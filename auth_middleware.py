"""
auth_middleware.py — Decoradores de autorización para Innova Mobili ERP.

Uso básico en cualquier blueprint:

    from auth_middleware import requiere_login, requiere_rol

    @mi_bp.route('/api/ventas', methods=['POST'])
    @requiere_login
    def registrar_venta():
        ...

    @mi_bp.route('/api/usuarios/nuevo', methods=['POST'])
    @requiere_rol('Admin')
    def crear_usuario():
        ...

El token JWT se envía en el header:
    Authorization: Bearer <token>

El login (/api/login y /api/login/email) ya devuelve el token.
"""

import os
import time
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    verify_jwt_in_request,
    get_jwt_identity,
    get_jwt,
)


# ─── Corte global de sesiones ("Cerrar sesión a todos") ──────────────────────
# Permite a un Admin invalidar TODOS los tokens JWT ya emitidos de un solo
# golpe, sin necesidad de guardar sesiones en el servidor. Funciona así:
#
#   1. Se guarda en la tabla `sistema_config` un timestamp (epoch, segundos)
#      con la clave 'forzar_logout_desde'.
#   2. En cada request protegido, comparamos el campo `iat` del JWT (fecha
#      de emisión del token) contra ese timestamp.
#   3. Si el token fue emitido ANTES del corte → se rechaza con 401, igual
#      que un token expirado. El frontend (apiFetch en app.js) ya detecta
#      el 401, muestra "Sesión expirada" y manda al usuario al login.
#
# Se cachea en memoria por unos segundos para no pegarle a la base de datos
# en cada request protegido del sistema.

_cache_corte_ts     = 0      # último valor de corte leído de la BD
_cache_leido_en     = 0      # timestamp (time.time()) de la última lectura
_CACHE_TTL_SEGUNDOS = 5

# FIX-RENDER: El servidor en Render puede reiniciarse y encontrar un timestamp
# histórico en sistema_config de un "forzar logout" antiguo. Si ese corte tiene
# más de 24h, lo ignoramos — ya no tiene sentido invalidar tokens tan viejos.
_CORTE_MAX_ANTIGUEDAD_SEGUNDOS = 24 * 3600


def _asegurar_tabla_config(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sistema_config (
            clave VARCHAR(50) PRIMARY KEY,
            valor TEXT
        );
    """)


def _obtener_corte_global() -> float:
    """Devuelve el timestamp (epoch) del último 'cerrar sesión a todos'."""
    global _cache_corte_ts, _cache_leido_en

    ahora = time.time()
    if ahora - _cache_leido_en < _CACHE_TTL_SEGUNDOS:
        return _cache_corte_ts

    from database import get_db_connection, release_db_connection
    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_tabla_config(cursor)
        cursor.execute("SELECT valor FROM sistema_config WHERE clave = 'forzar_logout_desde';")
        row = cursor.fetchone()
        conexion.commit()
        _cache_corte_ts = float(row[0]) if row and row[0] else 0
        _cache_leido_en = ahora
    except Exception as e:
        print(f"⚠️ No se pudo leer el corte global de sesiones: {e}")
        # En caso de error, no bloqueamos a nadie — devolvemos el último valor cacheado
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)

    return _cache_corte_ts


def forzar_logout_global():
    """
    Llamar desde el endpoint de Admin 'Cerrar sesión a todos'.
    Invalida de inmediato todos los tokens emitidos hasta este momento.
    """
    global _cache_corte_ts, _cache_leido_en

    from database import get_db_connection, release_db_connection
    ahora = time.time()
    conexion = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_tabla_config(cursor)
        cursor.execute("""
            INSERT INTO sistema_config (clave, valor) VALUES ('forzar_logout_desde', %s)
            ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
        """, (str(ahora),))
        conexion.commit()
    finally:
        if conexion:
            cursor.close(); release_db_connection(conexion)

    # Actualizamos el caché en memoria al toque, para no esperar el TTL
    _cache_corte_ts = ahora
    _cache_leido_en = ahora


def _token_invalidado_por_corte_global() -> bool:
    """
    True si el JWT actual fue emitido antes del último corte global.

    FIX-RENDER: Si el corte tiene más de 24h lo ignoramos. Render reinicia
    el servidor periódicamente y al arrancar puede encontrar un timestamp
    histórico en sistema_config (de un logout que ya nadie recuerda) que
    invalida a TODOS los usuarios. Con este límite de antigüedad, el
    "cerrar sesión a todos" solo tiene efecto durante las primeras 24h;
    pasado ese tiempo los usuarios pueden volver a iniciar sesión con
    normalidad aunque el registro siga en la BD.
    """
    corte = _obtener_corte_global()
    if corte <= 0:
        return False

    # Ignorar cortes históricos de más de 24h
    if time.time() - corte > _CORTE_MAX_ANTIGUEDAD_SEGUNDOS:
        return False

    claims = get_jwt()
    iat = claims.get('iat', 0)
    return iat < corte


# ─── Generar token tras login exitoso ────────────────────────────────────────

def generar_token(usuario: dict) -> dict:
    """
    Llama esto en el endpoint de login una vez que validaste el PIN/contraseña.
    Retorna un dict con 'access' y 'refresh'.

    usuario = {
        "id": 5,
        "nombre": "Carla",
        "rol": "Vendedor",
        "area_asignada": "Tienda del Medio"
    }
    """
    identity = str(usuario["id"])
    additional_claims = {
        "nombre":        usuario.get("nombre", ""),
        "rol":           usuario.get("rol", ""),
        "area_asignada": usuario.get("area_asignada", ""),
    }
    access  = create_access_token(identity=identity, additional_claims=additional_claims)
    refresh = create_refresh_token(identity=identity, additional_claims=additional_claims)
    return {"access": access, "refresh": refresh}


# ─── Decorador: solo requiere estar logueado ─────────────────────────────────

def requiere_login(fn):
    """
    Verifica que el request tenga un JWT válido.
    Si no, responde 401.
    Añade g.usuario_id y g.usuario_rol al contexto de Flask.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({"error": "No autorizado. Inicia sesión para continuar."}), 401

        if _token_invalidado_por_corte_global():
            return jsonify({"error": "Tu sesión fue cerrada por el administrador. Vuelve a iniciar sesión."}), 401

        return fn(*args, **kwargs)
    return wrapper


# ─── Decorador: requiere rol específico ──────────────────────────────────────

def requiere_rol(*roles_permitidos):
    """
    Verifica que el usuario tenga uno de los roles indicados.

    @requiere_rol('Admin')
    @requiere_rol('Admin', 'Jefe_Taller')
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({"error": "No autorizado. Inicia sesión para continuar."}), 401

            if _token_invalidado_por_corte_global():
                return jsonify({"error": "Tu sesión fue cerrada por el administrador. Vuelve a iniciar sesión."}), 401

            claims = get_jwt()
            rol_usuario = claims.get("rol", "")

            if rol_usuario not in roles_permitidos:
                return jsonify({
                    "error": f"Acceso denegado. Se requiere: {', '.join(roles_permitidos)}. "
                             f"Tu rol: {rol_usuario}"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ─── Helper: obtener datos del usuario logueado ───────────────────────────────

def get_usuario_actual() -> dict:
    """
    Llama desde dentro de una ruta protegida para obtener los datos del usuario.

    Retorna:
    {
        "id":            "5",
        "nombre":        "Carla",
        "rol":           "Vendedor",
        "area_asignada": "Tienda del Medio"
    }
    """
    claims = get_jwt()
    return {
        "id":            get_jwt_identity(),
        "nombre":        claims.get("nombre", ""),
        "rol":           claims.get("rol", ""),
        "area_asignada": claims.get("area_asignada", ""),
    }


# ─── GUÍA DE MIGRACIÓN ────────────────────────────────────────────────────────
"""
PASO 1 — Actualizar los endpoints de login para emitir el token.

En routes_usuarios.py, función verificar_email_pin(), al final donde retornas el JSON:

    from auth_middleware import generar_token

    # ... (validación existente sin cambios) ...
    if usuario:
        token = generar_token({
            "id":            usuario[0],
            "nombre":        usuario[1],
            "rol":           usuario[2],
            "area_asignada": usuario[6],
        })
        return jsonify({
            "exito": True,
            "token": token,          # ← NUEVO
            "usuario": { ... }       # ← sin cambios
        }), 200

Hacer lo mismo en verificar_pin() (login por id+pin).


PASO 2 — Prioridad alta: proteger escritura de ventas y producción.

    # routes_ventas.py
    from auth_middleware import requiere_login, requiere_rol

    @ventas_bp.route('/api/ventas', methods=['POST'])
    @requiere_login                          # ← añadir
    def guardar_venta():
        ...

    # routes_produccion.py
    @produccion_bp.route('/api/taller/ticket/<int:id>/finalizar', methods=['POST'])
    @requiere_login
    def finalizar_ticket(id):
        ...


PASO 3 — Rutas de solo Admin.

    @ventas_bp.route('/api/ventas/exportar', methods=['GET'])
    @requiere_rol('Admin', 'Jefe_Taller')
    def exportar_ventas_excel():
        ...

    @usuarios_bp.route('/api/usuarios/nuevo', methods=['POST'])
    @requiere_rol('Admin')
    def crear_usuario():
        ...


PASO 4 — Frontend: guardar y enviar el token.

    // Tras login exitoso, guardar en sessionStorage:
    sessionStorage.setItem('token', data.token);

    // En cada fetch protegido:
    const token = sessionStorage.getItem('token');
    fetch('/api/ventas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    // Añadir en app.js una función helper:
    function apiFetch(url, options = {}) {
        const token = sessionStorage.getItem('token');
        return fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
    }


ORDEN RECOMENDADO DE MIGRACIÓN:
  1. Emitir token en login (Paso 1) — sin romper nada aún
  2. Añadir apiFetch en frontend (Paso 4) — sin romper nada aún
  3. Proteger POST /api/ventas y POST /api/taller/ticket (Paso 2)
  4. Proteger /api/usuarios/nuevo y /api/ventas/exportar (Paso 3)
  5. Con tiempo: proteger GETs sensibles (listar ventas, exportar)
"""


# ─── Endpoint de renovación de token ─────────────────────────────────────────
# Registrar en app.py: app.register_blueprint(auth_bp)
from flask import Blueprint, jsonify

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    """
    Renueva el access token usando el refresh token.
    El cliente envía: Authorization: Bearer <refresh_token>
    Devuelve: { "access": "<nuevo_access_token>" }
    """
    try:
        verify_jwt_in_request(refresh=True)

        if _token_invalidado_por_corte_global():
            return jsonify({"error": "Tu sesión fue cerrada por el administrador. Vuelve a iniciar sesión."}), 401

        identity = get_jwt_identity()
        claims   = get_jwt()
        new_access = create_access_token(
            identity=identity,
            additional_claims={
                "nombre":        claims.get("nombre", ""),
                "rol":           claims.get("rol", ""),
                "area_asignada": claims.get("area_asignada", ""),
            }
        )
        return jsonify({"access": new_access}), 200
    except Exception:
        return jsonify({"error": "Refresh token inválido o expirado. Vuelve a iniciar sesión."}), 401