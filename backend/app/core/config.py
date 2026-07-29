import os

from pydantic_settings import BaseSettings
from typing import List

# Directorio de archivos subidos (upload web e ingesta por correo)
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
)


class Settings(BaseSettings):
    APP_ENV: str = "development"

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "estado_diario_db"
    POSTGRES_USER: str = "estado_diario_user"
    POSTGRES_PASSWORD: str = "dev_password_2024"

    # JWT
    BACKEND_SECRET_KEY: str = "dev-secret-key"
    BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    BACKEND_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:8090"

    # Logging
    BACKEND_LOG_LEVEL: str = "INFO"

    # Cifrado de la contraseña de la casilla de correo. Si queda vacío se
    # deriva de BACKEND_SECRET_KEY (ver app/core/crypto.py).
    MAIL_ENCRYPTION_KEY: str = ""

    # Zona horaria usada para interpretar la hora de ejecución programada
    TIMEZONE: str = "America/Santiago"

    # URL pública del sitio (sin barra final). Se usa para armar el
    # redirect_uri de Google OAuth y para volver al frontend tras conectar.
    # El Client ID/Secret de Google viven en la BD (ConfiguracionGoogle),
    # no acá: esto solo dice dónde vive la app.
    PUBLIC_BASE_URL: str = "http://localhost:8090"

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.PUBLIC_BASE_URL}/api/v1/google-calendar/callback"

    @property
    def DATABASE_URL(self) -> str:
        # client_encoding explícito: si la BD del host se creó con encoding
        # SQL_ASCII, psycopg2 hereda el códec ascii y falla al insertar
        # texto acentuado (UnicodeEncodeError sobre 'ó', 'ñ', etc.).
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            f"?client_encoding=utf8"
        )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]

    class Config:
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
