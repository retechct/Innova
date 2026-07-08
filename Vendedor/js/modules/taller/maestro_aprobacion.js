// Taller - inventario maestro y aprobaciones
const _maestroRenderState = {};
const _MAESTRO_BATCH = 40;

function _setMaestroSeccion(id, items, tipoResolver, key) {
    _maestroRenderState[key] = {
        id,
        items: items || [],
        tipoResolver,
        offset: 0,
    };
    _renderMaestroSeccion(key, true);
}

function _renderMaestroSeccion(key, reset = false, filtrados = null) {
    const state = _maestroRenderState[key];
    if (!state) return;
    const el = document.getElementById(state.id);
    if (!el) return;

    const lista = filtrados || state.items;
    if (reset) state.offset = 0;
    const nextOffset = filtrados ? lista.length : Math.min(state.offset + _MAESTRO_BATCH, lista.length);
    const visibles = lista.slice(0, nextOffset);

    el.innerHTML = visibles.map(i => dibujarTarjetaMaterial(i, state.tipoResolver(i))).join('');
    state.offset = nextOffset;

    if (!filtrados && nextOffset < lista.length) {
        el.insertAdjacentHTML('beforeend', `
            <button type="button" onclick="_verMasMaestro('${key}')"
                style="grid-column:1/-1;border:1.5px dashed #94a3b8;background:#f8fafc;color:#475569;
                       border-radius:10px;padding:12px;font-size:12px;font-weight:800;cursor:pointer;">
                Ver mas (${lista.length - nextOffset} restantes)
            </button>
        `);
    }
}

function _verMasMaestro(key) {
    _renderMaestroSeccion(key, false);
}

function _textoMaestroItem(item) {
    return Object.values(item || {})
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();
}

/* --- CARGAR INVENTARIO DE TALLER --- */
async function cargarInventarioTaller() {
    try {
        // Usar los datos del maestro en memoria para asegurar que tengan sku y foto_url
        if (!maestroMateriales || !maestroMateriales.telas) {
            if (typeof _refreshMaestro === 'function') await _refreshMaestro();
        }

        const telas = maestroMateriales.telas || [];
        const cojines = maestroMateriales.cojines || [];
        const tableros = maestroMateriales.tableros || [];
        const metal = [...(maestroMateriales.bases || []), ...(maestroMateriales.bases_comedor || [])];
        const madera = [...(maestroMateriales.sillas || []), ...(maestroMateriales.butacas || [])];

        _setMaestroSeccion('contenedor-telas-admin',    telas,    () => 'tela', 'telas');
        _setMaestroSeccion('contenedor-cojines-admin',  cojines,  () => 'cojin', 'cojines');
        _setMaestroSeccion('contenedor-tableros-admin', tableros, () => 'tablero', 'tableros');
        _setMaestroSeccion('contenedor-metal-admin',    metal,    i => i.categoria==='BASE'?'base':'base-comedor', 'metal');
        _setMaestroSeccion('contenedor-madera-admin',   madera,   i => i.categoria==='SILLA'?'silla':'butaca', 'madera');

        // Reaplicar filtros activos si el usuario estaba buscando
        ['telas','cojines','tableros','metal','madera'].forEach(k => {
            const inp = document.getElementById('buscador-' + k);
            if (inp && inp.value.trim()) filtrarSeccionMaestro(k);
        });

    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}

/**
 * filtrarVistaMaestro — muestra/oculta secciones completas del maestro.
 * key: 'todos' | 'telas' | 'cojines' | 'tableros' | 'metal' | 'madera'
 */
function filtrarVistaMaestro(key) {
    // Al cambiar de categoría, limpiar el filtro de proveedor de telas
    if (key !== 'telas' && key !== 'todos') {
        _proveedorTelaActivo = null;
    }

    const secciones = {
        telas:    'seccion-wrapper-telas',
        cojines:  'seccion-wrapper-cojines',
        tableros: 'seccion-wrapper-tableros',
        metal:    'seccion-wrapper-metal',
        madera:   'seccion-wrapper-madera',
    };

    // Mostrar/ocultar secciones
    Object.entries(secciones).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (key === 'todos' || key === k) ? '' : 'none';
    });

    // Chips de proveedor: solo visibles en vista "telas" o "todos"
    const barraProveedores = document.getElementById('filtros-proveedor-telas');
    if (barraProveedores) {
        if (key === 'telas' || key === 'todos') {
            _renderChipsProveedoresTelas();
            barraProveedores.style.display = 'flex';
        } else {
            barraProveedores.style.display = 'none';
        }
    }

    // Resaltar botón activo
    const colores = {
        todos:    { bg: 'var(--primary)', color: 'white',   border: 'var(--primary)' },
        telas:    { bg: '#7c3aed',        color: 'white',   border: '#7c3aed' },
        cojines:  { bg: '#ec4899',        color: 'white',   border: '#ec4899' },
        tableros: { bg: '#0284c7',        color: 'white',   border: '#0284c7' },
        metal:    { bg: '#0369a1',        color: 'white',   border: '#0369a1' },
        madera:   { bg: '#b45309',        color: 'white',   border: '#b45309' },
    };
    const inactivo = { bg: 'white', border: null };

    ['todos','telas','cojines','tableros','metal','madera'].forEach(k => {
        const btn = document.getElementById('filtro-btn-' + k);
        if (!btn) return;
        if (k === key) {
            const c = colores[k];
            btn.style.background = c.bg;
            btn.style.color = c.color;
            btn.style.borderColor = c.border;
        } else {
            const c = colores[k];
            btn.style.background = 'white';
            btn.style.color = c.bg;
            btn.style.borderColor = c.bg;
        }
    });
}

/**
 * filtrarSeccionMaestro — filtra las tarjetas visibles en cada sección del maestro.
 * key: 'telas' | 'cojines' | 'tableros' | 'metal' | 'madera'
 */
function filtrarSeccionMaestro(key) {
    // Para telas, delegar al filtro combinado (proveedor + texto)
    if (key === 'telas') {
        filtrarPorProveedorTela(_proveedorTelaActivo);
        return;
    }

    const mapaBuscador = {
        telas:    { input: 'buscador-telas',    contenedor: 'contenedor-telas-admin' },
        cojines:  { input: 'buscador-cojines',  contenedor: 'contenedor-cojines-admin' },
        tableros: { input: 'buscador-tableros',  contenedor: 'contenedor-tableros-admin' },
        metal:    { input: 'buscador-metal',    contenedor: 'contenedor-metal-admin' },
        madera:   { input: 'buscador-madera',   contenedor: 'contenedor-madera-admin' },
    };

    const cfg = mapaBuscador[key];
    if (!cfg) return;

    const query = (document.getElementById(cfg.input)?.value || '').toLowerCase().trim();
    const contenedor = document.getElementById(cfg.contenedor);
    if (!contenedor) return;

    const state = _maestroRenderState[key];
    const filtrados = state
        ? state.items.filter(item => !query || _textoMaestroItem(item).includes(query))
        : [];
    _renderMaestroSeccion(key, true, query ? filtrados : null);
    let visibles = query ? filtrados.length : (state?.items.length || contenedor.children.length);

    // Mostrar mensaje si no hay resultados
    let sinResultados = contenedor.querySelector('.maestro-sin-resultados');
    if (visibles === 0 && query) {
        if (!sinResultados) {
            sinResultados = document.createElement('p');
            sinResultados.className = 'maestro-sin-resultados';
            sinResultados.style.cssText = 'color:#94a3b8;font-size:13px;text-align:center;padding:30px 0;grid-column:1/-1;';
            contenedor.appendChild(sinResultados);
        }
        sinResultados.textContent = `Sin resultados para "${query}"`;
        sinResultados.style.display = '';
    } else if (sinResultados) {
        sinResultados.style.display = 'none';
    }
}


/* ================================================================= */
/* --- FILTRO DE PROVEEDORES EN MAESTRO DE TELAS --- */
/* ================================================================= */

// Proveedor actualmente seleccionado (null = todos)
let _proveedorTelaActivo = null;

/**
 * Genera los chips de proveedor a partir de maestroMateriales.telas.
 * Opera 100% en memoria, sin llamadas al backend.
 */
function _renderChipsProveedoresTelas() {
    const barra = document.getElementById('filtros-proveedor-telas');
    if (!barra) return;

    // Extraer proveedores únicos y ordenarlos
    const proveedores = [...new Set(
        (maestroMateriales.telas || [])
            .map(t => (t.proveedor || '').trim())
            .filter(Boolean)
    )].sort();

    if (proveedores.length === 0) {
        barra.style.display = 'none';
        return;
    }

    // Estilos base para chips
    const baseStyle = `
        padding:5px 13px;border-radius:20px;border:2px solid #7c3aed;
        font-size:11px;font-weight:700;cursor:pointer;transition:all 0.18s;
        white-space:nowrap;
    `;

    // Chip "Todos"
    const chips = [`
        <button
            id="chip-prov-todos"
            onclick="filtrarPorProveedorTela(null)"
            style="${baseStyle} background:${_proveedorTelaActivo === null ? '#7c3aed' : 'white'};
                   color:${_proveedorTelaActivo === null ? 'white' : '#7c3aed'};">
            Todos
        </button>
    `];

    // Un chip por proveedor
    proveedores.forEach(prov => {
        const activo = _proveedorTelaActivo === prov;
        chips.push(`
            <button
                onclick="filtrarPorProveedorTela('${prov.replace(/'/g, "\\'")}')"
                style="${baseStyle} background:${activo ? '#7c3aed' : 'white'};
                       color:${activo ? 'white' : '#7c3aed'};">
                ${prov}
            </button>
        `);
    });

    // Mantener el label y reemplazar solo los chips
    barra.innerHTML = `
        <span style="font-size:10px;font-weight:900;color:#7c3aed;letter-spacing:0.06em;margin-right:4px;align-self:center;">
            PROVEEDOR:
        </span>
        ${chips.join('')}
    `;
}

/**
 * Filtra las tarjetas de telas combinando proveedor seleccionado + texto del buscador.
 * @param {string|null} proveedor — null = mostrar todos
 */
function filtrarPorProveedorTela(proveedor) {
    _proveedorTelaActivo = proveedor;

    // Re-renderizar chips para reflejar el activo
    _renderChipsProveedoresTelas();

    const query = (document.getElementById('buscador-telas')?.value || '').toLowerCase().trim();
    const contenedor = document.getElementById('contenedor-telas-admin');
    if (!contenedor) return;

    const state = _maestroRenderState.telas;
    const filtrados = state
        ? state.items.filter(item => {
            const texto = _textoMaestroItem(item);
            const coincideTexto = !query || texto.includes(query);
            const coincideProveedor = !proveedor || texto.includes(proveedor.toLowerCase());
            return coincideTexto && coincideProveedor;
        })
        : [];
    _renderMaestroSeccion('telas', true, (query || proveedor) ? filtrados : null);
    const visibles = (query || proveedor) ? filtrados.length : (state?.items.length || 0);

    // Mensaje si no hay resultados
    let sinRes = contenedor.querySelector('.maestro-sin-resultados');
    if (visibles === 0) {
        if (!sinRes) {
            sinRes = document.createElement('p');
            sinRes.className = 'maestro-sin-resultados';
            sinRes.style.cssText = 'color:#94a3b8;font-size:13px;text-align:center;padding:30px 0;grid-column:1/-1;';
            contenedor.appendChild(sinRes);
        }
        const desc = [proveedor, query].filter(Boolean).join(' + ');
        sinRes.textContent = `Sin resultados para "${desc}"`;
        sinRes.style.display = '';
    } else if (sinRes) {
        sinRes.style.display = 'none';
    }
}

/* ================================================================= */
/* --- EDITAR FOTO DE UN ÍTEM PENDIENTE EN EL GESTOR DE APROBACIÓN --- */
/* ================================================================= */
function editarFotoAprobacion(tipo, id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('tipo', tipo);
        formData.append('id', id);
        formData.append('foto', file);

        try {
            Swal.fire({ title: 'Subiendo foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res  = await apiFetch(`${API_URL}/api/aprobacion/actualizar-foto`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.exito) {
                Swal.fire({ title: '¡Foto actualizada!', icon: 'success', timer: 1200, showConfirmButton: false });
                cargarGestorAprobacion();
            } else {
                Swal.fire('Error', data.error || 'No se pudo actualizar la foto.', 'error');
            }
        } catch(e) {
            Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
        }
    };
    input.click();
}

/* ================================================================= */
/* --- LÓGICA DE MESA DE CENTRO Y CONSOLA --- */
/* ================================================================= */
async function cargarGestorAprobacion() {
    const contenedor = document.getElementById('lista-aprobacion-pendientes');
    if (!contenedor) return;
    contenedor.style.display = 'grid';
    contenedor.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';
    contenedor.style.gap = '15px';
    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; grid-column: 1/-1;">Sincronizando modelos e insumos pendientes...</p>';

    // Cargar cambios de precio pendientes en paralelo
    cargarCambiosPrecioPendientes();

    try {
        // Ejecutamos las tres consultas simultáneamente
        const [resMuebles, resInsumos, resDisenos] = await Promise.all([
            apiFetch(`${API_URL}/api/creaciones`),
            apiFetch(`${API_URL}/api/sugerencias`),
            apiFetch(`${API_URL}/api/disenos-referencia?estado=Pendiente`)
        ]);

        const creaciones = await resMuebles.json();
        const sugerenciasInsumos = await resInsumos.json();
        const disenosReferencia = resDisenos.ok ? await resDisenos.json() : [];

        const mueblesPendientes = creaciones.filter(c => c.estado === 'Pendiente');
        const insumosPendientes = sugerenciasInsumos.filter(i => i.estado === 'Pendiente');
        const disenosPendientes = Array.isArray(disenosReferencia) ? disenosReferencia : [];

        if (mueblesPendientes.length === 0 && insumosPendientes.length === 0 && disenosPendientes.length === 0) {
            contenedor.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 15px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-check-double" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                    <h3 style="margin:0 0 5px 0;">¡Bandeja de Aprobaciones Vacía!</h3>
                    <p style="margin:0; color:gray; font-size:13px;">Todo el catálogo e insumos están al día.</p>
                </div>`;
            return;
        }

        let htmlFinal = "";

        // Renderizado de Modelos de Muebles Personalizados
        mueblesPendientes.forEach(item => {
            htmlFinal += `
            <div class="card-produccion" style="position:relative; background: #ffffff; border: 1px solid #e2e8f0; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="badge-area" style="position:absolute; top:15px; left:15px; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">MUEBLE: ${item.categoria}</div>
                <div style="position:relative;">
                    <img src="${item.foto_url.startsWith('http') ? item.foto_url : `${API_URL}/uploads/` + item.foto_url}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 12px;" onerror="this.src='imagenes/sin_foto.jpg'">
                    <button onclick="editarFotoAprobacion('mueble', ${item.id})"
                            title="Editar foto"
                            style="position:absolute; bottom:20px; right:8px; background:rgba(15,23,42,0.85); color:white;
                                   border:none; border-radius:7px; width:30px; height:30px; cursor:pointer; font-size:13px;">
                        ✏️
                    </button>
                </div>
                <h4 style="margin: 0 0 4px 0; color:#0f172a; font-size:14px;">${item.nombre}</h4>
                <small style="color:gray; display:block; margin-bottom:8px;">Subido por: <b>${item.vendedor || 'Vendedor'}</b></small>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 15px; background: #f8fafc; padding: 8px; border-radius: 6px; line-height:1.4;">
                    ${item.detalles.replace(/\n/g, '<br>')}
                </div>
                <div style="display:flex; gap:8px; margin-top:auto;">
                    <button class="btn-action btn-primary" style="flex:1; font-size:11px; padding:10px; border-radius:8px;"
                            onclick="procesarAprobacion(${item.id}, '${item.nombre}')">
                        <i class="fa-solid fa-check"></i> APROBAR
                    </button>
                    <button style="flex:1; font-size:11px; padding:10px; border-radius:8px; background:#dc2626; border:none; color:white; font-weight:bold; cursor:pointer;"
                            onclick="rechazarMueble(${item.id}, '${item.nombre.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-xmark"></i> RECHAZAR
                    </button>
                </div>
            </div>`;
        });

        // Renderizado de Insumos / Partes Sugeridas
        insumosPendientes.forEach(insumo => {
            let datos = {};
            try { datos = JSON.parse(insumo.datos_json); } catch(e) {}
            
            // Construir desglose legible de las propiedades técnicas enviadas en el JSON
            let especificacionesInsumo = "";
            for (const [key, value] of Object.entries(datos || {})) {
                if (key !== 'nombre_insumo') {
                    especificacionesInsumo += `<b>${key.toUpperCase()}:</b> ${value}<br>`;
                }
            }

            htmlFinal += `
            <div class="card-produccion" style="position:relative; background: #fffdf5; border: 1px dashed #d4af37; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="badge-template" style="position:absolute; top:15px; left:15px; background: #f59e0b; color:white;">📌 INSUMO: ${insumo.tipo.toUpperCase()}</div>
                <div style="position:relative;">
                    <img src="${insumo.foto_url}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 12px;" onerror="this.src='imagenes/sin_foto.jpg'">
                    <button onclick="editarFotoAprobacion('insumo', ${insumo.id})"
                            title="Editar foto"
                            style="position:absolute; bottom:20px; right:8px; background:rgba(15,23,42,0.85); color:white;
                                   border:none; border-radius:7px; width:30px; height:30px; cursor:pointer; font-size:13px;">
                        ✏️
                    </button>
                </div>
                <h4 style="margin: 0 0 4px 0; color:#0f172a; font-size:14px;">${insumo.nombre}</h4>
                <small style="color:gray; display:block; margin-bottom:8px;">Sugerido por: <b>${insumo.vendedor}</b></small>
                <div style="font-size: 11px; color: #b45309; margin-bottom: 15px; background: #fffbeb; padding: 8px; border-radius: 6px; line-height:1.4; text-align:left;">
                    ${especificacionesInsumo || 'Instrucciones estándar básicas.'}
                </div>
                <div style="display:flex; gap:8px; margin-top:auto;">
                    <button class="btn-primary" style="flex:1; font-size:11px; padding:10px; border-radius:8px; background:#d97706; border:none; color:white; font-weight:bold; cursor:pointer;"
                            onclick="procesarAprobacionInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")}', '${insumo.tipo}')">
                        <i class="fa-solid fa-stamp"></i> EVALUAR
                    </button>
                    <button style="flex:1; font-size:11px; padding:10px; border-radius:8px; background:#dc2626; border:none; color:white; font-weight:bold; cursor:pointer;"
                            onclick="rechazarInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-xmark"></i> RECHAZAR
                    </button>
                </div>
            </div>`;
        });

        // Renderizado de Diseños de Referencia (Pinterest/Inspiración)
        disenosPendientes.forEach(diseno => {
            const pinterestBtn = diseno.url_pinterest
                ? `<a href="${diseno.url_pinterest}" target="_blank" rel="noopener"
                      style="display:inline-flex;align-items:center;gap:5px;font-size:11px;
                             color:#e60023;text-decoration:none;font-weight:700;margin-bottom:8px;">
                      <i class="fa-brands fa-pinterest-p"></i> Ver en Pinterest
                   </a>`
                : '';
            htmlFinal += `
            <div class="card-produccion" style="position:relative; background: #fff8f8; border: 1px dashed #e60023; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="badge-template" style="position:absolute; top:15px; left:15px; background: #e60023; color:white; font-size:10px; padding:3px 8px; border-radius:20px; font-weight:700;">📌 DISEÑO: ${diseno.categoria.toUpperCase()}</div>
                <div style="position:relative;">
                    <img src="${diseno.foto_url}" style="width:100%; height:160px; object-fit:cover; border-radius:10px; margin-bottom:12px; margin-top:8px;" onerror="this.src='imagenes/sin_foto.jpg'">
                    <button onclick="editarFotoAprobacion('diseno', ${diseno.id})"
                            title="Editar foto"
                            style="position:absolute; bottom:20px; right:8px; background:rgba(15,23,42,0.85); color:white;
                                   border:none; border-radius:7px; width:30px; height:30px; cursor:pointer; font-size:13px;">
                        ✏️
                    </button>
                </div>
                <h4 style="margin:0 0 2px 0; color:#0f172a; font-size:14px;">${diseno.nombre}</h4>
                <small style="color:gray; display:block; margin-bottom:6px;">Subido por: <b>${diseno.vendedor || 'Vendedor'}</b> · ${diseno.fecha}</small>
                ${pinterestBtn}
                ${diseno.descripcion ? `<div style="font-size:11px; color:#7c3a3a; margin-bottom:12px; background:#fff0f0; padding:8px; border-radius:6px; line-height:1.5;">${diseno.descripcion}</div>` : ''}
                <div style="display:flex; gap:8px; margin-top:auto;">
                    <button class="btn-primary" style="flex:1; font-size:11px; padding:9px; border-radius:8px; background:#15803d; border:none; color:white; font-weight:bold; cursor:pointer;"
                            onclick="aprobarDiseno(${diseno.id}, '${diseno.nombre.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-check"></i> APROBAR
                    </button>
                    <button class="btn-primary" style="flex:1; font-size:11px; padding:9px; border-radius:8px; background:#dc2626; border:none; color:white; font-weight:bold; cursor:pointer;"
                            onclick="rechazarDiseno(${diseno.id}, '${diseno.nombre.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-xmark"></i> RECHAZAR
                    </button>
                </div>
            </div>`;
        });

        contenedor.innerHTML = htmlFinal;

    } catch (error) {
        console.error("Error unificando gestor:", error);
        contenedor.innerHTML = '<p style="color:red; text-align:center; grid-column: 1/-1;">❌ Error de sincronización con la base de datos.</p>';
    }
}

// ─── Aprobar diseño de referencia ────────────────────────────────────────────
async function aprobarDiseno(id, nombre) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Aprobar diseño de referencia?',
        html: `<p style="color:#475569; font-size:13px;">El diseño <b>${nombre}</b> quedará disponible
               como referencia visual aprobada para el equipo.</p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, aprobar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#15803d',
    });
    if (!isConfirmed) return;

    try {
        Swal.fire({ title: 'Aprobando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res  = await apiFetch(`${API_URL}/api/disenos-referencia/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diseno_id: id })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Aprobado!', data.mensaje, 'success');
            cargarGestorAprobacion();
        } else {
            Swal.fire('Error', data.error || 'No se pudo aprobar.', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

// ─── Rechazar diseño de referencia ───────────────────────────────────────────
async function rechazarDiseno(id, nombre) {
    const { value: motivo } = await Swal.fire({
        title: 'Rechazar diseño',
        html: `<p style="color:#475569;font-size:13px;margin-bottom:10px;">
                  Indica el motivo para rechazar: <b>${nombre}</b></p>
               <textarea id="swal-motivo-diseno" class="swal2-textarea"
                         placeholder="Ej: No aplica para nuestro estilo, imagen de baja calidad..."
                         style="min-height:80px;width:90%;"></textarea>`,
        showCancelButton: true,
        confirmButtonText: 'Rechazar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            const m = document.getElementById('swal-motivo-diseno')?.value.trim();
            if (!m) { Swal.showValidationMessage('El motivo es obligatorio.'); return false; }
            return m;
        }
    });
    if (!motivo) return;

    try {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res  = await apiFetch(`${API_URL}/api/disenos-referencia/rechazar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diseno_id: id, motivo })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('Rechazado', data.mensaje, 'info');
            cargarGestorAprobacion();
        } else {
            Swal.fire('Error', data.error || 'No se pudo rechazar.', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

// Ventana de evaluación contable/operativa de insumos para el Admin
async function procesarAprobacionInsumo(id, nombre, tipo) {
    let camposExtra = '';
    if (tipo === 'tela') {
        camposExtra = `
            <label style="font-weight:900; font-size:11px; color:#475569; display:block; margin-top:10px;">COLECCIÓN (Obligatorio):</label>
            <input id="swal-campo1" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Velvet">
            <label style="font-weight:900; font-size:11px; color:#475569; display:block;">COLOR (Obligatorio):</label>
            <input id="swal-campo2" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Gris Plata">
        `;
    } else if (tipo === 'cojin') {
        camposExtra = `
            <label style="font-weight:900; font-size:11px; color:#475569; display:block; margin-top:10px;">NOMBRE DISEÑO (Obligatorio):</label>
            <input id="swal-campo1" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Geométrico">
            <label style="font-weight:900; font-size:11px; color:#475569; display:block;">TIPO TELA (Obligatorio):</label>
            <input id="swal-campo2" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Jacquard">
        `;
    } else {
        camposExtra = `
            <label style="font-weight:900; font-size:11px; color:#475569; display:block; margin-top:10px;">MODELO / DISEÑO (Obligatorio):</label>
            <input id="swal-campo1" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Zócalo Bajo">
            <label style="font-weight:900; font-size:11px; color:#475569; display:block;">MATERIAL / COLOR (Obligatorio):</label>
            <input id="swal-campo2" class="swal2-input" style="height:35px; margin:5px 0 10px; width:100%;" placeholder="Ej: Madera Nogal">
        `;
    }

    const { value: origenEstrategia } = await Swal.fire({
        title: 'Oficializar Insumo',
        html: `
            <div style="text-align: left; padding: 5px; font-size:13px;">
                <p style="color:#475569; margin-bottom:10px;">Estás a punto de ingresar al maestro: <b style="color:#0f172a;">${nombre}</b></p>
                <label style="font-weight:900; font-size:11px; color:var(--primary); display:block; margin-bottom:5px;">DEFINIR ORIGEN DE PRODUCCIÓN (Make vs Buy):</label>
                <select id="swal-insumo-origen" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:14px;">
                    <option value="Externo">📦 COMPRA EXTERNA (Se compra directo a proveedor)</option>
                    <option value="Interno">🛠️ FABRICACIÓN INTERNA (Se procesa en el taller)</option>
                </select>
                <hr style="margin: 15px 0; border: 0; border-top: 1px dashed #cbd5e1;">
                <p style="color:#d97706; font-size:11px; font-weight:bold; margin-bottom:5px;">Completa los datos para el catálogo maestro:</p>
                ${camposExtra}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Oficializar Insumo',
        cancelButtonText: 'Rechazar',
        confirmButtonColor: '#d97706',
        preConfirm: () => {
            const campo1 = document.getElementById('swal-campo1') ? document.getElementById('swal-campo1').value.trim() : '';
            const campo2 = document.getElementById('swal-campo2') ? document.getElementById('swal-campo2').value.trim() : '';
            if (!campo1 || !campo2) {
                Swal.showValidationMessage('Debes completar los datos obligatorios del insumo');
                return false;
            }
            return {
                origen: document.getElementById('swal-insumo-origen').value,
                campo1: campo1,
                campo2: campo2
            };
        }
    });

    if (origenEstrategia) {
        Swal.fire({ title: 'Insertando en maestros...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await apiFetch(`${API_URL}/api/sugerencias/aprobar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sugerencia_id: id, 
                    origen: origenEstrategia.origen,
                    campo1: origenEstrategia.campo1,
                    campo2: origenEstrategia.campo2
                })
            });
            const data = await res.json();
            if (data.exito) {
                Swal.fire('¡Aprobado Oficial!', data.mensaje, 'success');
                cargarGestorAprobacion();
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Error de comunicación con Flask', 'error');
        }
    }
}

async function procesarAprobacion(id, nombre) {
    const { value: formValues } = await Swal.fire({
        title: 'Aprobación Técnica y Contable',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p style="font-size: 13px; margin-bottom: 15px; color:#475569;">Configura los costos y estrategia para: <b style="color:#0f172a;">${nombre}</b></p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 15px;">
                    <label style="font-size: 10px; font-weight: 900; color:var(--danger); display: block;">1. COSTO REAL (Producción/Compra) S/</label>
                    <input id="swal-costo" class="swal2-input" type="number" placeholder="Ej: 800" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--warning); display: block;">2. PRECIO MÍNIMO PERMITIDO S/</label>
                    <input id="swal-precio-min" class="swal2-input" type="number" placeholder="Ej: 1200" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--success); display: block;">3. PRECIO ETIQUETA / SUGERIDO S/</label>
                    <input id="swal-precio-sug" class="swal2-input" type="number" placeholder="Ej: 1500" style="margin-top: 5px; height: 35px; max-width:90%;">
                </div>
                
                <label style="font-size: 11px; font-weight: 900; color:var(--accent); display: block;">ESTRATEGIA (Make vs Buy)</label>
                <select id="swal-origen" class="swal2-input" style="width: 90%; max-width:90%; margin-top: 5px; height: 40px;">
                    <option value="Interno">🛠️ Fabricación Interna (Taller)</option>
                    <option value="Externo">📦 Compra Externa (Proveedor)</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Aprobar Modelo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        width: '500px',
        preConfirm: () => {
            return {
                costo: document.getElementById('swal-costo').value,
                precio_min: document.getElementById('swal-precio-min').value,
                precio_sug: document.getElementById('swal-precio-sug').value,
                origen: document.getElementById('swal-origen').value
            }
        }
    });

    if (formValues) {
        if (!formValues.costo || !formValues.precio_min || !formValues.precio_sug) {
            return Swal.fire('Error', 'Debes llenar los 3 campos contables.', 'error');
        }
        if (parseFloat(formValues.precio_min) < parseFloat(formValues.costo)) {
            return Swal.fire('Alerta Financiera', 'El precio mínimo no puede ser menor al costo.', 'error');
        }
        
        // Enviamos todo a Python — precio_base usa el precio mínimo como referencia
        ejecutarAprobacion(id, formValues.origen, formValues.precio_min);
    }
}
async function ejecutarAprobacion(id, origen, precio_base) {
    try {
        Swal.fire({ title: 'Aprobando y publicando...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/creaciones/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creacion_id: id,
                origen: origen,
                precio_base: precio_base
            })
        });

        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Aprobado!', 'El modelo ya está disponible en el Catálogo Principal para todos los vendedores.', 'success');
            cargarGestorAprobacion(); // Recargar bandeja
            init(); // Forzamos recarga del catálogo en segundo plano
        } else {
            Swal.fire('Error', data.error || 'No se pudo aprobar.', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}
/* ================================================================= */
// ─── Rechazar modelo de mueble (creación de vendedor) ────────────────────────
async function rechazarMueble(id, nombre) {
    const { value: motivo } = await Swal.fire({
        title: 'Rechazar modelo de mueble',
        html: `<p style="color:#475569;font-size:13px;margin-bottom:10px;">
                  Indica el motivo para rechazar: <b>${nombre}</b></p>
               <textarea id="swal-motivo-mueble" class="swal2-textarea"
                         placeholder="Ej: No aplica para nuestro catálogo, foto de baja calidad, precio fuera de rango..."
                         style="min-height:80px;width:90%;"></textarea>`,
        showCancelButton: true,
        confirmButtonText: 'Rechazar modelo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            const m = document.getElementById('swal-motivo-mueble')?.value.trim();
            if (!m) { Swal.showValidationMessage('El motivo es obligatorio.'); return false; }
            return m;
        }
    });
    if (!motivo) return;

    try {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res  = await apiFetch(`${API_URL}/api/creaciones/rechazar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creacion_id: id, motivo })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('Rechazado', `Modelo rechazado. Motivo registrado.`, 'info');
            cargarGestorAprobacion();
        } else {
            Swal.fire('Error', data.error || 'No se pudo rechazar.', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

// ─── Rechazar sugerencia de insumo ───────────────────────────────────────────
async function rechazarInsumo(id, nombre) {
    const { value: motivo } = await Swal.fire({
        title: 'Rechazar sugerencia de insumo',
        html: `<p style="color:#475569;font-size:13px;margin-bottom:10px;">
                  Indica el motivo para rechazar: <b>${nombre}</b></p>
               <textarea id="swal-motivo-insumo" class="swal2-textarea"
                         placeholder="Ej: Ya existe en el maestro, proveedor sin contrato, especificaciones incompletas..."
                         style="min-height:80px;width:90%;"></textarea>`,
        showCancelButton: true,
        confirmButtonText: 'Rechazar insumo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            const m = document.getElementById('swal-motivo-insumo')?.value.trim();
            if (!m) { Swal.showValidationMessage('El motivo es obligatorio.'); return false; }
            return m;
        }
    });
    if (!motivo) return;

    try {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res  = await apiFetch(`${API_URL}/api/sugerencias/rechazar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sugerencia_id: id, motivo })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('Rechazado', 'Sugerencia de insumo rechazada.', 'info');
            cargarGestorAprobacion();
        } else {
            Swal.fire('Error', data.error || 'No se pudo rechazar.', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

/* --- MÓDULO: ENTRADA DIRECTA DE PRODUCTOS (CUADROS/ESPEJOS) --- */
/* ================================================================= */
/* ================================================================= */
/* --- MÓDULO 4 COMPLETO: NUEVAS FUNCIONES                       --- */
/* ================================================================= */

