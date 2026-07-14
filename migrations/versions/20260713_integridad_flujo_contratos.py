"""Integridad del flujo de contratos, telas y despacho.

Revision ID: 20260713_integridad_flujo
Revises: 20260709_roles_areas_operativas
Create Date: 2026-07-13
"""

from alembic import op


revision = "20260713_integridad_flujo"
down_revision = "20260709_roles_areas_operativas"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT TRUE;")
    op.execute("""
        UPDATE usuarios
        SET area_asignada = 'ESTRUCTURAS_MUEBLES'
        WHERE UPPER(COALESCE(area_asignada, '')) = 'CARPINTERIA';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(150) NOT NULL,
            email VARCHAR(120),
            telefono VARCHAR(20),
            dni VARCHAR(20),
            direccion TEXT,
            contrasena VARCHAR(255),
            fecha_alta TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT;")
    op.execute("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contrasena VARCHAR(255);")

    op.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id ON ventas (cliente_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_clientes_dni ON clientes (dni);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (LOWER(nombre));")
    op.execute("CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes (LOWER(email));")
    op.execute("""
        WITH candidatos AS (
            SELECT v.id AS venta_id, MIN(c.id) AS cliente_id
            FROM ventas v
            JOIN clientes c ON (
                (COALESCE(v.dni_cliente, '') <> '' AND c.dni = v.dni_cliente)
                OR
                (COALESCE(v.celular_cliente, '') <> '' AND c.telefono = v.celular_cliente)
            )
            WHERE v.cliente_id IS NULL
            GROUP BY v.id
            HAVING COUNT(DISTINCT c.id) = 1
        )
        UPDATE ventas v
        SET cliente_id = candidatos.cliente_id
        FROM candidatos
        WHERE v.id = candidatos.venta_id;
    """)

    op.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS stock_producto_id INTEGER;")
    op.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS stock_pieza_id INTEGER;")
    op.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS es_stock BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS catalogo_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_items_venta_catalogo_id ON items_venta (catalogo_id);")
    op.execute("""
        WITH candidatos AS (
            SELECT iv.id AS item_id, MIN(cp.id) AS catalogo_id
            FROM items_venta iv
            JOIN catalogo_productos cp ON cp.nombre_modelo = iv.producto
            WHERE iv.catalogo_id IS NULL
            GROUP BY iv.id
            HAVING COUNT(DISTINCT cp.id) = 1
        )
        UPDATE items_venta iv
        SET catalogo_id = candidatos.catalogo_id
        FROM candidatos
        WHERE iv.id = candidatos.item_id;
    """)

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
            ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP,
            ADD COLUMN IF NOT EXISTS proveedor_informal VARCHAR(200);
    """)
    op.execute("""
        UPDATE logistica_externa
        SET categoria_insumo = 'TELA'
        WHERE COALESCE(categoria_insumo, '') != 'TELA'
          AND (
                LOWER(COALESCE(insumo_nombre, '')) LIKE '%tela%'
                OR LOWER(COALESCE(unidad, '')) IN ('mts', 'metro', 'metros')
              );
    """)
    op.execute("""
        UPDATE logistica_externa
        SET estado_distribucion = 'En espera'
        WHERE LOWER(BTRIM(COALESCE(estado_distribucion, ''))) = 'listo para recojo';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS logistica_externa_items (
            logistica_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            rol_componente VARCHAR(120),
            cantidad NUMERIC(12,2),
            unidad VARCHAR(30),
            PRIMARY KEY (logistica_id, item_id)
        );
    """)

    op.execute("""
        INSERT INTO logistica_externa_items (logistica_id, item_id)
        SELECT id, item_id
        FROM logistica_externa
        WHERE item_id IS NOT NULL
        ON CONFLICT (logistica_id, item_id) DO NOTHING;
    """)
    op.execute("""
        INSERT INTO logistica_externa_items (logistica_id, item_id)
        SELECT l.id, BTRIM(extra_id)::INTEGER
        FROM logistica_externa l
        CROSS JOIN LATERAL regexp_split_to_table(
            COALESCE(l.item_ids_extra, ''), ','
        ) AS extra_id
        WHERE BTRIM(extra_id) ~ '^[0-9]+$'
        ON CONFLICT (logistica_id, item_id) DO NOTHING;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_logistica_externa_items_item
        ON logistica_externa_items (item_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_logistica_flujo_contrato
        ON logistica_externa (venta_id, estado, estado_distribucion);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tickets_dependencias_item
        ON tickets_produccion (item_id, area_trabajo, estado_ticket);
    """)

    op.execute("""
        ALTER TABLE stock_estructuras_sofa
            ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS fecha_entrega_chofer TIMESTAMP,
            ADD COLUMN IF NOT EXISTS carpintero_nombre VARCHAR(150),
            ADD COLUMN IF NOT EXISTS chofer_nombre VARCHAR(150),
            ADD COLUMN IF NOT EXISTS es_antiguo BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS medida_brazo NUMERIC(8,2),
            ADD COLUMN IF NOT EXISTS foto_entrega_url TEXT,
            ADD COLUMN IF NOT EXISTS comentario_entrega TEXT;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_stock_estructuras_disponible
        ON stock_estructuras_sofa (estado, ticket_id);
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS pagos_carpinteros (
            id SERIAL PRIMARY KEY,
            carpintero_nombre VARCHAR(150) NOT NULL,
            semana_inicio DATE NOT NULL,
            semana_fin DATE NOT NULL,
            estructuras_ids JSONB NOT NULL DEFAULT '[]',
            cantidad_estructuras INTEGER NOT NULL DEFAULT 0,
            monto_total NUMERIC(12,2) NOT NULL DEFAULT 0,
            registrado_por VARCHAR(150),
            fecha_pago TIMESTAMP DEFAULT NOW(),
            notas TEXT,
            voucher_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("ALTER TABLE pagos_carpinteros ADD COLUMN IF NOT EXISTS voucher_url TEXT;")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_pagos_carpinteros_semana
        ON pagos_carpinteros (semana_inicio, semana_fin, carpintero_nombre);
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS gastos_logistica (
            id SERIAL PRIMARY KEY,
            concepto VARCHAR(300) NOT NULL,
            monto NUMERIC(12,2) NOT NULL DEFAULT 0,
            categoria VARCHAR(50) NOT NULL DEFAULT 'Otro',
            proveedor_nombre VARCHAR(200),
            fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
            registrado_por VARCHAR(150),
            notas TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_gastos_logistica_fecha ON gastos_logistica (fecha_gasto);")
    op.execute("""
        CREATE TABLE IF NOT EXISTS sofa_modelos_custom (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            label VARCHAR(255) NOT NULL,
            medidas VARCHAR(50) NOT NULL,
            foto_url TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS ordenes_compra_seq (
            id SERIAL PRIMARY KEY,
            logistica_id INTEGER,
            numero_oc VARCHAR(50) NOT NULL,
            url_pdf TEXT,
            public_id TEXT,
            pdf_bytes BYTEA,
            fecha_emision TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("ALTER TABLE ordenes_compra_seq ADD COLUMN IF NOT EXISTS public_id TEXT;")
    op.execute("ALTER TABLE ordenes_compra_seq ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA;")
    op.execute("ALTER TABLE sugerencias_insumos ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;")

    op.execute("""
        CREATE TABLE IF NOT EXISTS historial_precios (
            id SERIAL PRIMARY KEY,
            venta_id INTEGER NOT NULL,
            codigo_venta VARCHAR(50),
            precio_original NUMERIC(10,2) NOT NULL,
            precio_nuevo NUMERIC(10,2) NOT NULL,
            motivo TEXT NOT NULL,
            vendedor_id INTEGER,
            vendedor_nombre VARCHAR(100),
            admin_id INTEGER,
            admin_nombre VARCHAR(100),
            estado VARCHAR(20) DEFAULT 'Pendiente',
            notas_admin TEXT,
            fecha_solicitud TIMESTAMP DEFAULT NOW(),
            fecha_resolucion TIMESTAMP,
            item_id INTEGER,
            producto_nombre VARCHAR(200),
            tipo_cambio VARCHAR(30) DEFAULT 'precio',
            detalle_nuevo TEXT
        );
    """)
    op.execute("""
        ALTER TABLE historial_precios
            ADD COLUMN IF NOT EXISTS item_id INTEGER,
            ADD COLUMN IF NOT EXISTS producto_nombre VARCHAR(200),
            ADD COLUMN IF NOT EXISTS tipo_cambio VARCHAR(30) DEFAULT 'precio',
            ADD COLUMN IF NOT EXISTS detalle_nuevo TEXT;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_historial_precios_venta_estado
        ON historial_precios (venta_id, estado);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ventas_eliminadas_log (
            id SERIAL PRIMARY KEY,
            venta_id INTEGER,
            codigo_venta VARCHAR(50),
            nombre_cliente VARCHAR(150),
            monto_total NUMERIC(10,2),
            vendedor_nombre VARCHAR(100),
            fecha_emision_original TIMESTAMP,
            snapshot_items JSONB,
            motivo TEXT NOT NULL,
            eliminado_por_id INTEGER,
            eliminado_por_nombre VARCHAR(100),
            fecha_eliminacion TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ventas_eliminadas_codigo
        ON ventas_eliminadas_log (codigo_venta, fecha_eliminacion);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ajustes_sueldo_vendedor (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('descuento','aumento')),
            monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
            motivo TEXT,
            semana_inicio DATE NOT NULL,
            semana_fin DATE NOT NULL,
            aplicado BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS cierres_semanales_vendedor (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            semana_inicio DATE NOT NULL,
            semana_fin DATE NOT NULL,
            sueldo_base NUMERIC(10,2) DEFAULT 350,
            comision NUMERIC(10,2) DEFAULT 0,
            aumentos NUMERIC(10,2) DEFAULT 0,
            descuentos NUMERIC(10,2) DEFAULT 0,
            saldo_anterior NUMERIC(10,2) DEFAULT 0,
            monto_pagado NUMERIC(10,2) DEFAULT 0,
            notas TEXT,
            voucher_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cierres_vendedor_semana
        ON cierres_semanales_vendedor (usuario_id, semana_inicio);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ajustes_vendedor_pendientes
        ON ajustes_sueldo_vendedor (usuario_id, aplicado, semana_inicio, semana_fin);
    """)

    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS sku_maestro TEXT;")
    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS config_json JSONB;")
    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS fotos_urls TEXT DEFAULT '';")
    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS modo_abastecimiento TEXT DEFAULT 'STOCK_DIRECTO';")
    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS requiere_tela BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS observaciones TEXT;")
    op.execute("ALTER TABLE stock_productos ADD COLUMN IF NOT EXISTS sku_maestro TEXT;")
    op.execute("ALTER TABLE stock_productos ADD COLUMN IF NOT EXISTS fotos_adicionales TEXT;")
    op.execute("ALTER TABLE stock_productos ADD COLUMN IF NOT EXISTS observaciones TEXT;")
    op.execute("ALTER TABLE stock_piezas ADD COLUMN IF NOT EXISTS fotos_adicionales TEXT;")
    op.execute("ALTER TABLE stock_piezas ADD COLUMN IF NOT EXISTS foto_url TEXT;")
    op.execute("ALTER TABLE stock_piezas ADD COLUMN IF NOT EXISTS sku_maestro TEXT;")

    op.execute("""
        UPDATE catalogo_productos cp
        SET sku_maestro = fuente.sku_maestro
        FROM (
            SELECT catalogo_id, MIN(NULLIF(UPPER(sku_maestro), '')) AS sku_maestro
            FROM stock_productos
            WHERE catalogo_id IS NOT NULL
            GROUP BY catalogo_id
        ) fuente
        WHERE cp.id = fuente.catalogo_id
          AND COALESCE(cp.sku_maestro, '') = ''
          AND fuente.sku_maestro IS NOT NULL;
    """)
    op.execute("""
        UPDATE catalogo_productos
        SET sku_maestro = CASE
            WHEN NOT EXISTS (
                SELECT 1
                FROM catalogo_productos existente
                WHERE existente.id != catalogo_productos.id
                  AND UPPER(existente.sku_maestro) =
                      UPPER('PRD-' || LPAD(catalogo_productos.id::text, 8, '0'))
            ) THEN 'PRD-' || LPAD(id::text, 8, '0')
            ELSE 'AUTO-' || LPAD(id::text, 8, '0') || '-' ||
                 SUBSTRING(md5(id::text), 1, 8)
        END
        WHERE COALESCE(sku_maestro, '') = '';
    """)
    op.execute("""
        WITH duplicados AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY UPPER(sku_maestro) ORDER BY id) AS posicion
            FROM catalogo_productos
            WHERE COALESCE(sku_maestro, '') <> ''
        )
        UPDATE catalogo_productos cp
        SET sku_maestro = 'AUTO-DUP-' || LPAD(cp.id::text, 8, '0') || '-' ||
                           SUBSTRING(md5(cp.id::text || cp.sku_maestro), 1, 8)
        FROM duplicados
        WHERE cp.id = duplicados.id AND duplicados.posicion > 1;
    """)
    op.execute("""
        UPDATE stock_productos sp
        SET sku_maestro = cp.sku_maestro
        FROM catalogo_productos cp
        WHERE sp.catalogo_id = cp.id
          AND sp.sku_maestro IS DISTINCT FROM cp.sku_maestro;
    """)
    op.execute("""
        WITH grupos AS (
            SELECT categoria, LOWER(nombre_modelo) AS nombre_modelo,
                   COALESCE(observaciones, '') AS observaciones,
                   MIN(id) AS primer_id
            FROM stock_productos
            WHERE COALESCE(sku_maestro, '') = ''
            GROUP BY categoria, LOWER(nombre_modelo), COALESCE(observaciones, '')
        )
        UPDATE stock_productos sp
        SET sku_maestro = 'STK-' || LPAD(grupos.primer_id::text, 8, '0')
        FROM grupos
        WHERE sp.categoria IS NOT DISTINCT FROM grupos.categoria
          AND LOWER(sp.nombre_modelo) = grupos.nombre_modelo
          AND COALESCE(sp.observaciones, '') = grupos.observaciones
          AND COALESCE(sp.sku_maestro, '') = '';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_sku_maestro_unique
        ON catalogo_productos (UPPER(sku_maestro))
        WHERE sku_maestro IS NOT NULL AND sku_maestro != '';
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_prod_sku ON stock_productos (UPPER(sku_maestro));")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_prod_nombre ON stock_productos (LOWER(nombre_modelo));")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_prod_sede ON stock_productos (sede_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_piezas_sku ON stock_piezas (sku_maestro);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_piezas_sede ON stock_piezas (sede_id);")

    op.execute("ALTER TABLE maestro_bases ADD COLUMN IF NOT EXISTS acabado VARCHAR(50) DEFAULT '';")
    op.execute("ALTER TABLE maestro_bases_comedor ADD COLUMN IF NOT EXISTS acabado VARCHAR(50) DEFAULT '';")
    op.execute("ALTER TABLE creaciones_vendedores ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;")

    op.execute("""
        CREATE TABLE IF NOT EXISTS disenos_referencia (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            categoria VARCHAR(100),
            descripcion TEXT,
            foto_url TEXT,
            url_pinterest TEXT,
            vendedor VARCHAR(150),
            estado VARCHAR(20) DEFAULT 'Pendiente',
            motivo_rechazo TEXT,
            fecha_creacion TIMESTAMP DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_disenos_referencia_estado ON disenos_referencia (estado, fecha_creacion);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS ventas_tienda (
            id SERIAL PRIMARY KEY,
            fecha TIMESTAMP DEFAULT NOW(),
            usuario_id INTEGER,
            usuario_nombre VARCHAR(120),
            tipo_registro VARCHAR(20) DEFAULT 'producto',
            registro_id INTEGER NOT NULL,
            codigo_barra VARCHAR(80),
            nombre_producto VARCHAR(200),
            categoria VARCHAR(80),
            foto_url TEXT,
            sede_nombre VARCHAR(120),
            precio_venta NUMERIC(10,2) NOT NULL,
            observaciones TEXT
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ventas_tienda_fecha ON ventas_tienda (fecha DESC);")


def downgrade():
    # Se preservan columnas y asociaciones operativas para no perder trazabilidad.
    pass
