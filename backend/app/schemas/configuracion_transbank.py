from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConfiguracionTransbankResponse(BaseModel):
    """La API key **nunca** se devuelve: solo si hay una guardada.

    Es la misma regla del auth token de Twilio y de la contraseña de la casilla
    de correo. Una pantalla que muestra el secreto en claro lo deja en el
    historial del navegador, en la caché y en cualquier captura de pantalla.
    """

    activo: bool
    # `integracion` (no cobra) o `produccion`.
    ambiente: str
    # No es secreto: viaja en cada transacción y se muestra completo.
    commerce_code: str | None
    tiene_api_key: bool = False
    fecha_modificacion: datetime

    class Config:
        from_attributes = True


class ConfiguracionTransbankUpdate(BaseModel):
    activo: bool = False
    ambiente: str = "integracion"
    commerce_code: Optional[str] = Field(default=None, max_length=32)
    # Vacío o ausente = conservar la API key ya guardada.
    api_key: Optional[str] = None
