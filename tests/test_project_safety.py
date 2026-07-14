import ast
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


class ProjectSafetyTests(unittest.TestCase):
    def test_routes_do_not_run_schema_ddl_during_requests(self):
        ddl = re.compile(r"\b(?:CREATE\s+TABLE|ALTER\s+TABLE)\b", re.IGNORECASE)
        violations = []
        for path in ROOT.glob("routes_*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call) or not node.args:
                    continue
                if not isinstance(node.func, ast.Attribute) or node.func.attr != "execute":
                    continue
                sql_node = node.args[0]
                sql = sql_node.value if isinstance(sql_node, ast.Constant) and isinstance(sql_node.value, str) else ""
                if ddl.search(sql):
                    violations.append(f"{path.name}:{node.lineno}")
        self.assertEqual(violations, [], "DDL encontrado en rutas: " + ", ".join(violations))

    def test_render_dependencies_are_lean_and_migration_url_is_normalized(self):
        requirements = read("requirements.txt").splitlines()
        env_py = read("migrations/env.py")
        python_version = read(".python-version").strip()

        self.assertFalse(any(line.lower().startswith("pandas") for line in requirements))
        self.assertTrue(all("==" in line for line in requirements if line.strip()))
        self.assertEqual(python_version, "3.12.11")
        self.assertIn('direct_url.startswith("postgres://")', env_py)
        self.assertIn('direct_url.startswith("postgresql://")', env_py)

    def test_api_errors_are_generic_by_default(self):
        app_py = read("app.py")

        self.assertIn("DEBUG_API_ERRORS", app_py)
        self.assertIn("flask_compress", app_py)
        self.assertIn("if Compress:", app_py)
        self.assertIn("Compress(app)", app_py)
        self.assertIn("public, max-age=3600", app_py)
        self.assertIn("'Error interno del servidor'", app_py)
        self.assertIn("@app.route('/favicon.ico')", app_py)
        self.assertIn("Flask(__name__, static_folder=None)", app_py)
        self.assertIn("except NotFound:", app_py)
        self.assertIn("if es_ruta_frontend(filename):", app_py)
        self.assertIn("os.getenv('CANONICAL_HOST', 'innovamobili.com')", app_py)
        self.assertIn("'https://innovamobili.com,'", app_py)
        self.assertIn("['produccion.cotizar_lote']", app_py)
        self.assertIn("['produccion.responder_cotizacion']", app_py)
        self.assertIn("['produccion.servir_pdf_oc_publico']", app_py)
        self.assertLess(
            app_py.index("DEBUG_API_ERRORS"),
            app_py.index("return jsonify({'error': str(ex), 'tipo': type(ex).__name__}), 500"),
        )

    def test_startup_loads_catalog_data_on_demand(self):
        session_js = read("Vendedor/js/modules/app/session_ui.js")
        bootstrap_js = read("Vendedor/js/modules/app/bootstrap.js")
        nav_js = read("Vendedor/js/modules/app/navigation_auth.js")
        landing_js = read("Vendedor/js/landing.js")
        index_html = read("Vendedor/index.html")
        orden_js = read("Vendedor/js/modules/taller/orden_pedido.js")

        self.assertIn("async function cargarDatosVentaIniciales", session_js)
        self.assertLess(session_js.index("const sesion = localStorage.getItem('usuarioInnova')"),
                        session_js.index("const ok = await cargarDatosVentaIniciales()"))
        self.assertNotIn("cargarDatosInicialesLogin", bootstrap_js)
        self.assertNotIn("cargarDatosInicialesLogin", nav_js)
        self.assertIn("localStorage.getItem('innova_token')", bootstrap_js + session_js)
        self.assertIn("Cargando catálogo", nav_js)
        self.assertIn("window._datosVentaInicialesCargados", nav_js)
        self.assertNotIn("gmPopularSelect();", nav_js)
        self.assertNotIn("gmPopularSelect();", landing_js)
        self.assertNotIn('<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas', index_html)
        self.assertNotIn('<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf', index_html)
        self.assertIn("_asegurarLibreriasOrdenPDF", orden_js)
        self.assertIn("data-pdf-lib", orden_js)
        self.assertIn("async function gmPopularSelect(force = false)", index_html)
        self.assertIn("window._sofaModelosCargados", index_html)
        self.assertIn("await gmPopularSelect(true)", index_html)
        self.assertIn('id="modal-gestor-modelos"', index_html)
        catalogo_js = read("Vendedor/js/catalogo.js")
        self.assertIn("async function openConfig", catalogo_js)
        self.assertIn("await gmPopularSelect()", catalogo_js)

    def test_staff_login_uses_password_hash_path(self):
        usuarios_py = read("routes_usuarios.py")

        self.assertIn("password_hash", usuarios_py)
        self.assertIn("check_password_hash", usuarios_py)
        self.assertIn("generate_password_hash", usuarios_py)
        self.assertIn("_credencial_staff_valida", usuarios_py)
        self.assertNotIn("AND (pin_acceso = %s OR contrasena = %s)", usuarios_py)
        self.assertIn("@usuarios_bp.route('/api/usuarios', methods=['GET'])\n@requiere_login", usuarios_py)
        self.assertNotIn("verify_jwt_in_request(optional=True)", usuarios_py)

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
        self.assertIn("const producto = escapeHTML(e.producto", filtros_js)
        self.assertIn("const fotoJS = jsStringAttr(foto)", filtros_js)
        self.assertIn("window.open(${fotoJS}, '_blank', 'noopener')", filtros_js)
        self.assertIn("comision > monto", carrito_js)
        self.assertIn("comision_pos > monto_bruto", ventas_py)
        self.assertIn("/api/voucher/leer", catalogo_py)
        self.assertIn("_leer_voucher_automatico", catalogo_py)
        self.assertIn("_leer_voucher_con_gemini", catalogo_py)
        self.assertNotIn("_leer_voucher_con_openai", catalogo_py)
        self.assertNotIn("OPENAI_API_KEY", catalogo_py)
        self.assertNotIn("def _datos_voucher_desde_json(extraido):\n    resultado = _datos_voucher_desde_json(extraido)", catalogo_py)
        self.assertIn("responseMimeType", catalogo_py)
        self.assertIn("clasificar_error_gemini", catalogo_py)
        self.assertIn("'modo': 'manual'", catalogo_py)
        self.assertIn("GEMINI_API_KEY", catalogo_py)
        self.assertIn("_modelos_gemini_voucher", catalogo_py)
        self.assertIn("supportedGenerationMethods", catalogo_py)
        self.assertIn("gemini-3.5-flash", catalogo_py)
        self.assertIn("x-goog-api-key", catalogo_py)
        self.assertIn("generativelanguage.googleapis.com", catalogo_py)
        self.assertIn("proveedor_ocr", catalogo_py)
        self.assertIn("contacto_destino", catalogo_py)
        self.assertIn("leerVoucherAutomatico", carrito_js)
        self.assertIn("_aplicarDatosVoucher", carrito_js)
        self.assertIn("_seleccionarEmpresaPorVoucher", carrito_js)
        self.assertIn("_textoVoucherTieneAlias", carrito_js)
        self.assertIn("denixa canilla", carrito_js)
        self.assertIn("Señora Dani", carrito_js)
        self.assertIn("rommel", carrito_js)
        self.assertIn("inn l", carrito_js)
        self.assertIn("inn s", carrito_js)
        self.assertIn("INNOVA MOBILI LIMA E.I.R.L.", carrito_js)
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
        self.assertIn("escapeHTML(p.proveedor_nombre", contratos_js)
        self.assertIn("escapeHTML(item.insumo_nombre", contratos_js)
        self.assertIn("escapeAttr(foto)", contratos_js)
        self.assertIn("escapeHTML(item.insumo)", logistica_js)
        self.assertIn("escapeHTML(item.proveedor)", logistica_js)
        self.assertIn("escapeAttr(comprobanteUrl)", logistica_js)
        self.assertIn("escapeHTML(item.estado)", logistica_js)
        self.assertIn("function _logUrlImagenSegura", logistica_js)
        self.assertIn("const _logItemsEdicion = new Map()", logistica_js)
        self.assertIn("_logAbrirEditarPorId(${itemId})", logistica_js)
        self.assertIn("const notasHTML = escapeHTML(item.notas_proveedor", logistica_js)
        self.assertNotIn("JSON.stringify(item).replace", logistica_js)

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
        self.assertIn("seleccionarMaterial(${jsStringAttr(tipoInput)}", materiales_js)
        self.assertIn("escapeHTML(item.sku || '')", materiales_js)
        self.assertIn("escapeAttr(fotoResuelta)", materiales_js)

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
        self.assertIn("const esGestionDirecta", tickets_js)
        self.assertIn("!esGestionDirecta(l) && estaPendiente(l)", tickets_js)
        self.assertIn("_estadoLogisticaTelaUI", tickets_js)
        self.assertIn("Comprobante obligatorio", ficha_js)
        self.assertIn("file.size > 8 * 1024 * 1024", ficha_js)
        self.assertIn("Bandeja compartida de Telas", orden_pedido_js)
        self.assertIn("renderTrazabilidadTela", orden_pedido_js)
        self.assertIn("const trazabilidadAdmin = esAdmin", orden_pedido_js)
        self.assertIn("${trazabilidadAdmin}<button onclick=", orden_pedido_js)
        self.assertIn("recogido_por", orden_pedido_js)
        self.assertIn("distribuido_por", orden_pedido_js)
        self.assertIn("const gestionDirecta", orden_pedido_js)
        self.assertIn("Entregar a Tapicería", orden_pedido_js)
        self.assertIn("t.estado === 'Pendiente' || isEnProceso", orden_pedido_js)
        self.assertNotIn("Asignar Operario de Telas", ficha_js)
        self.assertNotIn("asignarTrabajadorLogistica", ficha_js)

    def test_fabric_states_are_canonical_and_do_not_regress(self):
        produccion_py = read("routes_produccion.py")
        ventas_py = read("routes_ventas.py")
        logistica_js = read("Vendedor/js/modules/app/logistica_externa.js")
        migration_py = read("migrations/versions/20260713_integridad_flujo_contratos.py")

        self.assertIn("normalizar_estado_distribucion", produccion_py)
        self.assertIn("tela_puede_distribuirse", produccion_py)
        self.assertIn("tela_requiere_comprobante", produccion_py)
        self.assertIn("tela_ya_distribuida", produccion_py)
        self.assertIn("Una tela distribuida no puede volver a pendiente", produccion_py)
        self.assertIn("Un insumo distribuido no puede cambiar de estado", produccion_py)
        self.assertIn("SET estado_distribucion = 'En espera'", migration_py)
        self.assertIn("SET categoria_insumo = 'TELA'", migration_py)
        self.assertIn("LOWER(COALESCE(unidad, '')) IN ('mts', 'metro', 'metros')", produccion_py)
        self.assertIn("LOWER(BTRIM(COALESCE(estado_distribucion, ''))) = 'listo para recojo'", migration_py)
        self.assertIn("const msg = d.mensaje", logistica_js)
        self.assertNotIn("Los tickets relacionados fueron desbloqueados", logistica_js)
        self.assertIn("WHERE estado_ticket NOT IN ('Terminado', 'Recogido')", ventas_py)

    def test_order_search_uses_api_contract_and_shows_fabric_actors(self):
        filtros_js = read("Vendedor/js/busqueda_filtros.js")
        orden_pedido_js = read("Vendedor/js/modules/taller/orden_pedido.js")
        produccion_py = read("routes_produccion.py")

        self.assertIn("function _opCodigoOrden", filtros_js)
        self.assertIn("function _opEstadoOrden", filtros_js)
        self.assertIn("renderTrazabilidadTela(t)", filtros_js)
        self.assertIn("'codigo_venta': v[1]", produccion_py)
        self.assertIn("'estado_general': v[6]", produccion_py)
        self.assertIn("'recogido_por': recogido_por", produccion_py)
        self.assertIn("'distribuido_por': distribuido_por", produccion_py)
        self.assertIn("recogido_por_id = COALESCE(recogido_por_id, %s)", produccion_py)
        self.assertIn("gestion_directa = tipo_gestion_final in ('Interno', 'Informal')", produccion_py)
        self.assertIn("Ingresó/recogió", orden_pedido_js)

    def test_sale_totals_are_server_derived_and_tracking_is_batched(self):
        ventas_py = read("routes_ventas.py")
        seguimiento_py = read("routes_seguimiento.py")
        usuarios_py = read("routes_usuarios.py")

        self.assertIn("datos['monto_total'] = round(sum", ventas_py)
        self.assertIn("monto_neto = round(monto_bruto - comision_pos, 2)", ventas_py)
        self.assertIn("total_confirmado = _recalcular_total_venta", ventas_py)
        self.assertNotIn("monto_neto = p.get", ventas_py)
        self.assertIn("WHERE i.venta_id = ANY(%s)", seguimiento_py)
        self.assertIn("primer_item_por_venta", seguimiento_py)
        self.assertNotIn("_ventas_tiene_cliente_id", seguimiento_py)
        self.assertIn("OR (%s <> '' AND telefono = %s)", usuarios_py)

    def test_external_logistics_reuses_quote_and_tracks_purchase_flow(self):
        ventas_py = read("routes_ventas.py")
        produccion_py = read("routes_produccion.py")
        logistica_js = read("Vendedor/js/modules/app/logistica_externa.js")
        flujo_doc = read("docs/flujo_operativo_produccion.md")

        self.assertIn("WHERE venta_id = %s AND sku = %s AND proveedor_id IS NOT DISTINCT FROM %s", ventas_py)
        self.assertIn("existing_log_row", ventas_py)
        self.assertIn("estado = 'Cotizado'", produccion_py)
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
        self.assertIn("estado_despues_pago", produccion_py)
        self.assertIn("estado_previo == 'Recibido'", produccion_py)
        self.assertIn("const pagoPendiente = estado === 'Recibido'", logistica_js)
        self.assertIn("'Listo para Recojo': ['Listo para Recojo','Recibido']", logistica_js)
        self.assertIn("Logistica externa no significa", flujo_doc)
        self.assertIn("no se vuelve a mandar cotizacion", flujo_doc)
        self.assertIn("sillas/tableros/piedras/bases externas recibidas", flujo_doc)

    def test_public_supplier_quotes_are_atomic_and_batch_page_is_complete(self):
        produccion_py = read("routes_produccion.py")
        cotizar_html = read("Vendedor/cotizar.html")
        migration_py = read(
            "migrations/versions/20260714_cotizaciones_proveedor_seguras.py"
        )

        self.assertIn("normalizar_precio_cotizacion", produccion_py)
        self.assertIn("normalizar_fecha_cotizacion", produccion_py)
        self.assertIn("cotizacion_esta_vigente", produccion_py)
        self.assertIn("FOR UPDATE OF l", produccion_py)
        self.assertIn("set(respuestas_validadas) != ids_esperados", produccion_py)
        self.assertIn("WHERE id = %s AND estado = 'Cotizacion Enviada'", produccion_py)
        self.assertIn("request.url_root.rstrip('/')", produccion_py)
        self.assertNotIn("for resp in body.get('respuestas', [])", produccion_py)

        self.assertIn("params.get('lote')", cotizar_html)
        self.assertIn("/api/cotizar-lote/", cotizar_html)
        self.assertIn("itemsActivos.forEach", cotizar_html)
        self.assertIn("textContent", cotizar_html)
        self.assertIn("Debes cotizar todos los materiales", produccion_py)

        self.assertIn("CREATE TABLE IF NOT EXISTS cotizaciones_lote", migration_py)
        self.assertIn("CREATE TABLE IF NOT EXISTS cotizacion_lote_items", migration_py)
        self.assertIn("uq_cotizaciones_lote_token", migration_py)
        self.assertIn("uq_logistica_token_respuesta", migration_py)
        self.assertIn("token_orden_compra", migration_py)
        self.assertIn("uq_logistica_token_orden_compra", migration_py)
        self.assertIn("/api/logistica/orden-publica/<token>", produccion_py)
        self.assertIn("servir_pdf_oc.__wrapped__(logistica_id)", produccion_py)
        self.assertIn("token_orden_compra = uuid.uuid4().hex", produccion_py)

    def test_purchase_order_html_escapes_database_values(self):
        produccion_py = read("routes_produccion.py")
        database_py = read("database.py")

        self.assertIn("from html import escape as html_escape", produccion_py)
        self.assertIn("numero_oc_html = html_escape", produccion_py)
        self.assertIn("cod_venta_html = html_escape", produccion_py)
        self.assertIn("insumo_html = html_escape", produccion_py)
        self.assertIn("html_escape(str(notas))", produccion_py)
        self.assertIn("request.url_root.rstrip('/')", produccion_py)
        self.assertNotIn(
            'src="https://innova-4cnn.onrender.com/imagenes/Logo3.png"',
            produccion_py,
        )
        self.assertIn(
            'BACKEND_URL = os.getenv("BACKEND_URL", "https://innovamobili.com")',
            database_py,
        )

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
