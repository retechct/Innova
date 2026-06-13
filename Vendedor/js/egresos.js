// ═══════════════════════════════════════════════════════════════════════════
// EGRESOS Y PAGOS DE PRODUCCIÓN — Innova Möbili ERP  (solo Admin)
//
// SECCIÓN 1: Stock Estructuras  → lista todo lo subido por carpinteros,
//            permite marcar pagado/no-pagado y ELIMINAR registros
// SECCIÓN 2: Pagos semanales   → cierra semana de un carpintero y muestra
//            historial con filtro por nombre y fecha
// SECCIÓN 3: Logística externa → gastos a proveedores (telas, bases, etc.)
//            filtro por fechas y categoría
// ═══════════════════════════════════════════════════════════════════════════

// ── Estado interno ──────────────────────────────────────────────────────────
let _egTab = 'estructuras';          // pestaña activa
let _egEstructuras = [];             // cache de estructuras para filtros
let _egCarpinteros = [];             // lista de carpinteros conocidos

// ════════════════════════════════════════════════════════════════════════════
//  INIT — se llama desde changeView('egresos') en app.js
// ════════════════════════════════════════════════════════════════════════════
function initEgresos() {
    egresosTab('estructuras');
}

// ════════════════════════════════════════════════════════════════════════════
//  NAVEGACIÓN DE PESTAÑAS
// ════════════════════════════════════════════════════════════════════════════
function egresosTab(tab) {
    _egTab = tab;

    // resaltar pestaña activa
    ['estructuras','pagos-semanales','logistica'].forEach(t => {
        const btn = document.getElementById(`eg-tab-${t}`);
        if (btn) btn.style.background = (t === tab) ? 'var(--primary)' : '#94a3b8';
    });

    // mostrar/ocultar paneles
    ['estructuras','pagos-semanales','logistica'].forEach(t => {
        const panel = document.getElementById(`eg-panel-${t}`);
        if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    });

    // cargar datos según pestaña
    if (tab === 'estructuras')     cargarStockEstructuras();
    if (tab === 'pagos-semanales') cargarPagosSemanales();
    if (tab === 'logistica')       cargarLogistica();
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 1 — STOCK DE ESTRUCTURAS
// ════════════════════════════════════════════════════════════════════════════
async function cargarStockEstructuras() {
    const cont = document.getElementById('eg-tabla-estructuras');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras`);
        const data = await res.json();

        if (!res.ok) { cont.innerHTML = _egError(data.error); return; }
        _egEstructuras = data;

        // cargar carpinteros para el select de filtro
        try {
            const rc = await apiFetch(`${API_URL}/api/stock-estructuras/carpinteros`);
            _egCarpinteros = await rc.json();
            const sel = document.getElementById('eg-filtro-carpintero');
            if (sel) {
                sel.innerHTML = '<option value="">Todos los carpinteros</option>' +
                    _egCarpinteros.map(c => `<option value="${c}">${c}</option>`).join('');
            }
        } catch(_) {}

        _egRenderEstructuras();
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

function _egRenderEstructuras() {
    const cont = document.getElementById('eg-tabla-estructuras');
    const filtroEstado    = document.getElementById('eg-filtro-estado')?.value || '';
    const filtroCarpintero = document.getElementById('eg-filtro-carpintero')?.value || '';

    let data = [..._egEstructuras];
    if (filtroEstado === 'pagado')   data = data.filter(e => e.pagado);
    if (filtroEstado === 'pendiente') data = data.filter(e => !e.pagado);
    if (filtroCarpintero) data = data.filter(e =>
        (e.chofer_nombre || '').toLowerCase().includes(filtroCarpintero.toLowerCase()) ||
        (e.carpintero_nombre || '').toLowerCase().includes(filtroCarpintero.toLowerCase())
    );

    const totalPendiente = data.filter(e => !e.pagado).reduce((s,e) => s + e.precio, 0);
    const totalPagado    = data.filter(e =>  e.pagado).reduce((s,e) => s + e.precio, 0);

    if (data.length === 0) {
        cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin estructuras con ese filtro</div>';
        return;
    }

    cont.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
        <div style="${_egCardStyle('#dc2626')}">
            <div style="font-size:11px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Pendiente de pago</div>
            <div style="font-size:20px;font-weight:800;margin-top:4px;">S/ ${totalPendiente.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.6;">${data.filter(e=>!e.pagado).length} estructuras</div>
        </div>
        <div style="${_egCardStyle('#16a34a')}">
            <div style="font-size:11px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Ya pagado</div>
            <div style="font-size:20px;font-weight:800;margin-top:4px;">S/ ${totalPagado.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.6;">${data.filter(e=>e.pagado).length} estructuras</div>
        </div>
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="${_egTh()}">Fecha</th>
                <th style="${_egTh()}">Modelo</th>
                <th style="${_egTh()}">Carpintero</th>
                <th style="${_egTh()}">Tipo</th>
                <th style="${_egTh()}">Medidas</th>
                <th style="${_egTh('right')}">Precio</th>
                <th style="${_egTh('center')}">Estado</th>
                <th style="${_egTh('center')}">Foto</th>
                <th style="${_egTh('center')}">Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(e => _egFilaEstructura(e)).join('')}
        </tbody>
    </table>
    </div>`;
}

function _egFilaEstructura(e) {
    const carpintero = e.carpintero_nombre || e.chofer_nombre || '—';
    const medidas = e.medida_estandar
        ? 'Estándar'
        : `${e.ancho||'?'}×${e.profundidad||'?'}×${e.alto||'?'}`;
    const estadoBadge = e.pagado
        ? `<span style="background:#dcfce7;color:#166534;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;">✓ Pagado</span>`
        : `<span style="background:#fee2e2;color:#991b1b;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;">Pendiente</span>`;

    return `
    <tr style="border-bottom:1px solid #f1f5f9;" id="eg-row-${e.id}">
        <td style="padding:10px;color:#64748b;white-space:nowrap;">${e.fecha || '—'}</td>
        <td style="padding:10px;font-weight:600;color:#0f172a;">${e.nombre_modelo || '—'}<br>
            <span style="font-size:11px;color:#94a3b8;">${e.modelo_base || ''}</span>
        </td>
        <td style="padding:10px;color:#374151;">${carpintero}</td>
        <td style="padding:10px;color:#64748b;">${e.tipo || '—'}</td>
        <td style="padding:10px;color:#64748b;">${medidas}</td>
        <td style="padding:10px;text-align:right;font-weight:700;color:#0f172a;">S/ ${(e.precio||0).toFixed(2)}</td>
        <td style="padding:10px;text-align:center;">${estadoBadge}</td>
        <td style="padding:10px;text-align:center;">
            ${e.foto_url
                ? `<a href="${e.foto_url}" target="_blank" title="Ver foto" style="color:#3b82f6;font-size:18px;"><i class="fa-solid fa-image"></i></a>`
                : `<span style="color:#cbd5e1;">—</span>`}
        </td>
        <td style="padding:10px;text-align:center;white-space:nowrap;">
            <button onclick="egTogglePago(${e.id}, ${!e.pagado})"
                style="border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;
                       background:${e.pagado ? '#fef9c3' : '#dcfce7'};color:${e.pagado ? '#854d0e' : '#166534'};">
                ${e.pagado ? '✗ Desmarcar' : '✓ Marcar pagado'}
            </button>
            <button onclick="egEliminarEstructura(${e.id})"
                style="border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;
                       background:#fee2e2;color:#991b1b;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    </tr>`;
}

// Marcar / desmarcar pagado
async function egTogglePago(id, nuevoPagado) {
    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/pago`, {
            method: 'PATCH',
            body: JSON.stringify({ pagado: nuevoPagado })
        });
        const data = await res.json();
        if (!res.ok) { Swal.fire('Error', data.error || 'No se pudo actualizar', 'error'); return; }

        // actualizar cache local y re-renderizar
        const idx = _egEstructuras.findIndex(e => e.id === id);
        if (idx >= 0) _egEstructuras[idx].pagado = nuevoPagado;
        _egRenderEstructuras();
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// Eliminar estructura
async function egEliminarEstructura(id) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar este registro?',
        text: 'Se borrará permanentemente del stock. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { Swal.fire('Error', data.error || 'No se pudo eliminar', 'error'); return; }

        _egEstructuras = _egEstructuras.filter(e => e.id !== id);
        _egRenderEstructuras();
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 2 — PAGOS SEMANALES A CARPINTEROS
// ════════════════════════════════════════════════════════════════════════════
async function cargarPagosSemanales() {
    const cont = document.getElementById('eg-tabla-pagos');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const carpintero = document.getElementById('eg-ps-carpintero')?.value || '';
    const semana     = document.getElementById('eg-ps-semana')?.value || '';

    try {
        let url = `${API_URL}/api/stock-estructuras/historial-pagos`;
        const params = [];
        if (carpintero) params.push(`carpintero=${encodeURIComponent(carpintero)}`);
        if (semana)     params.push(`semana=${semana}`);
        if (params.length) url += '?' + params.join('&');

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!res.ok) { cont.innerHTML = _egError(data.error); return; }
        if (!data.length) {
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin pagos registrados</div>';
            return;
        }

        const totalGeneral = data.reduce((s, p) => s + p.monto_total, 0);

        cont.innerHTML = `
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="${_egTh()}">Fecha cierre</th>
                    <th style="${_egTh()}">Carpintero</th>
                    <th style="${_egTh()}">Semana</th>
                    <th style="${_egTh('center')}">Estructuras</th>
                    <th style="${_egTh('right')}">Monto</th>
                    <th style="${_egTh()}">Registrado por</th>
                    <th style="${_egTh()}">Notas</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(p => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;color:#64748b;white-space:nowrap;">${p.fecha_pago}</td>
                    <td style="padding:10px;font-weight:600;color:#0f172a;">${p.carpintero}</td>
                    <td style="padding:10px;color:#374151;white-space:nowrap;">${p.semana_inicio} → ${p.semana_fin}</td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:#ede9fe;color:#5b21b6;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;">
                            ${p.cantidad_estructuras}
                        </span>
                    </td>
                    <td style="padding:10px;text-align:right;font-weight:700;color:#7c3aed;">S/ ${p.monto_total.toFixed(2)}</td>
                    <td style="padding:10px;color:#64748b;">${p.registrado_por || '—'}</td>
                    <td style="padding:10px;color:#94a3b8;font-size:12px;">${p.notas || '—'}</td>
                </tr>`).join('')}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;font-weight:800;">
                    <td colspan="4" style="padding:12px;color:#0f172a;">TOTAL</td>
                    <td style="padding:12px;text-align:right;color:#7c3aed;font-size:15px;">S/ ${totalGeneral.toFixed(2)}</td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
        </table>
        </div>`;
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

// Abrir modal para cerrar pago semanal
function egAbrirCierreSemanal() {
    // Calcular fechas de lunes a domingo de la semana actual
    const hoy    = new Date();
    const dow    = hoy.getDay() || 7;          // 1=lun … 7=dom
    const lunes  = new Date(hoy); lunes.setDate(hoy.getDate() - dow + 1);
    const dom    = new Date(lunes); dom.setDate(lunes.getDate() + 6);
    const fmt    = d => d.toISOString().split('T')[0];

    const opcCarpinteros = _egCarpinteros.length
        ? _egCarpinteros.map(c => `<option value="${c}">${c}</option>`).join('')
        : '<option value="">Escribe el nombre</option>';

    Swal.fire({
        title: 'Cerrar pago semanal',
        html: `
        <div style="text-align:left;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">CARPINTERO</label>
            <select id="sw-carpintero" class="swal2-input" style="width:100%;margin:0 0 12px;">
                <option value="">— Selecciona —</option>
                ${opcCarpinteros}
            </select>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">SEMANA DESDE</label>
            <input type="date" id="sw-desde" class="swal2-input" value="${fmt(lunes)}" style="width:100%;margin:0 0 12px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">SEMANA HASTA</label>
            <input type="date" id="sw-hasta" class="swal2-input" value="${fmt(dom)}" style="width:100%;margin:0 0 12px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">NOTAS (opcional)</label>
            <input type="text" id="sw-notas" class="swal2-input" placeholder="Ej: pago en efectivo" style="width:100%;margin:0;">
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Cerrar semana y pagar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        preConfirm: async () => {
            const carpintero   = document.getElementById('sw-carpintero').value;
            const semana_inicio = document.getElementById('sw-desde').value;
            const semana_fin    = document.getElementById('sw-hasta').value;
            const notas         = document.getElementById('sw-notas').value;
            if (!carpintero || !semana_inicio || !semana_fin) {
                Swal.showValidationMessage('Completa todos los campos obligatorios');
                return false;
            }
            try {
                const res = await apiFetch(`${API_URL}/api/stock-estructuras/cerrar-pago-semanal`, {
                    method: 'POST',
                    body: JSON.stringify({ carpintero_nombre: carpintero, semana_inicio, semana_fin, notas })
                });
                const d = await res.json();
                if (!res.ok) { Swal.showValidationMessage(d.error || 'Error al cerrar'); return false; }
                return d;
            } catch(e) {
                Swal.showValidationMessage('Error de conexión'); return false;
            }
        }
    }).then(result => {
        if (!result.isConfirmed || !result.value) return;
        const d = result.value;
        Swal.fire({
            icon: 'success',
            title: '¡Pago registrado!',
            html: `<b>${d.carpintero}</b><br>
                   ${d.estructuras_pagadas} estructura(s)<br>
                   <span style="font-size:20px;font-weight:800;color:#7c3aed;">S/ ${d.monto_total?.toFixed(2)}</span>`,
        });
        cargarPagosSemanales();
        // refrescar cache de estructuras también
        cargarStockEstructuras();
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 3 — LOGÍSTICA EXTERNA (compras a proveedores)
// ════════════════════════════════════════════════════════════════════════════
async function cargarLogistica() {
    const cont = document.getElementById('eg-tabla-logistica');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const desde = document.getElementById('eg-log-desde')?.value || '';
    const hasta = document.getElementById('eg-log-hasta')?.value || '';
    const cat   = document.getElementById('eg-log-cat')?.value || '';

    try {
        let url = `${API_URL}/api/logistica/resumen`;
        const params = [];
        if (desde) params.push(`desde=${desde}`);
        if (hasta) params.push(`hasta=${hasta}`);
        if (params.length) url += '?' + params.join('&');

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!res.ok) { cont.innerHTML = _egError(data.error || JSON.stringify(data)); return; }

        // data puede ser objeto con movimientos/estadísticas o array directo
        let movimientos = Array.isArray(data) ? data : (data.movimientos || []);
        if (cat) movimientos = movimientos.filter(m => m.categoria === cat);

        if (!movimientos.length) {
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin movimientos en ese período</div>';
            return;
        }

        const totalPagado   = movimientos.filter(m => m.estado === 'Pagado').reduce((s,m) => s + m.subtotal, 0);
        const totalGeneral  = movimientos.reduce((s,m) => s + m.subtotal, 0);

        cont.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            <div style="${_egCardStyle('#0369a1')}">
                <div style="font-size:11px;opacity:.8;text-transform:uppercase;">Total período</div>
                <div style="font-size:20px;font-weight:800;margin-top:4px;">S/ ${totalGeneral.toFixed(2)}</div>
                <div style="font-size:11px;opacity:.6;">${movimientos.length} movimientos</div>
            </div>
            <div style="${_egCardStyle('#16a34a')}">
                <div style="font-size:11px;opacity:.8;text-transform:uppercase;">Pagado</div>
                <div style="font-size:20px;font-weight:800;margin-top:4px;">S/ ${totalPagado.toFixed(2)}</div>
            </div>
        </div>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="${_egTh()}">Fecha</th>
                    <th style="${_egTh()}">Venta</th>
                    <th style="${_egTh()}">Insumo</th>
                    <th style="${_egTh()}">Proveedor</th>
                    <th style="${_egTh()}">Categoría</th>
                    <th style="${_egTh('right')}">Precio unit.</th>
                    <th style="${_egTh('center')}">Cant.</th>
                    <th style="${_egTh('right')}">Subtotal</th>
                    <th style="${_egTh('center')}">Estado</th>
                    <th style="${_egTh('center')}">Voucher</th>
                </tr>
            </thead>
            <tbody>
                ${movimientos.map(m => {
                    const estadoColor = m.estado === 'Pagado' ? '#dcfce7;color:#166534' : '#fef9c3;color:#854d0e';
                    return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:9px;color:#64748b;white-space:nowrap;">${m.fecha_pago || m.fecha_recojo || '—'}</td>
                        <td style="padding:9px;color:#3b82f6;font-size:12px;">${m.codigo_venta || '—'}</td>
                        <td style="padding:9px;font-weight:600;color:#0f172a;">${m.insumo || '—'}
                            ${m.sku ? `<br><span style="font-size:10px;color:#94a3b8;">${m.sku}</span>` : ''}
                        </td>
                        <td style="padding:9px;color:#374151;">${m.proveedor || '—'}</td>
                        <td style="padding:9px;">
                            <span style="background:#dbeafe;color:#1d4ed8;border-radius:12px;padding:2px 9px;font-size:11px;">${m.categoria || '—'}</span>
                        </td>
                        <td style="padding:9px;text-align:right;color:#374151;">S/ ${(m.precio_unit||0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;color:#374151;">${m.cantidad || 1}</td>
                        <td style="padding:9px;text-align:right;font-weight:700;color:#0f172a;">S/ ${(m.subtotal||0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;">
                            <span style="background:${estadoColor};border-radius:12px;padding:2px 9px;font-size:11px;font-weight:600;">
                                ${m.estado || '—'}
                            </span>
                        </td>
                        <td style="padding:9px;text-align:center;">
                            ${m.tiene_comprobante
                                ? `<span style="color:#16a34a;font-size:16px;" title="Tiene voucher"><i class="fa-solid fa-receipt"></i></span>`
                                : `<span style="color:#cbd5e1;font-size:12px;">—</span>`}
                        </td>
                    </tr>`;
                }).join('')}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                    <td colspan="7" style="padding:12px;font-weight:700;color:#0f172a;">TOTAL</td>
                    <td style="padding:12px;text-align:right;font-weight:800;font-size:15px;color:#0f172a;">S/ ${totalGeneral.toFixed(2)}</td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
        </table>
        </div>`;
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ════════════════════════════════════════════════════════════════════════════
function _egLoading() {
    return '<div style="text-align:center;padding:30px;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>';
}
function _egError(msg) {
    return `<div style="color:#ef4444;padding:20px;background:#fee2e2;border-radius:8px;">${msg}</div>`;
}
function _egTh(align = 'left') {
    return `padding:10px;text-align:${align};color:#64748b;font-weight:600;white-space:nowrap;`;
}
function _egCardStyle(color) {
    return `background:${color};color:white;border-radius:12px;padding:14px 18px;min-width:160px;`;
}

// helper apiFetch con token — si ya existe en app.js, esta no se usa
if (typeof apiFetch === 'undefined') {
    window.apiFetch = function(url, options = {}) {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
        return fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
    };
}