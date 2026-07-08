// Taller - stock de estructuras
// ── Stock Producción (Admin) — portal con secciones futuras, por ahora solo sofás ──
async function cargarVistaStockProduccion(contenedor) {
    // Sin título extra — el header de la página ya muestra "STOCK DE PRODUCCION"
    contenedor.innerHTML = '<div id="sp-sofa-contenido" style="padding:4px 0;">Cargando...</div>';
    await _cargarContenidoStockSofa('sp-sofa-contenido', true);
}

// ── Stock del Carpintero de Sofás (Operario con area ESTRUCTURAS_MUEBLES) ──
async function cargarVistaStockCarpinteroSofa(contenedor) {
    contenedor.innerHTML = `<div style="padding:16px;box-sizing:border-box;width:100%;overflow-x:hidden;" id="stock-carp-wrapper">Cargando...</div>`;
    await _cargarContenidoStockSofa('stock-carp-wrapper', false);
}

async function mostrarSeccionStockProd(seccion) {
    // Por ahora solo hay sofás; extender aquí en el futuro
    if (seccion === 'sofa') await _cargarContenidoStockSofa('sp-sofa-contenido', true);
}

// ── Motor compartido de stock de estructuras de sofá ──
async function _cargarContenidoStockSofa(contenedorId, esAdmin) {
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras?limit=500`);
        const data = await res.json();

        window._stockEstructurasData = data;
        const disponibles = data.filter(e => e.estado === 'disponible');
        const entregados  = data.filter(e => e.estado === 'entregado');

        document.getElementById(contenedorId).innerHTML = `
        <div style="width:100%;box-sizing:border-box;">
          <!-- Header: título área + botón registrar -->
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <i class="fa-solid fa-couch" style="color:#7c3aed;font-size:18px;"></i>
              <div>
                <div style="font-weight:900;font-size:15px;color:#0f172a;">Estructuras de Sofá</div>
                <div style="font-size:11px;color:#64748b;margin-top:1px;">${disponibles.length} disponible${disponibles.length!==1?'s':''} · ${entregados.length} entregado${entregados.length!==1?'s':''}</div>
              </div>
            </div>
            <button onclick="abrirModalRegistrarEstructura('${contenedorId}', ${esAdmin})"
                style="background:#7c3aed;color:white;border:none;border-radius:8px;
                       padding:10px 20px;cursor:pointer;font-size:13px;font-weight:700;
                       display:flex;align-items:center;gap:6px;white-space:nowrap;margin-left:auto;">
                <i class="fa-solid fa-plus"></i> Registrar
            </button>
          </div>

          <!-- ── Buscador de contratos pendientes (solo operario carpintero, no gestor admin) ── -->
          ${!esAdmin ? `
          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:800;color:#7c3aed;letter-spacing:0.08em;margin-bottom:8px;">
              <i class="fa-solid fa-magnifying-glass"></i> BUSCAR CONTRATO PENDIENTE
            </div>
            <div style="display:flex;gap:8px;">
              <input id="se-buscar-contrato-${contenedorId}"
                  placeholder="Ej: INV-0042 o solo 42"
                  style="flex:1;padding:9px 12px;border:1.5px solid #d8b4fe;border-radius:8px;font-size:13px;outline:none;"
                  onkeydown="if(event.key==='Enter') _buscarContratoPendiente('${contenedorId}')">
              <button onclick="_buscarContratoPendiente('${contenedorId}')"
                  style="padding:9px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;
                         font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">
                  Buscar
              </button>
            </div>
            <div id="se-contrato-resultado-${contenedorId}" style="margin-top:10px;"></div>
          </div>` : ''}

          <!-- Sub-tabs: Disponibles / Entregados -->
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <button id="subtab-disp-${contenedorId}" onclick="_filtrarStockSofa('disponible','${contenedorId}')"
                style="flex:1;min-width:140px;padding:10px;border-radius:8px;border:2px solid #7c3aed;
                       background:#7c3aed;color:white;font-weight:800;cursor:pointer;font-size:12px;">
                <i class="fa-solid fa-box"></i> En stock (${disponibles.length})
            </button>
            <button id="subtab-ent-${contenedorId}" onclick="_filtrarStockSofa('entregado','${contenedorId}')"
                style="flex:1;min-width:140px;padding:10px;border-radius:8px;border:2px solid #15803d;
                       background:#f0fdf4;color:#15803d;font-weight:800;cursor:pointer;font-size:12px;">
                <i class="fa-solid fa-circle-check"></i> Entregados (${entregados.length})
            </button>
          </div>

          <!-- Radio buttons: solo visibles en tab "En stock" -->
          <div id="radio-subtipo-${contenedorId}"
               style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
            ${['todos','estandar','personalizada'].map((v,i) => {
                const labels = ['Todos','⭐ Estándar','📐 Personalizadas'];
                const checked = i === 0 ? 'checked' : '';
                return `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                      padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
                                      border:1.5px solid ${i===0?'#7c3aed':'#e2e8f0'};
                                      background:${i===0?'#f5f3ff':'white'};
                                      color:${i===0?'#7c3aed':'#64748b'};"
                               id="radio-label-${v}-${contenedorId}">
                          <input type="radio" name="subtipo-${contenedorId}" value="${v}" ${checked}
                                 style="accent-color:#7c3aed;"
                                 onchange="_filtrarSubtipoSofa('${contenedorId}')">
                          ${labels[i]}
                        </label>`;
            }).join('')}
          </div>
          
          <!-- Radio buttons: Antigüedad -->
          <div id="radio-antiguedad-${contenedorId}"
               style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
            ${['actual','antiguo'].map((v,i) => {
                const labels = ['Actual','🗄️ Antiguo'];
                const checked = i === 0 ? 'checked' : '';
                return `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                      padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
                                      border:1.5px solid ${i===0?'#0369a1':'#e2e8f0'};
                                      background:${i===0?'#e0f2fe':'white'};
                                      color:${i===0?'#0369a1':'#64748b'};"
                               id="radio-label-antiguedad-${v}-${contenedorId}">
                          <input type="radio" name="antiguedad-${contenedorId}" value="${v}" ${checked}
                                 style="accent-color:#0369a1;"
                                 onchange="_filtrarSubtipoSofa('${contenedorId}')">
                          ${labels[i]}
                        </label>`;
            }).join('')}
          </div>

          <div id="lista-est-${contenedorId}">
            ${_renderListaEstructuras(_groupEstructuras(disponibles))}
          </div>
        </div>

        <!-- Modal registrar -->
        <div id="modal-registro-estructura" style="display:none;position:fixed;inset:0;
             background:rgba(0,0,0,0.6);z-index:9999;
             justify-content:center;align-items:center;">
          <div style="background:white;border-radius:16px;padding:24px;width:400px;max-width:95vw;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;font-size:16px;" id="se-modal-titulo">Registrar estructura / destrokes</h3>
              <button onclick="cerrarModalEstructura()"
                  style="background:#f1f5f9;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:16px;color:#64748b;">✕</button>
            </div>

            <!-- ── Mover "es_antiguo" al tope ── -->
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;cursor:pointer;
                          background:#fff7ed;padding:10px;border-radius:8px;border:1.5px solid #fed7aa;">
              <input type="checkbox" id="se-es-antiguo" onchange="_onChangeEsAntiguo()"> 
              <span style="font-weight:800;color:#c2410c;">🗄️ Es stock antiguo (hallado en almacén)</span>
            </label>

            <div data-bloque-normal="true">
                <label style="font-size:12px;font-weight:700;color:#475569;">TIPO</label>
                <select id="se-tipo" onchange="_onChangeTipoEstructura()"
                    style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">
                  <option value="estructura">🪵 Estructura de sofá</option>
                  <option value="destrokes">🔧 Destrokes</option>
                </select>
            </div>

            <div data-bloque-normal="true" style="margin-bottom:14px;">
                <label style="font-size:12px;font-weight:700;color:#475569;">¿ES JUEGO COMPLETO?</label>
                <select id="se-juego-completo" style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
                    <option value="true">Sí, juego completo</option>
                    <option value="false">No, es una parte (se completará después)</option>
                </select>
            </div>

            <label style="font-size:12px;font-weight:700;color:#475569;">NOMBRE / DESCRIPCIÓN *</label>
            <input id="se-nombre" placeholder="Ej: Seccional 3+2 · Gris Perla"
                style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">

            <div>
                <label style="font-size:12px;font-weight:700;color:#475569;">CANTIDAD *</label>
                <input id="se-cantidad" type="number" placeholder="Ej: 1" min="1" step="1" value="1"
                    style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">
            </div>

            <!-- ── Bloque SOLO para Estructura ── -->
            <div id="bloque-solo-estructura" data-bloque-normal="true">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label style="font-size:12px;font-weight:700;color:#475569;">MODELO BASE *</label>
                <button type="button" onclick="_abrirGestorDesdeStock()"
                    title="Agregar o editar modelos"
                    style="background:#f5f3ff;border:1.5px solid #ddd6fe;color:#7c3aed;
                           border-radius:7px;padding:4px 10px;cursor:pointer;
                           font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;">
                  ⚙️ Gestionar
                </button>
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:5px;">Tipo de sofá de las plantillas del catálogo</div>
              <select id="se-modelo-base"
                  style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;margin-bottom:10px;font-size:13px;">
                <option value="">— Seleccionar modelo base —</option>
              </select>

            <!-- A8: Medidas estructura sofa -->
            <div style="margin-bottom:6px;">
            <label style="font-size:12px;font-weight:700;color:#475569;">MEDIDAS (cm)</label>
            </div>
            <div id="bloque-medidas" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            <input id="se-ancho" type="number" placeholder="Ancho"
                style="flex:1;min-width:70px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            <input id="se-prof" type="number" placeholder="Prof."
                style="flex:1;min-width:70px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            <input id="se-alto" type="number" placeholder="Alto"
                style="flex:1;min-width:70px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            <input id="se-medida-brazo" type="number" placeholder="Brazo"
                style="flex:1;min-width:70px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;" title="Medida del brazo (cm)">
            </div>
            <!-- A8: Checkbox para marcar como medida estándar en BD -->
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;cursor:pointer;
                        background:#f9f5ff;padding:8px 10px;border-radius:6px;border:1px solid #ede9fe;">
            <input type="checkbox" id="se-estandar" onchange="document.getElementById('bloque-medidas').style.display = this.checked ? 'none' : 'flex'; if(this.checked){document.getElementById('se-ancho').value='';document.getElementById('se-prof').value='';document.getElementById('se-alto').value='';}"> 
            <span style="font-weight:500;">Es una medida estándar de catálogo</span>
            </label>
            </div><!-- A8: Bloque PATA/ZÓCALO para estructura sofa -->
<div data-bloque-normal="true" style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
  <label style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;display:block;">TIPO DE BASE</label>
  <select id="se-tipo-base" onchange="_actualizarVisibilidadBase()"
      style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:10px;font-size:13px;background:white;">
    <option value="">— Sin base (solo estructura) —</option>
    <option value="patas">Patas</option>
    <option value="zocalo">Zócalo</option>
  </select>

  <!-- Inputs de medida para pata/zócalo, mostrados condicionalmente -->
  <div id="bloque-medida-base" style="display:none;">
    <label style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;display:block;">MEDIDA DE BASE (cm)</label>
    <div id="bloque-inputs-medida-base" style="display:flex;gap:6px;margin-bottom:10px;">
      <input id="se-medida-base" type="number" placeholder="Ej: 15" step="0.1"
          style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
    </div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;
                  background:#f9f5ff;padding:8px 10px;border-radius:6px;border:1px solid #ede9fe;">
      <input type="checkbox" id="se-medida-base-estandar" onchange="document.getElementById('bloque-inputs-medida-base').style.display = this.checked ? 'none' : 'flex'; if(this.checked){document.getElementById('se-medida-base').value='';}"> 
      <span style="font-weight:500;">Es una medida estándar de base</span>
    </label>
  </div>
</div>
<!-- ── fin bloque pata/zócalo ── -->
            <!-- ── fin bloque estructura ── -->

            <!-- ── Bloque SOLO para Destrokes ── -->
            <div id="bloque-solo-destrokes" style="display:none;">
            </div>
            <!-- ── fin bloque destrokes ── -->
            <!-- ── Bloque SOLO visible en modo antiguo ── -->
            <div id="bloque-antiguo-extra" style="display:none;">
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">DESCRIPCIÓN</label>
              <textarea id="se-descripcion-antiguo" rows="3"
                  placeholder="Ej: Seccional hallado en almacén, color gris, sin patas..."
                  style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;resize:vertical;margin-bottom:14px;"></textarea>
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">¿ES JUEGO COMPLETO O PARTES?</label>
              <select id="se-juego-completo-antiguo"
                  style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:14px;">
                <option value="true">Sí, juego completo</option>
                <option value="false">No, es una parte (se completará después)</option>
              </select>
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">ESTRUCTURA SOFÁ</label>
              <select id="se-tipo-antiguo"
                  style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:14px;">
                <option value="estructura">🪵 Estructura de sofá</option>
                <option value="destrokes">🔧 Destrokes</option>
              </select>
            </div>
            <!-- ── fin bloque antiguo extra ── -->

            <div>
                <label style="font-size:12px;font-weight:700;color:#475569;">PRECIO (S/)</label>
                <input id="se-precio" type="number" placeholder="Ej: 350.00" step="0.01"
                    style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">
            </div>

            <label id="se-foto-label" style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:8px;">FOTO *</label>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
              <label style="flex:1;cursor:pointer;background:#7c3aed;color:#fff;padding:10px;border-radius:8px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-camera"></i> Tomar foto
                <input type="file" id="se-foto-cam" accept="image/*" capture="environment" style="display:none;" onchange="seSyncFoto(this)">
              </label>
              <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#1e293b;padding:10px;border-radius:8px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-folder-open"></i> Subir archivo
                <input type="file" id="se-foto" accept="image/*" style="display:none;" onchange="seSyncFoto(this)">
              </label>
            </div>
            <div id="se-foto-preview-container" style="display:none;margin-bottom:14px;text-align:center;">
              <img id="se-foto-preview" style="max-height:90px;border-radius:8px;border:2px solid #7c3aed;object-fit:cover;">
              <p id="se-foto-nombre" style="font-size:11px;color:#64748b;margin:4px 0 0;"></p>
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="cerrarModalEstructura()"
                  style="flex:1;padding:11px;border:1.5px solid #cbd5e1;background:white;
                         border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                Cancelar
              </button>
              <button onclick="guardarEstructura()"
                  style="flex:1;padding:11px;background:#7c3aed;color:white;border:none;
                         border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                <i class="fa-solid fa-floppy-disk"></i> Guardar
              </button>
            </div>
          </div>
        </div>`;

        // Guardar el contenedorId activo para saber dónde refrescar
        window._stockSofaContenedorActivo = contenedorId;

    } catch(e) {
        const el = document.getElementById(contenedorId);
        if (el) el.innerHTML = `<p style="color:red;text-align:center;">Error al cargar stock.</p>`;
    }
}

function _onChangeEsAntiguo() {
    const isAntiguo = document.getElementById('se-es-antiguo')?.checked;
    const bloquesNormales = document.querySelectorAll('#modal-registro-estructura [data-bloque-normal="true"]');
    const titulo = document.getElementById('se-modal-titulo');
    const seTipo = document.getElementById('se-tipo');
    const fotoLabel = document.getElementById('se-foto-label');
    const bloqueAntiguoExtra = document.getElementById('bloque-antiguo-extra');

    bloquesNormales.forEach(b => { b.style.display = isAntiguo ? 'none' : 'block'; });
    if (bloqueAntiguoExtra) bloqueAntiguoExtra.style.display = isAntiguo ? 'block' : 'none';

    if (isAntiguo) {
        if (titulo) titulo.textContent = 'Registrar Estructura Antigua';
        if (fotoLabel) fotoLabel.textContent = 'FOTO (Opcional)';
    } else {
        if (titulo) titulo.textContent = 'Registrar estructura / destrokes';
        if (seTipo) _onChangeTipoEstructura();
        if (fotoLabel) fotoLabel.textContent = 'FOTO *';
    }
}



// ── Buscador inteligente de contratos pendientes (carpintero de sofás) ──
async function _buscarContratoPendiente(contenedorId) {
    const input = document.getElementById(`se-buscar-contrato-${contenedorId}`);
    const resultado = document.getElementById(`se-contrato-resultado-${contenedorId}`);
    if (!input || !resultado) return;

    let query = input.value.trim();
    if (!query) return;

    // Normalizar: si es solo dígitos → agregar prefijo INV-
    if (/^\d+$/.test(query)) {
        query = 'INV-' + query.padStart(4, '0');
    } else {
        query = query.toUpperCase();
    }

    resultado.innerHTML = `<div style="font-size:12px;color:#7c3aed;padding:6px 0;">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Buscando ${query}...
    </div>`;

    try {
        // Usamos el endpoint de tickets pendientes y filtramos por código
        const res  = await apiFetch(`${API_URL}/api/taller/tickets_pendientes`);
        const data = await res.json();

        if (!Array.isArray(data)) {
            resultado.innerHTML = `<div style="color:#dc2626;font-size:12px;">Error al consultar contratos.</div>`;
            return;
        }

        // Filtrar por código de venta (partial match, insensible a mayúsculas)
        const coincidencias = data.filter(t =>
            (t.codigo || '').toUpperCase().includes(query) &&
            (t.area === 'ESTRUCTURAS_MUEBLES' || !t.area)
        );

        // Si no hay por área específica, buscar en todos
        const todos = coincidencias.length > 0 ? coincidencias :
            data.filter(t => (t.codigo || '').toUpperCase().includes(query));

        if (!todos.length) {
            resultado.innerHTML = `
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:22px;margin-bottom:6px;">🔍</div>
                <div style="font-weight:700;font-size:13px;color:#374151;">No se encontró "${query}"</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Verifica el número o el contrato ya está asignado / terminado.</div>
              </div>`;
            return;
        }

        resultado.innerHTML = todos.map(t => `
          <div style="background:white;border:1px solid #ddd6fe;border-radius:10px;
                      padding:14px 16px;margin-bottom:8px;border-left:3px solid #7c3aed;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;">
              <div>
                <div style="font-weight:900;font-size:15px;color:#0f172a;">${t.codigo}</div>
                <div style="font-size:13px;color:#374151;margin-top:2px;">${t.producto}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">
                  <i class="fa-solid fa-user"></i> ${t.cliente || '—'} &nbsp;·&nbsp;
                  <i class="fa-solid fa-calendar"></i> Entrega: <b>${t.entrega || 'S/F'}</b>
                </div>
                ${t.especificaciones ? `<div style="font-size:11px;color:#7c3aed;margin-top:4px;">
                  <i class="fa-solid fa-palette"></i> ${t.especificaciones}
                </div>` : ''}
              </div>
              <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;
                           background:#faf5ff;color:#7c3aed;border:1px solid #ddd6fe;white-space:nowrap;">
                ${t.estado || 'Pendiente'}
              </span>
            </div>
          </div>`).join('');

    } catch(e) {
        resultado.innerHTML = `<div style="color:#dc2626;font-size:12px;">Error de conexión. Intenta de nuevo.</div>`;
    }
}

function _filtrarStockSofa(estado, contenedorId) {
    const data = window._stockEstructurasData || [];

    // Estilo activo/inactivo en los tabs
    const btnDisp = document.getElementById(`subtab-disp-${contenedorId}`);
    const btnEnt  = document.getElementById(`subtab-ent-${contenedorId}`);
    if (btnDisp && btnEnt) {
        if (estado === 'disponible') {
            btnDisp.style.background = '#7c3aed'; btnDisp.style.color = 'white';
            btnEnt.style.background  = '#f0fdf4'; btnEnt.style.color  = '#15803d';
        } else {
            btnEnt.style.background  = '#15803d'; btnEnt.style.color  = 'white';
            btnDisp.style.background = '#f5f3ff'; btnDisp.style.color = '#7c3aed';
        }
    }

    // Mostrar radio buttons solo en "En stock", ocultar en "Entregados"
    const radioWrap = document.getElementById(`radio-subtipo-${contenedorId}`);
    const radioAntiWrap = document.getElementById(`radio-antiguedad-${contenedorId}`);
    if (radioWrap) {
        radioWrap.style.display = estado === 'disponible' ? 'flex' : 'none';
        // Resetear a "Todos" al cambiar de tab
        const radioTodos = radioWrap.querySelector(`input[value="todos"]`);
        if (radioTodos) {
            radioTodos.checked = true;
            _actualizarEstiloRadios(contenedorId, 'todos', 'subtipo');
        }
    }
    if (radioAntiWrap) {
        radioAntiWrap.style.display = estado === 'disponible' ? 'flex' : 'none';
        const radioActual = radioAntiWrap.querySelector(`input[value="actual"]`);
        if (radioActual) {
            radioActual.checked = true;
            _actualizarEstiloRadios(contenedorId, 'actual', 'antiguedad');
        }
    }

    const lista = data.filter(e => e.estado === estado);
    document.getElementById(`lista-est-${contenedorId}`).innerHTML =
        _renderListaEstructuras(_groupEstructuras(lista));
}

function _filtrarSubtipoSofa(contenedorId) {
    const data   = window._stockEstructurasData || [];
    
    let subtipo  = 'todos';
    document.querySelectorAll(`input[name="subtipo-${contenedorId}"]`).forEach(r => { if (r.checked) subtipo = r.value; });

    let antiguedad = 'actual';
    document.querySelectorAll(`input[name="antiguedad-${contenedorId}"]`).forEach(r => { if (r.checked) antiguedad = r.value; });

    _actualizarEstiloRadios(contenedorId, subtipo, 'subtipo');
    _actualizarEstiloRadios(contenedorId, antiguedad, 'antiguedad');

    let lista = data.filter(e => e.estado === 'disponible');
    if (subtipo === 'estandar')     lista = lista.filter(e => e.medida_estandar);
    if (subtipo === 'personalizada') lista = lista.filter(e => !e.medida_estandar);

    if (antiguedad === 'actual')    lista = lista.filter(e => !e.es_antiguo);
    if (antiguedad === 'antiguo')   lista = lista.filter(e => e.es_antiguo);

    document.getElementById(`lista-est-${contenedorId}`).innerHTML =
        _renderListaEstructuras(_groupEstructuras(lista));
}

function _actualizarEstiloRadios(contenedorId, activo, grupo) {
    if (grupo === 'subtipo') {
        ['todos','estandar','personalizada'].forEach(v => {
            const lbl = document.getElementById(`radio-label-${v}-${contenedorId}`);
            if (!lbl) return;
            const esActivo = v === activo;
            lbl.style.border     = `1.5px solid ${esActivo ? '#7c3aed' : '#e2e8f0'}`;
            lbl.style.background = esActivo ? '#f5f3ff' : 'white';
            lbl.style.color      = esActivo ? '#7c3aed' : '#64748b';
        });
    } else if (grupo === 'antiguedad') {
        ['actual','antiguo'].forEach(v => {
            const lbl = document.getElementById(`radio-label-antiguedad-${v}-${contenedorId}`);
            if (!lbl) return;
            const esActivo = v === activo;
            lbl.style.border     = `1.5px solid ${esActivo ? '#0369a1' : '#e2e8f0'}`;
            lbl.style.background = esActivo ? '#e0f2fe' : 'white';
            lbl.style.color      = esActivo ? '#0369a1' : '#64748b';
        });
    }
}

// A8: Mostrar/ocultar inputs de medida de base cuando cambia el tipo
function _actualizarVisibilidadBase() {
    const tipoBase = document.getElementById('se-tipo-base');
    const bloqueBase = document.getElementById('bloque-medida-base');
    if (!tipoBase || !bloqueBase) return;
    
    const tieneBase = tipoBase.value !== '';
    bloqueBase.style.display = tieneBase ? 'block' : 'none';
    
    if (!tieneBase) {
        // Limpiar campos cuando se selecciona "Sin base"
        document.getElementById('se-medida-base').value = '';
        document.getElementById('se-medida-base-estandar').checked = false;
        const bBase = document.getElementById('bloque-inputs-medida-base');
        if (bBase) bBase.style.display = 'flex';
    }
}

function abrirModalRegistrarEstructura(contenedorId, esAdminCtx) {
    window._modalEstructuraCtx = { contenedorId, esAdminCtx };
    const modal = document.getElementById('modal-registro-estructura');
    if (!modal) return;
    modal.style.display = 'flex';

    // Reset todos los campos
    ['se-nombre','se-precio','se-ancho','se-prof','se-alto','se-cantidad','se-medida-base','se-medida-brazo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    if (document.getElementById('se-juego-completo')) document.getElementById('se-juego-completo').value = 'true';
    const cb = document.getElementById('se-estandar');
    if (cb) {
        cb.checked = false;
        const b = document.getElementById('bloque-medidas');
        if (b) b.style.display = 'flex';
    }
    const cbAnti = document.getElementById('se-es-antiguo');
    if (cbAnti) { cbAnti.checked = false; _onChangeEsAntiguo(); }
    const cbBase = document.getElementById('se-medida-base-estandar');
    if (cbBase) {
        cbBase.checked = false;
        const bBase = document.getElementById('bloque-inputs-medida-base');
        if (bBase) bBase.style.display = 'flex';
    }

    // Resetear tipo a "estructura" y disparar el cambio de UI
    const selTipo = document.getElementById('se-tipo');
    if (selTipo) { selTipo.value = 'estructura'; _onChangeTipoEstructura(); }

    const selTipoBase = document.getElementById('se-tipo-base');
    if (selTipoBase) { selTipoBase.value = ''; _actualizarVisibilidadBase(); }

    // Poblar select de modelos con optgroups (base del sistema + personalizados)
    _refreshSelectModeloBase();
}

// ── Poblar #se-modelo-base con optgroups ─────────────────────────────────────
function _refreshSelectModeloBase() {
    const sel = document.getElementById('se-modelo-base');
    if (!sel) return;

    // Modelos base del sistema (hardcoded — mismos que GM_MODELOS_BASE en index.html)
    const BASE = [
        'Multifuncional (3 Piezas)',
        'Multifuncional (4 Piezas)',
        'Seccional Normal',
        'Seccional Invertido',
        'Curvo',
        'En U',
        'Juego de Sala (3-2-1)',
    ];

    // Modelos personalizados del localStorage
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('innova_modelos_sofa') || '[]'); } catch(e) {}

    let html = '<option value="">— Seleccionar modelo base —</option>';
    html += '<optgroup label="📐 Modelos del sistema">';
    BASE.forEach(label => { html += `<option value="${label}">${label}</option>`; });
    html += '</optgroup>';

    if (custom.length > 0) {
        html += '<optgroup label="✏️ Modelos personalizados">';
        custom.forEach(m => { html += `<option value="${m.label}">${m.label}</option>`; });
        html += '</optgroup>';
    }

    sel.innerHTML = html;

    // Eliminar el input de texto libre si quedó de una versión anterior
    const txt = document.getElementById('se-modelo-base-txt');
    if (txt) txt.remove();
}


// ── Abrir gestor de modelos desde el modal de stock ───────────────────────────
function _abrirGestorDesdeStock() {
    // Guardar referencia para que al cerrar el gestor se refresque el select
    window._gestorAbiertoDesdeStock = true;
    if (typeof abrirGestorModelos === 'function') {
        abrirGestorModelos();
    } else {
        Swal.fire({ icon: 'warning', text: 'El gestor de modelos no está disponible en esta pantalla.' });
    }
}

/** Mostrar/ocultar campos según si es Estructura o Destrokes */
function _onChangeTipoEstructura() {
    const tipo = document.getElementById('se-tipo')?.value;
    const bloqEst  = document.getElementById('bloque-solo-estructura');
    const bloqDest = document.getElementById('bloque-solo-destrokes');
    const titulo   = document.getElementById('se-modal-titulo');
    if (!bloqEst || !bloqDest) return;

    if (tipo === 'destrokes') {
        bloqEst.style.display  = 'none';
        bloqDest.style.display = 'block';
        if (titulo) titulo.textContent = 'Registrar Destrokes';
    } else {
        bloqEst.style.display  = 'block';
        bloqDest.style.display = 'none';
        if (titulo) titulo.textContent = 'Registrar Estructura de Sofá';
        // Restaurar medidas si estaban ocultas
        const bloqueMed = document.getElementById('bloque-medidas');
        if (bloqueMed) bloqueMed.style.display = 'flex';
    }
}

function cerrarModalEstructura() {
    const modal = document.getElementById('modal-registro-estructura');
    if (modal) modal.style.display = 'none';
    // Limpiar foto inputs y preview al cerrar
    const cam = document.getElementById('se-foto-cam');
    const arc = document.getElementById('se-foto');
    const prev = document.getElementById('se-foto-preview-container');
    if (cam) cam.value = '';
    if (arc) arc.value = '';
    if (prev) prev.style.display = 'none';
}

function _renderListaEstructuras(lista) {
    if (!lista.length) return `
        <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
            <i class="fa-solid fa-box-open" style="font-size:2.5rem;display:block;margin-bottom:12px;"></i>
            <p style="font-weight:700;font-size:14px;color:#475569;margin:0;">Sin registros</p>
            <p style="font-size:12px;margin:4px 0 0;">Registra la primera estructura con el botón de arriba.</p>
        </div>`;
    return `<div class="estructuras-grid">` +
    lista.map(e => `
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;
                  overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="position:relative;">
          <img src="${e.foto_url || (e.es_antiguo ? 'imagenes/Logo3.png' : 'imagenes/sin_foto.jpg')}"
               style="width:100%;height:clamp(120px,18vw,160px);object-fit:cover;display:block;"
               onerror="this.src='${e.es_antiguo ? 'imagenes/Logo3.png' : 'imagenes/sin_foto.jpg'}'">
          <span style="position:absolute;top:8px;right:8px;
                       background:${e.estado==='disponible'?'#dcfce7':'#f1f5f9'};
                       color:${e.estado==='disponible'?'#15803d':'#64748b'};
                       border-radius:20px;padding:3px 10px;font-size:11px;font-weight:800;">
            ${e.estado==='disponible'?'✓ Disponible':'✓ Entregado'}
          </span>
        </div>
        <div style="padding:12px 14px;">
          <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:4px;">${e.nombre_modelo}</div>
          ${e.modelo_base ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:4px;"><i class="fa-solid fa-tag"></i> ${e.modelo_base}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;">
            <span style="font-size:11px;color:#64748b;background:#f8fafc;padding:3px 8px;border-radius:6px;">
              ${e.tipo === 'destrokes' ? '🔧 Destrokes' : '🪵 Estructura'}
            </span>
            <span style="font-size:11px;color:#475569;background:#f1f5f9;padding:3px 8px;border-radius:6px;">
              📦 Cant: <b>${e.cantidad || 1}</b>
            </span>
            ${e.medida_estandar ? `<span style="font-size:11px;color:#7c3aed;background:#f5f3ff;padding:3px 8px;border-radius:6px;font-weight:700;">⭐ Estándar</span>` : ''}
            ${e.es_antiguo ? `<span style="font-size:11px;color:#991b1b;background:#fef2f2;padding:3px 8px;border-radius:6px;font-weight:700;">🗄️ Antiguo</span>` : ''}
            ${e.tipo_base ? `<span style="font-size:11px;color:#0f172a;background:#e2e8f0;padding:3px 8px;border-radius:6px;">${e.tipo_base === 'zocalo' ? '🪵 Zócalo' : '🦵 Patas'}: <b>${e.medida_base_estandar ? 'Estándar' : e.medida_base + ' cm'}</b></span>` : ''}
            ${e.es_juego_completo ? `<span style="font-size:11px;color:#15803d;background:#dcfce7;padding:3px 8px;border-radius:6px;font-weight:700;">🧩 Juego Completo</span>` : `<span style="font-size:11px;color:#c2410c;background:#fff7ed;padding:3px 8px;border-radius:6px;font-weight:700;">🔧 Es Parte</span>`}
          </div>
          ${(e.ancho || e.medida_brazo) ? `<div style="font-size:12px;color:#475569;margin-top:6px;"><i class="fa-solid fa-ruler-combined" style="color:#94a3b8;"></i> ${e.ancho ? e.ancho+'×'+e.profundidad+'×'+e.alto+' cm' : ''}${e.medida_brazo ? (e.ancho?' | ':'') + 'Brazo: '+e.medida_brazo+'cm' : ''}</div>` : ''}
          ${e.precio ? `<div style="font-size:14px;color:#15803d;font-weight:800;margin-top:6px;">S/ ${parseFloat(e.precio).toFixed(2)}</div>` : ''}

          <!-- A9b: fechas -->
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px;">
            ${e.fecha ? `<div style="font-size:11px;color:#94a3b8;"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>Registrado: <b style="color:#64748b;">${e.fecha}</b></div>` : ''}
            ${e.fecha_entrega_chofer ? `<div style="font-size:11px;color:#94a3b8;"><i class="fa-solid fa-truck" style="margin-right:4px;color:#15803d;"></i>Entregado: <b style="color:#15803d;">${e.fecha_entrega_chofer}</b></div>` : ''}
          </div>

          <!-- Info si es parte -->
          ${!e.es_juego_completo ? (e.completado_por ? `
            <div style="margin-top:10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:10px;font-size:11px;">
                <div style="color:#0f172a;font-weight:700;margin-bottom:4px;">✅ Parte Completada / Cambiada</div>
                <div style="color:#475569;margin-bottom:2px;">Por: <b>${e.completado_por}</b> el ${e.fecha_completado || ''}</div>
                ${e.comentario_parte ? `<div style="color:#64748b;margin-bottom:4px;font-style:italic;">"${e.comentario_parte}"</div>` : ''}
                ${e.foto_completado_url ? `<img src="${e.foto_completado_url}" style="width:60px;height:60px;border-radius:4px;object-fit:cover;cursor:pointer;border:1px solid #e2e8f0;" onclick="window.open(this.src)">` : ''}
            </div>` : `
            <div style="margin-top:10px;">
                <button onclick="marcarParteCompletada(${e.ids && e.ids.length===1 ? e.ids[0] : e.id})"
                        style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;width:100%;justify-content:center;">
                    📷 Marcar como completado/cambiado
                </button>
            </div>
          `) : ''}

          <!-- A9: badge de pago + botón toggle -->
          <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <button onclick="togglePagoEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id}, ${!!e.pagado}, this)"
                style="flex:1;padding:6px 10px;border-radius:7px;font-size:11px;font-weight:800;
                       cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;
                       border:${e.pagado ? '1.5px solid #15803d' : '1.5px solid #f59e0b'};
                       background:${e.pagado ? '#dcfce7' : '#fef3c7'};
                       color:${e.pagado ? '#15803d' : '#92400e'};"
                title="${e.pagado ? 'Marcar como no pagado' : 'Marcar como pagado'}">
              ${e.pagado ? '✓ Pagado' : '⏳ No pagado'}
            </button>
            <button onclick="abrirModalEditarEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id})"
                style="padding:6px 10px;border-radius:7px;font-size:11px;font-weight:800;
                       cursor:pointer;border:1.5px solid #cbd5e1;background:#f8fafc;color:#475569;
                       display:flex;align-items:center;gap:4px;" title="Editar datos">
              ✏️ Editar
            </button>
            ${(usuarioActivo?.rol === 'Admin') ? `
            <button onclick="eliminarCardEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id})"
                style="padding:6px 9px;border-radius:7px;font-size:13px;
                       cursor:pointer;border:1.5px solid #fca5a5;background:#fff1f2;color:#b91c1c;
                       display:flex;align-items:center;" title="Eliminar estructura">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>

          ${e.estado === 'disponible'
            ? `<button onclick="marcarEstructuraEntregada('${e.ids ? e.ids.join(',') : e.id}', '${(e.nombre_modelo||'').replace(/'/g,"\\'")}', this)"
                   style="width:100%;margin-top:10px;padding:9px;background:#0f172a;color:white;
                          border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                          display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-truck"></i> Entregar al chofer${e.cantidad > 1 ? ` (Máx: ${e.cantidad})` : ''}
               </button>`
            : `<div style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border-radius:8px;
                           font-size:11px;color:#15803d;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-circle-check"></i>
                <span>Chofer: <b>${e.chofer_nombre || '—'}</b></span>
               </div>`
          }
        </div>
      </div>`).join('') + `</div>`;
}


// Nota: abrirModalRegistrarEstructura y cerrarModalEstructura están definidas arriba
// con la lógica completa (carga de plantillas del catálogo)

function seSyncFoto(input) {
    const file = input.files[0];
    if (!file) return;
    // Copiar al input principal para que guardarEstructura lo encuentre
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('se-foto').files = dt.files;
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('se-foto-preview').src = e.target.result;
        document.getElementById('se-foto-nombre').textContent = file.name;
        document.getElementById('se-foto-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function guardarEstructura() {
    const nombre = document.getElementById('se-nombre').value.trim();
    const foto   = document.getElementById('se-foto-cam')?.files[0]
               || document.getElementById('se-foto').files[0];
    const tipo   = document.getElementById('se-tipo').value;
    const esAntiguo = document.getElementById('se-es-antiguo')?.checked;

    if (!nombre) {
        return Swal.fire({ icon:'warning', title:'Falta el nombre', text:'Escribe un nombre o descripción.' });
    }
    if (!esAntiguo && !foto) {
        return Swal.fire({ icon:'warning', title:'Falta la foto', text:'Agrega una foto del lote.' });
    }

    const esDestrokes = tipo === 'destrokes';

    // Validaciones específicas por tipo
    if (!esAntiguo && !esDestrokes) {
        const modeloBase = (document.getElementById('se-modelo-base')?.value || '').trim();
        if (!modeloBase) {
            return Swal.fire({ icon:'warning', title:'Falta el modelo base',
                text:'Selecciona el modelo base. Si no está en la lista, usa ⚙️ Gestionar para agregarlo.' });
        }
    } else if (!esAntiguo && esDestrokes) {
        const cant = document.getElementById('se-cantidad').value;
        if (!cant || parseInt(cant) < 1) {
            return Swal.fire({ icon:'warning', title:'Falta la cantidad',
                text:'Ingresa cuántas piezas de destrokes registras.' });
        }
    }

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const fd = new FormData();
    fd.append('nombre_modelo', nombre);
    fd.append('tipo',          tipo);
    fd.append('precio',        document.getElementById('se-precio').value || 0);
    if (foto) fd.append('foto', foto);
    
    fd.append('es_antiguo', esAntiguo ? 'true' : 'false');

    if (esAntiguo) {
        // En modo antiguo usar los campos del bloque antiguo extra
        fd.append('es_juego_completo', document.getElementById('se-juego-completo-antiguo')?.value || 'true');
        fd.append('tipo', document.getElementById('se-tipo-antiguo')?.value || 'estructura');
        fd.append('descripcion', document.getElementById('se-descripcion-antiguo')?.value || '');
        fd.append('cantidad', document.getElementById('se-cantidad').value || 1);
        fd.append('ancho', 0);
        fd.append('profundidad', 0);
        fd.append('alto', 0);
        fd.append('modelo_base', '');
        fd.append('medida_estandar', 'false');
        fd.append('tipo_base', '');
        fd.append('medida_base', '0');
        fd.append('medida_base_estandar', 'false');
        fd.append('medida_brazo', '');
    } else if (esDestrokes) {
        // Destrokes: solo cantidad, sin medidas ni modelo base
        fd.append('cantidad',    document.getElementById('se-cantidad').value || 1);
        fd.append('ancho',       0);
        fd.append('profundidad', 0);
        fd.append('alto',        0);
        fd.append('modelo_base', '');
        fd.append('medida_estandar', 'false');
    } else {
        const modeloBase = (document.getElementById('se-modelo-base')?.value || '').trim();
        fd.append('modelo_base',     modeloBase);
        fd.append('ancho',           document.getElementById('se-ancho').value || 0);
        fd.append('profundidad',     document.getElementById('se-prof').value || 0);
        fd.append('alto',            document.getElementById('se-alto').value || 0);
        fd.append('medida_estandar', document.getElementById('se-estandar').checked ? 'true' : 'false');
        fd.append('cantidad',        document.getElementById('se-cantidad').value || 1);
        // A8: campos pata/zócalo
        const tipoBase          = document.getElementById('se-tipo-base')?.value || '';
        const medidaBaseEst     = document.getElementById('se-medida-base-estandar')?.checked || false;
        const medidaBaseValor   = document.getElementById('se-medida-base')?.value || '';

        // Validación frontend: si eligió tipo de base pero no marcó estándar ni puso medida
        if (tipoBase && !medidaBaseEst && !medidaBaseValor) {
            Swal.close();
            return Swal.fire({ icon:'warning', title:'Falta la medida de base',
                text:'Ingresa la medida de la pata/zócalo, o marca "Es una medida estándar de base".' });
        }

        fd.append('tipo_base',            tipoBase);
        // Si es estándar enviamos "0" para que el backend no rechace campo vacío
        fd.append('medida_base',          medidaBaseEst ? '0' : medidaBaseValor);
        fd.append('medida_base_estandar', medidaBaseEst ? 'true' : 'false');
        fd.append('medida_brazo',         document.getElementById('se-medida-brazo')?.value || '');
    }

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras`, { method:'POST', body: fd });
        const d   = await res.json();
        if (d.exito) {
            cerrarModalEstructura();
            Swal.fire({ icon:'success', title:'¡Guardado!', timer:1400, showConfirmButton:false });
            const ctx = window._modalEstructuraCtx || {};
            if (ctx.contenedorId) {
                await _cargarContenidoStockSofa(ctx.contenedorId, ctx.esAdminCtx);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon:'error', title:'Error al guardar', text: d.error });
        }
    } catch(e) {
        Swal.fire({ icon:'error', title:'Sin conexión', text:'Verifica tu red e intenta de nuevo.' });
    }
}


// ── Función para agrupar estructuras similares en la vista de stock ──
function _groupEstructuras(lista) {
    let grouped = [];
    lista.forEach(e => {
        let existing = grouped.find(g => 
            g.nombre_modelo === e.nombre_modelo && 
            g.modelo_base === e.modelo_base &&
            g.ancho === e.ancho &&
            g.profundidad === e.profundidad &&
            g.alto === e.alto &&
            g.tipo === e.tipo &&
            g.tipo_base === e.tipo_base &&
            g.medida_base === e.medida_base &&
            g.medida_base_estandar === e.medida_base_estandar &&
            g.medida_estandar === e.medida_estandar &&
            g.estado === e.estado &&
            g.chofer_nombre === e.chofer_nombre &&
            g.es_antiguo === e.es_antiguo &&
            g.medida_brazo === e.medida_brazo &&
            g.es_juego_completo === e.es_juego_completo &&
            g.completado_por === e.completado_por &&
            g.fecha_completado === e.fecha_completado
        );
        if (existing) {
            existing.cantidad = (existing.cantidad || 1) + (e.cantidad || 1);
            if (!existing.ids) existing.ids = [existing.id];
            existing.ids.push(e.id);
        } else {
            grouped.push({ ...e, cantidad: e.cantidad || 1, ids: [e.id] });
        }
    });
    return grouped;
}

// ── Entregar estructura al chofer (flujo del carpintero) ──────────────────────
async function marcarEstructuraEntregada(idsStr, nombreEstructura, btnEl) {
    const ids = idsStr.toString().split(',').map(id => parseInt(id.trim()));
    const maxCant = ids.length;

    // 1. Cargar lista de choferes
    let opcionesHTML = '<option value="">— Selecciona al chofer —</option>';
    try {
        const res = await apiFetch(`${API_URL}/api/usuarios/choferes`);
        const choferes = await res.json();
        if (Array.isArray(choferes) && choferes.length > 0) {
            opcionesHTML += choferes
                .map(c => `<option value="${c.nombre}">${c.nombre}</option>`)
                .join('');
        }
    } catch(e) {
        // Si falla la carga, igual se puede escribir manualmente abajo
    }

    const { value: datos, isConfirmed } = await Swal.fire({
        title: '¿Qué chofer se la llevó?',
        html: `
            <p style="font-size:13px;color:#475569;margin:0 0 14px;">
                <b>${nombreEstructura}</b><br>
                <span style="font-size:11px;">Quedará registrada como entregada.</span>
            </p>
            <select id="swal-chofer-select"
                style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                       font-size:13px;margin-bottom:10px;">
                ${opcionesHTML}
            </select>
            <input id="swal-chofer-manual" type="text"
                placeholder="O escribe el nombre si no aparece en la lista"
                style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                       font-size:13px;box-sizing:border-box;">
            <div style="margin-top:14px;text-align:left;">
                <label style="font-size:12px;font-weight:700;color:#475569;">Foto de entrega (opcional)</label>
                <input id="swal-foto-entrega" type="file" accept="image/*" style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;margin-top:4px;">
                <label style="font-size:12px;font-weight:700;color:#475569;margin-top:10px;display:block;">Comentario</label>
                <textarea id="swal-comentario-entrega" style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;margin-top:4px;resize:vertical;min-height:50px;"></textarea>
            </div>
            ${maxCant > 1 ? `
            <div style="margin-top:14px;text-align:left;">
                <label style="font-size:12px;font-weight:700;color:#475569;">¿Cuántas unidades se lleva?</label>
                <input id="swal-cantidad-entregar" type="number" min="1" max="${maxCant}" value="${maxCant}"
                    style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                           font-size:13px;box-sizing:border-box;margin-top:4px;">
                <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;">Máximo disponible: ${maxCant}</p>
            </div>` : ''}
        `,
        showCancelButton: true,
        confirmButtonColor: '#15803d',
        cancelButtonColor: '#64748b',
        confirmButtonText: '✅ Confirmar entrega',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const sel    = document.getElementById('swal-chofer-select').value.trim();
            const manual = document.getElementById('swal-chofer-manual').value.trim();
            const nombre = manual || sel;
            if (!nombre) {
                Swal.showValidationMessage('Selecciona o escribe el nombre del chofer.');
                return false;
            }
            let cantidad = 1;
            if (maxCant > 1) {
                cantidad = parseInt(document.getElementById('swal-cantidad-entregar').value);
                if (isNaN(cantidad) || cantidad < 1 || cantidad > maxCant) {
                    Swal.showValidationMessage(`Ingresa una cantidad entre 1 y ${maxCant}.`);
                    return false;
                }
            
            }
            return { choferNombre: nombre, cantidad };
        }
    });

    if (!isConfirmed || !datos) return;

    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
        let foto_entrega_url = '';
        if (datos.foto) {
            const fdFoto = new FormData();
            fdFoto.append('foto', datos.foto);
            const resFoto = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: fdFoto });
            const dFoto = await resFoto.json();
            if (dFoto.url) foto_entrega_url = dFoto.url;
        }

        let exitoCount = 0;
        let lastError = null;
        const idsToDeliver = ids.slice(0, datos.cantidad);

        for (const id of idsToDeliver) {
            const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/entregar`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chofer_nombre: datos.choferNombre,
                    foto_entrega_url: foto_entrega_url,
                    comentario_entrega: datos.comentario
                })
            });
            const d = await res.json();
            if (d.exito) exitoCount++;
            else lastError = d.error;
        }

        if (exitoCount > 0) {
            Swal.fire({
                icon: 'success',
                title: '¡Entregado!',
                html: `Registrado que <b>${datos.choferNombre}</b> se llevó ${exitoCount} estructura(s).`,
                timer: 2200,
                showConfirmButton: false
            });
            // Refrescar la vista
            const ctx = window._modalEstructuraCtx || {};
            const contenedorId = ctx.contenedorId || window._stockSofaContenedorActivo;
            if (contenedorId) {
                await _cargarContenidoStockSofa(contenedorId, ctx.esAdminCtx || false);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error || 'No se pudo registrar la entrega.' });
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fa-solid fa-truck"></i> Entregar al chofer'; }
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Verifica tu red e intenta de nuevo.' });
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fa-solid fa-truck"></i> Entregar al chofer'; }
    }
}

// ── A9: Toggle pago de estructura ─────────────────────────────────────────────
async function togglePagoEstructura(id, pagadoActual, btnEl) {
    const nuevoPagado = !pagadoActual;
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '...';
    }
    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/pago`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pagado: nuevoPagado })
        });
        const d = await res.json();
        if (d.exito) {
            // Refrescar la vista completa para sincronizar estados
            const ctx = window._modalEstructuraCtx || {};
            const contenedorId = window._stockSofaContenedorActivo || (ctx.contenedorId);
            if (contenedorId) {
                const esAdmin = contenedorId === 'sp-sofa-contenido';
                await _cargarContenidoStockSofa(contenedorId, esAdmin);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error });
            if (btnEl) { btnEl.disabled = false; }
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
        if (btnEl) { btnEl.disabled = false; }
    }
}

// ── Eliminar estructura desde las cards (solo Admin) ─────────────────────────
async function eliminarCardEstructura(id) {
    const conf = await Swal.fire({
        title: '¿Eliminar esta estructura?',
        text: 'Se borrará permanentemente del stock. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!conf.isConfirmed) return;
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { Swal.fire('Error', data.error || 'No se pudo eliminar', 'error'); return; }
        // Quitar del cache y re-renderizar
        if (window._stockEstructurasData) {
            window._stockEstructurasData = window._stockEstructurasData.filter(e => e.id !== id);
        }
        const ctx = window._modalEstructuraCtx || {};
        const contenedorId = window._stockSofaContenedorActivo || ctx.contenedorId;
        if (contenedorId) {
            const esAdmin = contenedorId === 'sp-sofa-contenido';
            await _cargarContenidoStockSofa(contenedorId, esAdmin);
        }
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// ── Completar / Cambiar parte de la estructura ──
async function marcarParteCompletada(id) {
    const { value: datos } = await Swal.fire({
        title: 'Marcar como completado/cambiado',
        html: `
            <div style="text-align:left; font-size:13px;">
                <label style="font-weight:bold;display:block;margin-bottom:4px;">Completado por *</label>
                <input id="swal-cp-nombre" type="text" class="swal2-input" style="width:100%;margin:0 0 12px;font-size:13px;" placeholder="¿Quién lo completó?">
                
                <label style="font-weight:bold;display:block;margin-bottom:4px;">Fecha *</label>
                <input id="swal-cp-fecha" type="date" class="swal2-input" style="width:100%;margin:0 0 12px;font-size:13px;" value="${new Date().toISOString().split('T')[0]}">
                
                <label style="font-weight:bold;display:block;margin-bottom:4px;">Comentario</label>
                <textarea id="swal-cp-comentario" class="swal2-textarea" style="width:100%;margin:0 0 12px;font-size:13px;min-height:60px;" placeholder="Detalles de la pieza..."></textarea>
                
                <label style="font-weight:bold;display:block;margin-bottom:4px;">Foto de evidencia (opcional)</label>
                <input id="swal-cp-foto" type="file" accept="image/*" style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        confirmButtonColor: '#16a34a',
        preConfirm: () => {
            const completadoPor = document.getElementById('swal-cp-nombre').value.trim();
            const fecha = document.getElementById('swal-cp-fecha').value;
            const comentario = document.getElementById('swal-cp-comentario').value.trim();
            const foto = document.getElementById('swal-cp-foto').files[0];
            
            if (!completadoPor || !fecha) {
                Swal.showValidationMessage('El nombre y la fecha son obligatorios.');
                return false;
            }
            return { completadoPor, fecha, comentario, foto };
        }
    });

    if (!datos) return;
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const fd = new FormData();
    fd.append('completado_por', datos.completadoPor);
    fd.append('fecha_completado', datos.fecha);
    fd.append('comentario_parte', datos.comentario);
    if (datos.foto) fd.append('foto', datos.foto);

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/completar-parte`, { method: 'PATCH', body: fd });
        const d = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: 'Completado', timer: 1500, showConfirmButton: false });
            const ctx = window._modalEstructuraCtx || {};
            const contenedorId = window._stockSofaContenedorActivo || ctx.contenedorId;
            if (contenedorId) {
                await _cargarContenidoStockSofa(contenedorId, contenedorId === 'sp-sofa-contenido');
            } else { cargarTicketsTaller(); }
        } else { Swal.fire('Error', d.error, 'error'); }
    } catch (e) { Swal.fire('Error', 'No se pudo conectar', 'error'); }
}

// ── A9: Modal de edición de estructura ───────────────────────────────────────
async function abrirModalEditarEstructura(id) {
    const data = window._stockEstructurasData || [];
    const e = data.find(x => x.id === id);
    if (!e) {
        return Swal.fire({ icon: 'warning', title: 'No encontrado', text: 'Recarga la página e intenta de nuevo.' });
    }

    let opcionesModelo = '<option value="">— Seleccionar modelo base —</option>';
    try {
        const res = await apiFetch(`${API_URL}/api/catalogo`);
        const productos = await res.json();
        if (Array.isArray(productos)) {
            productos.filter(p => p.es_plantilla).forEach(p => {
                const sel = p.nombre === e.modelo_base ? 'selected' : '';
                opcionesModelo += `<option value="${p.nombre}" ${sel}>${p.nombre}</option>`;
            });
        }
    } catch(err) {}

    const tipoBaseOpts = ['', 'patas', 'zocalo'].map(v => {
        const label = v === '' ? '— Sin base —' : (v === 'patas' ? 'Patas' : 'Zócalo');
        return `<option value="${v}" ${e.tipo_base === v ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const resultado = await Swal.fire({
        title: 'Editar estructura',
        width: 520,
        html: `
<div style="text-align:left;font-family:Jost,sans-serif;font-size:13px;">
  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">NOMBRE / DESCRIPCIÓN</label>
  <input id="ed-nombre" value="${(e.nombre_modelo||'').replace(/"/g,'&quot;')}"
      style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;margin-bottom:12px;font-size:13px;box-sizing:border-box;">

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">MODELO BASE</label>
  <select id="ed-modelo-base"
      style="width:100%;padding:8px 10px;border:1.5px solid #7c3aed;border-radius:7px;margin-bottom:12px;font-size:13px;box-sizing:border-box;">
    ${opcionesModelo}
  </select>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">MEDIDAS (cm)</label>
  <div style="display:flex;gap:6px;margin-bottom:4px;">
    <input id="ed-ancho" type="number" placeholder="Ancho" value="${e.ancho||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
    <input id="ed-prof" type="number" placeholder="Prof." value="${e.profundidad||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
    <input id="ed-alto" type="number" placeholder="Alto" value="${e.alto||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
    <input id="ed-medida-brazo" type="number" placeholder="Brazo" value="${e.medida_brazo||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
  </div>
  <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;
                margin-bottom:6px;background:#f9f5ff;padding:7px 10px;border-radius:6px;border:1px solid #ede9fe;">
    <input type="checkbox" id="ed-estandar" ${e.medida_estandar ? 'checked' : ''}
           onchange="['ed-ancho','ed-prof','ed-alto'].forEach(id=>document.getElementById(id).disabled=this.checked);">
    <span style="font-weight:500;">Es medida estándar de catálogo</span>
  </label>
  <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;
                margin-bottom:12px;background:#fef2f2;padding:7px 10px;border-radius:6px;border:1px solid #fee2e2;">
    <input type="checkbox" id="ed-es-antiguo" ${e.es_antiguo ? 'checked' : ''}>
    <span style="font-weight:500;color:#991b1b;">🗄️ Es stock antiguo (hallado en almacén)</span>
  </label>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">TIPO DE BASE</label>
  <select id="ed-tipo-base"
      style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;margin-bottom:8px;font-size:13px;box-sizing:border-box;"
      onchange="document.getElementById('ed-bloque-base').style.display=this.value?'block':'none';">
    ${tipoBaseOpts}
  </select>
  <div id="ed-bloque-base" style="display:${e.tipo_base ? 'block' : 'none'};margin-bottom:12px;">
    <input id="ed-medida-base" type="number" placeholder="Medida base (cm)" value="${e.medida_base||''}"
        style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;margin-bottom:6px;">
    <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;
                  background:#f9f5ff;padding:7px 10px;border-radius:6px;border:1px solid #ede9fe;">
      <input type="checkbox" id="ed-medida-base-est" ${e.medida_base_estandar ? 'checked' : ''}
             onchange="document.getElementById('ed-medida-base').disabled=this.checked;">
      <span style="font-weight:500;">Medida estándar de base</span>
    </label>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <div style="flex:1;">
      <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">PRECIO (S/)</label>
      <input id="ed-precio" type="number" step="0.01" placeholder="0.00" value="${e.precio||''}"
          style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="flex:1;">
      <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">CANTIDAD</label>
      <input id="ed-cantidad" type="number" min="1" step="1" value="${e.cantidad||1}"
          style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;">
    </div>
  </div>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">NUEVA FOTO (opcional)</label>
  <input type="file" id="ed-foto" accept="image/*" style="font-size:12px;">
</div>`,
        confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios',
        confirmButtonColor: '#7c3aed',
        cancelButtonText: 'Cancelar',
        showCancelButton: true,
        preConfirm: () => {
            const nombre = (document.getElementById('ed-nombre')?.value || '').trim();
            if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
            return {
                nombre_modelo:        nombre,
                modelo_base:          document.getElementById('ed-modelo-base')?.value || '',
                ancho:                document.getElementById('ed-ancho')?.value || 0,
                profundidad:          document.getElementById('ed-prof')?.value || 0,
                alto:                 document.getElementById('ed-alto')?.value || 0,
                medida_estandar:      document.getElementById('ed-estandar')?.checked || false,
                medida_brazo:         document.getElementById('ed-medida-brazo')?.value || '',
                es_antiguo:           document.getElementById('ed-es-antiguo')?.checked || false,
                tipo_base:            document.getElementById('ed-tipo-base')?.value || '',
                medida_base:          document.getElementById('ed-medida-base')?.value || '',
                medida_base_estandar: document.getElementById('ed-medida-base-est')?.checked || false,
                precio:               document.getElementById('ed-precio')?.value || 0,
                cantidad:             document.getElementById('ed-cantidad')?.value || 1,
                foto:                 document.getElementById('ed-foto')?.files[0] || null,
            };
        }
    });

    if (!resultado.isConfirmed || !resultado.value) return;

    const captured = resultado.value;
    const fd = new FormData();
    Object.entries(captured).forEach(([k, v]) => {
        if (k === 'foto') { if (v) fd.append('foto', v); }
        else { fd.append(k, v); }
    });

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/editar`, {
            method: 'PATCH',
            body: fd
        });
        const d = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: '¡Guardado!', timer: 1300, showConfirmButton: false });
            const contenedorId = window._stockSofaContenedorActivo;
            if (contenedorId) {
                await _cargarContenidoStockSofa(contenedorId, contenedorId === 'sp-sofa-contenido');
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error al guardar', text: d.error });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
    }
}

