"""Validaciones puras para datos sugeridos por el lector de vouchers."""

import math
import re


_EVIDENCIA_POS_FUERTE = re.compile(
    r"culqi|izipay|niubiz|openpay|\blote\b|pin verificado|"
    r"venta id|\bterminal\b|merchant discount|"
    r"\bap(?:robaci[oó]n)?\s*[:#-]?\s*\d+",
    re.I,
)


def normalizar_monto(valor):
    if valor in (None, ""):
        return None
    try:
        monto = float(str(valor).replace(",", "."))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(monto):
        return None
    return round(monto, 2)


def normalizar_montos_pago(monto_bruto, comision_pos=0, monto_neto=None):
    bruto = normalizar_monto(monto_bruto)
    comision = normalizar_monto(comision_pos)
    neto_sugerido = normalizar_monto(monto_neto)
    if comision is None or comision < 0 or (bruto is not None and comision > bruto):
        comision = 0
    if bruto is not None:
        return bruto, comision, round(bruto - comision, 2)
    return bruto, comision, neto_sugerido


def clasificar_error_gemini(codigo, detalle):
    """Map Gemini HTTP failures to a visible message, status and retry flag."""
    texto = str(detalle or "").lower()
    if any(token in texto for token in (
        "api_key_invalid", "api key not valid", "reported as leaked", "key was blocked"
    )) or codigo == 401:
        return (
            "La clave de Gemini es invalida, fue revocada o esta bloqueada; "
            "revisa GEMINI_API_KEY en Render",
            503,
            False,
        )
    if codigo == 429 or any(token in texto for token in (
        "resource_exhausted", "quota", "rate limit", "billing quota"
    )):
        return (
            "Gemini no tiene cuota disponible en este momento; registra el voucher manualmente",
            429,
            False,
        )
    if codigo == 403 or "permission_denied" in texto:
        return (
            "Gemini rechazo la clave por permisos o restricciones del proyecto; revisa AI Studio",
            503,
            False,
        )
    if codigo == 400 and any(token in texto for token in (
        "failed_precondition", "free tier", "billing", "country"
    )):
        return (
            "Gemini requiere billing o no habilita el nivel gratuito para este proyecto o region",
            503,
            False,
        )
    if codigo == 404:
        return ("El modelo Gemini solicitado no esta disponible", 503, False)
    if codigo in (408, 500, 503, 504):
        return (
            "Gemini esta temporalmente saturado o tardo demasiado; registra el voucher manualmente",
            503,
            True,
        )
    return (f"Gemini rechazo la lectura (HTTP {codigo})", 502, False)


def normalizar_confianza(valor):
    try:
        confianza = float(valor)
    except (TypeError, ValueError):
        return None
    if 1 < confianza <= 100:
        confianza /= 100
    if not 0 <= confianza <= 1:
        return None
    return round(confianza, 2)


def validar_clasificacion_pago(
    tipo_pago, entidad=None, numero_operacion=None, notas=None, confianza=None
):
    tipo = tipo_pago or None
    confianza_normalizada = normalizar_confianza(confianza)
    notas_limpias = str(notas or "")
    evidencia = " ".join(str(v or "") for v in (entidad, numero_operacion, notas))

    if (
        tipo
        and "pos" in str(tipo).lower()
        and not _EVIDENCIA_POS_FUERTE.search(evidencia)
    ):
        tipo = None
        confianza_normalizada = min(
            confianza_normalizada if confianza_normalizada is not None else 0.6,
            0.6,
        )
        notas_limpias = (
            f"{notas_limpias} Clasificacion POS omitida por falta de evidencia."
        ).strip()

    return tipo, confianza_normalizada, notas_limpias
