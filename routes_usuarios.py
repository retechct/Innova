"""
routes_usuarios.py — Módulos 6 y 7: Usuarios, login y proveedores.
Blueprint: usuarios_bp  (sin prefijo de URL)
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection, release_db_connection
from auth_middleware import generar_token, requiere_login, requiere_rol, forzar_logout_global

usuarios_bp = Blueprint('usuarios', __name__)


def _asegurar_columna_telefono(cursor):
    """
    Auto-migración segura: agrega la columna `telefono` a `usuarios` si
    no existe todavía. Se necesita para poder notificar por WhatsApp/SMS
    a futuro (la capa de notificación ya recibe este campo, ver
    database.notificar_usuario). Formato libre por ahora — se recomienda
    incluir código de país, ej: +51987654321.
    """
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")


# ==========================================
# USUARIOS
# ==========================================

@usuarios_bp.route('/api/usuarios', methods=['GET'])
# Sin @requiere_login: este endpoint alimenta el dropdown del formulario
# de login (se llama antes de tener token). Solo devuelve id/nombre/rol.
def obtener_usuarios():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre, rol, area_asignada FROM usuarios ORDER BY nombre;")
        usuarios = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "area_asignada": r[3]}
            for r in cursor.fetchall()
        ]
        return jsonify(usuarios), 200
    except Exception as e:
        return jsonify({'error': 'Error al cargar usuarios'}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/usuarios/detalle', methods=['GET'])
@requiere_rol('Admin', 'Jefe_Taller')
def obtener_usuarios_detalle():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_columna_telefono(cursor)
        cursor.execute("""
            SELECT id, nombre, rol, email, area_asignada, empresa_nombre, empresa_ruc, telefono
            FROM usuarios ORDER BY nombre;
        """)
        usuarios = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "email": r[3],
             "area": r[4], "empresa": r[5], "ruc": r[6], "telefono": r[7] or ''}
            for r in cursor.fetchall()
        ]
        return jsonify(usuarios), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/usuarios/nuevo', methods=['POST'])
@requiere_rol('Admin')
def crear_usuario():
    data = request.json
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_columna_telefono(cursor)
        cursor.execute("""
            INSERT INTO usuarios (nombre, email, pin_acceso, contrasena, rol, area_asignada, empresa_nombre, empresa_ruc, telefono)
            VALUES (%s, %s, %s, '123456', %s, %s, %s, %s, %s);
        """, (data['nombre'], data['correo'], data['pin'], data['rol'],
              data['area'], data['empresa_nombre'], data['empresa_ruc'], data.get('telefono')))
        conexion.commit()
        return jsonify({'exito': True}), 201
    except Exception as e:
        print(f"❌ Error en crear_usuario: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/usuarios/<int:usuario_id>', methods=['PUT'])
@requiere_rol('Admin')
def editar_usuario(usuario_id):
    """
    Edita datos de un usuario ya existente — pensado en primer lugar
    para poder registrar/actualizar el `telefono` de operarios y choferes
    que se crearon antes de que existiera este campo, sin tener que
    recrear el usuario desde cero.

    Solo actualiza los campos que vengan en el body (parcial), para no
    pisar datos que no se quisieron tocar.
    """
    data = request.json or {}
    campos_permitidos = {
        'nombre':         'nombre',
        'correo':         'email',
        'telefono':       'telefono',
        'rol':            'rol',
        'area':           'area_asignada',
        'empresa_nombre': 'empresa_nombre',
        'empresa_ruc':    'empresa_ruc',
    }
    actualizaciones = {
        col: data[clave] for clave, col in campos_permitidos.items() if clave in data
    }
    if not actualizaciones:
        return jsonify({'error': 'No se envió ningún campo para actualizar'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        _asegurar_columna_telefono(cursor)

        set_clause = ", ".join(f"{col} = %s" for col in actualizaciones.keys())
        valores    = list(actualizaciones.values()) + [usuario_id]
        cursor.execute(f"UPDATE usuarios SET {set_clause} WHERE id = %s;", valores)

        if cursor.rowcount == 0:
            conexion.rollback()
            return jsonify({'error': 'Usuario no encontrado'}), 404

        conexion.commit()
        return jsonify({'exito': True, 'mensaje': 'Usuario actualizado correctamente'}), 200
    except Exception as e:
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/usuarios/por-area/<string:area>', methods=['GET'])
@requiere_login
def obtener_usuarios_por_area(area):
    AREA_ALIASES = {
        'CORTE_Y_CONTROL_TELAS':    ['CORTE_Y_CONTROL_TELAS', 'TELAS'],
        'TELAS':                    ['TELAS', 'CORTE_Y_CONTROL_TELAS'],
        'TAPICERIA_SOFAS':          ['TAPICERIA_SOFAS', 'TAPICERIA'],
        'TAPICERIA_SILLAS':         ['TAPICERIA_SILLAS', 'TAPICERIA'],
        'ESTRUCTURAS_MUEBLES':      ['ESTRUCTURAS_MUEBLES', 'ESTRUCTURAS', 'CARPINTERIA'],
        'ESTRUCTURAS_SILLAS':       ['ESTRUCTURAS_SILLAS', 'ESTRUCTURAS', 'CARPINTERIA'],
        'ARMADO_COJINES':           ['ARMADO_COJINES', 'COJINES'],
        'PREPARACION_PATAS_ZOCALO': ['PREPARACION_PATAS_ZOCALO', 'PATAS', 'ZOCALO'],
        'TABLEROS_Y_PIEDRAS':       ['TABLEROS_Y_PIEDRAS', 'TABLEROS'],
        'DESPACHO_CENTRAL':         ['DESPACHO_CENTRAL', 'DESPACHO'],
    }
    area_upper = area.upper()
    areas_buscar = AREA_ALIASES.get(area_upper, [area_upper])
    areas_buscar_set = list(dict.fromkeys([a.upper() for a in areas_buscar] + [area_upper]))
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        placeholders = ",".join(["%s"] * len(areas_buscar_set))
        cursor.execute(f"""
            SELECT id, nombre, rol, area_asignada,
                CASE WHEN UPPER(COALESCE(area_asignada,'')) IN ({placeholders}) THEN 0 ELSE 1 END AS orden
            FROM usuarios
            WHERE UPPER(COALESCE(area_asignada,'')) IN ({placeholders})
               OR rol IN ('Admin', 'Jefe_Taller')
            ORDER BY orden ASC, nombre ASC;
        """, (*areas_buscar_set, *areas_buscar_set))
        usuarios = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "area": r[3] or ''}
            for r in cursor.fetchall()
        ]
        return jsonify(usuarios), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/usuarios/choferes', methods=['GET'])
@requiere_login
def obtener_choferes():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT id, nombre, rol, area_asignada FROM usuarios
            WHERE area_asignada = 'DESPACHO' OR rol = 'Chofer'
            ORDER BY nombre;
        """)
        choferes = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "area": r[3]}
            for r in cursor.fetchall()
        ]
        return jsonify(choferes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


# ==========================================
# LOGIN
# ==========================================

# Nota: el decorator @limiter se aplica en app.py al registrar el blueprint,
# o directamente si se pasa el limiter como parámetro.
@usuarios_bp.route('/api/login', methods=['POST'])
def verificar_pin():
    try:
        usuario_id    = request.json.get('usuario_id')
        pin_ingresado = request.json.get('pin')

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT id, nombre, rol, empresa_nombre, empresa_ruc, email, area_asignada, pin_acceso
            FROM usuarios WHERE id = %s AND pin_acceso = %s;
        """, (usuario_id, pin_ingresado))
        usuario = cursor.fetchone()

        if usuario:
            tokens = generar_token({
                "id":            usuario[0],
                "nombre":        usuario[1],
                "rol":           usuario[2],
                "area_asignada": usuario[6],
            })
            res = jsonify({
                "exito": True,
                "token":         tokens["access"],
                "refresh_token": tokens["refresh"],
                "usuario": {
                    "id":            usuario[0],
                    "nombre":        usuario[1],
                    "rol":           usuario[2],
                    "empresa":       usuario[3],
                    "ruc":           usuario[4],
                    "email":         usuario[5],
                    "area_asignada": usuario[6]
                }
            })
            cursor.close(); release_db_connection(conexion)
            return res, 200

        cursor.close(); release_db_connection(conexion)
        return jsonify({"exito": False, "error": "PIN incorrecto"}), 401

    except Exception as e:
        print(f"❌ Error en login: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


# ==========================================
# PROVEEDORES (Módulo 7)
# ==========================================

@usuarios_bp.route('/api/proveedores', methods=['GET'])
@requiere_login
def obtener_proveedores():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre, especialidad, correo, telefono FROM proveedores ORDER BY nombre;")
        provs = [
            {"id": r[0], "nombre": r[1], "especialidad": r[2], "correo": r[3], "telefono": r[4]}
            for r in cursor.fetchall()
        ]
        return jsonify(provs), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)


@usuarios_bp.route('/api/proveedores/nuevo', methods=['POST'])
@requiere_rol('Admin', 'Jefe_Taller')
def crear_proveedor():
    data = request.json
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO proveedores (nombre, especialidad, correo, telefono)
            VALUES (%s,%s,%s,%s);
        """, (data['nombre'], data['especialidad'], data['correo'], data['telefono']))
        conexion.commit()
        return jsonify({'exito': True}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion:
            cursor.close(); release_db_connection(conexion)

@usuarios_bp.route('/api/usuarios/cerrar-sesiones-todas', methods=['POST'])
@requiere_rol('Admin')
def cerrar_sesiones_todas():
    """
    Invalida de inmediato TODOS los tokens JWT emitidos hasta este momento,
    para cualquier usuario en cualquier dispositivo. Útil cuando hay
    sesiones colgadas mostrando 'sesión expirada' y la gente no puede
    volver a entrar con normalidad.

    No requiere que el usuario haga nada: en su siguiente acción dentro
    del sistema recibirá un 401 y el frontend lo mandará al login solo.
    """
    try:
        forzar_logout_global()
        return jsonify({
            'exito': True,
            'mensaje': 'Se cerraron las sesiones de todos los usuarios. '
                       'En su próxima acción serán enviados al login automáticamente.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==========================================
# LOGIN POR EMAIL + PIN (nuevo landing)
# ==========================================

@usuarios_bp.route('/api/login/email', methods=['POST'])
def verificar_email_pin():
    """
    Login por correo + contraseña.
    Busca primero en `usuarios` (staff del ERP).
    Si no encuentra, busca en `clientes` (registrados desde el landing).
    """
    try:
        email = (request.json.get('email') or '').strip().lower()
        pin   = (request.json.get('pin')   or '').strip()

        if not email or not pin:
            return jsonify({"exito": False, "error": "Correo y contraseña son obligatorios"}), 400

        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # ── 1. Buscar en usuarios (staff: Admin, Vendedor, Operario…) ──────
        cursor.execute("""
            SELECT id, nombre, rol, empresa_nombre, empresa_ruc, email, area_asignada
            FROM usuarios
            WHERE LOWER(email) = %s
              AND (pin_acceso = %s OR contrasena = %s)
              AND COALESCE(estado, true) = true;
        """, (email, pin, pin))
        usuario = cursor.fetchone()

        if usuario:
            tokens = generar_token({
                "id":            usuario[0],
                "nombre":        usuario[1],
                "rol":           usuario[2],
                "area_asignada": usuario[6],
            })
            cursor.close(); release_db_connection(conexion)
            return jsonify({
                "exito": True,
                "token":         tokens["access"],
                "refresh_token": tokens["refresh"],
                "usuario": {
                    "id":            usuario[0],
                    "nombre":        usuario[1],
                    "rol":           usuario[2],
                    "empresa":       usuario[3],
                    "ruc":           usuario[4],
                    "email":         usuario[5],
                    "area_asignada": usuario[6]
                }
            }), 200

        # ── 2. Buscar en clientes (registrados desde el landing) ───────────
        from werkzeug.security import check_password_hash
        cursor.execute("""
            SELECT id, nombre, email, telefono, contrasena
            FROM clientes
            WHERE LOWER(email) = %s;
        """, (email,))
        cliente_row = cursor.fetchone()
        cursor.close(); release_db_connection(conexion)

        # Verificar hash — los clientes siempre usan contraseña propia
        cliente = cliente_row if (cliente_row and check_password_hash(cliente_row[4], pin)) else None

        if cliente:
            tokens = generar_token({
                "id":            cliente[0],
                "nombre":        cliente[1],
                "rol":           "Cliente",
                "area_asignada": "",
            })
            return jsonify({
                "exito": True,
                "token":         tokens["access"],
                "refresh_token": tokens["refresh"],
                "usuario": {
                    "id":            cliente[0],
                    "nombre":        cliente[1],
                    "rol":           "Cliente",
                    "email":         cliente[2],
                    "telefono":      cliente[3] or "",
                    "empresa":       "",
                    "ruc":           "",
                    "area_asignada": ""
                }
            }), 200

        return jsonify({"exito": False, "error": "Correo o contraseña incorrectos"}), 401

    except Exception as e:
        print(f"❌ Error en login email+pin: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500


# ==========================================
# REGISTRO PÚBLICO (usuarios externos)
# ==========================================

@usuarios_bp.route('/api/usuarios/registrar-web', methods=['POST'])
def registrar_usuario_web():
    """
    Registro desde el landing público.
    Guarda el cliente en la tabla `clientes` (no en usuarios).
    Esto permite que el vendedor lo encuentre en el autocomplete y
    que el cliente pueda rastrear sus pedidos por email.
    """
    data       = request.json or {}
    nombre     = (data.get('nombre')     or '').strip()
    email      = (data.get('email')      or '').strip().lower()
    telefono   = (data.get('telefono')   or '').strip()
    contrasena = (data.get('contrasena') or '').strip()
    dni        = (data.get('dni')        or '').strip()  # FIX: antes se ignoraba

    if not nombre or not email or not contrasena:
        return jsonify({'error': 'Nombre, correo y contraseña son obligatorios'}), 400

    from werkzeug.security import generate_password_hash
    contrasena_hash = generate_password_hash(contrasena)  # nunca guardar texto plano

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Verificar duplicado en clientes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clientes (
                id         SERIAL PRIMARY KEY,
                nombre     VARCHAR(150) NOT NULL,
                email      VARCHAR(120),
                telefono   VARCHAR(20),
                dni        VARCHAR(20),
                direccion  TEXT,
                contrasena VARCHAR(255),
                fecha_alta TIMESTAMP DEFAULT NOW()
            );
        """)
        cursor.execute("SELECT id FROM clientes WHERE LOWER(email) = %s;", (email,))
        if cursor.fetchone():
            cursor.close(); release_db_connection(conexion)
            return jsonify({'error': 'Este correo ya está registrado'}), 409

        cursor.execute("""
            INSERT INTO clientes (nombre, email, telefono, dni, contrasena)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """, (nombre, email, telefono or None, dni or None, contrasena_hash))
        conexion.commit()
        cursor.close(); release_db_connection(conexion)
        return jsonify({
            'exito':   True,
            'mensaje': '¡Registro exitoso! Ya puedes rastrear tus pedidos con tu correo.'
        }), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': str(e), 'detalle': traceback.format_exc()}), 500