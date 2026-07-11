"""Shared helpers for stable product master SKUs."""

import re
import unicodedata


SKU_PREFIXES = {
    "sofa": "SOF",
    "butaca": "BUT",
    "silla": "SIL",
    "espejo": "ESP",
    "cuadro": "CUA",
    "cojin": "COJ",
    "mesa centro": "MEC",
    "consola": "CON",
    "esquinero": "ESQ",
    "florero": "FLO",
    "manta": "MAN",
    "puff": "PUF",
}


def _texto_ascii(valor):
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    return "".join(ch for ch in texto if not unicodedata.combining(ch))


def normalizar_sku_maestro(valor):
    sku = _texto_ascii(valor).upper().strip()
    sku = re.sub(r"[^A-Z0-9]+", "-", sku).strip("-")
    # Keep CODE128 compact enough for reliable thermal-label scanning.
    return sku[:18].rstrip("-")


def _sku_esta_disponible(cursor, sku, excluir_catalogo_id=None):
    params = [sku]
    filtro_id = ""
    if excluir_catalogo_id:
        filtro_id = " AND id != %s"
        params.append(excluir_catalogo_id)

    cursor.execute(
        f"""
        SELECT 1
        FROM catalogo_productos
        WHERE UPPER(COALESCE(sku_maestro, '')) = %s
        {filtro_id}
        LIMIT 1
        """,
        params,
    )
    if cursor.fetchone():
        return False

    if excluir_catalogo_id:
        cursor.execute(
            """
            SELECT 1
            FROM stock_productos
            WHERE UPPER(COALESCE(sku_maestro, '')) = %s
              AND catalogo_id IS DISTINCT FROM %s
            LIMIT 1
            """,
            (sku, excluir_catalogo_id),
        )
    else:
        cursor.execute(
            """
            SELECT 1
            FROM stock_productos
            WHERE UPPER(COALESCE(sku_maestro, '')) = %s
            LIMIT 1
            """,
            (sku,),
        )
    return cursor.fetchone() is None


def generar_sku_maestro(cursor, categoria, nombre, solicitado=None, excluir_catalogo_id=None):
    # Serialize allocation inside the current PostgreSQL transaction.
    cursor.execute("SELECT pg_advisory_xact_lock(hashtext('innova-sku-maestro'))")
    solicitado_normalizado = normalizar_sku_maestro(solicitado)
    if solicitado_normalizado:
        if not _sku_esta_disponible(cursor, solicitado_normalizado, excluir_catalogo_id):
            raise ValueError(f"El SKU maestro {solicitado_normalizado} ya esta en uso")
        return solicitado_normalizado

    categoria_normalizada = normalizar_sku_maestro(categoria).lower().replace("-", " ")
    prefijo = SKU_PREFIXES.get(categoria_normalizada, "PRD")
    nombre_slug = normalizar_sku_maestro(nombre) or "MODELO"
    base = f"{prefijo}-{nombre_slug}"[:18].rstrip("-")

    candidato = base
    correlativo = 2
    while not _sku_esta_disponible(cursor, candidato, excluir_catalogo_id):
        sufijo = f"-{correlativo}"
        candidato = f"{base[:18 - len(sufijo)]}{sufijo}"
        correlativo += 1
    return candidato
