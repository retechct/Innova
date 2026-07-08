// Taller - pago semanal de carpinteros
// ══════════════════════════════════════════════════════════════════════════════
// PAGO SEMANAL DE CARPINTEROS
// ══════════════════════════════════════════════════════════════════════════════

async function abrirModalPagoSemanal() {
    const hoy    = new Date();
    const dia    = hoy.getDay();
    const lunes  = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1));
    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    const fmt = d => d.toISOString().split('T')[0];

    let carpinteros = [];
    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/carpinteros`);
        carpinteros = await res.json();
    } catch (_) {}

    const opcionesCarpinteros = carpinteros.length
        ? carpinteros.map(n => `<option value="${n}">${n}</option>`).join('')
        : '<option value="">— sin carpinteros registrados —</option>';

    const { value: formValues } = await Swal.fire({
        title: '💰 Cerrar pago semanal',
        html: `
            <div style="text-align:left;font-size:13px;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Carpintero</label>
                <select id="swal-carp" style="width:100%;padding:9px;border:1.5px solid #d1d5db;
                        border-radius:8px;font-size:13px;margin-bottom:12px;">
                    ${opcionesCarpinteros}
                </select>

                <div style="display:flex;gap:10px;margin-bottom:12px;">
                    <div style="flex:1;">
                        <label style="font-weight:700;display:block;margin-bottom:4px;">Semana inicio</label>
                        <input id="swal-inicio" type="date" value="${fmt(lunes)}"
                               style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;box-sizing:border-box;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-weight:700;display:block;margin-bottom:4px;">Semana fin</label>
                        <input id="swal-fin" type="date" value="${fmt(sabado)}"
                               style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;box-sizing:border-box;">
                    </div>
                </div>

                <div id="swal-preview" style="background:#f8fafc;border:1px solid #e2e8f0;
                     border-radius:8px;padding:12px;margin-bottom:12px;min-height:60px;font-size:12px;color:#475569;">
                    <em>Selecciona un carpintero y haz clic en "Ver pendientes"</em>
                </div>

                <button onclick="previewPagoSemanal()"
                        style="width:100%;padding:9px;background:#7c3aed;color:white;border:none;
                               border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px;">
                    🔍 Ver estructuras pendientes
                </button>

                <label style="font-weight:700;display:block;margin-bottom:4px;">Notas (opcional)</label>
                <textarea id="swal-notas" rows="2" placeholder="Ej: Pago por transferencia..."
                          style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                                 font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
            </div>`,
        showCancelButton:   true,
        confirmButtonText:  '✅ Confirmar pago',
        cancelButtonText:   'Cancelar',
        confirmButtonColor: '#15803d',
        width: 520,
        preConfirm: () => ({
            carpintero_nombre: document.getElementById('swal-carp').value,
            semana_inicio:     document.getElementById('swal-inicio').value,
            semana_fin:        document.getElementById('swal-fin').value,
            notas:             document.getElementById('swal-notas').value,
        })
    });

    if (!formValues) return;
    if (!formValues.carpintero_nombre) {
        return Swal.fire('Error', 'Selecciona un carpintero.', 'error');
    }

    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras/cerrar-pago-semanal`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(formValues),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cerrar pago');

        await Swal.fire({
            icon:  'success',
            title: '✅ Pago registrado',
            html: `
                <div style="font-size:14px;text-align:left;line-height:1.8;">
                    <b>Carpintero:</b> ${data.carpintero}<br>
                    <b>Estructuras pagadas:</b> ${data.estructuras_pagadas}<br>
                    <span style="font-size:20px;font-weight:900;color:#15803d;">
                        Total: S/ ${data.monto_total.toFixed(2)}
                    </span>
                </div>`,
        });

        // Recargar vista de stock si está activa
        const c = document.getElementById('sp-sofa-contenido') || document.getElementById('stock-carp-wrapper');
        if (c) await _cargarContenidoStockSofa(c.id, c.id === 'sp-sofa-contenido');

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// Accesible desde el botón inline del Swal
window.previewPagoSemanal = async function () {
    const carpintero = document.getElementById('swal-carp')?.value;
    const inicio     = document.getElementById('swal-inicio')?.value;
    const fin        = document.getElementById('swal-fin')?.value;
    const preview    = document.getElementById('swal-preview');
    if (!carpintero || !inicio || !fin || !preview) return;

    preview.innerHTML = '<em style="color:#94a3b8;">Cargando...</em>';
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras`);
        const data = await res.json();
        const desde = new Date(inicio);
        const hasta = new Date(fin); hasta.setHours(23, 59, 59);

        const pendientes = (Array.isArray(data) ? data : []).filter(e => {
            const nombre = (e.carpintero_nombre || e.chofer_nombre || '').toLowerCase();
            if (nombre !== carpintero.toLowerCase()) return false;
            if (e.pagado) return false;
            if (e.estado !== 'entregado') return false;
            if (e.fecha_entrega_chofer) {
                const fe = new Date(e.fecha_entrega_chofer);
                return fe >= desde && fe <= hasta;
            }
            return false;
        });

        if (!pendientes.length) {
            preview.innerHTML = '<span style="color:#ef4444;">Sin estructuras pendientes en ese rango.</span>';
            return;
        }
        const total = pendientes.reduce((s, e) => s + (parseFloat(e.precio || 0) * parseInt(e.cantidad || 1)), 0);
        preview.innerHTML = `
            <div style="font-weight:700;margin-bottom:6px;color:#0f172a;">${pendientes.length} estructura(s) pendiente(s):</div>
            ${pendientes.map(e => `
                <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:12px;">
                    <span>${e.nombre_modelo || 'Sin modelo'} ×${e.cantidad || 1}</span>
                    <span style="font-weight:700;color:#15803d;">S/ ${(parseFloat(e.precio || 0) * parseInt(e.cantidad || 1)).toFixed(2)}</span>
                </div>`).join('')}
            <div style="text-align:right;font-size:15px;font-weight:900;color:#15803d;margin-top:8px;">
                TOTAL: S/ ${total.toFixed(2)}
            </div>`;
    } catch (_) {
        preview.innerHTML = '<span style="color:#ef4444;">Error al cargar preview.</span>';
    }
};

async function verHistorialPagosCarpinteros() {
    const { value: filtros } = await Swal.fire({
        title: '📋 Historial de pagos',
        html: `
            <div style="text-align:left;font-size:13px;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Carpintero (opcional)</label>
                <input id="hist-carp" type="text" placeholder="Nombre del carpintero"
                       style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                              font-size:13px;box-sizing:border-box;margin-bottom:10px;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Fecha dentro de la semana (opcional)</label>
                <input id="hist-semana" type="date"
                       style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                              font-size:13px;box-sizing:border-box;">
            </div>`,
        showCancelButton:  true,
        confirmButtonText: 'Buscar',
        preConfirm: () => ({
            carpintero: document.getElementById('hist-carp').value.trim(),
            semana:     document.getElementById('hist-semana').value,
        })
    });
    if (!filtros) return;

    const params = new URLSearchParams();
    if (filtros.carpintero) params.set('carpintero', filtros.carpintero);
    if (filtros.semana)     params.set('semana', filtros.semana);

    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras/historial-pagos?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        if (!data.length) return Swal.fire('Sin resultados', 'No se encontraron pagos con esos filtros.', 'info');

        const totalGeneral = data.reduce((s, p) => s + p.monto_total, 0);
        const filas = data.map(p => `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:7px 6px;">${p.carpintero}</td>
                <td style="padding:7px 6px;font-size:11px;white-space:nowrap;">${p.semana_inicio} – ${p.semana_fin}</td>
                <td style="padding:7px 6px;text-align:center;">${p.cantidad_estructuras}</td>
                <td style="padding:7px 6px;text-align:right;font-weight:700;color:#15803d;">S/ ${p.monto_total.toFixed(2)}</td>
                <td style="padding:7px 6px;font-size:11px;color:#64748b;">${p.fecha_pago}</td>
            </tr>`).join('');

        Swal.fire({
            title: '📋 Historial de pagos a carpinteros',
            html: `
                <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
                    <thead><tr style="background:#f1f5f9;font-weight:700;">
                        <th style="padding:8px 6px;">Carpintero</th>
                        <th style="padding:8px 6px;">Semana</th>
                        <th style="padding:8px 6px;text-align:center;">Uds</th>
                        <th style="padding:8px 6px;text-align:right;">Total</th>
                        <th style="padding:8px 6px;">Fecha pago</th>
                    </tr></thead>
                    <tbody>${filas}</tbody>
                    <tfoot><tr style="background:#f0fdf4;font-weight:900;">
                        <td colspan="3" style="padding:8px 6px;text-align:right;">TOTAL GENERAL:</td>
                        <td style="padding:8px 6px;text-align:right;color:#15803d;font-size:14px;">S/ ${totalGeneral.toFixed(2)}</td>
                        <td></td>
                    </tr></tfoot>
                </table></div>`,
            width: 700,
            confirmButtonText: 'Cerrar',
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}


