"""Ruteo de conexiones en un esquema de **una base de datos por cliente**.

Hay dos esquemas distintos y por lo tanto dos `DeclarativeBase` separadas:

- `BaseMaestra` → base principal (`estado_diario`): `cliente`, los usuarios
  administradores del sistema y las configuraciones. Es una sola, fija, y la
  conoce el proceso desde que arranca.
- `BaseTenant` → base de cada cliente (`estado_diario_<guid>`): las 13 tablas
  operativas. El esquema es idéntico en todas; lo que cambia es a cuál se
  conecta la request.

Están separadas a propósito y no por prolijidad: `usuario` existe en las dos
con columnas distintas (el admin del sistema y el usuario del cliente). Con un
solo `MetaData` serían la misma tabla y `create_all()` crearía las 13 tablas
del cliente dentro de la base principal.

**Cómo sabe la request a qué base ir:** el JWT del usuario de cliente lleva el
guid del cliente (claim `guid`); la dependencia `get_db_tenant` lo lee, pide el
engine de ese guid y abre una sesión sobre él. Nadie arma un engine con un guid
que no venga de un token firmado: eso es lo que impide saltar de tenant.

**Caché de engines:** un engine por guid, creado a demanda y guardado en un
diccionario protegido por lock (uvicorn corre varios threads). Cada engine
mantiene su propio pool, así que el diccionario tiene tope
(`TENANT_ENGINE_CACHE_MAX`) y descarta el menos usado recientemente.
"""

import logging
import re
import threading
from collections import OrderedDict
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseMaestra(DeclarativeBase):
    """Metadata de la base principal. Ver app/models/maestra/."""


class BaseTenant(DeclarativeBase):
    """Metadata de la base de un cliente. Ver app/models/."""


# ── Base principal ────────────────────────────────────────────────────────

engine_maestro = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SesionMaestra = sessionmaker(autocommit=False, autoflush=False, bind=engine_maestro)


def get_db_maestra() -> Iterator[Session]:
    """Sesión sobre la base principal. Solo para clientes, administradores del
    sistema y configuraciones: acá no hay datos operativos de nadie."""
    db = SesionMaestra()
    try:
        yield db
    finally:
        db.close()


# ── Bases de cliente ──────────────────────────────────────────────────────

# El guid viaja hasta un CREATE DATABASE y hasta el nombre de base de la URL,
# ninguno de los dos parametrizable: se valida con lista blanca, no se escapa.
_GUID_VALIDO = re.compile(r"^[a-zA-Z0-9_-]{1,49}$")

_engines: "OrderedDict[str, Engine]" = OrderedDict()
_lock_engines = threading.Lock()


def validar_guid(guid: str) -> str:
    """Devuelve el guid si es utilizable como nombre de base; si no, revienta.

    El largo máximo de un identificador en PostgreSQL es 63 bytes y el prefijo
    ya ocupa parte: por eso el tope de 49.
    """
    if not guid or not _GUID_VALIDO.match(guid):
        raise ValueError(f"Guid de cliente inválido: {guid!r}")
    return guid


def nombre_base_tenant(guid: str) -> str:
    return f"{settings.TENANT_DB_PREFIJO}{validar_guid(guid)}"


def crear_engine_tenant(nombre_base: str) -> Engine:
    """Engine suelto (sin caché) hacia una base de cliente. Lo usa también el
    aprovisionamiento, que necesita conectarse antes de que exista el caché."""
    return create_engine(
        settings.url_base(nombre_base),
        pool_pre_ping=True,
        pool_size=settings.TENANT_POOL_SIZE,
        max_overflow=settings.TENANT_POOL_MAX_OVERFLOW,
        pool_recycle=settings.TENANT_POOL_RECYCLE,
    )


def obtener_engine_tenant(guid: str) -> Engine:
    """Engine de la base del cliente, cacheado por guid."""
    nombre_base = nombre_base_tenant(guid)
    with _lock_engines:
        engine = _engines.get(guid)
        if engine is not None:
            _engines.move_to_end(guid)  # LRU: se acaba de usar
            return engine

        engine = crear_engine_tenant(nombre_base)
        _engines[guid] = engine

        # Al pasarse del tope se bota el menos usado. dispose() cierra su pool;
        # las conexiones en uso siguen vivas hasta que las suelten.
        while len(_engines) > settings.TENANT_ENGINE_CACHE_MAX:
            guid_viejo, engine_viejo = _engines.popitem(last=False)
            logger.info("Descartando engine del tenant %s (caché llena)", guid_viejo)
            engine_viejo.dispose()

        return engine


def crear_sesion_tenant(guid: str) -> Session:
    """Sesión sobre la base del cliente. Quien la abre la cierra."""
    return sessionmaker(
        autocommit=False, autoflush=False, bind=obtener_engine_tenant(guid)
    )()


@contextmanager
def sesion_tenant(guid: str) -> Iterator[Session]:
    """Para los jobs y todo lo que corre fuera de una request de FastAPI."""
    db = crear_sesion_tenant(guid)
    try:
        yield db
    finally:
        db.close()


def olvidar_engine_tenant(guid: str) -> None:
    """Saca el engine del caché y cierra su pool. Se llama al desactivar o
    borrar un cliente para no dejar conexiones abiertas contra su base."""
    with _lock_engines:
        engine = _engines.pop(guid, None)
    if engine is not None:
        engine.dispose()


def cerrar_engines_tenant() -> None:
    """Cierra todos los pools de tenant. Se llama al apagar la aplicación."""
    with _lock_engines:
        engines = list(_engines.values())
        _engines.clear()
    for engine in engines:
        engine.dispose()
