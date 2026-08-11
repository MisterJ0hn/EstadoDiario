"""Contratos de los usuarios de un cliente.

En la BASE DE DATOS las columnas se llaman `usuario`, `correo` y `telefono`, y
guardan texto cifrado; en la API se exponen como `username` y `email`. La
traducción está en `UsuarioService._a_response`, en un solo lugar.
"""

import re
from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

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


def validar_palabra_unica(v: Optional[str], campo: str) -> Optional[str]:
    """Una sola palabra: sin espacios en el medio.

    El sistema guarda `nombre` y `apellido` por separado, y con espacios
    permitidos la gente escribe el nombre completo en el primer campo y deja el
    segundo vacío. Eso rompe todo lo que arma "Apellido, Nombre" o busca por
    apellido, y no hay forma automática de deshacerlo después: no se sabe si
    "Ana Maria Perez" son dos nombres y un apellido o uno y dos.

    Rechazarlo al escribir es la única oportunidad de tenerlo bien.
    """
    if v is None:
        return None
    limpio = v.strip()
    if not limpio:
        return None
    if any(c.isspace() for c in limpio):
        raise ValueError(
            f"El {campo} debe ser una sola palabra, sin espacios. "
            f"Si son dos, use solo el primero."
        )
    return limpio


class _ConNombreApellido(BaseModel):
    """Mixin: valida `nombre` y `apellido` allí donde existan.

    Va como mixin y no como validador suelto porque son cinco esquemas
    (alta y edición, desde el estudio y desde la consola) y basta con que uno
    quede sin validar para que entren nombres compuestos por esa puerta.
    """

    @field_validator("nombre", check_fields=False)
    @classmethod
    def _validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return validar_palabra_unica(v, "nombre")

    @field_validator("apellido", check_fields=False)
    @classmethod
    def _validar_apellido(cls, v: Optional[str]) -> Optional[str]:
        return validar_palabra_unica(v, "apellido")


class _ConEmail(_ConNombreApellido):
    email: Annotated[str, Field(max_length=255)]

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: str) -> str:
        validado = _validar_direccion(v)
        if validado is None:
            raise ValueError("Correo electrónico inválido")
        return validado


def validar_ruts(v: Optional[list[str]]) -> list[str]:
    """Normaliza la lista de RUT de un usuario: limpia, valida y deduplica.

    Se valida el dígito verificador porque un RUT mal tipeado acá no falla
    nunca: solo hace que la advertencia de importación no aparezca cuando
    debería, que es un error silencioso. El único formato que se acepta sin
    dígito es ninguno — para eso está el módulo 11.
    """
    if not v:
        return []
    limpios: list[str] = []
    for bruto in v:
        rut = (bruto or "").strip()
        if not rut:
            continue
        if not _rut_valido(rut):
            raise ValueError(f"RUT inválido: {bruto}")
        canonico = _rut_canonico(rut)
        if canonico not in limpios:
            limpios.append(canonico)
    return limpios


def _solo_alfanumericos(rut: str) -> str:
    return "".join(c for c in rut if c.isalnum()).upper()


def _rut_canonico(rut: str) -> str:
    """`16.952.077-k` → `16952077-K`. Es como se guarda y como se muestra."""
    limpio = _solo_alfanumericos(rut)
    return f"{limpio[:-1]}-{limpio[-1]}"


def _rut_valido(rut: str) -> bool:
    """Módulo 11. Misma regla que `core/utils/rut.ts` en las tres SPA."""
    limpio = _solo_alfanumericos(rut)
    if len(limpio) < 2 or not limpio[:-1].isdigit():
        return False
    cuerpo, dv = limpio[:-1], limpio[-1]
    suma = 0
    multiplicador = 2
    for digito in reversed(cuerpo):
        suma += int(digito) * multiplicador
        multiplicador = 2 if multiplicador == 7 else multiplicador + 1
    resto = 11 - (suma % 11)
    esperado = {11: "0", 10: "K"}.get(resto, str(resto))
    return dv == esperado


class UsuarioResponse(BaseModel):
    """El hash de la contraseña nunca sale del backend."""

    id: int
    username: str
    email: str | None
    nombre: str | None
    apellido: str | None
    telefono: str | None = None
    activo: bool
    # RUT con los que esta persona recibe archivos del PJUD. Ver `UsuarioRut`:
    # no son el RUT del estudio, son los del abogado que pide los reportes.
    ruts: list[str] = []
    # Clave provisoria pendiente de cambio (la puso un administrador).
    debe_cambiar_password: bool = False
    fecha_creacion: datetime


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
    activo: bool = True


class UsuarioUpdate(_ConEmail):
    """Edición desde el propio estudio.

    `username` es opcional: ausente = conservar el actual. Se puede cambiar
    (antes no) porque es lo que la persona escribe para entrar, y quedarse con
    un nombre mal escrito de por vida no tiene defensa. Lo que NO cambia es el
    `id`, que es lo que referencian los registros de quién hizo qué: renombrar
    el usuario no reescribe la historia.
    """

    username: Optional[str] = Field(
        default=None, min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$"
    )
    # Vacío o ausente = conservar la contraseña actual
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    activo: bool = True


# ── Alta/edición desde la consola de administración de la plataforma ──
# Van aparte de UsuarioCreate/UsuarioUpdate porque el correo acá es opcional:
# el administrador de la plataforma da de alta usuarios de un estudio que puede
# no tener todavía las direcciones, y esa alta no puede quedar bloqueada por
# eso.


class _ConRuts(_ConNombreApellido):
    """Mixin: los RUT del usuario, en el alta y en la edición.

    La lista COMPLETA reemplaza a la anterior; no hay endpoint para agregar o
    quitar uno solo. Es lo que hace el formulario —se editan todos juntos y se
    guarda— y evita el estado intermedio en el que media edición quedó aplicada.
    """

    ruts: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("ruts")
    @classmethod
    def _validar_ruts(cls, v: Optional[list[str]]) -> list[str]:
        return validar_ruts(v)


class UsuarioAdminCreate(_ConRuts):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    # Clave inicial: el usuario queda obligado a cambiarla al entrar.
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = Field(default=None, max_length=255)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    activo: bool = True

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: Optional[str]) -> Optional[str]:
        return _validar_direccion(v)


class UsuarioAdminUpdate(_ConRuts):
    # Ausente = conservar el nombre de usuario actual.
    username: Optional[str] = Field(
        default=None, min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$"
    )
    # Vacío o ausente = conservar la contraseña actual.
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    email: Optional[str] = Field(default=None, max_length=255)
    nombre: Optional[str] = Field(default=None, max_length=200)
    apellido: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    activo: bool = True

    @field_validator("email")
    @classmethod
    def _validar_email(cls, v: Optional[str]) -> Optional[str]:
        return _validar_direccion(v)
