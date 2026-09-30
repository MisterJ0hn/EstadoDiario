"""Contrato del webhook de un cliente visto desde la consola."""

from datetime import datetime

from pydantic import BaseModel, Field


class WebhookConfigUpdate(BaseModel):
    url: str | None = Field(
        default=None, max_length=500, description="Destino de los avisos. https://..."
    )
    activo: bool = False
    enviar_estado_diario: bool = True
    enviar_movimientos: bool = True
    enviar_audiencias: bool = True


class WebhookConfigResponse(BaseModel):
    cliente_id: int
    url: str | None = None
    activo: bool = False
    enviar_estado_diario: bool = True
    enviar_movimientos: bool = True
    enviar_audiencias: bool = True
    # El secreto nunca sale: solo se informa si existe.
    tiene_secreto: bool = False
    ultimo_envio: datetime | None = None
    ultimo_resultado: str | None = None
    # Entregas que agotaron sus reintentos y siguen sin enviarse.
    fallidos: int = 0


class WebhookConfigGuardadaResponse(WebhookConfigResponse):
    """Respuesta de guardar. Trae el secreto solo si se generó en esta llamada
    (primera vez): es la única oportunidad de copiarlo."""

    secreto: str | None = None


class WebhookSecretoResponse(BaseModel):
    """El secreto nuevo, en claro. No se puede volver a ver."""

    secreto: str


class WebhookPruebaResponse(BaseModel):
    exito: bool
    mensaje: str
    status_http: int | None = None


class WebhookEnvioResponse(BaseModel):
    id: int
    evento_id: str
    tipo: str
    origen_id: int | None = None
    lote: int
    total_lotes: int
    total_registros: int
    estado: str
    intentos: int
    proximo_intento: datetime
    ultimo_status_http: int | None = None
    ultimo_error: str | None = None
    fecha_creacion: datetime
    fecha_envio: datetime | None = None


class WebhookEnvioListResponse(BaseModel):
    total: int
    envios: list[WebhookEnvioResponse]


class WebhookReintentoResponse(BaseModel):
    reencolados: int
