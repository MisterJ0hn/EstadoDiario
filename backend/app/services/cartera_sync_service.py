"""Cruce de los tres reportes contra la cartera (`causa` y `causa_corte`).

**El problema.** Los tres Excel del PJUD hablan de las mismas causas y ninguno
las trae todas. El de Causas es la cartera, pero una causa puede moverse —y
aparecer en Movimientos o en el Estado Diario— antes de figurar ahí, o traer un
estado más fresco. Este módulo las junta: rellena lo que falta, actualiza el
estado y da de alta lo que la cartera no tiene.

**La llave es `rol + tribunal`**, y esto está medido, no supuesto. Sobre una
cartera real de 12.248 causas:

    rol                        9.734 combinaciones
    rol + materia              9.875     (la materia casi no discrimina)
    rol + tribunal            10.595
    rol + tribunal + materia  10.595     ← idéntico: la materia NO aporta nada

El rol se renumera en cada tribunal, así que `C-17-2021` existe a la vez en ocho
juzgados civiles distintos; el tribunal es lo que separa. Y agregarle la materia
a esa llave da exactamente el mismo número, porque el tribunal ya determina la
materia. De ahí sale también `_materia_por_tribunal`: para una causa que llega
del Estado Diario —que no dice de qué materia es— la materia se deduce del
tribunal, que es un dato que sí trae.

Las repeticiones que quedan bajo esa llave (1.653 en esa cartera) son la MISMA
causa repetida en el Excel, verificado: en cero de esos grupos difiere el
caratulado. Por eso el cruce actualiza todas las filas de un grupo y no elige
una.

**En corte la llave se construye.** Causas y Movimientos traen `Rol` y `Era` en
columnas separadas; el Estado Diario los trae pegados en un solo campo:

    Causas / Movimientos   Rol="2786"  Era="2026"  Corte="C.A. de Valparaíso"
    Estado Diario Corte    Número de Ingreso = "Civil-2786-2026"

Se parsea `<materia>-<rol>-<era>` y se cruza por `rol + era + corte`. Corte
Suprema no trae columna Corte —hay una sola— así que ahí la llave es `rol + era`.

**Qué puede aportar cada reporte.** No es simétrico y conviene saberlo antes de
buscar un estado que nunca va a llegar:

| Reporte              | ¿Trae estado?                  |
|----------------------|--------------------------------|
| Causas               | Sí, salvo Cobranza             |
| Movimientos          | Sí, en todas las hojas         |
| Estado Diario        | Solo Penal y Familia           |
| Estado Diario Corte  | **Nunca**: no tiene la columna |

En la práctica el estado lo mueve Movimientos. El Estado Diario aporta sobre
todo altas y campos vacíos (tribunal, caratulado, ubicación).

**Dónde escribe.** Sobre la foto de cartera vigente, la del último archivo de
Causas. Eso significa que una carga nueva de Causas deja atrás lo enriquecido,
y por eso el cruce se vuelve a correr al cerrar cada importación: se reconstruye
en vez de acumularse.
"""

import logging
import re
from datetime import date, datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.causa import (
    ORIGEN_DATO_AUDIENCIAS,
    ORIGEN_DATO_CAUSAS,
    ORIGEN_DATO_ESTADO_DIARIO,
    ORIGEN_DATO_MOVIMIENTOS,
    Causa,
)
from app.models.audiencia import Audiencia
from app.models.causa_corte import CausaCorte
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.movimiento import Movimiento
from app.models.movimiento_corte import MovimientoCorte

logger = logging.getLogger(__name__)

# `Civil-2786-2026` → materia, rol, era. La materia del prefijo se ignora: el
# tipo de corte sale de la hoja, que es más confiable que un prefijo de texto.
_NUMERO_INGRESO = re.compile(r"^\s*(?P<materia>.+?)-(?P<rol>\d+)-(?P<era>\d{4})\s*$")

# Campos que se sobrescriben aunque ya tengan valor, porque cambian por
# naturaleza: dónde está la causa hoy y en qué estado. El resto solo se rellena
# si está vacío — pisar un caratulado con otro sería inventar.
_CAMPOS_VOLATILES_CAUSA = ("estado_causa",)
_CAMPOS_VOLATILES_CORTE = ("estado_procesal", "ubicacion", "fecha_ubicacion")


def _norm(valor: Optional[str]) -> str:
    """Recorta y normaliza a minúsculas para comparar.

    Los Excel del PJUD traen espacios de sobra ("Tramitación         ") y el
    mismo tribunal escrito con distinta caja. Se comparó el cruce entre los tres
    reportes de un mismo estudio y con esto calzan 82/82 y 43/43.
    """
    return (valor or "").strip().lower()


def _vacio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


class ResultadoSync:
    """Qué hizo el cruce. Se registra en el log y lo devuelve el job."""

    def __init__(self) -> None:
        self.causas_creadas = 0
        self.causas_actualizadas = 0
        self.cortes_creadas = 0
        self.cortes_actualizadas = 0
        self.estados_cambiados = 0
        # Filas de origen que no se pudieron identificar (les falta el rol o el
        # tribunal). Se cuentan y se informan en vez de descartarlas en
        # silencio: un número alto acá suele delatar datos mal clasificados.
        self.omitidas_sin_llave = 0
        # Causas a las que se les puso o corrigió la fecha de última actividad.
        self.actividad_calculada = 0
        self.sin_cartera = False
        # El cruce tuvo que armar la cartera porque el estudio no ha cargado el
        # reporte de Causas. Lo lee la respuesta de la carga para poder
        # advertirlo: esa cartera es parcial y se factura.
        self.cartera_deducida = False

    @property
    def hubo_cambios(self) -> bool:
        return bool(
            self.causas_creadas or self.causas_actualizadas
            or self.cortes_creadas or self.cortes_actualizadas
        )

    def __str__(self) -> str:
        deducida = (
            " · cartera DEDUCIDA: el estudio no ha cargado el reporte de Causas"
            if self.cartera_deducida
            else ""
        )
        omitidas = (
            f" · {self.omitidas_sin_llave} filas sin rol o sin tribunal, omitidas"
            if self.omitidas_sin_llave
            else ""
        )
        return (
            f"materia: {self.causas_creadas} creadas / {self.causas_actualizadas} "
            f"actualizadas · corte: {self.cortes_creadas} creadas / "
            f"{self.cortes_actualizadas} actualizadas · "
            f"{self.estados_cambiados} estados{omitidas}{deducida}"
        )

    def como_aviso(self) -> Optional[str]:
        """Lo que hay que decirle a quien acaba de cargar un archivo, o None.

        Solo devuelve texto cuando hay algo que el usuario tiene que saber; el
        detalle completo vive en el log. Hoy eso es una cosa: que su cartera se
        armó sola porque falta el reporte de Causas.
        """
        if not self.cartera_deducida:
            return None
        return (
            f"Este estudio no tiene cargado el reporte de Causas, así que "
            f"Mis Causas se armó con lo que traen los archivos cargados "
            f"({self.causas_creadas + self.cortes_creadas} causas). Es una "
            f"cartera parcial: cargue el reporte de Causas para reemplazarla "
            f"por la completa."
        )


class CarteraSyncService:
    """Cruza los reportes contra la cartera de UN cliente.

    Recibe la sesión del tenant ya abierta: quien llama sabe de qué cliente se
    trata (el importador que acaba de cerrar, o el job que recorre a todos).
    """

    def __init__(self, db: Session):
        self.db = db
        self.ahora = datetime.now(timezone.utc)

    # ── Entrada ───────────────────────────────────────────

    def sincronizar(self) -> ResultadoSync:
        """Cruza todo contra la cartera vigente. No hace commit.

        Sin commit a propósito: se llama desde dentro de la transacción del
        importador, para que una importación no pueda quedar a medio cruzar.
        """
        resultado = ResultadoSync()

        origen_cartera = self._origen_cartera()
        if origen_cartera is None:
            origen_cartera = self._crear_cartera_deducida()
            resultado.cartera_deducida = True

        self._sincronizar_materia(origen_cartera, resultado)
        self._sincronizar_corte(origen_cartera, resultado)
        self._calcular_ultima_actividad(origen_cartera, resultado)
        logger.info("Cruce de cartera: %s", resultado)
        return resultado

    # ── Última señal de vida ──────────────────────────────

    def _calcular_ultima_actividad(
        self, origen_cartera: EstadoDiarioOrigen, resultado: ResultadoSync
    ) -> None:
        """Cuándo apareció por última vez cada causa en algún reporte.

        Tres fuentes, y cada una fecha distinto:

        - **Estado diario** y **movimientos**: la fecha del ARCHIVO, no la de
          ingreso de la causa. Que una causa figure en el estado diario del 5 de
          agosto significa que se movió ese día.
        - **Audiencias**: la fecha de la audiencia, y solo si **ya pasó**. Una
          audiencia futura no es actividad todavía; esa va por su propio lado
          (ver la próxima audiencia en el listado de la cartera).

        Se resuelve en tres consultas agregadas y no recorriendo causas: con
        12.000 filas, preguntar por cada una serían 12.000 viajes a la base.
        """
        cartera = (
            self.db.query(Causa)
            .filter(Causa.estado_diario_origen_id == origen_cartera.id)
            .all()
        )
        if not cartera:
            return

        # {(rol, tribunal): (fecha, de qué reporte)}, quedándose con la más nueva.
        mejor: Dict[Tuple[str, str], Tuple[date, str]] = {}

        def registrar(clave, fecha, procedencia):
            if fecha is None or not clave[0] or not clave[1]:
                return
            actual = mejor.get(clave)
            if actual is None or fecha > actual[0]:
                mejor[clave] = (fecha, procedencia)

        for modelo, procedencia in (
            (Movimiento, ORIGEN_DATO_MOVIMIENTOS),
            (EstadoDiario, ORIGEN_DATO_ESTADO_DIARIO),
        ):
            filas = (
                self.db.query(
                    modelo.rol, modelo.tribunal, func.max(EstadoDiarioOrigen.fecha)
                )
                .join(EstadoDiarioOrigen,
                      modelo.estado_diario_origen_id == EstadoDiarioOrigen.id)
                .group_by(modelo.rol, modelo.tribunal)
                .all()
            )
            for rol, tribunal, fecha in filas:
                registrar((_norm(rol), _norm(tribunal)), fecha, procedencia)

        hoy = date.today()
        filas = (
            self.db.query(
                Audiencia.rol, Audiencia.tribunal, func.max(Audiencia.fecha_audiencia)
            )
            .filter(Audiencia.fecha_audiencia <= hoy)
            .group_by(Audiencia.rol, Audiencia.tribunal)
            .all()
        )
        for rol, tribunal, fecha in filas:
            registrar((_norm(rol), _norm(tribunal)), fecha, ORIGEN_DATO_AUDIENCIAS)

        for causa in cartera:
            dato = mejor.get((_norm(causa.rol), _norm(causa.tribunal)))
            if dato is None:
                continue
            fecha, procedencia = dato
            if causa.ultima_actividad != fecha:
                causa.ultima_actividad = fecha
                causa.origen_actividad = procedencia
                resultado.actividad_calculada += 1

    def _origen_cartera(self) -> Optional[EstadoDiarioOrigen]:
        """La cartera sobre la que se escribe.

        Mismo orden que `ultimo_origen_causas_id`, y tiene que seguir siéndolo:
        si el cruce escribiera sobre una cartera distinta de la que muestra Mis
        Causas, lo enriquecido no aparecería en ninguna pantalla. Una cargada le
        gana a una deducida; después manda la fecha del reporte.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS)
            .order_by(
                EstadoDiarioOrigen.deducida.asc(),
                EstadoDiarioOrigen.fecha.desc(),
                EstadoDiarioOrigen.id.desc(),
            )
            .first()
        )

    def _crear_cartera_deducida(self) -> EstadoDiarioOrigen:
        """Arma la cartera con lo que traigan los otros reportes.

        **Esto se decidió a sabiendas y conviene tenerlo escrito.** Hasta acá el
        cruce se detenía sin cartera, porque el origen que se creara pasa a ser
        *la* cartera: se muestra en Mis Causas y la facturación cuenta sus
        causas vigentes. Con este cambio, un estudio que solo carga el estado
        diario ve su cartera poblarse —y se le cobra por esas causas—, que es
        lo que se pidió.

        Lo que hay que saber al mirar el resultado:

        - **Es parcial por construcción.** El estado diario de un día trae
          decenas de causas; el reporte de Causas del mismo RUT, miles. Esta
          cartera crece de a poco, con lo que se haya movido.
        - **Queda marcada** (`deducida`), y cada causa lleva además su
          `origen_dato`, así que siempre se puede explicar de dónde salió cada
          fila y por qué se cobró.
        - **La reemplaza el reporte real.** Cuando el estudio cargue el Excel de
          Causas, ese archivo manda y esta cartera se descarta (ver
          `CausaImportService.import_file`).

        La fecha es la de hoy y no la del archivo que gatilla: es la fecha en
        que esta foto se armó, y `ultimo_origen_causas_id` ordena por ella.
        """
        origen = EstadoDiarioOrigen(
            tipo=EstadoDiarioOrigen.TIPO_CAUSAS,
            fecha=self.ahora.date(),
            fecha_carga=self.ahora,
            nombre_archivo="(cartera deducida de los reportes cargados)",
            deducida=True,
        )
        self.db.add(origen)
        # `flush` y no `commit`: el cruce corre dentro de la transacción del
        # importador, y el id hace falta ya para colgarle las causas.
        self.db.flush()
        logger.warning(
            "El estudio no tiene reporte de Causas: se creó la cartera %d a "
            "partir de los otros reportes. Es parcial y se factura.",
            origen.id,
        )
        return origen

    # ── Primera instancia ─────────────────────────────────

    def _sincronizar_materia(
        self, origen_cartera: EstadoDiarioOrigen, resultado: ResultadoSync
    ) -> None:
        cartera = (
            self.db.query(Causa)
            .filter(Causa.estado_diario_origen_id == origen_cartera.id)
            .all()
        )
        # Un grupo por llave, no una fila: el Excel repite la misma causa y hay
        # que actualizarlas todas o quedarían diciendo cosas distintas.
        indice: Dict[Tuple[str, str], List[Causa]] = {}
        for c in cartera:
            indice.setdefault((_norm(c.rol), _norm(c.tribunal)), []).append(c)

        materia_de = self._materia_por_tribunal(cartera)
        fecha_cartera = origen_cartera.fecha

        for fila, origen, procedencia in self._fuentes_materia():
            clave = (_norm(fila.rol), _norm(fila.tribunal))
            if not clave[0] or not clave[1]:
                # La llave es `rol + tribunal`: sin las dos partes no se puede
                # decir de qué causa habla la fila, y darla de alta crearía una
                # causa que después nadie va a poder cruzar con nada.
                #
                # No es hipotético: el importador viejo guardaba las causas de
                # CORTE en esta misma tabla, con el rol en formato de corte
                # ("Civil-1404-2026"), la corte puesta y el tribunal vacío. Sin
                # esta guarda entraban a la cartera como causas de materia sin
                # materia — y se facturaban.
                resultado.omitidas_sin_llave += 1
                continue

            datos = self._datos_de_materia(fila, procedencia, materia_de)
            grupo = indice.get(clave)
            if grupo:
                for causa in grupo:
                    if self._aplicar(causa, datos, origen, fecha_cartera,
                                     _CAMPOS_VOLATILES_CAUSA, resultado):
                        resultado.causas_actualizadas += 1
            else:
                causa = Causa(
                    estado_diario_origen_id=origen_cartera.id,
                    origen_dato=procedencia,
                    enriquecida_en=self.ahora,
                    **datos,
                )
                self.db.add(causa)
                indice[clave] = [causa]
                resultado.causas_creadas += 1

    def _fuentes_materia(self):
        """Las filas de Movimientos y Estado Diario, de la más vieja a la más nueva.

        El orden importa: se aplica en secuencia y la última escritura gana, que
        es exactamente la regla de precedencia por fecha del archivo. Se recorren
        TODOS los archivos y no solo el último porque el estado diario es noticia
        de un día: cada archivo habla de causas distintas.
        """
        for modelo, procedencia in (
            (Movimiento, ORIGEN_DATO_MOVIMIENTOS),
            (EstadoDiario, ORIGEN_DATO_ESTADO_DIARIO),
        ):
            filas = (
                self.db.query(modelo, EstadoDiarioOrigen)
                .join(EstadoDiarioOrigen,
                      modelo.estado_diario_origen_id == EstadoDiarioOrigen.id)
                .order_by(EstadoDiarioOrigen.fecha.asc(), EstadoDiarioOrigen.id.asc())
                .all()
            )
            for fila, origen in filas:
                yield fila, origen, procedencia

    @staticmethod
    def _materia_por_tribunal(cartera: List[Causa]) -> Dict[str, str]:
        """`tribunal → materia`, sacado de la propia cartera del cliente.

        El Estado Diario no dice de qué materia es cada causa, pero sí de qué
        tribunal, y el tribunal determina la materia (por eso agregar la materia
        a la llave `rol + tribunal` no cambia el conteo). Así una causa que llega
        del estado diario entra a la cartera con su materia y no como "Sin
        materia", que la sacaría de su grupo en la factura.
        """
        mapa: Dict[str, str] = {}
        for c in cartera:
            t, m = _norm(c.tribunal), (c.materia or "").strip()
            if t and m:
                mapa.setdefault(t, m)
        return mapa

    @staticmethod
    def _datos_de_materia(fila, procedencia: str, materia_de: Dict[str, str]) -> dict:
        """Traduce una fila de Movimientos o Estado Diario al esquema de `Causa`.

        Las dos tablas nombran distinto lo mismo: `Movimiento.estado_causa` y
        `EstadoDiario.estado` son la misma columna del Excel con otro título.
        """
        comunes = {
            "rol": fila.rol,
            "tribunal": fila.tribunal,
            "caratulado": fila.caratulado,
            "fecha_ingreso": fila.fecha_ingreso,
            "jurisdiccion_id": fila.jurisdiccion_id,
        }
        if procedencia == ORIGEN_DATO_MOVIMIENTOS:
            return {
                **comunes,
                "materia": fila.materia,
                "estado_causa": fila.estado_causa,
                "institucion": fila.institucion,
            }
        return {
            **comunes,
            # El estado diario no trae materia; se deduce del tribunal.
            "materia": materia_de.get(_norm(fila.tribunal)),
            "estado_causa": fila.estado,
            "tipo_causa": fila.tipo_causa,
            # "Rol Unico" del estado diario es el RUC de la cartera.
            "ruc": fila.rol_unico,
        }

    # ── Corte ─────────────────────────────────────────────

    def _sincronizar_corte(
        self, origen_cartera: EstadoDiarioOrigen, resultado: ResultadoSync
    ) -> None:
        cartera = (
            self.db.query(CausaCorte)
            .filter(CausaCorte.estado_diario_origen_id == origen_cartera.id)
            .all()
        )
        indice: Dict[Tuple[str, str, str, str], List[CausaCorte]] = {}
        for c in cartera:
            indice.setdefault(self._clave_corte(c.tipo, c.rol, c.era, c.corte), []).append(c)

        fecha_cartera = origen_cartera.fecha

        for fila, origen, procedencia in self._fuentes_corte():
            datos = self._datos_de_corte(fila, procedencia)
            if datos is None:
                continue
            clave = self._clave_corte(
                datos["tipo"], datos.get("rol"), datos.get("era"), datos.get("corte")
            )
            if not clave[1]:
                continue

            grupo = indice.get(clave)
            if grupo:
                for causa in grupo:
                    if self._aplicar(causa, datos, origen, fecha_cartera,
                                     _CAMPOS_VOLATILES_CORTE, resultado):
                        resultado.cortes_actualizadas += 1
            else:
                nueva = CausaCorte(
                    estado_diario_origen_id=origen_cartera.id,
                    origen_dato=procedencia,
                    enriquecida_en=self.ahora,
                    **datos,
                )
                self.db.add(nueva)
                indice[clave] = [nueva]
                resultado.cortes_creadas += 1

    def _fuentes_corte(self):
        for modelo, procedencia in (
            (MovimientoCorte, ORIGEN_DATO_MOVIMIENTOS),
            (EstadoDiarioCorte, ORIGEN_DATO_ESTADO_DIARIO),
        ):
            filas = (
                self.db.query(modelo, EstadoDiarioOrigen)
                .join(EstadoDiarioOrigen,
                      modelo.estado_diario_origen_id == EstadoDiarioOrigen.id)
                .order_by(EstadoDiarioOrigen.fecha.asc(), EstadoDiarioOrigen.id.asc())
                .all()
            )
            for fila, origen in filas:
                yield fila, origen, procedencia

    @staticmethod
    def _clave_corte(tipo, rol, era, corte) -> Tuple[str, str, str, str]:
        """`(tipo, rol, era, corte)`, ya normalizada.

        En Suprema `corte` viene vacío —hay una sola Corte Suprema— así que la
        llave efectiva ahí es `rol + era`, que es lo correcto.
        """
        return (_norm(tipo), _norm(rol), _norm(era), _norm(corte))

    @classmethod
    def _datos_de_corte(cls, fila, procedencia: str) -> Optional[dict]:
        """Traduce una fila de corte al esquema de `CausaCorte`.

        Devuelve None cuando la fila no se puede identificar: en el estado
        diario el rol viene pegado dentro del número de ingreso y si ese texto
        no tiene la forma esperada, no hay con qué cruzar.
        """
        if procedencia == ORIGEN_DATO_MOVIMIENTOS:
            return {
                "tipo": fila.tipo,
                "rol": fila.rol,
                "era": fila.era,
                "corte": fila.corte,
                "fecha_ingreso": fila.fecha_ingreso,
                "caratulado": fila.caratulado,
                # `estado_causa` en Movimientos es `estado_procesal` en la
                # cartera: mismo dato, otro título de columna.
                "estado_procesal": fila.estado_causa,
                "institucion": fila.institucion,
                "ubicacion": fila.ubicacion,
                "fecha_ubicacion": fila.fecha_ubicacion,
                "jurisdiccion_id": fila.jurisdiccion_id,
            }

        m = _NUMERO_INGRESO.match(fila.numero_ingreso or "")
        if not m:
            return None
        return {
            "tipo": fila.tipo,
            "rol": m.group("rol"),
            "era": m.group("era"),
            "corte": fila.corte,
            "fecha_ingreso": fila.fecha_ingreso,
            "caratulado": fila.caratulado,
            "ubicacion": fila.ubicacion,
            "fecha_ubicacion": fila.fecha_ubicacion,
            "jurisdiccion_id": fila.jurisdiccion_id,
            # Sin estado a propósito: el estado diario de corte no trae la
            # columna. Ver la tabla del encabezado del módulo.
        }

    # ── Aplicación ────────────────────────────────────────

    def _aplicar(
        self,
        destino,
        datos: dict,
        origen: EstadoDiarioOrigen,
        fecha_cartera,
        volatiles: Tuple[str, ...],
        resultado: ResultadoSync,
    ) -> bool:
        """Vuelca los datos sobre la fila de la cartera. Devuelve si cambió algo.

        Dos reglas y una excepción:

        - Un campo VACÍO se rellena siempre. Que un reporte traiga un dato que
          el otro no tenía es justo lo que se busca acá.
        - Un campo con valor NO se toca, salvo los volátiles (estado, ubicación),
          que cambian por naturaleza y donde el dato viejo es el equivocado.
        - Un volátil solo se pisa si la fuente es **más nueva que la cartera**.
          Con fechas iguales manda el Excel de Causas: es el reporte que define
          la cartera, y un empate no es razón para reescribirlo.

        Un nulo nunca pisa a un valor existente: que un reporte no traiga la
        columna no significa que la causa haya perdido el dato.
        """
        mas_nueva = (
            origen.fecha is not None
            and fecha_cartera is not None
            and origen.fecha > fecha_cartera
        )
        cambio = False

        for campo, valor in datos.items():
            if _vacio(valor):
                continue
            actual = getattr(destino, campo, None)
            if _vacio(actual):
                setattr(destino, campo, valor)
                cambio = True
            elif campo in volatiles and mas_nueva and _norm(str(actual)) != _norm(str(valor)):
                setattr(destino, campo, valor)
                cambio = True
                if campo in ("estado_causa", "estado_procesal"):
                    resultado.estados_cambiados += 1

        if cambio:
            destino.enriquecida_en = self.ahora
        return cambio


def sincronizar_cartera(db: Session) -> ResultadoSync:
    """Atajo para los importadores: cruza y devuelve el resumen, sin commit."""
    return CarteraSyncService(db).sincronizar()
