import unittest
from pathlib import Path
from unittest.mock import patch

from migrations import bootstrap


ROOT = Path(__file__).resolve().parents[1]


class RuntimeMigrationTests(unittest.TestCase):
    def test_render_runs_pending_migrations(self):
        with patch.object(bootstrap, "upgrade_database") as upgrade:
            applied = bootstrap.upgrade_database_on_render({"RENDER": "true"})

        self.assertTrue(applied)
        upgrade.assert_called_once_with()

    def test_local_and_emergency_skip_do_not_touch_database(self):
        with patch.object(bootstrap, "upgrade_database") as upgrade:
            self.assertFalse(bootstrap.upgrade_database_on_render({}))
            self.assertFalse(bootstrap.upgrade_database_on_render({
                "RENDER": "true",
                "IS_PULL_REQUEST": "true",
            }))
            self.assertFalse(bootstrap.upgrade_database_on_render({
                "RENDER": "true",
                "SKIP_DB_MIGRATIONS": "true",
            }))

        upgrade.assert_not_called()

    def test_repair_revision_contains_ticket_columns(self):
        migration = (
            ROOT / "migrations" / "versions" / "20260714_reparar_tickets_taller.py"
        ).read_text(encoding="utf-8")
        for column in (
            "categoria_insumo",
            "estado_distribucion",
            "operario_id",
            "recogido_por_id",
            "distribuido_por_id",
            "tipo_gestion",
        ):
            self.assertIn(f"ADD COLUMN IF NOT EXISTS {column}", migration)

        app_py = (ROOT / "app.py").read_text(encoding="utf-8")
        self.assertIn("upgrade_database_on_render()", app_py)

    def test_taller_error_is_visible_and_retryable(self):
        route = (ROOT / "routes_produccion.py").read_text(encoding="utf-8")
        frontend = (
            ROOT / "Vendedor" / "js" / "modules" / "taller" / "tickets.js"
        ).read_text(encoding="utf-8")

        self.assertIn("'codigo': 'TALLER_TICKETS_ERROR'", route)
        self.assertIn("tickets?.codigo", frontend)
        self.assertIn('title="Reintentar carga"', frontend)


if __name__ == "__main__":
    unittest.main()
