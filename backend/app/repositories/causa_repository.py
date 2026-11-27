"""Consultas de la cartera de causas (hojas por materia del reporte Causas).

No confundir con `movimiento_repository`: movimientos es el estado procesal de
lo que se está tramitando; esto es el universo de causas del estudio, se hayan
movido o no.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import math
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, func, or_, select, tuple_
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.estados_causa import FINALIZADAS, VIGENTES, condicion_vigencia
from app.core.filtro_roles import RolFiltro, filtrar_por_roles, norm_tribunal_sql
from app.models.audiencia import Audiencia
from app.models.causa import Causa
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.usuario_rut import limpiar_rut

# `VIGENTES` y `FINALIZADAS` se re-exportan desde `app.core.estados_causa`: los
# endpoints y los otros repositorios los importan desde acá desde antes, y la
# regla vive allá.
__all__ = [
    "VIGENTES", "FINALIZADAS", "SIN_MATERIA",
    "ultimo_origen_causas_id", "origenes_cartera_ids", "solo_ultima_version",
    "CausaRepository",
]

# Valor que manda el frontend para la pestaña "Sin materia" (causas de la
# cartera deducida cuyo tribunal no calzó con ninguna materia conocida, ver
# `CarteraSyncService._materia_por_tribunal`). No puede ser "" ni None: las dos
# pantallas (Angular y este filtro) tratan esos dos valores como "sin filtro" —
# de ahí que la pestaña "Todas" y la pestaña "Sin materia" terminaran mostrando
# lo mismo antes de este sentinel.
SIN_MATERIA = "__sin_materia__"


def ultimo_origen_causas_id(db: Session) -> Optional[int]:
    """El archivo de causas más reciente, que ES la cartera de hoy.

    **El Excel de Causas trae la cartera completa, no las novedades.** Cada
    carga inserta otra vez todas las causas del estudio con su propio origen,
    así que sumar las filas de todos los archivos multiplica la cartera por la
    cantidad de veces que se cargó el reporte.

    **Una cartera cargada le gana a una deducida, sea cual sea la fecha.** La
    deducida es el reemplazo que arma el cruce mientras el estudio no sube el
    reporte de Causas (ver `CarteraSyncService._crear_cartera_deducida`), y es
    parcial: si ganara por ser más nueva, un estudio con su reporte de Causas
    del mes pasado pasaría a mostrar —y a facturar— las pocas causas que se
    movieron esta semana. Por eso `deducida` ordena primero.

    Después se ordena por `fecha` —la del reporte, no la de carga— porque es la
    que dice a qué día corresponde la foto; `id` desempata cuando el mismo día
    se cargó más de una vez.

    Vive suelta y no en la clase porque la usan los dos repositorios de la
    cartera —el de materia y el de corte— y las dos hojas salen del MISMO
    archivo: si cada uno eligiera el suyo, la pantalla de Corte podría estar
    mostrando un reporte distinto que la de Materia.
    """
    fila = (
        db.query(EstadoDiarioOrigen.id)
        .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS)
        .order_by(
            EstadoDiarioOrigen.deducida.asc(),
            EstadoDiarioOrigen.fecha.desc(),
            EstadoDiarioOrigen.id.desc(),
        )
        .first()
    )
    return fila[0] if fila else None


def origenes_cartera_ids(db: Session) -> list[int]:
    """Los archivos de causas que forman la cartera: el más reciente de CADA RUT.

    Cuando el estudio carga un reporte por abogado, cada archivo trae solo la
    cartera de ese abogado. Quedarse con un único archivo (`ultimo_origen_causas_id`)
    mostraba únicamente al último abogado cargado y escondía al resto.

    Dentro de un mismo RUT sigue valiendo lo de siempre: el reporte trae la cartera
    completa, así que solo cuenta el más reciente (sumar los anteriores
    multiplicaría las causas).

    Una cartera cargada le gana a una deducida; si solo hay deducidas, es una
    sola (la más reciente), porque es parcial y una por RUT no tiene sentido.

    El primero de la lista es el mismo que devuelve `ultimo_origen_causas_id`.
    Lista vacía si no hay ningún archivo de causas.
    """
    filas = (
        db.query(EstadoDiarioOrigen.id, EstadoDiarioOrigen.rut, EstadoDiarioOrigen.deducida)
        .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS)
        .order_by(
            EstadoDiarioOrigen.deducida.asc(),
            EstadoDiarioOrigen.fecha.desc(),
            EstadoDiarioOrigen.id.desc(),
        )
        .all()
    )
    if not filas:
        return []
    if filas[0].deducida:
        return [filas[0].id]
    vistos: dict = {}
    for f in filas:
        if f.deducida:
            continue
        vistos.setdefault(limpiar_rut(f.rut or "") or f"origen-{f.id}", f.id)
    return list(vistos.values())


def solo_ultima_version(query, entidad, origenes: list[int], claves):
    """Acota `query` a UNA fila por causa cuando la cartera viene de varios archivos.

    Una misma causa puede estar en el archivo de dos abogados. Sin esto se
    listaría y se contaría dos veces. Se queda la del archivo más reciente; las
    repetidas DENTRO de un mismo archivo no se tocan (eso ya lo resuelve la
    importación). Con un solo archivo no hay nada que deduplicar.

    `claves(modelo)` devuelve las expresiones que identifican la causa. La
    subconsulta va sobre un alias para que no se confunda con la consulta externa.
    """
    if len(origenes) < 2:
        return query
    otra = aliased(entidad)
    sub = (
        select(*claves(otra), func.max(otra.estado_diario_origen_id))
        .where(otra.estado_diario_origen_id.in_(origenes))
        .group_by(*claves(otra))
    )
    return query.filter(tuple_(*claves(entidad), entidad.estado_diario_origen_id).in_(sub))


def _claves_causa(modelo):
    return (
        func.coalesce(func.lower(func.trim(modelo.rol)), ""),
        func.coalesce(norm_tribunal_sql(modelo.tribunal), ""),
    )


class CausaRepository:
    def __init__(self, db: Session):
        self.db = db

    def ultimo_origen_id(self) -> Optional[int]:
        return ultimo_origen_causas_id(self.db)

    def origenes_cartera(self) -> list[int]:
        return origenes_cartera_ids(self.db)

    def find_by_id(self, causa_id: int) -> Optional[Causa]:
        return self.db.get(Causa, causa_id)

    def find_pjud_por_rol_tribunal(self, rol: str, tribunal: str) -> Optional[Causa]:
        """La Causa Civil, Familia, Laboral, Cobranza o Penal de la cartera VIGENTE
        (el último archivo) que calza por rol y tribunal, sin distinguir
        mayúsculas ni espacios de sobra.

        Para ofrecer el botón "Detalle PJUD" desde pantallas que no tienen el
        id de la Causa —Estado Diario, Movimientos— y solo conocen su rol y
        tribunal. `None` si no hay cartera cargada, si no calza ninguna, o si
        la que calza no es de una materia que expone la API del PJUD."""
        origenes = self.origenes_cartera()
        if not origenes or not rol or not tribunal:
            return None
        return (
            self.db.query(Causa)
            .filter(
                Causa.estado_diario_origen_id.in_(origenes),
                Causa.retirada_en.is_(None),
                Causa.materia.in_(("Civil", "Familia", "Laboral", "Cobranza", "Penal")),
                func.lower(func.btrim(Causa.rol)) == rol.strip().lower(),
                func.lower(func.btrim(Causa.tribunal)) == tribunal.strip().lower(),
            )
            .order_by(Causa.estado_diario_origen_id.desc(), Causa.id)
            .first()
        )

    def find_origen(self, rut: str, fecha) -> Optional[EstadoDiarioOrigen]:
        """El archivo de causas ya cargado para ese RUT y fecha, si existe.

        El tipo entra en la búsqueda: un estado diario y unas causas del mismo
        día y RUT son archivos distintos y los dos pueden convivir.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.rut == rut,
                EstadoDiarioOrigen.fecha == fecha,
                EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS,
            )
            .first()
        )

    @staticmethod
    def _condicion_vigencia(vigencia: Optional[str]):
        """Condición de vigencia sobre `Causa.estado_causa`, o None.

        La regla vive en `app.core.estados_causa`: son cuatro las pantallas que
        filtran por esto y tenerla escrita cuatro veces haría que agregar un
        estado terminal arreglara unas y dejara otras mintiendo.
        """
        return condicion_vigencia(Causa.estado_causa, vigencia)

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        materia: Optional[str],
        estado_causa: Optional[str],
        tribunal: Optional[str],
        busqueda: Optional[str],
        origen_id: Optional[int | list[int]],
        vigencia: Optional[str] = None,
        roles: Optional[list[RolFiltro]] = None,
    ):
        if materia == SIN_MATERIA:
            query = query.filter(Causa.materia.is_(None))
        elif materia:
            query = query.filter(Causa.materia == materia)
        if estado_causa:
            query = query.filter(Causa.estado_causa == estado_causa)
        if tribunal:
            # Parcial: el nombre del tribunal viene con variantes.
            query = query.filter(Causa.tribunal.ilike(f"%{tribunal}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(
                    Causa.caratulado.ilike(patron),
                    Causa.rol.ilike(patron),
                    Causa.ruc.ilike(patron),
                )
            )
        # Una retirada (dejó de venir en el reporte de su abogado) no es parte de
        # la cartera: ni se ve, ni se cuenta, ni se factura.
        query = query.filter(Causa.retirada_en.is_(None))
        if origen_id:
            origenes = origen_id if isinstance(origen_id, list) else [origen_id]
            query = query.filter(Causa.estado_diario_origen_id.in_(origenes))
            # La causa compartida por dos abogados cuenta una vez, ANTES de los
            # demás filtros: si no, el estado de un archivo podría esconder al otro.
            query = solo_ultima_version(query, Causa, origenes, _claves_causa)
        condicion = cls._condicion_vigencia(vigencia)
        if condicion is not None:
            query = query.filter(condicion)
        return filtrar_por_roles(query, Causa.rol, Causa.tribunal, roles)

    def _acotar_a_la_cartera(self, origen_id: Optional[int]) -> int | list[int]:
        """El/los origen(es) por los que hay que filtrar: el pedido, o la cartera.

        Sin origen explícito se muestra el archivo más reciente de cada RUT, que
        es la cartera vigente (ver `origenes_cartera_ids`). Con origen explícito manda ese: es el caso de llegar
        desde Bitácora a ver qué trajo un archivo concreto, incluido uno viejo.

        Devuelve `-1` cuando no hay ningún archivo de causas cargado, para que
        la consulta no encuentre nada en vez de devolver la tabla entera.
        """
        if origen_id:
            return origen_id
        return self.origenes_cartera() or -1


    @staticmethod
    def _proximas_audiencias():
        """Subconsulta `(rol, tribunal) -> próxima audiencia`, desde hoy.

        Se resuelve **al consultar** y no en una columna denormalizada porque no
        depende de que entre un archivo: una audiencia deja de ser próxima
        cuando pasa el día, sola. Guardada, el listado seguiría anunciando una
        audiencia de la semana pasada hasta la siguiente importación.

        Es un agregado pequeño —un estudio tiene decenas de audiencias, no miles—
        que se une a la página ya filtrada, no una subconsulta por fila.
        """
        return (
            select(
                func.lower(func.btrim(Audiencia.rol)).label("rol"),
                func.lower(func.btrim(Audiencia.tribunal)).label("tribunal"),
                func.min(Audiencia.fecha_audiencia).label("fecha"),
            )
            .where(Audiencia.fecha_audiencia >= func.current_date())
            .group_by(
                func.lower(func.btrim(Audiencia.rol)),
                func.lower(func.btrim(Audiencia.tribunal)),
            )
            .subquery()
        )

    @classmethod
    def _con_audiencia(cls, query, prox):
        """Une la próxima audiencia a la consulta, sin descartar causas."""
        return query.outerjoin(
            prox,
            and_(
                func.lower(func.btrim(Causa.rol)) == prox.c.rol,
                func.lower(func.btrim(Causa.tribunal)) == prox.c.tribunal,
            ),
        )

    def find_filtered(
        self,
        materia: Optional[str] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        origen_id: Optional[int] = None,
        vigencia: Optional[str] = None,
        sin_actividad_meses: Optional[int] = None,
        con_audiencia_hasta: Optional[date] = None,
        orden: Optional[str] = None,
        roles: Optional[list[RolFiltro]] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        origen_id = self._acotar_a_la_cartera(origen_id)
        prox = self._proximas_audiencias()

        def armar(consulta):
            consulta = self._con_audiencia(consulta, prox)
            consulta = self._aplicar_filtros(
                consulta, materia, estado_causa, tribunal, busqueda, origen_id, vigencia,
                roles,
            )
            if sin_actividad_meses:
                # **Sin fecha NO cuenta como dormida.** Que una causa no aparezca
                # en ningún reporte puede significar que no se movió, o que el
                # estudio solo tiene cargados dos archivos de la semana pasada.
                # Son cosas distintas y el sistema no puede distinguirlas: de
                # 12.248 causas reales, 12.158 no tienen registro simplemente
                # porque no hay historial cargado, y meterlas acá convertía el
                # filtro en "muéstrame casi toda la cartera".
                #
                # Dormida es la que SÍ apareció alguna vez y hace rato que no.
                corte = date.today() - timedelta(days=30 * sin_actividad_meses)
                consulta = consulta.filter(
                    Causa.ultima_actividad.isnot(None), Causa.ultima_actividad <= corte
                )
            if con_audiencia_hasta is not None:
                consulta = consulta.filter(prox.c.fecha <= con_audiencia_hasta)
            return consulta

        base = armar(self.db.query(Causa, prox.c.fecha))
        total = armar(self.db.query(func.count(Causa.id))).scalar() or 0

        query = base.options(joinedload(Causa.estado_diario_origen))
        if orden == "actividad":
            # Las dormidas primero, que es para lo que sirve este orden. Las que
            # no tienen registro van al FINAL: no se sabe nada de ellas, y
            # ponerlas arriba llenaría la primera página de causas sobre las que
            # no hay nada que decir.
            query = query.order_by(
                Causa.ultima_actividad.asc().nullslast(), Causa.id.desc()
            )
        elif orden == "audiencia":
            query = query.order_by(prox.c.fecha.asc().nullslast(), Causa.id.desc())
        else:
            query = query.order_by(
                Causa.fecha_ingreso.desc().nullslast(), Causa.id.desc()
            )

        total_pages = 1
        pagina_actual = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            pagina_actual = max(1, min(page or 1, total_pages))
            query = query.offset((pagina_actual - 1) * limit).limit(limit)

        # Cada fila viene como (Causa, fecha). La fecha se cuelga del objeto para
        # que el endpoint la lea sin tener que saber de esta tupla.
        filas = []
        for causa, proxima in query.all():
            causa.proxima_audiencia = proxima
            filas.append(causa)
        return filas, total, pagina_actual, total_pages

    def contar_por_materia(
        self,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        origen_id: Optional[int] = None,
        vigencia: Optional[str] = None,
        roles: Optional[list[RolFiltro]] = None,
    ) -> list[tuple[Optional[str], int]]:
        """(materia, total) para las pestañas del listado.

        Respeta los filtros activos MENOS el de materia: los contadores tienen
        que decir cuánto hay en cada pestaña bajo el filtro actual, no cuánto
        hay en la pestaña que ya se está mirando. La vigencia sí entra: es un
        interruptor de toda la pantalla, no una pestaña.
        """
        query = self._aplicar_filtros(
            self.db.query(Causa.materia, func.count(Causa.id)),
            None, estado_causa, tribunal, busqueda,
            self._acotar_a_la_cartera(origen_id), vigencia, roles,
        )
        return [
            (fila[0], int(fila[1] or 0))
            for fila in query.group_by(Causa.materia).order_by(Causa.materia).all()
        ]

    def _origenes_de(self, origen_id: Optional[int]) -> list[int]:
        acotado = self._acotar_a_la_cartera(origen_id)
        return acotado if isinstance(acotado, list) else [acotado]

    def listar_estados_causa(self, origen_id: Optional[int] = None) -> list[str]:
        """Estados presentes en la cartera, para el combo del filtro.

        Acotado al mismo archivo que el listado: ofrecer un estado que ya no
        existe en la cartera actual es un filtro que solo puede dar cero.
        """
        query = (
            self.db.query(Causa.estado_causa)
            .filter(Causa.estado_causa.isnot(None), Causa.retirada_en.is_(None))
            .filter(Causa.estado_diario_origen_id.in_(self._origenes_de(origen_id)))
        )
        return sorted({fila[0].strip() for fila in query.distinct().all() if fila[0]})

    def contar_activas(self) -> int:
        """Causas por materia vigentes en la cartera actual.

        Es el número que la consola muestra por cliente y el que se factura a
        1 peso. Cuenta en SQL: traer las filas para contarlas en Python, con
        una cartera de 9.000 causas, es arrastrar la base entera al backend.
        """
        return (
            self._aplicar_filtros(
                self.db.query(func.count(Causa.id)),
                None, None, None, None, self._acotar_a_la_cartera(None), VIGENTES,
            ).scalar()
            or 0
        )
