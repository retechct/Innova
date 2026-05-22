// =============================================================
// inventario.js — Módulo de Inventario Completo
// Innova Mobili ERP
// Requiere: config.js (API_URL), SweetAlert2, Font Awesome
// =============================================================

/* ─── Estado ────────────────────────────────────────────────── */
let _invTab        = 'productos';   // 'productos' | 'piezas' | 'historial'
let _invDataProd   = { sedes: [], modelos: [] };
let _invDataPiezas = { sedes: [], piezas:  [] };
let _invFiltroCat  = '';
let _invFiltroQ    = '';
let _invFiltroSede = '';
let _maestroInv    = { tableros: [], bases_comedor: [], catalogo: [] };

const CATEGORIAS_PRODUCTO = [
    'Sofa','Butaca','Silla','Espejo','Cuadro','Cojin','Mesa Centro','Consola'
];
const CATEGORIAS_PIEZA = [
    { val: 'tablero',          label: 'Tablero (piedra / vidrio / madera)' },
    { val: 'base-comedor',     label: 'Base de Comedor' },
    { val: 'base-consola',     label: 'Base de Consola' },
    { val: 'base-mesa-centro', label: 'Base de Mesa de Centro' },
];

/* ─── Punto de entrada ─────────────────────────────────────── */
async function cargarVistaInventario() {
    const main = document.getElementById('main-content');
    main.innerHTML = _htmlEsqueleto();
    await _cargarMaestrosInv();
    await _cargarDatosTab();
    _bindInvEventos();
}

/* ─── Esqueleto HTML ────────────────────────────────────────── */
function _htmlEsqueleto() {
    return `
    <div class="view-title-container">
        <i class="fas fa-boxes"></i>
        <h2>Inventario por Tienda</h2>
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
            ${_puedeEditarInv() ? `
            <button onclick="abrirModalNuevoItem()" 
                    style="background:var(--accent);color:white;border:none;padding:10px 16px;
                           border-radius:10px;font-weight:800;cursor:pointer;font-size:12px;
                           display:flex;align-items:center;gap:6px;">
                <i class="fas fa-plus"></i> Registrar
            </button>` : ''}
            <button onclick="_invExportarCSV()"
                    style="background:white;color:var(--text-muted);border:1px solid #e2e8f0;
                           padding:10px 14px;border-radius:10px;font-weight:700;cursor:pointer;
                           font-size:12px;display:flex;align-items:center;gap:6px;">
                <i class="fas fa-download"></i> CSV
            </button>
        </div>
    </div>

    <!-- TABS -->
    <div style="display:flex;gap:8px;margin-bottom:1.2rem;flex-wrap:wrap;">
        <button id="tab-productos" onclick="_invCambiarTab('productos')"
                class="btn-filter-taller active">
            <i class="fas fa-couch"></i> Productos
        </button>
        <button id="tab-piezas" onclick="_invCambiarTab('piezas')"
                class="btn-filter-taller">
            <i class="fas fa-puzzle-piece"></i> Piezas a Medida
        </button>
        <button id="tab-historial" onclick="_invCambiarTab('historial')"
                class="btn-filter-taller">
            <i class="fas fa-history"></i> Historial
        </button>
        <!-- Buscador por código de barras -->
        <div style="margin-left:auto;display:flex;gap:6px;">
            <input id="inv-barcode-input" type="text" class="form-input"
                   placeholder="📷 Escanear código..." 
                   style="max-width:200px;padding:8px 12px;font-size:13px;"
                   onkeydown="if(event.key==='Enter') _invBuscarBarcode(this.value)" />
            <button onclick="_invBuscarBarcode(document.getElementById('inv-barcode-input').value)"
                    style="background:var(--primary);color:white;border:none;padding:8px 14px;
                           border-radius:10px;cursor:pointer;font-size:13px;">
                <i class="fas fa-search"></i>
            </button>
        </div>
    </div>

    <!-- FILTROS -->
    <div id="inv-filtros" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:1rem;">
        <select id="inv-filtro-cat" class="form-input" 
                style="max-width:200px;padding:10px 12px;font-size:13px;">
            <option value="">Todas las categorías</option>
        </select>
        <select id="inv-filtro-sede" class="form-input"
                style="max-width:190px;padding:10px 12px;font-size:13px;">
            <option value="">Todas las tiendas</option>
        </select>
        <input id="inv-filtro-q" type="text" class="form-input"
               placeholder="🔍 Buscar modelo..." 
               style="max-width:240px;padding:10px 12px;font-size:13px;" />
    </div>

    <!-- CONTENIDO PRINCIPAL -->
    <div id="inv-contenido">
        <div style="padding:40px;text-align:center;color:var(--text-muted);">
            <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
            <p>Cargando inventario...</p>
        </div>
    </div>

    <!-- MODAL NUEVO ITEM -->
    <div id="modal-inv-nuevo" class="modal-overlay" style="display:none;align-items:center;justify-content:center;">
        <div class="modal-content" style="width:92%;max-width:550px;border-radius:20px;">
            <div class="modal-header">
                <h3><i class="fas fa-box-open" style="color:var(--accent);margin-right:8px;"></i>Registrar en Inventario</h3>
                <button class="close-btn" onclick="_cerrarModalInvNuevo()"><i class="fas fa-times"></i></button>
            </div>
            <div id="modal-inv-cuerpo" style="margin-top:12px;"></div>
        </div>
    </div>

    <!-- MODAL DETALLE / ACCIONES -->
    <div id="modal-inv-detalle" class="modal-overlay" style="display:none;align-items:center;justify-content:center;">
        <div class="modal-content" style="width:92%;max-width:620px;border-radius:20px;">
            <div class="modal-header">
                <h3 id="modal-inv-det-titulo">Detalle</h3>
                <button class="close-btn" onclick="document.getElementById('modal-inv-detalle').style.display='none'">
                    <i class="fas fa-times"></i></button>
            </div>
            <div id="modal-inv-det-cuerpo" style="margin-top:12px;"></div>
        </div>
    </div>
    `;
}

/* ─── Permisos ──────────────────────────────────────────────── */
function _puedeEditarInv() {
    const rol = window.usuarioActivo?.rol || '';
    return ['Admin', 'Jefe_Taller', 'JEFE_TALLER'].includes(rol);
}

/* ─── Cargar maestros ───────────────────────────────────────── */
async function _cargarMaestrosInv() {
    try {
        const [resMat, resCat, resSedes] = await Promise.all([
            fetch(`${API_URL}/api/materiales/listas`),
            fetch(`${API_URL}/api/catalogo`),
            fetch(`${API_URL}/api/sedes`)
        ]);
        const mat   = await resMat.json();
        const cat   = await resCat.json();
        const sedes = await resSedes.json();

        _maestroInv.tableros      = mat.tableros      || [];
        _maestroInv.bases_comedor = mat.bases_comedor || [];
        _maestroInv.catalogo      = cat || [];

        // Poblar selector de sedes en filtros
        const selSede = document.getElementById('inv-filtro-sede');
        if (selSede) sedes.forEach(s => {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.nombre;
            selSede.appendChild(o);
        });
    } catch(e) { console.error('Error maestros inventario:', e); }
}

/* ─── Cambiar Tab ───────────────────────────────────────────── */
async function _invCambiarTab(tab) {
    _invTab = tab;
    ['productos','piezas','historial'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });

    // Actualizar categorías del filtro según tab
    const selCat = document.getElementById('inv-filtro-cat');
    if (selCat) {
        selCat.innerHTML = '<option value="">Todas las categorías</option>';
        if (tab === 'productos') {
            CATEGORIAS_PRODUCTO.forEach(c => {
                selCat.innerHTML += `<option value="${c}">${c}</option>`;
            });
        } else if (tab === 'piezas') {
            CATEGORIAS_PIEZA.forEach(c => {
                selCat.innerHTML += `<option value="${c.val}">${c.label}</option>`;
            });
        }
    }

    _invFiltroCat = '';
    if (selCat) selCat.value = '';
    await _cargarDatosTab();
}

/* ─── Cargar datos según tab activo ─────────────────────────── */
async function _cargarDatosTab() {
    const contenido = document.getElementById('inv-contenido');
    if (!contenido) return;
    contenido.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i></div>`;

    try {
        if (_invTab === 'productos') {
            const p = new URLSearchParams();
            if (_invFiltroCat)  p.set('categoria', _invFiltroCat);
            if (_invFiltroQ)    p.set('q', _invFiltroQ);
            if (_invFiltroSede) p.set('sede_id', _invFiltroSede);
            const res = await fetch(`${API_URL}/api/inventario/resumen?${p}`);
            _invDataProd = await res.json();
            _renderTablaProductos();

        } else if (_invTab === 'piezas') {
            const p = new URLSearchParams();
            if (_invFiltroCat) p.set('categoria', _invFiltroCat);
            if (_invFiltroQ)   p.set('q', _invFiltroQ);
            const res = await fetch(`${API_URL}/api/inventario/piezas/resumen?${p}`);
            _invDataPiezas = await res.json();
            _renderTablaPiezas();

        } else if (_invTab === 'historial') {
            _renderHistorialSelector();
        }
    } catch(e) {
        contenido.innerHTML = `<div style="padding:30px;text-align:center;color:var(--danger);">
            <i class="fas fa-exclamation-triangle"></i> Error cargando datos.</div>`;
    }
}

/* ─── Render: tabla pivot de productos ─────────────────────── */
function _renderTablaProductos() {
    const contenido = document.getElementById('inv-contenido');
    const sedes     = _invDataProd.sedes  || [];
    const modelos   = _invDataProd.modelos || [];

    if (!modelos.length) {
        contenido.innerHTML = _htmlVacio('productos');
        return;
    }

    let html = `
    <div style="overflow-x:auto;border-radius:16px;border:1px solid #e2e8f0;
                box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <table style="width:100%;border-collapse:collapse;min-width:650px;">
        <thead>
            <tr style="background:#f1f5f9;font-size:11px;font-weight:900;
                       text-transform:uppercase;color:var(--text-muted);">
                <th style="padding:12px 16px;text-align:left;position:sticky;
                           left:0;background:#f1f5f9;z-index:2;min-width:200px;">Modelo</th>
                <th style="padding:12px 10px;text-align:center;color:var(--success);">Total Disp.</th>
                ${sedes.map(s=>`<th style="padding:12px 8px;text-align:center;">${s}</th>`).join('')}
                <th style="padding:12px 10px;text-align:center;">Acciones</th>
            </tr>
        </thead>
        <tbody>`;

    modelos.forEach((m, idx) => {
        const bg = idx % 2 === 0 ? 'white' : '#fafbfc';
        const catBadge = `<span style="background:#eff6ff;color:var(--accent);font-size:9px;
            font-weight:900;padding:2px 7px;border-radius:8px;">${m.categoria.toUpperCase()}</span>`;

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
            onmouseover="this.style.background='#eff6ff'"
            onmouseout="this.style.background='${bg}'">
            <td style="padding:12px 16px;position:sticky;left:0;background:inherit;z-index:1;">
                <div style="font-weight:800;font-size:13px;">${m.nombre_modelo}</div>
                <div style="margin-top:3px;">${catBadge}</div>
            </td>
            <td style="padding:12px 10px;text-align:center;">
                <span style="background:${m.disponibles>0?'#dcfce7':'#fee2e2'};
                    color:${m.disponibles>0?'#16a34a':'#dc2626'};
                    font-weight:900;padding:4px 12px;border-radius:8px;font-size:13px;">
                    ${m.disponibles}
                </span>
            </td>
            ${sedes.map(s => {
                const st = (m.sede_stock || {})[s] || {disponibles:0,total:0};
                return `<td style="padding:12px 8px;text-align:center;">
                    <div style="font-weight:700;font-size:13px;
                         color:${st.disponibles>0?'var(--primary)':'#cbd5e1'};">
                        ${st.disponibles}
                    </div>
                    ${st.total > st.disponibles ? `<div style="font-size:10px;color:var(--text-muted);">
                        ${st.total} total</div>` : ''}
                </td>`;
            }).join('')}
            <td style="padding:12px 8px;text-align:center;">
                <button onclick="_invVerUnidades('${m.nombre_modelo.replace(/'/g,"\\'")}','${m.categoria}',${m.catalogo_id||'null'})"
                        style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;
                               color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:700;">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-align:right;">
        ${modelos.length} modelos — "Total Disp." = unidades en estado Disponible
    </div>`;
    contenido.innerHTML = html;
}

/* ─── Render: tabla pivot de piezas ────────────────────────── */
function _renderTablaPiezas() {
    const contenido = document.getElementById('inv-contenido');
    const sedes     = _invDataPiezas.sedes  || [];
    const piezas    = _invDataPiezas.piezas || [];

    if (!piezas.length) {
        contenido.innerHTML = _htmlVacio('piezas');
        return;
    }

    let prevSKU = null;
    let html = `
    <div style="overflow-x:auto;border-radius:16px;border:1px solid #e2e8f0;
                box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <table style="width:100%;border-collapse:collapse;min-width:650px;">
        <thead>
            <tr style="background:#f1f5f9;font-size:11px;font-weight:900;
                       text-transform:uppercase;color:var(--text-muted);">
                <th style="padding:12px 16px;text-align:left;position:sticky;
                           left:0;background:#f1f5f9;z-index:2;min-width:200px;">Modelo</th>
                <th style="padding:12px 10px;text-align:left;">Medida</th>
                <th style="padding:12px 10px;text-align:center;color:var(--success);">Total</th>
                ${sedes.map(s=>`<th style="padding:12px 8px;text-align:center;">${s}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    piezas.forEach((p, idx) => {
        const isNew = p.sku_maestro !== prevSKU;
        prevSKU = p.sku_maestro;
        const bg = idx % 2 === 0 ? 'white' : '#fafbfc';
        const medida = _fmtMedida(p);

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
            onmouseover="this.style.background='#eff6ff'"
            onmouseout="this.style.background='${bg}'">
            <td style="padding:12px 16px;position:sticky;left:0;background:inherit;z-index:1;">
                ${isNew ? `
                <div style="font-weight:800;font-size:13px;">${p.nombre_modelo}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                    <span style="background:#fff7ed;color:#c2410c;font-size:9px;font-weight:900;
                          padding:2px 7px;border-radius:8px;">${p.categoria.toUpperCase()}</span>
                    <span style="margin-left:5px;">${p.material||''} ${p.color_acabado?'· '+p.color_acabado:''}</span>
                </div>
                <div style="font-size:10px;color:#94a3b8;">${p.sku_maestro}</div>
                ` : `<span style="color:#e2e8f0;font-size:11px;">↳</span>`}
            </td>
            <td style="padding:12px 10px;font-weight:700;font-size:12px;">${medida}</td>
            <td style="padding:12px 10px;text-align:center;">
                <span style="background:${p.disponibles>0?'#dcfce7':'#f1f5f9'};
                    color:${p.disponibles>0?'#16a34a':'#94a3b8'};
                    font-weight:900;padding:3px 10px;border-radius:8px;font-size:12px;">
                    ${p.disponibles}
                </span>
            </td>
            ${sedes.map(s=>`<td style="padding:12px 8px;text-align:center;font-weight:700;
                font-size:13px;color:${((p.sede_stock||{})[s]||0)>0?'var(--primary)':'#cbd5e1'};">
                ${(p.sede_stock||{})[s]||0}
            </td>`).join('')}
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenido.innerHTML = html;
}

/* ─── Render: selector de historial ────────────────────────── */
function _renderHistorialSelector() {
    const sedes = [];
    document.querySelectorAll('#inv-filtro-sede option').forEach(o => {
        if (o.value) sedes.push({ id: o.value, nombre: o.textContent });
    });

    const contenido = document.getElementById('inv-contenido');
    contenido.innerHTML = `
    <div style="background:white;border-radius:16px;padding:25px;border:1px solid #e2e8f0;">
        <p style="font-weight:700;color:var(--text-muted);font-size:13px;margin-bottom:15px;">
            Selecciona una tienda para ver sus últimos 50 movimientos:
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${sedes.map(s=>`
            <button onclick="_invCargarHistorialSede(${s.id},'${s.nombre}')"
                    style="background:#f1f5f9;border:none;padding:12px 18px;border-radius:12px;
                           font-weight:700;cursor:pointer;color:var(--primary);font-size:13px;
                           transition:0.2s;" onmouseover="this.style.background='#eff6ff'"
                    onmouseout="this.style.background='#f1f5f9'">
                <i class="fas fa-store"></i> ${s.nombre}
            </button>`).join('')}
        </div>
        <div id="inv-historial-tabla" style="margin-top:20px;"></div>
    </div>`;
}

async function _invCargarHistorialSede(sedeId, sedeNombre) {
    const wrap = document.getElementById('inv-historial-tabla');
    wrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin"></i> Cargando...</div>`;
    try {
        const res  = await fetch(`${API_URL}/api/inventario/historial/sede/${sedeId}`);
        const rows = await res.json();

        if (!rows.length) {
            wrap.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">
                Sin movimientos registrados para ${sedeNombre}.</p>`;
            return;
        }

        const colorEvento = {
            'Ingreso':    '#dcfce7', 'Traslado':  '#dbeafe', 'Venta':     '#fef3c7',
            'Reserva':    '#ede9fe', 'Ajuste':    '#f1f5f9', 'Baja':      '#fee2e2',
            'Devolucion': '#fce7f3'
        };

        let tabla = `
        <h4 style="margin:0 0 12px 0;font-weight:800;">Movimientos — ${sedeNombre}</h4>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:#f1f5f9;font-weight:900;color:var(--text-muted);">
                    <th style="padding:8px 10px;text-align:left;">Fecha</th>
                    <th style="padding:8px 10px;text-align:left;">Evento</th>
                    <th style="padding:8px 10px;text-align:left;">Código</th>
                    <th style="padding:8px 10px;text-align:left;">Desde → Hasta</th>
                    <th style="padding:8px 10px;text-align:left;">Usuario</th>
                    <th style="padding:8px 10px;text-align:left;">Notas</th>
                </tr>
            </thead><tbody>`;

        rows.forEach(r => {
            const bgEvento = colorEvento[r.evento] || '#f1f5f9';
            tabla += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 10px;color:var(--text-muted);">${r.fecha}</td>
                <td style="padding:8px 10px;">
                    <span style="background:${bgEvento};padding:3px 8px;border-radius:6px;
                          font-weight:800;font-size:10px;">${r.evento}</span>
                </td>
                <td style="padding:8px 10px;font-weight:700;color:var(--accent);">${r.codigo_barra}</td>
                <td style="padding:8px 10px;">
                    ${r.sede_origen||'—'} ${r.sede_destino&&r.sede_destino!==r.sede_origen?'→ '+r.sede_destino:''}
                </td>
                <td style="padding:8px 10px;">${r.usuario||'—'}</td>
                <td style="padding:8px 10px;color:var(--text-muted);max-width:160px;
                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" 
                     title="${r.notas||''}">${r.notas||'—'}</td>
            </tr>`;
        });
        tabla += `</tbody></table></div>`;
        wrap.innerHTML = tabla;
    } catch(e) {
        wrap.innerHTML = `<p style="color:var(--danger);">Error: ${e.message}</p>`;
    }
}

/* ─── Buscar por código de barras ───────────────────────────── */
async function _invBuscarBarcode(barcode) {
    barcode = (barcode || '').trim();
    if (!barcode) return;
    try {
        const res = await fetch(`${API_URL}/api/inventario/buscar/${encodeURIComponent(barcode)}`);
        const d   = await res.json();
        if (d.error) { Swal.fire('No encontrado', d.error, 'warning'); return; }
        _invMostrarDetalleUnidad(d);
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

function _invMostrarDetalleUnidad(d) {
    const esProducto = d.tipo === 'producto';
    const estadoColor = {
        'Disponible': '#dcfce7', 'Reservado': '#fef3c7',
        'Vendido': '#fee2e2', 'En Traslado': '#dbeafe',
        'Dañado': '#fee2e2', 'Baja': '#f1f5f9'
    };

    let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;">
        <div class="specs-section">
            <h4>Identificación</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Código:</b> <span style="color:var(--accent);font-weight:900;">${d.codigo_barra}</span></p>
            <p style="margin:4px 0;font-size:13px;"><b>Modelo:</b> ${d.nombre_modelo}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Categoría:</b> ${d.categoria}</p>
        </div>
        <div class="specs-section">
            <h4>Ubicación y Estado</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Sede:</b> ${d.sede}</p>
            <p style="margin:4px 0;"><span style="background:${estadoColor[d.estado]||'#f1f5f9'};
               padding:4px 10px;border-radius:8px;font-weight:800;font-size:12px;">${d.estado}</span></p>
            <p style="margin:4px 0;font-size:12px;color:var(--text-muted);">Ingreso: ${d.fecha_ingreso||'—'}</p>
        </div>
    </div>`;

    if (esProducto) {
        html += `<div class="specs-section">
            <h4>Detalles</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Color/Tela:</b> ${d.color_tela||'—'}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Acabado:</b> ${d.acabado||'—'}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Costo:</b> S/ ${d.costo_ingreso||'—'}</p>
        </div>`;
    } else {
        html += `<div class="specs-section">
            <h4>Medidas</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Material:</b> ${d.material||'—'} ${d.color_acabado?'· '+d.color_acabado:''}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Forma:</b> ${d.forma}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Medida:</b> ${_fmtMedidaObj(d)}</p>
        </div>`;
    }

    // Acciones (solo si puede editar)
    if (_puedeEditarInv()) {
        const estados = ['Disponible','Reservado','En Traslado','Dañado','Baja'];
        html += `
        <div style="margin-top:15px;border-top:1px solid #e2e8f0;padding-top:15px;">
            <p style="font-size:12px;font-weight:800;color:var(--text-muted);margin-bottom:8px;">CAMBIAR ESTADO / TRASLADAR</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                ${estados.map(e => `
                <button onclick="_invCambiarEstadoDesdeModal('${d.tipo}',${d.id},'${e}','${d.codigo_barra}')"
                        style="background:${e===d.estado?'var(--primary)':'#f1f5f9'};
                               color:${e===d.estado?'white':'var(--text-muted)'};
                               border:none;padding:6px 12px;border-radius:8px;
                               font-weight:700;cursor:pointer;font-size:11px;">
                    ${e}</button>`).join('')}
            </div>
            <button onclick="_invVerHistorialUnidad('${d.tipo}',${d.id})"
                    style="background:none;border:1px solid #e2e8f0;padding:8px 14px;
                           border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                           color:var(--text-muted);">
                <i class="fas fa-history"></i> Ver historial completo
            </button>
        </div>`;
    }

    document.getElementById('modal-inv-det-titulo').textContent =
        `${d.nombre_modelo} — ${d.codigo_barra}`;
    document.getElementById('modal-inv-det-cuerpo').innerHTML = html;
    document.getElementById('modal-inv-detalle').style.display = 'flex';
}

async function _invCambiarEstadoDesdeModal(tipo, id, estadoNuevo, barcode) {
    const { value: datos } = await Swal.fire({
        title:  `Cambiar a: ${estadoNuevo}`,
        html: `
            ${estadoNuevo === 'En Traslado' ? `
            <select id="swal-sede-dest" class="swal2-input" style="margin:8px 0;">
                <option value="">— Sede destino —</option>
                ${[...document.querySelectorAll('#inv-filtro-sede option')]
                    .filter(o=>o.value)
                    .map(o=>`<option value="${o.value}">${o.textContent}</option>`)
                    .join('')}
            </select>` : ''}
            <input id="swal-notas" class="swal2-input" placeholder="Motivo / notas" style="margin:8px 0;">
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => ({
            notas:          document.getElementById('swal-notas')?.value || '',
            sede_destino_id: document.getElementById('swal-sede-dest')?.value || null,
        })
    });
    if (!datos) return;

    const tipoEvento = {
        'En Traslado': 'Traslado', 'Vendido': 'Venta',
        'Baja': 'Baja', 'Disponible': 'Ajuste', 'Reservado': 'Reserva'
    }[estadoNuevo] || 'Ajuste';

    try {
        const res = await fetch(`${API_URL}/api/inventario/${tipo}/${id}/estado`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado_nuevo:    estadoNuevo,
                sede_destino_id: datos.sede_destino_id || null,
                tipo_evento:     tipoEvento,
                usuario_id:      window.usuarioActivo?.id,
                usuario_rol:     window.usuarioActivo?.rol,
                usuario_nombre:  window.usuarioActivo?.nombre,
                notas:           datos.notas,
            })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        Swal.fire({ icon:'success', title:'¡Actualizado!', timer:1500, showConfirmButton:false });
        document.getElementById('modal-inv-detalle').style.display = 'none';
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function _invVerHistorialUnidad(tipo, id) {
    try {
        const res  = await fetch(`${API_URL}/api/inventario/historial/${tipo}/${id}`);
        const rows = await res.json();
        if (!rows.length) { Swal.fire('Sin historial', 'Esta unidad no tiene movimientos registrados.', 'info'); return; }
        let tabla = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr style="background:#f1f5f9;font-weight:900;">
                <th style="padding:7px;">Fecha</th><th style="padding:7px;">Evento</th>
                <th style="padding:7px;">De → A</th><th style="padding:7px;">Usuario</th>
                <th style="padding:7px;">Notas</th>
            </tr>`;
        rows.forEach(r => {
            tabla += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px;color:var(--text-muted);">${r.fecha}</td>
                <td style="padding:7px;font-weight:800;">${r.evento}</td>
                <td style="padding:7px;">${r.sede_origen||'—'}${r.sede_destino&&r.sede_destino!==r.sede_origen?' → '+r.sede_destino:''}</td>
                <td style="padding:7px;">${r.usuario||'—'}</td>
                <td style="padding:7px;color:var(--text-muted);">${r.notas||'—'}</td>
            </tr>`;
        });
        tabla += `</table>`;
        Swal.fire({ title:'Historial', html:tabla, width:650, confirmButtonColor:'#0f172a' });
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ─── Modal: Registrar nuevo item ───────────────────────────── */
function abrirModalNuevoItem() {
    if (!_puedeEditarInv()) { Swal.fire('Sin permisos', 'Solo Admin o Jefe de Taller.', 'warning'); return; }
    const cuerpo = document.getElementById('modal-inv-cuerpo');
    const esProds = _invTab !== 'piezas';

    cuerpo.innerHTML = esProds ? _formProducto() : _formPieza();
    document.getElementById('modal-inv-nuevo').style.display = 'flex';
}

function _cerrarModalInvNuevo() {
    document.getElementById('modal-inv-nuevo').style.display = 'none';
}

function _formProducto() {
    const sedes = [...document.querySelectorAll('#inv-filtro-sede option')]
        .filter(o=>o.value)
        .map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');
    const cats  = CATEGORIAS_PRODUCTO.map(c=>`<option value="${c}">${c}</option>`).join('');
    const prods = _maestroInv.catalogo.map(p=>
        `<option value="${p.id}|${(p.nombre||p.nombre_modelo||'').replace(/"/g,'')}">${p.nombre||p.nombre_modelo}</option>`
    ).join('');

    return `
    <div class="form-group"><label>Categoría *</label>
        <select id="nf-cat" class="form-input">${cats}</select></div>
    <div class="form-group"><label>Modelo del Catálogo</label>
        <select id="nf-catalogo" class="form-input" onchange="_invSelCatalogo()">
            <option value="">— O escribir manualmente —</option>${prods}</select></div>
    <div class="form-group"><label>Nombre Modelo *</label>
        <input id="nf-nombre" type="text" class="form-input" placeholder="Sofá Venecia 3 cuerpos" /></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group"><label>Color / Tela</label>
            <input id="nf-color" type="text" class="form-input" placeholder="Beige" /></div>
        <div class="form-group"><label>Acabado</label>
            <input id="nf-acabado" type="text" class="form-input" placeholder="Liso" /></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group"><label>Sede *</label>
            <select id="nf-sede" class="form-input"><option value="">— Seleccionar —</option>${sedes}</select></div>
        <div class="form-group"><label>Costo Ingreso (S/)</label>
            <input id="nf-costo" type="number" class="form-input" placeholder="0.00" step="0.01"/></div>
    </div>
    <div class="form-group"><label>Observaciones</label>
        <input id="nf-obs" type="text" class="form-input" placeholder="Opcional" /></div>
    <button onclick="_invGuardarProducto()" class="btn-action btn-primary" style="margin-top:10px;">
        <i class="fas fa-save"></i> Registrar y Generar Código
    </button>
    <button onclick="_cerrarModalInvNuevo()" class="btn-action btn-ghost">Cancelar</button>`;
}

function _invSelCatalogo() {
    const sel = document.getElementById('nf-catalogo');
    if (!sel.value) return;
    const [, nombre] = sel.value.split('|');
    const nf = document.getElementById('nf-nombre');
    if (nf) nf.value = nombre;
}

function _formPieza() {
    const sedes = [...document.querySelectorAll('#inv-filtro-sede option')]
        .filter(o=>o.value)
        .map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');
    const cats  = CATEGORIAS_PIEZA.map(c=>`<option value="${c.val}">${c.label}</option>`).join('');
    const tabs  = _maestroInv.tableros.map(t=>
        `<option value="${t.sku}|${(t.nombre||'').replace(/"/g,'')}|${t.material_base||''}|${t.color||''}">${t.sku} — ${t.nombre}</option>`
    ).join('');
    const bases = _maestroInv.bases_comedor.map(b=>
        `<option value="${b.sku}|${(b.modelo||'').replace(/"/g,'')}|${b.material||''}|${b.color||''}">${b.sku} — ${b.modelo}</option>`
    ).join('');

    return `
    <div class="form-group"><label>Categoría *</label>
        <select id="npf-cat" class="form-input" onchange="_invActualizarModelosPieza()">${cats}</select></div>
    <div class="form-group"><label>Modelo Maestro *</label>
        <select id="npf-sku" class="form-input" onchange="_invSelModeloPieza()">
            <option value="">— Seleccionar —</option>${tabs}</select></div>
    <input type="hidden" id="npf-sku-val"/>
    <input type="hidden" id="npf-nombre-val"/>
    <input type="hidden" id="npf-mat-val"/>
    <input type="hidden" id="npf-color-val"/>
    <div class="form-group"><label>Forma *</label>
        <select id="npf-forma" class="form-input" onchange="_invToggleMedidasPieza()">
            <option value="Rectangular">Rectangular</option>
            <option value="Circular">Circular (diámetro)</option>
            <option value="Irregular">Irregular</option>
        </select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div class="form-group"><label id="npf-lbl-largo">Largo (cm) *</label>
            <input id="npf-largo" type="number" class="form-input" placeholder="160" min="1"/></div>
        <div class="form-group" id="npf-wrap-ancho"><label>Ancho (cm)</label>
            <input id="npf-ancho" type="number" class="form-input" placeholder="90" min="1"/></div>
        <div class="form-group"><label>Alto (cm)</label>
            <input id="npf-alto" type="number" class="form-input" placeholder="72" min="1"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div class="form-group"><label>Sede *</label>
            <select id="npf-sede" class="form-input"><option value="">—</option>${sedes}</select></div>
        <div class="form-group"><label>Cantidad</label>
            <input id="npf-cantidad" type="number" class="form-input" value="1" min="1"/></div>
        <div class="form-group"><label>Costo (S/)</label>
            <input id="npf-costo" type="number" class="form-input" placeholder="0.00" step="0.01"/></div>
    </div>
    <div class="form-group"><label>Proveedor</label>
        <input id="npf-proveedor" type="text" class="form-input" placeholder="Mármoles Perú"/></div>
    <button onclick="_invGuardarPieza()" class="btn-action btn-primary" style="margin-top:10px;">
        <i class="fas fa-save"></i> Registrar y Generar Código(s)
    </button>
    <button onclick="_cerrarModalInvNuevo()" class="btn-action btn-ghost">Cancelar</button>`;
}

function _invActualizarModelosPieza() {
    const cat = document.getElementById('npf-cat')?.value;
    const sel = document.getElementById('npf-sku');
    if (!sel) return;
    const lista = (cat === 'tablero')
        ? _maestroInv.tableros.map(t=>`<option value="${t.sku}|${(t.nombre||'').replace(/"/g,'')}|${t.material_base||''}|${t.color||''}">${t.sku} — ${t.nombre}</option>`).join('')
        : _maestroInv.bases_comedor.map(b=>`<option value="${b.sku}|${(b.modelo||'').replace(/"/g,'')}|${b.material||''}|${b.color||''}">${b.sku} — ${b.modelo}</option>`).join('');
    sel.innerHTML = `<option value="">— Seleccionar —</option>${lista}`;
}

function _invSelModeloPieza() {
    const val = document.getElementById('npf-sku')?.value;
    if (!val) return;
    const [sku, nombre, mat, color] = val.split('|');
    document.getElementById('npf-sku-val').value    = sku;
    document.getElementById('npf-nombre-val').value = nombre;
    document.getElementById('npf-mat-val').value    = mat;
    document.getElementById('npf-color-val').value  = color;
}

function _invToggleMedidasPieza() {
    const forma = document.getElementById('npf-forma')?.value;
    const lblLargo  = document.getElementById('npf-lbl-largo');
    const wrapAncho = document.getElementById('npf-wrap-ancho');
    if (!lblLargo) return;
    lblLargo.textContent = forma === 'Circular' ? 'Diámetro (cm) *' : 'Largo (cm) *';
    if (wrapAncho) wrapAncho.style.display = forma === 'Circular' ? 'none' : '';
}

async function _invGuardarProducto() {
    const nombre = document.getElementById('nf-nombre')?.value;
    const cat    = document.getElementById('nf-cat')?.value;
    const sedeId = document.getElementById('nf-sede')?.value;
    if (!nombre || !cat || !sedeId) {
        Swal.fire('Incompleto', 'Completa Categoría, Modelo y Sede.', 'warning'); return;
    }
    const catStr = document.getElementById('nf-catalogo')?.value || '';
    const catId  = catStr.split('|')[0] ? parseInt(catStr.split('|')[0]) : null;

    try {
        const res = await fetch(`${API_URL}/api/inventario/producto/nuevo`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_id:    catId,
                nombre_modelo:  nombre,
                categoria:      cat,
                color_tela:     document.getElementById('nf-color')?.value,
                acabado:        document.getElementById('nf-acabado')?.value,
                observaciones:  document.getElementById('nf-obs')?.value,
                sede_id:        parseInt(sedeId),
                costo_ingreso:  parseFloat(document.getElementById('nf-costo')?.value) || null,
                usuario_id:     window.usuarioActivo?.id,
                usuario_rol:    window.usuarioActivo?.rol,
                usuario_nombre: window.usuarioActivo?.nombre,
            })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        Swal.fire({
            icon: 'success', title: '¡Registrado!',
            html: `Código de barras generado:<br><b style="font-size:1.3rem;color:var(--accent);">${d.codigo_barra}</b>`,
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function _invGuardarPieza() {
    const sku    = document.getElementById('npf-sku-val')?.value;
    const nombre = document.getElementById('npf-nombre-val')?.value;
    const cat    = document.getElementById('npf-cat')?.value;
    const forma  = document.getElementById('npf-forma')?.value;
    const sedeId = document.getElementById('npf-sede')?.value;
    if (!sku || !nombre || !sedeId) {
        Swal.fire('Incompleto', 'Selecciona el modelo y la sede.', 'warning'); return;
    }
    try {
        const res = await fetch(`${API_URL}/api/inventario/pieza/nueva`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku_maestro:    sku,
                nombre_modelo:  nombre,
                categoria:      cat,
                material:       document.getElementById('npf-mat-val')?.value,
                color_acabado:  document.getElementById('npf-color-val')?.value,
                forma,
                largo_cm:  parseFloat(document.getElementById('npf-largo')?.value)    || null,
                ancho_cm:  parseFloat(document.getElementById('npf-ancho')?.value)    || null,
                alto_cm:   parseFloat(document.getElementById('npf-alto')?.value)     || null,
                sede_id:   parseInt(sedeId),
                cantidad:  parseInt(document.getElementById('npf-cantidad')?.value)   || 1,
                costo_ingreso: parseFloat(document.getElementById('npf-costo')?.value) || null,
                proveedor: document.getElementById('npf-proveedor')?.value,
                usuario_id:     window.usuarioActivo?.id,
                usuario_rol:    window.usuarioActivo?.rol,
                usuario_nombre: window.usuarioActivo?.nombre,
            })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        const codigos = (d.unidades || []).map(u=>u.codigo_barra).join('<br>');
        Swal.fire({
            icon: 'success', title: `¡${d.unidades.length} pieza(s) registradas!`,
            html: `Códigos generados:<br><b style="color:var(--accent);">${codigos}</b>`,
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ─── Ver unidades de un modelo ─────────────────────────────── */
async function _invVerUnidades(nombre, categoria, catalogoId) {
    try {
        const p = new URLSearchParams({ categoria, q: nombre });
        const res  = await fetch(`${API_URL}/api/inventario/resumen?${p}`);
        const data = await res.json();
        const m    = (data.modelos||[]).find(x=>x.nombre_modelo===nombre);
        if (!m) { Swal.fire('Sin datos', '', 'info'); return; }

        let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:15px;">`;
        (data.sedes||[]).forEach(s => {
            const st = (m.sede_stock||{})[s] || {disponibles:0,total:0};
            html += `<div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;border:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:6px;">${s}</div>
                <div style="font-size:2rem;font-weight:900;color:${st.disponibles>0?'#16a34a':'#cbd5e1'};">${st.disponibles}</div>
                <div style="font-size:10px;color:var(--text-muted);">disponibles</div>
                ${st.total>st.disponibles?`<div style="font-size:10px;color:var(--text-muted);">${st.total} total</div>`:''}
            </div>`;
        });
        html += `</div>`;

        Swal.fire({
            title: nombre,
            html, width: 680,
            confirmButtonColor: '#0f172a',
            confirmButtonText: 'Cerrar'
        });
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ─── Helpers ────────────────────────────────────────────────── */
function _fmtMedida(p) {
    if (p.forma === 'Circular') return p.largo_cm ? `⌀ ${p.largo_cm} cm` : 'Circular';
    if (p.forma === 'Rectangular') {
        const l = p.largo_cm ? `${p.largo_cm}` : '?';
        const a = p.ancho_cm ? ` × ${p.ancho_cm}` : '';
        const h = p.alto_cm  ? ` / H:${p.alto_cm}` : '';
        return `${l}${a} cm${h}`;
    }
    return p.largo_cm ? `${p.largo_cm} cm` : 'Irregular';
}

function _fmtMedidaObj(d) {
    if (d.forma === 'Circular') return d.largo_cm ? `⌀ ${d.largo_cm} cm` : '—';
    const l = d.largo_cm ? `${d.largo_cm}` : '?';
    const a = d.ancho_cm ? ` × ${d.ancho_cm}` : '';
    const h = d.alto_cm  ? ` / H:${d.alto_cm}` : '';
    return `${l}${a} cm${h}`;
}

function _htmlVacio(tipo) {
    return `<div style="padding:50px;text-align:center;color:var(--text-muted);">
        <i class="fas fa-box-open" style="font-size:3rem;opacity:0.3;margin-bottom:15px;"></i>
        <p style="font-weight:700;">Sin ${tipo} registrados aún.</p>
        ${_puedeEditarInv() ? `<button onclick="abrirModalNuevoItem()"
            style="margin-top:10px;background:var(--accent);color:white;border:none;
                   padding:10px 20px;border-radius:10px;font-weight:800;cursor:pointer;">
            + Registrar el primero</button>` : ''}
    </div>`;
}

function _invExportarCSV() {
    window.open(`${API_URL}/api/inventario/exportar`, '_blank');
}

/* ─── Bind eventos (filtros con debounce) ───────────────────── */
function _bindInvEventos() {
    // Poblar categorías iniciales (tab Productos)
    const selCat = document.getElementById('inv-filtro-cat');
    if (selCat) CATEGORIAS_PRODUCTO.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c; selCat.appendChild(o);
    });

    document.getElementById('inv-filtro-cat')?.addEventListener('change', async e => {
        _invFiltroCat = e.target.value;
        await _cargarDatosTab();
    });

    document.getElementById('inv-filtro-sede')?.addEventListener('change', async e => {
        _invFiltroSede = e.target.value;
        await _cargarDatosTab();
    });

    let debounce;
    document.getElementById('inv-filtro-q')?.addEventListener('input', e => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            _invFiltroQ = e.target.value.trim();
            await _cargarDatosTab();
        }, 350);
    });
}