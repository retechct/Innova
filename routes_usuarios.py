"""
routes_usuarios.py — Módulos 6 y 7: Usuarios, login y proveedores.
Blueprint: usuarios_bp  (sin prefijo de URL)
"""

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
from database import get_db_connection, release_db_connection
from auth_middleware import generar_token, requiere_login, requiere_rol, forzar_logout_global
from erp_constants import aliases_area

usuarios_bp = Blueprint('usuarios', __name__)


def _hash_valido(valor_hash, secreto):
    if not valor_hash or not secreto:
        return False
    try:
        return check_password_hash(valor_hash, secreto)
    except (ValueError, TypeError):
        return False


def _credencial_staff_valida(cursor, usuario_id, secreto, password_hash, contrasena_legacy, pin_legacy):
    """
    Verifica credenciales de staff.

    - Primero intenta password_hash.
    - Si el usuario aun es legacy, acepta contrasena/pin historicos.
    - Si entro por contrasena legacy, guarda hash para el siguiente login.
    """
    if _hash_valido(password_hash, secreto):
        return True

    if secreto and pin_legacy and secreto == str(pin_legacy):
        cursor.execute(
            "UPDATE usuarios SET password_hash = %s WHERE id = %s;",
            (generate_password_hash(secreto), usuario_id)
        )
        return True

    if secreto and contrasena_legacy and secreto == str(contrasena_legacy):
        cursor.execute(
            "UPDATE usuarios SET password_hash = %s WHERE id = %s;",
            (generate_password_hash(secreto), usuario_id)
        )
        return True

    return False


# ==========================================
# USUARIOS
# ==========================================

@usuarios_bp.route('/api/usuarios', methods=['GET'])
@requiere_login
def obtener_usuarios():
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("SELECT id, nombre, rol, area_asignada FROM usuarios ORDER BY nombre;")
        filas = cursor.fetchall()
        usuarios = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "area_asignada": r[3]}
            for r in filas
        ]
        return jsonify(usuarios), 200
    except Exception:
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
        cursor.execute("""
            SELECT id, nombre, rol, email, area_asignada, empresa_nombre, empresa_ruc,
                   telefono, COALESCE(solo_lectura, false)
            FROM usuarios ORDER BY nombre;
        """)
        usuarios = [
            {"id": r[0], "nombre": r[1], "rol": r[2], "email": r[3],
             "area": r[4], "empresa": r[5], "ruc": r[6], "telefono": r[7] or '',
             "solo_lectura": bool(r[8])}
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
    data = request.get_json(silent=True) or {}
    requeridos = ['nombre', 'correo', 'pin', 'rol', 'area', 'empresa_nombre', 'empresa_ruc']
    faltantes = [campo for campo in requeridos if not str(data.get(campo) or '').strip()]
    if faltantes:
        return jsonify({'error': f"Campos obligatorios faltantes: {', '.join(faltantes)}"}), 400
    if data['rol'] not in ('Admin', 'Jefe_Taller', 'Vendedor', 'Operario', 'Chofer'):
        return jsonify({'error': 'Rol de usuario no valido'}), 400
    secreto_inicial = str(data.get('contrasena') or data['pin']).strip()
    if len(secreto_inicial) < 4:
        return jsonify({'error': 'El PIN o contraseña debe tener al menos 4 caracteres'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            INSERT INTO usuarios
                (nombre, email, pin_acceso, contrasena, password_hash, rol,
                 area_asignada, empresa_nombre, empresa_ruc, telefono, solo_lectura)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (data['nombre'], data['correo'].strip().lower(), '',
              '', generate_password_hash(secreto_inicial), data['rol'],
              data['area'], data['empresa_nombre'], data['empresa_ruc'], data.get('telefono'),
              bool(data.get('solo_lectura', False))))
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
        'solo_lectura':   'solo_lectura',
    }
    actualizaciones = {
        col: data[clave] for clave, col in campos_permitidos.items() if clave in data
    }
    secreto_nuevo = str(data.get('contrasena') or data.get('pin') or '').strip()
    if secreto_nuevo:
        if len(secreto_nuevo) < 4:
            return jsonify({'error': 'El PIN o contraseña debe tener al menos 4 caracteres'}), 400
        actualizaciones['password_hash'] = generate_password_hash(secreto_nuevo)
        actualizaciones['pin_acceso'] = ''
        actualizaciones['contrasena'] = ''
    if 'rol' in data and data['rol'] not in ('Admin', 'Jefe_Taller', 'Vendedor', 'Operario', 'Chofer'):
        return jsonify({'error': 'Rol de usuario no valido'}), 400
    if not actualizaciones:
        return jsonify({'error': 'No se envió ningún campo para actualizar'}), 400

    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

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
    areas_buscar_set = aliases_area(area)
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
    conexion = None
    cursor = None
    try:
        data = request.get_json(silent=True) or {}
        usuario_id    = data.get('usuario_id')
        pin_ingresado = data.get('pin')

        conexion = get_db_connection()
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT id, nombre, rol, empresa_nombre, empresa_ruc, email,
                   area_asignada, password_hash, contrasena, pin_acceso,
                   COALESCE(solo_lectura, false)
            FROM usuarios
            WHERE id = %s AND COALESCE(estado, true) = true;
        """, (usuario_id,))
        usuario = cursor.fetchone()

        if usuario and _credencial_staff_valida(
            cursor, usuario[0], str(pin_ingresado or ''), usuario[7], usuario[8], usuario[9]
        ):
            conexion.commit()
            tokens = generar_token({
                "id":            usuario[0],
                "nombre":        usuario[1],
                "rol":           usuario[2],
                "area_asignada": usuario[6],
                "solo_lectura":  usuario[10],
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
                    "area_asignada": usuario[6],
                    "solo_lectura":  bool(usuario[10])
                }
            })
            return res, 200

        return jsonify({"exito": False, "error": "PIN incorrecto"}), 401

    except Exception as e:
        print(f"❌ Error en login: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            release_db_connection(conexion)


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
    conexion = None
    cursor = None
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()
        pin   = (data.get('pin')   or '').strip()

        if not email or not pin:
            return jsonify({"exito": False, "error": "Correo y contraseña son obligatorios"}), 400

        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # ── 1. Buscar en usuarios (staff: Admin, Vendedor, Operario…) ──────
        cursor.execute("""
            SELECT id, nombre, rol, empresa_nombre, empresa_ruc, email,
                   area_asignada, password_hash, contrasena, pin_acceso,
                   COALESCE(solo_lectura, false)
            FROM usuarios
            WHERE LOWER(email) = %s
              AND COALESCE(estado, true) = true;
        """, (email,))
        usuario = cursor.fetchone()

        if usuario and _credencial_staff_valida(
            cursor, usuario[0], pin, usuario[7], usuario[8], usuario[9]
        ):
            conexion.commit()
            tokens = generar_token({
                "id":            usuario[0],
                "nombre":        usuario[1],
                "rol":           usuario[2],
                "area_asignada": usuario[6],
                "solo_lectura":  usuario[10],
            })
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
                    "area_asignada": usuario[6],
                    "solo_lectura":  bool(usuario[10])
                }
            }), 200

        # ── 2. Buscar en clientes (registrados desde el landing) ───────────
        cursor.execute("""
            SELECT id, nombre, email, telefono, contrasena
            FROM clientes
            WHERE LOWER(email) = %s;
        """, (email,))
        cliente_row = cursor.fetchone()

        # Verificar hash — los clientes siempre usan contraseña propia
        cliente = cliente_row if (
            cliente_row
            and cliente_row[4]
            and check_password_hash(cliente_row[4], pin)
        ) else None

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
    finally:
        if cursor:
            cursor.close()
        if conexion:
            release_db_connection(conexion)


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
    if len(contrasena) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres'}), 400

    contrasena_hash = generate_password_hash(contrasena)  # nunca guardar texto plano

    conexion = None
    cursor = None
    try:
        conexion = get_db_connection()
        cursor   = conexion.cursor()

        # Bloquear cada identidad para que dos registros concurrentes no creen
        # clientes duplicados con distinto correo pero el mismo DNI/teléfono.
        for clave in (f'cliente-email:{email}', f'cliente-dni:{dni}' if dni else '',
                      f'cliente-telefono:{telefono}' if telefono else ''):
            if clave:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s));", (clave,))

        cursor.execute(
            "SELECT 1 FROM usuarios WHERE LOWER(email) = %s LIMIT 1;",
            (email,),
        )
        if cursor.fetchone():
            return jsonify({'error': 'Ese correo pertenece a una cuenta interna de Innova.'}), 409

        cursor.execute("""
            SELECT id, contrasena, COALESCE(telefono, ''), COALESCE(dni, ''),
                   COALESCE(email, '')
            FROM clientes
            WHERE LOWER(COALESCE(email, '')) = %s
               OR (
                    COALESCE(email, '') = ''
                    AND ((%s <> '' AND dni = %s)
                         OR (%s <> '' AND telefono = %s))
               )
            ORDER BY CASE WHEN LOWER(COALESCE(email, '')) = %s THEN 0 ELSE 1 END
            FOR UPDATE;
        """, (email, dni, dni, telefono, telefono, email))
        coincidencias = cursor.fetchall()
        if len(coincidencias) > 1:
            return jsonify({
                'error': 'Hay más de una ficha comercial con esos datos. Pide a Innova que las unifique.'
            }), 409
        existente = coincidencias[0] if coincidencias else None
        activada = False
        if existente:
            cliente_id, hash_existente, telefono_existente, dni_existente, _email_existente = existente
            if hash_existente:
                return jsonify({'error': 'Este correo ya está registrado'}), 409
            coincide_dato = (
                (dni_existente and dni and dni_existente == dni)
                or (telefono_existente and telefono and telefono_existente == telefono)
            )
            if not coincide_dato:
                return jsonify({
                    'error': 'La cuenta comercial ya existe. Usa el mismo DNI o teléfono registrado para activarla.'
                }), 409
            cursor.execute("""
                UPDATE clientes
                SET nombre = %s,
                    email = %s,
                    telefono = COALESCE(NULLIF(%s, ''), telefono),
                    dni = COALESCE(NULLIF(%s, ''), dni),
                    contrasena = %s
                WHERE id = %s
            """, (nombre, email, telefono, dni, contrasena_hash, cliente_id))
            activada = True
        else:
            cursor.execute("""
                INSERT INTO clientes (nombre, email, telefono, dni, contrasena)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (nombre, email, telefono or None, dni or None, contrasena_hash))
            cliente_id = cursor.fetchone()[0]
        conexion.commit()
        return jsonify({
            'exito':   True,
            'mensaje': (
                'Cuenta activada. Ya puedes rastrear los pedidos vinculados a este cliente.'
                if activada else
                '¡Registro exitoso! Ya puedes rastrear tus pedidos con tu correo.'
            )
        }), 200 if activada else 201

    except Exception:
        import traceback; traceback.print_exc()
        if 'conexion' in locals() and conexion: conexion.rollback()
        return jsonify({'error': 'Error interno del servidor'}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            release_db_connection(conexion)
