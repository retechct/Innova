// === MÓDULO: App principal, init, vistas, sesión ===
async function init() {
    try {
        const [catRes, matRes] = await Promise.all([
            fetch(`${API_URL}/api/catalogo`),
            fetch(`${API_URL}/api/materiales/listas`) 
        ]);
        
        allProducts = await catRes.json();
        maestroMateriales = await matRes.json(); 
        
        // Verificamos si Python nos mandó un error de Base de Datos en lugar de la lista
        if (allProducts.error || maestroMateriales.error) {
            console.error("Error de BD:", allProducts.error || maestroMateriales.error);
            return Swal.fire('Error de Base de Datos', 'Revisa la consola (F12) para ver la tabla que falta.', 'error');
        }
        
        // Punto 4: Persistencia de Sesión al recargar
        const sesion = localStorage.getItem('usuarioInnova');
        if (sesion) {
            usuarioActivo = JSON.parse(sesion);

            // SEGURIDAD: Clientes y roles no autorizados no pueden entrar al panel ERP
            const ROLES_ERP = ['Admin', 'Vendedor', 'Operario', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'];
            if (!ROLES_ERP.includes(usuarioActivo.rol)) {
                return; // Se queda en el landing
            }

            configurarInterfazPorRol();
            mostrarUsuarioEnHeader();
            document.getElementById('pantalla-login').style.display = 'none';
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER') {
                changeView('taller');
            } else {
                changeView('catalogo');
            }
        }
    } catch (e) {
        console.error("Error crítico:", e);
        Swal.fire('Error de Conexión', 'El servidor no responde o hay un error de código. Mira la consola (F12).', 'error');
    }
}

// Función centralizada para manejar permisos de UI
function configurarInterfazPorRol() {
    if (!usuarioActivo) return;
    
    const btnTaller = document.getElementById('btn-menu-taller');
    const btnInventario = document.getElementById('btn-menu-inventario');
    const btnInvTienda = document.getElementById('btn-menu-inv-tienda');
    const btnGestor = document.getElementById('btn-menu-gestor');
    const btnAddProd = document.getElementById('btn-add-producto');
    const btnLogistica = document.getElementById('btn-menu-logistica');
    const btnUsuarios = document.getElementById('btn-menu-usuarios');
    const btnProv = document.getElementById('btn-menu-proveedores');
    const btnContratos = document.getElementById('btn-menu-contratos'); // NUEVO ACCESO

    // Ocultar todos los botones por defecto
    if (btnTaller) btnTaller.style.display = 'none';
    if (btnInventario) btnInventario.style.display = 'none';
    if (btnInvTienda) btnInvTienda.style.display = 'none';
    if (btnGestor) btnGestor.style.display = 'none';
    if (btnAddProd) btnAddProd.style.display = 'none';
    if (btnLogistica) btnLogistica.style.display = 'none';
    if (btnUsuarios) btnUsuarios.style.display = 'none';
    if (btnProv) btnProv.style.display = 'none';
    if (btnContratos) btnContratos.style.display = 'none'; // NUEVO ACCESO

    // Mostrar botones según el rol


    if (['Admin','Jefe_Taller','JEFE_TALLER'].includes(usuarioActivo.rol)) {
    if (btnInvTienda) btnInvTienda.style.display = 'flex';
    }
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'Operario'].includes(usuarioActivo.rol)) {
        if (btnTaller) btnTaller.style.display = 'flex'; // GESTIÓN DE TALLER
    }
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'].includes(usuarioActivo.rol)) {
        if (btnInventario) btnInventario.style.display = 'flex'; // CONTROL DE INSUMOS
    }
    if (usuarioActivo.rol === 'Admin') {
        if (btnGestor)    btnGestor.style.display    = 'flex';
        // ↓ btnAddProd NO se muestra aquí; changeView lo controla según la vista activa
        if (btnLogistica) btnLogistica.style.display = 'flex';
        if (btnUsuarios)  btnUsuarios.style.display  = 'flex';
        if (btnProv)      btnProv.style.display      = 'flex';
    }
    if (usuarioActivo.rol === 'Admin') {
        if (btnContratos) btnContratos.style.display = 'block'; // Solo Admin ve reportes globales
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay-sidebar').classList.toggle('active');
}

/* ================================================================= */
/* --- SEGUIMIENTO DE PEDIDOS (CONEXIÓN CON PYTHON) --- */
/* ================================================================= */
async function loadMisPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center; padding:20px; color:gray;">Cargando seguimiento...</p>`;

    try {
       // ✅ CORRECCIÓN:
        if (!usuarioActivo) return; // salir sin hacer el fetch
        const idVendedor = usuarioActivo.id;
        const res = await fetch(`${API_URL}/api/mis-ventas/${idVendedor}`);
        const data = await res.json();
        
        if (data.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:40px;">No hay pedidos registrados.</p>`;
            return;
        }

        container.innerHTML = data.map(v => `
            <div class="pedido-card" onclick="abrirDetallePedido('${v.codigo}')" style="background:white; padding:15px; border-radius:10px; margin-bottom:10px; border:1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:800; color:#1a1a1a;">#${v.codigo}</span>
                    <small style="color:#d4af37; font-weight:800;">${v.estado.toUpperCase()}</small>
                </div>
                <p style="font-weight:700; margin:0 0 10px 0; font-size:14px; color:#1e293b;">${v.cliente.toUpperCase()}</p>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:900; color:#10b981; font-size:13px;">S/ ${v.monto_total.toFixed(2)}</span>
                    <span style="font-size:10px; color:#64748b;">Entrega: <b>${v.entrega}</b></span>
                </div>

                <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO: ${v.progreso}%</div>
                <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                    <div style="width:${v.progreso}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                </div>

                <div style="display:flex; gap:8px; margin-top:15px;">
                    <button onclick="abrirDetallePedido('${v.codigo}')" style="flex:1; background:#0f172a; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-eye"></i> Ver Ficha
                    </button>
                    ${(v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
                    <button onclick="abrirModalCambioPrecio('${v.codigo}', ${v.monto_total})" style="flex:1; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-tag"></i> Cambiar Precio
                    </button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</p>`;
    }
}


/* ================================================================= */
/* --- LOGÍSTICA EXTERNA (PROCURA) --- */
/* ================================================================= */
async function cargarLogisticaExterna() {
    const tabla = document.getElementById('tabla-logistica-externa');
    if (!tabla) return;
    tabla.innerHTML = `<div style="text-align:center;padding:30px;color:#64748b;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:10px;font-weight:600;">Cargando requerimientos...</p>
    </div>`;

    try {
        const [resLog, resProv] = await Promise.all([
            fetch(`${API_URL}/api/logistica`),
            fetch(`${API_URL}/api/proveedores`)
        ]);
        const items     = await resLog.json();
        const proveedores = await resProv.json();

        if (!items.length) {
            tabla.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;">
                <i class="fa-solid fa-box-open" style="font-size:2.5rem;opacity:0.4;"></i>
                <p style="margin-top:12px;font-weight:700;">Sin requerimientos externos activos.</p>
                <p style="font-size:12px;">Los insumos de proveedores que se necesiten para pedidos aparecerán aquí.</p>
            </div>`;
            return;
        }

        const coloresEstado = {
            'Pendiente':   { bg: '#fef9c3', color: '#854d0e' },
            'Cotizado':    { bg: '#dbeafe', color: '#1e40af' },
            'Confirmado':  { bg: '#dcfce7', color: '#166534' },
            'En Tránsito': { bg: '#ede9fe', color: '#5b21b6' },
            'Recibido':    { bg: '#f0fdf4', color: '#15803d' },
            'Cancelado':   { bg: '#fee2e2', color: '#991b1b' },
        };

        const esAdmin = usuarioActivo && usuarioActivo.rol === 'Admin';

        const opcionesProveedor = proveedores.map(p =>
            `<option value="${p.id}">${p.nombre} (${p.especialidad})</option>`
        ).join('');

        const opcionesEstado = ['Pendiente','Cotizado','Confirmado','En Tránsito','Recibido','Cancelado']
            .map(e => `<option value="${e}">${e}</option>`).join('');

        let html = `
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px;">
            <thead>
                <tr style="background:#0f172a;color:white;font-size:11px;font-weight:900;text-transform:uppercase;">
                    <th style="padding:12px 14px;text-align:left;">Pedido</th>
                    <th style="padding:12px 14px;text-align:left;">Insumo / SKU</th>
                    <th style="padding:12px 14px;text-align:left;">Proveedor</th>
                    <th style="padding:12px 10px;text-align:center;">Precio</th>
                    <th style="padding:12px 10px;text-align:center;">F. Entrega</th>
                    <th style="padding:12px 10px;text-align:center;">Estado</th>
                    ${esAdmin ? '<th style="padding:12px 10px;text-align:center;">Acciones</th>' : ''}
                </tr>
            </thead>
            <tbody>`;

        items.forEach((item, idx) => {
            const c   = coloresEstado[item.estado] || { bg:'#f1f5f9', color:'#475569' };
            const bg  = idx % 2 === 0 ? 'white' : '#fafbfc';
            html += `
            <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${bg}'">
                <td style="padding:12px 14px;">
                    <span style="font-weight:900;color:#d97706;">#${item.codigo_venta}</span>
                </td>
                <td style="padding:12px 14px;">
                    <div style="font-weight:700;">${item.insumo}</div>
                    <div style="font-size:11px;color:#94a3b8;">${item.sku || '—'}</div>
                </td>
                <td style="padding:12px 14px;color:#475569;">${item.proveedor}</td>
                <td style="padding:12px 10px;text-align:center;font-weight:800;color:#0f172a;">
                    ${item.precio_cotizado ? `S/ ${item.precio_cotizado.toFixed(2)}` : '<span style="color:#cbd5e1;">—</span>'}
                </td>
                <td style="padding:12px 10px;text-align:center;font-size:12px;color:#64748b;">
                    ${item.fecha_entrega_proveedor || '<span style="color:#cbd5e1;">Sin fecha</span>'}
                </td>
                <td style="padding:12px 10px;text-align:center;">
                    <span style="background:${c.bg};color:${c.color};padding:4px 10px;border-radius:20px;font-weight:800;font-size:11px;">
                        ${item.estado}
                    </span>
                </td>
                ${esAdmin ? `
                <td style="padding:12px 10px;text-align:center;">
                    <button onclick="_abrirEditarLogistica(${JSON.stringify(item).replace(/"/g,'&quot;')}, ${JSON.stringify(proveedores).replace(/"/g,'&quot;')})"
                            style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;color:#475569;">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                </td>` : ''}
            </tr>`;
        });

        html += `</tbody></table></div>
        <div style="margin-top:10px;font-size:11px;color:#94a3b8;text-align:right;">
            ${items.length} requerimiento${items.length !== 1 ? 's' : ''} activos
        </div>`;
        tabla.innerHTML = html;

    } catch(e) {
        tabla.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar: ${e.message}
        </div>`;
    }
}

async function _abrirEditarLogistica(item, proveedores) {
    const opsProv = `<option value="">— Sin asignar —</option>` + proveedores.map(p =>
        `<option value="${p.id}">${p.nombre} (${p.especialidad})</option>`
    ).join('');
    const opsEstado = ['Pendiente','Cotizado','Confirmado','En Tránsito','Recibido','Cancelado']
        .map(e => `<option value="${e}" ${e === item.estado ? 'selected' : ''}>${e}</option>`).join('');

    const { value: datos, isConfirmed } = await Swal.fire({
        title: `Editar: ${item.insumo}`,
        html: `
            <div style="text-align:left;font-size:13px;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Proveedor</label>
                <select id="sl-prov" class="swal2-input" style="margin:0 0 12px;width:100%;">${opsProv}</select>
                <label style="font-weight:700;display:block;margin-bottom:4px;">Precio cotizado (S/)</label>
                <input id="sl-precio" class="swal2-input" type="number" step="0.01"
                    placeholder="0.00" value="${item.precio_cotizado || ''}"
                    style="margin:0 0 12px;width:100%;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Fecha entrega proveedor</label>
                <input id="sl-fecha" class="swal2-input" type="date"
                    value="${item.fecha_entrega_proveedor
                        ? item.fecha_entrega_proveedor.split('/').reverse().join('-')
                        : ''}"
                    style="margin:0 0 12px;width:100%;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Estado</label>
                <select id="sl-estado" class="swal2-input" style="margin:0;width:100%;">${opsEstado}</select>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar cambios',
        cancelButtonText:  'Cancelar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => ({
            id:                      item.id,
            proveedor_id:            document.getElementById('sl-prov').value    || null,
            precio_cotizado:         document.getElementById('sl-precio').value  || null,
            fecha_entrega_proveedor: document.getElementById('sl-fecha').value   || null,
            estado:                  document.getElementById('sl-estado').value,
        })
    });
    if (!isConfirmed || !datos) return;

    try {
        const res = await fetch(`${API_URL}/api/logistica/actualizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        Swal.fire({ icon:'success', title:'¡Actualizado!', timer:1500, showConfirmButton:false });
        cargarLogisticaExterna();
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function changeView(view) {
    currentMode = view;
    if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();

    // ── Guard: proteger llamadas antes de que los scripts estén listos ──
    const guardas = {
        'inv-tienda':      () => typeof cargarVistaInventario === 'function',
        'inventario':      () => typeof cargarInventarioTaller === 'function',
        'taller':          () => typeof cargarTicketsTaller === 'function',
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
        'inventario':   'CONTROL DE INSUMOS',
        'contratos':    'REPORTES Y VENTAS',
        'inv-tienda':   'INVENTARIO POR TIENDA',
        'logistica':    'LOGÍSTICA EXTERNA',
        'usuarios-admin': 'GESTIÓN DE PERSONAL',
        'proveedores':  'PROVEEDORES',
    };

    // Restaurar el header estático si veníamos de inv-tienda
    const mainTitleContainer = document.querySelector('main .view-title-container');
    if (mainTitleContainer) mainTitleContainer.style.display = '';

    // Limpiar el contenedor dinámico del inventario si existía
    const invDinamico = document.getElementById('inv-dinamico-wrapper');
    if (invDinamico) invDinamico.remove();

    if (titles[view]) {
        document.getElementById('view-title').innerText = titles[view];
    }

    // ── Ocultar TODAS las secciones antes de mostrar la nueva ──
    const secciones = [
        'view-productos', 'view-plantillas', 'view-pedidos',
        'view-taller', 'view-inventario', 'view-gestor-aprobacion',
        'view-logistica', 'view-usuarios-admin', 'view-proveedores',
        'vista-contratos'
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
    else if (view === 'gestor-aprobacion') {
        mostrar('view-gestor-aprobacion');
        document.getElementById('view-title').innerText = 'GESTOR DE MODELOS (Make vs Buy)';
        cargarGestorAprobacion();
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
        // 1. Cargar Sedes
        const resSedes = await fetch(`${API_URL}/api/sedes`);
        const sedes = await resSedes.json();
        const selectSede = document.getElementById('login-tienda');
        
        if (selectSede) {
            selectSede.innerHTML = '<option value="">-- Selecciona Sede --</option>';
            sedes.forEach(s => {
                selectSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
            });
        }

        // 2. Cargar Usuarios
        const resUser = await fetch(`${API_URL}/api/usuarios`);
        const usuarios = await resUser.json();
        const selectUser = document.getElementById('login-usuario');
        if (selectUser) {
            selectUser.innerHTML = '<option value="">-- Elige tu nombre --</option>';
            usuarios.forEach(u => {
                selectUser.innerHTML += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
            });
        }
    } catch (error) {
        console.error("No hay conexión con el servidor para cargar usuarios", error);
    }
}

const ROLES_ERP = ['Admin', 'Vendedor', 'Operario', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'];

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
            const ROLES_ERP = ['Admin', 'Vendedor', 'Operario', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'];
            if (!ROLES_ERP.includes(usuarioActivo.rol)) {
                return Swal.fire('Acceso Denegado', 'Tu cuenta no tiene acceso al panel interno.', 'warning');
            }

            // Agregamos la tienda y la hora al perfil del usuario
            usuarioActivo.sede_id = tiendaSelect.value;
            usuarioActivo.tienda = nombreTienda;
            usuarioActivo.horaLogin = new Date().toLocaleTimeString();
            
            // Guardamos todo junto en la memoria del navegador
            localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));
            
            // Ocultamos el login
            document.getElementById('pantalla-login').style.display = 'none';
            
            configurarInterfazPorRol();
            mostrarUsuarioEnHeader();

            // Lógica de ruteo inicial después del login
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER') {
                changeView('taller');
            } else {
                changeView('catalogo');
            }

            // Mensaje de bienvenida actualizado con su tienda
            Swal.fire({
                title: `¡Hola, ${usuarioActivo.nombre}!`,
                text: `Rol: ${usuarioActivo.rol} | Sede: ${usuarioActivo.tienda}`,
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
        'JEFE_TALLER': 'Jefe Taller',
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
            location.reload();
        }
    });
}
// ==========================================
// MÓDULO: CONTRATOS / REPORTES Y VENTAS
// ==========================================
let _contratosData = [];

async function loadContratos() {
    const tbody = document.getElementById('contratos-tbody');
    const cards = document.getElementById('contratos-cards');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#94a3b8;">
        <i class="fa-solid fa-spinner fa-spin"></i> Cargando contratos...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/api/ventas`);
        _contratosData = await res.json();
        if (_contratosData.error) throw new Error(_contratosData.error);
        filtrarContratos();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#ef4444;">
            Error al cargar: ${e.message}</td></tr>`;
    }
}

function filtrarContratos() {
    const q      = (document.getElementById('contratos-search')?.value || '').toLowerCase();
    const estado = document.getElementById('contratos-filtro-estado')?.value || '';
    const desde  = document.getElementById('contratos-desde')?.value || '';
    const hasta  = document.getElementById('contratos-hasta')?.value || '';

    const filtrado = _contratosData.filter(v => {
        const texto = `${v.codigo} ${v.cliente} ${v.productos || ''}`.toLowerCase();
        const okQ      = !q      || texto.includes(q);
        const okEstado = !estado || v.estado === estado;
        const okDesde  = !desde  || v.fecha_entrega >= desde;
        const okHasta  = !hasta  || v.fecha_entrega <= hasta;
        return okQ && okEstado && okDesde && okHasta;
    });

    renderContratos(filtrado);
}

const ESTADO_COLORS = {
    'Pendiente':      { bg:'#fef3c7', color:'#92400e' },
    'En producción':  { bg:'#dbeafe', color:'#1e40af' },
    'Listo':          { bg:'#d1fae5', color:'#065f46' },
    'Entregado':      { bg:'#f1f5f9', color:'#475569' },
    'Despachado':     { bg:'#e0f2fe', color:'#0369a1' },
    'Cancelado':      { bg:'#fee2e2', color:'#b91c1c' },
};

function renderContratos(lista) {
    const tbody  = document.getElementById('contratos-tbody');
    const cards  = document.getElementById('contratos-cards');
    const stats  = document.getElementById('contratos-stats');
    const isMobile = window.innerWidth < 640;

    // Estadísticas rápidas
    const totalVentas  = lista.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const totalSaldo   = lista.reduce((s, v) => s + (parseFloat(v.saldo)  || 0), 0);
    stats.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#64748b; font-weight:700;">CONTRATOS</div>
            <div style="font-size:22px; font-weight:900; color:#0f172a;">${lista.length}</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#166534; font-weight:700;">TOTAL VENTAS</div>
            <div style="font-size:22px; font-weight:900; color:#166534;">S/ ${totalVentas.toFixed(2)}</div>
        </div>
        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#9a3412; font-weight:700;">SALDO PENDIENTE</div>
            <div style="font-size:22px; font-weight:900; color:#9a3412;">S/ ${totalSaldo.toFixed(2)}</div>
        </div>`;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#94a3b8;">No hay contratos para estos filtros.</td></tr>`;
        cards.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:40px;">No hay contratos para estos filtros.</p>`;
        return;
    }

    // === Tabla (desktop) === CORREGIDO PARA INCLUIR SEDE Y BALANCEAR COLUMNAS
document.getElementById('contratos-table-wrapper').style.display = isMobile ? 'none' : 'block';
cards.style.display = isMobile ? 'block' : 'none';

const ec = (v) => {
    const e = ESTADO_COLORS[v.estado] || { bg:'#f1f5f9', color:'#475569' };
    return `<span style="background:${e.bg}; color:${e.color}; font-size:10px; font-weight:800;
                    padding:3px 8px; border-radius:20px; white-space:nowrap;">${v.estado || '—'}</span>`;
};

tbody.innerHTML = lista.map((v, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; background:${i%2===0?'white':'#fafafa'};"
        onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${i%2===0?'white':'#fafafa'}'">
        <td style="padding:11px 14px; font-weight:800; color:#d4af37;">#${v.codigo}</td>
        <td style="padding:11px 14px;">
            <div style="font-weight:700; font-size:13px;">${v.cliente}</div>
            <div style="font-size:11px; color:#94a3b8;">${v.vendedor || 'Sin asignar'}</div>
        </td>
        
        <td style="padding:11px 14px;">
            <span style="font-size:11px; background:#f1f5f9; color:#334155; padding:3px 8px; border-radius:6px; font-weight:600;">
                <i class="fa-solid fa-shop" style="font-size:10px; margin-right:4px; color:#64748b;"></i>${v.sede || 'Sede Central'}
            </span>
        </td>
        
        <td style="padding:11px 14px; font-weight:800; color:#10b981;">S/ ${parseFloat(v.total||0).toFixed(2)}</td>
        <td style="padding:11px 14px; color:#0f172a;">S/ ${parseFloat(v.adelanto||0).toFixed(2)}</td>
        <td style="padding:11px 14px; color:#ef4444; font-weight:700;">S/ ${parseFloat(v.saldo||0).toFixed(2)}</td>
        <td style="padding:11px 14px;">${ec(v)}</td>
        <td style="padding:11px 14px; font-size:12px; color:#64748b;">${v.fecha_entrega || '—'}</td>
        <td style="padding:11px 14px; white-space:nowrap; display:flex; gap:6px; align-items:center;">
            <button onclick="verDetalleContrato('${v.codigo}')" title="Ver pedido"
                    style="background:#0f172a; color:white; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button onclick="verHistorialPrecios('${v.codigo}')" title="Historial de precios"
                    style="background:#f1f5f9; color:#475569; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-clock-rotate-left"></i>
            </button>
            ${(usuarioActivo?.rol === 'Vendedor' && v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
            <button onclick="abrirModalCambioPrecio('${v.codigo}', ${v.total})"
                    title="Proponer cambio de precio"
                    style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700;">
                <i class="fa-solid fa-tag"></i>
            </button>` : ''}
        </td>
    </tr>`).join('');

// === Cards (mobile) === CORREGIDO PARA MOSTRAR LA SEDE EN CELULARES
cards.innerHTML = lista.map(v => `
    <div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <span style="font-weight:900; font-size:15px; color:#d4af37;">#${v.codigo}</span>
            ${ec(v)}
        </div>
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${v.cliente}</div>
        
        <div style="font-size:12px; color:#64748b; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
            <span>${v.vendedor || 'Vendedor'}</span> · 
            <span style="background:#f1f5f9; color:#475569; padding:1px 5px; border-radius:4px; font-size:11px; font-weight:600;">${v.sede || 'Sede Central'}</span>
            · Entrega: ${v.fecha_entrega || '—'}
        </div>
        
        <div style="display:flex; gap:10px; font-size:13px; margin-bottom:12px;">
            <div style="flex:1; background:#f0fdf4; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:10px; color:#166534; font-weight:700;">TOTAL</div>
                <div style="font-weight:900; color:#166534;">S/ ${parseFloat(v.total||0).toFixed(2)}</div>
            </div>
            <div style="flex:1; background:#fff7ed; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:10px; color:#9a3412; font-weight:700;">SALDO</div>
                <div style="font-weight:900; color:#9a3412;">S/ ${parseFloat(v.saldo||0).toFixed(2)}</div>
            </div>
        </div>
        <button onclick="verDetalleContrato('${v.codigo}')"
                style="width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:${(usuarioActivo?.rol==='Vendedor'&&v.estado!=='Entregado'&&v.estado!=='Cancelado')?'8px':'0'};">
            <i class="fa-solid fa-eye"></i> Ver contrato
        </button>
        ${(usuarioActivo?.rol === 'Vendedor' && v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
        <button onclick="abrirModalCambioPrecio('${v.codigo}', ${v.total})"
                style="width:100%; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
            <i class="fa-solid fa-tag"></i> Proponer cambio de precio
        </button>` : ''}
    </div>`).join('');
}

function verDetalleContrato(codigo) {
    // Abre el modal de detalle de pedido que ya existe en el sistema
    abrirDetallePedido(codigo);
}

async function verHistorialPrecios(codigo) {
    try {
        Swal.fire({ title: 'Cargando historial...', didOpen: () => Swal.showLoading() });
        const res = await fetch(`${API_URL}/api/ventas/${codigo}/historial-precios`);
        const data = await res.json();
        Swal.close();

        if (!data.length) return Swal.fire('Sin cambios', 'Este contrato mantiene su precio original.', 'info');

        let html = `
            <div style="text-align:left; max-height:400px; overflow-y:auto; padding:5px;">
                ${data.map(h => {
                    const colorEstado = h.estado === 'Aprobado' ? '#10b981' : (h.estado === 'Rechazado' ? '#ef4444' : '#f59e0b');
                    return `
                    <div style="border-bottom:1px solid #eee; padding:10px 0; font-size:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-weight:900; color:${colorEstado}">${h.estado.toUpperCase()}</span>
                            <span style="color:gray;">${h.fecha_solicitud}</span>
                        </div>
                        <div style="margin-bottom:5px;">
                            De <b>S/ ${h.price_original?.toFixed(2) || h.precio_original?.toFixed(2)}</b> 
                            a <b style="color:#d4af37">S/ ${h.price_nuevo?.toFixed(2) || h.precio_nuevo?.toFixed(2)}</b>
                        </div>
                        <div style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:5px; color:#475569;">
                            <b>Motivo:</b> ${h.motivo}
                        </div>
                        <div style="font-size:11px;">
                            Solicitó: <b>${h.vendedor}</b><br>
                            ${h.admin ? `Resuelto por: <b>${h.admin}</b>` : ''}
                            ${h.notas_admin ? `<br><i style="color:gray;">"${h.notas_admin}"</i>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        Swal.fire({
            title: `Historial de Precios #${codigo}`,
            html: html,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a',
            width: '450px'
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el historial.', 'error');
    }
}

// ==========================================
// MÓDULO: CAMBIO DE PRECIO
// ==========================================
let _cambioPrecioActual = null; // { codigo, precioActual }

function abrirModalCambioPrecio(codigo, precioActual) {
    _cambioPrecioActual = { codigo, precioActual };
    document.getElementById('cambio-precio-codigo-label').textContent = `Contrato #${codigo}`;
    document.getElementById('cambio-precio-actual-label').textContent = `S/ ${parseFloat(precioActual).toFixed(2)}`;
    document.getElementById('input-precio-nuevo').value = '';
    document.getElementById('input-motivo-precio').value = '';
    document.getElementById('modal-cambio-precio').style.display = 'flex';
}

function cerrarModalCambioPrecio() {
    document.getElementById('modal-cambio-precio').style.display = 'none';
    _cambioPrecioActual = null;
}

async function enviarCambioPrecio() {
    if (!_cambioPrecioActual) return;
    const precioNuevo = parseFloat(document.getElementById('input-precio-nuevo').value);
    const motivo      = document.getElementById('input-motivo-precio').value.trim();

    if (!precioNuevo || precioNuevo <= 0) {
        return Swal.fire('Campo requerido', 'Ingresa el nuevo precio.', 'warning');
    }
    if (!motivo) {
        return Swal.fire('Campo requerido', 'Debes ingresar el motivo del cambio.', 'warning');
    }
    if (precioNuevo === _cambioPrecioActual.precioActual) {
        return Swal.fire('Sin cambio', 'El precio nuevo es igual al actual.', 'info');
    }

    try {
        const res = await fetch(`${API_URL}/api/ventas/${_cambioPrecioActual.codigo}/proponer-cambio-precio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                precio_nuevo:    precioNuevo,
                motivo:          motivo,
                vendedor_id:     usuarioActivo?.id,
                vendedor_nombre: usuarioActivo?.nombre
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        cerrarModalCambioPrecio();
        Swal.fire('✅ Enviado', 'Tu solicitud fue enviada al administrador para aprobación.', 'success');
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function cargarCambiosPrecioPendientes() {
    const contenedor = document.getElementById('lista-cambios-precio');
    const badge      = document.getElementById('badge-cambios-precio');
    if (!contenedor) return;

    try {
        const res  = await fetch(`${API_URL}/api/cambios-precio/pendientes`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.length === 0) {
            contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Sin solicitudes pendientes.</p>';
            badge.style.display = 'none';
            return;
        }

        badge.textContent     = `${data.length} pendiente${data.length > 1 ? 's' : ''}`;
        badge.style.display   = 'inline-block';

        contenedor.innerHTML = data.map(c => {
            const diff      = c.precio_nuevo - c.precio_original;
            const esSube    = diff > 0;
            const diffLabel = `${esSube ? '▲' : '▼'} S/ ${Math.abs(diff).toFixed(2)}`;
            const diffColor = esSube ? '#ef4444' : '#10b981';
            return `
            <div style="background:white; border:1px solid #fde68a; border-radius:12px; padding:16px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div>
                        <span style="font-weight:900; color:#d97706; font-size:14px;">#${c.codigo_venta}</span>
                        <span style="font-size:12px; color:#64748b; margin-left:8px;">${c.cliente}</span>
                    </div>
                    <span style="font-size:11px; font-weight:700; color:${diffColor}; background:${esSube?'#fef2f2':'#f0fdf4'}; padding:2px 8px; border-radius:20px;">${diffLabel}</span>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; font-size:13px;">
                    <div style="flex:1; text-align:center; background:#f8fafc; border-radius:8px; padding:8px;">
                        <div style="font-size:10px; color:#64748b; font-weight:700;">ACTUAL</div>
                        <div style="font-weight:900; color:#0f172a;">S/ ${c.precio_original.toFixed(2)}</div>
                    </div>
                    <div style="flex:1; text-align:center; background:#fffbeb; border-radius:8px; padding:8px;">
                        <div style="font-size:10px; color:#92400e; font-weight:700;">PROPUESTO</div>
                        <div style="font-weight:900; color:#d97706;">S/ ${c.precio_nuevo.toFixed(2)}</div>
                    </div>
                </div>
                <div style="background:#f8fafc; border-radius:8px; padding:10px; margin-bottom:12px; font-size:12px; color:#475569;">
                    <strong>Motivo:</strong> ${c.motivo}
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">
                    Solicitado por <strong>${c.vendedor}</strong> · ${c.fecha_solicitud}
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="resolverCambioPrecio(${c.id}, 'aprobar')"
                            style="flex:1; padding:9px; background:#065f46; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:800; font-size:12px;">
                        <i class="fa-solid fa-check"></i> Aprobar
                    </button>
                    <button onclick="resolverCambioPrecio(${c.id}, 'rechazar')"
                            style="flex:1; padding:9px; background:#7f1d1d; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:800; font-size:12px;">
                        <i class="fa-solid fa-xmark"></i> Rechazar
                    </button>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        contenedor.innerHTML = `<p style="color:#ef4444; font-size:13px;">Error: ${e.message}</p>`;
    }
}

async function resolverCambioPrecio(cambioId, accion) {
    const esAprobar = accion === 'aprobar';
    let notasAdmin  = '';

    if (!esAprobar) {
        const { value, isConfirmed } = await Swal.fire({
            title: 'Rechazar solicitud',
            input: 'textarea',
            inputLabel: 'Motivo del rechazo (opcional)',
            inputPlaceholder: 'Ej: El precio ya fue acordado con el cliente...',
            showCancelButton: true,
            confirmButtonText: 'Rechazar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#991b1b',
        });
        if (!isConfirmed) return;
        notasAdmin = value || '';
    } else {
        const confirm = await Swal.fire({
            title: '¿Aprobar cambio de precio?',
            text: 'El monto total de la venta se actualizará inmediatamente.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#065f46',
        });
        if (!confirm.isConfirmed) return;
    }

    try {
        const url = `${API_URL}/api/cambios-precio/${cambioId}/${esAprobar ? 'aprobar' : 'rechazar'}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id:     usuarioActivo?.id,
                admin_nombre: usuarioActivo?.nombre,
                notas_admin:  notasAdmin
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        Swal.fire('✅ Listo', data.mensaje, 'success');
        cargarCambiosPrecioPendientes();
        if (typeof loadContratos === 'function') loadContratos();

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function descargarExcelContratos() {
    const desde = document.getElementById('contratos-desde')?.value;
    const hasta = document.getElementById('contratos-hasta')?.value;

    if (!desde || !hasta) {
        // Si no hay fechas, exportar todo usando la ruta correcta
        const url = `${API_URL}/api/ventas/exportar`;
        window.open(url, '_blank');
        return;
    }
    const url = `${API_URL}/api/ventas/exportar?inicio=${desde}&fin=${hasta}`;
    window.open(url, '_blank');
}
// ==========================================
// PUNTO DE ENTRADA — se ejecuta al cargar la página
// FIX: un solo DOMContentLoaded que llama init() + cargarUsuariosLogin()
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosInicialesLogin(); // Carga Sedes y Usuarios
    verificarSesionExistente(); // oculta el login si ya hay sesión guardada
    init();                  // carga catálogo + materiales y rutea según sesión
});