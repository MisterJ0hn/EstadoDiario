import re
from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Rol = Literal["admin", "usuario"]

# Validación deliberadamente laxa: evita la dependencia email-validator y solo
# descarta lo que claramente no es una dirección.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class _ConEmail(BaseModel):
    email: Annotated[str, Field(max_length=255)]

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Correo electrónico inválido")
        return v.lower()


class UsuarioResponse(BaseModel):
    """El hash de la contraseña nunca sale del backend."""

    id: int
    username: str
    email: str
    nombre: str | None
    apellido: str | None
    telefono: str | None = None
    rol: str
    activo: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class UsuarioListResponse(BaseModel):
    exito: bool = True
    total: int
    usuarios: list[UsuarioResponse]


class UsuarioCreate(_ConEmail):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    # Número por defecto para recordatorios de WhatsApp; editable al crear cada uno.
    telefono: Optional[str] = Field(default=None, max_length=30)
    rol: Rol = "usuario"
    activo: bool = True


class UsuarioUpdate(_ConEmail):
    """El username no se cambia: identifica al usuario en los registros."""

    # Vacío o ausente = conservar la contraseña actual
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    rol: Rol = "usuario"
    activo: bool = True
