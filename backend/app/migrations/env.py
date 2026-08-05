from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.core.config import settings
from app.core.database import BaseMaestra

# OJO: Alembic NO está en uso en este repositorio (versions/ está vacío) y este
# archivo está acá solo como andamio. El esquema se mantiene desde el código:
# app/core/esquema.py lo aplica sobre la base principal al arrancar y sobre la
# base de cada cliente al aprovisionarla.
#
# Adoptar Alembic acá no es "generar una revisión": habría que resolver antes
# cómo se versiona un esquema que está replicado en N bases de datos, una por
# cliente, que se crean en cualquier momento. Por eso este env solo apunta a la
# base PRINCIPAL; las de tenant no las puede tocar.
from app.models import maestra  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = BaseMaestra.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
