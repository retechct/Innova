"""
routes_clientes.py — Clientes del landing público.

DECISIÓN A6 (Plan de Acción Mayo 2026):
  - El flujo oficial de REGISTRO con cuenta y contraseña es:
      POST /api/usuarios/registrar-web  (en routes_usuarios.py)
    Permite al cliente hacer login y rastrear sus pedidos.

  - Este módulo conserva solo:
      GET  /api/clientes/buscar   → autocomplete para el vendedor al crear una venta
      GET  /api/clientes          → lista completa (solo Admin)

  El endpoint POST /api/clientes/registro fue eliminado para evitar
  dos flujos de registro paralelos. El frontend (carrito.js) usa ahora
  /api/usuarios/registrar-web para registrar clientes en el acto de la venta.

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