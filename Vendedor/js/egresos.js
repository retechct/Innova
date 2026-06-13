// ═══════════════════════════════════════════════════════════════════════════
// EGRESOS Y FINANZAS — Innova Möbili ERP  (solo Admin)
//
// PESTAÑA 1: Pagos de Estructuras  → lista de estructuras por carpintero.
//            Muestra carpintero solo si está registrado; chofer separado.
//            Filtro pagado/pendiente funcional.
// PESTAÑA 2: Historial de Pagos    → cierres semanales registrados.
// PESTAÑA 3: Comisiones Vendedores → resumen por vendedor: ventas, contratos,
//            comisión 3%, campo de descuento editable, total neto.
// PESTAÑA 4: Compras a Proveedores → logística externa.
// ═══════════════════════════════════════════════════════════════════════════

let _egTab         = 'pagos-carpinteros';
let _egEstructuras = [];
let _egCarpinteros = [];
let _egVendedores  = [];   // caché de la tabla de comisiones

// ════════════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════════════
function initEgresos() {
    egresosTab('pagos-carpinteros');
}

// ════════════════════════════════════════════════════════════════════════════
//  NAVEGACIÓN
// ════════════════════════════════════════════════════════════════════════════
function egresosTab(tab) {
    _egTab = tab;
    const tabs = ['pagos-carpinteros', 'historial-pagos', 'vendedores', 'logistica'];
    tabs.forEach(t => {
        const btn   = document.getElementById(`eg-tab-${t}`);
        const panel = document.getElementById(`eg-panel-${t}`);
        const active = (t === tab);
        if (btn)   btn.style.background = active ? 'var(--primary)' : '#94a3b8';
        if (panel) panel.style.display  = active ? 'block' : 'none';
    });
    if (tab === 'pagos-carpinteros') cargarPagosCarpinteros();
    if (tab === 'historial-pagos')   cargarHistorialPagos();
    if (tab === 'vendedores')        cargarComisionesVendedores();
    if (tab === 'logistica')         cargarLogistica();
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 1 — PAGOS DE ESTRUCTURAS
//  Correcciones vs versión anterior:
//  - Carpintero solo se muestra si existe (no "—" confuso)
//  - Chofer en columna propia claramente etiquetada
//  - Filtro pagado/pendiente funciona desde el select del HTML
// ════════════════════════════════════════════════════════════════════════════
async function cargarPagosCarpinteros() {
    const cont = document.getElementById('eg-tabla-carpinteros');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const filtroEstado     = document.getElementById('eg-pc-estado')?.value    || '';
    const filtroCarpintero = document.getElementById('eg-pc-carpintero')?.value || '';
    const filtroDesde      = document.getElementById('eg-pc-desde')?.value      || '';
    const filtroHasta      = document.getElementById('eg-pc-hasta')?.value      || '';

    try {
        // Cargar lista de carpinteros para el select (solo primera vez)
        if (!_egCarpinteros.length) {
            try {
                const rc = await apiFetch(`${API_URL}/api/stock-estructuras/carpinteros`);
                _egCarpinteros = await rc.json();
                const sel = document.getElementById('eg-pc-carpintero');
                if (sel && Array.isArray(_egCarpinteros)) {
                    sel.innerHTML = '<option value="">Todos los carpinteros</option>' +
                        _egCarpinteros
                            .filter(Boolean)
                            .map(c => `<option value="${c}">${c}</option>`)
                            .join('');
                }
            } catch(_) {}
        }

        let url = `${API_URL}/api/stock-estructuras`;
        const params = [];
        if (filtroDesde)      params.push(`desde=${filtroDesde}`);
        if (filtroHasta)      params.push(`hasta=${filtroHasta}`);
        if (filtroCarpintero) params.push(`carpintero=${encodeURIComponent(filtroCarpintero)}`);
        if (filtroEstado === 'pagado')    params.push('pago=pagado');
        if (filtroEstado === 'pendiente') params.push('pago=pendiente');
        if (params.length) url += '?' + params.join('&');

        const res  = await apiFetch(url);
        const data = await res.json();
        if (!res.ok) { cont.innerHTML = _egError(data.error); return; }
        _egEstructuras = data;
        _egRenderEstructuras();
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

function _egRenderEstructuras() {
    const cont = document.getElementById('eg-tabla-carpinteros');
    const data = _egEstructuras;

    const pendientes = data.filter(e => !e.pagado);
    const pagados    = data.filter(e =>  e.pagado);
    const totalPend  = pendientes.reduce((s, e) => s + (e.precio || 0), 0);
    const totalPag   = pagados.reduce((s, e) => s + (e.precio || 0), 0);

    if (data.length === 0) {
        cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fa-solid fa-box-open" style="font-size:32px;margin-bottom:10px;display:block;"></i>Sin estructuras con ese filtro</div>';
        return;
    }

    cont.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <div style="${_egCardStyle('#dc2626')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Pendiente de pago</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalPend.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${pendientes.length} estructura${pendientes.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="${_egCardStyle('#16a34a')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ya pagado</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalPag.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${pagados.length} estructura${pagados.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="${_egCardStyle('#0f172a')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total general</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${(totalPend + totalPag).toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${data.length} estructuras</div>
        </div>
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="${_egTh()}">Fecha</th>
                <th style="${_egTh()}">Modelo</th>
                <th style="${_egTh()}">Carpintero</th>
                <th style="${_egTh()}">Chofer</th>
                <th style="${_egTh()}">Tipo</th>
                <th style="${_egTh()}">Medidas</th>
                <th style="${_egTh('right')}">Precio</th>
                <th style="${_egTh('center')}">Estado</th>
                <th style="${_egTh('center')}">Foto</th>
                <th style="${_egTh('center')}">Acción</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(e => _egFilaEstructura(e)).join('')}
        </tbody>
    </table>
    </div>`;
}

function _egFilaEstructura(e) {
    // Carpintero: mostrar solo si está registrado (no "—")
    const carpintero = (e.carpintero_nombre && e.carpintero_nombre.trim())
        ? `<span style="font-weight:600;color:#0f172a;">${e.carpintero_nombre}</span>`
        : `<span style="color:#cbd5e1;font-size:12px;">Sin asignar</span>`;

    // Chofer: etiquetado claramente como tal
    const chofer = (e.chofer_nombre && e.chofer_nombre.trim())
        ? `<span style="color:#374151;">${e.chofer_nombre}</span>`
        : `<span style="color:#cbd5e1;font-size:12px;">—</span>`;

    const medidas = e.medida_estandar
        ? '<span style="background:#dbeafe;color:#1e40af;border-radius:10px;padding:2px 8px;font-size:11px;">Estándar</span>'
        : (e.ancho ? `<span style="font-size:12px;color:#64748b;">${e.ancho}×${e.profundidad}×${e.alto}</span>` : '—');

    const estadoBadge = e.pagado
        ? `<span style="background:#dcfce7;color:#166534;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;white-space:nowrap;">✓ Pagado</span>`
        : `<span style="background:#fee2e2;color:#991b1b;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;white-space:nowrap;">Pendiente</span>`;

    return `
    <tr style="border-bottom:1px solid #f1f5f9;transition:background .15s;" id="eg-row-${e.id}"
        onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
        <td style="padding:10px;color:#64748b;white-space:nowrap;font-size:12px;">${e.fecha || '—'}</td>
        <td style="padding:10px;">
            <div style="font-weight:700;color:#0f172a;">${e.nombre_modelo || '—'}</div>
            ${e.modelo_base ? `<div style="font-size:11px;color:#94a3b8;">${e.modelo_base}</div>` : ''}
        </td>
        <td style="padding:10px;">${carpintero}</td>
        <td style="padding:10px;">${chofer}</td>
        <td style="padding:10px;color:#64748b;font-size:12px;">${e.tipo || '—'}</td>
        <td style="padding:10px;">${medidas}</td>
        <td style="padding:10px;text-align:right;font-weight:800;color:#0f172a;white-space:nowrap;">S/ ${(e.precio || 0).toFixed(2)}</td>
        <td style="padding:10px;text-align:center;">${estadoBadge}</td>
        <td style="padding:10px;text-align:center;">
            ${e.foto_url
                ? `<a href="${e.foto_url}" target="_blank" title="Ver foto"
                     style="color:#3b82f6;font-size:18px;"><i class="fa-solid fa-image"></i></a>`
                : `<span style="color:#cbd5e1;font-size:14px;">—</span>`}
        </td>
        <td style="padding:10px;text-align:center;white-space:nowrap;">
            <button onclick="egTogglePagoEstructura(${e.id}, ${!e.pagado})"
                style="border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;
                       font-weight:700;transition:opacity .15s;
                       background:${e.pagado ? '#fef9c3' : '#dcfce7'};
                       color:${e.pagado ? '#854d0e' : '#166534'};">
                ${e.pagado ? '✗ Desmarcar' : '✓ Marcar pagado'}
            </button>
        </td>
    </tr>`;
}

async function egTogglePagoEstructura(id, nuevoPagado) {
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/pago`, {
            method: 'PATCH',
            body: JSON.stringify({ pagado: nuevoPagado })
        });
        const data = await res.json();
        if (!res.ok) { Swal.fire('Error', data.error || 'No se pudo actualizar', 'error'); return; }
        const idx = _egEstructuras.findIndex(e => e.id === id);
        if (idx >= 0) _egEstructuras[idx].pagado = nuevoPagado;
        _egRenderEstructuras();
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// Mantener nombre antiguo para compatibilidad con modal de pago
const egTogglePagoCarpintero = egTogglePagoEstructura;

// ════════════════════════════════════════════════════════════════════════════
//  MODAL — REGISTRAR PAGO A CARPINTERO (sin cambios funcionales)
// ════════════════════════════════════════════════════════════════════════════
function egAbrirPagarCarpintero() {
    const hoy  = new Date();
    const dow  = hoy.getDay() || 7;
    const lun  = new Date(hoy); lun.setDate(hoy.getDate() - dow + 1);
    const dom  = new Date(lun); dom.setDate(lun.getDate() + 6);
    const fmt  = d => d.toISOString().split('T')[0];

    const opcCarpinteros = _egCarpinteros.length
        ? _egCarpinteros.filter(Boolean).map(c => `<option value="${c}">${c}</option>`).join('')
        : '';

    Swal.fire({
        title: 'Registrar pago a carpintero',
        width: 520,
        html: `
        <div style="text-align:left;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">CARPINTERO</label>
            <select id="sw-carpintero" class="swal2-input" style="width:100%;margin:0 0 12px;">
                <option value="">— Selecciona —</option>
                ${opcCarpinteros}
            </select>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <div style="flex:1;">
                    <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">DESDE</label>
                    <input type="date" id="sw-desde" class="swal2-input" value="${fmt(lun)}" style="width:100%;margin:0;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">HASTA</label>
                    <input type="date" id="sw-hasta" class="swal2-input" value="${fmt(dom)}" style="width:100%;margin:0;">
                </div>
            </div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">VOUCHER DE PAGO (opcional)</label>
            <input type="file" id="sw-voucher" accept="image/*,application/pdf"
                   class="swal2-input" style="width:100%;margin:0 0 12px;padding:6px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">NOTAS (opcional)</label>
            <input type="text" id="sw-notas" class="swal2-input" placeholder="Ej: pago en efectivo" style="width:100%;margin:0;">
        </div>`,
        showCancelButton:  true,
        confirmButtonText: 'Registrar pago',
        cancelButtonText:  'Cancelar',
        confirmButtonColor:'#7c3aed',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const carpintero    = document.getElementById('sw-carpintero').value;
            const semana_inicio = document.getElementById('sw-desde').value;
            const semana_fin    = document.getElementById('sw-hasta').value;
            const notas         = document.getElementById('sw-notas').value;
            const voucherFile   = document.getElementById('sw-voucher').files[0];

            if (!carpintero || !semana_inicio || !semana_fin) {
                Swal.showValidationMessage('Selecciona el carpintero y el rango de fechas');
                return false;
            }

            let voucher_url = '';
            if (voucherFile) {
                try {
                    const fd = new FormData();
                    fd.append('archivo', voucherFile);
                    const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
                    const upRes = await fetch(`${API_URL}/api/upload-voucher`, {
                        method: 'POST',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        body: fd
                    });
                    const upData = await upRes.json();
                    if (!upRes.ok) { Swal.showValidationMessage('Error al subir voucher: ' + upData.error); return false; }
                    voucher_url = upData.url || '';
                } catch(e) {
                    Swal.showValidationMessage('Error al subir el voucher'); return false;
                }
            }

            try {
                const res = await apiFetch(`${API_URL}/api/stock-estructuras/cerrar-pago-semanal`, {
                    method: 'POST',
                    body: JSON.stringify({ carpintero_nombre: carpintero, semana_inicio, semana_fin, notas, voucher_url })
                });
                const d = await res.json();
                if (!res.ok) { Swal.showValidationMessage(d.error || 'Error al registrar pago'); return false; }
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
            html: `<b>${d.carpintero}</b><br>${d.estructuras_pagadas} estructura(s)<br>
                   <span style="font-size:20px;font-weight:800;color:#7c3aed;">S/ ${d.monto_total?.toFixed(2)}</span>`,
        });
        cargarPagosCarpinteros();
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 2 — HISTORIAL DE PAGOS SEMANALES (sin cambios)
// ════════════════════════════════════════════════════════════════════════════
async function cargarHistorialPagos() {
    const cont = document.getElementById('eg-tabla-historial');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const carpintero = document.getElementById('eg-hp-carpintero')?.value || '';
    const semana     = document.getElementById('eg-hp-semana')?.value     || '';

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
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin pagos registrados aún</div>';
            return;
        }

        const totalGeneral = data.reduce((s, p) => s + p.monto_total, 0);

        cont.innerHTML = `
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="${_egTh()}">Fecha pago</th>
                    <th style="${_egTh()}">Carpintero</th>
                    <th style="${_egTh()}">Período</th>
                    <th style="${_egTh('center')}">Estructuras</th>
                    <th style="${_egTh('right')}">Monto</th>
                    <th style="${_egTh()}">Registrado por</th>
                    <th style="${_egTh('center')}">Voucher</th>
                    <th style="${_egTh()}">Notas</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(p => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;color:#64748b;white-space:nowrap;">${p.fecha_pago}</td>
                    <td style="padding:10px;font-weight:700;color:#0f172a;">${p.carpintero}</td>
                    <td style="padding:10px;color:#374151;white-space:nowrap;font-size:12px;">${p.semana_inicio} → ${p.semana_fin}</td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:#ede9fe;color:#5b21b6;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;">${p.cantidad_estructuras}</span>
                    </td>
                    <td style="padding:10px;text-align:right;font-weight:800;color:#7c3aed;">S/ ${p.monto_total.toFixed(2)}</td>
                    <td style="padding:10px;color:#64748b;">${p.registrado_por || '—'}</td>
                    <td style="padding:10px;text-align:center;">
                        ${p.voucher_url
                            ? `<a href="${p.voucher_url}" target="_blank" style="color:#16a34a;font-size:16px;" title="Ver voucher"><i class="fa-solid fa-receipt"></i></a>`
                            : `<span style="color:#cbd5e1;font-size:12px;">—</span>`}
                    </td>
                    <td style="padding:10px;color:#94a3b8;font-size:12px;">${p.notas || '—'}</td>
                </tr>`).join('')}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;font-weight:800;">
                    <td colspan="4" style="padding:12px;color:#0f172a;">TOTAL</td>
                    <td style="padding:12px;text-align:right;color:#7c3aed;font-size:15px;">S/ ${totalGeneral.toFixed(2)}</td>
                    <td colspan="3"></td>
                </tr>
            </tbody>
        </table>
        </div>`;
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 3 — COMISIONES DE VENDEDORES
// ════════════════════════════════════════════════════════════════════════════
async function cargarComisionesVendedores() {
    const cont = document.getElementById('eg-tabla-vendedores');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const desde    = document.getElementById('eg-vd-desde')?.value    || '';
    const hasta    = document.getElementById('eg-vd-hasta')?.value    || '';
    const vendedor = document.getElementById('eg-vd-vendedor')?.value || '';

    try {
        let url = `${API_URL}/api/vendedores/comisiones`;
        const params = [];
        if (desde)    params.push(`desde=${desde}`);
        if (hasta)    params.push(`hasta=${hasta}`);
        if (vendedor) params.push(`vendedor=${encodeURIComponent(vendedor)}`);
        if (params.length) url += '?' + params.join('&');

        const res  = await apiFetch(url);
        const data = await res.json();
        if (!res.ok) { cont.innerHTML = _egError(data.error || 'Error al cargar comisiones'); return; }

        _egVendedores = Array.isArray(data) ? data : (data.vendedores || []);

        // Poblar selector de vendedores
        const selVd = document.getElementById('eg-vd-vendedor');
        if (selVd && selVd.options.length <= 1) {
            const nombres = [...new Set(_egVendedores.map(v => v.vendedor_nombre).filter(Boolean))];
            selVd.innerHTML = '<option value="">Todos los vendedores</option>' +
                nombres.map(n => `<option value="${n}">${n}</option>`).join('');
        }

        _egRenderVendedores();
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

function _egRenderVendedores() {
    const cont = document.getElementById('eg-tabla-vendedores');
    const data = _egVendedores;

    if (!data.length) {
        cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin ventas en ese período</div>';
        return;
    }

    const totalVentas     = data.reduce((s, v) => s + (v.total_ventas    || 0), 0);
    const totalContratos  = data.reduce((s, v) => s + (v.total_contratos || 0), 0);
    const totalComisiones = data.reduce((s, v) => s + (v.comision        || 0), 0);
    const descuento       = parseFloat(document.getElementById('eg-vd-descuento')?.value || 0) || 0;
    const totalNeto       = Math.max(0, totalComisiones - descuento);

    cont.innerHTML = `
    <!-- KPI cards -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <div style="${_egCardStyle('#1d4ed8')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total ventas período</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalVentas.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${totalContratos} contrato${totalContratos !== 1 ? 's' : ''}</div>
        </div>
        <div style="${_egCardStyle('#7c3aed')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total comisiones (3%)</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalComisiones.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${data.length} vendedor${data.length !== 1 ? 'es' : ''}</div>
        </div>
        ${descuento > 0 ? `
        <div style="${_egCardStyle('#d97706')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Descuento aplicado</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">- S/ ${descuento.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">sobre el total</div>
        </div>` : ''}
        <div style="${_egCardStyle('#059669')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total neto a pagar</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalNeto.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${descuento > 0 ? 'comisiones menos descuento' : 'sin descuentos'}</div>
        </div>
    </div>

    <!-- Tabla de vendedores -->
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="${_egTh()}">Vendedor</th>
                <th style="${_egTh('center')}">Contratos</th>
                <th style="${_egTh('right')}">Total ventas</th>
                <th style="${_egTh('right')}">Comisión (3%)</th>
                <th style="${_egTh('center')}">Descuento</th>
                <th style="${_egTh('right')}">Neto vendedor</th>
            </tr>
        </thead>
        <tbody>
            ${data.map((v, idx) => _egFilaVendedor(v, idx)).join('')}
        </tbody>
        <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #e2e8f0;font-weight:800;">
                <td style="padding:12px;color:#0f172a;">TOTALES</td>
                <td style="padding:12px;text-align:center;color:#0f172a;">${totalContratos}</td>
                <td style="padding:12px;text-align:right;color:#1d4ed8;">S/ ${totalVentas.toFixed(2)}</td>
                <td style="padding:12px;text-align:right;color:#7c3aed;">S/ ${totalComisiones.toFixed(2)}</td>
                <td style="padding:12px;text-align:center;">
                    ${descuento > 0
                        ? `<span style="color:#d97706;font-size:12px;">- S/ ${descuento.toFixed(2)}</span>`
                        : '<span style="color:#94a3b8;font-size:11px;">—</span>'}
                </td>
                <td style="padding:12px;text-align:right;color:#059669;font-size:15px;">S/ ${totalNeto.toFixed(2)}</td>
            </tr>
        </tfoot>
    </table>
    </div>`;
}

function _egFilaVendedor(v, idx) {
    const descInput = `eg-desc-${idx}`;
    const neto = Math.max(0, (v.comision || 0) - (v._descuento_local || 0));

    return `
    <tr style="border-bottom:1px solid #f1f5f9;" id="eg-vrow-${idx}"
        onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
        <td style="padding:10px;">
            <div style="font-weight:700;color:#0f172a;">${v.vendedor_nombre || '—'}</div>
            ${v.sede ? `<div style="font-size:11px;color:#94a3b8;">${v.sede}</div>` : ''}
        </td>
        <td style="padding:10px;text-align:center;">
            <span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;">${v.total_contratos || 0}</span>
        </td>
        <td style="padding:10px;text-align:right;font-weight:700;color:#0f172a;white-space:nowrap;">
            S/ ${(v.total_ventas || 0).toFixed(2)}
        </td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">
            <span style="background:#ede9fe;color:#5b21b6;border-radius:8px;padding:4px 10px;font-weight:700;">
                S/ ${(v.comision || 0).toFixed(2)}
            </span>
        </td>
        <td style="padding:10px;text-align:center;">
            <input type="number" id="${descInput}" min="0" step="0.01" placeholder="0.00"
                   value="${v._descuento_local || ''}"
                   style="width:90px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:right;"
                   oninput="egActualizarNetoFila(${idx}, this.value)"
                   title="Descuento individual para ${v.vendedor_nombre}">
        </td>
        <td style="padding:10px;text-align:right;font-weight:800;white-space:nowrap;" id="eg-neto-${idx}">
            <span style="color:#059669;">S/ ${neto.toFixed(2)}</span>
        </td>
    </tr>`;
}

function egActualizarNetoFila(idx, valor) {
    const desc = parseFloat(valor) || 0;
    if (_egVendedores[idx]) {
        _egVendedores[idx]._descuento_local = desc;
        const neto = Math.max(0, (_egVendedores[idx].comision || 0) - desc);
        const netoCell = document.getElementById(`eg-neto-${idx}`);
        if (netoCell) netoCell.innerHTML = `<span style="color:#059669;">S/ ${neto.toFixed(2)}</span>`;
    }
}

// Recalcular fila de totales cuando cambia el descuento global
function egRecalcularNetos() {
    _egRenderVendedores();
}

// ════════════════════════════════════════════════════════════════════════════
//  PESTAÑA 4 — LOGÍSTICA EXTERNA / COMPRAS A PROVEEDORES (sin cambios)
// ════════════════════════════════════════════════════════════════════════════
async function cargarLogistica() {
    const cont = document.getElementById('eg-tabla-logistica');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const desde = document.getElementById('eg-log-desde')?.value || '';
    const hasta = document.getElementById('eg-log-hasta')?.value || '';
    const cat   = document.getElementById('eg-log-cat')?.value   || '';

    try {
        let url = `${API_URL}/api/logistica/resumen`;
        const params = [];
        if (desde) params.push(`desde=${desde}`);
        if (hasta) params.push(`hasta=${hasta}`);
        if (params.length) url += '?' + params.join('&');

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!res.ok) { cont.innerHTML = _egError(data.error || JSON.stringify(data)); return; }

        let movimientos = Array.isArray(data) ? data : (data.movimientos || []);
        if (cat) movimientos = movimientos.filter(m => m.categoria === cat);

        if (!movimientos.length) {
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin movimientos en ese período</div>';
            return;
        }

        const totalPagado  = movimientos.filter(m => m.estado === 'Pagado').reduce((s, m) => s + m.subtotal, 0);
        const totalGeneral = movimientos.reduce((s, m) => s + m.subtotal, 0);

        cont.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
            <div style="${_egCardStyle('#0369a1')}">
                <div style="font-size:10px;opacity:.75;text-transform:uppercase;font-weight:600;">Total período</div>
                <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalGeneral.toFixed(2)}</div>
                <div style="font-size:11px;opacity:.65;">${movimientos.length} movimientos</div>
            </div>
            <div style="${_egCardStyle('#16a34a')}">
                <div style="font-size:10px;opacity:.75;text-transform:uppercase;font-weight:600;">Pagado</div>
                <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalPagado.toFixed(2)}</div>
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
                        <td style="padding:9px;color:#64748b;white-space:nowrap;font-size:12px;">${m.fecha_pago || m.fecha_recojo || '—'}</td>
                        <td style="padding:9px;color:#3b82f6;font-size:12px;">${m.codigo_venta || '—'}</td>
                        <td style="padding:9px;font-weight:600;color:#0f172a;">${m.insumo || '—'}
                            ${m.sku ? `<br><span style="font-size:10px;color:#94a3b8;">${m.sku}</span>` : ''}
                        </td>
                        <td style="padding:9px;color:#374151;">${m.proveedor || '—'}</td>
                        <td style="padding:9px;">
                            <span style="background:#dbeafe;color:#1d4ed8;border-radius:12px;padding:2px 9px;font-size:11px;">${m.categoria || '—'}</span>
                        </td>
                        <td style="padding:9px;text-align:right;color:#374151;">S/ ${(m.precio_unit || 0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;color:#374151;">${m.cantidad || 1}</td>
                        <td style="padding:9px;text-align:right;font-weight:700;color:#0f172a;">S/ ${(m.subtotal || 0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;">
                            <span style="background:${estadoColor};border-radius:12px;padding:2px 9px;font-size:11px;font-weight:600;">${m.estado || '—'}</span>
                        </td>
                        <td style="padding:9px;text-align:center;">
                            ${m.tiene_comprobante
                                ? `<span style="color:#16a34a;font-size:16px;"><i class="fa-solid fa-receipt"></i></span>`
                                : `<span style="color:#cbd5e1;font-size:12px;">—</span>`}
                        </td>
                    </tr>`;
                }).join('')}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                    <td colspan="7" style="padding:12px;font-weight:800;color:#0f172a;">TOTAL</td>
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
//  HELPERS
// ════════════════════════════════════════════════════════════════════════════
function _egLoading() {
    return '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;margin-bottom:8px;display:block;"></i>Cargando...</div>';
}
function _egError(msg) {
    return `<div style="color:#ef4444;padding:16px 20px;background:#fee2e2;border-radius:8px;border-left:4px solid #dc2626;">
        <i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i>${msg}</div>`;
}
function _egTh(align = 'left') {
    return `padding:10px 12px;text-align:${align};color:#64748b;font-weight:700;white-space:nowrap;font-size:12px;text-transform:uppercase;letter-spacing:.5px;`;
}
function _egCardStyle(color) {
    return `background:${color};color:white;border-radius:12px;padding:14px 20px;min-width:170px;box-shadow:0 2px 8px rgba(0,0,0,.15);`;
}

// ════════════════════════════════════════════════════════════════════════════
//  FALLBACK apiFetch (por si no está definido globalmente)
// ════════════════════════════════════════════════════════════════════════════
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