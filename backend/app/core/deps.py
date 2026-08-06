"""Dependencias de FastAPI: quién es quien pide, y a qué base de datos va.

Una sola cadena de autenticación: usuario de un cliente,
`get_tenant_actual` → `get_db_tenant` → `get_usuario_actual`, sobre la base de
ese cliente.

**Acá ya no hay administrador de la plataforma.** Esa consola se separó a
`admin_app/`, que habla con la base principal por su cuenta. Este backend es
solo de los estudios.

El guid del tenant sale SIEMPRE del token firmado, nunca de un parámetro ni de
un header de la request. Es lo único que impide que alguien pida los datos de
otro cliente cambiando un valor. El header `X-Cliente-Guid` que manda el
frontend se usa solo para verificar que calce (ver `get_tenant_actual`).

"""

import logging
from dataclasses import dataclass
from typing import Iterator, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import crear_sesion_tenant, get_db_maestra
from app.core.security import decode_token
from app.models.usuario import Usuario
from app.services.auth_service import AMBITO_CLIENTE

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer()

# Código propio para "tienes que cambiar la clave antes de seguir". Se usa 403
# y un mensaje fijo para que el frontend lo reconozca y mande a esa pantalla.
MENSAJE_CAMBIO_PASSWORD = "Debe cambiar su contraseña antes de continuar"


@dataclass(frozen=True)
class TenantContexto:
    """Lo que el token dice del cliente al que pertenece la request."""

    guid: str
    cliente_id: int
    usuario_id: int
    rol: str


def _payload(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return payload


# ── Usuario de un cliente (base del cliente) ──────────────────────────────


def get_tenant_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    x_cliente_guid: Optional[str] = Header(default=None, alias="X-Cliente-Guid"),
) -> TenantContexto:
    """Cliente al que pertenece la request.

    **El tenant sale del TOKEN, nunca del header.** El frontend manda además
    `X-Cliente-Guid`, pero un header lo controla quien hace la petición: si se
    ruteara la conexión por ahí, cualquiera con una sesión válida cambiaría ese
    valor y leería la base de otro estudio. El header sirve solo como
    verificación cruzada.

    - Si viene y NO coincide con el guid del token → 403 y queda en el log: es
      señal de sesión manipulada, o de dos pestañas con sesiones distintas.
    - Si no viene → se sigue con el tenant del token, sin error, para no romper
      a los clientes que todavía no lo mandan.

    Que nadie "simplifique" esto después tomando el guid del header porque
    llega más a mano: eso es exactamente la filtración entre estudios.
    """
    payload = _payload(credentials)
    if payload.get("ambito") != AMBITO_CLIENTE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este recurso es solo para usuarios de un cliente",
        )

    guid = payload.get("guid")
    cliente_id = payload.get("cliente_id")
    if not guid or not cliente_id:
        # Token viejo o manipulado: sin guid no hay a qué base ir, y adivinar
        # una sería mezclar datos de clientes.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin cliente asociado; vuelva a iniciar sesión",
        )

    if x_cliente_guid and x_cliente_guid != guid:
        # No se dice cuál era el guid del token en la respuesta: sería
        # confirmarle al que probó a qué base sí tiene acceso.
        logger.warning(
            "Header X-Cliente-Guid '%s' no coincide con el tenant del token '%s' "
            "(usuario %s): petición rechazada",
            x_cliente_guid,
            guid,
            payload.get("sub"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El cliente indicado no corresponde a la sesión actual",
        )

    return TenantContexto(
        guid=guid,
        cliente_id=int(cliente_id),
        usuario_id=int(payload.get("sub", 0)),
        rol=payload.get("rol", "usuario"),
    )


def get_db_tenant(
    tenant: TenantContexto = Depends(get_tenant_actual),
) -> Iterator[Session]:
    """Sesión sobre la base del cliente del token. Es la que usan todos los
    endpoints operativos: estado diario, movimientos, audiencias, reportes."""
    db = crear_sesion_tenant(tenant.guid)
    try:
        yield db
    finally:
        db.close()


def get_usuario_actual(
    tenant: TenantContexto = Depends(get_tenant_actual),
    db: Session = Depends(get_db_tenant),
) -> Usuario:
    """Usuario autenticado, leído de la base de su propio cliente."""
    usuario = db.get(Usuario, tenant.usuario_id)
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado",
        )
    return usuario


def require_admin_cliente(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
    """Administrador DEL CLIENTE (ve todo lo del estudio). No tiene ninguna
    relación con el administrador del sistema."""
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requiere rol admin",
        )
    return usuario
