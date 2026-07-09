"""roles y areas operativas iniciales

Revision ID: 20260709_roles_areas_operativas
Revises: 20260709_usuarios_seguridad_hash
Create Date: 2026-07-09
"""

from alembic import op


revision = "20260709_roles_areas_operativas"
down_revision = "20260709_usuarios_seguridad_hash"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE usuarios
        SET area_asignada = 'ESTRUCTURAS_MUEBLES'
        WHERE UPPER(COALESCE(area_asignada, '')) = 'CARPINTERIA';
    """)


def downgrade():
    pass
