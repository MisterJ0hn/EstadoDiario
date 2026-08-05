"""Consultas de agregación para el dashboard de gestión.

Dos reglas que no se negocian en este archivo:

1. **Todo se agrega en SQL.** Ninguna de estas consultas trae filas para
   contarlas en Python: se usan `func.count`, `group_by` y `COUNT(CASE WHEN)`.
   Un estudio con 200.000 movimientos no puede pagar traerlos al proceso.

2. **Permiso de visibilidad.** Igual que el resto de los repositorios,
   `jurisdicciones` es obligatorio (sin valor por defecto) y `None` significa
   "sin restricción". Lo resuelve `EstadoDiarioService.alcance()`. Un número
   del dashboard que sume causas que la persona no puede abrir la mandaría a
   buscar algo que no va a encontrar, así que el filtro se aplica en **cada**
   consulta, sin excepción.

Compatibilidad: la base de producción puede ser PostgreSQL 9.2. Por eso NO se
usa `FILTER (WHERE ...)`, ni `jsonb`, ni funciones de ventana. `COUNT(CASE WHEN
... THEN 1 END)` y `timezone(zona, timestamptz)` sí existen desde mucho antes.
"""

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audiencia import Audiencia
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion

# Niveles de urgencia del negocio. El orden es el que se muestra en el gráfico.
NIVELES = ("bajo", "medio", "alto")
NIVEL_POR_DEFECTO = "medio"


def _dia_local(columna):
    """Fecha calendario (en America/Santiago) de una columna timestamptz.

    Sin esto, un movimiento resuelto a las 21:30 de Chile se contaría al día
    siguiente, porque la columna se guarda en UTC.
    """
    return func.date(func.timezone(settings.TIMEZONE, columna))


class MetricasRepository:
    """Lecturas de solo agregación. No escribe nada."""

    def __init__(self, db: Session):
        self.db = db

    # ── Ayudas de alcance ────────────────────────────────────────────────
    @staticmethod
    def _acotar(query, columna, jurisdicciones: Optional[list[int]]):
        """Restringe a las jurisdicciones permitidas. Lo sin clasificar entra
        siempre: esconderlo lo haría desaparecer de los totales sin que nadie
        pueda notar que falta."""
        if jurisdicciones is None:
            return query
        return query.filter(or_(columna.in_(jurisdicciones), columna.is_(None)))

    def _q_estados(self, jurisdicciones: Optional[list[int]]):
        """Query base sobre estado_diario ya unida a su origen y acotada a lo
        que el usuario puede ver. Todo lo que consulte estados diarios debe
        partir de acá.
        """
        query = self.db.query(EstadoDiario).join(
            EstadoDiarioOrigen,
            EstadoDiario.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        return self._acotar(query, EstadoDiario.jurisdiccion_id, jurisdicciones)

    def _q_agendas(self, jurisdicciones: Optional[list[int]]):
        """Recordatorios acotados por la jurisdicción de SU CAUSA, igual que en
        EstadoDiarioAgendaRepository. Por eso necesita el join, que la consulta
        no traía cuando el criterio era el dueño del recordatorio."""
        query = self.db.query(EstadoDiarioAgenda).join(
            EstadoDiario, EstadoDiarioAgenda.estado_diario_id == EstadoDiario.id
        )
        return self._acotar(query, EstadoDiario.jurisdiccion_id, jurisdicciones)

    # ── KPIs ─────────────────────────────────────────────────────────────
    def contar_sin_revisar(self, jurisdicciones: Optional[list[int]]) -> int:
        """El "inbox": ni resuelto ni marcado pendiente. Es deuda acumulada,
        por eso NO se acota al período: un no leído de hace dos meses sigue
        siendo trabajo por hacer hoy.
        """
        return (
            self._q_estados(jurisdicciones)
            .filter(EstadoDiario.leido.is_(False), EstadoDiario.pendiente.is_(False))
            .with_entities(func.count(EstadoDiario.id))
            .scalar()
        ) or 0

    def contar_pendientes(self, jurisdicciones: Optional[list[int]]) -> int:
        """Marcados pendientes y todavía no resueltos (resuelto gana sobre
        pendiente, mismo criterio que el listado)."""
        return (
            self._q_estados(jurisdicciones)
            .filter(EstadoDiario.pendiente.is_(True), EstadoDiario.leido.is_(False))
            .with_entities(func.count(EstadoDiario.id))
            .scalar()
        ) or 0

    def contar_resueltos(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> int:
        """Resueltos dentro del período, por fecha_leido."""
        return (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiario.leido.is_(True),
                EstadoDiario.fecha_leido.isnot(None),
                _dia_local(EstadoDiario.fecha_leido) >= desde,
                _dia_local(EstadoDiario.fecha_leido) <= hasta,
            )
            .with_entities(func.count(EstadoDiario.id))
            .scalar()
        ) or 0

    def contar_recibidos(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> int:
        return (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiarioOrigen.fecha.isnot(None),
                EstadoDiarioOrigen.fecha >= desde,
                EstadoDiarioOrigen.fecha <= hasta,
            )
            .with_entities(func.count(EstadoDiario.id))
            .scalar()
        ) or 0

    def contar_recordatorios_vigentes(self, jurisdicciones: Optional[list[int]]) -> int:
        return (
            self._q_agendas(jurisdicciones)
            .filter(EstadoDiarioAgenda.finalizado.is_(False))
            .with_entities(func.count(EstadoDiarioAgenda.id))
            .scalar()
        ) or 0

    def contar_recordatorios_atrasados(
        self, jurisdicciones: Optional[list[int]], ahora: datetime
    ) -> int:
        return (
            self._q_agendas(jurisdicciones)
            .filter(
                EstadoDiarioAgenda.finalizado.is_(False),
                EstadoDiarioAgenda.fecha_hora < ahora,
            )
            .with_entities(func.count(EstadoDiarioAgenda.id))
            .scalar()
        ) or 0

    # ── Gráficos ─────────────────────────────────────────────────────────
    def atrasados_por_nivel(
        self, jurisdicciones: Optional[list[int]], ahora: datetime
    ) -> dict[str, int]:
        """Recordatorios vencidos abiertos, agrupados por urgencia.

        Se agrupa en SQL y se normaliza el nivel a minúsculas; cualquier valor
        fuera de bajo/medio/alto (o nulo) cae en "medio", que es el default del
        modelo.
        """
        filas = (
            self._q_agendas(jurisdicciones)
            .filter(
                EstadoDiarioAgenda.finalizado.is_(False),
                EstadoDiarioAgenda.fecha_hora < ahora,
            )
            .with_entities(
                func.lower(func.coalesce(EstadoDiarioAgenda.nivel, NIVEL_POR_DEFECTO)),
                func.count(EstadoDiarioAgenda.id),
            )
            .group_by(func.lower(func.coalesce(EstadoDiarioAgenda.nivel, NIVEL_POR_DEFECTO)))
            .all()
        )
        resultado = {n: 0 for n in NIVELES}
        for nivel, total in filas:
            clave = nivel if nivel in resultado else NIVEL_POR_DEFECTO
            resultado[clave] += int(total or 0)
        return resultado

    def recibidos_por_dia(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> dict[date, int]:
        """Estados diarios cuyo archivo tiene esa fecha.

        Se usa la fecha del archivo (no la de carga): si el archivo del lunes se
        subió el miércoles, el trabajo es del lunes.
        """
        filas = (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiarioOrigen.fecha.isnot(None),
                EstadoDiarioOrigen.fecha >= desde,
                EstadoDiarioOrigen.fecha <= hasta,
            )
            .with_entities(EstadoDiarioOrigen.fecha, func.count(EstadoDiario.id))
            .group_by(EstadoDiarioOrigen.fecha)
            .all()
        )
        return {f: int(t or 0) for f, t in filas}

    def resueltos_por_dia(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> dict[date, int]:
        dia = _dia_local(EstadoDiario.fecha_leido)
        filas = (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiario.leido.is_(True),
                EstadoDiario.fecha_leido.isnot(None),
                dia >= desde,
                dia <= hasta,
            )
            .with_entities(dia.label("dia"), func.count(EstadoDiario.id))
            .group_by(dia)
            .all()
        )
        return {self._a_fecha(f): int(t or 0) for f, t in filas}

    def composicion(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> dict[str, int]:
        """No leídos / pendientes / resueltos de los estados diarios recibidos
        en el período, en UNA sola pasada con COUNT(CASE WHEN).

        Se mira el período (fecha del archivo) y no el universo completo para
        que la dona responda al selector de días como el resto de la página.
        """
        fila = (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiarioOrigen.fecha.isnot(None),
                EstadoDiarioOrigen.fecha >= desde,
                EstadoDiarioOrigen.fecha <= hasta,
            )
            .with_entities(
                func.count(
                    case((EstadoDiario.leido.is_(True), 1), else_=None)
                ),
                func.count(
                    case(
                        (
                            (EstadoDiario.leido.is_(False))
                            & (EstadoDiario.pendiente.is_(True)),
                            1,
                        ),
                        else_=None,
                    )
                ),
                func.count(
                    case(
                        (
                            (EstadoDiario.leido.is_(False))
                            & (EstadoDiario.pendiente.is_(False)),
                            1,
                        ),
                        else_=None,
                    )
                ),
            )
            .one()
        )
        resueltos, pendientes, no_leidos = (int(v or 0) for v in fila)
        return {
            "no_leidos": no_leidos,
            "pendientes": pendientes,
            "resueltos": resueltos,
        }

    def por_tribunal(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date, limite: int = 10
    ) -> list[tuple[str, int]]:
        filas = (
            self._q_estados(jurisdicciones)
            .filter(
                EstadoDiarioOrigen.fecha.isnot(None),
                EstadoDiarioOrigen.fecha >= desde,
                EstadoDiarioOrigen.fecha <= hasta,
                EstadoDiario.tribunal.isnot(None),
                EstadoDiario.tribunal != "",
            )
            .with_entities(EstadoDiario.tribunal, func.count(EstadoDiario.id).label("total"))
            .group_by(EstadoDiario.tribunal)
            .order_by(func.count(EstadoDiario.id).desc())
            .limit(limite)
            .all()
        )
        return [(t, int(n or 0)) for t, n in filas]

    def por_jurisdiccion(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> list[tuple[str, int]]:
        filas = (
            self._q_estados(jurisdicciones)
            .outerjoin(Jurisdiccion, EstadoDiario.jurisdiccion_id == Jurisdiccion.id)
            .filter(
                EstadoDiarioOrigen.fecha.isnot(None),
                EstadoDiarioOrigen.fecha >= desde,
                EstadoDiarioOrigen.fecha <= hasta,
            )
            .with_entities(
                func.coalesce(Jurisdiccion.nombre, "Sin jurisdicción").label("nombre"),
                func.count(EstadoDiario.id).label("total"),
            )
            .group_by(func.coalesce(Jurisdiccion.nombre, "Sin jurisdicción"))
            .order_by(func.count(EstadoDiario.id).desc())
            .all()
        )
        return [(n, int(t or 0)) for n, t in filas]

    # ── Tiempo de resolución ─────────────────────────────────────────────
    def _dias_resolucion(self):
        """Días entre la fecha del estado diario y la fecha en que se resolvió.

        En PostgreSQL `date - date` da un entero, así que el promedio sale
        directo del motor sin restar fechas en Python.
        """
        return _dia_local(EstadoDiario.fecha_leido) - EstadoDiarioOrigen.fecha

    def _filtro_resueltos_con_fechas(self, query, desde: date, hasta: date):
        dia = _dia_local(EstadoDiario.fecha_leido)
        return query.filter(
            EstadoDiario.leido.is_(True),
            EstadoDiario.fecha_leido.isnot(None),
            EstadoDiarioOrigen.fecha.isnot(None),
            dia >= desde,
            dia <= hasta,
        )

    def promedio_resolucion(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> Optional[float]:
        valor = (
            self._filtro_resueltos_con_fechas(self._q_estados(jurisdicciones), desde, hasta)
            .with_entities(func.avg(self._dias_resolucion()))
            .scalar()
        )
        return round(float(valor), 1) if valor is not None else None

    def promedio_resolucion_por_dia(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> dict[date, float]:
        dia = _dia_local(EstadoDiario.fecha_leido)
        filas = (
            self._filtro_resueltos_con_fechas(self._q_estados(jurisdicciones), desde, hasta)
            .with_entities(dia.label("dia"), func.avg(self._dias_resolucion()))
            .group_by(dia)
            .all()
        )
        return {
            self._a_fecha(f): round(float(v), 1)
            for f, v in filas
            if v is not None
        }

    # ── Cumplimiento de recordatorios ────────────────────────────────────
    def cumplimiento_recordatorios(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> dict[str, int]:
        """De los recordatorios finalizados en el período, cuántos se cerraron
        antes de su fecha y cuántos después.

        Se comparan fechas calendario (no instantes): el recordatorio es un
        evento de todo el día, así que cerrarlo a las 18:00 del mismo día es
        "a tiempo".
        """
        dia_fin = _dia_local(EstadoDiarioAgenda.fecha_finalizacion)
        dia_obj = _dia_local(EstadoDiarioAgenda.fecha_hora)
        fila = (
            self._q_agendas(jurisdicciones)
            .filter(
                EstadoDiarioAgenda.finalizado.is_(True),
                EstadoDiarioAgenda.fecha_finalizacion.isnot(None),
                dia_fin >= desde,
                dia_fin <= hasta,
            )
            .with_entities(
                func.count(case((dia_fin <= dia_obj, 1), else_=None)),
                func.count(case((dia_fin > dia_obj, 1), else_=None)),
            )
            .one()
        )
        return {"a_tiempo": int(fila[0] or 0), "atrasados": int(fila[1] or 0)}

    # ── Audiencias ───────────────────────────────────────────────────────
    # Único bloque del dashboard que mira hacia ADELANTE: una audiencia es un
    # compromiso futuro, no trabajo ya ocurrido. Por eso su ventana es
    # [hoy, hoy+dias] y no el período que usan los demás gráficos.
    #
    # La jurisdicción se lee de `audiencia.jurisdiccion_id` y no del origen: la
    # audiencia sobrevive al borrado de su archivo (ON DELETE SET NULL), así
    # que el origen no sirve de fuente.
    def _q_audiencias(self, jurisdicciones: Optional[list[int]]):
        return self._acotar(
            self.db.query(Audiencia), Audiencia.jurisdiccion_id, jurisdicciones
        )

    def audiencias_por_dia_materia(
        self, jurisdicciones: Optional[list[int]], desde: date, hasta: date
    ) -> list[tuple[date, Optional[str], int]]:
        """(día, materia, total) de las audiencias de la ventana.

        Una sola consulta agrupada: de acá salen el apilado por día, los
        totales por materia y el total general. Traer tres consultas para lo
        mismo sería pagar tres veces el mismo escaneo.
        """
        filas = (
            self._q_audiencias(jurisdicciones)
            .filter(
                Audiencia.fecha_audiencia >= desde,
                Audiencia.fecha_audiencia <= hasta,
            )
            .with_entities(
                Audiencia.fecha_audiencia,
                Audiencia.materia,
                func.count(Audiencia.id),
            )
            .group_by(Audiencia.fecha_audiencia, Audiencia.materia)
            .all()
        )
        return [(self._a_fecha(f), m, int(n or 0)) for f, m, n in filas]

    def ultima_fecha_audiencia(self, jurisdicciones: Optional[list[int]]) -> Optional[date]:
        """Hasta qué día alcanzan las audiencias cargadas.

        El reporte del PJUD cubre una semana, así que en una ventana de 30 días
        los días de más aparecen vacíos. Sin este dato el gráfico miente igual
        que el de recibidos sin el aviso de carga: "no tengo audiencias" y "no
        tengo el archivo que las trae" se ven idénticos.
        """
        return (
            self._q_audiencias(jurisdicciones)
            .with_entities(func.max(Audiencia.fecha_audiencia))
            .scalar()
        )

    # ── Sesgo de carga ───────────────────────────────────────────────────
    def ultima_fecha_archivo(self) -> Optional[date]:
        """Fecha del archivo de estado diario más reciente del ESTUDIO.

        Es la base del aviso de "no ha llegado nada": una caída en el gráfico de
        recibidos casi siempre significa que el archivo no se cargó, no que no
        hubo movimientos.

        No se acota por jurisdicción: la pregunta es si llegó el archivo, y eso
        no depende de qué materias tenga adentro.
        """
        return (
            self.db.query(func.max(EstadoDiarioOrigen.fecha))
            .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_ESTADO_DIARIO)
            .scalar()
        )

    # ── Utilidades ───────────────────────────────────────────────────────
    @staticmethod
    def _a_fecha(valor) -> date:
        """`func.date(...)` puede volver como date o como datetime según el
        driver; se normaliza a date para poder usarlo de clave."""
        if isinstance(valor, datetime):
            return valor.date()
        if isinstance(valor, date):
            return valor
        return date.fromisoformat(str(valor)[:10])


def dias_habiles_hacia_atras(desde_dia: date, cantidad: int) -> list[date]:
    """Los `cantidad` últimos días hábiles (lun-vie) contando desde `desde_dia`
    hacia atrás, incluido `desde_dia` si es hábil.

    No considera feriados: no hay tabla de feriados en el sistema y agregarla
    solo para este aviso sería desproporcionado. El efecto es que después de un
    feriado el aviso puede aparecer un día antes de lo estricto, lo que es el
    error barato (avisa de más, no de menos).
    """
    resultado: list[date] = []
    cursor = desde_dia
    # Cota dura para no ciclar si `cantidad` viniera mal.
    for _ in range(cantidad * 5 + 14):
        if len(resultado) >= cantidad:
            break
        if cursor.weekday() < 5:
            resultado.append(cursor)
        cursor -= timedelta(days=1)
    return resultado
