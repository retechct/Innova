import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


class ProjectSafetyTests(unittest.TestCase):
    def test_api_errors_are_generic_by_default(self):
        app_py = read("app.py")

        self.assertIn("DEBUG_API_ERRORS", app_py)
        self.assertIn("'Error interno del servidor'", app_py)
        self.assertLess(
            app_py.index("DEBUG_API_ERRORS"),
            app_py.index("return jsonify({'error': str(ex), 'tipo': type(ex).__name__}), 500"),
        )

    def test_staff_login_uses_password_hash_path(self):
        usuarios_py = read("routes_usuarios.py")

        self.assertIn("password_hash", usuarios_py)
        self.assertIn("check_password_hash", usuarios_py)
        self.assertIn("generate_password_hash", usuarios_py)
        self.assertIn("_credencial_staff_valida", usuarios_py)
        self.assertNotIn("AND (pin_acceso = %s OR contrasena = %s)", usuarios_py)

    def test_frontend_has_html_escape_helpers(self):
        helpers_js = read("Vendedor/js/helpers.js")

        self.assertIn("function escapeHTML", helpers_js)
        self.assertIn("function escapeAttr", helpers_js)
        self.assertIn("function jsStringAttr", helpers_js)
        self.assertIn("textContent", helpers_js)

    def test_order_views_escape_backend_data(self):
        pedidos_js = read("Vendedor/js/modules/app/pedidos.js")
        filtros_js = read("Vendedor/js/busqueda_filtros.js")

        self.assertIn("escapeHTML(v.codigo)", pedidos_js)
        self.assertIn("jsStringAttr(v.codigo)", pedidos_js)
        self.assertIn("escapeHTML(v.codigo)", filtros_js)
        self.assertIn("jsStringAttr(v.codigo)", filtros_js)

    def test_expense_views_escape_names_in_options_and_rows(self):
        vendedores_js = read("Vendedor/js/modules/egresos/vendedores.js")
        estructuras_js = read("Vendedor/js/modules/egresos/estructuras.js")

        self.assertIn("escapeAttr(n)", vendedores_js)
        self.assertIn("escapeHTML(n)", vendedores_js)
        self.assertIn("escapeHTML(v.vendedor_nombre", vendedores_js)
        self.assertIn("escapeAttr(c)", estructuras_js)
        self.assertIn("escapeHTML(e.carpintero_nombre)", estructuras_js)
        self.assertIn("rel=\"noopener\"", estructuras_js)

    def test_contracts_and_logistics_escape_operational_data(self):
        contratos_js = read("Vendedor/js/modules/app/contratos.js")
        logistica_js = read("Vendedor/js/modules/app/logistica_externa.js")

        self.assertIn("escapeHTML(v.cliente)", contratos_js)
        self.assertIn("jsStringAttr(v.codigo)", contratos_js)
        self.assertIn("escapeHTML(h.motivo", contratos_js)
        self.assertIn("escapeHTML(c.producto)", contratos_js)
        self.assertIn("escapeHTML(item.insumo)", logistica_js)
        self.assertIn("escapeHTML(item.proveedor)", logistica_js)
        self.assertIn("escapeAttr(item.url_comprobante_pago)", logistica_js)
        self.assertIn("jsStringAttr(e)", logistica_js)

    def test_inventory_catalog_and_material_cards_escape_dynamic_data(self):
        modals_js = read("Vendedor/js/modules/inventario/modals.js")
        catalogo_js = read("Vendedor/js/catalogo.js")
        materiales_js = read("Vendedor/js/materiales.js")

        self.assertIn("const safeNom  = jsStringAttr(nombre)", modals_js)
        self.assertIn("escapeHTML(nombre)", modals_js)
        self.assertIn("escapeAttr(fotoUrl ||", modals_js)
        self.assertIn("imprimirEtiqueta(${codigoJS}", modals_js)
        self.assertIn("_invBuscarBarcode(${codigoJS})", modals_js)
        self.assertIn("nombreSeguro = escapeHTML(item.nombre", catalogo_js)
        self.assertIn("jsStringAttr(fotosStock)", catalogo_js)
        self.assertIn("escapeHTML(sede)", catalogo_js)
        self.assertIn("const linea = (label, value)", materiales_js)
        self.assertIn("const skuHTML", materiales_js)
        self.assertIn("const fotoJS", materiales_js)
        self.assertIn("const catJS", materiales_js)

    def test_alembic_no_longer_depends_on_flask_migrate(self):
        env_py = read("migrations/env.py")

        self.assertIn("DATABASE_URL", env_py)
        self.assertNotIn("current_app.extensions['migrate']", env_py)

    def test_operational_areas_keep_carpentry_available_for_future(self):
        constants_py = read("erp_constants.py")
        tickets_js = read("Vendedor/js/modules/taller/tickets.js")
        index_html = read("Vendedor/index.html")

        self.assertIn('"ESTRUCTURAS_MUEBLES": "Estructura de Sofa"', constants_py)
        self.assertIn('"CARPINTERIA": ["CARPINTERIA"]', constants_py)
        self.assertNotIn('"ESTRUCTURAS_MUEBLES", "ESTRUCTURAS", "CARPINTERIA"', constants_py)
        self.assertIn("Estructura de Sofa", tickets_js)
        self.assertIn("Área: Estructura de Sofá", index_html)
        self.assertIn('value="CARPINTERIA"', index_html)

    def test_fabric_contract_has_grouped_fabric_logistics_endpoint(self):
        produccion_py = read("routes_produccion.py")

        self.assertIn("/api/logistica/telas-por-contrato", produccion_py)
        self.assertIn("def obtener_telas_por_contrato", produccion_py)
        self.assertIn("COALESCE(l.categoria_insumo, '') = 'TELA'", produccion_py)
        self.assertIn('"lineas": []', produccion_py)
        self.assertIn('"estado_distribucion": estado_dist', produccion_py)
        self.assertIn("tarjeta[\"total_telas\"] += 1", produccion_py)


if __name__ == "__main__":
    unittest.main()
