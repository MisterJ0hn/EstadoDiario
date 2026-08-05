"""Contratos de autenticación.

Ojo con los nombres: en la BASE DE DATOS las columnas del usuario de un cliente
se llaman `usuario`, `correo` y `telefono` (y van cifradas), pero en la API se
exponen como `username` y `email`. No es descuido: el nombre de la columna lo
fijó el diseño del modelo y el del JSON lo consume el frontend. La traducción
se hace en un solo lugar, en los mapeadores de `app/api/v1/endpoints/auth.py` y
`app/services/usuario_service.py`.
"""

from pydantic import BaseModel, Field


class LoginClienteRequest(BaseModel):
    """Login del usuario de un cliente: TRES campos.

    El RUT identifica al cliente en la base principal (y con eso, a qué base de
    datos entrar); el usuario y la clave se validan ya dentro de esa base.
    """

    rut: str = Field(..., min_length=3, examples=["76.543.210-K"])
    username: str = Field(..., min_length=1, examples=["jperez"])
    password: str = Field(..., min_length=1)


class LoginAdminRequest(BaseModel):
    """Login del administrador de la plataforma: solo usuario y password. No
    lleva RUT porque no pertenece a ningún cliente."""

    username: str = Field(..., min_length=1, examples=["admin"])
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    # Verdadero cuando la clave es provisoria. El frontend igual pide el perfil
    # después del login y ahí lo vuelve a ver; se manda acá para que pueda
    # decidir a qué pantalla ir sin esperar esa segunda llamada.
    debe_cambiar_password: bool = False


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class CambiarPasswordRequest(BaseModel):
    """Cambio de contraseña.

    `password_actual` es OPCIONAL a propósito: cuando la clave es provisoria
    (`debe_cambiar_password`), el usuario acaba de entrar con ella y pedírsela
    de nuevo es fricción sin ganancia. En un cambio voluntario —la clave ya es
    definitiva— sí se exige, porque ahí el riesgo es otro: una sesión olvidada
    abierta en un computador ajeno.
    """

    password_nueva: str = Field(..., min_length=8, max_length=100)
    password_actual: str | None = Field(default=None, min_length=1)


class UserInfo(BaseModel):
    """Perfil de la sesión, sirva para un usuario de cliente o para el
    administrador de la plataforma.

    Es una sola forma porque el frontend usa un solo `/auth/me` para ambos. Los
    campos `cliente_*` van nulos en la sesión del administrador, que no opera
    sobre la base de ningún cliente.

    `cliente_guid` es además lo que el frontend manda en el header
    `X-Cliente-Guid`: sin él ese header nunca viaja.
    """

    id: int
    # `username` y `email` salen descifrados de las propiedades `usuario` y
    # `correo` del modelo (ver el docstring del módulo).
    username: str
    email: str | None = None
    nombre: str | None = None
    apellido: str | None = None
    telefono: str | None = None
    # 'superadmin' para el administrador de la plataforma; 'admin' o 'usuario'
    # dentro de un cliente.
    rol: str
    activo: bool
    # La sesión vale, pero el backend rechaza el resto hasta que se cambie.
    debe_cambiar_password: bool = False

    cliente_id: int | None = None
    cliente_nombre: str | None = None
    cliente_rut: str | None = None
    cliente_guid: str | None = None


class ActualizarPerfilRequest(BaseModel):
    """Autoservicio: solo el propio teléfono, no correo/rol/password."""

    telefono: str | None = Field(default=None, max_length=30)
