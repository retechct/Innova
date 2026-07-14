// App - init, permisos y sidebar
// ─────────────────────────────────────────────────────────────// === MÓDULO: App principal, init, vistas, sesión ===
async function cargarDatosVentaIniciales({ force = false } = {}) {
    if (!force && window._datosVentaInicialesCargados) return true;
    if (!force && window._datosVentaInicialesPromise) return window._datosVentaInicialesPromise;
    window._datosVentaInicialesPromise = (async () => {
    try {
        const catRes = await fetch(`${API_URL}/api/catalogo`);
        allProducts = await catRes.json();

        if (allProducts.error) {
            console.error("Error de BD:", allProducts.error);
            Swal.fire('Error de Base de Datos', 'Revisa la consola (F12) para ver la tabla que falta.', 'error');
            return false;
        }

        window._datosVentaInicialesCargados = true;
        return true;
    } catch (e) {
        console.error("Error cargando datos de venta:", e);
        Swal.fire('Error de Conexión', 'El servidor no responde o hay un error cargando catálogo/materiales.', 'error');
        return false;
    } finally {
        window._datosVentaInicialesPromise = null;
    }
    })();
    return window._datosVentaInicialesPromise;
}

async function cargarMaestroMaterialesVenta({ force = false } = {}) {
    if (!force && window._maestroMaterialesCargado) return true;
    if (!force && window._maestroMaterialesPromise) return window._maestroMaterialesPromise;
    window._maestroMaterialesPromise = (async () => {
        try {
            const res = await apiFetch(`${API_URL}/api/materiales/listas`);
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'No se pudieron cargar los materiales');
            maestroMateriales = data;
            window._maestroMaterialesCargado = true;
            return true;
        } catch (e) {
            console.error('Error cargando materiales:', e);
            Swal.fire('Materiales no disponibles', e.message || 'No se pudo cargar el maestro de materiales.', 'error');
            return false;
        } finally {
            window._maestroMaterialesPromise = null;
        }
    })();
    return window._maestroMaterialesPromise;
}

async function init() {
    try {
        // Verificamos si Python nos mandó un error de Base de Datos en lugar de la lista
        
        // Punto 4: Persistencia de Sesión al recargar
        const sesion = localStorage.getItem('usuarioInnova');
        const token = localStorage.getItem('innova_token');
        if (sesion && token) {
            usuarioActivo = JSON.parse(sesion);

            // SEGURIDAD: Clientes y roles no autorizados no pueden entrar al panel ERP
            // ROLES_ERP viene de config.js — no redeclarar aquí
            if (!ROLES_ERP.includes(usuarioActivo.rol)) {
                return; // Se queda en el landing
            }

            // Verificación diaria de la sede para Vendedores
            if (usuarioActivo.rol === 'Vendedor') {
                const hoyPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                const ultimaSedeCheck = localStorage.getItem('innova_ultima_sede_check');

                if (hoyPeru !== ultimaSedeCheck) {
                    // Es un nuevo día o nunca se ha verificado.
                    // Mostramos el modal para confirmar/seleccionar la tienda.
                    if (typeof imMostrarModalSede === 'function') {
                        imMostrarModalSede();
                    }
                }
            }

            configurarInterfazPorRol();
            mostrarUsuarioEnHeader();
            document.getElementById('pantalla-login').style.display = 'none';
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'Chofer') {
                changeView('taller');
            } else {
                const ok = await cargarDatosVentaIniciales();
                if (!ok) return;
                changeView('catalogo');
            }
        } else if (sesion) {
            localStorage.removeItem('usuarioInnova');
            usuarioActivo = null;
        }
    } catch (e) {
        console.error("Error crítico:", e);
        Swal.fire('Error de Conexión', 'El servidor no responde o hay un error de código. Mira la consola (F12).', 'error');
    }
}

// Función centralizada para manejar permisos de UI
function configurarInterfazPorRol() {
    if (!usuarioActivo) return;
    
    const btnTaller      = document.getElementById('btn-menu-taller');
    const btnStockProduccion = document.getElementById('btn-menu-stock-produccion'); // ← nuevo
    const btnInventario  = document.getElementById('btn-menu-inventario');
    const btnInvTienda   = document.getElementById('btn-menu-inv-tienda');
    const btnGestor      = document.getElementById('btn-menu-gestor');
    const btnAddProd     = document.getElementById('btn-add-producto');
    const btnLogistica   = document.getElementById('btn-menu-logistica');
    const btnUsuarios    = document.getElementById('btn-menu-usuarios');
    const btnProv        = document.getElementById('btn-menu-proveedores');
    const btnContratos   = document.getElementById('btn-menu-contratos');
    const btnEgresos     = document.getElementById('btn-menu-egresos');
    const btnScanGlobal  = document.getElementById('btn-scan-global');

    // Ítems exclusivos de Vendedor / Admin
    const btnStock       = document.getElementById('btn-menu-stock');
    const btnCatalogo    = document.getElementById('btn-menu-catalogo');
    const btnContrato    = document.getElementById('btn-menu-contrato');
    const btnPedidos     = document.getElementById('btn-menu-pedidos');
    const btnCreaciones  = document.getElementById('btn-menu-creaciones');

    // Ocultar todo por defecto
    [btnTaller, btnStockProduccion, btnInventario, btnInvTienda, btnGestor, btnAddProd,
    btnLogistica, btnUsuarios, btnProv, btnContratos,
    btnStock, btnCatalogo, btnContrato, btnPedidos, btnCreaciones, btnEgresos, btnScanGlobal
    ].forEach(b => { if (b) b.style.display = 'none'; });

    const rol = usuarioActivo.rol;
    const esAdmin       = rol === 'Admin';
    const esVendedor    = rol === 'Vendedor';
    const esJefeTaller  = rol === 'Jefe_Taller';
    const esOperario    = rol === 'Operario';
    const esChofer      = rol === 'Chofer';
    const esAlmacen     = rol === 'ALMACEN';

    // ── Ítems solo para Vendedor y Admin ────────────────────────────
    if (esAdmin || esVendedor) {
        if (btnStock)      btnStock.style.display      = 'flex';
        if (btnCatalogo)   btnCatalogo.style.display   = 'flex';
        if (btnContrato)   btnContrato.style.display   = 'flex';
        if (btnPedidos)    btnPedidos.style.display    = 'flex';
        if (btnCreaciones) btnCreaciones.style.display = 'flex';
    }

    // ── Gestión de taller: Admin, Jefe, Operario, Chofer ────────────
    if (esAdmin || esJefeTaller || esOperario || esChofer) {
        if (btnTaller) btnTaller.style.display = 'flex';
    }

    // ── Control de insumos: Admin, Jefe, Almacén ────────────────────
    if (esAdmin || esJefeTaller || esAlmacen) {
        if (btnInventario) btnInventario.style.display = 'flex';
    }

    // ── Inventario por tienda: Admin, Jefe ──────────────────────────
    if (esAdmin || esJefeTaller) {
        if (btnInvTienda) btnInvTienda.style.display = 'flex';
    }

    // ── Solo Admin ───────────────────────────────────────────────────
if (esAdmin) {
    if (btnStockProduccion) btnStockProduccion.style.display = 'flex'; // ← nuevo
    if (btnGestor)          btnGestor.style.display          = 'flex';
    if (btnLogistica)       btnLogistica.style.display       = 'flex';
    if (btnUsuarios)        btnUsuarios.style.display        = 'flex';
    if (btnProv)            btnProv.style.display            = 'flex';
    if (btnContratos)       btnContratos.style.display       = 'block';
    if (btnEgresos)         btnEgresos.style.display         = 'flex';
}

// Si también quieres que el Jefe de Taller lo vea:
if (esAdmin || esJefeTaller) {
    if (btnInvTienda)       btnInvTienda.style.display       = 'flex';
    if (btnStockProduccion) btnStockProduccion.style.display = 'flex'; // ← mover aquí si aplica
}

    // ── Carrito flotante: solo Vendedor y Admin lo necesitan ─────────
    const fab = document.querySelector('.fab');
    if (fab) {
        fab.style.display = (esAdmin || esVendedor) ? 'flex' : 'none';
    }

    if (btnScanGlobal) {
        btnScanGlobal.style.display = (esAdmin || esVendedor || esJefeTaller) ? 'flex' : 'none';
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay-sidebar').classList.toggle('active');
}

/* ================================================================= */
