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

    if (isEnProceso) {
        // Despacho en proceso: chofer confirma entrega
        if (t.area === 'DESPACHO_CENTRAL') {
            return `<div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
                        <p style="font-size:11px; font-weight:bold; color:#475569; margin:0 0 10px 0; text-align:center;">
                            <i class="fa-solid fa-truck"></i> Chofer: <b>${t.trabajador_nombre}</b>
                        </p>
                        <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:5px;">📷 FOTO DE ENTREGA AL CLIENTE:</label>
                        <input type="file" id="foto-evid-${t.id}" accept="image/*" capture="environment" style="font-size:10px; width:100%; margin-bottom:8px;">
                        <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
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
        return `<div style="margin-top:10px; padding:10px; background:#f1f5f9; border-radius:8px; border:1px solid #cbd5e1;">
                    <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:5px;">📷 FOTO DE TRABAJO TERMINADO:</label>
                    <input type="file" id="foto-evid-${t.id}" accept="image/*" capture="environment" style="font-size:10px; width:100%; margin-bottom:8px;">
                    <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
                        style="width:100%; background:#22c55e; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-check-double"></i> MARCAR COMO TERMINADO
                    </button>
                </div>`;
    }

    // Pendiente — vista del operario que aún no inicia
    return `<p style="font-size:11px; color:#f59e0b; text-align:center; font-weight:bold; margin:8px 0 0 0;">
                <i class="fa-solid fa-clock"></i> Asignado — esperando que inicies
            </p>`;
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
        const cola = await res.json();

        if (!Array.isArray(cola) || cola.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin recojos pendientes</p>
                    <p style="font-size:13px;">Todas las estructuras terminadas ya fueron recogidas o no hay tapicería esperando.</p>
                </div>`;
            return;
        }

        // Botón PDF masivo
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; color:#c2410c; font-size:15px; font-weight:900;">
                        <i class="fa-solid fa-truck-fast"></i> ${cola.length} estructura${cola.length>1?'s':''} lista${cola.length>1?'s':''} para recoger
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Descarga el PDF de cada item o genera una hoja de recojo masiva</p>
                </div>
                <button onclick="imprimirPDFRecojoMasivo()" 
                    style="background:#c2410c; color:white; border:none; padding:12px 20px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-file-pdf"></i> PDF MASIVO (${cola.length} items)
                </button>
            </div>
            <div style="display:flex; flex-direction:column; gap:15px;">`;

        cola.forEach((c, idx) => {
            const fotoEstructura = c.foto_url && !c.foto_url.includes('sin_foto') ? c.foto_url : null;
            const fotoEvidencia  = c.foto_evidencia || null;

            html += `
            <div style="background:white; border-radius:14px; border:1px solid #fed7aa; box-shadow:0 4px 12px rgba(249,115,22,0.08); overflow:hidden;">
                <!-- Cabecera naranja -->
                <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5); padding:14px 18px; border-bottom:2px solid #fed7aa; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span style="font-size:10px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:1px;">${c.area.replace(/_/g,' ')} · Terminado el ${c.fecha_fin}</span>
                        <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${c.producto}</h4>
                        <p style="margin:0; font-size:12px; color:#64748b;">
                            <b>Ref:</b> ${c.codigo_venta} &nbsp;|&nbsp; <b>Cliente:</b> ${c.cliente}
                            ${c.direccion ? `&nbsp;|&nbsp; <b>Entrega:</b> ${c.fecha_entrega}` : ''}
                        </p>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">
                            <i class="fa-solid fa-user-gear"></i> <b>Carpintero:</b> ${c.operario} &nbsp;
                            <i class="fa-solid fa-couch"></i> <b>Tapicero:</b> <span style="color:#0369a1; font-weight:bold;">${c.tapicero}</span>
                        </p>
                    </div>
                    <button onclick="imprimirPDFRecojoUnitario(${idx})" 
                        data-recojo-idx="${idx}"
                        style="background:#f97316; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                        <i class="fa-solid fa-file-pdf"></i> PDF Unitario
                    </button>
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

        html += `</div>`;
        contenedor.innerHTML = html;

        // Guardar los datos en window para que los PDF los lean
        window._colaRecojoData = cola;

    } catch(e) {
        console.error('Error cargando cola de recojo:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar la cola de recojo.</p>`;
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
                        <img src="${c.foto_url}" class="foto-img" onerror="this.parentElement.style.display='none'">
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

    const esAdmin      = ['Admin', 'Jefe_Taller', 'JEFE_TALLER'].includes(usuarioActivo.rol);
    const esOperario   = usuarioActivo.rol === 'Operario';

    // ── TABS: solo para Operario y Jefe viendo sus tareas ──
    let tabsHeader = document.getElementById('tabs-taller-header');
    if (!tabsHeader) {
        tabsHeader = document.createElement('div');
        tabsHeader.id = 'tabs-taller-header';
        tabsHeader.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;';
        contenedor.parentNode.insertBefore(tabsHeader, contenedor);
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
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // Si está en vista RECOJO, mostrar esa sección y salir
        if (filtroAdminTaller === 'recojo') {
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojo(contenedor);
            return;
        }

        // Si está en vista ÓRDENES POR PEDIDO, mostrar esa sección y salir
        if (filtroAdminTaller === 'ordenes') {
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando órdenes de producción...</p>';
            await cargarOrdenesProduccion(contenedor);
            return;
        }
    } else {
        // Operario / Jefe de área: tabs Pendientes / Terminados
        tabsHeader.innerHTML = `
            <button onclick="filtroTaller='Pendientes'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Pendientes' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-clock"></i> MIS TAREAS
            </button>
            <button onclick="filtroTaller='Terminado'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Terminado' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-circle-check"></i> TRABAJOS TERMINADOS
            </button>`;
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
            // Admin ve:
            // 1. Tickets SIN asignar (Pendiente sin trabajador) → para asignar
            // 2. Tickets ya asignados pero no terminados → para reasignar si es necesario
            // 3. DESPACHO_CENTRAL siempre → gestión de choferes
            ticketsFiltrados = tickets.filter(t =>
                t.estado !== 'Terminado' ||
                t.area === 'DESPACHO_CENTRAL'
            );
        } else if (esOperario) {
            // Operario: solo los asignados a él
            ticketsFiltrados = tickets.filter(t => Number(t.trabajador) === Number(usuarioActivo.id));
            // Luego aplica filtro de tab
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado !== 'Terminado');
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Terminado');
            }
        } else {
            // Jefe de taller: ve todos, con tabs
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado !== 'Terminado');
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Terminado');
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

        contenedor.style.gridTemplateColumns = '1fr';
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
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:15px;">`;

            listaTickets.forEach(t => {
                const isBloqueado = t.estado === 'Bloqueado';
                const isTerminado = t.estado === 'Terminado';
                const isEnProceso = t.estado === 'En Proceso';
                const isPendiente = t.estado === 'Pendiente';

                const specsB64   = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
                let colorBorde   = isBloqueado ? '#94a3b8' : (isTerminado ? '#22c55e' : (isEnProceso ? '#3b82f6' : '#f59e0b'));
                let bgCard       = isBloqueado ? '#f1f5f9' : '#ffffff';
                let opacidad     = isBloqueado ? '0.55' : '1';

                let badgeBg  = isBloqueado ? '#e2e8f0' : (isTerminado ? '#dcfce7' : (isEnProceso ? '#dbeafe' : '#fef3c7'));
                let badgeCol = isBloqueado ? '#64748b' : (isTerminado ? '#166534' : (isEnProceso ? '#1e40af' : '#b45309'));
                let badgeTxt = isBloqueado ? '🔒 BLOQUEADO' : (isTerminado ? '✅ TERMINADO' : (isEnProceso ? '🔵 EN PROCESO' : '🟡 PENDIENTE'));

                // Asignado a quién
                const asignadoA = t.trabajador_nombre && t.trabajador_nombre !== 'Sin asignar'
                    ? `<p style="font-size:10px; color:#64748b; margin:4px 0 12px 0;"><i class="fa-solid fa-user"></i> ${t.trabajador_nombre}</p>`
                    : `<p style="font-size:10px; color:#f59e0b; margin:4px 0 12px 0;"><i class="fa-solid fa-user-clock"></i> Sin asignar</p>`;

                // Escapar producto para evitar romper HTML con comillas/apóstrofes
                const productoSafe = (t.producto || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                const fotoBtoa    = (t.foto||'').replace(/"/g,'&quot;');

                html += `
                <div style="background:${bgCard}; border-left:5px solid ${colorBorde}; border-radius:8px; padding:15px; opacity:${opacidad}; box-shadow:0 1px 3px rgba(0,0,0,0.08); transition:0.2s;">
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
                        <i class="fa-solid fa-eye"></i> Ver Ficha
                    </button>
                    ${renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin)}
                </div>`;
            });

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;

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
        .map(l => `<div style="padding:5px 0; border-bottom:1px solid #e2e8f0; font-size:12px;">${l}</div>`)
        .join('');

    // ── Foto del mueble ──
    const fotoMueble = foto
        ? `<img src="${foto}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; margin-bottom:12px;" onerror="this.style.display='none'">`
        : '';

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
                galeria.innerHTML = data.map(item => `
                    <div style="text-align:center; width:90px;">
                        <img src="${item.foto_url}" alt="${item.sku}"
                            style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${item.tipo === 'tela' ? '#93c5fd' : '#c4b5fd'}; display:block; margin:0 auto 4px;"
                            onerror="this.src='imagenes/sin_foto.jpg'">
                        <span style="font-size:9px; font-weight:900; color:${item.tipo === 'tela' ? '#1e40af' : '#5b21b6'}; display:block;">${item.sku}</span>
                        <span style="font-size:9px; color:#64748b; display:block; line-height:1.2;">${item.nombre}</span>
                    </div>
                `).join('');
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

                    <label style="font-size:10px; font-weight:900; color:#475569; display:block; margin-bottom:4px;">📷 FOTO DEL MATERIAL CORTADO *</label>
                    <input type="file" id="foto-derivar" accept="image/*" capture="environment"
                        style="width:100%; padding:8px; border:2px dashed #f97316; border-radius:8px; font-size:12px; margin-bottom:14px; box-sizing:border-box;">

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
            Swal.fire('¡Trabajo Completado!', 'El ticket fue marcado como Terminado.', 'success');
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

  // DESPUÉS:
        setHtml('contenedor-telas-admin',    telas.map(i=>dibujarTarjetaMaterial(i,'tela')).join(''));
        setHtml('contenedor-cojines-admin',  cojines.map(i=>dibujarTarjetaMaterial(i,'cojin')).join(''));
        setHtml('contenedor-tableros-admin', tableros.map(i=>dibujarTarjetaMaterial(i,'tablero')).join(''));
        setHtml('contenedor-metal-admin',    metal.map(i=>dibujarTarjetaMaterial(i, i.categoria==='BASE'?'base':'base-comedor')).join(''));
        setHtml('contenedor-madera-admin',   madera.map(i=>dibujarTarjetaMaterial(i, i.categoria==='SILLA'?'silla':'butaca')).join(''));

    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}
/* ================================================================= */
/* --- LÓGICA DE MESA DE CENTRO Y CONSOLA --- */
/* ================================================================= */
async function cargarGestorAprobacion() {
    const contenedor = document.getElementById('lista-aprobacion-pendientes');
    if (!contenedor) return;
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
            'Pendiente':  { bg:'#fef3c7', color:'#b45309', icon:'🟡' },
            'Bloqueado':  { bg:'#e2e8f0', color:'#64748b', icon:'🔒' },
            'En Proceso': { bg:'#dbeafe', color:'#1e40af', icon:'🔵' },
            'Terminado':  { bg:'#dcfce7', color:'#166534', icon:'✅' },
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
        contenedor.style.gridTemplateColumns = '1fr';

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
        confirmButtonColor: '#0f172a',
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