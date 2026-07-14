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

from flask import Flask, jsonify, redirect, request, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException, NotFound
from frontend_rules import es_ruta_frontend
try:
    from flask_compress import Compress
except ImportError:
    Compress = None
from datetime import timedelta
from dotenv import load_dotenv
from migrations.bootstrap import upgrade_database_on_render

# ─── Carga de variables de entorno ───────────────────────────────────────────
load_dotenv()
upgrade_database_on_render()

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
# Los archivos se sirven con rutas explicitas al final del modulo. Desactivar la
# ruta estatica automatica evita que Flask capture primero URLs SPA como /contacto.
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'image/svg+xml',
]
app.config['COMPRESS_MIN_SIZE'] = 1024
if Compress:
    Compress(app)


_CANONICAL_HOST = os.getenv('CANONICAL_HOST', 'innovamobili.com').strip().lower()
_CANONICAL_HOST = _CANONICAL_HOST.removeprefix('https://').removeprefix('http://').strip('/')


@app.before_request
def redirigir_render_al_dominio_canonico():
    """Evita dos sesiones separadas entre onrender.com y el dominio propio."""
    host = request.host.split(':', 1)[0].lower()
    if (
        _CANONICAL_HOST
        and host.endswith('.onrender.com')
        and host != _CANONICAL_HOST
        and request.method in ('GET', 'HEAD')
        and not request.path.startswith('/api/')
    ):
        query = f'?{request.query_string.decode("utf-8")}' if request.query_string else ''
        return redirect(f'https://{_CANONICAL_HOST}{request.path}{query}', code=308)


@app.errorhandler(Exception)
def manejar_error_api(ex):
    if isinstance(ex, HTTPException):
        if request.path.startswith('/api/'):
            return jsonify({'error': ex.description}), ex.code
        return ex
    if request.path.startswith('/api/'):
        app.logger.exception("Error no controlado en %s", request.path)
        if os.getenv('DEBUG_API_ERRORS', '').lower() in ('1', 'true', 'yes'):
            return jsonify({'error': str(ex), 'tipo': type(ex).__name__}), 500
        return jsonify({'error': 'Error interno del servidor'}), 500
    raise ex

# Restringir CORS a los dominios configurados.
# FRONTEND_URLS acepta varios orígenes separados por coma; FRONTEND_URL queda
# como compatibilidad con la configuración anterior.
#
# expose_headers: por defecto el navegador NO deja leer con fetch() ningún
# header de respuesta que no sea uno de la lista "simple" del spec CORS
# (Content-Type, Content-Length, etc.), aunque el backend sí lo mande.
# X-Ordenes-Truncado / X-Ordenes-Activas-Total los usa /api/taller/ordenes
# para avisar cuando el LIMIT 150 de seguridad está cortando pedidos
# activos de verdad — si no se exponen acá, ese aviso llega al navegador
# pero JavaScript jamás puede verlo.
_cors_origins = [
    origin.strip()
    for origin in (
        os.getenv('FRONTEND_URLS')
        or os.getenv('FRONTEND_URL')
        or (
            'https://innovamobili.com,'
            'https://www.innovamobili.com,'
            'https://innova-4cnn.onrender.com'
        )
    ).split(',')
    if origin.strip()
]
CORS(app, origins=_cors_origins, expose_headers=['X-Ordenes-Truncado', 'X-Ordenes-Activas-Total'])

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


@app.after_request
def agregar_cabeceras_seguridad(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()')
    if not request.path.startswith('/api/'):
        if request.path == '/' or request.path.endswith('.html'):
            response.headers['Cache-Control'] = 'no-cache'
        elif request.path.startswith(('/js/', '/css/')):
            response.headers.setdefault('Cache-Control', 'public, max-age=3600')
        elif request.path.startswith(('/imagenes/', '/uploads/')) or request.path.endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico')):
            response.headers.setdefault('Cache-Control', 'public, max-age=86400')
    return response

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
limiter.limit("10 per minute")(app.view_functions['usuarios.verificar_email_pin'])
limiter.limit("5 per hour")(app.view_functions['usuarios.registrar_usuario_web'])
limiter.limit("12 per minute")(app.view_functions['catalogo.leer_voucher'])
limiter.limit("20 per minute")(app.view_functions['catalogo.upload_voucher'])
limiter.limit("30 per minute")(app.view_functions['produccion.cotizar_lote'])
limiter.limit("30 per minute")(app.view_functions['produccion.ver_formulario_cotizacion'])
limiter.limit("10 per minute")(app.view_functions['produccion.responder_cotizacion'])
limiter.limit("30 per minute")(app.view_functions['produccion.servir_pdf_oc_publico'])

# ─── Blueprints externos (ya existían antes de la refactorización) ────────────
# NOTA: routes_kardex.py fue eliminado (julio 2026) — era un blueprint
# huérfano (SQLAlchemy) nunca llamado por el frontend; ver docstring arriba.
from routes_taller    import taller_bp, init_taller_pool
from routes_inventario import inventario_bp

app.register_blueprint(taller_bp)
app.register_blueprint(inventario_bp)
init_taller_pool()

# ─── Rutas de infraestructura (sedes, archivos estáticos) ────────────────────
from database import get_db_connection, release_db_connection
from auth_middleware import requiere_rol


@app.route('/api/sedes', methods=['GET'])
def obtener_sedes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre, tipo FROM sedes ORDER BY id;")
        sedes = [{'id': s[0], 'nombre': s[1], 'tipo': s[2]} for s in cursor.fetchall()]
        return jsonify(sedes), 200
    except Exception:
        app.logger.exception("Error al obtener sedes")
        return jsonify({'error': 'Error al cargar sedes'}), 500
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
    except Exception:
        if 'conexion' in locals() and conexion: conexion.rollback()
        app.logger.exception("Error al inicializar sedes")
        return jsonify({'error': 'Error al inicializar sedes'}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)



@app.route('/uploads/<filename>')
def mostrar_foto(filename):
    return send_from_directory('uploads', filename)

@app.route('/', methods=['GET'])
def bienvenida():
    return send_from_directory('Vendedor', 'index.html')

@app.route('/favicon.ico')
def favicon():
    return ('', 204)

# ← AGREGAR AQUÍ
@app.route('/<path:filename>')
def serve_frontend(filename):
    try:
        return send_from_directory('Vendedor', filename)
    except NotFound:
        if es_ruta_frontend(filename):
            return send_from_directory('Vendedor', 'index.html')
        raise


@app.before_request
def log_request():
    from flask import request
    if 'pdf' in request.path or 'oc' in request.path:
        print(f"[REQUEST] {request.method} {request.path}")

# ─── Arranque ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=False, port=5000)
