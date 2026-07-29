import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

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
    google_credencial,
    configuracion_google,
    configuracion_whatsapp,
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


# Base.metadata.create_all() crea tablas nuevas pero nunca altera una tabla
# que ya existe. Las columnas agregadas a tablas viejas necesitan este
# ALTER TABLE explícito. El servidor de producción corre PostgreSQL 9.2
# (sin soporte hace años), que NO entiende "ADD COLUMN IF NOT EXISTS" ni
# "CREATE INDEX IF NOT EXISTS" (llegaron en 9.6 y 9.5 respectivamente), así
# que la idempotencia se resuelve a mano consultando el catálogo antes de
# cada ALTER/CREATE en vez de usar esas cláusulas.
_COLUMNAS_NUEVAS = [
    ("usuario", "telefono", "VARCHAR(30)"),
    ("estado_diario_agenda", "nivel", "VARCHAR(20) DEFAULT 'medio'"),
    ("estado_diario_agenda", "finalizado", "BOOLEAN DEFAULT FALSE"),
    ("estado_diario_agenda", "fecha_finalizacion", "TIMESTAMPTZ"),
    ("estado_diario_agenda", "usuario_finaliza_id", "INTEGER REFERENCES usuario(id)"),
    ("estado_diario_agenda", "notificar_whatsapp", "BOOLEAN DEFAULT FALSE"),
    ("estado_diario_agenda", "whatsapp_telefono", "VARCHAR(30)"),
    ("estado_diario_agenda", "fecha_hora_whatsapp", "TIMESTAMPTZ"),
    ("estado_diario_agenda", "google_event_id", "VARCHAR(255)"),
    ("estado_diario_agenda", "google_calendar_id", "VARCHAR(255)"),
    ("estado_diario_agenda", "google_sync_error", "TEXT"),
]

# create_all() tampoco crea índices en columnas agregadas a tablas
# existentes (solo en tablas nuevas). Estos calzan con index=True en el
# modelo de EstadoDiarioAgenda.
_INDICES_NUEVOS = [
    ("ix_estado_diario_agenda_finalizado", "estado_diario_agenda", "finalizado"),
    ("ix_estado_diario_agenda_usuario_finaliza_id", "estado_diario_agenda", "usuario_finaliza_id"),
]


def _columna_existe(conn, tabla: str, columna: str) -> bool:
    fila = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :tabla AND column_name = :columna"
        ),
        {"tabla": tabla, "columna": columna},
    ).first()
    return fila is not None


def _indice_existe(conn, nombre: str) -> bool:
    fila = conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname = :nombre"),
        {"nombre": nombre},
    ).first()
    return fila is not None


def _aplicar_columnas_nuevas() -> None:
    with engine.begin() as conn:
        for tabla, columna, tipo_sql in _COLUMNAS_NUEVAS:
            try:
                if not _columna_existe(conn, tabla, columna):
                    conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo_sql}"))
            except Exception as e:
                logger.error("No se pudo agregar %s.%s: %s", tabla, columna, e)

        for nombre, tabla, columna in _INDICES_NUEVOS:
            try:
                if not _indice_existe(conn, nombre):
                    conn.execute(text(f"CREATE INDEX {nombre} ON {tabla} ({columna})"))
            except Exception as e:
                logger.error("No se pudo crear el índice %s: %s", nombre, e)


@app.on_event("startup")
def on_startup():
    logger.info("Creando tablas en la base de datos...")
    Base.metadata.create_all(bind=engine)
    _aplicar_columnas_nuevas()
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
