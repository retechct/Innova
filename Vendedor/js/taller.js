// === MÓDULO: Taller, producción y admin ===
async function abrirDetallePedido(codigo) {
    try {
        Swal.fire({ title: 'Buscando ficha de taller...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/pedido/detalle/${codigo}`);
        const data = await res.json();

        if(data.error) return Swal.fire('Error', data.error, 'error');

        let itemsHTML = data.items.map(item => `
            <div style="text-align:left; background:#f8fafc; padding:8px 12px; margin-bottom:5px; border-radius:5px; border-left: 3px solid #d4af37; font-size:12px; color: #1e293b;">
                <i class="fa-solid fa-couch"></i> <b>${item.producto}</b>
            </div>`).join('');

        Swal.fire({
            title: `Pedido #${data.codigo}`,
            html: `
                <div style="text-align: left; margin-bottom: 15px;">
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Cliente:</b> ${data.cliente}</p>
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Entrega:</b> <span style="background: #fef08a; padding: 2px 5px; color: #1a1a1a; font-weight: bold; border-radius: 3px;">${data.entrega}</span></p>
                </div>
                ${itemsHTML}
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-print"></i> IMPRIMIR ORDEN TALLER',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        }).then((result) => {
            if (result.isConfirmed) {
                imprimirOrdenTaller(data);
            }
        });
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

function imprimirOrdenTaller(data) {
    let filasItems = '';
    data.items.forEach((item, index) => {
        // Leemos el HTML exacto de la BD
        let detalleHTML = item.detalles || "Especificaciones estándar de fabricación.";
        
        filasItems += `
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b; vertical-align: top;">${index + 1}</td>
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

    const nomEmpresa = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.empresa : 'INNOVA MOBILI';
    const rucEmpresa = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.ruc : '---';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Orden Taller #${data.codigo}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@300;400;600;800;900&display=swap');
            
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
        </div>
    </body>
    </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 500); };
}
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

/* ================================================================= */
/* --- COLA DE RECOJO PARA CHOFER: confirmar recojo de estructuras  --- */
/* ================================================================= */

async function cargarVistaColaRecojoChofer(contenedor) {
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/cola-recojo`);
        const data = await res.json();
        const estructuras = Array.isArray(data) ? data : (data.estructuras || []);
        const compras     = Array.isArray(data) ? []   : (data.compras_externas || []);

        if (estructuras.length === 0 && compras.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin estructuras pendientes de recojo</p>
                    <p style="font-size:13px;">Cuando un carpintero marque una estructura como lista, aparecerá aquí.</p>
                </div>`;
            return;
        }
    

        let html = '';

        // ── SECCIÓN COMPRAS EXTERNAS (Chofer) ──────────────────────────────
        if (compras.length > 0) {
            html += `
            <div style="margin-bottom:20px; padding:14px 18px; background:linear-gradient(135deg,#faf5ff,#ede9fe); border-radius:12px; border:2px solid #ddd6fe;">
                <h3 style="margin:0 0 4px; color:#7c3aed; font-size:15px; font-weight:900;">
                    <i class="fa-solid fa-boxes-packing"></i> 📦 ${compras.length} compra(s) lista(s) para recoger
                </h3>
                <p style="margin:0; font-size:12px; color:#64748b;">Insumos o productos pagados que debes traer del proveedor.</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">`;
            compras.forEach(t => {
                html += `
                <div style="background:white; border-radius:14px; border:2px solid #ddd6fe; box-shadow:0 4px 12px rgba(124,58,237,0.07); overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe); padding:14px 18px; border-bottom:2px solid #ddd6fe; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#7c3aed; text-transform:uppercase; letter-spacing:1px;">COMPRA EXTERNA · Ref. ${t.codigo_venta}</span>
                            <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${t.insumo} ${t.sku ? `<span style="font-size:11px;color:#94a3b8;font-weight:600;">(${t.sku})</span>` : ''}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;">
                                <b>Proveedor:</b> ${t.proveedor} ${t.telefono_proveedor ? `· 📞 ${t.telefono_proveedor}` : ''}<br>
                                <b>Cliente:</b> ${t.cliente}
                            </p>
                        </div>
                        <button onclick="_confirmarRecojoExterno(${t.logistica_id}, '${t.insumo.replace(/'/g,"\\'")}', this)"
                            style="background:#7c3aed; color:white; border:none; padding:12px 20px; border-radius:9px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:7px; box-shadow:0 2px 8px rgba(124,58,237,0.2);">
                            <i class="fa-solid fa-check"></i> Confirmar Recojo
                        </button>
                    </div>
                    <div style="padding:12px 18px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                        ${t.cantidad ? `<span style="font-size:11px;color:#64748b;background:#f8fafc;padding:4px 8px;border-radius:6px;font-weight:bold;"><i class="fa-solid fa-hashtag"></i> Cantidad: ${t.cantidad} ${t.unidad || ''}</span>` : ''}
                        ${t.fecha_entrega_proveedor ? `<span style="font-size:11px;color:#64748b;background:#f8fafc;padding:4px 8px;border-radius:6px;font-weight:bold;"><i class="fa-regular fa-calendar"></i> Promesa prov: ${t.fecha_entrega_proveedor}</span>` : ''}
                        ${t.notas_proveedor ? `<div style="width:100%;font-size:11px;color:#475569;background:#faf5ff;border-left:3px solid #a78bfa;padding:6px 10px;border-radius:0 6px 6px 0;margin-top:4px;">${t.notas_proveedor}</div>` : ''}
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        // ── SECCIÓN ESTRUCTURAS (Chofer) ───────────────────────────────────
        if (estructuras.length > 0) {
            html += `
            <div style="margin-bottom:16px; padding:14px 18px; background:linear-gradient(135deg,#fff5f5,#fee2e2); border-radius:12px; border:2px solid #fca5a5; margin-top:${compras.length>0?'20px':'0'};">
                <h3 style="margin:0 0 4px; color:#991b1b; font-size:15px; font-weight:900;">
                    🔴 ${estructuras.length} estructura${estructuras.length>1?'s':''} lista${estructuras.length>1?'s':''} para recoger
                </h3>
                <p style="margin:0; font-size:12px; color:#64748b;">Confirma cada recojo cuando pases a buscar la estructura al taller de carpintería.</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">`;

        estructuras.forEach(c => {
            const fotoEstructura = c.foto_url && !c.foto_url.includes('sin_foto') ? c.foto_url.split('|')[0] : null;
            const telaLista = c.tela_distribuida !== false; // true si campo ausente (retrocompat)
            const semColor  = telaLista ? '#16a34a' : '#f59e0b';
            const semIcon   = telaLista ? '🟢' : '🟡';
            const semLabel  = telaLista
                ? 'Tela lista — recojo habilitado'
                : 'Tela pendiente de distribución — recojo bloqueado';
            const btnStyle  = telaLista
                ? 'background:#dc2626; color:white; border:none; padding:12px 20px; border-radius:9px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:7px; box-shadow:0 2px 8px rgba(220,38,38,0.3);'
                : 'background:#d1d5db; color:#6b7280; border:none; padding:12px 20px; border-radius:9px; font-size:12px; font-weight:800; cursor:not-allowed; white-space:nowrap; display:flex; align-items:center; gap:7px;';
            html += `
            <div style="background:white; border-radius:14px; border:2px solid ${semColor}33; box-shadow:0 4px 12px rgba(220,38,38,0.10); overflow:hidden;">
                <div style="background:linear-gradient(135deg,#fff5f5,#fee2e2); padding:14px 18px; border-bottom:2px solid ${semColor}44; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span style="font-size:10px; font-weight:900; color:#dc2626; text-transform:uppercase; letter-spacing:1px;">${semIcon} ${c.area.replace(/_/g,' ')} · Listo desde ${c.fecha_fin}</span>
                        <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${c.producto}</h4>
                        <p style="margin:0; font-size:12px; color:#64748b;">
                            <b>Ref:</b> ${c.codigo_venta} &nbsp;|&nbsp; <b>Cliente:</b> ${c.cliente}
                        </p>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">
                            <i class="fa-solid fa-user-gear"></i> <b>Carpintero:</b> ${c.operario}
                            ${c.tapicero && c.tapicero !== 'Sin asignar' ? `&nbsp;|&nbsp; <i class="fa-solid fa-couch"></i> <b>Tapicero:</b> <span style="color:#0369a1; font-weight:bold;">${c.tapicero}</span>` : ''}
                        </p>
                        <p style="margin:4px 0 0 0; font-size:11px; font-weight:700; color:${semColor};">${semLabel}</p>
                    </div>
                    <button ${telaLista ? `onclick="confirmarRecojoEstructura(${c.ticket_id}, '${(c.producto||'').replace(/'/g,"\\'")}', this)"` : 'disabled title="Esperando que la tela sea distribuida al tapicero"'}
                        style="${btnStyle}">
                        ✅ Confirmar Recojo
                    </button>
                </div>
                ${fotoEstructura ? `
                <div style="padding:12px 18px; display:flex; gap:14px; align-items:center;">
                    <img src="${fotoEstructura}" alt="Mueble"
                        style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0; flex-shrink:0;"
                        onerror="this.parentElement.style.display='none'">
                    ${c.especificaciones ? `<div style="font-size:11px; color:#374151; background:#f8fafc; padding:8px; border-radius:8px; border-left:3px solid #dc2626; flex:1;">${(c.especificaciones||'').replace(/\n/g,'<br>').substring(0,200)}</div>` : ''}
                </div>` : (c.especificaciones ? `
                <div style="padding:12px 18px;">
                    <div style="font-size:11px; color:#374151; background:#f8fafc; padding:8px; border-radius:8px; border-left:3px solid #dc2626;">${(c.especificaciones||'').replace(/\n/g,'<br>').substring(0,200)}</div>
                </div>` : '')}
            </div>`;
        });
        html += `</div>`;
        }
        contenedor.innerHTML = html;
    } catch(e) {
        console.error('Error cargando cola de recojo chofer:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar. Intenta de nuevo.</p>`;
    }
}

async function confirmarRecojoEstructura(ticketId, producto, btnEl) {
    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar recojo?',
        html: `<p style="font-size:14px;color:#374151;">Confirma que recogiste físicamente:<br><b>${producto}</b><br><br>
               <span style="font-size:12px;color:#64748b;">Esto desbloquea automáticamente la tapicería si las telas ya están listas.</span></p>`,
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: 'transparent',
        confirmButtonText: '✅ Sí, recogí la estructura',
        cancelButtonText: 'Cancelar',
    });
    if (!conf.isConfirmed) return;

    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
        const res = await apiFetch(`${API_URL}/api/taller/ticket/${ticketId}/confirmar-recojo`, { method: 'POST' });
        const d   = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: '✅ ¡Recojo confirmado!', text: d.mensaje, timer: 2800, showConfirmButton: false });
            cargarTicketsTaller();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error || 'No se pudo confirmar' });
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '✅ Confirmar Recojo'; }
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '✅ Confirmar Recojo'; }
    }
}

/* ================================================================= */
/* --- KANBAN DE PRODUCCIÓN — LÓGICA UNIFICADA POR ROL           --- */
/* ================================================================= */

const CONFIG_AREAS = {
    'ESTRUCTURAS_MUEBLES':    { icono: '<i class="fa-solid fa-tree"></i>',            nombre: 'Carpintería (Sofás)' },
    'ESTRUCTURAS_SILLAS':     { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Carpintería (Sillas)' },
    'CORTE_Y_CONTROL_TELAS':  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura (Telas)' },
    'TELAS':                  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura' },
    'PREPARACION_PATAS_ZOCALO':{ icono: '<i class="fa-solid fa-shoe-prints"></i>',   nombre: 'Patas y Zócalos' },
    'TABLEROS_Y_PIEDRAS':     { icono: '<i class="fa-solid fa-table-cells-large"></i>',nombre: 'Tableros (Comedor)' },
    'TAPICERIA_SOFAS':        { icono: '<i class="fa-solid fa-couch"></i>',           nombre: 'Tapicería (Sofás)' },
    'TAPICERIA_SILLAS':       { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Tapicería (Sillas)' },
    'ARMADO_COJINES':         { icono: '<i class="fa-solid fa-layer-group"></i>',     nombre: 'Armado de Cojines' },
    'DESPACHO_CENTRAL':       { icono: '<i class="fa-solid fa-truck"></i>',           nombre: 'Despacho Central' },
};

/* ================================================================= */
/* --- VISTA COLA DE RECOJO CON PDF                              --- */
/* ================================================================= */

async function cargarVistaColaRecojo(contenedor) {
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/cola-recojo`);
        const data = await res.json();

        // Soporte retrocompatible: si el backend devuelve array plano (versión vieja),
        // lo convertimos al nuevo formato.
        const estructuras = Array.isArray(data) ? data : (data.estructuras || []);
        const compras     = Array.isArray(data) ? []   : (data.compras_externas || data.telas || []);

        // Guardar para los PDF masivos (sección A)
        window._colaRecojoData = estructuras;

        if (estructuras.length === 0 && compras.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin recojos pendientes</p>
                    <p style="font-size:13px;">Todas las estructuras terminadas o compras externas ya fueron recogidas.</p>
                </div>`;
            return;
        }

        let html = '';

        // ── SECCIÓN B: Compras Externas listas para recoger del proveedor ─────────────────
        if (compras.length > 0) {
            html += `
            <div style="margin-bottom:28px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; color:#7c3aed; font-size:15px; font-weight:900;">
                            <i class="fa-solid fa-boxes-packing"></i> 📦 ${compras.length} compra(s) lista(s) para recoger del proveedor
                        </h3>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">El chofer o responsable debe ir a buscar estos insumos o productos</p>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">`;

            compras.forEach(t => {
                const fechaProv = t.fecha_entrega_proveedor
                    ? `<span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;">📅 ${t.fecha_entrega_proveedor}</span>`
                    : '';
                const tel = t.telefono_proveedor
                    ? `<a href="tel:${t.telefono_proveedor}" style="color:#7c3aed;font-weight:700;text-decoration:none;"><i class="fa-solid fa-phone"></i> ${t.telefono_proveedor}</a>`
                    : '';
                const dir = t.direccion_proveedor
                    ? `<span style="color:#64748b;font-size:11px;"><i class="fa-solid fa-location-dot"></i> ${t.direccion_proveedor}</span>`
                    : '';
                const fotoCot = t.url_cotizacion_adjunta
                    ? `<a href="${t.url_cotizacion_adjunta}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#f5f3ff;color:#7c3aed;padding:5px 10px;border-radius:7px;font-size:10px;font-weight:800;text-decoration:none;"><i class="fa-solid fa-file-image"></i> Ver cotización</a>`
                    : '';
                const notas = t.notas_proveedor
                    ? `<div style="font-size:11px;color:#475569;background:#faf5ff;border-left:3px solid #a78bfa;padding:6px 10px;border-radius:0 6px 6px 0;margin-top:6px;">${t.notas_proveedor}</div>`
                    : '';

                html += `
                <div style="background:white; border-radius:14px; border:1.5px solid #ddd6fe; box-shadow:0 4px 12px rgba(124,58,237,0.07); overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe); padding:13px 18px; border-bottom:2px solid #ddd6fe; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#7c3aed; text-transform:uppercase; letter-spacing:1px;">COMPRA EXTERNA · Ref. ${t.codigo_venta}</span>
                            <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${t.insumo}${t.sku ? ` <span style="font-size:11px;color:#94a3b8;font-weight:600;">(${t.sku})</span>` : ''}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;"><b>Cliente:</b> ${t.cliente}</p>
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; align-items:center;">
                                <span style="font-size:12px; font-weight:800; color:#0f172a; background:#ede9fe; padding:3px 10px; border-radius:20px;">
                                    <i class="fa-solid fa-store"></i> ${t.proveedor}
                                </span>
                                ${tel} ${dir} ${fechaProv}
                            </div>
                        </div>
                        <button onclick="_confirmarRecojoExterno(${t.logistica_id}, '${t.insumo.replace(/'/g,"\\'")}', this)"
                            style="background:#7c3aed; color:white; border:none; padding:10px 16px; border-radius:9px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:7px;">
                            <i class="fa-solid fa-circle-check"></i> Confirmar recojo
                        </button>
                    </div>
                    <div style="padding:12px 18px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                        ${fotoCot}
                        ${notas}
                        ${t.cantidad > 1 ? `<span style="font-size:11px;color:#64748b;background:#f8fafc;padding:3px 8px;border-radius:6px;"><i class="fa-solid fa-ruler"></i> ${t.cantidad} ${t.unidad || 'unid.'}</span>` : ''}
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        }

        // ── SECCIÓN A: Estructuras listas para llevar al tapicero ──────────────
        if (estructuras.length > 0) {
            html += `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; color:#c2410c; font-size:15px; font-weight:900;">
                            <i class="fa-solid fa-truck-fast"></i> 🧱 ${estructuras.length} estructura${estructuras.length>1?'s':''} lista${estructuras.length>1?'s':''} para llevar al tapicero
                        </h3>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Descarga el PDF de cada item o genera una hoja de recojo masiva</p>
                    </div>
                    <button onclick="imprimirPDFRecojoMasivo()" 
                        style="background:#c2410c; color:white; border:none; padding:12px 20px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-file-pdf"></i> PDF MASIVO (${estructuras.length} items)
                    </button>
                </div>
                <div style="display:flex; flex-direction:column; gap:15px;">`;

            estructuras.forEach((c, idx) => {
                const fotoEstructura = c.foto_url && !c.foto_url.includes('sin_foto') ? c.foto_url.split('|')[0] : null;
                const fotoEvidencia  = c.foto_evidencia || null;
                const telaLista = c.tela_distribuida !== false; // true si campo ausente (retrocompat)
                const semColor  = telaLista ? '#16a34a' : '#f59e0b';
                const semIcon   = telaLista ? '🟢' : '🟡';
                const semLabel  = telaLista
                    ? '<span style="color:#16a34a; font-weight:800; font-size:11px;">🟢 Tela lista — recojo habilitado</span>'
                    : '<span style="color:#f59e0b; font-weight:800; font-size:11px;">🟡 Tela pendiente de distribución al tapicero</span>';

                html += `
                <div style="background:white; border-radius:14px; border:1px solid ${semColor}55; box-shadow:0 4px 12px rgba(249,115,22,0.08); overflow:hidden;">
                    <!-- Cabecera naranja -->
                    <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5); padding:14px 18px; border-bottom:2px solid ${semColor}44; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <span style="font-size:10px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:1px;">${semIcon} ${c.area.replace(/_/g,' ')} · Terminado el ${c.fecha_fin}</span>
                            <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${c.producto}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;">
                                <b>Ref:</b> ${c.codigo_venta} &nbsp;|&nbsp; <b>Cliente:</b> ${c.cliente}
                                ${c.direccion ? `&nbsp;|&nbsp; <b>Entrega:</b> ${c.fecha_entrega}` : ''}
                            </p>
                            <p style="margin:4px 0 2px 0; font-size:11px; color:#64748b;">
                                <i class="fa-solid fa-user-gear"></i> <b>Carpintero:</b> ${c.operario} &nbsp;
                                <i class="fa-solid fa-couch"></i> <b>Tapicero:</b> <span style="color:#0369a1; font-weight:bold;">${c.tapicero}</span>
                            </p>
                            ${semLabel}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                            <button onclick="imprimirPDFRecojoUnitario(${idx})" 
                                data-recojo-idx="${idx}"
                                style="background:#f97316; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                                <i class="fa-solid fa-file-pdf"></i> PDF Unitario
                            </button>
                            ${(typeof usuarioActivo !== 'undefined' && (usuarioActivo.rol === 'Chofer' || usuarioActivo.rol === 'Admin' || usuarioActivo.rol === 'Jefe_Taller'))
                                ? (telaLista
                                    ? `<button onclick="confirmarRecojoEstructura(${c.ticket_id}, '${(c.producto||'').replace(/'/g,"\\'")}', this)"
                                        style="background:#dc2626; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                                        ✅ Confirmar Recojo
                                    </button>`
                                    : `<button disabled title="Esperando que la tela sea distribuida al tapicero"
                                        style="background:#d1d5db; color:#6b7280; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:not-allowed; white-space:nowrap;">
                                        🟡 Esperando tela
                                    </button>`)
                                : ''}
                        </div>
                    </div>
                    <!-- Cuerpo con fotos -->
                    <div style="padding:15px 18px; display:flex; gap:15px; flex-wrap:wrap; align-items:flex-start;">
                        ${fotoEstructura ? `
                        <div style="text-align:center;">
                            <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Foto del Mueble</span>
                            <img src="${fotoEstructura}" alt="Mueble"
                                style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0;"
                                onerror="this.parentElement.style.display='none'">
                        </div>` : ''}
                        ${fotoEvidencia ? `
                        <div style="text-align:center;">
                            <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Evidencia Terminado</span>
                            <img src="${fotoEvidencia}" alt="Evidencia"
                                style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #22c55e;"
                                onerror="this.parentElement.style.display='none'">
                        </div>` : ''}
                        ${c.especificaciones ? `
                        <div style="flex:1; min-width:180px; background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #f97316;">
                            <span style="font-size:9px; font-weight:900; color:#f97316; display:block; margin-bottom:6px; text-transform:uppercase;">Especificaciones</span>
                            <div style="font-size:11px; color:#374151; line-height:1.5;">${c.especificaciones.replace(/\n/g,'<br>')}</div>
                        </div>` : ''}
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;

    } catch(e) {
        console.error('Error cargando cola de recojo:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar la cola de recojo.</p>`;
    }
}

async function _confirmarRecojoExterno(logisticaId, insumoNombre, btnEl) {
    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar recojo?',
        html: `<p style="font-size:14px;color:#374151;">Confirma que recogiste físicamente:<br><b>${insumoNombre}</b><br><br>Se marcará como Recibido y habilitará la producción o el despacho del ítem.</p>`,
        showCancelButton: true,
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: 'transparent',
        confirmButtonText: '✅ Sí, lo recogí',
        cancelButtonText: 'Cancelar',
    });
    if (!conf.isConfirmed) return;

    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await apiFetch(`${API_URL}/api/logistica/${logisticaId}/confirmar-recojo-externo`, { method: 'POST' });
        const d   = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: '¡Recojo confirmado!', text: d.mensaje, timer: 2500, showConfirmButton: false });
            // Recargar la cola para que el item desaparezca
            const contFinal = document.getElementById('contenedor-cola-recojo') || document.querySelector('.cola-recojo-wrapper') || document.getElementById('contenedor-tickets-taller');
            if (contFinal) await cargarTicketsTaller();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error || 'No se pudo confirmar' });
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirmar recojo';
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
        btnEl.disabled = false;
        btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirmar recojo';
    }
}

// Helper: detecta el modelo base de un nombre de producto (para buscar stock coincidente)
function _extraerModeloBase(nombreProducto) {
    if (!nombreProducto) return '';
    const nombre = nombreProducto.toLowerCase();
    const modelos = [
        'multifuncional', 'multi3', 'multi4',
        'seccional invertido', 'seccional',
        'curvo', 'en u', 'juego', 'esquinero',
        'sofá 3', 'sofá 2', 'sofá 1',
        'sofa 3', 'sofa 2', 'sofa 1',
        'butaca', 'silla', 'cama', 'camas', 'puff',
    ];
    for (const m of modelos) {
        if (nombre.includes(m)) {
            return m.charAt(0).toUpperCase() + m.slice(1);
        }
    }
    return '';
}

async function cargarSugerenciasEstructura(ancho, profundidad, alto, ticketId, contenedorId, modeloBase = '') {
    try {
        const cont = document.getElementById(contenedorId);
        if (!cont) return;
 
        // — Primera consulta: por modelo_base y/o medidas —
        const params = new URLSearchParams({
            ancho:       ancho       || 0,
            profundidad: profundidad || 0,
            alto:        alto        || 0,
        });
        if (modeloBase) params.append('modelo_base', modeloBase);
 
        const res          = await apiFetch(`${API_URL}/api/stock-estructuras/sugerir?${params}`);
        let   sugerencias  = await res.json();
 
        // — Fallback: si no hay resultados, buscar solo estructuras estándar —
        let soloEstandar = false;
        if (!Array.isArray(sugerencias) || !sugerencias.length) {
            const res2       = await apiFetch(`${API_URL}/api/stock-estructuras/sugerir?solo_estandar=true`);
            sugerencias      = await res2.json();
            soloEstandar     = true;
        }
 
        if (!Array.isArray(sugerencias) || !sugerencias.length) return;
 
        // — Agrupar resultados —
        const porModelo   = sugerencias.filter(s =>
            s.modelo_base && modeloBase &&
            s.modelo_base.toLowerCase() === modeloBase.toLowerCase()
        );
        const estandares  = sugerencias.filter(s => s.medida_estandar && !porModelo.includes(s));
        const porMedidas  = sugerencias.filter(s => !porModelo.includes(s) && !estandares.includes(s));
 
        const renderOption = s => {
            const tagModelo = (s.modelo_base && modeloBase &&
                s.modelo_base.toLowerCase() === modeloBase.toLowerCase())
                ? ' 🎯 Mismo modelo' : '';
            const tagEst    = s.medida_estandar ? ' ⭐ Estándar' : '';
            const medidas   = (s.ancho || s.profundidad || s.alto)
                ? ` · ${s.ancho}×${s.profundidad}×${s.alto} cm` : '';
            const modeloTag = s.modelo_base ? ` (${s.modelo_base})` : '';
            return `<option value="${s.id}">${s.nombre_modelo}${modeloTag}${medidas}${tagModelo}${tagEst}</option>`;
        };
 
        let opcionesHTML = `<option value="">— Seleccionar estructura del stock —</option>`;
 
        if (soloEstandar) {
            // Modo fallback: solo estándar, mostrar con título especial
            opcionesHTML += `<optgroup label="⭐ Estructuras estándar disponibles">`;
            opcionesHTML += sugerencias.map(renderOption).join('');
            opcionesHTML += `</optgroup>`;
        } else {
            if (porModelo.length > 0) {
                opcionesHTML += `<optgroup label="🎯 Mismo modelo (${modeloBase})">`;
                opcionesHTML += porModelo.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            if (estandares.length > 0) {
                opcionesHTML += `<optgroup label="📐 Medidas estándar">`;
                opcionesHTML += estandares.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            if (porMedidas.length > 0) {
                opcionesHTML += `<optgroup label="📏 Medidas similares">`;
                opcionesHTML += porMedidas.map(renderOption).join('');
                opcionesHTML += `</optgroup>`;
            }
            // Seguridad: si no cayó en ningún grupo, mostrar plano
            if (!porModelo.length && !estandares.length && !porMedidas.length) {
                opcionesHTML += sugerencias.map(renderOption).join('');
            }
        }
 
        cont.innerHTML = `
          <div style="background:#f5f3ff;border:1.5px solid #7c3aed;border-radius:10px;
                      padding:12px;margin-top:10px;" id="box-est-${ticketId}">
            <div style="font-weight:700;font-size:13px;color:#7c3aed;margin-bottom:4px;">
              📦 Stock disponible — ya está pagado, NO cobrar:
            </div>
            <div style="font-size:11px;color:var(--text-muted,#64748b);margin-bottom:8px;">
              Selecciona una estructura del inventario para asignarla a este pedido.
            </div>
            <select id="sel-estructura-${ticketId}"
                style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;
                       font-size:13px;margin-bottom:8px;">
              ${opcionesHTML}
            </select>
            <button onclick="usarEstructuraStock(${ticketId})"
                id="btn-usar-est-${ticketId}"
                style="width:100%;padding:10px;background:#7c3aed;color:white;border:none;
                       border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                ✅ Usar esta estructura (ya está pagada — no cobrar al cliente)
            </button>
          </div>`;
 
    } catch(e) {
        console.warn('No se pudieron cargar sugerencias de stock:', e);
    }
}
 
async function usarEstructuraStock(ticketId) {
    const sel = document.getElementById(`sel-estructura-${ticketId}`);
    if (!sel || !sel.value) {
        return Swal.fire({ icon: 'warning', text: 'Selecciona una estructura.' });
    }
 
    // Obtener nombre para mostrarlo en el badge
    const nombreElegido = sel.options[sel.selectedIndex]?.text || '';
 
    const { isConfirmed } = await Swal.fire({
        icon: 'question',
        title: '¿Usar esta estructura del stock?',
        html: `<p style="font-size:13px;color:#475569;">
                Esta estructura <b>ya está pagada</b> — se asignará al ticket
                y el carpintero NO necesita fabricarla.<br><br>
                <span style="background:#fef3c7;color:#92400e;padding:6px 10px;
                             border-radius:6px;font-size:12px;font-weight:700;
                             display:inline-block;">
                  ⚠️ NO cobrar al cliente por esta pieza
                </span>
               </p>`,
        showCancelButton:    true,
        confirmButtonText:   '✅ Sí, usar del stock',
        cancelButtonText:    'Cancelar',
        confirmButtonColor:  '#7c3aed',
    });
    if (!isConfirmed) return;
 
    const res = await apiFetch(`${API_URL}/api/stock-estructuras/${sel.value}/usar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticket_id: ticketId }),
    });
    const d = await res.json();
 
    if (d.exito) {
        Swal.fire({
            icon: 'success', title: 'Listo',
            text: 'Estructura asignada desde stock.',
            timer: 1800, showConfirmButton: false,
        });
 
        // ── Actualización local del DOM ──────────────────────────────────
        // 1. Reemplazar el dropdown por un badge de confirmación
        const box = document.getElementById(`box-est-${ticketId}`);
        if (box) {
            box.innerHTML = `
              <div style="background:#ecfdf5;border:1.5px solid #16a34a;border-radius:8px;
                          padding:10px 14px;font-size:13px;color:#15803d;font-weight:600;">
                ✅ Estructura del stock asignada · <span style="font-weight:400;">${nombreElegido}</span>
              </div>`;
        }
 
        // 2. Resaltar la tarjeta del ticket con borde verde
        const card = document.querySelector(`[data-ticket-id="${ticketId}"]`)
                  || document.getElementById(`ticket-card-${ticketId}`)
                  || (() => {
                       // fallback: buscar el contenedor padre del div de sugerencias
                       const sugDiv = document.getElementById(`sug-est-${ticketId}`);
                       return sugDiv ? sugDiv.closest('[class*="ticket"]') : null;
                   })();
        if (card) {
            card.style.border     = '2px solid #16a34a';
            card.style.background = 'rgba(22,163,74,0.04)';
        }
 
        // 3. Ocultar el botón "Iniciar trabajo" del mismo ticket (ya no hay que fabricar)
        const btnIniciar = document.getElementById(`btn-iniciar-${ticketId}`)
                        || document.querySelector(`[onclick*="iniciarTicket(${ticketId})"]`);
        if (btnIniciar) btnIniciar.style.display = 'none';
 
    } else {
        Swal.fire({ icon: 'error', text: d.error || 'Error al asignar la estructura.' });
    }
}


/* --- PDF UNITARIO DE RECOJO --- */
function imprimirPDFRecojoUnitario(idx) {
    const cola = window._colaRecojoData;
    if (!cola || !cola[idx]) return;
    const c = cola[idx];
    abrirVentanaPDFRecojo([c], `HOJA DE RECOJO — ${c.codigo_venta}`);
}

/* --- PDF MASIVO DE RECOJO --- */
function imprimirPDFRecojoMasivo() {
    const cola = window._colaRecojoData;
    if (!cola || cola.length === 0) return Swal.fire('Sin datos', 'No hay items en la cola.', 'info');
    abrirVentanaPDFRecojo(cola, `HOJA DE RECOJO MASIVO — ${cola.length} Estructuras`);
}

/* --- GENERADOR DE PDF DE RECOJO (unitario y masivo comparten el mismo motor) --- */
function abrirVentanaPDFRecojo(items, titulo) {
    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });

    const filas = items.map((c, i) => `
        <div class="recojo-item ${i > 0 ? 'page-break' : ''}">
            <!-- Encabezado del item -->
            <div class="item-header">
                <div class="item-numero">ITEM ${String(i+1).padStart(2,'0')}</div>
                <div class="item-info">
                    <div class="item-titulo">${c.producto}</div>
                    <div class="item-meta">
                        <span><b>Ref:</b> ${c.codigo_venta}</span>
                        <span><b>Cliente:</b> ${c.cliente.toUpperCase()}</span>
                        <span><b>Entrega:</b> ${c.fecha_entrega || 'S/F'}</span>
                    </div>
                    <div class="item-meta" style="margin-top:4px;">
                        <span><b>Área terminada:</b> ${c.area.replace(/_/g,' ')}</span>
                        <span><b>Terminado el:</b> ${c.fecha_fin}</span>
                    </div>
                </div>
                <div class="item-badge">PARA RECOGER</div>
            </div>

            <!-- Cuerpo: fotos + specs + operarios -->
            <div class="item-body">
                <!-- Columna de fotos -->
                <div class="fotos-col">
                    ${c.foto_url && !c.foto_url.includes('sin_foto') ? `
                    <div class="foto-box">
                        <div class="foto-label">Foto del Mueble</div>
                        <img src="${c.foto_url.split('|')[0]}" class="foto-img" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    ${c.foto_evidencia ? `
                    <div class="foto-box">
                        <div class="foto-label">Evidencia Terminado</div>
                        <img src="${c.foto_evidencia}" class="foto-img evidencia" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                </div>

                <!-- Columna de datos -->
                <div class="datos-col">
                    <table class="datos-tabla">
                        <tr><th>Carpintero / Operario</th><td>${c.operario}</td></tr>
                        <tr><th>Tapicero Asignado</th><td style="color:#0369a1; font-weight:bold;">${c.tapicero}</td></tr>
                        ${c.direccion ? `<tr><th>Dirección Entrega</th><td>${c.direccion}</td></tr>` : ''}
                        ${c.especificaciones ? `<tr><th>Especificaciones</th><td class="specs">${c.especificaciones.replace(/\n/g,'<br>').replace(/<b>/g,'<b>').replace(/<\/b>/g,'</b>')}</td></tr>` : ''}
                    </table>
                </div>
            </div>

            <!-- Firmas -->
            <div class="firmas">
                <div class="firma-box"><div class="firma-linea"></div><p>Carpintero / Entrega</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Chofer / Transporte</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Tapicero / Recepción</p></div>
            </div>
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: white; font-size: 12px; }

    /* --- Encabezado de empresa --- */
    .empresa-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px 24px; border-bottom: 3px solid #f97316;
        margin-bottom: 20px;
    }
    .empresa-logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
    .empresa-logo span { color: #0f172a; }
    .empresa-doc { text-align: right; }
    .empresa-doc h2 { font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .empresa-doc p { font-size: 10px; color: #64748b; }
    .empresa-doc .badge-doc {
        background: #f97316; color: white; font-size: 10px; font-weight: 900;
        padding: 3px 10px; border-radius: 20px; display: inline-block; margin-bottom: 4px;
    }

    /* --- Item de recojo --- */
    .recojo-item { margin-bottom: 30px; }
    .page-break { page-break-before: always; padding-top: 20px; }

    .item-header {
        display: flex; align-items: flex-start; gap: 12px;
        background: linear-gradient(135deg, #fff7ed, #ffedd5);
        border: 2px solid #f97316; border-radius: 10px 10px 0 0;
        padding: 12px 16px;
    }
    .item-numero {
        background: #f97316; color: white; font-size: 11px; font-weight: 900;
        padding: 6px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }
    .item-info { flex: 1; }
    .item-titulo { font-size: 16px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .item-meta { display: flex; gap: 16px; font-size: 11px; color: #374151; flex-wrap: wrap; }
    .item-meta span b { color: #f97316; }
    .item-badge {
        background: #dc2626; color: white; font-size: 10px; font-weight: 900;
        padding: 5px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }

    .item-body {
        display: flex; gap: 0; border: 2px solid #f97316; border-top: none; border-radius: 0 0 0 0;
        min-height: 160px;
    }
    .fotos-col {
        display: flex; flex-direction: column; gap: 0;
        border-right: 1px solid #fed7aa; min-width: 140px; max-width: 180px;
    }
    .foto-box { padding: 10px; border-bottom: 1px solid #fed7aa; }
    .foto-box:last-child { border-bottom: none; }
    .foto-label { font-size: 9px; font-weight: 900; color: #f97316; text-transform: uppercase; margin-bottom: 5px; }
    .foto-img { width: 120px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; display: block; }
    .foto-img.evidencia { border-color: #22c55e; }

    .datos-col { flex: 1; padding: 12px; }
    .datos-tabla { width: 100%; border-collapse: collapse; }
    .datos-tabla th {
        text-align: left; font-size: 10px; font-weight: 900; color: #64748b;
        text-transform: uppercase; padding: 7px 8px; background: #f8fafc;
        border-bottom: 1px solid #e2e8f0; white-space: nowrap; width: 140px;
    }
    .datos-tabla td {
        font-size: 12px; padding: 7px 8px; border-bottom: 1px solid #f1f5f9;
        color: #1e293b; vertical-align: top;
    }
    .datos-tabla td.specs { font-size: 11px; line-height: 1.6; color: #374151; }

    /* Firmas */
    .firmas {
        display: flex; gap: 0;
        border: 2px solid #f97316; border-top: 1px solid #fed7aa;
        border-radius: 0 0 10px 10px; overflow: hidden;
    }
    .firma-box {
        flex: 1; padding: 14px 16px; text-align: center;
        border-right: 1px solid #fed7aa;
    }
    .firma-box:last-child { border-right: none; }
    .firma-linea { border-bottom: 1.5px solid #0f172a; margin-bottom: 6px; height: 30px; }
    .firma-box p { font-size: 10px; color: #64748b; font-weight: 700; }

    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none; }
    }
</style>
</head>
<body>

<div class="empresa-header">
    <div>
        <div class="empresa-logo">INNOVA <span>MOBILI</span></div>
        <p style="font-size:10px; color:#64748b; margin-top:3px;">Sistema de Producción y Despacho</p>
    </div>
    <div class="empresa-doc">
        <div class="badge-doc"><i>🚛</i> HOJA DE RECOJO</div>
        <h2>${titulo}</h2>
        <p>Fecha de emisión: ${fecha}</p>
        <p style="margin-top:2px; font-weight:bold; color:#f97316;">${items.length} ESTRUCTURA${items.length>1?'S':''} A RECOGER</p>
    </div>
</div>

${filas}

<div style="text-align:center; margin-top:20px; padding:10px; font-size:10px; color:#94a3b8; border-top:1px dashed #e2e8f0;">
    Documento generado por INNOVA MOBILI ERP · ${fecha}
</div>

<script>
    window.onload = function() {
        // Esperar que carguen las imágenes antes de imprimir
        const imgs = document.images;
        let loaded = 0;
        const total = imgs.length;
        if (total === 0) { setTimeout(() => window.print(), 300); return; }
        for (let i = 0; i < total; i++) {
            if (imgs[i].complete) {
                loaded++;
                if (loaded === total) { setTimeout(() => window.print(), 400); }
            } else {
                imgs[i].onload = imgs[i].onerror = function() {
                    loaded++;
                    if (loaded === total) { setTimeout(() => window.print(), 400); }
                };
            }
        }
    };
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return Swal.fire('Bloqueado', 'Permite ventanas emergentes en tu navegador para generar el PDF.', 'warning');
    win.document.write(html);
    win.document.close();
}

async function cargarTicketsTaller() {
    const contenedor = document.getElementById('contenedor-tickets-taller');
    if (!contenedor || !usuarioActivo) return;

    // ── Actualizar badge de stats siempre que se cargue el taller ──
    cargarStatsTaller();

    const esAdmin      = ['Admin', 'Jefe_Taller'].includes(usuarioActivo.rol);
    const esOperario   = usuarioActivo.rol === 'Operario';
    const esChofer     = usuarioActivo.rol === 'Chofer';

    // ── TABS: solo para Operario y Jefe viendo sus tareas ──
    let tabsHeader = document.getElementById('tabs-taller-header');
    if (!tabsHeader) {
        tabsHeader = document.createElement('div');
        tabsHeader.id = 'tabs-taller-header';
        tabsHeader.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;';
        contenedor.parentNode.insertBefore(tabsHeader, contenedor);
    }

    if (esAdmin && typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'stock_produccion') {
        tabsHeader.style.display = 'none';
        // Resetear el grid del contenedor para que el stock ocupe todo el ancho
        contenedor.style.display = 'block';
        contenedor.style.gridTemplateColumns = '';
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando stock de producción...</p>';
        await cargarVistaStockProduccion(contenedor);
        return;
    } else {
        tabsHeader.style.display = 'flex';
        // Restaurar el grid del contenedor para las vistas de tickets
        contenedor.style.display = 'grid';
        contenedor.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))';
    }

    if (esAdmin) {
        tabsHeader.innerHTML = `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                <button onclick="filtroAdminTaller='pendientes'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? '#0f172a' : '#e2e8f0'};
                    color:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? 'white' : '#475569'};">
                    <i class="fa-solid fa-user-plus"></i> PENDIENTES DE ASIGNAR
                </button>
                <button onclick="filtroAdminTaller='ordenes'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='ordenes' ? '#558fc5' : '#eff6ff'};
                    color:${filtroAdminTaller==='ordenes' ? 'white' : '#1e40af'};
                    border:2px solid #93c5fd;">
                    <i class="fa-solid fa-list-check"></i> ÓRDENES POR PEDIDO
                </button>
                <button onclick="filtroAdminTaller='recojo'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='recojo' ? '#c2410c' : '#fff7ed'};
                    color:${filtroAdminTaller==='recojo' ? 'white' : '#c2410c'};
                    border:2px solid #f97316;">
                    <i class="fa-solid fa-truck-fast"></i> COLA DE RECOJO
                </button>
                <button onclick="filtroAdminTaller='entregados'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='entregados' ? '#15803d' : '#f0fdf4'};
                    color:${filtroAdminTaller==='entregados' ? 'white' : '#15803d'};
                    border:2px solid #86efac;">
                    <i class="fa-solid fa-circle-check"></i> ENTREGADOS
                </button>
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // Si está en vista RECOJO, mostrar esa sección y salir
        if (filtroAdminTaller === 'recojo') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojo(contenedor);
            return;
        }

        // Si está en vista ENTREGADOS, mostrar historial y salir
        if (filtroAdminTaller === 'entregados') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando historial de entregas...</p>';
            await cargarVistaEntregados(contenedor, null);
            return;
        }

        // Si está en vista ÓRDENES POR PEDIDO, mostrar esa sección y salir
        if (filtroAdminTaller === 'ordenes') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando órdenes de producción...</p>';
            await cargarOrdenesProduccion(contenedor);
            return;
        }
    } else if (esChofer) {
        // ── CHOFER: vista propia con fichas de entrega ──────────────────────
        const filtroChofer = (typeof filtroAdminTaller !== 'undefined' && filtroAdminTaller === 'entregados_chofer')
            ? 'entregados_chofer'
            : (filtroAdminTaller === 'cola_recojo_chofer' ? 'cola_recojo_chofer' : 'activas');
        tabsHeader.innerHTML = `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                <button onclick="filtroAdminTaller='cola_recojo_chofer'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='cola_recojo_chofer' ? '#dc2626' : '#fff5f5'};
                    color:${filtroChofer==='cola_recojo_chofer' ? 'white' : '#991b1b'};
                    border:2px solid #fca5a5;">
                    🔴 COLA DE RECOJO
                </button>
                <button onclick="filtroAdminTaller='activas'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='activas' ? '#1e40af' : '#eff6ff'};
                    color:${filtroChofer==='activas' ? 'white' : '#1e40af'};
                    border:2px solid #93c5fd;">
                    <i class="fa-solid fa-truck"></i> MIS ENTREGAS ASIGNADAS
                </button>
                <button onclick="filtroAdminTaller='entregados_chofer'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroChofer==='entregados_chofer' ? '#15803d' : '#f0fdf4'};
                    color:${filtroChofer==='entregados_chofer' ? 'white' : '#15803d'};
                    border:2px solid #86efac;">
                    <i class="fa-solid fa-circle-check"></i> MIS ENTREGADOS
                </button>
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569; margin-left:auto;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // ── Tab "Cola de Recojo" del chofer ──────────────────────────────────
        if (filtroChofer === 'cola_recojo_chofer') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojoChofer(contenedor);
            return;
        }

        // ── Tab "Mis Entregados" del chofer ──────────────────────────────────
        if (filtroChofer === 'entregados_chofer') {
            contenedor.style.display = 'block';
            contenedor.style.gridTemplateColumns = '';
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando historial...</p>';
            await cargarVistaEntregados(contenedor, usuarioActivo.id);
            return;
        }

        contenedor.style.display = 'block';
        contenedor.style.gridTemplateColumns = '';
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:30px;">Cargando tus entregas...</p>';

        try {
            const res     = await apiFetch(`${API_URL}/api/taller/tickets?area=DESPACHO_CENTRAL`);
            const tickets = await res.json();

            if (!Array.isArray(tickets)) {
                contenedor.innerHTML = `<p style="color:red;text-align:center;">Error: ${tickets.error||'Respuesta inválida'}</p>`;
                return;
            }

            const misDespachos = tickets.filter(t =>
                t.area === 'DESPACHO_CENTRAL' &&
                Number(t.trabajador) === Number(usuarioActivo.id) &&
                t.estado !== 'Terminado'
            );

            if (misDespachos.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center;padding:60px 20px;color:#64748b;">
                        <div style="font-size:48px;margin-bottom:16px;">🚚</div>
                        <p style="font-weight:700;font-size:15px;color:#374151;margin:0 0 8px;">Sin entregas pendientes</p>
                        <p style="font-size:13px;margin:0;">Cuando el administrador te asigne una entrega aparecerá aquí.</p>
                    </div>`;
                return;
            }

            let html = '';
            for (const t of misDespachos) {
                const isEnProceso = t.estado === 'En Proceso';
                html += `
                <div style="background:#fff;border:2px solid ${isEnProceso?'#3b82f6':'#e2e8f0'};border-radius:14px;padding:0;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.07);overflow:hidden;">
                    <!-- Cabecera -->
                    <div style="background:${isEnProceso?'linear-gradient(135deg,#eff6ff,#dbeafe)':'#f8fafc'};padding:14px 16px;border-bottom:1px solid ${isEnProceso?'#93c5fd':'#e2e8f0'};display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Despacho asignado</div>
                            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">${t.producto}</div>
                        </div>
                        <span style="background:${isEnProceso?'#3b82f6':'#f59e0b'};color:white;font-size:11px;font-weight:800;padding:5px 12px;border-radius:20px;">
                            ${isEnProceso?'🔵 EN RUTA':'🟡 PENDIENTE'}
                        </span>
                    </div>
                    <!-- Ficha técnica (se carga al abrir) -->
                    <div id="ficha-chofer-${t.id}" style="display:none;"></div>
                    <!-- Botones principales -->
                    <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
                        <button onclick="toggleFichaChofer(${t.id}, ${t.item_id})"
                            id="btn-ficha-${t.id}"
                            style="width:100%;background:#0f172a;color:white;border:none;padding:11px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                            <i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA
                        </button>
                        ${renderBotonTicket(t, false, false, isEnProceso, false)}
                    </div>
                </div>`;
            }
            contenedor.innerHTML = html;
        } catch(e) {
            contenedor.innerHTML = `<p style="color:red;text-align:center;">Error de conexión. Intenta de nuevo.</p>`;
        }
        return; // El chofer no sigue el flujo normal del taller

    } else {
        // Carpintero de sofás: tiene tab extra de STOCK
        const esCarpinteroSofa = esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES';
        tabsHeader.innerHTML = `
            <button onclick="filtroTaller='Pendientes'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Pendientes' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-clock"></i> MIS TAREAS
            </button>
            ${esCarpinteroSofa ? `
            <button onclick="filtroTaller='StockCarpintero'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'StockCarpintero' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-boxes-stacked"></i> STOCK
            </button>` : ''}
            <button onclick="filtroTaller='Terminado'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Terminado' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-circle-check"></i> ${esCarpinteroSofa ? 'ENTREGADOS' : 'TRABAJOS TERMINADOS'}
            </button>`;
    }
    // Carpintero de sofás: tab de stock propio
    if (esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES' && filtroTaller === 'StockCarpintero') {
        contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando stock...</p>';
        await cargarVistaStockCarpinteroSofa(contenedor);
        return;
    }
    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Sincronizando...</p>';

    try {
        // Traer todos los tickets (el backend filtra por area si es operario vía query param)
        const url = esOperario
            ? `${API_URL}/api/taller/tickets?area=${encodeURIComponent(usuarioActivo.area_asignada)}`
            : `${API_URL}/api/taller/tickets`;

        const res     = await apiFetch(url);
        const tickets = await res.json();

        if (!Array.isArray(tickets)) {
            contenedor.innerHTML = `<p style="color:red; text-align:center;">Error: ${tickets.error || 'Respuesta inválida del servidor'}</p>`;
            return;
        }

        let ticketsFiltrados = tickets;

        if (esAdmin) {
            // Admin ve tickets no terminados, no listos para recojo ni recogidos.
            ticketsFiltrados = tickets.filter(t => 
                (t.es_logistica && t.estado !== 'Distribuido') ||
                (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
            );
        } else if (esOperario) {
            // Operario: solo los asignados a él
            ticketsFiltrados = tickets.filter(t => Number(t.trabajador) === Number(usuarioActivo.id));
            // Luego aplica filtro de tab
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado !== 'Distribuido') ||
                    (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
                );
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado === 'Distribuido') ||
                    (!t.es_logistica && (t.estado === 'Terminado' || t.estado === 'Listo para Recojo' || t.estado === 'Recogido'))
                );
            }
        } else {
            // Jefe de taller: ve todos, con tabs
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado !== 'Distribuido') ||
                    (!t.es_logistica && t.estado !== 'Terminado' && t.estado !== 'Listo para Recojo' && t.estado !== 'Recogido')
                );
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => 
                    (t.es_logistica && t.estado === 'Distribuido') ||
                    (!t.es_logistica && (t.estado === 'Terminado' || t.estado === 'Listo para Recojo' || t.estado === 'Recogido'))
                );
            }
        }

        if (ticketsFiltrados.length === 0) {
            const msg = esAdmin
                ? '✅ Todos los tickets están asignados. No hay tareas pendientes de asignar.'
                : `No hay trabajos en esta pestaña.`;
            contenedor.innerHTML = `<p style="color:gray; font-size:13px; text-align:center; padding:30px;">${msg}</p>`;
            return;
        }

        // Agrupar por área
        const areas = {};
        ticketsFiltrados.forEach(t => {
            const key = t.area || 'Sin Área';
            if (!areas[key]) areas[key] = [];
            areas[key].push(t);
        });

        contenedor.style.display = 'block';
        let html = '';

        for (const [areaId, listaTickets] of Object.entries(areas)) {
            const cfg = CONFIG_AREAS[areaId] || { icono: '<i class="fa-solid fa-gears"></i>', nombre: areaId };

            // Color de cabecera del área según si todos están terminados
            const todosTerminados = listaTickets.every(t => t.estado === 'Terminado');
            const algunoEnProceso = listaTickets.some(t => t.estado === 'En Proceso');
            let colorCab = todosTerminados ? '#22c55e' : (algunoEnProceso ? '#3b82f6' : '#cbd5e1');

            html += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:25px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; color:#0f172a; font-size:15px; border-bottom:3px solid ${colorCab}; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:${colorCab === '#22c55e' ? '#166534' : '#0f172a'};">${cfg.icono} ${cfg.nombre}</span>
                    <span style="background:#1e293b; color:white; padding:3px 10px; border-radius:20px; font-size:11px;">${listaTickets.length}</span>
                </h3>
                <div class="tickets-area-grid">`;

            listaTickets.forEach(t => {
                const isBloqueado       = t.estado === 'Bloqueado';
                const isTerminado       = t.estado === 'Terminado';
                const isEnProceso       = t.estado === 'En Proceso';
                const isPendiente       = t.estado === 'Pendiente';
                const isListoParaRecojo = t.estado === 'Listo para Recojo';
                const isRecogido        = t.estado === 'Recogido';

                const specsB64   = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
                let colorBorde   = isBloqueado       ? '#94a3b8'
                                 : isTerminado        ? '#22c55e'
                                 : isEnProceso        ? '#3b82f6'
                                 : isListoParaRecojo  ? '#dc2626'
                                 : isRecogido         ? '#22c55e'
                                 : '#f59e0b';
                let bgCard       = isBloqueado       ? '#f1f5f9'
                                 : isListoParaRecojo  ? '#fff5f5'
                                 : '#ffffff';
                let opacidad     = isBloqueado ? '0.55' : '1';

                let badgeBg  = isBloqueado       ? '#e2e8f0'
                             : isTerminado        ? '#dcfce7'
                             : isEnProceso        ? '#dbeafe'
                             : isListoParaRecojo  ? '#fee2e2'
                             : isRecogido         ? '#dcfce7'
                             : '#fef3c7';
                let badgeCol = isBloqueado       ? '#64748b'
                             : isTerminado        ? '#166534'
                             : isEnProceso        ? '#1e40af'
                             : isListoParaRecojo  ? '#991b1b'
                             : isRecogido         ? '#166534'
                             : '#b45309';
                let badgeTxt = isBloqueado       ? '🔒 BLOQUEADO'
                             : isTerminado        ? '✅ TERMINADO'
                             : isEnProceso        ? '🔵 EN PROCESO'
                             : isListoParaRecojo  ? '🔴 LISTO PARA RECOJO'
                             : isRecogido         ? '✅ RECOGIDO'
                             : '🟡 PENDIENTE';

                if (t.es_logistica) {
                    if (t.estado === 'En Recojo') { badgeBg = '#fef9c3'; badgeCol = '#854d0e'; badgeTxt = '🟡 EN RECOJO'; }
                    else if (t.estado === 'Recogido') { badgeBg = '#dcfce7'; badgeCol = '#166534'; badgeTxt = '✅ RECOGIDO (POR DISTRIBUIR)'; }
                    else if (t.estado === 'Distribuido') { badgeBg = '#dcfce7'; badgeCol = '#166534'; badgeTxt = '✅ DISTRIBUIDO'; }
                }

                // Asignado a quién
                const asignadoA = t.trabajador_nombre && t.trabajador_nombre !== 'Sin asignar'
                    ? `<p style="font-size:10px; color:#64748b; margin:4px 0 12px 0;"><i class="fa-solid fa-user"></i> ${t.trabajador_nombre}</p>`
                    : `<p style="font-size:10px; color:#f59e0b; margin:4px 0 12px 0;"><i class="fa-solid fa-user-clock"></i> Sin asignar</p>`;

                // Escapar producto para evitar romper HTML con comillas/apóstrofes
                const productoSafe = (t.producto || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                const fotoBtoa    = (t.foto||'').replace(/"/g,'&quot;');

                // Foto del mueble — mostrar siempre la foto del modelo base (la primera)
                const _fotosCard = t.foto ? t.foto.split('|').filter(f => f.trim()) : [];
                const fotoCardSrc = _fotosCard.length > 0 && !_fotosCard[0].includes('sin_foto') ? _fotosCard[0] : null;
                const fotoCardHTML = fotoCardSrc
                    ? `<div style="margin:-15px -15px 12px -15px; border-radius:8px 8px 0 0; overflow:hidden; height:160px; background:#f1f5f9;">
                           <img src="${fotoCardSrc}" alt="${productoSafe}"
                               style="width:100%; height:160px; object-fit:cover; display:block; cursor:pointer;"
                               onclick="ampliarImagen('${fotoCardSrc}')"
                               onerror="this.parentElement.style.display='none'">
                       </div>`
                    : '';

                html += `
                <div style="background:${bgCard}; border-left:5px solid ${colorBorde}; border-radius:8px; padding:15px; opacity:${opacidad}; box-shadow:0 1px 3px rgba(0,0,0,0.08); transition:0.2s; overflow:hidden;">
                    ${fotoCardHTML}
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:10px; font-weight:900; padding:4px 8px; border-radius:4px; background:${badgeBg}; color:${badgeCol};">${badgeTxt}</span>
                        <span style="font-size:10px; font-weight:bold; color:#94a3b8;">#${t.id}</span>
                    </div>
                    <h4 style="margin:0 0 2px 0; font-size:13px; color:${isBloqueado ? '#94a3b8' : '#0f172a'}; font-weight:800;">${productoSafe}</h4>
                    ${asignadoA}
                    <button class="btn-ver-ficha"
                        data-producto="${productoSafe}"
                        data-specs="${specsB64}"
                        data-foto="${fotoBtoa}"
                        data-ticket-id="${t.id}" data-area="${t.area}"
                        style="width:100%; background:#e0f2fe; color:#0369a1; border:none; padding:7px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; margin-bottom:8px;">
                        <i class="fa-solid fa-eye"></i> Ver Ficha Técnica Completa
                    </button>
                    ${renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin)}
                    <div id="sug-est-${t.id}"></div>
                </div>`;
            });

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;

        // Cargar sugerencias para estructuras — buscar por modelo base + medidas
        ticketsFiltrados.forEach(t => {
    if (t.area === 'ESTRUCTURAS_MUEBLES' && t.estado !== 'Terminado'
        && esOperario && usuarioActivo.area_asignada === 'ESTRUCTURAS_MUEBLES') {
 
        let l = 0, p = 0, h = 0;
        const spec = t.especificaciones || '';
 
        // Formatos soportados (en orden de especificidad):
        // 1. L120 x P90 x H45          (formato original)
        // 2. L120 x P90 x Alto 45      (variante con "Alto")
        // 3. Ancho: 120, Prof: 90       (con labels y coma)
        // 4. Ancho 120 / Fondo 90       (con slash, sin ":")
        // 5. 120cm x 90cm x 45cm        (con unidad cm)
        // 6. 120 x 90 x 45              (solo números con x)
        // 7. 120 x 90                   (sin alto)
 
        const regexes = [
            // L120 x P90 x H45  /  L120 x P90 x Alto 45
            /L\s*(\d+(?:\.\d+)?)\s*[xX×]\s*P\s*(\d+(?:\.\d+)?)(?:\s*[xX×]\s*(?:H|Alto)\s*(\d+(?:\.\d+)?))?/i,
            // Ancho: 120[,]? Prof/Fondo: 90[,]? (Alto: 45)?
            /Ancho[:\s]+(\d+(?:\.\d+)?)[,\s]+(?:Prof|Profundidad|Fondo)[.:\s]+(\d+(?:\.\d+)?)(?:[,\s]+(?:Alto|H)[.:\s]+(\d+(?:\.\d+)?))?/i,
            // Ancho 120 / Fondo 90
            /Ancho\s+(\d+(?:\.\d+)?)\s*[/]\s*(?:Fondo|Prof|Profundidad)\s+(\d+(?:\.\d+)?)/i,
            // 120cm x 90cm x 45cm  (con unidad)
            /(\d+(?:\.\d+)?)\s*cm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*cm(?:\s*[xX×]\s*(\d+(?:\.\d+)?)\s*cm)?/i,
            // 120 x 90 x 45  o  120 x 90  (solo números)
            /\b(\d{2,3}(?:\.\d+)?)\s*[xX×]\s*(\d{2,3}(?:\.\d+)?)(?:\s*[xX×]\s*(\d{2,3}(?:\.\d+)?))?/,
        ];
 
        for (const rx of regexes) {
            const m = spec.match(rx);
            if (m) {
                l = parseFloat(m[1]) || 0;
                p = parseFloat(m[2]) || 0;
                h = parseFloat(m[3]) || 0;
                break;
            }
        }
 
        const modeloBaseDetectado = _extraerModeloBase(t.producto || '');
 
        // Siempre intentar — el backend devolverá vacío si no hay nada
        // (el fallback a solo_estandar ocurre dentro de cargarSugerenciasEstructura)
        cargarSugerenciasEstructura(l, p, h, t.id, `sug-est-${t.id}`, modeloBaseDetectado);
    }
});

        // Event delegation para fichas técnicas
        contenedor.querySelectorAll('.btn-ver-ficha').forEach(btn => {
            btn.addEventListener('click', () => {
                verFichaTaller(
                    btn.dataset.producto,
                    decodeURIComponent(escape(atob(btn.dataset.specs))),
                    btn.dataset.foto,
                    btn.dataset.area
                );
            });
        });

    } catch (err) {
        console.error('Error cargando taller:', err);
        contenedor.innerHTML = '<p style="color:red; text-align:center;">❌ Error al conectar con el servidor.</p>';
    }
}

/* --- HELPER: Scroll para el carrusel de la ficha técnica --- */
function scrollFichaCarousel(direction) {
    const container = document.getElementById('ficha-carousel-container');
    if (container) {
        const scrollAmount = container.clientWidth;
        container.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
    }
}

/* --- FUNCIÓN PARA VER FICHA TÉCNICA (LIMPIEZA UX SEGÚN ÁREA) --- */
async function verFichaTaller(producto, especificaciones, foto, area) {
    const lines = especificaciones.includes('<br>')
        ? especificaciones.split('<br>')
        : especificaciones.split('\n');

    // ── Filtrado por área ──
    let seccionesFiltradas = [];
    let tituloSeccion = 'Ficha Técnica';
    let colorBorde = '#cbd5e1';
    let colorTitulo = 'var(--accent)';

    const esTelas     = area === 'TELAS' || area === 'CORTE_Y_CONTROL_TELAS';
    const esCojines   = area === 'ARMADO_COJINES';
    const esTapiceria = area === 'TAPICERIA_SOFAS' || area === 'TAPICERIA_SILLAS' || area === 'TAPICERIA';
    const esEstructura= area.includes('ESTRUCTURAS') || area.includes('CARPINTERIA') || area.includes('PATAS') || area.includes('ZOCALO') || area === 'PREPARACION_PATAS_ZOCALO';
    const esDespacho  = area === 'DESPACHO_CENTRAL';

    if (esTelas) {
        // Telas: MOD, TELA PRINCIPAL, cantidades telas/cojines, BANQUETA — sin INTERIOR/ESTRUCTURA ni BASE/PATAS
        seccionesFiltradas = lines.filter(l => l.trim() && !/INTERIOR|ESTRUCTURA|^BASE|PATA|ZOCALO/i.test(l));
        tituloSeccion = '✂️ Corte y Telas'; colorBorde = '#93c5fd'; colorTitulo = '#1e40af';
    } else if (esCojines) {
        seccionesFiltradas = lines.filter(l => l.trim() && /COJIN|DISEÑO|PATRON|COJ-/i.test(l));
        if (!seccionesFiltradas.length) seccionesFiltradas = ['Sin cojines especificados para este pedido'];
        tituloSeccion = '🧸 Armado de Cojines'; colorBorde = '#c4b5fd'; colorTitulo = '#5b21b6';
    } else if (esTapiceria) {
        seccionesFiltradas = lines.filter(l => l.trim() && !/PATA|ZOCALO|^BASE.*MADERA/i.test(l));
        tituloSeccion = '🛋️ Tapicería'; colorBorde = '#6ee7b7'; colorTitulo = '#065f46';
    } else if (esEstructura) {
        seccionesFiltradas = lines.filter(l => l.trim() && !/TELA|COJIN|TAPIZ|SKU.*TEL|SKU.*COJ/i.test(l));
        tituloSeccion = '🪵 Carpintería / Estructuras'; colorBorde = '#fcd34d'; colorTitulo = '#92400e';
    } else if (esDespacho) {
        seccionesFiltradas = lines.filter(l => l.trim());
        tituloSeccion = '📦 Despacho — Ficha Completa'; colorBorde = '#fca5a5'; colorTitulo = '#991b1b';
    } else {
        seccionesFiltradas = lines.filter(l => l.trim());
    }

    // ── Extraer todos los SKUs mencionados en las líneas filtradas ──
    const skuRegex = /SKU:\s*([A-Z0-9\-]+)/gi;
    const skusEncontrados = new Set();
    seccionesFiltradas.forEach(l => {
        let m;
        while ((m = skuRegex.exec(l)) !== null) skusEncontrados.add(m[1].toUpperCase());
    });

    // ── Construir HTML de las líneas de texto ──
    const specsHtml = seccionesFiltradas
        .map(l => {
            // 1. Extraer URLs de fotos href ANTES de limpiar HTML
            //    (vienen como <a href="url">[Ver Foto]</a> de procesarNotasConFotos)
            const _fotosHref = [];
            const _hrefRx = /href=["']?(https?:\/\/[^"'\s>]+)["']?/gi;
            let _hm;
            while ((_hm = _hrefRx.exec(l)) !== null) _fotosHref.push(_hm[1]);

            // 2. Limpiar tags HTML pero preservar texto plano
            let fLine = l.replace(/<[^>]+>/g, '').trim();
            fLine = fLine.replace(/\[Ver Foto\]/gi, '').trim();
            if (!fLine && _fotosHref.length === 0) return '';

            // 3. Convertir URLs de texto plano en imágenes
            const urlRegex = /(https?:\/\/[^\s"<]+)/g;
            fLine = fLine.replace(urlRegex, function(url) {
                return `<br><img src="${url}" style="width:120px; height:120px; object-fit:cover; border-radius:6px; border:2px solid #cbd5e1; margin-top:4px; cursor:pointer;" onclick="ampliarImagen('${url}')">`;
            });

            // 4. Agregar fotos extraídas de hrefs como galería destacada
            if (_fotosHref.length > 0) {
                const _galeriaHtml = _fotosHref.map(url =>
                    `<img src="${url}" style="width:110px; height:110px; object-fit:cover; border-radius:6px; border:2px solid #f59e0b; margin:4px 4px 0 0; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.15); display:inline-block;" onclick="ampliarImagen('${url}')" title="📸 Foto de referencia del vendedor">`
                ).join('');
                fLine += `<div style="margin-top:6px; padding:6px; background:#fffbeb; border-radius:6px; border-left:3px solid #f59e0b;"><div style="font-size:10px; font-weight:800; color:#92400e; margin-bottom:4px;">📸 FOTO DE REFERENCIA</div>${_galeriaHtml}</div>`;
            }
            
            // Si la línea tiene formato "Clave: Valor"
            if (fLine.includes(':') && !fLine.startsWith('http') && !fLine.includes('<img')) {
                const parts = fLine.split(':');
                const prefix = parts.shift().trim();
                let rest = parts.join(':').trim();
                
                // Extraer nota si existe en la misma línea
                let notaHtml = '';
                const notaMarker = '↳ Nota:';
                const notaIndex = rest.indexOf(notaMarker);
                if (notaIndex !== -1) {
                    const notaTexto = rest.substring(notaIndex + notaMarker.length).trim();
                    rest = rest.substring(0, notaIndex).trim(); // Limpiar la nota del 'rest' principal
                    notaHtml = `<div style="padding:4px 8px; margin-top:4px; background:#fffbeb; color:#92400e; border-left:3px solid #f59e0b; font-size:11px; border-radius:0 4px 4px 0;">
                                    <i class="fa-solid fa-circle-info"></i> <b>Nota:</b> ${notaTexto}
                                </div>`;
                }
                
                if (prefix.startsWith('-') || prefix.startsWith('•')) {
                     return `<div style="padding:4px 0; font-size:12px; display:flex;"><span style="color:#64748b; margin-right:5px;">•</span><div style="flex:1;"><b>${prefix.replace(/^[-•]\s*/, '')}:</b> ${rest}</div></div>`;
                }
                return `<div style="padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:12px;"><b style="color:#475569; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">${prefix}</b><span style="color:#0f172a; font-weight:600;">${rest}</span>${notaHtml}</div>`;
            }
            
            // Si es un título en mayúsculas (ej: COJINERÍA)
            if (/^[A-ZÁÉÍÓÚÑ ]+$/.test(fLine.trim()) && fLine.trim().length > 3) {
                 return `<div style="padding:10px 0 2px 0; font-size:11px; font-weight:900; color:var(--primary); text-transform:uppercase; border-bottom:2px solid #e2e8f0; margin-bottom:4px;">${fLine}</div>`;
            }
            return `<div style="padding:4px 0; font-size:12px; color:#1e293b;">${fLine}</div>`;
        })
        .join('');

    // ── Foto del mueble: mostrar todas las fotos (modelo base primero + referencias) ──
    let fotoMueble = '';
    if (foto) {
        const todasFotos = foto.split('|').filter(f => f.trim() !== '');
        // Mostrar todas las fotos en el carousel (logo genérico + fotos de referencia del vendedor)
        const fotosArray = todasFotos;
        if (fotosArray.length >= 1) {
            const slides = fotosArray.map(f => `
                <div style="min-width:100%; flex-shrink:0; display:flex; justify-content:center; align-items:center; scroll-snap-align:center;">
                    <img src="${f}" style="width:100%; height:200px; object-fit:contain; background:#f1f5f9; border-radius:10px; border:1px solid #e2e8f0;" onerror="this.style.display='none'">
                </div>`).join('');
            
            fotoMueble = `
                <div id="ficha-carousel-wrapper" style="position:relative; margin-bottom:12px; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0;">
                    <div id="ficha-carousel-container" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; gap:0; -webkit-overflow-scrolling:touch;" class="hide-scroll">
                        ${slides}
                    </div>
                    ${fotosArray.length > 1 ? `
                    <button onclick="scrollFichaCarousel(-1)" style="position:absolute; top:50%; left:8px; transform:translateY(-50%); background:rgba(15,23,42,0.6); color:white; border:none; border-radius:50%; width:32px; height:32px; font-size:14px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='rgba(15,23,42,0.8)'" onmouseout="this.style.background='rgba(15,23,42,0.6)'">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button onclick="scrollFichaCarousel(1)" style="position:absolute; top:50%; right:8px; transform:translateY(-50%); background:rgba(15,23,42,0.6); color:white; border:none; border-radius:50%; width:32px; height:32px; font-size:14px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='rgba(15,23,42,0.8)'" onmouseout="this.style.background='rgba(15,23,42,0.6)'">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <div style="position:absolute; bottom:10px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.8); color:white; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:bold; pointer-events:none; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                        📸 ${fotosArray.length} FOTOS (Desliza <i class="fa-solid fa-arrows-left-right"></i>)
                    </div>` : ''}
                </div>
                <style>.hide-scroll::-webkit-scrollbar { display:none; } .hide-scroll { -ms-overflow-style:none; scrollbar-width:none; }</style>
            `;
        }
    }

    // ── Mostrar modal con loader mientras buscamos fotos de SKUs ──
    Swal.fire({
        title: producto,
        html: `
            ${fotoMueble}
            <div style="text-align:left; background:#f8fafc; padding:14px; border-radius:10px; border-left:4px solid ${colorBorde}; margin-bottom:12px;">
                <strong style="color:${colorTitulo}; text-transform:uppercase; font-size:10px; display:block; margin-bottom:8px;">${tituloSeccion}</strong>
                ${specsHtml || '<span style="color:#94a3b8; font-size:12px;">Sin especificaciones</span>'}
            </div>
            <div id="galeria-skus" style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:8px;">
                ${skusEncontrados.size > 0 ? '<span style="color:#94a3b8; font-size:11px; width:100%; text-align:center;">Cargando fotos de materiales...</span>' : ''}
            </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#0f172a',
        width: '520px',
        didOpen: async () => {
            if (skusEncontrados.size === 0) return;
            try {
                const res  = await apiFetch(`${API_URL}/api/taller/fichatecnica-skus?skus=${[...skusEncontrados].join(',')}`);
                const data = await res.json();
                const galeria = document.getElementById('galeria-skus');
                if (!galeria) return;
                if (!Array.isArray(data) || data.length === 0) {
                    galeria.innerHTML = '<span style="color:#94a3b8; font-size:11px;">Sin fotos de materiales disponibles</span>';
                    return;
                }
                galeria.innerHTML = data.map(item => {
                    let borderColor = '#cbd5e1';
                    let textColor = '#475569';
                    if (item.tipo === 'tela') { borderColor = '#93c5fd'; textColor = '#1e40af'; }
                    else if (item.tipo === 'cojin') { borderColor = '#c4b5fd'; textColor = '#5b21b6'; }
                    else if (item.tipo.includes('base') || item.tipo === 'tablero') { borderColor = '#fcd34d'; textColor = '#92400e'; }
                    else if (item.tipo === 'silla' || item.tipo === 'butaca') { borderColor = '#fca5a5'; textColor = '#991b1b'; }
                    
                    return `
                    <div style="text-align:center; width:90px;">
                        <img src="${item.foto_url}" alt="${item.sku}"
                            style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${borderColor}; display:block; margin:0 auto 4px;"
                            onerror="this.src='imagenes/sin_foto.jpg'">
                        <span style="font-size:9px; font-weight:900; color:${textColor}; display:block;">${item.sku}</span>
                        <span style="font-size:9px; color:#64748b; display:block; line-height:1.2;">${item.nombre}</span>
                    </div>
                    `;
                }).join('');
            } catch(e) {
                const galeria = document.getElementById('galeria-skus');
                if (galeria) galeria.innerHTML = '';
            }
        }
    });
}
/* --- ASIGNAR CHOFER AL DESPACHO (con panel de progreso) --- */
async function asignarChoferDespacho(ticketId) {
    try {
        // Traer choferes
        let choferes = [];
        try {
            const r = await apiFetch(`${API_URL}/api/usuarios/choferes`);
            choferes = await r.json();
        } catch (_) {}
        if (!Array.isArray(choferes) || choferes.length === 0) {
            const r2 = await apiFetch(`${API_URL}/api/usuarios`);
            choferes = await r2.json();
        }

        let opciones = {};
        choferes.forEach(u => { opciones[u.id] = `${u.nombre} (${u.rol || u.area || 'Despacho'})`; });

        if (Object.keys(opciones).length === 0) {
            return Swal.fire('Sin personal', 'Registra un usuario con área DESPACHO primero.', 'info');
        }

        const { value: choferId } = await Swal.fire({
            title: '🚚 Asignar Chofer al Despacho',
            text: 'Todas las partes están listas. Selecciona quién hace la entrega.',
            input: 'select',
            inputOptions: opciones,
            inputPlaceholder: '-- Seleccionar Chofer --',
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            cancelButtonText: 'Cancelar',
            confirmButtonText: '🚚 Confirmar Despacho'
        });

        if (!choferId) return;

        Swal.fire({ title: 'Activando despacho...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const response = await apiFetch(`${API_URL}/api/despacho/asignar-chofer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: ticketId, chofer_id: choferId })
        });
        const result = await response.json();

        if (result.exito) {
            Swal.fire('¡Despacho Activo!', result.mensaje || 'El chofer ya puede ver la entrega.', 'success');
            cargarTicketsTaller();
        } else {
            Swal.fire('Error', result.error || 'No se pudo activar el despacho.', 'error');
        }
    } catch (e) {
        console.error("Error chofer despacho:", e);
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* --- PASE DE POSTA: TELAS ASIGNA TAPICERO Y COJINERO EN UN SOLO MODAL --- */
async function abrirModalDerivar(ticketId) {
    try {
        // Leer specs del botón derivar (data-specs en base64) para detectar si hay cojines
        let specsTexto = '';
        const btnDerivar = document.querySelector(`button[data-ticket-id="${ticketId}"]`);
        if (btnDerivar) {
            try { specsTexto = decodeURIComponent(escape(atob(btnDerivar.dataset.specs || ''))); } catch(e) {}
        }
        // Fallback: buscar en el botón Ver Ficha del mismo ticket
        if (!specsTexto) {
            const fichaBtn = document.querySelector(`.btn-ver-ficha[data-ticket-id="${ticketId}"]`);
            if (fichaBtn) {
                try { specsTexto = decodeURIComponent(escape(atob(fichaBtn.dataset.specs || ''))); } catch(e) {}
            }
        }
        const tieneCojines = /COJIN|COJ-/i.test(specsTexto);

        // Cargar usuarios
        const resAll = await apiFetch(`${API_URL}/api/usuarios`);
        const todosUsuarios = await resAll.json();

        // /api/usuarios devuelve area_asignada (no 'area')
        const tapicerosSofa   = todosUsuarios.filter(u => u.area_asignada === 'TAPICERIA_SOFAS');
        const tapicerosSillas = todosUsuarios.filter(u => u.area_asignada === 'TAPICERIA_SILLAS');
        const cojineros       = todosUsuarios.filter(u => u.area_asignada === 'ARMADO_COJINES');
        const opcionesTodosT  = [...tapicerosSofa, ...tapicerosSillas];

        // Bloque cojinero: obligatorio si hay cojines en la ficha, oculto si no
        const cojineroHtml = tieneCojines ? `
            <div style="background:#fdf4ff; border-radius:8px; padding:12px; border:2px solid #c4b5fd; margin-top:12px;">
                <label style="font-size:10px; font-weight:900; color:#7c3aed; display:block; margin-bottom:4px;">
                    🧸 COJINERO RESPONSABLE <span style="color:#ef4444;">*</span>
                </label>
                <p style="font-size:9px; color:#64748b; margin:0 0 6px 0;">Este pedido tiene cojines — debes asignar quién los arma.</p>
                <select id="swal-cojinero" style="width:100%; padding:10px; border:1px solid #c4b5fd; border-radius:8px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                    <option value="">-- Seleccionar Cojinero --</option>
                    ${cojineros.map(u => `<option value="${u.id}">${u.nombre} — ARMADO COJINES</option>`).join('')}
                </select>
            </div>` : `
            <div style="background:#f1f5f9; border-radius:8px; padding:10px; margin-top:12px; border:1px solid #e2e8f0;">
                <p style="font-size:11px; color:#94a3b8; margin:0; text-align:center;">
                    <i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> Sin cojines en este pedido
                </p>
            </div>`;

        const { value: confirmado } = await Swal.fire({
            title: '✂️ Material Cortado — Derivar a Siguientes Áreas',
            html: `
                <div style="text-align:left; font-size:12px;">
                    <div style="background:#fff7ed; border-left:4px solid #f97316; padding:10px; border-radius:6px; margin-bottom:15px;">
                        <b>Instrucción:</b> Sube la foto del corte y asigna quién tapiza el sofá.
                        ${tieneCojines ? ' <b style="color:#7c3aed;">Este pedido tiene cojines — el cojinero es obligatorio.</b>' : ''}
                    </div>

                    <label style="font-size:10px; font-weight:900; color:#475569; display:block; margin-bottom:6px;">📷 FOTO DEL MATERIAL CORTADO *</label>
                    <div style="display:flex;gap:7px;margin-bottom:14px;">
                        <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:9px 5px;
                                      border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                      align-items:center;justify-content:center;gap:5px;">
                            📷 Tomar foto
                            <input type="file" id="foto-derivar-cam" accept="image/*" capture="environment"
                                   style="display:none;" onchange="_syncDerivarFoto(this)">
                        </label>
                        <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:9px 5px;
                                      border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                      align-items:center;justify-content:center;gap:5px;">
                            📁 Seleccionar
                            <input type="file" id="foto-derivar" accept="image/*"
                                   style="display:none;" onchange="_syncDerivarFoto(this)">
                        </label>
                    </div>
                    <div id="foto-derivar-preview" style="display:none;margin-bottom:10px;text-align:center;">
                        <img id="foto-derivar-img" src=""
                             style="max-height:80px;border-radius:8px;border:2px solid #f97316;">
                    </div>

                    <div style="background:#eff6ff; border-radius:8px; padding:12px; border:2px solid #93c5fd;">
                        <label style="font-size:10px; font-weight:900; color:#1e40af; display:block; margin-bottom:6px;">
                            🛋️ TAPICERO RESPONSABLE *
                        </label>
                        <select id="swal-tapicero" style="width:100%; padding:10px; border:1px solid #bfdbfe; border-radius:8px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            <option value="">-- Seleccionar Tapicero --</option>
                            ${opcionesTodosT.map(u => `<option value="${u.id}|${u.area_asignada === 'TAPICERIA_SILLAS' ? 'TAPICERIA_SILLAS' : 'TAPICERIA_SOFAS'}">${u.nombre} — ${(u.area_asignada||'').replace(/_/g,' ')}</option>`).join('')}
                        </select>
                    </div>

                    ${cojineroHtml}
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#f97316',
            cancelButtonText: 'Cancelar',
            confirmButtonText: '✂️ Confirmar Derivación',
            preConfirm: () => {
                const foto       = document.getElementById('foto-derivar').files[0];
                const tapVal     = document.getElementById('swal-tapicero').value;
                const cojineroEl = document.getElementById('swal-cojinero');
                const cojineroId = cojineroEl ? cojineroEl.value : '';

                if (!foto)   { Swal.showValidationMessage('La foto del material cortado es obligatoria'); return false; }
                if (!tapVal) { Swal.showValidationMessage('Debes seleccionar un tapicero');               return false; }
                if (tieneCojines && !cojineroId) {
                    Swal.showValidationMessage('Este pedido tiene cojines — debes asignar un cojinero');
                    return false;
                }
                const [tapiceroId, areaTapiceria] = tapVal.split('|');
                return { foto, tapiceroId, areaTapiceria, cojineroId };
            }
        });

        if (!confirmado) return;

        Swal.fire({ title: 'Derivando material...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // 1. Finalizar el ticket de TELAS con la foto (marca como Terminado)
        const formData = new FormData();
        formData.append('foto', confirmado.foto);
        const resFin = await apiFetch(`${API_URL}/api/taller/ticket/${ticketId}/finalizar`, {
            method: 'POST', body: formData
        });
        const dataFin = await resFin.json();
        if (!dataFin.exito) {
            return Swal.fire('Error', dataFin.error || 'No se pudo cerrar el ticket de telas.', 'error');
        }

        // 2. Crear ticket de Tapicería
        const resTap = await apiFetch(`${API_URL}/api/taller/ticket/derivar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket_padre_id: ticketId,
                tapicero_id:     confirmado.tapiceroId,
                cojinero_id:     confirmado.cojineroId || null,
                area_tapiceria:  confirmado.areaTapiceria
            })
        });
        const dataTap = await resTap.json();

        if (dataTap.exito) {
            const msg = confirmado.cojineroId
                ? `Tapicero asignado a ${confirmado.areaTapiceria.replace(/_/g,' ')} y cojinero a ARMADO DE COJINES.`
                : `Tapicero asignado a ${confirmado.areaTapiceria.replace(/_/g,' ')}.`;
            Swal.fire('¡Material Derivado!', msg, 'success');
            cargarTicketsTaller();
        } else {
            Swal.fire('Error', dataTap.error || 'No se pudo crear los tickets secundarios.', 'error');
        }

    } catch (e) {
        console.error('Error en derivación:', e);
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* --- CONFIRMAR LLEGADA DE TELA DESDE LOGÍSTICA --- */
async function confirmarRecojoLogistica(id, fileInput) {
    const file = fileInput ? fileInput.files[0] : null;

    const conf = await Swal.fire({
        title: 'Confirmar recepción y pago',
        html: '<p style="font-size:12px;color:#64748b;">¿Confirmas que la tela ya fue pagada y está en el taller?</p>',
        showCancelButton: true,
        confirmButtonText: '✅ Confirmar',
        confirmButtonColor: '#f59e0b'
    });
    if (!conf.isConfirmed) return;
    
    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
    try {
        const formData = new FormData();
        if (file) formData.append('comprobante', file);
        
        const res = await apiFetch(`${API_URL}/api/logistica/${id}/confirmar-recojo`, {
            method: 'POST',
            body: formData
        });
        const d = await res.json();
        if (d.exito) {
            Swal.fire('¡Recibido!', d.mensaje, 'success');
            cargarTicketsTaller();
        } else { Swal.fire('Error', d.error, 'error'); }
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

/* --- DISTRIBUIR TELA A TAPICERÍA --- */

async function asignarTrabajadorLogistica(logisticaId) {
    try {
        Swal.fire({ title: 'Buscando personal...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const res = await apiFetch(`${API_URL}/api/usuarios/por-area/CORTE_Y_CONTROL_TELAS`);
        const usuarios = await res.json();
        Swal.close();

        if (!Array.isArray(usuarios) || usuarios.length === 0) {
            return Swal.fire({
                title: 'Sin personal registrado',
                html: `No hay operarios asignados al área <b style="color:#558fc5;">CORTE Y CONTROL TELAS</b>.`,
                icon: 'info',
                confirmButtonColor: '#0f172a'
            });
        }

        let selectHtml = `<select id="swal-select-trabajador-log" class="swal2-input" style="width:100%; font-size:14px; border-radius:8px;">
            <option value="">-- Selecciona un operario --</option>`;
        usuarios.forEach(u => {
            selectHtml += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
        });
        selectHtml += `</select>`;

        const { isConfirmed } = await Swal.fire({
            title: 'Asignar Operario de Telas',
            html: selectHtml,
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Confirmar Asignación',
            preConfirm: () => {
                const val = document.getElementById('swal-select-trabajador-log').value;
                if (!val) { Swal.showValidationMessage('Debes seleccionar un trabajador'); return false; }
                return val;
            }
        });

        if (isConfirmed) {
            const trabajadorId = document.getElementById('swal-select-trabajador-log').value;
            Swal.fire({ title: 'Asignando...', didOpen: () => Swal.showLoading() });
            const resp = await apiFetch(`${API_URL}/api/logistica/${logisticaId}/asignar-operario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id: trabajadorId })
            });
            const data = await resp.json();
            if (data.exito) {
                Swal.fire('¡Asignado!', 'El operario ya puede ver la recolección en su bandeja.', 'success');
                cargarTicketsTaller();
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        }
    } catch (e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}
async function confirmarDistribucionTela(id) {
    const conf = await Swal.fire({
        title: '¿Distribuir tela a Tapicería?',
        text: 'Esto desbloqueará los tickets de tapicería y les notificará que la tela está lista.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, distribuir'
    });
    if (!conf.isConfirmed) return;

    Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });
    const res = await apiFetch(`${API_URL}/api/logistica/${id}/confirmar-distribucion`, { method: 'POST' });
    const d = await res.json();
    if (d.exito) { Swal.fire('¡Distribuida!', `Tela entregada. ${d.desbloqueados} tickets desbloqueados.`, 'success'); cargarTicketsTaller(); }
    else { Swal.fire('Error', d.error, 'error'); }
}

/* --- NUEVA FUNCIÓN: ASIGNAR TRABAJADOR REAL --- */
async function asignarTrabajador(ticketId, areaTicket) {
    try {
        Swal.fire({ title: 'Buscando personal...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Traemos SOLO los operarios del área del ticket (+ jefes como respaldo)
        const res = await apiFetch(`${API_URL}/api/usuarios/por-area/${encodeURIComponent(areaTicket)}`);
        const usuarios = await res.json();
        Swal.close();

        if (!Array.isArray(usuarios) || usuarios.length === 0) {
            return Swal.fire({
                title: 'Sin personal registrado',
                html: `No hay operarios asignados al área <b style="color:#558fc5;">${areaTicket.replace(/_/g,' ')}</b>.<br><br>` +
                      `Ve a <b>Gestión de Personal</b> y crea un usuario con esa área exacta.`,
                icon: 'info',
                confirmButtonColor: '#0f172a'
            });
        }

        // SweetAlert inputOptions necesita claves tipo STRING (no número)
        // Separamos operarios del área de los jefes para mostrarlos diferente
        const operariosArea  = usuarios.filter(u => u.area === areaTicket);
        const otrosUsuarios  = usuarios.filter(u => u.area !== areaTicket);

        // Construimos HTML de select manualmente para mejor UX
        let selectHtml = `<select id="swal-select-trabajador" class="swal2-input" style="width:100%; margin:0; padding:10px; font-size:14px; border-radius:8px;">
            <option value="">-- Selecciona un trabajador --</option>`;

        if (operariosArea.length > 0) {
            selectHtml += `<optgroup label="✅ Operarios del área ${areaTicket.replace(/_/g,' ')}">`;
            operariosArea.forEach(u => {
                selectHtml += `<option value="${u.id}">${u.nombre}</option>`;
            });
            selectHtml += `</optgroup>`;
        }
        if (otrosUsuarios.length > 0) {
            selectHtml += `<optgroup label="👔 Jefes / Admins (respaldo)">`;
            otrosUsuarios.forEach(u => {
                selectHtml += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
            });
            selectHtml += `</optgroup>`;
        }
        selectHtml += `</select>`;

        const { isConfirmed } = await Swal.fire({
            title: 'Asignar Maestro Responsable',
            html: `
                <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
                    Área: <b style="color:#558fc5;">${areaTicket.replace(/_/g,' ')}</b>
                </p>
                ${selectHtml}
            `,
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Confirmar Asignación',
            preConfirm: () => {
                const val = document.getElementById('swal-select-trabajador').value;
                if (!val) {
                    Swal.showValidationMessage('Debes seleccionar un trabajador');
                    return false;
                }
                return val;
            }
        });

        if (isConfirmed) {
            const trabajadorId = document.getElementById('swal-select-trabajador')?.value;
            if (!trabajadorId) return;

            Swal.fire({ 
                title: 'Actualizando taller...', 
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading() 
            });
            
            const response = await apiFetch(`${API_URL}/api/taller/asignar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ticket_id: ticketId, 
                    trabajador_id: parseInt(trabajadorId)
                })
            });

            const result = await response.json();

            if (result.exito) {
                Swal.fire('¡Asignado!', 'El maestro ya puede ver su tarea en su tablet.', 'success');
                cargarTicketsTaller(); 
            } else {
                Swal.fire('Error', result.error || 'No se pudo guardar la asignación.', 'error');
            }
        }
    } catch (e) {
        console.error("Error en asignación:", e);
        Swal.close();
        Swal.fire('Error', 'No se pudo conectar con el servidor de personal.', 'error');
    }
}


/* --- FINALIZAR TICKET: SUBE FOTO Y MARCA COMO TERMINADO --- */
async function finalizarTicketTaller(ticketId, inputFile, area, producto) {
    const archivo = inputFile ? inputFile.files[0] : null;

    if (!archivo) {
        return Swal.fire('Foto requerida', 'Debes subir una foto de evidencia antes de finalizar.', 'warning');
    }

    const confirmar = await Swal.fire({
        title: '¿Confirmar trabajo terminado?',
        html: `<p style="font-size:13px; color:#475569;">Área: <b>${area.replace(/_/g,'  ')}</b><br>Producto: <b>${producto}</b></p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonText: 'Cancelar',
        confirmButtonText: '<i class="fa-solid fa-check-double"></i> Sí, finalizar'
    });

    if (!confirmar.isConfirmed) return;

    Swal.fire({ title: 'Guardando evidencia...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const formData = new FormData();
        formData.append('foto', archivo);

        const res = await apiFetch(`${API_URL}/api/taller/ticket/${ticketId}/finalizar`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.exito) {
            if (data.es_entrega) {
                await Swal.fire({
                    icon: 'success',
                    title: '🎉 ¡Entrega Confirmada!',
                    text: 'La entrega fue registrada. Puedes verla en "Mis Entregados".',
                    confirmButtonColor: '#15803d'
                });
            } else if (data.es_listo_recojo) {
                await Swal.fire({
                    icon: 'info',
                    title: '🔴 Estructura lista para recojo',
                    text: data.mensaje || 'Esperando que el chofer confirme el recojo.',
                    confirmButtonColor: '#dc2626'
                });
            } else {
                Swal.fire('¡Trabajo Completado!', 'El ticket fue marcado como Terminado.', 'success');
            }
            cargarTicketsTaller();
        } else {
            Swal.fire('Error', data.error || 'No se pudo finalizar el ticket.', 'error');
        }
    } catch (e) {
        console.error('Error finalizando ticket:', e);
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}


/* --- CARGAR INVENTARIO DE TALLER --- */
async function cargarInventarioTaller() {
    try {
        // Usar los datos del maestro en memoria para asegurar que tengan sku y foto_url
        if (!maestroMateriales || !maestroMateriales.telas) {
            if (typeof _refreshMaestro === 'function') await _refreshMaestro();
        }

        const telas = maestroMateriales.telas || [];
        const cojines = maestroMateriales.cojines || [];
        const tableros = maestroMateriales.tableros || [];
        const metal = [...(maestroMateriales.bases || []), ...(maestroMateriales.bases_comedor || [])];
        const madera = [...(maestroMateriales.sillas || []), ...(maestroMateriales.butacas || [])];

        const setHtml = (id, htmlContent) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = htmlContent;
        };

        setHtml('contenedor-telas-admin',    telas.map(i=>dibujarTarjetaMaterial(i,'tela')).join(''));
        setHtml('contenedor-cojines-admin',  cojines.map(i=>dibujarTarjetaMaterial(i,'cojin')).join(''));
        setHtml('contenedor-tableros-admin', tableros.map(i=>dibujarTarjetaMaterial(i,'tablero')).join(''));
        setHtml('contenedor-metal-admin',    metal.map(i=>dibujarTarjetaMaterial(i, i.categoria==='BASE'?'base':'base-comedor')).join(''));
        setHtml('contenedor-madera-admin',   madera.map(i=>dibujarTarjetaMaterial(i, i.categoria==='SILLA'?'silla':'butaca')).join(''));

        // Reaplicar filtros activos si el usuario estaba buscando
        ['telas','cojines','tableros','metal','madera'].forEach(k => {
            const inp = document.getElementById('buscador-' + k);
            if (inp && inp.value.trim()) filtrarSeccionMaestro(k);
        });

    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}

/**
 * filtrarVistaMaestro — muestra/oculta secciones completas del maestro.
 * key: 'todos' | 'telas' | 'cojines' | 'tableros' | 'metal' | 'madera'
 */
function filtrarVistaMaestro(key) {
    // Al cambiar de categoría, limpiar el filtro de proveedor de telas
    if (key !== 'telas' && key !== 'todos') {
        _proveedorTelaActivo = null;
    }

    const secciones = {
        telas:    'seccion-wrapper-telas',
        cojines:  'seccion-wrapper-cojines',
        tableros: 'seccion-wrapper-tableros',
        metal:    'seccion-wrapper-metal',
        madera:   'seccion-wrapper-madera',
    };

    // Mostrar/ocultar secciones
    Object.entries(secciones).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (key === 'todos' || key === k) ? '' : 'none';
    });

    // Chips de proveedor: solo visibles en vista "telas" o "todos"
    const barraProveedores = document.getElementById('filtros-proveedor-telas');
    if (barraProveedores) {
        if (key === 'telas' || key === 'todos') {
            _renderChipsProveedoresTelas();
            barraProveedores.style.display = 'flex';
        } else {
            barraProveedores.style.display = 'none';
        }
    }

    // Resaltar botón activo
    const colores = {
        todos:    { bg: 'var(--primary)', color: 'white',   border: 'var(--primary)' },
        telas:    { bg: '#7c3aed',        color: 'white',   border: '#7c3aed' },
        cojines:  { bg: '#ec4899',        color: 'white',   border: '#ec4899' },
        tableros: { bg: '#0284c7',        color: 'white',   border: '#0284c7' },
        metal:    { bg: '#0369a1',        color: 'white',   border: '#0369a1' },
        madera:   { bg: '#b45309',        color: 'white',   border: '#b45309' },
    };
    const inactivo = { bg: 'white', border: null };

    ['todos','telas','cojines','tableros','metal','madera'].forEach(k => {
        const btn = document.getElementById('filtro-btn-' + k);
        if (!btn) return;
        if (k === key) {
            const c = colores[k];
            btn.style.background = c.bg;
            btn.style.color = c.color;
            btn.style.borderColor = c.border;
        } else {
            const c = colores[k];
            btn.style.background = 'white';
            btn.style.color = c.bg;
            btn.style.borderColor = c.bg;
        }
    });
}

/**
 * filtrarSeccionMaestro — filtra las tarjetas visibles en cada sección del maestro.
 * key: 'telas' | 'cojines' | 'tableros' | 'metal' | 'madera'
 */
function filtrarSeccionMaestro(key) {
    // Para telas, delegar al filtro combinado (proveedor + texto)
    if (key === 'telas') {
        filtrarPorProveedorTela(_proveedorTelaActivo);
        return;
    }

    const mapaBuscador = {
        telas:    { input: 'buscador-telas',    contenedor: 'contenedor-telas-admin' },
        cojines:  { input: 'buscador-cojines',  contenedor: 'contenedor-cojines-admin' },
        tableros: { input: 'buscador-tableros',  contenedor: 'contenedor-tableros-admin' },
        metal:    { input: 'buscador-metal',    contenedor: 'contenedor-metal-admin' },
        madera:   { input: 'buscador-madera',   contenedor: 'contenedor-madera-admin' },
    };

    const cfg = mapaBuscador[key];
    if (!cfg) return;

    const query = (document.getElementById(cfg.input)?.value || '').toLowerCase().trim();
    const contenedor = document.getElementById(cfg.contenedor);
    if (!contenedor) return;

    // Cada tarjeta es un div directo hijo del contenedor
    const tarjetas = contenedor.children;
    let visibles = 0;

    for (const tarjeta of tarjetas) {
        const texto = tarjeta.innerText?.toLowerCase() || '';
        const mostrar = !query || texto.includes(query);
        tarjeta.style.display = mostrar ? '' : 'none';
        if (mostrar) visibles++;
    }

    // Mostrar mensaje si no hay resultados
    let sinResultados = contenedor.querySelector('.maestro-sin-resultados');
    if (visibles === 0 && query) {
        if (!sinResultados) {
            sinResultados = document.createElement('p');
            sinResultados.className = 'maestro-sin-resultados';
            sinResultados.style.cssText = 'color:#94a3b8;font-size:13px;text-align:center;padding:30px 0;grid-column:1/-1;';
            contenedor.appendChild(sinResultados);
        }
        sinResultados.textContent = `Sin resultados para "${query}"`;
        sinResultados.style.display = '';
    } else if (sinResultados) {
        sinResultados.style.display = 'none';
    }
}


/* ================================================================= */
/* --- FILTRO DE PROVEEDORES EN MAESTRO DE TELAS --- */
/* ================================================================= */

// Proveedor actualmente seleccionado (null = todos)
let _proveedorTelaActivo = null;

/**
 * Genera los chips de proveedor a partir de maestroMateriales.telas.
 * Opera 100% en memoria, sin llamadas al backend.
 */
function _renderChipsProveedoresTelas() {
    const barra = document.getElementById('filtros-proveedor-telas');
    if (!barra) return;

    // Extraer proveedores únicos y ordenarlos
    const proveedores = [...new Set(
        (maestroMateriales.telas || [])
            .map(t => (t.proveedor || '').trim())
            .filter(Boolean)
    )].sort();

    if (proveedores.length === 0) {
        barra.style.display = 'none';
        return;
    }

    // Estilos base para chips
    const baseStyle = `
        padding:5px 13px;border-radius:20px;border:2px solid #7c3aed;
        font-size:11px;font-weight:700;cursor:pointer;transition:all 0.18s;
        white-space:nowrap;
    `;

    // Chip "Todos"
    const chips = [`
        <button
            id="chip-prov-todos"
            onclick="filtrarPorProveedorTela(null)"
            style="${baseStyle} background:${_proveedorTelaActivo === null ? '#7c3aed' : 'white'};
                   color:${_proveedorTelaActivo === null ? 'white' : '#7c3aed'};">
            Todos
        </button>
    `];

    // Un chip por proveedor
    proveedores.forEach(prov => {
        const activo = _proveedorTelaActivo === prov;
        chips.push(`
            <button
                onclick="filtrarPorProveedorTela('${prov.replace(/'/g, "\\'")}')"
                style="${baseStyle} background:${activo ? '#7c3aed' : 'white'};
                       color:${activo ? 'white' : '#7c3aed'};">
                ${prov}
            </button>
        `);
    });

    // Mantener el label y reemplazar solo los chips
    barra.innerHTML = `
        <span style="font-size:10px;font-weight:900;color:#7c3aed;letter-spacing:0.06em;margin-right:4px;align-self:center;">
            PROVEEDOR:
        </span>
        ${chips.join('')}
    `;
}

/**
 * Filtra las tarjetas de telas combinando proveedor seleccionado + texto del buscador.
 * @param {string|null} proveedor — null = mostrar todos
 */
function filtrarPorProveedorTela(proveedor) {
    _proveedorTelaActivo = proveedor;

    // Re-renderizar chips para reflejar el activo
    _renderChipsProveedoresTelas();

    // Aplicar filtro combinado sobre las tarjetas
    const query = (document.getElementById('buscador-telas')?.value || '').toLowerCase().trim();
    const contenedor = document.getElementById('contenedor-telas-admin');
    if (!contenedor) return;

    let visibles = 0;
    for (const tarjeta of contenedor.children) {
        if (tarjeta.classList.contains('maestro-sin-resultados')) continue;
        const texto = tarjeta.innerText?.toLowerCase() || '';
        const coincideTexto    = !query    || texto.includes(query);
        const coincideProveedor = !proveedor || texto.includes(proveedor.toLowerCase());
        const mostrar = coincideTexto && coincideProveedor;
        tarjeta.style.display = mostrar ? '' : 'none';
        if (mostrar) visibles++;
    }

    // Mensaje si no hay resultados
    let sinRes = contenedor.querySelector('.maestro-sin-resultados');
    if (visibles === 0) {
        if (!sinRes) {
            sinRes = document.createElement('p');
            sinRes.className = 'maestro-sin-resultados';
            sinRes.style.cssText = 'color:#94a3b8;font-size:13px;text-align:center;padding:30px 0;grid-column:1/-1;';
            contenedor.appendChild(sinRes);
        }
        const desc = [proveedor, query].filter(Boolean).join(' + ');
        sinRes.textContent = `Sin resultados para "${desc}"`;
        sinRes.style.display = '';
    } else if (sinRes) {
        sinRes.style.display = 'none';
    }
}

/* ================================================================= */
/* --- LÓGICA DE MESA DE CENTRO Y CONSOLA --- */
/* ================================================================= */
async function cargarGestorAprobacion() {
    const contenedor = document.getElementById('lista-aprobacion-pendientes');
    if (!contenedor) return;
    contenedor.style.display = 'grid';
    contenedor.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';
    contenedor.style.gap = '15px';
    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; grid-column: 1/-1;">Sincronizando modelos e insumos pendientes...</p>';

    // Cargar cambios de precio pendientes en paralelo
    cargarCambiosPrecioPendientes();

    try {
        // Ejecutamos ambas consultas simultáneamente
        const [resMuebles, resInsumos] = await Promise.all([
            apiFetch(`${API_URL}/api/creaciones`),
            apiFetch(`${API_URL}/api/sugerencias`)
        ]);

        const creaciones = await resMuebles.json();
        const sugerenciasInsumos = await resInsumos.json();

        const mueblesPendientes = creaciones.filter(c => c.estado === 'Pendiente');
        const insumosPendientes = sugerenciasInsumos.filter(i => i.estado === 'Pendiente');

        if (mueblesPendientes.length === 0 && insumosPendientes.length === 0) {
            contenedor.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 15px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-check-double" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                    <h3 style="margin:0 0 5px 0;">¡Bandeja de Aprobaciones Vacía!</h3>
                    <p style="margin:0; color:gray; font-size:13px;">Todo el catálogo e insumos están al día.</p>
                </div>`;
            return;
        }

        let htmlFinal = "";

        // Renderizado de Modelos de Muebles Personalizados
        mueblesPendientes.forEach(item => {
            htmlFinal += `
            <div class="card-produccion" style="position:relative; background: #ffffff; border: 1px solid #e2e8f0; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="badge-area" style="position:absolute; top:15px; left:15px; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">MUEBLE: ${item.categoria}</div>
                <img src="${item.foto_url.startsWith('http') ? item.foto_url : `${API_URL}/uploads/` + item.foto_url}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 12px;" onerror="this.src='imagenes/sin_foto.jpg'">
                <h4 style="margin: 0 0 4px 0; color:#0f172a; font-size:14px;">${item.nombre}</h4>
                <small style="color:gray; display:block; margin-bottom:8px;">Subido por: <b>${item.vendedor || 'Vendedor'}</b></small>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 15px; background: #f8fafc; padding: 8px; border-radius: 6px; line-height:1.4;">
                    ${item.detalles.replace(/\n/g, '<br>')}
                </div>
                <button class="btn-action btn-primary" style="font-size: 11px; padding: 10px; border-radius:8px;" onclick="procesarAprobacion(${item.id}, '${item.nombre}')">
                    <i class="fa-solid fa-check"></i> APROBAR MUEBLE
                </button>
            </div>`;
        });

        // Renderizado de Insumos / Partes Sugeridas
        insumosPendientes.forEach(insumo => {
            let datos = {};
            try { datos = JSON.parse(insumo.datos_json); } catch(e) {}
            
            // Construir desglose legible de las propiedades técnicas enviadas en el JSON
            let especificacionesInsumo = "";
            for (const [key, value] of Object.entries(datos || {})) {
                if (key !== 'nombre_insumo') {
                    especificacionesInsumo += `<b>${key.toUpperCase()}:</b> ${value}<br>`;
                }
            }

            htmlFinal += `
            <div class="card-produccion" style="position:relative; background: #fffdf5; border: 1px dashed #d4af37; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="badge-template" style="position:absolute; top:15px; left:15px; background: #f59e0b; color:white;">📌 INSUMO: ${insumo.tipo.toUpperCase()}</div>
                <img src="${insumo.foto_url}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 12px;" onerror="this.src='imagenes/sin_foto.jpg'">
                <h4 style="margin: 0 0 4px 0; color:#0f172a; font-size:14px;">${insumo.nombre}</h4>
                <small style="color:gray; display:block; margin-bottom:8px;">Sugerido por: <b>${insumo.vendedor}</b></small>
                <div style="font-size: 11px; color: #b45309; margin-bottom: 15px; background: #fffbeb; padding: 8px; border-radius: 6px; line-height:1.4; text-align:left;">
                    ${especificacionesInsumo || 'Instrucciones estándar básicas.'}
                </div>
                <button class="btn-primary" style="font-size: 11px; padding: 10px; border-radius:8px; background:#d97706; border:none; color:white; font-weight:bold; cursor:pointer;" onclick="procesarAprobacionInsumo(${insumo.id}, '${insumo.nombre}')">
                    <i class="fa-solid fa-stamp"></i> EVALUAR INSUMO
                </button>
            </div>`;
        });

        contenedor.innerHTML = htmlFinal;

    } catch (error) {
        console.error("Error unificando gestor:", error);
        contenedor.innerHTML = '<p style="color:red; text-align:center; grid-column: 1/-1;">❌ Error de sincronización con la base de datos.</p>';
    }
}

// Ventana de evaluación contable/operativa de insumos para el Admin
async function procesarAprobacionInsumo(id, nombre) {
    const { value: origenEstrategia } = await Swal.fire({
        title: 'Evaluación Estratégica de Insumo',
        html: `
            <div style="text-align: left; padding: 5px; font-size:13px;">
                <p style="color:#475569; margin-bottom:15px;">Estás a punto de oficializar el insumo: <b style="color:#0f172a;">${nombre}</b> en el maestro del sistema.</p>
                <label style="font-weight:900; font-size:11px; color:var(--primary); display:block; margin-bottom:5px;">DEFINIR ORIGEN DE PRODUCCIÓN (Make vs Buy):</label>
                <select id="swal-insumo-origen" class="swal2-input" style="width:100%; margin:0; height:40px; font-size:14px;">
                    <option value="Externo">📦 COMPRA EXTERNA (Se compra directo a proveedor)</option>
                    <option value="Interno">🛠️ FABRICACIÓN INTERNA (Se procesa en el taller)</option>
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Oficializar e Inyectar SKU',
        cancelButtonText: 'Rechazar',
        confirmButtonColor: '#d97706',
        preConfirm: () => document.getElementById('swal-insumo-origen').value
    });

    if (origenEstrategia) {
        Swal.fire({ title: 'Insertando en maestros...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await apiFetch(`${API_URL}/api/sugerencias/aprobar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sugerencia_id: id, origen: origenEstrategia })
            });
            const data = await res.json();
            if (data.exito) {
                Swal.fire('¡Aprobado Oficial!', data.mensaje, 'success');
                cargarGestorAprobacion();
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Error de comunicación con Flask', 'error');
        }
    }
}

async function procesarAprobacion(id, nombre) {
    const { value: formValues } = await Swal.fire({
        title: 'Aprobación Técnica y Contable',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p style="font-size: 13px; margin-bottom: 15px; color:#475569;">Configura los costos y estrategia para: <b style="color:#0f172a;">${nombre}</b></p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 15px;">
                    <label style="font-size: 10px; font-weight: 900; color:var(--danger); display: block;">1. COSTO REAL (Producción/Compra) S/</label>
                    <input id="swal-costo" class="swal2-input" type="number" placeholder="Ej: 800" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--warning); display: block;">2. PRECIO MÍNIMO PERMITIDO S/</label>
                    <input id="swal-precio-min" class="swal2-input" type="number" placeholder="Ej: 1200" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--success); display: block;">3. PRECIO ETIQUETA / SUGERIDO S/</label>
                    <input id="swal-precio-sug" class="swal2-input" type="number" placeholder="Ej: 1500" style="margin-top: 5px; height: 35px; max-width:90%;">
                </div>
                
                <label style="font-size: 11px; font-weight: 900; color:var(--accent); display: block;">ESTRATEGIA (Make vs Buy)</label>
                <select id="swal-origen" class="swal2-input" style="width: 90%; max-width:90%; margin-top: 5px; height: 40px;">
                    <option value="Interno">🛠️ Fabricación Interna (Taller)</option>
                    <option value="Externo">📦 Compra Externa (Proveedor)</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Aprobar Modelo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        width: '500px',
        preConfirm: () => {
            return {
                costo: document.getElementById('swal-costo').value,
                precio_min: document.getElementById('swal-precio-min').value,
                precio_sug: document.getElementById('swal-precio-sug').value,
                origen: document.getElementById('swal-origen').value
            }
        }
    });

    if (formValues) {
        if (!formValues.costo || !formValues.precio_min || !formValues.precio_sug) {
            return Swal.fire('Error', 'Debes llenar los 3 campos contables.', 'error');
        }
        if (parseFloat(formValues.precio_min) < parseFloat(formValues.costo)) {
            return Swal.fire('Alerta Financiera', 'El precio mínimo no puede ser menor al costo.', 'error');
        }
        
        // Enviamos todo a Python — precio_base usa el precio mínimo como referencia
        ejecutarAprobacion(id, formValues.origen, formValues.precio_min);
    }
}
async function ejecutarAprobacion(id, origen, precio_base) {
    try {
        Swal.fire({ title: 'Aprobando y publicando...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/creaciones/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creacion_id: id,
                origen: origen,
                precio_base: precio_base
            })
        });

        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Aprobado!', 'El modelo ya está disponible en el Catálogo Principal para todos los vendedores.', 'success');
            cargarGestorAprobacion(); // Recargar bandeja
            init(); // Forzamos recarga del catálogo en segundo plano
        } else {
            Swal.fire('Error', data.error || 'No se pudo aprobar.', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}
/* ================================================================= */
/* --- MÓDULO: ENTRADA DIRECTA DE PRODUCTOS (CUADROS/ESPEJOS) --- */
/* ================================================================= */
/* ================================================================= */
/* --- MÓDULO 4 COMPLETO: NUEVAS FUNCIONES                       --- */
/* ================================================================= */

/* --- 1. STATS DEL TALLER (puebla el badge del header) --- */
async function cargarStatsTaller() {
    const badge = document.getElementById('stats-taller');
    if (!badge) return;
    try {
        const res  = await apiFetch(`${API_URL}/api/taller/stats`);
        const data = await res.json();
        if (data.error) { badge.innerText = 'Error de stats'; return; }

        const activos   = data.activos   || 0;
        const enProceso = data.en_proceso || 0;
        const pendientes = data.pendientes || 0;
        const listas    = data.ventas_listas || 0;

        badge.innerHTML = `
            <span style="color:#f59e0b; margin-right:8px;">
                <i class="fa-solid fa-clock"></i> ${pendientes} pendientes
            </span>
            <span style="color:#3b82f6; margin-right:8px;">
                <i class="fa-solid fa-gear fa-spin"></i> ${enProceso} en proceso
            </span>
            ${listas > 0 ? `<span style="color:#22c55e;">
                <i class="fa-solid fa-circle-check"></i> ${listas} listas
            </span>` : ''}
        `;
    } catch (e) {
        if (badge) badge.innerText = 'Sin conexión';
    }
}

/* --- 2. VISTA DE ÓRDENES POR PEDIDO (Admin) --- */
async function cargarOrdenesProduccion(contenedor) {
    try {
        const res    = await apiFetch(`${API_URL}/api/taller/ordenes?estado=activas`);
        const ordenes = await res.json();

        if (!Array.isArray(ordenes) || ordenes.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin órdenes de producción activas</p>
                    <p style="font-size:13px;">Todas las ventas están entregadas o no requieren producción.</p>
                </div>`;
            return;
        }

        const AREA_NOMBRES = {
            'ESTRUCTURAS_MUEBLES':     'Carpintería (Sofás)',
            'ESTRUCTURAS_SILLAS':      'Carpintería (Sillas)',
            'CORTE_Y_CONTROL_TELAS':   'Corte y Telas',
            'TELAS':                   'Corte y Telas',
            'PREPARACION_PATAS_ZOCALO':'Patas y Zócalos',
            'TABLEROS_Y_PIEDRAS':      'Tableros',
            'TAPICERIA_SOFAS':         'Tapicería Sofás',
            'TAPICERIA_SILLAS':        'Tapicería Sillas',
            'ARMADO_COJINES':          'Armado de Cojines',
            'DESPACHO_CENTRAL':        'Despacho',
        };

        const ESTADO_BADGE = {
            'Pendiente':    { bg:'#fef3c7', color:'#b45309', icon:'🟡' },
            'Bloqueado':    { bg:'#e2e8f0', color:'#64748b', icon:'🔒' },
            'En Proceso':   { bg:'#dbeafe', color:'#1e40af', icon:'🔵' },
            'Terminado':    { bg:'#dcfce7', color:'#166534', icon:'✅' },
            // Logística de tela externa
            'En Recojo':    { bg:'#fef9c3', color:'#854d0e', icon:'🚛' },
            'Recogido':     { bg:'#e0f2fe', color:'#0369a1', icon:'📦' },
            'Distribuido':  { bg:'#dcfce7', color:'#166534', icon:'✅' },
        };

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; font-size:15px; font-weight:900; color:#0f172a;">
                        <i class="fa-solid fa-list-check" style="color:#558fc5;"></i> ${ordenes.length} orden${ordenes.length>1?'es':''} activa${ordenes.length>1?'s':''}
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Vista agrupada por pedido — progreso de cada área de producción</p>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">`;

        ordenes.forEach(orden => {
            const progresoColor = orden.progreso >= 100 ? '#22c55e' : (orden.progreso >= 50 ? '#3b82f6' : '#f59e0b');
            const estadoBadge   = {
                'Listo':         { bg:'#dcfce7', color:'#166534' },
                'En Producción': { bg:'#dbeafe', color:'#1e40af' },
                'Pendiente':     { bg:'#fef3c7', color:'#b45309' },
            }[orden.estado] || { bg:'#f1f5f9', color:'#475569' };

            // Construir filas de items con sus tickets
            let itemsHTML = '';
            (orden.items || []).forEach(item => {
                const ticketsHTML = (item.tickets || [])
                    .filter(t => t.area !== 'DESPACHO_CENTRAL')
                    .map(t => {
                        const b = ESTADO_BADGE[t.estado] || { bg:'#f1f5f9', color:'#64748b', icon:'?' };
                        const nombre = AREA_NOMBRES[t.area] || t.area.replace(/_/g,' ');
                        // Para logística de tela: mostrar operario asignado y tapicero destino
                        if (t.es_logistica) {
                            const operarioInfo = (t.trabajador && t.trabajador !== 'Sin asignar')
                                ? '<span style="opacity:0.75">· ' + t.trabajador + '</span>'
                                : '<span style="opacity:0.6;color:#dc2626;"> · Sin operario</span>';
                            const tapiceroInfo = (t.tapicero_destino && t.tapicero_destino !== 'Sin asignar')
                                ? '<span style="opacity:0.75"> → ' + t.tapicero_destino + '</span>'
                                : '<span style="opacity:0.6;color:#dc2626;"> → Sin tapicero</span>';
                            const insumoLabel = t.insumo_nombre ? ' · ' + t.insumo_nombre : '';
                            return '<span title="Tela externa' + (t.insumo_nombre || '') + '" style="font-size:10px; background:' + b.bg + '; color:' + b.color + '; padding:3px 8px; border-radius:20px; font-weight:800; white-space:nowrap; display:inline-flex; align-items:center; gap:3px;">'
                                + b.icon + ' Tela ext.' + insumoLabel
                                + ' ' + operarioInfo + tapiceroInfo
                                + '</span>';
                        }
                        return `<span style="font-size:10px; background:${b.bg}; color:${b.color}; padding:3px 8px; border-radius:20px; font-weight:800; white-space:nowrap;">
                                    ${b.icon} ${nombre}
                                    ${t.trabajador !== 'Sin asignar' ? `<span style="opacity:0.7">· ${t.trabajador}</span>` : ''}
                                </span>`;
                    }).join('');

                const hayTickets = item.tickets && item.tickets.filter(t => t.area !== 'DESPACHO_CENTRAL').length > 0;
                itemsHTML += `
                    <div style="border-bottom:1px solid #f1f5f9; padding:8px 0; display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
                        <img src="${item.foto}" alt="" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;" onerror="this.src='imagenes/sin_foto.jpg'">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:5px;">${item.producto}</div>
                            ${hayTickets ? `<div style="display:flex; gap:5px; flex-wrap:wrap;">${ticketsHTML}</div>` : `<span style="font-size:11px; color:#94a3b8;">Sin tickets de producción</span>`}
                        </div>
                        <button onclick="abrirNotaOrden(${item.tickets && item.tickets[0] ? item.tickets[0].id : 0})"
                            style="background:#f8fafc; border:1px solid #e2e8f0; color:#475569; padding:5px 10px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;"
                            title="Agregar nota/incidencia">
                            <i class="fa-solid fa-note-sticky"></i>
                        </button>
                    </div>`;
            });

            html += `
            <div style="background:white; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Cabecera de la orden -->
                <div style="background:#f8fafc; padding:14px 18px; border-bottom:1px solid #e2e8f0; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                            <span style="font-size:13px; font-weight:900; color:#0f172a;">${orden.codigo}</span>
                            <span style="font-size:11px; background:${estadoBadge.bg}; color:${estadoBadge.color}; padding:2px 8px; border-radius:20px; font-weight:800;">${orden.estado}</span>
                        </div>
                        <div style="font-size:12px; color:#475569;">
                            <b>${orden.cliente}</b> &nbsp;·&nbsp;
                            <i class="fa-solid fa-calendar-days" style="color:#94a3b8;"></i> Entrega: <b>${orden.fecha_entrega}</b>
                            ${orden.vendedor ? `&nbsp;·&nbsp; <i class="fa-solid fa-user" style="color:#94a3b8;"></i> ${orden.vendedor}` : ''}
                            ${orden.sede ? `&nbsp;·&nbsp; ${orden.sede}` : ''}
                        </div>
                    </div>
                    <!-- Barra de progreso -->
                    <div style="min-width:160px; flex-shrink:0;">
                        <div style="font-size:10px; font-weight:900; color:${progresoColor}; margin-bottom:4px; text-align:right;">
                            ${orden.progreso}% completado
                            (${orden.tickets_term}/${orden.tickets_total} áreas)
                        </div>
                        <div style="background:#e2e8f0; border-radius:6px; height:8px; overflow:hidden;">
                            <div style="width:${orden.progreso}%; height:100%; background:${progresoColor}; border-radius:6px; transition:0.5s;"></div>
                        </div>
                    </div>
                </div>
                <!-- Ítems de la orden -->
                <div style="padding:12px 18px;">
                    ${itemsHTML || '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:10px;">Sin ítems de producción</p>'}
                </div>
            </div>`;
        });

        html += '</div>';
        contenedor.innerHTML = html;
        contenedor.style.display = 'block';

    } catch (e) {
        console.error('Error cargando órdenes:', e);
        contenedor.innerHTML = '<p style="color:red; text-align:center; padding:20px;">❌ Error al cargar las órdenes de producción.</p>';
    }
}

/* --- 3. AGREGAR NOTA / INCIDENCIA A UN TICKET --- */
async function abrirNotaOrden(ticketId) {
    if (!ticketId) {
        return Swal.fire('Sin ticket', 'Este ítem no tiene ticket de producción activo.', 'info');
    }

    const { value: nota } = await Swal.fire({
        title: '📝 Agregar nota / incidencia',
        html: `
            <div style="text-align:left;">
                <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px; color:#78350f;">
                    La nota quedará registrada con fecha, hora y tu nombre en el historial del ticket.
                </div>
                <textarea id="swal-nota-input" class="swal2-input" 
                    style="width:100%; height:90px; resize:vertical; font-size:13px; margin:0; padding:10px; box-sizing:border-box;"
                    placeholder="Ej: Material llegó con defecto, se coordinó cambio. / El maestro tuvo que ausentarse..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#25D366',
        cancelButtonText: 'Cancelar',
        confirmButtonText: '<i class="fa-solid fa-save"></i> Guardar nota',
        preConfirm: () => {
            const val = document.getElementById('swal-nota-input').value.trim();
            if (!val) { Swal.showValidationMessage('Escribe algo antes de guardar.'); return false; }
            return val;
        }
    });

    if (!nota) return;

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/taller/ticket/${ticketId}/nota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nota,
                usuario_nombre: usuarioActivo ? usuarioActivo.nombre : 'Usuario'
            })
        });
        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Nota guardada!', 'La incidencia quedó registrada en el ticket.', 'success');
        } else {
            Swal.fire('Error', data.error || 'No se pudo guardar la nota.', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* ================================================================= */
/* --- FICHA TÉCNICA DEL CHOFER — Toggle con carga lazy          --- */
/* ================================================================= */

const _fichaChoferCache = {};

async function toggleFichaChofer(ticketId, itemId) {
    const contenedor = document.getElementById(`ficha-chofer-${ticketId}`);
    const btn        = document.getElementById(`btn-ficha-${ticketId}`);
    if (!contenedor) return;

    // Toggle: si ya está visible, ocultar
    if (contenedor.style.display !== 'none') {
        contenedor.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando ficha...';
    btn.disabled  = true;

    // Usar caché si ya se cargó antes
    if (_fichaChoferCache[itemId]) {
        contenedor.innerHTML = _renderFichaChofer(_fichaChoferCache[itemId], ticketId);
        contenedor.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> OCULTAR FICHA';
        btn.disabled  = false;
        return;
    }

    try {
        const res  = await apiFetch(`${API_URL}/api/despacho/ficha-chofer/${itemId}`);
        const data = await res.json();

        if (!res.ok || data.error) {
            Swal.fire('Error', data.error || 'No se pudo cargar la ficha.', 'error');
            btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
            btn.disabled  = false;
            return;
        }

        _fichaChoferCache[itemId] = data;
        contenedor.innerHTML = _renderFichaChofer(data, ticketId);
        contenedor.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> OCULTAR FICHA';
    } catch(e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
        btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> VER FICHA TÉCNICA';
    }
    btn.disabled = false;
}

function _renderFichaChofer(d, ticketId) {
    const moneda   = 'S/';
    const saldoCol = d.saldo > 0 ? '#dc2626' : '#16a34a';
    const saldoTxt = d.saldo > 0 ? `⚠️ Falta cobrar ${moneda} ${d.saldo.toFixed(2)}` : '✅ Pagado completo';

    // Fotos de evidencia por área
    const fotosHTML = d.evidencias && d.evidencias.length > 0
        ? `<div style="padding:14px 16px;border-top:1px solid #e2e8f0;">
               <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                   📷 Evidencias de producción (${d.evidencias.length} área${d.evidencias.length>1?'s':''})
               </div>
               <div style="display:flex;gap:12px;flex-wrap:wrap;">
                   ${d.evidencias.map(e => `
                   <div style="text-align:center;flex:0 0 auto;">
                       <div style="font-size:9px;font-weight:700;color:#475569;margin-bottom:4px;max-width:90px;line-height:1.3;">${e.area}</div>
                       <img src="${e.foto}"
                           style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:2px solid #22c55e;cursor:pointer;"
                           onclick="window.open('${e.foto}','_blank')"
                           onerror="this.parentElement.style.display='none'">
                       <div style="font-size:9px;color:#64748b;margin-top:3px;">${e.operario}</div>
                   </div>`).join('')}
               </div>
           </div>`
        : `<div style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
               Sin fotos de evidencia registradas aún.
           </div>`;

    return `
    <div style="border-top:1px solid #e2e8f0;">
        <!-- Datos del cliente -->
        <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                👤 Datos del cliente
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Cliente</span>
                    <span style="font-weight:700;color:#0f172a;">${d.cliente}</span>
                </div>
                ${d.telefono ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Teléfono</span>
                    <a href="tel:${d.telefono}" style="font-weight:700;color:#0369a1;text-decoration:none;">📞 ${d.telefono}</a>
                </div>` : ''}
                ${d.direccion ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;gap:16px;">
                    <span style="color:#64748b;flex-shrink:0;">Dirección</span>
                    <span style="font-weight:700;color:#0f172a;text-align:right;">${d.direccion}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Fecha entrega</span>
                    <span style="font-weight:700;color:#0f172a;">${d.fecha_entrega}</span>
                </div>
            </div>
        </div>

        <!-- Financiero -->
        <div style="padding:14px 16px;background:#fff;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                💰 Situación de pago
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Total del pedido</span>
                    <span style="font-weight:700;">${moneda} ${d.total.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                    <span style="color:#64748b;">Adelanto pagado</span>
                    <span style="font-weight:700;color:#16a34a;">${moneda} ${d.adelanto.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                    <span style="color:#64748b;font-weight:700;">Saldo a cobrar</span>
                    <span style="font-weight:900;font-size:15px;color:${saldoCol};">${moneda} ${d.saldo.toFixed(2)}</span>
                </div>
                <div style="background:${d.saldo>0?'#fef2f2':'#f0fdf4'};border:1px solid ${d.saldo>0?'#fca5a5':'#86efac'};border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;color:${saldoCol};text-align:center;margin-top:4px;">
                    ${saldoTxt}
                </div>
            </div>
        </div>

        <!-- Fotos de evidencia de producción -->
        ${fotosHTML}
    </div>`;
}

/* ================================================================= */
/* --- VISTA HISTORIAL DE ENTREGADOS                              --- */
/* ================================================================= */

async function cargarVistaEntregados(contenedor, choferId) {
    try {
        const url = choferId
            ? `${API_URL}/api/despacho/entregados?chofer_id=${choferId}`
            : `${API_URL}/api/despacho/entregados`;

        const res  = await apiFetch(url);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:#64748b;">
                    <div style="font-size:48px;margin-bottom:16px;">✅</div>
                    <p style="font-weight:700;font-size:15px;color:#374151;margin:0 0 8px;">Sin entregas registradas aún</p>
                    <p style="font-size:13px;margin:0;">Cuando confirmes una entrega aparecerá aquí.</p>
                </div>`;
            return;
        }

        let html = `
            <div style="margin-bottom:16px;padding:12px 16px;background:#f0fdf4;border-radius:10px;border:1px solid #86efac;display:flex;align-items:center;gap:10px;">
                <i class="fa-solid fa-circle-check" style="color:#15803d;font-size:18px;"></i>
                <div>
                    <div style="font-weight:800;color:#15803d;font-size:13px;">${data.length} entrega${data.length!==1?'s':''} completada${data.length!==1?'s':''}</div>
                    <div style="font-size:11px;color:#166534;">Historial de despachos confirmados</div>
                </div>
            </div>`;

        for (const e of data) {
            const saldoCobrado = e.saldo === 0
                ? `<span style="color:#15803d;font-weight:800;">✓ Pagado</span>`
                : `<span style="color:#dc2626;font-weight:800;">S/ ${e.saldo.toFixed(2)} pendiente</span>`;

            html += `
            <div style="background:#fff;border:2px solid #86efac;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <!-- Cabecera verde -->
                <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:12px 16px;border-bottom:1px solid #86efac;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div>
                        <div style="font-size:10px;font-weight:900;color:#166534;text-transform:uppercase;letter-spacing:1px;">Entregado</div>
                        <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">${e.producto}</div>
                        <div style="font-size:11px;color:#475569;margin-top:1px;">${e.codigo_venta} · ${e.cliente}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="background:#15803d;color:white;font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;margin-bottom:4px;">🎉 ENTREGADO</div>
                        <div style="font-size:10px;color:#64748b;">${e.fecha_entrega_real}</div>
                    </div>
                </div>
                <!-- Detalle -->
                <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 120px), 1fr));gap:8px;font-size:12px;">
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Chofer</div>
                        <div style="font-weight:700;color:#0f172a;">${e.chofer}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Sede</div>
                        <div style="font-weight:700;color:#0f172a;">${e.sede || '—'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Dirección</div>
                        <div style="font-weight:600;color:#374151;">${e.direccion || '—'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;">Saldo</div>
                        <div>${saldoCobrado}</div>
                    </div>
                </div>
                ${e.foto_evidencia ? `
                <div style="padding:0 16px 12px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">📷 Foto de entrega</div>
                    <img src="${e.foto_evidencia}" alt="Evidencia" style="width:100%;max-width:280px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;"
                        onclick="window.open('${e.foto_evidencia}','_blank')">
                </div>` : ''}
            </div>`;
        }

        contenedor.innerHTML = html;
    } catch(e) {
        console.error('Error cargando entregados:', e);
        contenedor.innerHTML = `<p style="color:red;text-align:center;padding:30px;">Error al cargar el historial. Intenta de nuevo.</p>`;
    }
}
/**
 * _syncFotoEvid — preview al seleccionar foto de evidencia en tickets del taller.
 * Muestra miniatura bajo los botones de selección.
 */
function _syncFotoEvid(inputEl, ticketId) {
    const file = inputEl?.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const previewDiv = document.getElementById(`foto-evid-preview-${ticketId}`);
    const imgEl      = document.getElementById(`foto-evid-img-${ticketId}`);
    if (!previewDiv || !imgEl) return;
    const reader = new FileReader();
    reader.onload = e => {
        imgEl.src = e.target.result;
        previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

/**
 * _syncDerivarFoto — sincroniza foto del material cortado al derivar al tapicero.
 */
function _syncDerivarFoto(inputOrigen) {
    const file = inputOrigen?.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const cam = document.getElementById('foto-derivar-cam');
    const gal = document.getElementById('foto-derivar');
    if (cam) cam.files = dt.files;
    if (gal) gal.files = dt.files;
    const previewDiv = document.getElementById('foto-derivar-preview');
    const imgEl      = document.getElementById('foto-derivar-img');
    if (!previewDiv || !imgEl || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        imgEl.src = e.target.result;
        previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
}
// ── Stock Producción (Admin) — portal con secciones futuras, por ahora solo sofás ──
async function cargarVistaStockProduccion(contenedor) {
    // Sin título extra — el header de la página ya muestra "STOCK DE PRODUCCION"
    contenedor.innerHTML = '<div id="sp-sofa-contenido" style="padding:4px 0;">Cargando...</div>';
    await _cargarContenidoStockSofa('sp-sofa-contenido', true);
}

// ── Stock del Carpintero de Sofás (Operario con area ESTRUCTURAS_MUEBLES) ──
async function cargarVistaStockCarpinteroSofa(contenedor) {
    contenedor.innerHTML = `<div style="padding:16px;box-sizing:border-box;width:100%;overflow-x:hidden;" id="stock-carp-wrapper">Cargando...</div>`;
    await _cargarContenidoStockSofa('stock-carp-wrapper', false);
}

async function mostrarSeccionStockProd(seccion) {
    // Por ahora solo hay sofás; extender aquí en el futuro
    if (seccion === 'sofa') await _cargarContenidoStockSofa('sp-sofa-contenido', true);
}

// ── Motor compartido de stock de estructuras de sofá ──
async function _cargarContenidoStockSofa(contenedorId, esAdmin) {
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras`);
        const data = await res.json();

        window._stockEstructurasData = data;
        const disponibles = data.filter(e => e.estado === 'disponible');
        const entregados  = data.filter(e => e.estado === 'entregado');

        document.getElementById(contenedorId).innerHTML = `
        <div style="width:100%;box-sizing:border-box;">
          <!-- Header: título área + botón registrar -->
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <i class="fa-solid fa-couch" style="color:#7c3aed;font-size:18px;"></i>
              <div>
                <div style="font-weight:900;font-size:15px;color:#0f172a;">Estructuras de Sofá</div>
                <div style="font-size:11px;color:#64748b;margin-top:1px;">${disponibles.length} disponible${disponibles.length!==1?'s':''} · ${entregados.length} entregado${entregados.length!==1?'s':''}</div>
              </div>
            </div>
            <button onclick="abrirModalRegistrarEstructura('${contenedorId}', ${esAdmin})"
                style="background:#7c3aed;color:white;border:none;border-radius:8px;
                       padding:10px 20px;cursor:pointer;font-size:13px;font-weight:700;
                       display:flex;align-items:center;gap:6px;white-space:nowrap;margin-left:auto;">
                <i class="fa-solid fa-plus"></i> Registrar
            </button>
          </div>

          <!-- ── Buscador de contratos pendientes (solo operario carpintero, no gestor admin) ── -->
          ${!esAdmin ? `
          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:800;color:#7c3aed;letter-spacing:0.08em;margin-bottom:8px;">
              <i class="fa-solid fa-magnifying-glass"></i> BUSCAR CONTRATO PENDIENTE
            </div>
            <div style="display:flex;gap:8px;">
              <input id="se-buscar-contrato-${contenedorId}"
                  placeholder="Ej: INV-0042 o solo 42"
                  style="flex:1;padding:9px 12px;border:1.5px solid #d8b4fe;border-radius:8px;font-size:13px;outline:none;"
                  onkeydown="if(event.key==='Enter') _buscarContratoPendiente('${contenedorId}')">
              <button onclick="_buscarContratoPendiente('${contenedorId}')"
                  style="padding:9px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;
                         font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">
                  Buscar
              </button>
            </div>
            <div id="se-contrato-resultado-${contenedorId}" style="margin-top:10px;"></div>
          </div>` : ''}

          <!-- Sub-tabs: Disponibles / Entregados -->
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <button id="subtab-disp-${contenedorId}" onclick="_filtrarStockSofa('disponible','${contenedorId}')"
                style="flex:1;min-width:140px;padding:10px;border-radius:8px;border:2px solid #7c3aed;
                       background:#7c3aed;color:white;font-weight:800;cursor:pointer;font-size:12px;">
                <i class="fa-solid fa-box"></i> En stock (${disponibles.length})
            </button>
            <button id="subtab-ent-${contenedorId}" onclick="_filtrarStockSofa('entregado','${contenedorId}')"
                style="flex:1;min-width:140px;padding:10px;border-radius:8px;border:2px solid #15803d;
                       background:#f0fdf4;color:#15803d;font-weight:800;cursor:pointer;font-size:12px;">
                <i class="fa-solid fa-circle-check"></i> Entregados (${entregados.length})
            </button>
          </div>

          <!-- Radio buttons: solo visibles en tab "En stock" -->
          <div id="radio-subtipo-${contenedorId}"
               style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
            ${['todos','estandar','personalizada'].map((v,i) => {
                const labels = ['Todos','⭐ Estándar','📐 Personalizadas'];
                const checked = i === 0 ? 'checked' : '';
                return `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                      padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
                                      border:1.5px solid ${i===0?'#7c3aed':'#e2e8f0'};
                                      background:${i===0?'#f5f3ff':'white'};
                                      color:${i===0?'#7c3aed':'#64748b'};"
                               id="radio-label-${v}-${contenedorId}">
                          <input type="radio" name="subtipo-${contenedorId}" value="${v}" ${checked}
                                 style="accent-color:#7c3aed;"
                                 onchange="_filtrarSubtipoSofa('${contenedorId}')">
                          ${labels[i]}
                        </label>`;
            }).join('')}
          </div>

          <div id="lista-est-${contenedorId}">
            ${_renderListaEstructuras(_groupEstructuras(disponibles))}
          </div>
        </div>

        <!-- Modal registrar -->
        <div id="modal-registro-estructura" style="display:none;position:fixed;inset:0;
             background:rgba(0,0,0,0.6);z-index:9999;
             justify-content:center;align-items:center;">
          <div style="background:white;border-radius:16px;padding:24px;width:400px;max-width:95vw;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;font-size:16px;" id="se-modal-titulo">Registrar estructura / destrokes</h3>
              <button onclick="cerrarModalEstructura()"
                  style="background:#f1f5f9;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:16px;color:#64748b;">✕</button>
            </div>

            <label style="font-size:12px;font-weight:700;color:#475569;">TIPO</label>
            <select id="se-tipo" onchange="_onChangeTipoEstructura()"
                style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">
              <option value="estructura">🪵 Estructura de sofá</option>
              <option value="destrokes">🔧 Destrokes</option>
            </select>

            <label style="font-size:12px;font-weight:700;color:#475569;">NOMBRE / DESCRIPCIÓN *</label>
            <input id="se-nombre" placeholder="Ej: Seccional 3+2 · Gris Perla"
                style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">

            <label style="font-size:12px;font-weight:700;color:#475569;">CANTIDAD *</label>
            <input id="se-cantidad" type="number" placeholder="Ej: 1" min="1" step="1" value="1"
                style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">

            <!-- ── Bloque SOLO para Estructura ── -->
            <div id="bloque-solo-estructura">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label style="font-size:12px;font-weight:700;color:#475569;">MODELO BASE *</label>
                <button type="button" onclick="_abrirGestorDesdeStock()"
                    title="Agregar o editar modelos"
                    style="background:#f5f3ff;border:1.5px solid #ddd6fe;color:#7c3aed;
                           border-radius:7px;padding:4px 10px;cursor:pointer;
                           font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;">
                  ⚙️ Gestionar
                </button>
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:5px;">Tipo de sofá de las plantillas del catálogo</div>
              <select id="se-modelo-base"
                  style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;margin-bottom:10px;font-size:13px;">
                <option value="">— Seleccionar modelo base —</option>
              </select>

            <!-- A8: Medidas estructura sofa -->
            <div style="margin-bottom:6px;">
            <label style="font-size:12px;font-weight:700;color:#475569;">MEDIDAS (cm)</label>
            </div>
            <div id="bloque-medidas" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            <input id="se-ancho" type="number" placeholder="Ancho"
                style="flex:1;min-width:80px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            <input id="se-prof" type="number" placeholder="Prof."
                style="flex:1;min-width:80px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            <input id="se-alto" type="number" placeholder="Alto"
                style="flex:1;min-width:80px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
            </div>
            <!-- A8: Checkbox para marcar como medida estándar en BD -->
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;cursor:pointer;
                        background:#f9f5ff;padding:8px 10px;border-radius:6px;border:1px solid #ede9fe;">
            <input type="checkbox" id="se-estandar" onchange="document.getElementById('bloque-medidas').style.display = this.checked ? 'none' : 'flex'; if(this.checked){document.getElementById('se-ancho').value='';document.getElementById('se-prof').value='';document.getElementById('se-alto').value='';}"> 
            <span style="font-weight:500;">Es una medida estándar de catálogo</span>
            </label>
            </div><!-- A8: Bloque PATA/ZÓCALO para estructura sofa -->
<div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
  <label style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;display:block;">TIPO DE BASE</label>
  <select id="se-tipo-base" onchange="_actualizarVisibilidadBase()"
      style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:10px;font-size:13px;background:white;">
    <option value="">— Sin base (solo estructura) —</option>
    <option value="patas">Patas</option>
    <option value="zocalo">Zócalo</option>
  </select>

  <!-- Inputs de medida para pata/zócalo, mostrados condicionalmente -->
  <div id="bloque-medida-base" style="display:none;">
    <label style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;display:block;">MEDIDA DE BASE (cm)</label>
    <div id="bloque-inputs-medida-base" style="display:flex;gap:6px;margin-bottom:10px;">
      <input id="se-medida-base" type="number" placeholder="Ej: 15" step="0.1"
          style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;">
    </div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;
                  background:#f9f5ff;padding:8px 10px;border-radius:6px;border:1px solid #ede9fe;">
      <input type="checkbox" id="se-medida-base-estandar" onchange="document.getElementById('bloque-inputs-medida-base').style.display = this.checked ? 'none' : 'flex'; if(this.checked){document.getElementById('se-medida-base').value='';}"> 
      <span style="font-weight:500;">Es una medida estándar de base</span>
    </label>
  </div>
</div>
<!-- ── fin bloque pata/zócalo ── -->
            <!-- ── fin bloque estructura ── -->

            <!-- ── Bloque SOLO para Destrokes ── -->
            <div id="bloque-solo-destrokes" style="display:none;">
            </div>
            <!-- ── fin bloque destrokes ── -->

            <label style="font-size:12px;font-weight:700;color:#475569;">PRECIO (S/)</label>
            <input id="se-precio" type="number" placeholder="Ej: 350.00" step="0.01"
                style="width:100%;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-size:13px;">

            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:8px;">FOTO *</label>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
              <label style="flex:1;cursor:pointer;background:#7c3aed;color:#fff;padding:10px;border-radius:8px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-camera"></i> Tomar foto
                <input type="file" id="se-foto-cam" accept="image/*" capture="environment" style="display:none;" onchange="seSyncFoto(this)">
              </label>
              <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#1e293b;padding:10px;border-radius:8px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-folder-open"></i> Subir archivo
                <input type="file" id="se-foto" accept="image/*" style="display:none;" onchange="seSyncFoto(this)">
              </label>
            </div>
            <div id="se-foto-preview-container" style="display:none;margin-bottom:14px;text-align:center;">
              <img id="se-foto-preview" style="max-height:90px;border-radius:8px;border:2px solid #7c3aed;object-fit:cover;">
              <p id="se-foto-nombre" style="font-size:11px;color:#64748b;margin:4px 0 0;"></p>
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="cerrarModalEstructura()"
                  style="flex:1;padding:11px;border:1.5px solid #cbd5e1;background:white;
                         border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                Cancelar
              </button>
              <button onclick="guardarEstructura()"
                  style="flex:1;padding:11px;background:#7c3aed;color:white;border:none;
                         border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">
                <i class="fa-solid fa-floppy-disk"></i> Guardar
              </button>
            </div>
          </div>
        </div>`;

        // Guardar el contenedorId activo para saber dónde refrescar
        window._stockSofaContenedorActivo = contenedorId;

    } catch(e) {
        const el = document.getElementById(contenedorId);
        if (el) el.innerHTML = `<p style="color:red;text-align:center;">Error al cargar stock.</p>`;
    }
}


// ── Buscador inteligente de contratos pendientes (carpintero de sofás) ──
async function _buscarContratoPendiente(contenedorId) {
    const input = document.getElementById(`se-buscar-contrato-${contenedorId}`);
    const resultado = document.getElementById(`se-contrato-resultado-${contenedorId}`);
    if (!input || !resultado) return;

    let query = input.value.trim();
    if (!query) return;

    // Normalizar: si es solo dígitos → agregar prefijo INV-
    if (/^\d+$/.test(query)) {
        query = 'INV-' + query.padStart(4, '0');
    } else {
        query = query.toUpperCase();
    }

    resultado.innerHTML = `<div style="font-size:12px;color:#7c3aed;padding:6px 0;">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Buscando ${query}...
    </div>`;

    try {
        // Usamos el endpoint de tickets pendientes y filtramos por código
        const res  = await apiFetch(`${API_URL}/api/taller/tickets_pendientes`);
        const data = await res.json();

        if (!Array.isArray(data)) {
            resultado.innerHTML = `<div style="color:#dc2626;font-size:12px;">Error al consultar contratos.</div>`;
            return;
        }

        // Filtrar por código de venta (partial match, insensible a mayúsculas)
        const coincidencias = data.filter(t =>
            (t.codigo || '').toUpperCase().includes(query) &&
            (t.area === 'ESTRUCTURAS_MUEBLES' || !t.area)
        );

        // Si no hay por área específica, buscar en todos
        const todos = coincidencias.length > 0 ? coincidencias :
            data.filter(t => (t.codigo || '').toUpperCase().includes(query));

        if (!todos.length) {
            resultado.innerHTML = `
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:22px;margin-bottom:6px;">🔍</div>
                <div style="font-weight:700;font-size:13px;color:#374151;">No se encontró "${query}"</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Verifica el número o el contrato ya está asignado / terminado.</div>
              </div>`;
            return;
        }

        resultado.innerHTML = todos.map(t => `
          <div style="background:white;border:1px solid #ddd6fe;border-radius:10px;
                      padding:14px 16px;margin-bottom:8px;border-left:3px solid #7c3aed;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;">
              <div>
                <div style="font-weight:900;font-size:15px;color:#0f172a;">${t.codigo}</div>
                <div style="font-size:13px;color:#374151;margin-top:2px;">${t.producto}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">
                  <i class="fa-solid fa-user"></i> ${t.cliente || '—'} &nbsp;·&nbsp;
                  <i class="fa-solid fa-calendar"></i> Entrega: <b>${t.entrega || 'S/F'}</b>
                </div>
                ${t.especificaciones ? `<div style="font-size:11px;color:#7c3aed;margin-top:4px;">
                  <i class="fa-solid fa-palette"></i> ${t.especificaciones}
                </div>` : ''}
              </div>
              <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;
                           background:#faf5ff;color:#7c3aed;border:1px solid #ddd6fe;white-space:nowrap;">
                ${t.estado || 'Pendiente'}
              </span>
            </div>
          </div>`).join('');

    } catch(e) {
        resultado.innerHTML = `<div style="color:#dc2626;font-size:12px;">Error de conexión. Intenta de nuevo.</div>`;
    }
}

function _filtrarStockSofa(estado, contenedorId) {
    const data = window._stockEstructurasData || [];

    // Estilo activo/inactivo en los tabs
    const btnDisp = document.getElementById(`subtab-disp-${contenedorId}`);
    const btnEnt  = document.getElementById(`subtab-ent-${contenedorId}`);
    if (btnDisp && btnEnt) {
        if (estado === 'disponible') {
            btnDisp.style.background = '#7c3aed'; btnDisp.style.color = 'white';
            btnEnt.style.background  = '#f0fdf4'; btnEnt.style.color  = '#15803d';
        } else {
            btnEnt.style.background  = '#15803d'; btnEnt.style.color  = 'white';
            btnDisp.style.background = '#f5f3ff'; btnDisp.style.color = '#7c3aed';
        }
    }

    // Mostrar radio buttons solo en "En stock", ocultar en "Entregados"
    const radioWrap = document.getElementById(`radio-subtipo-${contenedorId}`);
    if (radioWrap) {
        radioWrap.style.display = estado === 'disponible' ? 'flex' : 'none';
        // Resetear a "Todos" al cambiar de tab
        const radioTodos = radioWrap.querySelector(`input[value="todos"]`);
        if (radioTodos) {
            radioTodos.checked = true;
            _actualizarEstiloRadios(contenedorId, 'todos');
        }
    }

    const lista = data.filter(e => e.estado === estado);
    document.getElementById(`lista-est-${contenedorId}`).innerHTML =
        _renderListaEstructuras(_groupEstructuras(lista));
}

function _filtrarSubtipoSofa(contenedorId) {
    const data   = window._stockEstructurasData || [];
    const radios = document.querySelectorAll(`input[name="subtipo-${contenedorId}"]`);
    let subtipo  = 'todos';
    radios.forEach(r => { if (r.checked) subtipo = r.value; });

    _actualizarEstiloRadios(contenedorId, subtipo);

    let lista = data.filter(e => e.estado === 'disponible');
    if (subtipo === 'estandar')     lista = lista.filter(e => e.medida_estandar);
    if (subtipo === 'personalizada') lista = lista.filter(e => !e.medida_estandar);

    document.getElementById(`lista-est-${contenedorId}`).innerHTML =
        _renderListaEstructuras(_groupEstructuras(lista));
}

function _actualizarEstiloRadios(contenedorId, activo) {
    ['todos','estandar','personalizada'].forEach(v => {
        const lbl = document.getElementById(`radio-label-${v}-${contenedorId}`);
        if (!lbl) return;
        const esActivo = v === activo;
        lbl.style.border     = `1.5px solid ${esActivo ? '#7c3aed' : '#e2e8f0'}`;
        lbl.style.background = esActivo ? '#f5f3ff' : 'white';
        lbl.style.color      = esActivo ? '#7c3aed' : '#64748b';
    });
}

// A8: Mostrar/ocultar inputs de medida de base cuando cambia el tipo
function _actualizarVisibilidadBase() {
    const tipoBase = document.getElementById('se-tipo-base');
    const bloqueBase = document.getElementById('bloque-medida-base');
    if (!tipoBase || !bloqueBase) return;
    
    const tieneBase = tipoBase.value !== '';
    bloqueBase.style.display = tieneBase ? 'block' : 'none';
    
    if (!tieneBase) {
        // Limpiar campos cuando se selecciona "Sin base"
        document.getElementById('se-medida-base').value = '';
        document.getElementById('se-medida-base-estandar').checked = false;
        const bBase = document.getElementById('bloque-inputs-medida-base');
        if (bBase) bBase.style.display = 'flex';
    }
}

function abrirModalRegistrarEstructura(contenedorId, esAdminCtx) {
    window._modalEstructuraCtx = { contenedorId, esAdminCtx };
    const modal = document.getElementById('modal-registro-estructura');
    if (!modal) return;
    modal.style.display = 'flex';

    // Reset todos los campos
    ['se-nombre','se-precio','se-ancho','se-prof','se-alto','se-cantidad','se-medida-base'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const cb = document.getElementById('se-estandar');
    if (cb) {
        cb.checked = false;
        const b = document.getElementById('bloque-medidas');
        if (b) b.style.display = 'flex';
    }
    const cbBase = document.getElementById('se-medida-base-estandar');
    if (cbBase) {
        cbBase.checked = false;
        const bBase = document.getElementById('bloque-inputs-medida-base');
        if (bBase) bBase.style.display = 'flex';
    }

    // Resetear tipo a "estructura" y disparar el cambio de UI
    const selTipo = document.getElementById('se-tipo');
    if (selTipo) { selTipo.value = 'estructura'; _onChangeTipoEstructura(); }

    const selTipoBase = document.getElementById('se-tipo-base');
    if (selTipoBase) { selTipoBase.value = ''; _actualizarVisibilidadBase(); }

    // Poblar select de modelos con optgroups (base del sistema + personalizados)
    _refreshSelectModeloBase();
}

// ── Poblar #se-modelo-base con optgroups ─────────────────────────────────────
function _refreshSelectModeloBase() {
    const sel = document.getElementById('se-modelo-base');
    if (!sel) return;

    // Modelos base del sistema (hardcoded — mismos que GM_MODELOS_BASE en index.html)
    const BASE = [
        'Multifuncional (3 Piezas)',
        'Multifuncional (4 Piezas)',
        'Seccional Normal',
        'Seccional Invertido',
        'Curvo',
        'En U',
        'Juego de Sala (3-2-1)',
    ];

    // Modelos personalizados del localStorage
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('innova_modelos_sofa') || '[]'); } catch(e) {}

    let html = '<option value="">— Seleccionar modelo base —</option>';
    html += '<optgroup label="📐 Modelos del sistema">';
    BASE.forEach(label => { html += `<option value="${label}">${label}</option>`; });
    html += '</optgroup>';

    if (custom.length > 0) {
        html += '<optgroup label="✏️ Modelos personalizados">';
        custom.forEach(m => { html += `<option value="${m.label}">${m.label}</option>`; });
        html += '</optgroup>';
    }

    sel.innerHTML = html;

    // Eliminar el input de texto libre si quedó de una versión anterior
    const txt = document.getElementById('se-modelo-base-txt');
    if (txt) txt.remove();
}


// ── Abrir gestor de modelos desde el modal de stock ───────────────────────────
function _abrirGestorDesdeStock() {
    // Guardar referencia para que al cerrar el gestor se refresque el select
    window._gestorAbiertoDesdeStock = true;
    if (typeof abrirGestorModelos === 'function') {
        abrirGestorModelos();
    } else {
        Swal.fire({ icon: 'warning', text: 'El gestor de modelos no está disponible en esta pantalla.' });
    }
}

/** Mostrar/ocultar campos según si es Estructura o Destrokes */
function _onChangeTipoEstructura() {
    const tipo = document.getElementById('se-tipo')?.value;
    const bloqEst  = document.getElementById('bloque-solo-estructura');
    const bloqDest = document.getElementById('bloque-solo-destrokes');
    const titulo   = document.getElementById('se-modal-titulo');
    if (!bloqEst || !bloqDest) return;

    if (tipo === 'destrokes') {
        bloqEst.style.display  = 'none';
        bloqDest.style.display = 'block';
        if (titulo) titulo.textContent = 'Registrar Destrokes';
    } else {
        bloqEst.style.display  = 'block';
        bloqDest.style.display = 'none';
        if (titulo) titulo.textContent = 'Registrar Estructura de Sofá';
        // Restaurar medidas si estaban ocultas
        const bloqueMed = document.getElementById('bloque-medidas');
        if (bloqueMed) bloqueMed.style.display = 'flex';
    }
}

function cerrarModalEstructura() {
    const modal = document.getElementById('modal-registro-estructura');
    if (modal) modal.style.display = 'none';
    // Limpiar foto inputs y preview al cerrar
    const cam = document.getElementById('se-foto-cam');
    const arc = document.getElementById('se-foto');
    const prev = document.getElementById('se-foto-preview-container');
    if (cam) cam.value = '';
    if (arc) arc.value = '';
    if (prev) prev.style.display = 'none';
}

function _renderListaEstructuras(lista) {
    if (!lista.length) return `
        <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
            <i class="fa-solid fa-box-open" style="font-size:2.5rem;display:block;margin-bottom:12px;"></i>
            <p style="font-weight:700;font-size:14px;color:#475569;margin:0;">Sin registros</p>
            <p style="font-size:12px;margin:4px 0 0;">Registra la primera estructura con el botón de arriba.</p>
        </div>`;
    return `<div class="estructuras-grid">` +
    lista.map(e => `
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;
                  overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="position:relative;">
          <img src="${e.foto_url || 'imagenes/sin_foto.jpg'}"
               style="width:100%;height:clamp(120px,18vw,160px);object-fit:cover;display:block;"
               onerror="this.src='imagenes/sin_foto.jpg'">
          <span style="position:absolute;top:8px;right:8px;
                       background:${e.estado==='disponible'?'#dcfce7':'#f1f5f9'};
                       color:${e.estado==='disponible'?'#15803d':'#64748b'};
                       border-radius:20px;padding:3px 10px;font-size:11px;font-weight:800;">
            ${e.estado==='disponible'?'✓ Disponible':'✓ Entregado'}
          </span>
        </div>
        <div style="padding:12px 14px;">
          <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:4px;">${e.nombre_modelo}</div>
          ${e.modelo_base ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:4px;"><i class="fa-solid fa-tag"></i> ${e.modelo_base}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;">
            <span style="font-size:11px;color:#64748b;background:#f8fafc;padding:3px 8px;border-radius:6px;">
              ${e.tipo === 'destrokes' ? '🔧 Destrokes' : '🪵 Estructura'}
            </span>
            <span style="font-size:11px;color:#475569;background:#f1f5f9;padding:3px 8px;border-radius:6px;">
              📦 Cant: <b>${e.cantidad || 1}</b>
            </span>
            ${e.medida_estandar ? `<span style="font-size:11px;color:#7c3aed;background:#f5f3ff;padding:3px 8px;border-radius:6px;font-weight:700;">⭐ Estándar</span>` : ''}
            ${e.tipo_base ? `<span style="font-size:11px;color:#0f172a;background:#e2e8f0;padding:3px 8px;border-radius:6px;">${e.tipo_base === 'zocalo' ? '🪵 Zócalo' : '🦵 Patas'}: <b>${e.medida_base_estandar ? 'Estándar' : e.medida_base + ' cm'}</b></span>` : ''}
          </div>
          ${e.ancho ? `<div style="font-size:12px;color:#475569;margin-top:6px;"><i class="fa-solid fa-ruler-combined" style="color:#94a3b8;"></i> ${e.ancho}×${e.profundidad}×${e.alto} cm</div>` : ''}
          ${e.precio ? `<div style="font-size:14px;color:#15803d;font-weight:800;margin-top:6px;">S/ ${parseFloat(e.precio).toFixed(2)}</div>` : ''}

          <!-- A9b: fechas -->
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px;">
            ${e.fecha ? `<div style="font-size:11px;color:#94a3b8;"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>Registrado: <b style="color:#64748b;">${e.fecha}</b></div>` : ''}
            ${e.fecha_entrega_chofer ? `<div style="font-size:11px;color:#94a3b8;"><i class="fa-solid fa-truck" style="margin-right:4px;color:#15803d;"></i>Entregado: <b style="color:#15803d;">${e.fecha_entrega_chofer}</b></div>` : ''}
          </div>

          <!-- A9: badge de pago + botón toggle -->
          <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <button onclick="togglePagoEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id}, ${!!e.pagado}, this)"
                style="flex:1;padding:6px 10px;border-radius:7px;font-size:11px;font-weight:800;
                       cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;
                       border:${e.pagado ? '1.5px solid #15803d' : '1.5px solid #f59e0b'};
                       background:${e.pagado ? '#dcfce7' : '#fef3c7'};
                       color:${e.pagado ? '#15803d' : '#92400e'};"
                title="${e.pagado ? 'Marcar como no pagado' : 'Marcar como pagado'}">
              ${e.pagado ? '✓ Pagado' : '⏳ No pagado'}
            </button>
            <button onclick="abrirModalEditarEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id})"
                style="padding:6px 10px;border-radius:7px;font-size:11px;font-weight:800;
                       cursor:pointer;border:1.5px solid #cbd5e1;background:#f8fafc;color:#475569;
                       display:flex;align-items:center;gap:4px;" title="Editar datos">
              ✏️ Editar
            </button>
            ${(usuarioActivo?.rol === 'Admin') ? `
            <button onclick="eliminarCardEstructura(${e.ids && e.ids.length === 1 ? e.ids[0] : e.id})"
                style="padding:6px 9px;border-radius:7px;font-size:13px;
                       cursor:pointer;border:1.5px solid #fca5a5;background:#fff1f2;color:#b91c1c;
                       display:flex;align-items:center;" title="Eliminar estructura">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>

          ${e.estado === 'disponible'
            ? `<button onclick="marcarEstructuraEntregada('${e.ids ? e.ids.join(',') : e.id}', '${(e.nombre_modelo||'').replace(/'/g,"\\'")}', this)"
                   style="width:100%;margin-top:10px;padding:9px;background:#0f172a;color:white;
                          border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                          display:flex;align-items:center;justify-content:center;gap:6px;">
                <i class="fa-solid fa-truck"></i> Entregar al chofer${e.cantidad > 1 ? ` (Máx: ${e.cantidad})` : ''}
               </button>`
            : `<div style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border-radius:8px;
                           font-size:11px;color:#15803d;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-circle-check"></i>
                <span>Chofer: <b>${e.chofer_nombre || '—'}</b></span>
               </div>`
          }
        </div>
      </div>`).join('') + `</div>`;
}


// Nota: abrirModalRegistrarEstructura y cerrarModalEstructura están definidas arriba
// con la lógica completa (carga de plantillas del catálogo)

function seSyncFoto(input) {
    const file = input.files[0];
    if (!file) return;
    // Copiar al input principal para que guardarEstructura lo encuentre
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('se-foto').files = dt.files;
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('se-foto-preview').src = e.target.result;
        document.getElementById('se-foto-nombre').textContent = file.name;
        document.getElementById('se-foto-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function guardarEstructura() {
    const nombre = document.getElementById('se-nombre').value.trim();
    const foto   = document.getElementById('se-foto-cam')?.files[0]
               || document.getElementById('se-foto').files[0];
    const tipo   = document.getElementById('se-tipo').value;

    if (!nombre) {
        return Swal.fire({ icon:'warning', title:'Falta el nombre', text:'Escribe un nombre o descripción.' });
    }
    if (!foto) {
        return Swal.fire({ icon:'warning', title:'Falta la foto', text:'Agrega una foto del lote.' });
    }

    const esDestrokes = tipo === 'destrokes';

    // Validaciones específicas por tipo
    if (!esDestrokes) {
        const modeloBase = (document.getElementById('se-modelo-base')?.value || '').trim();
        if (!modeloBase) {
            return Swal.fire({ icon:'warning', title:'Falta el modelo base',
                text:'Selecciona el modelo base. Si no está en la lista, usa ⚙️ Gestionar para agregarlo.' });
        }
    } else {
        const cant = document.getElementById('se-cantidad').value;
        if (!cant || parseInt(cant) < 1) {
            return Swal.fire({ icon:'warning', title:'Falta la cantidad',
                text:'Ingresa cuántas piezas de destrokes registras.' });
        }
    }

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const fd = new FormData();
    fd.append('nombre_modelo', nombre);
    fd.append('tipo',          tipo);
    fd.append('precio',        document.getElementById('se-precio').value || 0);
    fd.append('foto',          foto);

    if (esDestrokes) {
        // Destrokes: solo cantidad, sin medidas ni modelo base
        fd.append('cantidad',    document.getElementById('se-cantidad').value || 1);
        fd.append('ancho',       0);
        fd.append('profundidad', 0);
        fd.append('alto',        0);
        fd.append('modelo_base', '');
        fd.append('medida_estandar', 'false');
    } else {
        const modeloBase = (document.getElementById('se-modelo-base')?.value || '').trim();
        fd.append('modelo_base',     modeloBase);
        fd.append('ancho',           document.getElementById('se-ancho').value || 0);
        fd.append('profundidad',     document.getElementById('se-prof').value || 0);
        fd.append('alto',            document.getElementById('se-alto').value || 0);
        fd.append('medida_estandar', document.getElementById('se-estandar').checked ? 'true' : 'false');
        fd.append('cantidad',        document.getElementById('se-cantidad').value || 1);
        // A8: campos pata/zócalo
        const tipoBase          = document.getElementById('se-tipo-base')?.value || '';
        const medidaBaseEst     = document.getElementById('se-medida-base-estandar')?.checked || false;
        const medidaBaseValor   = document.getElementById('se-medida-base')?.value || '';

        // Validación frontend: si eligió tipo de base pero no marcó estándar ni puso medida
        if (tipoBase && !medidaBaseEst && !medidaBaseValor) {
            Swal.close();
            return Swal.fire({ icon:'warning', title:'Falta la medida de base',
                text:'Ingresa la medida de la pata/zócalo, o marca "Es una medida estándar de base".' });
        }

        fd.append('tipo_base',            tipoBase);
        // Si es estándar enviamos "0" para que el backend no rechace campo vacío
        fd.append('medida_base',          medidaBaseEst ? '0' : medidaBaseValor);
        fd.append('medida_base_estandar', medidaBaseEst ? 'true' : 'false');
    }

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras`, { method:'POST', body: fd });
        const d   = await res.json();
        if (d.exito) {
            cerrarModalEstructura();
            Swal.fire({ icon:'success', title:'¡Guardado!', timer:1400, showConfirmButton:false });
            const ctx = window._modalEstructuraCtx || {};
            if (ctx.contenedorId) {
                await _cargarContenidoStockSofa(ctx.contenedorId, ctx.esAdminCtx);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon:'error', title:'Error al guardar', text: d.error });
        }
    } catch(e) {
        Swal.fire({ icon:'error', title:'Sin conexión', text:'Verifica tu red e intenta de nuevo.' });
    }
}


// ── Función para agrupar estructuras similares en la vista de stock ──
function _groupEstructuras(lista) {
    let grouped = [];
    lista.forEach(e => {
        let existing = grouped.find(g => 
            g.nombre_modelo === e.nombre_modelo && 
            g.modelo_base === e.modelo_base &&
            g.ancho === e.ancho &&
            g.profundidad === e.profundidad &&
            g.alto === e.alto &&
            g.tipo === e.tipo &&
            g.tipo_base === e.tipo_base &&
            g.medida_base === e.medida_base &&
            g.medida_base_estandar === e.medida_base_estandar &&
            g.medida_estandar === e.medida_estandar &&
            g.estado === e.estado &&
            g.chofer_nombre === e.chofer_nombre
        );
        if (existing) {
            existing.cantidad = (existing.cantidad || 1) + (e.cantidad || 1);
            if (!existing.ids) existing.ids = [existing.id];
            existing.ids.push(e.id);
        } else {
            grouped.push({ ...e, cantidad: e.cantidad || 1, ids: [e.id] });
        }
    });
    return grouped;
}

// ── Entregar estructura al chofer (flujo del carpintero) ──────────────────────
async function marcarEstructuraEntregada(idsStr, nombreEstructura, btnEl) {
    const ids = idsStr.toString().split(',').map(id => parseInt(id.trim()));
    const maxCant = ids.length;

    // 1. Cargar lista de choferes
    let opcionesHTML = '<option value="">— Selecciona al chofer —</option>';
    try {
        const res = await apiFetch(`${API_URL}/api/usuarios/choferes`);
        const choferes = await res.json();
        if (Array.isArray(choferes) && choferes.length > 0) {
            opcionesHTML += choferes
                .map(c => `<option value="${c.nombre}">${c.nombre}</option>`)
                .join('');
        }
    } catch(e) {
        // Si falla la carga, igual se puede escribir manualmente abajo
    }

    const { value: datos, isConfirmed } = await Swal.fire({
        title: '¿Qué chofer se la llevó?',
        html: `
            <p style="font-size:13px;color:#475569;margin:0 0 14px;">
                <b>${nombreEstructura}</b><br>
                <span style="font-size:11px;">Quedará registrada como entregada.</span>
            </p>
            <select id="swal-chofer-select"
                style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                       font-size:13px;margin-bottom:10px;">
                ${opcionesHTML}
            </select>
            <input id="swal-chofer-manual" type="text"
                placeholder="O escribe el nombre si no aparece en la lista"
                style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                       font-size:13px;box-sizing:border-box;">
            ${maxCant > 1 ? `
            <div style="margin-top:14px;text-align:left;">
                <label style="font-size:12px;font-weight:700;color:#475569;">¿Cuántas unidades se lleva?</label>
                <input id="swal-cantidad-entregar" type="number" min="1" max="${maxCant}" value="${maxCant}"
                    style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;
                           font-size:13px;box-sizing:border-box;margin-top:4px;">
                <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;">Máximo disponible: ${maxCant}</p>
            </div>` : ''}
        `,
        showCancelButton: true,
        confirmButtonColor: '#15803d',
        cancelButtonColor: '#64748b',
        confirmButtonText: '✅ Confirmar entrega',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const sel    = document.getElementById('swal-chofer-select').value.trim();
            const manual = document.getElementById('swal-chofer-manual').value.trim();
            const nombre = manual || sel;
            if (!nombre) {
                Swal.showValidationMessage('Selecciona o escribe el nombre del chofer.');
                return false;
            }
            let cantidad = 1;
            if (maxCant > 1) {
                cantidad = parseInt(document.getElementById('swal-cantidad-entregar').value);
                if (isNaN(cantidad) || cantidad < 1 || cantidad > maxCant) {
                    Swal.showValidationMessage(`Ingresa una cantidad entre 1 y ${maxCant}.`);
                    return false;
                }
            
            }
            return { choferNombre: nombre, cantidad };
        }
    });

    if (!isConfirmed || !datos) return;

    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
        let exitoCount = 0;
        let lastError = null;
        const idsToDeliver = ids.slice(0, datos.cantidad);

        for (const id of idsToDeliver) {
            const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/entregar`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chofer_nombre: datos.choferNombre })
            });
            const d = await res.json();
            if (d.exito) exitoCount++;
            else lastError = d.error;
        }

        if (exitoCount > 0) {
            Swal.fire({
                icon: 'success',
                title: '¡Entregado!',
                html: `Registrado que <b>${datos.choferNombre}</b> se llevó ${exitoCount} estructura(s).`,
                timer: 2200,
                showConfirmButton: false
            });
            // Refrescar la vista
            const ctx = window._modalEstructuraCtx || {};
            const contenedorId = ctx.contenedorId || window._stockSofaContenedorActivo;
            if (contenedorId) {
                await _cargarContenidoStockSofa(contenedorId, ctx.esAdminCtx || false);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error || 'No se pudo registrar la entrega.' });
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fa-solid fa-truck"></i> Entregar al chofer'; }
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Verifica tu red e intenta de nuevo.' });
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fa-solid fa-truck"></i> Entregar al chofer'; }
    }
}

// ── A9: Toggle pago de estructura ─────────────────────────────────────────────
async function togglePagoEstructura(id, pagadoActual, btnEl) {
    const nuevoPagado = !pagadoActual;
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '...';
    }
    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/pago`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pagado: nuevoPagado })
        });
        const d = await res.json();
        if (d.exito) {
            // Refrescar la vista completa para sincronizar estados
            const ctx = window._modalEstructuraCtx || {};
            const contenedorId = window._stockSofaContenedorActivo || (ctx.contenedorId);
            if (contenedorId) {
                const esAdmin = contenedorId === 'sp-sofa-contenido';
                await _cargarContenidoStockSofa(contenedorId, esAdmin);
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: d.error });
            if (btnEl) { btnEl.disabled = false; }
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
        if (btnEl) { btnEl.disabled = false; }
    }
}

// ── Eliminar estructura desde las cards (solo Admin) ─────────────────────────
async function eliminarCardEstructura(id) {
    const conf = await Swal.fire({
        title: '¿Eliminar esta estructura?',
        text: 'Se borrará permanentemente del stock. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!conf.isConfirmed) return;
    try {
        const res  = await apiFetch(`${API_URL}/api/stock-estructuras/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { Swal.fire('Error', data.error || 'No se pudo eliminar', 'error'); return; }
        // Quitar del cache y re-renderizar
        if (window._stockEstructurasData) {
            window._stockEstructurasData = window._stockEstructurasData.filter(e => e.id !== id);
        }
        const ctx = window._modalEstructuraCtx || {};
        const contenedorId = window._stockSofaContenedorActivo || ctx.contenedorId;
        if (contenedorId) {
            const esAdmin = contenedorId === 'sp-sofa-contenido';
            await _cargarContenidoStockSofa(contenedorId, esAdmin);
        }
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch(e) {
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// ── A9: Modal de edición de estructura ───────────────────────────────────────
async function abrirModalEditarEstructura(id) {
    const data = window._stockEstructurasData || [];
    const e = data.find(x => x.id === id);
    if (!e) {
        return Swal.fire({ icon: 'warning', title: 'No encontrado', text: 'Recarga la página e intenta de nuevo.' });
    }

    let opcionesModelo = '<option value="">— Seleccionar modelo base —</option>';
    try {
        const res = await apiFetch(`${API_URL}/api/catalogo`);
        const productos = await res.json();
        if (Array.isArray(productos)) {
            productos.filter(p => p.es_plantilla).forEach(p => {
                const sel = p.nombre === e.modelo_base ? 'selected' : '';
                opcionesModelo += `<option value="${p.nombre}" ${sel}>${p.nombre}</option>`;
            });
        }
    } catch(err) {}

    const tipoBaseOpts = ['', 'patas', 'zocalo'].map(v => {
        const label = v === '' ? '— Sin base —' : (v === 'patas' ? 'Patas' : 'Zócalo');
        return `<option value="${v}" ${e.tipo_base === v ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const resultado = await Swal.fire({
        title: 'Editar estructura',
        width: 520,
        html: `
<div style="text-align:left;font-family:Jost,sans-serif;font-size:13px;">
  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">NOMBRE / DESCRIPCIÓN</label>
  <input id="ed-nombre" value="${(e.nombre_modelo||'').replace(/"/g,'&quot;')}"
      style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;margin-bottom:12px;font-size:13px;box-sizing:border-box;">

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">MODELO BASE</label>
  <select id="ed-modelo-base"
      style="width:100%;padding:8px 10px;border:1.5px solid #7c3aed;border-radius:7px;margin-bottom:12px;font-size:13px;box-sizing:border-box;">
    ${opcionesModelo}
  </select>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">MEDIDAS (cm)</label>
  <div style="display:flex;gap:6px;margin-bottom:4px;">
    <input id="ed-ancho" type="number" placeholder="Ancho" value="${e.ancho||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
    <input id="ed-prof" type="number" placeholder="Prof." value="${e.profundidad||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
    <input id="ed-alto" type="number" placeholder="Alto" value="${e.alto||''}"
        style="flex:1;padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;">
  </div>
  <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;
                margin-bottom:12px;background:#f9f5ff;padding:7px 10px;border-radius:6px;border:1px solid #ede9fe;">
    <input type="checkbox" id="ed-estandar" ${e.medida_estandar ? 'checked' : ''}
           onchange="['ed-ancho','ed-prof','ed-alto'].forEach(id=>document.getElementById(id).disabled=this.checked);">
    <span style="font-weight:500;">Es medida estándar de catálogo</span>
  </label>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">TIPO DE BASE</label>
  <select id="ed-tipo-base"
      style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;margin-bottom:8px;font-size:13px;box-sizing:border-box;"
      onchange="document.getElementById('ed-bloque-base').style.display=this.value?'block':'none';">
    ${tipoBaseOpts}
  </select>
  <div id="ed-bloque-base" style="display:${e.tipo_base ? 'block' : 'none'};margin-bottom:12px;">
    <input id="ed-medida-base" type="number" placeholder="Medida base (cm)" value="${e.medida_base||''}"
        style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;margin-bottom:6px;">
    <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;
                  background:#f9f5ff;padding:7px 10px;border-radius:6px;border:1px solid #ede9fe;">
      <input type="checkbox" id="ed-medida-base-est" ${e.medida_base_estandar ? 'checked' : ''}
             onchange="document.getElementById('ed-medida-base').disabled=this.checked;">
      <span style="font-weight:500;">Medida estándar de base</span>
    </label>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <div style="flex:1;">
      <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">PRECIO (S/)</label>
      <input id="ed-precio" type="number" step="0.01" placeholder="0.00" value="${e.precio||''}"
          style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="flex:1;">
      <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">CANTIDAD</label>
      <input id="ed-cantidad" type="number" min="1" step="1" value="${e.cantidad||1}"
          style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:13px;box-sizing:border-box;">
    </div>
  </div>

  <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px;">NUEVA FOTO (opcional)</label>
  <input type="file" id="ed-foto" accept="image/*" style="font-size:12px;">
</div>`,
        confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios',
        confirmButtonColor: '#7c3aed',
        cancelButtonText: 'Cancelar',
        showCancelButton: true,
        preConfirm: () => {
            const nombre = (document.getElementById('ed-nombre')?.value || '').trim();
            if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
            return {
                nombre_modelo:        nombre,
                modelo_base:          document.getElementById('ed-modelo-base')?.value || '',
                ancho:                document.getElementById('ed-ancho')?.value || 0,
                profundidad:          document.getElementById('ed-prof')?.value || 0,
                alto:                 document.getElementById('ed-alto')?.value || 0,
                medida_estandar:      document.getElementById('ed-estandar')?.checked || false,
                tipo_base:            document.getElementById('ed-tipo-base')?.value || '',
                medida_base:          document.getElementById('ed-medida-base')?.value || '',
                medida_base_estandar: document.getElementById('ed-medida-base-est')?.checked || false,
                precio:               document.getElementById('ed-precio')?.value || 0,
                cantidad:             document.getElementById('ed-cantidad')?.value || 1,
                foto:                 document.getElementById('ed-foto')?.files[0] || null,
            };
        }
    });

    if (!resultado.isConfirmed || !resultado.value) return;

    const captured = resultado.value;
    const fd = new FormData();
    Object.entries(captured).forEach(([k, v]) => {
        if (k === 'foto') { if (v) fd.append('foto', v); }
        else { fd.append(k, v); }
    });

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const res = await apiFetch(`${API_URL}/api/stock-estructuras/${id}/editar`, {
            method: 'PATCH',
            body: fd
        });
        const d = await res.json();
        if (d.exito) {
            Swal.fire({ icon: 'success', title: '¡Guardado!', timer: 1300, showConfirmButton: false });
            const contenedorId = window._stockSofaContenedorActivo;
            if (contenedorId) {
                await _cargarContenidoStockSofa(contenedorId, contenedorId === 'sp-sofa-contenido');
            } else {
                cargarTicketsTaller();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error al guardar', text: d.error });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Sin conexión', text: 'Intenta de nuevo.' });
    }
}

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