"""Contratos de autenticación.

Ojo con los nombres: en la BASE DE DATOS las columnas del usuario de un cliente
se llaman `usuario`, `correo` y `telefono` (y van cifradas), pero en la API se
exponen como `username` y `email`. No es descuido: el nombre de la columna lo
fijó el diseño del modelo y el del JSON lo consume el frontend. La traducción
se hace en un solo lugar, en los mapeadores de `app/api/v1/endpoints/auth.py` y
`app/services/usuario_service.py`.
"""

from pydantic import BaseModel, Field

from app.core.password_policy import DESCRIPCION as POLITICA_PASSWORD
from app.core.password_policy import LARGO_MAXIMO, LARGO_MINIMO


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

    El `min_length` es solo el corte barato: la política completa (mayúscula,
    minúscula, número y no repetir las últimas) la aplica el servicio, que es
    el único que puede consultar el historial. Ver `app/core/password_policy.py`.
    """

    password_nueva: str = Field(
        ..., min_length=LARGO_MINIMO, max_length=LARGO_MAXIMO, description=POLITICA_PASSWORD
    )
    password_actual: str | None = Field(default=None, min_length=1)


class RecuperarPasswordRequest(BaseModel):
    """Paso 1 de la recuperación por correo.

    El RUT va por lo mismo que en el login: dice en qué base de datos buscar.
    El correo es el del usuario, no el del estudio.
    """

    rut: str = Field(..., min_length=3, examples=["76.543.210-K"])
    email: str = Field(..., min_length=3, max_length=255, examples=["jperez@estudio.cl"])


class RestablecerPasswordRequest(BaseModel):
    """Paso 2: el token que venía en el enlace del correo, y la clave nueva."""

    token: str = Field(..., min_length=10)
    password_nueva: str = Field(
        ..., min_length=LARGO_MINIMO, max_length=LARGO_MAXIMO, description=POLITICA_PASSWORD
    )


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
    activo: bool
    # A QUÉ aplicación pertenece la sesión, no un rol dentro del estudio: los
    # usuarios de un estudio no tienen roles, todos hacen lo mismo.
    #
    # Existe porque las dos apps comparten este contrato y la consola necesita
    # distinguir su propia sesión. Antes se deducía de `rol == "superadmin"`;
    # al eliminarse los roles eso quedó siempre en falso y la consola entró en
    # un bucle de redirecciones que colgaba el navegador.
    es_admin_plataforma: bool = False
    # La sesión vale, pero el backend rechaza el resto hasta que se cambie.
    debe_cambiar_password: bool = False

    cliente_id: int | None = None
    cliente_nombre: str | None = None
    cliente_rut: str | None = None
    # Logo del estudio como `data:<mime>;base64,<...>`, listo para un <img src>.
    # Viaja en la sesión y no por un endpoint aparte porque un <img> no puede
    # mandar el header Authorization, y el logo es de un cliente concreto: no
    # puede quedar en una URL pública.
    cliente_logo: str | None = None
    cliente_guid: str | None = None


class RecaptchaConfigResponse(BaseModel):
    """Lo que el frontend necesita saber de reCAPTCHA, antes de tener sesión.

    La site key es pública por definición —va en el HTML de cualquier sitio que
    use reCAPTCHA—, pero se sirve desde acá en vez de compilarla en los
    `environment.ts` de las tres apps: la site key y el secret son un par, y
    tenerlos en repositorios con ciclos de despliegue distintos garantiza que
    algún día no coincidan. Un par desincronizado falla el 100% de las
    verificaciones con un error que no apunta a su causa.

    El secret NO sale de acá jamás.
    """

    activo: bool
    site_key: str | None = None


class ActualizarPerfilRequest(BaseModel):
    """Autoservicio: solo el propio teléfono, no correo ni contraseña."""

    telefono: str | None = Field(default=None, max_length=30)
