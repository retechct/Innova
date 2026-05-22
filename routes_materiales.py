"""
routes_materiales.py — Módulos 4 y 5: Maestro de materiales (SKU/fotos) y creaciones.
Blueprint: materiales_bp  (sin prefijo de URL)
"""

import json
import cloudinary.uploader
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto

materiales_bp = Blueprint('materiales', __name__)


# ==========================================
# MAESTRO DE MATERIALES — NUEVO Y LISTAS
# ==========================================

@materiales_bp.route('/api/materiales/nuevo', methods=['POST'])
def agregar_nuevo_material():
    try:
        tipo_material = request.form.get('tipo_material')
        origen        = request.form.get('origen_produccion', 'Externo')

        foto_ruta = ""
        if 'foto' in request.files:
            foto_file = request.files['foto']
            if foto_file.filename != '':
                respuesta_nube = cloudinary.uploader.upload(foto_file, folder="materiales")
                foto_ruta = respuesta_nube.get('secure_url')

        conexion  = get_db_connection()
        cursor    = conexion.cursor()
        nuevo_sku = ""

        if tipo_material == 'tela':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_telas")
            nuevo_sku = f"TEL-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_telas (sku, proveedor, coleccion, color, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('proveedor'), request.form.get('coleccion'),
                  request.form.get('color'), foto_ruta, origen))

        elif tipo_material == 'cojin':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_disenos_cojin")
            nuevo_sku = f"COJ-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_disenos_cojin (sku, nombre_diseno, tipo_tela, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('nombre_diseno'), request.form.get('tipo_tela'), foto_ruta, origen))

        elif tipo_material == 'base':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_bases")
            nuevo_sku = f"BAS-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_bases (sku, tipo, material, modelo, color, medida_altura, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('tipo'), request.form.get('material'),
                  request.form.get('modelo'), request.form.get('color'),
                  request.form.get('medida_altura'), foto_ruta, origen))

        elif tipo_material == 'tablero':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_tableros")
            nuevo_sku = f"TAB-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_tableros (sku, material_base, nombre_modelo, color_veta, acabado, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('material_base'), request.form.get('nombre_modelo'),
                  request.form.get('color_veta'), request.form.get('acabado'), foto_ruta, origen))

        elif tipo_material == 'base-comedor':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_bases_comedor")
            nuevo_sku = f"BAC-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_bases_comedor (sku, material, modelo, color, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('material'), request.form.get('modelo'),
                  request.form.get('color'), foto_ruta, origen))

        elif tipo_material == 'silla':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_sillas")
            nuevo_sku = f"SIL-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_sillas (sku, material, modelo, color_estructura, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('material'), request.form.get('modelo'),
                  request.form.get('color_estructura'), foto_ruta, origen))

        elif tipo_material == 'butaca':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_butacas")
            nuevo_sku = f"BUT-{str(cursor.fetchone()[0]+1).zfill(4)}"
            cursor.execute("""
                INSERT INTO maestro_butacas (sku, material, modelo, color_estructura, foto_url, origen_produccion, estado)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible') RETURNING id;
            """, (nuevo_sku, request.form.get('material'), request.form.get('modelo'),
                  request.form.get('color_estructura'), foto_ruta, origen))

        else:
            return jsonify({"error": "Tipo de material no válido"}), 400

        conexion.commit()
        return jsonify({
            "mensaje":  f"{tipo_material.capitalize()} registrada con éxito",
            "sku":      nuevo_sku,
            "foto_url": foto_ruta
        }), 201

    except Exception as ex:
        if 'conexion' in locals() and conexion: conexion.rollback()
        print("Error al guardar material:", ex)
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/materiales/listas', methods=['GET'])
def obtener_listas_materiales():
    try:
        conexion = get_db_connection()
        cur_telas    = conexion.cursor(); cur_telas.execute("SELECT sku, proveedor, coleccion, color, foto_url, COALESCE(estado,'Disponible') FROM maestro_telas")
        cur_cojines  = conexion.cursor(); cur_cojines.execute("SELECT sku, nombre_diseno, tipo_tela, foto_url, COALESCE(estado,'Disponible') FROM maestro_disenos_cojin")
        cur_bases    = conexion.cursor(); cur_bases.execute("SELECT sku, tipo, material, modelo, color, medida_altura, foto_url, COALESCE(estado,'Disponible') FROM maestro_bases")
        cur_tableros = conexion.cursor(); cur_tableros.execute("SELECT sku, material_base, nombre_modelo, color_veta, acabado, foto_url, COALESCE(estado,'Disponible') FROM maestro_tableros")
        cur_bcom     = conexion.cursor(); cur_bcom.execute("SELECT sku, material, modelo, color, foto_url, COALESCE(estado,'Disponible') FROM maestro_bases_comedor")
        cur_sillas   = conexion.cursor(); cur_sillas.execute("SELECT sku, material, modelo, color_estructura, foto_url, COALESCE(estado,'Disponible') FROM maestro_sillas")
        cur_butacas  = conexion.cursor(); cur_butacas.execute("SELECT sku, material, modelo, color_estructura, foto_url, COALESCE(estado,'Disponible') FROM maestro_butacas")

        telas         = [{"sku":r[0],"proveedor":r[1],"coleccion":r[2],"color":r[3],"foto_url":limpiar_foto(r[4]),"estado":r[5]} for r in cur_telas.fetchall()]
        cojines       = [{"sku":r[0],"nombre_diseno":r[1],"tipo_tela":r[2],"foto_url":limpiar_foto(r[3]),"estado":r[4]} for r in cur_cojines.fetchall()]
        bases         = [{"sku":r[0],"tipo":r[1],"material":r[2],"modelo":r[3],"color":r[4],"medida":r[5],"foto_url":limpiar_foto(r[6]),"estado":r[7]} for r in cur_bases.fetchall()]
        tableros      = [{"sku":r[0],"material_base":r[1],"nombre":r[2],"color":r[3],"acabado":r[4],"foto_url":limpiar_foto(r[5]),"estado":r[6]} for r in cur_tableros.fetchall()]
        bases_comedor = [{"sku":r[0],"material":r[1],"modelo":r[2],"color":r[3],"foto_url":limpiar_foto(r[4]),"estado":r[5]} for r in cur_bcom.fetchall()]
        sillas        = [{"sku":r[0],"material":r[1],"modelo":r[2],"color":r[3],"foto_url":limpiar_foto(r[4]),"estado":r[5]} for r in cur_sillas.fetchall()]
        butacas       = [{"sku":r[0],"material":r[1],"modelo":r[2],"color":r[3],"foto_url":limpiar_foto(r[4]),"estado":r[5]} for r in cur_butacas.fetchall()]

        for c in (cur_telas, cur_cojines, cur_bases, cur_tableros, cur_bcom, cur_sillas, cur_butacas):
            c.close()

        return jsonify({
            "telas": telas, "cojines": cojines, "bases": bases,
            "tableros": tableros, "bases_comedor": bases_comedor,
            "sillas": sillas, "butacas": butacas
        })
    except Exception as ex:
        print("Error en obtener_listas_materiales:", ex)
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            release_db_connection(conexion)


# ==========================================
# CREACIONES DE VENDEDORES (Módulo 5)
# ==========================================

@materiales_bp.route('/api/creaciones', methods=['POST'])
def guardar_creacion():
    try:
        vendedor_id       = request.form.get('vendedor_id', 1)
        nombre_modelo     = request.form.get('nombre_modelo')
        categoria         = request.form.get('categoria', 'Personalizado')
        detalles_tecnicos = request.form.get('detalles_tecnicos', '')
        notas_casqueria   = request.form.get('notas_casqueria', '')
        config_json       = request.form.get('config_json')

        if not nombre_modelo:
            return jsonify({'error': 'El nombre del modelo es obligatorio'}), 400

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO creaciones_vendedores
                (vendedor_id, nombre_modelo, categoria, detalles_tecnicos, notas_casqueria, config_json)
            VALUES (%s,%s,%s,%s,%s,%s) RETURNING id;
        """, (vendedor_id, nombre_modelo, categoria, detalles_tecnicos, notas_casqueria, config_json))
        creacion_id = cursor.fetchone()[0]

        for archivo in request.files.getlist('fotos'):
            if archivo and archivo.filename != '':
                respuesta_nube = cloudinary.uploader.upload(archivo, folder="creaciones")
                cursor.execute(
                    "INSERT INTO fotos_creaciones (creacion_id, foto_url) VALUES (%s,%s);",
                    (creacion_id, respuesta_nube.get('secure_url'))
                )
        conexion.commit()
        return jsonify({'mensaje': '¡Creación guardada con éxito!', 'creacion_id': creacion_id}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': 'Error interno del servidor'}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/creaciones', methods=['GET'])
def obtener_creaciones():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT c.id, c.nombre_modelo, c.categoria, c.detalles_tecnicos, c.notas_casqueria,
                   f.foto_url AS foto, c.config_json, c.estado
            FROM creaciones_vendedores c
            LEFT JOIN LATERAL (
                SELECT foto_url FROM fotos_creaciones WHERE creacion_id = c.id ORDER BY id LIMIT 1
            ) f ON true
            WHERE c.estado = 'Pendiente'
            ORDER BY c.fecha_creacion DESC;
        """)
        creaciones = [{
            "id": r[0], "nombre": r[1], "categoria": r[2], "detalles": r[3],
            "notas": r[4], "foto_url": limpiar_foto(r[5]), "config_json": r[6], "estado": r[7]
        } for r in cursor.fetchall()]
        return jsonify(creaciones), 200
    except Exception as e:
        return jsonify({'error': 'Error al cargar creaciones'}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/creaciones/aprobar', methods=['POST'])
def aprobar_creacion():
    data        = request.json
    creacion_id = data.get('creacion_id')
    origen      = data.get('origen', 'Interno')
    precio_base = data.get('precio_base', 0)
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT c.nombre_modelo,
                   (SELECT foto_url FROM fotos_creaciones WHERE creacion_id = c.id LIMIT 1)
            FROM creaciones_vendedores c WHERE c.id = %s;
        """, (creacion_id,))
        creacion = cursor.fetchone()
        if not creacion:
            return jsonify({'error': 'Creación no encontrada'}), 404
        nombre   = creacion[0]
        foto_url = limpiar_foto(creacion[1])
        cursor.execute("""
            INSERT INTO catalogo_productos (nombre_modelo, precio_base, foto_url, es_plantilla, en_stock, origen_produccion)
            VALUES (%s,%s,%s,False,False,%s);
        """, (nombre, precio_base, foto_url, origen))
        cursor.execute("UPDATE creaciones_vendedores SET estado = 'Aprobado' WHERE id = %s;", (creacion_id,))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Modelo aprobado y enviado al catálogo principal.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/creaciones/rechazar', methods=['POST'])
def rechazar_creacion():
    data        = request.json
    creacion_id = data.get('creacion_id')
    motivo      = data.get('motivo', '')
    if not creacion_id:
        return jsonify({'error': 'creacion_id es obligatorio'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("UPDATE creaciones_vendedores SET estado = 'Rechazado' WHERE id = %s;", (creacion_id,))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': f'Diseño rechazado. Motivo: {motivo}'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)