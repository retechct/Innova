"""
app.py — Punto de entrada principal.

Responsabilidades de este archivo:
  - Crear la app Flask y configurarla
  - Inicializar extensiones (jwt, limiter, cloudinary)
  - Registrar todos los Blueprints
  - Arrancar el servidor

La lógica de negocio vive en los módulos de rutas:
  database.py          → pool de conexiones (psycopg2) y utilidades compartidas
  routes_catalogo.py   → catálogo, insumos, upload vouchers          (módulo 1)
  routes_ventas.py     → ventas, seguimiento, exportación, precios   (módulos 2-3-14)
  routes_materiales.py → maestro de materiales y creaciones          (módulos 4-5)
  routes_usuarios.py   → usuarios, login, proveedores                (módulos 6-7)
  routes_produccion.py → taller, inventario, logística, BOM,
                         sugerencias, despacho                       (módulos 8-13)
  routes_taller.py     → taller extra (blueprint externo existente)
  routes_inventario.py → inventario extra (blueprint externo existente)

NOTA (limpieza julio 2026): se eliminaron routes_kardex.py y models.py.
Todo el sistema usa psycopg2 crudo vía database.py (pool de conexiones a
Neon); models.py con SQLAlchemy solo lo usaba ese blueprint huérfano de
kardex, que exponía /api/kardex/sedes y /api/kardex/catalogo pero nunca
era llamado por el frontend (que siempre usó /api/sedes y /api/catalogo,
ya definidos aquí y en routes_catalogo.py). Se quitó también Flask-Migrate
y Flask-SQLAlchemy del arranque por la misma razón: no tenían nada más
que inicializar.
"""

import os
import cloudinary
import cloudinary.uploader
import cloudinary.api

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager
from datetime import timedelta
from dotenv import load_dotenv

# ─── Carga de variables de entorno ───────────────────────────────────────────
load_dotenv()

# ─── Validación de secretos críticos ─────────────────────────────────────────
# Si JWT_SECRET_KEY no está seteada en el entorno, la app NO debe arrancar.
# Antes existía un valor por defecto hardcodeado y conocido (visible en el
# repo) — eso permitía a cualquiera fabricar tokens válidos con rol Admin
# si la variable de entorno faltaba en el servidor. Mejor fallar el deploy
# de forma explícita que correr en producción con esa clave pública.
_JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not _JWT_SECRET_KEY:
    raise RuntimeError(
        "❌ Falta la variable de entorno JWT_SECRET_KEY. "
        "Configúrala en Render (Settings → Environment) antes de arrancar la app. "
        "Nunca uses un valor por defecto hardcodeado para esta clave."
    )

# ─── Cloudinary ──────────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key    = os.getenv('CLOUDINARY_API_KEY'),
    api_secret = os.getenv('CLOUDINARY_API_SECRET'),
)

# ─── Aplicación Flask ─────────────────────────────────────────────────────────
app = Flask(__name__, static_folder='Vendedor', static_url_path='')

# Restringir CORS al dominio de producción.
# En desarrollo local, agregar también: 'http://localhost:5000'
CORS(app, origins=[
    os.getenv('FRONTEND_URL', 'https://innova-4cnn.onrender.com'),
])

app.config['JWT_SECRET_KEY']                 = _JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES']       = timedelta(hours=8)   # jornada laboral completa
app.config['JWT_REFRESH_TOKEN_EXPIRES']      = timedelta(days=30)   # renovar sin re-login

jwt = JWTManager(app)

# ─── Rate limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)

# ─── Blueprints propios ───────────────────────────────────────────────────────
from routes_catalogo   import catalogo_bp
from routes_ventas     import ventas_bp
from routes_materiales import materiales_bp
from routes_usuarios   import usuarios_bp
from routes_produccion import produccion_bp
from routes_seguimiento import seguimiento_bp
from auth_middleware   import auth_bp          # ← refresh token endpoint
app.register_blueprint(auth_bp)
app.register_blueprint(seguimiento_bp)

app.register_blueprint(catalogo_bp)
app.register_blueprint(ventas_bp)
app.register_blueprint(materiales_bp)
app.register_blueprint(usuarios_bp)
app.register_blueprint(produccion_bp)
from routes_clientes import clientes_bp       # ← clientes del landing
app.register_blueprint(clientes_bp)           # ← sin aprobación

# Aplicar rate limit al endpoint de login
limiter.limit("10 per minute")(app.view_functions['usuarios.verificar_pin'])

# ─── Blueprints externos (ya existían antes de la refactorización) ────────────
# NOTA: routes_kardex.py fue eliminado (julio 2026) — era un blueprint
# huérfano (SQLAlchemy) nunca llamado por el frontend; ver docstring arriba.
from routes_taller    import taller_bp, init_taller_pool
from routes_inventario import inventario_bp

app.register_blueprint(taller_bp)
app.register_blueprint(inventario_bp)
init_taller_pool()

# ─── Rutas de infraestructura (sedes, archivos estáticos) ────────────────────
from flask import jsonify, request
from database import get_db_connection, release_db_connection
from auth_middleware import requiere_login, requiere_rol


@app.route('/api/sedes', methods=['GET'])
def obtener_sedes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre, tipo FROM sedes ORDER BY id;")
        sedes = [{'id': s[0], 'nombre': s[1], 'tipo': s[2]} for s in cursor.fetchall()]
        return jsonify(sedes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@app.route('/api/inicializar-sedes', methods=['POST'])
@requiere_rol('Admin')
def inicializar_sedes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT COUNT(*) FROM sedes;")
        if cursor.fetchone()[0] > 0:
            return jsonify({'mensaje': 'Las sedes ya fueron inicializadas previamente.'}), 200
        sedes_base = [
            ('Tienda del Medio',    'Tienda'),
            ('Tienda Grande',       'Tienda'),
            ('Tienda de Plaza Vea', 'Tienda'),
            ('Tienda del Sol',      'Tienda'),
            ('Taller',              'Taller + Tienda'),
        ]
        for nombre, tipo in sedes_base:
            cursor.execute("INSERT INTO sedes (nombre, tipo) VALUES (%s, %s);", (nombre, tipo))
        conexion.commit()
        return jsonify({'mensaje': 'Las 5 sedes operativas han sido creadas con éxito.'}), 201
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)



@app.route('/uploads/<filename>')
def mostrar_foto(filename):
    return send_from_directory('uploads', filename)

@app.route('/', methods=['GET'])
def bienvenida():
    return send_from_directory('Vendedor', 'index.html')

# ← AGREGAR AQUÍ
@app.route('/<path:filename>')
def serve_frontend(filename):
    return send_from_directory('Vendedor', filename)


@app.before_request
def log_request():
    from flask import request
    if 'pdf' in request.path or 'oc' in request.path:
        print(f"[REQUEST] {request.method} {request.path}")

# ─── Arranque ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=False, port=5000)