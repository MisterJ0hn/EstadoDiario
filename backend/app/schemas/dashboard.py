"""Schemas del dashboard de gestión.

Un único response con todo el payload: la página hace una sola llamada y pinta
todos los gráficos a la vez. Ocho endpoints separados darían ocho spinners
desincronizados y ocho oportunidades de que uno falle y deje un hueco.
"""

from datetime import date

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    """Las cuatro tarjetas de la fila superior."""

    # Ni resueltos ni pendientes: el trabajo que nadie ha tocado. No se acota
    # al período porque es deuda acumulada.
    sin_revisar: int = 0
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
    aviso_carga: AvisoCarga
