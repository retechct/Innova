import importlib.util
import sys
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from flask import Flask


ROOT = Path(__file__).resolve().parents[1]
TOKEN = "a" * 32


def cargar_rutas_con_database_falso():
    database = types.ModuleType("database")
    database.get_db_connection = lambda: None
    database.release_db_connection = lambda _conexion: None
    database.limpiar_foto = lambda valor: valor or ""
    database.notificar_usuario = lambda *_args, **_kwargs: None
    database.cloudinary_upload = lambda *_args, **_kwargs: {}

    spec = importlib.util.spec_from_file_location(
        "routes_produccion_quote_tests",
        ROOT / "routes_produccion.py",
    )
    modulo = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"database": database}):
        spec.loader.exec_module(modulo)
    return modulo


class CursorCotizacionFalso:
    def __init__(self, estado):
        self.estado = estado
        self.rowcount = 0
        self._one = None
        self._all = []
        self.consultas = []

    def execute(self, sql, params=None):
        consulta = " ".join(sql.split())
        self.consultas.append((consulta, params))
        self.rowcount = 0
        self._one = None
        self._all = []

        if consulta.startswith("SELECT id, proveedor_id, token_usado"):
            self._one = self.estado["lote"]
        elif consulta.startswith("SELECT id, logistica_externa_id"):
            self._all = list(self.estado["items"])
        elif consulta.startswith("UPDATE cotizacion_lote_items"):
            self.rowcount = 1
            self.estado["items_actualizados"] += 1
        elif consulta.startswith("UPDATE logistica_externa"):
            resultados = self.estado.get("resultados_logistica", [])
            self.rowcount = resultados.pop(0) if resultados else 1
            self.estado["logistica_actualizada"] += self.rowcount
        elif consulta.startswith("UPDATE cotizaciones_lote"):
            self.rowcount = self.estado.get("resultado_lote", 1)
        elif consulta.startswith("SELECT id, token_usado, fecha_envio_cotizacion"):
            self._one = self.estado.get("individual")

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._all

    def close(self):
        pass


class ConexionCotizacionFalsa:
    def __init__(self, estado):
        self.cursor_falso = CursorCotizacionFalso(estado)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cursor_falso

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class SupplierQuoteRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rutas = cargar_rutas_con_database_falso()
        cls.app = Flask(__name__)

    def crear_estado(self):
        return {
            "lote": (10, 7, False, "Pendiente", datetime.now()),
            "items": [(101, 1001), (102, 1002)],
            "individual": (1001, False, datetime.now(), "Cotizacion Enviada"),
            "items_actualizados": 0,
            "logistica_actualizada": 0,
        }

    def fecha_futura(self, dias=7):
        return (datetime.now() + timedelta(days=dias)).date().isoformat()

    def ejecutar_lote(self, estado, payload):
        conexion = ConexionCotizacionFalsa(estado)
        with patch.object(self.rutas, "get_db_connection", return_value=conexion), patch.object(
            self.rutas, "release_db_connection", return_value=None
        ), self.app.test_request_context(
            f"/api/cotizar-lote/{TOKEN}", method="POST", json=payload
        ):
            respuesta, status = self.rutas.cotizar_lote(TOKEN)
        return conexion, respuesta.get_json(), status

    def test_lote_ficticio_exige_una_respuesta_por_material(self):
        estado = self.crear_estado()
        conexion, datos, status = self.ejecutar_lote(estado, {
            "respuestas": [{
                "item_id": 101,
                "precio": 120,
                "fecha_entrega": self.fecha_futura(),
            }]
        })

        self.assertEqual(status, 400)
        self.assertIn("cada material", datos["error"])
        self.assertEqual(conexion.commits, 0)
        self.assertEqual(estado["items_actualizados"], 0)

    def test_lote_ficticio_se_guarda_completo_en_una_transaccion(self):
        estado = self.crear_estado()
        conexion, datos, status = self.ejecutar_lote(estado, {
            "respuestas": [
                {
                    "item_id": 101,
                    "precio": 120.50,
                    "fecha_entrega": self.fecha_futura(),
                    "notas": "Disponible",
                },
                {
                    "item_id": 102,
                    "precio": 80,
                    "fecha_entrega": self.fecha_futura(8),
                    "notas": "",
                },
            ]
        })

        self.assertEqual(status, 200)
        self.assertTrue(datos["exito"])
        self.assertEqual(conexion.commits, 1)
        self.assertEqual(estado["items_actualizados"], 2)
        self.assertEqual(estado["logistica_actualizada"], 2)
        consultas = "\n".join(sql for sql, _params in conexion.cursor_falso.consultas)
        self.assertIn("FOR UPDATE", consultas)
        self.assertIn("estado = 'Cotizado'", consultas)

    def test_lote_ficticio_revierte_si_un_material_cambio_de_estado(self):
        estado = self.crear_estado()
        estado["resultados_logistica"] = [1, 0]
        conexion, datos, status = self.ejecutar_lote(estado, {
            "respuestas": [
                {"item_id": 101, "precio": 120, "fecha_entrega": self.fecha_futura()},
                {"item_id": 102, "precio": 80, "fecha_entrega": self.fecha_futura(8)},
            ]
        })

        self.assertEqual(status, 409)
        self.assertIn("cambió de estado", datos["error"])
        self.assertEqual(conexion.commits, 0)
        self.assertGreaterEqual(conexion.rollbacks, 1)

    def test_lote_ficticio_no_acepta_reenvio_del_token(self):
        estado = self.crear_estado()
        estado["lote"] = (10, 7, True, "Respondido", datetime.now())
        conexion, datos, status = self.ejecutar_lote(estado, {"respuestas": []})

        self.assertEqual(status, 409)
        self.assertIn("ya fue enviada", datos["error"])
        self.assertEqual(conexion.commits, 0)

    def test_cotizacion_individual_rechaza_nan_sin_tocar_la_base(self):
        estado = self.crear_estado()
        conexion = ConexionCotizacionFalsa(estado)
        with patch.object(self.rutas, "get_db_connection", return_value=conexion), self.app.test_request_context(
            f"/api/cotizar/{TOKEN}",
            method="POST",
            json={"precio": "nan", "fecha_entrega": self.fecha_futura()},
        ):
            respuesta, status = self.rutas.responder_cotizacion(TOKEN)

        self.assertEqual(status, 400)
        self.assertIn("mayor que cero", respuesta.get_json()["error"])
        self.assertEqual(conexion.cursor_falso.consultas, [])


if __name__ == "__main__":
    unittest.main()
