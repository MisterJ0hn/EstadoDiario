import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.database import engine, Base
from app.api.v1.router import api_router

# Import all models so they register with Base
from app.models import (  # noqa: F401
    usuario,
    jurisdiccion,
    estado_diario_origen,
    estado_diario,
    estado_diario_agenda,
    api_llamado_estado_diario,
    configuracion_correo,
    correo_log,
)

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Estado Diario CRM API",
    description="API REST para la gestión de Estado Diario",
    version="1.0.0",
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


@app.on_event("startup")
def on_startup():
    logger.info("Creando tablas en la base de datos...")
    Base.metadata.create_all(bind=engine)
    logger.info("Aplicación iniciada - Ambiente: %s", settings.APP_ENV)

    # Seed initial data
    from app.core.database import SessionLocal
    from app.core.security import get_password_hash
    from app.models.usuario import Usuario as UsuarioModel
    from app.models.jurisdiccion import Jurisdiccion as JurisdiccionModel

    db = SessionLocal()
    try:
        # Create admin user if not exists
        admin = db.query(UsuarioModel).filter(UsuarioModel.username == "admin").first()
        if not admin:
            admin = UsuarioModel(
                username="admin",
                email="admin@estadodiario.cl",
                password_hash=get_password_hash("admin123"),
                nombre="Administrador",
                apellido="Sistema",
                rol="admin",
                activo=True,
            )
            db.add(admin)
            logger.info("Usuario admin creado (password: admin123)")

        # Create sample user
        user = db.query(UsuarioModel).filter(UsuarioModel.username == "usuario").first()
        if not user:
            user = UsuarioModel(
                username="usuario",
                email="usuario@estadodiario.cl",
                password_hash=get_password_hash("usuario123"),
                nombre="Usuario",
                apellido="Demo",
                rol="usuario",
                activo=True,
            )
            db.add(user)
            logger.info("Usuario demo creado (password: usuario123)")

        # Seed jurisdicciones
        jurisdicciones = [
            "Civil", "Familia", "Laboral", "Penal", "Cobranza",
            "Corte de Apelaciones", "Corte Suprema", "Garantía", "Policía Local",
        ]
        for nombre in jurisdicciones:
            exists = db.query(JurisdiccionModel).filter(JurisdiccionModel.nombre == nombre).first()
            if not exists:
                db.add(JurisdiccionModel(nombre=nombre))

        db.commit()
        logger.info("Datos semilla verificados/creados")
    except Exception as e:
        db.rollback()
        logger.error("Error en seed: %s", e)
    finally:
        db.close()


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "ambiente": settings.APP_ENV}
