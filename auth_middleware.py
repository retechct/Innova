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
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    verify_jwt_in_request,
    get_jwt_identity,
    get_jwt,
)


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