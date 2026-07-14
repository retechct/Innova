"""
routes_taller.py — Blueprint auxiliar del taller.

NOTA: Las rutas /api/taller/stats, /api/taller/ordenes y
/api/taller/ticket/<id>/nota fueron eliminadas de este archivo
porque ya estaban definidas en routes_produccion.py (produccion_bp).
Flask solo registra la primera copia; tener dos causaba que los
cambios hechos en una versión nunca llegaran al usuario.

A7 (Plan de Acción Mayo 2026): Se eliminó el ThreadedConnectionPool
propio de este blueprint. Ahora usa get_db_connection / release_db_connection
de database.py, igual que el resto del sistema.
El pool propio generaba hasta 15 conexiones simultáneas innecesarias.

Este archivo conserva únicamente:
  - El Blueprint taller_bp (usado en app.py)
  - init_taller_pool() mantenida como stub vacío para no romper app.py
  - Los helpers internos de foto
"""

import os
from flask import Blueprint

taller_bp = Blueprint('taller_extra', __name__)


def init_taller_pool():
    """
    A7: Ya no crea un pool propio. Se mantiene por compatibilidad
    con la llamada en app.py. El pool global de database.py se usa
    en su lugar.
    """
    pass  # No-op: el pool de database.py se inicializa automáticamente


def _limpiar_foto(url):
    backend = os.getenv("BACKEND_URL", "https://innovamobili.com")
    if not url or "via.placeholder.com" in url or 'sin_foto.jpg' in str(url):
        return "imagenes/sin_foto.jpg"
    if url.startswith("http"):
        return url
    return f"{backend}/uploads/{url}"


# ─────────────────────────────────────────────────────────────────────────────
# A1 (ya aplicado): Las siguientes rutas fueron ELIMINADAS de este archivo
# porque ya existen en routes_produccion.py (produccion_bp) y registrarlas
# dos veces hace que Flask ignore silenciosamente la segunda definición:
#
#   GET  /api/taller/stats                    → ver routes_produccion.py
#   GET  /api/taller/ordenes                  → ver routes_produccion.py
#   POST /api/taller/ticket/<id>/nota         → ver routes_produccion.py
# ─────────────────────────────────────────────────────────────────────────────
