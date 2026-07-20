import ast
from pathlib import Path
import unittest
from unittest.mock import patch

from flask import Flask, jsonify
from flask_jwt_extended import JWTManager, create_access_token, decode_token

from auth_middleware import auth_bp, generar_token, requiere_login, requiere_rol


ROOT = Path(__file__).resolve().parents[1]


class DemoReadOnlyTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config["JWT_SECRET_KEY"] = "test-secret-not-for-production-32-bytes-minimum"
        JWTManager(self.app)
        self.app.register_blueprint(auth_bp)
        self.escrituras = []

        @self.app.get("/admin")
        @requiere_rol("Admin")
        def admin_read():
            return jsonify({"ok": True})

        @self.app.post("/admin")
        @requiere_rol("Admin")
        def admin_write():
            self.escrituras.append("admin")
            return jsonify({"ok": True})

        @self.app.patch("/staff")
        @requiere_login
        def staff_write():
            self.escrituras.append("staff")
            return jsonify({"ok": True})

        self.client = self.app.test_client()

    def _token(self, solo_lectura):
        with self.app.app_context():
            return create_access_token(
                identity="99",
                additional_claims={
                    "nombre": "Demo",
                    "rol": "Admin",
                    "area_asignada": "GENERAL",
                    "solo_lectura": solo_lectura,
                },
            )

    @staticmethod
    def _headers(token):
        return {"Authorization": f"Bearer {token}"}

    @patch("auth_middleware._token_invalidado_por_corte_global", return_value=False)
    def test_demo_can_read_admin_sections(self, _corte):
        response = self.client.get("/admin", headers=self._headers(self._token(True)))
        self.assertEqual(response.status_code, 200)

    @patch("auth_middleware._token_invalidado_por_corte_global", return_value=False)
    def test_demo_cannot_write_through_either_decorator(self, _corte):
        token = self._token(True)
        for method, path in ((self.client.post, "/admin"), (self.client.patch, "/staff")):
            response = method(path, headers=self._headers(token))
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.get_json()["codigo"], "CUENTA_SOLO_LECTURA")
        self.assertEqual(self.escrituras, [])

    @patch("auth_middleware._token_invalidado_por_corte_global", return_value=False)
    def test_normal_admin_keeps_write_access(self, _corte):
        response = self.client.post("/admin", headers=self._headers(self._token(False)))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.escrituras, ["admin"])

    def test_generated_access_and_refresh_tokens_are_marked(self):
        with self.app.app_context():
            tokens = generar_token({
                "id": 99,
                "nombre": "Demo",
                "rol": "Admin",
                "area_asignada": "GENERAL",
                "solo_lectura": True,
            })
            self.assertTrue(decode_token(tokens["access"])["solo_lectura"])
            self.assertTrue(decode_token(tokens["refresh"])["solo_lectura"])

    @patch("auth_middleware._token_invalidado_por_corte_global", return_value=False)
    def test_refresh_keeps_demo_in_read_only_mode(self, _corte):
        with self.app.app_context():
            refresh = generar_token({
                "id": 99,
                "nombre": "Demo",
                "rol": "Admin",
                "area_asignada": "GENERAL",
                "solo_lectura": True,
            })["refresh"]

        response = self.client.post(
            "/api/auth/refresh",
            headers=self._headers(refresh),
        )
        self.assertEqual(response.status_code, 200)
        with self.app.app_context():
            self.assertTrue(decode_token(response.get_json()["access"])["solo_lectura"])

    def test_every_internal_write_route_uses_auth_middleware(self):
        public_write_functions = {
            "verificar_pin",
            "verificar_email_pin",
            "registrar_usuario_web",
            "cotizar_lote",
            "responder_cotizacion",
        }
        violations = []

        for path in [ROOT / "app.py", *sorted(ROOT.glob("routes_*.py"))]:
            tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
            for node in tree.body:
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                decorators = [ast.unparse(item) for item in node.decorator_list]
                routes = [item for item in decorators if ".route(" in item]
                has_write_method = any(
                    any(f"'{method}'" in route for method in ("POST", "PUT", "PATCH", "DELETE"))
                    for route in routes
                )
                if not routes or not has_write_method or node.name in public_write_functions:
                    continue
                if not any("requiere_login" in item or "requiere_rol" in item for item in decorators):
                    violations.append(f"{path.name}:{node.lineno}:{node.name}")

        self.assertEqual(violations, [], "Rutas de escritura sin proteccion: " + ", ".join(violations))

    def test_migration_creates_seeded_read_only_account_without_plaintext_password(self):
        migration = (
            ROOT / "migrations" / "versions" / "20260719_cuenta_demo_solo_lectura.py"
        ).read_text(encoding="utf-8")
        self.assertIn("ADD COLUMN IF NOT EXISTS solo_lectura", migration)
        self.assertIn("demo.entrevista@innovamobili.com", migration)
        self.assertIn("solo_lectura = TRUE", migration)
        self.assertIn("scrypt:32768:8:1$", migration)
        self.assertNotIn("DEMO_PASSWORD =", migration)


if __name__ == "__main__":
    unittest.main()
