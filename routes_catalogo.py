"""
routes_catalogo.py — Módulo 1: Catálogo, Insumos y Vouchers.
Blueprint: catalogo_bp  (sin prefijo de URL)
"""

import json
import cloudinary.uploader
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto, cloudinary_upload
from auth_middleware import requiere_login, requiere_rol

catalogo_bp = Blueprint('catalogo', __name__)


def _asegurar_columnas_catalogo(cursor):
    cursor.execute("""
        ALTER TABLE catalogo_productos
            ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Sofá',
            ADD COLUMN IF NOT EXISTS fotos_urls TEXT DEFAULT '',
            ADD COLUMN IF NOT EXISTS config_json JSONB,
            ADD COLUMN IF NOT EXISTS requiere_tela BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS observaciones TEXT
    """)


# ==========================================
# CATÁLOGO DE PRODUCTOS
# ==========================================

@catalogo_bp.route('/api/catalogo', methods=['GET'])
def obtener_catalogo():
    try:
        q = request.args.get('q', '').strip().lower()
        categoria = request.args.get('categoria', '').strip()
        modo = request.args.get('modo', '').strip().lower()
        try:
            limit = min(max(int(request.args.get('limit', 0)), 0), 1000)
        except (TypeError, ValueError):
            limit = 0

        conexion = get_db_connection()
        cursor = conexion.cursor()
        # Asegurar columnas categoria y fotos_urls existen (migración lazy)
        _asegurar_columnas_catalogo(cursor)
        conexion.commit()
        where, params = [], []
        if q:
            where.append("(LOWER(nombre_modelo) LIKE %s OR LOWER(COALESCE(observaciones, '')) LIKE %s)")
            params.extend([f"%{q}%", f"%{q}%"])
        if categoria:
            where.append("COALESCE(categoria, 'Sofá') = %s")
            params.append(categoria)
        if modo == 'plantillas':
            where.append("es_plantilla = TRUE")
        elif modo == 'catalogo':
            where.append("COALESCE(en_stock, FALSE) = FALSE AND COALESCE(es_plantilla, FALSE) = FALSE")
        elif modo == 'stock':
            where.append("COALESCE(en_stock, FALSE) = TRUE")

        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        limit_sql = "LIMIT %s" if limit else ""
        if limit:
            params.append(limit)

        cursor.execute(f"""
            SELECT id, nombre_modelo, precio_base, foto_url,
                   es_plantilla, en_stock,
                   COALESCE(stock_cantidad, 0) AS stock_cantidad,
                   COALESCE(categoria, 'Sofá') AS categoria,
                   COALESCE(fotos_urls, '') AS fotos_urls,
                   config_json,
                   requiere_tela,
                   observaciones
            FROM catalogo_productos
            {where_sql}
            ORDER BY es_plantilla DESC, nombre_modelo ASC
            {limit_sql}
        """, params)
        productos = cursor.fetchall()
        lista_productos = []
        for p in productos:
            # foto principal: primer elemento de fotos_urls si existe, si no foto_url
            foto_principal = limpiar_foto(p[3])
            fotos_extra = [f for f in (p[8] or '').split('|') if f.strip()]
            # Construir lista completa de fotos sin duplicar
            todas_fotos = []
            if foto_principal:
                todas_fotos.append(foto_principal)
            for f in fotos_extra:
                if f not in todas_fotos:
                    todas_fotos.append(f)
            lista_productos.append({
                "id":             p[0],
                "nombre":         p[1],
                "precio":         float(p[2]),
                "foto":           foto_principal,
                "fotos":          todas_fotos,
                "es_plantilla":   bool(p[4]),
                "en_stock":       bool(p[5]),
                "stock_cantidad": int(p[6]),
                "categoria":      p[7] or 'Sofá',
                "config_json":    p[9],
                "requiere_tela":  bool(p[10]),
                "observaciones":  p[11] or ''
            })
        return jsonify(lista_productos)
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@catalogo_bp.route('/api/catalogo/plantilla', methods=['POST'])
@requiere_login
def agregar_plantilla_catalogo():
    """Registra un modelo de la carta (es_plantilla=True) con múltiples fotos y categoría."""
    try:
        nombre    = request.form.get('nombre', '').strip()
        precio    = float(request.form.get('precio', 0) or 0)
        categoria = request.form.get('categoria', 'Sofá').strip()
        observaciones = request.form.get('observaciones', '').strip()
        tipo_config = request.form.get('tipo_config', '').strip()
        config_json = {'tipo_config': tipo_config} if tipo_config else None

        if not nombre:
            return jsonify({'error': 'El nombre del modelo es obligatorio'}), 400

        fotos = request.files.getlist('fotos')
        fotos = [f for f in fotos if f and f.filename]
        if not fotos:
            return jsonify({'error': 'Debes subir al menos una foto del modelo'}), 400

        urls_subidas = []
        for f in fotos:
            res = cloudinary_upload(f, folder="catalogo_plantillas")
            urls_subidas.append(res.get('secure_url'))

        foto_principal = urls_subidas[0]
        fotos_urls_str = '|'.join(urls_subidas[1:]) if len(urls_subidas) > 1 else ''

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_columnas_catalogo(cursor)
        cursor.execute("""
            INSERT INTO catalogo_productos
                (nombre_modelo, precio_base, foto_url, fotos_urls, categoria, observaciones,
                 config_json, es_plantilla, en_stock, origen_produccion, stock_cantidad)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, True, False, 'Producción', 0)
            RETURNING id
        """, (nombre, precio, foto_principal, fotos_urls_str, categoria, observaciones,
              json.dumps(config_json) if config_json else None))
        nuevo_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': nuevo_id, 'mensaje': f'Modelo "{nombre}" añadido a la carta'}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@catalogo_bp.route('/api/catalogo/modelo/<int:producto_id>', methods=['PUT'])
@catalogo_bp.route('/api/catalogo/plantilla/<int:producto_id>', methods=['PUT'])
@requiere_rol('Admin')
def editar_plantilla_catalogo(producto_id):
    """Edita un modelo publicado sin cambiar su ID ni las ventas existentes."""
    try:
        nombre = request.form.get('nombre', '').strip()
        categoria = request.form.get('categoria', 'Sofá').strip()
        observaciones = request.form.get('observaciones', '').strip()
        tipo_config = request.form.get('tipo_config', '').strip()
        reemplazar_fotos = str(request.form.get('reemplazar_fotos', '')).lower() in ('1', 'true', 'si')
        precio = float(request.form.get('precio', 0) or 0)

        if not nombre:
            return jsonify({'error': 'El nombre del modelo es obligatorio'}), 400

        conexion = get_db_connection()
        cursor = conexion.cursor()
        _asegurar_columnas_catalogo(cursor)

        cursor.execute("""
            SELECT foto_url, COALESCE(fotos_urls, ''), config_json
            FROM catalogo_productos
            WHERE id = %s
        """, (producto_id,))
        actual = cursor.fetchone()
        if not actual:
            return jsonify({'error': 'Producto no encontrado'}), 404

        foto_principal = actual[0] or ''
        fotos_urls_str = actual[1] or ''
        fotos = [f for f in request.files.getlist('fotos') if f and f.filename]
        if fotos:
            urls_subidas = []
            for f in fotos:
                res = cloudinary_upload(f, folder="catalogo_plantillas")
                urls_subidas.append(res.get('secure_url'))
            if reemplazar_fotos:
                foto_principal = urls_subidas[0]
                fotos_urls_str = '|'.join(urls_subidas[1:]) if len(urls_subidas) > 1 else ''
            else:
                actuales = [foto_principal] + [f for f in fotos_urls_str.split('|') if f.strip()]
                combinadas = []
                for url in actuales + urls_subidas:
                    if url and url not in combinadas:
                        combinadas.append(url)
                foto_principal = combinadas[0] if combinadas else ''
                fotos_urls_str = '|'.join(combinadas[1:]) if len(combinadas) > 1 else ''

        config_json = actual[2] or {}
        if isinstance(config_json, str):
            try:
                config_json = json.loads(config_json) if config_json else {}
            except Exception:
                config_json = {}
        if tipo_config:
            config_json['tipo_config'] = tipo_config
        else:
            config_json.pop('tipo_config', None)
        config_json_final = json.dumps(config_json) if config_json else None
        cursor.execute("""
            UPDATE catalogo_productos
            SET nombre_modelo = %s,
                precio_base = %s,
                foto_url = %s,
                fotos_urls = %s,
                categoria = %s,
                observaciones = %s,
                config_json = %s::jsonb
            WHERE id = %s
        """, (
            nombre, precio, foto_principal, fotos_urls_str,
            categoria, observaciones,
            config_json_final,
            producto_id
        ))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': f'Modelo "{nombre}" actualizado'}), 200

    except Exception as e:
        if 'conexion' in locals() and conexion:
            conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@catalogo_bp.route('/api/catalogo/plantilla/<int:producto_id>', methods=['DELETE'])
@requiere_rol('Admin')
def eliminar_plantilla_catalogo(producto_id):
    """Elimina un modelo de la carta (solo si es_plantilla=True y no tiene ventas)."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT es_plantilla FROM catalogo_productos WHERE id = %s", (producto_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Producto no encontrado'}), 404
        if not row[0]:
            return jsonify({'error': 'Solo se pueden eliminar modelos de la carta'}), 400
        cursor.execute("DELETE FROM catalogo_productos WHERE id = %s", (producto_id,))
        conexion.commit()
        return jsonify({'exito': True}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@catalogo_bp.route('/api/catalogo/nuevo', methods=['POST'])
@requiere_login
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
        respuesta_nube = cloudinary_upload(foto_file, folder="catalogo")
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
@requiere_login
def upload_voucher():
    if 'archivo' not in request.files or request.files['archivo'].filename == '':
        return jsonify({'error': 'No se recibió ningún archivo'}), 400
    try:
        archivo = request.files['archivo']
        respuesta_nube = cloudinary_upload(archivo, folder="vouchers_pagos", max_width=1600)
        url = respuesta_nube.get('secure_url')
        return jsonify({'url': url}), 200
    except Exception as e:
        print(f"Error al subir voucher: {e}")
        return jsonify({'error': str(e)}), 500

# ==========================================
# UPLOAD DE FOTOS GENÉRICO
# ==========================================

@catalogo_bp.route('/api/upload-foto', methods=['POST'])
@requiere_login
def upload_foto():
    if 'foto' not in request.files or request.files['foto'].filename == '':
        return jsonify({'error': 'No se recibió ningún archivo'}), 400
    try:
        archivo = request.files['foto']
        respuesta_nube = cloudinary_upload(archivo, folder="referencias")
        url = respuesta_nube.get('secure_url')
        return jsonify({'url': url}), 200
    except Exception as e:
        print(f"Error al subir foto: {e}")
        return jsonify({'error': str(e)}), 500
