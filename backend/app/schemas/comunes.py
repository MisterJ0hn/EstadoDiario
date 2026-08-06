"""Contratos compartidos por varios módulos."""

from pydantic import BaseModel


class OperacionResponse(BaseModel):
    """Respuesta estándar de la API: exito/mensaje, no success/message."""

    exito: bool
    mensaje: str
