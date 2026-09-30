"""Configuración y seguimiento del webhook de un cliente, desde la consola.

La configuración vive en la base principal y la cola de entregas en la del
cliente: cada método que toca esta última abre su sesión de tenant y la cierra,
igual que `AdminClienteService`.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import sesion_tenant
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.configuracion_webhook import ConfiguracionWebhook
from app.models.webhook_envio import WebhookEnvio
from app.services import webhook_service
from admin_api.app.schemas.webhook import (
    WebhookConfigGuardadaResponse,
    WebhookConfigResponse,
    WebhookConfigUpdate,
    WebhookEnvioListResponse,
    WebhookEnvioResponse,
    WebhookPruebaResponse,
    WebhookSecretoResponse,
)
from admin_api.app.services.cliente_service import ClienteService

logger = logging.getLogger(__name__)


class WebhookAdminService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteService(db_maestra)

    def _cliente(self, cliente_id: int) -> Cliente:
        return self.clientes.obtener_entidad(cliente_id)

    def _cliente_operativo(self, cliente_id: int) -> Cliente:
        cliente = self._cliente(cliente_id)
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            raise BadRequestException(
                "La base de datos del cliente no está lista. "
                "Reintente el aprovisionamiento primero."
            )
        return cliente

    @staticmethod
    def _a_response(cliente_id: int, config: ConfiguracionWebhook | None) -> WebhookConfigResponse:
        if config is None:
            return WebhookConfigResponse(cliente_id=cliente_id)
        return WebhookConfigResponse(
            cliente_id=cliente_id,
            url=config.url,
            activo=config.activo,
            enviar_estado_diario=config.enviar_estado_diario,
            enviar_movimientos=config.enviar_movimientos,
            enviar_audiencias=config.enviar_audiencias,
            tiene_secreto=bool(config.secreto_cifrado),
            ultimo_envio=config.ultimo_envio,
            ultimo_resultado=config.ultimo_resultado,
            fallidos=config.fallidos or 0,
        )

    def obtener(self, cliente_id: int) -> WebhookConfigResponse:
        self._cliente(cliente_id)
        return self._a_response(
            cliente_id, webhook_service.obtener_configuracion(self.db, cliente_id)
        )

    def guardar(self, cliente_id: int, datos: WebhookConfigUpdate) -> WebhookConfigGuardadaResponse:
        self._cliente(cliente_id)
        url = (datos.url or "").strip() or None

        if datos.activo and not url:
            raise BadRequestException("Para activar el webhook indique la URL de destino")
        if url:
            try:
                url = webhook_service.validar_url(url)
            except webhook_service.ErrorDestino as e:
                raise BadRequestException(str(e))

        ahora = datetime.now(timezone.utc)
        config = webhook_service.obtener_configuracion(self.db, cliente_id)
        if config is None:
            config = ConfiguracionWebhook(cliente_id=cliente_id, fecha_creacion=ahora)
            self.db.add(config)

        secreto_nuevo = None
        if not config.secreto_cifrado:
            # Sin secreto el receptor no puede verificar la firma, así que nace
            # con uno. Es la única vez que se muestra.
            secreto_nuevo = webhook_service.generar_secreto()
            config.secreto_cifrado = cifrar(secreto_nuevo)

        config.url = url
        config.activo = datos.activo
        config.enviar_estado_diario = datos.enviar_estado_diario
        config.enviar_movimientos = datos.enviar_movimientos
        config.enviar_audiencias = datos.enviar_audiencias
        config.fecha_actualizacion = ahora
        self.db.commit()
        self.db.refresh(config)

        logger.info(
            "Webhook del cliente %s guardado (activo=%s, host=%s)",
            cliente_id, config.activo, webhook_service._host(url) if url else "-",
        )
        return WebhookConfigGuardadaResponse(
            **self._a_response(cliente_id, config).model_dump(), secreto=secreto_nuevo
        )

    def rotar_secreto(self, cliente_id: int) -> WebhookSecretoResponse:
        """Reemplaza el secreto. Desde este momento el receptor tiene que usar el
        nuevo: lo que ya estaba en cola se firma con él al enviarse."""
        self._cliente(cliente_id)
        config = webhook_service.obtener_configuracion(self.db, cliente_id)
        if config is None:
            raise NotFoundException("El cliente no tiene webhook configurado")
        secreto = webhook_service.generar_secreto()
        config.secreto_cifrado = cifrar(secreto)
        config.fecha_actualizacion = datetime.now(timezone.utc)
        self.db.commit()
        logger.info("Secreto del webhook del cliente %s rotado", cliente_id)
        return WebhookSecretoResponse(secreto=secreto)

    def probar(self, cliente_id: int) -> WebhookPruebaResponse:
        cliente = self._cliente(cliente_id)
        config = webhook_service.obtener_configuracion(self.db, cliente_id)
        if config is None:
            raise NotFoundException("El cliente no tiene webhook configurado")
        return WebhookPruebaResponse(**webhook_service.enviar_prueba(config, cliente))

    # ── Cola de entregas (base del cliente) ───────────────

    def listar_envios(
        self, cliente_id: int, estado: str | None = None, limite: int = 50
    ) -> WebhookEnvioListResponse:
        cliente = self._cliente_operativo(cliente_id)
        with sesion_tenant(cliente.guid) as db_tenant:
            consulta = db_tenant.query(WebhookEnvio)
            if estado:
                consulta = consulta.filter(WebhookEnvio.estado == estado)
            total = consulta.with_entities(func.count(WebhookEnvio.id)).scalar() or 0
            filas = consulta.order_by(WebhookEnvio.id.desc()).limit(limite).all()
            return WebhookEnvioListResponse(
                total=total,
                envios=[
                    WebhookEnvioResponse(
                        id=f.id, evento_id=f.evento_id, tipo=f.tipo, origen_id=f.origen_id,
                        lote=f.lote, total_lotes=f.total_lotes,
                        total_registros=f.total_registros, estado=f.estado,
                        intentos=f.intentos, proximo_intento=f.proximo_intento,
                        ultimo_status_http=f.ultimo_status_http, ultimo_error=f.ultimo_error,
                        fecha_creacion=f.fecha_creacion, fecha_envio=f.fecha_envio,
                    )
                    for f in filas
                ],
            )

    def reintentar(self, cliente_id: int, envio_id: int | None = None) -> int:
        """Devuelve a la cola lo fallido: una entrega, o todas si no se indica."""
        cliente = self._cliente_operativo(cliente_id)
        with sesion_tenant(cliente.guid) as db_tenant:
            n = webhook_service.reencolar_fallidos(db_tenant, envio_id)
        if envio_id is not None and n == 0:
            raise NotFoundException("No hay una entrega fallida con ese id")
        return n
