"""
notification_service.py

Capa operativa de notificaciones del ERP.

La idea es que rutas como ventas, taller o logistica pidan "notifica este
evento" y no sepan si por debajo sale por correo, WhatsApp o ambos. Hoy usa
database.notificar_usuario(), que ya centraliza el correo y deja listo el
telefono para una futura integracion con WhatsApp.
"""

import os
import smtplib
from email.mime.text import MIMEText

from database import _enviar_email_resend, notificar_usuario


ADMIN_ROLES = ("Admin", "Jefe_Taller")


def asegurar_esquema_notificaciones(cursor):
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")
    cursor.execute(
        "ALTER TABLE logistica_externa ADD COLUMN IF NOT EXISTS estado_distribucion VARCHAR(50);"
    )


def _env_emails():
    raw = ",".join(
        value for value in (
            os.getenv("ALERT_EMAILS", ""),
            os.getenv("ADMIN_EMAIL", ""),
            os.getenv("OWNER_EMAIL", ""),
        ) if value
    )
    return [email.strip() for email in raw.split(",") if email.strip()]


def _money(value):
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        number = 0
    return f"S/ {number:,.2f}"


def _fmt(value):
    if value is None:
        return "-"
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _fetch_admins(cursor):
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")
    recipients = {}

    for email in _env_emails():
        recipients[email.lower()] = {
            "email": email,
            "nombre": "Administracion",
            "telefono": None,
            "rol": "Admin",
        }

    cursor.execute(
        """
        SELECT nombre, email, telefono, rol
        FROM usuarios
        WHERE rol = ANY(%s)
          AND email IS NOT NULL
          AND TRIM(email) <> '';
        """,
        (list(ADMIN_ROLES),),
    )
    for nombre, email, telefono, rol in cursor.fetchall():
        recipients[email.lower()] = {
            "email": email,
            "nombre": nombre or "Administracion",
            "telefono": telefono,
            "rol": rol,
        }

    return list(recipients.values())


def _fetch_usuario(cursor, usuario_id):
    if not usuario_id:
        return None
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);")
    cursor.execute(
        """
        SELECT nombre, email, telefono, rol
        FROM usuarios
        WHERE id = %s;
        """,
        (usuario_id,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    nombre, email, telefono, rol = row
    return {
        "nombre": nombre or "Usuario",
        "email": email,
        "telefono": telefono,
        "rol": rol,
    }


def _send_many(recipients, subject, message):
    sent = 0
    skipped = 0
    for recipient in recipients:
        ok = notificar_usuario(
            recipient.get("email"),
            recipient.get("nombre") or "Usuario",
            subject,
            message,
            telefono=recipient.get("telefono"),
        )
        if ok:
            sent += 1
        else:
            skipped += 1
    return {"enviados": sent, "omitidos": skipped}


def notificar_contrato_creado(cursor, venta_id, datos, cantidad_items=None):
    """Notifica al equipo cuando se registra un contrato nuevo."""
    codigo = datos.get("codigo") or datos.get("codigo_venta") or f"venta-{venta_id}"
    cliente = datos.get("cliente") or datos.get("nombre_cliente") or "-"
    vendedor = _fetch_usuario(cursor, datos.get("vendedor_id"))
    nombre_vendedor = (
        (vendedor or {}).get("nombre")
        or datos.get("vendedor_nombre")
        or "Sin asignar"
    )
    items = cantidad_items
    if items is None:
        try:
            items = len(datos.get("muebles") or [])
        except TypeError:
            items = 0

    total = datos.get("total")
    if total is None:
        total = datos.get("total_venta")
    if total is None:
        total = datos.get("monto_total")

    resumen = [
        f"Contrato: {codigo}",
        f"Cliente: {cliente}",
        f"Vendedor: {nombre_vendedor}",
        f"Sede: {datos.get('sede') or '-'}",
        f"Total: {_money(total)}",
        f"Items: {items}",
        f"Fecha de entrega: {_fmt(datos.get('fecha_entrega'))}",
        "Estado inicial: Pendiente",
    ]

    admin_message = (
        "Se registro un nuevo contrato en el ERP Innova.\n\n"
        + "\n".join(resumen)
        + "\n\nRevisa produccion, logistica externa y pagos si corresponde."
    )
    admin_result = _send_many(
        _fetch_admins(cursor),
        f"[Innova] Nuevo contrato {codigo}",
        admin_message,
    )

    vendedor_result = {"enviados": 0, "omitidos": 0}
    if vendedor and vendedor.get("email"):
        vendedor_message = (
            f"Hola {vendedor.get('nombre')},\n\n"
            f"Tu contrato {codigo} fue registrado correctamente.\n\n"
            + "\n".join(resumen)
            + "\n\nEl sistema te avisara cuando cambie de estado."
        )
        vendedor_result = _send_many(
            [vendedor],
            f"[Innova] Contrato registrado {codigo}",
            vendedor_message,
        )

    return {
        "codigo": codigo,
        "admin": admin_result,
        "vendedor": vendedor_result,
    }


def notificar_estado_contrato(cursor, venta_id, nuevo_estado):
    """Notifica que un contrato cambio de estado."""
    cursor.execute(
        """
        SELECT codigo_venta, nombre_cliente, vendedor_id, vendedor_nombre,
               sede, monto_total, fecha_entrega
        FROM ventas
        WHERE id = %s;
        """,
        (venta_id,),
    )
    row = cursor.fetchone()
    if not row:
        return {"enviados": 0, "omitidos": 0, "motivo": "venta_no_encontrada"}

    codigo, cliente, vendedor_id, vendedor_nombre, sede, total, fecha_entrega = row
    vendedor = _fetch_usuario(cursor, vendedor_id)
    nombre_vendedor = (
        (vendedor or {}).get("nombre")
        or vendedor_nombre
        or "Sin asignar"
    )
    message = (
        "El contrato cambio de estado en el ERP Innova.\n\n"
        f"Contrato: {codigo}\n"
        f"Cliente: {cliente}\n"
        f"Nuevo estado: {nuevo_estado}\n"
        f"Vendedor: {nombre_vendedor}\n"
        f"Sede: {sede or '-'}\n"
        f"Total: {_money(total)}\n"
        f"Fecha de entrega: {_fmt(fecha_entrega)}"
    )

    recipients = _fetch_admins(cursor)
    if vendedor and vendedor.get("email"):
        recipients.append(vendedor)

    unique = {}
    for recipient in recipients:
        email = (recipient.get("email") or "").lower()
        if email:
            unique[email] = recipient

    result = _send_many(
        list(unique.values()),
        f"[Innova] {codigo} ahora esta {nuevo_estado}",
        message,
    )
    return {"codigo": codigo, **result}


def resumen_operativo(cursor):
    """Devuelve contadores de pendientes para correo o futuras alertas."""
    asegurar_esquema_notificaciones(cursor)

    cursor.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE estado_ticket = 'Pendiente') AS tickets_pendientes,
            COUNT(*) FILTER (WHERE estado_ticket = 'En Proceso') AS tickets_en_proceso,
            COUNT(*) FILTER (WHERE estado_ticket = 'Bloqueado') AS tickets_bloqueados
        FROM tickets_produccion;
        """
    )
    tickets = cursor.fetchone() or (0, 0, 0)

    cursor.execute(
        """
        SELECT COUNT(*)
        FROM logistica_externa
        WHERE COALESCE(estado, '') NOT IN ('Recibido', 'Cancelado', 'Completado', 'Entregado')
           OR COALESCE(estado_distribucion, '') IN ('Pendiente', 'Por Comprar', 'Por Pedir');
        """
    )
    logistica_pendiente = cursor.fetchone()[0] or 0

    cursor.execute("SELECT to_regclass('public.historial_precios');")
    if cursor.fetchone()[0]:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM historial_precios
            WHERE estado = 'Pendiente';
            """
        )
        cambios_precio = cursor.fetchone()[0] or 0
    else:
        cambios_precio = 0

    data = {
        "tickets_pendientes": int(tickets[0] or 0),
        "tickets_en_proceso": int(tickets[1] or 0),
        "tickets_bloqueados": int(tickets[2] or 0),
        "logistica_externa_pendiente": int(logistica_pendiente or 0),
        "cambios_precio_pendientes": int(cambios_precio or 0),
    }
    data["total_alertas"] = sum(
        int(value)
        for key, value in data.items()
        if key != "tickets_en_proceso"
    )
    return data


def enviar_resumen_operativo(cursor):
    data = resumen_operativo(cursor)
    message = (
        "Resumen operativo pendiente del ERP Innova.\n\n"
        f"Tickets pendientes: {data['tickets_pendientes']}\n"
        f"Tickets en proceso: {data['tickets_en_proceso']}\n"
        f"Tickets bloqueados: {data['tickets_bloqueados']}\n"
        f"Logistica externa pendiente: {data['logistica_externa_pendiente']}\n"
        f"Cambios de precio pendientes: {data['cambios_precio_pendientes']}\n\n"
        "Prioridad sugerida: revisar bloqueados, compras de logistica externa y cambios de precio."
    )
    result = _send_many(
        _fetch_admins(cursor),
        "[Innova] Resumen operativo pendiente",
        message,
    )
    return {**data, "notificaciones": result}


def enviar_correo_prueba(cursor=None):
    recipients = [
        {
            "email": email,
            "nombre": "Administracion",
            "telefono": None,
        }
        for email in _env_emails()
    ]
    if cursor is not None:
        asegurar_esquema_notificaciones(cursor)
        recipients = _fetch_admins(cursor)

    result = _send_many(
        recipients,
        "[Innova] Prueba de correo",
        "Correo de prueba enviado desde el ERP Innova. Si recibiste esto, SMTP esta funcionando.",
    )
    return {"destinatarios": len(recipients), "notificaciones": result}


def diagnosticar_correo_prueba():
    destinatarios = _env_emails()
    resend_api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "Innova Mobili <onboarding@resend.dev>")
    remitente = os.getenv("EMAIL_USER")
    password = os.getenv("EMAIL_PASS")
    smtp_server = os.getenv("EMAIL_SMTP", "smtp.gmail.com")
    smtp_port_raw = os.getenv("EMAIL_PORT", "587")

    diagnostico = {
        "canal": "resend" if resend_api_key else "smtp",
        "resend_api_key_configurado": bool(resend_api_key),
        "email_from": email_from if resend_api_key else None,
        "email_user_configurado": bool(remitente),
        "email_pass_configurado": bool(password),
        "smtp": smtp_server,
        "port": smtp_port_raw,
        "destinatarios": len(destinatarios),
        "resultados": [],
    }

    if not destinatarios:
        diagnostico["error"] = "ALERT_EMAILS no tiene destinatarios."
        return diagnostico
    if resend_api_key:
        resultados = []
        for email in destinatarios:
            resend_result = _enviar_email_resend(
                email,
                "[Innova] Prueba de correo",
                "Correo de prueba enviado desde el ERP Innova usando Resend.",
            )
            ok = bool(resend_result and resend_result.get("ok"))
            resultados.append({
                "email": email,
                "enviado": ok,
                "status": resend_result.get("status") if resend_result else None,
                "respuesta": resend_result.get("body") if resend_result else None,
            })
        diagnostico["enviados"] = sum(1 for r in resultados if r["enviado"])
        diagnostico["omitidos"] = len(resultados) - diagnostico["enviados"]
        diagnostico["resultados"] = resultados
        return diagnostico
    if not remitente:
        diagnostico["error"] = "EMAIL_USER no esta configurado."
        return diagnostico
    if not password:
        diagnostico["error"] = "EMAIL_PASS no esta configurado."
        return diagnostico

    try:
        smtp_port = int(smtp_port_raw)
    except (TypeError, ValueError):
        diagnostico["error"] = "EMAIL_PORT debe ser numerico."
        return diagnostico

    for email in destinatarios:
        try:
            msg = MIMEText(
                "Correo de prueba enviado desde el ERP Innova. SMTP esta funcionando."
            )
            msg["Subject"] = "[Innova] Prueba de correo"
            msg["From"] = remitente
            msg["To"] = email

            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(remitente, password)
                server.send_message(msg)

            diagnostico["resultados"].append({
                "email": email,
                "enviado": True,
                "error_tipo": None,
                "error": None,
            })
        except Exception as ex:
            diagnostico["resultados"].append({
                "email": email,
                "enviado": False,
                "error_tipo": type(ex).__name__,
                "error": str(ex),
            })

    diagnostico["enviados"] = sum(1 for r in diagnostico["resultados"] if r["enviado"])
    diagnostico["omitidos"] = len(diagnostico["resultados"]) - diagnostico["enviados"]
    return diagnostico
