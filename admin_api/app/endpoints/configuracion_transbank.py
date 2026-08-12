"""Credenciales de Webpay Plus, desde la consola de la plataforma.

Una sola fila global: la cuenta de Transbank donde cae la plata es la de
Temposoft, no la de cada estudio (ver el modelo). Por eso acá no hay
`cliente_id` como en SMTP, Google o WhatsApp.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import transbank
from app.core.crypto import cifrar, descifrar
from app.core.database import get_db_maestra
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.repositories.configuracion_transbank_repository import (
    ConfiguracionTransbankRepository,
)
from app.schemas.configuracion_transbank import (
    ConfiguracionTransbankResponse,
    ConfiguracionTransbankUpdate,
)
from app.schemas.configuracion_whatsapp import OperacionResponse

from admin_api.app.deps import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/configuracion-transbank",
    tags=["Configuración de Transbank"],
    dependencies=[Depends(require_admin)],
)


def _a_response(config) -> ConfiguracionTransbankResponse:
    return ConfiguracionTransbankResponse(
        activo=config.activo,
        ambiente=config.ambiente,
        commerce_code=config.commerce_code,
        tiene_api_key=bool(config.api_key_cifrada),
        fecha_modificacion=config.fecha_modificacion,
    )


@router.get(
    "",
    response_model=ConfiguracionTransbankResponse,
    summary="Obtener la configuración de Webpay",
)
def obtener_configuracion(db: Session = Depends(get_db_maestra)):
    return _a_response(ConfiguracionTransbankRepository(db).get_or_create())


@router.put(
    "",
    response_model=ConfiguracionTransbankResponse,
    summary="Guardar la configuración de Webpay",
)
def guardar_configuracion(
    datos: ConfiguracionTransbankUpdate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    repo = ConfiguracionTransbankRepository(db)
    config = repo.get_or_create()

    config.activo = datos.activo
    # Un ambiente desconocido se guarda como integración: equivocarse hacia el
    # lado que no cobra.
    config.ambiente = (
        transbank.AMBIENTE_PRODUCCION
        if datos.ambiente == transbank.AMBIENTE_PRODUCCION
        else transbank.AMBIENTE_INTEGRACION
    )
    config.commerce_code = datos.commerce_code

    # Campo vacío = el admin no quiso cambiar la API key ya guardada.
    if datos.api_key:
        config.api_key_cifrada = cifrar(datos.api_key)

    repo.save(config)
    logger.warning(
        "Configuración de Transbank actualizada por %s: ambiente %s, pago %s",
        admin.usuario,
        config.ambiente,
        "activo" if config.activo else "apagado",
    )
    return _a_response(config)


@router.post(
    "/probar-conexion",
    response_model=OperacionResponse,
    summary="Probar las credenciales contra Transbank sin cobrar nada",
)
def probar_conexion(db: Session = Depends(get_db_maestra)):
    """Crea una transacción de $10 y **no** la confirma.

    Es la única forma de comprobar las credenciales: Transbank no tiene un
    endpoint de "ping". Sin confirmar no se cobra nada y la transacción se
    reversa sola a los 10 minutos, así que probar en producción es inofensivo.
    """
    config = ConfiguracionTransbankRepository(db).get_or_create()

    api_key = None
    if config.api_key_cifrada:
        try:
            api_key = descifrar(config.api_key_cifrada)
        except ValueError as exc:
            return OperacionResponse(exito=False, mensaje=str(exc))

    try:
        transbank.crear_transaccion(
            config.ambiente,
            config.commerce_code,
            api_key,
            buy_order="PRUEBA-CONEXION",
            session_id="PRUEBA",
            monto=10,
            # No se usa: la transacción no se completa. Tiene que ser una URL
            # válida igual, porque Transbank la valida al crearla.
            return_url="https://localhost/prueba",
        )
    except transbank.ErrorTransbank as exc:
        return OperacionResponse(exito=False, mensaje=str(exc))

    ambiente = (
        "producción"
        if config.ambiente == transbank.AMBIENTE_PRODUCCION
        else "integración"
    )
    return OperacionResponse(
        exito=True,
        mensaje=f"Conexión correcta con Webpay en {ambiente}. "
        "La transacción de prueba no se confirmó, así que no se cobró nada.",
    )
