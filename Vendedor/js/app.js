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
            configurarInterfazPorRol();
            document.getElementById('pantalla-login').style.display = 'none';
            // Lógica de ruteo inicial al cargar la sesión
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
    const btnGestor = document.getElementById('btn-menu-gestor');
    const btnAddProd = document.getElementById('btn-add-producto');
    const btnLogistica = document.getElementById('btn-menu-logistica');
    const btnUsuarios = document.getElementById('btn-menu-usuarios');
    const btnProv = document.getElementById('btn-menu-proveedores');
    const btnContratos = document.getElementById('btn-menu-contratos'); // NUEVO ACCESO

    // Ocultar todos los botones por defecto
    if (btnTaller) btnTaller.style.display = 'none';
    if (btnInventario) btnInventario.style.display = 'none';
    if (btnGestor) btnGestor.style.display = 'none';
    if (btnAddProd) btnAddProd.style.display = 'none';
    if (btnLogistica) btnLogistica.style.display = 'none';
    if (btnUsuarios) btnUsuarios.style.display = 'none';
    if (btnProv) btnProv.style.display = 'none';
    if (btnContratos) btnContratos.style.display = 'none'; // NUEVO ACCESO

    // Mostrar botones según el rol
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'Operario'].includes(usuarioActivo.rol)) {
        if (btnTaller) btnTaller.style.display = 'flex'; // GESTIÓN DE TALLER
    }
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'].includes(usuarioActivo.rol)) {
        if (btnInventario) btnInventario.style.display = 'flex'; // CONTROL DE INSUMOS
    }
    if (usuarioActivo.rol === 'Admin') {
        if (btnGestor) btnGestor.style.display = 'flex';     // GESTOR DE MODELOS
        if (btnAddProd) btnAddProd.style.display = 'block'; // Añadir Producto (en catálogo)
        if (btnLogistica) btnLogistica.style.display = 'flex'; // LOGÍSTICA EXTERNA
        if (btnUsuarios) btnUsuarios.style.display = 'flex';   // GESTIÓN DE PERSONAL
        if (btnProv) btnProv.style.display = 'flex';         // PROVEEDORES
        if (btnContratos) btnContratos.style.display = 'block'; // NUEVO ACCESO: REPORTES Y VENTAS
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
                    <small style="color:#d4af37; font-weight:800;">Entrega: ${v.entrega}</small>
                </div>
                <p style="font-weight:700; margin:0 0 10px 0; font-size:14px; color:#1e293b;">${v.cliente.toUpperCase()}</p>
                <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO: ${v.progreso}%</div>
                <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                    <div style="width:${v.progreso}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</p>`;
    }
}

// Función encargada de recopilar el rango de fechas y descargar el reporte Excel
function descargarExcelContratos() {
    const inicio = document.getElementById('excel-fecha-inicio').value;
    const fin = document.getElementById('excel-fecha-fin').value;
    
    if (!inicio || !fin) {
        Swal.fire('Atención', 'Por favor selecciona un rango de fechas.', 'warning');
        return;
    }

    Swal.fire({
        title: 'Generando Reporte...',
        text: 'Por favor espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const urlDescarga = `${API_URL}/api/ventas/exportar?inicio=${inicio}&fin=${fin}`;
    window.open(urlDescarga, '_blank');
    Swal.close();
}
/* --- FUNCIÓN BLINDADA CONTRA ERRORES "NULL" --- */
function changeView(view) {
    currentMode = view;
    if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
    
    // 1. ACTUALIZADO: Se agregó el título 'contratos'
    const titles = { 
        'stock': 'STOCK EN TIENDA', 
        'catalogo': 'NUESTRA CARTA', 
        'contrato': 'DISEÑOS A MEDIDA', 
        'pedidos': 'SEGUIMIENTO', 
        'taller': 'GESTIÓN DE TALLER' ,
        'inventario': 'CONTROL DE INSUMOS',
        'contratos': 'REPORTES Y VENTAS' // <-- NUEVO
    };
    
    if (titles[view]) {
        document.getElementById('view-title').innerText = titles[view];
    }

    // 2. ACTUALIZADO: Se agregó 'vista-contratos' a la lista para que se oculte correctamente
    const secciones = ['view-productos', 'view-plantillas', 'view-pedidos', 'view-taller', 'view-inventario', 'view-gestor-aprobacion', 'view-logistica', 'view-usuarios-admin', 'view-proveedores', 'vista-contratos'];
    
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Mostrar la vista seleccionada
    if (view === 'stock' || view === 'catalogo') {
        document.getElementById('view-productos').style.display = 'block';
        renderGrid(); 
    }
    else if (view === 'contrato') {
        document.getElementById('view-plantillas').style.display = 'block';
    }
    else if (view === 'contratos') {
        document.getElementById('vista-contratos').style.display = 'block';
        loadContratos();
    }
    else if (view === 'pedidos') {
        document.getElementById('view-pedidos').style.display = 'block';
        loadMisPedidos();
    }
    else if (view === 'taller') {
        document.getElementById('view-taller').style.display = 'block';
        cargarTicketsTaller(); 
    }
    else if (view === 'inventario') {
        document.getElementById('view-inventario').style.display = 'block';
        cargarInventarioTaller(); 
    }
    else if (view === 'logistica') {
        document.getElementById('view-logistica').style.display = 'block';
        cargarLogisticaExterna();
    }
    else if (view === 'usuarios-admin') {
        document.getElementById('view-usuarios-admin').style.display = 'block';
        listarUsuarios();
    }
    else if (view === 'proveedores') {
        document.getElementById('view-proveedores').style.display = 'block';
        listarProveedores();
    }
    else if (view === 'gestor-aprobacion') {
        document.getElementById('view-gestor-aprobacion').style.display = 'block';
        document.getElementById('view-title').innerText = 'GESTOR DE MODELOS (Make vs Buy)';
        cargarGestorAprobacion();
    }
}
function renderGrid() {
    const grid = document.getElementById('product-grid');
    let filtered = [];

    // Filtramos los productos según la vista seleccionada (ignorando plantillas)
    if (currentMode === 'stock') {
        filtered = allProducts.filter(p => p.en_stock === true && p.es_plantilla === false);
    } else if (currentMode === 'catalogo') {
        filtered = allProducts.filter(p => p.en_stock === false && p.es_plantilla === false);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: gray; padding: 40px;">No hay productos disponibles en esta categoría.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="card">
            <img src="${p.foto}" onerror="this.src='imagenes/sin_foto.jpg'">
            <div class="card-info">
                ${p.en_stock ? '<span class="status-badge" style="background:#f0fdf4; color:var(--success)">ENTREGA INMEDIATA</span>' : '<span class="status-badge" style="background:#f1f5f9; color:var(--text-muted)">ESTÁNDAR</span>'}
                <h4>${p.nombre}</h4>
                <span class="price-tag">${p.precio > 0 ? 'S/ ' + p.precio.toFixed(2) : 'A Cotizar'}</span>
                <button class="btn-action btn-primary" onclick="addToCart('${p.nombre}', ${p.precio}, '${p.foto}', 'Venta Estándar')">
                    <i class="fa-solid fa-plus"></i> AÑADIR AL CARRO
                </button>
            </div>
        </div>
    `).join('');
}

async function cargarUsuariosLogin() {
    try {
        const response = await fetch(`${API_URL}/api/usuarios`);
        const usuarios = await response.json();
        const select = document.getElementById('login-usuario');
        select.innerHTML = '<option value="">-- Elige tu nombre --</option>';
        
        usuarios.forEach(u => {
            select.innerHTML += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
        });
    } catch (error) {
        console.error("No hay conexión con el servidor para cargar usuarios", error);
    }
}

function verificarSesionExistente() {
    const sesionGuardada = localStorage.getItem('usuarioInnova');
    
    if (sesionGuardada) {
        usuarioActivo = JSON.parse(sesionGuardada);
        document.getElementById('pantalla-login').style.display = 'none';
        configurarInterfazPorRol();
        // El ruteo real lo hará init() una vez cargue los productos
    }
}

async function entrarAlSistema() {
    const usuarioId = document.getElementById('login-usuario').value;
    const pin = document.getElementById('login-pin').value;
    
    // Capturamos la tienda que seleccionó en el dropdown
    const tiendaSelect = document.getElementById('login-tienda');
    const tiendaSeleccionada = tiendaSelect ? tiendaSelect.value : 'No especificada';

    if (!usuarioId || !pin) {
        return Swal.fire('Error', 'Selecciona tu nombre y pon tu PIN.', 'warning');
    }

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId, pin: pin })
        });

        const result = await response.json();

        if (result.exito) {
            usuarioActivo = result.usuario;
            
            // Agregamos la tienda y la hora al perfil del usuario
            usuarioActivo.tienda = tiendaSeleccionada;
            usuarioActivo.horaLogin = new Date().toLocaleTimeString();
            
            // Guardamos todo junto en la memoria del navegador
            localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));
            
            // Ocultamos el login
            document.getElementById('pantalla-login').style.display = 'none';
            
            configurarInterfazPorRol();

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

// ==========================================
// FUNCIÓN PARA EDITAR PLANTILLAS GUARDADAS
// ==========================================
async function editarPlantilla(id) {
    try {
        Swal.fire({ title: 'Cargando diseño en el taller...', didOpen: () => Swal.showLoading() });
        
        const response = await fetch(`${API_URL}/api/creaciones`);
        const creaciones = await response.json();
        const plantilla = creaciones.find(c => c.id === id);

        if (!plantilla || !plantilla.config_json) {
            Swal.close();
            return Swal.fire('Aviso', 'Esta plantilla se guardó antes de la actualización y no se puede editar automáticamente. Solo las creadas a partir de hoy tienen esta función.', 'info');
        }

        const adn = typeof plantilla.config_json === 'string' ? JSON.parse(plantilla.config_json) : plantilla.config_json;

        // 1. Cerramos la vista de catálogo
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

        // 2. Abrimos el modal y disparamos la vista base
        if (plantilla.categoria.toLowerCase() === 'comedor') {
            openConfigComedor();
            if (adn['comedor-formato']) {
                document.getElementById('comedor-formato').value = adn['comedor-formato'];
                actualizarVistaComedor();
            }
        } else {
            const fotoResucitada = `${API_URL}/uploads/${plantilla.foto_url}`;
            openConfig(plantilla.nombre, fotoResucitada);
            if (adn['sofa-modelo']) {
                document.getElementById('sofa-modelo').value = adn['sofa-modelo'];
                actualizarVistaSofa();
            }
        }

        // 3. Esperamos un instante a que el HTML reaccione, y rellenamos todo
        setTimeout(() => {
            for (const [idElemento, valor] of Object.entries(adn)) {
                const el = document.getElementById(idElemento);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = valor;
                        if (el.onchange) el.onchange();
                    } else {
                        el.value = valor;
                    }
                }
            }
            
            Swal.close();
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'success', title: 'Diseño cargado y listo para modificar.' });
            
        }, 300);

    } catch (error) {
        console.error("Error al editar plantilla:", error);
        Swal.fire('Error', 'No se pudo conectar con el servidor para cargar el diseño.', 'error');
    }
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

    // === Tabla (desktop) ===
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
                <div style="font-size:11px; color:#94a3b8;">${v.vendedor || ''}</div>
            </td>
            <td style="padding:11px 14px; font-size:12px; color:#475569; max-width:180px; display:none;" class="col-extra">${(v.productos||'').substring(0,60)}${(v.productos||'').length>60?'...':''}</td>
            <td style="padding:11px 14px; font-weight:800; color:#10b981;">S/ ${parseFloat(v.total||0).toFixed(2)}</td>
            <td style="padding:11px 14px; color:#0f172a;">S/ ${parseFloat(v.adelanto||0).toFixed(2)}</td>
            <td style="padding:11px 14px; color:#ef4444; font-weight:700; display:none;" class="col-extra">S/ ${parseFloat(v.saldo||0).toFixed(2)}</td>
            <td style="padding:11px 14px;">${ec(v)}</td>
            <td style="padding:11px 14px; font-size:12px; color:#64748b;">${v.fecha_entrega || '—'}</td>
            <td style="padding:11px 14px; white-space:nowrap; display:flex; gap:6px; align-items:center;">
                <button onclick="verDetalleContrato('${v.codigo}')"
                        style="background:#0f172a; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700;">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
                ${(usuarioActivo?.rol === 'Vendedor' && v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
                <button onclick="abrirModalCambioPrecio('${v.codigo}', ${v.total})"
                        title="Proponer cambio de precio"
                        style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700;">
                    <i class="fa-solid fa-tag"></i>
                </button>` : ''}
            </td>
        </tr>`).join('');

    // === Cards (mobile) ===
    cards.innerHTML = lista.map(v => `
        <div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <span style="font-weight:900; font-size:15px; color:#d4af37;">#${v.codigo}</span>
                ${ec(v)}
            </div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${v.cliente}</div>
            <div style="font-size:12px; color:#64748b; margin-bottom:10px;">${v.vendedor || ''} · Entrega: ${v.fecha_entrega || '—'}</div>
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
    cargarUsuariosLogin();   // llena el dropdown de usuarios en el login
    verificarSesionExistente(); // oculta el login si ya hay sesión guardada
    init();                  // carga catálogo + materiales y rutea según sesión
});