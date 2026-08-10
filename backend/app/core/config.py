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

    # Vigencia del enlace de recuperación de contraseña que se manda por
    # correo. Corto a propósito: el enlace permite cambiar la clave sin saber
    # la anterior, así que un correo viejo reenviado no debería seguir
    # sirviendo. Alcanza para leer el correo y usarlo en el momento.
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS. Separados por COMA (ver cors_origins). Los dev-servers del repo son
    # los de los `npm start` de cada app: 4300 la de Ionic (la que se publica) y
    # 4200 la de escritorio (`frontend/`). La consola de administración no va
    # acá: habla con admin_api, que tiene su propia lista.
    #
    # El origen tiene que coincidir EXACTO con el que manda el navegador:
    # esquema, host y puerto, sin barra final ni ningún otro carácter de más.
    # Un separador equivocado no da error al arrancar, da un preflight
    # rechazado con "No 'Access-Control-Allow-Origin' header", que parece un
    # problema del endpoint y no de esta línea.
    BACKEND_CORS_ORIGINS: str = "http://localhost:4300,http://localhost:4200"

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

    # ── reCAPTCHA v3 (invisible, por puntaje) ──
    # El interruptor son las DOS claves: mientras cualquiera esté vacía el
    # sistema se comporta exactamente como antes y no sale nada a la red. Las
    # comparte `admin_api`, que valida el login de la consola con las mismas.
    RECAPTCHA_SECRET_KEY: str = ""
    # Pública por definición: la sirve GET /auth/recaptcha para que el frontend
    # no tenga que traerla compilada (ver app/core/recaptcha.py).
    RECAPTCHA_SITE_KEY: str = ""
    # Bajo este puntaje se rechaza. 0.0 es "bot seguro" y 1.0 "humano seguro";
    # 0.5 es el default de Google. Solo se puede calibrar con datos de
    # producción: en localhost Google devuelve casi siempre 0.9.
    RECAPTCHA_SCORE_MINIMO: float = 0.5
    RECAPTCHA_TIMEOUT_SEGUNDOS: float = 5.0
    # Hostnames aceptados, separados por coma. Vacío = no se valida acá y se
    # confía en la verificación de dominio de la consola de Google. Solo hace
    # falta si esa verificación se desactivó allá.
    RECAPTCHA_HOSTNAMES: str = ""
    # Modo monitor: verifica y deja el puntaje en el log, pero NO rechaza a
    # nadie. Es como hay que estrenarlo en producción — ver DEPLOY.md.
    RECAPTCHA_SOLO_REGISTRAR: bool = False
    # Google inalcanzable → dejar pasar. En false, una caída de Google bloquea
    # todos los ingresos: solo para estar bajo ataque activo.
    RECAPTCHA_FALLA_ABIERTA: bool = True
    # Configurable porque www.recaptcha.net es el dominio alternativo que
    # documenta Google donde google.com está bloqueado.
    RECAPTCHA_VERIFY_URL: str = "https://www.google.com/recaptcha/api/siteverify"

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.PUBLIC_BASE_URL}/api/v1/google-calendar/callback"

    @property
    def recaptcha_hostnames(self) -> List[str]:
        return [h.strip().lower() for h in self.RECAPTCHA_HOSTNAMES.split(",") if h.strip()]

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
