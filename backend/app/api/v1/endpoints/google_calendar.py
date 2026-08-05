"""Conexión OAuth de cada usuario a su Google Calendar personal (opción B:
sin organización de Google Workspace, cada abogado autoriza su propia
cuenta). El Client ID/Secret del proyecto se configuran en
/configuracion-google (solo admin); acá cada usuario autenticado conecta o
desconecta SU cuenta.
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import cifrar
from app.core.database import crear_sesion_tenant, get_db_maestra
from app.core.deps import TenantContexto, get_db_tenant, get_tenant_actual, get_usuario_actual
from app.core.security import create_state_token, decode_token
from app.models.usuario import Usuario
from app.repositories.configuracion_google_repository import ConfiguracionGoogleRepository
from app.repositories.google_credencial_repository import GoogleCredencialRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.configuracion_google import (
    ConectarGoogleResponse,
    EstadoConexionGoogleResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/google-calendar", tags=["Google Calendar"])

_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def _build_flow(client_id: str, client_secret: str) -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=_SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


@router.get(
    "/estado",
    response_model=EstadoConexionGoogleResponse,
    summary="Estado de conexión del usuario actual con Google Calendar",
)
def estado(
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    cred = GoogleCredencialRepository(db).find_by_usuario(current_user.id)
    if cred is None:
        return EstadoConexionGoogleResponse(conectado=False)
    return EstadoConexionGoogleResponse(conectado=True, google_email=cred.google_email)


@router.get(
    "/conectar",
    response_model=ConectarGoogleResponse,
    summary="Arma la URL de consentimiento de Google para conectar la cuenta",
)
def conectar(
    db_maestra: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
    current_user: Usuario = Depends(get_usuario_actual),
):
    # El Client ID/Secret del proyecto de Google vive en la base PRINCIPAL.
    config = ConfiguracionGoogleRepository(db_maestra).get_or_create(None)
    if not config.activo or not config.client_id or not config.client_secret_cifrado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar no está configurado. Contacte a un administrador.",
        )

    from app.core.crypto import descifrar

    flow = _build_flow(config.client_id, descifrar(config.client_secret_cifrado))
    # El guid va en el `state` porque el callback lo trae Google como una
    # redirección del navegador, SIN el token de sesión: sin esto no habría
    # forma de saber en qué base guardar la credencial. El state va firmado,
    # así que el guid no se puede alterar en el camino.
    state = create_state_token(
        {"sub": str(current_user.id), "guid": tenant.guid}, timedelta(minutes=10)
    )
    url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",  # garantiza refresh_token también en reconexiones
        include_granted_scopes="true",
        state=state,
    )
    return ConectarGoogleResponse(url=url)


@router.get(
    "/callback",
    summary="Callback de Google OAuth (público: Google redirige el navegador aquí)",
    include_in_schema=False,
)
def callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db_maestra: Session = Depends(get_db_maestra),
):
    """Lo llama el navegador del usuario cuando Google lo redirige de vuelta.

    No lleva token de sesión (es una redirección, no una llamada del frontend),
    así que no puede depender de `get_db_tenant`: la base sale del `state`, que
    es un token firmado por nosotros y lleva el guid del cliente.
    """
    destino_perfil = f"{settings.PUBLIC_BASE_URL}/perfil"

    if error or not code or not state:
        return RedirectResponse(f"{destino_perfil}?google=error")

    payload = decode_token(state)
    if not payload or payload.get("type") != "oauth_state" or not payload.get("guid"):
        return RedirectResponse(f"{destino_perfil}?google=error")

    db = crear_sesion_tenant(payload["guid"])

    usuario = UsuarioRepository(db).find_by_id(int(payload["sub"]))
    if not usuario:
        db.close()
        return RedirectResponse(f"{destino_perfil}?google=error")

    config = ConfiguracionGoogleRepository(db_maestra).get_or_create(None)
    if not config.client_id or not config.client_secret_cifrado:
        db.close()
        return RedirectResponse(f"{destino_perfil}?google=error")

    from app.core.crypto import descifrar

    try:
        flow = _build_flow(config.client_id, descifrar(config.client_secret_cifrado))
        flow.fetch_token(code=code)
        credentials = flow.credentials

        oauth2 = build("oauth2", "v2", credentials=credentials, cache_discovery=False)
        info = oauth2.userinfo().get().execute()
        google_email = info.get("email", "")

        if not credentials.refresh_token:
            # Ya estaba conectado y Google no reemitió el refresh_token
            # (pasa si "prompt=consent" no se respetó); mantener el que había.
            existente = GoogleCredencialRepository(db).find_by_usuario(usuario.id)
            if existente is None:
                raise ValueError("Google no entregó refresh_token en la primera conexión")
            GoogleCredencialRepository(db).upsert(
                usuario.id, google_email, existente.refresh_token_cifrado
            )
        else:
            GoogleCredencialRepository(db).upsert(
                usuario.id, google_email, cifrar(credentials.refresh_token)
            )

        logger.info("Google Calendar conectado para el usuario %s (%s)", usuario.usuario, google_email)
        return RedirectResponse(f"{destino_perfil}?google=ok")
    except Exception:
        logger.exception("Fallo al completar la conexión con Google Calendar")
        return RedirectResponse(f"{destino_perfil}?google=error")
    finally:
        # La sesión de tenant se abrió a mano (no vino de una dependencia),
        # así que se cierra a mano en todas las salidas.
        db.close()


@router.post(
    "/desconectar",
    summary="Desconecta la cuenta de Google Calendar del usuario actual",
)
def desconectar(
    db: Session = Depends(get_db_tenant),
    current_user: Usuario = Depends(get_usuario_actual),
):
    cred_repo = GoogleCredencialRepository(db)
    cred = cred_repo.find_by_usuario(current_user.id)
    if cred is not None:
        try:
            import requests

            from app.core.crypto import descifrar

            requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": descifrar(cred.refresh_token_cifrado)},
                headers={"content-type": "application/x-www-form-urlencoded"},
                timeout=5,
            )
        except Exception:
            # Best-effort: si Google no responde, igual se borra la conexión local.
            logger.warning("No se pudo revocar el token en Google para %s", current_user.usuario)
        cred_repo.delete(current_user.id)

    return {"exito": True}
