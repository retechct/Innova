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
let _maestroInv = { tableros: [], bases_comedor: [], sillas: [], butacas: [], catalogo: [], cargado: false };

const CATEGORIAS_PRODUCTO = [
    'Sofa','Butaca','Silla','Espejo','Cuadro','Cojin','Mesa Centro','Consola'
];
const CATEGORIAS_PIEZA = [
    { val: 'tablero',          label: 'Tablero (piedra / vidrio / madera)' },
    { val: 'base-comedor',     label: 'Base de Comedor' },
    { val: 'base-consola',     label: 'Base de Consola' },
    { val: 'base-mesa-centro', label: 'Base de Mesa de Centro' },
    { val: 'silla',            label: 'Silla' },
    { val: 'butaca',           label: 'Butaca' },
];
/* ─── Punto de entrada ─────────────────────────────────────── */
async function cargarVistaInventario() {
    const main = document.getElementById('main-content');
    
    // Creamos y usamos un contenedor dinámico sin borrar las demás vistas de la página
    let wrapper = document.getElementById('inv-dinamico-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'inv-dinamico-wrapper';
        main.appendChild(wrapper);
    }
    wrapper.innerHTML = _htmlEsqueleto();
    
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
            ${_puedeEditarInv() ? `
            <button onclick="_invImprimirMasivo()" 
                    style="background:var(--primary);color:white;border:none;padding:10px 16px;
                           border-radius:10px;font-weight:800;cursor:pointer;font-size:12px;
                           display:flex;align-items:center;gap:6px;">
                <i class="fas fa-barcode"></i> Imprimir SKUs
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
                   placeholder="Escanear código..." 
                   style="max-width:200px;padding:8px 12px;font-size:13px;"
                   onkeydown="if(event.key==='Enter') _invBuscarBarcode(this.value)" />
            <button onclick="_invBuscarBarcode(document.getElementById('inv-barcode-input').value)"
                    style="background:var(--primary);color:white;border:none;padding:8px 14px;
                           border-radius:10px;cursor:pointer;font-size:13px;">
                <i class="fas fa-search"></i>
            </button>
            <button onclick="_iniciarEscaneoCamara()" title="Escanear con cámara"
                    style="background:#1e293b;color:white;border:none;padding:8px 14px;
                           border-radius:10px;cursor:pointer;font-size:13px;">
                <i class="fas fa-camera"></i>
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
               placeholder="Buscar modelo..." 
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
        <div class="modal-content" style="width:92%;max-width:620px;border-radius:20px;max-height:90vh;display:flex;flex-direction:column;">
            <div class="modal-header" style="flex-shrink:0;">
                <h3 id="modal-inv-det-titulo">Detalle</h3>
                <button class="close-btn" onclick="document.getElementById('modal-inv-detalle').style.display='none'">
                    <i class="fas fa-times"></i></button>
            </div>
            <div id="modal-inv-det-cuerpo" style="margin-top:12px;overflow-y:auto;overflow-x:hidden;padding-right:4px;"></div>
        </div>
    </div>

    <!-- MODAL ESCANER CAMARA -->
    <div id="modal-scanner-inv" class="modal-overlay" style="display:none;align-items:center;justify-content:center;z-index:99999;">
        <div class="modal-content" style="width:92%;max-width:500px;border-radius:16px;padding:20px;text-align:center;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;"><i class="fas fa-camera"></i> Escanear Código</h3>
                <button onclick="_cerrarEscaneoCamara()" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
            </div>
            <div id="reader-inv" style="width:100%; min-height:250px; background:#f1f5f9; border-radius:8px; overflow:hidden;"></div>
            <p style="font-size:12px;color:gray;margin-top:10px;">Apunta la cámara del celular al código de barras impreso.</p>
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
    // Guard: no recargar si ya están en memoria (evita 3 requests redundantes
    // cuando el usuario navega entre tabs o vuelve a la vista)
    if (_maestroInv.cargado) return;

    try {
        const [resMat, resCat, resSedes] = await Promise.all([
            apiFetch(`${API_URL}/api/materiales/listas`),
            apiFetch(`${API_URL}/api/catalogo`),
            apiFetch(`${API_URL}/api/sedes`)
        ]);
        const mat   = await resMat.json();
        const cat   = await resCat.json();
        const sedes = await resSedes.json();

        _maestroInv.tableros      = mat.tableros      || [];
        _maestroInv.bases_comedor = mat.bases_comedor || [];
        _maestroInv.sillas        = mat.sillas        || [];
        _maestroInv.butacas       = mat.butacas       || [];
        _maestroInv.catalogo      = cat || [];
        _maestroInv.cargado       = true;

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
            const res = await apiFetch(`${API_URL}/api/inventario/resumen?${p}`);
            _invDataProd = await res.json();
            _renderTablaProductos();

        } else if (_invTab === 'piezas') {
            const p = new URLSearchParams();
            if (_invFiltroCat) p.set('categoria', _invFiltroCat);
            if (_invFiltroQ)   p.set('q', _invFiltroQ);
            const res = await apiFetch(`${API_URL}/api/inventario/piezas/resumen?${p}`);
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
                <th style="padding:12px 16px;text-align:left;position:sticky;left:0;background:#f1f5f9;z-index:2;min-width:200px;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="checkbox" onchange="document.querySelectorAll('.chk-prod').forEach(c=>c.checked=this.checked)">
                        <span>Modelo</span>
                    </div>
                </th>
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
                <div style="display:flex; gap:10px; align-items:flex-start;">
                    <input type="checkbox" class="chk-prod" value="${encodeURIComponent(JSON.stringify(m))}" data-cant="${m.disponibles}" style="margin-top:2px;">
                    <div>
                        <div style="font-weight:800;font-size:13px;">${m.nombre_modelo}</div>
                        <div style="margin-top:3px;">${catBadge}</div>
                    </div>
                </div>
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
            <td style="padding:12px 8px;text-align:center;display:flex;gap:4px;justify-content:center;">
                <button onclick="_invImprimirFisico('${encodeURIComponent(JSON.stringify(m))}')"
                        style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px;
                               color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:700;" title="Imprimir Código Físico">
                    <i class="fas fa-barcode"></i> SKU
                </button>
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
                <th style="padding:12px 16px;text-align:left;position:sticky;left:0;background:#f1f5f9;z-index:2;min-width:200px;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="checkbox" onchange="document.querySelectorAll('.chk-pieza').forEach(c=>c.checked=this.checked)">
                        <span>Modelo</span>
                    </div>
                </th>
                <th style="padding:12px 10px;text-align:left;">Medida</th>
                <th style="padding:12px 10px;text-align:center;color:var(--success);">Total</th>
                ${sedes.map(s=>`<th style="padding:12px 8px;text-align:center;">${s}</th>`).join('')}
                <th style="padding:12px 10px;text-align:center;">Acciones</th>
            </tr>
        </thead>
        <tbody>`;

    piezas.forEach((p, idx) => {
        const isNew = p.sku_maestro !== prevSKU;
        prevSKU = p.sku_maestro;
        const bg = idx % 2 === 0 ? 'white' : '#fafbfc';
        const medida = _fmtMedida(p);
        const nombreConMedida = `${p.nombre_modelo} - ${medida.toUpperCase()}`;
        const pObj = { ...p, nombreConMedida };

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
            onmouseover="this.style.background='#eff6ff'"
            onmouseout="this.style.background='${bg}'">
            <td style="padding:12px 16px;position:sticky;left:0;background:inherit;z-index:1;">
                <div style="display:flex; gap:10px; align-items:flex-start;">
                    <input type="checkbox" class="chk-pieza" value="${encodeURIComponent(JSON.stringify(pObj))}" data-cant="${p.disponibles}" style="margin-top:2px;">
                    <div>
                        ${isNew ? `
                        <div style="font-weight:800;font-size:13px;">${p.nombre_modelo}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                            <span style="background:#fff7ed;color:#c2410c;font-size:9px;font-weight:900;
                                  padding:2px 7px;border-radius:8px;">${p.categoria.toUpperCase()}</span>
                            <span style="margin-left:5px;">${p.material||''} ${p.color_acabado?'· '+p.color_acabado:''}</span>
                        </div>
                        <div style="font-size:10px;color:#94a3b8;">${p.sku_maestro}</div>
                        ` : `<span style="color:#e2e8f0;font-size:11px;">↳</span>`}
                    </div>
                </div>
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
            <td style="padding:12px 8px;text-align:center;display:flex;gap:4px;justify-content:center;">
                <button onclick="_invImprimirFisico('${encodeURIComponent(JSON.stringify(pObj))}')"
                        style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px;
                               color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:700;" title="Imprimir Código Físico">
                    <i class="fas fa-barcode"></i> SKU
                </button>
                ${isNew ? `
                <button onclick="_invVerUnidades('${p.nombre_modelo.replace(/'/g,"\\'")}','${p.categoria}','es_pieza')"
                        style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;
                               color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:700;" title="Ver Stock Físico">
                    <i class="fas fa-eye"></i> Ver
                </button>` : '<div style="width:55px;"></div>'}
            </td>
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
        const res  = await apiFetch(`${API_URL}/api/inventario/historial/sede/${sedeId}`);
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
        // 1. Interceptar escaneo de código genérico de estante (PROD-XX)
        if (barcode.startsWith('PROD-')) {
            const catId = barcode.split('-')[1];
            const catItem = _maestroInv.catalogo.find(c => c.id == catId);
            if (catItem) {
                Swal.fire({ title: 'Etiqueta de Estante', text: 'Escaneaste la etiqueta general del modelo. Mostrando el stock disponible en tienda...', icon: 'info', timer: 2500, showConfirmButton: false });
                _invVerUnidades(catItem.nombre || catItem.nombre_modelo, catItem.categoria, catId);
                return;
            }
        }

        // 2. Búsqueda normal de unidad física
        const res = await apiFetch(`${API_URL}/api/inventario/buscar/${encodeURIComponent(barcode)}`);
        const d   = await res.json();
        if (d.error) { 
            // 3. Interceptar escaneo de SKU Maestro (Piezas)
            const esPiezaMaestro = _invDataPiezas.piezas.find(p => p.sku_maestro === barcode);
            if (esPiezaMaestro) {
                Swal.fire({ title: 'Etiqueta de Estante', text: 'Escaneaste el SKU general de la pieza. Mostrando el stock disponible en tienda...', icon: 'info', timer: 2500, showConfirmButton: false });
                _invVerUnidades(esPiezaMaestro.nombre_modelo, esPiezaMaestro.categoria, 'es_pieza');
                return;
            }
            Swal.fire('No encontrado', 'El código no pertenece a ninguna unidad física ni modelo registrado.', 'warning'); 
            return; 
        }
        await _invMostrarDetalleUnidad(d);
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function _invMostrarDetalleUnidad(d) {
    const esProducto = d.tipo === 'producto';
    const estadoColor = {
        'Disponible': '#dcfce7', 'Reservado': '#fef3c7',
        'Vendido': '#fee2e2', 'En Traslado': '#dbeafe',
        'Dañado': '#fee2e2', 'Baja': '#f1f5f9'
    };

    // 1. Intentar recuperar foto: primero en memoria, luego request al backend
    let fotoUrlFinal = d.foto_url;
    if (!fotoUrlFinal && d.tipo !== 'producto') {
        const cat = (d.categoria || '').toLowerCase();
        let lista = [];
        if (cat === 'tablero') lista = _maestroInv.tableros || [];
        else if (cat === 'silla') lista = _maestroInv.sillas || [];
        else if (cat === 'butaca') lista = _maestroInv.butacas || [];
        else if (cat.includes('base')) lista = _maestroInv.bases_comedor || [];

        const f = lista.find(x =>
            (x.nombre_modelo && x.nombre_modelo.toLowerCase() === (d.nombre_modelo || '').toLowerCase()) ||
            (x.modelo && x.modelo.toLowerCase() === (d.nombre_modelo || '').toLowerCase()) ||
            (x.nombre && x.nombre.toLowerCase() === (d.nombre_modelo || '').toLowerCase())
        );
        if (f && f.foto_url) {
            fotoUrlFinal = f.foto_url;
        } else {
            // Fallback: pedir al backend directamente (cubre el caso donde
            // _maestroInv no estaba cargado porque el usuario llegó desde otra vista)
            try {
                const params = new URLSearchParams({ tipo: cat, modelo: d.nombre_modelo || '' });
                const resFoto = await apiFetch(`${API_URL}/api/materiales/maestro/buscar?${params}`);
                const dataFoto = await resFoto.json();
                if (dataFoto.foto_url) fotoUrlFinal = dataFoto.foto_url;
            } catch(e) {
                console.warn('[inventario] No se pudo obtener foto del maestro:', e);
            }
        }
    }

    // ✅ FUNCIÓN HELPER: Extraer URL limpia y validar
    function obtenerFotoLimpia(url) {
        if (!url) return null;
        // Si contiene |, tomar la primera parte (puede ser múltiples fotos separadas por |)
        return url.split('|')[0].trim();
    }

    const fotoLimpia = obtenerFotoLimpia(fotoUrlFinal);
    
    // 2. HTML de imagen mejorado (con fallback y mejor diseño responsive)
    const fotoHTML = fotoLimpia 
        ? `<div style="text-align:center; margin-bottom:15px; display:flex; flex-direction:column; align-items:center;">
               <img src="${fotoLimpia}" 
                    alt="${d.nombre_modelo}"
                    style="max-width:180px; width:100%; height:auto; max-height:180px; object-fit:cover; border-radius:12px; border:2px solid #e2e8f0; box-shadow:0 4px 10px rgba(0,0,0,0.08);"
                    onerror="this.src='imagenes/sin_foto.jpg'; this.style.opacity='0.6';">
               <p style="font-size:10px; color:var(--text-muted); margin-top:6px; font-weight:bold; letter-spacing:0.5px;">FOTO DEL CATÁLOGO</p>
           </div>`
        : `<div style="text-align:center; margin-bottom:15px; padding:20px; background:#f1f5f9; border-radius:12px; color:var(--text-muted);">
               <i class="fas fa-image" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
               <p style="font-size:12px; margin:0;">Sin foto disponible</p>
           </div>`;

    let html = fotoHTML + `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:15px;">
        <div class="specs-section" style="background:#f8fafc; padding:12px; border-radius:8px;">
            <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--primary); text-transform:uppercase;">Identificación</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Código:</b> <span style="color:var(--accent);font-weight:900;">${d.codigo_barra}</span></p>
            <p style="margin:4px 0;font-size:13px;"><b>Modelo:</b> ${d.nombre_modelo}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Categoría:</b> ${d.categoria}</p>
        </div>
        <div class="specs-section" style="background:#f8fafc; padding:12px; border-radius:8px;">
            <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--primary); text-transform:uppercase;">Ubicación y Estado</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Sede:</b> ${d.sede}</p>
            <p style="margin:4px 0;"><span style="background:${estadoColor[d.estado]||'#f1f5f9'};
               padding:4px 10px;border-radius:8px;font-weight:800;font-size:12px;display:inline-block;">${d.estado}</span></p>
            <p style="margin:4px 0;font-size:12px;color:var(--text-muted);">Ingreso: ${d.fecha_ingreso||'—'}</p>
        </div>`;

    if (esProducto) {
        html += `<div class="specs-section" style="background:#f8fafc; padding:12px; border-radius:8px;">
            <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--primary); text-transform:uppercase;">Detalles</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Color/Tela:</b> ${d.color_tela||'—'}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Acabado:</b> ${d.acabado||'—'}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Costo:</b> S/ ${d.costo_ingreso||'—'}</p>
        </div>`;
    } else {
        html += `<div class="specs-section" style="background:#f8fafc; padding:12px; border-radius:8px;">
            <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--primary); text-transform:uppercase;">Medidas</h4>
            <p style="margin:4px 0;font-size:13px;"><b>Material:</b> ${d.material||'—'} ${d.color_acabado?'· '+d.color_acabado:''}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Forma:</b> ${d.forma}</p>
            <p style="margin:4px 0;font-size:13px;"><b>Medida:</b> ${_fmtMedidaObj(d)}</p>
        </div>`;
    }

    html += `</div>`;

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
                               font-weight:700;cursor:pointer;font-size:11px;flex:1;min-width:90px;">
                    ${e}</button>`).join('')}
            </div>
            <button onclick="_invVerHistorialUnidad('${d.tipo}',${d.id})"
                    style="width:100%;background:none;border:1px solid #e2e8f0;padding:10px 14px;margin-bottom:8px;
                           border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                           color:var(--text-muted);">
                <i class="fas fa-history"></i> Ver historial completo
            </button>
            <button onclick="_invEliminarUnidad('${d.tipo}',${d.id})"
                    style="width:100%;background:#fee2e2;border:1px solid #fca5a5;padding:10px 14px;
                           border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                           color:#991b1b;">
                <i class="fas fa-trash"></i> Eliminar Registro Físico
            </button>
        </div>`;
    }

    document.getElementById('modal-inv-det-titulo').textContent =
        `${d.nombre_modelo} — ${d.codigo_barra}`;
    document.getElementById('modal-inv-det-cuerpo').innerHTML = html;
    document.getElementById('modal-inv-detalle').style.display = 'flex';
}

async function _invCambiarEstadoDesdeModal(tipo, id, estadoNuevo, barcode) {
    const pideFoto = (estadoNuevo === 'Dañado' || estadoNuevo === 'En Traslado');

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

            <!-- 2. Evidencia Fotográfica Híbrida -->
            <div style="margin-top:15px; text-align:left; background:#f8fafc; padding:10px; border-radius:8px; border:1px dashed #cbd5e1;">
                <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">📷 FOTO DE EVIDENCIA ${pideFoto ? '<span style="color:#dc2626;">(OBLIGATORIA)</span>' : '(OPCIONAL)'}</label>
                <input type="file" id="swal-evidencia" accept="image/*" style="width:100%; padding:8px 0; margin-top:5px; font-size:12px;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => {
            const notas = document.getElementById('swal-notas')?.value || '';
            const sede_destino_id = document.getElementById('swal-sede-dest')?.value || null;
            const archivo = document.getElementById('swal-evidencia')?.files[0];
            
            if (estadoNuevo === 'En Traslado' && !sede_destino_id) {
                Swal.showValidationMessage('Debes seleccionar la sede de destino.');
                return false;
            }
            if (pideFoto && !archivo) {
                Swal.showValidationMessage('Para este estado es OBLIGATORIO subir una foto de evidencia.');
                return false;
            }
            return { notas, sede_destino_id, archivo };
        }
    });
    if (!datos) return;

    const tipoEvento = {
        'En Traslado': 'Traslado', 'Vendido': 'Venta',
        'Baja': 'Baja', 'Disponible': 'Ajuste', 'Reservado': 'Reserva'
    }[estadoNuevo] || 'Ajuste';

    // Subir evidencia fotográfica si el usuario adjuntó una
    let urlEvidencia = '';
    if (datos.archivo) {
        Swal.fire({ title: 'Subiendo evidencia...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const fd = new FormData();
        fd.append('foto', datos.archivo);
        try {
            const resUpload = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: fd });
            const dUpload = await resUpload.json();
            if (dUpload.url) urlEvidencia = dUpload.url;
        } catch(e) { console.error("Error al subir foto:", e); }
    }

    let notasFinales = datos.notas;
    if (urlEvidencia) notasFinales += ` [Evidencia adjunta: ${urlEvidencia}]`;

    try {
        Swal.fire({ title: 'Actualizando estado...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/inventario/${tipo}/${id}/estado`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado_nuevo:    estadoNuevo,
                sede_destino_id: datos.sede_destino_id || null,
                tipo_evento:     tipoEvento,
                usuario_id:      window.usuarioActivo?.id,
                usuario_rol:     window.usuarioActivo?.rol,
                usuario_nombre:  window.usuarioActivo?.nombre,
                notas:           notasFinales,
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
        const res  = await apiFetch(`${API_URL}/api/inventario/historial/${tipo}/${id}`);
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

async function _invEliminarUnidad(tipo, id) {
    const conf = await Swal.fire({
        title: '¿Eliminar este registro?',
        text: 'Se borrará permanentemente del inventario físico. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!conf.isConfirmed) return;
    Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await apiFetch(`${API_URL}/api/inventario/${tipo}/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) {
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            document.getElementById('modal-inv-detalle').style.display = 'none';
            await _cargarDatosTab();
        } else { Swal.fire('Error', data.error || 'No se pudo eliminar el registro.', 'error'); }
    } catch(e) { Swal.fire('Error', 'Fallo de conexión al servidor.', 'error'); }
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
        <select id="nf-cat" class="form-input" onchange="_invFiltrarCatalogoPorCat()">${cats}</select></div>
    <div class="form-group"><label>Modelo del Catálogo <span style="font-size:11px;color:#94a3b8;">(filtra por categoría)</span></label>
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
    const [catId, nombre] = sel.value.split('|');
    const nf = document.getElementById('nf-nombre');
    if (nf) nf.value = nombre;
    // Autocompletar categoría si el producto del catálogo la trae
    const prod = _maestroInv.catalogo.find(p => String(p.id) === String(catId));
    if (prod && prod.categoria) {
        const selCat = document.getElementById('nf-cat');
        if (selCat) {
            const opt = [...selCat.options].find(o => o.value === prod.categoria);
            if (opt) selCat.value = prod.categoria;
        }
    }
}

// Filtra el select de catálogo por la categoría elegida
window._invFiltrarCatalogoPorCat = function() {
    const cat = document.getElementById('nf-cat')?.value || '';
    const selCatalogo = document.getElementById('nf-catalogo');
    if (!selCatalogo) return;

    // Mapeo: categoría de inventario → categoría del catálogo
    const mapaCategoria = {
        'Sofá':    ['Sofá', 'Seccional', 'Modular'],
        'Sillón':  ['Sillón'],
        'Butaca':  ['Butaca', 'Puff'],
        'Silla':   ['Silla', 'Sitial'],
        'Mesa':    ['Mesa'],
        'Cama':    ['Cama'],
    };

    const catsCatalogo = mapaCategoria[cat] || null;
    const prodsFiltrados = catsCatalogo
        ? _maestroInv.catalogo.filter(p => catsCatalogo.includes(p.categoria || ''))
        : _maestroInv.catalogo;

    selCatalogo.innerHTML = `<option value="">— O escribir manualmente —</option>` +
        prodsFiltrados.map(p =>
            `<option value="${p.id}|${(p.nombre||p.nombre_modelo||'').replace(/"/g,'')}">${p.nombre||p.nombre_modelo}${p.categoria ? ' ('+p.categoria+')' : ''}</option>`
        ).join('');
};

function _formPieza() {
    const sedes = [...document.querySelectorAll('#inv-filtro-sede option')]
        .filter(o=>o.value)
        .map(o=>`<option value="${o.value}">${o.textContent}</option>`).join('');
    const cats  = CATEGORIAS_PIEZA.map(c=>`<option value="${c.val}">${c.label}</option>`).join('');

    return `
    <div class="form-group"><label>Categoría *</label>
        <select id="npf-cat" class="form-input" onchange="_invLimpiarSmartSearch()">${cats}</select></div>
        
    <div class="form-group" style="margin-bottom: 15px;">
        <label style="font-size: 11px; font-weight: bold; color: var(--primary);">MODELO MAESTRO *</label>
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 5px;">
            <div class="custom-select-wrapper" style="flex-grow: 1; position: relative;">
                <input type="text" id="search-inv-pieza" class="form-input" placeholder="🔍 Buscar modelo en el catálogo..."
                       onkeyup="filtrarMaterial('inv-pieza')" onfocus="mostrarUltimasMaterial('inv-pieza')" autocomplete="off">
                <div id="list-inv-pieza" class="custom-options" style="position: absolute; width: 100%; z-index: 9999;"></div>
            </div>
            <img id="img-preview-inv-pieza" src="" 
                 style="width: 42px; height: 42px; border-radius: 6px; object-fit: cover; border: 1px solid #cbd5e1; display: none; cursor: zoom-in;" 
                 onclick="ampliarImagen(this.src)" title="Haz clic para agrandar">
        </div>
        <input type="hidden" id="sku-inv-pieza">
        <button type="button" onclick="_invCrearAlVuelo()"
                style="margin-top: 8px; width: 100%; background: #f8fafc; color: var(--accent); border: 1px dashed var(--accent); padding: 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">
            <i class="fa-solid fa-plus"></i> CREAR NUEVO MODELO AL VUELO
        </button>
    </div>

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

function _invLimpiarSmartSearch() {
    const search = document.getElementById('search-inv-pieza');
    const sku = document.getElementById('sku-inv-pieza');
    const img = document.getElementById('img-preview-inv-pieza');
    const list = document.getElementById('list-inv-pieza');
    if (search) search.value = '';
    if (sku) sku.value = '';
    if (img) img.style.display = 'none';
    if (list) list.classList.remove('show');
}

function _invCrearAlVuelo() {
    const cat = document.getElementById('npf-cat')?.value || 'tablero';
    const mapeo = {
        'tablero': 'tablero',
        'base-comedor': 'base-comedor',
        'base-consola': 'base-comedor',
        'base-mesa-centro': 'base-comedor',
        'silla': 'silla',
        'butaca': 'butaca'
    };
    abrirModalNuevo(mapeo[cat] || 'tablero', 'inventario');
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
        const res = await apiFetch(`${API_URL}/api/inventario/producto/nuevo`, {
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

        const nombreProd = document.getElementById('nf-nombre')?.value || '';
        const sedeSel    = document.getElementById('nf-sede');
        const sedeNombre = sedeSel?.options[sedeSel.selectedIndex]?.text || '';

        Swal.fire({
            icon: 'success', title: '¡Registrado!',
            html: `
                Código de barras generado:<br>
                <b style="font-size:1.3rem;color:var(--accent);">${d.codigo_barra}</b><br><br>
                <button onclick="imprimirEtiqueta('${d.codigo_barra}','${nombreProd.replace(/'/g,"\\'")}','${sedeNombre}')"
                    style="background:var(--primary);color:white;border:none;padding:10px 20px;
                           border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">
                    🖨️ Imprimir Etiqueta
                </button>`,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function _invGuardarPieza() {
    const sku    = document.getElementById('sku-inv-pieza')?.value;
    const nombre = document.getElementById('search-inv-pieza')?.value;
    const cat    = document.getElementById('npf-cat')?.value;
    const forma  = document.getElementById('npf-forma')?.value;
    const sedeId = document.getElementById('npf-sede')?.value;

    if (!sku || !nombre || !sedeId) {
        Swal.fire('Incompleto', 'Selecciona el modelo y la sede.', 'warning'); return;
    }

    let mat = '';
    let color = '';
    if (cat === 'tablero') {
        const f = _maestroInv.tableros.find(x => x.sku === sku);
        if (f) { mat = f.material_base; color = f.color; }
    } else if (cat === 'silla') {
        const f = _maestroInv.sillas.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color_estructura; }
    } else if (cat === 'butaca') {
        const f = _maestroInv.butacas.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color_estructura; }
    } else {
        const f = _maestroInv.bases_comedor.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color; }
    }

    try {
        const res = await apiFetch(`${API_URL}/api/inventario/pieza/nueva`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku_maestro:    sku,
                nombre_modelo:  nombre,
                categoria:      cat,
                material:       mat,
                color_acabado:  color,
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

        const sedeSel    = document.getElementById('npf-sede');
        const sedeNombre = sedeSel?.options[sedeSel.selectedIndex]?.text || '';
        
        const nombreBase = document.getElementById('search-inv-pieza')?.value || '';
        const formaActual  = document.getElementById('npf-forma')?.value || '';
        let medida = '';
        if (formaActual === 'Circular') {
            const l = document.getElementById('npf-largo')?.value;
            medida = l ? `⌀ ${l} cm` : 'Circular';
        } else if (formaActual === 'Rectangular') {
            const l = document.getElementById('npf-largo')?.value || '?';
            const a = document.getElementById('npf-ancho')?.value || '';
            const h = document.getElementById('npf-alto')?.value || '';
            medida = `${l}${a ? ' × '+a : ''} cm${h ? ' / H:'+h : ''}`;
        } else {
            const l = document.getElementById('npf-largo')?.value;
            medida = l ? `${l} cm` : 'Irregular';
        }
        const nombrePieza = `${nombreBase} - ${medida.toUpperCase()}`;

        const codigosHTML = (d.unidades || []).map(u => `
            <div style="margin:6px 0;">
                <b style="color:var(--accent);">${u.codigo_barra}</b>
                <button onclick="imprimirEtiqueta('${u.codigo_barra}','${nombrePieza.replace(/'/g,"\\'")}','${sedeNombre}')"
                    style="margin-left:10px;background:var(--primary);color:white;border:none;
                           padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
                    🖨️ Imprimir
                </button>
            </div>`).join('');

        Swal.fire({
            icon: 'success', title: `¡${d.unidades.length} pieza(s) registradas!`,
            html: `Códigos generados:<br>${codigosHTML}`,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ─── Ver unidades de un modelo ─────────────────────────────── */
async function _invVerUnidades(nombre, categoria, catalogoId) {
    try {
        const esPieza = (catalogoId === 'es_pieza');
        const p = new URLSearchParams({ categoria, q: nombre });
        const endpoint = esPieza 
            ? `${API_URL}/api/inventario/piezas/resumen?${p}`
            : `${API_URL}/api/inventario/resumen?${p}`;

        const res  = await apiFetch(endpoint);
        const data = await res.json();
        
        const lista = esPieza ? (data.piezas || []) : (data.modelos || []);
        const m    = lista.find(x => x.nombre_modelo === nombre);
        if (!m) { Swal.fire('Sin datos', 'No hay stock registrado de este modelo.', 'info'); return; }

        let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:15px;">`;
        (data.sedes||[]).forEach(s => {
            // FIX: Manejar si el backend devuelve un número o un objeto incompleto
            const stockSede = (m.sede_stock || {})[s];
            const st = {
                disponibles: (typeof stockSede === 'number') ? stockSede : (stockSede?.disponibles || 0),
                total: (typeof stockSede === 'number') ? stockSede : (stockSede?.total || 0)
            };

            html += `<div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;border:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:6px;">${s}</div>
                <div style="font-size:2rem;font-weight:900;color:${st.disponibles>0?'#16a34a':'#cbd5e1'};">${st.disponibles}</div>
                <div style="font-size:10px;color:var(--text-muted);">disponibles</div>
                ${st.total > st.disponibles ? `<div style="font-size:10px;color:var(--text-muted);">${st.total} total</div>` : ''}
            </div>`;
        });
        html += `</div>`;

        // Añadir tabla detallada de códigos
        try {
            const tipoQuery = esPieza ? 'pieza' : 'producto';
            const resUnidades = await apiFetch(`${API_URL}/api/inventario/unidades-modelo?tipo=${tipoQuery}&modelo=${encodeURIComponent(nombre)}`);
            if (resUnidades.ok) {
                const unidades = await resUnidades.json();
                if (unidades.length > 0) {
                    html += `<div style="margin-top: 20px; text-align: left;">
                        <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">Unidades Físicas (Códigos):</h4>
                        <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <thead style="background: #f1f5f9; position: sticky; top: 0; z-index:1;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">Código</th>
                                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">Sede</th>
                                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">Estado</th>
                                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${unidades.map(u => `
                                        <tr style="border-bottom: 1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                            <td style="padding: 8px; font-weight: bold; color: var(--accent);">${u.codigo_barra}</td>
                                            <td style="padding: 8px;">${u.sede}</td>
                                            <td style="padding: 8px; text-align: center;">
                                                <span style="background: ${u.estado === 'Disponible' ? '#dcfce7' : '#f1f5f9'}; color: ${u.estado === 'Disponible' ? '#16a34a' : '#64748b'}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">${u.estado}</span>
                                            </td>
                                            <td style="padding: 8px; text-align: center;">
                                                <button onclick="Swal.close(); setTimeout(() => _invBuscarBarcode('${u.codigo_barra}'), 300)" style="background: var(--primary); color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold;"><i class="fa-solid fa-eye"></i> Detalles</button>
                                            </td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
                }
            }
        } catch(err) {}

        Swal.fire({
            title: nombre,
            html, width: '90vw', maxWidth: '680px',
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

/* ─── Imprimir Etiqueta de Código de Barras ─────────────────── */
// Genera la imagen PNG directamente en la página (sin window.open / document.write)
// y la descarga al instante. Funciona en PC y Android Chrome sin popups.

function imprimirEtiqueta(codigo, nombre, sede) {
    // Inyectar JsBarcode si aún no está cargado
    function _cargarJsBarcode(cb) {
        if (typeof JsBarcode !== 'undefined') { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = cb;
        document.head.appendChild(s);
    }

    _cargarJsBarcode(function() {
        // 1. Renderizar barcode en canvas oculto
        const bcCanvas = document.createElement('canvas');
        bcCanvas.style.display = 'none';
        document.body.appendChild(bcCanvas);
        JsBarcode(bcCanvas, codigo, {
            format: 'CODE128', width: 3, height: 80, displayValue: false, margin: 6
        });

        // 2. Construir imagen final (590×354px — Niimbot B21 50×30mm a 300dpi)
        const canvas  = document.createElement('canvas');
        canvas.width  = 590;
        canvas.height = 354;
        const ctx     = canvas.getContext('2d');

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Borde
        ctx.strokeStyle = '#1e140a';
        ctx.lineWidth   = 5;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

        ctx.textAlign = 'center';

        // Marca dorada
        ctx.fillStyle = '#c9a84c';
        ctx.font      = 'bold 20px Arial';
        ctx.fillText('INNOVA MÖBILI', canvas.width / 2, 46);

        // Nombre del producto
        ctx.fillStyle = '#1e140a';
        ctx.font      = 'bold 26px Arial';
        const nomCorto = nombre.length > 30 ? nombre.substring(0, 30) + '…' : nombre;
        ctx.fillText(nomCorto, canvas.width / 2, 82);

        // Sede
        ctx.fillStyle = '#8a7560';
        ctx.font      = '19px Arial';
        ctx.fillText(sede, canvas.width / 2, 110);

        // Barcode centrado
        ctx.drawImage(bcCanvas, 75, 118, 440, 180);

        // Código en texto
        ctx.fillStyle = '#1e140a';
        ctx.font      = 'bold 23px Arial';
        ctx.fillText(codigo, canvas.width / 2, 328);

        // Limpiar canvas temporal
        bcCanvas.remove();

        // 3. Mostrar modal de previsualización + botones
        // Eliminar modal anterior si existe
        document.getElementById('_modal-etiqueta')?.remove();

        const overlay = document.createElement('div');
        overlay.id    = '_modal-etiqueta';
        overlay.style.cssText = [
            'position:fixed','inset:0','z-index:99999',
            'background:rgba(0,0,0,0.7)',
            'display:flex','align-items:center','justify-content:center',
            'flex-direction:column','gap:14px','padding:20px'
        ].join(';');

        const img      = document.createElement('img');
        img.src        = canvas.toDataURL('image/png');
        img.style.cssText = 'max-width:320px;width:100%;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.4);';

        const btnDesc  = document.createElement('button');
        btnDesc.textContent = '📥 Descargar PNG para Niimbot';
        btnDesc.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;width:100%;max-width:320px;';
        btnDesc.onclick = function() {
            const link    = document.createElement('a');
            link.href     = canvas.toDataURL('image/png');
            link.download = 'etiqueta-' + codigo + '.png';
            document.body.appendChild(link);
            link.click();
            link.remove();
            aviso.style.display = 'block';
            aviso.innerHTML = '✅ Descargada. Abre Niimbot → <strong>+</strong> → <strong>Importar imagen</strong> → selecciónala.';
        };

        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '✕ Cerrar';
        btnCerrar.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:8px 24px;border-radius:8px;font-size:13px;cursor:pointer;';
        btnCerrar.onclick = function() { overlay.remove(); };

        const aviso = document.createElement('div');
        aviso.style.cssText = 'display:none;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:8px;padding:10px 16px;font-size:13px;text-align:center;max-width:320px;width:100%;';

        // Cerrar al tocar el fondo
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        overlay.appendChild(img);
        overlay.appendChild(btnDesc);
        overlay.appendChild(aviso);
        overlay.appendChild(btnCerrar);
        document.body.appendChild(overlay);
    });
}

/* ─── Impresión Masiva de Etiquetas Físicas ─────────────────────────────── */
async function _invImprimirMasivo() {
    const chks = document.querySelectorAll('.chk-prod:checked, .chk-pieza:checked');
    if (!chks.length) {
        return Swal.fire('Ningún ítem seleccionado', 'Selecciona al menos un modelo marcando su casilla en la tabla.', 'warning');
    }

    const res = await Swal.fire({
        title: 'Imprimir Etiquetas Físicas',
        text: `Has seleccionado ${chks.length} modelos. ¿Deseas imprimir el código físico de 1 unidad por modelo, o de TODAS las unidades disponibles?`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '1 por modelo',
        denyButtonText: 'Todas las disp.',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        denyButtonColor: '#16a34a'
    });

    if (res.isDismissed) return;

    const porCantidad = res.isDenied; 
    const items = Array.from(chks).map(chk => JSON.parse(decodeURIComponent(chk.value)));

    await _ejecutarImpresionFisica(items, porCantidad);
}

async function _invImprimirFisico(encodedObj) {
    const obj = JSON.parse(decodeURIComponent(encodedObj));
    await _ejecutarImpresionFisica([obj], false);
}

async function _ejecutarImpresionFisica(items, porCantidad) {
    Swal.fire({ title: 'Obteniendo códigos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await apiFetch(`${API_URL}/api/inventario/etiquetas-disponibles`, {
            method: 'POST',
            body: JSON.stringify({ items, por_cantidad: porCantidad })
        });
        const data = await res.json();
        Swal.close();
        if (data.error) throw new Error(data.error);

        if (data.etiquetas && data.etiquetas.length > 0) {
            imprimirEtiquetasMasivas(data.etiquetas);
        } else {
            Swal.fire('Aviso', 'No se encontraron unidades físicas disponibles para los modelos seleccionados.', 'info');
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function imprimirEtiquetasMasivas(lista) {
    // Sin window.open. Todo en un modal inline dentro de la misma página.
    function _cargarJsBarcode(cb) {
        if (typeof JsBarcode !== 'undefined') { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = cb;
        document.head.appendChild(s);
    }

    _cargarJsBarcode(function() {
        // Pre-generar todos los canvas de barcode
        const bcCanvases = lista.map(it => {
            const c = document.createElement('canvas');
            c.style.display = 'none';
            document.body.appendChild(c);
            JsBarcode(c, it.codigo, { format: 'CODE128', width: 3, height: 80, displayValue: false, margin: 6 });
            return c;
        });

        function _generarPNG(i) {
            const it     = lista[i];
            const canvas = document.createElement('canvas');
            canvas.width  = 590;
            canvas.height = 354;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#1e140a'; ctx.lineWidth = 5;
            ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
            ctx.textAlign = 'center';

            ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 20px Arial';
            ctx.fillText('INNOVA MÖBILI', canvas.width / 2, 46);

            ctx.fillStyle = '#1e140a'; ctx.font = 'bold 26px Arial';
            const nom = it.nombre.length > 30 ? it.nombre.substring(0, 30) + '…' : it.nombre;
            ctx.fillText(nom, canvas.width / 2, 82);

            ctx.fillStyle = '#8a7560'; ctx.font = '19px Arial';
            ctx.fillText(it.sede, canvas.width / 2, 110);

            ctx.drawImage(bcCanvases[i], 75, 118, 440, 180);

            ctx.fillStyle = '#1e140a'; ctx.font = 'bold 23px Arial';
            ctx.fillText(it.codigo, canvas.width / 2, 328);

            return canvas.toDataURL('image/png');
        }

        function _limpiarCanvases() {
            bcCanvases.forEach(c => c.remove());
        }

        // Construir tarjetas del modal
        const tarjetas = lista.map((it, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'background:#fff;border-radius:10px;padding:12px;text-align:center;width:200px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);';

            const imgEl = document.createElement('img');
            imgEl.src = _generarPNG(i);
            imgEl.style.cssText = 'width:100%;border-radius:6px;margin-bottom:8px;';

            const nomEl = document.createElement('div');
            nomEl.textContent = it.nombre.length > 22 ? it.nombre.substring(0, 22) + '…' : it.nombre;
            nomEl.style.cssText = 'font-size:11px;font-weight:700;color:#1e140a;margin-bottom:2px;';

            const codEl = document.createElement('div');
            codEl.textContent = it.codigo;
            codEl.style.cssText = 'font-size:10px;color:#8a7560;margin-bottom:8px;';

            const btnEl = document.createElement('button');
            btnEl.textContent = '📥 Descargar';
            btnEl.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;width:100%;';
            btnEl.onclick = function() {
                const link = document.createElement('a');
                link.href = imgEl.src;
                link.download = 'etiqueta-' + it.codigo + '.png';
                document.body.appendChild(link); link.click(); link.remove();
                btnEl.textContent = '✅ Descargada';
                btnEl.style.background = '#86efac';
            };

            wrap.appendChild(imgEl);
            wrap.appendChild(nomEl);
            wrap.appendChild(codEl);
            wrap.appendChild(btnEl);
            return wrap;
        });

        // Overlay modal
        document.getElementById('_modal-masivo')?.remove();
        const overlay = document.createElement('div');
        overlay.id = '_modal-masivo';
        overlay.style.cssText = [
            'position:fixed','inset:0','z-index:99999',
            'background:rgba(0,0,0,0.85)',
            'display:flex','flex-direction:column',
            'overflow:hidden'
        ].join(';');

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'background:#1e140a;padding:14px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-shrink:0;';

        const titulo = document.createElement('span');
        titulo.textContent = `Etiquetas (${lista.length})`;
        titulo.style.cssText = 'color:#c9a84c;font-weight:800;font-size:15px;flex:1;';

        const btnTodas = document.createElement('button');
        btnTodas.textContent = '📥 Descargar todas';
        btnTodas.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;';
        btnTodas.onclick = async function() {
            btnTodas.disabled = true;
            const aviso = document.getElementById('_aviso-masivo');
            for (let i = 0; i < lista.length; i++) {
                aviso.textContent = '⬇️ Descargando ' + (i + 1) + ' de ' + lista.length + '...';
                const link = document.createElement('a');
                link.href = tarjetas[i].querySelector('img').src;
                link.download = 'etiqueta-' + lista[i].codigo + '.png';
                document.body.appendChild(link); link.click(); link.remove();
                tarjetas[i].querySelector('button').textContent = '✅ Descargada';
                tarjetas[i].querySelector('button').style.background = '#86efac';
                await new Promise(r => setTimeout(r, 800));
            }
            aviso.textContent = '✅ ' + lista.length + ' imágenes descargadas. Importa en Niimbot → + → Importar imagen.';
            btnTodas.disabled = false;
        };

        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '✕ Cerrar';
        btnCerrar.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;';
        btnCerrar.onclick = function() { _limpiarCanvases(); overlay.remove(); };

        toolbar.appendChild(titulo);
        toolbar.appendChild(btnTodas);
        toolbar.appendChild(btnCerrar);

        const aviso = document.createElement('div');
        aviso.id = '_aviso-masivo';
        aviso.style.cssText = 'background:#1e2a3a;color:#93c5fd;font-size:12px;text-align:center;padding:6px 16px;flex-shrink:0;min-height:28px;';

        // Grid de tarjetas
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;padding:20px;overflow-y:auto;justify-content:center;flex:1;';
        tarjetas.forEach(t => grid.appendChild(t));

        overlay.appendChild(toolbar);
        overlay.appendChild(aviso);
        overlay.appendChild(grid);
        document.body.appendChild(overlay);
    });
}

/* ─── Lector de Código de Barras con Cámara del Celular ────────────────── */
let _html5QrcodeInv = null;

function _iniciarEscaneoCamara() {
    document.getElementById('modal-scanner-inv').style.display = 'flex';
    
    // Cargar la librería dinámicamente solo cuando se necesita para no poner lenta tu página
    if (typeof Html5Qrcode === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = () => _iniciarLectorLibreria();
        document.head.appendChild(script);
    } else {
        _iniciarLectorLibreria();
    }
}

function _iniciarLectorLibreria() {
    if (!_html5QrcodeInv) {
        _html5QrcodeInv = new Html5Qrcode("reader-inv");
    }
    
    _html5QrcodeInv.start(
        { facingMode: "environment" }, // ⬅️ Fuerza la cámara trasera del celular
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (textoDecodificado) => {
            _cerrarEscaneoCamara();
            document.getElementById('inv-barcode-input').value = textoDecodificado;
            _invBuscarBarcode(textoDecodificado);
        },
        (errorMessage) => { /* Ignorar errores de lectura en progreso */ }
    ).catch(err => {
        console.error("Error cámara:", err);
        Swal.fire('Aviso', 'No se pudo acceder a la cámara trasera. Asegúrate de dar permisos en tu navegador.', 'warning');
    });
}

function _cerrarEscaneoCamara() {
    if (_html5QrcodeInv && _html5QrcodeInv.isScanning) {
        _html5QrcodeInv.stop().catch(e => console.error("Error al detener escáner.", e));
    }
    document.getElementById('modal-scanner-inv').style.display = 'none';
}