// ═══════════════════════════════════════════════════════════════════════════════
// gestores_modelos.js — Gestores de modelos para Comedor, Centro y Butaca
// Replica el mismo patrón que el gestor de Sofá (inline en index.html)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── COMEDOR ─────────────────────────────────────────────────────────────────

const GM_COMEDOR_BASE = [
    { key: 'rect-6',  label: 'Rectangular - 6 Sillas',  foto: 'imagenes/comedor_rect-6.jpg',  tipo: 'rect' },
    { key: 'rect-8',  label: 'Rectangular - 8 Sillas',  foto: 'imagenes/comedor_rect-8.jpg',  tipo: 'rect' },
    { key: 'rect-10', label: 'Rectangular - 10 Sillas', foto: 'imagenes/comedor_rect-10.jpg', tipo: 'rect' },
    { key: 'rect-12', label: 'Rectangular - 12 Sillas', foto: 'imagenes/comedor_rect-12.jpg', tipo: 'rect' },
    { key: 'circ-4',  label: 'Circular - 4 Sillas',     foto: 'imagenes/comedor_circ-4.jpg',  tipo: 'circ' },
    { key: 'circ-6',  label: 'Circular - 6 Sillas',     foto: 'imagenes/comedor_circ-6.jpg',  tipo: 'circ' },
];

const GM_CENTRO_BASE = [
    { key: 'Mesa de Centro', label: 'Mesa de Centro',           foto: 'imagenes/mesa_centro.jpg'  },
    { key: 'Consola',        label: 'Consola / Recibidor',       foto: 'imagenes/consola.jpg'       },
    { key: 'Mesa Lateral',   label: 'Mesa Lateral (Esquinera)',  foto: 'imagenes/mesa_lateral.jpg'  },
];

const GM_BUTACA_BASE = [
    { key: 'Butaca',          label: 'Butaca de Sala',                foto: 'imagenes/butaca.jpg'       },
    { key: 'Silla Suelta',    label: 'Silla (Comedor/Escritorio)',     foto: 'imagenes/silla_suelta.jpg' },
    { key: 'Sitial',          label: 'Sitial (Con brazos de madera)',  foto: 'imagenes/sitial.jpg'       },
    { key: 'Puff / Banqueta', label: 'Puff / Banqueta',               foto: 'imagenes/puff.jpg'         },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function _gmGet(storageKey) {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) { return []; }
}
function _gmSave(storageKey, arr) {
    localStorage.setItem(storageKey, JSON.stringify(arr));
}

// ─── Poblar selects dinámicamente ────────────────────────────────────────────

function gmPopularSelectComedor() {
    const sel = document.getElementById('comedor-formato');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const custom = _gmGet('innova_modelos_comedor');
    [...GM_COMEDOR_BASE, ...custom].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    else if (sel.options.length) sel.value = 'rect-6';
}

function gmPopularSelectCentro() {
    const sel = document.getElementById('centro-tipo');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const custom = _gmGet('innova_modelos_centro');
    [...GM_CENTRO_BASE, ...custom].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function gmPopularSelectButaca() {
    const sel = document.getElementById('butaca-tipo');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const custom = _gmGet('innova_modelos_butaca');
    [...GM_BUTACA_BASE, ...custom].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

// ─── Parches sobre actualizarVistaComedor / Centro / Butaca ──────────────────
// Se sobreescriben DESPUÉS de que catalogo.js las define, para soportar custom.

function _patchVistasConCustom() {

    // ── COMEDOR ──
    const _origComedor = window.actualizarVistaComedor;
    window.actualizarVistaComedor = function() {
        const formato = document.getElementById('comedor-formato')?.value || '';
        // Modelos custom de comedor: cualquier key que no empiece con 'rect' ni 'circ'
        if (!formato.startsWith('rect') && !formato.startsWith('circ')) {
            const custom = _gmGet('innova_modelos_comedor');
            const m = custom.find(c => c.key === formato);
            if (m) {
                const img = document.getElementById('preview-comedor');
                if (img) {
                    img.src = m.foto;
                    img.onerror = function() { this.onerror=null; this.src='imagenes/sin_foto.jpg'; };
                }
                // Medidas genéricas para todos los modelos custom de comedor
                const medContainer = document.getElementById('medidas-comedor-container');
                if (medContainer) medContainer.innerHTML = `
                    <label style="font-size:10px;font-weight:bold;color:gray;">MEDIDAS DEL TABLERO (cm)</label>
                    <div style="display:flex;gap:10px;margin-top:5px;">
                        <input type="number" id="med-tablero-largo" class="form-input-sm" placeholder="Largo (cm)" style="flex:1;">
                        <input type="number" id="med-tablero-ancho" class="form-input-sm" placeholder="Ancho (cm)" style="flex:1;">
                    </div>`;
                return;
            }
        }
        if (typeof _origComedor === 'function') _origComedor();
    };

    // ── CENTRO ──
    const _origCentro = window.actualizarVistaCentro;
    window.actualizarVistaCentro = function() {
        const tipo = document.getElementById('centro-tipo')?.value || '';
        const esBase = GM_CENTRO_BASE.some(m => m.key === tipo);
        if (!esBase) {
            const custom = _gmGet('innova_modelos_centro');
            const m = custom.find(c => c.key === tipo);
            if (m) {
                const img = document.getElementById('preview-centro');
                if (img) {
                    img.src = m.foto;
                    img.onerror = function() { this.onerror=null; this.src='imagenes/sin_foto.jpg'; };
                }
                return;
            }
        }
        if (typeof _origCentro === 'function') _origCentro();
    };

    // ── BUTACA ──
    const _origButaca = window.actualizarVistaButaca;
    window.actualizarVistaButaca = function() {
        const tipo = document.getElementById('butaca-tipo')?.value || '';
        const esBase = GM_BUTACA_BASE.some(m => m.key === tipo);
        if (!esBase) {
            const custom = _gmGet('innova_modelos_butaca');
            const m = custom.find(c => c.key === tipo);
            if (m) {
                const img = document.getElementById('preview-butaca');
                if (img) {
                    img.src = m.foto;
                    img.onerror = function() { this.onerror=null; this.src='imagenes/sin_foto.jpg'; };
                }
                return;
            }
        }
        if (typeof _origButaca === 'function') _origButaca();
    };
}

// ─── Abrir / cerrar modales ───────────────────────────────────────────────────

function abrirGestorModelosComedor() {
    _gmRenderGestor('comedor');
    document.getElementById('modal-gestor-comedor').style.display = 'flex';
}
function cerrarGestorModelosComedor() {
    document.getElementById('modal-gestor-comedor').style.display = 'none';
}

function abrirGestorModelosCentro() {
    _gmRenderGestor('centro');
    document.getElementById('modal-gestor-centro').style.display = 'flex';
}
function cerrarGestorModelosCentro() {
    document.getElementById('modal-gestor-centro').style.display = 'none';
}

function abrirGestorModelosButaca() {
    _gmRenderGestor('butaca');
    document.getElementById('modal-gestor-butaca').style.display = 'flex';
}
function cerrarGestorModelosButaca() {
    document.getElementById('modal-gestor-butaca').style.display = 'none';
}

// ─── Render genérico del gestor ───────────────────────────────────────────────

function _gmRenderGestor(tipo) {
    const cfg = {
        comedor: { storageKey: 'innova_modelos_comedor', base: GM_COMEDOR_BASE,
                   listaBaseId: 'gmc-lista-base', listaCustomId: 'gmc-lista-custom',
                   countId: 'gmc-count' },
        centro:  { storageKey: 'innova_modelos_centro',  base: GM_CENTRO_BASE,
                   listaBaseId: 'gmce-lista-base', listaCustomId: 'gmce-lista-custom',
                   countId: 'gmce-count' },
        butaca:  { storageKey: 'innova_modelos_butaca',  base: GM_BUTACA_BASE,
                   listaBaseId: 'gmb-lista-base', listaCustomId: 'gmb-lista-custom',
                   countId: 'gmb-count' },
    }[tipo];
    if (!cfg) return;

    // Modelos base (chips)
    const listaBaseEl = document.getElementById(cfg.listaBaseId);
    if (listaBaseEl) {
        listaBaseEl.innerHTML = cfg.base.map(m =>
            `<span style="background:#e2e8f0;color:#374151;padding:4px 10px;border-radius:20px;
                          font-size:11px;font-weight:700;">${m.label}</span>`
        ).join('');
    }

    // Modelos custom
    const custom = _gmGet(cfg.storageKey);
    const countEl = document.getElementById(cfg.countId);
    if (countEl) countEl.textContent = custom.length;

    const listaCustomEl = document.getElementById(cfg.listaCustomId);
    if (!listaCustomEl) return;

    if (custom.length === 0) {
        listaCustomEl.innerHTML = `<p style="color:#94a3b8;font-size:12px;text-align:center;padding:12px 0;">
            Sin modelos personalizados aún.</p>`;
        return;
    }

    listaCustomEl.innerHTML = custom.map((m, i) => `
        <div style="display:flex;align-items:center;gap:10px;background:#faf5ff;border:1px solid #ddd6fe;
                    border-radius:10px;padding:10px 12px;">
            <img src="${m.foto}" alt="${m.label}"
                 style="width:52px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #ddd6fe;"
                 onerror="this.style.opacity='0.3'">
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:#1e1b4b;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">${m.label}</div>
            </div>
            <button onclick="_gmEliminarModelo('${tipo}', ${i})"
                    style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;
                           border-radius:7px;padding:5px 9px;cursor:pointer;font-size:13px;flex-shrink:0;"
                    title="Eliminar modelo">🗑</button>
        </div>`
    ).join('');
}

// ─── Sync foto (input cam + galería) ─────────────────────────────────────────

function _gmSyncFotoGestor(inputEl, prefijo) {
    const file = inputEl?.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const dt = new DataTransfer(); dt.items.add(file);
    const cam = document.getElementById(`${prefijo}-foto-cam`);
    const gal = document.getElementById(`${prefijo}-foto`);
    if (cam && cam !== inputEl) cam.files = dt.files;
    if (gal && gal !== inputEl) gal.files = dt.files;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById(`${prefijo}-foto-img`);
        const prev = document.getElementById(`${prefijo}-foto-preview`);
        if (img) img.src = e.target.result;
        if (prev) prev.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// ─── Guardar nuevo modelo ─────────────────────────────────────────────────────

function _gmGuardarModelo(tipo) {
    const prefijos = { comedor: 'gmc', centro: 'gmce', butaca: 'gmb' };
    const storageKeys = {
        comedor: 'innova_modelos_comedor',
        centro:  'innova_modelos_centro',
        butaca:  'innova_modelos_butaca',
    };
    const selIds  = { comedor: 'comedor-formato', centro: 'centro-tipo', butaca: 'butaca-tipo' };
    const actuFns = {
        comedor: () => { gmPopularSelectComedor(); if (typeof actualizarVistaComedor === 'function') actualizarVistaComedor(); },
        centro:  () => { gmPopularSelectCentro();  if (typeof actualizarVistaCentro  === 'function') actualizarVistaCentro();  },
        butaca:  () => { gmPopularSelectButaca();   if (typeof actualizarVistaButaca  === 'function') actualizarVistaButaca();  },
    };

    const pfx      = prefijos[tipo];
    const errEl    = document.getElementById(`${pfx}-error`);
    errEl.style.display = 'none';

    const nombre   = (document.getElementById(`${pfx}-nombre`)?.value || '').trim();
    const fileCam  = document.getElementById(`${pfx}-foto-cam`)?.files[0];
    const fileGal  = document.getElementById(`${pfx}-foto`)?.files[0];
    const file     = fileCam || fileGal;

    if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.style.display='block'; return; }
    if (!file)   { errEl.textContent = 'La foto del modelo es obligatoria.'; errEl.style.display='block'; return; }

    const reader = new FileReader();
    reader.onload = e => {
        const fotoData = e.target.result;
        const key      = `custom_${tipo}_${Date.now()}`;
        const nuevo    = { key, label: nombre, foto: fotoData };

        const custom = _gmGet(storageKeys[tipo]);
        custom.push(nuevo);
        _gmSave(storageKeys[tipo], custom);

        // Actualizar select y vista
        actuFns[tipo]();

        // Seleccionar el nuevo modelo recién guardado
        const sel = document.getElementById(selIds[tipo]);
        if (sel) { sel.value = key; actuFns[tipo](); }

        // Limpiar formulario
        document.getElementById(`${pfx}-nombre`).value = '';
        const camEl = document.getElementById(`${pfx}-foto-cam`);
        const galEl = document.getElementById(`${pfx}-foto`);
        if (camEl) camEl.value = '';
        if (galEl) galEl.value = '';
        const imgEl  = document.getElementById(`${pfx}-foto-img`);
        const prevEl = document.getElementById(`${pfx}-foto-preview`);
        if (imgEl)  imgEl.src = '';
        if (prevEl) prevEl.style.display = 'none';

        // Re-render lista
        _gmRenderGestor(tipo);
    };
    reader.readAsDataURL(file);
}

// ─── Eliminar modelo custom ───────────────────────────────────────────────────

function _gmEliminarModelo(tipo, index) {
    if (!confirm('¿Eliminar este modelo personalizado?')) return;
    const storageKeys = {
        comedor: 'innova_modelos_comedor',
        centro:  'innova_modelos_centro',
        butaca:  'innova_modelos_butaca',
    };
    const selIds  = { comedor: 'comedor-formato', centro: 'centro-tipo', butaca: 'butaca-tipo' };
    const actuFns = {
        comedor: () => { gmPopularSelectComedor(); if (typeof actualizarVistaComedor === 'function') actualizarVistaComedor(); },
        centro:  () => { gmPopularSelectCentro();  if (typeof actualizarVistaCentro  === 'function') actualizarVistaCentro();  },
        butaca:  () => { gmPopularSelectButaca();   if (typeof actualizarVistaButaca  === 'function') actualizarVistaButaca();  },
    };

    const key    = storageKeys[tipo];
    const custom = _gmGet(key);
    const eliminado = custom[index];
    custom.splice(index, 1);
    _gmSave(key, custom);

    // Si el select tenía ese valor, volver al primero
    const sel = document.getElementById(selIds[tipo]);
    if (sel && sel.value === eliminado?.key) {
        actuFns[tipo]();
        sel.selectedIndex = 0;
        actuFns[tipo]();
    } else {
        actuFns[tipo]();
    }

    _gmRenderGestor(tipo);
}

// ─── Inicialización al cargar la página ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    gmPopularSelectComedor();
    gmPopularSelectCentro();
    gmPopularSelectButaca();
    // Parchear las funciones de vista DESPUÉS de que catalogo.js las definió
    setTimeout(_patchVistasConCustom, 0);
});