"""
routes_ventas.py — Módulos 2, 3 y 14: Ventas, seguimiento, producción y exportación.
Blueprint: ventas_bp  (sin prefijo de URL)

PUENTE INVENTARIO (Mayo 2026)
─────────────────────────────
Cuando se registra una venta con muebles que tienen es_stock=True y un
stock_producto_id / stock_pieza_id, este módulo ahora:
  1. Marca la unidad física como "Reservado"  en stock_productos / stock_piezas
  2. Deja registro en historial_inventario
  3. Vincula el id de la unidad al ítem de venta (items_venta.stock_producto_id)

Al cambiar estado a "Entregado":  Reservado → Vendido
Al anular la venta:               Reservado → Disponible

El carrito (carrito.js) debe enviar stock_producto_id o stock_pieza_id
dentro de cada elemento del array muebles.
"""

import io
import traceback
import openpyxl
from datetime import datetime
from io import BytesIO, StringIO

import cloudinary.uploader
from flask import Blueprint, jsonify, request, send_file
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from database import get_db_connection, release_db_connection, enviar_notificacion_venta

ventas_bp = Blueprint('ventas', __name__)

# ─── Migración de esquema (se ejecuta una sola vez por proceso) ───────────────
_schema_listo = False

def _asegurar_columnas_inventario():
    """
    Añade stock_producto_id / stock_pieza_id a items_venta si aún no existen.
    Se ejecuta con autocommit=True para que un ALTER TABLE no envenene
    ninguna transacción abierta en caso de error.
    """
    global _schema_listo
    if _schema_listo:
        return
    conn = None
    cur  = None
    try:
        conn = get_db_connection()
        conn.autocommit = True          # DDL fuera de cualquier transacción
        cur  = conn.cursor()
        cur.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS stock_producto_id INTEGER;")
        cur.execute("ALTER TABLE items_venta ADD COLUMN IF NOT EXISTS stock_pieza_id INTEGER;")
        _schema_listo = True
    except Exception as e:
        print(f"⚠️ _asegurar_columnas_inventario: {e}")
        # Aunque falle el ALTER (columna ya existe en versiones <9.6), marcamos
        # igual como listo para no reintentar en cada request.
        _schema_listo = True
    finally:
        if cur:
            cur.close()
        if conn:
            conn.autocommit = False     # Restaurar antes de devolver al pool
            release_db_connection(conn)


# ─── Helper: historial de precios ────────────────────────────────────────────

def _crear_tabla_historial_precios(cursor):
    """Crea la tabla si todavía no existe (auto-migración segura)."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historial_precios (
            id               SERIAL PRIMARY KEY,
            venta_id         INTEGER       NOT NULL,
            codigo_venta     VARCHAR(50),
            precio_original  NUMERIC(10,2) NOT NULL,
            precio_nuevo     NUMERIC(10,2) NOT NULL,
            motivo           TEXT          NOT NULL,
            vendedor_id      INTEGER,
            vendedor_nombre  VARCHAR(100),
            admin_id         INTEGER,
            admin_nombre     VARCHAR(100),
            estado           VARCHAR(20)   DEFAULT 'Pendiente',
            notas_admin      TEXT,
            fecha_solicitud  TIMESTAMP     DEFAULT NOW(),
            fecha_resolucion TIMESTAMP
        );
    """)


# ─── Helper: puente con el inventario real ───────────────────────────────────

def _reservar_unidad(cursor, venta_id, codigo_venta,
                     stock_prod_id, stock_piez_id,
                     usuario_id, usuario_nombre, item_id):
    """
    Marca una unidad física como 'Reservado' y deja huella en
    historial_inventario. Vincula el id al ítem de venta.
    Usa SAVEPOINT para no abortar la transacción padre si algo falla.
    """
    if stock_prod_id:
        tabla, col, tipo = 'stock_productos', 'stock_producto_id', 'producto'
        reg_id = stock_prod_id
    elif stock_piez_id:
        tabla, col, tipo = 'stock_piezas', 'stock_pieza_id', 'pieza'
        reg_id = stock_piez_id
    else:
        return

    try:
        cursor.execute("SAVEPOINT reservar_unidad")

        cursor.execute(
            f"SELECT estado, sede_id, codigo_barra FROM {tabla} WHERE id = %s",
            (reg_id,)
        )
        fila = cursor.fetchone()
        if not fila:
            cursor.execute("RELEASE SAVEPOINT reservar_unidad")
            return  # La unidad ya no existe; continuar sin romper la transacción

        estado_ant, sede_id, barcode = fila

        # Cambiar a Reservado
        cursor.execute(
            f"UPDATE {tabla} SET estado = 'Reservado', actualizado_en = NOW() WHERE id = %s",
            (reg_id,)
        )

        # Historial
        cursor.execute("""
            INSERT INTO historial_inventario
                (tipo_registro, registro_id, codigo_barra, tipo_evento,
                 sede_origen_id, sede_destino_id, estado_anterior, estado_nuevo,
                 usuario_id, usuario_nombre, venta_id, codigo_venta, notas)
            VALUES (%s,%s,%s,'Reserva',%s,NULL,%s,'Reservado',%s,%s,%s,%s,%s);
        """, (tipo, reg_id, barcode, sede_id, estado_ant,
              usuario_id, usuario_nombre, venta_id, codigo_venta,
              f"Reservado al registrar venta {codigo_venta}"))

        # Vincular al ítem de venta
        cursor.execute(f"UPDATE items_venta SET {col} = %s WHERE id = %s", (reg_id, item_id))

        cursor.execute("RELEASE SAVEPOINT reservar_unidad")

    except Exception as e:
        print(f"⚠️  _reservar_unidad ERROR — tabla={tabla if 'tabla' in dir() else '?'} reg_id={reg_id if 'reg_id' in dir() else '?'}")
        print(f"⚠️  Excepción: {type(e).__name__}: {e}")
        print(f"⚠️  Traceback:\n{traceback.format_exc()}")
        cursor.execute("ROLLBACK TO SAVEPOINT reservar_unidad")
        cursor.execute("RELEASE SAVEPOINT reservar_unidad")


def _liberar_unidades(cursor, venta_id, estado_destino, evento_nombre):
    """
    Itera los ítems de la venta y pasa las unidades reservadas al
    estado indicado (Disponible para anulaciones, Vendido para entregas).
    """
    for tabla, col, tipo in [
        ('stock_productos', 'stock_producto_id', 'producto'),
        ('stock_piezas',    'stock_pieza_id',    'pieza'),
    ]:
        try:
            cursor.execute(f"""
                SELECT iv.{col}, sp.estado, sp.sede_id, sp.codigo_barra
                FROM items_venta iv
                JOIN {tabla} sp ON sp.id = iv.{col}
                WHERE iv.venta_id = %s AND iv.{col} IS NOT NULL
                  AND sp.estado = 'Reservado'
            """, (venta_id,))
        except Exception:
            continue  # La columna puede no existir en BD más antiguas

        for reg_id, estado_ant, sede_id, barcode in cursor.fetchall():
            cursor.execute(
                f"UPDATE {tabla} SET estado = %s, actualizado_en = NOW() WHERE id = %s",
                (estado_destino, reg_id)
            )
            cursor.execute("""
                INSERT INTO historial_inventario
                    (tipo_registro, registro_id, codigo_barra, tipo_evento,
                     sede_origen_id, sede_destino_id, estado_anterior, estado_nuevo,
                     usuario_id, usuario_nombre, venta_id, codigo_venta, notas)
                VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, NULL, 'Sistema', %s, NULL, %s)
            """, (tipo, reg_id, barcode, evento_nombre,
                  sede_id, estado_ant, estado_destino,
                  venta_id, f"Cambio automático — {evento_nombre}"))


# ==========================================
# VENTAS — REGISTRO Y LISTADO
# ==========================================

@ventas_bp.route('/api/ventas', methods=['GET', 'POST'])
def guardar_venta():
    if request.method == 'GET':
        return listar_ventas()

    _asegurar_columnas_inventario()   # ← migración segura al primer uso

    datos = request.json
    _paso_actual = "inicio"
    try:
        print(f"\n{'='*60}")
        print(f"[VENTA] Iniciando registro — código: {datos.get('codigo')}")
        print(f"[VENTA] Payload recibido: {datos}")
        print(f"{'='*60}\n")

        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()

        lista_pagos_raw = datos.get('pagos', [])
        empresa_pago_resumen = lista_pagos_raw[0].get('empresa', '') if lista_pagos_raw else ''

        _paso_actual = "INSERT ventas"
        print(f"[PASO 1] {_paso_actual}")
        cursor.execute("""
            INSERT INTO ventas (
                codigo_venta, nombre_cliente, dni_cliente, celular_cliente,
                direccion_cliente, vendedor_id, fecha_emision, fecha_entrega,
                monto_total, vendedor_nombre, moneda, tipo_cambio, tipo_comprobante,
                empresa_ruc, empresa_pago, sede, nombre_empresa_cliente
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (
            datos['codigo'],          datos['cliente'],
            datos.get('dni'),         datos.get('celular'),
            datos.get('direccion'),   datos.get('vendedor_id'),
            datos['fecha_emision'],   datos.get('fecha_entrega'),
            datos.get('monto_total', 0),
            datos.get('vendedor_nombre'),
            datos.get('moneda', 'PEN'),
            datos.get('tipo_cambio', 1.00),
            datos.get('tipo_comprobante', 'Boleta'),
            datos.get('empresa_ruc'),
            empresa_pago_resumen,
            datos.get('sede', 'Sede Central'),
            datos.get('empresa_cliente', 'Particular')
        ))
        venta_id = cursor.fetchone()[0]
        print(f"[PASO 1] OK — venta_id={venta_id}")

        _paso_actual = "crear_tabla_historial_precios"
        print(f"[PASO 2] {_paso_actual}")
        _crear_tabla_historial_precios(cursor)
        cursor.execute("""
            INSERT INTO historial_precios (
                venta_id, codigo_venta, precio_original, precio_nuevo,
                motivo, vendedor_id, vendedor_nombre, estado, fecha_solicitud, fecha_resolucion
            ) VALUES (%s, %s, %s, %s, 'Precio base de creación del contrato', %s, %s, 'Aprobado', NOW(), NOW());
        """, (
            venta_id,
            datos['codigo'],
            float(datos.get('monto_total', 0)),
            float(datos.get('monto_total', 0)),
            datos.get('vendedor_id'),
            datos.get('vendedor_nombre')
        ))
        print(f"[PASO 2] OK")

        # Pagos múltiples
        _paso_actual = "INSERT pagos"
        print(f"[PASO 3] {_paso_actual} — {len(lista_pagos_raw)} pago(s)")
        total_adelanto = 0
        for idx_p, p in enumerate(lista_pagos_raw):
            monto_bruto = p.get('monto', 0)
            total_adelanto += monto_bruto
            print(f"[PASO 3.{idx_p+1}] Pago: {p}")
            cursor.execute("""
                INSERT INTO pagos (
                    venta_id, tipo_pago, entidad, numero_operacion,
                    monto_bruto, comision_pos, monto_neto, empresa_destino, comprobante_url
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                venta_id,
                p.get('tipo'), p.get('entidad'), p.get('operacion'),
                monto_bruto, p.get('comision', 0), p.get('monto_neto', 0),
                p.get('empresa'), p.get('comprobante_url', 'Sin imagen')
            ))
        print(f"[PASO 3] OK — total_adelanto={total_adelanto}")

        if total_adelanto > 0:
            _paso_actual = "UPDATE ventas monto_adelanto"
            cursor.execute(
                "UPDATE ventas SET monto_adelanto = %s WHERE id = %s",
                (total_adelanto, venta_id)
            )
            print(f"[PASO 3b] UPDATE monto_adelanto OK")

        # ── Motor Make-vs-Buy ─────────────────────────────────────────────────
        SUFIJO_TELA = {
            'tela':        ' - Para Sofá/Silla',
            'tela-silla':  ' - Para Silla Comedor',
            'tela-butaca': ' - Para Butaca',
            'tela-cojin':  ' - Para Cojines',
            'cojin-entero':'Cojines Enteros',
            'cojin-diseno':'Cojines c/Diseño',
        }
        mapeo_erp = {
            'tela':              ('maestro_telas',         'CORTE_Y_CONTROL_TELAS'),
            'tela-cojin':        ('maestro_telas',         'CORTE_Y_CONTROL_TELAS'),
            'tela-silla':        ('maestro_telas',         'CORTE_Y_CONTROL_TELAS'),
            'tela-butaca':       ('maestro_telas',         'CORTE_Y_CONTROL_TELAS'),
            'cojin-entero':      ('maestro_telas',         'CORTE_Y_CONTROL_TELAS'),
            'cojin-diseno':      ('maestro_disenos_cojin', 'ARMADO_COJINES'),
            'base':              ('maestro_bases',          'PREPARACION_PATAS_ZOCALO'),
            'tablero':           ('maestro_tableros',       'TABLEROS_Y_PIEDRAS'),
            'tablero-centro':    ('maestro_tableros',       'TABLEROS_Y_PIEDRAS'),
            'silla':             ('maestro_sillas',         'ESTRUCTURAS_SILLAS'),
            'estructura-butaca': ('maestro_butacas',        'ESTRUCTURAS_SILLAS'),
            'base-mesa':         ('maestro_bases_comedor',  'TABLEROS_Y_PIEDRAS'),
            'base-centro':       ('maestro_bases_comedor',  'TABLEROS_Y_PIEDRAS'),
        }

        _paso_actual = "loop muebles"
        print(f"[PASO 4] Procesando {len(datos.get('muebles', []))} mueble(s)")
        for idx_m, m in enumerate(datos['muebles']):
            _paso_actual = f"mueble[{idx_m}] INSERT items_venta"
            print(f"[PASO 4.{idx_m+1}] Mueble: {m}")
            # Limpiar foto_url: si viene con prefijo /uploads/ seguido de una URL absoluta, extraer solo la URL real
            foto_url_raw = m.get('foto', '') or ''
            if '/uploads/https://' in foto_url_raw:
                foto_url_raw = foto_url_raw[foto_url_raw.index('/uploads/https://') + len('/uploads/'):]
            elif '/uploads/http://' in foto_url_raw:
                foto_url_raw = foto_url_raw[foto_url_raw.index('/uploads/http://') + len('/uploads/'):]

            cursor.execute("""
                INSERT INTO items_venta (venta_id, producto, color_tela, foto_url, precio_unitario)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
            """, (venta_id, m.get('tipo'), m.get('tela'), foto_url_raw, m.get('precio')))
            item_id = cursor.fetchone()[0]
            print(f"[PASO 4.{idx_m+1}] item_id={item_id}")

            componentes = m.get('componentes', {})
            areas_internas_creadas = set()

            nombre_lower = m['tipo'].lower()
            area_estructura = None
            if any(p in nombre_lower for p in ['sofá', 'sofa', 'seccional', 'modular', 'multi', 'curvado', 'plantilla']):
                area_estructura = 'ESTRUCTURAS_MUEBLES'
            elif any(p in nombre_lower for p in ['silla', 'butaca', 'sitial', 'puff']):
                area_estructura = 'ESTRUCTURAS_SILLAS'

            if area_estructura:
                _paso_actual = f"mueble[{idx_m}] INSERT ticket {area_estructura}"
                print(f"[PASO 4.{idx_m+1}.a] Ticket area_estructura={area_estructura}")
                cursor.execute("""
                    INSERT INTO tickets_produccion (item_id, area_trabajo, estado_ticket, etapa)
                    VALUES (%s, %s, 'Pendiente', 1)
                """, (item_id, area_estructura))
                areas_internas_creadas.add(area_estructura)

                area_tap = 'TAPICERIA_SOFAS' if area_estructura == 'ESTRUCTURAS_MUEBLES' else 'TAPICERIA_SILLAS'
                cursor.execute("""
                    INSERT INTO tickets_produccion (item_id, area_trabajo, estado_ticket, etapa)
                    VALUES (%s, %s, 'Bloqueado', 2)
                """, (item_id, area_tap))
                areas_internas_creadas.add(area_tap)

            # ── Acumular detalle de cojines para ticket_details_override ─────
            # Leemos los SKUs de cojines del componente antes de procesar el loop
            detalle_cojines_armado  = []   # para ARMADO_COJINES
            detalle_cojines_corte   = []   # para CORTE_Y_CONTROL_TELAS

            for key_c, sku_c in componentes.items():
                if not sku_c:
                    continue
                if key_c == 'cojin-entero':
                    try:
                        cursor.execute("SAVEPOINT sp_cojin_entero")
                        cursor.execute(
                            "SELECT coleccion, color FROM maestro_telas WHERE sku = %s", (sku_c,)
                        )
                        row_te = cursor.fetchone()
                        nombre_tela = f"{row_te[0]} - {row_te[1]}" if row_te else sku_c
                        cursor.execute("RELEASE SAVEPOINT sp_cojin_entero")
                    except Exception:
                        cursor.execute("ROLLBACK TO SAVEPOINT sp_cojin_entero")
                        cursor.execute("RELEASE SAVEPOINT sp_cojin_entero")
                        nombre_tela = sku_c
                    linea = f"Cojín Entero → [{sku_c}] {nombre_tela}"
                    detalle_cojines_armado.append(linea)
                    detalle_cojines_corte.append(linea)

                elif key_c == 'cojin-diseno':
                    try:
                        cursor.execute("SAVEPOINT sp_cojin_diseno")
                        cursor.execute(
                            "SELECT nombre_diseno, tipo_tela FROM maestro_disenos_cojin WHERE sku = %s", (sku_c,)
                        )
                        row_dc = cursor.fetchone()
                        nombre_dis = row_dc[0] if row_dc else sku_c
                        tipo_tela  = row_dc[1] if row_dc else ''
                        cursor.execute("RELEASE SAVEPOINT sp_cojin_diseno")
                    except Exception:
                        cursor.execute("ROLLBACK TO SAVEPOINT sp_cojin_diseno")
                        cursor.execute("RELEASE SAVEPOINT sp_cojin_diseno")
                        nombre_dis, tipo_tela = sku_c, ''
                    linea = f"Cojín c/Diseño → [{sku_c}] {nombre_dis}" + (f" ({tipo_tela})" if tipo_tela else "")
                    detalle_cojines_armado.append(linea)
                    detalle_cojines_corte.append(linea)

            # ─────────────────────────────────────────────────────────────────

            for key, sku in componentes.items():
                if not sku or key not in mapeo_erp:
                    continue
                tabla, area_destino = mapeo_erp[key]
                _paso_actual = f"mueble[{idx_m}] componente key={key} sku={sku} tabla={tabla}"
                print(f"[PASO 4.{idx_m+1}.c] Componente key={key}, sku={sku}, tabla={tabla}, area={area_destino}")

                if key == 'silla':
                    cursor.execute("SELECT material, origen_produccion FROM maestro_sillas WHERE sku = %s", (sku,))
                    res_silla = cursor.fetchone()
                    if res_silla:
                        mat = (res_silla[0] or '').lower()
                        if any(w in mat for w in ['metal', 'acero', 'fierro', 'aluminio']) or res_silla[1] == 'Externo':
                            cursor.execute(
                                "INSERT INTO logistica_externa (venta_id, insumo_nombre, sku, estado) VALUES (%s, %s, %s, 'POR_PEDIR')",
                                (venta_id, key, sku)
                            )
                            continue

                try:
                    cursor.execute(f"SELECT origen_produccion FROM {tabla} WHERE sku = %s", (sku,))
                    res = cursor.fetchone()
                except Exception:
                    res = None

                if res and res[0] == 'Interno':
                    if area_destino not in areas_internas_creadas:
                        # Determinar detalle a guardar en el ticket
                        override_texto = None
                        if area_destino == 'ARMADO_COJINES' and detalle_cojines_armado:
                            override_texto = "COJINERÍA:\n" + "\n".join(detalle_cojines_armado)
                        elif area_destino == 'CORTE_Y_CONTROL_TELAS' and detalle_cojines_corte:
                            # Agregar detalle de cojines al ticket de corte (junto al tipo de tela general)
                            tela_general = componentes.get('tela') or componentes.get('tela-silla') or componentes.get('tela-butaca') or ''
                            override_texto = ("TELA PRINCIPAL: " + tela_general + "\n" if tela_general else "")
                            override_texto += "COJINES:\n" + "\n".join(detalle_cojines_corte)

                        cursor.execute("""
                            INSERT INTO tickets_produccion (item_id, area_trabajo, estado_ticket, etapa, ticket_details_override)
                            VALUES (%s, %s, 'Pendiente', 1, %s)
                        """, (item_id, area_destino, override_texto))
                        areas_internas_creadas.add(area_destino)
                elif res is None or res[0] == 'Externo':
                    cursor.execute(
                        "INSERT INTO logistica_externa (venta_id, insumo_nombre, sku, estado) VALUES (%s, %s, %s, 'POR_PEDIR')",
                        (venta_id, key, sku)
                    )

            # Ticket de Despacho
            # Si es stock ya fabricado → Pendiente; si es producción → Bloqueado
            estado_despacho = 'Pendiente' if m.get('es_stock') else 'Bloqueado'
            _paso_actual = f"mueble[{idx_m}] INSERT ticket DESPACHO_CENTRAL"
            print(f"[PASO 4.{idx_m+1}.d] Ticket DESPACHO_CENTRAL estado={estado_despacho}")
            cursor.execute("""
                INSERT INTO tickets_produccion (item_id, area_trabajo, estado_ticket, etapa)
                VALUES (%s, 'DESPACHO_CENTRAL', %s, 99)
            """, (item_id, estado_despacho))

            # Descuento genérico de stock (contador en catálogo)
            if m.get('es_stock') and m.get('catalogo_id'):
                _paso_actual = f"mueble[{idx_m}] UPDATE catalogo_productos stock"
                print(f"[PASO 4.{idx_m+1}.e] UPDATE stock catalogo_id={m['catalogo_id']}")
                cursor.execute("""
                    UPDATE catalogo_productos
                    SET stock_cantidad = GREATEST(0, stock_cantidad - 1),
                        en_stock = CASE WHEN stock_cantidad - 1 <= 0 THEN false ELSE en_stock END
                    WHERE id = %s AND en_stock = true
                """, (m['catalogo_id'],))

            # ── PUENTE INVENTARIO REAL ────────────────────────────────────────
            _paso_actual = f"mueble[{idx_m}] _reservar_unidad stock_producto_id={m.get('stock_producto_id')} stock_pieza_id={m.get('stock_pieza_id')}"
            print(f"[PASO 4.{idx_m+1}.f] _reservar_unidad: {_paso_actual}")
            _reservar_unidad(
                cursor, venta_id, datos['codigo'],
                m.get('stock_producto_id'),
                m.get('stock_pieza_id'),
                datos.get('vendedor_id'),
                datos.get('vendedor_nombre', ''),
                item_id
            )
            print(f"[PASO 4.{idx_m+1}.f] _reservar_unidad OK")
            # ─────────────────────────────────────────────────────────────────

            # Descuento de insumos por receta (solo productos fabricados)
            _paso_actual = f"mueble[{idx_m}] descuento insumos receta"
            cursor.execute(
                "SELECT cp.id FROM catalogo_productos cp WHERE cp.nombre_modelo = %s LIMIT 1;",
                (m['tipo'],)
            )
            prod_row = cursor.fetchone()
            if prod_row and not m.get('es_stock'):
                print(f"[PASO 4.{idx_m+1}.g] UPDATE insumos receta prod_id={prod_row[0]}")
                cursor.execute("""
                    UPDATE inventario_insumos i
                    SET cantidad_actual = GREATEST(0, i.cantidad_actual - r.cantidad_necesaria)
                    FROM recetas_muebles r
                    WHERE r.insumo_id = i.id AND r.producto_id = %s;
                """, (prod_row[0],))

        print(f"[PASO 5] COMMIT")
        conexion.commit()

        cursor.execute("SELECT email FROM usuarios WHERE id = %s", (datos['vendedor_id'],))
        v_correo = cursor.fetchone()
        if v_correo:
            enviar_notificacion_venta(v_correo[0], datos['codigo'], datos['cliente'])

        print(f"[VENTA] ✅ Venta registrada exitosamente — venta_id={venta_id}\n")
        return jsonify({"mensaje": "Venta procesada exitosamente", "id": venta_id}), 201

    except Exception as ex:
        if 'conexion' in locals() and conexion: conexion.rollback()
        tb = traceback.format_exc()
        print(f"\n{'!'*60}")
        print(f"[ERROR] PASO QUE FALLÓ: {_paso_actual}")
        print(f"[ERROR] EXCEPCIÓN: {type(ex).__name__}: {str(ex)}")
        print(f"[ERROR] TRACEBACK COMPLETO:\n{tb}")
        print(f"{'!'*60}\n")
        error_msg = str(ex)
        if "llave duplicada" in error_msg or "UniqueViolation" in error_msg:
            return jsonify({"error": "El N° de Contrato ya fue registrado."}), 400
        return jsonify({
            "error": error_msg,
            "paso": _paso_actual,
            "detalle": tb
        }), 500
    finally:
        if 'conexion' in locals() and conexion:
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


def listar_ventas():
    """Devuelve todas las ventas sumando los pagos múltiples."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT
                v.codigo_venta, v.nombre_cliente, v.monto_total,
                COALESCE(pg.total_pagado, 0) AS monto_adelanto,
                COALESCE(v.monto_total, 0) - COALESCE(pg.total_pagado, 0) AS saldo,
                COALESCE(v.estado_general, 'Pendiente') AS estado,
                v.fecha_entrega, v.vendedor_nombre,
                COALESCE(itm.productos, '') AS productos,
                v.sede
            FROM ventas v
            LEFT JOIN (
                SELECT venta_id, SUM(monto_bruto) AS total_pagado
                FROM pagos GROUP BY venta_id
            ) pg ON pg.venta_id = v.id
            LEFT JOIN (
                SELECT venta_id, STRING_AGG(producto, ' / ') AS productos
                FROM items_venta GROUP BY venta_id
            ) itm ON itm.venta_id = v.id
            ORDER BY v.id DESC;
        """)
        filas = cursor.fetchall()
        resultado = [{
            'codigo':        f[0], 'cliente':       f[1],
            'total':         float(f[2]) if f[2] else 0,
            'adelanto':      float(f[3]) if f[3] else 0,
            'saldo':         float(f[4]) if f[4] else 0,
            'estado':        f[5],
            'fecha_entrega': f[6].strftime('%Y-%m-%d') if f[6] else None,
            'vendedor':      f[7], 'productos':     f[8], 'sede': f[9]
        } for f in filas]
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


# ==========================================
# GESTIÓN MANUAL DE ESTADOS Y ANULACIÓN
# ==========================================

@ventas_bp.route('/api/ventas/<int:venta_id>/estado', methods=['PUT'])
def cambiar_estado_venta(venta_id):
    nuevo_estado = request.json.get('estado')
    if not nuevo_estado:
        return jsonify({'error': 'El estado es obligatorio'}), 400

    try:
        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()

        cursor.execute("UPDATE ventas SET estado_general = %s WHERE id = %s", (nuevo_estado, venta_id))

        # ── PUENTE INVENTARIO: Entregado → marcar unidades como Vendido ──────
        if nuevo_estado == 'Entregado':
            _liberar_unidades(cursor, venta_id, 'Vendido', 'Venta')
        # ─────────────────────────────────────────────────────────────────────

        conexion.commit()
        return jsonify({'exito': True, 'mensaje': f'Estado actualizado a {nuevo_estado}'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


@ventas_bp.route('/api/ventas/<int:venta_id>/anular', methods=['POST'])
def anular_venta_completa(venta_id):
    try:
        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()

        # 1. Marcar venta como Cancelado
        cursor.execute("UPDATE ventas SET estado_general = 'Cancelado' WHERE id = %s", (venta_id,))

        # 2. Cancelar Tickets de Producción
        cursor.execute("""
            UPDATE tickets_produccion
            SET estado_ticket = 'Cancelado'
            WHERE item_id IN (SELECT id FROM items_venta WHERE venta_id = %s)
              AND estado_ticket != 'Terminado'
        """, (venta_id,))

        # 3. Cancelar compras en Logística Externa
        cursor.execute("""
            UPDATE logistica_externa
            SET estado = 'Cancelado'
            WHERE venta_id = %s AND estado != 'Recibido'
        """, (venta_id,))

        # 4. Devolver stock genérico (contador en catalogo_productos)
        cursor.execute("""
            SELECT cp.id
            FROM catalogo_productos cp
            JOIN items_venta iv ON cp.nombre_modelo = iv.producto
            WHERE iv.venta_id = %s
        """, (venta_id,))
        for p in cursor.fetchall():
            cursor.execute("""
                UPDATE catalogo_productos
                SET stock_cantidad = stock_cantidad + 1, en_stock = true
                WHERE id = %s
            """, (p[0],))

        # 5. ── PUENTE INVENTARIO: liberar unidades físicas reservadas ─────────
        _liberar_unidades(cursor, venta_id, 'Disponible', 'Devolucion')
        # ─────────────────────────────────────────────────────────────────────

        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Venta y procesos de taller anulados con éxito.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


# ==========================================
# SEGUIMIENTO Y PRODUCCIÓN
# ==========================================

@ventas_bp.route('/api/mis-ventas/<int:vendedor_id>', methods=['GET'])
def obtener_mis_ventas(vendedor_id):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT v.codigo_venta, v.nombre_cliente, v.fecha_entrega,
                   COALESCE(COUNT(t.id), 0) AS total,
                   COALESCE(SUM(CASE WHEN t.estado_ticket = 'Terminado' THEN 1 ELSE 0 END), 0) AS terminados,
                   v.monto_total, COALESCE(v.estado_general, 'Pendiente') AS estado
            FROM ventas v
            LEFT JOIN items_venta i        ON v.id  = i.venta_id
            LEFT JOIN tickets_produccion t ON i.id  = t.item_id
            WHERE v.vendedor_id = %s
            GROUP BY v.id, v.codigo_venta, v.nombre_cliente, v.fecha_entrega, v.monto_total, v.estado_general
            ORDER BY v.id DESC;
        """, (vendedor_id,))
        res = []
        for v in cursor.fetchall():
            total      = v[3]
            terminados = v[4]
            porcentaje = round((terminados / total * 100), 0) if total > 0 else 0
            res.append({
                "codigo":      v[0], "cliente":    v[1],
                "entrega":     v[2].strftime('%d/%m/%Y') if v[2] else "S/F",
                "progreso":    porcentaje,
                "monto_total": float(v[5]),
                "estado":      v[6]
            })
        return jsonify(res)
    except Exception as ex:
        print("Error en seguimiento:", ex)
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/produccion/<area>', methods=['GET'])
def ver_tickets_area(area):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT t.id, i.producto, i.color_tela, v.codigo_venta,
                   t.estado_ticket, i.foto_url, v.fecha_entrega
            FROM tickets_produccion t
            JOIN items_venta i ON t.item_id  = i.id
            JOIN ventas v      ON i.venta_id = v.id
            WHERE t.area_trabajo = %s AND t.estado_ticket = 'Pendiente'
            ORDER BY v.fecha_entrega ASC;
        """, (area,))
        lista = [{
            "ticket_id":    t[0], "producto":     t[1], "color":        t[2],
            "codigo_venta": t[3], "estado":       t[4], "foto":         t[5],
            "fecha_entrega": t[6].strftime('%d/%m/%Y') if t[6] else "S/F"
        } for t in cursor.fetchall()]
        return jsonify({"area": area, "tareas": lista})
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/pedido/detalle/<codigo>', methods=['GET'])
def obtener_detalle_pedido(codigo):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT id, codigo_venta, nombre_cliente, fecha_entrega, empresa_ruc, vendedor_nombre
            FROM ventas WHERE codigo_venta = %s;
        """, (codigo,))
        venta = cursor.fetchone()
        if not venta:
            return jsonify({"error": "Pedido no encontrado"}), 404
        cursor.execute("SELECT producto, color_tela, foto_url FROM items_venta WHERE venta_id = %s;", (venta[0],))
        items = [{"producto": i[0], "detalles": i[1], "foto": i[2].split('|')[0] if i[2] else ""} for i in cursor.fetchall()]
        return jsonify({
            "codigo":  venta[1], "cliente": venta[2],
            "entrega": venta[3].strftime('%d/%m/%Y') if venta[3] else "S/F",
            "items":   items
        }), 200
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# CAMBIO DE PRECIO CON HISTORIAL
# ==========================================

@ventas_bp.route('/api/ventas/<codigo>/proponer-cambio-precio', methods=['POST'])
def proponer_cambio_precio(codigo):
    data = request.json
    precio_nuevo    = data.get('precio_nuevo')
    motivo          = data.get('motivo', '').strip()
    vendedor_id     = data.get('vendedor_id')
    vendedor_nombre = data.get('vendedor_nombre', '')

    if not precio_nuevo or not motivo:
        return jsonify({'error': 'precio_nuevo y motivo son obligatorios'}), 400
    if float(precio_nuevo) <= 0:
        return jsonify({'error': 'El precio nuevo debe ser mayor a 0'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _crear_tabla_historial_precios(cursor)

        cursor.execute("SELECT id, monto_total, estado_general FROM ventas WHERE codigo_venta = %s;", (codigo,))
        venta = cursor.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404
        venta_id, precio_original, estado = venta
        if estado in ('Entregado', 'Cancelado'):
            return jsonify({'error': f'No se puede modificar una venta en estado {estado}'}), 400

        cursor.execute(
            "SELECT id FROM historial_precios WHERE venta_id = %s AND estado = 'Pendiente';",
            (venta_id,)
        )
        if cursor.fetchone():
            return jsonify({'error': 'Ya existe una solicitud de cambio de precio pendiente para esta venta'}), 400

        cursor.execute("""
            INSERT INTO historial_precios
                (venta_id, codigo_venta, precio_original, precio_nuevo,
                 motivo, vendedor_id, vendedor_nombre, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Pendiente')
            RETURNING id;
        """, (venta_id, codigo, float(precio_original), float(precio_nuevo),
              motivo, vendedor_id, vendedor_nombre))
        nuevo_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': nuevo_id, 'mensaje': 'Solicitud enviada al administrador'}), 201

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/cambios-precio/pendientes', methods=['GET'])
def listar_cambios_precio_pendientes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _crear_tabla_historial_precios(cursor)
        cursor.execute("""
            SELECT hp.id, hp.codigo_venta, hp.precio_original, hp.precio_nuevo,
                   hp.motivo, hp.vendedor_nombre, hp.fecha_solicitud,
                   v.nombre_cliente, COALESCE(v.estado_general, 'En Producción') AS estado_venta
            FROM historial_precios hp
            JOIN ventas v ON hp.venta_id = v.id
            WHERE hp.estado = 'Pendiente'
            ORDER BY hp.fecha_solicitud DESC;
        """)
        resultado = [{
            'id': f[0], 'codigo_venta': f[1],
            'precio_original': float(f[2]), 'precio_nuevo': float(f[3]),
            'motivo': f[4], 'vendedor': f[5],
            'fecha_solicitud': f[6].strftime('%d/%m/%Y %H:%M') if f[6] else '',
            'cliente': f[7], 'estado_venta': f[8],
        } for f in cursor.fetchall()]
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/cambios-precio/<int:cambio_id>/aprobar', methods=['POST'])
def aprobar_cambio_precio(cambio_id):
    data         = request.json
    admin_id     = data.get('admin_id')
    admin_nombre = data.get('admin_nombre', 'Admin')
    try:
        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()
        cursor.execute(
            "SELECT venta_id, precio_nuevo FROM historial_precios WHERE id = %s AND estado = 'Pendiente';",
            (cambio_id,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Solicitud no encontrada o ya resuelta'}), 404
        venta_id, precio_nuevo = row
        cursor.execute("UPDATE ventas SET monto_total = %s WHERE id = %s;", (precio_nuevo, venta_id))
        cursor.execute("""
            UPDATE historial_precios
            SET estado = 'Aprobado', admin_id = %s, admin_nombre = %s, fecha_resolucion = NOW()
            WHERE id = %s;
        """, (admin_id, admin_nombre, cambio_id))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Precio actualizado con éxito'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/cambios-precio/<int:cambio_id>/rechazar', methods=['POST'])
def rechazar_cambio_precio(cambio_id):
    data         = request.json
    admin_id     = data.get('admin_id')
    admin_nombre = data.get('admin_nombre', 'Admin')
    notas        = data.get('notas_admin', '').strip()
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE historial_precios
            SET estado = 'Rechazado', admin_id = %s, admin_nombre = %s,
                notas_admin = %s, fecha_resolucion = NOW()
            WHERE id = %s AND estado = 'Pendiente';
        """, (admin_id, admin_nombre, notas, cambio_id))
        if cursor.rowcount == 0:
            return jsonify({'error': 'Solicitud no encontrada o ya resuelta'}), 404
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Solicitud rechazada'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@ventas_bp.route('/api/ventas/<codigo>/historial-precios', methods=['GET'])
def historial_precios_venta(codigo):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _crear_tabla_historial_precios(cursor)
        cursor.execute("""
            SELECT precio_original, precio_nuevo, motivo, vendedor_nombre,
                   admin_nombre, estado, notas_admin, fecha_solicitud, fecha_resolucion
            FROM historial_precios WHERE codigo_venta = %s ORDER BY fecha_solicitud DESC;
        """, (codigo,))
        resultado = [{
            'precio_original':  float(f[0]), 'precio_nuevo': float(f[1]),
            'motivo': f[2], 'vendedor': f[3], 'admin': f[4], 'estado': f[5],
            'notas_admin': f[6],
            'fecha_solicitud':  f[7].strftime('%d/%m/%Y %H:%M') if f[7] else '',
            'fecha_resolucion': f[8].strftime('%d/%m/%Y %H:%M') if f[8] else '',
        } for f in cursor.fetchall()]
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# EXPORTACIÓN DE VENTAS
# ==========================================

@ventas_bp.route('/api/ventas/exportar', methods=['GET'])
def exportar_ventas_excel():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT v.codigo_venta, v.nombre_cliente, v.tipo_comprobante, v.dni_cliente,
                   v.fecha_emision, v.fecha_entrega, v.monto_total,
                   COALESCE(itm.productos, '') AS productos, v.direccion_cliente,
                   COALESCE(pg.metodos, 'Sin pago') AS metodo_pago,
                   COALESCE(pg.total_pagado, 0) AS monto_adelanto,
                   COALESCE(pg.empresas, '---') AS empresa_pago,
                   v.fecha_emision AS fecha_registro, v.celular_cliente,
                   v.moneda, v.vendedor_nombre
            FROM ventas v
            LEFT JOIN (
                SELECT venta_id, SUM(monto_bruto) AS total_pagado,
                       STRING_AGG(tipo_pago || ' (' || COALESCE(entidad, '') || ')', ' | ') AS metodos,
                       STRING_AGG(DISTINCT empresa_destino, ' / ') AS empresas
                FROM pagos GROUP BY venta_id
            ) pg ON pg.venta_id = v.id
            LEFT JOIN (
                SELECT venta_id, STRING_AGG(producto, ' / ') AS productos
                FROM items_venta GROUP BY venta_id
            ) itm ON itm.venta_id = v.id
            ORDER BY v.id DESC;
        """)
        filas = cursor.fetchall()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Ventas"
        header_font = Font(bold=True, color="FFFFFF", size=10)
        header_fill = PatternFill("solid", fgColor="0F172A")
        center      = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin        = Side(style="thin", color="CBD5E0")
        border      = Border(left=thin, right=thin, top=thin, bottom=thin)
        headers = [
            "Cód. Venta", "Cliente", "Comprobante", "RUC/DNI/CE",
            "F. Emisión", "F. Entrega", "Monto Total",
            "Producto(s)", "Dirección", "Métodos Pago (Múltiples)",
            "Adelanto Cobrado", "Empresa Receptora",
            "Fecha Registro", "Teléfono", "Moneda", "Vendedor"
        ]
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.font = header_font; cell.fill = header_fill
            cell.alignment = center; cell.border = border
        anchos = [12, 25, 12, 14, 14, 14, 12, 40, 30, 30, 15, 30, 14, 14, 10, 20]
        for col, ancho in enumerate(anchos, 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = ancho
        fill_par   = PatternFill("solid", fgColor="F8FAFC")
        fill_impar = PatternFill("solid", fgColor="FFFFFF")
        for row_num, f in enumerate(filas, 2):
            fill = fill_par if row_num % 2 == 0 else fill_impar
            valores = [
                f[0], f[1], f[2], f[3],
                f[4].strftime('%d/%m/%Y') if f[4] else '',
                f[5].strftime('%d/%m/%Y') if f[5] else '',
                float(f[6]) if f[6] else 0,
                f[7], f[8], f[9],
                float(f[10]) if f[10] else 0,
                f[11],
                f[12].strftime('%d/%m/%Y') if f[12] else '',
                f[13], f[14], f[15]
            ]
            for col, val in enumerate(valores, 1):
                cell = ws.cell(row=row_num, column=col, value=val)
                cell.fill = fill; cell.border = border
                cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.freeze_panes = "A2"
        buffer = io.BytesIO()
        wb.save(buffer); buffer.seek(0)
        fecha_hoy = datetime.now().strftime('%Y%m%d_%H%M')
        return send_file(
            buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'ventas_innova_{fecha_hoy}.xlsx'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


# A4: La ruta /api/exportar_ventas (CSV stub) fue eliminada.
# El único endpoint de exportación es /api/ventas/exportar (Excel completo).
# El frontend ya apunta correctamente a /api/ventas/exportar.