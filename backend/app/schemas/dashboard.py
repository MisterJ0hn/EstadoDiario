"""Schemas del dashboard de gestión.

Un único response con todo el payload: la página hace una sola llamada y pinta
todos los gráficos a la vez. Ocho endpoints separados darían ocho spinners
desincronizados y ocho oportunidades de que uno falle y deje un hueco.
"""

from datetime import date

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    """Las tarjetas de la fila superior.

    **Ninguna de las que se muestran hoy se acota al período.** Son el estado
    del estudio ahora —deuda acumulada, cartera vigente, audiencias—, y el
    filtro de días gobierna solo los gráficos. Los campos que sí miran el
    período (`resueltos_periodo`, `recibidos_periodo`, los de recordatorios)
    siguen acá porque los usan los gráficos y el estado vacío de la pantalla,
    pero ya no tienen tarjeta propia.
    """

    # Ni resueltos ni pendientes: el trabajo que nadie ha tocado. No se acota
    # al período porque es deuda acumulada.
    sin_revisar: int = 0
    # Causas DISTINTAS (rol + tribunal) de la cartera actual. La misma causa
    # puede venir repetida en el Excel del PJUD y contar filas la infla.
    causas_activas: int = 0
    causas_finalizadas: int = 0
    # Todas las audiencias cargadas, mientras no exista el dato de asistencia:
    # ver `MetricasRepository.contar_audiencias_no_asistidas`.
    audiencias_no_asistidas: int = 0
    # Marcados pendientes y aún abiertos.
    pendientes: int = 0
    # Resueltos dentro del período consultado.
    resueltos_periodo: int = 0
    # Estados diarios recibidos dentro del período (contexto de los resueltos).
    recibidos_periodo: int = 0
    recordatorios_vigentes: int = 0
    # Métrica de alarma: no finalizados con fecha_hora ya vencida.
    recordatorios_atrasados: int = 0
    # Días promedio entre la fecha del estado diario y su resolución.
    # `None` = no hubo resoluciones en el período (distinto de 0 días).
    promedio_resolucion_dias: float | None = None


class ConteoNivel(BaseModel):
    nivel: str
    total: int


class PuntoDiario(BaseModel):
    dia: date
    recibidos: int = 0
    resueltos: int = 0


class PuntoResolucion(BaseModel):
    dia: date
    dias_promedio: float


class Composicion(BaseModel):
    no_leidos: int = 0
    pendientes: int = 0
    resueltos: int = 0


class ConteoEtiqueta(BaseModel):
    """Par etiqueta/total para los gráficos de barras (tribunal, jurisdicción)."""

    etiqueta: str
    total: int


class Cumplimiento(BaseModel):
    a_tiempo: int = 0
    atrasados: int = 0


class AudienciaDia(BaseModel):
    """Un día del gráfico de audiencias, con su desglose por materia.

    El desglose va como diccionario y no como lista de pares porque el gráfico
    lo consume por nombre de materia: las series están declaradas aparte, en
    `Audiencias.materias`, y cada día solo aporta los valores que tenga.
    """

    dia: date
    total: int = 0
    materias: dict[str, int] = {}


class Audiencias(BaseModel):
    """Audiencias programadas: la única sección que mira hacia adelante.

    La ventana es [hoy, hoy + dias) — el resto del dashboard mira hacia atrás.
    Una audiencia ya ocurrida no es gestión pendiente; lo que importa es lo que
    viene.
    """

    desde: date
    hasta: date
    total: int = 0
    # Materias presentes en la ventana, en orden fijo (alfabético). Definen las
    # series del gráfico: el orden no depende del volumen, para que un día
    # flojo no reordene la leyenda ni repinte las materias.
    materias: list[str] = []
    # Totales por materia, para el resumen bajo el gráfico.
    totales_por_materia: list[ConteoEtiqueta] = []
    por_dia: list[AudienciaDia] = []
    # Hasta qué día alcanzan las audiencias cargadas. `None` = no hay ninguna.
    # Si queda antes de `hasta`, los días finales están vacíos por falta de
    # archivo y no por falta de audiencias.
    cubierto_hasta: date | None = None


class AvisoCarga(BaseModel):
    """Aviso de sesgo de carga.

    Sin esto el dashboard miente: una caída en "recibidos" se lee como "no hubo
    movimientos" cuando casi siempre significa "no llegó el archivo".
    """

    sin_carga_reciente: bool = False
    ultima_fecha_archivo: date | None = None
    # Días hábiles revisados (3) sin ningún archivo con esa fecha.
    dias_habiles_revisados: int = 3
    mensaje: str | None = None


class DashboardResponse(BaseModel):
    exito: bool = True
    dias: int
    desde: date
    hasta: date
    kpis: DashboardKpis
    atrasados_por_nivel: list[ConteoNivel] = []
    evolucion_diaria: list[PuntoDiario] = []
    evolucion_resolucion: list[PuntoResolucion] = []
    composicion: Composicion
    por_tribunal: list[ConteoEtiqueta] = []
    por_jurisdiccion: list[ConteoEtiqueta] = []
    cumplimiento: Cumplimiento
    audiencias: Audiencias
    aviso_carga: AvisoCarga
