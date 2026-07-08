// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PESTAÃ‘A 2 â€” HISTORIAL DE PAGOS SEMANALES (sin cambios)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            cont.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Sin pagos registrados aÃºn</div>';
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
                    <th style="${_egTh()}">PerÃ­odo</th>
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
                    <td style="padding:10px;color:#374151;white-space:nowrap;font-size:12px;">${p.semana_inicio} â†’ ${p.semana_fin}</td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:#ede9fe;color:#5b21b6;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;">${p.cantidad_estructuras}</span>
                    </td>
                    <td style="padding:10px;text-align:right;font-weight:800;color:#7c3aed;">S/ ${p.monto_total.toFixed(2)}</td>
                    <td style="padding:10px;color:#64748b;">${p.registrado_por || 'â€”'}</td>
                    <td style="padding:10px;text-align:center;">
                        ${p.voucher_url
                            ? `<a href="${p.voucher_url}" target="_blank" style="color:#16a34a;font-size:16px;" title="Ver voucher"><i class="fa-solid fa-receipt"></i></a>`
                            : `<span style="color:#cbd5e1;font-size:12px;">â€”</span>`}
                    </td>
                    <td style="padding:10px;color:#94a3b8;font-size:12px;">${p.notas || 'â€”'}</td>
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
        cont.innerHTML = _egError('Error de conexiÃ³n: ' + e.message);
    }
}
