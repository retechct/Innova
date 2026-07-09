// Inventario - modales, formularios y registro de unidades.

function abrirModalNuevoItem() {
    _fotosAdicionalesActuales = []; // Resetear fotos
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
    const sedes = (_invSedesList || [])
        .map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(s.nombre)}</option>`).join('');
    const cats  = CATEGORIAS_PRODUCTO.map(c=>`<option value="${escapeAttr(c)}">${escapeHTML(c)}</option>`).join('');

    return `
    <div id="inv-nuevo-form-container">
        <div class="form-group"><label>Categoría *</label>
            <select id="nf-cat" class="form-input" onchange="_invFiltrarCatalogoPorCat()">${cats}</select></div>

        <!-- === BUSCADOR INTELIGENTE CON FOTO (igual que piezas) === -->
        <div class="form-group" style="margin-bottom:15px;">
            <label style="font-size:11px;font-weight:bold;color:var(--primary);">MODELO DEL CATÁLOGO</label>
            <div style="display:flex;gap:8px;align-items:center;margin-top:5px;">
                <div class="custom-select-wrapper" style="flex-grow:1;position:relative;">
                    <input type="text" id="search-inv-prod" class="form-input"
                           placeholder="🔍 Buscar modelo en el catálogo..."
                           onkeyup="_invFiltrarCatalogoBuscador()"
                           onfocus="_invMostrarCatalogoBuscador()"
                           autocomplete="off">
                    <div id="list-inv-prod" class="custom-options" style="position:absolute;width:100%;z-index:9999;"></div>
                </div>
                <img id="img-preview-inv-prod" src=""
                     style="width:42px;height:42px;border-radius:6px;object-fit:cover;border:1px solid #cbd5e1;display:none;cursor:zoom-in;"
                     onclick="ampliarImagen(this.src)" title="Haz clic para agrandar">
            </div>
            <input type="hidden" id="nf-catalogo-id">
        </div>

        <div class="form-group"><label>Nombre Modelo *</label>
            <input id="nf-nombre" type="text" class="form-input" placeholder="Sofá Venecia 3 cuerpos" /></div>

        <!-- === INICIO: CAMPOS DINÁMICOS === -->
        <div id="nf-detalles-tela" style="display:none;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group"><label>Color / Tela</label>
                    <input id="nf-color" type="text" class="form-input" placeholder="Beige" /></div>
                <div class="form-group"><label>Acabado</label>
                    <input id="nf-acabado" type="text" class="form-input" placeholder="Liso" /></div>
            </div>
        </div>
        <div id="nf-detalles-mesa" style="display:none;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <div class="form-group"><label>Largo (cm)</label><input id="nf-largo" type="number" class="form-input" /></div>
                <div class="form-group"><label>Ancho (cm)</label><input id="nf-ancho" type="number" class="form-input" /></div>
                <div class="form-group"><label>Alto (cm)</label><input id="nf-alto" type="number" class="form-input" /></div>
            </div>
        </div>
        <div id="nf-detalles-espejo" style="display:none;">
            <div class="form-group"><label>Medidas</label><input id="nf-medidas" type="text" class="form-input" placeholder="Ej: 120cm x 80cm" /></div>
            <div class="form-group"><label>Marco</label><input id="nf-marco" type="text" class="form-input" placeholder="Ej: Dorado, Madera" /></div>
        </div>
        <!-- === FIN: CAMPOS DINÁMICOS === -->

        <!-- === INICIO: FOTOS === -->
        <div class="form-group" style="margin-top:15px;">
            <label style="font-size:11px;font-weight:bold;color:var(--primary);">FOTOS</label>
            <div id="nf-fotos-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding:8px;background:#f8fafc;border-radius:8px;min-height:60px;">
                <!-- Fotos se renderizan aquí -->
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:8px;border-radius:8px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;">
                    <i class="fas fa-camera"></i> Tomar foto
                    <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="_invManejarFotosAdicionales(event, 'nf-fotos-preview')">
                </label>
                <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:8px;border-radius:8px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;">
                    <i class="fas fa-folder-open"></i> Subir archivos
                    <input type="file" accept="image/*" multiple style="display:none;" onchange="_invManejarFotosAdicionales(event, 'nf-fotos-preview')">
                </label>
            </div>
        </div>
        <!-- === FIN: FOTOS === -->

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:15px;">
            <div class="form-group"><label>Sede *</label>
                <select id="nf-sede" class="form-input"><option value="">— Seleccionar —</option>${sedes}</select></div>
            <div class="form-group"><label>Cantidad *</label>
                <input id="nf-cantidad" type="number" class="form-input" value="1" min="1" placeholder="1" /></div>
            <div class="form-group"><label>Costo Ingreso (S/)</label>
                <input id="nf-costo" type="number" class="form-input" placeholder="0.00" step="0.01"/></div>
        </div>
        <div class="form-group"><label>Observaciones</label>
            <input id="nf-obs" type="text" class="form-input" placeholder="Opcional" /></div>
        <button onclick="_invGuardarProducto()" class="btn-action btn-primary" style="margin-top:10px;">
            <i class="fas fa-save"></i> Registrar y Generar Código(s)
        </button>
        <button onclick="_cerrarModalInvNuevo()" class="btn-action btn-ghost">Cancelar</button>
    </div>`;
}

// ─── Buscador inteligente de productos del catálogo ──────────────────────────

function _invMostrarCatalogoBuscador() {
    const searchEl = document.getElementById('search-inv-prod');
    if (!searchEl || searchEl.value.trim() !== '') return;

    // A11: Resetear estado del buscador
    _invSmartSearchState['catalogo'] = { offset: 10 };

    const cat = document.getElementById('nf-cat')?.value || '';
    const lista = _invGetCatalogoPorCat(cat);

    const listContainer = document.getElementById('list-inv-prod');
    if (!listContainer) return;

    const total   = lista.length;
    const ultimas = lista.slice(0, 10);
    const header = `<div style="padding:6px 12px;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;">
        🕐 Últimos en catálogo — escribe para buscar
    </div>`;

    // "Ver todas" solo aparece si de verdad hay más de 10 (igual que en
    // el buscador de materiales — mismo patrón, mismo texto).
    // A11: Cambiado a "Ver más"
    const restantes = total - 10;
    const htmlVerMas = total > 10
        ? `<div class="custom-option-item" id="ver-mas-inv-catalogo" style="justify-content:center; color:#2563eb; font-weight:700; font-size:12px; cursor:pointer;"
                 onclick="_invMostrarMasCatalogo()">
               + Ver más (${restantes} restantes) →
           </div>`
        : '';

    listContainer.innerHTML = header + ultimas.map(p => _invHtmlItemCatalogo(p)).join('') + htmlVerMas;
    listContainer.classList.add('show');
}

/**
 * A11: Carga y añade un lote de 30 productos más a la lista del buscador.
 * Reemplaza a `_invMostrarTodasCatalogoBuscador` que tenía un tope fijo.
 */
function _invMostrarMasCatalogo() {
    const cat = document.getElementById('nf-cat')?.value || '';
    const lista = _invGetCatalogoPorCat(cat);

    const listContainer = document.getElementById('list-inv-prod');
    if (!listContainer) return;

    const state = _invSmartSearchState['catalogo'] || { offset: 10 };
    const BATCH_SIZE = 30;
    const newOffset = state.offset + BATCH_SIZE;

    const nuevosItems = lista.slice(state.offset, newOffset);
    const htmlNuevos = nuevosItems.map(p => _invHtmlItemCatalogo(p)).join('');

    const verMasBoton = document.getElementById('ver-mas-inv-catalogo');
    if (verMasBoton) {
        verMasBoton.insertAdjacentHTML('beforebegin', htmlNuevos);
    } else {
        listContainer.insertAdjacentHTML('beforeend', htmlNuevos);
    }

    state.offset = newOffset;
    _invSmartSearchState['catalogo'] = state;

    if (verMasBoton) {
        const restantes = lista.length - newOffset;
        if (restantes > 0) {
            verMasBoton.innerHTML = `+ Ver más (${restantes} restantes) →`;
        } else {
            verMasBoton.remove();
        }
    }
}

function _invFiltrarCatalogoBuscador() {
    const searchEl = document.getElementById('search-inv-prod');
    const texto = (searchEl?.value || '').toLowerCase().trim();
    const listContainer = document.getElementById('list-inv-prod');
    if (!listContainer) return;

    if (!texto) { _invMostrarCatalogoBuscador(); return; }

    const cat = document.getElementById('nf-cat')?.value || '';
    const lista = _invGetCatalogoPorCat(cat);
    const coincidencias = lista.filter(p =>
        (p.nombre || p.nombre_modelo || '').toLowerCase().includes(texto) ||
        (p.categoria || '').toLowerCase().includes(texto)
    );
    const filtrados = coincidencias.slice(0, 30);

    // Si hay más coincidencias de las que se pintaron, avisamos al pie
    // (mismo patrón que filtrarMaterial en materiales.js).
    const htmlAvisoMas = coincidencias.length > filtrados.length
        ? `<div style="padding:8px 12px; font-size:11px; color:#94a3b8; text-align:center; border-top:1px solid #f1f5f9;">
               Mostrando ${filtrados.length} de ${coincidencias.length} — sigue escribiendo para afinar
           </div>`
        : '';

    listContainer.innerHTML = filtrados.length
        ? filtrados.map(p => _invHtmlItemCatalogo(p)).join('') + htmlAvisoMas
        : `<div style="padding:12px;font-size:12px;color:#94a3b8;text-align:center;">Sin resultados para "${escapeHTML(texto)}"</div>`;
    listContainer.classList.add('show');
}

function _invGetCatalogoPorCat(cat) {
    // Silla y Butaca: usar maestro de materiales
    if (cat === 'Silla')  return (_maestroInv.sillas  || []).map(s => ({ _tipo:'silla',  id: s.sku, nombre_modelo: s.modelo || s.sku, categoria:'Silla',  foto_url: s.foto_url || '', _mat: s.material || '' }));
    if (cat === 'Butaca') return (_maestroInv.butacas || []).map(b => ({ _tipo:'butaca', id: b.sku, nombre_modelo: b.modelo || b.sku, categoria:'Butaca', foto_url: b.foto_url || '', _mat: b.material || '' }));

    // Resto: filtrar catálogo por categoría
    const mapaCategoria = {
        'Sofa':        ['sofa', 'sofá', 'seccional', 'modular'],
        'Mesa Centro': ['mesa centro', 'mesa'],
        'Consola':     ['consola'],
        'Espejo':      ['espejo'],
        'Cuadro':      ['cuadro'],
        'Cojin':       ['cojin', 'cojín'],
        'Esquinero':   ['esquinero'],
        'Florero':     ['florero'],
        'Manta':       ['manta'],
        'Puff':        ['puff'],
    };
    const cats = mapaCategoria[cat] || null;
    return cats
        ? _maestroInv.catalogo.filter(p => cats.includes((p.categoria || '').toLowerCase()))
        : _maestroInv.catalogo;
}

function _invHtmlItemCatalogo(p) {
    const nombre   = p.nombre || p.nombre_modelo || '';
    const cat      = p.categoria || '';
    const fotoUrl  = p.foto_url || p.foto || '';
    const subtitulo = p._mat ? p._mat : cat;
    const safeNom  = jsStringAttr(nombre);
    const safeFoto = jsStringAttr(fotoUrl);
    const safeId   = jsStringAttr((p.id || '').toString());
    const esMaestro = p._tipo === 'silla' || p._tipo === 'butaca';

    return `
        <div class="custom-option-item" onclick="_invSeleccionarProductoCatalogo(${safeId}, ${safeNom}, ${safeFoto}, ${jsStringAttr(esMaestro)})">
            <img src="${escapeAttr(fotoUrl || 'imagenes/sin_foto.jpg')}" class="custom-option-img"
                 onerror="this.src='imagenes/sin_foto.jpg'">
            <div style="flex-grow:1;">
                <span class="custom-option-sku">${escapeHTML(cat.toUpperCase())}</span>
                <div class="custom-option-text"><strong>${escapeHTML(nombre)}</strong>${subtitulo ? '<br>' + escapeHTML(subtitulo) : ''}</div>
            </div>
        </div>`;
}

function _invSeleccionarProductoCatalogo(id, nombre, fotoUrl, esMaestro) {
    // Rellenar campos
    const nfNombre = document.getElementById('nf-nombre');
    if (nfNombre) nfNombre.value = nombre;

    // Guardar id en hidden (string 'maestro' si viene de silla/butaca)
    const hidden = document.getElementById('nf-catalogo-id');
    if (hidden) hidden.value = esMaestro === 'true' ? '' : id;

    // Mostrar miniatura con foto
    const imgPreview = document.getElementById('img-preview-inv-prod');
    if (imgPreview) {
        if (fotoUrl && fotoUrl.startsWith('http')) {
            imgPreview.src = fotoUrl;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.style.display = 'none';
        }
    }

    // Autocompletar categoría si viene del catálogo (no maestro)
    if (esMaestro !== 'true') {
        const prod = _maestroInv.catalogo.find(p => String(p.id) === String(id));
        if (prod) {
            // Autocompletar categoría si existe
            if (prod.categoria) {
            const selCat = document.getElementById('nf-cat');
            if (selCat) {
                const opt = [...selCat.options].find(
                    o => o.value.toLowerCase() === (prod.categoria || '').toLowerCase()
                );
                if (opt) { selCat.value = opt.value; }
            }
            }
            // Mostrar foto en preview de fotos del formulario
            _invRenderizarFotosPreview('nf-fotos-preview', prod.foto_url || fotoUrl);

            // Pre-rellenar observaciones del modelo base
            const obsInput = document.getElementById('nf-obs');
            if (obsInput && prod.observaciones) obsInput.value = prod.observaciones;
        }
    }

    _invActualizarFormDinamico();

    // Mostrar texto en buscador y cerrar lista
    const searchEl = document.getElementById('search-inv-prod');
    if (searchEl) searchEl.value = nombre;
    const listContainer = document.getElementById('list-inv-prod');
    if (listContainer) listContainer.classList.remove('show');
}

// Dispara actualización de forma dinámica cuando cambia la categoría
window._invFiltrarCatalogoPorCat = function() {
    _invActualizarFormDinamico();
    // Limpiar buscador y preview al cambiar categoría
    const searchEl = document.getElementById('search-inv-prod');
    if (searchEl) searchEl.value = '';
    const hidden = document.getElementById('nf-catalogo-id');
    if (hidden) hidden.value = '';
    const imgPreview = document.getElementById('img-preview-inv-prod');
    if (imgPreview) imgPreview.style.display = 'none';
    const listContainer = document.getElementById('list-inv-prod');
    if (listContainer) listContainer.classList.remove('show');
};

function _invActualizarFormDinamico() {
    const cat = document.getElementById('nf-cat')?.value || '';
    const telaDiv   = document.getElementById('nf-detalles-tela');
    const mesaDiv   = document.getElementById('nf-detalles-mesa');
    const espejoDiv = document.getElementById('nf-detalles-espejo');

    // Ocultar todos primero
    if (telaDiv)   telaDiv.style.display   = 'none';
    if (mesaDiv)   mesaDiv.style.display   = 'none';
    if (espejoDiv) espejoDiv.style.display = 'none';

    // Sofá (con o sin acento), Butaca y Silla llevan campo de tela
    const catNorm = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (['sofa','butaca','silla'].includes(catNorm)) {
        if (telaDiv) telaDiv.style.display = 'block';
    } else if (['mesa centro','consola', 'esquinero'].includes(catNorm)) {
        if (mesaDiv) mesaDiv.style.display = 'block';
    } else if (['espejo','cuadro'].includes(catNorm)) {
        if (espejoDiv) espejoDiv.style.display = 'block';
    }
}

function _formPieza() {
    const sedes = (_invSedesList || [])
        .map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(s.nombre)}</option>`).join('');
    const cats = CATEGORIAS_PIEZA.map(c => `<option value="${escapeAttr(c.val)}">${escapeHTML(c.label)}</option>`).join('');

    return `
    <div class="form-group">
        <label>Categoría *</label>
        <select id="npf-cat" class="form-input" onchange="_invLimpiarSmartSearch(); _invUpdateFormaOptions();">${cats}</select>
    </div>
        
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

    <!-- === CAMPOS DINÁMICOS: Tela para silla/butaca === -->
    <div id="npf-detalles-tela" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group"><label>Color / Tela</label>
                <input id="npf-color-tela" type="text" class="form-input" placeholder="Beige, Marrón..." /></div>
            <div class="form-group"><label>Acabado</label>
                <input id="npf-acabado" type="text" class="form-input" placeholder="Liso, Texturado..." /></div>
        </div>
    </div>

    <!-- === INICIO: FOTOS PIEZA === -->
    <div class="form-group" style="margin-top:15px;">
        <label style="font-size:11px;font-weight:bold;color:var(--primary);">FOTOS ADICIONALES</label>
        <div id="npf-fotos-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding:8px;background:#f8fafc;border-radius:8px;min-height:60px;">
            <!-- Fotos se renderizan aquí -->
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
            <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:8px;border-radius:8px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;">
                <i class="fas fa-camera"></i> Tomar foto
                <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="_invManejarFotosAdicionales(event, 'npf-fotos-preview')">
            </label>
            <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:8px;border-radius:8px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;">
                <i class="fas fa-folder-open"></i> Subir archivos
                <input type="file" accept="image/*" multiple style="display:none;" onchange="_invManejarFotosAdicionales(event, 'npf-fotos-preview')">
            </label>
        </div>
    </div>
    <!-- === FIN: FOTOS PIEZA === -->

    <div class="form-group">
        <label>Forma *</label>
        <select id="npf-forma" class="form-input" onchange="_invToggleMedidasPieza()">
            <option value="Rectangular">Rectangular</option>
            <option value="Circular">Circular (diámetro)</option>
            <option value="Irregular">Irregular</option>
        </select>
    </div>
    <div id="npf-wrap-corte" class="form-group" style="display:none;">
        <label>Tipo de Corte (para Tablero Rectangular)</label>
        <select id="npf-corte" class="form-input">
            <option value="Normal">Normal (Recto)</option>
            <option value="Codito">Codito</option>
            <option value="Balde">Balde</option>
            <option value="Media Luna">Media Luna</option>
            <option value="Ovalado">Ovalado</option>
        </select>
    </div>

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

function _invUpdateFormaOptions() {
    const cat = document.getElementById('npf-cat')?.value;
    const formaSelect = document.getElementById('npf-forma');
    if (!formaSelect) return;

    if (cat === 'tablero') {
        formaSelect.innerHTML = `
            <option value="Rectangular">Rectangular</option>
            <option value="Circular">Circular (diámetro)</option>
        `;
    } else {
        // Restaurar opciones por defecto para otras categorías
        formaSelect.innerHTML = `
            <option value="Rectangular">Rectangular</option>
            <option value="Circular">Circular (diámetro)</option>
            <option value="Irregular">Irregular</option>
        `;
    }
    // Disparar el cambio para actualizar los campos dependientes (medidas, corte)
    if (typeof _invToggleMedidasPieza === 'function') {
        _invToggleMedidasPieza();
    }
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
    // Ocultar campos de tela al limpiar
    const telaDiv = document.getElementById('npf-detalles-tela');
    if (telaDiv) telaDiv.style.display = 'none';
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
    const cat = document.getElementById('npf-cat')?.value;
    const forma = document.getElementById('npf-forma')?.value;
    const lblLargo  = document.getElementById('npf-lbl-largo');
    const wrapAncho = document.getElementById('npf-wrap-ancho');
    const wrapCorte = document.getElementById('npf-wrap-corte');
    const telaDiv   = document.getElementById('npf-detalles-tela');

    if (!lblLargo) return;
    lblLargo.textContent = forma === 'Circular' ? 'Diámetro (cm) *' : 'Largo (cm) *';
    if (wrapAncho) {
        wrapAncho.style.display = forma === 'Circular' ? 'none' : '';
    }
    if (wrapCorte) {
        // Mostrar opciones de corte solo para tableros
        wrapCorte.style.display = (cat === 'tablero') ? 'block' : 'none';
    }
    // Mostrar campos de tela solo para silla y butaca
    if (telaDiv) {
        telaDiv.style.display = (cat === 'silla' || cat === 'butaca') ? 'block' : 'none';
    }
}

async function _invGuardarProducto() {
    const nombre = document.getElementById('nf-nombre')?.value;
    const cat    = document.getElementById('nf-cat')?.value;
    const sedeId = document.getElementById('nf-sede')?.value;
    const cantidad = parseInt(document.getElementById('nf-cantidad')?.value) || 1;

    if (!nombre || !cat || !sedeId) {
        Swal.fire('Incompleto', 'Completa Categoría, Modelo y Sede.', 'warning'); return;
    }
    if (cantidad < 1 || cantidad > 50) {
        Swal.fire('Cantidad inválida', 'La cantidad debe ser entre 1 y 50.', 'warning'); return;
    }

    // Leer el id del catálogo desde el hidden del buscador inteligente
    const catId = parseInt(document.getElementById('nf-catalogo-id')?.value) || null;

    // Resolver foto del modelo maestro del catálogo para que aparezca
    // primero en el carousel de detalle y en las tarjetas de stock.
    let fotoUrlCatalogo = '';
    if (catId) {
        const prodCat = _maestroInv.catalogo.find(p => String(p.id) === String(catId));
        if (prodCat) {
            const todasFotosCat = [prodCat.foto_url, ...(prodCat.fotos || [])]
                .filter(Boolean)
                .filter((f, i, arr) => arr.indexOf(f) === i); // dedup
            fotoUrlCatalogo = todasFotosCat.join('|');
        }
    }

    try {
        const payload = {
            catalogo_id:    catId,
            nombre_modelo:  nombre,
            categoria:      cat,
            sede_id:        parseInt(sedeId),
            cantidad:       cantidad,
            costo_ingreso:  parseFloat(document.getElementById('nf-costo')?.value) || null,
            observaciones:  document.getElementById('nf-obs')?.value,
            usuario_id:     window.usuarioActivo?.id,
            usuario_rol:    window.usuarioActivo?.rol,
            usuario_nombre: window.usuarioActivo?.nombre,
            fotos_adicionales: _fotosAdicionalesActuales.join('|'),
            foto_url:       fotoUrlCatalogo
        };

        // Add dynamic fields to payload
        const _catN = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if (['sofa','butaca','silla'].includes(_catN)) {
            payload.color_tela = document.getElementById('nf-color')?.value;
            payload.acabado = document.getElementById('nf-acabado')?.value;
        } else if (['mesa centro','consola', 'esquinero'].includes(_catN)) {
            payload.largo_cm = parseFloat(document.getElementById('nf-largo')?.value) || null;
            payload.ancho_cm = parseFloat(document.getElementById('nf-ancho')?.value) || null;
            payload.alto_cm = parseFloat(document.getElementById('nf-alto')?.value) || null;
        } else if (['Espejo', 'Cuadro'].includes(cat)) {
            const obs = payload.observaciones || '';
            const medidas = document.getElementById('nf-medidas')?.value || '';
            const marco = document.getElementById('nf-marco')?.value || '';
            payload.observaciones = `${obs} | Medidas: ${medidas} | Marco: ${marco}`.replace(/^ \| /, '');
        }

        const res = await apiFetch(`${API_URL}/api/inventario/producto/nuevo`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);

        const nombreProd = document.getElementById('nf-nombre')?.value || '';
        const sedeSel    = document.getElementById('nf-sede');
        const sedeNombre = sedeSel?.options[sedeSel.selectedIndex]?.text || '';

        // El backend devuelve unidades[] si se registraron múltiples, o codigo_barra si fue 1
        const unidades = d.unidades || (d.codigo_barra ? [{ codigo_barra: d.codigo_barra }] : []);

        const codigosHTML = unidades.map(u => {
            const codigoHTML = escapeHTML(u.codigo_barra || '');
            const codigoJS = jsStringAttr(u.codigo_barra || '');
            const nombreJS = jsStringAttr(nombreProd);
            const sedeJS = jsStringAttr(sedeNombre);
            return `
            <div style="margin:6px 0;">
                <b style="color:var(--accent);">${codigoHTML}</b>
                <button onclick="imprimirEtiqueta(${codigoJS}, ${nombreJS}, ${sedeJS})"
                    style="margin-left:10px;background:var(--primary);color:white;border:none;
                           padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
                    🖨️ Imprimir
                </button>
            </div>`;
        }).join('');

        Swal.fire({
            icon: 'success', title: `¡${unidades.length} unidad(es) registrada(s)!`,
            html: `Códigos generados:<br>${codigosHTML}`,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        window._invalidarCacheStockTiendas?.();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

async function _invGuardarPieza() {
    const sku    = document.getElementById('sku-inv-pieza')?.value;
    const nombre = document.getElementById('search-inv-pieza')?.value;
    const cat    = document.getElementById('npf-cat')?.value;
    let forma    = document.getElementById('npf-forma')?.value;
    const sedeId = document.getElementById('npf-sede')?.value;

    // Silla y butaca son piezas enteras, no tienen forma geométrica relevante
    if (cat === 'silla' || cat === 'butaca') {
        forma = forma || 'N/A';
    }

    if (!sku || !nombre || !sedeId) {
        Swal.fire('Incompleto', 'Selecciona el modelo y la sede.', 'warning'); return;
    }

    // Si es un tablero rectangular con un corte especial, usamos el corte como la forma final.
    if (cat === 'tablero' && forma === 'Rectangular') {
        const corte = document.getElementById('npf-corte')?.value;
        if (corte && corte !== 'Normal') {
            forma = corte;
        }
    }

    let mat = '';
    let color = '';
    let fotoMaestro = '';
    if (cat === 'tablero') {
        const f = _maestroInv.tableros.find(x => x.sku === sku);
        if (f) { mat = f.material_base; color = f.color; fotoMaestro = f.foto_url || ''; }
    } else if (cat === 'silla') {
        const f = _maestroInv.sillas.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color_estructura; fotoMaestro = f.foto_url || ''; }
    } else if (cat === 'butaca') {
        const f = _maestroInv.butacas.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color_estructura; fotoMaestro = f.foto_url || ''; }
    } else {
        const f = _maestroInv.bases_comedor.find(x => x.sku === sku);
        if (f) { mat = f.material; color = f.color; fotoMaestro = f.foto_url || ''; }
    }

    try {
        const res = await apiFetch(`${API_URL}/api/inventario/pieza/nueva`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku_maestro:    sku,
                nombre_modelo:  nombre,
                categoria:      cat,
                material:       mat,
                fotos_adicionales: _fotosAdicionalesActuales.join('|'),
                foto_url:       fotoMaestro,
                color_acabado:  color,
                // Campos de tela/acabado para silla y butaca
                color_tela:    (cat === 'silla' || cat === 'butaca') ? (document.getElementById('npf-color-tela')?.value || '') : '',
                acabado:       (cat === 'silla' || cat === 'butaca') ? (document.getElementById('npf-acabado')?.value || '') : '',
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

        const codigosHTML = (d.unidades || []).map(u => {
            const codigoHTML = escapeHTML(u.codigo_barra || '');
            const codigoJS = jsStringAttr(u.codigo_barra || '');
            const nombreJS = jsStringAttr(nombrePieza);
            const sedeJS = jsStringAttr(sedeNombre);
            return `
            <div style="margin:6px 0;">
                <b style="color:var(--accent);">${codigoHTML}</b>
                <button onclick="imprimirEtiqueta(${codigoJS}, ${nombreJS}, ${sedeJS}, '')"
                    style="margin-left:10px;background:var(--primary);color:white;border:none;
                           padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
                    🖨️ Imprimir
                </button>
            </div>`;
        }).join('');

        Swal.fire({
            icon: 'success', title: `¡${d.unidades.length} pieza(s) registradas!`,
            html: `Códigos generados:<br>${codigosHTML}`,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        });
        _cerrarModalInvNuevo();
        window._invalidarCacheStockTiendas?.();
        await _cargarDatosTab();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ─── Ver unidades de un modelo ─────────────────────────────── */
async function _invVerUnidades(nombre, categoria, catalogoId) {
    try {
        const esPieza = (catalogoId === 'es_pieza');
        const tipoQuery = esPieza ? 'pieza' : 'producto';
        const resUnidades = await apiFetch(`${API_URL}/api/inventario/unidades-modelo?tipo=${tipoQuery}&modelo=${encodeURIComponent(nombre)}`);
        
        if (!resUnidades.ok) throw new Error('No se pudo cargar el detalle de unidades.');
        
        const unidades = await resUnidades.json();

        let html = '';
        if (unidades.length > 0) {
            // Agrupar por sede para mostrar totales
            const porSede = unidades.reduce((acc, u) => {
                const sede = u.sede || 'Sin sede';
                if (!acc[sede]) acc[sede] = { disponibles: 0, total: 0 };
                acc[sede].total++;
                if (u.estado === 'Disponible') acc[sede].disponibles++;
                return acc;
            }, {});

            html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:15px;">`;
            Object.entries(porSede).forEach(([sede, counts]) => {
                html += `<div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:6px;">${escapeHTML(sede)}</div>
                    <div style="font-size:2rem;font-weight:900;color:${counts.disponibles>0?'#16a34a':'#cbd5e1'};">${counts.disponibles}</div>
                    <div style="font-size:10px;color:var(--text-muted);">disponibles</div>
                    ${counts.total > counts.disponibles ? `<div style="font-size:10px;color:var(--text-muted);">${counts.total} total</div>` : ''}
                </div>`;
            });
            html += `</div>`;

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
                                    ${unidades.map(u => {
                                        const codigoHTML = escapeHTML(u.codigo_barra || '');
                                        const codigoJS = jsStringAttr(u.codigo_barra || '');
                                        const sedeHTML = escapeHTML(u.sede || '');
                                        const estadoHTML = escapeHTML(u.estado || '');
                                        return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                            <td style="padding: 8px; font-weight: bold; color: var(--accent);">${codigoHTML}</td>
                                            <td style="padding: 8px;">${sedeHTML}</td>
                                            <td style="padding: 8px; text-align: center;">
                                                <span style="background: ${u.estado === 'Disponible' ? '#dcfce7' : '#f1f5f9'}; color: ${u.estado === 'Disponible' ? '#16a34a' : '#64748b'}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">${estadoHTML}</span>
                                            </td>
                                            <td style="padding: 8px; text-align: center;">
                                                <button onclick="Swal.close(); setTimeout(() => _invBuscarBarcode(${codigoJS}), 300)" style="background: var(--primary); color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold;"><i class="fa-solid fa-eye"></i> Detalles</button>
                                            </td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
        } else {
            html = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No hay unidades físicas registradas para este modelo.</p>`;
        }
        Swal.fire({
            title: nombre,
            html, width: '90vw', maxWidth: '680px',
            confirmButtonColor: '#0f172a',
            confirmButtonText: 'Cerrar'
        });
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}
