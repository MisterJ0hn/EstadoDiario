"""Dashboard de gestión: un solo endpoint con todo el payload.

`GET /api/v1/dashboard?dias=30` devuelve KPIs, series y agregados. La página de
inicio hace una sola llamada; por eso no hay ocho endpoints.

Aislamiento por usuario: el alcance se resuelve **una vez** con
`EstadoDiarioService.alcance(current_user)` (None = admin, ve todo) y se pasa a
cada una de las consultas del repositorio, que lo aplican sobre
`estado_diario_origen.usuario_carga_id` (estados diarios) o
`estado_diario_agenda.usuario_registro_id` (recordatorios). Acá no se
reimplementa la regla.
"""

import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db_tenant, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.metricas_repository import (
    NIVELES,
    MetricasRepository,
    dias_habiles_hacia_atras,
)
from app.schemas.dashboard import (
    AudienciaDia,
    Audiencias,
    AvisoCarga,
    Composicion,
    ConteoEtiqueta,
    ConteoNivel,
    Cumplimiento,
    DashboardKpis,
    DashboardResponse,
    PuntoDiario,
    PuntoResolucion,
)
from app.services.estado_diario_service import EstadoDiarioService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Días hábiles sin archivo que disparan el aviso de sesgo de carga.
DIAS_HABILES_AVISO = 3


def _zona() -> ZoneInfo:
    try:
        return ZoneInfo(settings.TIMEZONE)
    except Exception:  # pragma: no cover - configuración inválida
        logger.warning("Zona horaria '%s' inválida; se usa UTC", settings.TIMEZONE)
        return ZoneInfo("UTC")


def _armar_aviso(ultima: date | None, hoy: date) -> AvisoCarga:
    """Compara la última fecha de archivo contra los últimos días hábiles."""
    habiles = dias_habiles_hacia_atras(hoy, DIAS_HABILES_AVISO)
    corte = min(habiles) if habiles else hoy

    if ultima is None:
        return AvisoCarga(
            sin_carga_reciente=True,
            ultima_fecha_archivo=None,
            dias_habiles_revisados=DIAS_HABILES_AVISO,
            mensaje=(
                "No hay ningún estado diario cargado todavía. "
                "Los gráficos aparecerán en cuanto llegue el primer archivo."
            ),
        )

    if ultima < corte:
        return AvisoCarga(
            sin_carga_reciente=True,
            ultima_fecha_archivo=ultima,
            dias_habiles_revisados=DIAS_HABILES_AVISO,
            mensaje=(
                f"No se ha recibido ningún estado diario en los últimos "
                f"{DIAS_HABILES_AVISO} días hábiles. El último es del "
                f"{ultima.strftime('%d-%m-%Y')}. Una caída en el gráfico de "
                "recibidos puede deberse a que el archivo no se cargó, no a que "
                "no hubo movimientos."
            ),
        )

    return AvisoCarga(
        sin_carga_reciente=False,
        ultima_fecha_archivo=ultima,
        dias_habiles_revisados=DIAS_HABILES_AVISO,
    )


# Materia de las audiencias que llegaron sin hoja identificable. Se agrupan en
# una etiqueta visible en vez de quedar como una serie sin nombre.
MATERIA_SIN_CLASIFICAR = "Sin materia"


def _armar_audiencias(
    filas: list[tuple[date, str | None, int]],
    desde: date,
    hasta: date,
    cubierto_hasta: date | None,
) -> Audiencias:
    """Arma el bloque de audiencias a partir de la consulta agrupada.

    El eje de días se rellena con ceros acá y no en SQL: un día sin audiencias
    es un día real de la agenda y tiene que aparecer, si no el gráfico
    comprimiría la semana y daría la impresión de que todos los días tienen
    carga. Es armar el eje, no contar filas en Python.
    """
    por_dia: dict[date, dict[str, int]] = {}
    totales: dict[str, int] = {}
    for dia, materia, total in filas:
        etiqueta = (materia or "").strip() or MATERIA_SIN_CLASIFICAR
        del_dia = por_dia.setdefault(dia, {})
        # La misma materia puede venir en dos filas si dos hojas distintas la
        # nombran igual salvo por espacios: se suman, no se pisan.
        del_dia[etiqueta] = del_dia.get(etiqueta, 0) + total
        totales[etiqueta] = totales.get(etiqueta, 0) + total

    dias: list[AudienciaDia] = []
    cursor = desde
    while cursor <= hasta:
        materias_dia = por_dia.get(cursor, {})
        dias.append(
            AudienciaDia(
                dia=cursor,
                total=sum(materias_dia.values()),
                materias=materias_dia,
            )
        )
        cursor += timedelta(days=1)

    return Audiencias(
        desde=desde,
        hasta=hasta,
        total=sum(totales.values()),
        # Alfabético: el orden de las series no puede depender del volumen, o
        # cambiar de período reordenaría la leyenda y repintaría las materias.
        materias=sorted(totales),
        totales_por_materia=[
            ConteoEtiqueta(etiqueta=m, total=t)
            for m, t in sorted(totales.items(), key=lambda par: (-par[1], par[0]))
        ],
        por_dia=dias,
        cubierto_hasta=cubierto_hasta,
    )


@router.get(
    "",
    response_model=DashboardResponse,
    summary="Métricas de gestión (KPIs y series para los gráficos)",
)
def obtener_dashboard(
    dias: int = Query(30, ge=1, le=365, description="Largo del período en días"),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    # Un solo alcance para todas las consultas: None = admin (ve todo),
    # id del usuario en cualquier otro caso.
    alcance = EstadoDiarioService.alcance(current_user)

    zona = _zona()
    ahora = datetime.now(zona)
    hasta = ahora.date()
    desde = hasta - timedelta(days=dias - 1)
    # Las audiencias usan el mismo largo de período pero hacia adelante: son
    # compromisos que vienen, no trabajo que pasó. Hoy queda incluido en ambas
    # ventanas, que es lo correcto: hoy tiene movimientos recibidos y también
    # audiencias que todavía no ocurren.
    hasta_audiencias = hasta + timedelta(days=dias - 1)

    repo = MetricasRepository(db)

    kpis = DashboardKpis(
        sin_revisar=repo.contar_sin_revisar(alcance),
        pendientes=repo.contar_pendientes(alcance),
        resueltos_periodo=repo.contar_resueltos(alcance, desde, hasta),
        recibidos_periodo=repo.contar_recibidos(alcance, desde, hasta),
        recordatorios_vigentes=repo.contar_recordatorios_vigentes(alcance),
        recordatorios_atrasados=repo.contar_recordatorios_atrasados(alcance, ahora),
        promedio_resolucion_dias=repo.promedio_resolucion(alcance, desde, hasta),
    )

    por_nivel = repo.atrasados_por_nivel(alcance, ahora)

    # Las series diarias vienen dispersas desde SQL (solo días con datos). Se
    # rellenan los ceros acá: es armar el eje, no contar filas en Python.
    recibidos = repo.recibidos_por_dia(alcance, desde, hasta)
    resueltos = repo.resueltos_por_dia(alcance, desde, hasta)
    evolucion = []
    cursor = desde
    while cursor <= hasta:
        evolucion.append(
            PuntoDiario(
                dia=cursor,
                recibidos=recibidos.get(cursor, 0),
                resueltos=resueltos.get(cursor, 0),
            )
        )
        cursor += timedelta(days=1)

    # El tiempo de resolución NO se rellena con ceros: un día sin resoluciones
    # no es "se resolvió en 0 días", es un día sin dato. La línea se corta.
    promedios = repo.promedio_resolucion_por_dia(alcance, desde, hasta)
    evolucion_resolucion = [
        PuntoResolucion(dia=d, dias_promedio=v) for d, v in sorted(promedios.items())
    ]

    comp = repo.composicion(alcance, desde, hasta)
    cumpl = repo.cumplimiento_recordatorios(alcance, desde, hasta)

    return DashboardResponse(
        dias=dias,
        desde=desde,
        hasta=hasta,
        kpis=kpis,
        atrasados_por_nivel=[
            ConteoNivel(nivel=n, total=por_nivel.get(n, 0)) for n in NIVELES
        ],
        evolucion_diaria=evolucion,
        evolucion_resolucion=evolucion_resolucion,
        composicion=Composicion(**comp),
        por_tribunal=[
            ConteoEtiqueta(etiqueta=t, total=n)
            for t, n in repo.por_tribunal(alcance, desde, hasta, limite=10)
        ],
        por_jurisdiccion=[
            ConteoEtiqueta(etiqueta=j, total=n)
            for j, n in repo.por_jurisdiccion(alcance, desde, hasta)
        ],
        cumplimiento=Cumplimiento(**cumpl),
        audiencias=_armar_audiencias(
            repo.audiencias_por_dia_materia(alcance, hasta, hasta_audiencias),
            hasta,
            hasta_audiencias,
            repo.ultima_fecha_audiencia(alcance),
        ),
        aviso_carga=_armar_aviso(repo.ultima_fecha_archivo(alcance), hasta),
    )
