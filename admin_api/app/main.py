"""Servicio HTTP de la consola de administración de la plataforma.

Proceso aparte del backend de los estudios (`backend/`, puerto 8091): distinto
público, distinto ciclo de despliegue y distinta superficie de ataque. Lo único
que comparte es el paquete `app` de `backend/` —modelos, cifrado, firma de
tokens, ruteo de conexiones, repositorios y aprovisionamiento—; el porqué de
compartirlo y qué implica para la imagen está en `admin_api/app/__init__.py`,
que además deja `backend/` en el `sys.path` antes de que se importe nada.

Se arranca DESDE LA RAÍZ del repositorio:

    uvicorn admin_api.app.main:app --port 8092

Este módulo no se puede importar como `app.main`: ese nombre es el del paquete
compartido.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import recaptcha
from app.core.config import settings
from app.core.database import SesionMaestra, cerrar_engines_tenant, engine_maestro
from app.core.esquema import aplicar_esquema_maestra
from app.core.logging_config import setup_logging

# Importar los dos paquetes de modelos registra ambos esquemas: los de la base
# principal (BaseMaestra) y los de la base de cada cliente (BaseTenant). Acá
# solo se CREA el primero; las 14 tablas del cliente se crean al aprovisionar
# su base (ver app/services/aprovisionamiento_service.py), que es justamente lo
# que hace este servicio al dar de alta un cliente.
from app import models  # noqa: F401
from app.models import maestra  # noqa: F401

from admin_api.app.config import admin_settings
from admin_api.app.router import api_router

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Estado Diario - API de administración",
    description=(
        "Administración de la plataforma multi-cliente: alta de clientes y su "
        "base de datos, dashboard y configuración transversal."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# La SPA se sirve desde otro origen (`admin_app/`, dev-server en 4401), así que
# el navegador manda preflight. Cuando la consola era un solo proceso con su
# HTML esto no existía.
app.add_middleware(
    CORSMiddleware,
    allow_origins=admin_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Contrato de error de la casa: exito/mensaje, no success/message.
    logger.exception("Error no controlado: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"exito": False, "mensaje": "Error interno del servidor"},
    )


app.include_router(api_router)


def _sembrar_administrador_inicial() -> None:
    """Primer administrador del sistema, en el primer arranque.

    Sin él no hay forma de crear el primer cliente: la API de administración
    exige un administrador autenticado y no hay ninguno todavía.

    Nace con `debe_cambiar_password`, así que la clave inicial sirve para
    entrar y para nada más — mientras esté puesta, ningún endpoint de
    administración responde (ver `require_admin` en admin_api/app/deps.py). El
    usuario y la clave salen de la configuración para que el despliegue los
    fije por variable de entorno; la clave NO se escribe en el log.

    Idempotente: si ya existe algún administrador no se crea nada.
    """
    from app.core.security import get_password_hash
    from app.models.maestra.usuario_admin import UsuarioAdmin
    from app.repositories.usuario_admin_repository import UsuarioAdminRepository

    db = SesionMaestra()
    try:
        repo = UsuarioAdminRepository(db)
        if repo.existe_alguno():
            return

        repo.save(
            UsuarioAdmin(
                usuario=settings.ADMIN_INICIAL_USUARIO,
                password_hash=get_password_hash(settings.ADMIN_INICIAL_PASSWORD),
                nombre="Administrador del sistema",
                activo=True,
                debe_cambiar_password=True,
            )
        )
        logger.warning(
            "Primer arranque: se creó el administrador '%s' con clave provisoria. "
            "Hay que cambiarla en el primer inicio de sesión.",
            settings.ADMIN_INICIAL_USUARIO,
        )
    except Exception as e:
        db.rollback()
        logger.error("No se pudo sembrar el administrador inicial: %s", e)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # Solo la base principal. Poner al día las bases de los clientes le toca al
    # backend de los estudios, que es quien las usa en cada request; hacerlo
    # también acá abriría una conexión por cliente en cada reinicio de la
    # consola, sin ganar nada.
    logger.info("Creando/actualizando el esquema de la base principal...")
    aplicar_esquema_maestra(engine_maestro)
    _sembrar_administrador_inicial()
    recaptcha.advertir_configuracion_incompleta()
    logger.info("API de administración iniciada - Ambiente: %s", settings.APP_ENV)


@app.on_event("shutdown")
def on_shutdown():
    # El dashboard y la purga abren una sesión contra la base de cada cliente:
    # al apagar hay que cerrar esos pools o quedan conexiones colgando.
    cerrar_engines_tenant()


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "ambiente": settings.APP_ENV, "servicio": "admin_api"}
