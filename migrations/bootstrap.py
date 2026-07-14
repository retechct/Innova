"""Prepare a legacy Innova database and apply pending Alembic revisions."""

import os
from pathlib import Path
from urllib.parse import quote_plus

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool


ROOT = Path(__file__).resolve().parent.parent
ALEMBIC_INI = ROOT / "migrations" / "alembic.ini"
LEGACY_BASELINE = "20260709_roles_areas_operativas"
CORE_TABLES = (
    "usuarios",
    "ventas",
    "items_venta",
    "catalogo_productos",
    "logistica_externa",
    "stock_productos",
    "stock_piezas",
)


def _database_url():
    direct_url = (os.getenv("DATABASE_URL") or "").strip()
    if direct_url:
        if direct_url.startswith("postgres://"):
            return "postgresql+psycopg2://" + direct_url[len("postgres://"):]
        if direct_url.startswith("postgresql://"):
            return "postgresql+psycopg2://" + direct_url[len("postgresql://"):]
        return direct_url

    values = {
        "DB_HOST": os.getenv("DB_HOST"),
        "DB_NAME": os.getenv("DB_NAME"),
        "DB_USER": os.getenv("DB_USER"),
        "DB_PASSWORD": os.getenv("DB_PASSWORD"),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError("Faltan variables de base de datos: " + ", ".join(missing))

    return (
        "postgresql+psycopg2://"
        f"{quote_plus(values['DB_USER'])}:{quote_plus(values['DB_PASSWORD'])}"
        f"@{values['DB_HOST']}/{quote_plus(values['DB_NAME'])}"
    )


def _database_state(url):
    engine = create_engine(url, poolclass=NullPool)
    try:
        with engine.connect() as connection:
            tablas = {
                table_name: bool(connection.execute(
                    text("SELECT to_regclass(:table_name)"),
                    {"table_name": f"public.{table_name}"},
                ).scalar())
                for table_name in CORE_TABLES
            }
            tiene_alembic = bool(connection.execute(
                text("SELECT to_regclass('public.alembic_version')")
            ).scalar())
            revision = None
            if tiene_alembic:
                revision = connection.execute(
                    text("SELECT version_num FROM alembic_version LIMIT 1")
                ).scalar()
            return tablas, revision
    finally:
        engine.dispose()


def upgrade_database():
    url = _database_url()
    tables, revision = _database_state(url)
    config = Config(str(ALEMBIC_INI))

    if not revision:
        missing_core = [name for name, exists in tables.items() if not exists]
        if missing_core:
            raise RuntimeError(
                "La base no tiene historial Alembic ni el esquema heredado completo. "
                "Faltan tablas base: " + ", ".join(missing_core)
            )
        print(f"[MIGRATIONS] Base heredada detectada; stamp {LEGACY_BASELINE}.")
        command.stamp(config, LEGACY_BASELINE)

    command.upgrade(config, "head")
    print("[MIGRATIONS] Esquema actualizado a head.")


if __name__ == "__main__":
    upgrade_database()
