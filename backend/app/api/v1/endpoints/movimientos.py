"""Endpoints del módulo Movimientos.

Solo lectura + carga: no hay acciones sobre un movimiento (leído, pendiente,
agenda) porque este reporte es de consulta. La visibilidad se resuelve con
Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR
from app.core.deps import get_db_tenant, get_usuario_actual
from app.models.usuario import Usuario
from app.repositories.movimiento_corte_repository import MovimientoCorteRepository
from app.repositories.movimiento_repository import MovimientoRepository
from app.schemas.movimiento import (
    MovimientoCorteListResponse,
    MovimientoCorteResponse,
    ConteoMateria,
    MovimientoListResponse,
    MovimientoOrigenListResponse,
    MovimientoOrigenResponse,
    MovimientoResponse,
    MovimientoResumenResponse,
    MovimientoUploadResponse,
)
from app.services.estado_diario_service import EstadoDiarioService
from app.services.movimiento_import_service import (
    MovimientoImportService,
    parse_nombre_archivo,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/movimientos", tags=["Movimientos"])


@router.get(
    "",
    response_model=MovimientoListResponse,
    summary="Listar movimientos (paginado y filtrado)",
)
def listar_movimientos(
    materia: str | None = Query(None, description="Nombre de la hoja: Civil, Familia, ..."),
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None, description="Coincidencia parcial"),
    busqueda: str | None = Query(None, description="Busca en caratulado y rol/rit"),
    rut: str | None = Query(None),
    origen_id: int | None = Query(None),
    fecha_desde: str | None = Query(None, description="Fecha del archivo (YYYY-MM-DD)"),
    fecha_hasta: str | None = Query(None),
    page: int | None = Query(None, ge=1),
    limit: int | None = Query(None, ge=1, le=500),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = MovimientoRepository(db)
    items, total, current_page, total_pages = repo.find_filtered(
        materia=materia,
        estado_causa=estado_causa,
        tribunal=tribunal,
        busqueda=busqueda,
        rut=rut,
        origen_id=origen_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
    )
    return MovimientoListResponse(
        total=total,
        page=current_page,
        total_pages=total_pages,
        movimientos=[MovimientoResponse.from_model(m) for m in items],
    )


@router.get(
    "/resumen",
    response_model=MovimientoResumenResponse,
    summary="Conteo por materia y valores disponibles de estado de causa",
)
def resumen(
    estado_causa: str | None = Query(None),
    tribunal: str | None = Query(None),
    busqueda: str | None = Query(None),
    rut: str | None = Query(None),
    origen_id: int | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Alimenta las pestañas por materia y el combo de estado de causa. La
    agregación la hace la base de datos (GROUP BY / DISTINCT)."""
    repo = MovimientoRepository(db)
    conteos = repo.contar_por_materia(
        estado_causa=estado_causa,
        tribunal=tribunal,
        busqueda=busqueda,
        rut=rut,
        origen_id=origen_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )
    return MovimientoResumenResponse(
        total=sum(c for _, c in conteos),
        por_materia=[ConteoMateria(materia=m, total=c) for m, c in conteos],
        estados_causa=repo.listar_estados_causa(),
    )


@router.get(
    "/archivos",
    response_model=MovimientoOrigenListResponse,
    summary="Listar archivos de movimientos cargados",
)
def listar_archivos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = MovimientoRepository(db)
    # Los archivos son del estudio y no se filtran; lo que se acota por
    # jurisdicción es su contenido, que es lo que cuenta `count_filtered`.
    items, total, current_page, total_pages = repo.find_origenes_paginados(
        page=page, per_page=per_page
    )
    return MovimientoOrigenListResponse(
        total=total,
        page=current_page,
        total_pages=total_pages,
        origenes=[
            MovimientoOrigenResponse(
                id=o.id,
                rut=o.rut,
                fecha=o.fecha,
                nombre_archivo=o.nombre_archivo,
                fecha_carga=o.fecha_carga,
                usuario_carga=o.usuario_carga.usuario if o.usuario_carga else None,
                total_movimientos=repo.count_filtered(
                    origen_id=o.id
                ),
            )
            for o in items
        ],
    )


@router.post(
    "/upload",
    response_model=MovimientoUploadResponse,
    summary="Subir archivo XLS/XLSX de movimientos",
)
def upload_movimientos(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """El archivo queda a nombre de quien lo sube, como dato de auditoría. Eso
    ya no decide quién lo ve: los archivos son del estudio y sus movimientos se
    acotan por jurisdicción."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".xls", ".xlsx", ".xlsm"):
        return MovimientoUploadResponse(
            exito=False, mensaje="Solo se permiten archivos XLS o XLSX"
        )

    rut = rut.strip() if rut else None
    fecha = fecha.strip() if fecha else None

    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = date.fromisoformat(fecha)
        except ValueError:
            fecha_date = None

    # Lo que no venga en el formulario se intenta sacar del nombre del archivo
    # (Movimientos_16952077__30_07_2026.xls).
    rut_archivo, fecha_archivo = parse_nombre_archivo(file.filename or "")
    rut_final = rut or rut_archivo
    fecha_final = fecha_date or fecha_archivo

    if not rut_final:
        return MovimientoUploadResponse(
            exito=False,
            mensaje="No se pudo determinar el RUT. Proporciónelo manualmente o use "
                    "el formato: Movimientos_RUT_DD_MM_YYYY.xls",
        )
    if not fecha_final:
        return MovimientoUploadResponse(
            exito=False,
            mensaje="No se pudo determinar la fecha. Proporciónela manualmente o use "
                    "el formato: Movimientos_RUT_DD_MM_YYYY.xls",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    try:
        service = MovimientoImportService(db)
        resultado = service.import_file(
            filepath, rut_final, fecha_final, current_user.id, file.filename
        )
        return MovimientoUploadResponse(
            exito=True, rut=rut_final, fecha=str(fecha_final), **resultado
        )
    except Exception as e:
        # Sin traceback en el log, el mensaje que ve el usuario no alcanza para
        # ubicar la causa (encoding, hoja inesperada, etc.).
        logger.exception("Fallo al importar movimientos %s", file.filename)
        db.rollback()
        return MovimientoUploadResponse(
            exito=False, mensaje=f"Error al procesar el archivo: {e}"
        )


# ── Causas de corte (submenú Corte) ───────────────────────


@router.get(
    "/cortes",
    response_model=MovimientoCorteListResponse,
    summary="Causas de Corte Suprema y Corte de Apelaciones",
)
def listar_cortes(
    tipo: str | None = Query(None, description="suprema | apelaciones"),
    busqueda: str | None = Query(None, description="Busca en carátula y rol"),
    corte: str | None = Query(None, description="Nombre de la corte, coincidencia parcial"),
    fecha_desde: str | None = Query(None, description="Fecha del archivo (YYYY-MM-DD)"),
    fecha_hasta: str | None = Query(None),
    page: int | None = Query(None, ge=1),
    limit: int | None = Query(None, ge=1, le=500),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Las causas que el reporte de movimientos trae en sus hojas de corte.

    Están en otra tabla y en otra pantalla porque no comparten columnas con las
    de materia: traen Era, Ubicación y Fecha Ubicación, y no traen tribunal. Se
    acotan con el mismo permiso por jurisdicción que el resto del sistema.
    """
    repo = MovimientoCorteRepository(db)

    items, total, pagina, total_pages = repo.find_filtered(
        tipo=tipo,
        busqueda=busqueda,
        corte=corte,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
    )

    return MovimientoCorteListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        cortes=[
            MovimientoCorteResponse(
                id=c.id,
                tipo=c.tipo,
                rol=c.rol,
                era=c.era,
                fecha_ingreso=c.fecha_ingreso,
                caratulado=c.caratulado,
                estado_causa=c.estado_causa,
                institucion=c.institucion,
                corte=c.corte,
                ubicacion=c.ubicacion,
                fecha_ubicacion=c.fecha_ubicacion,
                fecha_archivo=c.estado_diario_origen.fecha if c.estado_diario_origen else None,
            )
            for c in items
        ],
        cortes_disponibles=repo.listar_cortes(),
    )
