// =============================================================
// inventario.js — Módulo de Inventario Completo
// Innova Mobili ERP
// Requiere: config.js (API_URL), SweetAlert2, Font Awesome
// =============================================================

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
            <button id="btn-inv-nuevo" onclick="abrirModalNuevoItem()" 
                    style="background:var(--accent);color:white;border:none;padding:10px 16px;
                           border-radius:10px;font-weight:800;cursor:pointer;font-size:12px;
                           display:flex;align-items:center;gap:6px;">
                <i class="fas fa-plus"></i> Registrar...
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
                <i class="fas fa-file-excel"></i> Excel
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
        <button onclick="_invLimpiarFiltros()"
                style="background:transparent;border:none;color:var(--text-muted);
                       cursor:pointer;font-size:12px;font-weight:700;
                       display:flex;align-items:center;gap:5px;">
            <i class="fas fa-times-circle"></i> Limpiar
        </button>
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

    <!-- MODAL EDITAR PRODUCTO -->
    <div id="modal-inv-editar" class="modal-overlay" style="display:none;align-items:center;justify-content:center;">
        <div class="modal-content" style="width:92%;max-width:480px;border-radius:20px;">
            <div class="modal-header">
                <h3><i class="fas fa-pen" style="color:#c2410c;margin-right:8px;"></i>Editar Producto</h3>
                <button class="close-btn" onclick="document.getElementById('modal-inv-editar').style.display='none'"><i class="fas fa-times"></i></button>
            </div>
            <div id="modal-inv-editar-cuerpo" style="margin-top:12px;"></div>
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
            <div id="scanner-inv-error" style="display:none;margin:10px 0;padding:9px;background:#fff7ed;color:#9a3412;border-radius:6px;font-size:12px;text-align:left;"></div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <input id="scanner-inv-codigo-manual" type="text" class="form-input"
                       placeholder="Escribir o pegar código"
                       onkeydown="if(event.key === 'Enter') _usarCodigoManualScanner()"
                       style="flex:1;min-width:0;">
                <button type="button" class="btn-action btn-primary" onclick="_usarCodigoManualScanner()"
                        title="Buscar código" style="width:auto;white-space:nowrap;">
                    <i class="fas fa-search"></i> Buscar
                </button>
            </div>
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
        _maestroInv.cojines       = mat.cojines       || [];
        _maestroInv.catalogo      = cat || [];
        _maestroInv.cargado       = true;

        // Poblar selector de sedes en filtros
        const selSede = document.getElementById('inv-filtro-sede');
        if (selSede) sedes.forEach(s => {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.nombre;
            selSede.appendChild(o);
        });
        _invSedesList = sedes || [];
    } catch(e) { console.error('Error maestros inventario:', e); }
}

/* ─── Cambiar Tab ───────────────────────────────────────────── */
async function _invCambiarTab(tab) {
    _invTab = tab;
    ['productos','piezas','historial'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });

    // TAREA 1: Mostrar/ocultar y cambiar texto del botón de registro según el tab
    const btnNuevo = document.getElementById('btn-inv-nuevo');
    if (btnNuevo && _puedeEditarInv()) {
        if (tab === 'productos') {
            btnNuevo.style.display = 'flex';
            btnNuevo.innerHTML = '<i class="fas fa-couch"></i> Registrar Producto';
        } else if (tab === 'piezas') {
            btnNuevo.style.display = 'flex';
            btnNuevo.innerHTML = '<i class="fas fa-puzzle-piece"></i> Registrar Pieza';
        } else { // historial
            btnNuevo.style.display = 'none';
        }
    }

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

/* ─── Render: tarjetas con carousel de productos ────────────── */
function _renderTablaProductos() {
    const contenido = document.getElementById('inv-contenido');
    const sedes     = _invDataProd.sedes  || [];
    const modelos   = _invDataProd.modelos || [];

    if (!modelos.length) {
        contenido.innerHTML = _htmlVacio('productos');
        return;
    }

    // Checkbox maestro en barra superior
    let html = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;
                      font-weight:700;color:var(--text-muted);cursor:pointer;">
            <input type="checkbox" id="chk-prod-all"
                   onchange="document.querySelectorAll('.chk-prod').forEach(c=>c.checked=this.checked)">
            Seleccionar todos
        </label>
        <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">
            ${modelos.length} modelos
        </span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;

    modelos.forEach((m, idx) => {
        const cid  = `inv-car-${idx}`;
        const fotos = (m.fotos && m.fotos.length) ? m.fotos
                    : (m.foto_url ? [m.foto_url] : []);
        const tieneCarousel = fotos.length > 1;

        // Slides del carousel
        const slides = fotos.length
            ? fotos.map((f, i) => `
                <div style="min-width:100%;scroll-snap-align:center;">
                    <img src="${f}" alt="${m.nombre_modelo} foto ${i+1}"
                         style="width:100%;height:200px;object-fit:contain;object-position:center;background:#f8f6f2;cursor:zoom-in;"
                         onclick="_invLightbox('${f}','${m.nombre_modelo}')"
                         onerror="this.src='imagenes/sin_foto.jpg'">
                </div>`).join('')
            : `<div style="min-width:100%;display:flex;align-items:center;justify-content:center;
                           height:200px;background:#f8f6f2;color:#cbd5e1;flex-direction:column;gap:8px;">
                   <i class="fas fa-image" style="font-size:2rem;"></i>
                   <span style="font-size:11px;">Sin foto</span>
               </div>`;

        // Stock por sede (solo las con unidades)
        const sedesConStock = sedes
            .map(s => ({ nombre: s, st: (m.sede_stock||{})[s] || {disponibles:0,total:0} }))
            .filter(x => x.st.total > 0);

        const sedesHTML = sedesConStock.length
            ? sedesConStock.map(x => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:11px;">
                    <span style="color:var(--text-muted);white-space:nowrap;overflow:hidden;
                                 text-overflow:ellipsis;max-width:130px;" title="${x.nombre}">
                        ${x.nombre}
                    </span>
                    <span style="font-weight:800;
                                 color:${x.st.disponibles>0?'#16a34a':'#94a3b8'};">
                        ${x.st.disponibles}
                        ${x.st.total>x.st.disponibles
                            ? `<span style="font-weight:400;color:#cbd5e1;">/${x.st.total}</span>`
                            : ''}
                    </span>
                </div>`).join('')
            : `<div style="font-size:11px;color:#cbd5e1;text-align:center;padding:6px 0;">Sin stock</div>`;

        html += `
        <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;
                    box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;
                    display:flex;flex-direction:column;">

            <!-- Carousel foto -->
            <div style="position:relative;">
                <div id="${cid}"
                     style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;
                            scrollbar-width:none;">
                    ${slides}
                </div>
                ${tieneCarousel ? `
                <button onclick="_carouselNav('${cid}',-1)"
                        style="position:absolute;top:50%;left:6px;transform:translateY(-50%);
                               background:rgba(0,0,0,0.45);color:white;border:none;
                               border-radius:50%;width:28px;height:28px;cursor:pointer;
                               font-size:15px;display:flex;align-items:center;justify-content:center;
                               line-height:1;">‹</button>
                <button onclick="_carouselNav('${cid}',1)"
                        style="position:absolute;top:50%;right:6px;transform:translateY(-50%);
                               background:rgba(0,0,0,0.45);color:white;border:none;
                               border-radius:50%;width:28px;height:28px;cursor:pointer;
                               font-size:15px;display:flex;align-items:center;justify-content:center;
                               line-height:1;">›</button>
                <!-- Dots -->
                <div style="position:absolute;bottom:6px;left:0;right:0;
                            display:flex;justify-content:center;gap:4px;">
                    ${fotos.map((_,i)=>`
                    <div class="inv-dot-${cid}" data-idx="${i}"
                         style="width:6px;height:6px;border-radius:50%;
                                background:${i===0?'white':'rgba(255,255,255,0.45)'};
                                cursor:pointer;transition:.2s;"
                         onclick="_carouselGoTo('${cid}',${i})"></div>`).join('')}
                </div>` : ''}

                <!-- Badge disponibles -->
                <div style="position:absolute;top:8px;right:8px;
                            background:${m.disponibles>0?'#16a34a':'#dc2626'};
                            color:white;font-weight:900;font-size:12px;
                            padding:3px 10px;border-radius:20px;">
                    ${m.disponibles} disp.
                </div>
                <!-- Checkbox -->
                <div style="position:absolute;top:8px;left:8px;">
                    <input type="checkbox" class="chk-prod"
                           value="${encodeURIComponent(JSON.stringify(m))}"
                           data-cant="${m.disponibles}"
                           style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);">
                </div>
            </div>

            <!-- Cuerpo -->
            <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:8px;">
                <div>
                    <div style="font-weight:800;font-size:13px;color:var(--primary);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                         title="${m.nombre_modelo}">${m.nombre_modelo}</div>
                    ${m.observaciones ? `
                    <div style="font-size:11px; color:#64748b; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.observaciones}">
                        <i class="fas fa-ruler-horizontal" style="margin-right:4px; color:#94a3b8;"></i> ${m.observaciones}
                    </div>
                    ` : ''}
                    <span style="background:#eff6ff;color:var(--accent);font-size:9px;
                                 font-weight:900;padding:2px 7px;border-radius:8px;
                                 display:inline-block;margin-top:3px;">
                        ${m.categoria.toUpperCase()}
                    </span>
                </div>

                <!-- Stock por sede -->
                <div style="flex:1;">${sedesHTML}</div>

                <!-- Acciones -->
                <div style="display:flex;gap:6px;margin-top:4px;">
                    <button onclick="_invImprimirFisico('${encodeURIComponent(JSON.stringify(m))}')"
                            style="flex:1;background:#f8fafc;border:1px solid #cbd5e1;
                                   padding:7px 0;border-radius:8px;color:var(--text-muted);
                                   cursor:pointer;font-size:11px;font-weight:700;">
                        <i class="fas fa-barcode"></i> SKU
                    </button>
                    <button onclick="_invVerUnidades('${m.nombre_modelo.replace(/'/g,"\\'")}','${m.categoria}',${m.catalogo_id||'null'})"
                            style="flex:1;background:#f1f5f9;border:none;padding:7px 0;
                                   border-radius:8px;color:var(--text-muted);cursor:pointer;
                                   font-size:11px;font-weight:700;">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    ${_puedeEditarInv() ? `
                    <button onclick="_invAbrirEditarProducto('${encodeURIComponent(JSON.stringify(m))}')"
                            style="flex:1;background:#fff7ed;border:1px solid #fed7aa;padding:7px 0;
                                   border-radius:8px;color:#c2410c;cursor:pointer;
                                   font-size:11px;font-weight:700;">
                        <i class="fas fa-pen"></i> Editar
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    });

    html += `</div>`;
    contenido.innerHTML = html;

    // Sincronizar dots con scroll en cada carousel
    modelos.forEach((_, idx) => {
        const cid = `inv-car-${idx}`;
        const el  = document.getElementById(cid);
        if (!el) return;
        el.addEventListener('scroll', () => {
            const i = Math.round(el.scrollLeft / el.clientWidth);
            document.querySelectorAll(`.inv-dot-${cid}`).forEach((d, di) => {
                d.style.background = di === i ? 'white' : 'rgba(255,255,255,0.45)';
            });
        }, { passive: true });
    });
}

function _carouselGoTo(cid, idx) {
    const el = document.getElementById(cid);
    if (el) el.scrollTo({ left: el.clientWidth * idx, behavior: 'smooth' });
}

/* ─── Editar producto (datos generales: nombre, categoría, observaciones, precio) ─── */
let _invEditOriginal = null;

async function _invAbrirEditarProducto(encodedObj) {
    if (!_puedeEditarInv()) { Swal.fire('Sin permisos', 'Solo Admin o Jefe de Taller.', 'warning'); return; }
    let m = JSON.parse(decodeURIComponent(encodedObj));

    // FIX: si hay un filtro de tienda activo en la lista (ej. "Tienda Grande"),
    // /api/inventario/resumen ya viene filtrado por esa sede desde el backend
    // — las demás tiendas ni siquiera se incluyen en la respuesta. La tarjeta
    // 'm' que llega aquí puede venir de ese resumen filtrado, así que el panel
    // "Stock disponible por tienda" mostraba 0 en las demás sedes aunque sí
    // tuvieran stock real (simplemente nunca las vio). Por eso, antes de abrir
    // el modal, siempre pedimos el resumen de este modelo SIN filtro de sede,
    // para que el panel muestre el desglose real de todas las tiendas.
    try {
        const params = new URLSearchParams({ categoria: m.categoria, q: m.nombre_modelo });
        const res  = await apiFetch(`${API_URL}/api/inventario/resumen?${params}`);
        const data = await res.json();
        const encontrado = (data.modelos || []).find(x =>
            x.categoria === m.categoria &&
            (x.nombre_modelo || '').toLowerCase() === (m.nombre_modelo || '').toLowerCase() &&
            (x.observaciones || '') === (m.observaciones || '')
        );
        if (encontrado) m = encontrado;
    } catch (e) {
        // Si falla el refresco, seguimos con los datos que ya teníamos (mejor que nada)
    }

    _invEditOriginal = m;
    _invRenderModalEditarProducto(m);
}

function _invRenderModalEditarProducto(m) {
    const cats = CATEGORIAS_PRODUCTO.map(c =>
        `<option value="${c}" ${c === m.categoria ? 'selected' : ''}>${c}</option>`
    ).join('');

    const cuerpo = document.getElementById('modal-inv-editar-cuerpo');

    // Foto actual del modelo (si tiene) — para mostrar preview y permitir cambiarla
    const fotoActual = (m.fotos && m.fotos.length) ? m.fotos[0] : (m.foto_url || '');
    _invEditNuevaFotoFile = null; // se llena en _invPreviewNuevaFotoEdicion si el usuario elige una

    // Panel de stock por tienda: una fila por sede con su cantidad disponible actual
    const filasStock = (_invSedesList || []).map(s => {
        const stSede = (m.sede_stock && m.sede_stock[s.nombre]) ? m.sede_stock[s.nombre].disponibles : 0;
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="flex:1;font-size:12px;color:var(--text-muted);">${s.nombre}</span>
            <input type="number" min="0" id="ef-stock-${s.id}" class="form-input"
                   value="${stSede}" style="width:70px;padding:6px 8px;font-size:12px;text-align:center;" />
            <button onclick="_invAjustarStockSede(${s.id}, '${(m.nombre_modelo||'').replace(/'/g,"\\'")}', '${(m.categoria||'').replace(/'/g,"\\'")}', ${m.catalogo_id ? m.catalogo_id : 'null'}, '${(m.observaciones||'').replace(/'/g,"\\'")}')"
                    title="Guardar cantidad de esta tienda"
                    style="background:#0f172a;color:white;border:none;padding:6px 12px;
                           border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
                <i class="fas fa-check"></i>
            </button>
        </div>`;
    }).join('');

    cuerpo.innerHTML = `
        <div class="form-group">
            <label>Foto del modelo</label>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                <img id="ef-foto-preview" src="${fotoActual || 'imagenes/sin_foto.jpg'}"
                     onerror="this.src='imagenes/sin_foto.jpg'"
                     style="width:70px;height:70px;object-fit:cover;border-radius:8px;
                            border:1px solid #e2e8f0;background:#f8fafc;" />
                <div style="flex:1;">
                    <input type="file" id="ef-foto-input" accept="image/*"
                           onchange="_invPreviewNuevaFotoEdicion(event)"
                           style="font-size:12px;" />
                    <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                        ${fotoActual ? 'Sube una imagen para reemplazar la foto actual.' : 'Este modelo no tiene foto — sube una para que deje de aparecer "Sin foto".'}
                    </p>
                </div>
            </div>
        </div>
        <div class="form-group"><label>Nombre Modelo *</label>
            <input id="ef-nombre" type="text" class="form-input" value="${(m.nombre_modelo||'').replace(/"/g,'&quot;')}" /></div>
        <div class="form-group"><label>Categoría *</label>
            <select id="ef-categoria" class="form-input">${cats}</select></div>
        <div class="form-group"><label>Observaciones</label>
            <input id="ef-obs" type="text" class="form-input" value="${(m.observaciones||'').replace(/"/g,'&quot;')}" placeholder="Opcional" /></div>
        ${m.catalogo_id ? `
        <div class="form-group"><label>Precio Base (S/) — modelo de la carta</label>
            <input id="ef-precio" type="number" class="form-input" step="0.01" placeholder="Dejar vacío para no cambiar" /></div>
        ` : ''}
        <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">
            Este cambio se aplicará a las <strong>${m.total}</strong> unidad(es) de este modelo en todas las sedes.
        </p>
        <button onclick="_invGuardarEdicionProducto()" class="btn-action btn-primary" style="margin-top:10px;">
            <i class="fas fa-save"></i> Guardar Cambios
        </button>

        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;">
        <label style="display:block;font-size:12px;font-weight:800;color:#1e293b;margin-bottom:8px;">
            <i class="fas fa-warehouse" style="color:#c2410c;"></i> Stock disponible por tienda
        </label>
        ${filasStock || '<p style="font-size:12px;color:var(--text-muted);">No hay sedes registradas.</p>'}
        <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">
            Aumenta el número para generar unidades nuevas (con su código de barras), o redúcelo para quitar
            las unidades <strong>Disponibles</strong> más recientes. No afecta unidades vendidas, reservadas o en traslado.
        </p>

        <button onclick="document.getElementById('modal-inv-editar').style.display='none'" class="btn-action btn-ghost" style="margin-top:10px;">Cerrar</button>
    `;
    document.getElementById('modal-inv-editar').style.display = 'flex';
}

/* ─── Preview de la foto elegida al editar (no se sube todavía) ─── */
let _invEditNuevaFotoFile = null;
function _invPreviewNuevaFotoEdicion(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    _invEditNuevaFotoFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById('ef-foto-preview');
        if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* ─── Ajustar (aumentar/reducir) el stock disponible de un modelo en una sede ─── */
// FIX-DUPLICADO: antes esta función no mandaba 'observaciones' al backend.
// Las unidades nuevas se creaban con observaciones = NULL, distinto de las
// observaciones del modelo original (ej. "Nova cobalto"). Como /api/inventario/resumen
// agrupa las tarjetas por (categoria, nombre_modelo, observaciones), esas unidades
// nuevas aparecían como un modelo aparte — duplicado, sin foto y sin el resto del
// stock — en vez de sumarse a la tarjeta que ya existía.
async function _invAjustarStockSede(sedeId, nombreModelo, categoria, catalogoId, observaciones) {
    const input = document.getElementById(`ef-stock-${sedeId}`);
    if (!input) return;

    const cantidadNueva = parseInt(input.value, 10);
    if (isNaN(cantidadNueva) || cantidadNueva < 0) {
        Swal.fire('Cantidad inválida', 'Ingresa un número de 0 a más.', 'warning');
        return;
    }

    try {
        const res = await apiFetch(`${API_URL}/api/inventario/stock-producto/cantidad`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_modelo:   nombreModelo,
                categoria:       categoria,
                catalogo_id:     catalogoId,
                observaciones:   observaciones || '',
                sede_id:         sedeId,
                cantidad_nueva:  cantidadNueva,
                usuario_id:      window.usuarioActivo?.id,
                usuario_nombre:  window.usuarioActivo?.nombre,
            })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            Swal.fire('Error', data.error || 'No se pudo ajustar el stock.', 'error');
            return;
        }
        Swal.fire({ icon: 'success', title: 'Stock actualizado', text: data.mensaje, timer: 1600, showConfirmButton: false });
        window._invalidarCacheStockTiendas?.();
        _cargarDatosTab();

        // Refrescar también el panel del modal (que sigue abierto) con datos
        // frescos y SIN filtro de sede, para que se vea el stock actualizado
        // de esta tienda junto con el de las demás, sin tener que cerrar y
        // reabrir "Editar".
        if (_invEditOriginal) {
            try {
                const params = new URLSearchParams({
                    categoria: _invEditOriginal.categoria,
                    q:         _invEditOriginal.nombre_modelo
                });
                const resFresh  = await apiFetch(`${API_URL}/api/inventario/resumen?${params}`);
                const dataFresh = await resFresh.json();
                const encontrado = (dataFresh.modelos || []).find(x =>
                    x.categoria === _invEditOriginal.categoria &&
                    (x.nombre_modelo || '').toLowerCase() === (_invEditOriginal.nombre_modelo || '').toLowerCase() &&
                    (x.observaciones || '') === (_invEditOriginal.observaciones || '')
                );
                if (encontrado) {
                    _invEditOriginal = encontrado;
                    _invRenderModalEditarProducto(encontrado);
                }
            } catch (e) { /* si falla el refresco, el modal se queda como estaba */ }
        }
    } catch (e) {
        Swal.fire('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
}

async function _invGuardarEdicionProducto() {
    const m = _invEditOriginal;
    if (!m) return;

    const nuevoNombre = document.getElementById('ef-nombre').value.trim();
    const nuevaCategoria = document.getElementById('ef-categoria').value;
    const nuevasObs = document.getElementById('ef-obs').value.trim();
    const precioEl = document.getElementById('ef-precio');
    const nuevoPrecio = precioEl ? precioEl.value : '';

    if (!nuevoNombre) {
        Swal.fire('Falta el nombre', 'El nombre del modelo no puede estar vacío.', 'warning');
        return;
    }

    try {
        // Si el usuario eligió una foto nueva, subirla primero a Cloudinary
        let nuevaFotoUrl = '';
        if (_invEditNuevaFotoFile) {
            Swal.fire({ title: 'Subiendo foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const fd = new FormData();
            fd.append('foto', _invEditNuevaFotoFile);
            const resUpload = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: fd });
            const dataUpload = await resUpload.json();
            if (!resUpload.ok || dataUpload.error) {
                Swal.fire('Error', dataUpload.error || 'No se pudo subir la foto.', 'error');
                return;
            }
            nuevaFotoUrl = dataUpload.url;
        }

        const res = await apiFetch(`${API_URL}/api/inventario/producto/editar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categoria:      m.categoria,
                nombre_modelo:  m.nombre_modelo,
                observaciones:  m.observaciones || '',
                catalogo_id:    m.catalogo_id || null,
                nuevo_nombre:         nuevoNombre,
                nueva_categoria:      nuevaCategoria,
                nuevas_observaciones: nuevasObs,
                nuevo_precio:         nuevoPrecio !== '' ? parseFloat(nuevoPrecio) : null,
                nueva_foto_url:       nuevaFotoUrl || null,
                usuario_id:     window.usuarioActivo?.id,
                usuario_nombre: window.usuarioActivo?.nombre,
            })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            Swal.fire('Error', data.error || 'No se pudo actualizar el producto.', 'error');
            return;
        }
        _invEditNuevaFotoFile = null;
        document.getElementById('modal-inv-editar').style.display = 'none';
        Swal.fire('Actualizado', data.mensaje || 'Producto actualizado correctamente.', 'success');
        window._invalidarCacheStockTiendas?.();
        _cargarDatosTab();
    } catch (e) {
        Swal.fire('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
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
                <th style="padding:12px 10px;text-align:left;">Forma</th>
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
        const fotoPieza = (p.fotos && p.fotos.length) ? p.fotos[0] : (p.foto_url || 'imagenes/sin_foto.jpg');

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;background:${bg};"
            onmouseover="this.style.background='#eff6ff'"
            onmouseout="this.style.background='${bg}'">
            <td style="padding:12px 16px;position:sticky;left:0;background:inherit;z-index:1;">
                <div style="display:flex; gap:10px; align-items:flex-start;">
                    <input type="checkbox" class="chk-pieza" value="${encodeURIComponent(JSON.stringify(pObj))}" data-cant="${p.disponibles}" style="margin-top:2px;">
                    <img src="${fotoPieza}" alt="${p.nombre_modelo || 'Pieza'}"
                         onclick="_invLightbox('${fotoPieza}', '${(p.nombre_modelo || 'Pieza').replace(/'/g, "\\'")}')"
                         onerror="this.src='imagenes/sin_foto.jpg'"
                         style="width:46px;height:46px;object-fit:cover;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;cursor:zoom-in;flex-shrink:0;">
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
            <td style="padding:12px 10px;font-weight:700;font-size:12px;">${p.forma || ''}</td>
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

    // 1. Construir lista completa de fotos para el carousel
    //    - Para PRODUCTOS: el backend ya manda d.fotos (catálogo + stock + adicionales)
    //    - Para PIEZAS: buscar foto del maestro de materiales
    let todasLasFotos = [];

    if (d.fotos && d.fotos.length) {
        // Caso producto: el backend ya hizo el merge (catálogo primero)
        todasLasFotos = d.fotos.filter(Boolean);
    } else {
        // Caso pieza: buscar foto del maestro en memoria o backend
        let fotoUrlFinal = d.foto_url || '';
        if (!fotoUrlFinal) {
            const cat = (d.categoria || '').toLowerCase();
            let lista = [];
            if (cat === 'tablero') lista = _maestroInv.tableros || [];
            else if (cat === 'silla') lista = _maestroInv.sillas || [];
            else if (cat === 'butaca') lista = _maestroInv.butacas || [];
            else if (cat === 'cojin') lista = _maestroInv.cojines || [];
            else if (cat.includes('base')) lista = _maestroInv.bases_comedor || [];

            const f = lista.find(x =>
                (x.nombre_modelo && x.nombre_modelo.toLowerCase() === (d.nombre_modelo || '').toLowerCase()) ||
                (x.modelo && x.modelo.toLowerCase() === (d.nombre_modelo || '').toLowerCase()) ||
                (x.nombre && x.nombre.toLowerCase() === (d.nombre_modelo || '').toLowerCase()) ||
                (x.nombre_diseno && x.nombre_diseno.toLowerCase() === (d.nombre_modelo || '').toLowerCase())
            );
            if (f && f.foto_url) {
                fotoUrlFinal = f.foto_url;
            } else {
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
        // Maestro primero, luego fotos adicionales del stock
        const fotosMaestro = fotoUrlFinal.split('|').filter(Boolean);
        const fotosAdicionales = (d.fotos_adicionales || '').split('|').filter(Boolean);
        todasLasFotos = [...fotosMaestro, ...fotosAdicionales];
    }

    let fotoHTML = '';
    if (todasLasFotos.length > 0) {
        const carouselId = `carousel-det-${d.id}`;
        const slides = todasLasFotos.map((foto, index) => `
            <div style="min-width:100%; scroll-snap-align:center;">
                <img src="${foto}" alt="${d.nombre_modelo} - Foto ${index + 1}"
                     style="width:100%; height:220px; object-fit:cover; border-radius:12px;"
                     onerror="this.src='imagenes/sin_foto.jpg';">
            </div>
        `).join('');

        const dotsHTML = todasLasFotos.map((_, i) => `
            <div class="inv-dot-${carouselId}" data-idx="${i}"
                 style="width:8px; height:8px; border-radius:50%;
                        background:${i === 0 ? 'white' : 'rgba(255,255,255,0.5)'};
                        border: 1px solid rgba(0,0,0,0.2);
                        cursor:pointer; transition:background .2s;"
                 onclick="_carouselGoTo('${carouselId}', ${i})"></div>
        `).join('');

        fotoHTML = `
            <div style="position:relative; margin-bottom:15px;">
                <div id="${carouselId}" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; border-radius:12px; border:1px solid #e2e8f0; background:#f8fafc; scrollbar-width: none;">
                    ${slides}
                </div>
                ${todasLasFotos.length > 1 ? `
                <button onclick="_carouselNav('${carouselId}', -1)" style="position:absolute; top:50%; left:8px; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center;">‹</button>
                <button onclick="_carouselNav('${carouselId}', 1)" style="position:absolute; top:50%; right:8px; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center;">›</button>
                <div style="position:absolute; bottom:10px; left:0; right:0; display:flex; justify-content:center; gap:5px;">
                    ${dotsHTML}
                </div>
                ` : ''}
            </div>
        `;
    } else {
        fotoHTML = `<div style="text-align:center; margin-bottom:15px; padding:20px; background:#f1f5f9; border-radius:12px; color:var(--text-muted);">
               <i class="fas fa-image" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
               <p style="font-size:12px; margin:0;">Sin foto disponible</p>
           </div>`;
    }

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

    // Sincronizar dots del carousel con el scroll
    if (todasLasFotos.length > 1) {
        const carouselId = `carousel-det-${d.id}`;
        const el = document.getElementById(carouselId);
        if (el) {
            el.addEventListener('scroll', () => {
                const i = Math.round(el.scrollLeft / el.clientWidth);
                document.querySelectorAll(`.inv-dot-${carouselId}`).forEach((dot, dotIdx) => {
                    dot.style.background = dotIdx === i ? 'white' : 'rgba(255,255,255,0.5)';
                });
            }, { passive: true });
        }
    }
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
        window._invalidarCacheStockTiendas?.();
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
            window._invalidarCacheStockTiendas?.();
            await _cargarDatosTab();
        } else { Swal.fire('Error', data.error || 'No se pudo eliminar el registro.', 'error'); }
    } catch(e) { Swal.fire('Error', 'Fallo de conexión al servidor.', 'error'); }
}

/* ─── Modal: Registrar nuevo item ───────────────────────────── */
