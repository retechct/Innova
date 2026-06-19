"""
routes_materiales.py — Módulos 4 y 5: Maestro de materiales (SKU/fotos) y creaciones.
Blueprint: materiales_bp  (sin prefijo de URL)

PLAN DE ACCIÓN B (Mayo 2026) — Cambios aplicados:
  B1 + B2: INSERT para 'base' y 'base-comedor' ahora guardan el campo 'acabado'.
           Los campos categóricos (tipo, material, acabado) se validan aquí.
  B3: Los 7 endpoints PUT para editar materiales por SKU son código real
      (antes estaban atrapados dentro de un triple-quoted string).
  Listas: Todas las consultas devuelven 'id' y 'acabado' donde aplica,
          para que las tarjetas de B3 puedan actualizar estado y editar.

MIGRACIÓN SQL REQUERIDA (solo una vez):
  Si las tablas ya existían antes de este cambio, ejecutar:
    ALTER TABLE maestro_bases         ADD COLUMN IF NOT EXISTS acabado VARCHAR(50) DEFAULT '';
    ALTER TABLE maestro_bases_comedor ADD COLUMN IF NOT EXISTS acabado VARCHAR(50) DEFAULT '';
"""

import cloudinary.uploader
from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection, limpiar_foto
from auth_middleware import requiere_login, requiere_rol

materiales_bp = Blueprint('materiales', __name__)


# ==========================================
# MAESTRO DE MATERIALES — NUEVO Y LISTAS
# ==========================================

@materiales_bp.route('/api/materiales/nuevo', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
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
            
            prov_id_str = request.form.get('proveedor_id')
            prov_id = int(prov_id_str) if prov_id_str and prov_id_str.strip() and prov_id_str != "null" else None

            cursor.execute("""
                INSERT INTO maestro_telas (sku, proveedor, coleccion, color, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible', %s) RETURNING id;
            """, (nuevo_sku, request.form.get('proveedor'), request.form.get('coleccion'),
                  request.form.get('color'), foto_ruta, origen, prov_id))

        elif tipo_material == 'cojin':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_disenos_cojin")
            nuevo_sku = f"COJ-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_cojin = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_disenos_cojin (sku, nombre_diseno, tipo_tela, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku, request.form.get('nombre_diseno'), request.form.get('tipo_tela'), foto_ruta, origen, prov_id_cojin))

        elif tipo_material == 'base':
            # B2: incluye 'acabado' (nuevo campo). Ver nota de migración SQL arriba.
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_bases")
            nuevo_sku = f"BAS-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_base = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_bases
                    (sku, tipo, material, modelo, color, medida_altura, acabado, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku,
                  request.form.get('tipo'),
                  request.form.get('material'),
                  request.form.get('modelo'),
                  request.form.get('color'),
                  request.form.get('medida_altura', ''),
                  request.form.get('acabado', ''),
                  foto_ruta, origen, prov_id_base))

        elif tipo_material == 'tablero':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_tableros")
            nuevo_sku = f"TAB-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_tab = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_tableros (sku, material_base, nombre_modelo, color_veta, acabado, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku, request.form.get('material_base'), request.form.get('nombre_modelo'),
                  request.form.get('color_veta'), request.form.get('acabado'), foto_ruta, origen, prov_id_tab))

        elif tipo_material == 'base-comedor':
            # B2: incluye 'acabado' (nuevo campo). Ver nota de migración SQL arriba.
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_bases_comedor")
            nuevo_sku = f"BAC-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_bac = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_bases_comedor
                    (sku, material, modelo, color, acabado, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku,
                  request.form.get('material'),
                  request.form.get('modelo'),
                  request.form.get('color'),
                  request.form.get('acabado', ''),
                  foto_ruta, origen, prov_id_bac))

        elif tipo_material == 'silla':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_sillas")
            nuevo_sku = f"SIL-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_sil = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_sillas (sku, material, modelo, color_estructura, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku, request.form.get('material'), request.form.get('modelo'),
                  request.form.get('color_estructura'), foto_ruta, origen, prov_id_sil))

        elif tipo_material == 'butaca':
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM maestro_butacas")
            nuevo_sku = f"BUT-{str(cursor.fetchone()[0]+1).zfill(4)}"
            prov_id_but = request.form.get('proveedor_id') or None
            cursor.execute("""
                INSERT INTO maestro_butacas (sku, material, modelo, color_estructura, foto_url, origen_produccion, estado, proveedor_id)
                VALUES (%s,%s,%s,%s,%s,%s,'Disponible',%s) RETURNING id;
            """, (nuevo_sku, request.form.get('material'), request.form.get('modelo'),
                  request.form.get('color_estructura'), foto_ruta, origen, prov_id_but))

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
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


@materiales_bp.route('/api/materiales/listas', methods=['GET'])
@requiere_login
def obtener_listas_materiales():
    """
    B3: Devuelve 'id' en todos los registros (necesario para actualizarEstadoInsumo).
        Devuelve 'acabado' en bases y bases_comedor (B2).
    """
    try:
        conexion = get_db_connection()

        cur_telas = conexion.cursor()
        cur_telas.execute("""
            SELECT id, sku, proveedor, coleccion, color,
                   foto_url, COALESCE(estado,'Disponible'), proveedor_id,
                   COALESCE(origen_produccion,'Externo')
            FROM maestro_telas
            ORDER BY id DESC
        """)

        cur_cojines = conexion.cursor()
        cur_cojines.execute("""
            SELECT id, sku, nombre_diseno, tipo_tela,
                   foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_disenos_cojin
            ORDER BY id DESC
        """)

        cur_bases = conexion.cursor()
        cur_bases.execute("""
            SELECT id, sku, tipo, material, modelo, color,
                   medida_altura, COALESCE(acabado,'') AS acabado,
                   foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_bases
            ORDER BY id DESC
        """)

        cur_tableros = conexion.cursor()
        cur_tableros.execute("""
            SELECT id, sku, material_base, nombre_modelo, color_veta,
                   acabado, foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_tableros
            ORDER BY id DESC
        """)

        cur_bcom = conexion.cursor()
        cur_bcom.execute("""
            SELECT id, sku, material, modelo, color,
                   COALESCE(acabado,'') AS acabado,
                   foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_bases_comedor
            ORDER BY id DESC
        """)

        cur_sillas = conexion.cursor()
        cur_sillas.execute("""
            SELECT id, sku, material, modelo, color_estructura,
                   foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_sillas
            ORDER BY id DESC
        """)

        cur_butacas = conexion.cursor()
        cur_butacas.execute("""
            SELECT id, sku, material, modelo, color_estructura,
                   foto_url, COALESCE(estado,'Disponible'),
                   COALESCE(origen_produccion,'Externo'), proveedor_id
            FROM maestro_butacas
            ORDER BY id DESC
        """)

        telas = [{
            "id": r[0], "sku": r[1], "proveedor": r[2], "coleccion": r[3],
            "color": r[4], "foto_url": limpiar_foto(r[5]), "estado": r[6],
            "proveedor_id": r[7], "origen_produccion": r[8], "categoria": "TELA"
        } for r in cur_telas.fetchall()]

        cojines = [{
            "id": r[0], "sku": r[1], "nombre_diseno": r[2], "tipo_tela": r[3],
            "foto_url": limpiar_foto(r[4]), "estado": r[5],
            "origen_produccion": r[6], "proveedor_id": r[7], "categoria": "COJIN"
        } for r in cur_cojines.fetchall()]

        bases = [{
            "id": r[0], "sku": r[1], "tipo": r[2], "material": r[3],
            "modelo": r[4], "color": r[5], "medida": r[6], "acabado": r[7],
            "foto_url": limpiar_foto(r[8]), "estado": r[9],
            "origen_produccion": r[10], "proveedor_id": r[11], "categoria": "BASE"
        } for r in cur_bases.fetchall()]

        tableros = [{
            "id": r[0], "sku": r[1], "material_base": r[2], 
            "nombre": r[3], "nombre_modelo": r[3],   # ← mismo valor, dos claves
            "color": r[4], "acabado": r[5], "foto_url": limpiar_foto(r[6]),
            "estado": r[7], "origen_produccion": r[8], "proveedor_id": r[9], "categoria": "TABLERO"
        } for r in cur_tableros.fetchall()]

        bases_comedor = [{
            "id": r[0], "sku": r[1], "material": r[2], "modelo": r[3],
            "color": r[4], "acabado": r[5], "foto_url": limpiar_foto(r[6]),
            "estado": r[7], "origen_produccion": r[8], "proveedor_id": r[9], "categoria": "BASE-COMEDOR"
        } for r in cur_bcom.fetchall()]

        sillas = [{
            "id": r[0], "sku": r[1], "material": r[2], "modelo": r[3],
            "color": r[4], "foto_url": limpiar_foto(r[5]),
            "estado": r[6], "origen_produccion": r[7], "proveedor_id": r[8], "categoria": "SILLA"
        } for r in cur_sillas.fetchall()]

        butacas = [{
            "id": r[0], "sku": r[1], "material": r[2], "modelo": r[3],
            "color": r[4], "foto_url": limpiar_foto(r[5]),
            "estado": r[6], "origen_produccion": r[7], "proveedor_id": r[8], "categoria": "BUTACA"
        } for r in cur_butacas.fetchall()]

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


@materiales_bp.route('/api/materiales/maestro/buscar', methods=['GET'])
@requiere_login
def buscar_maestro_por_modelo():
    """
    Devuelve la foto_url del maestro que coincide con tipo + nombre de modelo.
    Query params:
      ?tipo=tablero|silla|butaca|base-comedor|base-consola|base-mesa-centro
      &modelo=Nombre%20del%20modelo
    Respuesta: { "foto_url": "https://..." }  o  { "error": "..." }

    Usado por el frontend como fallback cuando una unidad física no tiene foto_url.
    """
    tipo   = (request.args.get('tipo')   or '').lower().strip()
    modelo = (request.args.get('modelo') or '').strip()

    if not tipo or not modelo:
        return jsonify({'error': 'Los parámetros tipo y modelo son obligatorios'}), 400

    # Mapa: tipo → (tabla, columna_nombre_modelo)
    # base-consola y base-mesa-centro comparten la tabla maestro_bases_comedor
    TABLA_MAP = {
        'tablero':          ('maestro_tableros',     'nombre_modelo'),
        'silla':            ('maestro_sillas',        'modelo'),
        'butaca':           ('maestro_butacas',       'modelo'),
        'base-comedor':     ('maestro_bases_comedor', 'modelo'),
        'base-consola':     ('maestro_bases_comedor', 'modelo'),
        'base-mesa-centro': ('maestro_bases_comedor', 'modelo'),
    }

    info = TABLA_MAP.get(tipo)
    if not info:
        return jsonify({'error': f'Tipo de maestro no reconocido: {tipo}'}), 400

    tabla, col_nombre = info
    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute(
            f"SELECT foto_url FROM {tabla} WHERE LOWER({col_nombre}) = LOWER(%s) LIMIT 1",
            (modelo,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Maestro no encontrado'}), 404
        return jsonify({'foto_url': limpiar_foto(row[0]) or ''}), 200
    except Exception as ex:
        print(f"[buscar_maestro_por_modelo] Error: {ex}")
        return jsonify({'error': str(ex)}), 500
    finally:
        if conexion:
            cursor.close()
            release_db_connection(conexion)


# ==========================================
# CREACIONES DE VENDEDORES (Módulo 5)
# ==========================================

@materiales_bp.route('/api/creaciones', methods=['POST'])
@requiere_login
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
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


@materiales_bp.route('/api/creaciones', methods=['GET'])
@requiere_login
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
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


@materiales_bp.route('/api/creaciones/aprobar', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
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
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


@materiales_bp.route('/api/creaciones/rechazar', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
def rechazar_creacion():
    data        = request.json
    creacion_id = data.get('creacion_id')
    motivo      = (data.get('motivo') or '').strip()
    if not creacion_id:
        return jsonify({'error': 'creacion_id es obligatorio'}), 400
    if not motivo:
        return jsonify({'error': 'El motivo de rechazo es obligatorio'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        # Añadir columna motivo_rechazo si no existe (migración segura)
        cursor.execute("""
            ALTER TABLE creaciones_vendedores
            ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
        """)
        cursor.execute("""
            UPDATE creaciones_vendedores
            SET estado = 'Rechazado', motivo_rechazo = %s
            WHERE id = %s;
        """, (motivo, creacion_id))
        conexion.commit()
        return jsonify({'exito': True, 'mensaje': f'Modelo rechazado. Motivo: {motivo}'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            if 'cursor' in locals() and cursor: cursor.close()
            release_db_connection(conexion)


# ==========================================
# B3 — EDICIÓN DE MATERIALES POR SKU (PUT)
# ==========================================
# Helper genérico — evita 7 bloques idénticos.
# Solo actualiza los campos presentes en el JSON que estén en campos_permitidos.

def _actualizar_tabla(tabla: str, sku_columna: str, sku: str, campos_permitidos: list) -> tuple:
    data = request.get_json(silent=True) or {}
    updates = {k: v for k, v in data.items() if k in campos_permitidos}

    if not updates:
        return {"error": "No se enviaron campos válidos para actualizar."}, 400

    set_clause = ", ".join(f"{col} = %s" for col in updates)
    values     = list(updates.values()) + [sku]

    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute(f"SELECT 1 FROM {tabla} WHERE {sku_columna} = %s;", (sku,))
        if not cursor.fetchone():
            return {"error": f"No se encontró ningún registro con SKU '{sku}'."}, 404
        cursor.execute(f"UPDATE {tabla} SET {set_clause} WHERE {sku_columna} = %s;", values)
        conexion.commit()
        return {"exito": True, "sku": sku}, 200
    except Exception as ex:
        if conexion: conexion.rollback()
        print(f"[PUT {tabla}] Error: {ex}")
        return {"error": str(ex)}, 500
    finally:
        if conexion:
            cursor.close()
            release_db_connection(conexion)


@materiales_bp.route('/api/materiales/telas/<string:sku>', methods=['PUT'])
@requiere_login
def editar_tela(sku):
    """B3: Actualiza una tela por SKU. Campos: proveedor, coleccion, color, foto_url, estado, proveedor_id"""
    resp, status = _actualizar_tabla(
        tabla='maestro_telas', sku_columna='sku', sku=sku,
        campos_permitidos=['proveedor', 'coleccion', 'color', 'foto_url', 'estado', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/cojines/<string:sku>', methods=['PUT'])
@requiere_login
def editar_cojin(sku):
    """B3: Actualiza un diseño de cojín por SKU. Campos: nombre_diseno, tipo_tela, foto_url, estado"""
    resp, status = _actualizar_tabla(
        tabla='maestro_disenos_cojin', sku_columna='sku', sku=sku,
        campos_permitidos=['nombre_diseno', 'tipo_tela', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/bases/<string:sku>', methods=['PUT'])
@requiere_login
def editar_base(sku):
    """
    B3: Actualiza una base de sofá por SKU.
    B2: 'tipo' solo acepta: Zócalo / Patas / Combinado (Zócalo + Patas)
    """
    data = request.get_json(silent=True) or {}
    tipo = data.get('tipo', '')
    if tipo and tipo not in {'Zócalo', 'Patas', 'Combinado (Zócalo + Patas)'}:
        return jsonify({"error": f"Tipo de base no válido: '{tipo}'. "
                                 "Opciones: Zócalo / Patas / Combinado (Zócalo + Patas)"}), 400
    resp, status = _actualizar_tabla(
        tabla='maestro_bases', sku_columna='sku', sku=sku,
        campos_permitidos=['tipo', 'material', 'modelo', 'color',
                           'medida_altura', 'acabado', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/bases-comedor/<string:sku>', methods=['PUT'])
@requiere_login
def editar_base_comedor(sku):
    """
    B3: Actualiza una base de comedor por SKU.
    B2: 'tipo' NO es editable en BASE-COMEDOR (siempre es 'Base de Comedor').
    """
    resp, status = _actualizar_tabla(
        tabla='maestro_bases_comedor', sku_columna='sku', sku=sku,
        campos_permitidos=['material', 'modelo', 'color', 'acabado', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/tableros/<string:sku>', methods=['PUT'])
@requiere_login
def editar_tablero(sku):
    """B3: Actualiza un tablero por SKU. Campos: material_base, nombre_modelo, color_veta, acabado, foto_url, estado"""
    resp, status = _actualizar_tabla(
        tabla='maestro_tableros', sku_columna='sku', sku=sku,
        campos_permitidos=['material_base', 'nombre_modelo', 'color_veta',
                           'acabado', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/sillas/<string:sku>', methods=['PUT'])
@requiere_login
def editar_silla(sku):
    """
    B3: Actualiza una estructura de silla por SKU.
    B1: 'material' solo acepta: Madera / Madera MDF / Acero / Fierro / Aluminio / Polipropileno
    """
    data     = request.get_json(silent=True) or {}
    material = data.get('material', '')
    if material and material not in {'Madera', 'Madera MDF', 'Acero', 'Fierro', 'Aluminio', 'Polipropileno'}:
        return jsonify({"error": f"Material no válido para silla: '{material}'."}), 400
    resp, status = _actualizar_tabla(
        tabla='maestro_sillas', sku_columna='sku', sku=sku,
        campos_permitidos=['material', 'modelo', 'color_estructura', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status


@materiales_bp.route('/api/materiales/butacas/<string:sku>', methods=['PUT'])
@requiere_login
def editar_butaca(sku):
    """
    B3: Actualiza una estructura de butaca por SKU.
    B1: 'material' solo acepta: Madera / Acero / Fierro / Aluminio
    """
    data     = request.get_json(silent=True) or {}
    material = data.get('material', '')
    if material and material not in {'Madera', 'Acero', 'Fierro', 'Aluminio'}:
        return jsonify({"error": f"Material no válido para butaca: '{material}'."}), 400
    resp, status = _actualizar_tabla(
        tabla='maestro_butacas', sku_columna='sku', sku=sku,
        campos_permitidos=['material', 'modelo', 'color_estructura', 'foto_url', 'estado', 'origen_produccion', 'proveedor_id']
    )
    return jsonify(resp), status

# ══════════════════════════════════════════════════════════════════
# DISEÑOS DE REFERENCIA (Pinterest / Inspiración)
# ══════════════════════════════════════════════════════════════════

def _ensure_disenos_referencia(cursor):
    """Auto-crea la tabla si no existe (migración segura)."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS disenos_referencia (
            id              SERIAL PRIMARY KEY,
            nombre          VARCHAR(200) NOT NULL,
            categoria       VARCHAR(100),
            descripcion     TEXT,
            foto_url        TEXT,
            url_pinterest   TEXT,
            vendedor        VARCHAR(150),
            estado          VARCHAR(20) DEFAULT 'Pendiente',
            motivo_rechazo  TEXT,
            fecha_creacion  TIMESTAMP DEFAULT NOW()
        );
    """)


@materiales_bp.route('/api/disenos-referencia', methods=['POST'])
@requiere_login
def subir_diseno_referencia():
    """
    Vendedor sube un diseño de referencia (foto de Pinterest u otra fuente).
    Espera multipart/form-data con:
      - nombre        (str, obligatorio)
      - categoria     (str, ej: 'Sofá', 'Comedor', 'Tela')
      - descripcion   (str, opcional)
      - url_pinterest (str, opcional)
      - vendedor      (str)
      - foto          (file, obligatorio)
    """
    import cloudinary.uploader
    from auth_middleware import get_usuario_actual
    try:
        nombre        = (request.form.get('nombre') or '').strip()
        categoria     = (request.form.get('categoria') or 'General').strip()
        descripcion   = (request.form.get('descripcion') or '').strip()
        url_pinterest = (request.form.get('url_pinterest') or '').strip()
        usuario       = get_usuario_actual()
        vendedor      = usuario.get('nombre', request.form.get('vendedor', 'Vendedor'))

        if not nombre:
            return jsonify({'error': 'El nombre del diseño es obligatorio.'}), 400
        if 'foto' not in request.files or request.files['foto'].filename == '':
            return jsonify({'error': 'La foto de referencia es obligatoria.'}), 400

        foto_file  = request.files['foto']
        resultado  = cloudinary.uploader.upload(foto_file, folder='disenos_referencia')
        foto_url   = resultado.get('secure_url')

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_disenos_referencia(cursor)
        cursor.execute("""
            INSERT INTO disenos_referencia
                (nombre, categoria, descripcion, foto_url, url_pinterest, vendedor, estado)
            VALUES (%s, %s, %s, %s, %s, %s, 'Pendiente')
            RETURNING id;
        """, (nombre, categoria, descripcion, foto_url, url_pinterest, vendedor))
        nuevo_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': nuevo_id,
                        'mensaje': f'Diseño "{nombre}" enviado para aprobación.'}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/disenos-referencia', methods=['GET'])
@requiere_login
def listar_disenos_referencia():
    """
    Devuelve todos los diseños de referencia.
    Query param opcional: ?estado=Pendiente|Aprobado|Rechazado
    """
    estado_filtro = request.args.get('estado', None)
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_disenos_referencia(cursor)
        if estado_filtro:
            cursor.execute("""
                SELECT id, nombre, categoria, descripcion, foto_url,
                       url_pinterest, vendedor, estado, motivo_rechazo,
                       TO_CHAR(fecha_creacion, 'DD/MM/YYYY') AS fecha
                FROM disenos_referencia
                WHERE estado = %s
                ORDER BY fecha_creacion DESC;
            """, (estado_filtro,))
        else:
            cursor.execute("""
                SELECT id, nombre, categoria, descripcion, foto_url,
                       url_pinterest, vendedor, estado, motivo_rechazo,
                       TO_CHAR(fecha_creacion, 'DD/MM/YYYY') AS fecha
                FROM disenos_referencia
                ORDER BY fecha_creacion DESC;
            """)
        rows = cursor.fetchall()
        return jsonify([{
            'id':            r[0],
            'nombre':        r[1],
            'categoria':     r[2] or '',
            'descripcion':   r[3] or '',
            'foto_url':      r[4] or '',
            'url_pinterest': r[5] or '',
            'vendedor':      r[6] or '',
            'estado':        r[7] or 'Pendiente',
            'motivo_rechazo': r[8] or '',
            'fecha':         r[9] or '',
        } for r in rows]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/disenos-referencia/aprobar', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
def aprobar_diseno_referencia():
    """Admin aprueba un diseño → estado = 'Aprobado'."""
    data = request.get_json(silent=True) or {}
    diseno_id = data.get('diseno_id')
    if not diseno_id:
        return jsonify({'error': 'diseno_id es requerido.'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_disenos_referencia(cursor)
        cursor.execute("""
            UPDATE disenos_referencia
            SET estado = 'Aprobado', motivo_rechazo = NULL
            WHERE id = %s
            RETURNING nombre;
        """, (diseno_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Diseño no encontrado.'}), 404
        conexion.commit()
        return jsonify({'exito': True,
                        'mensaje': f'Diseño "{row[0]}" aprobado y disponible como referencia.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@materiales_bp.route('/api/disenos-referencia/rechazar', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
def rechazar_diseno_referencia():
    """Admin rechaza un diseño → estado = 'Rechazado' + motivo."""
    data = request.get_json(silent=True) or {}
    diseno_id = data.get('diseno_id')
    motivo    = (data.get('motivo') or '').strip()
    if not diseno_id:
        return jsonify({'error': 'diseno_id es requerido.'}), 400
    if not motivo:
        return jsonify({'error': 'Debes indicar un motivo de rechazo.'}), 400
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_disenos_referencia(cursor)
        cursor.execute("""
            UPDATE disenos_referencia
            SET estado = 'Rechazado', motivo_rechazo = %s
            WHERE id = %s
            RETURNING nombre;
        """, (motivo, diseno_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Diseño no encontrado.'}), 404
        conexion.commit()
        return jsonify({'exito': True,
                        'mensaje': f'Diseño "{row[0]}" rechazado.'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)