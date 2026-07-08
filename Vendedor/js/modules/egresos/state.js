// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EGRESOS Y FINANZAS â€” Innova MÃ¶bili ERP  (solo Admin)
//
// PESTAÃ‘A 1: Pagos de Estructuras  â†’ lista de estructuras por carpintero.
//            Muestra carpintero solo si estÃ¡ registrado; chofer separado.
//            Filtro pagado/pendiente funcional.
// PESTAÃ‘A 2: Historial de Pagos    â†’ cierres semanales registrados.
// PESTAÃ‘A 3: Comisiones Vendedores â†’ resumen por vendedor: ventas, contratos,
//            comisiÃ³n 3%, campo de descuento editable, total neto.
// PESTAÃ‘A 4: Compras a Proveedores â†’ logÃ­stica externa.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _egTab         = 'pagos-carpinteros';
let _egEstructuras = [];
let _egCarpinteros = [];
let _egVendedores  = [];   // cachÃ© de la tabla de comisiones
