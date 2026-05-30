/**
 * busqueda_filtros.js — Innova Möbili ERP
 * ─────────────────────────────────────────────────────────────────────────────
 * Reemplaza / extiende tres funciones existentes:
 *   1. loadMisPedidos()         → vista "Mis Pedidos" del vendedor
 *   2. cargarVistaEntregados()  → historial de entregados (Admin/Taller + Chofer)
 *
 * INSTRUCCIONES DE INTEGRACIÓN
 * ─────────────────────────────
 * 1. Copia este archivo en tu carpeta Vendedor/ (junto a app.js, taller.js, etc.)
 * 2. En index.html, carga este script DESPUÉS de app.js y taller.js:
 *      <script src="busqueda_filtros.js"></script>
 * 3. Listo. Las funciones aquí redefinen las anteriores; no borres nada más.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════════════════════════════════════
   SECCIÓN 1 — "MIS PEDIDOS" DEL VENDEDOR
   Con: buscador por nº contrato o cliente, filtro por estado,
        y ahora muestra también los Entregados.
   ═══════════════════════════════════════════════════════════════════════════ */

// Guardamos todos los pedidos del vendedor en memoria para filtrar sin fetch
let _mpTodos = [];

async function loadMisPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container || !usuarioActivo) return;

    container.innerHTML = _mpSpinner();

    try {
        const res  = await apiFetch(`${API_URL}/api/mis-ventas/${usuarioActivo.id}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = _mpVacio('No tienes pedidos registrados todavía.');
            return;
        }

        _mpTodos = data;
        _mpRenderUI(container);

    } catch (e) {
        container.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.</p>`;
    }
}

function _mpRenderUI(container) {
    // Barra de herramientas
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
                    oninput="_mpFiltrar()"
                    style="width:100%; padding:9px 12px 9px 32px; box-sizing:border-box;
                        border:1px solid #e2e8f0; border-radius:8px; font-size:12px;
                        font-family:'Jost',sans-serif; outline:none; background:#fff;
                        color:#0f172a; transition:border-color .2s;"
                    onfocus="this.style.borderColor='#d4af37'"
                    onblur="this.style.borderColor='#e2e8f0'">
            </div>

            <!-- Filtro estado -->
            <select id="mp-estado" onchange="_mpFiltrar()"
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

        <!-- Lista filtrada -->
        <div id="mp-lista"></div>`;

    _mpFiltrar(); // render inicial con todos
}

function _mpFiltrar() {
    const q      = (document.getElementById('mp-buscar')?.value  || '').toLowerCase().trim();
    const estado = (document.getElementById('mp-estado')?.value  || '');
    const lista  = document.getElementById('mp-lista');
    const cont   = document.getElementById('mp-contador');
    if (!lista) return;

    let filtrados = _mpTodos.filter(v => {
        const matchQ = !q ||
            v.codigo.toLowerCase().includes(q) ||
            v.cliente.toLowerCase().includes(q);
        const matchE = !estado || v.estado === estado;
        return matchQ && matchE;
    });

    if (cont) cont.textContent = `${filtrados.length} pedido${filtrados.length !== 1 ? 's' : ''}`;

    if (filtrados.length === 0) {
        lista.innerHTML = _mpVacio('Sin resultados para esta búsqueda.');
        return;
    }

    lista.innerHTML = filtrados.map(v => _mpCardHTML(v)).join('');
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

// Cache de entregados para filtrar en memoria
let _entTodos = [];

async function cargarVistaEntregados(contenedor, choferId) {
    try {
        const url = choferId
            ? `${API_URL}/api/despacho/entregados?chofer_id=${choferId}`
            : `${API_URL}/api/despacho/entregados`;

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#64748b;">
                    <div style="font-size:48px; margin-bottom:16px;">✅</div>
                    <p style="font-weight:700; font-size:15px; color:#374151;
                        margin:0 0 8px;">Sin entregas registradas aún</p>
                    <p style="font-size:13px; margin:0;">
                        Cuando confirmes una entrega aparecerá aquí.</p>
                </div>`;
            return;
        }

        _entTodos = data;
        _entRenderUI(contenedor, choferId);

    } catch (e) {
        console.error('Error cargando entregados:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center; padding:30px;">
            Error al cargar el historial. Intenta de nuevo.</p>`;
    }
}

function _entRenderUI(contenedor, choferId) {
    // Construir opciones únicas de sede para el filtro
    const sedes  = [...new Set(_entTodos.map(e => e.sede).filter(Boolean))].sort();
    const opsSede = sedes.map(s =>
        `<option value="${s}">${s}</option>`
    ).join('');

    // Si hay varios choferes (vista Admin), ofrecer filtro por chofer
    const choferes = !choferId
        ? [...new Set(_entTodos.map(e => e.chofer).filter(Boolean))].sort()
        : [];
    const opsChofer = choferes.map(c =>
        `<option value="${c}">${c}</option>`
    ).join('');

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
                        oninput="_entFiltrar()"
                        style="width:100%; padding:9px 12px 9px 32px; box-sizing:border-box;
                            border:1px solid #bbf7d0; border-radius:8px; font-size:12px;
                            font-family:'Jost',sans-serif; outline:none; background:#fff;
                            color:#0f172a; transition:border-color .2s;"
                        onfocus="this.style.borderColor='#22c55e'"
                        onblur="this.style.borderColor='#bbf7d0'">
                </div>

                <!-- Filtro sede -->
                ${sedes.length > 1 ? `
                <select id="ent-sede" onchange="_entFiltrar()"
                    style="padding:9px 12px; border:1px solid #bbf7d0; border-radius:8px;
                        font-size:12px; font-family:'Jost',sans-serif; outline:none;
                        background:#fff; color:#0f172a; cursor:pointer; min-width:140px;">
                    <option value="">Todas las sedes</option>
                    ${opsSede}
                </select>` : '<span id="ent-sede" style="display:none;"></span>'}

                <!-- Filtro chofer (solo Admin) -->
                ${choferes.length > 1 ? `
                <select id="ent-chofer" onchange="_entFiltrar()"
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

            <!-- Lista filtrada -->
            <div id="ent-lista"></div>
        </div>`;

    _entFiltrar(); // render inicial
}

function _entFiltrar() {
    const q      = (document.getElementById('ent-buscar')?.value  || '').toLowerCase().trim();
    const sede   = (document.getElementById('ent-sede')?.value    || '');
    const chofer = (document.getElementById('ent-chofer')?.value  || '');
    const lista  = document.getElementById('ent-lista');
    const cont   = document.getElementById('ent-contador');
    if (!lista) return;

    let filtrados = _entTodos.filter(e => {
        const matchQ = !q ||
            (e.codigo_venta || '').toLowerCase().includes(q) ||
            (e.cliente      || '').toLowerCase().includes(q) ||
            (e.producto     || '').toLowerCase().includes(q);
        const matchS = !sede   || e.sede   === sede;
        const matchC = !chofer || e.chofer === chofer;
        return matchQ && matchS && matchC;
    });

    if (cont) cont.textContent =
        `${filtrados.length} entrega${filtrados.length !== 1 ? 's' : ''}`;

    if (filtrados.length === 0) {
        lista.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#64748b;">
                <div style="font-size:36px; margin-bottom:12px;">🔍</div>
                <p style="font-weight:700; color:#374151; margin:0;">
                    Sin resultados para esta búsqueda.</p>
            </div>`;
        return;
    }

    let html = '';
    for (const e of filtrados) {
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

    lista.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECCIÓN 3 — ÓRDENES POR PEDIDO (Admin Taller)
   Con: buscador por nº contrato o cliente + filtro por estado de pedido
   ═══════════════════════════════════════════════════════════════════════════ */

// Reemplaza cargarOrdenesProduccion para añadir buscador + filtros de estado
let _opTodos = [];

async function cargarOrdenesProduccion(contenedor) {
    contenedor.innerHTML = `
        <p style="color:gray; font-size:13px; text-align:center; padding:20px;">
            Cargando órdenes de producción...</p>`;
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/ordenes`);
        const data = await res.json();

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

    contenedor.innerHTML = `
        <div style="
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            width: 100%;
            min-width: 0;">

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

    // Reutilizamos el renderer original de órdenes que ya existía en taller.js
    // El helper _opRenderOrdenes recibe el array ya filtrado
    _opRenderOrdenes(lista, filtrados);
}

/**
 * Renderer de tarjetas de orden de producción.
 * Extraído de la función original cargarOrdenesProduccion en taller.js
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