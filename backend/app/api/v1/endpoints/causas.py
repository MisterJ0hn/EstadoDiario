"""Cartera de causas del estudio.

Tercer reporte del PJUD que entra al sistema, y el que responde otra pregunta:
estado diario dice qué se movió hoy, movimientos dice cómo va cada tramitación,
y esto dice **qué causas tiene el estudio**, se hayan movido o no.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import logging
import os
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR, settings
from app.core.deps import get_db_tenant, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.causa_corte_repository import CausaCorteRepository
from app.repositories.causa_repository import FINALIZADAS, VIGENTES, CausaRepository
from app.schemas.causa import (
    CargarCausasResponse,
    CausaCorteListResponse,
    CausaCorteResponse,
    CausaListResponse,
    CausaResponse,
    CausaResumenResponse,
    ConteoMateria,
)
from app.schemas.pjud import PjudDisponibleResponse, PjudMovimientosResponse
from app.services.causa_import_service import CausaImportService, parse_nombre_archivo
from app.services.pjud_service import PjudApiError, PjudService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/causas", tags=["Causas"])


def _vigencia(valor: str | None) -> str | None:
    """Normaliza el parámetro `vigencia` de la cartera.

    Cualquier cosa que no sea uno de los dos valores conocidos se trata como
    "sin filtro" en vez de rechazarse: es un interruptor de pantalla, y un 422
    por un query param mal escrito dejaría el listado en blanco en vez de
    mostrar de más.
    """
    normalizado = (valor or "").strip().lower()
    return normalizado if normalizado in (VIGENTES, FINALIZADAS) else None


# ── Carga ─────────────────────────────────────────────────


@router.post(
    "/upload",
    response_model=CargarCausasResponse,
    summary="Subir el archivo XLS/XLSX de causas",
)
def upload_causas(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Importa la cartera de causas.

    **La fecha no está en el archivo** (a diferencia de movimientos y
    audiencias, que la traen en el nombre): este reporte es una foto de la
    cartera al momento de emitirlo. Si no se indica, se usa hoy — que es lo que
    corresponde para quien acaba de descargarlo del PJUD.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".xls", ".xlsx", ".xlsm"):
        return CargarCausasResponse(
            exito=False, mensaje="Solo se permiten archivos XLS o XLSX",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )

    rut = rut.strip() if rut else None
    fecha = fecha.strip() if fecha else None

    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = date.fromisoformat(fecha)
        except ValueError:
            fecha_date = None

    # El nombre del archivo trae el RUT (Causas_16952077-1.xlsx) pero no la
    # fecha.
    rut_archivo, _ = parse_nombre_archivo(file.filename or "")
    rut_final = rut or rut_archivo
    fecha_final = fecha_date or date.today()

    if not rut_final:
        return CargarCausasResponse(
            exito=False,
            mensaje="No se pudo determinar el RUT. Indíquelo manualmente o use "
                    "el formato: Causas_RUT.xlsx",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    try:
        resultado = CausaImportService(db).import_file(
            filepath, rut_final, fecha_final, current_user.id, file.filename
        )
        return CargarCausasResponse(
            exito=True,
            mensaje=(
                f"{resultado['causas_importadas']} causas y "
                f"{resultado['cortes_importados']} de corte importadas"
            ),
            **resultado,
        )
    except Exception as e:
        # Sin traceback en el log, el mensaje que ve el usuario no alcanza para
        # ubicar la causa (encoding, hoja inesperada, etc.).
        logger.exception("Fallo al importar causas %s", file.filename)
        db.rollback()
        return CargarCausasResponse(
            exito=False, mensaje=f"Error al procesar el archivo: {e}",
            origen_id=0, causas_importadas=0, cortes_importados=0,
        )


# ── Causas de corte (submenú Corte) ───────────────────────
# OJO: va ANTES del listado por materia solo por orden de lectura; lo que sí
# importa es que ninguna ruta con parámetro (`/{algo}`) quede declarada antes
# que ésta, porque FastAPI resuelve por orden y `/cortes` caería ahí.


@router.get(
    "/cortes",
    response_model=CausaCorteListResponse,
    summary="Causas de Corte Suprema y Corte de Apelaciones",
)
def listar_cortes(
    tipo: str | None = Query(None, description="suprema o apelaciones"),
    busqueda: str | None = Query(None, description="Carátula o rol"),
    corte: str | None = Query(None, description="Nombre de la corte"),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = CausaCorteRepository(db)
    items, total, pagina, total_pages = repo.find_filtered(
        tipo=tipo, busqueda=busqueda, corte=corte,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        vigencia=_vigencia(vigencia), page=page, limit=limit,
    )
    return CausaCorteListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        cortes=[
            CausaCorteResponse(
                id=c.id,
                tipo=c.tipo,
                rol=c.rol,
                era=c.era,
                corte=c.corte,
                fecha_ingreso=c.fecha_ingreso,
                ubicacion=c.ubicacion,
                fecha_ubicacion=c.fecha_ubicacion,
                caratulado=c.caratulado,
                estado_procesal=c.estado_procesal,
                institucion=c.institucion,
                fecha_archivo=c.estado_diario_origen.fecha if c.estado_diario_origen else None,
            )
            for c in items
        ],
        cortes_disponibles=repo.listar_cortes(),
    )


# ── Listado por materia (submenú Materia) ─────────────────


@router.get(
    "/resumen",
    response_model=CausaResumenResponse,
    summary="Conteos por materia y estados disponibles",
)
def resumen(
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None),
    origen_id: int | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Alimenta las pestañas del listado. Respeta los filtros activos menos el
    de materia, que es justamente lo que las pestañas dejan elegir."""
    repo = CausaRepository(db)
    conteos = repo.contar_por_materia(
        estado_causa=estado_causa, tribunal=tribunal,
        busqueda=busqueda, origen_id=origen_id, vigencia=_vigencia(vigencia),
    )
    return CausaResumenResponse(
        total=sum(t for _, t in conteos),
        por_materia=[ConteoMateria(materia=m, total=t) for m, t in conteos],
        estados_causa=repo.listar_estados_causa(origen_id),
    )


@router.get(
    "",
    response_model=CausaListResponse,
    summary="Listar la cartera de causas",
)
def listar(
    materia: str | None = Query(None),
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None, description="Carátula, rol o RUC"),
    origen_id: int | None = Query(None),
    vigencia: str | None = Query(
        VIGENTES, description="vigentes | finalizadas | vacío para todas"
    ),
    sin_actividad_meses: int | None = Query(
        None, ge=1, le=120,
        description="Solo las que no aparecen en ningún reporte hace más de N meses",
    ),
    con_audiencia_dias: int | None = Query(
        None, ge=0, le=365,
        description="Solo las que tienen audiencia dentro de los próximos N días",
    ),
    orden: str | None = Query(
        None, description="actividad | audiencia. Por defecto, fecha de ingreso.",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Sin `origen_id`, devuelve **solo el último archivo de causas**: el
    reporte trae la cartera completa cada vez, y sumar todos los que se
    cargaron mostraría la misma causa tantas veces como se haya importado."""
    items, total, pagina, total_pages = CausaRepository(db).find_filtered(
        materia=materia, estado_causa=estado_causa, tribunal=tribunal,
        busqueda=busqueda, origen_id=origen_id, vigencia=_vigencia(vigencia),
        sin_actividad_meses=sin_actividad_meses,
        con_audiencia_hasta=(
            date.today() + timedelta(days=con_audiencia_dias)
            if con_audiencia_dias is not None
            else None
        ),
        orden=orden,
        page=page, limit=limit,
    )
    return CausaListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        causas=[CausaResponse.from_model(c) for c in items],
    )


# ── Detalle en vivo desde el PJUD (solo Civil) ────────────


@router.get(
    "/pjud/disponible",
    response_model=PjudDisponibleResponse,
    summary="Si la consulta de detalle PJUD está configurada",
)
def pjud_disponible(current_user: Usuario = Depends(get_usuario_actual)):
    """El frontend la consulta una vez para decidir si muestra el botón
    'Detalle PJUD': sin credenciales configuradas, no tiene sentido ofrecerlo
    y que cada clic termine en un error."""
    return PjudDisponibleResponse(disponible=settings.pjud_api_activo)


@router.get(
    "/{causa_id}/pjud/movimientos",
    response_model=PjudMovimientosResponse,
    summary="Detalle de una causa Civil consultado en vivo al PJUD",
)
def pjud_movimientos(
    causa_id: int,
    response: Response,
    forzar: bool = Query(False, description="Pide al PJUD que sincronice antes de consultar"),
    cuaderno: int | None = Query(None, description="Cuaderno a traer en Historia; por defecto el primero"),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    causa = CausaRepository(db).find_by_id(causa_id)
    if not causa:
        raise HTTPException(status_code=404, detail="Causa no encontrada")

    try:
        resultado = PjudService().obtener_detalle(
            causa, forzar_sincronizacion=forzar, cuaderno_id=cuaderno
        )
    except PjudApiError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # El scrape del proveedor es asíncrono: 202 mientras no esté listo, para
    # que el frontend distinga "espera y reintenta" de "listo".
    if resultado.get("estado") == "sincronizando":
        response.status_code = 202

    return PjudMovimientosResponse(**resultado)
