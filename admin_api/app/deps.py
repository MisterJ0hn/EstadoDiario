"""Dependencias de FastAPI: quién pide, y con qué permiso.

Una sola cadena de autenticación —`get_admin_actual` → `require_admin`— sobre la
base PRINCIPAL. Acá no hay tenant: la administración no opera sobre la base de
ningún estudio salvo cuando explícitamente abre una sesión hacia una (ver
`AdminClienteService`), y en ese caso el guid sale de la ficha del cliente
leída de la base principal, nunca de la request.

El equivalente de cliente (`get_tenant_actual`, `get_db_tenant`,
`get_usuario_actual`) vive en `app/core/deps.py` del backend de los estudios y
acá no se usa: un token de estudio no debe abrir nada de este servicio.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.security import decode_token
from app.models.maestra.usuario_admin import UsuarioAdmin

from admin_api.app.services.auth_admin_service import AMBITO_ADMIN

security_scheme = HTTPBearer()

# Código propio para "tienes que cambiar la clave antes de seguir". Se usa 403
# y un mensaje fijo para que la SPA lo reconozca y mande a esa pantalla.
MENSAJE_CAMBIO_PASSWORD = "Debe cambiar su contraseña antes de continuar"


def payload_valido(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return payload


def get_admin_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db_maestra),
) -> UsuarioAdmin:
    """Administrador autenticado, sin exigir que ya haya cambiado la clave.

    Solo la deberían usar el perfil y el cambio de contraseña; todo lo demás va
    por `require_admin`.
    """
    payload = payload_valido(credentials)
    if payload.get("ambito") != AMBITO_ADMIN:
        # Un token de usuario de estudio llega firmado y vigente, pero con
        # `ambito=cliente`: se corta acá y no ve un solo dato de la consola.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este recurso es solo para administradores del sistema",
        )

    admin = db.get(UsuarioAdmin, int(payload.get("sub", 0)))
    if not admin or not admin.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado",
        )
    return admin


def require_admin(admin: UsuarioAdmin = Depends(get_admin_actual)) -> UsuarioAdmin:
    """Administrador con la clave ya definitiva.

    Mientras `debe_cambiar_password` esté puesto, el login entrega token pero
    ningún endpoint de administración responde: con una clave provisoria
    conocida, cualquiera que la adivine podría crear clientes.
    """
    if admin.debe_cambiar_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MENSAJE_CAMBIO_PASSWORD,
        )
    return admin
