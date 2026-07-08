// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PESTAÃ‘A 4 â€” LOGÃSTICA EXTERNA / COMPRAS A PROVEEDORES (sin cambios)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin movimientos en ese perÃ­odo</div>';
            return;
        }

        const totalPagado  = movimientos.filter(m => m.estado === 'Pagado').reduce((s, m) => s + m.subtotal, 0);
        const totalGeneral = movimientos.reduce((s, m) => s + m.subtotal, 0);

        // Cache para que el botÃ³n del "ojo" pueda recuperar el movimiento completo sin re-pedirlo
        window._egMovCache = {};
        movimientos.forEach(m => { window._egMovCache[m.id] = m; });

        cont.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
            <div style="${_egCardStyle('#0369a1')}">
                <div style="font-size:10px;opacity:.75;text-transform:uppercase;font-weight:600;">Total perÃ­odo</div>
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
                    <th style="${_egTh()}">CategorÃ­a</th>
                    <th style="${_egTh('right')}">Precio unit.</th>
                    <th style="${_egTh('center')}">Cant.</th>
                    <th style="${_egTh('right')}">Subtotal</th>
                    <th style="${_egTh('center')}">Estado</th>
                    <th style="${_egTh('center')}">Voucher</th>
                    <th style="${_egTh('center')}">Ver</th>
                </tr>
            </thead>
            <tbody>
                ${movimientos.map(m => {
                    const estadoColor = m.estado === 'Pagado' ? '#dcfce7;color:#166534' : '#fef9c3;color:#854d0e';
                    return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:9px;color:#64748b;white-space:nowrap;font-size:12px;">${m.fecha_pago || m.fecha_recojo || 'â€”'}</td>
                        <td style="padding:9px;color:#3b82f6;font-size:12px;">${m.codigo_venta || 'â€”'}</td>
                        <td style="padding:9px;font-weight:600;color:#0f172a;">${m.insumo || 'â€”'}
                            ${m.sku ? `<br><span style="font-size:10px;color:#94a3b8;">${m.sku}</span>` : ''}
                        </td>
                        <td style="padding:9px;color:#374151;">${m.proveedor || 'â€”'}</td>
                        <td style="padding:9px;">
                            <span style="background:#dbeafe;color:#1d4ed8;border-radius:12px;padding:2px 9px;font-size:11px;">${m.categoria || 'â€”'}</span>
                        </td>
                        <td style="padding:9px;text-align:right;color:#374151;">S/ ${(m.precio_unit || 0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;color:#374151;">${m.cantidad || 1}</td>
                        <td style="padding:9px;text-align:right;font-weight:700;color:#0f172a;">S/ ${(m.subtotal || 0).toFixed(2)}</td>
                        <td style="padding:9px;text-align:center;">
                            <span style="background:${estadoColor};border-radius:12px;padding:2px 9px;font-size:11px;font-weight:600;">${m.estado || 'â€”'}</span>
                        </td>
                        <td style="padding:9px;text-align:center;">
                            ${m.tiene_comprobante
                                ? `<span style="color:#16a34a;font-size:16px;"><i class="fa-solid fa-receipt"></i></span>`
                                : `<span style="color:#cbd5e1;font-size:12px;">â€”</span>`}
                        </td>
                        <td style="padding:9px;text-align:center;">
                            <button onclick="_egVerDetalle(${m.id})" title="Ver detalle completo"
                                    style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:13px;">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('')}
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                    <td colspan="7" style="padding:12px;font-weight:800;color:#0f172a;">TOTAL</td>
                    <td style="padding:12px;text-align:right;font-weight:800;font-size:15px;color:#0f172a;">S/ ${totalGeneral.toFixed(2)}</td>
                    <td colspan="3"></td>
                </tr>
            </tbody>
        </table>
        </div>`;
    } catch(e) {
        cont.innerHTML = _egError('Error de conexiÃ³n: ' + e.message);
    }
}

/**
 * Ojo de Egresos: muestra el movimiento completo (insumo, venta, proveedor,
 * fechas, montos y el comprobante de pago si existe) sin necesitar la
 * columna estrecha de la tabla ni forzar a imprimir para verlo.
 */
function _egVerDetalle(id) {
    const m = (window._egMovCache || {})[id];
    if (!m) return;

    const comprobanteHTML = m.comprobante_url
        ? `<img src="${m.comprobante_url}" onerror="this.src='imagenes/sin_foto.jpg'"
                style="width:100%; max-height:260px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0; margin-top:6px; cursor:zoom-in;"
                onclick="window.open('${m.comprobante_url}', '_blank')">`
        : `<div style="text-align:center; color:#94a3b8; font-size:12px; padding:14px; background:#f8fafc; border-radius:8px; margin-top:6px;">Sin comprobante subido</div>`;

    Swal.fire({
        title: m.insumo || 'Detalle del movimiento',
        html: `
            <div style="text-align:left; font-size:13px; color:#334155; line-height:1.7;">
                ${m.sku ? `<div><b>SKU:</b> ${m.sku}</div>` : ''}
                <div><b>Venta relacionada:</b> ${m.codigo_venta || 'â€”'}</div>
                <div><b>Proveedor:</b> ${m.proveedor || 'â€”'}</div>
                <div><b>CategorÃ­a:</b> ${m.categoria || 'â€”'}</div>
                <div><b>Tipo de gestiÃ³n:</b> ${m.tipo_gestion || 'â€”'}</div>
                <div><b>Cantidad:</b> ${m.cantidad || 1} ${m.unidad || ''}</div>
                <div><b>Precio unitario:</b> S/ ${(m.precio_unit || 0).toFixed(2)}</div>
                <div><b>Subtotal:</b> S/ ${(m.subtotal || 0).toFixed(2)}</div>
                <div><b>Estado de pago:</b> ${m.estado || 'â€”'}</div>
                <div><b>Fecha de pago:</b> ${m.fecha_pago || 'â€”'}</div>
                <div><b>Fecha de recojo:</b> ${m.fecha_recojo || 'â€”'}</div>
                <div style="margin-top:10px;"><b>Comprobante:</b></div>
                ${comprobanteHTML}
            </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#0f172a',
        width: 420,
    });
}
