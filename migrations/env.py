import os
from logging.config import fileConfig
from urllib.parse import quote_plus

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def _database_url():
    direct_url = (os.getenv("DATABASE_URL") or "").strip()
    if direct_url:
        if direct_url.startswith("postgres://"):
            return "postgresql+psycopg2://" + direct_url[len("postgres://"):]
        if direct_url.startswith("postgresql://"):
            return "postgresql+psycopg2://" + direct_url[len("postgresql://"):]
        return direct_url

    host = os.getenv("DB_HOST")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")

    missing = [
        key for key, value in {
            "DB_HOST": host,
            "DB_NAME": name,
            "DB_USER": user,
            "DB_PASSWORD": password,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Faltan variables para ejecutar migraciones: " + ", ".join(missing)
        )

    return (
        "postgresql+psycopg2://"
        f"{quote_plus(user)}:{quote_plus(password)}@{host}/{quote_plus(name)}"
    )


def run_migrations_offline():
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        configuration,
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
