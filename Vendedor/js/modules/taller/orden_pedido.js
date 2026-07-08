// Taller - orden de pedido, impresion y PDF
// === MÓDULO: Taller, producción y admin ===
async function abrirDetallePedido(codigo) {
    try {
        Swal.fire({ title: 'Buscando ficha de taller...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/pedido/detalle/${codigo}`);
        const data = await res.json();

        if(data.error) return Swal.fire('Error', data.error, 'error');

        const totalPedido = (data.items || []).reduce((s, it) => s + (it.precio || 0), 0);

        let itemsHTML = data.items.map(item => {
            // FIX (julio 2026): item.fotos trae TODAS las imágenes que el
            // vendedor eligió del catálogo para esta pieza (antes solo
            // llegaba una). Con fallback a item.foto por si es un pedido
            // viejo guardado antes de este cambio.
            const fotosItem = (item.fotos && item.fotos.length) ? item.fotos : (item.foto ? [item.foto] : []);
            const foto = fotosItem[0] || 'imagenes/sin_foto.jpg';
            const miniaturas = fotosItem.length > 1
                ? `<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                    ${fotosItem.map(f => `<img src="${f}" onerror="this.style.display='none'"
                         onclick="_invLightbox && _invLightbox('${f}', '${(item.producto||'').replace(/'/g,"\\'")}')"
                         style="width:24px; height:24px; object-fit:cover; border-radius:4px; cursor:zoom-in; border:1px solid #e2e8f0;">`).join('')}
                   </div>`
                : '';
            return `
            <div style="display:flex; align-items:center; gap:10px; text-align:left; background:#f8fafc; padding:8px 10px; margin-bottom:6px; border-radius:8px; border-left: 3px solid #d4af37;">
                <img src="${foto}" onerror="this.src='imagenes/sin_foto.jpg'"
                     onclick="_invLightbox && _invLightbox('${foto}', '${(item.producto||'').replace(/'/g,"\\'")}')"
                     style="width:46px; height:46px; object-fit:cover; border-radius:6px; flex-shrink:0; cursor:zoom-in; border:1px solid #e2e8f0;">
                <div style="flex:1; min-width:0; font-size:12px; color:#1e293b;">
                    <div><i class="fa-solid fa-couch"></i> <b>${item.producto}</b></div>
                    <div style="color:#64748b; font-size:11px; margin-top:2px;">${item.detalles || 'Sin tela registrada'}</div>
                    ${miniaturas}
                </div>
                <div style="font-weight:800; color:#065f46; font-size:12px; white-space:nowrap;">S/ ${(item.precio || 0).toFixed(2)}</div>
            </div>`;
        }).join('');

        itemsHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px 12px; margin-top:4px; border-top:2px solid #e2e8f0; font-size:13px;">
                <b style="color:#0f172a;">TOTAL DEL PEDIDO</b>
                <b style="color:#0f172a;">S/ ${totalPedido.toFixed(2)}</b>
            </div>`;

        // Comprobantes de pago subidos al finalizar la venta
        const pagos = data.pagos || [];
        let pagosHTML = '';
        if (pagos.length > 0) {
            pagosHTML = `
                <div style="text-align:left; margin-top:14px; margin-bottom:10px;">
                    <p style="margin:0 0 6px; font-size:12px; font-weight:800; color:#475569; text-transform:uppercase;">
                        <i class="fa-solid fa-receipt"></i> Comprobantes de pago
                    </p>
                    ${pagos.map((p, i) => `
                        <div style="display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid #e2e8f0;
                                    border-radius:8px; padding:8px 10px; margin-bottom:6px;">
                            ${p.comprobante
                                ? `<img src="${p.comprobante}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
                                       onclick="_invLightbox('${p.comprobante}','Comprobante · ${(p.entidad||'').replace(/'/g,"\\'")}')"
                                       title="Ver comprobante en grande"
                                       style="width:44px;height:44px;object-fit:cover;border-radius:6px;cursor:zoom-in;
                                              border:1px solid #e2e8f0;flex-shrink:0;">`
                                : `<div style="width:44px;height:44px;border-radius:6px;background:#f1f5f9;display:flex;
                                          align-items:center;justify-content:center;color:#cbd5e1;flex-shrink:0;font-size:16px;">
                                       <i class="fa-solid fa-file-circle-xmark"></i></div>`}
                            <div style="text-align:left; min-width:0; font-size:11px; color:#475569;">
                                <div style="font-weight:800; color:#0f172a;">${p.tipo}${p.entidad && p.entidad !== '—' ? ' · ' + p.entidad : ''}</div>
                                <div>S/ ${p.monto.toFixed(2)} — ${p.fecha}</div>
                                ${!p.comprobante ? '<div style="color:#cbd5e1;">Sin comprobante subido</div>' : ''}
                            </div>
                        </div>`).join('')}
                </div>`;
        }

        // Guardamos el detalle para que los botones de abajo (que viven en HTML
        // de SweetAlert, sin closure sobre `data`) puedan volver a leerlo.
        _ultimoPedidoDetalle = data;

        Swal.fire({
            title: `Pedido #${data.codigo}`,
            html: `
                <div style="text-align: left; margin-bottom: 15px;">
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Cliente:</b> ${data.cliente}</p>
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Entrega:</b> <span style="background: #fef08a; padding: 2px 5px; color: #1a1a1a; font-weight: bold; border-radius: 3px;">${data.entrega}</span></p>
                </div>
                ${itemsHTML}
                ${pagosHTML}
                <div style="display:flex; gap:8px; margin-top:16px;">
                    <button onclick="descargarPDFOrdenTaller(_ultimoPedidoDetalle)"
                            style="flex:1; background:#0f172a; color:#d4af37; border:none; padding:11px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:800;">
                        <i class="fa-solid fa-download"></i> Descargar PDF
                    </button>
                    <button onclick="imprimirOrdenTaller(_ultimoPedidoDetalle)"
                            style="flex:1; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:11px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:800;">
                        <i class="fa-solid fa-print"></i> Imprimir
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Cerrar'
        });
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

// Guarda el último detalle de pedido cargado, para que los botones
// "Descargar PDF" / "Imprimir" del modal (HTML plano, sin closure) lo lean.
let _ultimoPedidoDetalle = null;

/**
 * Arma el HTML del documento "Orden de Producción" (mismo diseño para
 * impresión y para exportar a PDF). Se separó de imprimirOrdenTaller()
 * para no duplicar el maquetado en dos lugares.
 *
 * `paraCanvas`: si es true, deja el <div class="page"> suelto (sin
 * <html>/<head>/<body>) para insertarlo directo en el DOM y capturarlo
 * con html2canvas. Si es false, devuelve el documento completo para
 * abrir en una ventana nueva e imprimir.
 */
function _construirHTMLOrdenTaller(data, paraCanvas = false) {
    let filasItems = '';
    data.items.forEach((item, index) => {
        // Leemos el HTML exacto de la BD
        let detalleHTML = item.detalles || "Especificaciones estándar de fabricación.";
        // FIX (julio 2026): item.fotos trae TODAS las fotos que el vendedor
        // eligió del catálogo para esta pieza (antes solo se imprimía una,
        // aunque el pedido tuviera varias imágenes de referencia guardadas).
        const fotosItem = (item.fotos && item.fotos.length) ? item.fotos : (item.foto ? [item.foto] : []);
        const fotoCelda = fotosItem.length
            ? `<div style="display:flex; flex-wrap:wrap; gap:4px; width:100px;">
                ${fotosItem.map(f => `<img src="${f}" crossorigin="anonymous" style="width:${fotosItem.length > 1 ? '42px' : '90px'};height:${fotosItem.length > 1 ? '42px' : '90px'};object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;display:block;" onerror="this.style.display='none'">`).join('')}
               </div>`
            : `<div style="width:90px;height:90px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;text-align:center;">Sin foto</div>`;

        filasItems += `
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b; vertical-align: top;">${index + 1}</td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top; width: 100px;">
                    ${fotoCelda}
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <div style="font-weight: 900; color: #0f172a; font-size: 14px; margin-bottom: 8px; text-transform: uppercase;">${item.producto}</div>
                    
                    <div style="background: #f8fafc; border-left: 3px solid #d4af37; padding: 10px; font-size: 11.5px; color: #334155; line-height: 1.6; border-radius: 0 4px 4px 0;">
                        ${detalleHTML}
                    </div>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top; width: 140px;">
                    <div style="border: 2px dashed #cbd5e1; height: 100%; min-height: 110px; border-radius: 5px; background: #fff; padding: 5px; font-size: 9px; color: #94a3b8; text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                        <span style="border-top: 1px solid #cbd5e1; padding-top: 5px; width: 80%; margin: 0 auto;">Firma Taller / CC</span>
                    </div>
                </td>
            </tr>`;
    });

    const estilos = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@300;400;600;800;900&display=swap');
            
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #333; margin: 0; padding: 0; background-color: #fff; }
            .page { width: 210mm; min-height: 297mm; padding: 15mm; margin: auto; position: relative; box-sizing: border-box; overflow: hidden; background: #fff; }
            
            /* DECORACIÓN GEOMÉTRICA (Estilo Carey) */
            .corner-top { position: absolute; top: -50px; right: -50px; width: 250px; height: 250px; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); transform: rotate(45deg); z-index: 0; opacity: 0.9; }
            .corner-top-inner { position: absolute; top: 0; right: 80px; width: 100px; height: 300px; background: #e5e7eb; transform: rotate(45deg); z-index: -1; }
            .corner-bottom { position: absolute; bottom: -80px; left: -80px; width: 280px; height: 280px; background: #1f2937; transform: rotate(45deg); z-index: 0; }
            .corner-bottom-accent { position: absolute; bottom: 40px; left: 80px; width: 40px; height: 200px; background: #d4af37; transform: rotate(45deg); z-index: -1; }

            .content { position: relative; z-index: 10; }

            /* HEADER */
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .logo { height: 100px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.1)); }
            .contract-title { text-align: right; position: relative; z-index: 20; }
            .contract-title h1 { font-family: 'Playfair Display', serif; font-size: 30px; margin: 0; color: #1a1a1a; letter-spacing: 1px; }
            .contract-title p { margin: 5px 0 0 0; font-weight: 800; color: #ffffff; font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }

            /* INFO CLIENTE */
            .client-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; background: rgba(249, 250, 251, 0.8); padding: 20px; border-radius: 4px; border-left: 5px solid #0f172a; }
            .info-box div { margin-bottom: 8px; font-size: 13px; }
            .info-box strong { color: #1f2937; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; display: inline-block; width: 110px; }

            /* TABLA */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            thead th { background: #1f2937; color: white; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
            
            .warning-box { border: 2px dashed #b8860b; padding: 15px; text-align: center; margin-top: 40px; font-size: 11px; font-weight: 800; background: #fffcf0; color: #1a1a1a; text-transform: uppercase; border-radius: 6px; }

            /* FIRMAS */
            .signature-section { display: flex; justify-content: space-around; margin-top: 80px; }
            .sig-block { width: 250px; border-top: 2px solid #1a1a1a; text-align: center; padding-top: 10px; }
            .sig-block p { margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; }

            @media print {
                body { -webkit-print-color-adjust: exact; }
                .page { margin: 0; border: none; }
            }
        </style>`;

    const cuerpoPage = `
        <div class="page">
            <div class="corner-top"></div>
            <div class="corner-top-inner"></div>
            
            <div class="content">
                <div class="header">
                    <img src="imagenes/Logo3.png" class="logo" crossorigin="anonymous">
                    <div class="contract-title">
                        <h1>ORDEN DE PRODUCCIÓN</h1>
                        
                        <div style="margin-top: 5px; font-size: 18pxpx; font-weight: 900; color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif;">N° ${data.codigo}</div>
                    </div>
                </div>

                <div class="client-section">
                    <div class="info-box">
                        <div><strong>Cliente:</strong> ${data.cliente.toUpperCase()}</div>
                        <div><strong>Emisión:</strong> ${new Date().toLocaleDateString('es-PE')}</div>
                    </div>
                    <div class="info-box">
                        <div style="font-size: 16px; margin-top: 5px;">
                            <strong>ENTREGA:</strong> 
                            <span style="background-color: #fef08a; color: #1a1a1a; font-weight: 900; padding: 3px 8px; border-radius: 4px; border: 1px solid #eab308;">${data.entrega}</span>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">#</th>
                            <th style="width:100px; text-align:center;">Foto</th>
                            <th>Despiece Técnico y Tapicería</th>
                            <th style="width:140px; text-align:center;">Control Calidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasItems}
                    </tbody>
                </table>

                <div class="warning-box">
                    <i class="fa-solid fa-triangle-exclamation"></i> DOCUMENTO EXCLUSIVO DE TALLER. RESPETAR MEDIDAS Y ESPECIFICACIONES AL MILÍMETRO.<br>
                    CUALQUIER MODIFICACIÓN DEBE SER CONSULTADA CON EL VENDEDOR O ÁREA COMERCIAL ANTES DEL CORTE.
                </div>

               <div class="signature-section">
                    <div class="sig-block">
                        <p>Jefe de Taller / Producción</p>
                    </div>
                    <div class="sig-block">
                        <p>Sello de Salida (Despacho)</p>
                    </div>
                </div>
            </div>
            
            <div class="corner-bottom"></div>
            <div class="corner-bottom-accent"></div>
        </div>`;

    if (paraCanvas) {
        // Sin <html>/<head>: esto se inyecta directo en un <div> ya montado
        // en el documento actual, así que los estilos van en un <style> normal.
        return estilos + cuerpoPage;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Orden Taller #${data.codigo}</title>
        ${estilos}
    </head>
    <body>
        ${cuerpoPage}
    </body>
    </html>
    `;
}

function imprimirOrdenTaller(data) {
    const htmlOrden = _construirHTMLOrdenTaller(data, false);

    // ── Blob URL en vez de window.open('','_blank') + document.write ──
    // document.write() sobre una ventana recién abierta es poco confiable en
    // Chrome cuando window.open() se llama desde un callback asíncrono (como
    // el .then() de un SweetAlert): la pestaña se abre, pero el contenido
    // escrito con document.write a veces "llega tarde" y la pestaña queda en
    // blanco para siempre. Generando un Blob con el HTML completo y abriendo
    // esa URL directamente, el navegador la carga como cualquier página
    // normal — sin ninguna carrera de tiempos.
    const blob = new Blob([htmlOrden], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');

    if (!printWindow) {
        Swal.fire('Ventana bloqueada', 'El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio y vuelve a intentar.', 'warning');
        URL.revokeObjectURL(blobUrl);
        return;
    }

    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
            URL.revokeObjectURL(blobUrl);
        }, 500);
    };
}

/**
 * Descarga directa del PDF de la Orden de Producción (fotos + descripciones
 * de cada pieza del pedido), sin pasar por el diálogo de impresión del
 * navegador. Usa html2canvas para "fotografiar" el documento ya maquetado
 * y jsPDF para partirlo en páginas A4 y guardarlo como archivo.
 */
async function descargarPDFOrdenTaller(data) {
    if (!data) { Swal.fire('Error', 'No hay datos del pedido para generar el PDF.', 'error'); return; }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        Swal.fire('Error', 'No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.', 'error');
        return;
    }

    Swal.fire({ title: 'Generando PDF...', text: 'Esto puede tardar unos segundos si hay muchas fotos.', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    // Montamos el documento fuera de la vista (no dentro del modal de SweetAlert,
    // que está recortado/con scroll) para que html2canvas lo capture completo.
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-99999px';
    contenedor.style.top = '0';
    contenedor.style.width = '794px'; // ancho A4 aprox. a 96dpi
    contenedor.innerHTML = _construirHTMLOrdenTaller(data, true);
    document.body.appendChild(contenedor);

    try {
        // Esperar a que carguen las imágenes (fotos de Cloudinary) antes de
        // capturar; si no, el canvas sale con huecos en blanco.
        const imgs = Array.from(contenedor.querySelectorAll('img'));
        await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
            img.onload = res; img.onerror = res;
        })));

        const canvas = await html2canvas(contenedor, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const anchoPagina = 210, altoPagina = 297;
        const anchoImg = anchoPagina;
        const altoImg  = canvas.height * anchoImg / canvas.width;
        const imgData  = canvas.toDataURL('image/jpeg', 0.92);

        let alturaRestante = altoImg;
        let posicion = 0;
        pdf.addImage(imgData, 'JPEG', 0, posicion, anchoImg, altoImg);
        alturaRestante -= altoPagina;

        while (alturaRestante > 0) {
            posicion = alturaRestante - altoImg;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, posicion, anchoImg, altoImg);
            alturaRestante -= altoPagina;
        }

        pdf.save(`Orden_Pedido_${data.codigo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error('Error generando PDF de orden de pedido:', e);
        Swal.fire('Error', 'No se pudo generar el PDF: ' + e.message, 'error');
    } finally {
        contenedor.remove();
    }
}

/* NOTA (julio 2026): se eliminó el buscador standalone "Orden de Pedido"
   (toggleBuscadorOrdenPedido / _cargarVentasOrdenPedido / _filtrarOrdenPedido)
   junto con su botón y panel en index.html — era 100% redundante con el
   buscador + el ícono de PDF que ya tiene cada tarjeta en la pestaña
   "Órdenes por Pedido" (ver abrirDetallePedido(), llamado también desde la
   tarjeta de cada pedido al costado de su barra de progreso, más abajo en
   este archivo). */

/* ── HELPER: Botón de acción correcto según rol, estado y área ── */
function renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin) {
    const isListoParaRecojo = t.estado === 'Listo para Recojo';
    const isRecogido        = t.estado === 'Recogido';
    const esAreaEstructura  = t.area === 'ESTRUCTURAS_MUEBLES' || t.area === 'ESTRUCTURAS_SILLAS';

    // ── LOGÍSTICA EXTERNA (TELAS): se evalúa ANTES del bloque esAdmin,
    // porque ese bloque hace return temprano y nunca llegaría aquí ──
    if (t.es_logistica) {
        if (esAdmin) {
            const trabajadorInfo = t.trabajador
                ? `<div style="background:#f0fdf4; color:#166534; padding:6px; border-radius:6px; text-align:center; font-size:10px; margin-bottom:6px;"><i class="fa-solid fa-user-check"></i> Asignado: <b>${t.trabajador_nombre}</b></div>`
                : '';
            return `${trabajadorInfo}
                <button onclick="asignarTrabajadorLogistica(${t.id})"
                    style="width:100%; background:#94a3b8; color:white; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">
                    <i class="fa-solid fa-user-clock"></i> ${t.trabajador ? 'Reasignar' : 'Asignar'} Operario de Telas
                </button>`;
        } else {
            if (t.estado === 'En Recojo') {
                return `<div style="margin-top:10px; padding:10px; background:#fef9c3; border-radius:8px; border:1px solid #fde047;">
                            <label style="font-size:9px; font-weight:900; color:#854d0e; display:block; margin-bottom:6px;">📷 SUBIR VOUCHER / RECIBO DE PAGO:</label>
                            <input type="file" id="foto-voucher-${t.id}" accept="image/*,application/pdf" style="width:100%; margin-bottom:8px; font-size:11px;">
                            <button onclick="confirmarRecojoLogistica(${t.id}, document.getElementById('foto-voucher-${t.id}'))"
                                style="width:100%; background:#f59e0b; color:white; border:none; padding:10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                                <i class="fa-solid fa-truck-ramp-box"></i> Pagar y Confirmar Recojo
                            </button>
                        </div>`;
            } else if (t.estado === 'Recogido') {
                return `<button onclick="confirmarDistribucionTela(${t.id})"
                            style="width:100%; background:#16a34a; color:white; border:none; padding:10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-people-carry-box"></i> Entregar a Tapicería
                        </button>`;
            }
            // Sin asignar (no admin) — informativo, el admin debe asignar primero
            return `<div style="background:#fef3c7; color:#92400e; padding:8px; border-radius:8px; text-align:center; font-size:11px;">
                        <i class="fa-solid fa-user-clock"></i> Esperando asignación de operario
                    </div>`;
        }
    }

    // ── ADMIN: solo ve botón para ASIGNAR, nunca para terminar ──
    if (esAdmin) {
        if (t.area === 'DESPACHO_CENTRAL') {
            if (isBloqueado) {
                return `<button disabled style="width:100%; background:#e2e8f0; color:#94a3b8; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:not-allowed;">
                            <i class="fa-solid fa-lock"></i> Esperando que terminen las demás áreas
                        </button>`;
            }
            if (isTerminado) {
                return `<div style="background:#dcfce7; color:#166534; padding:10px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                            <i class="fa-solid fa-circle-check"></i> DESPACHADO
                        </div>`;
            }
            if (isEnProceso) {
                return `<div style="background:#dbeafe; color:#1e40af; padding:10px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                            <i class="fa-solid fa-truck"></i> En ruta — Chofer: ${t.trabajador_nombre}
                        </div>`;
            }
            // Pendiente desbloqueado → admin puede asignar chofer
            return `<button onclick="asignarChoferDespacho(${t.id})"
                        style="width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-truck"></i> Asignar Chofer y Despachar
                    </button>`;
        }

        // Badge para estados especiales de estructura (admin no puede confirmar recojo)
        if (isListoParaRecojo) {
            return `<div style="background:#fee2e2; color:#991b1b; padding:8px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                        🔴 Listo para Recojo — Esperando al chofer
                    </div>`;
        }
        if (isRecogido) {
            return `<div style="background:#dcfce7; color:#166534; padding:8px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                        ✅ Recogido por chofer — En camino al tapicero
                    </div>`;
        }

        // Áreas normales: admin asigna maestro
        // Para tapicería bloqueada: admin puede asignar de antemano (ticket sigue Bloqueado)
        if (isBloqueado) {
            const areaTap = t.area === 'TAPICERIA_SOFAS' || t.area === 'TAPICERIA_SILLAS' || t.area === 'ARMADO_COJINES';
            if (areaTap) {
                const trabajadorInfo = t.trabajador
                    ? `<div style="background:#f0fdf4; color:#166534; padding:6px; border-radius:6px; text-align:center; font-size:10px; margin-bottom:6px;"><i class="fa-solid fa-user-check"></i> Pre-asignado: <b>${t.trabajador_nombre}</b></div>`
                    : '';
                return `${trabajadorInfo}
                    <button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                        style="width:100%; background:#94a3b8; color:white; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-user-clock"></i> ${t.trabajador ? 'Reasignar' : 'Pre-asignar'} Tapicero
                    </button>
                    <p style="font-size:9px; color:#94a3b8; text-align:center; margin:4px 0 0 0;">Esperando: estructuras + telas</p>`;
            }
            return `<div style="background:#e2e8f0; color:#64748b; padding:8px; border-radius:8px; text-align:center; font-size:11px;">
                        <i class="fa-solid fa-lock"></i> Bloqueado — prerrequisitos pendientes
                    </div>`;
        }
        if (isTerminado) {
            return `<div style="background:#dcfce7; color:#166534; padding:8px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                        <i class="fa-solid fa-circle-check"></i> COMPLETADO
                    </div>`;
        }
        if (t.trabajador) {
            // Ya tiene asignado — mostrar nombre + botón para reasignar si es necesario
            const nombreSafe = (t.trabajador_nombre || 'Asignado').replace(/'/g, "\\'");
            return `<div style="background:#f0fdf4; color:#166534; padding:8px; border-radius:8px; text-align:center; font-size:11px; margin-bottom:6px;">
                        <i class="fa-solid fa-user-check"></i> <b>${t.trabajador_nombre || 'Asignado'}</b>
                    </div>
                    <button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                        style="width:100%; background:#e2e8f0; color:#475569; border:none; padding:7px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-arrows-rotate"></i> Reasignar
                    </button>`;
        }
        // Sin asignar → botón de asignación
        return `<button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                    style="width:100%; background:#558fc5; color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">
                    <i class="fa-solid fa-user-plus"></i> Asignar Maestro
                </button>`;
    }

    // ── OPERARIO / JEFE (no admin) ──
    
    if (isBloqueado) {
        return `<button disabled style="width:100%; background:#e2e8f0; color:#94a3b8; border:none; padding:8px; border-radius:6px; font-size:12px; font-weight:bold; cursor:not-allowed;">
                    <i class="fa-solid fa-hourglass-half"></i> Esperando áreas previas
                </button>`;
    }

    if (isTerminado) {
        return `<div style="text-align:center; padding:10px; background:#dcfce7; color:#166534; border-radius:8px; font-size:11px; font-weight:bold;">
                    <i class="fa-solid fa-circle-check"></i> TRABAJO COMPLETADO
                </div>`;
    }

    // Estado: Listo para Recojo (carpintero ya marcó terminado, espera al chofer)
    if (isListoParaRecojo) {
        return `<div style="text-align:center; padding:10px; background:#fee2e2; color:#991b1b; border-radius:8px; font-size:11px; font-weight:bold; border:1px solid #fca5a5;">
                    🔴 Esperando recojo — El chofer pasará a buscarlo
                </div>`;
    }

    // Estado: Recogido (el chofer ya lo recogió)
    if (isRecogido) {
        return `<div style="text-align:center; padding:10px; background:#dcfce7; color:#166534; border-radius:8px; font-size:11px; font-weight:bold;">
                    ✅ Recogido — En camino al tapicero
                </div>`;
    }

    if (isEnProceso) {
        // Despacho en proceso: chofer confirma entrega
        if (t.area === 'DESPACHO_CENTRAL') {
            return `<div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
                        <p style="font-size:11px; font-weight:bold; color:#475569; margin:0 0 10px 0; text-align:center;">
                            <i class="fa-solid fa-truck"></i> Chofer: <b>${t.trabajador_nombre}</b>
                        </p>
                        <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:6px;">📷 FOTO DE ENTREGA AL CLIENTE:</label>
                        <div style="display:flex;gap:6px;margin-bottom:8px;">
                            <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:7px 4px;
                                          border-radius:7px;font-size:10px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:4px;text-align:center;">
                                📷 Tomar foto
                                <input type="file" id="foto-evid-cam-${t.id}" accept="image/*" capture="environment"
                                       style="display:none;" onchange="_syncFotoEvid(this, '${t.id}')">
                            </label>
                            <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:7px 4px;
                                          border-radius:7px;font-size:10px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:4px;text-align:center;">
                                📁 Archivo
                                <input type="file" id="foto-evid-${t.id}" accept="image/*"
                                       style="display:none;" onchange="_syncFotoEvid(this, '${t.id}')">
                            </label>
                        </div>
                        <div id="foto-evid-preview-${t.id}" style="display:none;margin-bottom:6px;">
                            <img id="foto-evid-img-${t.id}" src="" style="max-height:70px;border-radius:6px;border:1px solid #e2e8f0;">
                        </div>
                        <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-cam-${t.id}')?.files[0] ? document.getElementById('foto-evid-cam-${t.id}') : document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
                            style="width:100%; background:#22c55e; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-check-double"></i> CONFIRMAR ENTREGA
                        </button>
                    </div>`;
        }

        // Área de Telas: botón especial "Derivar material" (pase de posta)
        const esAreaTelas = t.area === 'CORTE_Y_CONTROL_TELAS' || t.area === 'TELAS';
        const usuarioEsTelas = usuarioActivo.area_asignada === 'CORTE_Y_CONTROL_TELAS' || usuarioActivo.area_asignada === 'TELAS';
        if (esAreaTelas && usuarioEsTelas) {
            // data-specs en base64 para que abrirModalDerivar detecte si hay cojines
            const specsB64Derivar = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
            return `<button onclick="abrirModalDerivar(${t.id})"
                        data-ticket-id="${t.id}"
                        data-specs="${specsB64Derivar}"
                        style="width:100%; background:#f97316; color:white; border:none; padding:10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; margin-top:4px;">
                        ✂️ Subir Foto y Derivar Material
                    </button>`;
        }

        // Cualquier otra área en proceso: evidencia + finalizar
        const labelFinalizar = esAreaEstructura
            ? '🔴 Listo para Recojo'
            : '<i class="fa-solid fa-check-double"></i> MARCAR COMO TERMINADO';
        const colorFinalizar = esAreaEstructura ? '#dc2626' : '#22c55e';
        return `<div style="margin-top:10px; padding:10px; background:#f1f5f9; border-radius:8px; border:1px solid #cbd5e1;">
                    <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:6px;">📷 FOTO DE TRABAJO TERMINADO:</label>
                    <div style="display:flex;gap:6px;margin-bottom:8px;">
                        <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:7px 4px;
                                      border-radius:7px;font-size:10px;font-weight:700;display:flex;
                                      align-items:center;justify-content:center;gap:4px;text-align:center;">
                            📷 Tomar foto
                            <input type="file" id="foto-evid-cam-${t.id}" accept="image/*" capture="environment"
                                   style="display:none;" onchange="_syncFotoEvid(this, '${t.id}')">
                        </label>
                        <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:7px 4px;
                                      border-radius:7px;font-size:10px;font-weight:700;display:flex;
                                      align-items:center;justify-content:center;gap:4px;text-align:center;">
                            📁 Archivo
                            <input type="file" id="foto-evid-${t.id}" accept="image/*"
                                   style="display:none;" onchange="_syncFotoEvid(this, '${t.id}')">
                        </label>
                    </div>
                    <div id="foto-evid-preview-${t.id}" style="display:none;margin-bottom:6px;">
                        <img id="foto-evid-img-${t.id}" src="" style="max-height:70px;border-radius:6px;border:1px solid #e2e8f0;">
                    </div>
                    <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-cam-${t.id}')?.files[0] ? document.getElementById('foto-evid-cam-${t.id}') : document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
                        style="width:100%; background:${colorFinalizar}; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        ${labelFinalizar}
                    </button>
                </div>`;
    }

    // Pendiente — vista del operario que aún no inicia
    return `<p style="font-size:11px; color:#f59e0b; text-align:center; font-weight:bold; margin:8px 0 0 0;">
                <i class="fa-solid fa-clock"></i> Asignado — esperando que inicies
            </p>`;
}

