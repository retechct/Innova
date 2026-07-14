// App - navegacion, login y logout
function changeView(view) {
    currentMode = view;
    if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();

    // ── Guard: proteger llamadas antes de que los scripts estén listos ──
    const guardas = {
        'inv-tienda':      () => typeof cargarVistaInventario === 'function',
        'inventario':      () => typeof cargarInventarioTaller === 'function',
        'taller':          () => typeof cargarTicketsTaller === 'function',
        'stock-produccion': () => typeof cargarTicketsTaller === 'function',
    };
    if (guardas[view] && !guardas[view]()) {
        console.warn(`changeView('${view}'): función de carga aún no disponible, reintentando...`);
        setTimeout(() => changeView(view), 150);
        return;
    }

    const titles = {
        'stock':        'STOCK EN TIENDA',
        'catalogo':     'NUESTRA CARTA',
        'contrato':     'DISEÑOS A MEDIDA',
        'pedidos':      'SEGUIMIENTO',
        'taller':       'GESTIÓN DE TALLER',
        'stock-produccion': 'STOCK DE PRODUCCION',
        'inventario':   'CONTROL DE INSUMOS',
        'contratos':    'REPORTES Y VENTAS',
        'inv-tienda':   'INVENTARIO POR TIENDA',
        'logistica':    'LOGÍSTICA EXTERNA',
        'usuarios-admin': 'GESTIÓN DE PERSONAL',
        'proveedores':  'PROVEEDORES',
        'egresos':      'EGRESOS Y PAGOS',
    };

    // Restaurar el header estático si veníamos de inv-tienda
    const vistasConCabeceraPropia = new Set([
        'taller',
        'stock-produccion',
        'inv-tienda',
        'logistica',
        'usuarios-admin',
        'proveedores',
        'egresos',
        'gestor-aprobacion',
    ]);
    const mainTitleContainer = document.querySelector('main .view-title-container');
    if (mainTitleContainer) {
        mainTitleContainer.style.display = vistasConCabeceraPropia.has(view) ? 'none' : '';
    }

    // Limpiar el contenedor dinámico del inventario si existía
    const invDinamico = document.getElementById('inv-dinamico-wrapper');
    if (invDinamico) invDinamico.remove();

    if (titles[view]) {
        document.getElementById('view-title').innerText = titles[view];
        // Resetear ícono al cambiar de vista (por si venía de "Mis Creaciones")
        const viewIcon = document.getElementById('view-icon');
        if (viewIcon) viewIcon.className = 'fa-solid fa-book-open';
    }

    // ── Ocultar TODAS las secciones antes de mostrar la nueva ──
    const secciones = [
        'view-productos', 'view-plantillas', 'view-pedidos',
        'view-taller', 'view-inventario', 'view-gestor-aprobacion',
        'view-logistica', 'view-usuarios-admin', 'view-proveedores',
        'vista-contratos', 'view-egresos'
    ];
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // ── Controlar visibilidad del botón "Añadir Producto" ──
    const btnAddProdNav = document.getElementById('btn-add-producto');
    if (btnAddProdNav) {
        const esVistaProductos = (view === 'stock' || view === 'catalogo');
        const esAdmin = usuarioActivo && usuarioActivo.rol === 'Admin';
        btnAddProdNav.style.display = (esVistaProductos && esAdmin) ? 'block' : 'none';
    }

    // ── Función helper para mostrar una sección de forma segura ──
    function mostrar(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
        } else {
            console.error(`changeView: no se encontró el elemento #${id}`);
        }
    }

    // ── Mostrar la vista seleccionada ──
    if (view === 'stock' || view === 'catalogo') {
        mostrar('view-productos');
        if (!window._datosVentaInicialesCargados && typeof cargarDatosVentaIniciales === 'function') {
            const grid = document.getElementById('product-grid');
            if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-weight:700;">Cargando catálogo...</div>';
            cargarDatosVentaIniciales().then(ok => { if (ok) changeView(view); });
            return;
        }
        if (typeof _catPagina !== 'undefined') _catPagina = 1;
        renderGrid();
    }
    else if (view === 'contrato') {
        mostrar('view-plantillas');
    }
    else if (view === 'contratos') {
        mostrar('vista-contratos');
        loadContratos();
    }
    else if (view === 'pedidos') {
        mostrar('view-pedidos');
        loadMisPedidos();
    }
    else if (view === 'taller') {
        if (typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'stock_produccion') {
            filtroAdminTaller = 'pendientes';
        }
        if (mainTitleContainer) mainTitleContainer.style.display = 'none';
        mostrar('view-taller');
        cargarTicketsTaller();
    }
    else if (view === 'inventario') {
        mostrar('view-inventario');
        cargarInventarioTaller();
    }
    else if (view === 'inv-tienda') {
        if (mainTitleContainer) mainTitleContainer.style.display = 'none';
        cargarVistaInventario();
    }
    else if (view === 'logistica') {
        mostrar('view-logistica');
        cargarLogisticaExterna();
    }
    else if (view === 'usuarios-admin') {
        mostrar('view-usuarios-admin');
        listarUsuarios();
    }
    else if (view === 'proveedores') {
        mostrar('view-proveedores');
        listarProveedores();
    }
    // DESPUÉS:
    else if (view === 'gestor-aprobacion') {
        mostrar('view-gestor-aprobacion');
        document.getElementById('view-title').innerText = 'GESTOR DE MODELOS (Make vs Buy)';
        cargarGestorAprobacion();
    }
    else if (view === 'stock-produccion') {              // ← nuevo bloque
        filtroAdminTaller = 'stock_produccion';          // setear ANTES de mostrar y cargar
        if (mainTitleContainer) mainTitleContainer.style.display = 'none';
        mostrar('view-taller');
        cargarTicketsTaller();
    }
    else if (view === 'egresos') {
        mostrar('view-egresos');
        if (typeof initEgresos === 'function') initEgresos();
    }
    else {
        console.warn(`changeView: vista desconocida → '${view}'`);
    }
}

// ROLES_ERP definido en config.js

function verificarSesionExistente() {
    const sesionGuardada = localStorage.getItem('usuarioInnova');
    const tokenGuardado = localStorage.getItem('innova_token');
    if (!sesionGuardada || !tokenGuardado) {
        if (sesionGuardada && !tokenGuardado) localStorage.removeItem('usuarioInnova');
        usuarioActivo = null;
        return;
    }

    try {
        usuarioActivo = JSON.parse(sesionGuardada);
    } catch (_error) {
        localStorage.removeItem('usuarioInnova');
        localStorage.removeItem('innova_token');
        localStorage.removeItem('innova_refresh_token');
        usuarioActivo = null;
        return;
    }

    // Clientes y roles no autorizados NO entran al panel ERP
    if (!ROLES_ERP.includes(usuarioActivo.rol)) {
        usuarioActivo = null;
        return;
    }

    document.getElementById('pantalla-login').style.display = 'none';
    configurarInterfazPorRol();
    // El ruteo real lo hará init() una vez cargue los productos
}

// ── Usuario activo en el header del panel ─────────────────────────
function mostrarUsuarioEnHeader() {
    if (!usuarioActivo) return;
    const slot = document.getElementById('header-worker-slot');
    if (!slot) return;

    // Evitar duplicados
    const existing = document.getElementById('header-user-info');
    if (existing) existing.remove();

    const ROL_LABELS = {
        'Admin':       'Admin',
        'Vendedor':    'Vendedor',
        'Operario':    'Operario',
        'Jefe_Taller': 'Jefe Taller',
        'ALMACEN':     'Almacén',
    };
    const rolLabel = String(ROL_LABELS[usuarioActivo.rol] || usuarioActivo.rol || 'Usuario');
    const nombreCompleto = String(usuarioActivo.nombre || 'Usuario').trim() || 'Usuario';
    const nombre = nombreCompleto.split(/\s+/)[0];
    const nombreHTML = escapeHTML(nombre);
    const rolHTML = escapeHTML(rolLabel);

    const wrap = document.createElement('div');
    wrap.id = 'header-user-info';
    wrap.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        font-family: 'Inter', sans-serif;
    `;
    wrap.innerHTML = `
        <div style="text-align:right; line-height:1.3;">
            <div style="font-size:13px; font-weight:600; color:var(--text, #1e293b);">${nombreHTML}</div>
            <div style="font-size:10px; color:var(--text-muted, #94a3b8); letter-spacing:0.05em; text-transform:uppercase;">${rolHTML}</div>
        </div>
        <div style="
            width:34px; height:34px; border-radius:50%;
            background: linear-gradient(135deg, var(--primary,#2d5a27), var(--accent,#d4af37));
            display:flex; align-items:center; justify-content:center;
            font-size:14px; font-weight:700; color:#fff; flex-shrink:0;
        ">${escapeHTML(nombre.charAt(0).toUpperCase())}</div>
    `;
    slot.appendChild(wrap);
}

// FUNCIÓN PARA CERRAR SESIÓN
function cerrarSesion() {
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: "Tendrás que poner tu PIN de nuevo para entrar.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d4af37',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('usuarioInnova');
            localStorage.removeItem('innova_token');
            localStorage.removeItem('innova_refresh_token');
            location.reload();
        }
    });
}
