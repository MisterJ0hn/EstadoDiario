"""Contratos de los usuarios de un cliente.

En la BASE DE DATOS las columnas se llaman `usuario`, `correo` y `telefono`, y
guardan texto cifrado; en la API se exponen como `username` y `email`. La
traducción está en `UsuarioService._a_response`, en un solo lugar.
"""

import re
from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Rol = Literal["admin", "usuario"]

# Validación deliberadamente laxa: evita la dependencia email-validator y solo
# descarta lo que claramente no es una dirección.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validar_direccion(v: Optional[str]) -> Optional[str]:
    if v is None or not v.strip():
        return None
    v = v.strip()
    if not _EMAIL_RE.match(v):
        raise ValueError("Correo electrónico inválido")
    return v.lower()


class _ConEmail(BaseModel):
    email: Annotated[str, Field(max_length=255)]

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: str) -> str:
        validado = _validar_direccion(v)
        if validado is None:
            raise ValueError("Correo electrónico inválido")
        return validado


class UsuarioResponse(BaseModel):
    """El hash de la contraseña nunca sale del backend."""

    id: int
    username: str
    email: str | None
    nombre: str | None
    apellido: str | None
    telefono: str | None = None
    rol: str
    activo: bool
    # Clave provisoria pendiente de cambio (la puso un administrador).
    debe_cambiar_password: bool = False
    fecha_creacion: datetime


class UsuarioListResponse(BaseModel):
    exito: bool = True
    total: int
    usuarios: list[UsuarioResponse]


# ── Permisos de visibilidad (los asigna el admin del estudio) ──


class JurisdiccionOpcion(BaseModel):
    """Jurisdicción disponible para asignar. Va en la respuesta del listado
    para que la pantalla no tenga que pedir el catálogo aparte."""

    id: int
    nombre: str


class PermisosUsuario(BaseModel):
    usuario_id: int
    username: str
    nombre_completo: str
    rol: str
    activo: bool
    # Ids de las jurisdicciones que puede ver. **Vacío = ve todas.**
    jurisdicciones: list[int]


class PermisosUsuarioListResponse(BaseModel):
    exito: bool = True
    total: int
    jurisdicciones: list[JurisdiccionOpcion]
    usuarios: list[PermisosUsuario]


class PermisosUsuarioUpdate(BaseModel):
    # Reemplaza la asignación completa. Vacío = sin restricción (ve todas), no
    # "no ve nada": ver el endpoint.
    jurisdicciones: list[int] = Field(default_factory=list)


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
    """El nombre de usuario no se cambia: identifica a la persona en los registros."""

    # Vacío o ausente = conservar la contraseña actual
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    rol: Rol = "usuario"
    activo: bool = True


# ── Alta/edición desde la consola de administración de la plataforma ──
# Van aparte de UsuarioCreate/UsuarioUpdate porque el correo acá es opcional:
# el administrador de la plataforma da de alta usuarios de un estudio que puede
# no tener todavía las direcciones, y esa alta no puede quedar bloqueada por
# eso.


class UsuarioAdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    # Clave inicial: el usuario queda obligado a cambiarla al entrar.
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = Field(default=None, max_length=255)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    rol: Rol = "usuario"
    activo: bool = True

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: Optional[str]) -> Optional[str]:
        return _validar_direccion(v)


class UsuarioAdminUpdate(BaseModel):
    # Vacío o ausente = conservar la contraseña actual.
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    email: Optional[str] = Field(default=None, max_length=255)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    rol: Rol = "usuario"
    activo: bool = True

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: Optional[str]) -> Optional[str]:
        return _validar_direccion(v)
