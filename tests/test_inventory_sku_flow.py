import pathlib
import unittest

from sku_utils import generar_sku_maestro, normalizar_sku_maestro


ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


class FakeSkuCursor:
    def __init__(self, catalog_skus=None, stock_skus=None):
        self.catalog_skus = set(catalog_skus or [])
        self.stock_skus = set(stock_skus or [])
        self._row = None

    def execute(self, query, params=None):
        sql = " ".join(query.split())
        params = params or []
        if "pg_advisory_xact_lock" in sql:
            self._row = (None,)
        elif "FROM catalogo_productos" in sql:
            self._row = (1,) if params[0] in self.catalog_skus else None
        elif "FROM stock_productos" in sql:
            self._row = (1,) if params[0] in self.stock_skus else None
        else:
            raise AssertionError(f"Unexpected SQL in SKU helper: {sql}")

    def fetchone(self):
        return self._row


class InventorySkuFlowTests(unittest.TestCase):
    def test_master_sku_is_ascii_compact_and_barcode_friendly(self):
        sku = normalizar_sku_maestro(" Sofa Seccional Ripley 3-2-1 ")

        self.assertEqual("SOFA-SECCIONAL-RIP", sku)
        self.assertLessEqual(len(sku), 18)

    def test_generator_rejects_used_sku_and_suffixes_automatic_collision(self):
        used = "SIL-NORDICA"
        cursor = FakeSkuCursor(catalog_skus={used})

        with self.assertRaisesRegex(ValueError, "ya esta en uso"):
            generar_sku_maestro(cursor, "Silla", "Nordica", used)

        generated = generar_sku_maestro(cursor, "Silla", "Nordica")
        self.assertEqual("SIL-NORDICA-2", generated)

    def test_catalog_officialization_links_physical_units(self):
        catalog_py = read("routes_catalogo.py")
        inventory_js = read("Vendedor/js/inventario.js")

        self.assertIn("/api/catalogo/oficializar-stock", catalog_py)
        self.assertIn("FOR UPDATE", catalog_py)
        self.assertIn("UPDATE stock_productos", catalog_py)
        self.assertIn("catalogo_id = %s", catalog_py)
        self.assertIn("unidades_enlazadas", catalog_py)
        self.assertIn("_invOficializarProductoCatalogo", inventory_js)
        self.assertIn("Editar ficha, descripcion y fotos", inventory_js)

    def test_labels_keep_master_and_unit_identity_separate(self):
        labels_js = read("Vendedor/js/modules/inventario/etiquetas.js")
        production_py = read("routes_produccion.py")
        endpoint = production_py.split("def obtener_etiquetas_disponibles", 1)[1]
        endpoint = endpoint.split("@produccion_bp.route", 1)[0]

        self.assertIn("SKU MAESTRO", labels_js)
        self.assertIn("UNIDAD: ${it.codigo}", labels_js)
        self.assertIn("imprimirEtiquetaMaestra", labels_js)
        self.assertIn("omitidos", endpoint)
        self.assertNotIn("SIN-STOCK", endpoint)
        self.assertNotIn("es_pieza = 'sku_maestro' in item", endpoint)

    def test_cart_can_allocate_multiple_distinct_units(self):
        catalog_js = read("Vendedor/js/catalogo.js")
        inventory_py = read("routes_inventario.py")

        self.assertIn("swal-stock-cantidad", catalog_js)
        self.assertIn("idsYaAgregados", catalog_js)
        self.assertIn("unidadesSeleccionadas.forEach", catalog_js)
        self.assertIn("sedePreferida", catalog_js)
        self.assertIn("identidadPieza", catalog_js)
        self.assertIn("COALESCE(sp.{columna}, 0)", inventory_py)
        self.assertIn("pg_advisory_xact_lock", inventory_py)


if __name__ == "__main__":
    unittest.main()
