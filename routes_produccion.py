"""
routes_produccion.py — Módulos 8–13: Taller/Kanban, inventario de materiales,
logística externa, recetas BOM, sugerencias de insumos y despacho.
Blueprint: produccion_bp  (sin prefijo de URL)
"""

import json
import uuid
from datetime import datetime
from io import BytesIO
import cloudinary.uploader
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto

# pip install reportlab==4.2.2
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors as rl_colors
from reportlab.platypus import Table, TableStyle
from reportlab.lib.units import mm

produccion_bp = Blueprint('produccion', __name__)

AREA_ALIASES = {
    'TELAS':                  ['TELAS', 'CORTE_Y_CONTROL_TELAS'],
    'CORTE_Y_CONTROL_TELAS':  ['CORTE_Y_CONTROL_TELAS', 'TELAS'],
    'TAPICERIA':              ['TAPICERIA', 'TAPICERIA_SOFAS', 'TAPICERIA_SILLAS'],
    'TAPICERIA_SOFAS':        ['TAPICERIA_SOFAS', 'TAPICERIA'],
    'TAPICERIA_SILLAS':       ['TAPICERIA_SILLAS', 'TAPICERIA'],
    'ESTRUCTURAS':            ['ESTRUCTURAS', 'ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS', 'CARPINTERIA'],
    'ESTRUCTURAS_MUEBLES':    ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS', 'CARPINTERIA'],
    'ESTRUCTURAS_SILLAS':     ['ESTRUCTURAS_SILLAS', 'ESTRUCTURAS', 'CARPINTERIA'],
    'CARPINTERIA':            ['CARPINTERIA', 'ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS'],
}


# ==========================================
# 8. TALLER Y KANBAN
# ==========================================

@produccion_bp.route('/api/taller/ticket/<int:id>/finalizar', methods=['POST'])
def finalizar_ticket(id):
    try:
        if 'foto' not in request.files or request.files['foto'].filename == '':
            return jsonify({'error': 'La foto de evidencia es obligatoria'}), 400

        foto = request.files['foto']
        respuesta_nube = cloudinary.uploader.upload(foto, folder="evidencias")
        foto_url_final = respuesta_nube.get('secure_url')

        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()

        cursor.execute("""
            UPDATE tickets_produccion
            SET estado_ticket = CASE
                    WHEN area_trabajo IN ('ESTRUCTURAS_MUEBLES','ESTRUCTURAS_SILLAS')
                    THEN 'Listo para Recojo'
                    ELSE 'Terminado'
                END,
                foto_evidencia = %s,
                fecha_fin = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING item_id, area_trabajo, estado_ticket;
        """, (foto_url_final, id))
        row = cursor.fetchone()

        desbloqueados = 0
        if row:
            item_id   = row[0]
            area_term = row[1]

            cursor.execute("""
                SELECT t.id, t.area_trabajo FROM tickets_produccion t
                WHERE t.item_id = %s AND t.estado_ticket = 'Bloqueado'
                  AND t.area_trabajo IN ('TAPICERIA_SOFAS','TAPICERIA_SILLAS','ARMADO_COJINES')
            """, (item_id,))
            tickets_bloqueados = cursor.fetchall()

            for tb_id, tb_area in tickets_bloqueados:
                if tb_area in ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS'):
                    areas_req = ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS', 'CORTE_Y_CONTROL_TELAS', 'TELAS']
                elif tb_area == 'ARMADO_COJINES':
                    areas_req = ['CORTE_Y_CONTROL_TELAS', 'TELAS']
                else:
                    continue

                placeholders_req = ','.join(['%s'] * len(areas_req))
                cursor.execute(f"""
                    SELECT COUNT(*) FROM tickets_produccion
                    WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                    AND estado_ticket IN ('Terminado', 'Listo para Recojo', 'Recogido')
                """, (item_id, *areas_req))
                terminados_req = cursor.fetchone()[0]

                cursor.execute(f"""
                    SELECT COUNT(*) FROM tickets_produccion
                    WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                """, (item_id, *areas_req))
                total_req = cursor.fetchone()[0]

                if total_req > 0 and terminados_req >= total_req:
                    cursor.execute("""
                        UPDATE tickets_produccion
                        SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
                        WHERE id = %s AND estado_ticket = 'Bloqueado'
                    """, (tb_id,))
                    desbloqueados += cursor.rowcount

        venta_actualizada = False
        if row:
            cursor.execute("SELECT venta_id FROM items_venta WHERE id = %s", (item_id,))
            venta_row = cursor.fetchone()
            if venta_row:
                venta_id_check = venta_row[0]

                # Si el ticket finalizado es DESPACHO_CENTRAL → marcar venta como Entregado
                if area_term == 'DESPACHO_CENTRAL':
                    cursor.execute("""
                        UPDATE ventas SET estado_general = 'Entregado'
                        WHERE id = %s AND COALESCE(estado_general,'') != 'Cancelado'
                    """, (venta_id_check,))
                    venta_actualizada = cursor.rowcount > 0
                else:
                    cursor.execute("""
                        SELECT COUNT(*) FROM tickets_produccion t
                        JOIN items_venta i ON t.item_id = i.id
                        WHERE i.venta_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL'
                        AND t.estado_ticket NOT IN ('Terminado', 'Listo para Recojo', 'Recogido')
                    """, (venta_id_check,))
                    if cursor.fetchone()[0] == 0:
                        cursor.execute("""
                            UPDATE ventas SET estado_general = 'Listo'
                            WHERE id = %s AND COALESCE(estado_general,'') NOT IN ('Entregado','Cancelado')
                        """, (venta_id_check,))
                        venta_actualizada = cursor.rowcount > 0

        conexion.commit()
        es_despacho     = row and row[1] == 'DESPACHO_CENTRAL'
        es_listo_recojo = row and row[2] == 'Listo para Recojo'
        if es_despacho:
            msg = '🎉 ¡Entrega confirmada! La venta fue marcada como Entregado.'
        elif es_listo_recojo:
            msg = '🔴 Estructura lista. Esperando que el chofer confirme el recojo.'
        else:
            msg = 'Ticket finalizado correctamente'
        if not es_despacho and desbloqueados > 0:
            msg += f'. {desbloqueados} ticket(s) de tapicería desbloqueado(s) automáticamente.'
        if not es_despacho and venta_actualizada:
            msg += '. ✅ ¡Producción completa! La venta pasó a estado Listo.'
        return jsonify({'exito': True, 'mensaje': msg, 'desbloqueados': desbloqueados, 'venta_lista': venta_actualizada, 'es_entrega': es_despacho, 'es_listo_recojo': es_listo_recojo}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/cola-recojo', methods=['GET'])
def obtener_cola_recojo():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT t.id, t.area_trabajo, i.producto, v.codigo_venta, v.nombre_cliente,
                   COALESCE(u.nombre, 'Sin asignar') AS operario, t.fecha_fin,
                   COALESCE(i.foto_url, '') AS foto_url,
                   COALESCE(t.ticket_details_override, i.color_tela, '') AS especificaciones,
                   t.foto_evidencia, v.direccion_cliente, v.fecha_entrega, t.item_id,
                   COALESCE(ut.nombre, 'Sin asignar') AS tapicero_nombre,
                   CASE
                       WHEN tela.id IS NOT NULL
                            AND tela.estado_ticket NOT IN ('Terminado', 'Listo para Recojo', 'Recogido')
                       THEN true
                       ELSE false
                   END AS bloqueado_por_telas
            FROM tickets_produccion t
            JOIN items_venta i    ON t.item_id  = i.id
            JOIN ventas v         ON i.venta_id = v.id
            LEFT JOIN usuarios u  ON t.trabajador_asignado_id = u.id
            LEFT JOIN tickets_produccion tap
                ON tap.item_id = t.item_id
               AND tap.area_trabajo IN ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS')
            LEFT JOIN usuarios ut ON tap.trabajador_asignado_id = ut.id
            LEFT JOIN tickets_produccion tela
                ON tela.item_id = t.item_id
               AND tela.area_trabajo = 'CORTE_Y_CONTROL_TELAS'
            WHERE t.area_trabajo IN ('ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS')
              AND t.estado_ticket = 'Listo para Recojo'
            ORDER BY t.fecha_fin DESC;
        """)
        estructuras = [{
            "ticket_id": r[0], "area": r[1], "producto": r[2], "codigo_venta": r[3],
            "cliente": r[4], "operario": r[5],
            "fecha_fin": r[6].strftime('%d/%m/%Y %H:%M') if r[6] else 'S/F',
            "foto_url": "|".join([limpiar_foto(p) for p in r[7].split('|')]) if r[7] and "|" in r[7] else limpiar_foto(r[7]),
            "especificaciones": r[8] or '',
            "foto_evidencia": r[9] if r[9] else '', "direccion": r[10] or '',
            "fecha_entrega": r[11].strftime('%d/%m/%Y') if r[11] else 'S/F',
            "item_id": r[12], "tapicero": r[13],
            "bloqueado_por_telas": bool(r[14]),
        } for r in cursor.fetchall()]

        # 2. Compras externas (Logística)
        cursor.execute("""
            SELECT l.id, v.codigo_venta, v.nombre_cliente, l.insumo_nombre, l.sku,
                   COALESCE(p.nombre, l.proveedor_informal, 'Sin proveedor') AS proveedor,
                   COALESCE(p.telefono, '') AS telefono_proveedor,
                   l.url_cotizacion_adjunta, l.notas_proveedor,
                   l.cantidad, l.unidad, l.fecha_entrega_proveedor
            FROM logistica_externa l
            JOIN ventas v ON l.venta_id = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.estado = 'Listo para Recojo'
            ORDER BY l.id DESC;
        """)
        compras_externas = [{
            "logistica_id": r[0], "codigo_venta": r[1], "cliente": r[2], "insumo": r[3], "sku": r[4],
            "proveedor": r[5], "telefono_proveedor": r[6], "url_cotizacion_adjunta": r[7], "notas_proveedor": r[8],
            "cantidad": float(r[9]) if r[9] else None, "unidad": r[10], "fecha_entrega_proveedor": r[11].strftime('%d/%m/%Y') if r[11] else ''
        } for r in cursor.fetchall()]

        return jsonify({"estructuras": estructuras, "compras_externas": compras_externas}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/ticket/<int:id>/confirmar-recojo', methods=['POST'])
def confirmar_recojo_estructura(id):
    """Chofer confirma recojo de estructura: Listo para Recojo → Recogido.
    También intenta desbloquear tapicería si ya están listas las telas."""
    conexion = None
    try:
        conexion = get_db_connection()
        conexion.autocommit = False
        cursor   = conexion.cursor()

        cursor.execute("""
            UPDATE tickets_produccion
            SET estado_ticket = 'Recogido'
            WHERE id = %s AND estado_ticket = 'Listo para Recojo'
            RETURNING item_id, area_trabajo;
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ticket no encontrado o no está en estado "Listo para Recojo"'}), 400

        item_id = row[0]

        # ── Intentar desbloquear tapicería si ya están listas estructuras + telas ──
        cursor.execute("""
            SELECT t.id, t.area_trabajo FROM tickets_produccion t
            WHERE t.item_id = %s AND t.estado_ticket = 'Bloqueado'
              AND t.area_trabajo IN ('TAPICERIA_SOFAS','TAPICERIA_SILLAS','ARMADO_COJINES')
        """, (item_id,))
        tickets_bloqueados = cursor.fetchall()

        desbloqueados = 0
        for tb_id, tb_area in tickets_bloqueados:
            if tb_area in ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS'):
                areas_req = ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS', 'CORTE_Y_CONTROL_TELAS', 'TELAS']
            elif tb_area == 'ARMADO_COJINES':
                areas_req = ['CORTE_Y_CONTROL_TELAS', 'TELAS']
            else:
                continue

            placeholders_req = ','.join(['%s'] * len(areas_req))
            cursor.execute(f"""
                SELECT COUNT(*) FROM tickets_produccion
                WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                AND estado_ticket IN ('Terminado', 'Listo para Recojo', 'Recogido')
            """, (item_id, *areas_req))
            terminados_req = cursor.fetchone()[0]

            cursor.execute(f"""
                SELECT COUNT(*) FROM tickets_produccion
                WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
            """, (item_id, *areas_req))
            total_req = cursor.fetchone()[0]

            if total_req > 0 and terminados_req >= total_req:
                cursor.execute("""
                    UPDATE tickets_produccion
                    SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
                    WHERE id = %s AND estado_ticket = 'Bloqueado'
                """, (tb_id,))
                desbloqueados += cursor.rowcount

        # ── Verificar si la venta queda completamente lista ──
        cursor.execute("SELECT venta_id FROM items_venta WHERE id = %s", (item_id,))
        venta_row = cursor.fetchone()
        venta_actualizada = False
        if venta_row:
            venta_id_check = venta_row[0]
            cursor.execute("""
                SELECT COUNT(*) FROM tickets_produccion t
                JOIN items_venta i ON t.item_id = i.id
                WHERE i.venta_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL'
                AND t.estado_ticket NOT IN ('Terminado', 'Listo para Recojo', 'Recogido')
            """, (venta_id_check,))
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    UPDATE ventas SET estado_general = 'Listo'
                    WHERE id = %s AND COALESCE(estado_general,'') NOT IN ('Entregado','Cancelado')
                """, (venta_id_check,))
                venta_actualizada = cursor.rowcount > 0

        conexion.commit()
        msg = '✅ Recojo confirmado. El ticket pasa a estado Recogido.'
        if desbloqueados > 0:
            msg += f' {desbloqueados} ticket(s) de tapicería desbloqueado(s).'
        if venta_actualizada:
            msg += ' ✅ ¡Producción completa! La venta pasó a estado Listo.'
        return jsonify({'exito': True, 'mensaje': msg, 'desbloqueados': desbloqueados, 'venta_lista': venta_actualizada}), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        if conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/<int:logistica_id>/confirmar-recojo-externo', methods=['POST'])
def confirmar_recojo_externo(logistica_id):
    """Chofer o Tapicero confirma recojo externo: marca logística como Recibido
    y desbloquea las áreas de producción que correspondan."""
    conexion = None
    try:
        conexion = get_db_connection()
        conexion.autocommit = False
        cursor = conexion.cursor()

        # Leer estado anterior para evitar doble ejecución
        cursor.execute("SELECT estado, venta_id FROM logistica_externa WHERE id = %s", (logistica_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ítem de logística no encontrado'}), 404
        estado_anterior, venta_id = row

        if estado_anterior != 'Recibido':
            cursor.execute("""
                UPDATE logistica_externa
                SET estado = 'Recibido'
                WHERE id = %s
            """, (logistica_id,))

        desbloqueados = 0
        if venta_id and estado_anterior != 'Recibido':
            cursor.execute("""
                SELECT t.id, t.area_trabajo, t.item_id
                FROM tickets_produccion t
                JOIN items_venta i ON t.item_id = i.id
                WHERE i.venta_id = %s AND t.estado_ticket = 'Bloqueado'
            """, (venta_id,))
            tickets_bloqueados = cursor.fetchall()

            for tb_id, tb_area, tb_item_id in tickets_bloqueados:
                if tb_area in ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS'):
                    areas_req = ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS', 'CORTE_Y_CONTROL_TELAS', 'TELAS']
                    placeholders_req = ','.join(['%s'] * len(areas_req))
                    cursor.execute(f"""
                        SELECT COUNT(*) FROM tickets_produccion
                        WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                          AND estado_ticket IN ('Terminado', 'Listo para Recojo', 'Recogido')
                    """, (tb_item_id, *areas_req))
                    terminados_req = cursor.fetchone()[0]
                    cursor.execute(f"""
                        SELECT COUNT(*) FROM tickets_produccion
                        WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                    """, (tb_item_id, *areas_req))
                    total_req = cursor.fetchone()[0]
                    if total_req > 0 and terminados_req >= total_req:
                        cursor.execute("UPDATE tickets_produccion SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP WHERE id = %s", (tb_id,))
                        desbloqueados += cursor.rowcount
                else:
                    cursor.execute("UPDATE tickets_produccion SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP WHERE id = %s", (tb_id,))
                    desbloqueados += cursor.rowcount

        conexion.commit()
        return jsonify({
            'exito': True,
            'mensaje': f'✅ Material recogido y recibido. {desbloqueados} ticket(s) desbloqueado(s) para continuar su proceso.',
            'desbloqueados': desbloqueados
        }), 200

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/tickets', methods=['GET'])
def obtener_tickets_taller():
    area_filtro = request.args.get('area')
    operario_id = request.args.get('operario_id')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        query = """
            SELECT t.id, i.producto, t.estado_ticket, t.area_trabajo, t.ticket_details_override,
                   t.trabajador_asignado_id, v.codigo_venta, i.color_tela, t.item_id,
                   i.foto_url, t.foto_evidencia, u.nombre
            FROM tickets_produccion t
            JOIN items_venta i ON t.item_id  = i.id
            JOIN ventas v      ON i.venta_id = v.id
            LEFT JOIN usuarios u ON t.trabajador_asignado_id = u.id
            WHERE t.item_id NOT IN (
                -- Excluir items que SOLO tienen tickets de ESTRUCTURAS_SILLAS/TAPICERIA_SILLAS
                -- y ningún ticket de áreas internas reales (tela, cojines, etc.)
                -- Esto indica que la silla/butaca es comprada externamente (logística externa)
                SELECT DISTINCT t2.item_id
                FROM tickets_produccion t2
                WHERE t2.area_trabajo NOT IN ('DESPACHO_CENTRAL')
                GROUP BY t2.item_id
                HAVING
                    -- Todos sus tickets son solo de estructura/tapicería silla
                    bool_and(t2.area_trabajo IN ('ESTRUCTURAS_SILLAS', 'TAPICERIA_SILLAS'))
                    -- Y existe al menos una fila en logística externa activa para esa venta
                    AND EXISTS (
                        SELECT 1
                        FROM logistica_externa le
                        JOIN items_venta i2 ON le.venta_id = i2.venta_id
                        WHERE i2.id = t2.item_id
                          AND le.tipo_gestion = 'Externo'
                          AND le.estado NOT IN ('Recibido', 'Cancelado')
                    )
            )
        """
        params = []
        if area_filtro:
            areas_buscar = AREA_ALIASES.get(area_filtro, [area_filtro])
            placeholders = ','.join(['%s'] * len(areas_buscar))
            query += f' AND t.area_trabajo IN ({placeholders})'
            params.extend(areas_buscar)
        if operario_id:
            query += ' AND t.trabajador_asignado_id = %s'
            params.append(int(operario_id))
        query += " ORDER BY t.etapa ASC, t.id DESC;"

        cursor.execute(query, params)
        raw_rows = cursor.fetchall()

        item_ids_despacho = {row[8] for row in raw_rows if row[3] == 'DESPACHO_CENTRAL'}
        items_incompletos = set()
        if item_ids_despacho:
            placeholders_items = ','.join(['%s'] * len(item_ids_despacho))
            cursor.execute(f"""
                SELECT DISTINCT item_id FROM tickets_produccion
                WHERE item_id IN ({placeholders_items})
                  AND estado_ticket NOT IN ('Terminado', 'Bloqueado') AND area_trabajo != 'DESPACHO_CENTRAL'
            """, tuple(item_ids_despacho))
            items_incompletos = {r[0] for r in cursor.fetchall()}

        tickets = []
        for row in raw_rows:
            estado = row[2]
            if row[3] == 'DESPACHO_CENTRAL' and row[8] in items_incompletos:
                estado = 'Bloqueado'
            tickets.append({
                "id":              row[0],
                "producto":        f"{row[1]} (Ref: {row[6]})",
                "estado":          estado,
                "area":            row[3],
                "trabajador":      row[5],
                "especificaciones": row[4] if row[4] else (row[7] if row[7] else "Sin notas técnicas"),
                "foto":            "|".join([limpiar_foto(p) for p in row[9].split('|')]) if row[9] and "|" in row[9] else limpiar_foto(row[9]),
                "trabajador_nombre": row[11] if row[11] else 'Sin asignar',
                "item_id":         row[8]
            })
        return jsonify(tickets), 200
    except Exception as e:
        print("Error en tickets taller:", e)
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/tickets_pendientes', methods=['GET'])
def obtener_tickets_pendientes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT t.id, v.codigo_venta, v.nombre_cliente, i.producto,
                   t.area_trabajo, t.estado_ticket, v.fecha_entrega, i.color_tela
            FROM tickets_produccion t
            JOIN items_venta i ON t.item_id  = i.id
            JOIN ventas v      ON i.venta_id = v.id
            WHERE t.trabajador_asignado_id IS NULL AND t.estado_ticket != 'Terminado'
            ORDER BY v.fecha_entrega ASC;
        """)
        res = [{
            "ticket_id": t[0], "codigo": t[1], "cliente": t[2], "producto": t[3],
            "area": t[4], "estado": t[5],
            "entrega": t[6].strftime('%d/%m/%Y') if t[6] else "S/F",
            "especificaciones": t[7]
        } for t in cursor.fetchall()]
        return jsonify(res), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/asignar', methods=['POST'])
def asignar_maestro_ticket():
    data          = request.json
    ticket_id     = data.get('ticket_id')
    trabajador_id = data.get('trabajador_id')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT estado_ticket FROM tickets_produccion WHERE id = %s", (ticket_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ticket no encontrado'}), 404
        nuevo_estado = row[0] if row[0] == 'Bloqueado' else 'En Proceso'
        cursor.execute("""
            UPDATE tickets_produccion
            SET trabajador_asignado_id = %s,
                estado_ticket = %s,
                fecha_inicio = CASE WHEN %s = 'En Proceso' THEN CURRENT_TIMESTAMP ELSE fecha_inicio END
            WHERE id = %s;
        """, (trabajador_id, nuevo_estado, nuevo_estado, ticket_id))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Maestro asignado correctamente', 'estado': nuevo_estado}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/ticket/<int:ticket_id>/derivar', methods=['POST'])
def derivar_ticket_con_foto(ticket_id):
    nueva_area          = request.form.get('nueva_area')
    nuevo_trabajador_id = request.form.get('nuevo_trabajador_id')
    if not nueva_area or not nuevo_trabajador_id:
        return jsonify({'error': 'nueva_area y nuevo_trabajador_id son obligatorios'}), 400
    foto_ruta = None
    if 'foto' in request.files and request.files['foto'].filename != '':
        respuesta_nube = cloudinary.uploader.upload(request.files['foto'], folder="derivaciones")
        foto_ruta = respuesta_nube.get('secure_url')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id FROM tickets_produccion WHERE id = %s", (ticket_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Ticket no encontrado'}), 404
        cursor.execute("""
            UPDATE tickets_produccion
            SET area_trabajo = %s, trabajador_asignado_id = %s,
                foto_evidencia = COALESCE(%s, foto_evidencia),
                estado_ticket = 'Pendiente', fecha_inicio = NULL, fecha_fin = NULL
            WHERE id = %s
        """, (nueva_area, int(nuevo_trabajador_id), foto_ruta, ticket_id))
        conexion.commit()
        return jsonify({'exito': True, 'nueva_area': nueva_area}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/ticket/derivar', methods=['POST'])
def derivar_ticket():
    data            = request.json
    ticket_padre_id = data.get('ticket_padre_id')
    tapicero_id     = data.get('tapicero_id')
    cojinero_id     = data.get('cojinero_id')
    area_tapiceria  = data.get('area_tapiceria', 'TAPICERIA_SOFAS')
    if not ticket_padre_id or not tapicero_id:
        return jsonify({'error': 'ticket_padre_id y tapicero_id son obligatorios'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT item_id FROM tickets_produccion WHERE id = %s", (ticket_padre_id,))
        res = cursor.fetchone()
        if not res:
            return jsonify({'error': 'Ticket no encontrado'}), 404
        item_id = res[0]

        cursor.execute("""
            UPDATE tickets_produccion
            SET trabajador_asignado_id = %s, estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
            WHERE item_id = %s AND area_trabajo = %s AND estado_ticket IN ('Bloqueado', 'Pendiente')
        """, (tapicero_id, item_id, area_tapiceria))

        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO tickets_produccion (item_id, area_trabajo, trabajador_asignado_id, estado_ticket, etapa)
                SELECT %s, %s, %s, 'En Proceso', 2
                WHERE NOT EXISTS (
                    SELECT 1 FROM tickets_produccion
                    WHERE item_id = %s AND area_trabajo = %s AND estado_ticket != 'Terminado'
                )
            """, (item_id, area_tapiceria, tapicero_id, item_id, area_tapiceria))

        if cojinero_id:
            cursor.execute("""
                INSERT INTO tickets_produccion (item_id, area_trabajo, trabajador_asignado_id, estado_ticket, etapa)
                SELECT %s, 'ARMADO_COJINES', %s, 'En Proceso', 2
                WHERE NOT EXISTS (
                    SELECT 1 FROM tickets_produccion
                    WHERE item_id = %s AND area_trabajo = 'ARMADO_COJINES' AND estado_ticket != 'Terminado'
                )
            """, (item_id, cojinero_id, item_id))

        conexion.commit()
        return jsonify({'exito': True}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/taller/stats', methods=['GET'])
def obtener_taller_stats():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM tickets_produccion WHERE estado_ticket = 'Pendiente'")
        pendientes = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM tickets_produccion WHERE estado_ticket = 'En Proceso'")
        en_proceso = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM tickets_produccion WHERE estado_ticket IN ('Pendiente', 'En Proceso', 'Bloqueado')")
        activos = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM ventas WHERE estado_general = 'Listo'")
        ventas_listas = cursor.fetchone()[0]
        
        return jsonify({
            'pendientes': pendientes,
            'en_proceso': en_proceso,
            'activos': activos,
            'ventas_listas': ventas_listas
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/taller/ordenes', methods=['GET'])
def obtener_ordenes_produccion():
    estado = request.args.get('estado', 'activas')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        
        query = """
            SELECT v.id, v.codigo_venta, v.nombre_cliente, v.fecha_entrega, v.vendedor_nombre, v.sede, v.estado_general
            FROM ventas v
            WHERE v.estado_general NOT IN ('Entregado', 'Cancelado')
            ORDER BY v.fecha_entrega ASC
        """
        cursor.execute(query)
        ventas = cursor.fetchall()
        
        resultado = []
        for v in ventas:
            venta_id = v[0]
            
            cursor.execute("SELECT id, producto, foto_url FROM items_venta WHERE venta_id = %s", (venta_id,))
            items = cursor.fetchall()
            
            items_list = []
            tickets_term = 0
            tickets_total = 0
            
            for item in items:
                item_id = item[0]
                cursor.execute("""
                    SELECT id, area_trabajo, estado_ticket, 
                           COALESCE((SELECT nombre FROM usuarios WHERE id = trabajador_asignado_id), 'Sin asignar') 
                    FROM tickets_produccion 
                    WHERE item_id = %s
                """, (item_id,))
                tickets = cursor.fetchall()
                
                tickets_list = []
                for t in tickets:
                    tickets_total += 1
                    if t[2] == 'Terminado':
                        tickets_term += 1
                    tickets_list.append({
                        'id': t[0],
                        'area': t[1],
                        'estado': t[2],
                        'trabajador': t[3]
                    })
                
                items_list.append({
                    'id': item_id,
                    'producto': item[1],
                    'foto': limpiar_foto(item[2].split('|')[0] if item[2] else ''),
                    'tickets': tickets_list
                })
                
            progreso = round((tickets_term / tickets_total * 100)) if tickets_total > 0 else 0
            resultado.append({'id': venta_id, 'codigo': v[1], 'cliente': v[2], 'fecha_entrega': v[3].strftime('%d/%m/%Y') if v[3] else 'S/F', 'vendedor': v[4], 'sede': v[5], 'estado': v[6], 'progreso': progreso, 'tickets_term': tickets_term, 'tickets_total': tickets_total, 'items': items_list})
            
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

# ==========================================
# 9. INVENTARIO DE MATERIALES
# ==========================================

@produccion_bp.route('/api/taller/fichatecnica-skus', methods=['GET'])
def obtener_fotos_skus():
    skus_param = request.args.get('skus', '')
    if not skus_param:
        return jsonify([]), 200
    skus = [s.strip().upper() for s in skus_param.split(',') if s.strip()]
    if not skus:
        return jsonify([]), 200
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        placeholders = ','.join(['%s'] * len(skus))
        cursor.execute(f"""
            SELECT sku, CONCAT(coleccion, ' - ', color) AS nombre, foto_url, 'tela' AS tipo
            FROM maestro_telas WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados = [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, nombre_diseno AS nombre, foto_url, 'cojin' AS tipo
            FROM maestro_disenos_cojin WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, CONCAT(modelo, ' - ', color) AS nombre, foto_url, 'base' AS tipo
            FROM maestro_bases WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, CONCAT(modelo, ' - ', color) AS nombre, foto_url, 'base-comedor' AS tipo
            FROM maestro_bases_comedor WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, CONCAT(nombre_modelo, ' - ', color_veta) AS nombre, foto_url, 'tablero' AS tipo
            FROM maestro_tableros WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, CONCAT(modelo, ' - ', color_estructura) AS nombre, foto_url, 'silla' AS tipo
            FROM maestro_sillas WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        cursor.execute(f"""
            SELECT sku, CONCAT(modelo, ' - ', color_estructura) AS nombre, foto_url, 'butaca' AS tipo
            FROM maestro_butacas WHERE UPPER(sku) IN ({placeholders})
        """, skus)
        resultados += [{'sku': r[0], 'nombre': r[1], 'foto_url': limpiar_foto(r[2]), 'tipo': r[3]} for r in cursor.fetchall()]
        
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/taller/ticket/<int:ticket_id>/nota', methods=['POST'])
def agregar_nota_ticket(ticket_id):
    data = request.json
    nota = data.get('nota')
    usuario = data.get('usuario_nombre', 'Usuario')
    
    if not nota:
        return jsonify({'error': 'La nota es obligatoria'}), 400
        
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        nota_formateada = f"\n\n[NOTA {datetime.now().strftime('%d/%m %H:%M')} - {usuario}]: {nota}"
        cursor.execute("UPDATE tickets_produccion SET ticket_details_override = COALESCE(ticket_details_override, '') || %s WHERE id = %s", (nota_formateada, ticket_id))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Nota agregada correctamente'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/taller/inventario', methods=['GET'])
def obtener_inventario():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT id, nombre_modelo AS nombre, COALESCE(estado,'Disponible'), 'TABLERO' AS cat, origen_produccion FROM maestro_tableros
            UNION ALL SELECT id, color, COALESCE(estado,'Disponible'), 'TELA', origen_produccion FROM maestro_telas
            UNION ALL SELECT id, nombre_diseno, COALESCE(estado,'Disponible'), 'COJIN', origen_produccion FROM maestro_disenos_cojin
            UNION ALL SELECT id, modelo, COALESCE(estado,'Disponible'), 'BASE', origen_produccion FROM maestro_bases
            UNION ALL SELECT id, modelo, COALESCE(estado,'Disponible'), 'BASE-COMEDOR', origen_produccion FROM maestro_bases_comedor
            UNION ALL SELECT id, modelo, COALESCE(estado,'Disponible'), 'SILLA', origen_produccion FROM maestro_sillas
            UNION ALL SELECT id, modelo, COALESCE(estado,'Disponible'), 'BUTACA', origen_produccion FROM maestro_butacas
            ORDER BY cat, nombre;
        """)
        insumos = [
            {"id": r[0], "nombre": r[1], "estado": r[2], "categoria": r[3]}
            for r in cursor.fetchall()
        ]
        return jsonify(insumos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/inventario/actualizar', methods=['POST'])
def actualizar_estado_inventario():
    data         = request.json
    item_id      = data.get('id')
    categoria    = data.get('categoria')
    nuevo_estado = data.get('estado')
    tablas_permitidas = {
        'TELA': 'maestro_telas', 'COJIN': 'maestro_disenos_cojin',
        'BASE': 'maestro_bases', 'BASE-COMEDOR': 'maestro_bases_comedor',
        'TABLERO': 'maestro_tableros', 'SILLA': 'maestro_sillas', 'BUTACA': 'maestro_butacas',
    }
    tabla = tablas_permitidas.get(categoria)
    if not tabla:
        return jsonify({'error': 'Categoría no válida'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute(f"UPDATE {tabla} SET estado = %s WHERE id = %s;", (nuevo_estado, item_id))
        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# 10. LOGÍSTICA EXTERNA
# ==========================================

@produccion_bp.route('/api/logistica', methods=['GET'])
def obtener_logistica():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT l.id, v.codigo_venta, l.insumo_nombre, l.sku,
                   COALESCE(p.nombre, 'Sin asignar') AS proveedor,
                   COALESCE(p.correo, '')            AS correo_proveedor,
                   l.precio_cotizado, l.fecha_entrega_proveedor, l.estado,
                   l.token_usado, l.notas_proveedor, l.url_comprobante_pago,
                   COALESCE(l.cantidad, 1)           AS cantidad,
                   COALESCE(l.unidad, '')            AS unidad,
                   COALESCE(l.tipo_gestion, 'Externo') AS tipo_gestion,
                   l.proveedor_id,
                   COALESCE(l.proveedor_informal, '') AS proveedor_informal,
                   l.url_cotizacion_adjunta,
                   -- Foto del insumo desde los maestros por SKU
                   COALESCE(
                       (SELECT foto_url FROM maestro_telas        WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_tableros      WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_bases         WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_bases_comedor WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_sillas        WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_butacas       WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_disenos_cojin WHERE sku = l.sku LIMIT 1),
                       -- FALLBACK: foto del primer ítem de la venta que generó este requerimiento
                       (SELECT i2.foto_url FROM items_venta i2 WHERE i2.venta_id = l.venta_id LIMIT 1)
                   ) AS foto_url,
                   -- Detalles descriptivos del insumo según su tipo
                   COALESCE(
                       (SELECT CONCAT(coleccion, ' · ', color) FROM maestro_telas WHERE sku = l.sku LIMIT 1),
                       (SELECT CONCAT(nombre_modelo, ' · ', color_veta, CASE WHEN acabado != '' THEN CONCAT(' · ', acabado) ELSE '' END) FROM maestro_tableros WHERE sku = l.sku LIMIT 1),
                       (SELECT CONCAT(modelo, ' · ', color) FROM maestro_bases WHERE sku = l.sku LIMIT 1),
                       (SELECT CONCAT(modelo, ' · ', color) FROM maestro_bases_comedor WHERE sku = l.sku LIMIT 1),
                       (SELECT CONCAT(modelo, ' · ', color_estructura) FROM maestro_sillas WHERE sku = l.sku LIMIT 1),
                       (SELECT CONCAT(modelo, ' · ', color_estructura) FROM maestro_butacas WHERE sku = l.sku LIMIT 1),
                       (SELECT nombre_diseno FROM maestro_disenos_cojin WHERE sku = l.sku LIMIT 1)
                   ) AS detalle_insumo,
                   COALESCE(l.categoria_insumo, 'OTRO')  AS categoria_insumo,
                   l.estado_distribucion
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            ORDER BY l.estado ASC, l.id DESC;
        """)
        items = [{
            "id": r[0], "codigo_venta": r[1], "insumo": r[2], "sku": r[3],
            "proveedor": r[4], "correo_proveedor": r[5],
            "precio_cotizado": float(r[6]) if r[6] else None,
            "fecha_entrega_proveedor": r[7].strftime('%d/%m/%Y') if r[7] else None,
            "estado": r[8],
            "token_usado": r[9], "notas_proveedor": r[10],
            "url_comprobante_pago":    r[11],
            "cantidad":                float(r[12]) if r[12] else 1,
            "unidad":                  r[13],
            "tipo_gestion":            r[14],
            "proveedor_id":            r[15],
            "proveedor_informal":      r[16] or "",
            "foto_url":                limpiar_foto(r[17]) if r[17] else "",
            "detalle_insumo":          r[18] or "",
            "url_cotizacion_adjunta":  r[19] if len(r) > 19 else None,
            "categoria_insumo":        r[20] if len(r) > 20 else 'OTRO',
            "estado_distribucion":     r[21] if len(r) > 21 else None,
        } for r in cursor.fetchall()]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/actualizar', methods=['POST'])
def actualizar_logistica():
    data                    = request.json
    logistica_id            = data.get('id')
    proveedor_id            = data.get('proveedor_id')
    precio_cotizado         = data.get('precio_cotizado')
    fecha_entrega_proveedor = data.get('fecha_entrega_proveedor')
    estado                  = data.get('estado')
    tipo_gestion              = data.get('tipo_gestion')
    cantidad                  = data.get('cantidad')
    unidad                    = data.get('unidad')
    proveedor_informal        = data.get('proveedor_informal')
    notas_proveedor           = data.get('notas_proveedor')           # ← respuesta WA
    url_cotizacion_adjunta    = data.get('url_cotizacion_adjunta')    # ← foto/PDF del proveedor
    if not logistica_id:
        return jsonify({'error': 'id es obligatorio'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Leer estado anterior ANTES del UPDATE para evitar doble desbloqueo
        # si el frontend llama dos veces con estado='Recibido' (bug conocido A1)
        cursor.execute("SELECT estado FROM logistica_externa WHERE id = %s", (logistica_id,))
        row_prev = cursor.fetchone()
        estado_anterior = row_prev[0] if row_prev else None

        cursor.execute("""
            UPDATE logistica_externa
            SET proveedor_id             = COALESCE(%s, proveedor_id),
                precio_cotizado          = COALESCE(%s, precio_cotizado),
                fecha_entrega_proveedor  = COALESCE(%s::date, fecha_entrega_proveedor),
                estado                   = COALESCE(%s, estado),
                tipo_gestion             = COALESCE(%s, tipo_gestion),
                cantidad                 = COALESCE(%s, cantidad),
                unidad                   = COALESCE(%s, unidad),
                proveedor_informal       = COALESCE(%s, proveedor_informal),
                notas_proveedor          = COALESCE(%s, notas_proveedor),
                url_cotizacion_adjunta   = COALESCE(%s, url_cotizacion_adjunta)
            WHERE id = %s;
        """, (proveedor_id, precio_cotizado, fecha_entrega_proveedor,
              estado, tipo_gestion, cantidad, unidad, proveedor_informal,
              notas_proveedor, url_cotizacion_adjunta, logistica_id))

        # Solo desbloquear si la transición ES NUEVA: estado anterior != 'Recibido'
        # Esto evita el conflicto con el trigger de "Listo para recojo" (bug A1)
        if estado == 'Recibido' and estado_anterior != 'Recibido':
            cursor.execute("""
                SELECT l.venta_id FROM logistica_externa l WHERE l.id = %s
            """, (logistica_id,))
            venta_row = cursor.fetchone()
            if venta_row:
                venta_id_check = venta_row[0]
                # Obtener tickets bloqueados de esta venta
                cursor.execute("""
                    SELECT t.id, t.area_trabajo, t.item_id
                    FROM tickets_produccion t
                    JOIN items_venta i ON t.item_id = i.id
                    WHERE i.venta_id = %s AND t.estado_ticket = 'Bloqueado'
                """, (venta_id_check,))
                tickets_bloqueados = cursor.fetchall()

                for tb_id, tb_area, tb_item_id in tickets_bloqueados:
                    if tb_area in ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS'):
                        # Requiere estructuras + telas completas antes de desbloquear
                        areas_req = ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS',
                                     'CORTE_Y_CONTROL_TELAS', 'TELAS']
                        placeholders_req = ','.join(['%s'] * len(areas_req))
                        cursor.execute(f"""
                            SELECT COUNT(*) FROM tickets_produccion
                            WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                              AND estado_ticket IN ('Terminado', 'Listo para Recojo', 'Recogido')
                        """, (tb_item_id, *areas_req))
                        terminados_req = cursor.fetchone()[0]
                        cursor.execute(f"""
                            SELECT COUNT(*) FROM tickets_produccion
                            WHERE item_id = %s AND area_trabajo IN ({placeholders_req})
                        """, (tb_item_id, *areas_req))
                        total_req = cursor.fetchone()[0]
                        if total_req > 0 and terminados_req >= total_req:
                            cursor.execute("""
                                UPDATE tickets_produccion
                                SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
                                WHERE id = %s AND estado_ticket = 'Bloqueado'
                            """, (tb_id,))
                    else:
                        # Para áreas no-tapicería (cojines, despacho, etc.), desbloquear directamente
                        cursor.execute("""
                            UPDATE tickets_produccion
                            SET estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
                            WHERE id = %s AND estado_ticket = 'Bloqueado'
                        """, (tb_id,))

        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/<int:logistica_id>/enviar-al-taller', methods=['POST'])
def enviar_al_taller(logistica_id):
    """
    Flujo 'Informal': el jefe de taller consiguió el material por su cuenta
    y quiere notificar al área de despacho que ya puede armar el pedido.

    Marca la fila de logistica_externa como 'Recibido' (tipo_gestion = 'Informal')
    y desbloquea los tickets_produccion relacionados, igual que cuando llega
    un material externo formal.
    """
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Verificar que existe
        cursor.execute(
            "SELECT id, venta_id, insumo_nombre FROM logistica_externa WHERE id = %s;",
            (logistica_id,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ítem de logística no encontrado'}), 404

        venta_id      = row[1]
        insumo_nombre = row[2]

        # Marcar como recibido/informal
        cursor.execute("""
            UPDATE logistica_externa
            SET estado       = 'Recibido',
                tipo_gestion = 'Informal'
            WHERE id = %s;
        """, (logistica_id,))

        # Desbloquear tickets relacionados al pedido
        desbloqueados = 0
        if venta_id:
            cursor.execute("""
                UPDATE tickets_produccion
                SET estado_ticket = 'En Proceso',
                    fecha_inicio  = CURRENT_TIMESTAMP
                WHERE estado_ticket = 'Bloqueado'
                  AND item_id IN (
                      SELECT id FROM items_venta WHERE venta_id = %s
                  )
                RETURNING id;
            """, (venta_id,))
            desbloqueados = len(cursor.fetchall())

        conexion.commit()
        return jsonify({
            'exito':        True,
            'mensaje':      f'"{insumo_nombre}" marcado como recibido. {desbloqueados} ticket(s) desbloqueado(s).',
            'desbloqueados': desbloqueados,
        }), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# 11. RECETAS DE MUEBLES (BOM)
# ==========================================

@produccion_bp.route('/api/recetas/<int:producto_id>', methods=['GET'])
def obtener_receta(producto_id):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT r.id, i.nombre_insumo, r.insumo_id, r.cantidad_necesaria, i.cantidad_actual
            FROM recetas_muebles r
            JOIN inventario_insumos i ON r.insumo_id = i.id
            WHERE r.producto_id = %s ORDER BY i.nombre_insumo;
        """, (producto_id,))
        receta = [{
            "id": r[0], "nombre_insumo": r[1], "insumo_id": r[2],
            "cantidad_necesaria": r[3], "stock_actual": r[4]
        } for r in cursor.fetchall()]
        return jsonify(receta), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/recetas/nueva', methods=['POST'])
def agregar_ingrediente_receta():
    data               = request.json
    producto_id        = data.get('producto_id')
    insumo_id          = data.get('insumo_id')
    cantidad_necesaria = data.get('cantidad_necesaria', 1)
    if not producto_id or not insumo_id:
        return jsonify({'error': 'producto_id e insumo_id son obligatorios'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO recetas_muebles (producto_id, insumo_id, cantidad_necesaria)
            VALUES (%s,%s,%s) RETURNING id;
        """, (producto_id, insumo_id, cantidad_necesaria))
        nuevo_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': nuevo_id}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# 12. SUGERENCIAS DE INSUMOS
# ==========================================

@produccion_bp.route('/api/sugerencias', methods=['POST'])
def guardar_sugerencia():
    try:
        nombre     = request.form.get('nombre')
        tipo       = request.form.get('tipo')
        usuario_id = request.form.get('usuario_id')
        datos_json = request.form.get('datos_json')
        if not nombre or not tipo:
            return jsonify({'error': 'El nombre y tipo de insumo son obligatorios'}), 400
        foto_ruta = "imagenes/sin_foto.jpg"
        if 'foto' in request.files and request.files['foto'].filename != '':
            respuesta_nube = cloudinary.uploader.upload(request.files['foto'], folder="sugerencias")
            foto_ruta = respuesta_nube.get('secure_url')
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO sugerencias_insumos (nombre, tipo, foto_ref, usuario_id, datos_json, estado)
            VALUES (%s, %s, %s, %s, %s, 'Pendiente') RETURNING id;
        """, (nombre, tipo, foto_ruta, usuario_id, datos_json))
        sugerencia_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': sugerencia_id, 'mensaje': 'Sugerencia enviada al Gestor de Aprobación'}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/sugerencias', methods=['GET'])
def obtener_sugerencias():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT s.id, s.nombre, s.tipo, s.foto_ref,
                   COALESCE(u.nombre, 'Vendedor') AS vendedor, s.datos_json, s.estado
            FROM sugerencias_insumos s
            LEFT JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.estado = 'Pendiente'
            ORDER BY s.fecha_registro DESC;
        """)
        resultado = [{
            "id": r[0], "nombre": r[1], "tipo": r[2], "foto_url": r[3],
            "vendedor": r[4], "datos_json": r[5], "estado": r[6]
        } for r in cursor.fetchall()]
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/sugerencias/aprobar', methods=['POST'])
def aprobar_sugerencia_insumo():
    data          = request.json
    sugerencia_id = data.get('sugerencia_id')
    origen        = data.get('origen', 'Value')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT tipo, foto_ref, datos_json FROM sugerencias_insumos WHERE id = %s;", (sugerencia_id,))
        sug = cursor.fetchone()
        if not sug:
            return jsonify({'error': 'Sugerencia no encontrada'}), 404
        tipo_material, foto_ruta, datos_raw = sug
        datos = json.loads(datos_raw) if datos_raw else {}
        nuevo_sku = ""
        inserts = {
            'tela':        ("maestro_telas", "TEL", "(sku, proveedor, coleccion, color, foto_url, origen_produccion, estado, proveedor_id) VALUES (%s,%s,%s,%s,%s,%s,'Disponible',%s)", lambda d: (datos.get('proveedor'), datos.get('coleccion'), datos.get('color'), foto_ruta, origen, datos.get('proveedor_id'))),
            'cojin':       ("maestro_disenos_cojin", "COJ", "(sku, nombre_diseno, tipo_tela, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('nombre_diseno'), datos.get('tipo_tela'), foto_ruta, origen)),
            'base':        ("maestro_bases", "BAS", "(sku, tipo, material, modelo, color, medida_altura, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('tipo'), datos.get('material'), datos.get('modelo'), datos.get('color'), datos.get('medida_altura'), foto_ruta, origen)),
            'tablero':     ("maestro_tableros", "TAB", "(sku, material_base, nombre_modelo, color_veta, acabado, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('material_base'), datos.get('nombre_modelo'), datos.get('color_veta'), datos.get('acabado'), foto_ruta, origen)),
            'base-comedor':("maestro_bases_comedor", "BAC", "(sku, material, modelo, color, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('material'), datos.get('modelo'), datos.get('color'), foto_ruta, origen)),
            'silla':       ("maestro_sillas", "SIL", "(sku, material, modelo, color_estructura, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('material'), datos.get('modelo'), datos.get('color_estructura'), foto_ruta, origen)),
            'butaca':      ("maestro_butacas", "BUT", "(sku, material, modelo, color_estructura, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('material'), datos.get('modelo'), datos.get('color_estructura'), foto_ruta, origen)),
        }
        if tipo_material not in inserts:
            return jsonify({'error': 'Tipo de material no reconocido'}), 400
        tabla, prefijo, cols_sql, params_fn = inserts[tipo_material]
        cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM {tabla}")
        nuevo_sku = f"{prefijo}-{str(cursor.fetchone()[0]+1).zfill(4)}"
        params = (nuevo_sku,) + params_fn(datos)
        cursor.execute(f"INSERT INTO {tabla} {cols_sql}", params)
        cursor.execute("UPDATE sugerencias_insumos SET estado = 'Aprobado' WHERE id = %s;", (sugerencia_id,))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': f'Insumo oficializado con éxito. Nuevo SKU: {nuevo_sku}'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/sugerencias/rechazar', methods=['POST'])
def rechazar_sugerencia_insumo():
    data          = request.json
    sugerencia_id = data.get('sugerencia_id')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("UPDATE sugerencias_insumos SET estado = 'Rechazado' WHERE id = %s;", (sugerencia_id,))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Sugerencia de insumo rechazada.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


# ==========================================
# 13. DESPACHO — ASIGNAR CHOFER Y PROGRESO
# ==========================================

@produccion_bp.route('/api/despacho/asignar-chofer', methods=['POST'])
def asignar_chofer_despacho():
    data      = request.json
    ticket_id = data.get('ticket_id')
    chofer_id = data.get('chofer_id')
    if not ticket_id or not chofer_id:
        return jsonify({'error': 'ticket_id y chofer_id son obligatorios'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT t.id, t.item_id, t.estado_ticket FROM tickets_produccion t
            WHERE t.id = %s AND t.area_trabajo = 'DESPACHO_CENTRAL'
        """, (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            return jsonify({'error': 'Ticket de despacho no encontrado'}), 404
        item_id = ticket[1]
        cursor.execute("""
            SELECT COUNT(*) FROM tickets_produccion
            WHERE item_id = %s AND area_trabajo != 'DESPACHO_CENTRAL' AND estado_ticket != 'Terminado'
        """, (item_id,))
        pendientes = cursor.fetchone()[0]
        if pendientes > 0:
            return jsonify({'error': f'Aún hay {pendientes} área(s) sin terminar. No se puede despachar.'}), 409
        cursor.execute("""
            UPDATE tickets_produccion
            SET trabajador_asignado_id = %s, estado_ticket = 'En Proceso', fecha_inicio = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (chofer_id, ticket_id))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Chofer asignado. El despacho está activo.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/pendientes-por-proveedor', methods=['GET'])
def logistica_pendientes_por_proveedor():
    """Agrupa filas pendientes de logística externa por proveedor."""
    conexion = None
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # Detectar qué tablas maestro_* existen realmente en la BD
        cursor.execute("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename LIKE 'maestro_%'
              AND tablename IN (
                  'maestro_telas','maestro_bases','maestro_tableros',
                  'maestro_bases_comedor','maestro_sillas',
                  'maestro_butacas','maestro_disenos_cojin'
              );
        """)
        tablas_existentes = [r[0] for r in cursor.fetchall()]

        if tablas_existentes:
            subqueries = " ,\n                    ".join(
                f"(SELECT foto_url FROM {t} WHERE sku = l.sku LIMIT 1)"
                for t in tablas_existentes
            )
            foto_expr = f"COALESCE(\n                    {subqueries}\n                )"
        else:
            foto_expr = "NULL"

        # Detectar si las columnas cantidad/unidad ya existen (migración puede no haberse corrido)
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'logistica_externa'
              AND column_name IN ('cantidad', 'unidad');
        """)
        cols_existentes = {r[0] for r in cursor.fetchall()}
        cantidad_expr = "l.cantidad" if 'cantidad' in cols_existentes else "NULL"
        unidad_expr   = "l.unidad"   if 'unidad'   in cols_existentes else "NULL"

        cursor.execute(f"""
            SELECT
                p.id AS proveedor_id,
                p.nombre AS proveedor_nombre,
                p.telefono,
                l.id, l.insumo_nombre, l.sku,
                {cantidad_expr} AS cantidad,
                {unidad_expr}   AS unidad,
                {foto_expr}     AS foto_url,
                v.codigo_venta
            FROM logistica_externa l
            JOIN ventas v ON l.venta_id = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.estado IN ('Pendiente', 'Por Pedir')
              AND l.proveedor_id IS NOT NULL
            ORDER BY p.id, l.id
        """)
        rows = cursor.fetchall()

        grupos = {}
        for r in rows:
            pid = r[0]
            if pid not in grupos:
                grupos[pid] = {
                    'proveedor_id':     pid,
                    'proveedor_nombre': r[1],
                    'telefono':         r[2],
                    'items': []
                }
            grupos[pid]['items'].append({
                'logistica_id':  r[3],
                'insumo_nombre': r[4],
                'sku':           r[5] or '',
                'cantidad':      float(r[6]) if r[6] else None,
                'unidad':        r[7] or '',
                'foto_url':      r[8] or '',
                'codigo_venta':  r[9],
            })
        return jsonify(list(grupos.values())), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/crear-lote-cotizacion', methods=['POST'])
def crear_lote_cotizacion():
    try:
        datos = request.get_json()
        proveedor_id = datos['proveedor_id']
        items = datos['items']

        conexion = get_db_connection()
        cursor = conexion.cursor()

        cursor.execute("SELECT nombre, telefono FROM proveedores WHERE id = %s", (proveedor_id,))
        prov = cursor.fetchone()
        if not prov:
            return jsonify({'error': 'Proveedor no encontrado'}), 404
        nombre_proveedor, telefono = prov
        if not telefono:
            return jsonify({'error': 'El proveedor no tiene teléfono/WhatsApp registrado'}), 400

        from database import BACKEND_URL
        token = uuid.uuid4().hex

        cursor.execute("""
            INSERT INTO cotizaciones_lote (token, proveedor_id, estado, fecha_envio)
            VALUES (%s, %s, 'Pendiente', NOW()) RETURNING id
        """, (token, proveedor_id))
        lote_id = cursor.fetchone()[0]

        for item in items:
            cursor.execute("""
                INSERT INTO cotizacion_lote_items
                    (lote_id, logistica_externa_id, sku, insumo_nombre, cantidad, unidad, foto_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (lote_id, item.get('logistica_id'), item.get('sku'), item.get('insumo_nombre'),
                  item.get('cantidad'), item.get('unidad'), item.get('foto_url')))

            if item.get('logistica_id'):
                cursor.execute("""
                    UPDATE logistica_externa
                    SET estado = 'Cotizacion Enviada', fecha_envio_cotizacion = NOW()
                    WHERE id = %s
                """, (item['logistica_id'],))

        conexion.commit()

        link = f"{BACKEND_URL}/cotizar.html?lote={token}"
        return jsonify({
            'exito': True, 'token': token, 'link': link,
            'telefono': telefono, 'nombre_proveedor': nombre_proveedor or 'Proveedor',
            'items': items
        }), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/cotizar-lote/<token>', methods=['GET', 'POST'])
def cotizar_lote(token):
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        cursor.execute("SELECT id, proveedor_id, token_usado, estado FROM cotizaciones_lote WHERE token = %s", (token,))
        lote = cursor.fetchone()
        if not lote:
            return jsonify({'error': 'Token inválido'}), 404
        lote_id, proveedor_id, token_usado, estado = lote

        if request.method == 'GET':
            if token_usado: return jsonify({'ya_respondido': True}), 200
            cursor.execute("SELECT nombre FROM proveedores WHERE id = %s", (proveedor_id,))
            prov = cursor.fetchone()
            cursor.execute("SELECT id, sku, insumo_nombre, cantidad, unidad, foto_url, logistica_externa_id FROM cotizacion_lote_items WHERE lote_id = %s", (lote_id,))
            items = [{'id': r[0], 'sku': r[1], 'insumo_nombre': r[2], 'cantidad': float(r[3]) if r[3] else None, 'unidad': r[4], 'foto_url': r[5] or ''} for r in cursor.fetchall()]
            return jsonify({'proveedor': prov[0] if prov else '', 'items': items}), 200

        body = request.get_json()
        for resp in body.get('respuestas', []):
            cursor.execute("UPDATE cotizacion_lote_items SET precio_cotizado = %s, fecha_entrega_proveedor = %s, notas_item = %s, respondido = TRUE WHERE id = %s AND lote_id = %s", (resp['precio'], resp['fecha_entrega'], resp.get('notas'), resp['item_id'], lote_id))
            cursor.execute("UPDATE logistica_externa SET precio_cotizado = %s, fecha_entrega_proveedor = %s, estado = 'Cotizacion Recibida', fecha_respuesta_proveedor = NOW() WHERE id = (SELECT logistica_externa_id FROM cotizacion_lote_items WHERE id = %s)", (resp['precio'], resp['fecha_entrega'], resp['item_id']))
        cursor.execute("UPDATE cotizaciones_lote SET token_usado = TRUE, estado = 'Respondido', fecha_respuesta = NOW() WHERE id = %s", (lote_id,))
        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion: cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/despacho/progreso/<int:item_id>', methods=['GET'])
def progreso_despacho(item_id):
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT area_trabajo, estado_ticket, trabajador_asignado_id,
                   COALESCE(u.nombre, 'Sin asignar') AS trabajador_nombre
            FROM tickets_produccion t
            LEFT JOIN usuarios u ON t.trabajador_asignado_id = u.id
            WHERE t.item_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL'
            ORDER BY t.etapa ASC, t.id ASC
        """, (item_id,))
        partes = [{"area": r[0], "estado": r[1], "trabajador": r[3]} for r in cursor.fetchall()]
        total      = len(partes)
        terminados = sum(1 for p in partes if p['estado'] == 'Terminado')
        return jsonify({"partes": partes, "total": total, "terminados": terminados, "listo": total > 0 and terminados == total}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/despacho/ficha-chofer/<int:item_id>', methods=['GET'])
def ficha_chofer(item_id):
    """
    Devuelve todo lo que el chofer necesita ver antes de hacer la entrega:
    - Datos del cliente (nombre, dirección, teléfono)
    - Financiero (total, adelanto, saldo)
    - Producto y especificaciones
    - Fotos de evidencia de TODAS las áreas de producción terminadas
    """
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Datos de la venta y del ítem
        cursor.execute("""
            SELECT
                i.producto,
                COALESCE(
                    (SELECT ticket_details_override FROM tickets_produccion
                     WHERE item_id = i.id AND area_trabajo = 'DESPACHO_CENTRAL' LIMIT 1),
                    i.color_tela, i.detalles, ''
                ) AS especificaciones,
                i.foto_url,
                v.nombre_cliente,
                COALESCE(v.celular_cliente, '') AS telefono,
                COALESCE(v.direccion_cliente, '') AS direccion,
                COALESCE(v.monto_total, 0)    AS total,
                COALESCE(v.monto_adelanto, 0) AS adelanto,
                v.codigo_venta,
                v.sede,
                TO_CHAR(v.fecha_entrega, 'DD/MM/YYYY') AS fecha_entrega
            FROM items_venta i
            JOIN ventas v ON i.venta_id = v.id
            WHERE i.id = %s;
        """, (item_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ítem no encontrado'}), 404

        total    = float(row[6])
        adelanto = float(row[7])

        # Fotos de evidencia de todas las áreas terminadas (excepto DESPACHO_CENTRAL)
        cursor.execute("""
            SELECT
                t.area_trabajo,
                t.foto_evidencia,
                COALESCE(u.nombre, 'Sin asignar') AS operario,
                TO_CHAR(t.fecha_fin, 'DD/MM HH24:MI') AS fecha_fin
            FROM tickets_produccion t
            LEFT JOIN usuarios u ON t.trabajador_asignado_id = u.id
            WHERE t.item_id = %s
              AND t.area_trabajo != 'DESPACHO_CENTRAL'
              AND t.estado_ticket = 'Terminado'
              AND t.foto_evidencia IS NOT NULL
            ORDER BY t.fecha_fin ASC;
        """, (item_id,))

        NOMBRES_AREA = {
            'CORTE_Y_CONTROL_TELAS':    'Corte de Telas',
            'TAPICERIA_SOFAS':          'Tapicería Sofás',
            'TAPICERIA_SILLAS':         'Tapicería Sillas',
            'ESTRUCTURAS_MUEBLES':      'Carpintería (Sofás)',
            'ESTRUCTURAS_SILLAS':       'Carpintería (Sillas)',
            'ARMADO_COJINES':           'Cojines',
            'PREPARACION_PATAS_ZOCALO': 'Patas y Zócalo',
            'TABLEROS_Y_PIEDRAS':       'Tableros',
        }

        evidencias = []
        for r in cursor.fetchall():
            evidencias.append({
                'area':       NOMBRES_AREA.get(r[0], r[0].replace('_', ' ').title()),
                'foto':       r[1],
                'operario':   r[2],
                'fecha_fin':  r[3] or '',
            })

        return jsonify({
            'producto':        row[0],
            'especificaciones': row[1],
            'foto_producto':   limpiar_foto(row[2]),
            'cliente':         row[3],
            'telefono':        row[4],
            'direccion':       row[5],
            'total':           total,
            'adelanto':        adelanto,
            'saldo':           max(0, total - adelanto),
            'codigo_venta':    row[8],
            'sede':            row[9] or '',
            'fecha_entrega':   row[10] or 'Por coordinar',
            'evidencias':      evidencias,
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

# ==========================================
# DESPACHO — HISTORIAL DE ENTREGADOS
# ==========================================

@produccion_bp.route('/api/despacho/entregados', methods=['GET'])
def despacho_entregados():
    """
    Devuelve todos los tickets DESPACHO_CENTRAL ya Terminados (= entregados).
    Opcional: ?chofer_id=X para filtrar por chofer (usado por el chofer para su historial).
    """
    chofer_id = request.args.get('chofer_id')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        params = []
        filtro_chofer = ''
        if chofer_id:
            filtro_chofer = ' AND t.trabajador_asignado_id = %s'
            params.append(int(chofer_id))

        cursor.execute(f"""
            SELECT
                t.id, i.producto, v.codigo_venta, v.nombre_cliente,
                COALESCE(u.nombre, 'Sin asignar') AS chofer,
                t.fecha_fin,
                COALESCE(i.foto_url, '') AS foto_url,
                COALESCE(t.ticket_details_override, i.color_tela, '') AS especificaciones,
                t.foto_evidencia,
                v.direccion_cliente, v.fecha_entrega,
                t.item_id,
                COALESCE(v.monto_total, 0)    AS total,
                COALESCE(v.monto_adelanto, 0) AS adelanto,
                v.sede
            FROM tickets_produccion t
            JOIN items_venta i    ON t.item_id  = i.id
            JOIN ventas v         ON i.venta_id = v.id
            LEFT JOIN usuarios u  ON t.trabajador_asignado_id = u.id
            WHERE t.area_trabajo = 'DESPACHO_CENTRAL'
              AND t.estado_ticket = 'Terminado'
              {filtro_chofer}
            ORDER BY t.fecha_fin DESC
            LIMIT 200;
        """, params)

        resultado = []
        for r in cursor.fetchall():
            total    = float(r[12])
            adelanto = float(r[13])
            resultado.append({
                'ticket_id':      r[0],
                'producto':       r[1],
                'codigo_venta':   r[2],
                'cliente':        r[3],
                'chofer':         r[4],
                'fecha_entrega_real': r[5].strftime('%d/%m/%Y %H:%M') if r[5] else '—',
                'foto_url':       limpiar_foto(r[6]),
                'especificaciones': r[7] or '',
                'foto_evidencia': r[8] if r[8] else '',
                'direccion':      r[9] or '',
                'fecha_entrega_pactada': r[10].strftime('%d/%m/%Y') if r[10] else '—',
                'item_id':        r[11],
                'total':          total,
                'adelanto':       adelanto,
                'saldo':          max(0, total - adelanto),
                'sede':           r[14] or '',
            })

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

# ──────────────────────────────────────────────────────────
# LOGÍSTICA EXTERNA — endpoints nuevos
# ──────────────────────────────────────────────────────────

@produccion_bp.route('/api/logistica/<int:id>/enviar-cotizacion', methods=['POST'])
def enviar_cotizacion_proveedor(id):
    """Genera token y devuelve el link + datos para abrir WhatsApp desde el frontend."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT l.insumo_nombre, l.sku, v.codigo_venta,
                   p.nombre, p.telefono,
                   -- busca foto del insumo en los maestros por SKU
                   COALESCE(
                       (SELECT foto_url FROM maestro_telas          WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_bases           WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_tableros        WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_bases_comedor   WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_sillas          WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_butacas         WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM maestro_disenos_cojin   WHERE sku = l.sku LIMIT 1),
                       (SELECT foto_url FROM items_venta             WHERE venta_id = l.venta_id LIMIT 1)
                   ) AS foto_url
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.id = %s
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Registro no encontrado'}), 404

        insumo, sku, codigo_venta, nombre_proveedor, telefono_proveedor, foto_url = row

        if not telefono_proveedor:
            return jsonify({'error': 'El proveedor no tiene teléfono/WhatsApp registrado'}), 400

        from database import BACKEND_URL
        token = uuid.uuid4().hex
        link  = f"{BACKEND_URL}/cotizar.html?token={token}"
        foto_url_limpia = limpiar_foto(foto_url.split('|')[0]) if foto_url else ''

        cursor.execute("""
            UPDATE logistica_externa
            SET token_respuesta            = %s,
                token_usado                = FALSE,
                fecha_envio_cotizacion     = NOW(),
                estado                     = 'Cotizacion Enviada'
            WHERE id = %s
        """, (token, id))
        conexion.commit()

        return jsonify({
            'exito':             True,
            'link':              link,
            'telefono':          telefono_proveedor,
            'nombre_proveedor':  nombre_proveedor or 'Proveedor',
            'insumo':            insumo,
            'sku':               sku or '',
            'codigo_venta':      codigo_venta,
            'foto_url':          foto_url_limpia,
        }), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/cotizar/<string:token>', methods=['GET'])
def ver_formulario_cotizacion(token):
    """Endpoint PÚBLICO — el proveedor abre el link desde su celular."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT l.id, l.insumo_nombre, l.sku, l.token_usado,
                   v.codigo_venta, COALESCE(p.nombre,'Sin nombre') AS proveedor
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.token_respuesta = %s
        """, (token,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Token inválido o expirado'}), 404
        if row[3]:   # token_usado
            return jsonify({'ya_respondido': True}), 200
        return jsonify({
            'id': row[0], 'insumo': row[1], 'sku': row[2] or '',
            'codigo_venta': row[4], 'proveedor': row[5]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/cotizar/<string:token>', methods=['POST'])
def responder_cotizacion(token):
    """Endpoint PÚBLICO — el proveedor envía su precio y fecha."""
    data   = request.json or {}
    precio = data.get('precio')
    fecha  = data.get('fecha_entrega')
    notas  = data.get('notas', '')
    if not precio or not fecha:
        return jsonify({'error': 'precio y fecha_entrega son obligatorios'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE logistica_externa
            SET precio_cotizado           = %s,
                fecha_entrega_proveedor   = %s::date,
                notas_proveedor           = %s,
                token_usado               = TRUE,
                fecha_respuesta_proveedor = NOW(),
                estado = 'Cotizado'
            WHERE token_respuesta = %s AND token_usado = FALSE
        """, (precio, fecha, notas, token))
        if cursor.rowcount == 0:
            return jsonify({'error': 'Token ya fue usado o no existe'}), 409
        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/<int:id>/generar-orden', methods=['POST'])
def generar_orden_compra(id):
    """Genera PDF de Orden de Compra con diseño corporativo y lo sube a Cloudinary."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # ── Auto-migración: crear tabla ordenes_compra_seq si no existe ──────
        # Neon/PostgreSQL — seguro ejecutar siempre (IF NOT EXISTS)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ordenes_compra_seq (
                id           SERIAL PRIMARY KEY,
                logistica_id INTEGER REFERENCES logistica_externa(id),
                numero_oc    VARCHAR(50) NOT NULL,
                url_pdf      TEXT,
                public_id    TEXT,
                fecha_emision TIMESTAMP DEFAULT NOW()
            );
        """)
        # Auto-migración: agregar public_id si la tabla ya existía sin esa columna
        cursor.execute("""
            ALTER TABLE ordenes_compra_seq
            ADD COLUMN IF NOT EXISTS public_id TEXT;
        """)
        conexion.commit()

        # ── Auto-migración: agregar columna proveedor_informal si no existe ──
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'logistica_externa'
              AND column_name = 'proveedor_informal';
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE logistica_externa
                ADD COLUMN proveedor_informal VARCHAR(200);
            """)
            conexion.commit()

        cursor.execute("""
            SELECT l.insumo_nombre, l.sku, l.precio_cotizado,
                   l.fecha_entrega_proveedor, l.notas_proveedor,
                   v.codigo_venta, COALESCE(p.nombre,'Sin proveedor') AS prov,
                   COALESCE(p.telefono,'') AS tel_prov,
                   COALESCE(p.correo,'')  AS correo_prov,
                   COALESCE(l.cantidad, 1) AS cantidad,
                   COALESCE(l.unidad, 'und') AS unidad,
                   COALESCE(l.proveedor_informal,'') AS prov_informal
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.id = %s
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Registro no encontrado'}), 404

        (insumo, sku, precio, fecha_entrega, notas,
         cod_venta, proveedor, tel_prov, correo_prov,
         cantidad, unidad, prov_informal) = row

        # Número de OC — intentar obtener el próximo de la secuencia
        cursor.execute("""
            SELECT EXISTS(
                SELECT 1 FROM pg_proc WHERE proname = 'generar_numero_oc'
            )
        """)
        if cursor.fetchone()[0]:
            cursor.execute("SELECT generar_numero_oc()")
            numero_oc = cursor.fetchone()[0]
        else:
            # Fallback: usar el próximo número de la tabla ordenes_compra_seq
            cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM ordenes_compra_seq")
            seq_num   = cursor.fetchone()[0]
            numero_oc = f"OC-{seq_num:04d}"

        fecha_emision = datetime.now().strftime('%d/%m/%Y')
        fecha_entrega_str = fecha_entrega.strftime('%d/%m/%Y') if fecha_entrega else 'Por confirmar'
        precio_unit  = float(precio) if precio else 0.0
        subtotal     = precio_unit * float(cantidad)
        igv          = round(subtotal * 0.18, 2)
        total        = round(subtotal + igv, 2)
        nombre_prov_display = prov_informal if prov_informal else proveedor

        # ── Colores corporativos ────────────────────────────────────────
        COLOR_OSCURO = rl_colors.HexColor('#0f172a')
        COLOR_DORADO = rl_colors.HexColor('#c9a84c')
        COLOR_GRIS   = rl_colors.HexColor('#f8fafc')
        COLOR_BORDE  = rl_colors.HexColor('#e2e8f0')
        COLOR_TEXTO  = rl_colors.HexColor('#374151')

        # ── Canvas ─────────────────────────────────────────────────────
        buf  = BytesIO()
        c    = rl_canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        margin_x = 40 * mm

        def draw_text(text, x, y, font='Helvetica', size=10, color=COLOR_TEXTO):
            c.setFont(font, size)
            c.setFillColor(color)
            c.drawString(x, y, str(text))

        def draw_rect(x, y, width, height, fill=None, stroke=None, radius=4):
            c.setLineWidth(0.5)
            if fill:
                c.setFillColor(fill)
            if stroke:
                c.setStrokeColor(stroke)
            else:
                c.setStrokeColor(rl_colors.white)
            c.roundRect(x, y, width, height, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)

        # ── HEADER: banda oscura ───────────────────────────────────────
        draw_rect(0, h - 52*mm, w, 52*mm, fill=COLOR_OSCURO)

        # Nombre empresa
        c.setFont('Helvetica-Bold', 22)
        c.setFillColor(rl_colors.white)
        c.drawString(margin_x, h - 18*mm, 'INNOVA')
        c.setFillColor(COLOR_DORADO)
        c.drawString(margin_x + 68, h - 18*mm, 'MÖBILI')

        # Subtítulo empresa
        c.setFont('Helvetica', 8)
        c.setFillColor(rl_colors.HexColor('#94a3b8'))
        c.drawString(margin_x, h - 24*mm, 'Muebles de diseño a medida')

        # Título OC (derecha)
        c.setFont('Helvetica-Bold', 18)
        c.setFillColor(COLOR_DORADO)
        c.drawRightString(w - margin_x, h - 18*mm, 'ORDEN DE COMPRA')

        # Número OC
        c.setFont('Helvetica', 10)
        c.setFillColor(rl_colors.white)
        c.drawRightString(w - margin_x, h - 24*mm, f'N° {numero_oc}')

        # Fecha y ref (segunda línea header)
        c.setFont('Helvetica', 9)
        c.setFillColor(rl_colors.HexColor('#cbd5e1'))
        c.drawString(margin_x, h - 32*mm, f'Fecha de emisión: {fecha_emision}')
        c.drawRightString(w - margin_x, h - 32*mm, f'Ref. pedido: {cod_venta}')

        # Línea separadora dorada
        c.setStrokeColor(COLOR_DORADO)
        c.setLineWidth(1.5)
        c.line(margin_x, h - 38*mm, w - margin_x, h - 38*mm)

        # ── BLOQUE: Proveedor + Condiciones ───────────────────────────
        y_bloque = h - 64*mm
        col_w    = (w - 2 * margin_x - 8*mm) / 2

        # Caja Proveedor
        draw_rect(margin_x, y_bloque - 28*mm, col_w, 32*mm, fill=COLOR_GRIS, stroke=COLOR_BORDE)
        draw_text('PROVEEDOR', margin_x + 4*mm, y_bloque + 1*mm, 'Helvetica-Bold', 8, COLOR_DORADO)
        draw_text(nombre_prov_display[:40], margin_x + 4*mm, y_bloque - 6*mm, 'Helvetica-Bold', 11, COLOR_OSCURO)
        if tel_prov:
            draw_text(f'Tel: {tel_prov}', margin_x + 4*mm, y_bloque - 12*mm, 'Helvetica', 9, COLOR_TEXTO)
        if correo_prov:
            draw_text(correo_prov[:38], margin_x + 4*mm, y_bloque - 18*mm, 'Helvetica', 9, COLOR_TEXTO)

        # Caja Condiciones
        x_cond = margin_x + col_w + 8*mm
        draw_rect(x_cond, y_bloque - 28*mm, col_w, 32*mm, fill=COLOR_GRIS, stroke=COLOR_BORDE)
        draw_text('CONDICIONES', x_cond + 4*mm, y_bloque + 1*mm, 'Helvetica-Bold', 8, COLOR_DORADO)
        draw_text(f'Entrega pactada: {fecha_entrega_str}', x_cond + 4*mm, y_bloque - 6*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text('Moneda: Soles (PEN)', x_cond + 4*mm, y_bloque - 12*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text('Pago: Contra entrega', x_cond + 4*mm, y_bloque - 18*mm, 'Helvetica', 9, COLOR_TEXTO)

        # ── TABLA DE ÍTEMS ────────────────────────────────────────────
        y_tabla = y_bloque - 36*mm

        # Encabezado tabla
        draw_rect(margin_x, y_tabla - 8*mm, w - 2*margin_x, 8*mm, fill=COLOR_OSCURO)
        headers = [('DESCRIPCIÓN', margin_x + 3*mm),
                   ('SKU',         margin_x + 90*mm),
                   ('CANT.',       margin_x + 115*mm),
                   ('P. UNIT.',    margin_x + 132*mm),
                   ('SUBTOTAL',    margin_x + 152*mm)]
        for txt, xh in headers:
            draw_text(txt, xh, y_tabla - 5*mm, 'Helvetica-Bold', 8, rl_colors.white)

        # Fila de datos
        y_fila = y_tabla - 18*mm
        draw_rect(margin_x, y_fila, w - 2*margin_x, 12*mm, fill=COLOR_GRIS, stroke=COLOR_BORDE)
        # Nombre truncado si es muy largo
        nombre_corto = insumo[:48] if insumo else '—'
        draw_text(nombre_corto, margin_x + 3*mm, y_fila + 4*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text(sku or '—',   margin_x + 90*mm, y_fila + 4*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text(f'{float(cantidad):.0f} {unidad}', margin_x + 115*mm, y_fila + 4*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text(f'S/ {precio_unit:.2f}', margin_x + 132*mm, y_fila + 4*mm, 'Helvetica', 9, COLOR_TEXTO)
        draw_text(f'S/ {subtotal:.2f}',    margin_x + 152*mm, y_fila + 4*mm, 'Helvetica-Bold', 9, COLOR_OSCURO)

        # ── TOTALES ───────────────────────────────────────────────────
        y_tot = y_fila - 6*mm
        x_tot = margin_x + 120*mm
        tot_w = w - margin_x - x_tot

        def fila_total(label, valor, y, bold=False, highlight=False):
            if highlight:
                draw_rect(x_tot - 2*mm, y - 2*mm, tot_w + 2*mm, 8*mm, fill=COLOR_OSCURO)
                draw_text(label, x_tot, y + 2*mm, 'Helvetica-Bold', 9, rl_colors.white)
                draw_text(valor, x_tot + tot_w - 3*mm, y + 2*mm, 'Helvetica-Bold', 10, COLOR_DORADO)
            else:
                c.setStrokeColor(COLOR_BORDE)
                c.setLineWidth(0.3)
                c.line(x_tot, y - 1*mm, x_tot + tot_w, y - 1*mm)
                draw_text(label, x_tot, y + 2*mm, 'Helvetica-Bold' if bold else 'Helvetica', 9, COLOR_TEXTO)
                draw_text(valor, x_tot + tot_w - 3*mm, y + 2*mm, 'Helvetica-Bold' if bold else 'Helvetica', 9, COLOR_TEXTO)

        fila_total('Subtotal:',  f'S/ {subtotal:.2f}', y_tot)
        fila_total('IGV (18%):', f'S/ {igv:.2f}',      y_tot - 9*mm)
        fila_total('TOTAL:',     f'S/ {total:.2f}',    y_tot - 20*mm, bold=True, highlight=True)

        # ── NOTAS ─────────────────────────────────────────────────────
        if notas:
            y_notas = y_fila - 42*mm
            draw_rect(margin_x, y_notas - 14*mm, w - 2*margin_x, 18*mm, fill=rl_colors.HexColor('#fffbeb'), stroke=rl_colors.HexColor('#fde047'))
            draw_text('OBSERVACIONES', margin_x + 4*mm, y_notas + 1*mm, 'Helvetica-Bold', 8, rl_colors.HexColor('#854d0e'))
            # Truncar notas a 2 líneas de ~90 chars
            linea1 = notas[:90]
            linea2 = notas[90:180] if len(notas) > 90 else ''
            draw_text(linea1, margin_x + 4*mm, y_notas - 6*mm, 'Helvetica', 8, COLOR_TEXTO)
            if linea2:
                draw_text(linea2, margin_x + 4*mm, y_notas - 12*mm, 'Helvetica', 8, COLOR_TEXTO)

        # ── PIE DE PÁGINA ─────────────────────────────────────────────
        draw_rect(0, 0, w, 14*mm, fill=COLOR_OSCURO)
        c.setFont('Helvetica', 7)
        c.setFillColor(rl_colors.HexColor('#64748b'))
        c.drawCentredString(w / 2, 6*mm, 'Innova Möbili — Este documento es una orden de compra oficial.')
        c.drawCentredString(w / 2, 3*mm, f'Generado el {fecha_emision} · Ref. {cod_venta} · OC {numero_oc}')

        c.save()
        buf.seek(0)

        # ── Guardar PDF en base de datos (BYTEA) ─────────────────────
        # Evita depender de Cloudinary para servir el PDF.
        # El endpoint /pdf-oc regenera el PDF desde los datos y lo sirve directo.
        pdf_bytes = buf.getvalue()

        # Agregar columna pdf_bytes si no existe (auto-migración)
        try:
            cursor.execute("""
                ALTER TABLE ordenes_compra_seq
                ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA;
            """)
            cursor.execute("""
                ALTER TABLE ordenes_compra_seq
                ADD COLUMN IF NOT EXISTS public_id TEXT;
            """)
            conexion.commit()
        except Exception:
            conexion.rollback()

        # Guardar/actualizar registro en ordenes_compra_seq
        try:
            # Si ya existe un registro para este logistica_id, actualizarlo
            cursor.execute("""
                SELECT id FROM ordenes_compra_seq WHERE logistica_id = %s ORDER BY id DESC LIMIT 1
            """, (id,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("""
                    UPDATE ordenes_compra_seq
                    SET numero_oc = %s, pdf_bytes = %s
                    WHERE id = %s
                """, (numero_oc, pdf_bytes, existing[0]))
            else:
                cursor.execute("""
                    INSERT INTO ordenes_compra_seq (logistica_id, numero_oc, pdf_bytes)
                    VALUES (%s, %s, %s)
                """, (id, numero_oc, pdf_bytes))
            conexion.commit()
        except Exception as e_seq:
            conexion.rollback()
            print(f"[ordenes_compra_seq] Error al guardar PDF: {e_seq}")

        # ── Actualizar estado logística ────────────────────────────────
        try:
            cursor.execute("""
                UPDATE logistica_externa SET estado = 'Orden Enviada' WHERE id = %s
            """, (id,))
            conexion.commit()
        except Exception as e_upd:
            conexion.rollback()
            print(f"[generar_orden] Advertencia al actualizar estado: {e_upd}")

        return jsonify({
            'exito':      True,
            'numero_oc':  numero_oc,
            'proveedor':  nombre_prov_display,
            'telefono':   tel_prov,
        }), 200


    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/<int:id>/registrar-pago', methods=['POST'])
def registrar_pago_proveedor(id):
    """Sube voucher de pago a Cloudinary y actualiza estado.
    Detecta automáticamente si el insumo es TELA o ESTRUCTURAL
    y asigna estado_distribucion correspondiente.
    """
    if 'comprobante' not in request.files:
        return jsonify({'error': 'Campo comprobante es obligatorio'}), 400
    archivo = request.files['comprobante']
    try:
        resp = cloudinary.uploader.upload(archivo, folder='pagos_proveedores')
        url_voucher = resp.get('secure_url')
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Agregar columnas si aún no existen (idempotente)
        cursor.execute("""
            ALTER TABLE logistica_externa
                ADD COLUMN IF NOT EXISTS categoria_insumo   VARCHAR(30) DEFAULT 'OTRO',
                ADD COLUMN IF NOT EXISTS estado_distribucion VARCHAR(30) DEFAULT NULL;
        """)

        # Leer el SKU de esta fila para detectar la categoría
        cursor.execute("SELECT sku FROM logistica_externa WHERE id = %s", (id,))
        row_sku = cursor.fetchone()
        sku = (row_sku[0] or '').strip() if row_sku else ''

        # Detectar categoría cruzando con tablas maestro
        categoria_insumo   = 'OTRO'
        estado_distribucion = None

        if sku:
            cursor.execute("SELECT 1 FROM maestro_telas WHERE sku = %s LIMIT 1", (sku,))
            if cursor.fetchone():
                categoria_insumo    = 'TELA'
                estado_distribucion = 'En espera'   # el operario decide cuándo está listo
            else:
                cursor.execute("""
                    SELECT 1 FROM (
                        SELECT sku FROM maestro_tableros      WHERE sku = %s
                        UNION ALL
                        SELECT sku FROM maestro_bases         WHERE sku = %s
                        UNION ALL
                        SELECT sku FROM maestro_bases_comedor WHERE sku = %s
                        UNION ALL
                        SELECT sku FROM maestro_sillas        WHERE sku = %s
                        UNION ALL
                        SELECT sku FROM maestro_butacas       WHERE sku = %s
                    ) t LIMIT 1
                """, (sku, sku, sku, sku, sku))
                if cursor.fetchone():
                    categoria_insumo    = 'ESTRUCTURAL'
                    estado_distribucion = 'Listo para recojo'   # va directo a cola

        cursor.execute("""
            UPDATE logistica_externa
            SET url_comprobante_pago  = %s,
                fecha_pago            = NOW(),
                estado                = 'Pagado',
                categoria_insumo      = %s,
                estado_distribucion   = %s
            WHERE id = %s
        """, (url_voucher, categoria_insumo, estado_distribucion, id))

        conexion.commit()
        return jsonify({
            'exito':               True,
            'url':                 url_voucher,
            'categoria_insumo':    categoria_insumo,
            'estado_distribucion': estado_distribucion,
        }), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/logistica/<int:id>/estado-distribucion', methods=['PATCH'])
def actualizar_estado_distribucion(id):
    """El operario de telas cambia el estado de distribución de un ítem pagado.
    Solo aplica a ítems con categoria_insumo = 'TELA'.
    Body: { "estado": "Listo para recojo" | "En espera" }
    """
    data   = request.get_json() or {}
    estado = (data.get('estado') or '').strip()
    estados_validos = ('Listo para recojo', 'En espera')
    if estado not in estados_validos:
        return jsonify({'error': f'Estado debe ser uno de: {estados_validos}'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT categoria_insumo, estado
            FROM logistica_externa WHERE id = %s
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Ítem no encontrado'}), 404
        if row[1] != 'Pagado':
            return jsonify({'error': 'Solo se puede cambiar la distribución de ítems pagados'}), 409
        cursor.execute("""
            UPDATE logistica_externa
            SET estado_distribucion = %s
            WHERE id = %s
        """, (estado, id))
        conexion.commit()
        return jsonify({'exito': True, 'estado_distribucion': estado}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


def servir_pdf_oc(id):
    """
    Genera y sirve la Orden de Compra como HTML con diseño corporativo.
    El browser abre el HTML en ventana nueva y puede imprimirlo como PDF.
    Elimina la dependencia de Cloudinary y problemas de Content-Type.
    """
    from flask import make_response
    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Obtener datos del requerimiento
        cursor.execute("""
            SELECT l.insumo_nombre, l.sku, l.precio_cotizado,
                   l.fecha_entrega_proveedor, l.notas_proveedor,
                   v.codigo_venta, COALESCE(p.nombre,'Sin proveedor') AS prov,
                   COALESCE(p.telefono,'') AS tel_prov,
                   COALESCE(p.correo,'')  AS correo_prov,
                   COALESCE(l.cantidad, 1) AS cantidad,
                   COALESCE(l.unidad, 'und') AS unidad,
                   COALESCE(l.proveedor_informal,'') AS prov_informal
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.id = %s
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Registro no encontrado'}), 404

        (insumo, sku, precio, fecha_entrega, notas,
         cod_venta, proveedor, tel_prov, correo_prov,
         cantidad, unidad, prov_informal) = row

        # Obtener número de OC
        numero_oc = f'OC-{id:04d}'
        try:
            cursor.execute("""
                SELECT numero_oc FROM ordenes_compra_seq
                WHERE logistica_id = %s ORDER BY id DESC LIMIT 1
            """, (id,))
            oc_row = cursor.fetchone()
            if oc_row and oc_row[0]:
                numero_oc = oc_row[0]
        except Exception:
            conexion.rollback()

        from datetime import datetime as dt
        fecha_emision     = dt.now().strftime('%d/%m/%Y')
        fecha_entrega_str = fecha_entrega.strftime('%d/%m/%Y') if fecha_entrega else 'Por confirmar'
        precio_unit = float(precio) if precio else 0.0
        subtotal    = precio_unit * float(cantidad)
        igv         = round(subtotal * 0.18, 2)
        total       = round(subtotal + igv, 2)
        nombre_prov = prov_informal if prov_informal else proveedor
        notas_html  = f'<div class="notas-box"><b>Observaciones:</b> {notas}</div>' if notas else ''

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orden de Compra {numero_oc}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Jost:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Jost', Arial, sans-serif;
    background: #f5f0e8;
    padding: 30px 16px;
    color: #2c1f0e;
  }}
  .page {{
    width: 210mm;
    margin: auto;
    background: #fff;
    overflow: hidden;
    box-shadow: 0 12px 48px rgba(44,31,14,0.18);
  }}

  /* ── HEADER ── */
  .header {{
    background: #1a120b;
    padding: 28px 40px 22px;
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }}
  .header-left {{
    display: flex;
    align-items: center;
    gap: 18px;
  }}
  /* Logo */
  .logo-mark {{
    height: 80px;
    width: auto;
    flex-shrink: 0;
    filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.25));
  }}
  .brand-text {{}}
  .brand-name {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 700;
    color: #f5f0e8;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1;
  }}
  .brand-name em {{
    color: #c9a84c;
    font-style: italic;
  }}
  .brand-sub {{
    font-family: 'Jost', sans-serif;
    font-size: 9px;
    font-weight: 300;
    color: #8a7560;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-top: 5px;
  }}
  .header-right {{
    text-align: right;
  }}
  .oc-label {{
    font-family: 'Jost', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: #8a7560;
    margin-bottom: 6px;
  }}
  .oc-title {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    font-weight: 600;
    color: #c9a84c;
    letter-spacing: 0.06em;
    line-height: 1;
  }}
  .oc-num {{
    font-family: 'Jost', sans-serif;
    font-size: 12px;
    font-weight: 300;
    color: #8a7560;
    letter-spacing: 0.1em;
    margin-top: 4px;
  }}

  /* Línea dorada separadora */
  .header-divider {{
    border: none;
    border-top: 1px solid rgba(201,168,76,0.35);
    margin: 18px 40px 0;
  }}
  .header-meta {{
    background: #1a120b;
    display: flex;
    justify-content: space-between;
    padding: 10px 40px 20px;
    font-family: 'Jost', sans-serif;
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.1em;
    color: #8a7560;
  }}
  .header-meta b {{ color: #e8dcc8; font-weight: 500; }}

  /* ── BODY ── */
  .body {{ padding: 32px 40px; }}

  /* CAJAS INFO */
  .info-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 32px;
  }}
  .info-box {{
    border: 1px solid #e8dcc8;
    border-radius: 4px;
    padding: 16px 20px;
    background: #fdfaf5;
  }}
  .info-box-label {{
    font-family: 'Jost', sans-serif;
    font-size: 8px;
    font-weight: 600;
    color: #c9a84c;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e8dcc8;
  }}
  .info-box-nombre {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    font-weight: 600;
    color: #2c1f0e;
    margin-bottom: 8px;
    line-height: 1.2;
  }}
  .info-box-row {{
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 300;
    color: #8a7560;
    margin-bottom: 4px;
    letter-spacing: 0.04em;
  }}
  .info-box-row b {{ font-weight: 500; color: #2c1f0e; }}

  /* TABLA */
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
  thead tr {{
    background: #2c1f0e;
  }}
  thead th {{
    font-family: 'Jost', sans-serif;
    color: #e8dcc8;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    padding: 12px 14px;
    text-align: left;
  }}
  thead th:last-child {{ text-align: right; }}
  tbody tr {{ background: #fdfaf5; }}
  tbody tr:nth-child(even) {{ background: #f5f0e8; }}
  tbody td {{
    padding: 16px 14px;
    font-family: 'Jost', sans-serif;
    font-size: 12px;
    font-weight: 400;
    color: #2c1f0e;
    border-bottom: 1px solid #e8dcc8;
    vertical-align: middle;
  }}
  tbody td:last-child {{
    text-align: right;
    font-weight: 600;
    color: #2c1f0e;
    font-family: 'Cormorant Garamond', serif;
    font-size: 15px;
    white-space: nowrap;
  }}
  .td-sku {{
    font-family: 'Jost', sans-serif;
    font-size: 10px;
    font-weight: 300;
    color: #b07d3a;
    letter-spacing: 0.08em;
  }}

  /* TOTALES */
  .totales {{ display: flex; justify-content: flex-end; margin-bottom: 24px; }}
  .totales-inner {{ width: 260px; }}
  .tot-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px solid #e8dcc8;
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 300;
    color: #8a7560;
    letter-spacing: 0.06em;
  }}
  .tot-row.final {{
    background: #2c1f0e;
    color: #f5f0e8;
    padding: 12px 16px;
    margin-top: 8px;
    border: none;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }}
  .tot-row.final span:last-child {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 700;
    color: #c9a84c;
    letter-spacing: 0.05em;
  }}

  /* NOTAS */
  .notas-box {{
    background: rgba(201,168,76,0.06);
    border-left: 3px solid #c9a84c;
    padding: 12px 18px;
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 300;
    color: #8a7560;
    margin-bottom: 28px;
    letter-spacing: 0.04em;
  }}
  .notas-box b {{ color: #2c1f0e; font-weight: 500; }}

  /* PIE */
  .footer {{
    background: #1a120b;
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }}
  .footer-logo {{
    opacity: 0.5;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .footer-logo span {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 11px;
    font-weight: 300;
    color: #8a7560;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }}
  .footer-sep {{ color: #8a7560; opacity: 0.3; }}
  .footer-text {{
    font-family: 'Jost', sans-serif;
    font-size: 9px;
    font-weight: 300;
    color: #8a7560;
    letter-spacing: 0.12em;
  }}

  /* BOTÓN IMPRIMIR */
  .print-bar {{ text-align: center; margin-bottom: 24px; }}
  .btn-print {{
    background: #2c1f0e;
    color: #c9a84c;
    border: none;
    padding: 13px 36px;
    font-family: 'Jost', sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s;
  }}
  .btn-print:hover {{ background: #1a120b; }}

  @media print {{
    body {{ background: #fff; padding: 0; }}
    .page {{ box-shadow: none; width: 100%; }}
    .print-bar {{ display: none; }}
  }}
</style>
</head>
<body>
<div class="print-bar">
  <button class="btn-print" onclick="window.print()">🖨️ &nbsp;Imprimir / Guardar como PDF</button>
</div>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <!-- Logo real (mismo archivo que usa el contrato de venta) -->
      <img src="https://innova-4cnn.onrender.com/imagenes/Logo3.png" class="logo-mark"
           onerror="this.style.display='none'">
      <div class="brand-text">
        <div class="brand-name">Innova <em>Möbili</em></div>
        <div class="brand-sub">Muebles de diseño a medida &nbsp;·&nbsp; RUC 20600768175</div>
      </div>
    </div>
    <div class="header-right">
      <div class="oc-label">Documento comercial</div>
      <div class="oc-title">Orden de Compra</div>
      <div class="oc-num">N° {numero_oc}</div>
    </div>
  </div>
  <hr class="header-divider">
  <div class="header-meta">
    <span>Fecha de emisión: <b>{fecha_emision}</b></span>
    <span>Ref. pedido: <b>{cod_venta}</b></span>
  </div>

  <!-- BODY -->
  <div class="body">
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-label">Proveedor</div>
        <div class="info-box-nombre">{nombre_prov}</div>
        {'<div class="info-box-row">📞 &nbsp;' + tel_prov + '</div>' if tel_prov else ''}
        {'<div class="info-box-row">✉ &nbsp;' + correo_prov + '</div>' if correo_prov else ''}
      </div>
      <div class="info-box">
        <div class="info-box-label">Condiciones</div>
        <div class="info-box-row"><b>Entrega pactada:</b> &nbsp;{fecha_entrega_str}</div>
        <div class="info-box-row"><b>Moneda:</b> &nbsp;Soles (PEN)</div>
        <div class="info-box-row"><b>Pago:</b> &nbsp;Contra entrega</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th>SKU</th>
          <th>Cant.</th>
          <th>P. Unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{insumo or '—'}</td>
          <td class="td-sku">{sku or '—'}</td>
          <td>{int(float(cantidad))} {unidad}</td>
          <td>S/ {precio_unit:.2f}</td>
          <td>S/ {subtotal:.2f}</td>
        </tr>
      </tbody>
    </table>

    <div class="totales">
      <div class="totales-inner">
        <div class="tot-row"><span>Subtotal</span><span>S/ {subtotal:.2f}</span></div>
        <div class="tot-row"><span>IGV (18%)</span><span>S/ {igv:.2f}</span></div>
        <div class="tot-row final"><span>Total</span><span>S/ {total:.2f}</span></div>
      </div>
    </div>

    {notas_html}
  </div>

  <!-- PIE -->
  <div class="footer">
    <div class="footer-logo">
      <svg width="14" height="14" viewBox="0 0 56 56" fill="none">
        <polygon points="28,4 52,28 28,52 4,28" fill="#c9a84c" opacity="0.6"/>
      </svg>
      <span>Innova Möbili</span>
    </div>
    <span class="footer-sep">·</span>
    <span class="footer-text">Documento generado el {fecha_emision} &nbsp;·&nbsp; Ref. {cod_venta} &nbsp;·&nbsp; {numero_oc}</span>
  </div>

</div>
</body>
</html>"""

        resp = make_response(html)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        resp.headers['Cache-Control'] = 'no-store'
        return resp

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)
            # ─── STOCK ESTRUCTURAS SOFÁ ───────────────────────────────────────────────────

@produccion_bp.route('/api/stock-estructuras', methods=['GET'])
def listar_stock_estructuras():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        # Agregar chofer_nombre si la columna ya existe (migración segura)
        cursor.execute("""
            ALTER TABLE stock_estructuras_sofa
            ADD COLUMN IF NOT EXISTS chofer_nombre VARCHAR(150);
        """)
        cursor.execute("""
            SELECT id, nombre_modelo, ancho, profundidad, alto,
                   medida_estandar, foto_url, tipo, cantidad, estado,
                   ticket_id, TO_CHAR(fecha_registro,'DD/MM/YYYY'), COALESCE(precio, 0),
                   COALESCE(modelo_base, ''), COALESCE(chofer_nombre, '')
            FROM stock_estructuras_sofa
            ORDER BY fecha_registro DESC
        """)
        rows = cursor.fetchall()
        return jsonify([{
            'id': r[0], 'nombre_modelo': r[1],
            'ancho': float(r[2] or 0), 'profundidad': float(r[3] or 0), 'alto': float(r[4] or 0),
            'medida_estandar': r[5], 'foto_url': r[6], 'tipo': r[7],
            'cantidad': r[8], 'estado': r[9], 'ticket_id': r[10], 'fecha': r[11],
            'precio': float(r[12] or 0),
            'modelo_base': r[13], 'chofer_nombre': r[14]
        } for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/stock-estructuras', methods=['POST'])
def registrar_stock_estructura():
    import cloudinary.uploader
    try:
        nombre              = request.form.get('nombre_modelo')
        modelo_base         = request.form.get('modelo_base', '')
        ancho               = request.form.get('ancho') or 0
        profundidad         = request.form.get('profundidad') or 0
        alto                = request.form.get('alto') or 0
        medida_estandar     = request.form.get('medida_estandar') == 'true'
        tipo                = request.form.get('tipo', 'estructura')
        cantidad            = int(request.form.get('cantidad', 1))
        precio              = float(request.form.get('precio') or 0)
        # A8: Campos nuevos para pata/zócalo
        tipo_base           = request.form.get('tipo_base', '')  # 'patas', 'zocalo', o vacío
        medida_base         = request.form.get('medida_base') or None
        medida_base_estandar = request.form.get('medida_base_estandar') == 'true'

        # Validar que si hay tipo_base, también hay medida_base
        if tipo_base and not medida_base:
            return jsonify({'error': 'Si selecciona un tipo de base, debe ingresar la medida'}), 400

        foto_url = None
        if 'foto' in request.files and request.files['foto'].filename:
            res = cloudinary.uploader.upload(request.files['foto'], folder='stock_estructuras')
            foto_url = res.get('secure_url')

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO stock_estructuras_sofa
                (nombre_modelo, modelo_base, ancho, profundidad, alto,
                 medida_estandar, foto_url, tipo, cantidad, precio,
                 tipo_base, medida_base, medida_base_estandar)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (nombre, modelo_base, ancho, profundidad, alto,
              medida_estandar, foto_url, tipo, cantidad, precio,
              tipo_base, medida_base, medida_base_estandar))
        new_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': new_id}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@produccion_bp.route('/api/stock-estructuras/<int:stock_id>/usar', methods=['POST'])
def usar_stock_estructura(stock_id):
    """Marca una estructura como entregada, la vincula al ticket y termina el ticket."""
    data      = request.get_json()
    ticket_id = data.get('ticket_id')
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE stock_estructuras_sofa
            SET estado = 'entregado', ticket_id = %s
            WHERE id = %s
        """, (ticket_id, stock_id))
        # Marcar el ticket de carpintería como Terminado automáticamente
        # (la estructura ya estaba hecha — no hay que fabricarla)
        if ticket_id:
            cursor.execute("""
                UPDATE tickets_produccion
                SET estado_ticket = 'Terminado'
                WHERE id = %s
            """, (ticket_id,))
        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

# =============================================================================
# INNOVA MÖBILI — routes_produccion.py  PATCH
# Reemplazar SOLO la función sugerir_estructura() (~línea 2039).
# El resto del archivo no se toca.
# =============================================================================


@produccion_bp.route('/api/stock-estructuras/sugerir', methods=['GET'])
def sugerir_estructura():
    """
    Devuelve estructuras disponibles ordenadas: primero por modelo exacto,
    luego estándar, luego por medidas similares (±15 cm).

    Query params:
      ancho, profundidad, alto  — medidas del ticket (float, default 0)
      modelo_base               — modelo del sofá (str, opcional)
      solo_estandar             — si 'true', ignora medidas y devuelve
                                  solo tipo='estructura' con medida_estandar=TRUE
    """
    try:
        ancho        = float(request.args.get('ancho', 0))
        profundidad  = float(request.args.get('profundidad', 0))
        alto         = float(request.args.get('alto', 0))
        modelo_base  = request.args.get('modelo_base', '').strip()
        solo_estandar = request.args.get('solo_estandar', 'false').lower() == 'true'
        margen       = 15  # cm

        conexion = get_db_connection()
        cursor   = conexion.cursor()

        if solo_estandar:
            # ── Caso C: solo estructuras estándar, sin filtro de medidas ──────
            cursor.execute("""
                SELECT id, nombre_modelo, ancho, profundidad, alto,
                       medida_estandar, foto_url, tipo, cantidad,
                       COALESCE(modelo_base, '')
                FROM stock_estructuras_sofa
                WHERE estado = 'disponible'
                  AND medida_estandar = TRUE
                  AND tipo = 'estructura'
                ORDER BY nombre_modelo ASC
                LIMIT 8
            """)
        else:
            # Determinar si debemos aplicar el filtro de medidas similares.
            # Si los tres valores son 0, NO aplicar (evita "ancho <= 15" que
            # devuelve basura).
            hay_medidas = (ancho > 0 or profundidad > 0 or alto > 0)

            if hay_medidas:
                medidas_clause = """
                    OR (
                        ABS(ancho       - %(ancho)s)       <= %(margen)s AND
                        ABS(profundidad - %(profundidad)s) <= %(margen)s AND
                        (%(alto)s = 0 OR ABS(alto - %(alto)s) <= %(margen)s)
                    )
                """
            else:
                # Sin medidas: no incluir cláusula de distancia
                medidas_clause = ""

            sql = f"""
                SELECT id, nombre_modelo, ancho, profundidad, alto,
                       medida_estandar, foto_url, tipo, cantidad,
                       COALESCE(modelo_base, '')
                FROM stock_estructuras_sofa
                WHERE estado = 'disponible'
                  AND (
                    medida_estandar = TRUE
                    OR (%(modelo_base)s != '' AND LOWER(modelo_base) = LOWER(%(modelo_base)s))
                    {medidas_clause}
                  )
                ORDER BY
                    CASE WHEN %(modelo_base)s != ''
                              AND LOWER(modelo_base) = LOWER(%(modelo_base)s)
                         THEN 0 ELSE 1 END ASC,
                    medida_estandar DESC,
                    ABS(ancho - %(ancho)s) ASC
                LIMIT 8
            """
            cursor.execute(sql, {
                'ancho':        ancho,
                'profundidad':  profundidad,
                'alto':         alto,
                'modelo_base':  modelo_base,
                'margen':       margen,
            })

        rows = cursor.fetchall()
        return jsonify([{
            'id':             r[0],
            'nombre_modelo':  r[1],
            'ancho':          float(r[2] or 0),
            'profundidad':    float(r[3] or 0),
            'alto':           float(r[4] or 0),
            'medida_estandar': r[5],
            'foto_url':       r[6],
            'tipo':           r[7],
            'cantidad':       r[8],
            'modelo_base':    r[9],
        } for r in rows]), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/stock-estructuras/<int:stock_id>/entregar', methods=['PATCH'])
def entregar_estructura(stock_id):
    """
    El carpintero marca una estructura como entregada al chofer.
    Recibe: { "chofer_nombre": "Juan Quispe" }
    Registra quién la recogió para historial.
    """
    data          = request.get_json() or {}
    chofer_nombre = (data.get('chofer_nombre') or '').strip()

    if not chofer_nombre:
        return jsonify({'error': 'Debes indicar el nombre del chofer.'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Asegurar columna (idempotente)
        cursor.execute("""
            ALTER TABLE stock_estructuras_sofa
            ADD COLUMN IF NOT EXISTS chofer_nombre VARCHAR(150);
        """)

        # Verificar que la estructura existe y está disponible
        cursor.execute(
            "SELECT id, estado FROM stock_estructuras_sofa WHERE id = %s;",
            (stock_id,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Estructura no encontrada.'}), 404
        if row[1] != 'disponible':
            return jsonify({'error': 'Esta estructura ya fue entregada o no está disponible.'}), 409

        cursor.execute("""
            UPDATE stock_estructuras_sofa
            SET estado = 'entregado', chofer_nombre = %s
            WHERE id = %s
        """, (chofer_nombre, stock_id))
        conexion.commit()
        return jsonify({'exito': True, 'chofer_nombre': chofer_nombre}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion:
            conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)