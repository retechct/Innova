"""Asegura columnas de seguridad para usuarios internos.

Revision ID: 20260709_usuarios_seguridad_hash
Revises: 51135cb4d5f7
Create Date: 2026-07-09
"""

from alembic import op


revision = "20260709_usuarios_seguridad_hash"
down_revision = "51135cb4d5f7"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT TRUE;")


def downgrade():
    # No se eliminan columnas de seguridad para evitar perdida de credenciales
    # migradas o datos operativos capturados despues del upgrade.
    pass
