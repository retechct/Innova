"""
database.py — Pool de conexiones y funciones compartidas de utilidad.
Importar en cualquier módulo con:
    from database import get_db_connection, release_db_connection, limpiar_foto
"""

import os
import smtplib
from email.mime.text import MIMEText
from psycopg2 import pool as pg_pool

BACKEND_URL = os.getenv("BACKEND_URL", "https://innova-4cnn.onrender.com")

# ─── Pool de conexiones ───────────────────────────────────────────────────────
_db_pool = pg_pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    host     = os.getenv("DB_HOST"),
    database = os.getenv("DB_NAME"),
    user     = os.getenv("DB_USER"),
    password = os.getenv("DB_PASSWORD"),
)


def get_db_connection():
    """Obtiene una conexión del pool (no abre una TCP nueva cada vez)."""
    return _db_pool.getconn()


def release_db_connection(conn):
    """Devuelve la conexión al pool para que otro request la reutilice."""
    if conn:
        _db_pool.putconn(conn)


# ─── Paginación genérica (server-side) ───────────────────────────────────────

def paginar(cursor, query, params, page=1, per_page=20):
    """
    Envuelve un SELECT ya armado (con WHERE/JOIN/GROUP BY/ORDER BY, lo que sea)
    y le agrega LIMIT/OFFSET, calculando también el total de filas para poder
    pintar los controles de página en el frontend.

    Uso:
        query = '''
            SELECT v.id, v.codigo_venta, v.nombre_cliente
            FROM ventas v
            WHERE v.vendedor_id = %s
            ORDER BY v.id DESC
        '''
        rows, total, total_pages = paginar(cursor, query, [vendedor_id], page=2, per_page=20)

    Parámetros:
        cursor    — cursor psycopg2 ya abierto
        query     — el SELECT completo, SIN ';' final y SIN LIMIT/OFFSET propios
        params    — lista/tupla de parámetros posicionales para `query`
        page      — página pedida (1-indexed). Se corrige a 1 si viene inválida.
        per_page  — tamaño de página. Tope de 100 para evitar abusos desde el
                    frontend (?per_page=99999).

    Retorna:
        (rows, total, total_pages)
        rows        — lista de tuplas de la página pedida (cursor.fetchall())
        total       — cantidad total de filas que matchean el query, sin paginar
        total_pages — total de páginas (mínimo 1, incluso si total == 0)

    Nota sobre el COUNT: envolver el query original en
    "SELECT COUNT(*) FROM (query) AS _conteo" funciona igual con GROUP BY
    (cuenta los grupos resultantes, no las filas crudas) y es más simple que
    mantener un segundo query de conteo a mano en cada endpoint.
    """
    try:
        page = int(page)
    except (TypeError, ValueError):
        page = 1
    page = max(1, page)

    try:
        per_page = int(per_page)
    except (TypeError, ValueError):
        per_page = 20
    per_page = max(1, min(per_page, 100))

    params = list(params) if params else []

    cursor.execute(f"SELECT COUNT(*) FROM ({query}) AS _conteo;", params)
    total = cursor.fetchone()[0] or 0
    total_pages = max(1, -(-total // per_page))  # ceil sin importar math

    if page > total_pages:
        page = total_pages

    offset = (page - 1) * per_page
    cursor.execute(f"{query} LIMIT %s OFFSET %s;", params + [per_page, offset])
    rows = cursor.fetchall()

    return rows, total, total_pages


# ─── Utilidades compartidas ───────────────────────────────────────────────────

def limpiar_foto(url):
    """
    Evita placeholders o URLs vacías en campos de foto.
    Para URLs de Cloudinary inyecta transformación WebP + calidad automática al vuelo,
    sin re-subir nada ni tocar la base de datos.
    """
    if not url or 'via.placeholder.com' in url or 'sin_foto.jpg' in str(url):
        return "imagenes/sin_foto.jpg"
    if url.startswith('http'):
        if 'res.cloudinary.com' in url and '/upload/' in url:
            # Solo inyectar si aún no tiene transformaciones aplicadas
            if '/upload/f_' not in url and '/upload/q_' not in url and '/upload/w_' not in url:
                url = url.replace(
                    '/upload/',
                    '/upload/f_webp,q_auto:good,w_1200,c_limit/'
                )
        return url
    return f"{BACKEND_URL}/uploads/{url}"


def cloudinary_upload(file_obj, folder: str, max_width: int = 1200):
    """
    Sube un archivo a Cloudinary con compresión automática y conversión a WebP.

    Usar en lugar de cloudinary.uploader.upload() en todos los blueprints:

        # ANTES
        res = cloudinary.uploader.upload(archivo, folder="vouchers_pagos")

        # DESPUÉS
        from database import cloudinary_upload
        res = cloudinary_upload(archivo, folder="vouchers_pagos")

    Parámetros:
        file_obj   — el objeto de archivo (request.files['foto'], etc.)
        folder     — carpeta en Cloudinary (igual que antes)
        max_width  — ancho máximo en px (default 1200). Para vouchers/comprobantes
                     donde se necesita leer texto, usar max_width=1600.

    La transformación aplicada:
        - w_{max_width},c_limit  → reduce si es más ancho, nunca agranda
        - q_auto:good            → Cloudinary elige calidad óptima (~70-85%)
        - f_webp                 → convierte a WebP (30% más liviano que JPEG)
    """
    import cloudinary.uploader
    return cloudinary.uploader.upload(
        file_obj,
        folder=folder,
        transformation=[
            {"width": max_width, "crop": "limit"},
            {"quality": "auto:good"},
            {"fetch_format": "webp"},
        ],
        overwrite=False,
    )


def enviar_notificacion_venta(correo_destino, codigo_venta, cliente):
    """Envía un correo automático al vendedor tras registrar una venta."""
    try:
        remitente   = os.getenv("EMAIL_USER")
        password    = os.getenv("EMAIL_PASS")
        smtp_server = os.getenv("EMAIL_SMTP", "smtp.gmail.com")
        smtp_port   = int(os.getenv("EMAIL_PORT", 587))

        if not remitente or not password:
            print("⚠️ Advertencia: Credenciales de correo no configuradas.")
            return

        mensaje = MIMEText(
            f"Se ha registrado una nueva venta.\n\nCódigo: {codigo_venta}\nCliente: {cliente}"
        )
        mensaje['Subject'] = f"Nueva Venta Registrada - {codigo_venta}"
        mensaje['From']    = remitente
        mensaje['To']      = correo_destino

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(remitente, password)
            server.send_message(mensaje)
    except Exception as e:
        print(f"Error al enviar correo de notificación: {e}")


def enviar_solicitud_cotizacion(correo_proveedor, nombre_proveedor,
                                insumo, link_formulario, codigo_venta):
    """Envía el correo de solicitud de cotización al proveedor externo."""
    try:
        remitente   = os.getenv('EMAIL_USER')
        password    = os.getenv('EMAIL_PASS')
        smtp_server = os.getenv('EMAIL_SMTP', 'smtp.gmail.com')
        smtp_port   = int(os.getenv('EMAIL_PORT', 587))

        if not remitente or not password:
            print('⚠️ Correo no configurado — no se envió cotización.')
            return

        cuerpo = f"""
Estimado/a {nombre_proveedor},

Le escribimos desde Innova Möbili para solicitar una cotización
del siguiente material:

  Material: {insumo}
  Referencia de venta: {codigo_venta}

Por favor ingrese al siguiente enlace para enviarnos su precio
y fecha de entrega estimada:

  {link_formulario}

Tiene 3 días hábiles para responder. Gracias.

Innova Möbili — Área de Compras
"""
        msg = MIMEText(cuerpo.strip())
        msg['Subject'] = (
            f"Solicitud de cotización — {insumo} (Ref. {codigo_venta})"
        )
        msg['From'] = remitente
        msg['To']   = correo_proveedor

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(remitente, password)
            server.send_message(msg)

        print(f'✅ Cotización enviada a {correo_proveedor}')
    except Exception as e:
        print(f'Error al enviar cotización: {e}')


# ─── Notificaciones internas a usuarios del ERP (operarios, choferes, etc.) ──
def notificar_usuario(destinatario_email, nombre_destinatario, asunto, mensaje, telefono=None):
    """
    Capa de abstracción para notificar a un usuario del ERP (operario,
    chofer, jefe de taller, etc.) — por ejemplo cuando se le asigna un
    ticket nuevo.

    Por qué existe esta función en vez de llamar smtplib directamente
    desde cada ruta: el día que conectes WhatsApp Business (Meta Cloud API)
    o un proveedor como Twilio, solo cambias el CUERPO de esta función.
    Todos los lugares del sistema que ya llaman a notificar_usuario()
    empezarán a notificar por WhatsApp sin que toques nada más.

    HOY  → envía por correo (usa las mismas credenciales EMAIL_USER /
           EMAIL_PASS que ya usa enviar_notificacion_venta()).
    LUEGO → cuando tengas WhatsApp Business listo, reemplaza el cuerpo
           por una llamada a la Cloud API usando `telefono`.

    El parámetro `telefono` se recibe ya desde ahora (aunque hoy no se
    use) para que los lugares que llaman a esta función no tengan que
    cambiar cuando se conecte el canal nuevo.

    Retorna True/False según si se pudo enviar.
    """
    if not destinatario_email:
        print(f"⚠️  notificar_usuario: '{nombre_destinatario}' no tiene correo registrado — no se envió notificación.")
        return False

    try:
        remitente   = os.getenv("EMAIL_USER")
        password    = os.getenv("EMAIL_PASS")
        smtp_server = os.getenv("EMAIL_SMTP", "smtp.gmail.com")
        smtp_port   = int(os.getenv("EMAIL_PORT", 587))

        if not remitente or not password:
            print("⚠️ Advertencia: Credenciales de correo no configuradas — no se envió notificación.")
            return False

        msg = MIMEText(mensaje)
        msg['Subject'] = asunto
        msg['From']    = remitente
        msg['To']      = destinatario_email

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(remitente, password)
            server.send_message(msg)

        print(f"✅ Notificación enviada a {nombre_destinatario} ({destinatario_email})")
        return True
    except Exception as e:
        print(f"⚠️ Error al notificar a {nombre_destinatario}: {e}")
        return False