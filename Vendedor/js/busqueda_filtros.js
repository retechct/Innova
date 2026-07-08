/**
 * busqueda_filtros.js — Innova Möbili ERP
 * ─────────────────────────────────────────────────────────────────────────────
 * Reemplaza / extiende tres funciones existentes:
 *   1. loadMisPedidos()         → vista "Mis Pedidos" del vendedor
 *   2. cargarVistaEntregados()  → historial de entregados (Admin/Taller + Chofer)
 *
 * INSTRUCCIONES DE INTEGRACIÓN
 * ─────────────────────────────
 * 1. Copia este archivo en tu carpeta Vendedor/js/.
 * 2. En index.html, carga este script DESPUÉS de los módulos App y Taller:
 *      <script src="busqueda_filtros.js"></script>
 * 3. Listo. Las funciones aquí redefinen las anteriores; no borres nada más.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════════════════════════════════════
   SECCIÓN 1 — "MIS PEDIDOS" DEL VENDEDOR
   Con: buscador por nº contrato o cliente, filtro por estado,
        y ahora muestra también los Entregados.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Estado de la vista (julio 2026: paginación server-side) ────────────────
// Ya NO guardamos todos los pedidos en memoria. Cada cambio de búsqueda,
// filtro o página dispara un fetch nuevo al backend, que hace el filtrado
// y el LIMIT/OFFSET en el query (ver /api/mis-ventas en routes_ventas.py).
let _mpPagina  = 1;
let _mpQuery   = '';
let _mpEstado  = '';

// Debounce del buscador: no pegamos un fetch por cada tecla.
const _mpBuscarDebounced = debounce(() => { _mpPagina = 1; _mpCargarPagina(); }, 350);

async function loadMisPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container || !usuarioActivo) return;

    _mpPagina = 1;
    _mpQuery  = '';
    _mpEstado = '';
    _mpRenderUI(container);
}

function _mpRenderUI(container) {
    // Barra de herramientas (se pinta una sola vez; los fetches solo
    // reemplazan #mp-lista y #mp-paginacion, no todo el toolbar)
    container.innerHTML = `
        <div id="mp-toolbar" style="
            display:flex; flex-wrap:wrap; gap:10px; align-items:center;
            padding:14px 16px; background:#f8fafc;
            border:1px solid #e2e8f0; border-radius:12px; margin-bottom:16px;">

            <!-- Buscador -->
            <div style="position:relative; flex:1; min-width:180px;">
                <i class="fa-solid fa-magnifying-glass" style="
                    position:absolute; left:10px; top:50%; transform:translateY(-50%);
                    color:#94a3b8; font-size:12px; pointer-events:none;"></i>
                <input id="mp-buscar" type="text" placeholder="Buscar por contrato o cliente…"
                    oninput="_mpQuery = this.value; _mpBuscarDebounced()"
                    style="width:100%; padding:9px 12px 9px 32px; box-sizing:border-box;
                        border:1px solid #e2e8f0; border-radius:8px; font-size:12px;
                        font-family:'Jost',sans-serif; outline:none; background:#fff;
                        color:#0f172a; transition:border-color .2s;"
                    onfocus="this.style.borderColor='#d4af37'"
                    onblur="this.style.borderColor='#e2e8f0'">
            </div>

            <!-- Filtro estado -->
            <select id="mp-estado" onchange="_mpEstado = this.value; _mpPagina = 1; _mpCargarPagina()"
                style="padding:9px 12px; border:1px solid #e2e8f0; border-radius:8px;
                    font-size:12px; font-family:'Jost',sans-serif; outline:none;
                    background:#fff; color:#0f172a; cursor:pointer; min-width:150px;">
                <option value="">Todos los estados</option>
                <option value="En Producción">⚙️ En Producción</option>
                <option value="Listo">✅ Listo</option>
                <option value="En Despacho">🚚 En Despacho</option>
                <option value="Entregado">🎉 Entregado</option>
                <option value="Pendiente Pago">💳 Pendiente Pago</option>
                <option value="Cancelado">❌ Cancelado</option>
            </select>

            <!-- Contador -->
            <span id="mp-contador" style="
                font-size:11px; color:#64748b; font-family:'Jost',sans-serif;
                white-space:nowrap; margin-left:auto;">
            </span>
        </div>

        <!-- Lista de la página actual -->
        <div id="mp-lista">${_mpSpinner()}</div>
        <div id="mp-paginacion"></div>`;

    _mpCargarPagina();
}

async function _mpCargarPagina() {
    const lista = document.getElementById('mp-lista');
    const cont  = document.getElementById('mp-contador');
    const pagEl = document.getElementById('mp-paginacion');
    if (!lista || !usuarioActivo) return;

    lista.innerHTML = _mpSpinner();

    try {
        const params = new URLSearchParams({ page: _mpPagina, per_page: 20 });
        if (_mpQuery)  params.set('q', _mpQuery);
        if (_mpEstado) params.set('estado', _mpEstado);

        const res  = await apiFetch(`${API_URL}/api/mis-ventas/${usuarioActivo.id}?${params}`);
        const data = await res.json();

        if (!data || !Array.isArray(data.items)) {
            lista.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.</p>`;
            return;
        }

        _mpPagina = data.page || 1;

        if (cont) cont.textContent = `${data.total} pedido${data.total !== 1 ? 's' : ''}`;

        if (data.items.length === 0) {
            lista.innerHTML = _mpVacio(
                (_mpQuery || _mpEstado) ? 'Sin resultados para esta búsqueda.' : 'No tienes pedidos registrados todavía.'
            );
            if (pagEl) pagEl.innerHTML = '';
            return;
        }

        lista.innerHTML = data.items.map(v => _mpCardHTML(v)).join('');

        renderPaginacion(pagEl, {
            page: data.page,
            totalPages: data.total_pages,
            onChange: (p) => { _mpPagina = p; _mpCargarPagina(); }
        });

    } catch (e) {
        lista.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.</p>`;
    }
}

function _mpCardHTML(v) {
    const estadoColor = {
        'Entregado':      { bg:'#f0fdf4', border:'#86efac', badge:'#15803d',  text:'#166534' },
        'Cancelado':      { bg:'#fef2f2', border:'#fca5a5', badge:'#dc2626',  text:'#991b1b' },
        'En Producción':  { bg:'#fefce8', border:'#fde68a', badge:'#d97706',  text:'#92400e' },
        'Listo':          { bg:'#f0fdf4', border:'#a7f3d0', badge:'#10b981',  text:'#065f46' },
        'En Despacho':    { bg:'#eff6ff', border:'#93c5fd', badge:'#2563eb',  text:'#1e40af' },
        'Pendiente Pago': { bg:'#fff7ed', border:'#fdba74', badge:'#ea580c',  text:'#9a3412' },
    };
    const c = estadoColor[v.estado] || { bg:'#f8fafc', border:'#e2e8f0', badge:'#64748b', text:'#475569' };

    const esFinalizado = (v.estado === 'Entregado' || v.estado === 'Cancelado');
    const pct = v.estado === 'Entregado' ? 100 : (v.progreso || 0);

    return `
    <div class="pedido-card" onclick="abrirDetallePedido('${v.codigo}')"
        style="background:#fff; border:1px solid ${c.border}; border-radius:12px;
            margin-bottom:12px; overflow:hidden; cursor:pointer;
            box-shadow:0 2px 8px rgba(0,0,0,0.05);
            transition:box-shadow .2s, transform .15s;"
        onmouseenter="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)'; this.style.transform='translateY(-1px)'"
        onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">

        <!-- Cabecera coloreada -->
        <div style="background:${c.bg}; padding:12px 16px;
            border-bottom:1px solid ${c.border};
            display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:900; color:#0f172a; font-size:14px; letter-spacing:.3px;">
                    #${v.codigo}
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    ${v.cliente.toUpperCase()}
                </div>
            </div>
            <span style="background:${c.badge}; color:#fff; font-size:10px;
                font-weight:800; padding:4px 10px; border-radius:20px;
                text-transform:uppercase; letter-spacing:.5px;">
                ${v.estado}
            </span>
        </div>

        <!-- Cuerpo -->
        <div style="padding:12px 16px;">
            <div style="display:flex; justify-content:space-between;
                align-items:center; margin-bottom:10px;">
                <span style="font-weight:900; color:#10b981; font-size:14px;">
                    S/ ${v.monto_total.toFixed(2)}
                </span>
                <span style="font-size:11px; color:#64748b;">
                    Entrega: <b>${v.entrega}</b>
                </span>
            </div>

            <!-- Barra de progreso -->
            <div style="font-size:10px; font-weight:700; color:#64748b;
                margin-bottom:5px;">
                PROGRESO: ${pct}%
            </div>
            <div style="width:100%; height:6px; background:#f1f5f9;
                border-radius:4px; overflow:hidden; margin-bottom:14px;">
                <div style="width:${pct}%; height:100%;
                    background:linear-gradient(90deg, #d4af37, #b8860b);
                    transition:width .6s ease;"></div>
            </div>

            <!-- Botones -->
            <div style="display:flex; gap:8px;">
                <button onclick="event.stopPropagation(); abrirDetallePedido('${v.codigo}')"
                    style="flex:1; background:#0f172a; color:#fff; border:none;
                        padding:9px; border-radius:8px; font-size:11px;
                        font-weight:800; cursor:pointer; font-family:'Jost',sans-serif;">
                    <i class="fa-solid fa-eye"></i> Ficha
                </button>
                <button onclick="event.stopPropagation(); verSeguimientoVendedor('${v.codigo}')"
                    style="flex:1; background:#3b82f6; color:#fff; border:none;
                        padding:9px; border-radius:8px; font-size:11px;
                        font-weight:800; cursor:pointer; font-family:'Jost',sans-serif;">
                    <i class="fa-solid fa-list-check"></i> Progreso
                </button>
                ${!esFinalizado ? `
                <button onclick="event.stopPropagation(); abrirModalCambioPrecio('${v.codigo}', ${v.monto_total})"
                    style="flex:1; background:#fef3c7; color:#92400e;
                        border:1px solid #fde68a; padding:9px; border-radius:8px;
                        font-size:11px; font-weight:800; cursor:pointer;
                        font-family:'Jost',sans-serif;">
                    <i class="fa-solid fa-tag"></i> Precio
                </button>` : ''}
            </div>
        </div>
    </div>`;
}

function _mpVacio(msg) {
    return `<div style="text-align:center; padding:60px 20px; color:#64748b;">
        <div style="font-size:48px; margin-bottom:16px;">📋</div>
        <p style="font-weight:700; color:#374151; margin:0 0 8px;">${msg}</p>
    </div>`;
}

function _mpSpinner() {
    return `<div style="text-align:center; padding:30px; color:#64748b;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem; color:#d4af37;"></i>
        <p style="margin-top:10px; font-size:13px; font-weight:600;">Cargando seguimiento...</p>
    </div>`;
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECCIÓN 2 — HISTORIAL DE ENTREGADOS (Admin / Taller / Chofer)
   Con: buscador por nº contrato o cliente, filtro por sede/chofer
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Estado de la vista (julio 2026: paginación server-side) ────────────────
// El array de entregados en memoria (_entTodos) desapareció junto con el
// LIMIT 200 fijo del backend. Ahora cada búsqueda/filtro/página pide solo
// lo que se va a mostrar (ver /api/despacho/entregados en routes_produccion.py).
let _entPagina  = 1;
let _entQuery   = '';
let _entSede    = '';
let _entChofer  = '';
let _entChoferIdFijo = null; // choferId de la URL (vista "mi historial" del chofer)

const _entBuscarDebounced = debounce(() => { _entPagina = 1; _entCargarPagina(); }, 350);

async function cargarVistaEntregados(contenedor, choferId) {
    _entPagina = 1;
    _entQuery  = '';
    _entSede   = '';
    _entChofer = '';
    _entChoferIdFijo = choferId || null;

    // Opciones de filtro (sedes/choferes) — endpoint chico y aparte,
    // porque con paginación ya no tenemos todo el historial en memoria
    // para sacar los valores únicos como antes.
    let opciones = { sedes: [], choferes: [] };
    try {
        const res = await apiFetch(`${API_URL}/api/despacho/entregados/filtros`);
        opciones = await res.json();
    } catch (e) {
        console.error('Error cargando opciones de filtro de entregados:', e);
    }

    _entRenderUI(contenedor, choferId, opciones);
}

function _entRenderUI(contenedor, choferId, opciones) {
    const sedes  = (opciones?.sedes || []);
    const opsSede = sedes.map(s => `<option value="${s}">${s}</option>`).join('');

    // Si hay varios choferes (vista Admin), ofrecer filtro por chofer
    const choferes  = !choferId ? (opciones?.choferes || []) : [];
    const opsChofer = choferes.map(c => `<option value="${c}">${c}</option>`).join('');

    // ── IMPORTANTE: el contenedor padre es un grid multi-columna.
    // Envolvemos todo en un div con grid-column:1/-1 para que ocupe el ancho
    // completo y se comporte como una columna única internamente.
    contenedor.innerHTML = `
        <div style="
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            width: 100%;
            min-width: 0;">

            <!-- Barra de herramientas -->
            <div id="ent-toolbar" style="
                display:flex; flex-wrap:wrap; gap:10px; align-items:center;
                padding:14px 16px; background:#f0fdf4;
                border:1px solid #86efac; border-radius:12px; margin-bottom:20px;">

                <!-- Buscador -->
                <div style="position:relative; flex:2; min-width:180px;">
                    <i class="fa-solid fa-magnifying-glass" style="
                        position:absolute; left:10px; top:50%; transform:translateY(-50%);
                        color:#94a3b8; font-size:12px; pointer-events:none;"></i>
                    <input id="ent-buscar" type="text"
                        placeholder="Buscar por contrato o cliente…"
                        oninput="_entQuery = this.value; _entBuscarDebounced()"
                        style="width:100%; padding:9px 12px 9px 32px; box-sizing:border-box;
                            border:1px solid #bbf7d0; border-radius:8px; font-size:12px;
                            font-family:'Jost',sans-serif; outline:none; background:#fff;
                            color:#0f172a; transition:border-color .2s;"
                        onfocus="this.style.borderColor='#22c55e'"
                        onblur="this.style.borderColor='#bbf7d0'">
                </div>

                <!-- Filtro sede -->
                ${sedes.length > 1 ? `
                <select id="ent-sede" onchange="_entSede = this.value; _entPagina = 1; _entCargarPagina()"
                    style="padding:9px 12px; border:1px solid #bbf7d0; border-radius:8px;
                        font-size:12px; font-family:'Jost',sans-serif; outline:none;
                        background:#fff; color:#0f172a; cursor:pointer; min-width:140px;">
                    <option value="">Todas las sedes</option>
                    ${opsSede}
                </select>` : '<span id="ent-sede" style="display:none;"></span>'}

                <!-- Filtro chofer (solo Admin) -->
                ${choferes.length > 1 ? `
                <select id="ent-chofer" onchange="_entChofer = this.value; _entPagina = 1; _entCargarPagina()"
                    style="padding:9px 12px; border:1px solid #bbf7d0; border-radius:8px;
                        font-size:12px; font-family:'Jost',sans-serif; outline:none;
                        background:#fff; color:#0f172a; cursor:pointer; min-width:140px;">
                    <option value="">Todos los choferes</option>
                    ${opsChofer}
                </select>` : '<span id="ent-chofer" style="display:none;"></span>'}

                <!-- Contador -->
                <span id="ent-contador" style="
                    font-size:11px; color:#166534; font-family:'Jost',sans-serif;
                    font-weight:700; white-space:nowrap; margin-left:auto;">
                </span>
            </div>

            <!-- Lista de la página actual -->
            <div id="ent-lista">${_mpSpinner()}</div>
            <div id="ent-paginacion"></div>
        </div>`;

    _entCargarPagina();
}

async function _entCargarPagina() {
    const lista = document.getElementById('ent-lista');
    const cont  = document.getElementById('ent-contador');
    const pagEl = document.getElementById('ent-paginacion');
    if (!lista) return;

    lista.innerHTML = _mpSpinner();

    try {
        const params = new URLSearchParams({ page: _entPagina, per_page: 20 });
        if (_entChoferIdFijo) params.set('chofer_id', _entChoferIdFijo);
        if (_entQuery)  params.set('q', _entQuery);
        if (_entSede)   params.set('sede', _entSede);
        if (_entChofer) params.set('chofer', _entChofer);

        const res  = await apiFetch(`${API_URL}/api/despacho/entregados?${params}`);
        const data = await res.json();

        if (!data || !Array.isArray(data.items)) {
            lista.innerHTML = `<p style="color:red; text-align:center; padding:30px;">
                Error al cargar el historial. Intenta de nuevo.</p>`;
            return;
        }

        _entPagina = data.page || 1;

        if (cont) cont.textContent = `${data.total} entrega${data.total !== 1 ? 's' : ''}`;

        if (data.items.length === 0) {
            lista.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#64748b;">
                    <div style="font-size:36px; margin-bottom:12px;">🔍</div>
                    <p style="font-weight:700; color:#374151; margin:0;">
                        Sin resultados para esta búsqueda.</p>
                </div>`;
            if (pagEl) pagEl.innerHTML = '';
            return;
        }

        lista.innerHTML = _entTarjetasHTML(data.items);

        renderPaginacion(pagEl, {
            page: data.page,
            totalPages: data.total_pages,
            onChange: (p) => { _entPagina = p; _entCargarPagina(); }
        });

    } catch (e) {
        console.error('Error cargando entregados:', e);
        lista.innerHTML = `<p style="color:red; text-align:center; padding:30px;">
            Error al cargar el historial. Intenta de nuevo.</p>`;
    }
}

/**
 * Arma el HTML de las tarjetas de entregados. Extraído de la vieja
 * _entFiltrar para poder llamarlo con la página que venga del backend.
 */
function _entTarjetasHTML(entregas) {
    let html = '';
    for (const e of entregas) {
        const saldoCobrado = e.saldo === 0
            ? `<span style="color:#15803d; font-weight:800;">✓ Pagado</span>`
            : `<span style="color:#dc2626; font-weight:800;">
                S/ ${e.saldo.toFixed(2)} pendiente</span>`;

        html += `
        <div style="background:#fff; border:2px solid #86efac; border-radius:14px;
            margin-bottom:16px; overflow:hidden;
            box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <!-- Cabecera verde -->
            <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);
                padding:12px 16px; border-bottom:1px solid #86efac;
                display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:10px; font-weight:900; color:#166534;
                        text-transform:uppercase; letter-spacing:1px;">Entregado</div>
                    <div style="font-size:14px; font-weight:800; color:#0f172a;
                        margin-top:2px;">${e.producto}</div>
                    <div style="font-size:11px; color:#475569; margin-top:1px;">
                        ${e.codigo_venta} · ${e.cliente}
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="background:#15803d; color:#fff; font-size:10px;
                        font-weight:800; padding:4px 10px; border-radius:20px;
                        margin-bottom:4px;">🎉 ENTREGADO</div>
                    <div style="font-size:10px; color:#64748b;">
                        ${e.fecha_entrega_real}</div>
                </div>
            </div>

            <!-- Detalle -->
            <div style="padding:12px 16px; display:grid;
                grid-template-columns:1fr 1fr; gap:8px; font-size:12px;">
                <div>
                    <div style="color:#64748b; font-size:10px; font-weight:700;
                        text-transform:uppercase;">Chofer</div>
                    <div style="font-weight:700; color:#0f172a;">
                        ${e.chofer}</div>
                </div>
                <div>
                    <div style="color:#64748b; font-size:10px; font-weight:700;
                        text-transform:uppercase;">Sede</div>
                    <div style="font-weight:700; color:#0f172a;">
                        ${e.sede || '—'}</div>
                </div>
                <div>
                    <div style="color:#64748b; font-size:10px; font-weight:700;
                        text-transform:uppercase;">Dirección</div>
                    <div style="font-weight:600; color:#374151;">
                        ${e.direccion || '—'}</div>
                </div>
                <div>
                    <div style="color:#64748b; font-size:10px; font-weight:700;
                        text-transform:uppercase;">Saldo</div>
                    <div>${saldoCobrado}</div>
                </div>
            </div>

            ${e.foto_evidencia ? `
            <div style="padding:0 16px 12px;">
                <div style="font-size:10px; font-weight:700; color:#64748b;
                    text-transform:uppercase; margin-bottom:6px;">
                    📷 Foto de entrega</div>
                <img src="${e.foto_evidencia}" alt="Evidencia"
                    style="width:100%; max-width:280px; border-radius:8px;
                        border:1px solid #e2e8f0; cursor:pointer;"
                    onclick="window.open('${e.foto_evidencia}','_blank')">
            </div>` : ''}
        </div>`;
    }

    return html;
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECCIÓN 3 — ÓRDENES POR PEDIDO (Admin Taller)
   Con: buscador por nº contrato o cliente + filtro por estado de pedido
   ═══════════════════════════════════════════════════════════════════════════ */

// Reemplaza cargarOrdenesProduccion para añadir buscador + filtros de estado
let _opTodos = [];

// Julio 2026 — el backend tiene un tope de seguridad de 150 pedidos activos
// (LIMIT 150, ver comentario en obtener_ordenes_produccion). Si algún día
// hay más de 150 activos a la vez, el backend avisa por header (no cambia
// la forma del JSON para no romper _opTodos = data) y acá lo convertimos
// en un banner visible, para que el corte nunca sea silencioso.
let _opTruncado         = false;
let _opTotalActivasReal = 0;

async function cargarOrdenesProduccion(contenedor) {
    contenedor.innerHTML = `
        <p style="color:gray; font-size:13px; text-align:center; padding:20px;">
            Cargando órdenes de producción...</p>`;
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/ordenes`);
        const data = await res.json();

        _opTruncado         = res.headers.get('X-Ordenes-Truncado') === 'true';
        _opTotalActivasReal = parseInt(res.headers.get('X-Ordenes-Activas-Total') || '0', 10);

        if (!Array.isArray(data) || data.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#64748b;">
                    <div style="font-size:48px; margin-bottom:16px;">📋</div>
                    <p style="font-weight:700; color:#374151; margin:0;">
                        No hay órdenes de producción activas.</p>
                </div>`;
            return;
        }

        _opTodos = data;
        _opRenderUI(contenedor);

    } catch (e) {
        contenedor.innerHTML = `<p style="color:red; text-align:center; padding:30px;">
            Error al cargar órdenes. Intenta de nuevo.</p>`;
    }
}

function _opRenderUI(contenedor) {
    const estadosDisponibles = [...new Set(_opTodos.map(o => o.estado_general).filter(Boolean))].sort();
    const opsEstado = estadosDisponibles.map(s =>
        `<option value="${s}">${s}</option>`
    ).join('');

    const htmlAvisoTruncado = _opTruncado ? `
        <div style="
            display:flex; align-items:center; gap:10px;
            padding:12px 16px; background:#fef2f2; border:1px solid #fca5a5;
            border-radius:12px; margin-bottom:14px; color:#991b1b;
            font-size:12px; font-family:'Jost',sans-serif;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:16px;"></i>
            <div>
                <strong>Hay ${_opTotalActivasReal} pedidos activos</strong> y esta vista solo
                muestra los 150 con entrega más próxima. Los ${_opTotalActivasReal - 150}
                restantes (entrega más lejana o sin fecha) no aparecen aquí — pide que se
                active paginación completa para esta vista.
            </div>
        </div>` : '';

    contenedor.innerHTML = `
        <div style="
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            width: 100%;
            min-width: 0;">

            ${htmlAvisoTruncado}

            <!-- Barra de herramientas -->
            <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;
                padding:14px 16px; background:#eff6ff; border:1px solid #93c5fd;
                border-radius:12px; margin-bottom:20px;">

                <!-- Buscador -->
                <div style="position:relative; flex:2; min-width:180px;">
                    <i class="fa-solid fa-magnifying-glass" style="
                        position:absolute; left:10px; top:50%; transform:translateY(-50%);
                        color:#94a3b8; font-size:12px; pointer-events:none;"></i>
                    <input id="op-buscar" type="text"
                        placeholder="Buscar por contrato o cliente…"
                        oninput="_opFiltrar()"
                        style="width:100%; padding:9px 12px 9px 32px; box-sizing:border-box;
                            border:1px solid #93c5fd; border-radius:8px; font-size:12px;
                            font-family:'Jost',sans-serif; outline:none; background:#fff;
                            color:#0f172a; transition:border-color .2s;"
                        onfocus="this.style.borderColor='#2563eb'"
                        onblur="this.style.borderColor='#93c5fd'">
                </div>

                <!-- Filtro estado -->
                <select id="op-estado" onchange="_opFiltrar()"
                    style="padding:9px 12px; border:1px solid #93c5fd; border-radius:8px;
                        font-size:12px; font-family:'Jost',sans-serif; outline:none;
                        background:#fff; color:#0f172a; cursor:pointer; min-width:160px;">
                    <option value="">Todos los estados</option>
                    ${opsEstado}
                </select>

                <!-- Contador -->
                <span id="op-contador" style="
                    font-size:11px; color:#1e40af; font-family:'Jost',sans-serif;
                    font-weight:700; white-space:nowrap; margin-left:auto;">
                </span>
            </div>

            <!-- Lista filtrada -->
            <div id="op-lista"></div>
        </div>`;

    _opFiltrar();
}

function _opFiltrar() {
    const q      = (document.getElementById('op-buscar')?.value  || '').toLowerCase().trim();
    const estado = (document.getElementById('op-estado')?.value  || '');
    const lista  = document.getElementById('op-lista');
    const cont   = document.getElementById('op-contador');
    if (!lista) return;

    let filtrados = _opTodos.filter(o => {
        const matchQ = !q ||
            (o.codigo_venta   || '').toLowerCase().includes(q) ||
            (o.cliente        || '').toLowerCase().includes(q);
        const matchE = !estado || o.estado_general === estado;
        return matchQ && matchE;
    });

    if (cont) cont.textContent =
        `${filtrados.length} orden${filtrados.length !== 1 ? 'es' : ''}`;

    if (filtrados.length === 0) {
        lista.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#64748b;">
                <div style="font-size:36px; margin-bottom:12px;">🔍</div>
                <p style="font-weight:700; color:#374151; margin:0;">
                    Sin resultados para esta búsqueda.</p>
            </div>`;
        return;
    }

    // Reutilizamos el renderer original de órdenes que ya existía en los módulos de Taller.
    // El helper _opRenderOrdenes recibe el array ya filtrado
    _opRenderOrdenes(lista, filtrados);
}

/**
 * Renderer de tarjetas de orden de producción.
 * Extraído de la función original cargarOrdenesProduccion en modules/taller/ordenes_despacho.js
 * para poder reutilizarlo con datos filtrados.
 */
function _opRenderOrdenes(wrapper, ordenes) {
    const AREA_NOMBRES = {
        'ESTRUCTURAS_MUEBLES':     'Carpintería (Sofás)',
        'ESTRUCTURAS_SILLAS':      'Carpintería (Sillas)',
        'CORTE_Y_CONTROL_TELAS':   'Corte y Telas',
        'TELAS':                   'Corte y Telas',
        'PREPARACION_PATAS_ZOCALO':'Patas y Zócalos',
        'TABLEROS_Y_PIEDRAS':      'Tableros',
        'TAPICERIA_SOFAS':         'Tapicería Sofás',
        'TAPICERIA_SILLAS':        'Tapicería Sillas',
        'ARMADO_COJINES':          'Armado de Cojines',
        'DESPACHO_CENTRAL':        'Despacho',
    };
    const ESTADO_BADGE = {
        'Pendiente':  { bg:'#fef3c7', color:'#b45309', icon:'🟡' },
        'Bloqueado':  { bg:'#e2e8f0', color:'#64748b', icon:'🔒' },
        'En Proceso': { bg:'#dbeafe', color:'#1e40af', icon:'🔵' },
        'Terminado':  { bg:'#dcfce7', color:'#166534', icon:'✅' },
    };

    let html = '';
    for (const orden of ordenes) {
        const pct         = orden.progreso || 0;
        const progresoColor = pct >= 100 ? '#22c55e' : (pct >= 50 ? '#3b82f6' : '#f59e0b');
        const estadoBadge = {
            'Listo':         { bg:'#dcfce7', color:'#166534' },
            'En Producción': { bg:'#dbeafe', color:'#1e40af' },
            'Pendiente':     { bg:'#fef3c7', color:'#b45309' },
        }[orden.estado_general] || { bg:'#f1f5f9', color:'#475569' };

        let itemsHTML = '';
        (orden.items || []).forEach(item => {
            const ticketsHTML = (item.tickets || [])
                .filter(t => t.area !== 'DESPACHO_CENTRAL')
                .map(t => {
                    const b = ESTADO_BADGE[t.estado] || { bg:'#f1f5f9', color:'#64748b', icon:'?' };
                    const nombre = AREA_NOMBRES[t.area] || t.area.replace(/_/g,' ');
                    return `<span style="font-size:10px; background:${b.bg}; color:${b.color}; padding:3px 8px; border-radius:20px; font-weight:800; white-space:nowrap;">
                                ${b.icon} ${nombre}
                                ${t.trabajador !== 'Sin asignar' ? `<span style="opacity:0.7">· ${t.trabajador}</span>` : ''}
                            </span>`;
                }).join('');

            const hayTickets = item.tickets && item.tickets.filter(t => t.area !== 'DESPACHO_CENTRAL').length > 0;
            itemsHTML += `
                <div style="border-bottom:1px solid #f1f5f9; padding:8px 0; display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
                    <img src="${item.foto}" alt="" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;" onerror="this.src='imagenes/sin_foto.jpg'">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:5px;">${item.producto}</div>
                        ${hayTickets ? `<div style="display:flex; gap:5px; flex-wrap:wrap;">${ticketsHTML}</div>` : `<span style="font-size:11px; color:#94a3b8;">Sin tickets de producción</span>`}
                    </div>
                    <button onclick="abrirNotaOrden(${item.tickets && item.tickets[0] ? item.tickets[0].id : 0})"
                        style="background:#f8fafc; border:1px solid #e2e8f0; color:#475569; padding:5px 10px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;"
                        title="Agregar nota/incidencia">
                        <i class="fa-solid fa-note-sticky"></i>
                    </button>
                </div>`;
        });

        html += `
        <div style="background:white; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden; margin-bottom:16px;">
            <div style="background:#f8fafc; padding:14px 18px; border-bottom:1px solid #e2e8f0; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                        <span style="font-size:13px; font-weight:900; color:#0f172a;">${orden.codigo || orden.codigo_venta}</span>
                        <span style="font-size:11px; background:${estadoBadge.bg}; color:${estadoBadge.color}; padding:2px 8px; border-radius:20px; font-weight:800;">${orden.estado_general || '—'}</span>
                    </div>
                    <div style="font-size:12px; color:#475569;">
                        <b>${orden.cliente}</b> &nbsp;·&nbsp;
                        <i class="fa-solid fa-calendar-days" style="color:#94a3b8;"></i> Entrega: <b>${orden.fecha_entrega || orden.entrega || 'S/F'}</b>
                        ${orden.vendedor ? `&nbsp;·&nbsp; <i class="fa-solid fa-user" style="color:#94a3b8;"></i> ${orden.vendedor}` : ''}
                        ${orden.sede ? `&nbsp;·&nbsp; <i class="fa-solid fa-store" style="color:#94a3b8;"></i> ${orden.sede}` : ''}
                    </div>
                </div>
                <div style="min-width:160px; flex-shrink:0;">
                    <div style="font-size:10px; font-weight:900; color:${progresoColor}; margin-bottom:4px; text-align:right;">
                        ${pct}% completado
                        (${orden.tickets_term || 0}/${orden.tickets_total || 0} áreas)
                    </div>
                    <div style="background:#e2e8f0; border-radius:6px; height:8px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${progresoColor}; border-radius:6px; transition:0.5s;"></div>
                    </div>
                </div>
            </div>
            <div style="padding:12px 18px;">
                ${itemsHTML || '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:10px;">Sin ítems de producción</p>'}
            </div>
        </div>`;
    }
    wrapper.innerHTML = html || `
        <div style="text-align:center; padding:40px 20px; color:#64748b;">
            <p style="font-weight:700; color:#374151; margin:0;">
                No hay órdenes para mostrar.</p>
        </div>`;
}
