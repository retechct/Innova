// Venta rapida: entrada controlada al carrito para ventas parche sin stock completo.
async function _vrSubirFoto(file) {
    if (!file) return '';
    const fd = new FormData();
    fd.append('foto', file);
    const res = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'No se pudo subir la foto');
    return data.url || '';
}

function _vrSedesOpciones() {
    const sedeActual = usuarioActivo?.tienda || 'Sede Central';
    const sedes = [sedeActual, 'Sede Central', 'Tienda Surco', 'Tienda San Miguel', 'Almacen', 'Otra']
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i);
    return sedes.map(s => `<option value="${s}" ${s === sedeActual ? 'selected' : ''}>${s}</option>`).join('');
}

function _vrPreviewInput(input) {
    const file = input?.files?.[0];
    const img = document.getElementById('vr-preview-img');
    const box = document.getElementById('vr-preview-box');
    if (!file || !img || !box) return;
    img.src = URL.createObjectURL(file);
    box.style.display = 'block';
}

async function abrirModalVentaRapida() {
    const sedesHtml = _vrSedesOpciones();
    const { value: form } = await Swal.fire({
        title: '<i class="fa-solid fa-bolt" style="color:#d97706;"></i> Venta rapida',
        html: `
            <div style="text-align:left;display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">Nombre *</label>
                    <input id="vr-nombre" class="swal2-input" style="margin:5px 0 0;width:100%;box-sizing:border-box;" placeholder="Ej: Mesa de centro exhibicion">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">Descripcion *</label>
                    <textarea id="vr-desc" class="swal2-textarea" style="margin:5px 0 0;width:100%;box-sizing:border-box;min-height:86px;" placeholder="Medidas, material, estado, color, observaciones..."></textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">Precio S/ *</label>
                        <input id="vr-precio" type="number" min="1" step="0.01" class="swal2-input" style="margin:5px 0 0;width:100%;box-sizing:border-box;" placeholder="0.00">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">Sede *</label>
                        <select id="vr-sede" class="swal2-input" style="margin:5px 0 0;width:100%;box-sizing:border-box;">${sedesHtml}</select>
                    </div>
                </div>
                <div>
                    <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">Foto de referencia</label>
                    <input id="vr-foto" type="file" accept="image/*" onchange="_vrPreviewInput(this)"
                           style="margin:5px 0 0;width:100%;box-sizing:border-box;padding:8px;border:2px dashed #cbd5e1;border-radius:8px;font-size:13px;">
                    <div id="vr-preview-box" style="display:none;margin-top:8px;">
                        <img id="vr-preview-img" src="" style="width:100%;max-height:180px;object-fit:contain;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                    </div>
                </div>
                <p style="margin:2px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;">
                    Entra al carrito como Venta Rapida. No descuenta stock automaticamente.
                </p>
            </div>
        `,
        width: '560px',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-cart-plus"></i> Agregar al carrito',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706',
        preConfirm: () => {
            const nombre = document.getElementById('vr-nombre')?.value.trim();
            const descripcion = document.getElementById('vr-desc')?.value.trim();
            const precio = parseFloat(document.getElementById('vr-precio')?.value || 0);
            const sede = document.getElementById('vr-sede')?.value || '';
            const foto = document.getElementById('vr-foto')?.files?.[0] || null;
            if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
            if (!descripcion) { Swal.showValidationMessage('La descripcion es obligatoria'); return false; }
            if (!precio || precio <= 0) { Swal.showValidationMessage('Ingresa un precio valido'); return false; }
            if (!sede) { Swal.showValidationMessage('Selecciona una sede'); return false; }
            return { nombre, descripcion, precio, sede, foto };
        }
    });
    if (!form) return;

    try {
        Swal.fire({ title: 'Preparando venta rapida...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const fotoUrl = await _vrSubirFoto(form.foto);
        const detalles = `
            <b>VENTA RAPIDA</b><br>
            <b>Sede:</b> ${form.sede}<br>
            <b>Descripcion:</b> ${form.descripcion}<br>
            <span style="color:#b45309;font-weight:700;">No descuenta stock automaticamente.</span>
        `;
        const componentes = {
            venta_rapida: true,
            sede: form.sede,
            descripcion: form.descripcion
        };
        addToCart(form.nombre, form.precio, fotoUrl || 'imagenes/sin_foto.jpg', detalles, componentes, 'Venta Rapida');
        Swal.fire({
            icon: 'success',
            title: 'Agregado al carrito',
            text: 'Completa cliente y pago para registrar el pedido.',
            timer: 1700,
            showConfirmButton: false
        });
        if (!document.getElementById('cart-slider')?.classList.contains('open')) toggleCart();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo preparar la venta rapida.', 'error');
    }
}

window.abrirModalVentaRapida = abrirModalVentaRapida;
window._vrPreviewInput = _vrPreviewInput;
