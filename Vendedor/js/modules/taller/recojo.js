// Taller - cola de recojo
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
