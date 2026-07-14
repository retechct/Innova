import importlib.util
import io
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Flask
from werkzeug.datastructures import FileStorage


ROOT = Path(__file__).resolve().parents[1]


def cargar_rutas_catalogo_aisladas():
    database = types.ModuleType("database")
    database.get_db_connection = lambda: None
    database.release_db_connection = lambda _conexion: None
    database.limpiar_foto = lambda valor: valor or ""
    database.cloudinary_upload = lambda *_args, **_kwargs: {}

    auth = types.ModuleType("auth_middleware")
    auth.requiere_login = lambda funcion: funcion
    auth.requiere_rol = lambda *_roles: lambda funcion: funcion

    spec = importlib.util.spec_from_file_location(
        "routes_catalogo_voucher_tests",
        ROOT / "routes_catalogo.py",
    )
    modulo = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"database": database, "auth_middleware": auth}):
        spec.loader.exec_module(modulo)
    return modulo


class VoucherRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rutas = cargar_rutas_catalogo_aisladas()
        cls.app = Flask(__name__)

    def test_falta_de_clave_gemini_devuelve_error_explicito(self):
        archivo = FileStorage(
            stream=io.BytesIO(b"imagen-ficticia"),
            filename="voucher.jpg",
            content_type="image/jpeg",
        )
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            resultado = self.rutas._leer_voucher_con_gemini(archivo)

        self.assertFalse(resultado["ok"])
        self.assertEqual(resultado["status"], 503)
        self.assertIn("GEMINI_API_KEY", resultado["error"])

    def test_cuota_gemini_llega_visible_al_frontend(self):
        with self.app.test_request_context(
            "/api/voucher/leer",
            method="POST",
            data={"archivo": (io.BytesIO(b"imagen-ficticia"), "voucher.jpg")},
            content_type="multipart/form-data",
        ), patch.object(
            self.rutas,
            "_leer_voucher_automatico",
            return_value={
                "ok": False,
                "error": "Gemini no tiene cuota disponible en este momento",
                "status": 429,
            },
        ):
            respuesta, status = self.rutas.leer_voucher()

        datos = respuesta.get_json()
        self.assertEqual(status, 429)
        self.assertFalse(datos["ok"])
        self.assertEqual(datos["modo"], "manual")
        self.assertIn("cuota", datos["error"])

    def test_pdf_queda_manual_sin_llamar_gemini(self):
        with self.app.test_request_context(
            "/api/voucher/leer",
            method="POST",
            data={"archivo": (io.BytesIO(b"pdf-ficticio"), "voucher.pdf", "application/pdf")},
            content_type="multipart/form-data",
        ), patch.object(self.rutas, "_leer_voucher_automatico") as lector:
            respuesta, status = self.rutas.leer_voucher()

        self.assertEqual(status, 415)
        self.assertEqual(respuesta.get_json()["modo"], "manual")
        lector.assert_not_called()


if __name__ == "__main__":
    unittest.main()
