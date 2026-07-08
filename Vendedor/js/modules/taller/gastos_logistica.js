// Taller - gastos de logistica
// ══════════════════════════════════════════════════════════════════════════════
// GASTOS DE LOGÍSTICA / FLETE
// ══════════════════════════════════════════════════════════════════════════════

async function abrirModalGastoLogistica() {
    const hoy = new Date().toISOString().split('T')[0];

    const { value: formValues } = await Swal.fire({
        title: '➕ Registrar gasto de logística',
        html: `
            <div style="text-align:left;font-size:13px;">
                <label style="font-weight:700;display:block;margin-bottom:4px;">Concepto *</label>
                <input id="gl-concepto" type="text" placeholder="Ej: Flete Lima – Ate"
                       style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                              font-size:13px;box-sizing:border-box;margin-bottom:10px;">

                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;">
                        <label style="font-weight:700;display:block;margin-bottom:4px;">Monto (S/) *</label>
                        <input id="gl-monto" type="number" min="0" step="0.01" placeholder="0.00"
                               style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                                      font-size:13px;box-sizing:border-box;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-weight:700;display:block;margin-bottom:4px;">Fecha *</label>
                        <input id="gl-fecha" type="date" value="${hoy}"
                               style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                                      font-size:13px;box-sizing:border-box;">
                    </div>
                </div>

                <label style="font-weight:700;display:block;margin-bottom:4px;">Categoría</label>
                <select id="gl-categoria"
                        style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                               font-size:13px;margin-bottom:10px;">
                    <option value="Flete">🚛 Flete</option>
                    <option value="Transporte">🚐 Transporte</option>
                    <option value="Compra directa">🛒 Compra directa</option>
                    <option value="Otro">📦 Otro</option>
                </select>

                <label style="font-weight:700;display:block;margin-bottom:4px;">Proveedor / Chofer (opcional)</label>
                <input id="gl-proveedor" type="text" placeholder="Nombre libre"
                       style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                              font-size:13px;box-sizing:border-box;margin-bottom:10px;">

                <label style="font-weight:700;display:block;margin-bottom:4px;">Notas (opcional)</label>
                <textarea id="gl-notas" rows="2"
                          style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;
                                 font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
            </div>`,
        showCancelButton:   true,
        confirmButtonText:  '💾 Guardar gasto',
        cancelButtonText:   'Cancelar',
        confirmButtonColor: '#0369a1',
        width: 500,
        preConfirm: () => {
            const concepto = document.getElementById('gl-concepto').value.trim();
            const monto    = document.getElementById('gl-monto').value;
            if (!concepto) { Swal.showValidationMessage('El concepto es obligatorio'); return false; }
            if (!monto || isNaN(parseFloat(monto))) { Swal.showValidationMessage('Ingresa un monto válido'); return false; }
            return {
                concepto,
                monto:            parseFloat(monto),
                categoria:        document.getElementById('gl-categoria').value,
                proveedor_nombre: document.getElementById('gl-proveedor').value.trim() || null,
                fecha_gasto:      document.getElementById('gl-fecha').value,
                notas:            document.getElementById('gl-notas').value.trim() || null,
            };
        }
    });

    if (!formValues) return;

    try {
        const res  = await apiFetch(`${API_URL}/api/logistica/gasto`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(formValues),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar el gasto');

        Swal.fire({
            icon:                'success',
            title:               '✅ Gasto registrado',
            text:                `${formValues.concepto} — S/ ${formValues.monto.toFixed(2)}`,
            timer:               2000,
            showConfirmButton:   false,
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}
