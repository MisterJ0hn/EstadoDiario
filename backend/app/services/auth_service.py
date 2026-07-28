import logging

from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.core.exceptions import UnauthorizedException, BadRequestException
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.auth import TokenResponse, UserInfo

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session):
        self.user_repo = UsuarioRepository(db)

    def login(self, username: str, password: str) -> TokenResponse:
        user = self.user_repo.find_by_username(username)
        if not user or not verify_password(password, user.password_hash):
            logger.warning("Intento de login fallido para: %s", username)
            raise UnauthorizedException("Credenciales inválidas")

        if not user.activo:
            raise UnauthorizedException("Usuario desactivado")

        token_data = {"sub": str(user.id), "username": user.username, "rol": user.rol}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        logger.info("Login exitoso: %s", username)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedException("Refresh token inválido o expirado")

        user = self.user_repo.find_by_id(int(payload["sub"]))
        if not user or not user.activo:
            raise UnauthorizedException("Usuario no encontrado o desactivado")

        token_data = {"sub": str(user.id), "username": user.username, "rol": user.rol}
        new_access = create_access_token(token_data)
        new_refresh = create_refresh_token(token_data)

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=settings.BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    def get_user_info(self, user_id: int) -> UserInfo:
        user = self.user_repo.find_by_id(user_id)
        if not user:
            raise UnauthorizedException("Usuario no encontrado")
        return UserInfo.model_validate(user)
