"""
routes_clientes.py — Clientes del landing público.

Los clientes NO son usuarios del ERP. Se guardan en la tabla `clientes`
(separada de `usuarios`) sin aprobación y sin acceso al sistema interno.

Endpoints:
  POST /api/clientes/registro   → registro desde el landing (sin aprobación)
  GET  /api/clientes/buscar     → autocomplete para el vendedor al crear una venta
  GET  /api/clientes            → lista completa (solo Admin)

Tabla esperada en PostgreSQL (créala con el script de abajo si no existe):

    CREATE TABLE IF NOT EXISTS clientes (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(150) NOT NULL,
        email       VARCHAR(120),
        telefono    VARCHAR(20),
        dni         VARCHAR(20),
        direccion   TEXT,
        fecha_alta  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (LOWER(nombre));
    CREATE INDEX IF NOT EXISTS idx_clientes_email  ON clientes (LOWER(email));
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection

clientes_bp = Blueprint('clientes', __name__)


# ─── Helper: crear tabla si no existe (auto-migración segura) ─────────────────

def _ensure_tabla_clientes(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id         SERIAL PRIMARY KEY,
            nombre     VARCHAR(150) NOT NULL,
            email      VARCHAR(120),
            telefono   VARCHAR(20),
            dni        VARCHAR(20),
            direccion  TEXT,
            fecha_alta TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (LOWER(nombre));
        CREATE INDEX IF NOT EXISTS idx_clientes_email  ON clientes (LOWER(email));
    """)


# ==========================================
# REGISTRO PÚBLICO — sin aprobación
# ==========================================

@clientes_bp.route('/api/clientes/registro', methods=['POST'])
def registrar_cliente():
    """
    Llamado desde el landing público.
    No requiere autenticación. No requiere aprobación.
    Si el correo ya existe, devuelve los datos actuales (idempotente).
    """
    data     = request.json or {}
    nombre   = (data.get('nombre')   or '').strip()
    email    = (data.get('email')    or '').strip().lower()
    telefono = (data.get('telefono') or '').strip()
    dni      = (data.get('dni')      or '').strip()
    direccion = (data.get('direccion') or '').strip()

    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_tabla_clientes(cursor)

        # Si ya existe por email, no duplicar — solo devolver id
        if email:
            cursor.execute("SELECT id FROM clientes WHERE LOWER(email) = %s;", (email,))
            existente = cursor.fetchone()
            if existente:
                cursor.close(); release_db_connection(conexion)
                return jsonify({
                    'exito':   True,
                    'id':      existente[0],
                    'mensaje': 'Ya estás registrado. ¡Bienvenido de vuelta!'
                }), 200

        cursor.execute("""
            INSERT INTO clientes (nombre, email, telefono, dni, direccion)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """, (nombre, email or None, telefono or None, dni or None, direccion or None))
        nuevo_id = cursor.fetchone()[0]
        conexion.commit()
        cursor.close(); release_db_connection(conexion)

        return jsonify({
            'exito':   True,
            'id':      nuevo_id,
            'mensaje': '¡Registro exitoso! Pronto un asesor se pondrá en contacto contigo.'
        }), 201

    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500


# ==========================================
# BÚSQUEDA / AUTOCOMPLETE (para el vendedor)
# ==========================================

@clientes_bp.route('/api/clientes/buscar', methods=['GET'])
def buscar_clientes():
    """
    Devuelve hasta 8 clientes cuyo nombre o DNI contenga el texto buscado.
    Usado por el campo #c-nombre del carrito para autocompletar.

    Query param: ?q=texto
    """
    q = (request.args.get('q') or '').strip()
    if len(q) < 2:
        return jsonify([]), 200

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_tabla_clientes(cursor)
        cursor.execute("""
            SELECT id, nombre, email, telefono, dni, direccion
            FROM clientes
            WHERE LOWER(nombre) LIKE %s
               OR dni LIKE %s
            ORDER BY nombre ASC
            LIMIT 8;
        """, (f'%{q.lower()}%', f'%{q}%'))

        resultados = [{
            'id':        r[0],
            'nombre':    r[1],
            'email':     r[2] or '',
            'telefono':  r[3] or '',
            'dni':       r[4] or '',
            'direccion': r[5] or '',
        } for r in cursor.fetchall()]

        return jsonify(resultados), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# LISTA COMPLETA (solo Admin)
# ==========================================

@clientes_bp.route('/api/clientes', methods=['GET'])
def listar_clientes():
    """Lista paginada de todos los clientes registrados."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _ensure_tabla_clientes(cursor)
        cursor.execute("""
            SELECT id, nombre, email, telefono, dni, direccion,
                   TO_CHAR(fecha_alta, 'DD/MM/YYYY') AS fecha
            FROM clientes
            ORDER BY fecha_alta DESC
            LIMIT 500;
        """)
        clientes = [{
            'id':        r[0],
            'nombre':    r[1],
            'email':     r[2] or '',
            'telefono':  r[3] or '',
            'dni':       r[4] or '',
            'direccion': r[5] or '',
            'fecha_alta': r[6] or '',
        } for r in cursor.fetchall()]
        return jsonify(clientes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)