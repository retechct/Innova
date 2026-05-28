"""
routes_catalogo.py — Módulo 1: Catálogo, Insumos y Vouchers.
Blueprint: catalogo_bp  (sin prefijo de URL)
"""

import cloudinary.uploader
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto

catalogo_bp = Blueprint('catalogo', __name__)


# ==========================================
# CATÁLOGO DE PRODUCTOS
# ==========================================

@catalogo_bp.route('/api/catalogo', methods=['GET'])
def obtener_catalogo():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("""
            SELECT id, nombre_modelo, precio_base, foto_url,
                   es_plantilla, en_stock,
                   COALESCE(stock_cantidad, 0) AS stock_cantidad
            FROM catalogo_productos
        """)
        productos = cursor.fetchall()
        lista_productos = []
        for p in productos:
            lista_productos.append({
                "id":             p[0],
                "nombre":         p[1],
                "precio":         float(p[2]),
                "foto":           limpiar_foto(p[3]),
                "es_plantilla":   bool(p[4]),
                "en_stock":       bool(p[5]),
                "stock_cantidad": int(p[6]),
            })
        return jsonify(lista_productos)
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@catalogo_bp.route('/api/catalogo/nuevo', methods=['POST'])
def agregar_producto_directo():
    """Agrega un producto ya terminado (en stock) directo al catálogo."""
    try:
        nombre   = request.form.get('nombre')
        precio   = float(request.form.get('precio', 0))
        cantidad = int(request.form.get('cantidad', 1))
        origen   = request.form.get('origen', 'Externo')

        if 'foto' not in request.files or request.files['foto'].filename == '':
            return jsonify({'error': 'La foto del producto es obligatoria'}), 400

        foto_file = request.files['foto']
        respuesta_nube = cloudinary.uploader.upload(foto_file, folder="catalogo")
        foto_ruta = respuesta_nube.get('secure_url')

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO catalogo_productos
                (nombre_modelo, precio_base, foto_url, es_plantilla, en_stock, origen_produccion, stock_cantidad)
            VALUES (%s, %s, %s, False, %s, %s, %s)
        """, (nombre, precio, foto_ruta, cantidad > 0, origen, cantidad))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Producto añadido al catálogo'}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# INSUMOS
# ==========================================

@catalogo_bp.route('/api/insumos', methods=['GET'])
def obtener_insumos():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre_insumo, cantidad_actual FROM inventario_insumos ORDER BY nombre_insumo")
        insumos = [
            {"id": r[0], "nombre": r[1], "cantidad_actual": r[2]}
            for r in cursor.fetchall()
        ]
        return jsonify(insumos)
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# UPLOAD DE VOUCHERS
# ==========================================

@catalogo_bp.route('/api/upload-voucher', methods=['POST'])
def upload_voucher():
    if 'archivo' not in request.files or request.files['archivo'].filename == '':
        return jsonify({'error': 'No se recibió ningún archivo'}), 400
    try:
        archivo = request.files['archivo']
        respuesta_nube = cloudinary.uploader.upload(archivo, folder="vouchers_pagos")
        url = respuesta_nube.get('secure_url')
        return jsonify({'url': url}), 200
    except Exception as e:
        print(f"Error al subir voucher: {e}")
        return jsonify({'error': str(e)}), 500

# ==========================================
# UPLOAD DE FOTOS GENÉRICO
# ==========================================

@catalogo_bp.route('/api/upload-foto', methods=['POST'])
def upload_foto():
    if 'foto' not in request.files or request.files['foto'].filename == '':
        return jsonify({'error': 'No se recibió ningún archivo'}), 400
    try:
        archivo = request.files['foto']
        respuesta_nube = cloudinary.uploader.upload(archivo, folder="referencias")
        url = respuesta_nube.get('secure_url')
        return jsonify({'url': url}), 200
    except Exception as e:
        print(f"Error al subir foto: {e}")
        return jsonify({'error': str(e)}), 500