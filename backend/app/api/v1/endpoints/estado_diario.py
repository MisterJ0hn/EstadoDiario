import os
import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.schemas.estado_diario import (
    MovimientoListResponse,
    MarcarLeidoResponse,
    MarcarPendienteRequest,
    AgendaCreateRequest,
    AgendaListResponse,
    WebhookResponse,
    EstadoDiarioOrigenListResponse,
    EstadoDiarioOrigenResponse,
)
from app.services.estado_diario_service import EstadoDiarioService
from app.services.import_service import ImportService
from app.repositories.estado_diario_origen_repository import EstadoDiarioOrigenRepository

router = APIRouter(prefix="/estado-diario", tags=["Estado Diario"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")


# ── Origenes ──────────────────────────────────────────────

@router.get(
    "/origenes",
    response_model=EstadoDiarioOrigenListResponse,
    summary="Listar orígenes (archivos cargados)",
)
def listar_origenes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    repo = EstadoDiarioOrigenRepository(db)
    items, total, total_pages = repo.find_all_paginated(page, per_page)
    origenes = []
    for o in items:
        origenes.append(EstadoDiarioOrigenResponse(
            id=o.id,
            rut=o.rut,
            fecha=o.fecha,
            nombre_archivo=o.nombre_archivo,
            url=o.url,
            fecha_carga=o.fecha_carga,
            usuario_carga=o.usuario_carga.username if o.usuario_carga else None,
            total_movimientos=repo.count_movimientos(o.id),
        ))
    return EstadoDiarioOrigenListResponse(
        total=total, page=page, total_pages=total_pages, origenes=origenes,
    )


@router.get(
    "/origenes/{origen_id}/movimientos",
    summary="Listar movimientos de un origen",
)
def movimientos_por_origen(
    origen_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.repositories.estado_diario_repository import EstadoDiarioRepository
    repo = EstadoDiarioRepository(db)
    items = repo.find_by_origen(origen_id)
    service = EstadoDiarioService(db)
    data = [service._map_movimiento(m, include_pendiente=True) for m in items]
    return {"exito": True, "total": len(data), "movimientos": data}


def _parse_filename(filename: str) -> tuple[str | None, date | None]:
    """
    Extrae RUT y fecha del nombre del archivo.
    Formato esperado: EstadoDiario{RUT}_{DD}_{MM}_{YYYY}.xls
    Ejemplo: EstadoDiario17314741-4_15_07_2026.xls
    """
    name = os.path.splitext(filename)[0]  # sin extensión

    # Patrón: EstadoDiario + RUT + _ + DD_MM_YYYY
    match = re.match(
        r"^EstadoDiario(\d+[\-kK]\d?)_(\d{1,2})_(\d{1,2})_(\d{4})$",
        name,
    )
    if match:
        rut = match.group(1)
        dia = int(match.group(2))
        mes = int(match.group(3))
        anio = int(match.group(4))
        try:
            fecha = date(anio, mes, dia)
        except ValueError:
            fecha = None
        return rut, fecha

    return None, None


@router.post(
    "/upload",
    summary="Subir archivo XLS/XLSX de estado diario",
)
def upload_file(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".xls", ".xlsx", ".xlsm"):
        return {"exito": False, "mensaje": "Solo se permiten archivos XLS o XLSX"}

    # Normalizar cadenas vacías a None
    rut = rut.strip() if rut else None
    fecha = fecha.strip() if fecha else None

    # Parsear fecha si viene como string
    fecha_date: date | None = None
    if fecha:
        try:
            fecha_date = date.fromisoformat(fecha)
        except ValueError:
            fecha_date = None

    # Extraer RUT y fecha del nombre del archivo si no se proporcionaron
    parsed_rut, parsed_fecha = _parse_filename(file.filename or "")
    rut_final = rut or parsed_rut
    fecha_final = fecha_date or parsed_fecha

    if not rut_final:
        return {"exito": False, "mensaje": "No se pudo determinar el RUT. Proporciónelo manualmente o use el formato: EstadoDiarioRUT_DD_MM_YYYY.xls"}
    if not fecha_final:
        return {"exito": False, "mensaje": "No se pudo determinar la fecha. Proporciónela manualmente o use el formato: EstadoDiarioRUT_DD_MM_YYYY.xls"}

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = file.file.read()
        f.write(content)

    try:
        service = ImportService(db)
        result = service.import_file(filepath, rut_final, fecha_final, current_user.id, file.filename)
        return {"exito": True, "rut": rut_final, "fecha": str(fecha_final), **result}
    except Exception as e:
        return {"exito": False, "mensaje": f"Error al procesar el archivo: {e}"}


@router.delete(
    "/origenes/{origen_id}",
    summary="Eliminar un origen y sus movimientos",
)
def eliminar_origen(
    origen_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    repo = EstadoDiarioOrigenRepository(db)
    origen = repo.find_by_id(origen_id)
    if not origen:
        return {"exito": False, "mensaje": "Origen no encontrado"}
    repo.delete(origen)
    return {"exito": True}


# ── Movimientos filtrados ─────────────────────────────────

@router.get(
    "/no-leidos",
    response_model=MovimientoListResponse,
    summary="Movimientos no leídos",
)
def no_leidos(
    jurisdiccion: int | None = Query(None),
    fecha: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_no_leidos(jurisdiccion, fecha, rut, page, limit)


@router.get(
    "/leidos",
    response_model=MovimientoListResponse,
    summary="Movimientos leídos (resueltos)",
)
def leidos(
    jurisdiccion: int | None = Query(None),
    fecha: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_leidos(jurisdiccion, fecha, rut, page, limit)


@router.get(
    "/pendientes",
    response_model=MovimientoListResponse,
    summary="Movimientos pendientes",
)
def pendientes(
    jurisdiccion: int | None = Query(None),
    fecha: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_pendientes(jurisdiccion, fecha, rut, page, limit)


# ── Detalle ───────────────────────────────────────────────

@router.get(
    "/{estado_diario_id}",
    summary="Detalle de un movimiento",
)
def detalle_movimiento(
    estado_diario_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.get_movimiento_detalle(estado_diario_id)


# ── Acciones ──────────────────────────────────────────────

@router.post(
    "/{estado_diario_id}/leido",
    response_model=MarcarLeidoResponse,
    summary="Marcar como leído",
)
def marcar_leido(
    estado_diario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.marcar_leido(estado_diario_id, current_user.id)


@router.post(
    "/{estado_diario_id}/pendiente",
    summary="Marcar como pendiente",
)
def marcar_pendiente(
    estado_diario_id: int,
    body: MarcarPendienteRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.marcar_pendiente(
        estado_diario_id, body.nivel, body.username, body.mensaje, body.fecha_hora
    )


# ── Agenda ────────────────────────────────────────────────

@router.get(
    "/{estado_diario_id}/agendas",
    response_model=AgendaListResponse,
    summary="Listar agendas de un movimiento",
)
def listar_agendas(
    estado_diario_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.get_agendas(estado_diario_id)


@router.post(
    "/{estado_diario_id}/agenda",
    summary="Crear entrada de agenda",
)
def crear_agenda(
    estado_diario_id: int,
    body: AgendaCreateRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    service = EstadoDiarioService(db)
    return service.crear_agenda(estado_diario_id, body.detalle, body.fecha_hora, body.username)


# ── Webhook Twilio ────────────────────────────────────────

@router.post(
    "/request-tw",
    response_model=WebhookResponse,
    summary="Webhook Twilio (sin autenticación)",
)
def webhook_twilio(
    datos: dict | None = None,
    db: Session = Depends(get_db),
):
    """Endpoint público para recibir callbacks de Twilio."""
    service = EstadoDiarioService(db)
    return service.webhook_twilio(datos or {})
