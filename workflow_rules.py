"""Reglas puras y compartidas del flujo operativo."""

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

ESTADOS_TICKET_TERMINALES = frozenset({
    "Terminado",
    "Listo para Recojo",
    "Recogido",
    "Cancelado",
})

ESTADOS_ESTRUCTURA_DISPONIBLE_TAPICERIA = frozenset({
    "Terminado",
    "Recogido",
})

ESTADOS_LOGISTICA_CERRADOS = frozenset({
    "Recibido",
    "Cancelado",
    "Rechazado",
})

ESTADOS_LOGISTICA_INICIALES = frozenset({
    "POR_PEDIR",
    "Por Pedir",
    "Pendiente",
})

TRANSICIONES_LOGISTICA = {
    "Pendiente": frozenset({"Cotizacion Enviada", "Cancelado"}),
    "Cotizacion Enviada": frozenset({
        "Cotizacion Recibida",
        "Cotizado",
        "Cancelado",
    }),
    "Cotizacion Recibida": frozenset({"Cotizado", "Cancelado"}),
    "Cotizado": frozenset({"Orden Enviada", "Cancelado"}),
    "Orden Enviada": frozenset({
        "Confirmado",
        "En Tránsito",
        "Pagado",
        "Listo para Recojo",
        "Recibido",
        "Cancelado",
    }),
    "Confirmado": frozenset({
        "En Tránsito",
        "Pagado",
        "Listo para Recojo",
        "Recibido",
        "Cancelado",
    }),
    "En Tránsito": frozenset({"Pagado", "Listo para Recojo", "Recibido", "Cancelado"}),
    "Pagado": frozenset({"Listo para Recojo", "Recibido"}),
    "Listo para Recojo": frozenset({"Recibido"}),
    "Recibido": frozenset(),
    "Cancelado": frozenset(),
    "Rechazado": frozenset(),
}

ESTADOS_DESPACHO_CERRADOS = frozenset({
    "Terminado",
    "Recogido",
    "Cancelado",
})

ESTADOS_DESPACHO_ENTREGADOS = frozenset({
    "Terminado",
    "Recogido",
})

ESTADOS_DISTRIBUCION_TELA = {
    "en espera": "En espera",
    "en recojo": "En Recojo",
    "recogido": "Recogido",
    "distribuido": "Distribuido",
    # Estado historico que dejaba filas sin una accion visible en el frontend.
    "listo para recojo": "En espera",
}


def ticket_esta_terminado(estado):
    return estado in ESTADOS_TICKET_TERMINALES


def estructura_disponible_para_tapiceria(estado):
    return estado in ESTADOS_ESTRUCTURA_DISPONIBLE_TAPICERIA


def puede_desbloquear_tapiceria(estados_estructura, telas_pendientes=0):
    return (
        int(telas_pendientes or 0) == 0
        and all(estructura_disponible_para_tapiceria(e) for e in estados_estructura)
    )


def contrato_listo_para_despacho(
    estados_produccion, estados_logistica=(), estados_distribucion_telas=()
):
    return (
        all(e in ESTADOS_DESPACHO_CERRADOS for e in estados_produccion)
        and all(e in ESTADOS_LOGISTICA_CERRADOS for e in estados_logistica)
        and all(e == "Distribuido" for e in estados_distribucion_telas)
    )


def contrato_entregado(estados_despacho):
    estados = tuple(estados_despacho)
    return bool(estados) and all(e in ESTADOS_DESPACHO_ENTREGADOS for e in estados)


def normalizar_estado_distribucion(estado):
    texto = str(estado or "").strip()
    if not texto:
        return "En espera"
    return ESTADOS_DISTRIBUCION_TELA.get(texto.casefold(), texto)


def normalizar_estado_logistica(estado):
    texto = str(estado or "").strip()
    return "Pendiente" if texto in ESTADOS_LOGISTICA_INICIALES else texto


def transicion_logistica_permitida(estado_actual, estado_nuevo, tipo_gestion="Externo"):
    actual = normalizar_estado_logistica(estado_actual)
    nuevo = normalizar_estado_logistica(estado_nuevo)
    if not actual or not nuevo:
        return False
    if actual == nuevo:
        return True
    gestion_directa = str(tipo_gestion or "Externo").strip().casefold() in {
        "interno",
        "informal",
    }
    if actual == "Pendiente" and nuevo == "Recibido" and gestion_directa:
        return True
    return nuevo in TRANSICIONES_LOGISTICA.get(actual, frozenset())


def tela_puede_distribuirse(tipo_gestion, estado_distribucion):
    estado = normalizar_estado_distribucion(estado_distribucion)
    if estado == "Recogido":
        return True
    gestion = str(tipo_gestion or "Externo").strip().casefold()
    return gestion in {"interno", "informal"} and estado in {
        "En espera",
        "En Recojo",
    }


def tela_requiere_comprobante(tipo_gestion):
    return str(tipo_gestion or "Externo").strip().casefold() not in {
        "interno",
        "informal",
    }


def ids_items_logistica(item_id, item_ids_extra=""):
    """Normaliza la relacion legacy CSV sin duplicar ids."""
    resultado = []
    for valor in [item_id, *str(item_ids_extra or "").split(",")]:
        try:
            normalizado = int(valor)
        except (TypeError, ValueError):
            continue
        if normalizado not in resultado:
            resultado.append(normalizado)
    return resultado


def siguiente_limite(actual, total, paso=10):
    actual = max(0, int(actual or 0))
    total = max(0, int(total or 0))
    paso = max(1, int(paso or 1))
    return min(actual + paso, total)


def normalizar_precio_cotizacion(valor):
    """Valida un precio publico antes de enviarlo a PostgreSQL."""
    if isinstance(valor, bool) or valor is None:
        raise ValueError("El precio debe ser un numero mayor que cero")
    try:
        precio = Decimal(str(valor).strip())
    except (InvalidOperation, ValueError):
        raise ValueError("El precio debe ser un numero valido") from None
    if not precio.is_finite() or precio <= 0:
        raise ValueError("El precio debe ser un numero mayor que cero")
    if precio > Decimal("99999999.99"):
        raise ValueError("El precio supera el limite permitido")
    redondeado = precio.quantize(Decimal("0.01"))
    if precio != redondeado:
        raise ValueError("El precio admite como maximo dos decimales")
    return redondeado


def normalizar_fecha_cotizacion(valor, fecha_minima=None):
    """Acepta exclusivamente una fecha ISO real, sin conversiones ambiguas."""
    if isinstance(valor, datetime):
        fecha = valor.date()
    elif isinstance(valor, date):
        fecha = valor
    else:
        if not isinstance(valor, str) or not valor.strip():
            raise ValueError("La fecha de entrega es obligatoria")
        try:
            fecha = date.fromisoformat(valor.strip())
        except ValueError:
            raise ValueError("La fecha de entrega debe tener formato AAAA-MM-DD") from None
    if fecha_minima and fecha < fecha_minima:
        raise ValueError("La fecha de entrega no puede estar en el pasado")
    return fecha


def cotizacion_esta_vigente(fecha_envio, ahora=None, dias_habiles=3):
    """Mantiene el enlace activo hasta terminar el ultimo dia habil."""
    if not fecha_envio:
        return False
    if isinstance(fecha_envio, datetime):
        fecha_inicio = fecha_envio.date()
    elif isinstance(fecha_envio, date):
        fecha_inicio = fecha_envio
    else:
        return False

    fecha_actual = (ahora or datetime.now()).date()
    limite = fecha_inicio
    pendientes = max(0, int(dias_habiles or 0))
    while pendientes:
        limite += timedelta(days=1)
        if limite.weekday() < 5:
            pendientes -= 1
    return fecha_actual <= limite
