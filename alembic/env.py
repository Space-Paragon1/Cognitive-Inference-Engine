from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Alembic config object
alembic_cfg = context.config

if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

# Import our metadata so Alembic can autogenerate migrations
from engine.db.connection import metadata as target_metadata  # noqa: E402
from engine.db.connection import get_engine  # noqa: E402


def _get_url() -> str:
    """Resolve the database URL from app config (respects CLR_DATABASE_URL)."""
    engine = get_engine()
    return str(engine.url)


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = get_engine()
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
