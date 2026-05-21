// === MÓDULO: Carrito, pagos y ventas ===
function toggleCart() {
    document.getElementById('cart-slider').classList.toggle('open');
    document.getElementById('overlay-cart').classList.toggle('active');
    if(document.getElementById('cart-slider').classList.contains('open')) {
        document.getElementById('c-emision').value = new Date().toISOString().split('T')[0];
        goToStep(1);
    }
}

function addToCart(name, price, img, details, componentes = {}) {
    cart.push({ name, price, img, details, componentes });
    document.getElementById('cart-count').innerText = cart.length;
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('lista-carrito');
    list.innerHTML = cart.length === 0 ? '<p style="text-align:center; padding:40px; color:gray;">El carrito está vacío</p>' : cart.map((item, i) => `
        <div style="padding:15px; background:#f8fafc; border-radius:15px; margin-bottom:12px; border:1px solid #eee;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--primary); font-size:13px;">${item.name}</strong>
                <strong style="color:var(--success);">S/ ${item.price.toFixed(2)}</strong>
            </div>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">${item.details}</div>
            <div style="text-align:right; margin-top:5px;"><button onclick="removeItem(${i})" style="border:none; color:red; background:none; cursor:pointer; font-size:10px; font-weight:bold;">QUITAR</button></div>
        </div>
    `).join('');
    calcularTotales();
}

function removeItem(i) { cart.splice(i, 1); updateCartUI(); document.getElementById('cart-count').innerText = cart.length; }

/* --- REEMPLAZA ESTA FUNCIÓN COMPLETA --- */
function calcularTotales() {
    // 1. Sumar el total de los muebles en el carrito
    const total = cart.reduce((s, i) => s + i.price, 0);
    
    // 2. Sumar el total de los adelantos usando la nueva lógica de Múltiples Pagos
    let adelanto = 0;
    if (typeof listaPagos !== 'undefined') {
        adelanto = listaPagos.reduce((sum, p) => sum + p.monto, 0);
    }
    
    // 3. Imprimir los resultados en el carrito (protegido por si no existen los IDs)
    const elTotal = document.getElementById('res-total');
    const elAdelanto = document.getElementById('res-adelanto');
    const elSaldo = document.getElementById('res-saldo');

    if (elTotal) elTotal.innerText = `S/ ${total.toFixed(2)}`;
    if (elAdelanto) elAdelanto.innerText = `S/ ${adelanto.toFixed(2)}`;
    if (elSaldo) elSaldo.innerText = `S/ ${(total - adelanto).toFixed(2)}`;
}

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    for(let i = 1; i <= step; i++) document.getElementById(`s${i}`).classList.add('active');
    
    const btn = document.getElementById('btn-main');
    if(step === 1) btn.innerHTML = 'CONTINUAR A CLIENTE <i class="fa-solid fa-arrow-right"></i>';
    else if(step === 2) btn.innerHTML = 'CONTINUAR A PAGO <i class="fa-solid fa-arrow-right"></i>';
    else btn.innerHTML = '<i class="fa-solid fa-print"></i> FINALIZAR VENTA';
}

function handleNextStep() {
    if (currentStep === 1) { 
        if (cart.length === 0) return Swal.fire('Vacío', 'Agregue productos al carrito', 'info'); 
        goToStep(2); 
    }
    else if (currentStep === 2) { 
        // 1. Capturamos todos los datos importantes
        const codigo = document.getElementById('c-codigo').value;
        const nombre = document.getElementById('c-nombre').value;
        const dni = document.getElementById('c-dni').value;
        const celular = document.getElementById('c-celular').value;

        // 2. VALIDACIÓN: Obligamos a que DNI y Celular estén llenos
        if (!codigo || !nombre || !dni || !celular) {
            return Swal.fire({
                title: 'Faltan Datos',
                text: 'El N° de Contrato, Nombre, DNI y Celular son obligatorios para poder generar el contrato.',
                icon: 'warning',
                confirmButtonColor: '#d4af37'
            });
        }
        goToStep(3); 
    }
    else { 
        guardarVenta(); 
    }
}
// NOTA: listaPagos se declara en config.js — no redeclarar aquí
// NUEVA FUNCIÓN: Mostrar input de tipo de cambio si es USD
function toggleTipoCambio() {
    const moneda = document.getElementById('v-moneda').value;
    document.getElementById('v-tipo-cambio').style.display = moneda === 'USD' ? 'block' : 'none';
}

function actualizarCamposPago() {
    const tipo = document.getElementById('pago-tipo').value;
    const entidad = document.getElementById('pago-entidad');
    const operacion = document.getElementById('pago-operacion');
    const divComision = document.getElementById('div-comision-pos'); // NUEVO

    // Limpiamos los valores previos
    entidad.innerHTML = '';
    operacion.value = '';
    if(document.getElementById('pago-comision')) document.getElementById('pago-comision').value = ''; 

    if (tipo === 'Transferencia') {
        entidad.style.display = 'block';
        operacion.style.display = 'block';
        if(divComision) divComision.style.display = 'none'; 
        entidad.innerHTML = `
            <option value="BCP">BCP</option>
            <option value="BBVA">BBVA</option>
            <option value="Yape">Yape</option>
            <option value="Plin">Plin</option>
        `;
    } else if (tipo === 'POS') {
        entidad.style.display = 'block';
        operacion.style.display = 'block'; 
        if(divComision) divComision.style.display = 'block'; // Mostrar comisión
        entidad.innerHTML = `
            <option value="Izipay">Izipay</option>
            <option value="Niubis">Niubis</option>
            <option value="Culqui">Culqui</option>
            <option value="Openpay">Openpay</option>
        `;
    } else {
        // Efectivo
        entidad.style.display = 'none';
        operacion.style.display = 'none';
        if(divComision) divComision.style.display = 'none'; 
    }
}

function limpiarFormularioVenta() {
    const camposCliente = ['c-codigo', 'c-nombre', 'c-dni', 'c-celular', 'c-direccion', 'c-entrega'];
    camposCliente.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

    listaPagos = [];
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-operacion').value = '';
    document.getElementById('pago-comprobante').value = '';
    document.getElementById('pago-tipo').value = 'Efectivo';
    
    // NUEVO: Limpiar comisión y resetear moneda a Soles
    if(document.getElementById('pago-comision')) document.getElementById('pago-comision').value = '';
    if(document.getElementById('v-moneda')) document.getElementById('v-moneda').value = 'PEN';
    if(document.getElementById('v-tipo-cambio')) {
        document.getElementById('v-tipo-cambio').value = '';
        document.getElementById('v-tipo-cambio').style.display = 'none';
    }

    actualizarCamposPago(); 
    actualizarPagosUI();
    
    goToStep(1);
}

async function agregarMetodoPago() {
    const tipo = document.getElementById('pago-tipo').value;
    const entidad = document.getElementById('pago-entidad').style.display !== 'none' ? document.getElementById('pago-entidad').value : '';
    const operacion = document.getElementById('pago-operacion').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const empresa = document.getElementById('pago-empresa').value;
    const comprobanteInput = document.getElementById('pago-comprobante');

    // Captura de comisión si es POS
    let comision = 0;
    if (tipo === 'POS') {
        comision = parseFloat(document.getElementById('pago-comision').value) || 0;
    }

    if (isNaN(monto) || monto <= 0) return Swal.fire('Error', 'Ingrese un monto mayor a 0', 'warning');
    if (!empresa) return Swal.fire('Falta empresa', '¿A qué empresa entró el dinero? Selecciona una.', 'warning');
    if (tipo !== 'Efectivo' && operacion.trim() === '') return Swal.fire('Error', 'El Número de Operación es obligatorio para transferencias o POS', 'warning');

    // Validación obligatoria de foto
    if (comprobanteInput.files.length === 0) {
        return Swal.fire('Comprobante Requerido', 'Debes subir la foto del voucher o recibo firmado para registrar el pago.', 'warning');
    }

    // *** SUBIR FOTO A CLOUDINARY AHORA (antes de agregar a listaPagos) ***
    Swal.fire({ title: 'Subiendo voucher...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    let comprobante_url = 'Sin imagen';
    try {
        const formDataFoto = new FormData();
        formDataFoto.append('archivo', comprobanteInput.files[0]);
        const res = await fetch(`${API_URL}/api/upload-voucher`, {
            method: 'POST',
            body: formDataFoto
        });
        if (!res.ok) throw new Error('Error al subir la imagen');
        const data = await res.json();
        comprobante_url = data.url;
        Swal.close();
    } catch (e) {
        Swal.close();
        return Swal.fire('Error', 'No se pudo subir la foto del voucher. Verifica tu conexión.', 'error');
    }

    const montoNeto = monto - comision;

    listaPagos.push({ 
        tipo, 
        entidad, 
        operacion, 
        monto,
        comision: comision,
        monto_neto: montoNeto,
        empresa,
        comprobante_url  // URL real de Cloudinary
    });

    // Resetear inputs después de agregar
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-operacion').value = '';
    document.getElementById('pago-empresa').value = '';
    if(document.getElementById('pago-comision')) document.getElementById('pago-comision').value = '';
    comprobanteInput.value = '';
    
    actualizarPagosUI();
}


// Validación dinámica del documento según tipo
function actualizarValidacionDoc() {
    const tipo = document.getElementById('c-tipo-doc').value;
    const input = document.getElementById('c-dni');
    if (tipo === 'DNI') {
        input.maxLength = 8;
        input.placeholder = 'DNI (8 dígitos)';
        input.type = 'number';
    } else if (tipo === 'RUC') {
        input.maxLength = 11;
        input.placeholder = 'RUC (11 dígitos)';
        input.type = 'number';
    } else {
        input.maxLength = 20;
        input.placeholder = 'Número de carnet';
        input.type = 'text';
    }
}

// Exportar ventas a Excel
async function exportarVentas() {
    Swal.fire({ title: 'Generando Excel...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        const res = await fetch(`${API_URL}/api/ventas/exportar`);
        if (!res.ok) throw new Error('Error del servidor');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas_innova_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: '¡Excel descargado!', timer: 2000, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', 'No se pudo generar el archivo.', 'error');
    }
}

function eliminarPago(index) {
    listaPagos.splice(index, 1);
    actualizarPagosUI();
}

function actualizarPagosUI() {
    const container = document.getElementById('lista-pagos-agregados');
    const totalAdelanto = listaPagos.reduce((sum, p) => sum + p.monto, 0);
    
    container.innerHTML = listaPagos.map((p, i) => {
        const detalle = p.tipo === 'Efectivo' ? 'Efectivo' : `${p.entidad} (Op: ${p.operacion})`;
        const iconoComprobante = p.comprobante_nombre !== 'Sin comprobante' ? '<i class="fa-solid fa-image" style="color: var(--primary);"></i>' : '';
        const empresaTag = p.empresa ? `<span style="font-size:10px; background:#f0fdf4; color:#166534; padding:2px 6px; border-radius:4px; font-weight:800;">${p.empresa}</span>` : '';
        
        return `
        <div style="background:#fff; border-left: 4px solid var(--accent); padding:8px 10px; border-radius:5px; margin-bottom:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items: center;">
                <div>
                    <strong style="font-size: 13px;">${p.tipo}</strong> <span style="font-size: 11px; color: gray;">${iconoComprobante}</span><br>
                    <span style="font-size: 11px; color: var(--text-muted);">${detalle}</span><br>
                    ${empresaTag}
                </div>
                <div style="text-align: right;">
                    <strong style="color: var(--success); font-size: 14px;">S/ ${p.monto.toFixed(2)}</strong><br>
                    <button onclick="eliminarPago(${i})" style="border:none; color:red; background:none; cursor:pointer; font-size: 10px; font-weight: bold; margin-top: 3px;">QUITAR</button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const totalVenta = cart.reduce((s, i) => s + i.price, 0);
    document.getElementById('res-total').innerText = `S/ ${totalVenta.toFixed(2)}`;
    document.getElementById('res-adelanto').innerText = `S/ ${totalAdelanto.toFixed(2)}`;
    document.getElementById('res-saldo').innerText = `S/ ${(totalVenta - totalAdelanto).toFixed(2)}`;
}
/* ================================================================= */
/* --- LÓGICA DEL CONFIGURADOR DE COMEDORES (Y VENTAS) --- */
/* ================================================================= */

async function guardarVenta() {
    // Validaciones de seguridad antes de procesar
    if (cart.length === 0) return Swal.fire('Carrito Vacío', 'No hay muebles en la cotización.', 'warning');
    if (listaPagos.length === 0) return Swal.fire('Falta Pago', 'Debes registrar al menos un adelanto o método de pago.', 'warning');

    const total = cart.reduce((s, i) => s + i.price, 0);
    
    // Captura de los campos financieros
    const monedaActiva = document.getElementById('v-moneda') ? document.getElementById('v-moneda').value : 'PEN';
    const tipoCambioActivo = document.getElementById('v-tipo-cambio') ? (parseFloat(document.getElementById('v-tipo-cambio').value) || 1.00) : 1.00;
    const tipoComprobanteActivo = document.getElementById('c-comprobante-tipo') ? document.getElementById('c-comprobante-tipo').value : 'Boleta';

    const payload = {
        codigo: document.getElementById('c-codigo').value,
        cliente: document.getElementById('c-nombre').value,
        tipo_documento: document.getElementById('c-tipo-doc') ? document.getElementById('c-tipo-doc').value : 'DNI',
        dni: document.getElementById('c-dni').value,
        celular: document.getElementById('c-celular').value,
        direccion: document.getElementById('c-direccion').value,
        fecha_emision: document.getElementById('c-emision').value,
        fecha_entrega: document.getElementById('c-entrega').value || null,
        
        monto_total: total,
        moneda: monedaActiva,
        tipo_cambio: tipoCambioActivo,
        tipo_comprobante: tipoComprobanteActivo,
        pagos: listaPagos, // Ya tienen comprobante_url real de Cloudinary

        vendedor_id: usuarioActivo.id,
        vendedor_nombre: usuarioActivo.nombre,
        empresa_ruc: usuarioActivo.ruc,

        muebles: cart.map(c => ({ 
            tipo: c.name, 
            precio: c.price, 
            tela: typeof c.details === 'object' ? JSON.stringify(c.details) : (c.details || "Venta Estándar"), 
            foto: c.img,
            componentes: c.componentes
        }))
    };
    
    Swal.fire({ title: 'Guardando en Base de Datos...', didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/ventas`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Swal.fire({
                title: '¡Venta Exitosa!',
                text: '¿Deseas imprimir el contrato profesional?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Sí, Imprimir',
                cancelButtonText: 'Cerrar',
                confirmButtonColor: '#d4af37' 
            }).then((result) => {
                if (result.isConfirmed) {
                    imprimirContratoElegante();
                }
                if (typeof limpiarFormularioVenta === 'function') {
                    limpiarFormularioVenta();
                } else {
                    cart = [];
                    listaPagos = [];
                    document.getElementById('cart-count').innerText = "0";
                }
                toggleCart();
                changeView('pedidos'); 
            });
        } else {
            const err = await res.json();
            Swal.fire('No se pudo guardar', err.error || 'Error desconocido del servidor', 'error');
        }
    } catch(e) {
        Swal.fire({
            title: 'Sin conexión',
            html: 'No se pudo contactar al servidor.<br><b>La venta NO fue guardada.</b><br><small>Verifica tu conexión y vuelve a intentarlo.</small>',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
    }
}

// ==========================================
// SOLICITUD DE CAMBIO DE PRECIO (Vendedor → Admin)
// ==========================================
async function solicitarCambioPrecio(codigoVenta, precioActual) {
    const { value: formValues } = await Swal.fire({
        title: 'Solicitar Cambio de Precio',
        html: `
            <p style="font-size:12px; color:gray; margin-bottom:10px;">Precio actual: <strong>S/ ${parseFloat(precioActual).toFixed(2)}</strong></p>
            <input id="swal-precio-nuevo" type="number" class="swal2-input" placeholder="Nuevo precio total (S/)" min="1" step="0.01">
            <textarea id="swal-motivo" class="swal2-textarea" placeholder="Motivo del cambio (obligatorio)" style="height:80px;"></textarea>
        `,
        confirmButtonText: 'Enviar al Admin',
        confirmButtonColor: '#d4af37',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const precio = parseFloat(document.getElementById('swal-precio-nuevo').value);
            const motivo = document.getElementById('swal-motivo').value.trim();
            if (!precio || precio <= 0) { Swal.showValidationMessage('Ingresa un precio válido'); return false; }
            if (!motivo) { Swal.showValidationMessage('El motivo es obligatorio'); return false; }
            return { precio, motivo };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_URL}/api/ventas/${codigoVenta}/proponer-cambio-precio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                precio_nuevo: formValues.precio,
                motivo: formValues.motivo,
                vendedor_id: usuarioActivo.id,
                vendedor_nombre: usuarioActivo.nombre
            })
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire('Solicitud Enviada', 'El administrador revisará el cambio de precio y te notificará.', 'success');
        } else {
            Swal.fire('Error', data.error || 'No se pudo enviar la solicitud', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Sin conexión al servidor', 'error');
    }
}
// ==========================================
// NUEVO: FUNCIONES PARA CREACIONES DE VENDEDOR (CORREGIDO PARA SOFÁS Y COMEDORES)
// ==========================================

function imprimirContratoElegante() {
    // 1. CAPTURA DE DATOS (IDs de tu HTML)
    const nroContrato = document.getElementById('c-codigo').value || '00000';
    const nombreCliente = document.getElementById('c-nombre').value || '---';
    const dniCliente = document.getElementById('c-dni').value || '---';
    const celCliente = document.getElementById('c-celular').value || '---';
    const direccionEntrega = document.getElementById('c-direccion').value || '---';
    const fechaEmision = document.getElementById('c-emision').value || new Date().toLocaleDateString('es-PE');
    const fechaEntrega = document.getElementById('c-entrega').value || '---';

    const totalVenta = document.getElementById('res-total').innerText || 'S/ 0.00';
    const totalPagado = document.getElementById('res-adelanto').innerText || 'S/ 0.00';
    const saldoPendiente = document.getElementById('res-saldo').innerText || 'S/ 0.00';

   // 2. GENERAR FILAS DE PRODUCTOS CON MATRIZ TÉCNICA
    let filasItems = '';
    cart.forEach((item, index) => {
        let detalleHTML = "";
        
        // ¡CORRECCIÓN!: Ahora leemos la variable correcta de tu carrito (item.details)
        if (item.details) {
            // Si por si acaso es un objeto (como en catálogos muy antiguos)
            if (typeof item.details === 'object') {
                detalleHTML += `<table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 10px;">`;
                for (const [key, value] of Object.entries(item.details)) {
                    detalleHTML += `
                        <tr>
                            <td style="padding: 3px 5px; border-bottom: 1px solid #e2e8f0; width: 30%; color: #64748b; font-weight: bold; text-transform: uppercase;">${key}:</td>
                            <td style="padding: 3px 5px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${value}</td>
                        </tr>`;
                }
                detalleHTML += `</table>`;
            } else {
                // Si es texto (Como vienen los Sofás Personalizados y Plantillas)
                detalleHTML = `<div style="padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">${item.details}</div>`;
            }
        } else {
            // Solo si realmente está vacío
            detalleHTML = `<div style="padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">Especificaciones estándar de fabricación.</div>`;
        }

        // Diseño visual con la variable corregida
        filasItems += `
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b; vertical-align: top;">${index + 1}</td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <div style="font-weight: 900; color: #0f172a; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">${item.name}</div>
                    
                    <div style="background: #f8fafc; border-left: 3px solid #d4af37; padding: 8px; font-size: 10.5px; color: #334155; line-height: 1.5; border-radius: 0 4px 4px 0;">
                        ${detalleHTML}
                    </div>
                    
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 900; color: #0f172a; vertical-align: top;">S/ ${parseFloat(item.price).toFixed(2)}</td>
            </tr>`;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
    <html>
    <head>
        <title>Innova Mobili - Contrato ${nroContrato}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap');
            
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #333; margin: 0; padding: 0; background-color: #fff; }
            .page { width: 210mm; min-height: 297mm; padding: 15mm; margin: auto; position: relative; box-sizing: border-box; overflow: hidden; }
            
            /* DECORACIÓN GEOMÉTRICA (Estilo Carey) */
            .corner-top { position: absolute; top: -50px; right: -50px; width: 250px; height: 250px; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); transform: rotate(45deg); z-index: 0; opacity: 0.9; }
            .corner-top-inner { position: absolute; top: 0; right: 80px; width: 100px; height: 300px; background: #e5e7eb; transform: rotate(45deg); z-index: -1; }
            .corner-bottom { position: absolute; bottom: -80px; left: -80px; width: 280px; height: 280px; background: #1f2937; transform: rotate(45deg); z-index: 0; }
            .corner-bottom-accent { position: absolute; bottom: 40px; left: 80px; width: 40px; height: 200px; background: #d4af37; transform: rotate(45deg); z-index: -1; }

            .content { position: relative; z-index: 10; }

            /* HEADER */
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .logo { height: 100px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.1)); }
            .contract-title { text-align: right; }
            .contract-title h1 { font-family: 'Playfair Display', serif; font-size: 32px; margin: 0; color: #1a1a1a; letter-spacing: 1px; }
            .contract-title p { margin: 5px 0; font-weight: 800; color: #ffffff; font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }

            /* INFO CLIENTE */
            .client-section { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; margin-bottom: 30px; background: rgba(249, 250, 251, 0.8); padding: 20px; border-radius: 4px; border-left: 5px solid #d4af37; }
            .info-box div { margin-bottom: 8px; font-size: 12px; }
            .info-box strong { color: #1f2937; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; display: inline-block; width: 110px; }

            /* TABLA */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            thead th { background: #1f2937; color: white; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            
            /* TOTALES */
            .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 30px; }
            .total-table { width: 280px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px; font-size: 12px; border-bottom: 1px solid #eee; }
            .total-row.final { background: #d4af37; color: white; font-weight: 800; font-size: 18px; border-radius: 4px; margin-top: 5px; }

            /* FIRMAS */
            .signature-section { display: flex; justify-content: space-around; margin-top: 80px; }
            .sig-block { width: 250px; border-top: 2px solid #1a1a1a; text-align: center; padding-top: 10px; }
            .sig-block p { margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; }

            /* PÁGINA 2 */
            .page-break { page-break-before: always; }
            .terms-header { text-align: center; margin-bottom: 40px; }
            .terms-header h2 { font-family: 'Playfair Display', serif; font-size: 24px; border-bottom: 2px solid #d4af37; display: inline-block; padding-bottom: 10px; }
            .terms-body { font-size: 11.5px; line-height: 1.8; text-align: justify; color: #444; padding: 0 20px; }
            .terms-body h4 { color: #b8860b; margin-bottom: 5px; text-transform: uppercase; }

            .warranty-stamp { margin-top: 50px; border: 3px double #d4af37; padding: 20px; text-align: center; font-weight: 800; background: #fffcf0; }

            @media print {
                body { -webkit-print-color-adjust: exact; }
                .page { margin: 0; border: none; }
            }
        </style>
    </head>
    <body>
        <div class="page">
            <div class="corner-top"></div>
            <div class="corner-top-inner"></div>
            
            <div class="content">
           <div class="header">
                    <img src="imagenes/Logo3.png" class="logo">
                    <div class="contract-title">
                        <h1>${typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.empresa : 'INNOVA MOBILI'}</h1>
                        <p>RUC: ${typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.ruc : '---'}</p>
                        <div style="margin-top: 5px; font-size: 18px; font-weight: 900; color: #1a1a1a; font-family: 'Plus Jakarta Sans', sans-serif;">N° ${nroContrato}</div>
                    </div>
                </div>
        </div>
                <div class="client-section">
                    <div class="info-box">
                        <div><strong>Cliente:</strong> ${nombreCliente}</div>
                        <div><strong>DNI / RUC:</strong> ${dniCliente}</div>
                        <div><strong>Dirección:</strong> ${direccionEntrega}</div>
                    </div>
                    <div class="info-box">
                        <div><strong>Emisión:</strong> ${fechaEmision}</div>
                        <div><strong>Entrega:</strong> <span style="background-color: #fef08a; color: #1a1a1a; font-weight: 900; padding: 2px 6px; border-radius: 3px;">${fechaEntrega}</span></div>
                        <div><strong>Celular:</strong> ${celCliente}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th>Ficha Técnica del Mueble</th>
                            <th style="width:120px; text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasItems}
                    </tbody>
                </table>

                <div class="summary-wrapper">
                    <div class="total-table">
                        <div class="total-row"><span>Total Venta</span> <span>${totalVenta}</span></div>
                        <div class="total-row" style="color:#059669; font-weight: 800;"><span>Adelanto / Pagado</span> <span>${totalPagado}</span></div>
                        <div class="total-row final"><span>SALDO PEND.</span> <span>${saldoPendiente}</span></div>
                    </div>
                </div>

               <div class="signature-section">
                    <div class="sig-block">
                        <p>Firma del Cliente</p>
                        <span style="font-size:8px;">DNI: ${dniCliente}</span>
                    </div>
                    <div class="sig-block">
                        <p>Innova Mobili</p>
                        <span style="font-size:8px; display:block; margin-bottom: 5px;">Departamento Comercial</span>
                        <span style="font-size:10px; font-weight:800; color:#1f2937; background:#f1f5f9; padding:3px 8px; border-radius:4px;">
                            Atendido por: ${usuarioActivo ? usuarioActivo.nombre : 'Vendedor'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="corner-bottom"></div>
            <div class="corner-bottom-accent"></div>
        </div>

    
<div class="page page-break" style="position:relative; background:#fff; padding:14mm; min-height:297mm; box-sizing:border-box; overflow:hidden;">

    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.05; z-index:0; width:55%; pointer-events:none;">
        <img src="imagenes/Logo2.png" style="width:100%;">
    </div>

    <div class="content" style="position:relative; z-index:10;">

        <div style="text-align:center; margin-bottom:18px;">
            <h2 style="font-family:'Playfair Display', serif; font-size:18px; color:#1a1a1a; margin:0; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #d4af37; display:inline-block; padding-bottom:6px;">
                TÉRMINOS Y CONDICIONES DE VENTA
            </h2>
        </div>

        <div style="font-size:9pt; line-height:1.35; text-align:justify; color:#222; font-family:'Plus Jakarta Sans', sans-serif;">

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    1. DE LA ELABORACIÓN Y PEDIDOS PERSONALIZADOS
                </h4>
                <p style="margin:0 0 5px 0;">Todos nuestros productos son fabricados bajo pedido y personalizados según las especificaciones (medidas, colores, materiales y diseño) proporcionadas por el cliente.</p>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Aceptación de Diseño:</strong> Al firmar la orden de trabajo o realizar el abono inicial, el cliente declara su conformidad con las especificaciones técnicas detalladas, conforme al principio de autonomía de la voluntad establecido en el Código Civil peruano (art. 1354).</li>
                    <li style="margin-bottom:4px;"><strong>Cambios:</strong> Una vez iniciada la etapa de corte o fabricación, no se aceptarán modificaciones al diseño original. Cualquier cambio posterior generará un costo adicional y afectará la fecha de entrega.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Código Civil - arts. 1351, 1354 (formación y contenido del contrato).</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    2. POLÍTICA DE NO DEVOLUCIÓN DE DINERO
                </h4>
                <p style="margin:0 0 5px 0;">De conformidad con la naturaleza del producto (bienes confeccionados conforme a las especificaciones del consumidor), no se realizan devoluciones de dinero ni cambios de producto una vez aceptado el contrato y realizado el pago (total o parcial). La empresa garantiza la entrega de un producto funcional y conforme a lo pactado.</p>
                <p style="margin:0;"><small><strong>Base legal:</strong> Código Civil - art. 1361 (obligatoriedad del contrato).</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    3. PRECIOS Y PROMOCIONES
                </h4>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Canales de Venta:</strong> Los precios, descuentos y promociones publicados en redes sociales (Facebook, Instagram, WhatsApp, etc.) son exclusivos para compras por dichos medios y pueden variar respecto a los precios vigentes en tienda física.</li>
                    <li style="margin-bottom:4px;"><strong>Vigencia:</strong> Las promociones tienen una duración limitada y están sujetas a cambios sin previo aviso hasta que se formalice el pedido con el pago correspondiente.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 Código de Protección y Defensa del Consumidor arts. 14 y 18.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    4. VERIFICACIÓN E INSTALACIÓN
                </h4>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Responsabilidad del Cliente:</strong> Es deber del cliente asegurar que los accesos (puertas, ascensores, pasadizos) permitan el ingreso del mueble.</li>
                    <li style="margin-bottom:4px;"><strong>Inspección:</strong> Todo producto será verificado por el cliente previo a la cancelación total y antes de la instalación.</li>
                    <li style="margin-bottom:4px;"><strong>Conformidad:</strong> Al finalizar la instalación, el cliente deberá firmar un acta de conformidad. La empresa no se responsabiliza por daños estéticos reportados con posterioridad al retiro del personal técnico.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 - art. 19 y Código Civil - art. 1314.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    5. COMPROBANTES DE PAGO Y SUNAT
                </h4>
                <p style="margin:0 0 5px 0;">Según lo dispuesto por la SUNAT, la emisión de Nota de Crédito solo procede para anular operaciones que cumplan con los requisitos legales.</p>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Elección del Comprobante:</strong> El cliente debe decidir si requiere Boleta de Venta o Factura al momento de la compra. Una vez emitido el documento, no procede el cambio entre estos.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> SUNAT - Reglamento de Comprobantes de Pago.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    6. GARANTÍA
                </h4>
                <p style="margin:0 0 5px 0;">Todo producto cuenta con una garantía de 1 año contra defectos de fabricación o fallas estructurales. <strong>La garantía no cubre:</strong></p>
                <ul style="margin:0; padding-left:18px; columns:2;">
                    <li>Daños por mal uso</li>
                    <li>Exposición a humedad extrema</li>
                    <li>Uso de productos abrasivos</li>
                    <li>Manipulaciones por terceros</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 - arts. 18, 19 y 20.</small></p>
            </div>

            <div style="margin-bottom:0;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    7. DISPOSICIONES FINALES
                </h4>
                <p style="margin:0;">Cualquier situación no prevista en estos términos se regirá por la normativa vigente del ordenamiento jurídico peruano.</p>
                <div class="warranty-stamp">GARANTÍA: TODO PRODUCTO CUENTA CON 1 AÑO DE GARANTÍA ESTRUCTURAL</div>
            </div>
        </div>
    </div>
</div>
    </body>
    </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 500); };
}
// ==========================================
// MÓDULO DE TALLER: DETALLES E IMPRESIÓN
// ==========================================