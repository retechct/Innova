// Taller - ficha tecnica y asignaciones
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

        // Etiqueta de carga: 🟢 libre, 🟡 algo cargado, 🔴 muy cargado
        const etiquetaCarga = (pendientes) => {
            const n = Number(pendientes) || 0;
            if (n === 0) return `🟢 libre`;
            if (n <= 3)  return `🟡 ${n} pendiente${n !== 1 ? 's' : ''}`;
            return `🔴 ${n} pendientes`;
        };

        // Construimos HTML de select manualmente para mejor UX
        let selectHtml = `<select id="swal-select-trabajador" class="swal2-input" style="width:100%; margin:0; padding:10px; font-size:14px; border-radius:8px;">
            <option value="">-- Selecciona un trabajador --</option>`;

        if (operariosArea.length > 0) {
            selectHtml += `<optgroup label="✅ Operarios del área ${areaTicket.replace(/_/g,' ')}">`;
            operariosArea
                .slice()
                .sort((a, b) => (a.pendientes || 0) - (b.pendientes || 0)) // menos cargados primero
                .forEach(u => {
                    selectHtml += `<option value="${u.id}">${u.nombre} — ${etiquetaCarga(u.pendientes)}</option>`;
                });
            selectHtml += `</optgroup>`;
        }
        if (otrosUsuarios.length > 0) {
            selectHtml += `<optgroup label="👔 Jefes / Admins (respaldo)">`;
            otrosUsuarios.forEach(u => {
                selectHtml += `<option value="${u.id}">${u.nombre} (${u.rol}) — ${etiquetaCarga(u.pendientes)}</option>`;
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


