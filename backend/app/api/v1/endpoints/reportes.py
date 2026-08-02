"""Informes dinámicos: el usuario arma su informe eligiendo campos, lo guarda
para reutilizarlo y lo recibe por correo en Excel.

La configuración SMTP va en este mismo módulo pero bajo `require_admin`: es una
cuenta única del sistema, no algo que cada usuario configure (a diferencia de
la casilla IMAP de entrada, que sí es por usuario).
"""

import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import NotFoundException
from app.models.reporte_plantilla import ReportePlantilla
from app.models.usuario import Usuario
from app.repositories.reporte_repository import ReporteRepository
from app.schemas.reporte import (
    CamposDisponiblesResponse,
    ConfiguracionSmtpResponse,
    ConfiguracionSmtpUpdate,
    GenerarReporteResponse,
    OperacionResponse,
    ReportePlantillaListResponse,
    ReportePlantillaRequest,
    ReportePlantillaResponse,
)
from app.services.reporte_service import ReporteService
from app.services.smtp_service import XLSX_MIME, SmtpService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reportes", tags=["Informes"])


def _alcance(current_user: Usuario):
    """Misma convención que el resto del sistema: None = admin (ve todo)."""
    return None if current_user.rol == "admin" else current_user.id


# ── Catálogo de campos ────────────────────────────────────

@router.get(
    "/campos",
    response_model=CamposDisponiblesResponse,
    summary="Campos disponibles para armar un informe",
)
def campos_disponibles(_: Usuario = Depends(get_current_user)):
    return CamposDisponiblesResponse(fuentes=ReporteService.campos_disponibles())


# ── Plantillas guardadas ──────────────────────────────────

@router.get(
    "",
    response_model=ReportePlantillaListResponse,
    summary="Listar los informes guardados del usuario",
)
def listar(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    plantillas = ReporteRepository(db).find_by_usuario(_alcance(current_user))
    return ReportePlantillaListResponse(
        total=len(plantillas),
        plantillas=[ReportePlantillaResponse.from_model(p) for p in plantillas],
    )


@router.post(
    "",
    response_model=ReportePlantillaResponse,
    summary="Guardar un informe para reutilizarlo",
)
def crear(
    datos: ReportePlantillaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    campos = ReporteService.validar(datos.fuente, datos.campos)
    plantilla = ReportePlantilla(
        usuario_id=current_user.id,
        nombre=datos.nombre.strip(),
        descripcion=datos.descripcion,
        fuente=datos.fuente,
        campos=json.dumps(campos),
        filtros=json.dumps(datos.filtros or {}),
    )
    return ReportePlantillaResponse.from_model(ReporteRepository(db).save(plantilla))


@router.get(
    "/{plantilla_id}",
    response_model=ReportePlantillaResponse,
    summary="Obtener un informe guardado",
)
def obtener(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Va declarado DESPUÉS de /campos a propósito: FastAPI resuelve por orden
    de declaración y `/{plantilla_id}` capturaría esa ruta literal si fuera
    primero (devolviendo 422 al intentar leer "campos" como entero)."""
    plantilla = ReporteRepository(db).find_by_id(plantilla_id, _alcance(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")
    return ReportePlantillaResponse.from_model(plantilla)


@router.put(
    "/{plantilla_id}",
    response_model=ReportePlantillaResponse,
    summary="Modificar un informe guardado",
)
def actualizar(
    plantilla_id: int,
    datos: ReportePlantillaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    repo = ReporteRepository(db)
    plantilla = repo.find_by_id(plantilla_id, _alcance(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")

    campos = ReporteService.validar(datos.fuente, datos.campos)
    plantilla.nombre = datos.nombre.strip()
    plantilla.descripcion = datos.descripcion
    plantilla.fuente = datos.fuente
    plantilla.campos = json.dumps(campos)
    plantilla.filtros = json.dumps(datos.filtros or {})
    return ReportePlantillaResponse.from_model(repo.save(plantilla))


@router.delete("/{plantilla_id}", summary="Eliminar un informe guardado")
def eliminar(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    repo = ReporteRepository(db)
    plantilla = repo.find_by_id(plantilla_id, _alcance(current_user))
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")
    repo.delete(plantilla)
    return {"exito": True}


# ── Generación ────────────────────────────────────────────

@router.post(
    "/{plantilla_id}/enviar",
    response_model=GenerarReporteResponse,
    summary="Generar el informe y enviarlo por correo al usuario",
)
def enviar(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Genera el Excel y lo despacha al correo del usuario autenticado.

    El destinatario NO se recibe por parámetro: siempre es el correo del
    usuario de la sesión. Aceptarlo del cliente convertiría el sistema en un
    relay para mandar datos de causas a cualquier dirección.
    """
    return GenerarReporteResponse(
        **ReporteService(db).generar_y_enviar(plantilla_id, current_user)
    )


@router.get(
    "/{plantilla_id}/descargar",
    summary="Descargar el informe directamente, sin pasar por correo",
)
def descargar(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Alternativa al envío por correo, útil para revisar el informe antes de
    mandarlo y como salida cuando el SMTP no está configurado."""
    import io

    servicio = ReporteService(db)
    alcance = _alcance(current_user)
    plantilla = ReporteRepository(db).find_by_id(plantilla_id, alcance)
    if plantilla is None:
        raise NotFoundException("Informe no encontrado")

    contenido = servicio.generar_excel(plantilla, alcance)
    nombre = f"{plantilla.nombre.replace(' ', '_')}.xlsx"
    return StreamingResponse(
        io.BytesIO(contenido),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


# ── Configuración SMTP (solo admin) ───────────────────────

@router.get(
    "/configuracion/smtp",
    response_model=ConfiguracionSmtpResponse,
    summary="Obtener la configuración de la cuenta de envío",
    dependencies=[Depends(require_admin)],
)
def obtener_smtp(db: Session = Depends(get_db)):
    c = SmtpService(db).get_config()
    return ConfiguracionSmtpResponse(
        activo=c.activo, host=c.host, puerto=c.puerto,
        usar_tls=c.usar_tls, usar_ssl=c.usar_ssl, usuario=c.usuario,
        tiene_password=bool(c.password_cifrado),
        remitente_email=c.remitente_email, remitente_nombre=c.remitente_nombre,
        ultimo_envio=c.ultimo_envio, ultimo_resultado=c.ultimo_resultado,
    )


@router.put(
    "/configuracion/smtp",
    response_model=ConfiguracionSmtpResponse,
    summary="Guardar la configuración de la cuenta de envío",
    dependencies=[Depends(require_admin)],
)
def guardar_smtp(
    datos: ConfiguracionSmtpUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    servicio = SmtpService(db)
    c = servicio.get_config()
    c.activo = datos.activo
    c.host = datos.host
    c.puerto = datos.puerto
    c.usar_tls = datos.usar_tls
    c.usar_ssl = datos.usar_ssl
    c.usuario = datos.usuario
    c.remitente_email = datos.remitente_email
    c.remitente_nombre = datos.remitente_nombre
    if datos.password:
        c.password_cifrado = cifrar(datos.password)
    db.commit()
    db.refresh(c)
    logger.info("Configuración SMTP actualizada por %s", admin.username)
    return obtener_smtp(db)


@router.post(
    "/configuracion/smtp/probar",
    response_model=OperacionResponse,
    summary="Probar la conexión SMTP sin enviar nada",
    dependencies=[Depends(require_admin)],
)
def probar_smtp(
    datos: ConfiguracionSmtpUpdate | None = None,
    db: Session = Depends(get_db),
):
    resultado = SmtpService(db).probar_conexion(
        password_override=datos.password if datos else None
    )
    return OperacionResponse(**resultado)
