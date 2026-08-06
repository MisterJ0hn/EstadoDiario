"""Creación y actualización del esquema, sin Alembic.

En este repositorio NO hay migraciones: el esquema se mantiene desde el código
al arrancar la aplicación (base principal) y al aprovisionar un cliente (base
de tenant). `Base.metadata.create_all()` crea tablas nuevas pero **nunca altera
una tabla que ya existe**, así que toda columna agregada después va declarada
acá además de en el modelo.

**Agregar una columna son tres pasos**:
1. la columna en el modelo SQLAlchemy;
2. una entrada en `COLUMNAS_NUEVAS_TENANT` o `COLUMNAS_NUEVAS_MAESTRA`, según
   en qué base viva la tabla;
3. si el modelo la marca `index=True`, una entrada en los `INDICES_*`.
Saltarse el paso 2 funciona en una base recién creada y falla en producción con
`UndefinedColumn`.

Producción corre PostgreSQL 9.2, que no entiende `ADD COLUMN IF NOT EXISTS`
(9.6) ni `CREATE INDEX IF NOT EXISTS` (9.5): la idempotencia se resuelve a mano
consultando `information_schema` y `pg_indexes` antes de cada ALTER/CREATE.
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.database import BaseMaestra, BaseTenant

logger = logging.getLogger(__name__)


# (tabla, columna, tipo SQL). Lo que create_all() no puede agregar a una tabla
# que ya existe: en la base principal, y en CADA base de cliente ya creada.
COLUMNAS_NUEVAS_MAESTRA: list[tuple[str, str, str]] = [
    # Estado del aprovisionamiento: distingue un alta completa de una que
    # falló a la mitad. Las filas anteriores son clientes que sí quedaron
    # operativos, por eso el DEFAULT las deja en 'listo'.
    ("cliente", "estado_aprovisionamiento", "VARCHAR(20) DEFAULT 'listo'"),
    ("cliente", "error_aprovisionamiento", "TEXT"),
    ("cliente", "fecha_aprovisionamiento", "TIMESTAMPTZ"),
    # Las tres configuraciones que pasaron de ser únicas del sistema a admitir
    # una fila por cliente. En una instalación que viene de la versión de una
    # sola base, estas tablas YA existen sin la columna: la fila que traen
    # queda con cliente_id nulo, que es exactamente la fila global.
    ("configuracion_smtp", "cliente_id", "INTEGER"),
    ("configuracion_google", "cliente_id", "INTEGER"),
    ("configuracion_whatsapp", "cliente_id", "INTEGER"),
]

COLUMNAS_NUEVAS_TENANT: list[tuple[str, str, str]] = [
    # Clave provisoria del usuario del cliente. Los que ya existen tienen su
    # clave definitiva, así que el DEFAULT correcto es FALSE.
    ("usuario", "debe_cambiar_password", "BOOLEAN DEFAULT FALSE"),
]

# (nombre del índice, tabla, columnas). create_all() tampoco crea índices sobre
# columnas agregadas a tablas que ya existían.
INDICES_NUEVOS_MAESTRA: list[tuple[str, str, str]] = []
INDICES_NUEVOS_TENANT: list[tuple[str, str, str]] = []

# Los nombres son los que usa SQLAlchemy para un `index=True` (ix_<tabla>_<col>):
# si no coincidieran, create_all() intentaría crearlos de nuevo en una base
# nueva y chocaría con el que ya está.
INDICES_UNICOS_MAESTRA: list[tuple[str, str, str]] = [
    ("ix_configuracion_smtp_cliente_id", "configuracion_smtp", "cliente_id"),
    ("ix_configuracion_google_cliente_id", "configuracion_google", "cliente_id"),
    ("ix_configuracion_whatsapp_cliente_id", "configuracion_whatsapp", "cliente_id"),
]
INDICES_UNICOS_TENANT: list[tuple[str, str, str]] = []


# Las 15 tablas que debe tener la base de un cliente. Es una verificación, no
# la fuente: las crea BaseTenant.metadata. Si alguien declara un modelo con la
# Base equivocada, la base del cliente queda incompleta y esto lo delata al
# aprovisionar en vez de a las semanas, con un "relation does not exist".
TABLAS_TENANT = (
    "api_llamado_estado_diario",
    "audiencia",
    "correo_log",
    "estado_diario",
    "estado_diario_agenda",
    "estado_diario_corte",
    "estado_diario_origen",
    "google_credencial",
    "jurisdiccion",
    "log_actividades",
    "movimiento",
    "movimiento_corte",
    "reporte_plantilla",
    "usuario",
    "usuario_jurisdiccion",
)


def columna_existe(conn, tabla: str, columna: str) -> bool:
    fila = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :tabla AND column_name = :columna"
        ),
        {"tabla": tabla, "columna": columna},
    ).first()
    return fila is not None


def indice_existe(conn, nombre: str) -> bool:
    fila = conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname = :nombre"),
        {"nombre": nombre},
    ).first()
    return fila is not None


def _aplicar(engine: Engine, columnas, indices, indices_unicos) -> None:
    with engine.begin() as conn:
        for tabla, columna, tipo_sql in columnas:
            try:
                if not columna_existe(conn, tabla, columna):
                    conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo_sql}"))
            except Exception as e:
                logger.error("No se pudo agregar %s.%s: %s", tabla, columna, e)

        for nombre, tabla, columnas_idx in indices:
            try:
                if not indice_existe(conn, nombre):
                    conn.execute(text(f"CREATE INDEX {nombre} ON {tabla} ({columnas_idx})"))
            except Exception as e:
                logger.error("No se pudo crear el índice %s: %s", nombre, e)

        for nombre, tabla, columnas_idx in indices_unicos:
            try:
                if not indice_existe(conn, nombre):
                    conn.execute(
                        text(f"CREATE UNIQUE INDEX {nombre} ON {tabla} ({columnas_idx})")
                    )
            except Exception as e:
                logger.error("No se pudo crear el índice único %s: %s", nombre, e)


def aplicar_esquema_maestra(engine: Engine) -> None:
    """Crea/actualiza el esquema de la base principal. Idempotente."""
    BaseMaestra.metadata.create_all(bind=engine)
    _aplicar(engine, COLUMNAS_NUEVAS_MAESTRA, INDICES_NUEVOS_MAESTRA, INDICES_UNICOS_MAESTRA)


def aplicar_esquema_tenant(engine: Engine) -> None:
    """Crea/actualiza el esquema de la base de un cliente. Idempotente: se
    corre al crear el cliente y también al desplegar una versión con columnas
    nuevas, sobre cada base existente."""
    BaseTenant.metadata.create_all(bind=engine)
    _aplicar(engine, COLUMNAS_NUEVAS_TENANT, INDICES_NUEVOS_TENANT, INDICES_UNICOS_TENANT)

    faltantes = set(TABLAS_TENANT) - set(BaseTenant.metadata.tables)
    if faltantes:
        logger.error(
            "Faltan modelos declarados sobre BaseTenant: %s", ", ".join(sorted(faltantes))
        )
