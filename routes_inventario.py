"""
routes_inventario.py — Módulo Inventario Completo
Innova Mobili ERP

Rutas:
  GET  /api/inventario/resumen              → tabla pivot productos por sede
  GET  /api/inventario/piezas/resumen       → tabla pivot piezas por sede
  GET  /api/inventario/buscar/<codigo>      → buscar unidad por código de barras
  GET  /api/inventario/historial/sede/<id>  → últimos 50 movimientos de una sede
  GET  /api/inventario/historial/<tipo>/<id>→ historial de una unidad específica
  POST /api/inventario/producto/nuevo       → registrar producto entero + generar código
  POST /api/inventario/pieza/nueva          → registrar pieza(s) + generar código(s)
  PUT  /api/inventario/producto/<id>/estado → cambiar estado de un producto
  PUT  /api/inventario/pieza/<id>/estado    → cambiar estado de una pieza
  GET  /api/inventario/exportar             → CSV completo del inventario
"""

import os, csv, random, string
from io import StringIO
from datetime import datetime

import psycopg2
from psycopg2 import pool as pg_pool
import pytz
from flask import Blueprint, request, jsonify, Response

inventario_bp = Blueprint('inventario', __name__)

_pool = None
_tz   = pytz.timezone('America/Lima')


def init_inventario_pool():
    """Llamar desde app.py DESPUÉS de load_dotenv()."""
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=1, maxconn=6,
            host     = os.getenv("DB_HOST"),
            database = os.getenv("DB_NAME"),
            user     = os.getenv("DB_USER"),
            password = os.getenv("DB_PASSWORD"),
        )


def _conn():
    return _pool.getconn()


def _release(c):
    if c: _pool.putconn(c)


# ──────────────────────────────────────────────────────────────
# UTILIDAD: generar código de barras único
# Formato: IM-CAT3-XXXX  (IM = Innova Mobili, CAT3 = 3 letras categoría, XXXX = 4 aleatorio)
# ──────────────────────────────────────────────────────────────
def _generar_codigo(categoria, tabla, cursor):
    prefijo = 'IM-' + ''.join(c for c in categoria.upper() if c.isalpha())[:4]
    for _ in range(50):
        sufijo  = ''.join(random.choices(string.digits + string.ascii_uppercase, k=5))
        codigo  = f"{prefijo}-{sufijo}"
        cursor.execute(f"SELECT 1 FROM {tabla} WHERE codigo_barra = %s", (codigo,))
        if not cursor.fetchone():
            return codigo
    raise RuntimeError("No se pudo generar un código único. Inténtalo de nuevo.")


def _registrar_movimiento(cur, tipo_item, item_id, codigo_barra, evento,
                           estado_ant, estado_nuevo,
                           sede_origen_id, sede_destino_id,
                           usuario_id, usuario_nombre, usuario_rol, notas):
    cur.execute("""
        INSERT INTO stock_movimientos
            (tipo_item, item_id, codigo_barra, evento,
             estado_anterior, estado_nuevo,
             sede_origen_id, sede_destino_id,
             usuario_id, usuario_nombre, usuario_rol, notas)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (tipo_item, item_id, codigo_barra, evento,
          estado_ant, estado_nuevo,
          sede_origen_id, sede_destino_id,
          usuario_id, usuario_nombre, usuario_rol, notas))


# ══════════════════════════════════════════════════════════════
# 1. RESUMEN PRODUCTOS (pivot sede)
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/resumen', methods=['GET'])
def resumen_productos():
    categoria = request.args.get('categoria', '')
    q         = request.args.get('q', '').strip()
    sede_id   = request.args.get('sede_id', '')

    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()

        # Sedes disponibles
        cur.execute("SELECT id, nombre FROM sedes ORDER BY id")
        sedes = cur.fetchall()
        nombres_sedes = [s[1] for s in sedes]

        where = ["1=1"]
        params = []
        if categoria:
            where.append("u.categoria = %s"); params.append(categoria)
        if q:
            where.append("u.nombre_modelo ILIKE %s"); params.append(f'%{q}%')
        if sede_id:
            where.append("u.sede_id = %s"); params.append(int(sede_id))

        cur.execute(f"""
            SELECT
                u.nombre_modelo,
                u.categoria,
                u.catalogo_id,
                u.sede_id,
                s.nombre                                           AS sede_nombre,
                COUNT(*) FILTER (WHERE u.estado = 'Disponible')   AS disponibles,
                COUNT(*)                                           AS total
            FROM stock_unidades u
            JOIN sedes s ON u.sede_id = s.id
            WHERE {' AND '.join(where)}
            GROUP BY u.nombre_modelo, u.categoria, u.catalogo_id, u.sede_id, s.nombre
            ORDER BY u.categoria, u.nombre_modelo
        """, params)
        rows = cur.fetchall()

        # Agrupar por modelo
        modelos_dict = {}
        for r in rows:
            nombre, cat, cat_id, sid, snombre, disp, tot = r
            key = (nombre, cat)
            if key not in modelos_dict:
                modelos_dict[key] = {
                    'nombre_modelo': nombre,
                    'categoria':     cat,
                    'catalogo_id':   cat_id,
                    'disponibles':   0,
                    'total':         0,
                    'sede_stock':    {}
                }
            modelos_dict[key]['disponibles'] += disp
            modelos_dict[key]['total']       += tot
            modelos_dict[key]['sede_stock'][snombre] = {'disponibles': disp, 'total': tot}

        return jsonify({
            'sedes':   nombres_sedes,
            'modelos': list(modelos_dict.values())
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 2. RESUMEN PIEZAS (pivot sede)
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/piezas/resumen', methods=['GET'])
def resumen_piezas():
    categoria = request.args.get('categoria', '')
    q         = request.args.get('q', '').strip()

    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()

        cur.execute("SELECT id, nombre FROM sedes ORDER BY id")
        sedes = cur.fetchall()
        nombres_sedes = [s[1] for s in sedes]

        where = ["1=1"]
        params = []
        if categoria:
            where.append("p.categoria = %s"); params.append(categoria)
        if q:
            where.append("p.nombre_modelo ILIKE %s"); params.append(f'%{q}%')

        cur.execute(f"""
            SELECT
                p.sku_maestro, p.nombre_modelo, p.categoria,
                p.material, p.color_acabado, p.forma,
                p.largo_cm, p.ancho_cm, p.alto_cm,
                p.sede_id, s.nombre AS sede_nombre,
                COUNT(*) FILTER (WHERE p.estado = 'Disponible') AS disponibles,
                COUNT(*) AS total
            FROM stock_piezas p
            JOIN sedes s ON p.sede_id = s.id
            WHERE {' AND '.join(where)}
            GROUP BY p.sku_maestro, p.nombre_modelo, p.categoria,
                     p.material, p.color_acabado, p.forma,
                     p.largo_cm, p.ancho_cm, p.alto_cm,
                     p.sede_id, s.nombre
            ORDER BY p.categoria, p.nombre_modelo, p.largo_cm
        """, params)
        rows = cur.fetchall()

        piezas_dict = {}
        for r in rows:
            (sku, nombre, cat, mat, color, forma,
             largo, ancho, alto, sid, snombre, disp, tot) = r

            key = (sku, forma, largo, ancho, alto)
            if key not in piezas_dict:
                piezas_dict[key] = {
                    'sku_maestro':  sku,
                    'nombre_modelo': nombre,
                    'categoria':    cat,
                    'material':     mat,
                    'color_acabado': color,
                    'forma':        forma,
                    'largo_cm':     float(largo) if largo else None,
                    'ancho_cm':     float(ancho) if ancho else None,
                    'alto_cm':      float(alto)  if alto  else None,
                    'disponibles':  0,
                    'total':        0,
                    'sede_stock':   {}
                }
            piezas_dict[key]['disponibles'] += disp
            piezas_dict[key]['total']       += tot
            piezas_dict[key]['sede_stock'][snombre] = disp

        return jsonify({
            'sedes':  nombres_sedes,
            'piezas': list(piezas_dict.values())
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 3. BUSCAR POR CÓDIGO DE BARRAS
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/buscar/<barcode>', methods=['GET'])
def buscar_barcode(barcode):
    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()

        # Buscar primero en productos
        cur.execute("""
            SELECT u.id, u.codigo_barra, u.nombre_modelo, u.categoria,
                   u.color_tela, u.acabado, u.estado, u.costo_ingreso,
                   u.fecha_ingreso, u.catalogo_id, s.nombre AS sede
            FROM stock_unidades u
            JOIN sedes s ON u.sede_id = s.id
            WHERE u.codigo_barra = %s
        """, (barcode,))
        r = cur.fetchone()
        if r:
            return jsonify({
                'tipo': 'producto', 'id': r[0], 'codigo_barra': r[1],
                'nombre_modelo': r[2], 'categoria': r[3],
                'color_tela': r[4], 'acabado': r[5], 'estado': r[6],
                'costo_ingreso': float(r[7]) if r[7] else None,
                'fecha_ingreso': r[8].strftime('%d/%m/%Y') if r[8] else None,
                'catalogo_id': r[9], 'sede': r[10]
            }), 200

        # Buscar en piezas
        cur.execute("""
            SELECT p.id, p.codigo_barra, p.nombre_modelo, p.categoria,
                   p.material, p.color_acabado, p.forma,
                   p.largo_cm, p.ancho_cm, p.alto_cm,
                   p.estado, p.costo_ingreso, p.fecha_ingreso, s.nombre AS sede
            FROM stock_piezas p
            JOIN sedes s ON p.sede_id = s.id
            WHERE p.codigo_barra = %s
        """, (barcode,))
        r = cur.fetchone()
        if r:
            return jsonify({
                'tipo': 'pieza', 'id': r[0], 'codigo_barra': r[1],
                'nombre_modelo': r[2], 'categoria': r[3],
                'material': r[4], 'color_acabado': r[5], 'forma': r[6],
                'largo_cm': float(r[7]) if r[7] else None,
                'ancho_cm': float(r[8]) if r[8] else None,
                'alto_cm':  float(r[9]) if r[9] else None,
                'estado': r[10],
                'costo_ingreso': float(r[11]) if r[11] else None,
                'fecha_ingreso': r[12].strftime('%d/%m/%Y') if r[12] else None,
                'sede': r[13]
            }), 200

        return jsonify({'error': f'Código "{barcode}" no encontrado en inventario'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 4. HISTORIAL POR SEDE (últimos 50)
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/historial/sede/<int:sede_id>', methods=['GET'])
def historial_sede(sede_id):
    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT
                m.fecha, m.evento, m.codigo_barra,
                so.nombre AS sede_origen,
                sd.nombre AS sede_destino,
                m.usuario_nombre, m.notas
            FROM stock_movimientos m
            LEFT JOIN sedes so ON m.sede_origen_id  = so.id
            LEFT JOIN sedes sd ON m.sede_destino_id = sd.id
            WHERE m.sede_origen_id = %s OR m.sede_destino_id = %s
            ORDER BY m.fecha DESC
            LIMIT 50
        """, (sede_id, sede_id))
        rows = cur.fetchall()
        resultado = [{
            'fecha':         r[0].strftime('%d/%m/%Y %H:%M') if r[0] else '',
            'evento':        r[1],
            'codigo_barra':  r[2],
            'sede_origen':   r[3],
            'sede_destino':  r[4],
            'usuario':       r[5],
            'notas':         r[6],
        } for r in rows]
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 5. HISTORIAL DE UNA UNIDAD ESPECÍFICA
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/historial/<tipo>/<int:item_id>', methods=['GET'])
def historial_unidad(tipo, item_id):
    if tipo not in ('producto', 'pieza'):
        return jsonify({'error': 'tipo inválido'}), 400
    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT m.fecha, m.evento,
                   so.nombre AS sede_origen,
                   sd.nombre AS sede_destino,
                   m.usuario_nombre, m.notas,
                   m.estado_anterior, m.estado_nuevo
            FROM stock_movimientos m
            LEFT JOIN sedes so ON m.sede_origen_id  = so.id
            LEFT JOIN sedes sd ON m.sede_destino_id = sd.id
            WHERE m.tipo_item = %s AND m.item_id = %s
            ORDER BY m.fecha DESC
        """, (tipo, item_id))
        rows = cur.fetchall()
        resultado = [{
            'fecha':          r[0].strftime('%d/%m/%Y %H:%M') if r[0] else '',
            'evento':         r[1],
            'sede_origen':    r[2],
            'sede_destino':   r[3],
            'usuario':        r[4],
            'notas':          r[5],
            'estado_anterior': r[6],
            'estado_nuevo':   r[7],
        } for r in rows]
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 6. REGISTRAR PRODUCTO ENTERO
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/producto/nuevo', methods=['POST'])
def nuevo_producto():
    d = request.json or {}
    nombre    = (d.get('nombre_modelo') or '').strip()
    categoria = (d.get('categoria')     or '').strip()
    sede_id   = d.get('sede_id')

    if not nombre or not categoria or not sede_id:
        return jsonify({'error': 'nombre_modelo, categoria y sede_id son obligatorios'}), 400

    conn = None
    try:
        conn = _conn()
        conn.autocommit = False
        cur = conn.cursor()

        codigo = _generar_codigo(categoria, 'stock_unidades', cur)

        cur.execute("""
            INSERT INTO stock_unidades
                (codigo_barra, catalogo_id, nombre_modelo, categoria,
                 color_tela, acabado, observaciones,
                 sede_id, estado, costo_ingreso, usuario_ingreso_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Disponible',%s,%s)
            RETURNING id
        """, (
            codigo,
            d.get('catalogo_id'),
            nombre, categoria,
            d.get('color_tela'), d.get('acabado'), d.get('observaciones'),
            int(sede_id),
            d.get('costo_ingreso'),
            d.get('usuario_id'),
        ))
        nuevo_id = cur.fetchone()[0]

        _registrar_movimiento(
            cur, 'producto', nuevo_id, codigo, 'Ingreso',
            None, 'Disponible',
            int(sede_id), int(sede_id),
            d.get('usuario_id'), d.get('usuario_nombre'),
            d.get('usuario_rol'), 'Ingreso inicial al inventario'
        )

        conn.commit()
        return jsonify({'exito': True, 'id': nuevo_id, 'codigo_barra': codigo}), 201

    except Exception as e:
        if conn:
            try: conn.rollback()
            except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.autocommit = True
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 7. REGISTRAR PIEZA(S) A MEDIDA
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/pieza/nueva', methods=['POST'])
def nueva_pieza():
    d = request.json or {}
    sku     = (d.get('sku_maestro')  or '').strip()
    nombre  = (d.get('nombre_modelo') or '').strip()
    cat     = (d.get('categoria')    or '').strip()
    sede_id = d.get('sede_id')
    cant    = int(d.get('cantidad') or 1)

    if not sku or not nombre or not sede_id:
        return jsonify({'error': 'sku_maestro, nombre_modelo y sede_id son obligatorios'}), 400

    conn = None
    try:
        conn = _conn()
        conn.autocommit = False
        cur = conn.cursor()

        unidades = []
        for _ in range(cant):
            codigo = _generar_codigo(cat or 'PIEZA', 'stock_piezas', cur)
            cur.execute("""
                INSERT INTO stock_piezas
                    (codigo_barra, sku_maestro, nombre_modelo, categoria,
                     material, color_acabado, forma,
                     largo_cm, ancho_cm, alto_cm,
                     sede_id, estado, costo_ingreso, proveedor, usuario_ingreso_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Disponible',%s,%s,%s)
                RETURNING id
            """, (
                codigo, sku, nombre, cat,
                d.get('material'), d.get('color_acabado'),
                d.get('forma', 'Rectangular'),
                d.get('largo_cm'), d.get('ancho_cm'), d.get('alto_cm'),
                int(sede_id),
                d.get('costo_ingreso'), d.get('proveedor'),
                d.get('usuario_id'),
            ))
            nuevo_id = cur.fetchone()[0]

            _registrar_movimiento(
                cur, 'pieza', nuevo_id, codigo, 'Ingreso',
                None, 'Disponible',
                int(sede_id), int(sede_id),
                d.get('usuario_id'), d.get('usuario_nombre'),
                d.get('usuario_rol'), 'Ingreso inicial al inventario'
            )
            unidades.append({'id': nuevo_id, 'codigo_barra': codigo})

        conn.commit()
        return jsonify({'exito': True, 'unidades': unidades}), 201

    except Exception as e:
        if conn:
            try: conn.rollback()
            except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.autocommit = True
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 8. CAMBIAR ESTADO — PRODUCTO
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/producto/<int:item_id>/estado', methods=['PUT'])
def cambiar_estado_producto(item_id):
    d = request.json or {}
    estado_nuevo    = d.get('estado_nuevo')
    sede_destino_id = d.get('sede_destino_id')
    tipo_evento     = d.get('tipo_evento', 'Ajuste')

    if not estado_nuevo:
        return jsonify({'error': 'estado_nuevo es obligatorio'}), 400

    conn = None
    try:
        conn = _conn()
        conn.autocommit = False
        cur = conn.cursor()

        cur.execute("""
            SELECT codigo_barra, estado, sede_id FROM stock_unidades WHERE id = %s
        """, (item_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Producto no encontrado'}), 404
        codigo, estado_ant, sede_id = row

        # Si es traslado, actualizar sede también
        if tipo_evento == 'Traslado' and sede_destino_id:
            cur.execute("""
                UPDATE stock_unidades SET estado = %s, sede_id = %s WHERE id = %s
            """, (estado_nuevo, int(sede_destino_id), item_id))
        else:
            cur.execute("""
                UPDATE stock_unidades SET estado = %s WHERE id = %s
            """, (estado_nuevo, item_id))

        _registrar_movimiento(
            cur, 'producto', item_id, codigo, tipo_evento,
            estado_ant, estado_nuevo,
            sede_id, int(sede_destino_id) if sede_destino_id else sede_id,
            d.get('usuario_id'), d.get('usuario_nombre'),
            d.get('usuario_rol'), d.get('notas')
        )

        conn.commit()
        return jsonify({'exito': True}), 200

    except Exception as e:
        if conn:
            try: conn.rollback()
            except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.autocommit = True
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 9. CAMBIAR ESTADO — PIEZA
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/pieza/<int:item_id>/estado', methods=['PUT'])
def cambiar_estado_pieza(item_id):
    d = request.json or {}
    estado_nuevo    = d.get('estado_nuevo')
    sede_destino_id = d.get('sede_destino_id')
    tipo_evento     = d.get('tipo_evento', 'Ajuste')

    if not estado_nuevo:
        return jsonify({'error': 'estado_nuevo es obligatorio'}), 400

    conn = None
    try:
        conn = _conn()
        conn.autocommit = False
        cur = conn.cursor()

        cur.execute("""
            SELECT codigo_barra, estado, sede_id FROM stock_piezas WHERE id = %s
        """, (item_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Pieza no encontrada'}), 404
        codigo, estado_ant, sede_id = row

        if tipo_evento == 'Traslado' and sede_destino_id:
            cur.execute("""
                UPDATE stock_piezas SET estado = %s, sede_id = %s WHERE id = %s
            """, (estado_nuevo, int(sede_destino_id), item_id))
        else:
            cur.execute("""
                UPDATE stock_piezas SET estado = %s WHERE id = %s
            """, (estado_nuevo, item_id))

        _registrar_movimiento(
            cur, 'pieza', item_id, codigo, tipo_evento,
            estado_ant, estado_nuevo,
            sede_id, int(sede_destino_id) if sede_destino_id else sede_id,
            d.get('usuario_id'), d.get('usuario_nombre'),
            d.get('usuario_rol'), d.get('notas')
        )

        conn.commit()
        return jsonify({'exito': True}), 200

    except Exception as e:
        if conn:
            try: conn.rollback()
            except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.autocommit = True
        _release(conn)


# ══════════════════════════════════════════════════════════════
# 10. EXPORTAR CSV
# ══════════════════════════════════════════════════════════════
@inventario_bp.route('/api/inventario/exportar', methods=['GET'])
def exportar_csv():
    conn = None
    try:
        conn = _conn()
        cur  = conn.cursor()

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Tipo','Código','Modelo','Categoría','Material/Color',
                         'Medida','Sede','Estado','Costo','Fecha Ingreso'])

        # Productos
        cur.execute("""
            SELECT 'Producto', u.codigo_barra, u.nombre_modelo, u.categoria,
                   COALESCE(u.color_tela,'') || ' ' || COALESCE(u.acabado,''),
                   '—', s.nombre, u.estado,
                   COALESCE(u.costo_ingreso::text,'—'),
                   TO_CHAR(u.fecha_ingreso,'DD/MM/YYYY')
            FROM stock_unidades u JOIN sedes s ON u.sede_id = s.id
            ORDER BY u.categoria, u.nombre_modelo
        """)
        writer.writerows(cur.fetchall())

        # Piezas
        cur.execute("""
            SELECT 'Pieza', p.codigo_barra, p.nombre_modelo, p.categoria,
                   COALESCE(p.material,'') || ' ' || COALESCE(p.color_acabado,''),
                   COALESCE(p.largo_cm::text,'') || 'x' || COALESCE(p.ancho_cm::text,'') || ' cm',
                   s.nombre, p.estado,
                   COALESCE(p.costo_ingreso::text,'—'),
                   TO_CHAR(p.fecha_ingreso,'DD/MM/YYYY')
            FROM stock_piezas p JOIN sedes s ON p.sede_id = s.id
            ORDER BY p.categoria, p.nombre_modelo
        """)
        writer.writerows(cur.fetchall())

        output.seek(0)
        fecha = datetime.now(_tz).strftime('%Y%m%d_%H%M')
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment;filename=inventario_{fecha}.csv'}
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _release(conn)