"""Pure routing rules shared by the Flask frontend fallback and tests."""


def es_ruta_frontend(filename):
    """Return True for an extensionless SPA route, never for an API route."""
    path = str(filename or "").strip("/")
    if not path or path.startswith("api/"):
        return False
    return "." not in path.rsplit("/", 1)[-1]
