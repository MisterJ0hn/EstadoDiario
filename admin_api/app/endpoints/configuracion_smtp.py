"""Cuenta de correo de salida del sistema.

Es la cuenta **del SaaS** (fila con `cliente_id` nulo), la que despacha los
informes de todos los estudios. Por eso vive acá y no en el backend de los
estudios: hasta ahora estaba en `/reportes/configuracion/smtp` protegida con
`require_admin_cliente`, o sea que **el administrador de cualquier estudio
podía cambiarle la cuenta de salida a toda la plataforma**. Al separar la
consola quedó a la vista y se corrigió moviéndola acá.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import get_db_maestra
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.schemas.reporte import (
    ConfiguracionSmtpResponse,
    ConfiguracionSmtpUpdate,
)
from app.services.smtp_service import SmtpService

from admin_api.app.deps import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/configuracion-smtp",
    tags=["Correo de salida"],
    dependencies=[Depends(require_admin)],
)


def _a_response(c) -> ConfiguracionSmtpResponse:
    return ConfiguracionSmtpResponse(
        activo=c.activo,
        host=c.host,
        puerto=c.puerto,
        usar_tls=c.usar_tls,
        usar_ssl=c.usar_ssl,
        usuario=c.usuario,
        # La contraseña nunca sale del servidor; solo si hay una guardada.
        tiene_password=bool(c.password_cifrado),
        remitente_email=c.remitente_email,
        remitente_nombre=c.remitente_nombre,
        ultimo_envio=c.ultimo_envio,
        ultimo_resultado=c.ultimo_resultado,
    )


@router.get("", response_model=ConfiguracionSmtpResponse, summary="Cuenta de salida")
def obtener_configuracion(db: Session = Depends(get_db_maestra)):
    return _a_response(SmtpService(db).get_config())


@router.put("", response_model=ConfiguracionSmtpResponse, summary="Guardar la cuenta de salida")
def guardar_configuracion(
    datos: ConfiguracionSmtpUpdate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    c = SmtpService(db).get_config()
    c.activo = datos.activo
    c.host = datos.host
    c.puerto = datos.puerto
    c.usar_tls = datos.usar_tls
    c.usar_ssl = datos.usar_ssl
    c.usuario = datos.usuario
    c.remitente_email = datos.remitente_email
    c.remitente_nombre = datos.remitente_nombre

    # Campo vacío = no se quiso cambiar la contraseña ya guardada.
    if datos.password:
        c.password_cifrado = cifrar(datos.password)

    db.commit()
    db.refresh(c)
    logger.info("Configuración SMTP actualizada por %s", admin.usuario)
    return _a_response(c)


@router.post(
    "/probar",
    summary="Probar la conexión SMTP sin enviar nada",
)
def probar_conexion(db: Session = Depends(get_db_maestra)):
    """Valida credenciales y cifrado contra el servidor, sin despachar correo.

    Configurar la cuenta a ciegas es la forma más rápida de que los informes
    dejen de llegar sin que nadie se entere hasta que alguien reclama.
    """
    return SmtpService(db).probar_conexion()
