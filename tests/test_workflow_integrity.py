import subprocess
import unittest
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from workflow_rules import (
    contrato_entregado,
    contrato_listo_para_despacho,
    cotizacion_esta_vigente,
    estructura_disponible_para_tapiceria,
    ids_items_logistica,
    normalizar_fecha_cotizacion,
    normalizar_estado_distribucion,
    normalizar_estado_logistica,
    normalizar_precio_cotizacion,
    puede_desbloquear_tapiceria,
    siguiente_limite,
    tela_puede_distribuirse,
    tela_requiere_comprobante,
    transicion_logistica_permitida,
)
from voucher_rules import (
    clasificar_error_gemini,
    normalizar_confianza,
    normalizar_montos_pago,
    validar_clasificacion_pago,
)
from frontend_rules import es_ruta_frontend


class WorkflowIntegrityTests(unittest.TestCase):
    def test_contrato_ficticio_sofa_tela_y_dos_entregas(self):
        # C-TEST-001: sofa + butaca comparten tela externa.
        estructura = ["Listo para Recojo", "Recogido"]
        self.assertFalse(puede_desbloquear_tapiceria(estructura, telas_pendientes=1))
        self.assertFalse(
            contrato_listo_para_despacho(
                [*estructura, "Bloqueado", "Bloqueado"],
                ["Recibido"],
                ["En espera"],
            )
        )

        # Recibir la tela solo la pone en la bandeja. Aun debe distribuirse.
        estructura = ["Recogido", "Recogido"]
        self.assertFalse(puede_desbloquear_tapiceria(estructura, telas_pendientes=1))
        self.assertFalse(
            contrato_listo_para_despacho(
                [*estructura, "Bloqueado", "Bloqueado"],
                ["Recibido"],
                ["Recogido"],
            )
        )

        # Distribuir desbloquea tapiceria, pero no despacho hasta terminarla.
        self.assertTrue(puede_desbloquear_tapiceria(estructura, telas_pendientes=0))
        self.assertFalse(
            contrato_listo_para_despacho(
                [*estructura, "En Proceso", "En Proceso"],
                ["Recibido"],
                ["Distribuido"],
            )
        )
        self.assertTrue(
            contrato_listo_para_despacho(
                [*estructura, "Terminado", "Terminado"],
                ["Recibido"],
                ["Distribuido"],
            )
        )

        # Entregar un producto no cierra un contrato de dos productos.
        self.assertFalse(contrato_entregado(["Terminado", "En Proceso"]))
        self.assertTrue(contrato_entregado(["Terminado", "Recogido"]))

    def test_contrato_ficticio_sin_tela_no_inventa_dependencia(self):
        # C-TEST-002: mesa de stock sin tela ni logistica externa.
        self.assertTrue(
            contrato_listo_para_despacho(["Terminado"], [], [])
        )

    def test_logistica_cancelada_no_se_incluye_como_tela_pendiente(self):
        # C-TEST-003: una compra de tela rechazada/cancelada ya no participa.
        self.assertTrue(
            contrato_listo_para_despacho(
                ["Terminado"],
                ["Cancelado"],
                [],
            )
        )

    def test_estructura_lista_aun_no_esta_fisicamente_disponible(self):
        self.assertFalse(estructura_disponible_para_tapiceria("Listo para Recojo"))
        self.assertFalse(estructura_disponible_para_tapiceria("Cancelado"))
        self.assertFalse(puede_desbloquear_tapiceria(["Listo para Recojo"], 0))
        self.assertTrue(puede_desbloquear_tapiceria(["Recogido"], 0))
        self.assertFalse(
            contrato_listo_para_despacho(["Listo para Recojo"], [], [])
        )

    def test_tela_interna_recibida_debe_distribuirse(self):
        produccion = ["Terminado", "Recogido"]
        self.assertFalse(
            contrato_listo_para_despacho(produccion, ["Recibido"], ["Recogido"])
        )
        self.assertTrue(
            contrato_listo_para_despacho(produccion, ["Recibido"], ["Distribuido"])
        )

    def test_flujo_de_recojo_depende_del_tipo_de_gestion(self):
        self.assertEqual(
            normalizar_estado_distribucion("Listo para recojo"),
            "En espera",
        )
        self.assertFalse(tela_requiere_comprobante("Interno"))
        self.assertFalse(tela_requiere_comprobante("Informal"))
        self.assertTrue(tela_requiere_comprobante("Externo"))
        self.assertTrue(tela_puede_distribuirse("Interno", "En espera"))
        self.assertTrue(tela_puede_distribuirse("Informal", "Listo para recojo"))
        self.assertFalse(tela_puede_distribuirse("Externo", "En espera"))
        self.assertTrue(tela_puede_distribuirse("Externo", "Recogido"))
        self.assertFalse(tela_puede_distribuirse("Externo", "Distribuido"))

    def test_logistica_no_retrocede_despues_de_recibida_o_pagada(self):
        self.assertEqual(normalizar_estado_logistica("POR_PEDIR"), "Pendiente")
        self.assertTrue(
            transicion_logistica_permitida("Pendiente", "Recibido", "Interno")
        )
        self.assertFalse(
            transicion_logistica_permitida("Pendiente", "Recibido", "Externo")
        )
        self.assertTrue(
            transicion_logistica_permitida("Cotizado", "Orden Enviada", "Externo")
        )
        self.assertFalse(
            transicion_logistica_permitida("Pagado", "Orden Enviada", "Externo")
        )
        self.assertFalse(
            transicion_logistica_permitida("Recibido", "Cancelado", "Externo")
        )

    def test_tela_pendiente_bloquea_tapiceria(self):
        self.assertFalse(puede_desbloquear_tapiceria(["Recogido"], 1))
        self.assertTrue(puede_desbloquear_tapiceria(["Recogido"], 0))

    def test_contrato_dos_items_no_se_entrega_por_el_primero(self):
        self.assertFalse(contrato_entregado(["Terminado", "Pendiente"]))
        self.assertFalse(contrato_entregado(["Terminado", "Cancelado"]))
        self.assertTrue(contrato_entregado(["Terminado", "Recogido"]))

    def test_asociaciones_legacy_no_duplican_items(self):
        self.assertEqual(ids_items_logistica(10, "11,10,abc,12,11"), [10, 11, 12])

    def test_ver_mas_avanza_exactamente_de_diez(self):
        self.assertEqual(siguiente_limite(0, 23), 10)
        self.assertEqual(siguiente_limite(10, 23), 20)
        self.assertEqual(siguiente_limite(20, 23), 23)

    def test_cotizacion_rechaza_precios_ambiguos_o_no_finitos(self):
        self.assertEqual(normalizar_precio_cotizacion("250.50"), Decimal("250.50"))
        for invalido in (None, True, 0, -1, "nan", "inf", "12.345"):
            with self.subTest(invalido=invalido):
                with self.assertRaises(ValueError):
                    normalizar_precio_cotizacion(invalido)

    def test_cotizacion_valida_fecha_iso_real(self):
        self.assertEqual(
            normalizar_fecha_cotizacion("2026-07-20").isoformat(),
            "2026-07-20",
        )
        with self.assertRaises(ValueError):
            normalizar_fecha_cotizacion("20/07/2026")
        with self.assertRaises(ValueError):
            normalizar_fecha_cotizacion("2026-02-30")
        with self.assertRaisesRegex(ValueError, "pasado"):
            normalizar_fecha_cotizacion(
                "2026-07-13",
                fecha_minima=date(2026, 7, 14),
            )

    def test_cotizacion_expira_luego_de_tres_dias_habiles(self):
        enviada = datetime(2026, 7, 10, 18, 0)  # viernes
        self.assertTrue(
            cotizacion_esta_vigente(enviada, datetime(2026, 7, 15, 23, 59))
        )
        self.assertFalse(
            cotizacion_esta_vigente(enviada, datetime(2026, 7, 16, 0, 1))
        )

    def test_buscadores_reales_avanzan_de_diez(self):
        script = Path(__file__).with_name("test_smart_search_batches.js")
        resultado = subprocess.run(
            ["node", str(script)],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(resultado.returncode, 0, resultado.stderr or resultado.stdout)

    def test_pos_sin_evidencia_no_modifica_el_formulario(self):
        tipo, confianza, notas = validar_clasificacion_pago(
            "POS", "BCP", "123456", "Pago desde banca movil", 0.96
        )
        self.assertIsNone(tipo)
        self.assertLessEqual(confianza, 0.6)
        self.assertIn("falta de evidencia", notas)

    def test_pos_con_evidencia_se_conserva(self):
        tipo, confianza, _ = validar_clasificacion_pago(
            "POS", "Izipay", "Lote 42", "Visa", 92
        )
        self.assertEqual(tipo, "POS")
        self.assertEqual(confianza, 0.92)

    def test_marca_de_tarjeta_sola_no_autoselecciona_pos(self):
        tipo, confianza, notas = validar_clasificacion_pago(
            "POS", "BCP", "123456", "Pago con Visa", 0.98
        )
        self.assertIsNone(tipo)
        self.assertLessEqual(confianza, 0.6)
        self.assertIn("falta de evidencia", notas)

    def test_confianza_fuera_de_rango_no_se_autocompleta(self):
        self.assertIsNone(normalizar_confianza(140))

    def test_montos_gemini_no_aceptan_nan_ni_comision_invalida(self):
        self.assertEqual(
            normalizar_montos_pago(100, -5, 999),
            (100.0, 0, 100.0),
        )
        self.assertEqual(
            normalizar_montos_pago(100, 120, 10),
            (100.0, 0, 100.0),
        )
        self.assertEqual(
            normalizar_montos_pago("nan", 0, "inf"),
            (None, 0.0, None),
        )

    def test_errores_gemini_son_visibles_y_clasificados(self):
        mensaje, status, retry = clasificar_error_gemini(
            429, '{"status":"RESOURCE_EXHAUSTED"}'
        )
        self.assertIn("cuota", mensaje.lower())
        self.assertEqual(status, 429)
        self.assertFalse(retry)

        mensaje, status, retry = clasificar_error_gemini(
            503, '{"status":"UNAVAILABLE"}'
        )
        self.assertIn("temporalmente", mensaje.lower())
        self.assertEqual(status, 503)
        self.assertTrue(retry)

        mensaje, status, retry = clasificar_error_gemini(
            403, '{"status":"PERMISSION_DENIED"}'
        )
        self.assertIn("permisos", mensaje.lower())
        self.assertEqual(status, 503)
        self.assertFalse(retry)

    def test_ruta_spa_contacto_no_se_convierte_en_error_500(self):
        self.assertTrue(es_ruta_frontend("contacto"))
        self.assertTrue(es_ruta_frontend("clientes/mis-pedidos"))
        self.assertFalse(es_ruta_frontend("api/contacto"))
        self.assertFalse(es_ruta_frontend("js/app.js"))


if __name__ == "__main__":
    unittest.main()
