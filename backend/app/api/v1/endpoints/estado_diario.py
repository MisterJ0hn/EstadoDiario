import logging
import os
import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_DIR, settings
from app.core.deps import get_db_tenant, get_usuario_actual
from app.models.usuario import Usuario
from app.schemas.estado_diario import (
    CorteListResponse,
    CorteResponse,
    MovimientoListResponse,
    MarcarLeidoRequest,
    MarcarLeidoResponse,
    MarcarPendienteRequest,
    AgendaCreateRequest,
    AgendaListResponse,
    CalendarioResponse,
    FinalizarAgendaRequest,
    WebhookResponse,
    EstadoDiarioOrigenListResponse,
    EstadoDiarioOrigenResponse,
)
from app.repositories.estado_diario_corte_repository import EstadoDiarioCorteRepository
from app.services.estado_diario_service import EstadoDiarioService
from app.services.import_service import ImportService
from app.repositories.estado_diario_origen_repository import EstadoDiarioOrigenRepository
from app.services import auditoria_service as auditoria

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/estado-diario", tags=["Estado Diario"])

# UPLOAD_DIR vive en app.core.config: lo comparte la ingesta por correo.


# ── Origenes ──────────────────────────────────────────────

@router.get(
    "/origenes",
    response_model=EstadoDiarioOrigenListResponse,
    summary="Listar orígenes (archivos cargados)",
)
def listar_origenes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tipo: str | None = Query(
        None, description="estado_diario | movimientos | audiencias | causas"
    ),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = EstadoDiarioOrigenRepository(db)
    # Los archivos son del estudio. Lo que se acota por
    # jurisdicción es su contenido, al abrirlos.
    items, total, total_pages = repo.find_all_paginated(tipo, page, per_page)
    # Cuáles de esta página entraron por la casilla. Se resuelve en UNA consulta
    # sobre los ids de la página y no preguntando por archivo: son 20 filas por
    # pantalla y serían 20 viajes a la base para pintar una columna.
    por_correo = repo.ids_ingresados_por_correo([o.id for o in items])
    origenes = []
    for o in items:
        origenes.append(EstadoDiarioOrigenResponse(
            id=o.id,
            rut=o.rut,
            fecha=o.fecha,
            tipo=o.tipo,
            nombre_archivo=o.nombre_archivo,
            url=o.url,
            fecha_carga=o.fecha_carga,
            usuario_carga=o.usuario_carga.usuario if o.usuario_carga else None,
            total_movimientos=repo.count_registros(o),
            via="correo" if o.id in por_correo else "manual",
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
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    from app.repositories.estado_diario_repository import EstadoDiarioRepository
    repo = EstadoDiarioRepository(db)
    items = repo.find_by_origen(origen_id)
    service = EstadoDiarioService(db)
    data = [service._map_movimiento(m, include_pendiente=True) for m in items]
    return {"exito": True, "total": len(data), "movimientos": data}


# Formato actual: estadoDiario_{RUT}_{DV}_{DDMMYYYY}
# El dígito verificador va en un campo propio que suele venir vacío, de ahí el
# doble guion bajo: estadoDiario_16952077__28072026.xls. La fecha viene pegada,
# sin separadores. Se aceptan además el guion como separador del DV y el DV
# ausente sin dejar el campo vacío.
_PATRON_FECHA_PEGADA = re.compile(
    r"^estadoDiario_(\d+)(?:-|_)?([\dkK])?_+(\d{2})(\d{2})(\d{4})$",
    re.IGNORECASE,
)

# Formato anterior, aún soportado para no romper archivos guardados o reenvíos
# viejos: EstadoDiario{RUT}_{DD}_{MM}_{YYYY}.xls
_PATRON_FECHA_SEPARADA = re.compile(
    r"^estadoDiario_?(\d+(?:-[\dkK])?)_+(\d{1,2})_(\d{1,2})_(\d{4})$",
    re.IGNORECASE,
)


def _a_fecha(anio: str, mes: str, dia: str) -> date | None:
    """Los archivos vienen en DDMMYYYY; una fecha imposible (32/13) devuelve
    None para que el llamador lo trate como nombre no reconocido."""
    try:
        return date(int(anio), int(mes), int(dia))
    except ValueError:
        return None


def _parse_filename(filename: str) -> tuple[str | None, date | None]:
    """Extrae RUT y fecha del nombre del archivo de estado diario.

    Acepta los dos formatos que ha usado el PJUD:
      estadoDiario_16952077__28072026.xls   (actual)
      EstadoDiario17314741-4_15_07_2026.xls (anterior)
    """
    name = os.path.splitext(filename or "")[0]

    match = _PATRON_FECHA_PEGADA.match(name)
    if match:
        cuerpo, dv, dia, mes, anio = match.groups()
        rut = f"{cuerpo}-{dv}" if dv else cuerpo
        return rut, _a_fecha(anio, mes, dia)

    match = _PATRON_FECHA_SEPARADA.match(name)
    if match:
        rut, dia, mes, anio = match.groups()
        return rut, _a_fecha(anio, mes, dia)

    return None, None


@router.post(
    "/upload",
    summary="Subir archivo XLS/XLSX de estado diario",
)
def upload_file(
    file: UploadFile = File(...),
    rut: str | None = Form(default=None),
    fecha: str | None = Form(default=None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
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
        return {"exito": False, "mensaje": "No se pudo determinar el RUT. Proporciónelo manualmente o use el formato: estadoDiario_{RUT}__{DDMMYYYY}.xls"}
    if not fecha_final:
        return {"exito": False, "mensaje": "No se pudo determinar la fecha. Proporciónela manualmente o use el formato: estadoDiario_{RUT}__{DDMMYYYY}.xls"}

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
        # Sin el traceback en el log, el mensaje que ve el usuario no basta
        # para ubicar la causa (p.ej. errores de encoding de psycopg2).
        logger.exception("Fallo al importar %s", file.filename)
        db.rollback()
        return {"exito": False, "mensaje": f"Error al procesar el archivo: {e}"}


@router.delete(
    "/origenes/{origen_id}",
    summary="Eliminar un origen y sus movimientos",
)
def eliminar_origen(
    origen_id: int,
    request: Request,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    repo = EstadoDiarioOrigenRepository(db)
    origen = repo.find_by_id(origen_id)
    if not origen:
        return {"exito": False, "mensaje": "Origen no encontrado"}

    # Se describe ANTES de borrar: después el objeto ya no tiene nombre que
    # poner en la bitácora, y "se eliminó el origen 7" no le sirve a nadie.
    descripcion = f"{origen.tipo}: {origen.nombre_archivo or f'origen {origen.id}'}"
    repo.delete(origen)
    auditoria.registrar(
        db, auditoria.MODULO_ESTADO_DIARIO, auditoria.ACCION_ELIMINAR,
        usuario_id=current_user.id, ip=auditoria.ip_de(request), detalle=descripcion,
    )
    db.commit()
    return {"exito": True}


# ── Movimientos filtrados ─────────────────────────────────

@router.get(
    "/no-leidos",
    response_model=MovimientoListResponse,
    summary="Movimientos no leídos",
)
def no_leidos(
    jurisdiccion: int | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_no_leidos(
        jurisdiccion, fecha_desde, fecha_hasta, rut, page, limit
    )


@router.get(
    "/leidos",
    response_model=MovimientoListResponse,
    summary="Movimientos leídos (resueltos)",
)
def leidos(
    jurisdiccion: int | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_leidos(
        jurisdiccion, fecha_desde, fecha_hasta, rut, page, limit
    )


@router.get(
    "/pendientes",
    response_model=MovimientoListResponse,
    summary="Movimientos pendientes",
)
def pendientes(
    jurisdiccion: int | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    rut: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.get_movimientos_pendientes(
        jurisdiccion, fecha_desde, fecha_hasta, rut, page, limit
    )


@router.get(
    "/calendario",
    response_model=CalendarioResponse,
    summary="Recordatorios vigentes (no finalizados) para el calendario",
)
def calendario(
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Admin ve los recordatorios de todos; cada usuario ve solo los suyos."""
    service = EstadoDiarioService(db)
    return service.get_calendario(current_user)


# ── Detalle ───────────────────────────────────────────────

# ── Causas de corte (submenú Corte) ───────────────────────


@router.get(
    "/cortes",
    response_model=CorteListResponse,
    summary="Causas de Corte Suprema y Corte de Apelaciones",
)
def listar_cortes(
    tipo: str | None = Query(None, description="suprema | apelaciones"),
    busqueda: str | None = Query(None, description="Busca en carátula y número de ingreso"),
    corte: str | None = Query(None, description="Nombre de la corte, coincidencia parcial"),
    fecha_desde: str | None = Query(None, description="Fecha del archivo (YYYY-MM-DD)"),
    fecha_hasta: str | None = Query(None),
    page: int | None = Query(None, ge=1),
    limit: int | None = Query(None, ge=1, le=500),
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """Las causas que el Excel trae en las hojas de corte.

    Están en otra tabla y en otra pantalla porque no comparten columnas con las
    de materia: no traen rol único, ni tribunal, ni estado de la causa. Se
    acotan con el mismo permiso por jurisdicción que el resto del sistema.
    """
    repo = EstadoDiarioCorteRepository(db)

    items, total, pagina, total_pages = repo.find_filtered(
        tipo=tipo,
        busqueda=busqueda,
        corte=corte,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        limit=limit,
    )

    return CorteListResponse(
        total=total,
        page=pagina,
        total_pages=total_pages,
        cortes=[
            CorteResponse(
                id=c.id,
                tipo=c.tipo,
                numero_ingreso=c.numero_ingreso,
                fecha_ingreso=c.fecha_ingreso,
                caratulado=c.caratulado,
                ubicacion=c.ubicacion,
                fecha_ubicacion=c.fecha_ubicacion,
                corte=c.corte,
                tipo_recurso=c.tipo_recurso,
                fecha_archivo=c.estado_diario_origen.fecha if c.estado_diario_origen else None,
            )
            for c in items
        ],
        cortes_disponibles=repo.listar_cortes(),
    )


@router.get(
    "/{estado_diario_id}",
    summary="Detalle de un movimiento",
)
def detalle_movimiento(
    estado_diario_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
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
    request: Request,
    body: MarcarLeidoRequest | None = None,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    """La observación es opcional: el body completo puede venir vacío, que es
    como lo llaman los clientes que solo marcan resuelto sin comentario."""
    service = EstadoDiarioService(db)
    return service.marcar_leido(
        estado_diario_id,
        current_user.id,
        body.observacion if body else None,
        ip=auditoria.ip_de(request),
    )


@router.post(
    "/{estado_diario_id}/pendiente",
    summary="Marcar como pendiente",
)
def marcar_pendiente(
    estado_diario_id: int,
    body: MarcarPendienteRequest,
    request: Request,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.marcar_pendiente(
        estado_diario_id, body.nivel, body.username, body.mensaje, body.fecha_hora,
        body.notificar_whatsapp, body.whatsapp_telefono, body.fecha_hora_whatsapp,
        usuario_id=current_user.id, ip=auditoria.ip_de(request),
    )


# ── Agenda ────────────────────────────────────────────────

@router.get(
    "/{estado_diario_id}/agendas",
    response_model=AgendaListResponse,
    summary="Listar agendas de un movimiento",
)
def listar_agendas(
    estado_diario_id: int,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
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
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.crear_agenda(
        estado_diario_id, body.detalle, body.fecha_hora, body.username,
    )


@router.post(
    "/agendas/{agenda_id}/finalizar",
    summary="Finalizar un recordatorio (con opción de marcar el movimiento resuelto)",
)
def finalizar_agenda(
    agenda_id: int,
    body: FinalizarAgendaRequest,
    request: Request,
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    service = EstadoDiarioService(db)
    return service.finalizar_agenda(
        agenda_id, body.marcar_resuelto, current_user, ip=auditoria.ip_de(request),
    )


# ── Webhook Twilio ────────────────────────────────────────

async def _leer_datos_webhook(request: Request) -> dict:
    """Twilio postea application/x-www-form-urlencoded, pero se aceptan
    además JSON y query string para poder probar el endpoint a mano (el
    Symfony original leía las tres fuentes en el mismo orden)."""
    try:
        formulario = await request.form()
        if formulario:
            return {clave: str(valor) for clave, valor in formulario.multi_items()}
    except Exception:
        logger.warning("No se pudo leer el body como formulario", exc_info=True)

    try:
        cuerpo = await request.json()
        if isinstance(cuerpo, dict) and cuerpo:
            return cuerpo
    except Exception:
        pass  # Body vacío o no-JSON: se cae a los query params.

    return dict(request.query_params)


def _urls_candidatas(request: Request) -> list[str]:
    """URLs contra las que se prueba la firma de Twilio.

    Twilio firma la URL exacta que tiene configurada en su consola. El backend
    corre detrás del proxy del frontend, así que ve otra cosa (http y un host
    interno): se prueba primero la URL pública (PUBLIC_BASE_URL, el mismo
    ajuste que usa el OAuth de Google), luego lo que reporta el proxy y por
    último la que ve el propio backend.
    """
    ruta = request.url.path
    if request.url.query:
        ruta = f"{ruta}?{request.url.query}"

    candidatas = [f"{settings.PUBLIC_BASE_URL.rstrip('/')}{ruta}"]

    proto = request.headers.get("x-forwarded-proto")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if proto and host:
        candidatas.append(f"{proto}://{host}{ruta}")

    candidatas.append(str(request.url))
    return list(dict.fromkeys(candidatas))  # sin repetidos, conservando el orden


@router.post(
    "/request-tw",
    response_model=WebhookResponse,
    summary="Webhook Twilio (sin autenticación, valida X-Twilio-Signature)",
)
async def webhook_twilio(
    request: Request,
    db: Session = Depends(get_db_tenant),
):
    """Endpoint público para recibir callbacks de Twilio.

    No lleva Bearer token porque quien llama es Twilio; lo que autentica el
    request es la firma X-Twilio-Signature (se puede desactivar desde la
    configuración de WhatsApp, ver ConfiguracionWhatsapp.validar_firma_webhook).
    Con la firma activa solo pasan los POST form-urlencoded reales de Twilio.
    """
    datos = await _leer_datos_webhook(request)
    service = EstadoDiarioService(db)
    return service.webhook_twilio(
        datos,
        firma=request.headers.get("X-Twilio-Signature"),
        urls=_urls_candidatas(request),
    )
