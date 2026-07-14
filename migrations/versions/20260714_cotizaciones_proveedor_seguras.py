"""Completa y asegura el flujo publico de cotizaciones de proveedor.

Revision ID: 20260714_cotizaciones_seguras
Revises: 20260713_integridad_flujo
Create Date: 2026-07-14
"""

from alembic import op


revision = "20260714_cotizaciones_seguras"
down_revision = "20260713_integridad_flujo"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE logistica_externa
            ADD COLUMN IF NOT EXISTS token_respuesta VARCHAR(64),
            ADD COLUMN IF NOT EXISTS token_usado BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS fecha_envio_cotizacion TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_respuesta_proveedor TIMESTAMP,
            ADD COLUMN IF NOT EXISTS notas_proveedor TEXT,
            ADD COLUMN IF NOT EXISTS tipo_gestion VARCHAR(20) DEFAULT 'Externo',
            ADD COLUMN IF NOT EXISTS url_comprobante_pago TEXT,
            ADD COLUMN IF NOT EXISTS url_cotizacion_adjunta TEXT,
            ADD COLUMN IF NOT EXISTS token_orden_compra VARCHAR(64);
    """)
    op.execute("ALTER TABLE logistica_externa ALTER COLUMN estado TYPE VARCHAR(30);")
    op.execute("""
        UPDATE logistica_externa
        SET token_usado = COALESCE(token_usado, FALSE),
            tipo_gestion = COALESCE(NULLIF(tipo_gestion, ''), 'Externo'),
            estado = CASE
                WHEN estado IN ('POR_PEDIR', 'Por Pedir') THEN 'Pendiente'
                ELSE estado
            END;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS cotizaciones_lote (
            id SERIAL PRIMARY KEY,
            token VARCHAR(64) NOT NULL,
            proveedor_id INTEGER NOT NULL,
            estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
            fecha_envio TIMESTAMP NOT NULL DEFAULT NOW(),
            token_usado BOOLEAN NOT NULL DEFAULT FALSE,
            fecha_respuesta TIMESTAMP
        );
    """)
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS token VARCHAR(64);")
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS proveedor_id INTEGER;")
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'Pendiente';")
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMP DEFAULT NOW();")
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS token_usado BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE cotizaciones_lote ADD COLUMN IF NOT EXISTS fecha_respuesta TIMESTAMP;")
    op.execute("UPDATE cotizaciones_lote SET token_usado = FALSE WHERE token_usado IS NULL;")

    op.execute("""
        CREATE TABLE IF NOT EXISTS cotizacion_lote_items (
            id SERIAL PRIMARY KEY,
            lote_id INTEGER NOT NULL,
            logistica_externa_id INTEGER NOT NULL,
            sku VARCHAR(80),
            insumo_nombre TEXT,
            cantidad NUMERIC(12,2),
            unidad VARCHAR(30),
            foto_url TEXT,
            precio_cotizado NUMERIC(10,2),
            fecha_entrega_proveedor DATE,
            notas_item TEXT,
            respondido BOOLEAN NOT NULL DEFAULT FALSE
        );
    """)
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS lote_id INTEGER;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS logistica_externa_id INTEGER;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS sku VARCHAR(80);")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS insumo_nombre TEXT;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS cantidad NUMERIC(12,2);")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS unidad VARCHAR(30);")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS foto_url TEXT;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS precio_cotizado NUMERIC(10,2);")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS fecha_entrega_proveedor DATE;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS notas_item TEXT;")
    op.execute("ALTER TABLE cotizacion_lote_items ADD COLUMN IF NOT EXISTS respondido BOOLEAN DEFAULT FALSE;")
    op.execute("UPDATE cotizacion_lote_items SET respondido = FALSE WHERE respondido IS NULL;")

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cotizaciones_lote_token
        ON cotizaciones_lote (token)
        WHERE token IS NOT NULL AND token <> '';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_cotizacion_lote_items_lote
        ON cotizacion_lote_items (lote_id, id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_cotizacion_lote_items_logistica
        ON cotizacion_lote_items (logistica_externa_id);
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_logistica_token_respuesta
        ON logistica_externa (token_respuesta)
        WHERE token_respuesta IS NOT NULL AND token_respuesta <> '';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_logistica_proveedor_estado
        ON logistica_externa (proveedor_id, estado, id);
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_logistica_token_orden_compra
        ON logistica_externa (token_orden_compra)
        WHERE token_orden_compra IS NOT NULL AND token_orden_compra <> '';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ordenes_compra_logistica
        ON ordenes_compra_seq (logistica_id, id DESC);
    """)


def downgrade():
    # Se preservan cotizaciones y tokens historicos para no perder trazabilidad.
    pass
