"""
routes_clientes.py — Clientes del landing público.

DECISIÓN A6 (actualizada en julio de 2026):
  - El flujo oficial de REGISTRO con cuenta y contraseña es:
      POST /api/usuarios/registrar-web  (en routes_usuarios.py)
    Permite al cliente hacer login y rastrear sus pedidos.

  - Este módulo conserva solo:
      GET  /api/clientes/buscar   → autocomplete para el vendedor al crear una venta
      GET  /api/clientes          → lista completa (solo Admin)

  POST /api/clientes/registro es solo para el alta comercial desde el ERP y
  nunca inventa una contraseña. El cliente activa después esa misma ficha en
  /api/usuarios/registrar-web validando su DNI o teléfono.

Tabla esperada en PostgreSQL:

    CREATE TABLE IF NOT EXISTS clientes (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(150) NOT NULL,
        email       VARCHAR(120),
        telefono    VARCHAR(20),
        dni         VARCHAR(20),
        direccion   TEXT,
        contrasena  VARCHAR(255),
        fecha_alta  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (LOWER(nombre));
    CREATE INDEX IF NOT EXISTS idx_clientes_email  ON clientes (LOWER(email));
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection
from auth_middleware import requiere_login, requiere_rol

clientes_bp = Blueprint('clientes', __name__)


# ==========================================
# BÚSQUEDA / AUTOCOMPLETE (para el vendedor)
# ==========================================

@clientes_bp.route('/api/clientes/buscar', methods=['GET'])
@requiere_login
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


@clientes_bp.route('/api/clientes/registro', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller', 'Vendedor')
def registrar_cliente_desde_erp():
    """Registra un cliente comercial sin inventarle una contraseña web."""
    data = request.get_json(silent=True) or {}
    nombre = (data.get('nombre') or '').strip()
    email = (data.get('email') or '').strip().lower()
    telefono = (data.get('telefono') or '').strip()
    dni = (data.get('dni') or '').strip()
    direccion = (data.get('direccion') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    conexion = None
    cursor = None
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        claves = [f'cliente-email:{email}' if email else '', f'cliente-dni:{dni}' if dni else '']
        if not any(claves):
            claves.append(f'cliente-nombre:{nombre.lower()}')
        for clave in claves:
            if clave:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s));", (clave,))

        if email:
            cursor.execute("SELECT 1 FROM usuarios WHERE LOWER(email) = %s LIMIT 1", (email,))
            if cursor.fetchone():
                return jsonify({'error': 'Ese correo pertenece a una cuenta interna de Innova.'}), 409

        cursor.execute("""
            SELECT id
            FROM clientes
            WHERE (%s <> '' AND LOWER(COALESCE(email, '')) = %s)
               OR (%s <> '' AND COALESCE(dni, '') = %s)
            ORDER BY id
            FOR UPDATE
        """, (email, email, dni, dni))
        coincidencias = [r[0] for r in cursor.fetchall()]
        if len(coincidencias) > 1:
            return jsonify({
                'error': 'El correo y el DNI pertenecen a fichas distintas. Unifícalas antes de continuar.'
            }), 409
        if coincidencias:
            cliente_id = coincidencias[0]
            cursor.execute("""
                UPDATE clientes
                SET email = COALESCE(NULLIF(email, ''), NULLIF(%s, '')),
                    telefono = COALESCE(NULLIF(telefono, ''), NULLIF(%s, '')),
                    dni = COALESCE(NULLIF(dni, ''), NULLIF(%s, '')),
                    direccion = COALESCE(NULLIF(direccion, ''), NULLIF(%s, ''))
                WHERE id = %s
            """, (email, telefono, dni, direccion, cliente_id))
            conexion.commit()
            return jsonify({'exito': True, 'id': cliente_id, 'existente': True}), 200

        cursor.execute("""
            INSERT INTO clientes (nombre, email, telefono, dni, direccion)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (nombre, email or None, telefono or None, dni or None, direccion or None))
        cliente_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({'exito': True, 'id': cliente_id}), 201
    except Exception:
        if conexion:
            conexion.rollback()
        return jsonify({'error': 'No se pudo registrar el cliente'}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            release_db_connection(conexion)


# ==========================================
# LISTA COMPLETA (Admin y Jefe de Taller)
# ==========================================

@clientes_bp.route('/api/clientes', methods=['GET'])
@requiere_rol('Admin', 'Jefe_Taller')
def listar_clientes():
    """Lista paginada de todos los clientes registrados."""
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
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
    except Exception:
        return jsonify({'error': 'No se pudo cargar la lista de clientes'}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)
