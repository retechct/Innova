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

/**
 * NUEVO: Carga las sedes y usuarios directamente desde Neon SQL
 */
async function cargarDatosInicialesLogin() {
    try {
        // 1. Cargar Sedes (fetch directo: se llama antes del login, sin token)
        const resSedes = await fetch(`${API_URL}/api/sedes`);
        const sedes = await resSedes.json();
        const selectSede = document.getElementById('login-tienda');
        
        if (selectSede) {
            selectSede.innerHTML = '<option value="">-- Selecciona Sede --</option>';
            sedes.forEach(s => {
                selectSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
            });
        }

        // 2. Cargar Usuarios (fetch directo: se llama antes del login, sin token)
        const resUser = await fetch(`${API_URL}/api/usuarios`);
        const usuarios = await resUser.json();
        const selectUser = document.getElementById('login-usuario');
        if (selectUser) {
            selectUser.innerHTML = '<option value="">-- Elige tu nombre --</option>';
            usuarios.forEach(u => {
                selectUser.innerHTML += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
            });
            
            // Ocultar selector de tienda si no es Vendedor
            selectUser.addEventListener('change', (e) => {
                const selectedOpt = e.target.options[e.target.selectedIndex];
                const selectTienda = document.getElementById('login-tienda');
                if (selectTienda) {
                    if (selectedOpt.text.includes('(Vendedor)')) {
                        selectTienda.style.display = '';
                    } else {
                        selectTienda.style.display = 'none';
                        selectTienda.value = '';
                    }
                }
            });
        }
    } catch (error) {
        console.error("No hay conexión con el servidor para cargar usuarios", error);
    }
}

// ROLES_ERP definido en config.js

function verificarSesionExistente() {
    const sesionGuardada = localStorage.getItem('usuarioInnova');
    if (!sesionGuardada) return;

    usuarioActivo = JSON.parse(sesionGuardada);

    // Clientes y roles no autorizados NO entran al panel ERP
    if (!ROLES_ERP.includes(usuarioActivo.rol)) {
        usuarioActivo = null;
        return;
    }

    document.getElementById('pantalla-login').style.display = 'none';
    configurarInterfazPorRol();
    // El ruteo real lo hará init() una vez cargue los productos
}

async function entrarAlSistema() {
    const usuarioId = document.getElementById('login-usuario').value;
    const pin = document.getElementById('login-pin').value;
    
    // Capturamos la tienda que seleccionó en el dropdown
    const tiendaSelect = document.getElementById('login-tienda');
    const nombreTienda = tiendaSelect ? tiendaSelect.options[tiendaSelect.selectedIndex].text : 'No especificada';

    if (!usuarioId || !pin) {
        return Swal.fire('Error', 'Selecciona tu nombre y pon tu PIN.', 'warning');
    }

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                usuario_id: usuarioId, 
                pin: pin,
                sede_id: tiendaSelect.value 
            })
        });

        const result = await response.json();

        if (result.exito) {
            usuarioActivo = result.usuario;
            
            // SEGURIDAD: Clientes no pueden entrar al panel ERP
            // ROLES_ERP viene de config.js — no redeclarar aquí
            if (!ROLES_ERP.includes(usuarioActivo.rol)) {
                return Swal.fire('Acceso Denegado', 'Tu cuenta no tiene acceso al panel interno.', 'warning');
            }

            // Agregamos la tienda y la hora al perfil del usuario
            usuarioActivo.sede_id = tiendaSelect.value;
            usuarioActivo.tienda = nombreTienda;
            usuarioActivo.horaLogin = new Date().toLocaleTimeString();
            
            // FIX-1: Guardamos el token en localStorage para que sobreviva recargas
            if (result.token)         localStorage.setItem('innova_token', result.token);
            if (result.refresh_token) localStorage.setItem('innova_refresh_token', result.refresh_token);
            
            // Guardamos todo junto en la memoria del navegador
            localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));

            // Ocultamos el login
            document.getElementById('pantalla-login').style.display = 'none';
            
            configurarInterfazPorRol();
            mostrarUsuarioEnHeader();

            // Lógica de ruteo inicial después del login
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'Chofer') {
                changeView('taller');
            } else {
                if (typeof cargarDatosVentaIniciales === 'function') {
                    const ok = await cargarDatosVentaIniciales();
                    if (!ok) return;
                }
                changeView('catalogo');
            }

            // Solo mostrar tienda si es vendedor
            let textoBienvenida = `Rol: ${usuarioActivo.rol}`;
            if (usuarioActivo.rol === 'Vendedor') {
                textoBienvenida += ` | Sede: ${usuarioActivo.tienda}`;
            }

            Swal.fire({
                title: `¡Hola, ${usuarioActivo.nombre}!`,
                text: textoBienvenida,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire('Acceso Denegado', 'El PIN es incorrecto.', 'error');
            document.getElementById('login-pin').value = '';
        }
    } catch (error) {
        Swal.fire('Error', 'No hay conexión con el servidor Python.', 'error');
    }
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
    const rolLabel = ROL_LABELS[usuarioActivo.rol] || usuarioActivo.rol;
    const nombre   = usuarioActivo.nombre.split(' ')[0];

    const wrap = document.createElement('div');
    wrap.id = 'header-user-info';
    wrap.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        font-family: 'Inter', sans-serif;
    `;
    wrap.innerHTML = `
        <div style="text-align:right; line-height:1.3;">
            <div style="font-size:13px; font-weight:600; color:var(--text, #1e293b);">${nombre}</div>
            <div style="font-size:10px; color:var(--text-muted, #94a3b8); letter-spacing:0.05em; text-transform:uppercase;">${rolLabel}</div>
        </div>
        <div style="
            width:34px; height:34px; border-radius:50%;
            background: linear-gradient(135deg, var(--primary,#2d5a27), var(--accent,#d4af37));
            display:flex; align-items:center; justify-content:center;
            font-size:14px; font-weight:700; color:#fff; flex-shrink:0;
        ">${nombre.charAt(0).toUpperCase()}</div>
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
