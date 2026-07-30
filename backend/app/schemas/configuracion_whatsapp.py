from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConfiguracionWhatsappResponse(BaseModel):
    """El auth token nunca se devuelve, solo si hay uno guardado."""

    activo: bool
    twilio_account_sid: str | None
    tiene_auth_token: bool = False
    twilio_numero_whatsapp: str | None
    plantilla_content_sid: str | None
    validar_firma_webhook: bool
    fecha_modificacion: datetime

    class Config:
        from_attributes = True


class ConfiguracionWhatsappUpdate(BaseModel):
    activo: bool = False
    twilio_account_sid: Optional[str] = Field(default=None, max_length=64)
    # Vacío o ausente = conservar el auth token ya guardado
    twilio_auth_token: Optional[str] = None
    twilio_numero_whatsapp: Optional[str] = Field(default=None, max_length=40)
    plantilla_content_sid: Optional[str] = Field(default=None, max_length=64)
    validar_firma_webhook: bool = True


class OperacionResponse(BaseModel):
    exito: bool
    mensaje: str
