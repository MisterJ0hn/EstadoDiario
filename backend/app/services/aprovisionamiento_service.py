"""Creación e inicialización de la base de datos de un cliente.

Dos pasos, ambos idempotentes, para que un alta a medio terminar se pueda
reintentar sin dejar nada duplicado:

1. `crear_base_datos()` — `CREATE DATABASE` si no existe.
2. `inicializar_esquema()` — las 13 tablas y los datos semilla.

**Por qué AUTOCOMMIT:** en PostgreSQL `CREATE DATABASE` no puede correr dentro
de un bloque de transacción, y SQLAlchemy abre una implícita en cada conexión.
Sin `isolation_level="AUTOCOMMIT"` el servidor responde
`CREATE DATABASE cannot run inside a transaction block`.

**Por qué una conexión aparte:** tampoco se puede crear una base estando
conectado a ella, así que el CREATE va por una conexión a la base de
mantenimiento (`postgres` por defecto), no por el engine de la maestra.
"""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import crear_engine_tenant, nombre_base_tenant, validar_guid
from app.core.esquema import aplicar_esquema_tenant
from app.models.jurisdiccion import Jurisdiccion

logger = logging.getLogger(__name__)

# Jurisdicciones con que arranca todo cliente nuevo. Son las del PJUD y las
# mismas para todos; el cliente puede agregar las suyas después.
JURISDICCIONES_INICIALES = (
    "Civil",
    "Familia",
    "Laboral",
    "Penal",
    "Cobranza",
    "Corte de Apelaciones",
    "Corte Suprema",
    "Garantía",
    "Policía Local",
)


def base_existe(nombre_base: str) -> bool:
    engine = create_engine(settings.url_mantenimiento, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as conn:
            fila = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :nombre"),
                {"nombre": nombre_base},
            ).first()
        return fila is not None
    finally:
        engine.dispose()


def crear_base_datos(guid: str) -> str:
    """Crea `estado_diario_<guid>` si no existe. Devuelve el nombre de la base.

    El nombre no se puede parametrizar (no es un valor, es un identificador),
    así que va interpolado; `validar_guid` es la lista blanca que hace que eso
    sea seguro. Las comillas dobles son obligatorias porque el guid puede
    traer guiones.
    """
    validar_guid(guid)
    nombre_base = nombre_base_tenant(guid)

    if base_existe(nombre_base):
        logger.info("La base %s ya existía; no se vuelve a crear", nombre_base)
        return nombre_base

    engine = create_engine(settings.url_mantenimiento, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as conn:
            # TEMPLATE template0 + ENCODING + LC_*: si la plantilla por defecto
            # del servidor quedó en SQL_ASCII (pasa en instalaciones viejas),
            # copiarla heredaría ese encoding y el texto acentuado del PJUD
            # reventaría al insertarse.
            conn.execute(
                text(
                    f'CREATE DATABASE "{nombre_base}" '
                    f"TEMPLATE template0 "
                    f"ENCODING '{settings.TENANT_DB_ENCODING}' "
                    f"LC_COLLATE '{settings.TENANT_DB_LOCALE}' "
                    f"LC_CTYPE '{settings.TENANT_DB_LOCALE}'"
                )
            )
        logger.info("Base de datos %s creada", nombre_base)
    finally:
        engine.dispose()

    return nombre_base


def inicializar_esquema(guid: str) -> None:
    """Crea las 13 tablas del cliente y siembra sus datos iniciales.

    NO crea usuarios: el cliente nace sin nadie adentro y el administrador de
    la plataforma los da de alta después, desde la ficha. Así la clave de la
    primera persona la escribe alguien que la va a comunicar, y no queda una
    cuenta genérica creada en el alta que nadie recuerda desactivar.

    Idempotente: se puede volver a correr sobre una base ya inicializada, y de
    hecho hay que correrlo sobre TODAS las bases existentes cuando un
    despliegue agrega columnas (ver `app/core/esquema.py`).
    """
    engine = crear_engine_tenant(nombre_base_tenant(guid))
    try:
        aplicar_esquema_tenant(engine)

        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            _sembrar_jurisdicciones(db)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    finally:
        # Este engine es de un solo uso: el que atiende las requests lo crea y
        # cachea `obtener_engine_tenant`.
        engine.dispose()


def _sembrar_jurisdicciones(db) -> None:
    existentes = {n for (n,) in db.query(Jurisdiccion.nombre).all()}
    for nombre in JURISDICCIONES_INICIALES:
        if nombre not in existentes:
            db.add(Jurisdiccion(nombre=nombre))


def aprovisionar(guid: str) -> str:
    """Crea la base del cliente y la deja usable. Devuelve el nombre de la base."""
    nombre_base = crear_base_datos(guid)
    inicializar_esquema(guid)
    return nombre_base


def actualizar_esquema(guid: str) -> None:
    """Aplica el esquema vigente a una base ya existente, sin sembrar nada."""
    engine = crear_engine_tenant(nombre_base_tenant(guid))
    try:
        aplicar_esquema_tenant(engine)
    finally:
        engine.dispose()


def actualizar_esquema_de_todos(guids) -> tuple[int, int]:
    """Aplica el esquema vigente a TODAS las bases de cliente indicadas.

    Es el equivalente multi-cliente de la migración al arrancar: sin esto, un
    despliegue que agrega una columna la crea solo en las bases nuevas, y los
    clientes que ya existían revientan con `UndefinedColumn` en la primera
    consulta que la toque.

    Devuelve (actualizadas, con error). Un cliente con la base caída no puede
    impedir que se actualicen las demás, así que cada uno va en su propio try.
    """
    actualizadas = 0
    con_error = 0
    for guid in guids:
        try:
            actualizar_esquema(guid)
            actualizadas += 1
        except Exception:
            con_error += 1
            logger.exception("No se pudo actualizar el esquema del cliente %s", guid)
    return actualizadas, con_error
