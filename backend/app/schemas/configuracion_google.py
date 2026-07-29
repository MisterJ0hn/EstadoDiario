from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConfiguracionGoogleResponse(BaseModel):
    """El client secret nunca se devuelve, solo si hay uno guardado."""

    activo: bool
    client_id: str | None
    tiene_client_secret: bool = False
    fecha_modificacion: datetime

    class Config:
        from_attributes = True


class ConfiguracionGoogleUpdate(BaseModel):
    activo: bool = False
    client_id: Optional[str] = Field(default=None, max_length=255)
    # Vacío o ausente = conservar el client secret ya guardado
    client_secret: Optional[str] = None


class EstadoConexionGoogleResponse(BaseModel):
    conectado: bool
    google_email: str | None = None


class ConectarGoogleResponse(BaseModel):
    url: str
