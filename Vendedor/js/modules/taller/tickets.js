// Taller - kanban, tickets y contratos de tela
/* --- KANBAN DE PRODUCCIÓN — LÓGICA UNIFICADA POR ROL           --- */
/* ================================================================= */

const CONFIG_AREAS = {
    'ESTRUCTURAS_MUEBLES':    { icono: '<i class="fa-solid fa-tree"></i>',            nombre: 'Carpintería (Sofás)' },
    'ESTRUCTURAS_SILLAS':     { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Carpintería (Sillas)' },
    'CORTE_Y_CONTROL_TELAS':  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura (Telas)' },
    'TELAS':                  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura' },
    'PREPARACION_PATAS_ZOCALO':{ icono: '<i class="fa-solid fa-shoe-prints"></i>',   nombre: 'Patas y Zócalos' },
    'TABLEROS_Y_PIEDRAS':     { icono: '<i class="fa-solid fa-table-cells-large"></i>',nombre: 'Tableros (Comedor)' },
    'TAPICERIA_SOFAS':        { icono: '<i class="fa-solid fa-couch"></i>',           nombre: 'Tapicería (Sofás)' },
    'TAPICERIA_SILLAS':       { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Tapicería (Sillas)' },
    'ARMADO_COJINES':         { icono: '<i class="fa-solid fa-layer-group"></i>',     nombre: 'Armado de Cojines' },
    'DESPACHO_CENTRAL':       { icono: '<i class="fa-solid fa-truck"></i>',           nombre: 'Despacho Central' },
};

/* ================================================================= */
/* --- VISTA COLA DE RECOJO CON PDF                              --- */
/* ================================================================= */

async function cargarVistaColaRecojo(contenedor) {
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/cola-recojo`);
        const data = await res.json();

        // Soporte retrocompatible: si el backend devuelve array plano (versión vieja),
        // lo convertimos al nuevo formato.
        const estructuras = Array.isArray(data) ? data : (data.estructuras || []);
        const compras     = Array.isArray(data) ? []   : (data.compras_externas || data.telas || []);

        // Guardar para los PDF masivos (sección A)
        window._colaRecojoData = estructuras;

        if (estructuras.length === 0 && compras.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin recojos pendientes</p>
                    <p style="font-size:13px;">Todas las estructuras terminadas o compras externas ya fueron recogidas.</p>
                </div>`;
            return;
        }

        let html = '';

        // ── SECCIÓN B: Compras Externas listas para recoger del proveedor ─────────────────
        if (compras.length > 0) {
            html += `
            <div style="margin-bottom:28px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; color:#7c3aed; font-size:15px; font-weight:900;">
                            <i class="fa-solid fa-boxes-packing"></i> 📦 ${compras.length} compra(s) lista(s) para recoger del proveedor
                        </h3>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">El chofer o responsable debe ir a buscar estos insumos o productos</p>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">`;

            compras.forEach(t => {
                const fechaProv = t.fecha_entrega_proveedor
                    ? `<span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;">📅 ${t.fecha_entrega_proveedor}</span>`
                    : '';
                const tel = t.telefono_proveedor
                    ? `<a href="tel:${t.telefono_proveedor}" style="color:#7c3aed;font-weight:700;text-decoration:none;"><i class="fa-solid fa-phone"></i> ${t.telefono_proveedor}</a>`
                    : '';
                const dir = t.direccion_proveedor
                    ? `<span style="color:#64748b;font-size:11px;"><i class="fa-solid fa-location-dot"></i> ${t.direccion_proveedor}</span>`
                    : '';
                const fotoCot = t.url_cotizacion_adjunta
                    ? `<a href="${t.url_cotizacion_adjunta}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#f5f3ff;color:#7c3aed;padding:5px 10px;border-radius:7px;font-size:10px;font-weight:800;text-decoration:none;"><i class="fa-solid fa-file-image"></i> Ver cotización</a>`
                    : '';
                const notas = t.notas_proveedor
                    ? `<div style="font-size:11px;color:#475569;background:#faf5ff;border-left:3px solid #a78bfa;padding:6px 10px;border-radius:0 6px 6px 0;margin-top:6px;">${t.notas_proveedor}</div>`
                    : '';

                html += `
                <div style="background:white; border-radius:14px; border:1.5px solid #ddd6fe; box-shadow:0 4px 12px rgba(124,58,237,0.07); overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe); padding:13px 18px; border-bottom:2px solid #ddd6fe; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#7c3aed; text-transform:uppercase; letter-spacing:1px;">COMPRA EXTERNA · Ref. ${t.codigo_venta}</span>
                            <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${t.insumo}${t.sku ? ` <span style="font-size:11px;color:#94a3b8;font-weight:600;">(${t.sku})</span>` : ''}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;"><b>Cliente:</b> ${t.cliente}</p>
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; align-items:center;">
                                <span style="font-size:12px; font-weight:800; color:#0f172a; background:#ede9fe; padding:3px 10px; border-radius:20px;">
                                    <i class="fa-solid fa-store"></i> ${t.proveedor}
                                </span>
                                ${tel} ${dir} ${fechaProv}
                            </div>
                        </div>
                        <button onclick="_confirmarRecojoExterno(${t.logistica_id}, '${t.insumo.replace(/'/g,"\\'")}', this)"
                            style="background:#7c3aed; color:white; border:none; padding:10px 16px; border-radius:9px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:7px;">
                            <i class="fa-solid fa-circle-check"></i> Confirmar recojo
                        </button>
                    </div>
                    <div style="padding:12px 18px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                        ${fotoCot}
                        ${notas}
                        ${t.cantidad > 1 ? `<span style="font-size:11px;color:#64748b;background:#f8fafc;padding:3px 8px;border-radius:6px;"><i class="fa-solid fa-ruler"></i> ${t.cantidad} ${t.unidad || 'unid.'}</span>` : ''}
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        }

        // ── SECCIÓN A: Estructuras listas para llevar al tapicero ──────────────
        if (estructuras.length > 0) {
            html += `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; color:#c2410c; font-size:15px; font-weight:900;">
                            <i class="fa-solid fa-truck-fast"></i> 🧱 ${estructuras.length} estructura${estructuras.length>1?'s':''} lista${estructuras.length>1?'s':''} para llevar al tapicero
                        </h3>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Descarga el PDF de cada item o genera una hoja de recojo masiva</p>
                    </div>
                    <button onclick="imprimirPDFRecojoMasivo()" 
                        style="background:#c2410c; color:white; border:none; padding:12px 20px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-file-pdf"></i> PDF MASIVO (${estructuras.length} items)
                    </button>
                </div>
                <div style="display:flex; flex-direction:column; gap:15px;">`;

            estructuras.forEach((c, idx) => {
                const fotoEstructura = c.foto_url && !c.foto_url.includes('sin_foto') ? c.foto_url.split('|')[0] : null;
                const fotoEvidencia  = c.foto_evidencia || null;
                const telaLista = c.tela_distribuida !== false; // true si campo ausente (retrocompat)
                const semColor  = telaLista ? '#16a34a' : '#f59e0b';
                const semIcon   = telaLista ? '🟢' : '🟡';
                const semLabel  = telaLista
                    ? '<span style="color:#16a34a; font-weight:800; font-size:11px;">🟢 Tela lista — recojo habilitado</span>'
                    : '<span style="color:#f59e0b; font-weight:800; font-size:11px;">🟡 Tela pendiente de distribución al tapicero</span>';

                html += `
                <div style="background:white; border-radius:14px; border:1px solid ${semColor}55; box-shadow:0 4px 12px rgba(249,115,22,0.08); overflow:hidden;">
                    <!-- Cabecera naranja -->
                    <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5); padding:14px 18px; border-bottom:2px solid ${semColor}44; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:1px;">${semIcon} ${c.area.replace(/_/g,' ')} · Terminado el ${c.fecha_fin}</span>
                            <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${c.producto}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;">
                                <b>Ref:</b> ${c.codigo_venta} &nbsp;|&nbsp; <b>Cliente:</b> ${c.cliente}
                                ${c.direccion ? `&nbsp;|&nbsp; <b>Entrega:</b> ${c.fecha_entrega}` : ''}
                            </p>
                            <p style="margin:4px 0 2px 0; font-size:11px; color:#64748b;">
                                <i class="fa-solid fa-user-gear"></i> <b>Carpintero:</b> ${c.operario} &nbsp;
                                <i class="fa-solid fa-couch"></i> <b>Tapicero:</b> <span style="color:#0369a1; font-weight:bold;">${c.tapicero}</span>
                            </p>
                            ${semLabel}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                            <button onclick="imprimirPDFRecojoUnitario(${idx})" 
                                data-recojo-idx="${idx}"
                                style="background:#f97316; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                                <i class="fa-solid fa-file-pdf"></i> PDF Unitario
                            </button>
                            ${(typeof usuarioActivo !== 'undefined' && (usuarioActivo.rol === 'Chofer' || usuarioActivo.rol === 'Admin' || usuarioActivo.rol === 'Jefe_Taller'))
                                ? (telaLista
                                    ? `<button onclick="confirmarRecojoEstructura(${c.ticket_id}, '${(c.producto||'').replace(/'/g,"\\'")}', this)"
                                        style="background:#dc2626; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                                        ✅ Confirmar Recojo
                                    </button>`
                                    : `<button disabled title="Esperando que la tela sea distribuida al tapicero"
                                        style="background:#d1d5db; color:#6b7280; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:not-allowed; white-space:nowrap;">
                                        🟡 Esperando tela
                                    </button>`)
                                : ''}
                        </div>
                    </div>
                    <!-- Cuerpo con fotos -->
                    <div style="padding:15px 18px; display:flex; gap:15px; flex-wrap:wrap; align-items:flex-start;">
                        ${fotoEstructura ? `
                        <div style="text-align:center;">
                            <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Foto del Mueble</span>
                            <img src="${fotoEstructura}" alt="Mueble"
                                style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0;"
                                onerror="this.parentElement.style.display='none'">
                        </div>` : ''}
                        ${fotoEvidencia ? `
                        <div style="text-align:center;">
                            <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Evidencia Terminado</span>
                            <img src="${fotoEvidencia}" alt="Evidencia"
                                style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #22c55e;"
                                onerror="this.parentElement.style.display='none'">
                        </div>` : ''}
                        ${c.especificaciones ? `
                        <div style="flex:1; min-width:180px; background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #f97316;">
                            <span style="font-size:9px; font-weight:900; color:#f97316; display:block; margin-bottom:6px; text-transform:uppercase;">Especificaciones</span>
                            <div style="font-size:11px; color:#374151; line-height:1.5;">${c.especificaciones.replace(/\n/g,'<br>')}</div>
                        </div>` : ''}
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;

    } catch(e) {
        console.error('Error cargando cola de recojo:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar la cola de recojo.</p>`;
    }
}

async function _confirmarRecojoExterno(logisticaId, insumoNombre, btnEl) {
    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar recojo?',
        html: `<p style="font-size:14px;color:#374151;">Confirma que recogiste físicamente:<br><b>${insumoNombre}</b><br><br>Se marcará como Recibido y habilitará la producción o el despacho del ítem.</p>`,
        showCancelButton: true,
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: 'transparent',
        confirmButtonText: '✅ Sí, lo recogí',
        cancelButtonText: 'Cancelar',
    });
    if (!conf.isConfirmed) return;

    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await apiFetch(`${API_URL}/api/logistica/${logisticaId}/confirmar-recojo-externo`, { method: 'POST' });
        const d   = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: '¡Recojo confirmado!', text: d.mensaje, timer: 2500, showConfirmButton: false });
            // Recargar la cola para que el item desaparezca
            const contFinal = document.getElementById('contenedor-cola-recojo') || document.querySelector('.cola-recojo-wrapper') || document.getElementById('contenedor-tickets-taller');
            if (contFinal) await cargarTicketsTaller();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error || 'No se pudo confirmar' });
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirmar recojo';
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
        btnEl.disabled = false;
        btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirmar recojo';
    }
}

// Helper: detecta el modelo base de un nombre de producto (para buscar stock coincidente)
function _extraerModeloBase(nombreProducto) {
    if (!nombreProducto) return '';
    const nombre = nombreProducto.toLowerCase();
    const modelos = [
        'multifuncional', 'multi3', 'multi4',
        'seccional invertido', 'seccional',
        'curvo', 'en u', 'juego', 'esquinero',
        'sofá 3', 'sofá 2', 'sofá 1',
        'sofa 3', 'sofa 2', 'sofa 1',
        'butaca', 'silla', 'cama', 'camas', 'puff',
    ];
    for (const m of modelos) {
        if (nombre.includes(m)) {
            return m.charAt(0).toUpperCase() + m.slice(1);
        }
    }
    return '';
}

async function cargarSugerenciasEstructura(ancho, profundidad, alto, ticketId, contenedorId, modeloBase = '') {
    try {
        const cont = document.getElementById(contenedorId);
        if (!cont) return;
 
        // — Primera consulta: por modelo_base y/o medidas —
        const params = new URLSearchParams({
            ancho:       ancho       || 0,
            profundidad: profundidad || 0,
            alto:        alto        || 0,
        });
        if (modeloBase) params.append('modelo_base', modeloBase.trim());
 
        const res          = await apiFetch(`${API_URL}/api/stock-estructuras/sugerir?${params}`);
        const sugerencias  = await res.json();
 
        if (!Array.isArray(sugerencias) || !sugerencias.length) return;
 
        // — Agrupar resultados —
        const porModelo   = sugerencias.filter(s =>
            s.modelo_base && modeloBase &&
            s.modelo_base.toLowerCase() === modeloBase.toLowerCase()
        );
        const estandares  = sugerencias.filter(s => s.medida_estandar && !porModelo.includes(s));
        const porMedidas  = sugerencias.filter(s => !porModelo.includes(s) && !estandares.includes(s));
 
        const renderOption = s => {
            const tagModelo = (s.modelo_base && modeloBase &&
                s.modelo_base.toLowerCase() === modeloBase.toLowerCase())
                ? ' 🎯 Mismo modelo' : '';
            const tagEst    = s.medida_estandar ? ' ⭐ Estándar' : '';
            const medidas   = (s.ancho || s.profundidad || s.alto)
                ? ` · ${s.ancho}×${s.profundidad}×${s.alto} cm` : '';
            const modeloTag = s.modelo_base ? ` (${s.modelo_base})` : '';
            return `<option value="${s.id}">${s.nombre_modelo}${modeloTag}${medidas}${tagModelo}${tagEst}</option>`;
        };
 
        let opcionesHTML = `<option value="">— Seleccionar estructura del stock —</option>`;
 
        if (porModelo.length > 0) {
                opcionesHTML += `<optgroup label="🎯 Mismo modelo (${modeloBase})">`;
                opcionesHTML += porModelo.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            if (estandares.length > 0) {
                opcionesHTML += `<optgroup label="📐 Medidas estándar">`;
                opcionesHTML += estandares.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            if (porMedidas.length > 0) {
                opcionesHTML += `<optgroup label="📏 Medidas similares">`;
                opcionesHTML += porMedidas.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            // Seguridad: si no cayó en ningún grupo, mostrar plano
            if (!porModelo.length && !estandares.length && !porMedidas.length) {
                opcionesHTML += sugerencias.map(renderOption).join('');
            }
 
        cont.innerHTML = `
          <div style="background:#f5f3ff;border:1.5px solid #7c3aed;border-radius:10px;
                      padding:12px;margin-top:10px;" id="box-est-${ticketId}">
            <div style="font-weight:700;font-size:13px;color:#7c3aed;margin-bottom:4px;">
              📦 Stock disponible — ya está pagado, NO cobrar:
            </div>
            <div style="font-size:11px;color:var(--text-muted,#64748b);margin-bottom:8px;">
              Selecciona una estructura del inventario para asignarla a este pedido.
            </div>
            <select id="sel-estructura-${ticketId}"
                style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;
                       font-size:13px;margin-bottom:8px;">
              ${opcionesHTML}
            </select>
            <button onclick="usarEstructuraStock(${ticketId})"
                id="btn-usar-est-${ticketId}"
                style="width:100%;padding:10px;background:#7c3aed;color:white;border:none;
                       border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                ✅ Usar esta estructura (ya está pagada — no cobrar al cliente)
            </button>
          </div>`;
 
    } catch(e) {
        console.warn('No se pudieron cargar sugerencias de stock:', e);
    }
}
 
async function usarEstructuraStock(ticketId) {
    const sel = document.getElementById(`sel-estructura-${ticketId}`);
    if (!sel || !sel.value) {
        return Swal.fire({ icon: 'warning', text: 'Selecciona una estructura.' });
    }
 
    // Obtener nombre para mostrarlo en el badge
    const nombreElegido = sel.options[sel.selectedIndex]?.text || '';
 
    const { isConfirmed } = await Swal.fire({
        icon: 'question',
        title: '¿Usar esta estructura del stock?',
        html: `<p style="font-size:13px;color:#475569;">
                Esta estructura <b>ya está pagada</b> — se asignará al ticket
                y el carpintero NO necesita fabricarla.<br><br>
                <span style="background:#fef3c7;color:#92400e;padding:6px 10px;
                             border-radius:6px;font-size:12px;font-weight:700;
                             display:inline-block;">
                  ⚠️ NO cobrar al cliente por esta pieza
                </span>
               </p>`,
        showCancelButton:    true,
        confirmButtonText:   '✅ Sí, usar del stock',
        cancelButtonText:    'Cancelar',
        confirmButtonColor:  '#7c3aed',
    });
    if (!isConfirmed) return;
 
    const res = await apiFetch(`${API_URL}/api/stock-estructuras/${sel.value}/usar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticket_id: ticketId }),
    });
    const d = await res.json();
 
    if (d.exito) {
        Swal.fire({
            icon: 'success', title: 'Listo',
            text: 'Estructura asignada desde stock.',
            timer: 1800, showConfirmButton: false,
        });
 
        // ── Actualización local del DOM ──────────────────────────────────
        // 1. Reemplazar el dropdown por un badge de confirmación
        const box = document.getElementById(`box-est-${ticketId}`);
        if (box) {
            box.innerHTML = `
              <div style="background:#ecfdf5;border:1.5px solid #16a34a;border-radius:8px;
                          padding:10px 14px;font-size:13px;color:#15803d;font-weight:600;">
                ✅ Estructura del stock asignada · <span style="font-weight:400;">${nombreElegido}</span>
              </div>`;
        }
 
        // 2. Resaltar la tarjeta del ticket con borde verde
        const card = document.querySelector(`[data-ticket-id="${ticketId}"]`)
                  || document.getElementById(`ticket-card-${ticketId}`)
                  || (() => {
                       // fallback: buscar el contenedor padre del div de sugerencias
                       const sugDiv = document.getElementById(`sug-est-${ticketId}`);
                       return sugDiv ? sugDiv.closest('[class*="ticket"]') : null;
                   })();
        if (card) {
            card.style.border     = '2px solid #16a34a';
            card.style.background = 'rgba(22,163,74,0.04)';
        }
 
        // 3. Ocultar el botón "Iniciar trabajo" del mismo ticket (ya no hay que fabricar)
        const btnIniciar = document.getElementById(`btn-iniciar-${ticketId}`)
                        || document.querySelector(`[onclick*="iniciarTicket(${ticketId})"]`);
        if (btnIniciar) btnIniciar.style.display = 'none';
 
    } else {
        Swal.fire({ icon: 'error', text: d.error || 'Error al asignar la estructura.' });
    }
}


/* --- PDF UNITARIO DE RECOJO --- */
function imprimirPDFRecojoUnitario(idx) {
    const cola = window._colaRecojoData;
    if (!cola || !cola[idx]) return;
    const c = cola[idx];
    abrirVentanaPDFRecojo([c], `HOJA DE RECOJO — ${c.codigo_venta}`);
}

/* --- PDF MASIVO DE RECOJO --- */
function imprimirPDFRecojoMasivo() {
    const cola = window._colaRecojoData;
    if (!cola || cola.length === 0) return Swal.fire('Sin datos', 'No hay items en la cola.', 'info');
    abrirVentanaPDFRecojo(cola, `HOJA DE RECOJO MASIVO — ${cola.length} Estructuras`);
}

/* --- GENERADOR DE PDF DE RECOJO (unitario y masivo comparten el mismo motor) --- */
function abrirVentanaPDFRecojo(items, titulo) {
    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });

    const filas = items.map((c, i) => `
        <div class="recojo-item ${i > 0 ? 'page-break' : ''}">
            <!-- Encabezado del item -->
            <div class="item-header">
                <div class="item-numero">ITEM ${String(i+1).padStart(2,'0')}</div>
                <div class="item-info">
                    <div class="item-titulo">${c.producto}</div>
                    <div class="item-meta">
                        <span><b>Ref:</b> ${c.codigo_venta}</span>
                        <span><b>Cliente:</b> ${c.cliente.toUpperCase()}</span>
                        <span><b>Entrega:</b> ${c.fecha_entrega || 'S/F'}</span>
                    </div>
                    <div class="item-meta" style="margin-top:4px;">
                        <span><b>Área terminada:</b> ${c.area.replace(/_/g,' ')}</span>
                        <span><b>Terminado el:</b> ${c.fecha_fin}</span>
                    </div>
                </div>
                <div class="item-badge">PARA RECOGER</div>
            </div>

            <!-- Cuerpo: fotos + specs + operarios -->
            <div class="item-body">
                <!-- Columna de fotos -->
                <div class="fotos-col">
                    ${c.foto_url && !c.foto_url.includes('sin_foto') ? `
                    <div class="foto-box">
                        <div class="foto-label">Foto del Mueble</div>
                        <img src="${c.foto_url.split('|')[0]}" class="foto-img" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    ${c.foto_evidencia ? `
                    <div class="foto-box">
                        <div class="foto-label">Evidencia Terminado</div>
                        <img src="${c.foto_evidencia}" class="foto-img evidencia" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                </div>

                <!-- Columna de datos -->
                <div class="datos-col">
                    <table class="datos-tabla">
                        <tr><th>Carpintero / Operario</th><td>${c.operario}</td></tr>
                        <tr><th>Tapicero Asignado</th><td style="color:#0369a1; font-weight:bold;">${c.tapicero}</td></tr>
                        ${c.direccion ? `<tr><th>Dirección Entrega</th><td>${c.direccion}</td></tr>` : ''}
                        ${c.especificaciones ? `<tr><th>Especificaciones</th><td class="specs">${c.especificaciones.replace(/\n/g,'<br>').replace(/<b>/g,'<b>').replace(/<\/b>/g,'</b>')}</td></tr>` : ''}
                    </table>
                </div>
            </div>

            <!-- Firmas -->
            <div class="firmas">
                <div class="firma-box"><div class="firma-linea"></div><p>Carpintero / Entrega</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Chofer / Transporte</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Tapicero / Recepción</p></div>
            </div>
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: white; font-size: 12px; }

    /* --- Encabezado de empresa --- */
    .empresa-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px 24px; border-bottom: 3px solid #f97316;
        margin-bottom: 20px;
    }
    .empresa-logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
    .empresa-logo span { color: #0f172a; }
    .empresa-doc { text-align: right; }
    .empresa-doc h2 { font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .empresa-doc p { font-size: 10px; color: #64748b; }
    .empresa-doc .badge-doc {
        background: #f97316; color: white; font-size: 10px; font-weight: 900;
        padding: 3px 10px; border-radius: 20px; display: inline-block; margin-bottom: 4px;
    }

    /* --- Item de recojo --- */
    .recojo-item { margin-bottom: 30px; }
    .page-break { page-break-before: always; padding-top: 20px; }

    .item-header {
        display: flex; align-items: flex-start; gap: 12px;
        background: linear-gradient(135deg, #fff7ed, #ffedd5);
        border: 2px solid #f97316; border-radius: 10px 10px 0 0;
        padding: 12px 16px;
    }
    .item-numero {
        background: #f97316; color: white; font-size: 11px; font-weight: 900;
        padding: 6px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }
    .item-info { flex: 1; }
    .item-titulo { font-size: 16px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .item-meta { display: flex; gap: 16px; font-size: 11px; color: #374151; flex-wrap: wrap; }
    .item-meta span b { color: #f97316; }
    .item-badge {
        background: #dc2626; color: white; font-size: 10px; font-weight: 900;
        padding: 5px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }

    .item-body {
        display: flex; gap: 0; border: 2px solid #f97316; border-top: none; border-radius: 0 0 0 0;
        min-height: 160px;
    }
    .fotos-col {
        display: flex; flex-direction: column; gap: 0;
        border-right: 1px solid #fed7aa; min-width: 140px; max-width: 180px;
    }
    .foto-box { padding: 10px; border-bottom: 1px solid #fed7aa; }
    .foto-box:last-child { border-bottom: none; }
    .foto-label { font-size: 9px; font-weight: 900; color: #f97316; text-transform: uppercase; margin-bottom: 5px; }
    .foto-img { width: 120px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; display: block; }
    .foto-img.evidencia { border-color: #22c55e; }

    .datos-col { flex: 1; padding: 12px; }
    .datos-tabla { width: 100%; border-collapse: collapse; }
    .datos-tabla th {
        text-align: left; font-size: 10px; font-weight: 900; color: #64748b;
        text-transform: uppercase; padding: 7px 8px; background: #f8fafc;
        border-bottom: 1px solid #e2e8f0; white-space: nowrap; width: 140px;
    }
    .datos-tabla td {
        font-size: 12px; padding: 7px 8px; border-bottom: 1px solid #f1f5f9;
        color: #1e293b; vertical-align: top;
    }
    .datos-tabla td.specs { font-size: 11px; line-height: 1.6; color: #374151; }

    /* Firmas */
    .firmas {
        display: flex; gap: 0;
        border: 2px solid #f97316; border-top: 1px solid #fed7aa;
        border-radius: 0 0 10px 10px; overflow: hidden;
    }
    .firma-box {
        flex: 1; padding: 14px 16px; text-align: center;
        border-right: 1px solid #fed7aa;
    }
    .firma-box:last-child { border-right: none; }
    .firma-linea { border-bottom: 1.5px solid #0f172a; margin-bottom: 6px; height: 30px; }
    .firma-box p { font-size: 10px; color: #64748b; font-weight: 700; }

    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none; }
    }
</style>
</head>
<body>

<div class="empresa-header">
    <div>
        <div class="empresa-logo">INNOVA <span>MOBILI</span></div>
        <p style="font-size:10px; color:#64748b; margin-top:3px;">Sistema de Producción y Despacho</p>
    </div>
    <div class="empresa-doc">
        <div class="badge-doc"><i>🚛</i> HOJA DE RECOJO</div>
        <h2>${titulo}</h2>
        <p>Fecha de emisión: ${fecha}</p>
        <p style="margin-top:2px; font-weight:bold; color:#f97316;">${items.length} ESTRUCTURA${items.length>1?'S':''} A RECOGER</p>
    </div>
</div>

${filas}

<div style="text-align:center; margin-top:20px; padding:10px; font-size:10px; color:#94a3b8; border-top:1px dashed #e2e8f0;">
    Documento generado por INNOVA MOBILI ERP · ${fecha}
</div>

<script>
    window.onload = function() {
        // Esperar que carguen las imágenes antes de imprimir
        const imgs = document.images;
        let loaded = 0;
        const total = imgs.length;
        if (total === 0) { setTimeout(() => window.print(), 300); return; }
        for (let i = 0; i < total; i++) {
            if (imgs[i].complete) {
                loaded++;
                if (loaded === total) { setTimeout(() => window.print(), 400); }
            } else {
                imgs[i].onload = imgs[i].onerror = function() {
                    loaded++;
                    if (loaded === total) { setTimeout(() => window.print(), 400); }
                };
            }
        }
    };
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return Swal.fire('Bloqueado', 'Permite ventanas emergentes en tu navegador para generar el PDF.', 'warning');
    win.document.write(html);
    win.document.close();
}

async function cargarTicketsTaller() {
    const contenedor = document.getElementById('contenedor-tickets-taller');
    if (!contenedor || !usuarioActivo) return;

    // ── Actualizar badge de stats siempre que se cargue el taller ──
    cargarStatsTaller();

    const esAdmin      = ['Admin', 'Jefe_Taller'].includes(usuarioActivo.rol);
    const esOperario   = usuarioActivo.rol === 'Operario';
    const esChofer     = usuarioActivo.rol === 'Chofer';

    // ── TABS: solo para Operario y Jefe viendo sus tareas ──
    let tabsHeader = document.getElementById('tabs-taller-header');
    if (!tabsHeader) {
        tabsHeader = document.createElement('div');
        tabsHeader.id = 'tabs-taller-header';
        tabsHeader.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;';
        contenedor.parentNode.insertBefore(tabsHeader, contenedor);
    }

    if (esAdmin && typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'stock_produccion') {
        tabsHeader.style.display = 'none';
        // Resetear el grid del contenedor para que el stock ocupe todo el ancho
        contenedor.style.display = 'block';
        contenedor.style.gridTemplateColumns = '';
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando stock de producción...</p>';
        await cargarVistaStockProduccion(contenedor);
        return;
    } else {
        tabsHeader.style.display = 'flex';
        // Restaurar el grid del contenedor para las vistas de tickets
        contenedor.style.display = 'grid';
        contenedor.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))';
    }

    if (esAdmin) {
        tabsHeader.innerHTML = `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                <button onclick="filtroAdminTaller='pendientes'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? '#0f172a' : '#e2e8f0'};
                    color:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? 'white' : '#475569'};">
                    <i class="fa-solid fa-user-plus"></i> PENDIENTES DE ASIGNAR
                </button>
                <button onclick="filtroAdminTaller='ordenes'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='ordenes' ? '#558fc5' : '#eff6ff'};
                    color:${filtroAdminTaller==='ordenes' ? 'white' : '#1e40af'};
                    border:2px solid #93c5fd;">
                    <i class="fa-solid fa-list-check"></i> ÓRDENES POR PEDIDO
                </button>
                <button onclick="filtroAdminTaller='recojo'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='recojo' ? '#c2410c' : '#fff7ed'};
                    color:${filtroAdminTaller==='recojo' ? 'white' : '#c2410c'};
                    border:2px solid #f97316;">
                    <i class="fa-solid fa-truck-fast"></i> COLA DE RECOJO
                </button>
                <button onclick="filtroAdminTaller='entregados'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='entregados' ? '#15803d' : '#f0fdf4'};
                    color:${filtroAdminTaller==='entregados' ? 'white' : '#15803d'};
                    border:2px solid #86efac;">
                    <i class="fa-solid fa-circle-check"></i> ENTREGADOS
                </button>
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // Si está en vista RECOJO, mostrar esa sección y salir
        if (filtroAdminTaller === 'recojo') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojo(contenedor);
            return;
        }

        // Si está en vista ENTREGADOS, mostrar historial y salir
        if (filtroAdminTaller === 'entregados') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando historial de entregas...</p>';
            await cargarVistaEntregados(contenedor, null);
            return;
        }

        // Si está en vista ÓRDENES POR PEDIDO, mostrar esa sección y salir
        if (filtroAdminTaller === 'ordenes') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando órdenes de producción...</p>';
            await cargarOrdenesProduccion(contenedor);
            return;
        }
    } else if (esChofer) {
        // ── CHOFER: vista propia con fichas de entrega ──────────────────────
        const filtroChofer = (typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'entregados_chofer')
            ? 'entregados_chofer'
            : (filtroAdminTaller === 'cola_recojo_chofer' ? 'cola_recojo_chofer' : 'activas');
        
        // AÑADIR ESTA LÍNEA
        const filtroActivo = (filtroAdminTaller === 'cola_despacho') ? 'cola_despacho' : filtroChofer;

        tabsHeader.innerHTML = `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                <button onclick="filtroAdminTaller='cola_recojo_chofer'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='cola_recojo_chofer' ? '#dc2626' : '#fff5f5'};
                    color:${filtroChofer==='cola_recojo_chofer' ? 'white' : '#991b1b'};
                    border:2px solid #fca5a5;">
                    🔴 COLA DE RECOJO
                </button>
                <button onclick="filtroAdminTaller='cola_despacho'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroActivo==='cola_despacho' ? '#f97316' : '#fff7ed'};
                    color:${filtroActivo==='cola_despacho' ? 'white' : '#9a3412'};
                    border:2px solid #fb923c;">
                    <i class="fa-solid fa-boxes-packing"></i> COLA DE DESPACHO
                </button>
                <button onclick="filtroAdminTaller='activas'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='activas' ? '#1e40af' : '#eff6ff'};
                    color:${filtroChofer==='activas' ? 'white' : '#1e40af'};
                    border:2px solid #93c5fd;">
                    <i class="fa-solid fa-truck"></i> MIS ENTREGAS ASIGNADAS
                </button>
                <button onclick="filtroAdminTaller='entregados_chofer'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='entregados_chofer' ? '#15803d' : '#f0fdf4'};
                    color:${filtroChofer==='entregados_chofer' ? 'white' : '#15803d'};
                    border:2px solid #86efac;">
                    <i class="fa-solid fa-circle-check"></i> MIS ENTREGADOS
                </button>
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569; margin-left:auto;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // ── Tab "Cola de Recojo" del chofer ──────────────────────────────────
        if (filtroChofer === 'cola_recojo_chofer') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojoChofer(contenedor);
            return;
        }

        // ── Tab "Cola de Despacho" del chofer ────────────────────────────────
        if (filtroActivo === 'cola_despacho') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando despachos pendientes...</p>';
            await cargarColaDespacho(contenedor);
            return;
        }

        // ── Tab "Mis Entregados" del chofer ──────────────────────────────────
        if (filtroChofer === 'entregados_chofer') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando historial...</p>';
            await cargarVistaEntregados(contenedor, usuarioActivo.id);
            return;
        }

        contenedor.style.display = 'block';
        contenedor.style.gridTemplateColumns = '';
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando tus entregas...</p>';

        try {
            const res     = await apiFetch(`${API_URL}/api/taller/tickets?area=DESPACHO_CENTRAL`);
            const tickets = await res.json();

            if (!Array.isArray(tickets)) {
                contenedor.innerHTML = `<p style="color:red;text-align:center;">Error: ${tickets.error||'Respuesta inválida'}</p>`;
                return;
            }

            const misDespachos = tickets.filter(t =>
                t.area === 'DESPACHO_CENTRAL' &&
                Number(t.trabajador) === Number(usuarioActivo.id) &&
                t.estado !== 'Terminado'
            );

            if (misDespachos.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center;padding:60px 20px;color:#64748b;">
                        <div style="font-size:48px;margin-bottom:16px;">🚚</div>
                        <p style="font-weight:700;font-size:15px;color:#374151;margin:0 0 8px;">Sin entregas pendientes</p>
                        <p style="font-size:13px;margin:0;">Cuando el administrador te asigne una entrega aparecerá aquí.</p>
                    </div>`;
                return;
            }

            let html = '';
            for (const t of misDespachos) {
                const isEnProceso = t.estado === 'En Proceso';
                html += `
                <div style="background:#fff;border:2px solid ${isEnProceso?'#3b82f6':'#e2e8f0'};border-radius:14px;padding:0;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.07);overflow:hidden;">
                    <!-- Cabecera -->
                    <div style="background:${isEnProceso?'linear-gradient(135deg,#eff6ff,#dbeafe)':'#f8fafc'};padding:14px 16px;border-bottom:1px solid ${isEnProceso?'#93c5fd':'#e2e8f0'};display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Despacho asignado</div>
                            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">${t.producto}</div>
                        </div>
                        <span style="background:${isEnProceso?'#3b82f6':'#f59e0b'};color:white;font-size:11px;font-weight:800;padding:5px 12px;border-radius:20px;">
                            ${isEnProceso?'🔵 EN RUTA':'🟡 PENDIENTE'}
                        </span>
                    </div>
                    <!-- Ficha técnica (se carga al abrir) -->
                    <div id="ficha-chofer-${t.id}" style="display:none;"></div>
                    <!-- Botones principales -->
                    <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
                        <button onclick="toggleFichaChofer(${t.id}, ${t.item_id})"
                            id="btn-ficha-${t.id}"
                            style="width:100%;background:#0f172a;color:white;border:none;padding:11px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                            <i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA
                        </button>
                        ${renderBotonTicket(t, false, false, isEnProceso, false)}
                    </div>
                </div>`;
            }
            contenedor.innerHTML = html;
        } catch(e) {
            contenedor.innerHTML = `<p style="color:red;text-align:center;">Error de conexión. Intenta de nuevo.</p>`;
        }
        return; // El chofer no sigue el flujo normal del taller

    } else {
        // Carpintero de sofás: tiene tab extra de STOCK
        const esCarpinteroSofa = esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES';
        tabsHeader.innerHTML = `
            <button onclick="filtroTaller='Pendientes'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Pendientes' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-clock"></i> MIS TAREAS
            </button>
            ${esCarpinteroSofa ? `
            <button onclick="filtroTaller='StockCarpintero'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'StockCarpintero' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-boxes-stacked"></i> STOCK
            </button>` : ''}
            <button onclick="filtroTaller='Terminado'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Terminado' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-circle-check"></i> ${esCarpinteroSofa ? 'ENTREGADOS' : 'TRABAJOS TERMINADOS'}
            </button>`;
    }
    // Carpintero de sofás: tab de stock propio
    if (esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES' && filtroTaller === 'StockCarpintero') {
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando stock...</p>';
        await cargarVistaStockCarpinteroSofa(contenedor);
        return;
    }
    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Sincronizando...</p>';

    try {
        // Traer todos los tickets (el backend filtra por area si es operario vía query param)
        const url = esOperario
            ? `${API_URL}/api/taller/tickets?area=${encodeURIComponent(usuarioActivo.area_asignada)}`
            : `${API_URL}/api/taller/tickets`;

        const res     = await apiFetch(url);
        const tickets = await res.json();

        if (!Array.isArray(tickets)) {
            contenedor.innerHTML = `<p style="color:red; text-align:center;">Error: ${tickets.error || 'Respuesta inválida del servidor'}</p>`;
            return;
        }

        let ticketsFiltrados = tickets;

        if (esAdmin) {
            // Admin ve tickets no terminados, no listos para recojo ni recogidos.
            ticketsFiltrados = tickets.filter(t => 
                (t.es_logistica && t.estado !== 'Distribuido') ||
                (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
            );
        } else if (esOperario) {
            // Operario: solo los asignados a él
            ticketsFiltrados = tickets.filter(t => Number(t.trabajador) === Number(usuarioActivo.id));
            // Luego aplica filtro de tab
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado !== 'Distribuido') ||
                    (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
                );
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado === 'Distribuido') ||
                    (!t.es_logistica && (t.estado === 'Terminado' || t.estado === 'Listo para Recojo' || t.estado === 'Recogido'))
                );
            }
        } else {
            // Jefe de taller: ve todos, con tabs
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado !== 'Distribuido') ||
                    (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
                );
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado === 'Distribuido') ||
                    (!t.es_logistica && (t.estado === 'Terminado' || t.estado === 'Listo para Recojo' || t.estado === 'Recogido'))
                );
            }
        }

        if (ticketsFiltrados.length === 0) {
            const msg = esAdmin
                ? '✅ Todos los tickets están asignados. No hay tareas pendientes de asignar.'
                : `No hay trabajos en esta pestaña.`;
            contenedor.innerHTML = `<p style="color:gray; font-size:13px; text-align:center; padding:30px;">${msg}</p>`;
            return;
        }

        // Agrupar por área
        const areas = {};
        ticketsFiltrados.forEach(t => {
            const key = t.area || 'Sin Área';
            if (!areas[key]) areas[key] = [];
            areas[key].push(t);
        });

        contenedor.style.display = 'block';
        let html = '';

        for (const [areaId, listaTickets] of Object.entries(areas)) {
            const cfg = CONFIG_AREAS[areaId] || { icono: '<i class="fa-solid fa-gears"></i>', nombre: areaId };

            // Color de cabecera del área según si todos están terminados
            const todosTerminados = listaTickets.every(t => t.estado === 'Terminado');
            const algunoEnProceso = listaTickets.some(t => t.estado === 'En Proceso');
            let colorCab = todosTerminados ? '#22c55e' : (algunoEnProceso ? '#3b82f6' : '#cbd5e1');

            html += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:25px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; color:#0f172a; font-size:15px; border-bottom:3px solid ${colorCab}; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:${colorCab === '#22c55e' ? '#166534' : '#0f172a'};">${cfg.icono} ${cfg.nombre}</span>
                    <span style="background:#1e293b; color:white; padding:3px 10px; border-radius:20px; font-size:11px;">${listaTickets.length}</span>
                </h3>`;

            // ── AGRUPAR POR CONTRATO solo para Corte y Control de Telas ──
            // Las filas que vienen de logistica_externa (t.es_logistica) se
            // agrupan por venta_id en una tarjeta de contrato; los tickets
            // internos reales de esta área (si existen) siguen pintándose
            // igual que siempre, en el grid de tarjetas normal.
            const esAreaTelasVista = (areaId === 'CORTE_Y_CONTROL_TELAS' || areaId === 'TELAS');
            const ticketsInternos  = esAreaTelasVista ? listaTickets.filter(t => !t.es_logistica) : listaTickets;
            const ticketsLogistica = esAreaTelasVista ? listaTickets.filter(t =>  t.es_logistica) : [];

            if (ticketsInternos.length > 0) {
                html += `<div class="tickets-area-grid">`;
                ticketsInternos.forEach(t => { html += renderTicketCardHTML(t, esAdmin); });
                html += `</div>`;
            }

            if (ticketsLogistica.length > 0) {
                html += renderContratosTelaHTML(ticketsLogistica, esAdmin);
            }

            html += `</div>`;
        }

        contenedor.innerHTML = html;

        // Cargar sugerencias para estructuras — buscar por modelo base + medidas
        ticketsFiltrados.forEach(t => {
    if (t.area === 'ESTRUCTURAS_MUEBLES' && t.estado !== 'Terminado'
        && esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES') {
 
        let l = 0, p = 0, h = 0;
        const spec = t.especificaciones || '';
 
        // Formatos soportados (en orden de especificidad):
        // 1. L120 x P90 x H45          (formato original)
        // 2. L120 x P90 x Alto 45      (variante con "Alto")
        // 3. Ancho: 120, Prof: 90       (con labels y coma)
        // 4. Ancho 120 / Fondo 90       (con slash, sin ":")
        // 5. 120cm x 90cm x 45cm        (con unidad cm)
        // 6. 120 x 90 x 45              (solo números con x)
        // 7. 120 x 90                   (sin alto)
 
        const regexes = [
            // L120 x P90 x H45  /  L120 x P90 x Alto 45
            /L\s*(\d+(?:\.\d+)?)\s*[xX×]\s*P\s*(\d+(?:\.\d+)?)(?:\s*[xX×]\s*(?:H|Alto)\s*(\d+(?:\.\d+)?))?/i,
            // Ancho: 120[,]? Prof/Fondo: 90[,]? (Alto: 45)?
            /Ancho[:\s]+(\d+(?:\.\d+)?)[,\s]+(?:Prof|Profundidad|Fondo)[.:\s]+(\d+(?:\.\d+)?)(?:[,\s]+(?:Alto|H)[.:\s]+(\d+(?:\.\d+)?))?/i,
            // Ancho 120 / Fondo 90
            /Ancho\s+(\d+(?:\.\d+)?)\s*[/]\s*(?:Fondo|Prof|Profundidad)\s+(\d+(?:\.\d+)?)/i,
            // 120cm x 90cm x 45cm  (con unidad)
            /(\d+(?:\.\d+)?)\s*cm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*cm(?:\s*[xX×]\s*(\d+(?:\.\d+)?)\s*cm)?/i,
            // 120 x 90 x 45  o  120 x 90  (solo números)
            /\b(\d{2,3}(?:\.\d+)?)\s*[xX×]\s*(\d{2,3}(?:\.\d+)?)(?:\s*[xX×]\s*(\d{2,3}(?:\.\d+)?))?/,
        ];
 
        for (const rx of regexes) {
            const m = spec.match(rx);
            if (m) {
                l = parseFloat(m[1]) || 0;
                p = parseFloat(m[2]) || 0;
                h = parseFloat(m[3]) || 0;
                break;
            }
        }
 
        const modeloBaseDetectado = _extraerModeloBase(t.producto || '');
 
        // Siempre intentar — el backend devolverá vacío si no hay nada
        // (el fallback a solo_estandar ocurre dentro de cargarSugerenciasEstructura)
        cargarSugerenciasEstructura(l, p, h, t.id, `sug-est-${t.id}`, modeloBaseDetectado);
    }
});

        // Event delegation para fichas técnicas
        contenedor.querySelectorAll('.btn-ver-ficha').forEach(btn => {
            btn.addEventListener('click', () => {
                verFichaTaller(
                    btn.dataset.producto,
                    decodeURIComponent(escape(atob(btn.dataset.specs))),
                    btn.dataset.foto,
                    btn.dataset.area
                );
            });
        });

    } catch (err) {
        console.error('Error cargando taller:', err);
        contenedor.innerHTML = '<p style="color:red; text-align:center;">❌ Error al conectar con el servidor.</p>';
    }
}

/* ================================================================= */
/* --- TARJETA DE TICKET INDIVIDUAL (extraída de cargarTicketsTaller,
       sin cambios de HTML/lógica — solo convertida en función para
       poder reusarla dentro de las tarjetas de contrato de Telas) --- */
/* ================================================================= */
function renderTicketCardHTML(t, esAdmin) {
    const isBloqueado       = t.estado === 'Bloqueado';
    const isTerminado       = t.estado === 'Terminado';
    const isEnProceso       = t.estado === 'En Proceso';
    const isListoParaRecojo = t.estado === 'Listo para Recojo';
    const isRecogido        = t.estado === 'Recogido';

    const specsB64   = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
    let colorBorde   = isBloqueado       ? '#94a3b8'
                     : isTerminado        ? '#22c55e'
                     : isEnProceso        ? '#3b82f6'
                     : isListoParaRecojo  ? '#dc2626'
                     : isRecogido         ? '#22c55e'
                     : '#f59e0b';
    let bgCard       = isBloqueado       ? '#f1f5f9'
                     : isListoParaRecojo  ? '#fff5f5'
                     : '#ffffff';
    let opacidad     = isBloqueado ? '0.55' : '1';

    let badgeBg  = isBloqueado       ? '#e2e8f0'
                 : isTerminado        ? '#dcfce7'
                 : isEnProceso        ? '#dbeafe'
                 : isListoParaRecojo  ? '#fee2e2'
                 : isRecogido         ? '#dcfce7'
                 : '#fef3c7';
    let badgeCol = isBloqueado       ? '#64748b'
                 : isTerminado        ? '#166534'
                 : isEnProceso        ? '#1e40af'
                 : isListoParaRecojo  ? '#991b1b'
                 : isRecogido         ? '#166534'
                 : '#b45309';
    let badgeTxt = isBloqueado       ? '🔒 BLOQUEADO'
                 : isTerminado        ? '✅ TERMINADO'
                 : isEnProceso        ? '🔵 EN PROCESO'
                 : isListoParaRecojo  ? '🔴 LISTO PARA RECOJO'
                 : isRecogido         ? '✅ RECOGIDO'
                 : '🟡 PENDIENTE';

    if (t.es_logistica) {
        const b = _badgeLogisticaTela(t.estado);
        badgeBg = b.bg; badgeCol = b.col; badgeTxt = b.txt;
    }

    // Asignado a quién
    const asignadoA = t.trabajador_nombre && t.trabajador_nombre !== 'Sin asignar'
        ? `<p style="font-size:10px; color:#64748b; margin:4px 0 12px 0;"><i class="fa-solid fa-user"></i> ${t.trabajador_nombre}</p>`
        : `<p style="font-size:10px; color:#f59e0b; margin:4px 0 12px 0;"><i class="fa-solid fa-user-clock"></i> Sin asignar</p>`;

    // Escapar producto para evitar romper HTML con comillas/apóstrofes
    const productoSafe = (t.producto || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const fotoBtoa    = (t.foto||'').replace(/"/g,'&quot;');

    // Foto del mueble — mostrar siempre la foto del modelo base (la primera)
    const _fotosCard = t.foto ? t.foto.split('|').filter(f => f.trim()) : [];
    const fotoCardSrc = _fotosCard.length > 0 && !_fotosCard[0].includes('sin_foto') ? _fotosCard[0] : null;
    const fotoCardHTML = fotoCardSrc
        ? `<div style="margin:-15px -15px 12px -15px; border-radius:8px 8px 0 0; overflow:hidden; height:160px; background:#f1f5f9;">
               <img src="${fotoCardSrc}" alt="${productoSafe}"
                   style="width:100%; height:160px; object-fit:cover; display:block; cursor:pointer;"
                   onclick="ampliarImagen('${fotoCardSrc}')"
                   onerror="this.parentElement.style.display='none'">
           </div>`
        : '';

    return `
    <div style="background:${bgCard}; border-left:5px solid ${colorBorde}; border-radius:8px; padding:15px; opacity:${opacidad}; box-shadow:0 1px 3px rgba(0,0,0,0.08); transition:0.2s; overflow:hidden;">
        ${fotoCardHTML}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:10px; font-weight:900; padding:4px 8px; border-radius:4px; background:${badgeBg}; color:${badgeCol};">${badgeTxt}</span>
            <span style="font-size:10px; font-weight:bold; color:#94a3b8;">#${t.id}</span>
        </div>
        <h4 style="margin:0 0 2px 0; font-size:13px; color:${isBloqueado ? '#94a3b8' : '#0f172a'}; font-weight:800;">${productoSafe}</h4>
        ${asignadoA}
        <button class="btn-ver-ficha"
            data-producto="${productoSafe}"
            data-specs="${specsB64}"
            data-foto="${fotoBtoa}"
            data-ticket-id="${t.id}" data-area="${t.area}"
            style="width:100%; background:#e0f2fe; color:#0369a1; border:none; padding:7px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; margin-bottom:8px;">
            <i class="fa-solid fa-eye"></i> Ver Ficha Técnica Completa
        </button>
        ${renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin)}
        <div id="sug-est-${t.id}"></div>
    </div>`;
}

/* Badge de estado para una línea de logística de tela (incluye 'En espera',
   que antes no se pintaba en ningún lado porque ni siquiera llegaba a esta
   bandeja — ver el fix en obtener_tickets_taller, backend). */
function _badgeLogisticaTela(estado) {
    if (estado === 'En espera')   return { bg:'#fef3c7', col:'#92400e', txt:'🟡 PAGADO — ESPERANDO OPERARIO' };
    if (estado === 'En Recojo')   return { bg:'#fef9c3', col:'#854d0e', txt:'🟡 EN RECOJO' };
    if (estado === 'Recogido')    return { bg:'#dcfce7', col:'#166534', txt:'✅ RECOGIDO (POR DISTRIBUIR)' };
    if (estado === 'Distribuido') return { bg:'#dcfce7', col:'#166534', txt:'✅ DISTRIBUIDO' };
    return { bg:'#fef3c7', col:'#92400e', txt: estado || '—' };
}

/* ================================================================= */
/* --- TARJETAS DE CONTRATO (Corte y Control de Telas)             ---
   Agrupa las líneas de logistica_externa (t.es_logistica) por
   venta_id: un header por contrato (código, cliente, entrega,
   tapicero/cojinero destino) + total consolidado + una fila por
   línea con su propio botón de acción (mismo renderBotonTicket de
   siempre — no se toca el flujo de asignar/pagar/distribuir). */
/* ================================================================= */
function renderContratosTelaHTML(ticketsLogistica, esAdmin) {
    // Agrupar por venta_id (con fallback a item_id por compatibilidad
    // con cachés viejos que no tengan el campo nuevo todavía)
    const contratos = {};
    ticketsLogistica.forEach(t => {
        const key = t.venta_id ?? t.item_id;
        if (!contratos[key]) contratos[key] = [];
        contratos[key].push(t);
    });

    let out = `<div style="display:flex; flex-direction:column; gap:14px; margin-top:${Object.keys(contratos).length ? '4px' : '0'};">`;

    for (const lineas of Object.values(contratos)) {
        const cab = lineas[0];
        const codigo   = cab.codigo_venta || '—';
        const cliente  = cab.cliente || '';
        const entrega  = cab.fecha_entrega ? `Entrega: <b>${cab.fecha_entrega}</b>` : '';
        const tapicero = (cab.tapicero_destino && cab.tapicero_destino !== 'Sin asignar')
            ? `<span title="Tapicero/Cojinero destino"><i class="fa-solid fa-arrow-right"></i> ${cab.tapicero_destino}</span>` : '';
        const cojinero = (cab.cojinero_destino && cab.cojinero_destino !== 'Sin asignar')
            ? `<span title="Cojinero destino"><i class="fa-solid fa-arrow-right"></i> ${cab.cojinero_destino}</span>` : '';

        // Total consolidado: solo se suma entre líneas con la MISMA unidad
        // (no se puede sumar 18 mts + 2 cojines en un solo número honesto).
        const totalesPorUnidad = {};
        lineas.forEach(l => {
            const u = (l.unidad || '').trim().toLowerCase() || 'unid.';
            totalesPorUnidad[u] = (totalesPorUnidad[u] || 0) + (Number(l.cantidad) || 0);
        });
        const totalHTML = Object.entries(totalesPorUnidad)
            .map(([u, cant]) => `<b>${cant % 1 === 0 ? cant : cant.toFixed(2)} ${u}</b>`)
            .join(' &nbsp;+&nbsp; ');

        // Botón de lote: solo tiene sentido para quien distribuye (no admin),
        // y solo si hay al menos una línea ya 'Recogido' esperando entrega.
        const idsRecogidos = lineas.filter(l => l.estado === 'Recogido').map(l => l.id);
        const botonLoteHTML = (!esAdmin && idsRecogidos.length > 1)
            ? `<button onclick='confirmarDistribucionLote(${JSON.stringify(idsRecogidos)})'
                   style="width:100%; background:#16a34a; color:white; border:none; padding:9px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; margin-top:10px;">
                   <i class="fa-solid fa-people-carry-box"></i> Distribuir las ${idsRecogidos.length} líneas ya recogidas de este contrato
               </button>`
            : '';

        out += `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:6px; border-bottom:1px dashed #e2e8f0; padding-bottom:10px; margin-bottom:10px;">
                <div>
                    <div style="font-size:13px; font-weight:900; color:#0f172a;"><i class="fa-solid fa-file-contract"></i> ${codigo} <span style="font-weight:600; color:#64748b;">— ${cliente}</span></div>
                    <div style="font-size:10px; color:#64748b; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${entrega} ${tapicero} ${cojinero}
                    </div>
                </div>
                ${totalHTML ? `<div style="font-size:11px; color:#0f172a; background:#f1f5f9; padding:6px 10px; border-radius:8px; white-space:nowrap;">Total: ${totalHTML}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${lineas.map(l => renderLineaTelaHTML(l, esAdmin)).join('')}
            </div>
            ${botonLoteHTML}
        </div>`;
    }

    out += `</div>`;
    return out;
}

/* Fila compacta de una línea de tela dentro de una tarjeta de contrato. */
function renderLineaTelaHTML(t, esAdmin) {
    const b = _badgeLogisticaTela(t.estado);
    const nombreInsumo = (t.producto || '').replace(/^TELA EXTERNA:\s*/, '');
    const insumoSafe = nombreInsumo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const cantidadTxt = (Number(t.cantidad) || 0) % 1 === 0 ? Number(t.cantidad) : Number(t.cantidad).toFixed(2);

    return `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:800; color:#0f172a;">${insumoSafe}</span>
            <span style="font-size:9px; font-weight:900; padding:3px 7px; border-radius:4px; background:${b.bg}; color:${b.col}; white-space:nowrap;">${b.txt}</span>
        </div>
        <div style="font-size:10px; color:#64748b; margin-bottom:8px;">
            SKU: ${t.sku || 'N/A'} &nbsp;·&nbsp; Cant.: <b>${cantidadTxt} ${t.unidad || ''}</b> &nbsp;·&nbsp; Proveedor: ${t.proveedor || 'Sin proveedor'}
        </div>
        ${renderBotonTicket(t, false, false, false, esAdmin)}
    </div>`;
}

/* Distribuye en lote todas las líneas de un contrato que ya estén en
   estado 'Recogido' — no toca las que aún no llegaron. Reusa el mismo
   endpoint que el botón individual, una llamada por línea. */
async function confirmarDistribucionLote(ids) {
    const conf = await Swal.fire({
        title: `¿Distribuir ${ids.length} líneas de este contrato?`,
        text: 'Esto desbloqueará los tickets de tapicería/cojines que dependan de estas telas.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, distribuir todas'
    });
    if (!conf.isConfirmed) return;

    Swal.fire({ title: 'Distribuyendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let okCount = 0, desbloqueadosTotal = 0, errores = [];
    for (const id of ids) {
        try {
            const res = await apiFetch(`${API_URL}/api/logistica/${id}/confirmar-distribucion`, { method: 'POST' });
            const d = await res.json();
            if (d.exito) { okCount++; desbloqueadosTotal += (d.desbloqueados || 0); }
            else { errores.push(`#${id}: ${d.error || 'error'}`); }
        } catch (e) {
            errores.push(`#${id}: error de conexión`);
        }
    }

    if (errores.length === 0) {
        Swal.fire('¡Distribuidas!', `${okCount} línea(s) entregadas. ${desbloqueadosTotal} ticket(s) desbloqueado(s).`, 'success');
    } else {
        Swal.fire('Parcialmente completado', `${okCount} OK. Fallaron: ${errores.join(', ')}`, 'warning');
    }
    cargarTicketsTaller();
}

