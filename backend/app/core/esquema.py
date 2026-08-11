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
    # Logo del estudio: base64 y su tipo MIME. TEXT porque un PNG de 100 KB
    # son ~137 KB en base64 y VARCHAR obligaría a elegir un límite arbitrario.
    # Estudio o patrocinador, y cuántos abogados contrató. Las filas
    # anteriores son estudios (se les creó más de un usuario), de ahí el
    # DEFAULT; `cal` queda nulo y se interpreta como "sin tope declarado".
    ("cliente", "tipo", "VARCHAR(20) DEFAULT 'estudio'"),
    ("cliente", "cal", "INTEGER"),
    ("cliente", "logo", "TEXT"),
    ("cliente", "logo_mime", "VARCHAR(100)"),
    # Datos comerciales para la cabecera de la factura. Nulos en los clientes
    # anteriores: la factura los omite en vez de imprimir una línea vacía.
    ("cliente", "giro", "VARCHAR(255)"),
    ("cliente", "direccion", "VARCHAR(255)"),
    ("cliente", "comuna", "VARCHAR(100)"),
    ("cliente", "ciudad", "VARCHAR(100)"),
]

COLUMNAS_NUEVAS_TENANT: list[tuple[str, str, str]] = [
    # Clave provisoria del usuario del cliente. Los que ya existen tienen su
    # clave definitiva, así que el DEFAULT correcto es FALSE.
    ("usuario", "debe_cambiar_password", "BOOLEAN DEFAULT FALSE"),
]

# Lo que se ELIMINA. Al revés que agregar, esto no es opcional: `usuario.rol`
# es NOT NULL sin default de servidor, así que si el modelo deja de escribirla
# y la columna sigue ahí, el primer INSERT de un usuario revienta con
# NotNullViolation en toda base que ya exista.
#
# Se borra en vez de dejarla: una columna `rol` viva en la base, sin nada que
# la lea, es una trampa para el que venga después.
COLUMNAS_A_BORRAR_TENANT: list[tuple[str, str]] = [
    # Dentro de un estudio ya no hay roles: todos hacen de todo.
    ("usuario", "rol"),
]
COLUMNAS_A_BORRAR_MAESTRA: list[tuple[str, str]] = []

# Tablas que se eliminan. Misma idea: dejarlas invita a creer que el permiso
# sigue vigente.
TABLAS_A_BORRAR_TENANT: list[str] = [
    # Permiso de visibilidad por jurisdicción, eliminado con los roles.
    "usuario_jurisdiccion",
]
TABLAS_A_BORRAR_MAESTRA: list[str] = []

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


# Las 18 tablas que debe tener la base de un cliente. Es una verificación, no
# la fuente: las crea BaseTenant.metadata. Si alguien declara un modelo con la
# Base equivocada, la base del cliente queda incompleta y esto lo delata al
# aprovisionar en vez de a las semanas, con un "relation does not exist".
TABLAS_TENANT = (
    "api_llamado_estado_diario",
    "audiencia",
    "causa",
    "causa_corte",
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
    "usuario_password_historial",
    "usuario_rut",
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


def tabla_existe(conn, tabla: str) -> bool:
    fila = conn.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_name = :tabla"),
        {"tabla": tabla},
    ).first()
    return fila is not None


def _aplicar(
    engine: Engine, columnas, indices, indices_unicos, columnas_a_borrar=(), tablas_a_borrar=()
) -> None:
    with engine.begin() as conn:
        # Primero las tablas que se van: pueden tener FK hacia columnas que
        # también se borran más abajo.
        for tabla in tablas_a_borrar:
            try:
                if tabla_existe(conn, tabla):
                    conn.execute(text(f"DROP TABLE {tabla}"))
                    logger.info("Tabla %s eliminada", tabla)
            except Exception as e:
                logger.error("No se pudo eliminar la tabla %s: %s", tabla, e)

        for tabla, columna in columnas_a_borrar:
            try:
                if columna_existe(conn, tabla, columna):
                    conn.execute(text(f"ALTER TABLE {tabla} DROP COLUMN {columna}"))
                    logger.info("Columna %s.%s eliminada", tabla, columna)
            except Exception as e:
                logger.error("No se pudo eliminar %s.%s: %s", tabla, columna, e)

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
    _aplicar(
        engine,
        COLUMNAS_NUEVAS_MAESTRA,
        INDICES_NUEVOS_MAESTRA,
        INDICES_UNICOS_MAESTRA,
        COLUMNAS_A_BORRAR_MAESTRA,
        TABLAS_A_BORRAR_MAESTRA,
    )


def aplicar_esquema_tenant(engine: Engine) -> None:
    """Crea/actualiza el esquema de la base de un cliente. Idempotente: se
    corre al crear el cliente y también al desplegar una versión con columnas
    nuevas, sobre cada base existente."""
    BaseTenant.metadata.create_all(bind=engine)
    _aplicar(
        engine,
        COLUMNAS_NUEVAS_TENANT,
        INDICES_NUEVOS_TENANT,
        INDICES_UNICOS_TENANT,
        COLUMNAS_A_BORRAR_TENANT,
        TABLAS_A_BORRAR_TENANT,
    )

    faltantes = set(TABLAS_TENANT) - set(BaseTenant.metadata.tables)
    if faltantes:
        logger.error(
            "Faltan modelos declarados sobre BaseTenant: %s", ", ".join(sorted(faltantes))
        )
