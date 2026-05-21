"""
routes_taller.py — Módulo 4: Taller y Producción
Rutas nuevas que completan el módulo:
  GET  /api/taller/stats           → resumen de estado del kanban
  GET  /api/taller/ordenes         → órdenes de producción agrupadas por pedido
  POST /api/taller/ticket/<id>/nota → agregar nota/incidencia a un ticket
"""
import os
import pytz
from datetime import datetime
from flask import Blueprint, request, jsonify
import psycopg2
from psycopg2 import pool as pg_pool

taller_bp = Blueprint('taller_extra', __name__)

# Pool propio del blueprint (se inicializa después de cargar .env)
_pool = None


def init_taller_pool():
    """Llamar desde app.py DESPUÉS de load_dotenv()."""
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=1, maxconn=5,
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
        )


def _get_conn():
    return _pool.getconn()


def _release_conn(conn):
    if conn:
        _pool.putconn(conn)


def _limpiar_foto(url):
    backend = os.getenv("BACKEND_URL", "https://innova-4cnn.onrender.com")
    if not url or "via.placeholder.com" in url:
        return "imagenes/sin_foto.jpg"
    if url.startswith("http"):
        return url
    return f"{backend}/uploads/{url}"


# ──────────────────────────────────────────────────────────────────────────────
# 1. STATS DEL TALLER
# ──────────────────────────────────────────────────────────────────────────────
@taller_bp.route('/api/taller/stats', methods=['GET'])
def obtener_stats_taller():
    """
    Resumen rápido para poblar el badge del header del Kanban.
    Devuelve conteos de tickets por estado, excluyendo DESPACHO_CENTRAL.
    """
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE estado_ticket = 'Pendiente'
                                   AND area_trabajo != 'DESPACHO_CENTRAL')  AS pendientes,
                COUNT(*) FILTER (WHERE estado_ticket = 'En Proceso'
                                   AND area_trabajo != 'DESPACHO_CENTRAL')  AS en_proceso,
                COUNT(*) FILTER (WHERE estado_ticket = 'Bloqueado')         AS bloqueados,
                COUNT(*) FILTER (WHERE estado_ticket != 'Terminado'
                                   AND area_trabajo != 'DESPACHO_CENTRAL')  AS activos,
                -- Ventas que acaban de pasar a Listo (todas sus áreas terminadas)
                (SELECT COUNT(DISTINCT v.id)
                   FROM ventas v
                   WHERE COALESCE(v.estado_general, '') = 'Listo')          AS ventas_listas
            FROM tickets_produccion;
        """)
        r = cur.fetchone()
        return jsonify({
            "pendientes":   r[0],
            "en_proceso":   r[1],
            "bloqueados":   r[2],
            "activos":      r[3],
            "ventas_listas": r[4],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conn' in locals():
            cur.close(); _release_conn(conn)


# ──────────────────────────────────────────────────────────────────────────────
# 2. ÓRDENES DE PRODUCCIÓN AGRUPADAS POR PEDIDO
# ──────────────────────────────────────────────────────────────────────────────
@taller_bp.route('/api/taller/ordenes', methods=['GET'])
def obtener_ordenes_produccion():
    """
    Vista de Órdenes de Producción para el Admin / Jefe de Taller.
    Agrupa los tickets por venta y devuelve el progreso de cada pedido.

    Query params:
      ?estado=activas (default) → excluye Entregado y Cancelado
      ?estado=todas             → todas las ventas con tickets
    """
    estado_filtro = request.args.get('estado', 'activas')
    where_ventas = (
        "WHERE COALESCE(v.estado_general, 'En Producción') NOT IN ('Entregado', 'Cancelado')"
        if estado_filtro == 'activas'
        else "WHERE 1=1"
    )
    try:
        conn = _get_conn()
        cur = conn.cursor()

        # Cabeceras de venta con conteos de tickets
        cur.execute(f"""
            SELECT
                v.id,
                v.codigo_venta,
                v.nombre_cliente,
                v.fecha_entrega,
                COALESCE(v.estado_general, 'En Producción')  AS estado,
                COALESCE(v.vendedor_nombre, '')               AS vendedor,
                COALESCE(v.sede, '')                          AS sede,
                COUNT(DISTINCT i.id)                          AS total_items,
                COUNT(t.id) FILTER (WHERE t.area_trabajo != 'DESPACHO_CENTRAL') AS total_tickets,
                COUNT(t.id) FILTER (WHERE t.estado_ticket = 'Terminado'
                                      AND t.area_trabajo != 'DESPACHO_CENTRAL') AS terminados,
                COUNT(t.id) FILTER (WHERE t.estado_ticket = 'En Proceso'
                                      AND t.area_trabajo != 'DESPACHO_CENTRAL') AS en_proceso,
                COUNT(t.id) FILTER (WHERE t.estado_ticket IN ('Pendiente','Bloqueado')
                                      AND t.area_trabajo != 'DESPACHO_CENTRAL') AS pendientes
            FROM ventas v
            LEFT JOIN items_venta i      ON v.id = i.venta_id
            LEFT JOIN tickets_produccion t ON i.id = t.item_id
            {where_ventas}
            GROUP BY v.id, v.codigo_venta, v.nombre_cliente, v.fecha_entrega,
                     v.estado_general, v.vendedor_nombre, v.sede
            HAVING COUNT(t.id) > 0
            ORDER BY v.fecha_entrega ASC NULLS LAST, v.id DESC
            LIMIT 100;
        """)
        ventas_rows = cur.fetchall()

        ordenes = []
        for v in ventas_rows:
            venta_id   = v[0]
            total_tick = v[8]
            terminados = v[9]
            progreso   = round((terminados / total_tick * 100)) if total_tick > 0 else 0

            # Detalle de ítems y sus tickets para este pedido
            cur.execute("""
                SELECT
                    i.id                                        AS item_id,
                    i.producto,
                    COALESCE(i.foto_url, '')                    AS foto_url,
                    t.id                                        AS ticket_id,
                    t.area_trabajo,
                    t.estado_ticket,
                    COALESCE(u.nombre, 'Sin asignar')           AS trabajador,
                    t.etapa,
                    COALESCE(t.ticket_details_override, i.color_tela, '') AS notas
                FROM items_venta i
                LEFT JOIN tickets_produccion t ON i.id = t.item_id
                LEFT JOIN usuarios u ON t.trabajador_asignado_id = u.id
                WHERE i.venta_id = %s
                ORDER BY i.id, t.etapa ASC, t.id ASC;
            """, (venta_id,))

            items_dict = {}
            for r in cur.fetchall():
                iid = r[0]
                if iid not in items_dict:
                    items_dict[iid] = {
                        "id":       iid,
                        "producto": r[1],
                        "foto":     _limpiar_foto(r[2]),
                        "tickets":  []
                    }
                if r[3]:   # hay ticket para este ítem
                    items_dict[iid]["tickets"].append({
                        "id":          r[3],
                        "area":        r[4],
                        "estado":      r[5],
                        "trabajador":  r[6],
                        "etapa":       r[7],
                        "notas":       r[8],
                    })

            ordenes.append({
                "venta_id":         venta_id,
                "codigo":           v[1],
                "cliente":          v[2],
                "fecha_entrega":    v[3].strftime('%d/%m/%Y') if v[3] else "S/F",
                "estado":           v[4],
                "vendedor":         v[5],
                "sede":             v[6],
                "total_items":      v[7],
                "progreso":         progreso,
                "tickets_total":    total_tick,
                "tickets_term":     terminados,
                "tickets_proceso":  v[10],
                "tickets_pendiente": v[11],
                "items":            list(items_dict.values()),
            })

        return jsonify(ordenes), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conn' in locals():
            cur.close(); _release_conn(conn)


# ──────────────────────────────────────────────────────────────────────────────
# 3. AGREGAR NOTA / INCIDENCIA A UN TICKET
# ──────────────────────────────────────────────────────────────────────────────
@taller_bp.route('/api/taller/ticket/<int:ticket_id>/nota', methods=['POST'])
def agregar_nota_ticket(ticket_id):
    """
    Añade una nota o incidencia al campo ticket_details_override.
    El texto se añade con timestamp al final del override existente.
    Body JSON: { nota: "texto", usuario_nombre: "Juan" }
    """
    data          = request.json or {}
    nota          = (data.get('nota') or '').strip()
    usuario_nombre = (data.get('usuario_nombre') or 'Usuario').strip()

    if not nota:
        return jsonify({'error': 'La nota no puede estar vacía'}), 400

    try:
        conn = _get_conn()
        cur  = conn.cursor()

        cur.execute(
            "SELECT id, ticket_details_override FROM tickets_produccion WHERE id = %s",
            (ticket_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Ticket no encontrado'}), 404

        tz_peru    = pytz.timezone('America/Lima')
        timestamp  = datetime.now(tz_peru).strftime('%d/%m/%Y %H:%M')
        nueva_linea = f"📝 [{timestamp}] {usuario_nombre}: {nota}"

        override_prev = row[1] or ''
        nuevo_override = (override_prev + '\n' + nueva_linea).strip()

        cur.execute(
            "UPDATE tickets_produccion SET ticket_details_override = %s WHERE id = %s",
            (nuevo_override, ticket_id)
        )
        conn.commit()
        return jsonify({'exito': True, 'mensaje': 'Nota agregada correctamente'}), 200

    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conn' in locals():
            cur.close(); _release_conn(conn)