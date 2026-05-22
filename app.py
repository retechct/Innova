"""
app.py — Punto de entrada principal.

Responsabilidades de este archivo:
  - Crear la app Flask y configurarla
  - Inicializar extensiones (db, migrate, jwt, limiter, cloudinary)
  - Registrar todos los Blueprints
  - Arrancar el servidor

La lógica de negocio vive en los módulos de rutas:
  database.py          → pool de conexiones y utilidades compartidas
  routes_catalogo.py   → catálogo, insumos, upload vouchers          (módulo 1)
  routes_ventas.py     → ventas, seguimiento, exportación, precios   (módulos 2-3-14)
  routes_materiales.py → maestro de materiales y creaciones          (módulos 4-5)
  routes_usuarios.py   → usuarios, login, proveedores                (módulos 6-7)
  routes_produccion.py → taller, inventario, logística, BOM,
                         sugerencias, despacho                       (módulos 8-13)
  routes_kardex.py     → kardex (blueprint externo existente)
  routes_taller.py     → taller extra (blueprint externo existente)
  routes_inventario.py → inventario extra (blueprint externo existente)
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
from flask_migrate import Migrate
from dotenv import load_dotenv

from models import db

# ─── Carga de variables de entorno ───────────────────────────────────────────
load_dotenv()

# ─── Cloudinary ──────────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key    = os.getenv('CLOUDINARY_API_KEY'),
    api_secret = os.getenv('CLOUDINARY_API_SECRET'),
)

# ─── Aplicación Flask ─────────────────────────────────────────────────────────
app = Flask(__name__, static_folder='Vendedor', static_url_path='')
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI']        = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY']                 = os.getenv('JWT_SECRET_KEY', 'clave-secreta-de-innova-mobili')

db.init_app(app)
migrate = Migrate(app, db)
jwt     = JWTManager(app)

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

app.register_blueprint(catalogo_bp)
app.register_blueprint(ventas_bp)
app.register_blueprint(materiales_bp)
app.register_blueprint(usuarios_bp)
app.register_blueprint(produccion_bp)

# Aplicar rate limit al endpoint de login
limiter.limit("10 per minute")(app.view_functions['usuarios.verificar_pin'])

# ─── Blueprints externos (ya existían antes de la refactorización) ────────────
from routes_kardex    import kardex_bp
from routes_taller    import taller_bp, init_taller_pool
from routes_inventario import inventario_bp, init_inventario_pool

app.register_blueprint(kardex_bp, url_prefix='/api/kardex')
app.register_blueprint(taller_bp)
app.register_blueprint(inventario_bp)
init_taller_pool()
init_inventario_pool()

# ─── Rutas de infraestructura (sedes, archivos estáticos) ────────────────────
from flask import jsonify, request
from database import get_db_connection, release_db_connection


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
    """Ruta de compatibilidad para fotos antiguas guardadas localmente."""
    return send_from_directory('uploads', filename)


@app.route('/', methods=['GET'])
def bienvenida():
    return send_from_directory('Vendedor', 'index.html')


# ─── Arranque ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=False, port=5000)