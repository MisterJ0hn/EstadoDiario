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
    # Base PRINCIPAL (maestra): clientes, administradores del sistema y
    # configuraciones. No contiene datos operativos de ningún cliente.
    POSTGRES_DB: str = "estado_diario"
    POSTGRES_USER: str = "estado_diario_user"
    POSTGRES_PASSWORD: str = "dev_password_2024"

    # ── Multi-tenant: una base por cliente ──
    # Prefijo del nombre de la base de cada cliente: <prefijo><guid>.
    # Se guarda además en cliente.base_datos para que cambiarlo no deje
    # huérfanos a los clientes ya creados.
    TENANT_DB_PREFIJO: str = "estado_diario_"
    # Base a la que hay que conectarse para poder ejecutar CREATE DATABASE:
    # no se puede crear una base estando conectado a ella.
    POSTGRES_DB_MANTENIMIENTO: str = "postgres"
    # CREATE DATABASE con un ENCODING distinto al de la plantilla solo se
    # permite desde template0, y en ese caso hay que fijar también el locale.
    # 'C' es el único garantizado en cualquier instalación; el orden lexicográfico
    # de acentos no importa acá porque todo el ordenamiento se hace en la app.
    TENANT_DB_ENCODING: str = "UTF8"
    TENANT_DB_LOCALE: str = "C"
    # Pool por cliente. Se multiplica por la cantidad de clientes con tráfico,
    # así que se deja chico a propósito: 2 conexiones fijas + 3 de desborde.
    TENANT_POOL_SIZE: int = 2
    TENANT_POOL_MAX_OVERFLOW: int = 3
    # Recicla conexiones antes de que las corte el server (PostgreSQL 9.2 en
    # producción, detrás de un firewall que corta ociosas).
    TENANT_POOL_RECYCLE: int = 1800
    # Tope de engines vivos en el proceso. Cada uno mantiene su pool abierto;
    # sin tope, mil clientes serían mil pools.
    TENANT_ENGINE_CACHE_MAX: int = 50

    # Al arrancar, aplicar el esquema vigente a TODAS las bases de cliente que
    # ya existen. Es lo que hace que un despliegue con columnas nuevas no deje
    # a los clientes viejos con `UndefinedColumn`. Se abre una conexión por
    # cliente, así que con muchos clientes el arranque se alarga: se puede
    # apagar acá y correrlo aparte en la ventana de mantención.
    APLICAR_ESQUEMA_TENANTS_AL_ARRANCAR: bool = True

    # Dominio de la casilla por defecto de cada cliente: <guid>@<dominio>.
    INBOX_DOMINIO: str = "temposoft.cl"

    # Retención por defecto de log_actividades, en días. El administrador la
    # ajusta por cliente (cliente.dias_retencion_log).
    LOG_ACTIVIDADES_DIAS_RETENCION: int = 90

    # Administrador inicial de la base principal. Sin él no se puede crear
    # ningún cliente, así que se siembra al arrancar si la tabla está vacía.
    ADMIN_INICIAL_USUARIO: str = "admin"
    ADMIN_INICIAL_PASSWORD: str = "admin123"

    # JWT
    BACKEND_SECRET_KEY: str = "dev-secret-key"
    BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    BACKEND_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # CORS. Separados por COMA (ver cors_origins). Los dev-servers del repo:
    # 4400 la app de escritorio, 4300 la de Ionic.
    #
    # El origen tiene que coincidir EXACTO con el que manda el navegador:
    # esquema, host y puerto, sin barra final ni ningún otro carácter de más.
    # Un separador equivocado no da error al arrancar, da un preflight
    # rechazado con "No 'Access-Control-Allow-Origin' header", que parece un
    # problema del endpoint y no de esta línea.
    BACKEND_CORS_ORIGINS: str = "http://localhost:4400,http://localhost:4300"

    # Logging
    BACKEND_LOG_LEVEL: str = "INFO"

    # Cifrado de la contraseña de la casilla de correo. Si queda vacío se
    # deriva de BACKEND_SECRET_KEY (ver app/core/crypto.py).
    MAIL_ENCRYPTION_KEY: str = ""

    # Clave del HMAC con que se calculan los *_hash de búsqueda sobre campos
    # cifrados (ver app/core/hash_busqueda.py). Si queda vacía se deriva de
    # BACKEND_SECRET_KEY. Cambiarla obliga a recalcular todos los hash.
    SEARCH_HASH_KEY: str = ""

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

    def url_base(self, nombre_base: str) -> str:
        """URL de conexión a una base cualquiera del mismo servidor.

        client_encoding explícito: si la BD del host se creó con encoding
        SQL_ASCII, psycopg2 hereda el códec ascii y falla al insertar
        texto acentuado (UnicodeEncodeError sobre 'ó', 'ñ', etc.).
        """
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{nombre_base}"
            f"?client_encoding=utf8"
        )

    @property
    def DATABASE_URL(self) -> str:
        """Base principal. Los datos de cada cliente NO están acá: viven en la
        base propia del cliente (ver app/core/database.py)."""
        return self.url_base(self.POSTGRES_DB)

    @property
    def url_mantenimiento(self) -> str:
        """Conexión usada solo para CREATE DATABASE / comprobar existencia."""
        return self.url_base(self.POSTGRES_DB_MANTENIMIENTO)

    @property
    def cors_origins(self) -> List[str]:
        # Se descartan los vacíos: una coma sobrante al final de la variable
        # metía un origen "" en la lista, que no habilita nada pero deja la
        # configuración efectiva distinta de la que se lee en el .env.
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
