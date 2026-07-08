// Taller - ordenes, notas, despacho y entregados
/* --- 1. STATS DEL TALLER (puebla el badge del header) --- */
async function cargarStatsTaller() {
    const badge = document.getElementById('stats-taller');
    if (!badge) return;
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/stats`);
        const data = await res.json();
        if (data.error) { badge.innerText = 'Error de stats'; return; }

        const activos   = data.activos   || 0;
        const enProceso = data.en_proceso || 0;
        const pendientes = data.pendientes || 0;
        const listas    = data.ventas_listas || 0;

        badge.innerHTML = `
            <span style="color:#f59e0b; margin-right:8px;">
                <i class="fa-solid fa-clock"></i> ${pendientes} pendientes
            </span>
            <span style="color:#3b82f6; margin-right:8px;">
                <i class="fa-solid fa-gear fa-spin"></i> ${enProceso} en proceso
            </span>
            ${listas > 0 ? `<span style="color:#22c55e;">
                <i class="fa-solid fa-circle-check"></i> ${listas} listas
            </span>` : ''}
        `;
    } catch (e) {
        if (badge) badge.innerText = 'Sin conexión';
    }
}

/* --- 2. VISTA DE ÓRDENES POR PEDIDO (Admin) --- */
async function cargarOrdenesProduccion(contenedor) {
    try {
        const res    = await apiFetch(`${API_URL}/api/taller/ordenes`);
        const ordenes = await res.json();

        // Separar activas (todo excepto Entregado/Cancelado) de entregadas
        const activas     = (ordenes || []).filter(o => o.estado !== 'Entregado' && o.estado !== 'Cancelado' && o.progreso < 100);
        const entregadas  = (ordenes || []).filter(o => o.estado === 'Entregado');

        if (!Array.isArray(ordenes) || activas.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin órdenes de producción activas</p>
                    <p style="font-size:13px;">Todas las ventas están entregadas o no requieren producción.</p>
                </div>`;
            return;
        }

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
            'Pendiente':    { bg:'#fef3c7', color:'#b45309', icon:'🟡' },
            'Bloqueado':    { bg:'#e2e8f0', color:'#64748b', icon:'🔒' },
            'En Proceso':   { bg:'#dbeafe', color:'#1e40af', icon:'🔵' },
            'Terminado':    { bg:'#dcfce7', color:'#166534', icon:'✅' },
            // Logística de tela externa
            'En Recojo':    { bg:'#fef9c3', color:'#854d0e', icon:'🚛' },
            'Recogido':     { bg:'#e0f2fe', color:'#0369a1', icon:'📦' },
            'Distribuido':  { bg:'#dcfce7', color:'#166534', icon:'✅' },
        };

        // ── Función helper para renderizar una tarjeta de orden ─────────────
        const renderOrdenCard = (orden) => {
            const progresoColor = orden.progreso >= 100 ? '#22c55e' : (orden.progreso >= 50 ? '#3b82f6' : '#f59e0b');
            const estadoBadge   = {
                'Listo':         { bg:'#dcfce7', color:'#166534' },
                'En Producción': { bg:'#dbeafe', color:'#1e40af' },
                'Pendiente':     { bg:'#fef3c7', color:'#b45309' },
                'Entregado':     { bg:'#d1fae5', color:'#065f46' },
            }[orden.estado] || { bg:'#f1f5f9', color:'#475569' };

            // Construir filas de items con sus tickets
            let itemsHTML = '';
            (orden.items || []).forEach(item => {
                const ticketsHTML = (item.tickets || [])
                    .filter(t => t.area !== 'DESPACHO_CENTRAL')
                    .map(t => {
                        const b = ESTADO_BADGE[t.estado] || { bg:'#f1f5f9', color:'#64748b', icon:'?' };
                        const nombre = AREA_NOMBRES[t.area] || t.area.replace(/_/g,' ');
                        // Para logística de tela: mostrar operario asignado y tapicero destino
                        if (t.es_logistica) {
                            const operarioInfo = (t.trabajador && t.trabajador !== 'Sin asignar')
                                ? '<span style="opacity:0.75">· ' + t.trabajador + '</span>'
                                : '<span style="opacity:0.6;color:#dc2626;"> · Sin operario</span>';
                            const tapiceroInfo = (t.tapicero_destino && t.tapicero_destino !== 'Sin asignar')
                                ? '<span style="opacity:0.75"> → ' + t.tapicero_destino + '</span>'
                                : '<span style="opacity:0.6;color:#dc2626;"> → Sin tapicero</span>';
                            const insumoLabel = t.insumo_nombre ? ' · ' + t.insumo_nombre : '';
                            return '<span title="Tela externa' + (t.insumo_nombre || '') + '" style="font-size:10px; background:' + b.bg + '; color:' + b.color + '; padding:3px 8px; border-radius:20px; font-weight:800; white-space:nowrap; display:inline-flex; align-items:center; gap:3px;">'
                                + b.icon + ' Tela ext.' + insumoLabel
                                + ' ' + operarioInfo + tapiceroInfo
                                + '</span>';
                        }
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

            return `
            <div style="background:white; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Cabecera de la orden -->
                <div style="background:#f8fafc; padding:14px 18px; border-bottom:1px solid #e2e8f0; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                            <span style="font-size:13px; font-weight:900; color:#0f172a;">${orden.codigo}</span>
                            <span style="font-size:11px; background:${estadoBadge.bg}; color:${estadoBadge.color}; padding:2px 8px; border-radius:20px; font-weight:800;">${orden.estado}</span>
                        </div>
                        <div style="font-size:12px; color:#475569;">
                            <b>${orden.cliente}</b> &nbsp;·&nbsp;
                            <i class="fa-solid fa-calendar-days" style="color:#94a3b8;"></i> Entrega: <b>${orden.fecha_entrega}</b>
                            ${orden.vendedor ? `&nbsp;·&nbsp; <i class="fa-solid fa-user" style="color:#94a3b8;"></i> ${orden.vendedor}` : ''}
                            ${orden.sede ? `&nbsp;·&nbsp; ${orden.sede}` : ''}
                        </div>
                    </div>
                    <!-- Barra de progreso -->
                    <div style="min-width:160px; flex-shrink:0;">
                        <div style="font-size:10px; font-weight:900; color:${progresoColor}; margin-bottom:4px; text-align:right;">
                            ${orden.progreso}% completado
                            (${orden.tickets_term}/${orden.tickets_total} áreas)
                        </div>
                        <div style="background:#e2e8f0; border-radius:6px; height:8px; overflow:hidden;">
                            <div style="width:${orden.progreso}%; height:100%; background:${progresoColor}; border-radius:6px; transition:0.5s;"></div>
                        </div>
                    </div>
                    <!-- Ícono para ver/descargar el PDF del pedido (fotos + descripciones) -->
                    <button onclick="abrirDetallePedido('${orden.codigo}')"
                            title="Ver / Descargar PDF del pedido"
                            style="background:#0f172a; color:#d4af37; border:none; width:34px; height:34px; border-radius:8px; cursor:pointer; font-size:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                </div>
                <!-- Ítems de la orden -->
                <div style="padding:12px 18px;">
                    ${itemsHTML || '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:10px;">Sin ítems de producción</p>'}
                </div>
            </div>`;
        };

        // ── Sección ACTIVAS ─────────────────────────────────────────────────
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; font-size:15px; font-weight:900; color:#0f172a;">
                        <i class="fa-solid fa-list-check" style="color:#558fc5;"></i>
                        ${activas.length} orden${activas.length!==1?'es':''} activa${activas.length!==1?'s':''}
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Ordenadas por fecha de entrega más próxima · progreso por área</p>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">`;

        activas.forEach(orden => { html += renderOrdenCard(orden); });
        html += '</div>';

        // ── Sección ENTREGADAS (colapsable) ─────────────────────────────────
        if (entregadas.length > 0) {
            html += `
            <div style="margin-top:32px;">
                <button onclick="
                    const sec=document.getElementById('sec-entregadas-ordenes');
                    const ico=document.getElementById('ico-entregadas-ordenes');
                    const visible=sec.style.display!=='none';
                    sec.style.display=visible?'none':'flex';
                    ico.className=visible?'fa-solid fa-chevron-right':'fa-solid fa-chevron-down';
                " style="width:100%;display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px 16px;cursor:pointer;font-size:13px;font-weight:800;color:#166534;">
                    <i id="ico-entregadas-ordenes" class="fa-solid fa-chevron-right"></i>
                    <i class="fa-solid fa-circle-check" style="color:#22c55e;"></i>
                    ${entregadas.length} pedido${entregadas.length!==1?'s':''} entregado${entregadas.length!==1?'s':''} reciente${entregadas.length!==1?'s':''}
                    <span style="margin-left:auto;font-size:10px;font-weight:500;color:#4ade80;">clic para ver</span>
                </button>
                <div id="sec-entregadas-ordenes" style="display:none;flex-direction:column;gap:12px;margin-top:12px;">
                    ${entregadas.map(o => renderOrdenCard(o)).join('')}
                </div>
            </div>`;
        }

        contenedor.innerHTML = html;
        contenedor.style.display = 'block';

    } catch (e) {
        console.error('Error cargando órdenes:', e);
        contenedor.innerHTML = '<p style="color:red; text-align:center; padding:20px;">❌ Error al cargar las órdenes de producción.</p>';
    }
}

/* --- 3. AGREGAR NOTA / INCIDENCIA A UN TICKET --- */
async function abrirNotaOrden(ticketId) {
    if (!ticketId) {
        return Swal.fire('Sin ticket', 'Este ítem no tiene ticket de producción activo.', 'info');
    }

    const { value: nota } = await Swal.fire({
        title: '📝 Agregar nota / incidencia',
        html: `
            <div style="text-align:left;">
                <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px; color:#78350f;">
                    La nota quedará registrada con fecha, hora y tu nombre en el historial del ticket.
                </div>
                <textarea id="swal-nota-input" class="swal2-input" 
                    style="width:100%; height:90px; resize:vertical; font-size:13px; margin:0; padding:10px; box-sizing:border-box;"
                    placeholder="Ej: Material llegó con defecto, se coordinó cambio. / El maestro tuvo que ausentarse..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#25D366',
        cancelButtonText: 'Cancelar',
        confirmButtonText: '<i class="fa-solid fa-save"></i> Guardar nota',
        preConfirm: () => {
            const val = document.getElementById('swal-nota-input').value.trim();
            if (!val) { Swal.showValidationMessage('Escribe algo antes de guardar.'); return false; }
            return val;
        }
    });

    if (!nota) return;

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/taller/ticket/${ticketId}/nota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nota,
                usuario_nombre: usuarioActivo ? usuarioActivo.nombre : 'Usuario'
            })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Nota guardada!', 'La incidencia quedó registrada en el ticket.', 'success');
        } else {
            Swal.fire('Error', data.error || 'No se pudo guardar la nota.', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* ================================================================= */
/* --- VISTA COLA DE DESPACHO GENERAL (para Choferes)            --- */
/* ================================================================= */

async function cargarColaDespacho(contenedor) {
    try {
        const res  = await apiFetch(`${API_URL}/api/despacho/cola-general`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin despachos pendientes</p>
                    <p style="font-size:13px;">Cuando un pedido esté listo para entregar, aparecerá aquí.</p>
                </div>`;
            return;
        }

        let html = `
            <div style="margin-bottom:16px; padding:14px 18px; background:linear-gradient(135deg,#fff7ed,#ffedd5); border-radius:12px; border:2px solid #fb923c;">
                <h3 style="margin:0 0 4px; color:#9a3412; font-size:15px; font-weight:900;">
                    <i class="fa-solid fa-boxes-packing"></i> ${data.length} pedido${data.length>1?'s':''} listo${data.length>1?'s':''} para despachar
                </h3>
                <p style="margin:0; font-size:12px; color:#64748b;">Estos pedidos están terminados y esperando un chofer para la entrega final.</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">`;

        data.forEach(d => {
            html += `
            <div style="background:white; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.06); overflow:hidden;">
                <div style="padding:14px 18px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <img src="${d.foto_url}" onerror="this.src='imagenes/sin_foto.jpg'"
                             style="width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:1px;">PEDIDO #${d.codigo_venta}</span>
                            <h4 style="margin:2px 0; font-size:14px; font-weight:900; color:#0f172a;">${d.producto}</h4>
                            <p style="margin:0; font-size:12px; color:#475569;">
                                <i class="fa-solid fa-user"></i> <b>Cliente:</b> ${d.cliente}<br>
                                <i class="fa-solid fa-location-dot"></i> <b>Dirección:</b> ${d.direccion || 'No especificada'}<br>
                                <i class="fa-solid fa-calendar-check"></i> <b>Entrega:</b> ${d.fecha_entrega}
                            </p>
                        </div>
                    </div>
                    <button onclick="autoAsignarDespacho(${d.ticket_id}, '${d.codigo_venta}')"
                        style="background:#f97316; color:white; border:none; padding:10px 18px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:7px;">
                        <i class="fa-solid fa-truck-fast"></i> Asignarme y Despachar
                    </button>
                </div>
            </div>`;
        });
        html += `</div>`;
        contenedor.innerHTML = html;
    } catch(e) {
        console.error('Error cargando cola de despacho:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar. Intenta de nuevo.</p>`;
    }
}

async function autoAsignarDespacho(ticketId, codigoVenta) {
    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Asignarte esta entrega?',
        html: `<p style="font-size:14px;color:#374151;">Se te asignará el despacho del pedido <b>#${codigoVenta}</b> y se moverá a tu bandeja "Mis Entregas".</p>`,
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        confirmButtonText: 'Sí, asignarme',
        cancelButtonText: 'Cancelar',
    });
    if (!conf.isConfirmed) return;

    try {
        const res = await apiFetch(`${API_URL}/api/despacho/auto-asignar/${ticketId}`, { method: 'POST' });
        const data = await res.json();
        if (data.exito) {
            Swal.fire({ icon: 'success', title: '¡Entrega Asignada!', text: data.mensaje, timer: 2500, showConfirmButton: false });
            cargarTicketsTaller(); // Recargar la vista de taller para que el item desaparezca de la cola
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'No se pudo asignar la entrega.' });
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
    }
}

/* ================================================================= */
/* --- FICHA TÉCNICA DEL CHOFER — Toggle con carga lazy          --- */
/* ================================================================= */

const _fichaChoferCache = {};

async function toggleFichaChofer(ticketId, itemId) {
    const contenedor = document.getElementById(`ficha-chofer-${ticketId}`);
    const btn        = document.getElementById(`btn-ficha-${ticketId}`);
    if (!contenedor) return;

    // Toggle: si ya está visible, ocultar
    if (contenedor.style.display !== 'none') {
        contenedor.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando ficha...';
    btn.disabled  = true;

    // Usar caché si ya se cargó antes
    if (_fichaChoferCache[itemId]) {
        contenedor.innerHTML = _renderFichaChofer(_fichaChoferCache[itemId], ticketId);
        contenedor.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> OCULTAR FICHA';
        btn.disabled  = false;
        return;
    }

    try {
        const res  = await apiFetch(`${API_URL}/api/despacho/ficha-chofer/${itemId}`);
        const data = await res.json();

        if (!res.ok || data.error) {
            Swal.fire('Error', data.error || 'No se pudo cargar la ficha.', 'error');
            btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
            btn.disabled  = false;
            return;
        }

        _fichaChoferCache[itemId] = data;
        contenedor.innerHTML = _renderFichaChofer(data, ticketId);
        contenedor.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> OCULTAR FICHA';
    } catch(e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
        btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
    }
    btn.disabled = false;
}

function _renderFichaChofer(d, ticketId) {
    const moneda   = 'S/';
    const saldoCol = d.saldo > 0 ? '#dc2626' : '#16a34a';
    const saldoTxt = d.saldo > 0 ? `⚠️ Falta cobrar ${moneda} ${d.saldo.toFixed(2)}` : '✅ Pagado completo';

    // Fotos de evidencia por área
    const fotosHTML = d.evidencias && d.evidencias.length > 0
        ? `<div style="padding:14px 16px;border-top:1px solid #e2e8f0;">
               <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                   📷 Evidencias de producción (${d.evidencias.length} área${d.evidencias.length>1?'s':''})
               </div>
               <div style="display:flex;gap:12px;flex-wrap:wrap;">
                   ${d.evidencias.map(e => `
                   <div style="text-align:center;flex:0 0 auto;">
                       <div style="font-size:9px;font-weight:700;color:#475569;margin-bottom:4px;max-width:90px;line-height:1.3;">${e.area}</div>
                       <img src="${e.foto}"
                           style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:2px solid #22c55e;cursor:pointer;"
                           onclick="window.open('${e.foto}','_blank')"
                           onerror="this.parentElement.style.display='none'">
                       <div style="font-size:9px;color:#64748b;margin-top:3px;">${e.operario}</div>
                   </div>`).join('')}
               </div>
           </div>`
        : `<div style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
               Sin fotos de evidencia registradas aún.
           </div>`;

    return `
    <div style="border-top:1px solid #e2e8f0;">
        <!-- Datos del cliente -->
        <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                👤 Datos del cliente
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Cliente</span>
                    <span style="font-weight:700;color:#0f172a;">${d.cliente}</span>
                </div>
                ${d.telefono ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Teléfono</span>
                    <a href="tel:${d.telefono}" style="font-weight:700;color:#0369a1;text-decoration:none;">📞 ${d.telefono}</a>
                </div>` : ''}
                ${d.direccion ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;gap:16px;">
                    <span style="color:#64748b;flex-shrink:0;">Dirección</span>
                    <span style="font-weight:700;color:#0f172a;text-align:right;">${d.direccion}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Fecha entrega</span>
                    <span style="font-weight:700;color:#0f172a;">${d.fecha_entrega}</span>
                </div>
            </div>
        </div>

        <!-- Financiero -->
        <div style="padding:14px 16px;background:#fff;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                💰 Situación de pago
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Total del pedido</span>
                    <span style="font-weight:700;">${moneda} ${d.total.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Adelanto pagado</span>
                    <span style="font-weight:700;color:#16a34a;">${moneda} ${d.adelanto.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                    <span style="color:#64748b;font-weight:700;">Saldo a cobrar</span>
                    <span style="font-weight:900;font-size:15px;color:${saldoCol};">${moneda} ${d.saldo.toFixed(2)}</span>
                </div>
                <div style="background:${d.saldo>0?'#fef2f2':'#f0fdf4'};border:1px solid ${d.saldo>0?'#fca5a5':'#86efac'};border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;color:${saldoCol};text-align:center;margin-top:4px;">
                    ${saldoTxt}
                </div>
            </div>
        </div>

        <!-- Fotos de evidencia de producción -->
        ${fotosHTML}
    </div>`;
}

/* ================================================================= */
/* --- VISTA HISTORIAL DE ENTREGADOS                              --- */
/* ================================================================= */

async function cargarVistaEntregados(contenedor, choferId) {
    try {
        const url = choferId
            ? `${API_URL}/api/despacho/entregados?chofer_id=${choferId}`
            : `${API_URL}/api/despacho/entregados`;

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:#64748b;">
                    <div style="font-size:48px;margin-bottom:16px;">✅</div>
                    <p style="font-weight:700;font-size:15px;color:#374151;margin:0 0 8px;">Sin entregas registradas aún</p>
                    <p style="font-size:13px;margin:0;">Cuando confirmes una entrega aparecerá aquí.</p>
                </div>`;
            return;
        }

        let html = `
            <div style="margin-bottom:16px;padding:12px 16px;background:#f0fdf4;border-radius:10px;border:1px solid #86efac;display:flex;align-items:center;gap:10px;">
                <i class="fa-solid fa-circle-check" style="color:#15803d;font-size:18px;"></i>
                <div>
                    <div style="font-weight:800;color:#15803d;font-size:13px;">${data.length} entrega${data.length!==1?'s':''} completada${data.length!==1?'s':''}</div>
                    <div style="font-size:11px;color:#166534;">Historial de despachos confirmados</div>
                </div>
            </div>`;

        for (const e of data) {
            const saldoCobrado = e.saldo === 0
                ? `<span style="color:#15803d;font-weight:800;">✓ Pagado</span>`
                : `<span style="color:#dc2626;font-weight:800;">S/ ${e.saldo.toFixed(2)} pendiente</span>`;

            html += `
            <div style="background:#fff;border:2px solid #86efac;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <!-- Cabecera verde -->
                <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:12px 16px;border-bottom:1px solid #86efac;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div>
                        <div style="font-size:10px;font-weight:900;color:#166534;text-transform:uppercase;letter-spacing:1px;">Entregado</div>
                        <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">${e.producto}</div>
                        <div style="font-size:11px;color:#475569;margin-top:1px;">${e.codigo_venta} · ${e.cliente}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="background:#15803d;color:white;font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;margin-bottom:4px;">🎉 ENTREGADO</div>
                        <div style="font-size:10px;color:#64748b;">${e.fecha_entrega_real}</div>
                    </div>
                </div>
                <!-- Detalle -->
                <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 120px), 1fr));gap:8px;font-size:12px;">
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Chofer</div>
                        <div style="font-weight:700;color:#0f172a;">${e.chofer}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Sede</div>
                        <div style="font-weight:700;color:#0f172a;">${e.sede || '—'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Dirección</div>
                        <div style="font-weight:600;color:#374151;">${e.direccion || '—'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Saldo</div>
                        <div>${saldoCobrado}</div>
                    </div>
                </div>
                ${e.foto_evidencia ? `
                <div style="padding:0 16px 12px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">📷 Foto de entrega</div>
                    <img src="${e.foto_evidencia}" alt="Evidencia" style="width:100%;max-width:280px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;"
                        onclick="window.open('${e.foto_evidencia}','_blank')">
                </div>` : ''}
            </div>`;
        }

        contenedor.innerHTML = html;
    } catch(e) {
        console.error('Error cargando entregados:', e);
        contenedor.innerHTML = `<p style="color:red;text-align:center;padding:30px;">Error al cargar el historial. Intenta de nuevo.</p>`;
    }
}
/**
 * _syncFotoEvid — preview al seleccionar foto de evidencia en tickets del taller.
 * Muestra miniatura bajo los botones de selección.
 */
function _syncFotoEvid(inputEl, ticketId) {
    const file = inputEl?.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const previewDiv = document.getElementById(`foto-evid-preview-${ticketId}`);
    const imgEl      = document.getElementById(`foto-evid-img-${ticketId}`);
    if (!previewDiv || !imgEl) return;
    const reader = new FileReader();
    reader.onload = e => {
        imgEl.src = e.target.result;
        previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

/**
 * _syncDerivarFoto — sincroniza foto del material cortado al derivar al tapicero.
 */
function _syncDerivarFoto(inputOrigen) {
    const file = inputOrigen?.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const cam = document.getElementById('foto-derivar-cam');
    const gal = document.getElementById('foto-derivar');
    if (cam) cam.files = dt.files;
    if (gal) gal.files = dt.files;
    const previewDiv = document.getElementById('foto-derivar-preview');
    const imgEl      = document.getElementById('foto-derivar-img');
    if (!previewDiv || !imgEl || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        imgEl.src = e.target.result;
        previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
}
