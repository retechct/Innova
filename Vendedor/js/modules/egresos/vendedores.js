// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PESTAÃ‘A 3 â€” SUELDOS Y COMISIONES DE VENDEDORES
//  - Muestra TODOS los vendedores aunque no hayan registrado pedidos
//  - Sueldo base S/350 solo si registro al menos un pedido esa semana
//  - Descuentos por tardanza que no se cobran pasan a la siguiente semana
//  - Botones para registrar aumento / descuento y cerrar semana
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _egSemanaInicio = '';
let _egSemanaFin    = '';

(function _initSemanaActual() {
    const hoy = new Date();
    const dow = hoy.getDay() || 7;
    const lun = new Date(hoy); lun.setDate(hoy.getDate() - dow + 1);
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
    const fmt = _egFechaLocalISO;
    _egSemanaInicio = fmt(lun);
    _egSemanaFin    = fmt(dom);
})();

async function cargarComisionesVendedores() {
    const cont = document.getElementById('eg-tabla-vendedores');
    if (!cont) return;
    cont.innerHTML = _egLoading();

    const desde    = document.getElementById('eg-vd-desde')?.value    || _egSemanaInicio;
    const hasta    = document.getElementById('eg-vd-hasta')?.value    || _egSemanaFin;
    const vendedor = document.getElementById('eg-vd-vendedor')?.value || '';

    // Actualizar los inputs de fecha si estÃ¡n vacÃ­os
    const inpDesde = document.getElementById('eg-vd-desde');
    const inpHasta = document.getElementById('eg-vd-hasta');
    if (inpDesde && !inpDesde.value) inpDesde.value = _egSemanaInicio;
    if (inpHasta && !inpHasta.value) inpHasta.value = _egSemanaFin;

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

        _egVendedores = data.vendedores || [];

        // Poblar selector de vendedores (solo primera vez)
        const selVd = document.getElementById('eg-vd-vendedor');
        if (selVd && selVd.options.length <= 1) {
            const nombres = _egVendedores.map(v => v.vendedor_nombre).filter(Boolean);
            selVd.innerHTML = '<option value="">Todos los vendedores</option>' +
                nombres.map(n => `<option value="${escapeAttr(n)}">${escapeHTML(n)}</option>`).join('');
        }

        _egRenderVendedores(data);
    } catch(e) {
        cont.innerHTML = _egError('Error de conexión: ' + e.message);
    }
}

function _egRenderVendedores(meta = {}) {
    const cont = document.getElementById('eg-tabla-vendedores');
    const data = _egVendedores;

    if (!data.length) {
        cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">No hay vendedores registrados</div>';
        return;
    }

    const totalVentas    = meta.total_ventas    ?? data.reduce((s, v) => s + (v.total_ventas || 0), 0);
    const totalContratos = meta.total_contratos ?? data.reduce((s, v) => s + (v.total_contratos || 0), 0);
    const totalSueldos   = meta.total_sueldos   ?? data.reduce((s, v) => s + (v.sueldo_efectivo || 0), 0);
    const totalComision  = meta.total_comision  ?? data.reduce((s, v) => s + (v.comision || 0), 0);
    const totalNeto      = meta.total_neto      ?? data.reduce((s, v) => s + (v.neto || 0), 0);
    const sueldoBase     = meta.sueldo_base     ?? 350;

    const vendedoresSinPedido = data.filter(v => !(v.hizo_pedido ?? v.vendido)).length;

    cont.innerHTML = `
    <!-- KPI cards -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <div style="${_egCardStyle('#0f172a')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Vendedores</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">${data.length}</div>
            <div style="font-size:11px;opacity:.65;">${vendedoresSinPedido} sin pedido esta semana</div>
        </div>
        <div style="${_egCardStyle('#1d4ed8')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total ventas período</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalVentas.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">${totalContratos} pedido${totalContratos !== 1 ? 's' : ''}</div>
        </div>
        <div style="${_egCardStyle('#7c3aed')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Sueldos base (S/${sueldoBase})</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalSueldos.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">+ S/ ${totalComision.toFixed(2)} comisiones (3%)</div>
        </div>
        <div style="${_egCardStyle('#059669')}">
            <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total neto a pagar</div>
            <div style="font-size:22px;font-weight:800;margin:5px 0 2px;">S/ ${totalNeto.toFixed(2)}</div>
            <div style="font-size:11px;opacity:.65;">sueldo + comisión ± ajustes</div>
        </div>
    </div>

    ${vendedoresSinPedido > 0 ? `
    <div style="background:#fef9c3;border-left:4px solid #d97706;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#92400e;">
        <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>
        <b>${vendedoresSinPedido} vendedor${vendedoresSinPedido !== 1 ? 'es' : ''}</b> no registró pedidos esta semana.
        No recibirán sueldo base. Los descuentos pendientes se acumulan para la siguiente semana.
    </div>` : ''}

    <!-- Tabla principal -->
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="${_egTh()}">Vendedor</th>
                <th style="${_egTh('center')}">Contratos</th>
                <th style="${_egTh('right')}">Ventas</th>
                <th style="${_egTh('right')}">Comisión 3%</th>
                <th style="${_egTh('right')}">Sueldo base</th>
                <th style="${_egTh('right')}">Aumentos</th>
                <th style="${_egTh('right')}">Descuentos</th>
                <th style="${_egTh('right')}">Deuda ant.</th>
                <th style="${_egTh('right')}">Neto</th>
                <th style="${_egTh('center')}">Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${data.map((v, idx) => _egFilaVendedor(v, idx)).join('')}
        </tbody>
        <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #e2e8f0;font-weight:800;">
                <td style="padding:12px;color:#0f172a;">TOTALES</td>
                <td style="padding:12px;text-align:center;">${totalContratos}</td>
                <td style="padding:12px;text-align:right;color:#1d4ed8;">S/ ${totalVentas.toFixed(2)}</td>
                <td style="padding:12px;text-align:right;color:#7c3aed;">S/ ${totalComision.toFixed(2)}</td>
                <td style="padding:12px;text-align:right;color:#0f172a;">S/ ${totalSueldos.toFixed(2)}</td>
                <td style="padding:12px;text-align:right;color:#16a34a;">â€”</td>
                <td style="padding:12px;text-align:right;color:#dc2626;">â€”</td>
                <td style="padding:12px;text-align:right;color:#d97706;">â€”</td>
                <td style="padding:12px;text-align:right;color:#059669;font-size:15px;">S/ ${totalNeto.toFixed(2)}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
    </div>`;
}

function _egFilaVendedor(v, idx) {
    const sinVenta   = !(v.hizo_pedido ?? v.vendido);
    const rowBg      = sinVenta ? 'background:#fffbeb;' : '';
    const sueldoTxt  = sinVenta
        ? `<span style="color:#94a3b8;font-size:11px;" title="Sin pedidos esta semana">S/ 0.00 <i class="fa-solid fa-ban" style="color:#fbbf24;"></i></span>`
        : `<span style="color:#0f172a;font-weight:700;">S/ ${(v.sueldo_efectivo||0).toFixed(2)}</span>`;

    const deudaTxt = v.saldo_acumulado > 0
        ? `<span style="color:#d97706;font-weight:700;" title="Descuentos arrastrados de semanas anteriores">S/ ${v.saldo_acumulado.toFixed(2)}</span>`
        : `<span style="color:#94a3b8;">â€”</span>`;

    const netoColor = v.neto > 0 ? '#059669' : '#dc2626';
    const vendedorNombre = escapeHTML(v.vendedor_nombre || 'â€”');
    const sede = escapeHTML(v.sede || '');

    return `
    <tr style="border-bottom:1px solid #f1f5f9;${rowBg}" id="eg-vrow-${idx}"
        onmouseover="this.style.background='${sinVenta ? '#fef3c7' : '#fafafa'}'"
        onmouseout="this.style.background='${sinVenta ? '#fffbeb' : ''}'">
        <td style="padding:10px;">
            <div style="font-weight:700;color:#0f172a;">${vendedorNombre}</div>
            ${sede ? `<div style="font-size:11px;color:#94a3b8;">${sede}</div>` : ''}
            ${sinVenta ? `<div style="font-size:10px;background:#fde68a;color:#92400e;border-radius:10px;padding:1px 7px;display:inline-block;margin-top:3px;">Sin pedido</div>` : ''}
        </td>
        <td style="padding:10px;text-align:center;">
            <span style="background:${sinVenta ? '#f1f5f9' : '#dbeafe'};color:${sinVenta ? '#94a3b8' : '#1d4ed8'};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;">${v.total_contratos || 0}</span>
        </td>
        <td style="padding:10px;text-align:right;font-weight:700;color:#0f172a;white-space:nowrap;">
            S/ ${(v.total_ventas || 0).toFixed(2)}
        </td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">
            <span style="background:${sinVenta ? '#f1f5f9' : '#ede9fe'};color:${sinVenta ? '#94a3b8' : '#5b21b6'};border-radius:8px;padding:4px 10px;font-weight:700;">
                S/ ${(v.comision || 0).toFixed(2)}
            </span>
        </td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">${sueldoTxt}</td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">
            ${v.aumentos > 0
                ? `<span style="color:#16a34a;font-weight:700;">+ S/ ${v.aumentos.toFixed(2)}</span>`
                : `<span style="color:#94a3b8;">â€”</span>`}
        </td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">
            ${v.descuentos > 0
                ? `<span style="color:#dc2626;font-weight:700;">- S/ ${v.descuentos.toFixed(2)}</span>`
                : `<span style="color:#94a3b8;">â€”</span>`}
        </td>
        <td style="padding:10px;text-align:right;white-space:nowrap;">${deudaTxt}</td>
        <td style="padding:10px;text-align:right;font-weight:800;white-space:nowrap;" id="eg-neto-${idx}">
            <span style="color:${netoColor};font-size:14px;">S/ ${(v.neto || 0).toFixed(2)}</span>
            ${v.deuda_siguiente > 0 ? `<div style="font-size:10px;color:#d97706;white-space:nowrap;">â†’ S/ ${v.deuda_siguiente.toFixed(2)} a la siguiente</div>` : ''}
        </td>
        <td style="padding:10px;text-align:center;white-space:nowrap;">
            <button onclick="egAbrirAjusteVendedor(${idx}, 'descuento')"
                style="border:none;background:#fee2e2;color:#991b1b;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:700;margin:2px;"
                title="Registrar descuento (tardanza, falta)">
                <i class="fa-solid fa-minus"></i> Desc.
            </button>
            <button onclick="egAbrirAjusteVendedor(${idx}, 'aumento')"
                style="border:none;background:#dcfce7;color:#166534;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:700;margin:2px;"
                title="Registrar aumento o bono">
                <i class="fa-solid fa-plus"></i> Aum.
            </button>
            <button onclick="egVerAjustesVendedor(${idx})"
                style="border:none;background:#f1f5f9;color:#475569;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px;margin:2px;"
                title="Ver historial de ajustes">
                <i class="fa-solid fa-list"></i>
            </button>
            <button onclick="egCerrarSemanaVendedor(${idx})"
                style="border:none;background:#0f172a;color:white;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:700;margin:2px;"
                title="Cerrar y registrar pago semanal">
                <i class="fa-solid fa-check"></i> Pagar
            </button>
        </td>
    </tr>`;
}

// â”€â”€â”€ Modal: registrar descuento o aumento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function egAbrirAjusteVendedor(idx, tipo) {
    const v = _egVendedores[idx];
    if (!v) return;

    const desde = document.getElementById('eg-vd-desde')?.value || _egSemanaInicio;
    const hasta = document.getElementById('eg-vd-hasta')?.value || _egSemanaFin;
    const esDesc = tipo === 'descuento';
    const color  = esDesc ? '#dc2626' : '#16a34a';
    const label  = esDesc ? 'Descuento' : 'Aumento / bono';
    const icon   = esDesc ? 'âž–' : 'âž•';

    const { value: formValues } = await Swal.fire({
        title: `${icon} ${label} â€” ${v.vendedor_nombre}`,
        html: `
        <div style="text-align:left;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">MONTO (S/)</label>
            <input type="number" id="sw-monto" class="swal2-input" min="0.01" step="0.01" placeholder="Ej: 20.00"
                   style="width:100%;margin:0 0 12px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">MOTIVO</label>
            <input type="text" id="sw-motivo" class="swal2-input" placeholder="${esDesc ? 'Ej: tardanza lunes, falta justificada' : 'Ej: bono por meta, horas extra'}"
                   style="width:100%;margin:0 0 12px;">
            <div style="display:flex;gap:8px;">
                <div style="flex:1;">
                    <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">SEMANA INICIO</label>
                    <input type="date" id="sw-inicio" class="swal2-input" value="${desde}" style="width:100%;margin:0;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">SEMANA FIN</label>
                    <input type="date" id="sw-fin" class="swal2-input" value="${hasta}" style="width:100%;margin:0;">
                </div>
            </div>
            ${esDesc ? `<div style="margin-top:10px;padding:8px 12px;background:#fef9c3;border-radius:6px;font-size:12px;color:#92400e;">
                <i class="fa-solid fa-info-circle"></i> Si el vendedor no tiene pedidos esta semana, el descuento se arrastrara a la siguiente semana que si registre pedidos.
            </div>` : ''}
        </div>`,
        confirmButtonColor: color,
        confirmButtonText: `Registrar ${label}`,
        showCancelButton:  true,
        cancelButtonText:  'Cancelar',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const monto  = parseFloat(document.getElementById('sw-monto').value);
            const motivo = document.getElementById('sw-motivo').value.trim();
            const inicio = document.getElementById('sw-inicio').value;
            const fin    = document.getElementById('sw-fin').value;
            if (!monto || monto <= 0) { Swal.showValidationMessage('Ingresa un monto válido mayor a 0'); return false; }
            if (!inicio || !fin)      { Swal.showValidationMessage('Selecciona el rango de la semana'); return false; }

            const res = await apiFetch(`${API_URL}/api/vendedores/ajuste`, {
                method: 'POST',
                body: JSON.stringify({
                    usuario_id:    v.usuario_id,
                    tipo,
                    monto,
                    motivo,
                    semana_inicio: inicio,
                    semana_fin:    fin
                })
            });
            const d = await res.json();
            if (!res.ok) { Swal.showValidationMessage(d.error || 'Error al guardar'); return false; }
            return d;
        }
    });

    if (formValues?.exito) {
        await Swal.fire({ icon: 'success', title: formValues.mensaje, timer: 1500, showConfirmButton: false });
        cargarComisionesVendedores();
    }
}

// â”€â”€â”€ Modal: ver historial de ajustes de un vendedor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function egVerAjustesVendedor(idx) {
    const v = _egVendedores[idx];
    if (!v) return;

    const res  = await apiFetch(`${API_URL}/api/vendedores/ajustes/${v.usuario_id}`);
    const data = await res.json();
    if (!res.ok) { Swal.fire('Error', data.error, 'error'); return; }

    if (!data.length) {
        Swal.fire({ icon: 'info', title: `${v.vendedor_nombre}`, text: 'Sin ajustes registrados aún.' });
        return;
    }

    const filas = data.map(a => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px;">${a.fecha}</td>
            <td style="padding:8px;">
                <span style="background:${a.tipo === 'descuento' ? '#fee2e2;color:#991b1b' : '#dcfce7;color:#166534'};border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;">
                    ${a.tipo === 'descuento' ? 'âž– Desc.' : 'âž• Aum.'}
                </span>
            </td>
            <td style="padding:8px;font-weight:700;color:${a.tipo === 'descuento' ? '#dc2626' : '#16a34a'};">S/ ${a.monto.toFixed(2)}</td>
            <td style="padding:8px;color:#64748b;font-size:12px;">${a.motivo || 'â€”'}</td>
            <td style="padding:8px;font-size:11px;color:#94a3b8;">${a.semana_inicio} â†’ ${a.semana_fin}</td>
            <td style="padding:8px;text-align:center;">
                ${a.aplicado
                    ? `<span style="color:#16a34a;font-size:11px;">âœ“ Aplicado</span>`
                    : `<button onclick="egEliminarAjuste(${a.id})"
                        style="border:none;background:#fee2e2;color:#991b1b;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;">
                        Eliminar
                       </button>`}
            </td>
        </tr>`).join('');

    Swal.fire({
        title:  `Ajustes â€” ${v.vendedor_nombre}`,
        width:  700,
        html: `
        <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="padding:8px;color:#64748b;">Fecha</th>
                    <th style="padding:8px;color:#64748b;">Tipo</th>
                    <th style="padding:8px;color:#64748b;">Monto</th>
                    <th style="padding:8px;color:#64748b;">Motivo</th>
                    <th style="padding:8px;color:#64748b;">Semana</th>
                    <th style="padding:8px;color:#64748b;">Estado</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        </div>`,
        showConfirmButton: false,
        showCloseButton:   true,
    });
}

async function egEliminarAjuste(ajusteId) {
    const conf = await Swal.fire({
        title: '¿Eliminar ajuste?',
        text:  'Solo se puede eliminar si aún no fue aplicado en un cierre.',
        icon:  'warning',
        showCancelButton:   true,
        confirmButtonColor: '#dc2626',
        confirmButtonText:  'Sí, eliminar',
        cancelButtonText:   'Cancelar',
    });
    if (!conf.isConfirmed) return;

    const res  = await apiFetch(`${API_URL}/api/vendedores/ajuste/${ajusteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { Swal.fire('Error', data.error, 'error'); return; }
    Swal.fire({ icon: 'success', title: 'Ajuste eliminado', timer: 1200, showConfirmButton: false });
    cargarComisionesVendedores();
}

// â”€â”€â”€ Modal: cerrar semana y registrar pago â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function egCerrarSemanaVendedor(idx) {
    const v = _egVendedores[idx];
    if (!v) return;

    const desde = document.getElementById('eg-vd-desde')?.value || _egSemanaInicio;
    const hasta = document.getElementById('eg-vd-hasta')?.value || _egSemanaFin;

    const netoCalculado = v.neto || 0;
    const sinVenta = !(v.hizo_pedido ?? v.vendido);

    const { value: formValues } = await Swal.fire({
        title: `ðŸ’³ Cerrar semana â€” ${v.vendedor_nombre}`,
        width: 520,
        html: `
        <div style="text-align:left;">
            ${sinVenta ? `<div style="background:#fef9c3;border-left:4px solid #d97706;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:14px;font-size:13px;color:#92400e;">
                <b>Sin pedidos esta semana.</b> El monto a pagar sera S/ 0.00.
                Los descuentos pendientes (S/ ${(v.descuentos_total||0).toFixed(2)}) pasarán a la siguiente semana.
            </div>` : `
            <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:14px;font-size:13px;color:#166534;">
                <b>Neto calculado:</b> S/ ${netoCalculado.toFixed(2)}
                &nbsp;|&nbsp; Sueldo S/ ${(v.sueldo_efectivo||0).toFixed(2)}
                + Comisión S/ ${(v.comision||0).toFixed(2)}
                ${v.aumentos > 0 ? `+ Aum. S/ ${v.aumentos.toFixed(2)}` : ''}
                ${v.descuentos_total > 0 ? `âˆ’ Desc. S/ ${v.descuentos_total.toFixed(2)}` : ''}
            </div>`}
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">MONTO PAGADO (S/)</label>
            <input type="number" id="sw-pago" class="swal2-input" min="0" step="0.01"
                   value="${sinVenta ? '0' : netoCalculado.toFixed(2)}"
                   ${sinVenta ? 'disabled' : ''}
                   style="width:100%;margin:0 0 12px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">VOUCHER DE PAGO (opcional)</label>
            <input type="file" id="sw-voucher" accept="image/*,application/pdf"
                   class="swal2-input" style="width:100%;margin:0 0 12px;padding:6px;">
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">NOTAS</label>
            <input type="text" id="sw-notas" class="swal2-input" placeholder="Ej: pago en efectivo"
                   style="width:100%;margin:0;">
        </div>`,
        confirmButtonText:  sinVenta ? 'Registrar (sin pago)' : 'Confirmar pago',
        confirmButtonColor: sinVenta ? '#d97706' : '#059669',
        showCancelButton:   true,
        cancelButtonText:   'Cancelar',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const monto_pagado = sinVenta ? 0 : (parseFloat(document.getElementById('sw-pago').value) || 0);
            const notas        = document.getElementById('sw-notas').value.trim();
            const voucherFile  = document.getElementById('sw-voucher').files?.[0];

            let voucher_url = '';
            if (voucherFile) {
                try {
                    const fd = new FormData();
                    fd.append('archivo', voucherFile);
                    const upRes = await apiFetch(`${API_URL}/api/upload-voucher`, {
                        method: 'POST',
                        body: fd
                    });
                    const upData = await upRes.json();
                    if (!upRes.ok) { Swal.showValidationMessage('Error al subir voucher: ' + upData.error); return false; }
                    voucher_url = upData.url || '';
                } catch(e) {
                    Swal.showValidationMessage('Error al subir el voucher'); return false;
                }
            }

            const res = await apiFetch(`${API_URL}/api/vendedores/cerrar-semana`, {
                method: 'POST',
                body: JSON.stringify({
                    usuario_id:    v.usuario_id,
                    semana_inicio: desde,
                    semana_fin:    hasta,
                    monto_pagado,
                    notas,
                    voucher_url
                })
            });
            const d = await res.json();
            if (!res.ok) { Swal.showValidationMessage(d.error || 'Error al registrar cierre'); return false; }
            return d;
        }
    });

    if (formValues?.exito) {
        const msg = formValues.vendio
            ? `âœ… Pago registrado: S/ ${formValues.monto_pagado?.toFixed(2)}`
            : `âš ï¸ Semana cerrada sin pago. Descuentos arrastrados a la siguiente semana.`;
        await Swal.fire({ icon: formValues.vendio ? 'success' : 'warning', title: formValues.vendedor, text: msg });
        cargarComisionesVendedores();
    }
}

// Mantener compatibilidad con cÃ³digo anterior
function egActualizarNetoFila() {}
function egRecalcularNetos() { cargarComisionesVendedores(); }
