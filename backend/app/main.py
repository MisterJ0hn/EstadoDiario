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
    movimiento,
    audiencia,
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
    ("configuracion_whatsapp", "validar_firma_webhook", "BOOLEAN DEFAULT TRUE"),
    # Observación opcional al marcar un movimiento como resuelto.
    ("estado_diario", "observacion_resuelto", "TEXT"),
    # Discrimina estado diario vs. movimientos en la tabla de archivos. El
    # DEFAULT deja las filas existentes como 'estado_diario', que es lo que son.
    ("estado_diario_origen", "tipo", "VARCHAR(20) DEFAULT 'estado_diario'"),
    # Dueño de la casilla IMAP: la configuración pasó de global a una por
    # usuario. La fila global heredada queda con usuario_id NULL.
    ("configuracion_correo", "usuario_id", "INTEGER REFERENCES usuario(id)"),
    # Dueño de la casilla revisada, para que la bitácora también quede aislada.
    ("correo_log", "usuario_id", "INTEGER REFERENCES usuario(id)"),
    # Identificación del reporte por el ASUNTO del correo. El nombre del
    # archivo dejó de ser confiable: el PJUD se lo cambió al de audiencias.
    ("configuracion_correo", "asunto_estado_diario", "VARCHAR(255)"),
    ("configuracion_correo", "asunto_movimientos", "VARCHAR(255)"),
    ("configuracion_correo", "asunto_audiencias", "VARCHAR(255)"),
    # RUT del dueño de la casilla: respaldo cuando el nombre no lo trae.
    ("configuracion_correo", "rut", "VARCHAR(20)"),
]

# create_all() tampoco crea índices en columnas agregadas a tablas
# existentes (solo en tablas nuevas). Estos calzan con index=True en el
# modelo de EstadoDiarioAgenda.
_INDICES_NUEVOS = [
    ("ix_estado_diario_agenda_finalizado", "estado_diario_agenda", "finalizado"),
    ("ix_estado_diario_agenda_usuario_finaliza_id", "estado_diario_agenda", "usuario_finaliza_id"),
    ("ix_estado_diario_origen_tipo", "estado_diario_origen", "tipo"),
    ("ix_correo_log_usuario_id", "correo_log", "usuario_id"),
]

# El unique de configuracion_correo.usuario_id (una casilla por usuario) no lo
# puede crear create_all() porque la tabla ya existe, y _INDICES_NUEVOS crea
# índices no únicos. Va aparte.
_INDICES_UNICOS_NUEVOS = [
    ("ux_configuracion_correo_usuario_id", "configuracion_correo", "usuario_id"),
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

        for nombre, tabla, columna in _INDICES_UNICOS_NUEVOS:
            try:
                if not _indice_existe(conn, nombre):
                    conn.execute(
                        text(f"CREATE UNIQUE INDEX {nombre} ON {tabla} ({columna})")
                    )
            except Exception as e:
                logger.error("No se pudo crear el índice único %s: %s", nombre, e)


def _asignar_datos_huerfanos() -> None:
    """Los archivos cargados antes del aislamiento por usuario pueden no tener
    dueño. Sin dueño no los vería nadie salvo el admin, así que se le asignan
    explícitamente a él en vez de dejarlos invisibles.

    Es idempotente: en la segunda corrida ya no queda ninguna fila con
    usuario_carga_id NULL y el UPDATE no afecta nada.
    """
    with engine.begin() as conn:
        try:
            admin_id = conn.execute(
                text("SELECT id FROM usuario WHERE rol = 'admin' ORDER BY id LIMIT 1")
            ).scalar()
            if admin_id is None:
                return

            resultado = conn.execute(
                text(
                    "UPDATE estado_diario_origen SET usuario_carga_id = :admin "
                    "WHERE usuario_carga_id IS NULL"
                ),
                {"admin": admin_id},
            )
            if resultado.rowcount:
                logger.info(
                    "Se asignaron %d archivos sin dueño al admin (id=%d)",
                    resultado.rowcount,
                    admin_id,
                )

            conn.execute(
                text(
                    "UPDATE estado_diario_origen SET tipo = 'estado_diario' "
                    "WHERE tipo IS NULL"
                )
            )
        except Exception as e:
            logger.error("No se pudieron asignar los datos huérfanos: %s", e)


@app.on_event("startup")
def on_startup():
    logger.info("Creando tablas en la base de datos...")
    Base.metadata.create_all(bind=engine)
    _aplicar_columnas_nuevas()
    _asignar_datos_huerfanos()
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
