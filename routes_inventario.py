"""
routes_inventario.py — Sistema de Inventario Completo
Innova Mobili ERP

Rutas:
  GET  /api/inventario/resumen           → stock agrupado por categoría/modelo/sede
  GET  /api/inventario/piezas/resumen    → piezas agrupadas por sku/medida/sede
  GET  /api/inventario/buscar/<barcode>  → buscar unidad por código de barras
  POST /api/inventario/producto/nuevo    → registrar producto entero
  POST /api/inventario/pieza/nueva       → registrar pieza a medida
  PUT  /api/inventario/<tipo>/<id>/estado → cambiar estado (traslado, venta, baja, etc.)
  GET  /api/inventario/historial/<tipo>/<id> → historial de una unidad
  GET  /api/inventario/historial/sede/<sede_id> → movimientos de una sede
  GET  /api/inventario/exportar          → CSV completo
"""

import os
import csv
import io
from datetime import datetime
import pytz
from flask import Blueprint, request, jsonify, Response
from database import get_db_connection, release_db_connection
from auth_middleware import requiere_login, requiere_rol

inventario_bp = Blueprint('inventario', __name__)
tz_peru = pytz.timezone('America/Lima')
_schema_fotos_adicionales_listo = False

# Roles autorizados para modificar stock
ROLES_INVENTARIO = ('Admin', 'Jefe_Taller')

# Prefijos por categoría para el código de barras
PREFIJOS = {
    'Sofa':           'SOF',
    'Butaca':         'BUT',
    'Silla':          'SIL',
    'Espejo':         'ESP',
    'Cuadro':         'CUA',
    'Cojin':          'COJ',
    'Mesa Centro':    'MEC',
    'Consola':        'CON',
    'tablero':        'TAB',
    'base-comedor':   'BAC',
    'base-consola':   'BCS',
    'base-mesa-centro': 'BMC',
    'silla':            'SIL',   # ← AGREGAR
    'butaca':           'BUT',   # ← AGREGAR
}


def _conn():
    return get_db_connection()


def _rel(c):
    release_db_connection(c)


def _verificar_rol(rol):
    return rol in ROLES_INVENTARIO


def _asegurar_columna_fotos_adicionales():
    """Añade fotos_adicionales a stock_productos y stock_piezas si no existen."""
    global _schema_fotos_adicionales_listo
    if _schema_fotos_adicionales_listo:
        return
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("ALTER TABLE stock_productos ADD COLUMN IF NOT EXISTS fotos_adicionales TEXT;")
        cur.execute("ALTER TABLE stock_piezas ADD COLUMN IF NOT EXISTS fotos_adicionales TEXT;")
        _schema_fotos_adicionales_listo = True
    except Exception as e:
        print(f"⚠️  _asegurar_columna_fotos_adicionales: {e}")
        _schema_fotos_adicionales_listo = True # Don't retry
    finally:
        if cur: cur.close()
        if conn:
            conn.autocommit = False
            release_db_connection(conn)


def _generar_codigo(cur, prefijo, tabla_col):
    """Genera el siguiente código de barras único: IM-{PREFIX}-{N:05d}"""
    cur.execute(f"SELECT COUNT(*) FROM {tabla_col};")
    n = cur.fetchone()[0] + 1
    codigo = f"IM-{prefijo}-{str(n).zfill(5)}"
    # Verificar unicidad (si ya existe, incrementar)
    cur.execute(f"SELECT 1 FROM {tabla_col} WHERE codigo_barra = %s", (codigo,))
    while cur.fetchone():
        n += 1
        codigo = f"IM-{prefijo}-{str(n).zfill(5)}"
        cur.execute(f"SELECT 1 FROM {tabla_col} WHERE codigo_barra = %s", (codigo,))
    return codigo


def _registrar_historial(cur, tipo, reg_id, barcode, evento,
                          sede_orig, sede_dest, est_ant, est_nuevo,
                          usuario_id, usuario_nombre, venta_id=None,
                          codigo_venta=None, notas=None):
    cur.execute("""
        INSERT INTO historial_inventario
            (tipo_registro, registro_id, codigo_barra, tipo_evento,
             sede_origen_id, sede_destino_id, estado_anterior, estado_nuevo,
             usuario_id, usuario_nombre, venta_id, codigo_venta, notas)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);
    """, (tipo, reg_id, barcode, evento,
          sede_orig, sede_dest, est_ant, est_nuevo,
          usuario_id, usuario_nombre, venta_id, codigo_venta, notas))


# Mapa: categoría de pieza → (tabla_maestro, columna_nombre_modelo)
_MAESTRO_FOTO_MAP = {
    'tablero':          ('maestro_tableros',     'nombre_modelo'),
    'silla':            ('maestro_sillas',        'modelo'),
    'butaca':           ('maestro_butacas',       'modelo'),
    'base-comedor':     ('maestro_bases_comedor', 'modelo'),
    'base-consola':     ('maestro_bases_comedor', 'modelo'),
    'base-mesa-centro': ('maestro_bases_comedor', 'modelo'),
}


def _obtener_foto_maestro(cur, categoria, nombre_modelo):
    """
    Busca la foto_url del maestro correspondiente a una categoría y nombre de modelo.
    Devuelve la URL limpia (str) o '' si no encuentra nada.
    """
    if not categoria or not nombre_modelo:
        return ''
    entry = _MAESTRO_FOTO_MAP.get(categoria.lower())
    if not entry:
        return ''
    tabla, col = entry
    try:
        cur.execute(
            f"SELECT foto_url FROM {tabla} WHERE LOWER({col}) = LOWER(%s) LIMIT 1",
            (nombre_modelo,)
        )
        row = cur.fetchone()
        if row and row[0]:
            # Normalizar: tomar primera URL si hay varias separadas por |
            return row[0].split('|')[0].strip()
    except Exception:
        pass
    return ''


# ─────────────────────────────────────────────────────────────────────────────
# 1. RESUMEN DE PRODUCTOS ENTEROS (pivot por sede)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/resumen', methods=['GET'])
@requiere_login
def resumen_productos():
    categoria = request.args.get('categoria', '')
    q         = request.args.get('q', '').strip().lower()
    sede_id   = request.args.get('sede_id', '')

    where, params = [], []
    if categoria:
        where.append("sp.categoria = %s"); params.append(categoria)
    if q:
        where.append("LOWER(sp.nombre_modelo) LIKE %s"); params.append(f"%{q}%")
    if sede_id:
        where.append("sp.sede_id = %s"); params.append(sede_id)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        cur.execute("SELECT id, nombre FROM sedes ORDER BY id;")
        sedes = cur.fetchall()

        cur.execute(f"""
            SELECT
                sp.categoria,
                sp.nombre_modelo,
                sp.catalogo_id,
                sp.sede_id,
                se.nombre AS sede_nombre,
                COUNT(*)                                                    AS total,
                COUNT(*) FILTER (WHERE sp.estado = 'Disponible')           AS disponibles,
                COUNT(*) FILTER (WHERE sp.estado = 'Reservado')            AS reservados,
                COUNT(*) FILTER (WHERE sp.estado = 'Vendido')              AS vendidos,
                MAX(sp.foto_url)                                            AS foto_url
            FROM stock_productos sp
            JOIN sedes se ON sp.sede_id = se.id
            {where_sql}
            GROUP BY sp.categoria, sp.nombre_modelo, sp.catalogo_id, sp.sede_id, se.nombre
            ORDER BY sp.categoria, sp.nombre_modelo, se.nombre;
        """, params)
        rows = cur.fetchall()

        # Agrupar por modelo
        modelos = {}
        for r in rows:
            key = (r[0], r[1])  # (categoria, nombre_modelo)
            if key not in modelos:
                modelos[key] = {
                    "categoria":     r[0],
                    "nombre_modelo": r[1],
                    "catalogo_id":   r[2],
                    "foto_url":      r[9] or "",
                    "total":         0,
                    "disponibles":   0,
                    "sede_stock":    {s[1]: {"total":0,"disponibles":0} for s in sedes},
                }
            modelos[key]["total"]       += r[5]
            modelos[key]["disponibles"] += r[6]
            modelos[key]["sede_stock"][r[4]] = {
                "total":      r[5],
                "disponibles": r[6],
                "reservados":  r[7],
                "vendidos":    r[8],
            }

        return jsonify({
            "sedes":   [s[1] for s in sedes],
            "modelos": list(modelos.values())
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 2. RESUMEN DE PIEZAS A MEDIDA (pivot por sede)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/piezas/resumen', methods=['GET'])
@requiere_login
def resumen_piezas():
    categoria = request.args.get('categoria', '')
    q         = request.args.get('q', '').strip().lower()

    where, params = [], []
    if categoria:
        where.append("sp.categoria = %s"); params.append(categoria)
    if q:
        where.append("(LOWER(sp.nombre_modelo) LIKE %s OR LOWER(sp.material) LIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        cur.execute("SELECT id, nombre FROM sedes ORDER BY id;")
        sedes = cur.fetchall()

        cur.execute(f"""
            SELECT
                sp.categoria, sp.sku_maestro, sp.nombre_modelo,
                sp.material, sp.color_acabado, sp.forma,
                sp.largo_cm, sp.ancho_cm, sp.alto_cm,
                sp.sede_id, se.nombre AS sede_nombre,
                COUNT(*) FILTER (WHERE sp.estado = 'Disponible') AS disponibles,
                COUNT(*) AS total
            FROM stock_piezas sp
            JOIN sedes se ON sp.sede_id = se.id
            {where_sql}
            GROUP BY sp.categoria, sp.sku_maestro, sp.nombre_modelo,
                     sp.material, sp.color_acabado, sp.forma,
                     sp.largo_cm, sp.ancho_cm, sp.alto_cm,
                     sp.sede_id, se.nombre
            ORDER BY sp.categoria, sp.sku_maestro, sp.forma, se.nombre;
        """, params)
        rows = cur.fetchall()

        grupos = {}
        for r in rows:
            key = (r[1], r[5], r[6], r[7], r[8])  # sku+forma+medidas
            if key not in grupos:
                grupos[key] = {
                    "categoria":     r[0],
                    "sku_maestro":   r[1],
                    "nombre_modelo": r[2],
                    "material":      r[3],
                    "color_acabado": r[4],
                    "forma":         r[5],
                    "largo_cm":      float(r[6]) if r[6] else None,
                    "ancho_cm":      float(r[7]) if r[7] else None,
                    "alto_cm":       float(r[8]) if r[8] else None,
                    "total":         0,
                    "disponibles":   0,
                    "sede_stock":    {s[1]: 0 for s in sedes},
                }
            grupos[key]["disponibles"] += r[11]
            grupos[key]["total"]       += r[12]
            grupos[key]["sede_stock"][r[10]] = r[11]  # disponibles por sede

        return jsonify({
            "sedes":  [s[1] for s in sedes],
            "piezas": list(grupos.values())
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 11. UNIDADES DE PIEZAS DISPONIBLES POR SKU (para el picker del carrito)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/piezas/disponibles/<sku_maestro>', methods=['GET'])
@requiere_login
def unidades_piezas_disponibles_por_sku(sku_maestro):
    sede_id = request.args.get('sede_id', '')
    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        where_extra = ""
        params = [sku_maestro]
        if sede_id:
            where_extra = " AND sp.sede_id = %s"
            params.append(sede_id)

        cur.execute(f"""
            SELECT sp.id, sp.codigo_barra, se.nombre AS sede,
                   sp.material, sp.color_acabado, sp.forma, sp.largo_cm, sp.ancho_cm, sp.alto_cm,
                   sp.costo_ingreso,
                   TO_CHAR(sp.fecha_ingreso, 'DD/MM/YYYY') AS fecha_ingreso
            FROM stock_piezas sp
            JOIN sedes se ON sp.sede_id = se.id
            WHERE sp.sku_maestro = %s
              AND sp.estado = 'Disponible'
              {where_extra}
            ORDER BY se.nombre, sp.fecha_ingreso;
        """, params)

        unidades = []
        for r in cur.fetchall():
            medida = ""
            if r[5] == 'Circular': medida = f"⌀ {r[6]} cm" if r[6] else 'Circular'
            elif r[5] == 'Rectangular':
                l = r[6] if r[6] else '?'
                a = f" x {r[7]}" if r[7] else ''
                h = f" / H:{r[8]}" if r[8] else ''
                medida = f"{l}{a} cm{h}"
            else: medida = f"{r[6]} cm" if r[6] else 'Irregular'

            label_parts = [r[1], r[2], medida]
            if r[3]: label_parts.append(r[3])
            if r[4]: label_parts.append(r[4])

            unidades.append({
                'id':            r[0],
                'codigo_barra':  r[1],
                'sede':          r[2],
                'label':         ' — '.join(label_parts),
            })
        return jsonify(unidades), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 3. BUSCAR POR CÓDIGO DE BARRAS
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/buscar/<barcode>', methods=['GET'])
@requiere_login
def buscar_por_barcode(barcode):
    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        # 1. Buscar en stock_productos
        cur.execute("""
            SELECT sp.id, sp.codigo_barra, sp.nombre_modelo, sp.categoria,
                   sp.color_tela, sp.acabado, sp.estado, se.nombre AS sede,
                   sp.foto_url, sp.costo_ingreso, sp.precio_venta,
                   sp.fecha_ingreso, 'producto' AS tipo, sp.fotos_adicionales
            FROM stock_productos sp
            LEFT JOIN sedes se ON sp.sede_id = se.id
            WHERE sp.codigo_barra = %s;
        """, (barcode,))
        row = cur.fetchone()
        if row:
            return jsonify({
                "tipo":              "producto",
                "id":                row[0],
                "codigo_barra":      row[1],
                "nombre_modelo":     row[2],
                "categoria":         row[3],
                "color_tela":        row[4],
                "acabado":           row[5],
                "estado":            row[6],
                "sede":              row[7],
                "foto_url":          row[8] or "",
                "costo_ingreso":     float(row[9]) if row[9] else None,
                "precio_venta":      float(row[10]) if row[10] else None,
                "fecha_ingreso":     row[11].strftime('%d/%m/%Y') if row[11] else None,
                "fotos_adicionales": row[13] or "",
            }), 200

        # 2. Buscar en stock_piezas
        cur.execute("""
            SELECT sp.id, sp.codigo_barra, sp.nombre_modelo, sp.categoria,
                   sp.material, sp.color_acabado, sp.estado, se.nombre AS sede,
                   sp.forma, sp.largo_cm, sp.ancho_cm, sp.alto_cm,
                   sp.costo_ingreso, sp.fecha_ingreso, 'pieza' AS tipo,
                   NULL AS foto_url, sp.fotos_adicionales
            FROM stock_piezas sp
            LEFT JOIN sedes se ON sp.sede_id = se.id
            WHERE sp.codigo_barra = %s;
        """, (barcode,))
        row = cur.fetchone()
        if row:
            foto_url = row[15] or ""
            if not foto_url:
                foto_url = _obtener_foto_maestro(cur, row[3], row[2])
            return jsonify({
                "tipo":              "pieza",
                "id":                row[0],
                "codigo_barra":      row[1],
                "nombre_modelo":     row[2],
                "categoria":         row[3],
                "material":          row[4],
                "color_acabado":     row[5],
                "estado":            row[6],
                "sede":              row[7],
                "forma":             row[8],
                "largo_cm":          float(row[9]) if row[9] else None,
                "ancho_cm":          float(row[10]) if row[10] else None,
                "alto_cm":           float(row[11]) if row[11] else None,
                "costo_ingreso":     float(row[12]) if row[12] else None,
                "fecha_ingreso":     row[13].strftime('%d/%m/%Y') if row[13] else None,
                "foto_url":          foto_url,
                "fotos_adicionales": row[16] or "",
            }), 200

        # 3. ← NUEVO: Buscar en stock_unidades
        cur.execute("""
            SELECT su.id, su.codigo_barra, su.nombre_modelo, su.categoria,
                   su.color_tela, su.acabado, su.estado, se.nombre AS sede,
                   NULL AS foto_url, su.costo_ingreso, su.fecha_ingreso,
                   'unidad' AS tipo
            FROM stock_unidades su
            LEFT JOIN sedes se ON su.sede_id = se.id
            WHERE su.codigo_barra = %s;
        """, (barcode,))
        row = cur.fetchone()
        if row:
            return jsonify({
                "tipo": "producto",   # tratarlo como producto para que el frontend lo muestre igual
                "id": row[0], "codigo_barra": row[1],
                "nombre_modelo": row[2], "categoria": row[3],
                "color_tela": row[4], "acabado": row[5], "estado": row[6],
                "sede": row[7], "foto_url": row[8] or "",
                "costo_ingreso": float(row[9]) if row[9] else None,
                "precio_venta": None,
                "fecha_ingreso": row[10].strftime('%d/%m/%Y') if row[10] else None,
            }), 200

        return jsonify({'error': 'Código no encontrado'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: cur.close(); _rel(conn)
# ─────────────────────────────────────────────────────────────────────────────
# 4. REGISTRAR PRODUCTO ENTERO
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/producto/nuevo', methods=['POST'])
@requiere_login
def registrar_producto():
    _asegurar_columna_fotos_adicionales()
    data = request.json or {}

    if not _verificar_rol(data.get('usuario_rol', '')):
        return jsonify({'error': 'Sin permisos. Solo Admin o Jefe de Taller.'}), 403

    required = ['nombre_modelo', 'categoria', 'sede_id', 'usuario_id']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        prefijo = PREFIJOS.get(data['categoria'], 'PRD')
        barcode = _generar_codigo(cur, prefijo, 'stock_productos')

        cur.execute("""
            INSERT INTO stock_productos
                (catalogo_id, nombre_modelo, categoria, codigo_barra,
                 color_tela, acabado, observaciones, foto_url, fotos_adicionales,
                 sede_id, estado, costo_ingreso, precio_venta, creado_por)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Disponible',%s,%s,%s)
            RETURNING id;
        """, (
            data.get('catalogo_id'),
            data['nombre_modelo'],
            data['categoria'],
            barcode,
            data.get('color_tela'),
            data.get('acabado'),
            data.get('observaciones'),
            data.get('foto_url'),
            data.get('fotos_adicionales'),
            data['sede_id'],
            data.get('costo_ingreso'),
            data.get('precio_venta'),
            data['usuario_id'],
        ))
        nuevo_id = cur.fetchone()[0]

        _registrar_historial(
            cur, 'producto', nuevo_id, barcode,
            'Ingreso', None, data['sede_id'],
            None, 'Disponible',
            data['usuario_id'], data.get('usuario_nombre', ''),
            notas=f"Ingreso inicial. {data.get('observaciones', '')}"
        )

        conn.commit()
        return jsonify({'exito': True, 'id': nuevo_id, 'codigo_barra': barcode}), 201

    except Exception as e:
        if conn: conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 5. REGISTRAR PIEZA A MEDIDA
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/pieza/nueva', methods=['POST'])
@requiere_login
def registrar_pieza():
    _asegurar_columna_fotos_adicionales()
    data = request.json or {}

    if not _verificar_rol(data.get('usuario_rol', '')):
        return jsonify({'error': 'Sin permisos. Solo Admin o Jefe de Taller.'}), 403

    required = ['sku_maestro', 'nombre_modelo', 'categoria', 'forma', 'sede_id', 'usuario_id']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Campos faltantes: {", ".join(missing)}'}), 400

    # Puede registrarse más de 1 unidad a la vez (cantidad)
    cantidad = max(1, int(data.get('cantidad', 1)))

    conn = None
    try:
        conn = _conn(); cur = conn.cursor()
        prefijo  = PREFIJOS.get(data['categoria'], 'PIE')
        generados = []

        for _ in range(cantidad):
            barcode = _generar_codigo(cur, prefijo, 'stock_piezas')
            cur.execute("""
                INSERT INTO stock_piezas
                    (categoria, sku_maestro, nombre_modelo, material, color_acabado,
                    codigo_barra, forma, largo_cm, ancho_cm, alto_cm, fotos_adicionales,
                    sede_id, estado, costo_ingreso, proveedor, usuario_ingreso_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Disponible',%s,%s,%s)
                RETURNING id;
            """, (
                data['categoria'],
                data['sku_maestro'],
                data['nombre_modelo'],
                data.get('material'),
                data.get('color_acabado'),
                barcode,
                data['forma'],
                data.get('largo_cm'),
                data.get('ancho_cm'),
                data.get('alto_cm'),
                data.get('fotos_adicionales'),
                data['sede_id'],
                data.get('costo_ingreso'),
                data.get('proveedor'),
                data['usuario_id'],
            ))
            nuevo_id = cur.fetchone()[0]
            _registrar_historial(
                cur, 'pieza', nuevo_id, barcode,
                'Ingreso', None, data['sede_id'],
                None, 'Disponible',
                data['usuario_id'], data.get('usuario_nombre', ''),
                notas=data.get('notas', 'Ingreso inicial')
            )
            generados.append({'id': nuevo_id, 'codigo_barra': barcode})

        conn.commit()
        return jsonify({'exito': True, 'unidades': generados}), 201

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 6. CAMBIAR ESTADO (Traslado, Venta, Baja, Reserva, etc.)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/<tipo>/<int:reg_id>/estado', methods=['PUT'])
@requiere_login
def cambiar_estado(tipo, reg_id):
    """
    tipo: 'producto' o 'pieza'
    Body JSON:
    {
      "estado_nuevo":   "En Traslado",
      "sede_destino_id": 3,          (requerido si es traslado)
      "tipo_evento":    "Traslado",
      "usuario_id":     5,
      "usuario_rol":    "Admin",
      "usuario_nombre": "Carlos",
      "notas":          "Traslado para exhibición",
      "venta_id":       null,
      "codigo_venta":   null
    }
    """
    if tipo not in ('producto', 'pieza'):
        return jsonify({'error': 'tipo debe ser producto o pieza'}), 400

    data = request.json or {}
    if not _verificar_rol(data.get('usuario_rol', '')):
        return jsonify({'error': 'Sin permisos. Solo Admin o Jefe de Taller.'}), 403

    tabla = 'stock_productos' if tipo == 'producto' else 'stock_piezas'
    conn  = None
    try:
        conn = _conn(); cur = conn.cursor()

        cur.execute(
            f"SELECT estado, sede_id, codigo_barra FROM {tabla} WHERE id = %s",
            (reg_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Registro no encontrado'}), 404

        estado_ant, sede_orig, barcode = row
        estado_nuevo   = data.get('estado_nuevo', estado_ant)
        sede_destino   = data.get('sede_destino_id')
        nueva_sede_id  = sede_destino if sede_destino else sede_orig

        # Actualizar estado y sede si hay traslado
        cur.execute(f"""
            UPDATE {tabla}
               SET estado = %s, sede_id = %s, actualizado_en = NOW()
             WHERE id = %s;
        """, (estado_nuevo, nueva_sede_id, reg_id))

        _registrar_historial(
            cur, tipo, reg_id, barcode,
            data.get('tipo_evento', 'Ajuste'),
            sede_orig, sede_destino,
            estado_ant, estado_nuevo,
            data['usuario_id'], data.get('usuario_nombre', ''),
            data.get('venta_id'), data.get('codigo_venta'),
            data.get('notas')
        )

        conn.commit()
        return jsonify({'exito': True, 'estado_nuevo': estado_nuevo}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 7. HISTORIAL DE UNA UNIDAD
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/historial/<tipo>/<int:reg_id>', methods=['GET'])
@requiere_login
def historial_unidad(tipo, reg_id):
    conn = None
    try:
        conn = _conn(); cur = conn.cursor()
        cur.execute("""
            SELECT h.tipo_evento, h.estado_anterior, h.estado_nuevo,
                   so.nombre AS sede_origen, sd.nombre AS sede_destino,
                   h.usuario_nombre, h.codigo_venta, h.notas,
                   TO_CHAR(h.fecha AT TIME ZONE 'America/Lima', 'DD/MM/YYYY HH24:MI') AS fecha
            FROM historial_inventario h
            LEFT JOIN sedes so ON h.sede_origen_id  = so.id
            LEFT JOIN sedes sd ON h.sede_destino_id = sd.id
            WHERE h.tipo_registro = %s AND h.registro_id = %s
            ORDER BY h.fecha DESC;
        """, (tipo, reg_id))
        rows = cur.fetchall()
        return jsonify([{
            "evento":        r[0], "estado_ant": r[1], "estado_nuevo": r[2],
            "sede_origen":   r[3], "sede_destino": r[4],
            "usuario":       r[5], "venta":       r[6],
            "notas":         r[7], "fecha":        r[8],
        } for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 8. MOVIMIENTOS DE UNA SEDE
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/historial/sede/<int:sede_id>', methods=['GET'])
@requiere_login
def historial_sede(sede_id):
    limite = int(request.args.get('limite', 50))
    conn   = None
    try:
        conn = _conn(); cur = conn.cursor()
        cur.execute("""
            SELECT h.tipo_registro, h.codigo_barra, h.tipo_evento,
                   h.estado_anterior, h.estado_nuevo,
                   so.nombre AS sede_origen, sd.nombre AS sede_destino,
                   h.usuario_nombre, h.codigo_venta, h.notas,
                   TO_CHAR(h.fecha AT TIME ZONE 'America/Lima', 'DD/MM/YYYY HH24:MI') AS fecha
            FROM historial_inventario h
            LEFT JOIN sedes so ON h.sede_origen_id  = so.id
            LEFT JOIN sedes sd ON h.sede_destino_id = sd.id
            WHERE h.sede_origen_id = %s OR h.sede_destino_id = %s
            ORDER BY h.fecha DESC
            LIMIT %s;
        """, (sede_id, sede_id, limite))
        rows = cur.fetchall()
        return jsonify([{
            "tipo": r[0], "codigo_barra": r[1], "evento": r[2],
            "estado_ant": r[3], "estado_nuevo": r[4],
            "sede_origen": r[5], "sede_destino": r[6],
            "usuario": r[7], "venta": r[8], "notas": r[9], "fecha": r[10],
        } for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 9. EXPORTAR CSV COMPLETO
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/exportar', methods=['GET'])
@requiere_rol('Admin', 'Jefe_Taller')
def exportar_inventario():
    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        # Productos enteros
        cur.execute("""
            SELECT 'Producto', sp.categoria, sp.nombre_modelo, sp.codigo_barra,
                   sp.color_tela, sp.acabado, sp.estado, se.nombre,
                   sp.costo_ingreso, sp.precio_venta,
                   TO_CHAR(sp.fecha_ingreso,'DD/MM/YYYY'), sp.observaciones,
                   NULL, NULL, NULL, NULL, NULL
            FROM stock_productos sp JOIN sedes se ON sp.sede_id = se.id
            UNION ALL
            SELECT 'Pieza', sp.categoria, sp.nombre_modelo, sp.codigo_barra,
                   sp.material, sp.color_acabado, sp.estado, se.nombre,
                   sp.costo_ingreso, NULL,
                   TO_CHAR(sp.fecha_ingreso,'DD/MM/YYYY'), NULL,
                   sp.forma, sp.largo_cm::text, sp.ancho_cm::text, sp.alto_cm::text,
                   sp.proveedor
            FROM stock_piezas sp JOIN sedes se ON sp.sede_id = se.id
            ORDER BY 1, 2, 3;
        """)
        rows = cur.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Tipo', 'Categoría', 'Modelo', 'Código Barras',
            'Color/Material', 'Acabado/Color', 'Estado', 'Sede',
            'Costo Ingreso', 'Precio Venta', 'Fecha Ingreso', 'Observaciones',
            'Forma', 'Largo/Diám (cm)', 'Ancho (cm)', 'Alto (cm)', 'Proveedor'
        ])
        writer.writerows(rows)
        output.seek(0)

        fecha = datetime.now(tz_peru).strftime('%Y%m%d_%H%M')
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=inventario_{fecha}.csv'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)

# ─────────────────────────────────────────────────────────────────────────────
# 10. UNIDADES DISPONIBLES POR CATÁLOGO (para el picker del carrito)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/disponibles/<int:catalogo_id>', methods=['GET'])
@requiere_login
def unidades_disponibles_por_catalogo(catalogo_id):
    """
    Devuelve todas las unidades de stock_productos con estado='Disponible'
    que pertenecen al producto de catálogo indicado.

    Usado por addStockItemToCart() en catalogo.js para que el vendedor
    pueda elegir la pieza física exacta que va a vender.

    Query param opcional:  ?sede_id=3  → filtrar por tienda
    """
    sede_id = request.args.get('sede_id', '')
    conn = None
    try:
        conn = _conn(); cur = conn.cursor()

        where_extra = ""
        params = [catalogo_id]
        if sede_id:
            where_extra = " AND sp.sede_id = %s"
            params.append(sede_id)

        cur.execute(f"""
            SELECT sp.id, sp.codigo_barra, se.nombre AS sede,
                   sp.color_tela, sp.acabado, sp.observaciones,
                   sp.costo_ingreso, sp.precio_venta,
                   TO_CHAR(sp.fecha_ingreso, 'DD/MM/YYYY') AS fecha_ingreso
            FROM stock_productos sp
            JOIN sedes se ON sp.sede_id = se.id
            WHERE sp.catalogo_id = %s
              AND sp.estado = 'Disponible'
              {where_extra}
            ORDER BY se.nombre, sp.fecha_ingreso;
        """, params)

        unidades = []
        for r in cur.fetchall():
            # Etiqueta descriptiva para el picker
            label_parts = [r[1], r[2]]                   # código + sede
            if r[3]: label_parts.append(r[3])            # color/tela
            if r[4]: label_parts.append(r[4])            # acabado
            if r[5]: label_parts.append(r[5])            # observaciones
            unidades.append({
                'id':            r[0],
                'codigo_barra':  r[1],
                'sede':          r[2],
                'color_tela':    r[3] or '',
                'acabado':       r[4] or '',
                'observaciones': r[5] or '',
                'costo_ingreso': float(r[6]) if r[6] else None,
                'precio_venta':  float(r[7]) if r[7] else None,
                'fecha_ingreso': r[8] or '',
                'label':         ' — '.join(label_parts),
            })

        return jsonify(unidades), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        _rel(conn)

# ─────────────────────────────────────────────────────────────────────────────
# ELIMINAR ITEM (Pruebas)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/<tipo>/<int:reg_id>', methods=['DELETE'])
@requiere_rol('Admin')
def eliminar_item_inventario(tipo, reg_id):
    if tipo not in ('producto', 'pieza'):
        return jsonify({'error': 'tipo debe ser producto o pieza'}), 400

    tabla = 'stock_productos' if tipo == 'producto' else 'stock_piezas'
    conn = None
    try:
        conn = _conn()
        cur = conn.cursor()

        # Borrar del historial primero para evitar problemas de relación
        cur.execute("DELETE FROM historial_inventario WHERE tipo_registro = %s AND registro_id = %s", (tipo, reg_id))
        
        # Eliminar el registro de stock físico
        cur.execute(f"DELETE FROM {tabla} WHERE id = %s RETURNING id", (reg_id,))
        if not cur.fetchone():
            return jsonify({'error': 'Registro no encontrado'}), 404

        conn.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if conn: conn.rollback()
        err_msg = str(e)
        if "foreign key" in err_msg.lower() or "llave foránea" in err_msg.lower():
            err_msg = "No se puede eliminar porque este registro ya está vinculado a una venta o proceso activo."
        return jsonify({'error': err_msg}), 500
    finally:
        if conn: _rel(conn)

# ─────────────────────────────────────────────────────────────────────────────
# LISTAR UNIDADES DE UN MODELO (Para eliminar pruebas/gestión)
# ─────────────────────────────────────────────────────────────────────────────
@inventario_bp.route('/api/inventario/unidades-modelo', methods=['GET'])
@requiere_login
def unidades_modelo():
    tipo = request.args.get('tipo')
    nombre_modelo = request.args.get('modelo', '')
    
    conn = None
    try:
        conn = _conn()
        cur = conn.cursor()
        
        tabla = 'stock_productos' if tipo == 'producto' else 'stock_piezas'
        
        cur.execute(f"""
            SELECT sp.id, sp.codigo_barra, se.nombre AS sede, sp.estado, sp.fecha_ingreso
            FROM {tabla} sp
            LEFT JOIN sedes se ON sp.sede_id = se.id
            WHERE sp.nombre_modelo = %s
            ORDER BY sp.fecha_ingreso DESC
        """, (nombre_modelo,))
            
        unidades = [{
            'id': r[0], 'codigo_barra': r[1],
            'sede': r[2] or 'Sin sede', 'estado': r[3],
            'fecha_ingreso': r[4].strftime('%d/%m/%Y') if r[4] else ''
        } for r in cur.fetchall()]
            
        return jsonify(unidades), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: _rel(conn)