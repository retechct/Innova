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


# ─── Utilidades compartidas ───────────────────────────────────────────────────

def limpiar_foto(url):
    """Evita placeholders o URLs vacías en campos de foto."""
    if not url or 'via.placeholder.com' in url or 'sin_foto.jpg' in str(url):
        return "imagenes/sin_foto.jpg"
    if url.startswith('http'):
        return url
    return f"{BACKEND_URL}/uploads/{url}"


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