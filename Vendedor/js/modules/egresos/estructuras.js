async function descargarExcelEstructuras() {
    const filtroEstado     = document.getElementById('eg-pc-estado')?.value    || '';
    const filtroCarpintero = document.getElementById('eg-pc-carpintero')?.value || '';
    const filtroDesde      = document.getElementById('eg-pc-desde')?.value      || '';
    const filtroHasta      = document.getElementById('eg-pc-hasta')?.value      || '';

    const btn = document.getElementById('eg-btn-exportar-excel');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...'; }

    try {
        let url = `${API_URL}/api/stock-estructuras/exportar`;
        const params = [];
        if (filtroDesde)      params.push(`desde=${filtroDesde}`);
        if (filtroHasta)      params.push(`hasta=${filtroHasta}`);
        if (filtroCarpintero) params.push(`carpintero=${encodeURIComponent(filtroCarpintero)}`);
        if (filtroEstado === 'pagado')    params.push('pago=pagado');
        if (filtroEstado === 'pendiente') params.push('pago=pendiente');
        if (params.length) url += '?' + params.join('&');

        const res = await apiFetch(url);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'No se pudo generar el Excel');
        }

        const blob = await res.blob();
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `estructuras_innova_${_egFechaLocalISO(new Date())}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (e) {
        Swal.fire('Error', e.message || 'Fallo al generar el Excel', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Descargar Excel'; }
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PESTAÃ‘A 1 â€” PAGOS DE ESTRUCTURAS
//  Correcciones vs versiÃ³n anterior:
//  - Carpintero solo se muestra si existe (no "â€”" confuso)
//  - Chofer en columna propia claramente etiquetada
//  - Filtro pagado/pendiente funciona desde el select del HTML
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        cont.innerHTML = _egError('Error de conexiÃ³n: ' + e.message);
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
                <th style="${_egTh('center')}">AcciÃ³n</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(e => _egFilaEstructura(e)).join('')}
        </tbody>
    </table>
    </div>`;
}

function _egFilaEstructura(e) {
    // Carpintero: mostrar solo si estÃ¡ registrado (no "â€”")
    const carpintero = (e.carpintero_nombre && e.carpintero_nombre.trim())
        ? `<span style="font-weight:600;color:#0f172a;">${e.carpintero_nombre}</span>`
        : `<span style="color:#cbd5e1;font-size:12px;">Sin asignar</span>`;

    // Chofer: etiquetado claramente como tal
    const chofer = (e.chofer_nombre && e.chofer_nombre.trim())
        ? `<span style="color:#374151;">${e.chofer_nombre}</span>`
        : `<span style="color:#cbd5e1;font-size:12px;">â€”</span>`;

    const medidas = e.medida_estandar
        ? '<span style="background:#dbeafe;color:#1e40af;border-radius:10px;padding:2px 8px;font-size:11px;">EstÃ¡ndar</span>'
        : (e.ancho ? `<span style="font-size:12px;color:#64748b;">${e.ancho}Ã—${e.profundidad}Ã—${e.alto}</span>` : 'â€”');

    const estadoBadge = e.pagado
        ? `<span style="background:#dcfce7;color:#166534;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;white-space:nowrap;">âœ“ Pagado</span>`
        : `<span style="background:#fee2e2;color:#991b1b;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;white-space:nowrap;">Pendiente</span>`;

    return `
    <tr style="border-bottom:1px solid #f1f5f9;transition:background .15s;" id="eg-row-${e.id}"
        onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
        <td style="padding:10px;color:#64748b;white-space:nowrap;font-size:12px;">${e.fecha || 'â€”'}</td>
        <td style="padding:10px;">
            <div style="font-weight:700;color:#0f172a;">${e.nombre_modelo || 'â€”'}</div>
            ${e.modelo_base ? `<div style="font-size:11px;color:#94a3b8;">${e.modelo_base}</div>` : ''}
        </td>
        <td style="padding:10px;">${carpintero}</td>
        <td style="padding:10px;">${chofer}</td>
        <td style="padding:10px;color:#64748b;font-size:12px;">${e.tipo || 'â€”'}</td>
        <td style="padding:10px;">${medidas}</td>
        <td style="padding:10px;text-align:right;font-weight:800;color:#0f172a;white-space:nowrap;">S/ ${(e.precio || 0).toFixed(2)}</td>
        <td style="padding:10px;text-align:center;">${estadoBadge}</td>
        <td style="padding:10px;text-align:center;">
            ${e.foto_url
                ? `<a href="${e.foto_url}" target="_blank" title="Ver foto"
                     style="color:#3b82f6;font-size:18px;"><i class="fa-solid fa-image"></i></a>`
                : `<span style="color:#cbd5e1;font-size:14px;">â€”</span>`}
        </td>
        <td style="padding:10px;text-align:center;white-space:nowrap;">
            <button onclick="egTogglePagoEstructura(${e.id}, ${!e.pagado})"
                style="border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;
                       font-weight:700;transition:opacity .15s;
                       background:${e.pagado ? '#fef9c3' : '#dcfce7'};
                       color:${e.pagado ? '#854d0e' : '#166534'};">
                ${e.pagado ? 'âœ— Desmarcar' : 'âœ“ Marcar pagado'}
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
        Swal.fire('Error', 'Error de conexiÃ³n', 'error');
    }
}

// Mantener nombre antiguo para compatibilidad con modal de pago
const egTogglePagoCarpintero = egTogglePagoEstructura;
window.egTogglePagoCarpintero = egTogglePagoEstructura;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MODAL â€” REGISTRAR PAGO A CARPINTERO (sin cambios funcionales)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function egAbrirPagarCarpintero() {
    const hoy  = new Date();
    const dow  = hoy.getDay() || 7;
    const lun  = new Date(hoy); lun.setDate(hoy.getDate() - dow + 1);
    const dom  = new Date(lun); dom.setDate(lun.getDate() + 6);
    const fmt  = _egFechaLocalISO;

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
                <option value="">â€” Selecciona â€”</option>
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

            try {
                const res = await apiFetch(`${API_URL}/api/stock-estructuras/cerrar-pago-semanal`, {
                    method: 'POST',
                    body: JSON.stringify({ carpintero_nombre: carpintero, semana_inicio, semana_fin, notas, voucher_url })
                });
                const d = await res.json();
                if (!res.ok) { Swal.showValidationMessage(d.error || 'Error al registrar pago'); return false; }
                return d;
            } catch(e) {
                Swal.showValidationMessage('Error de conexiÃ³n'); return false;
            }
        }
    }).then(result => {
        if (!result.isConfirmed || !result.value) return;
        const d = result.value;
        Swal.fire({
            icon: 'success',
            title: 'Â¡Pago registrado!',
            html: `<b>${d.carpintero}</b><br>${d.estructuras_pagadas} estructura(s)<br>
                   <span style="font-size:20px;font-weight:800;color:#7c3aed;">S/ ${d.monto_total?.toFixed(2)}</span>`,
        });
        cargarPagosCarpinteros();
    });
}
