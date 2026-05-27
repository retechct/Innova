"""
routes_seguimiento.py — Portal de seguimiento para clientes finales.
"""

import traceback
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto

seguimiento_bp = Blueprint('seguimiento', __name__)

ESTADO_LEGIBLE = {
    'En Producción':  ('⚙️ En producción',    'Tu pedido está siendo fabricado en nuestro taller.'),
    'Listo':          ('✅ Listo',             'Tu pedido está terminado y listo para coordinación de entrega.'),
    'En Despacho':    ('🚚 En camino',         'Tu pedido está en camino hacia ti.'),
    'Entregado':      ('🎉 Entregado',         '¡Tu pedido fue entregado! Esperamos que lo disfrutes.'),
    'Cancelado':      ('❌ Cancelado',          'Este pedido fue cancelado.'),
    'Pendiente Pago': ('💳 Pendiente de pago', 'Tu pedido está pendiente de confirmar el pago.'),
}

def _estado_para_cliente(estado_interno):
    label, desc = ESTADO_LEGIBLE.get(
        estado_interno,
        (f'⏳ {estado_interno}', 'Pedido registrado, pronto recibirás novedades.')
    )
    return {'label': label, 'descripcion': desc, 'raw': estado_interno}


def _progreso_tickets(cursor, venta_id):
    try:
        cursor.execute("""
            SELECT
                SUM(CASE WHEN t.area_trabajo != 'DESPACHO_CENTRAL' THEN 1 ELSE 0 END),
                SUM(CASE WHEN t.estado_ticket = 'Terminado'
                          AND t.area_trabajo != 'DESPACHO_CENTRAL' THEN 1 ELSE 0 END)
            FROM items_venta i
            LEFT JOIN tickets_produccion t ON i.id = t.item_id
            WHERE i.venta_id = %s;
        """, (venta_id,))
        row = cursor.fetchone()
        total      = int(row[0] or 0)
        terminados = int(row[1] or 0)
        porcentaje = round(terminados / total * 100) if total > 0 else 0
        return {'total': total, 'terminados': terminados, 'porcentaje': porcentaje}
    except Exception:
        return {'total': 0, 'terminados': 0, 'porcentaje': 0}


@seguimiento_bp.route('/api/seguimiento/mis-pedidos', methods=['GET'])
def mis_pedidos():
    email = (request.args.get('email') or '').strip().lower()
    if not email or '@' not in email:
        return jsonify({'error': 'Ingresa un correo válido'}), 400

    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Buscar nombre: primero en usuarios (ERP), luego en clientes (landing)
        nombre_cliente = None
        cursor.execute(
            "SELECT nombre FROM usuarios WHERE LOWER(email) = %s LIMIT 1;",
            (email,)
        )
        row = cursor.fetchone()
        if row:
            nombre_cliente = row[0]

        if not nombre_cliente:
            try:
                cursor.execute(
                    "SELECT nombre FROM clientes WHERE LOWER(email) = %s LIMIT 1;",
                    (email,)
                )
                row = cursor.fetchone()
                if row:
                    nombre_cliente = row[0]
            except Exception:
                pass  # la tabla clientes puede no existir aún

        # Buscar ventas por nombre (coincidencia exacta o parcial)
        ventas = []
        if nombre_cliente:
            cursor.execute("""
                SELECT id, codigo_venta, nombre_cliente, fecha_emision,
                       fecha_entrega, monto_total, monto_adelanto,
                       COALESCE(estado_general, 'En Producción'), sede
                FROM ventas
                WHERE LOWER(nombre_cliente) LIKE LOWER(%s)
                ORDER BY fecha_emision DESC
                LIMIT 20;
            """, (f'%{nombre_cliente}%',))
            ventas = cursor.fetchall()

        resultado = []
        for v in ventas:
            venta_id = v[0]
            progreso = _progreso_tickets(cursor, venta_id)
            estado   = _estado_para_cliente(v[7])
            total    = float(v[5] or 0)
            adelanto = float(v[6] or 0)
            saldo    = max(0, total - adelanto)

            thumbnail       = 'imagenes/sin_foto.jpg'
            primer_producto = '—'
            try:
                cursor.execute(
                    "SELECT producto, foto_url FROM items_venta WHERE venta_id = %s ORDER BY id LIMIT 1;",
                    (venta_id,)
                )
                item_row = cursor.fetchone()
                if item_row:
                    primer_producto = item_row[0] or '—'
                    thumbnail = limpiar_foto(item_row[1])
            except Exception:
                pass

            resultado.append({
                'codigo':          v[1],
                'cliente':         v[2],
                'fecha_emision':   v[3].strftime('%d/%m/%Y') if v[3] else '—',
                'fecha_entrega':   v[4].strftime('%d/%m/%Y') if v[4] else 'Por coordinar',
                'total':           total,
                'adelanto':        adelanto,
                'saldo':           saldo,
                'estado':          estado,
                'progreso':        progreso,
                'sede':            v[8] or '',
                'thumbnail':       thumbnail,
                'primer_producto': primer_producto,
            })

        return jsonify({
            'email':          email,
            'nombre_cliente': nombre_cliente,
            'pedidos':        resultado,
            'total_pedidos':  len(resultado),
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)


@seguimiento_bp.route('/api/seguimiento/pedido/<codigo>', methods=['GET'])
def detalle_pedido_cliente(codigo):
    email  = (request.args.get('email') or '').strip().lower()
    codigo = codigo.upper().strip()

    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        cursor.execute("""
            SELECT id, codigo_venta, nombre_cliente, fecha_emision, fecha_entrega,
                   monto_total, monto_adelanto, COALESCE(estado_general, 'En Producción'),
                   sede, vendedor_nombre
            FROM ventas WHERE codigo_venta = %s;
        """, (codigo,))
        venta = cursor.fetchone()
        if not venta:
            return jsonify({'error': 'Pedido no encontrado'}), 404

        venta_id = venta[0]

        moneda = 'PEN'
        comprobante = 'Boleta'
        try:
            cursor.execute("SELECT moneda, tipo_comprobante FROM ventas WHERE id = %s;", (venta_id,))
            row_extra = cursor.fetchone()
            if row_extra:
                moneda      = row_extra[0] or 'PEN'
                comprobante = row_extra[1] or 'Boleta'
        except Exception:
            conexion.rollback()

        # Ítems
        items = []
        try:
            cursor.execute("""
                SELECT producto,
                       COALESCE(detalles, color_tela, '') AS detalles,
                       foto_url, precio_unitario
                FROM items_venta WHERE venta_id = %s ORDER BY id;
            """, (venta_id,))
            items = [{
                'producto': r[0],
                'detalles': r[1] or '',
                'foto':     limpiar_foto(r[2]),
                'precio':   float(r[3]) if r[3] else None,
            } for r in cursor.fetchall()]
        except Exception:
            pass

        # Pagos
        pagos = []
        try:
            cursor.execute("""
                SELECT tipo_pago, entidad, monto_bruto, comprobante_url,
                       TO_CHAR(fecha_pago, 'DD/MM/YYYY')
                FROM pagos WHERE venta_id = %s ORDER BY id;
            """, (venta_id,))
            pagos = [{
                'tipo':        r[0] or '—',
                'entidad':     r[1] or '—',
                'monto':       float(r[2] or 0),
                'comprobante': r[3] if r[3] and r[3] != 'Sin imagen' else None,
                'fecha':       r[4] or '—',
            } for r in cursor.fetchall()]
        except Exception:
            pass

        # Progreso por área
        areas = []
        try:
            cursor.execute("""
                SELECT t.area_trabajo, t.estado_ticket, COUNT(*) AS cnt
                FROM items_venta i
                JOIN tickets_produccion t ON i.id = t.item_id
                WHERE i.venta_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL'
                GROUP BY t.area_trabajo, t.estado_ticket
                ORDER BY t.area_trabajo;
            """, (venta_id,))
            areas_dict = {}
            for area, est, cnt in cursor.fetchall():
                if area not in areas_dict:
                    areas_dict[area] = {'area': area, 'terminados': 0, 'total': 0}
                areas_dict[area]['total'] += cnt
                if est == 'Terminado':
                    areas_dict[area]['terminados'] += cnt
            for a in areas_dict.values():
                pct = round(a['terminados'] / a['total'] * 100) if a['total'] > 0 else 0
                areas.append({**a, 'porcentaje': pct, 'listo': pct == 100})
        except Exception:
            pass

        total    = float(venta[5] or 0)
        adelanto = float(venta[6] or 0)
        saldo    = max(0, total - adelanto)

        return jsonify({
            'codigo':        venta[1],
            'cliente':       venta[2],
            'fecha_emision': venta[3].strftime('%d/%m/%Y') if venta[3] else '—',
            'fecha_entrega': venta[4].strftime('%d/%m/%Y') if venta[4] else 'Por coordinar',
            'total':         total,
            'adelanto':      adelanto,
            'saldo':         saldo,
            'estado':        _estado_para_cliente(venta[7]),
            'progreso':      _progreso_tickets(cursor, venta_id),
            'sede':          venta[8] or '',
            'vendedor':      venta[9] or '',
            'moneda':        moneda,
            'comprobante':   comprobante,
            'items':         items,
            'pagos':         pagos,
            'areas':         areas,
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)