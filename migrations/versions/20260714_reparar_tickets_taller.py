"""Repara las columnas requeridas por la bandeja de tickets del taller.

Revision ID: 20260714_taller_tickets_fix
Revises: 20260714_cotizaciones_seguras
Create Date: 2026-07-14
"""

from alembic import op


revision = "20260714_taller_tickets_fix"
down_revision = "20260714_cotizaciones_seguras"
branch_labels = None
depends_on = None


def upgrade():
    # Es intencionalmente idempotente: algunas bases heredadas ya recibieron
    # parte de estas columnas mediante correcciones manuales antiguas.
    op.execute("""
        ALTER TABLE logistica_externa
            ADD COLUMN IF NOT EXISTS categoria_insumo VARCHAR(30) DEFAULT 'OTRO',
            ADD COLUMN IF NOT EXISTS estado_distribucion VARCHAR(30),
            ADD COLUMN IF NOT EXISTS item_ids_extra TEXT,
            ADD COLUMN IF NOT EXISTS cantidad NUMERIC(12,2),
            ADD COLUMN IF NOT EXISTS unidad VARCHAR(30),
            ADD COLUMN IF NOT EXISTS item_id INTEGER,
            ADD COLUMN IF NOT EXISTS operario_id INTEGER,
            ADD COLUMN IF NOT EXISTS recogido_por_id INTEGER,
            ADD COLUMN IF NOT EXISTS distribuido_por_id INTEGER,
            ADD COLUMN IF NOT EXISTS fecha_recojo_fisico TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_distribucion TIMESTAMP,
            ADD COLUMN IF NOT EXISTS proveedor_informal VARCHAR(200),
            ADD COLUMN IF NOT EXISTS tipo_gestion VARCHAR(20) DEFAULT 'Externo';
    """)
    op.execute("""
        UPDATE logistica_externa
        SET categoria_insumo = COALESCE(NULLIF(categoria_insumo, ''), 'OTRO'),
            tipo_gestion = COALESCE(NULLIF(tipo_gestion, ''), 'Externo');
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_logistica_flujo_contrato
        ON logistica_externa (venta_id, estado, estado_distribucion);
    """)


def downgrade():
    # No se eliminan columnas operativas para preservar la trazabilidad.
    pass
