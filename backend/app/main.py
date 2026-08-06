import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import SesionMaestra, cerrar_engines_tenant, engine_maestro
from app.core.esquema import aplicar_esquema_maestra
from app.core.logging_config import setup_logging
from app.api.v1.router import api_router

# Importar los dos paquetes de modelos registra ambos esquemas: los de la base
# principal (BaseMaestra) y los de la base de cada cliente (BaseTenant). El
# backend sigue LEYENDO la base principal (clientes y configuraciones) para
# rutear la ingesta y los envíos; **darlos de alta es de `admin_app/`**, que es
# quien crea las bases de los clientes.
from app import models  # noqa: F401
from app.models import maestra  # noqa: F401

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Estado Diario CRM API",
    description="API REST para la gestión de Estado Diario (multi-cliente)",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"exito": False, "mensaje": "Error interno del servidor"},
    )


# Include API routes
app.include_router(api_router)


def _actualizar_esquema_de_los_clientes() -> None:
    """Aplica el esquema vigente a las bases de cliente que ya existen.

    `create_all()` no alcanza acá: cada cliente tiene su propia base y un
    despliegue que agrega una columna solo la crearía en las bases nuevas. Sin
    esto, los clientes que ya existían fallan con `UndefinedColumn` en la
    primera consulta que toque la columna nueva.

    Se saltan los clientes cuyo aprovisionamiento no terminó: su base puede ni
    existir todavía.
    """
    from app.models.maestra.cliente import Cliente
    from app.repositories.cliente_repository import ClienteRepository
    from app.services import aprovisionamiento_service

    db = SesionMaestra()
    try:
        guids = [
            c.guid
            for c in ClienteRepository(db).find_all()
            if c.estado_aprovisionamiento == Cliente.APROV_LISTO
        ]
    except Exception as e:
        logger.error("No se pudo listar los clientes para actualizar su esquema: %s", e)
        return
    finally:
        db.close()

    if not guids:
        return

    actualizadas, con_error = aprovisionamiento_service.actualizar_esquema_de_todos(guids)
    logger.info(
        "Esquema aplicado a %d bases de cliente (%d con error)", actualizadas, con_error
    )


@app.on_event("startup")
def on_startup():
    logger.info("Creando/actualizando el esquema de la base principal...")
    aplicar_esquema_maestra(engine_maestro)
    if settings.APLICAR_ESQUEMA_TENANTS_AL_ARRANCAR:
        _actualizar_esquema_de_los_clientes()
    logger.info("Aplicación iniciada - Ambiente: %s", settings.APP_ENV)


@app.on_event("shutdown")
def on_shutdown():
    # Cada cliente con tráfico deja un pool abierto: al apagar hay que cerrarlos
    # o el servidor queda con conexiones colgando hasta que expiren.
    cerrar_engines_tenant()


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "ambiente": settings.APP_ENV}
