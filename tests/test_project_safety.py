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
        self.assertIn("@app.route('/favicon.ico')", app_py)
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
        carrito_js = read("Vendedor/js/carrito.js")
        ventas_py = read("routes_ventas.py")
        catalogo_py = read("routes_catalogo.py")
        logistica_js = read("Vendedor/js/modules/app/logistica_externa.js")

        self.assertIn("escapeHTML(v.codigo)", pedidos_js)
        self.assertIn("jsStringAttr(v.codigo)", pedidos_js)
        self.assertIn("escapeHTML(v.codigo)", filtros_js)
        self.assertIn("jsStringAttr(v.codigo)", filtros_js)
        self.assertIn("comision > monto", carrito_js)
        self.assertIn("comision_pos > monto_bruto", ventas_py)
        self.assertIn("/api/voucher/leer", catalogo_py)
        self.assertIn("_leer_voucher_automatico", catalogo_py)
        self.assertIn("_leer_voucher_con_openai", catalogo_py)
        self.assertIn("_llamar_openai_voucher", catalogo_py)
        self.assertIn("_leer_voucher_con_gemini", catalogo_py)
        self.assertNotIn("def _datos_voucher_desde_json(extraido):\n    resultado = _datos_voucher_desde_json(extraido)", catalogo_py)
        self.assertIn("json_object", catalogo_py)
        self.assertIn("La API key de OpenAI no tiene saldo", catalogo_py)
        self.assertIn("'modo': 'manual'", catalogo_py)
        self.assertIn("OPENAI_API_KEY", catalogo_py)
        self.assertIn("GEMINI_API_KEY", catalogo_py)
        self.assertIn("gemini-2.5-flash", catalogo_py)
        self.assertIn("x-goog-api-key", catalogo_py)
        self.assertIn("generativelanguage.googleapis.com", catalogo_py)
        self.assertIn("proveedor_ocr", catalogo_py)
        self.assertIn("leerVoucherAutomatico", carrito_js)
        self.assertIn("_aplicarDatosVoucher", carrito_js)
        self.assertIn("voucher_leido_auto", carrito_js)
        self.assertIn("_leerVoucherLogisticaAutomatico", logistica_js)
        self.assertIn("window._ultimoVoucherLogisticaOCR", logistica_js)
        self.assertIn("precio acordado", logistica_js)

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
        self.assertIn("escapeHTML(item.estado)", logistica_js)

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
        tickets_js = read("Vendedor/js/modules/taller/tickets.js")
        ficha_js = read("Vendedor/js/modules/taller/ficha_asignaciones.js")
        orden_pedido_js = read("Vendedor/js/modules/taller/orden_pedido.js")

        self.assertIn("/api/logistica/telas-por-contrato", produccion_py)
        self.assertIn("def obtener_telas_por_contrato", produccion_py)
        self.assertIn("operario_id = request.args.get('operario_id')", produccion_py)
        self.assertIn("COALESCE(l.categoria_insumo, '') = 'TELA'", produccion_py)
        self.assertIn('"lineas": []', produccion_py)
        self.assertIn('"tapicero_destino": destino.get("tapicero")', produccion_py)
        self.assertIn('"cojinero_destino": destino.get("cojinero")', produccion_py)
        self.assertIn('"estado_distribucion": estado_dist', produccion_py)
        self.assertIn('"operario_id": r[21]', produccion_py)
        self.assertIn("tarjeta[\"total_telas\"] += 1", produccion_py)
        self.assertIn("/api/logistica/telas-por-contrato", tickets_js)
        self.assertIn("renderContratosTelaBackendHTML", tickets_js)
        self.assertIn("const esOperarioTelas", tickets_js)
        self.assertIn("? await cargarContratosTelaAgrupados(null, filtroTaller)", tickets_js)
        self.assertIn("&& !t.trabajador", tickets_js)
        self.assertIn("t.area !== 'CORTE_Y_CONTROL_TELAS'", tickets_js)
        self.assertIn("confirmarRecojoContratoTela", tickets_js)
        self.assertIn("confirmarDistribucionLote", tickets_js)
        self.assertIn("l.estado === 'En Recojo' || l.estado === 'En espera'", tickets_js)
        self.assertIn("Comprobante obligatorio", ficha_js)
        self.assertIn("Bandeja compartida de Telas", orden_pedido_js)
        self.assertIn("t.estado === 'En Recojo' || t.estado === 'En espera'", orden_pedido_js)
        self.assertIn("t.estado === 'Pendiente' || isEnProceso", orden_pedido_js)
        self.assertNotIn("Asignar Operario de Telas", ficha_js)
        self.assertNotIn("asignarTrabajadorLogistica", ficha_js)

    def test_external_logistics_reuses_quote_and_tracks_purchase_flow(self):
        ventas_py = read("routes_ventas.py")
        produccion_py = read("routes_produccion.py")
        logistica_js = read("Vendedor/js/modules/app/logistica_externa.js")
        flujo_doc = read("docs/flujo_operativo_produccion.md")

        self.assertIn("WHERE venta_id = %s AND sku = %s AND proveedor_id IS NOT DISTINCT FROM %s", ventas_py)
        self.assertIn("existing_log_row", ventas_py)
        self.assertIn("estado = 'Cotizacion Recibida'", produccion_py)
        self.assertIn("/api/logistica/<int:id>/generar-orden", produccion_py)
        self.assertIn("/api/logistica/<int:id>/registrar-pago", produccion_py)
        self.assertIn("/api/logistica/<int:id>/pdf-oc", produccion_py)
        self.assertIn("estado = 'Orden Enviada'", produccion_py)
        self.assertIn("FLUJO_LOGISTICA", logistica_js)
        self.assertIn("1. Resolver", logistica_js)
        self.assertIn("3. Comprar", logistica_js)
        self.assertIn("Gestionar etapa", logistica_js)
        self.assertIn("['Admin', 'Jefe_Taller'].includes(usuarioActivo.rol)", logistica_js)
        self.assertIn("/api/logistica/${item.id}/generar-orden", logistica_js)
        self.assertIn("/api/logistica/${item.id}/registrar-pago", logistica_js)
        self.assertIn("Logistica externa no significa", flujo_doc)
        self.assertIn("no se vuelve a mandar cotizacion", flujo_doc)
        self.assertIn("sillas/tableros/piedras/bases externas recibidas", flujo_doc)

    def test_dispatch_waits_for_entire_contract_and_external_logistics(self):
        produccion_py = read("routes_produccion.py")

        self.assertIn("def _validar_contrato_listo_para_despacho", produccion_py)
        self.assertIn("i.venta_id = %s", produccion_py)
        self.assertIn("AND t.area_trabajo != 'DESPACHO_CENTRAL'", produccion_py)
        self.assertIn("WHERE venta_id = %s", produccion_py)
        self.assertIn("insumo(s) de logística externa del contrato sin recibir", produccion_py)
        self.assertIn("NOT EXISTS (\n                  SELECT 1\n                  FROM logistica_externa le", produccion_py)
        self.assertIn("_validar_contrato_listo_para_despacho(cursor, ticket_id)", produccion_py)
        self.assertIn("ventas_con_logistica_pendiente", produccion_py)
        self.assertIn("row[12] in ventas_con_logistica_pendiente", produccion_py)


if __name__ == "__main__":
    unittest.main()
