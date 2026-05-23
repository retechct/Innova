"""
routes_seguimiento.py — Portal de seguimiento para clientes finales.

Permite que un cliente vea el estado de sus pedidos usando solo su email.
No requiere JWT (es público) pero es seguro: solo muestra datos del email consultado.

Registrar en app.py:
    from routes_seguimiento import seguimiento_bp
    app.register_blueprint(seguimiento_bp)

Endpoints:
  GET  /api/seguimiento/mis-pedidos?email=...   → lista de pedidos del cliente
  GET  /api/seguimiento/pedido/<codigo>          → detalle completo de un pedido
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto

seguimiento_bp = Blueprint('seguimiento', __name__)


# ─── Mapa de estado legible para el cliente ───────────────────────────────────

ESTADO_LEGIBLE = {
    'En Producción':   ('⚙️ En producción',   'Tu pedido está siendo fabricado en nuestro taller.'),
    'Listo':           ('✅ Listo',            'Tu pedido está terminado y listo para coordinación de entrega.'),
    'En Despacho':     ('🚚 En camino',        'Tu pedido está en camino hacia ti.'),
    'Entregado':       ('🎉 Entregado',        '¡Tu pedido fue entregado! Esperamos que lo disfrutes.'),
    'Cancelado':       ('❌ Cancelado',         'Este pedido fue cancelado.'),
    'Pendiente Pago':  ('💳 Pendiente de pago', 'Tu pedido está pendiente de confirmar el pago.'),
}

def _estado_para_cliente(estado_interno: str) -> dict:
    label, descripcion = ESTADO_LEGIBLE.get(
        estado_interno,
        (f'⏳ {estado_interno}', 'Pedido registrado, pronto recibirás novedades.')
    )
    return {'label': label, 'descripcion': descripcion, 'raw': estado_interno}


def _progreso_tickets(cursor, venta_id: int) -> dict:
    """Calcula % de avance de producción basado en tickets."""
    cursor.execute("""
        SELECT
            COUNT(*) FILTER (WHERE t.area_trabajo != 'DESPACHO_CENTRAL') AS total,
            COUNT(*) FILTER (WHERE t.estado_ticket = 'Terminado'
                               AND t.area_trabajo != 'DESPACHO_CENTRAL') AS terminados
        FROM items_venta i
        LEFT JOIN tickets_produccion t ON i.id = t.item_id
        WHERE i.venta_id = %s;
    """, (venta_id,))
    row = cursor.fetchone()
    total      = row[0] or 0
    terminados = row[1] or 0
    porcentaje = round((terminados / total * 100)) if total > 0 else 0
    return {'total': total, 'terminados': terminados, 'porcentaje': porcentaje}


# ==========================================
# MIS PEDIDOS — búsqueda por email
# ==========================================

@seguimiento_bp.route('/api/seguimiento/mis-pedidos', methods=['GET'])
def mis_pedidos():
    """
    Devuelve todos los pedidos asociados al email del cliente.
    Busca en ventas por dni_cliente/celular_cliente O en la tabla clientes.

    Query param: ?email=cliente@correo.com
    """
    email = (request.args.get('email') or '').strip().lower()
    if not email or '@' not in email:
        return jsonify({'error': 'Ingresa un correo válido'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Buscar cliente en tabla clientes
        cursor.execute(
            "SELECT id, nombre FROM clientes WHERE LOWER(email) = %s LIMIT 1;",
            (email,)
        )
        cliente_row = cursor.fetchone()

        # También buscar en usuarios (clientes registrados en el ERP)
        cursor.execute(
            "SELECT id, nombre FROM usuarios WHERE LOWER(email) = %s AND rol = 'Cliente' LIMIT 1;",
            (email,)
        )
        usuario_row = cursor.fetchone()

        nombre_cliente = None
        if cliente_row:
            nombre_cliente = cliente_row[1]
        elif usuario_row:
            nombre_cliente = usuario_row[1]

        # Buscar ventas por nombre de cliente o email directo en ventas
        # La tabla ventas no guarda email pero guarda nombre_cliente y dni
        # Buscar por nombre exacto si lo encontramos, o por email en campo correo si existe
        ventas = []

        if nombre_cliente:
            cursor.execute("""
                SELECT id, codigo_venta, nombre_cliente, fecha_emision,
                       fecha_entrega, monto_total, monto_adelanto,
                       COALESCE(estado_general, 'En Producción') AS estado,
                       sede
                FROM ventas
                WHERE LOWER(nombre_cliente) = LOWER(%s)
                ORDER BY fecha_emision DESC
                LIMIT 20;
            """, (nombre_cliente,))
            ventas = cursor.fetchall()

        # Si no encontramos por nombre, buscar por email en el campo correo_cliente si existe
        if not ventas:
            try:
                cursor.execute("""
                    SELECT id, codigo_venta, nombre_cliente, fecha_emision,
                           fecha_entrega, monto_total, monto_adelanto,
                           COALESCE(estado_general, 'En Producción') AS estado,
                           sede
                    FROM ventas
                    WHERE LOWER(correo_cliente) = %s
                    ORDER BY fecha_emision DESC
                    LIMIT 20;
                """, (email,))
                ventas = cursor.fetchall()
            except Exception:
                pass  # La columna correo_cliente puede no existir

        resultado = []
        for v in ventas:
            venta_id = v[0]
            progreso = _progreso_tickets(cursor, venta_id)
            estado   = _estado_para_cliente(v[7])

            # Saldo pendiente
            total    = float(v[5] or 0)
            adelanto = float(v[6] or 0)
            saldo    = max(0, total - adelanto)

            # Primer ítem para thumbnail
            cursor.execute("""
                SELECT producto, foto_url FROM items_venta
                WHERE venta_id = %s ORDER BY id LIMIT 1;
            """, (venta_id,))
            item_row = cursor.fetchone()

            resultado.append({
                'codigo':        v[1],
                'cliente':       v[2],
                'fecha_emision': v[3].strftime('%d/%m/%Y') if v[3] else '—',
                'fecha_entrega': v[4].strftime('%d/%m/%Y') if v[4] else 'Por coordinar',
                'total':         total,
                'adelanto':      adelanto,
                'saldo':         saldo,
                'estado':        estado,
                'progreso':      progreso,
                'sede':          v[8] or '',
                'thumbnail':     limpiar_foto(item_row[1] if item_row else None),
                'primer_producto': item_row[0] if item_row else '—',
            })

        return jsonify({
            'email':          email,
            'nombre_cliente': nombre_cliente,
            'pedidos':        resultado,
            'total_pedidos':  len(resultado),
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# DETALLE DE UN PEDIDO — por código
# ==========================================

@seguimiento_bp.route('/api/seguimiento/pedido/<codigo>', methods=['GET'])
def detalle_pedido_cliente(codigo):
    """
    Detalle completo de un pedido para mostrar al cliente.
    Incluye ítems, pagos registrados y progreso de producción por área.

    Query param opcional: ?email=... para validar que el pedido pertenece al cliente.
    """
    email = (request.args.get('email') or '').strip().lower()
    codigo = codigo.upper().strip()

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        cursor.execute("""
            SELECT id, codigo_venta, nombre_cliente, fecha_emision, fecha_entrega,
                   monto_total, monto_adelanto, COALESCE(estado_general, 'En Producción'),
                   sede, vendedor_nombre, moneda, tipo_comprobante
            FROM ventas WHERE codigo_venta = %s;
        """, (codigo,))
        venta = cursor.fetchone()

        if not venta:
            return jsonify({'error': 'Pedido no encontrado'}), 404

        venta_id = venta[0]

        # ── Ítems del pedido ──────────────────────────────────────────────────
        cursor.execute("""
            SELECT producto, color_tela, foto_url, precio_unitario
            FROM items_venta WHERE venta_id = %s ORDER BY id;
        """, (venta_id,))
        items = [{
            'producto':  r[0],
            'detalles':  r[1] or '',
            'foto':      limpiar_foto(r[2]),
            'precio':    float(r[3]) if r[3] else None,
        } for r in cursor.fetchall()]

        # ── Pagos registrados ─────────────────────────────────────────────────
        cursor.execute("""
            SELECT tipo_pago, entidad, monto_bruto, comprobante_url,
                   TO_CHAR(fecha_pago, 'DD/MM/YYYY')
            FROM pagos WHERE venta_id = %s ORDER BY id;
        """, (venta_id,))
        pagos = [{
            'tipo':         r[0] or '—',
            'entidad':      r[1] or '—',
            'monto':        float(r[2] or 0),
            'comprobante':  r[3] if r[3] and r[3] != 'Sin imagen' else None,
            'fecha':        r[4] or '—',
        } for r in cursor.fetchall()]

        # ── Progreso por área ─────────────────────────────────────────────────
        cursor.execute("""
            SELECT t.area_trabajo, t.estado_ticket, COUNT(*) AS cnt
            FROM items_venta i
            JOIN tickets_produccion t ON i.id = t.item_id
            WHERE i.venta_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL'
            GROUP BY t.area_trabajo, t.estado_ticket
            ORDER BY t.area_trabajo;
        """, (venta_id,))
        areas_raw = cursor.fetchall()

        areas_dict: dict = {}
        for area, estado_ticket, cnt in areas_raw:
            if area not in areas_dict:
                areas_dict[area] = {'area': area, 'terminados': 0, 'total': 0}
            areas_dict[area]['total'] += cnt
            if estado_ticket == 'Terminado':
                areas_dict[area]['terminados'] += cnt

        areas = []
        for a in areas_dict.values():
            pct = round(a['terminados'] / a['total'] * 100) if a['total'] > 0 else 0
            areas.append({**a, 'porcentaje': pct,
                          'listo': pct == 100})

        # ── Totales ───────────────────────────────────────────────────────────
        total    = float(venta[5] or 0)
        adelanto = float(venta[6] or 0)
        saldo    = max(0, total - adelanto)

        progreso_global = _progreso_tickets(cursor, venta_id)
        estado          = _estado_para_cliente(venta[7])

        return jsonify({
            'codigo':          venta[1],
            'cliente':         venta[2],
            'fecha_emision':   venta[3].strftime('%d/%m/%Y') if venta[3] else '—',
            'fecha_entrega':   venta[4].strftime('%d/%m/%Y') if venta[4] else 'Por coordinar',
            'total':           total,
            'adelanto':        adelanto,
            'saldo':           saldo,
            'estado':          estado,
            'progreso':        progreso_global,
            'sede':            venta[8] or '',
            'vendedor':        venta[9] or '',
            'moneda':          venta[10] or 'PEN',
            'comprobante':     venta[11] or 'Boleta',
            'items':           items,
            'pagos':           pagos,
            'areas':           areas,
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)