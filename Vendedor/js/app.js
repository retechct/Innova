// ─── Helper: fetch con token JWT automático ──────────────────
// A3: Maneja FormData correctamente (no sobreescribe Content-Type)
// FIX-1: Token en localStorage para que persista al recargar la página.
// FIX-JWT: Intercepta 401 → intenta refresh automático → si falla, avisa.
let _refreshEnCurso = false;   // evita bucles si el refresh también da 401

async function _intentarRefresh() {
    const refreshToken = localStorage.getItem('innova_refresh_token');
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${refreshToken}` }
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.access) {
            localStorage.setItem('innova_token', data.access);
            return true;
        }
    } catch(e) {}
    return false;
}

function apiFetch(url, options = {}) {
    const token = localStorage.getItem('innova_token');
    const esFormData = options.body instanceof FormData;
    const fetchConToken = (tk) => fetch(url, {
        ...options,
        headers: {
            // Si es FormData, NO poner Content-Type: el browser lo pone con el boundary correcto
            ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {}),
            ...(tk ? { 'Authorization': `Bearer ${tk}` } : {})
        }
    });

    return fetchConToken(token).then(async res => {
        if (res.status !== 401 || _refreshEnCurso) return res;

        _refreshEnCurso = true;
        const renovado = await _intentarRefresh();
        _refreshEnCurso = false;

        if (renovado) {
            return fetchConToken(localStorage.getItem('innova_token'));
        }

        // Refresh fallido → sesión expirada, forzar re-login
        localStorage.removeItem('innova_token');
        localStorage.removeItem('innova_refresh_token');
        Swal.fire({
            background: '#14100a', color: '#f5f0e8', icon: 'warning',
            title: 'Sesión expirada',
            text: 'Tu sesión ha caducado. Por favor vuelve a iniciar sesión.',
            confirmButtonColor: '#c9a84c', confirmButtonText: 'Entendido'
        }).then(() => location.reload());

        return res;
    });
}
// ─────────────────────────────────────────────────────────────// === MÓDULO: App principal, init, vistas, sesión ===
async function init() {
    try {
        const [catRes, matRes] = await Promise.all([
            apiFetch(`${API_URL}/api/catalogo`),
            apiFetch(`${API_URL}/api/materiales/listas`)
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
            // ROLES_ERP viene de config.js — no redeclarar aquí
            if (!ROLES_ERP.includes(usuarioActivo.rol)) {
                return; // Se queda en el landing
            }

            configurarInterfazPorRol();
            mostrarUsuarioEnHeader();
            document.getElementById('pantalla-login').style.display = 'none';
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER' || usuarioActivo.rol === 'Chofer') {
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

    // Ítems exclusivos de Vendedor / Admin
    const btnStock       = document.getElementById('btn-menu-stock');
    const btnCatalogo    = document.getElementById('btn-menu-catalogo');
    const btnContrato    = document.getElementById('btn-menu-contrato');
    const btnPedidos     = document.getElementById('btn-menu-pedidos');
    const btnCreaciones  = document.getElementById('btn-menu-creaciones');

    // Ocultar todo por defecto
    [btnTaller, btnStockProduccion, btnInventario, btnInvTienda, btnGestor, btnAddProd,
    btnLogistica, btnUsuarios, btnProv, btnContratos,
    btnStock, btnCatalogo, btnContrato, btnPedidos, btnCreaciones
    ].forEach(b => { if (b) b.style.display = 'none'; });

    const rol = usuarioActivo.rol;
    const esAdmin       = rol === 'Admin';
    const esVendedor    = rol === 'Vendedor';
    const esJefeTaller  = ['Jefe_Taller', 'JEFE_TALLER'].includes(rol);
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
        const res = await apiFetch(`${API_URL}/api/mis-ventas/${idVendedor}`);
        const data = await res.json();
        
        if (data.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:40px;">No hay pedidos registrados.</p>`;
            return;
        }

        container.innerHTML = data.map(v => `
            <div class="pedido-card" onclick="verSeguimientoVendedor('${v.codigo}')" style="background:white; padding:15px; border-radius:10px; margin-bottom:10px; border:1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;">
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
                    <button onclick="event.stopPropagation(); abrirDetallePedido('${v.codigo}')" style="flex:1; background:#0f172a; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-eye"></i> Ver Ficha
                    </button>
                    <button onclick="event.stopPropagation(); verSeguimientoVendedor('${v.codigo}')" style="flex:1; background:#3b82f6; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-list-check"></i> Progreso
                    </button>
                    ${(v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
                    <button onclick="event.stopPropagation(); abrirModalCambioPrecio('${v.codigo}', ${v.monto_total})" style="flex:1; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-tag"></i> Cambiar Precio
                    </button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</p>`;
    }
}


async function verSeguimientoVendedor(codigo) {
    try {
        Swal.fire({ title: 'Cargando progreso...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/seguimiento/pedido/${codigo}`);
        const d = await res.json();
        
        if (!res.ok || d.error) {
            return Swal.fire('Error', d.error || 'No se pudo cargar el progreso.', 'error');
        }

        const pct = d.estado.raw === 'Entregado' ? 100 : (d.progreso?.porcentaje || 0);
        
        function _formatArea(area) {
            const nombres = {
                'CORTE_Y_CONTROL_TELAS':    'Corte de telas',
                'TAPICERIA_SOFAS':          'Tapicería sofás',
                'TAPICERIA_SILLAS':         'Tapicería sillas',
                'ESTRUCTURAS_MUEBLES':      'Estructuras',
                'ESTRUCTURAS_SILLAS':       'Estructuras sillas',
                'ARMADO_COJINES':           'Cojines',
                'PREPARACION_PATAS_ZOCALO': 'Patas y zócalo',
                'TABLEROS_Y_PIEDRAS':       'Tableros',
                'DESPACHO_CENTRAL':         'Despacho',
            };
            return nombres[area] || area.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
        }

        const areasHTML = (d.areas || []).length > 0 ? `
            <div style="margin-top: 15px;">
                <div style="font-size:12px; font-weight:bold; color:gray; margin-bottom:10px;">AVANCE POR ÁREA</div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${d.areas.map(a => {
                        const trabajadores = a.trabajadores && a.trabajadores.length > 0 ? a.trabajadores.join(', ') : 'Sin asignar';
                        const colorBarra = a.listo ? '#22c55e' : (a.porcentaje > 0 ? '#3b82f6' : '#e2e8f0');
                        return `
                        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <strong style="font-size:12px; color:#1e293b;">${_formatArea(a.area)}</strong>
                                <span style="font-size:11px; font-weight:bold; color:${a.listo ? '#166534' : '#1e40af'};">${a.listo ? '✓ Listo' : a.porcentaje + '%'}</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-bottom:8px;">
                                <i class="fa-solid fa-user-gear"></i> ${trabajadores}
                            </div>
                            <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                                <div style="width:${a.porcentaje}%; height:100%; background:${colorBarra}; transition:0.3s;"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '<p style="font-size:12px; color:gray; margin-top:10px;">Sin áreas de producción registradas.</p>';

        Swal.fire({
            title: `Seguimiento #${codigo}`,
            html: `
                <div style="text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:14px; font-weight:800;">${d.cliente}</span>
                        <span style="font-size:11px; background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:4px; font-weight:bold;">${d.estado.label}</span>
                    </div>
                    
                    <div style="font-size:12px; color:gray; margin-bottom:15px;">
                        Entrega estimada: <b>${d.fecha_entrega}</b>
                    </div>

                    <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO GLOBAL: ${pct}%</div>
                    <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                    </div>

                    ${areasHTML}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a',
            width: '450px'
        });

    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* ================================================================= */
/* --- LOGÍSTICA EXTERNA (PROCURA) --- */
/* ================================================================= */
// ── Helper PDF: fuerza descarga en Cloudinary para evitar error 401
// del visor PDF de Chrome (chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai)
function _abrirPDF(urlPdf) {
    if (!urlPdf) return;
    let url = urlPdf;
    if (url.includes('cloudinary.com') && !url.includes('fl_attachment')) {
        url = url.replace('/upload/', '/upload/fl_attachment/');
    }
    window.open(url, '_blank');
}

// ── Helper: normalizar número peruano para wa.me ──────────────────────────────
function _normalizarTelWA(raw) {
    if (!raw) return '';
    // Quitar espacios, guiones, paréntesis, puntos
    let tel = String(raw).replace(/[\s\-\(\)\.]/g, '');
    // Quitar el + inicial si lo tiene
    if (tel.startsWith('+')) tel = tel.slice(1);
    // Si ya empieza con 51 y tiene 11 dígitos → correcto
    if (/^51\d{9}$/.test(tel)) return tel;
    // Si empieza con 51 y tiene más o menos → limpiar el prefijo y volver a agregar
    if (tel.startsWith('51')) tel = tel.slice(2);
    // Quitar ceros al inicio que sobren
    tel = tel.replace(/^0+/, '');
    // Solo números peruanos de 9 dígitos son válidos
    if (!/^\d{9}$/.test(tel)) return '';
    return '51' + tel;
}

async function cargarLogisticaExterna() {
    const tabla = document.getElementById('tabla-logistica-externa');
    if (!tabla) return;
    tabla.innerHTML = `<div style="text-align:center;padding:30px;color:#64748b;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:10px;font-weight:600;">Cargando requerimientos...</p>
    </div>`;

    try {
        const [resLog, resProv] = await Promise.all([
            apiFetch(`${API_URL}/api/logistica`),
            apiFetch(`${API_URL}/api/proveedores`)
        ]);
        const items       = await resLog.json();
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
            'POR_PEDIR':           { bg: '#fef9c3', color: '#854d0e' },
            'Pendiente':           { bg: '#fef9c3', color: '#854d0e' },
            'Cotizado':            { bg: '#dbeafe', color: '#1e40af' },
            'Cotizacion Enviada':  { bg: '#e0f2fe', color: '#0369a1' },
            'Cotizacion Recibida': { bg: '#fef3c7', color: '#b45309' },
            'Confirmado':          { bg: '#dcfce7', color: '#166534' },
            'Orden Enviada':       { bg: '#f3e8ff', color: '#7e22ce' },
            'En Tránsito':         { bg: '#ede9fe', color: '#5b21b6' },
            'Pagado':              { bg: '#fef3c7', color: '#92400e' },
            'Recibido':            { bg: '#f0fdf4', color: '#15803d' },
            'Cancelado':           { bg: '#fee2e2', color: '#991b1b' },
        };

        const esAdmin = usuarioActivo && usuarioActivo.rol === 'Admin';
        // FIX RESPONSIVE: detectar móvil
        const esMobil = window.innerWidth < 700;

        let html = `
        <div style="display:flex;justify-content:space-between;margin-bottom:15px;align-items:center;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:16px;">Requerimientos</h3>
            <button onclick="abrirModalLote()" style="background:#25D366;color:white;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">
                <i class="fa-solid fa-list-check"></i> Cotizar por lote
            </button>
        </div>`;

        if (esMobil) {
            // ── VISTA MÓVIL: Cards apiladas ──────────────────────────
            html += `<div style="display:flex;flex-direction:column;gap:12px;">`;
            items.forEach(item => {
                const c = coloresEstado[item.estado] || { bg: '#f1f5f9', color: '#475569' };
                const fotoHTML = item.foto_url
                    ? `<img src="${item.foto_url}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
                           style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0;">`
                    : `<div style="width:56px;height:56px;border-radius:8px;background:#f1f5f9;display:flex;
                              align-items:center;justify-content:center;flex-shrink:0;font-size:22px;border:1px solid #e2e8f0;">🪵</div>`;
                html += `
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex;gap:12px;margin-bottom:10px;">
                        ${fotoHTML}
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:900;font-size:14px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.insumo}</div>
                            ${item.sku ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">${item.sku}</div>` : ''}
                            ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.detalle_insumo}</div>` : ''}
                            <div style="margin-top:4px;">
                                <span style="background:${c.bg};color:${c.color};padding:3px 9px;border-radius:20px;font-weight:800;font-size:10px;">${item.estado}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px;">
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Pedido</div>
                            <div style="font-weight:800;color:#d97706;">#${item.codigo_venta}</div>
                        </div>
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Proveedor</div>
                            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.proveedor}</div>
                        </div>
                        ${item.precio_cotizado ? `
                        <div style="background:#fef9c3;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;">Precio</div>
                            <div style="font-weight:900;color:#92400e;">S/ ${item.precio_cotizado.toFixed(2)}</div>
                        </div>` : ''}
                        ${item.fecha_entrega_proveedor ? `
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">F. Entrega</div>
                            <div style="font-weight:600;">${item.fecha_entrega_proveedor}</div>
                        </div>` : ''}
                        ${item.cantidad ? `
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Cantidad</div>
                            <div style="font-weight:600;">${item.cantidad} ${item.unidad || ''}</div>
                        </div>` : ''}
                    </div>
                    ${esAdmin ? `
                    <button onclick="_abrirEditarLogistica(${JSON.stringify(item).replace(/"/g,'&quot;')}, ${JSON.stringify(proveedores).replace(/"/g,'&quot;')})"
                            style="width:100%;background:#0f172a;color:white;border:none;
                                   padding:9px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">
                        <i class="fa-solid fa-pen"></i> Gestionar requerimiento
                    </button>` : ''}
                </div>`;
            });
            html += `</div>`;

        } else {
            // ── VISTA ESCRITORIO: Tabla ───────────────────────────────
            html += `
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
                const c  = coloresEstado[item.estado] || { bg: '#f1f5f9', color: '#475569' };
                const bg = idx % 2 === 0 ? 'white' : '#fafbfc';
                // FIX foto: ícono 🪵 en lugar de 📦 cuando no hay foto
                const fotoHTML = item.foto_url
                    ? `<img src="${item.foto_url}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
                           style="width:42px;height:42px;object-fit:cover;border-radius:6px;
                                  border:1px solid #e2e8f0;flex-shrink:0;">`
                    : `<div style="width:42px;height:42px;border-radius:6px;background:#f1f5f9;
                              display:flex;align-items:center;justify-content:center;
                              flex-shrink:0;font-size:18px;border:1px solid #e2e8f0;">🪵</div>`;
                html += `
                <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
                    onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${bg}'">
                    <td style="padding:12px 14px;">
                        <span style="font-weight:900;color:#d97706;">#${item.codigo_venta}</span>
                    </td>
                    <td style="padding:10px 14px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            ${fotoHTML}
                            <div style="min-width:0;">
                                <div style="font-weight:700;line-height:1.3;">${item.insumo}</div>
                                <div style="font-size:11px;color:#94a3b8;">${item.sku || '—'}</div>
                                ${item.detalle_insumo ? `<div style="font-size:10px;color:#64748b;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${item.detalle_insumo}</div>` : ''}
                                ${item.cantidad ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">${item.cantidad} ${item.unidad || ''}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td style="padding:12px 14px;">
                        <div style="color:#475569;">${item.proveedor}</div>
                        ${item.proveedor_informal ? `
                        <div style="font-size:11px;color:#64748b;margin-top:2px;">
                            <i class="fa-solid fa-phone" style="font-size:10px;"></i> ${item.proveedor_informal}
                        </div>` : ''}
                        ${item.tipo_gestion && item.tipo_gestion !== 'Externo' ? `
                        <span style="background:${item.tipo_gestion === 'Informal' ? '#fef9c3' : '#dcfce7'};
                            color:${item.tipo_gestion === 'Informal' ? '#854d0e' : '#166534'};
                            padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800;">
                            ${item.tipo_gestion === 'Informal' ? '📞 Informal' : '🔨 Interno'}
                        </span>` : ''}
                    </td>
                    <td style="padding:12px 10px;text-align:center;font-weight:800;color:#0f172a;">
                        ${item.precio_cotizado ? `S/ ${item.precio_cotizado.toFixed(2)}` : '<span style="color:#cbd5e1;">—</span>'}
                        ${item.url_comprobante_pago
                            ? `<br><a href="${item.url_comprobante_pago}" target="_blank"
                                  title="Ver comprobante de pago"
                                  style="font-size:10px;font-weight:700;color:#1d4ed8;text-decoration:none;display:inline-flex;align-items:center;gap:3px;margin-top:3px;">
                                  <i class="fa-solid fa-receipt"></i> Comprobante
                               </a>`
                            : ''
                        }
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

            html += `</tbody></table></div>`;
        }

        html += `
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
    // ── Determinar etapa del flujo para mostrar acciones correctas ──
    const estado = item.estado;

    // ETAPA 1 → Editar gestión del insumo (Externo / Informal / Interno)
    if (['POR_PEDIR', 'Pendiente'].includes(estado)) {
        const tipoActual = item.tipo_gestion || 'Externo';
        const opsProv = `<option value="">— Sin asignar —</option>` + proveedores.map(p =>
            `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre} (${p.especialidad})</option>`
        ).join('');

        // Bloque de foto + detalles del insumo desde el maestro
        const fotoHTML = item.foto_url
            ? `<img src="${item.foto_url}" onerror="this.style.display='none'"
                   style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0;">`
            : `<div style="width:72px;height:72px;border-radius:8px;background:#f1f5f9;display:flex;
                   align-items:center;justify-content:center;flex-shrink:0;font-size:22px;">📦</div>`;

        const { value: datos, isConfirmed } = await Swal.fire({
            title: `✏️ Editar insumo`,
            width: 540,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <!-- Info del insumo con foto -->
                    <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;
                                display:flex;gap:12px;align-items:center;">
                        ${fotoHTML}
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Insumo</div>
                            <div style="font-weight:900;font-size:15px;line-height:1.2;">${item.insumo}
                                <span style="color:#94a3b8;font-size:11px;font-weight:400;">${item.sku || ''}</span>
                            </div>
                            ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${item.detalle_insumo}</div>` : ''}
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">Pedido: <b style="color:#d97706;">#${item.codigo_venta}</b></div>
                        </div>
                    </div>

                    <!-- Cantidad y unidad -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Cantidad</label>
                            <input id="sl-cantidad" class="swal2-input" type="number" step="0.01" min="0"
                                value="${item.cantidad || ''}" placeholder="Ej: 3.5"
                                style="margin:0;width:100%;">
                        </div>
                        <div>
                            <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Unidad</label>
                            <select id="sl-unidad" class="swal2-input" style="margin:0;width:100%;">
                                <option value="">—</option>
                                ${['mts','und','planchas','kg','rollos','piezas','juegos'].map(u =>
                                    `<option value="${u}" ${item.unidad === u ? 'selected' : ''}>${u}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Tipo de gestión -->
                    <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;text-transform:uppercase;color:#475569;">¿Cómo se consigue este insumo?</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;" id="sl-tipo-btns">
                        ${[
                            { val:'Externo',  icon:'🏭', label:'Externo',  desc:'Proveedor formal con cotización' },
                            { val:'Informal', icon:'📞', label:'Informal', desc:'Jefe lo consigue por su cuenta' },
                            { val:'Interno',  icon:'🔨', label:'Interno',  desc:'Lo fabrica el taller' },
                        ].map(t => `
                            <label style="cursor:pointer;">
                                <input type="radio" name="tipo_gestion" value="${t.val}" ${tipoActual === t.val ? 'checked' : ''}
                                    style="display:none;" onchange="
                                        document.querySelectorAll('.tipo-btn').forEach(b => b.style.borderColor='#e2e8f0');
                                        this.closest('label').querySelector('.tipo-btn').style.borderColor='#3b82f6';
                                        document.getElementById('sl-prov-wrap').style.display = this.value === 'Externo' ? 'block' : 'none';
                                        document.getElementById('sl-nota-wrap').style.display = this.value === 'Externo' ? 'block' : 'none';
                                        document.getElementById('sl-informal-wrap').style.display = this.value === 'Informal' ? 'block' : 'none';
                                        document.getElementById('sl-interno-info').style.display = this.value === 'Interno' ? 'block' : 'none';
                                    ">
                                <div class="tipo-btn" style="border:2px solid ${tipoActual === t.val ? '#3b82f6' : '#e2e8f0'};
                                    border-radius:8px;padding:10px 8px;text-align:center;transition:border-color .15s;">
                                    <div style="font-size:20px;">${t.icon}</div>
                                    <div style="font-weight:800;font-size:12px;margin-top:2px;">${t.label}</div>
                                    <div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.3;">${t.desc}</div>
                                </div>
                            </label>`
                        ).join('')}
                    </div>

                    <!-- Proveedor formal (solo Externo) -->
                    <div id="sl-prov-wrap" style="display:${tipoActual === 'Externo' ? 'block' : 'none'};">
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Proveedor registrado (opcional)</label>
                        <select id="sl-prov" class="swal2-input" style="margin:0 0 12px;width:100%;">${opsProv}</select>
                    </div>

                    <!-- Nota (solo Externo) -->
                    <div id="sl-nota-wrap" style="display:${tipoActual === 'Externo' ? 'block' : 'none'};">
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Nota para el proveedor (opcional)</label>
                        <textarea id="sl-nota" class="swal2-textarea" placeholder="Ej: Necesitamos entrega urgente..." style="margin:0 0 4px;width:100%;font-size:13px;resize:vertical;min-height:60px;"></textarea>
                    </div>

                    <!-- Informal: nombre + celular libre -->
                    <div id="sl-informal-wrap" style="display:${tipoActual === 'Informal' ? 'block' : 'none'};">
                        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#854d0e;">
                            <b>Flujo informal:</b> El jefe consigue el material por su cuenta.
                            Registra con quién lo consigue y luego usa <b>"📦 Enviar al taller"</b>
                            cuando ya esté disponible para desbloquear producción.
                        </div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Proveedor / Contacto (nombre y celular)</label>
                        <input id="sl-informal-prov" class="swal2-input" type="text"
                            placeholder="Ej: Juan Pérez · 987654321"
                            value="${item.proveedor_informal || ''}"
                            style="margin:0;width:100%;">
                    </div>

                    <!-- Info Interno -->
                    <div id="sl-interno-info" style="display:${tipoActual === 'Interno' ? 'block' : 'none'};
                        background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:10px 12px;font-size:12px;color:#166534;">
                        <b>Fabricación interna:</b> El taller produce este insumo.
                        Marca como <b>"Recibido"</b> cuando esté listo para usar y los tickets se desbloquearán automáticamente.
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar y continuar →',
            cancelButtonText:  'Cancelar',
            confirmButtonColor: '#0f172a',
            preConfirm: () => {
                const tipo = document.querySelector('input[name="tipo_gestion"]:checked')?.value || 'Externo';
                return {
                    id:                  item.id,
                    tipo_gestion:        tipo,
                    proveedor_id:        tipo === 'Externo' ? (document.getElementById('sl-prov')?.value || null) : null,
                    cantidad:            document.getElementById('sl-cantidad')?.value || null,
                    unidad:              document.getElementById('sl-unidad')?.value || null,
                    nota:                document.getElementById('sl-nota')?.value?.trim() || null,
                    proveedor_informal:  tipo === 'Informal'
                                            ? (document.getElementById('sl-informal-prov')?.value?.trim() || null)
                                            : null,
                };
            }
        });
        if (!isConfirmed || !datos) return;

        try {
            // Guardar tipo_gestion, proveedor, cantidad, unidad, proveedor_informal
            const resSave = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id:                  datos.id,
                    tipo_gestion:        datos.tipo_gestion,
                    proveedor_id:        datos.proveedor_id || null,
                    cantidad:            datos.cantidad || null,
                    unidad:              datos.unidad || null,
                    proveedor_informal:  datos.proveedor_informal || null,
                })
            });
            const dSave = await resSave.json();
            if (dSave.error) throw new Error(dSave.error);

            // ── EXTERNO con proveedor: WhatsApp directo sin formulario online ──
            if (datos.tipo_gestion === 'Externo' && datos.proveedor_id) {
                // Marcar como Cotizacion Enviada
                await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, estado: 'Cotizacion Enviada' })
                });

                const provData = proveedores.find(p => p.id == datos.proveedor_id) || {};
                let tel = _normalizarTelWA(provData.telefono || '');

                const esTela = (item.unidad || '').toLowerCase() === 'mts' ||
                               (item.insumo  || '').toLowerCase().includes('tela');
                const msgWsp = [
                    `Hola *${provData.nombre || 'Proveedor'}* 👋, somos *Innova Möbili*.`,
                    ``,
                    `Necesitamos cotización del siguiente material:`,
                    ``,
                    `📦 *Material:* ${item.insumo}`,
                    ...(item.sku            ? [`🔖 *SKU:* ${item.sku}`]                                    : []),
                    ...(item.detalle_insumo ? [`🎨 *Detalle:* ${item.detalle_insumo}`]                     : []),
                    ...(esTela && datos.cantidad
                                            ? [`📐 *Metros requeridos:* ${datos.cantidad} mts`]            : []),
                    ...(!esTela && datos.cantidad
                                            ? [`🔢 *Cantidad:* ${datos.cantidad} ${datos.unidad || ''}`]   : []),
                    ...(item.foto_url       ? [`🔗 *Ref. visual:* ${item.foto_url}`]                       : []),
                    `📋 *Pedido:* #${item.codigo_venta}`,
                    ...(datos.nota          ? [`📝 *Nota:* ${datos.nota}`]                                 : []),
                    ``,
                    `Por favor respóndenos con el *precio por ${esTela ? 'metro' : 'unidad'}* y la *fecha de entrega*. Gracias 🙏`,
                ].join('\n');

                if (tel) {
                    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
                } else {
                    await Swal.fire({
                        icon: 'warning', title: 'Sin teléfono registrado',
                        html: `El proveedor <b>${provData.nombre || ''}</b> no tiene WhatsApp registrado.<br>
                               Agrégalo en la sección Proveedores para poder abrir WA automáticamente.`,
                        confirmButtonColor: '#0f172a',
                    });
                }
                cargarLogisticaExterna();
                return;
            }

            // ── EXTERNO sin proveedor aún: solo guardar ────────────────────
            if (datos.tipo_gestion === 'Externo' && !datos.proveedor_id) {
                Swal.fire({ icon:'success', title:'Guardado', text:'Asigna un proveedor más tarde para enviar la cotización.', timer:2200, showConfirmButton:false });
                cargarLogisticaExterna();
                return;
            }

            // ── INFORMAL: mostrar botón "Enviar al taller" ─────────────────
            if (datos.tipo_gestion === 'Informal') {
                const { isConfirmed: confirmarTaller } = await Swal.fire({
                    icon: 'info',
                    title: '📞 Insumo informal guardado',
                    html: `Cuando ya tengas el material listo, presiona <b>"Enviar al taller"</b> para desbloquear los tickets de producción.`,
                    confirmButtonText: '📦 Enviar al taller ahora',
                    showCancelButton: true,
                    cancelButtonText: 'Lo haré después',
                    confirmButtonColor: '#0f172a',
                });
                if (confirmarTaller) {
                    const resTaller = await apiFetch(`${API_URL}/api/logistica/${item.id}/enviar-al-taller`, { method: 'POST' });
                    const dTaller = await resTaller.json();
                    if (!resTaller.ok || !dTaller.exito) throw new Error(dTaller.error || 'Error al enviar al taller');
                    Swal.fire({ icon:'success', title:'¡Enviado al taller!', text: dTaller.mensaje, timer:2500, showConfirmButton:false });
                } else {
                    Swal.fire({ icon:'success', title:'Guardado', timer:1500, showConfirmButton:false });
                }
                cargarLogisticaExterna();
                return;
            }

            // ── INTERNO ────────────────────────────────────────────────────
            Swal.fire({ icon:'success', title:'Guardado como interno', text:'El taller fabricará este insumo.', timer:2000, showConfirmButton:false });
            cargarLogisticaExterna();

        } catch(e) { Swal.fire('Error', e.message, 'error'); }
        return;
    }

    // ETAPA 2 → Cotización Enviada: el proveedor respondió por WA — registrar manualmente
    if (estado === 'Cotizacion Enviada' || estado === 'Cotizacion Recibida') {
        const { isConfirmed, isDenied } = await Swal.fire({
            title: `⏳ Esperando cotización`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;
                                padding:10px 12px;margin-bottom:14px;font-size:12px;color:#0369a1;">
                        Solicitud enviada a <b>${item.proveedor}</b> por WhatsApp.
                        Cuando responda con el precio, regístralo aquí.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Insumo</div>
                            <div style="font-weight:800;">${item.insumo}</div>
                            ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;">${item.detalle_insumo}</div>` : ''}
                        </div>
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Pedido</div>
                            <div style="font-weight:800;color:#d97706;">#${item.codigo_venta}</div>
                        </div>
                        ${item.cantidad ? `
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Cantidad solicitada</div>
                            <div style="font-weight:700;">${item.cantidad} ${item.unidad || ''}</div>
                        </div>` : ''}
                    </div>
                    <div style="color:#64748b;font-size:12px;padding:8px 10px;background:#f8fafc;border-radius:6px;">
                        💬 Cuando el proveedor te confirme el precio por WhatsApp, usa
                        <b>"Registrar respuesta"</b> para ingresarlo. Si no ha visto el mensaje,
                        puedes reenviar el pedido por WhatsApp.
                    </div>
                </div>`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '✅ Registrar respuesta del proveedor',
            denyButtonText:    '📲 Reenviar pedido por WhatsApp',
            cancelButtonText:  'Cerrar',
            confirmButtonColor: '#166534',
            denyButtonColor:   '#0369a1',
        });

        if (isConfirmed) {
            await _registrarRespuestaProveedor(item);
        } else if (isDenied) {
            // Reenviar WhatsApp con el mismo mensaje limpio (sin link de formulario)
            // item.telefono_proveedor viene del backend; fallback a correo_proveedor si fuera un número
            const telRaw = item.telefono_proveedor || item.correo_proveedor || '';
            let tel = _normalizarTelWA(telRaw);
            const esTela = (item.unidad || '').toLowerCase() === 'mts' ||
                           (item.insumo  || '').toLowerCase().includes('tela');
            const msgWsp = [
                `Hola *${item.proveedor}* 👋, somos *Innova Möbili*.`,
                ``,
                `Te reenviamos nuestra solicitud de cotización:`,
                ``,
                `📦 *Material:* ${item.insumo}`,
                ...(item.sku            ? [`🔖 *SKU:* ${item.sku}`]                                   : []),
                ...(item.detalle_insumo ? [`🎨 *Detalle:* ${item.detalle_insumo}`]                    : []),
                ...(item.cantidad       ? [`📐 *Cantidad:* ${item.cantidad} ${item.unidad || ''}`]     : []),
                ...(item.foto_url       ? [`🔗 *Ref. visual:* ${item.foto_url}`]                      : []),
                `📋 *Pedido:* #${item.codigo_venta}`,
                ``,
                `Por favor dinos el *precio por ${esTela ? 'metro' : 'unidad'}* y la *fecha de entrega*. Gracias 🙏`,
            ].join('\n');

            if (tel) {
                window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
            } else {
                Swal.fire({ icon:'warning', title:'Sin teléfono', text:'El proveedor no tiene teléfono registrado.', confirmButtonColor:'#0f172a' });
            }
        }
        return;
    }

    // ETAPA 3 → Cotizado: revisar y aprobar para emitir Orden de Compra
    if (estado === 'Cotizado') {
        const { isConfirmed, isDenied } = await Swal.fire({
            title: `✅ Revisar Cotización`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#166534;">
                        <b>Paso 3 de 3:</b> El proveedor ya respondió. Revisa los datos y aprueba para generar la Orden de Compra.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                        <div style="background:#f8fafc;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#475569;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Proveedor</div>
                            <div style="font-weight:900;">${item.proveedor}</div>
                        </div>
                        <div style="background:#f8fafc;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#475569;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Insumo</div>
                            <div style="font-weight:900;">${item.insumo}</div>
                        </div>
                        <div style="background:#fef9c3;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#854d0e;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Precio cotizado</div>
                            <div style="font-weight:900;font-size:18px;color:#854d0e;">S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</div>
                        </div>
                        <div style="background:#fef9c3;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#854d0e;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Fecha de entrega</div>
                            <div style="font-weight:900;font-size:14px;color:#854d0e;">${item.fecha_entrega_proveedor || '—'}</div>
                        </div>
                    </div>
                    <div style="color:#64748b;font-size:12px;">Al aprobar, se genera la <b>Orden de Compra</b> y se notifica al proveedor.</div>
                </div>`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '🛒 Aprobar y generar Orden de Compra',
            denyButtonText:    '✏️ Editar cotización',
            cancelButtonText:  'Cerrar',
            confirmButtonColor: '#166534',
            denyButtonColor:   '#0369a1',
        });

        if (isConfirmed) {
            try {
                Swal.fire({ title: 'Generando Orden de Compra...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                const resOC = await apiFetch(`${API_URL}/api/logistica/${item.id}/generar-orden`, {
                    method: 'POST'
                });
                const dOC = await resOC.json();
                if (!resOC.ok || !dOC.exito) throw new Error(dOC.error || 'No se pudo generar la OC');

                Swal.close();

                // Construir número de WhatsApp
                let tel = _normalizarTelWA(dOC.telefono || item.telefono_proveedor || '');

                const msgOC = [
                    `Hola *${dOC.proveedor || item.proveedor}* 👋, somos *Innova Möbili*.`,
                    ``,
                    `Le comunicamos que hemos *aprobado su cotización* y adjuntamos la`,
                    `*Orden de Compra oficial* para su referencia:`,
                    ``,
                    `📦 *Material:* ${item.insumo}${item.sku ? ` (${item.sku})` : ''}`,
                    `💰 *Precio acordado:* S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}`,
                    `📅 *Fecha de entrega pactada:* ${item.fecha_entrega_proveedor || 'Por confirmar'}`,
                    `📋 *Ref. pedido:* ${item.codigo_venta}`,
                    ``,
                    `📄 *Orden de Compra (PDF):*`,
                    `👉 ${dOC.url_pdf}`,
                    ``,
                    `Por favor confirme la recepción de este documento. Gracias 🙏`,
                    ``,
                    `_Innova Möbili — Área de Compras_`,
                ].join('\n');

                // Mostrar confirmación con preview y botón abrir WhatsApp
                const { isConfirmed: abrirWsp } = await Swal.fire({
                    icon: 'success',
                    title: '¡Orden de Compra generada!',
                    html: `
                        <div style="text-align:left;font-size:13px;">
                            <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;
                                        padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;">
                                El PDF fue generado y subido correctamente.
                                ${dOC.numero_oc ? `<br><b>N° OC: ${dOC.numero_oc}</b>` : ''}
                            </div>
                            <div style="margin-bottom:10px;">
                                <a href="#" onclick="_abrirPDF('${dOC.url_pdf}');return false;"
                                   style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;
                                          border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;
                                          font-size:12px;font-weight:700;color:#0f172a;text-decoration:none;">
                                    📄 Ver PDF de la Orden de Compra
                                </a>
                            </div>
                            ${tel ? `<div style="color:#64748b;font-size:12px;">
                                ¿Deseas enviar la OC al proveedor por WhatsApp ahora?
                            </div>` : `<div style="background:#fef9c3;border-radius:6px;padding:8px 12px;
                                font-size:12px;color:#854d0e;">
                                El proveedor no tiene teléfono registrado. Puedes copiar el link del PDF y enviarlo manualmente.
                            </div>`}
                        </div>`,
                    showCancelButton: true,
                    confirmButtonText: tel ? '📲 Enviar por WhatsApp' : 'Cerrar',
                    cancelButtonText: 'Cerrar',
                    confirmButtonColor: tel ? '#25D366' : '#0f172a',
                    showConfirmButton: true,
                });

                if (abrirWsp && tel) {
                    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgOC)}`, '_blank');
                }

                cargarLogisticaExterna();
            } catch(e) { Swal.fire('Error', e.message, 'error'); }
        } else if (isDenied) {
            await _ingresarCotizacionManual(item);
        }
        return;
    }

    // ETAPA 4 → Orden Enviada / En Tránsito: marcar recibido o actualizar estado
    if (['Orden Enviada', 'En Tránsito', 'Confirmado', 'Pagado'].includes(estado)) {
        const opsEstado = ['Orden Enviada','Confirmado','En Tránsito','Pagado','Recibido','Cancelado']
            .map(e => `<option value="${e}" ${e === estado ? 'selected' : ''}>${e}</option>`).join('');

        const tienePago = !!item.url_comprobante_pago;

        const { value: datos, isConfirmed } = await Swal.fire({
            title: `📦 Actualizar estado`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#f3e8ff;border:1px solid #d8b4fe;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#7e22ce;">
                        Orden enviada a <b>${item.proveedor}</b>. Actualiza el estado según el avance.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                        <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Precio acordado</span><br><b style="font-size:16px;">S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</b></div>
                        <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">F. entrega pactada</span><br><b>${item.fecha_entrega_proveedor || '—'}</b></div>
                    </div>
                    <label style="font-weight:700;display:block;margin-bottom:4px;">Nuevo estado</label>
                    <select id="sl-estado" class="swal2-input" style="margin:0 0 14px;width:100%;"
                        onchange="
                            const v = this.value;
                            document.getElementById('bloque-voucher').style.display = v === 'Pagado' ? 'block' : 'none';
                        "
                    >${opsEstado}</select>

                    <!-- Bloque voucher: visible solo si se elige Pagado -->
                    <div id="bloque-voucher" style="display:${estado === 'Pagado' ? 'block' : 'none'};">
                        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                                    padding:10px 12px;margin-bottom:10px;font-size:12px;color:#854d0e;">
                            <b>Registrar pago al proveedor</b> — Adjunta el comprobante (foto o PDF).
                            ${tienePago ? `<br><a href="${item.url_comprobante_pago}" target="_blank"
                                style="color:#1d4ed8;font-weight:700;">📄 Ver comprobante anterior</a>` : ''}
                        </div>
                        <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">
                            Comprobante de pago ${tienePago ? '(reemplazar)' : '*'}
                        </label>
                        <div style="display:flex;gap:8px;margin-bottom:6px;">
                            <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:9px 6px;
                                          border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:5px;">
                                📷 Tomar foto
                                <input type="file" id="inp-voucher-cam" accept="image/*" capture="environment"
                                       style="display:none;" onchange="_previewVoucher(this)">
                            </label>
                            <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:9px 6px;
                                          border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:5px;">
                                📁 Seleccionar archivo
                                <input type="file" id="inp-voucher" accept="image/*,application/pdf"
                                       style="display:none;" onchange="_previewVoucher(this)">
                            </label>
                        </div>
                        <div id="voucher-preview" style="margin-top:8px;display:none;">
                            <img id="voucher-img" src="" alt="preview"
                                 style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;object-fit:contain;">
                            <div id="voucher-pdf-label" style="display:none;background:#f1f5f9;border-radius:6px;
                                 padding:8px 12px;font-size:12px;font-weight:700;color:#475569;">
                                📄 <span id="voucher-pdf-nombre"></span>
                            </div>
                        </div>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText:  'Cancelar',
            confirmButtonColor: '#7e22ce',
            preConfirm: () => {
                const nuevoEstado = document.getElementById('sl-estado').value;
                const archivoCam = document.getElementById('inp-voucher-cam')?.files[0] || null;
                const archivoGal = document.getElementById('inp-voucher')?.files[0] || null;
                const archivo = archivoCam || archivoGal;
                if (nuevoEstado === 'Pagado' && !archivo && !tienePago) {
                    Swal.showValidationMessage('Adjunta el comprobante de pago para continuar.');
                    return false;
                }
                return { id: item.id, estado: nuevoEstado, archivo };
            }
        });
        if (!isConfirmed || !datos) return;

        try {
            // Si el estado es Pagado y hay archivo nuevo → subir voucher primero
            if (datos.estado === 'Pagado' && datos.archivo) {
                Swal.fire({ title: 'Subiendo comprobante...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const fd = new FormData();
                fd.append('comprobante', datos.archivo);
                const resPago = await apiFetch(`${API_URL}/api/logistica/${item.id}/registrar-pago`, {
                    method: 'POST',
                    body: fd,
                });
                const dPago = await resPago.json();
                Swal.close();
                if (!resPago.ok || !dPago.exito) throw new Error(dPago.error || 'Error al subir el comprobante');
                Swal.fire({
                    icon: 'success',
                    title: '💳 Pago registrado',
                    html: `El comprobante fue subido correctamente.<br>
                           <a href="${dPago.url}" target="_blank"
                              style="color:#1d4ed8;font-weight:700;font-size:13px;">📄 Ver comprobante</a>`,
                    timer: 3000,
                    showConfirmButton: false,
                });
                cargarLogisticaExterna();
                return;
            }

            // Para cualquier otro estado → actualizar normalmente
            const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: datos.id, estado: datos.estado })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            const msg = datos.estado === 'Recibido'
                ? '¡Material recibido! Los tickets relacionados fueron desbloqueados.'
                : '¡Estado actualizado!';
            Swal.fire({ icon: 'success', title: msg, timer: 2000, showConfirmButton: false });
            cargarLogisticaExterna();
        } catch(e) { Swal.fire('Error', e.message, 'error'); }
        return;
    }

    // ETAPA FINAL → Recibido / Cancelado: solo lectura con opción de cancelar
    const opsEstadoFinal = ['Recibido','Cancelado']
        .map(e => `<option value="${e}" ${e === estado ? 'selected' : ''}>${e}</option>`).join('');

    const { value: datos, isConfirmed } = await Swal.fire({
        title: `${estado === 'Recibido' ? '✅' : '❌'} ${estado}`,
        html: `
            <div style="text-align:left;font-size:13px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Proveedor</span><br><b>${item.proveedor}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Insumo</span><br><b>${item.insumo}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Precio final</span><br><b>S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Entrega</span><br><b>${item.fecha_entrega_proveedor || '—'}</b></div>
                </div>
                <label style="font-weight:700;display:block;margin-bottom:4px;">Cambiar estado</label>
                <select id="sl-estado" class="swal2-input" style="margin:0;width:100%;">${opsEstadoFinal}</select>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText:  'Cerrar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => ({ id: item.id, estado: document.getElementById('sl-estado').value })
    });
    if (!isConfirmed || !datos) return;

    try {
        const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        Swal.fire({ icon:'success', title:'Actualizado', timer:1500, showConfirmButton:false });
        cargarLogisticaExterna();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

// Helper: ingresar cotización manualmente (cuando el proveedor confirma por teléfono/WhatsApp)
// Renombrado y mejorado: registrar respuesta del proveedor (precio + fecha + foto opcional)
async function _registrarRespuestaProveedor(item) {
    const { value: datos, isConfirmed } = await Swal.fire({
        title: `✅ Registrar respuesta del proveedor`,
        width: 500,
        html: `
            <div style="text-align:left;font-size:13px;">
                <!-- Resumen del insumo -->
                <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin-bottom:14px;
                            display:flex;gap:10px;align-items:center;">
                    ${item.foto_url
                        ? `<img src="${item.foto_url}" id="img-insumo-header"
                               style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;"
                               onerror="this.style.display='none';var fb=document.getElementById('icon-insumo-fb');if(fb)fb.style.display='flex';">
                           <div id="icon-insumo-fb" style="display:none;width:52px;height:52px;border-radius:6px;background:#f1f5f9;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>`
                        : `<div style="width:52px;height:52px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>`}
                    <div>
                        <div style="font-weight:800;font-size:14px;">${item.insumo}</div>
                        ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;">${item.detalle_insumo}</div>` : ''}
                        <div style="font-size:11px;color:#d97706;font-weight:700;">Proveedor: ${item.proveedor}</div>
                    </div>
                </div>

                <!-- Precio y fecha -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">Precio total (S/) *</label>
                        <input id="sl-precio" class="swal2-input" type="number" step="0.01" min="0.01"
                            placeholder="0.00" value="${item.precio_cotizado || ''}"
                            style="margin:0;width:100%;">
                    </div>
                    <div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">Fecha de entrega *</label>
                        <input id="sl-fecha" class="swal2-input" type="date"
                            value="${item.fecha_entrega_proveedor
                                ? item.fecha_entrega_proveedor.split('/').reverse().join('-') : ''}"
                            style="margin:0;width:100%;">
                    </div>
                </div>

                <!-- Notas del proveedor -->
                <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                              text-transform:uppercase;color:#475569;">Notas / condiciones (opcional)</label>
                <textarea id="sl-notas" class="swal2-textarea"
                    placeholder="Ej: precio por metro, incluye flete, etc."
                    style="margin:0 0 12px;width:100%;font-size:12px;min-height:55px;resize:vertical;"
                >${item.notas_proveedor || ''}</textarea>

                <!-- Adjuntar cotización (foto o PDF del WA) -->
                <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;
                              text-transform:uppercase;color:#475569;">
                    Adjuntar cotización (foto o PDF, opcional)
                </label>
                <div style="display:flex;gap:8px;margin-bottom:6px;">
                    <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:9px 6px;
                                  border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                  align-items:center;justify-content:center;gap:5px;">
                        📷 Tomar foto
                        <input type="file" id="inp-cotizacion-cam" accept="image/*" capture="environment"
                               style="display:none;" onchange="_previewCotizacion(this)">
                    </label>
                    <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:9px 6px;
                                  border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                  align-items:center;justify-content:center;gap:5px;">
                        📁 Seleccionar archivo
                        <input type="file" id="inp-cotizacion" accept="image/*,application/pdf"
                               style="display:none;" onchange="_previewCotizacion(this)">
                    </label>
                </div>
                <div id="cot-preview" style="margin-top:6px;display:none;">
                    <img id="cot-img" src="" alt="preview"
                         style="max-height:100px;border-radius:6px;border:1px solid #e2e8f0;">
                    <div id="cot-pdf-label" style="display:none;background:#f1f5f9;border-radius:6px;
                         padding:8px 12px;font-size:12px;font-weight:700;color:#475569;">
                        📄 <span id="cot-pdf-nombre"></span>
                    </div>
                </div>
                ${item.url_cotizacion_adjunta
                    ? `<div style="margin-top:6px;font-size:11px;">
                           📎 Ya hay una cotización adjunta:
                           <a href="${item.url_cotizacion_adjunta}" target="_blank"
                              style="color:#1d4ed8;font-weight:700;">Ver archivo</a>
                       </div>`
                    : ''}
            </div>`,
        showCancelButton: true,
        confirmButtonText: '💾 Guardar cotización',
        cancelButtonText:  'Cancelar',
        confirmButtonColor: '#166534',
        preConfirm: () => {
            const precio = document.getElementById('sl-precio').value;
            const fecha  = document.getElementById('sl-fecha').value;
            if (!precio || parseFloat(precio) <= 0) { Swal.showValidationMessage('Ingresa un precio válido'); return false; }
            if (!fecha) { Swal.showValidationMessage('Ingresa la fecha de entrega'); return false; }
            // Tomar el archivo de whichever input fue usado (cámara o galería)
            const archivoCam = document.getElementById('inp-cotizacion-cam')?.files[0] || null;
            const archivoGal = document.getElementById('inp-cotizacion')?.files[0] || null;
            return {
                precio,
                fecha,
                notas:   document.getElementById('sl-notas').value.trim(),
                archivo: archivoCam || archivoGal,
            };
        }
    });
    if (!isConfirmed || !datos) return;

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Si hay archivo adjunto → subirlo primero como voucher de cotización
        let url_cotizacion = null;
        if (datos.archivo) {
            const fd = new FormData();
            fd.append('archivo', datos.archivo);
            const resUp = await apiFetch(`${API_URL}/api/upload-voucher`, { method: 'POST', body: fd });
            const dUp = await resUp.json();
            if (dUp.url) url_cotizacion = dUp.url;
        }

        // Guardar precio, fecha, notas y marcar como Cotizado
        const payload = {
            id:                      item.id,
            precio_cotizado:         datos.precio,
            fecha_entrega_proveedor: datos.fecha,
            estado:                  'Cotizado',
        };
        if (datos.notas)       payload.notas_proveedor       = datos.notas;
        if (url_cotizacion)    payload.url_cotizacion_adjunta = url_cotizacion;

        const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        Swal.close();
        if (d.error) throw new Error(d.error);

        Swal.fire({
            icon: 'success',
            title: '¡Cotización registrada!',
            html: `Precio: <b>S/ ${parseFloat(datos.precio).toFixed(2)}</b><br>
                   ${url_cotizacion ? `📎 <a href="${url_cotizacion}" target="_blank" style="color:#1d4ed8;">Ver cotización adjunta</a><br>` : ''}
                   Ahora puedes revisar y aprobar la Orden de Compra.`,
            timer: 3000,
            showConfirmButton: false,
        });
        cargarLogisticaExterna();
    } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}

// Alias para compatibilidad con ETAPA 3 que aún lo referencia
async function _ingresarCotizacionManual(item) {
    return _registrarRespuestaProveedor(item);
}

/**
 * _previewCotizacion — muestra preview inteligente al seleccionar foto o PDF.
 * Funciona con ambos inputs (cámara y galería/archivo).
 * Se llama con onchange="..." directamente en el HTML del Swal.
 */
/**
 * _previewVoucher — igual que _previewCotizacion pero para el comprobante de pago.
 */
function _previewVoucher(inputEl) {
    const file = inputEl?.files[0];
    if (!file) return;
    const previewDiv = document.getElementById('voucher-preview');
    const imgEl      = document.getElementById('voucher-img');
    const pdfLabel   = document.getElementById('voucher-pdf-label');
    const pdfNombre  = document.getElementById('voucher-pdf-nombre');
    if (!previewDiv) return;

    if (file.type.startsWith('image/')) {
        if (pdfLabel) pdfLabel.style.display = 'none';
        if (imgEl)    imgEl.style.display = 'block';
        const reader = new FileReader();
        reader.onload = e => {
            imgEl.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        if (imgEl)    { imgEl.style.display = 'none'; imgEl.src = ''; }
        if (pdfLabel) pdfLabel.style.display = 'block';
        if (pdfNombre) pdfNombre.textContent = file.name;
        previewDiv.style.display = 'block';
    }
}

function _previewCotizacion(inputEl) {
    const file = inputEl?.files[0];
    if (!file) return;
    const previewDiv  = document.getElementById('cot-preview');
    const imgEl       = document.getElementById('cot-img');
    const pdfLabel    = document.getElementById('cot-pdf-label');
    const pdfNombre   = document.getElementById('cot-pdf-nombre');
    if (!previewDiv) return;

    if (file.type.startsWith('image/')) {
        // Mostrar imagen, ocultar etiqueta PDF
        if (pdfLabel) pdfLabel.style.display = 'none';
        if (imgEl)    imgEl.style.display = 'block';
        const reader = new FileReader();
        reader.onload = e => {
            imgEl.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        // PDF u otro: mostrar nombre, ocultar img para no romper layout
        if (imgEl)    { imgEl.style.display = 'none'; imgEl.src = ''; }
        if (pdfLabel) pdfLabel.style.display = 'block';
        if (pdfNombre) pdfNombre.textContent = file.name;
        previewDiv.style.display = 'block';
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
    };

    // Restaurar el header estático si veníamos de inv-tienda
    const mainTitleContainer = document.querySelector('main .view-title-container');
    if (mainTitleContainer) mainTitleContainer.style.display = '';

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
        if (typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'stock_produccion') {
            filtroAdminTaller = 'pendientes';
        }
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
        mostrar('view-taller');
        cargarTicketsTaller();
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
        const resSedes = await apiFetch(`${API_URL}/api/sedes`);
        const sedes = await resSedes.json();
        const selectSede = document.getElementById('login-tienda');
        
        if (selectSede) {
            selectSede.innerHTML = '<option value="">-- Selecciona Sede --</option>';
            sedes.forEach(s => {
                selectSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
            });
        }

        // 2. Cargar Usuarios
        const resUser = await apiFetch(`${API_URL}/api/usuarios`);
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
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER' || usuarioActivo.rol === 'Chofer') {
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
            localStorage.removeItem('innova_token');
            localStorage.removeItem('innova_refresh_token');
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
        const res = await apiFetch(`${API_URL}/api/ventas`);
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
            <button onclick="verSeguimientoVendedor('${v.codigo}')" title="Ver progreso y operarios"
                    style="background:#3b82f6; color:white; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-list-check"></i>
            </button>
            ${(usuarioActivo?.rol === 'Admin') ? `
            <button onclick="gestionarEstadoVenta(${v.id}, '${v.estado}')" title="Cambiar Estado / Anular"
                    style="background:#fee2e2; color:#b91c1c; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
            </button>` : ''}
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
        <button onclick="verSeguimientoVendedor('${v.codigo}')"
                style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:8px; margin-top:8px;">
            <i class="fa-solid fa-list-check"></i> Ver progreso de fabricación
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
        const res = await apiFetch(`${API_URL}/api/ventas/${codigo}/historial-precios`);
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
        const res = await apiFetch(`${API_URL}/api/ventas/${_cambioPrecioActual.codigo}/proponer-cambio-precio`, {
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
        const res  = await apiFetch(`${API_URL}/api/cambios-precio/pendientes`);
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
        const res = await apiFetch(url, {
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
// GESTIÓN MANUAL DE ESTADO Y ANULACIÓN (ADMIN)
// ==========================================
async function gestionarEstadoVenta(ventaId, estadoActual) {
    const { value: accion } = await Swal.fire({
        title: 'Gestionar Venta',
        input: 'select',
        inputOptions: {
            'Estados': {
                'Pendiente': 'Marcar como Pendiente',
                'En producción': 'Marcar como En Producción',
                'Listo': 'Marcar como Listo',
                'Despachado': 'Marcar como Despachado',
                'Entregado': 'Marcar como Entregado'
            },
            'Peligro': {
                'ANULAR': '❌ ANULAR VENTA COMPLETA'
            }
        },
        inputPlaceholder: 'Selecciona una acción',
        showCancelButton: true,
        confirmButtonColor: '#0f172a'
    });

    if (!accion) return;

    try {
        let url, body;
        if (accion === 'ANULAR') {
            const confirm = await Swal.fire({ title: '¿Seguro?', text: 'Esto cancelará el pedido, vaciará los tickets del taller y cancelará la logística externa.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#b91c1c' });
            if (!confirm.isConfirmed) return;
            url = `${API_URL}/api/ventas/${ventaId}/anular`;
        } else {
            url = `${API_URL}/api/ventas/${ventaId}/estado`;
            body = JSON.stringify({ estado: accion });
        }

        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(url, { method: accion === 'ANULAR' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: body });
        const data = await res.json();
        
        if (data.exito) {
            Swal.fire('Éxito', data.mensaje, 'success');
            loadContratos();
        } else throw new Error(data.error);
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function abrirModalLote() {
    try {
        const res = await apiFetch(`${API_URL}/api/logistica/pendientes-por-proveedor`);
        const proveedores = await res.json();

        if (!proveedores || proveedores.length === 0) {
            return Swal.fire('Sin pendientes', 'No hay materiales pendientes asignados a un proveedor.', 'info');
        }

        const opcionesProv = proveedores.map(p => `<option value="${p.proveedor_id}">${p.proveedor_nombre} (${p.items.length} items)</option>`).join('');

        const { value: provId } = await Swal.fire({
            title: 'Cotización por lote',
            html: `
                <label style="font-weight:bold;display:block;margin-bottom:8px;text-align:left;">Selecciona el proveedor:</label>
                <select id="swal-prov-lote" class="swal2-input" style="width:100%; margin:0;">
                    ${opcionesProv}
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: 'Siguiente',
            preConfirm: () => document.getElementById('swal-prov-lote').value
        });

        if (!provId) return;
        const proveedorSelec = proveedores.find(p => p.proveedor_id == provId);

        let itemsHtml = proveedorSelec.items.map((item, idx) => `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; text-align:left; background:#f8fafc; padding:8px; border-radius:6px;">
                <input type="checkbox" id="chk-lote-${idx}" class="chk-lote-item" value="${idx}" checked style="width:18px;height:18px;">
                <img src="${item.foto_url || 'imagenes/sin_foto.jpg'}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
                <div style="line-height:1.2;">
                    <strong style="font-size:13px;">${item.insumo_nombre}</strong><br>
                    <span style="font-size:11px;color:#64748b;">SKU: ${item.sku || 'N/A'} | Cant: ${item.cantidad || 0} ${item.unidad || ''}</span>
                </div>
            </div>
        `).join('');

        const { value: confirmLote } = await Swal.fire({
            title: 'Seleccionar Materiales',
            html: `<div style="max-height:300px; overflow-y:auto; margin-bottom:10px;">${itemsHtml}</div>`,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-brands fa-whatsapp"></i> Crear Lote y Enviar',
            confirmButtonColor: '#25D366',
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.chk-lote-item:checked');
                if (checkboxes.length === 0) { Swal.showValidationMessage('Debes seleccionar al menos un material'); return false; }
                return Array.from(checkboxes).map(chk => proveedorSelec.items[chk.value]);
            }
        });
        if (!confirmLote) return;

        Swal.fire({ title: 'Generando link...', didOpen: () => Swal.showLoading() });
        const resLote = await apiFetch(`${API_URL}/api/logistica/crear-lote-cotizacion`, {
            method: 'POST', body: JSON.stringify({ proveedor_id: provId, items: confirmLote })
        });
        const dLote = await resLote.json();
        if (!resLote.ok || !dLote.exito) throw new Error(dLote.error || 'Error al generar el lote');

        let tel = (dLote.telefono || '').replace(/[\s\-\(\)]/g, '');
        if (!tel.startsWith('+')) tel = '51' + tel.replace(/^0+/, '');

        let msgItems = dLote.items.map((it, i) => `${i+1}. 📦 *${it.sku ? it.sku + ' — ' : ''}${it.insumo_nombre}* | Cant: ${it.cantidad || 0} ${it.unidad || ''}`).join('\n');

        const msgWsp = [
            `Hola ${dLote.nombre_proveedor} 👋, somos *Innova Möbili*.`,``,`Le solicitamos cotización de los siguientes materiales:`,``,msgItems,``,
            `Por favor ingrese al siguiente link para enviarnos sus precios y fechas:`,`👉 ${dLote.link}`,``,`Tiene 3 días hábiles para responder. Gracias 🙏`
        ].join('\n');

        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
        cargarLogisticaExterna();
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
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