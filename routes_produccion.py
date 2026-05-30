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
            SET estado_ticket = 'Terminado', foto_evidencia = %s, fecha_fin = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING item_id, area_trabajo;
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
                    WHERE item_id = %s AND area_trabajo IN ({placeholders_req}) AND estado_ticket = 'Terminado'
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
                        WHERE i.venta_id = %s AND t.area_trabajo != 'DESPACHO_CENTRAL' AND t.estado_ticket != 'Terminado'
                    """, (venta_id_check,))
                    if cursor.fetchone()[0] == 0:
                        cursor.execute("""
                            UPDATE ventas SET estado_general = 'Listo'
                            WHERE id = %s AND COALESCE(estado_general,'') NOT IN ('Entregado','Cancelado')
                        """, (venta_id_check,))
                        venta_actualizada = cursor.rowcount > 0

        conexion.commit()
        es_despacho = row and row[1] == 'DESPACHO_CENTRAL'
        msg = '🎉 ¡Entrega confirmada! La venta fue marcada como Entregado.' if es_despacho else 'Ticket finalizado correctamente'
        if not es_despacho and desbloqueados > 0:
            msg += f'. {desbloqueados} ticket(s) de tapicería desbloqueado(s) automáticamente.'
        if not es_despacho and venta_actualizada:
            msg += '. ✅ ¡Producción completa! La venta pasó a estado Listo.'
        return jsonify({'exito': True, 'mensaje': msg, 'desbloqueados': desbloqueados, 'venta_lista': venta_actualizada, 'es_entrega': es_despacho}), 200

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
                   COALESCE(ut.nombre, 'Sin asignar') AS tapicero_nombre
            FROM tickets_produccion t
            JOIN items_venta i    ON t.item_id  = i.id
            JOIN ventas v         ON i.venta_id = v.id
            LEFT JOIN usuarios u  ON t.trabajador_asignado_id = u.id
            LEFT JOIN tickets_produccion tap
                ON tap.item_id = t.item_id
               AND tap.area_trabajo IN ('TAPICERIA_SOFAS', 'TAPICERIA_SILLAS')
               AND tap.estado_ticket = 'Bloqueado'
            LEFT JOIN usuarios ut ON tap.trabajador_asignado_id = ut.id
            WHERE t.area_trabajo IN ('ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS_SILLAS')
              AND t.estado_ticket = 'Terminado' AND tap.id IS NOT NULL
            ORDER BY t.fecha_fin DESC;
        """)
        resultado = [{
            "ticket_id": r[0], "area": r[1], "producto": r[2], "codigo_venta": r[3],
            "cliente": r[4], "operario": r[5],
            "fecha_fin": r[6].strftime('%d/%m/%Y %H:%M') if r[6] else 'S/F',
            "foto_url": limpiar_foto(r[7]), "especificaciones": r[8] or '',
            "foto_evidencia": r[9] if r[9] else '', "direccion": r[10] or '',
            "fecha_entrega": r[11].strftime('%d/%m/%Y') if r[11] else 'S/F',
            "item_id": r[12], "tapicero": r[13],
        } for r in cursor.fetchall()]
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
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
            WHERE 1=1
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
                  AND estado_ticket != 'Terminado' AND area_trabajo != 'DESPACHO_CENTRAL'
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
                "foto":            limpiar_foto(row[9]),
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
                    'foto': limpiar_foto(item[2]),
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
                   l.token_usado, l.notas_proveedor, l.url_comprobante_pago
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
            "url_comprobante_pago": r[11]
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
    if not logistica_id:
        return jsonify({'error': 'id es obligatorio'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE logistica_externa
            SET proveedor_id = COALESCE(%s, proveedor_id),
                precio_cotizado = COALESCE(%s, precio_cotizado),
                fecha_entrega_proveedor = COALESCE(%s::date, fecha_entrega_proveedor),
                estado = COALESCE(%s, estado)
            WHERE id = %s;
        """, (proveedor_id, precio_cotizado, fecha_entrega_proveedor, estado, logistica_id))

        # Si se marca como Recibido → desbloquear tickets_produccion relacionados
        if estado == 'Recibido':
            cursor.execute("""
                SELECT l.venta_id FROM logistica_externa l WHERE l.id = %s
            """, (logistica_id,))
            venta_row = cursor.fetchone()
            if venta_row:
                cursor.execute("""
                    UPDATE tickets_produccion
                    SET estado_ticket = 'En Proceso',
                        fecha_inicio  = CURRENT_TIMESTAMP
                    WHERE estado_ticket = 'Bloqueado'
                      AND item_id IN (
                          SELECT id FROM items_venta WHERE venta_id = %s
                      )
                """, (venta_row[0],))

        conexion.commit()
        return jsonify({'exito': True}), 200
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
            'tela':        ("maestro_telas", "TEL", "(sku, proveedor, coleccion, color, foto_url, origen_produccion, estado) VALUES (%s,%s,%s,%s,%s,%s,'Disponible')", lambda d: (datos.get('proveedor'), datos.get('coleccion'), datos.get('color'), foto_ruta, origen)),
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
                       (SELECT foto_url FROM maestro_disenos_cojin   WHERE sku = l.sku LIMIT 1)
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
            'foto_url':          foto_url or '',
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
    """Genera PDF de Orden de Compra y lo sube a Cloudinary."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT l.insumo_nombre, l.sku, l.precio_cotizado,
                   l.fecha_entrega_proveedor, l.notas_proveedor,
                   v.codigo_venta, COALESCE(p.nombre,'Sin proveedor') AS prov
            FROM logistica_externa l
            JOIN ventas v           ON l.venta_id    = v.id
            LEFT JOIN proveedores p ON l.proveedor_id = p.id
            WHERE l.id = %s
        """, (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Registro no encontrado'}), 404

        insumo, sku, precio, fecha_entrega, notas, cod_venta, proveedor = row

        # Generar PDF en memoria con ReportLab
        buf = BytesIO()
        c   = rl_canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(60, h - 60, "ORDEN DE COMPRA — INNOVA MÖBILI")
        c.setFont("Helvetica", 11)
        c.drawString(60, h - 90,  f"Referencia: {cod_venta}")
        c.drawString(60, h - 110, f"Proveedor:  {proveedor}")
        c.drawString(60, h - 130, f"Material:   {insumo}  (SKU: {sku or 'N/A'})")
        c.drawString(60, h - 150, f"Precio:     S/ {precio or 'Por confirmar'}")
        if fecha_entrega:
            c.drawString(60, h - 170,
                f"Fecha entrega: {fecha_entrega.strftime('%d/%m/%Y')}")
        if notas:
            c.drawString(60, h - 200, f"Notas: {notas[:120]}")
        c.save()
        buf.seek(0)

        # Subir a Cloudinary
        resp = cloudinary.uploader.upload(
            buf,
            folder='ordenes_compra',
            resource_type='raw',
            public_id=f'OC-{id}-{cod_venta}'
        )
        url_pdf = resp.get('secure_url')

        # Guardar en ordenes_compra_seq y cambiar estado
        cursor.execute("""
            INSERT INTO ordenes_compra_seq (logistica_id, numero_oc, url_pdf)
            VALUES (%s, generar_numero_oc(), %s)
        """, (id, url_pdf))
        cursor.execute("""
            UPDATE logistica_externa SET estado = 'Orden Enviada' WHERE id = %s
        """, (id,))
        conexion.commit()
        return jsonify({'exito': True, 'url_pdf': url_pdf}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@produccion_bp.route('/api/logistica/<int:id>/registrar-pago', methods=['POST'])
def registrar_pago_proveedor(id):
    """Sube voucher de pago a Cloudinary y actualiza estado."""
    if 'comprobante' not in request.files:
        return jsonify({'error': 'Campo comprobante es obligatorio'}), 400
    archivo = request.files['comprobante']
    try:
        resp = cloudinary.uploader.upload(archivo, folder='pagos_proveedores')
        url_voucher = resp.get('secure_url')
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE logistica_externa
            SET url_comprobante_pago = %s,
                fecha_pago = NOW(),
                estado     = 'Pagado'
            WHERE id = %s
        """, (url_voucher, id))
        conexion.commit()
        return jsonify({'exito': True, 'url': url_voucher}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)