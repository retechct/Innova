// App - logistica externa y proveedores
/* --- LOGÍSTICA EXTERNA (PROCURA) --- */
/* ================================================================= */
// ── Helper PDF: abre el PDF usando el visor de Google Docs como fallback
// Evita ERR_INVALID_RESPONSE que produce fl_attachment en Cloudinary raw
function _abrirPDF(urlPdf, logisticaId) {
    if (!urlPdf && !logisticaId) return;
    // Si tenemos el id de logística, usamos el proxy Flask que sirve el PDF
    // con Content-Type correcto (Cloudinary devuelve ERR_INVALID_RESPONSE directo).
    if (logisticaId) {
        window.open(`${API_URL}/api/logistica/${logisticaId}/pdf-oc`, '_blank');
        return;
    }
    // Fallback: abrir la URL de Cloudinary directo (puede no funcionar en todos los browsers)
    window.open(urlPdf, '_blank');
}
// URL para compartir por WhatsApp — usamos el proxy Flask también,
// así el proveedor puede abrir el PDF desde el link del mensaje.
function _urlPdfPublica(urlPdf, logisticaId) {
    if (logisticaId) {
        return `${API_URL}/api/logistica/${logisticaId}/pdf-oc`;
    }
    return urlPdf || '';
}
// ── Helper: normalizar número peruano para wa.me ──────────────────────────────
function _normalizarTelWA(raw) {
    if (!raw) return '';
    // Quitar espacios, guiones, paréntesis, puntos
    let tel = String(raw).replace(/[\s\-\(\)\.]/g, '');
    // Quitar el + inicial si lo tiene
    if (tel.startsWith('+')) tel = tel.slice(1);
    // Si ya empieza con 51 y tiene 11 dígitos → correcto
    if (/^51\d{9}$/.test(tel)) return tel;
    // Si empieza con 51 y tiene más o menos → limpiar el prefijo y volver a agregar
    if (tel.startsWith('51')) tel = tel.slice(2);
    // Quitar ceros al inicio que sobren
    tel = tel.replace(/^0+/, '');
    // Solo números peruanos de 9 dígitos son válidos
    if (!/^\d{9}$/.test(tel)) return '';
    return '51' + tel;
}

// ── Foto(s) del insumo en Logística Externa ───────────────────────────────
// Un requerimiento puede tener hasta 2 fotos: la del insumo del maestro
// (la que sale del buscador inteligente al elegir la parte del catálogo)
// y la foto propia del ítem de venta (la que se sube aparte). Si el backend
// manda las dos y son distintas, se muestra un mini-carrusel; si solo hay
// una, se muestra esa; si no hay ninguna, el ícono de "sin foto" de siempre.
const _logCarouselIdx = {};

function _logFotosArray(item) {
    if (Array.isArray(item.fotos) && item.fotos.length) return item.fotos;
    // Compatibilidad con datos antiguos que solo traían foto_url
    return item.foto_url ? [item.foto_url] : [];
}

// Etiquetas para cada foto del array de _logFotosArray, en el MISMO orden
// en que el backend arma "fotos" (ver obtener_logistica en routes_produccion.py:
// primero foto_maestro, luego foto_item; si son iguales, se deduplica a 1 sola).
// Sin esto, dos fotos en el carrusel no dicen cuál es la tela/insumo y cuál
// es el mueble al que pertenece — que es justamente lo que se confunde
// cuando varias líneas de "Requerimientos" usan la misma tela.
function _logFotoLabels(item) {
    const hayMaestro = !!item.foto_maestro;
    const hayItem     = !!item.foto_item;
    const sonIguales   = hayMaestro && hayItem && item.foto_maestro === item.foto_item;

    if (hayMaestro && hayItem && !sonIguales) {
        return ['Insumo', item.producto_item ? `Mueble: ${item.producto_item}` : 'Mueble'];
    }
    if (hayMaestro || sonIguales) {
        return ['Insumo'];
    }
    if (hayItem) {
        return [item.producto_item ? `Mueble: ${item.producto_item}` : 'Mueble'];
    }
    return [];
}

window._logCarouselNav = function(idBase, fotos, labels, dir) {
    if (!fotos || fotos.length < 2) return;
    _logCarouselIdx[idBase] = ((_logCarouselIdx[idBase] || 0) + dir + fotos.length) % fotos.length;
    const idx = _logCarouselIdx[idBase];
    const img = document.getElementById(`${idBase}-img`);
    const dot = document.getElementById(`${idBase}-dot`);
    if (img) img.src = fotos[idx];
    if (dot) dot.textContent = `${(labels && labels[idx]) || ''} · ${idx + 1}/${fotos.length}`;
};

function _logFotoHTML(item, size, idPrefix) {
    const fotos  = _logFotosArray(item);
    const labels = _logFotoLabels(item);
    const idBase = `${idPrefix}-${item.id}`;
    const titulo = (item.insumo || '').replace(/'/g, "\\'");

    if (fotos.length === 0) {
        return `<div style="width:${size}px;height:${size}px;border-radius:6px;background:#f1f5f9;
                      display:flex;align-items:center;justify-content:center;color:#94a3b8;
                      flex-shrink:0;font-size:${Math.round(size * 0.38)}px;border:1px solid #e2e8f0;">
                      <i class="fa-solid fa-image"></i></div>`;
    }

    if (fotos.length === 1) {
        const etiqueta = labels[0] || '';
        return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
            <img id="${idBase}-img" src="${fotos[0]}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
               onclick="event.stopPropagation();_invLightbox(this.src,'${titulo}')"
               title="${etiqueta ? etiqueta + ' — ' : ''}Ver foto en grande"
               style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in;
                      border:1px solid #e2e8f0;">
            ${etiqueta ? `<span style="position:absolute;bottom:1px;left:1px;right:1px;background:rgba(0,0,0,0.55);
                  color:white;font-size:7px;font-weight:700;text-align:center;border-radius:0 0 5px 5px;
                  padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${etiqueta}</span>` : ''}
        </div>`;
    }

    // 2+ fotos → mini carrusel (insumo + foto del mueble), con etiqueta
    // debajo indicando cuál de las dos se está viendo.
    const fotosJSON  = JSON.stringify(fotos).replace(/"/g, '&quot;');
    const labelsJSON = JSON.stringify(labels).replace(/"/g, '&quot;');
    const btn = Math.max(15, Math.round(size * 0.36));
    return `<div id="${idBase}" style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;
                  border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
        <img id="${idBase}-img" src="${fotos[0]}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
             onclick="event.stopPropagation();_invLightbox(this.src,'${titulo}')"
             title="Ver foto en grande"
             style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;">
        <button onclick="event.stopPropagation();_logCarouselNav('${idBase}', ${fotosJSON}, ${labelsJSON}, -1)"
            style="position:absolute;left:1px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.45);
                   color:white;border:none;border-radius:50%;width:${btn}px;height:${btn}px;cursor:pointer;
                   font-size:${Math.round(btn * 0.6)}px;line-height:1;padding:0;
                   display:flex;align-items:center;justify-content:center;">‹</button>
        <button onclick="event.stopPropagation();_logCarouselNav('${idBase}', ${fotosJSON}, ${labelsJSON}, 1)"
            style="position:absolute;right:1px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.45);
                   color:white;border:none;border-radius:50%;width:${btn}px;height:${btn}px;cursor:pointer;
                   font-size:${Math.round(btn * 0.6)}px;line-height:1;padding:0;
                   display:flex;align-items:center;justify-content:center;">›</button>
        <span id="${idBase}-dot" style="position:absolute;bottom:1px;left:1px;right:1px;
              background:rgba(0,0,0,0.55);color:white;font-size:7px;font-weight:700;text-align:center;
              border-radius:0 0 5px 5px;padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${labels[0] || ''} · 1/${fotos.length}</span>
    </div>`;
}

async function cargarLogisticaExterna() {
    const tabla = document.getElementById('tabla-logistica-externa');
    if (!tabla) return;
    tabla.innerHTML = `<div style="text-align:center;padding:30px;color:#64748b;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:10px;font-weight:600;">Cargando requerimientos...</p>
    </div>`;

    try {
        const [resLog, resProv] = await Promise.all([
            apiFetch(`${API_URL}/api/logistica`),
            apiFetch(`${API_URL}/api/proveedores`)
        ]);
        const items       = await resLog.json();
        const proveedores = await resProv.json();

        const ESTADOS_COMPLETADOS = ['Recibido', 'Cancelado'];
        const itemsActivos     = items.filter(i => !ESTADOS_COMPLETADOS.includes(i.estado));
        const itemsCompletados = items.filter(i =>  ESTADOS_COMPLETADOS.includes(i.estado));

        if (!items.length) {
            tabla.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;">
                <i class="fa-solid fa-box-open" style="font-size:2.5rem;opacity:0.4;"></i>
                <p style="margin-top:12px;font-weight:700;">Sin requerimientos externos activos.</p>
                <p style="font-size:12px;">Los insumos de proveedores que se necesiten para pedidos aparecerán aquí.</p>
            </div>`;
            return;
        }

        const coloresEstado = {
            'POR_PEDIR':           { bg: '#fef9c3', color: '#854d0e' },
            'Pendiente':           { bg: '#fef9c3', color: '#854d0e' },
            'Cotizado':            { bg: '#dbeafe', color: '#1e40af' },
            'Cotizacion Enviada':  { bg: '#e0f2fe', color: '#0369a1' },
            'Cotizacion Recibida': { bg: '#fef3c7', color: '#b45309' },
            'Confirmado':          { bg: '#dcfce7', color: '#166534' },
            'Orden Enviada':       { bg: '#f3e8ff', color: '#7e22ce' },
            'En Tránsito':         { bg: '#ede9fe', color: '#5b21b6' },
            'Pagado':              { bg: '#fef3c7', color: '#92400e' },
            'Recibido':            { bg: '#f0fdf4', color: '#15803d' },
            'Cancelado':           { bg: '#fee2e2', color: '#991b1b' },
        };

        const esAdmin = usuarioActivo && ['Admin', 'Jefe_Taller'].includes(usuarioActivo.rol);

        // ── Foto grande con carrusel para la parte superior de la tarjeta ──
        // Igual que _logFotoHTML pero a ancho completo (100%) con relación de
        // aspecto fija, flechas más visibles y contador — pensado para verse
        // bien como cabecera de una tarjeta de catálogo, no como miniatura.
        function _logFotoHTMLCard(item, idPrefix) {
            const fotos  = _logFotosArray(item);
            const labels = _logFotoLabels(item);
            const idBase = `${idPrefix}-${item.id}`;
            const titulo = (item.insumo || '').replace(/'/g, "\\'");

            if (fotos.length === 0) {
                return `<div style="width:100%;aspect-ratio:4/3;border-radius:12px 12px 0 0;background:#f1f5f9;
                              display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:2.2rem;">
                              <i class="fa-solid fa-image"></i></div>`;
            }

            const fotosJSON  = JSON.stringify(fotos).replace(/"/g, '&quot;');
            const labelsJSON = JSON.stringify(labels).replace(/"/g, '&quot;');
            const controles = fotos.length > 1 ? `
                <button onclick="event.stopPropagation();_logCarouselNav('${idBase}', ${fotosJSON}, ${labelsJSON}, -1)"
                    style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);
                           color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;
                           font-size:16px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;">‹</button>
                <button onclick="event.stopPropagation();_logCarouselNav('${idBase}', ${fotosJSON}, ${labelsJSON}, 1)"
                    style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);
                           color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;
                           font-size:16px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;">›</button>` : '';

            return `<div id="${idBase}" style="position:relative;width:100%;aspect-ratio:4/3;overflow:hidden;
                          border-radius:12px 12px 0 0;background:#f1f5f9;">
                <img id="${idBase}-img" src="${fotos[0]}" onerror="this.onerror=null;this.src='imagenes/sin_foto.jpg'"
                     onclick="event.stopPropagation();_invLightbox(this.src,'${titulo}')"
                     title="Ver foto en grande"
                     style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;display:block;">
                ${controles}
                <span id="${idBase}-dot" style="position:absolute;bottom:6px;right:8px;background:rgba(0,0,0,0.6);
                      color:white;font-size:10px;font-weight:700;border-radius:12px;padding:2px 9px;">
                      ${labels[0] || ''}${labels[0] ? ' · ' : ''}1/${fotos.length}</span>
            </div>`;
        }

        const _renderCardLogistica = (item, proveedores, esAdmin, coloresEstado) => {
            const c = coloresEstado[item.estado] || { bg: '#f1f5f9', color: '#475569' };
            const fotoHTML = _logFotoHTMLCard(item, 'logc');
            return `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;
                        box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;flex-direction:column;">
                ${fotoHTML}
                <div style="padding:14px;display:flex;flex-direction:column;flex:1;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
                        <span style="font-weight:900;color:#d97706;font-size:13px;">#${escapeHTML(item.codigo_venta)}</span>
                        <span style="background:${c.bg};color:${c.color};padding:3px 9px;border-radius:20px;font-weight:800;font-size:10px;white-space:nowrap;">${escapeHTML(item.estado)}</span>
                    </div>
                    <div style="font-weight:900;font-size:14px;line-height:1.3;">${escapeHTML(item.insumo)}</div>
                    ${item.sku ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">${escapeHTML(item.sku)}</div>` : ''}
                    ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${escapeHTML(item.detalle_insumo)}</div>` : ''}
                    ${item.producto_item ? `<div style="font-size:11px;color:#0369a1;margin-top:3px;font-weight:700;"><i class="fa-solid fa-couch" style="font-size:10px;"></i> ${escapeHTML(item.producto_item)}</div>` : ''}

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin:10px 0;">
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Proveedor</div>
                            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(item.proveedor)}</div>
                            ${item.proveedor_informal ? `<div style="font-size:10px;color:#64748b;margin-top:1px;"><i class="fa-solid fa-phone" style="font-size:9px;"></i> ${escapeHTML(item.proveedor_informal)}</div>` : ''}
                        </div>
                        ${item.precio_cotizado ? `
                        <div style="background:#fef9c3;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;">Precio</div>
                            <div style="font-weight:900;color:#92400e;">S/ ${item.precio_cotizado.toFixed(2)}</div>
                        </div>` : `
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Precio</div>
                            <div style="color:#cbd5e1;font-weight:700;">—</div>
                        </div>`}
                        ${item.fecha_entrega_proveedor ? `
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">F. Entrega</div>
                            <div style="font-weight:600;">${escapeHTML(item.fecha_entrega_proveedor)}</div>
                        </div>` : ''}
                        ${item.cantidad ? `
                        <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Cantidad</div>
                            <div style="font-weight:600;">${escapeHTML(item.cantidad)} ${escapeHTML(item.unidad || '')}</div>
                        </div>` : ''}
                        ${item.tipo_gestion && item.tipo_gestion !== 'Externo' ? `
                        <div style="background:${item.tipo_gestion === 'Informal' ? '#fef9c3' : '#dcfce7'};border-radius:6px;padding:6px 8px;">
                            <div style="font-size:10px;color:${item.tipo_gestion === 'Informal' ? '#854d0e' : '#166534'};font-weight:700;text-transform:uppercase;">Gestión</div>
                            <div style="font-weight:700;color:${item.tipo_gestion === 'Informal' ? '#854d0e' : '#166534'};">${item.tipo_gestion === 'Informal' ? '📞 Informal' : '🔨 Interno'}</div>
                        </div>` : ''}
                    </div>

                    ${item.url_comprobante_pago ? `
                    <a href="${escapeAttr(item.url_comprobante_pago)}" target="_blank" rel="noopener"
                       style="font-size:11px;font-weight:700;color:#1d4ed8;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:8px;">
                       <i class="fa-solid fa-receipt"></i> Ver comprobante de pago
                    </a>` : ''}

                    <div style="flex:1;"></div>
                    ${esAdmin ? `
                    <button onclick="_abrirEditarLogistica(${JSON.stringify(item).replace(/"/g,'&quot;')}, ${JSON.stringify(proveedores).replace(/"/g,'&quot;')})"
                            style="width:100%;background:#0f172a;color:white;border:none;margin-top:4px;
                                   padding:9px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">
                        <i class="fa-solid fa-pen"></i> Gestionar etapa
                    </button>` : ''}
                </div>
            </div>`;
        };

        // ── Filtrado reactivo en memoria ────────────────────────────
        const FLUJO_LOGISTICA = [
            { id:'resolver', titulo:'1. Resolver', icono:'fa-clipboard-question', color:'#854d0e', bg:'#fffbeb',
              desc:'Definir proveedor, cantidad y si se compra, se consigue informal o se fabrica interno.',
              match:i => ['POR_PEDIR','Pendiente',null,undefined,''].includes(i.estado) },
            { id:'cotizar', titulo:'2. Cotizar', icono:'fa-comments-dollar', color:'#0369a1', bg:'#eff6ff',
              desc:'Cotizacion enviada o respondida. Si ya hay precio, no se vuelve a cotizar.',
              match:i => ['Cotizacion Enviada','Cotizacion Recibida'].includes(i.estado) },
            { id:'comprar', titulo:'3. Comprar', icono:'fa-file-invoice-dollar', color:'#166534', bg:'#f0fdf4',
              desc:'Cotizacion aprobada: generar orden de compra o pedido al proveedor.',
              match:i => i.estado === 'Cotizado' },
            { id:'pagar', titulo:'4. Pagar / seguir', icono:'fa-receipt', color:'#7e22ce', bg:'#faf5ff',
              desc:'Orden enviada: subir comprobante, confirmar transito o mandar a cola de recojo.',
              match:i => i.estado_distribucion !== 'Recogido'
                  && ['Orden Enviada','Confirmado','En Tránsito','Pagado','Listo para Recojo'].includes(i.estado) },
            { id:'recibir', titulo:'5. Recibir / juntar', icono:'fa-box-circle-check', color:'#0f766e', bg:'#f0fdfa',
              desc:'Material listo para entrar al contrato: recibir, distribuir o liberar despacho.',
              match:i => i.estado_distribucion === 'Recogido' },
        ];
        let _filtroBusqueda = '';

        const _renderCarrilesLogistica = (lista) => {
            const asignados = new Set();
            const carrilesHTML = FLUJO_LOGISTICA.map(carril => {
                const itemsCarril = lista.filter(i => {
                    if (asignados.has(i.id)) return false;
                    const ok = carril.match(i);
                    if (ok) asignados.add(i.id);
                    return ok;
                });
                return `
                <section style="background:${carril.bg};border:1px solid #e2e8f0;border-radius:10px;min-width:280px;overflow:hidden;">
                    <div style="padding:12px 12px 10px;border-bottom:1px solid rgba(15,23,42,.08);">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                            <i class="fa-solid ${carril.icono}" style="color:${carril.color};"></i>
                            <h4 style="margin:0;font-size:13px;color:#0f172a;font-weight:900;">${carril.titulo}</h4>
                            <span style="margin-left:auto;background:white;color:${carril.color};border:1px solid rgba(15,23,42,.08);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:900;">${itemsCarril.length}</span>
                        </div>
                        <p style="margin:0;color:#64748b;font-size:10px;line-height:1.35;">${carril.desc}</p>
                    </div>
                    <div style="padding:10px;display:flex;flex-direction:column;gap:10px;">
                        ${itemsCarril.length
                            ? itemsCarril.map(i => _renderCardLogistica(i, proveedores, esAdmin, coloresEstado)).join('')
                            : `<div style="background:rgba(255,255,255,.65);border:1px dashed #cbd5e1;border-radius:8px;padding:16px;text-align:center;color:#94a3b8;font-size:11px;font-weight:700;">Sin items</div>`}
                    </div>
                </section>`;
            }).join('');

            const sinCarril = lista.filter(i => !asignados.has(i.id));
            const extraHTML = sinCarril.length ? `
                <section style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;min-width:280px;overflow:hidden;">
                    <div style="padding:12px;border-bottom:1px solid #e2e8f0;">
                        <h4 style="margin:0;font-size:13px;color:#0f172a;font-weight:900;"><i class="fa-solid fa-layer-group"></i> Otros estados</h4>
                        <p style="margin:5px 0 0;color:#64748b;font-size:10px;">Estados antiguos o excepciones que deben revisarse.</p>
                    </div>
                    <div style="padding:10px;display:flex;flex-direction:column;gap:10px;">
                        ${sinCarril.map(i => _renderCardLogistica(i, proveedores, esAdmin, coloresEstado)).join('')}
                    </div>
                </section>` : '';

            return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;">${carrilesHTML}${extraHTML}</div>`;
        };

        const _aplicarFiltros = () => {
            const filtrados = itemsActivos.filter(i => {
                const q = _filtroBusqueda.toLowerCase();
                const matchTexto   = !q ||
                    (i.codigo_venta   || '').toLowerCase().includes(q) ||
                    (i.insumo         || '').toLowerCase().includes(q) ||
                    (i.proveedor      || '').toLowerCase().includes(q) ||
                    (i.sku            || '').toLowerCase().includes(q) ||
                    (i.producto_item  || '').toLowerCase().includes(q);
                return matchTexto;
            });

            // Re-renderiza solo la sección activos
            const cont = document.getElementById('log-activos-body');
            if (!cont) return;
            if (filtrados.length === 0) {
                cont.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8;background:#f8fafc;border-radius:10px;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>
                    <span style="font-weight:700;">Sin resultados para ese filtro</span>
                </div>`;
                return;
            }
            cont.innerHTML = _renderCarrilesLogistica(filtrados);
        };

        window._logFiltrarTexto  = (q)      => { _filtroBusqueda = q;    _aplicarFiltros(); };

        let html = `
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;align-items:center;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:16px;">Requerimientos</h3>
            <button onclick="abrirModalLote()" style="background:#25D366;color:white;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">
                <i class="fa-solid fa-list-check"></i> Cotizar por lote
            </button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <input oninput="_logFiltrarTexto(this.value)" placeholder="🔍 Pedido, insumo, mueble o proveedor…"
                style="margin-left:auto;border:1.5px solid #e2e8f0;border-radius:20px;
                       padding:5px 14px;font-size:12px;outline:none;min-width:200px;max-width:260px;"
                onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
        </div>`;

        // ── Sección 1: Activos (requieren atención) ───────────────
        html += `<div id="log-activos-body" style="margin-bottom:24px;">`;
        if (itemsActivos.length === 0) {
            html += `<div style="text-align:center;padding:24px;color:#94a3b8;background:#f8fafc;border-radius:10px;">
                <i class="fa-solid fa-circle-check" style="font-size:1.8rem;color:#86efac;display:block;margin-bottom:8px;"></i>
                <span style="font-weight:700;">Sin requerimientos pendientes</span>
            </div>`;
        } else {
            html += _renderCarrilesLogistica(itemsActivos);
        }
        html += `</div>`;

        // ── Sección 2: Completados (colapsable) ───────────────────
        if (itemsCompletados.length > 0) {
            // 1. Agrupar por código de venta
            const groupedCompletados = itemsCompletados.reduce((acc, item) => {
                const key = item.codigo_venta;
                if (!acc[key]) {
                    acc[key] = {
                        codigo_venta: key,
                        items: [],
                        precio_total: 0,
                        proveedor_resumen: new Set(),
                        todos_recibidos: true
                    };
                }
                acc[key].items.push(item);
                acc[key].precio_total += (item.precio_cotizado || 0);
                if (item.estado !== 'Recibido') acc[key].todos_recibidos = false;
                acc[key].proveedor_resumen.add(item.proveedor);
                return acc;
            }, {});

            const gruposArray = Object.values(groupedCompletados);
            const idCollapse = 'log-completados-body';

            html += `
            <div style="margin-top:8px;">
                <button onclick="const b=document.getElementById('${idCollapse}');const ic=this.querySelector('i');
                    b.style.display=b.style.display==='none'?'block':'none';
                    ic.className=b.style.display==='none'?'fa-solid fa-chevron-right':'fa-solid fa-chevron-down';"
                    style="width:100%;display:flex;align-items:center;gap:8px;background:#f1f5f9;border:none;
                           border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;color:#475569;text-align:left;">
                    <i class="fa-solid fa-chevron-right"></i>
                    <i class="fa-solid fa-circle-check" style="color:#86efac;"></i>
                    Completados / Recibidos
                    <span style="margin-left:auto;background:#d1fae5;color:#065f46;border-radius:20px;
                                 padding:2px 10px;font-size:11px;font-weight:800;">${gruposArray.length}</span>
                </button>
                <div id="${idCollapse}" style="display:none;margin-top:8px;">`;

            html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 260px), 1fr));gap:12px;opacity:.8;">
                ${gruposArray.map((grupo, idx) => {
                    const provs = [...grupo.proveedor_resumen];
                    const provLabel = provs.length > 1 ? 'Múltiples' : provs[0] || 'N/A';
                    const estadoLabel = grupo.todos_recibidos ? 'Recibido' : 'Parcial';
                    const c = coloresEstado[estadoLabel] || coloresEstado['Recibido'];
                    const subId = `log-comp-${idx}`;
                    return `
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                            <div style="font-weight:900;font-size:14px;color:#d97706;">#${escapeHTML(grupo.codigo_venta)}</div>
                            <span style="background:${c.bg};color:${c.color};padding:3px 9px;border-radius:20px;font-weight:800;font-size:10px;">${escapeHTML(estadoLabel)}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px;">
                            <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;">PROVEEDOR</div><div style="font-weight:600;">${escapeHTML(provLabel)}</div></div>
                            <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;">TOTAL</div><div style="font-weight:900;color:#166534;">S/ ${grupo.precio_total.toFixed(2)}</div></div>
                        </div>
                        <button onclick="document.getElementById('${subId}').style.display = document.getElementById('${subId}').style.display === 'none' ? 'block' : 'none';"
                                style="width:100%;background:#f1f5f9;color:#475569;border:none;padding:8px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                            Ver ${grupo.items.length} insumos <i class="fa-solid fa-chevron-down" style="font-size:9px;"></i>
                        </button>
                        <div id="${subId}" style="display:none;margin-top:10px;font-size:11px;border-top:1px solid #f1f5f9;padding-top:8px;">
                            ${grupo.items.map(i => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${escapeHTML(i.insumo)}</span><span style="font-weight:600;">S/ ${Number(i.precio_cotizado||0).toFixed(2)}</span></div>`).join('')}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
            html += `</div></div>`;
        }

        html += `
        <div style="margin-top:10px;font-size:11px;color:#94a3b8;text-align:right;">
            ${itemsActivos.length} activo${itemsActivos.length !== 1 ? 's' : ''}
            ${itemsCompletados.length > 0 ? ` · ${itemsCompletados.length} completado${itemsCompletados.length !== 1 ? 's' : ''}` : ''}
        </div>`;
        tabla.innerHTML = html;

    } catch(e) {
        tabla.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar: ${escapeHTML(e.message)}
        </div>`;
    }
}

window._logCarouselNav = function(idBase, fotos, labels, dir) {
    if (!fotos || !fotos.length) return;
    _logCarouselIdx[idBase] = ((_logCarouselIdx[idBase] || 0) + dir + fotos.length) % fotos.length;
    const idx = _logCarouselIdx[idBase];
    const img = document.getElementById(`${idBase}-img`);
    const dot = document.getElementById(`${idBase}-dot`);
    if (img) img.src = fotos[idx];
    if (dot) dot.textContent = `${(labels && labels[idx]) ? labels[idx] + ' · ' : ''}${idx + 1}/${fotos.length}`;
};

async function _abrirEditarLogistica(item, proveedores) {
    // ── Determinar etapa del flujo para mostrar acciones correctas ──
    const estado = item.estado;

    // ETAPA 1 → Editar gestión del insumo (Externo / Informal / Interno)
    if (['POR_PEDIR', 'Pendiente'].includes(estado)) {
        const tipoActual = item.tipo_gestion || 'Externo';
        const opsProv = `<option value="">— Sin asignar —</option>` + proveedores.map(p =>
            `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre} (${p.especialidad})</option>`
        ).join('');

        // Bloque de foto + detalles del insumo desde el maestro
        const fotoHTML = _logFotoHTML(item, 72, 'loge');

        const { value: datos, isConfirmed } = await Swal.fire({
            title: `✏️ Editar insumo`,
            width: 540,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <!-- Info del insumo con foto -->
                    <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;
                                display:flex;gap:12px;align-items:center;">
                        ${fotoHTML}
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Insumo</div>
                            <div style="font-weight:900;font-size:15px;line-height:1.2;">${item.insumo}
                                <span style="color:#94a3b8;font-size:11px;font-weight:400;">${item.sku || ''}</span>
                            </div>
                            ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${item.detalle_insumo}</div>` : ''}
                            ${item.producto_item ? `<div style="font-size:11px;color:#0369a1;margin-top:2px;font-weight:700;"><i class="fa-solid fa-couch" style="font-size:10px;"></i> ${item.producto_item}</div>` : ''}
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">Pedido: <b style="color:#d97706;">#${item.codigo_venta}</b></div>
                        </div>
                    </div>

                    <!-- Cantidad y unidad -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                        <div>
                            <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Cantidad</label>
                            <input id="sl-cantidad" class="swal2-input" type="number" step="0.01" min="0"
                                value="${item.cantidad || ''}" placeholder="Ej: 3.5"
                                style="margin:0;width:100%;">
                        </div>
                        <div>
                            <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Unidad</label>
                            <select id="sl-unidad" class="swal2-input" style="margin:0;width:100%;">
                                <option value="">—</option>
                                ${['mts','und','planchas','kg','rollos','piezas','juegos'].map(u =>
                                    `<option value="${u}" ${item.unidad === u ? 'selected' : ''}>${u}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Tipo de gestión -->
                    <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;text-transform:uppercase;color:#475569;">¿Cómo se consigue este insumo?</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;" id="sl-tipo-btns">
                        ${[
                            { val:'Externo',  icon:'🏭', label:'Externo',  desc:'Proveedor formal con cotización' },
                            { val:'Informal', icon:'📞', label:'Informal', desc:'Jefe lo consigue por su cuenta' },
                            { val:'Interno',  icon:'🔨', label:'Interno',  desc:'Lo fabrica el taller' },
                        ].map(t => `
                            <label style="cursor:pointer;">
                                <input type="radio" name="tipo_gestion" value="${t.val}" ${tipoActual === t.val ? 'checked' : ''}
                                    style="display:none;" onchange="
                                        document.querySelectorAll('.tipo-btn').forEach(b => b.style.borderColor='#e2e8f0');
                                        this.closest('label').querySelector('.tipo-btn').style.borderColor='#3b82f6';
                                        document.getElementById('sl-prov-wrap').style.display = this.value === 'Externo' ? 'block' : 'none';
                                        document.getElementById('sl-nota-wrap').style.display = this.value === 'Externo' ? 'block' : 'none';
                                        document.getElementById('sl-informal-wrap').style.display = this.value === 'Informal' ? 'block' : 'none';
                                        document.getElementById('sl-interno-info').style.display = this.value === 'Interno' ? 'block' : 'none';
                                    ">
                                <div class="tipo-btn" style="border:2px solid ${tipoActual === t.val ? '#3b82f6' : '#e2e8f0'};
                                    border-radius:8px;padding:10px 8px;text-align:center;transition:border-color .15s;">
                                    <div style="font-size:20px;">${t.icon}</div>
                                    <div style="font-weight:800;font-size:12px;margin-top:2px;">${t.label}</div>
                                    <div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.3;">${t.desc}</div>
                                </div>
                            </label>`
                        ).join('')}
                    </div>

                    <!-- Proveedor formal (solo Externo) -->
                    <div id="sl-prov-wrap" style="display:${tipoActual === 'Externo' ? 'block' : 'none'};">
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Proveedor registrado (opcional)</label>
                        <select id="sl-prov" class="swal2-input" style="margin:0 0 12px;width:100%;">${opsProv}</select>
                    </div>

                    <!-- Nota (solo Externo) -->
                    <div id="sl-nota-wrap" style="display:${tipoActual === 'Externo' ? 'block' : 'none'};">
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Nota para el proveedor (opcional)</label>
                        <textarea id="sl-nota" class="swal2-textarea" placeholder="Ej: Necesitamos entrega urgente..." style="margin:0 0 4px;width:100%;font-size:13px;resize:vertical;min-height:60px;"></textarea>
                    </div>

                    <!-- Informal: nombre + celular libre -->
                    <div id="sl-informal-wrap" style="display:${tipoActual === 'Informal' ? 'block' : 'none'};">
                        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#854d0e;">
                            <b>Flujo informal:</b> El jefe consigue el material por su cuenta.
                            Registra con quién lo consigue y luego usa <b>"📦 Enviar al taller"</b>
                            cuando ya esté disponible para desbloquear producción.
                        </div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#475569;">Proveedor / Contacto (nombre y celular)</label>
                        <input id="sl-informal-prov" class="swal2-input" type="text"
                            placeholder="Ej: Juan Pérez · 987654321"
                            value="${item.proveedor_informal || ''}"
                            style="margin:0;width:100%;">
                    </div>

                    <!-- Info Interno -->
                    <div id="sl-interno-info" style="display:${tipoActual === 'Interno' ? 'block' : 'none'};
                        background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:10px 12px;font-size:12px;color:#166534;">
                        <b>Fabricación interna:</b> El taller produce este insumo.
                        Marca como <b>"Recibido"</b> cuando esté listo para usar y los tickets se desbloquearán automáticamente.
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar y continuar →',
            cancelButtonText:  'Cancelar',
            confirmButtonColor: '#0f172a',
            preConfirm: () => {
                const tipo = document.querySelector('input[name="tipo_gestion"]:checked')?.value || 'Externo';
                return {
                    id:                  item.id,
                    tipo_gestion:        tipo,
                    proveedor_id:        tipo === 'Externo' ? (document.getElementById('sl-prov')?.value || null) : null,
                    cantidad:            document.getElementById('sl-cantidad')?.value || null,
                    unidad:              document.getElementById('sl-unidad')?.value || null,
                    nota:                document.getElementById('sl-nota')?.value?.trim() || null,
                    proveedor_informal:  tipo === 'Informal'
                                            ? (document.getElementById('sl-informal-prov')?.value?.trim() || null)
                                            : null,
                };
            }
        });
        if (!isConfirmed || !datos) return;

        try {
            // Guardar tipo_gestion, proveedor, cantidad, unidad, proveedor_informal
            const resSave = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id:                  datos.id,
                    tipo_gestion:        datos.tipo_gestion,
                    proveedor_id:        datos.proveedor_id || null,
                    cantidad:            datos.cantidad || null,
                    unidad:              datos.unidad || null,
                    proveedor_informal:  datos.proveedor_informal || null,
                })
            });
            const dSave = await resSave.json();
            if (dSave.error) throw new Error(dSave.error);

            // ── EXTERNO con proveedor: WhatsApp directo sin formulario online ──
            if (datos.tipo_gestion === 'Externo' && datos.proveedor_id) {
                // Marcar como Cotizacion Enviada
                await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, estado: 'Cotizacion Enviada' })
                });

                const provData = proveedores.find(p => p.id == datos.proveedor_id) || {};
                let tel = _normalizarTelWA(provData.telefono || '');

                const esTela = (item.unidad || '').toLowerCase() === 'mts' ||
                               (item.insumo  || '').toLowerCase().includes('tela');
                const msgWsp = [
                    `Hola *${provData.nombre || 'Proveedor'}* 👋, somos *Innova Möbili*.`,
                    ``,
                    `Necesitamos cotización del siguiente material:`,
                    ``,
                    `📦 *Material:* ${item.insumo}`,
                    ...(item.sku            ? [`🔖 *SKU:* ${item.sku}`]                                    : []),
                    ...(item.detalle_insumo ? [`🎨 *Detalle:* ${item.detalle_insumo}`]                     : []),
                    ...(esTela && datos.cantidad
                                            ? [`📐 *Metros requeridos:* ${datos.cantidad} mts`]            : []),
                    ...(!esTela && datos.cantidad
                                            ? [`🔢 *Cantidad:* ${datos.cantidad} ${datos.unidad || ''}`]   : []),
                    ...(item.foto_url       ? [`🔗 *Ref. visual:* ${item.foto_url}`]                       : []),
                    `📋 *Pedido:* #${item.codigo_venta}`,
                    ...(datos.nota          ? [`📝 *Nota:* ${datos.nota}`]                                 : []),
                    ``,
                    `Por favor respóndenos con el *precio por ${esTela ? 'metro' : 'unidad'}* y la *fecha de entrega*. Gracias 🙏`,
                ].join('\n');

                if (tel) {
                    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
                } else {
                    await Swal.fire({
                        icon: 'warning', title: 'Sin teléfono registrado',
                        html: `El proveedor <b>${provData.nombre || ''}</b> no tiene WhatsApp registrado.<br>
                               Agrégalo en la sección Proveedores para poder abrir WA automáticamente.`,
                        confirmButtonColor: '#0f172a',
                    });
                }
                cargarLogisticaExterna();
                return;
            }

            // ── EXTERNO sin proveedor aún: solo guardar ────────────────────
            if (datos.tipo_gestion === 'Externo' && !datos.proveedor_id) {
                Swal.fire({ icon:'success', title:'Guardado', text:'Asigna un proveedor más tarde para enviar la cotización.', timer:2200, showConfirmButton:false });
                cargarLogisticaExterna();
                return;
            }

            // ── INFORMAL: mostrar botón "Enviar al taller" ─────────────────
            if (datos.tipo_gestion === 'Informal') {
                const { isConfirmed: confirmarTaller } = await Swal.fire({
                    icon: 'info',
                    title: '📞 Insumo informal guardado',
                    html: `Cuando ya tengas el material listo, presiona <b>"Enviar al taller"</b> para desbloquear los tickets de producción.`,
                    confirmButtonText: '📦 Enviar al taller ahora',
                    showCancelButton: true,
                    cancelButtonText: 'Lo haré después',
                    confirmButtonColor: '#0f172a',
                });
                if (confirmarTaller) {
                    const resTaller = await apiFetch(`${API_URL}/api/logistica/${item.id}/enviar-al-taller`, { method: 'POST' });
                    const dTaller = await resTaller.json();
                    if (!resTaller.ok || !dTaller.exito) throw new Error(dTaller.error || 'Error al enviar al taller');
                    Swal.fire({ icon:'success', title:'¡Enviado al taller!', text: dTaller.mensaje, timer:2500, showConfirmButton:false });
                } else {
                    Swal.fire({ icon:'success', title:'Guardado', timer:1500, showConfirmButton:false });
                }
                cargarLogisticaExterna();
                return;
            }

            // ── INTERNO ────────────────────────────────────────────────────
            const { isConfirmed: marcarListo } = await Swal.fire({
                icon: 'info',
                title: 'Insumo interno guardado',
                html: 'Cuando el taller termine físicamente este insumo, márcalo como <b>listo para usar</b> para desbloquear las tareas que dependen de él.',
                confirmButtonText: 'Marcar listo para usar',
                showCancelButton: true,
                cancelButtonText: 'Lo haré después',
                confirmButtonColor: '#0f172a',
            });
            if (marcarListo) {
                const resListo = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, estado: 'Recibido' }),
                });
                const dListo = await resListo.json();
                if (!resListo.ok || !dListo.exito) throw new Error(dListo.error || 'Error al marcar el insumo como listo');
                Swal.fire({
                    icon: 'success',
                    title: 'Insumo listo',
                    text: dListo.mensaje || `Se desbloquearon ${dListo.desbloqueados || 0} tarea(s).`,
                    timer: 2500,
                    showConfirmButton: false,
                });
            } else {
                Swal.fire({ icon:'success', title:'Guardado como interno', timer:1500, showConfirmButton:false });
            }
            cargarLogisticaExterna();
            return;

        } catch(e) { Swal.fire('Error', e.message, 'error'); }
        return;
    }

    // ETAPA 2 → Cotización Enviada: el proveedor respondió por WA — registrar manualmente
    if (estado === 'Cotizacion Enviada' || estado === 'Cotizacion Recibida') {
        const { isConfirmed, isDenied } = await Swal.fire({
            title: `⏳ Esperando cotización`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;
                                padding:10px 12px;margin-bottom:14px;font-size:12px;color:#0369a1;">
                        Solicitud enviada a <b>${item.proveedor}</b> por WhatsApp.
                        Cuando responda con el precio, regístralo aquí.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Insumo</div>
                            <div style="font-weight:800;">${item.insumo}</div>
                            ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;">${item.detalle_insumo}</div>` : ''}
                            ${item.producto_item ? `<div style="font-size:11px;color:#0369a1;font-weight:700;">🛋️ ${item.producto_item}</div>` : ''}
                        </div>
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Pedido</div>
                            <div style="font-weight:800;color:#d97706;">#${item.codigo_venta}</div>
                        </div>
                        ${item.cantidad ? `
                        <div>
                            <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:2px;">Cantidad solicitada</div>
                            <div style="font-weight:700;">${item.cantidad} ${item.unidad || ''}</div>
                        </div>` : ''}
                    </div>
                    <div style="color:#64748b;font-size:12px;padding:8px 10px;background:#f8fafc;border-radius:6px;">
                        💬 Cuando el proveedor te confirme el precio por WhatsApp, usa
                        <b>"Registrar respuesta"</b> para ingresarlo. Si no ha visto el mensaje,
                        puedes reenviar el pedido por WhatsApp.
                    </div>
                </div>`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '✅ Registrar respuesta del proveedor',
            denyButtonText:    '📲 Reenviar pedido por WhatsApp',
            cancelButtonText:  'Cerrar',
            confirmButtonColor: '#166534',
            denyButtonColor:   '#0369a1',
        });

        if (isConfirmed) {
            await _registrarRespuestaProveedor(item);
        } else if (isDenied) {
            // Reenviar WhatsApp con el mismo mensaje limpio (sin link de formulario)
            // item.telefono_proveedor viene del backend; fallback a correo_proveedor si fuera un número
            const telRaw = item.telefono_proveedor || item.correo_proveedor || '';
            let tel = _normalizarTelWA(telRaw);
            const esTela = (item.unidad || '').toLowerCase() === 'mts' ||
                           (item.insumo  || '').toLowerCase().includes('tela');
            const msgWsp = [
                `Hola *${item.proveedor}* 👋, somos *Innova Möbili*.`,
                ``,
                `Te reenviamos nuestra solicitud de cotización:`,
                ``,
                `📦 *Material:* ${item.insumo}`,
                ...(item.sku            ? [`🔖 *SKU:* ${item.sku}`]                                   : []),
                ...(item.detalle_insumo ? [`🎨 *Detalle:* ${item.detalle_insumo}`]                    : []),
                ...(item.cantidad       ? [`📐 *Cantidad:* ${item.cantidad} ${item.unidad || ''}`]     : []),
                ...(item.foto_url       ? [`🔗 *Ref. visual:* ${item.foto_url}`]                      : []),
                `📋 *Pedido:* #${item.codigo_venta}`,
                ``,
                `Por favor dinos el *precio por ${esTela ? 'metro' : 'unidad'}* y la *fecha de entrega*. Gracias 🙏`,
            ].join('\n');

            if (tel) {
                window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
            } else {
                Swal.fire({ icon:'warning', title:'Sin teléfono', text:'El proveedor no tiene teléfono registrado.', confirmButtonColor:'#0f172a' });
            }
        }
        return;
    }

    // ETAPA 3 → Cotizado: revisar y aprobar para emitir Orden de Compra
    if (estado === 'Cotizado') {
        const { value: opciones, isConfirmed } = await Swal.fire({
            title: `✅ Revisar Cotización`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#166534;">
                        <b>Paso 3 de 3:</b> El proveedor ya respondió. Revisa los datos y aprueba para generar la Orden de Compra.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                        <div style="background:#f8fafc;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#475569;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Proveedor</div>
                            <div style="font-weight:900;">${item.proveedor}</div>
                        </div>
                        <div style="background:#f8fafc;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#475569;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Insumo</div>
                            <div style="font-weight:900;">${item.insumo}</div>
                        </div>
                        <div style="background:#fef9c3;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#854d0e;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Precio cotizado</div>
                            <div style="font-weight:900;font-size:18px;color:#854d0e;">S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</div>
                        </div>
                        <div style="background:#fef9c3;border-radius:8px;padding:10px;">
                            <div style="font-weight:700;color:#854d0e;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Fecha de entrega</div>
                            <div style="font-weight:900;font-size:14px;color:#854d0e;">${item.fecha_entrega_proveedor || '—'}</div>
                        </div>
                    </div>
                    <div style="color:#64748b;font-size:12px;margin-bottom:12px;">Al aprobar, se genera la <b>Orden de Compra</b> y se notifica al proveedor.</div>
                    
                    <!-- NEW: Radio buttons for payment/delivery flow -->
                    <div style="background:#f1f5f9;border-radius:8px;padding:12px;font-size:12px;">
                        <label style="font-weight:700;display:block;margin-bottom:8px;color:#475569;">¿Cómo proceder con este proveedor?</label>
                        <label style="display:block;margin-bottom:8px;cursor:pointer;">
                            <input type="radio" name="oc_flow" value="pagar_primero" checked>
                            <b>Pagar primero:</b> Se registrará el pago y luego se recogerá el material.
                        </label>
                        <label style="display:block;cursor:pointer;">
                            <input type="radio" name="oc_flow" value="recoger_primero">
                            <b>Recoger ahora (proveedor de confianza):</b> El material pasa a la cola de recojo y se paga después.
                        </label>
                    </div>
                </div>`,
            showCancelButton: true,
            showDenyButton: false,
            confirmButtonText: '🛒 Aprobar y generar Orden de Compra',
            cancelButtonText:  'Cerrar',
            confirmButtonColor: '#166534',
            preConfirm: () => {
                const flow = document.querySelector('input[name="oc_flow"]:checked').value;
                return { recoger_primero: flow === 'recoger_primero' };
            }
        });

        if (isConfirmed && opciones) {
            try {
                Swal.fire({ title: 'Generando Orden de Compra...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                const resOC = await apiFetch(`${API_URL}/api/logistica/${item.id}/generar-orden`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(opciones)
                });
                const dOC = await resOC.json();
                if (!resOC.ok || !dOC.exito) throw new Error(dOC.error || 'No se pudo generar la OC');

                Swal.close();

                // Construir número de WhatsApp
                let tel = _normalizarTelWA(dOC.telefono || item.telefono_proveedor || '');

                const msgOC = [
                    `Hola *${dOC.proveedor || item.proveedor}* 👋, somos *Innova Möbili*.`,
                    ``,
                    `Le comunicamos que hemos *aprobado su cotización* y adjuntamos la`,
                    `*Orden de Compra oficial* para su referencia:`,
                    ``,
                    `📦 *Material:* ${item.insumo}${item.sku ? ` (${item.sku})` : ''}`,
                    `💰 *Precio acordado:* S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}`,
                    `📅 *Fecha de entrega pactada:* ${item.fecha_entrega_proveedor || 'Por confirmar'}`,
                    `📋 *Ref. pedido:* ${item.codigo_venta}`,
                    ``,
                    `📄 *Orden de Compra (PDF):*`,
                    `👉 ${_urlPdfPublica(dOC.url_pdf, item.id)}`,
                    ``,
                    `Por favor confirme la recepción de este documento. Gracias 🙏`,
                    ``,
                    `_Innova Möbili — Área de Compras_`,
                ].join('\n');

                // Mostrar confirmación con preview y botón abrir WhatsApp
                const { isConfirmed: abrirWsp } = await Swal.fire({
                    icon: 'success',
                    title: '¡Orden de Compra generada!',
                    html: `
                        <div style="text-align:left;font-size:13px;">
                            <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;
                                        padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;">
                                El PDF fue generado y subido correctamente.
                                ${dOC.numero_oc ? `<br><b>N° OC: ${dOC.numero_oc}</b>` : ''}
                            </div>
                            <div style="margin-bottom:10px;">
                                <a href="#" onclick="_abrirPDF('${dOC.url_pdf}', ${item.id});return false;"
                                   style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;
                                          border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;
                                          font-size:12px;font-weight:700;color:#0f172a;text-decoration:none;">
                                    📄 Ver PDF de la Orden de Compra
                                </a>
                            </div>
                            ${tel ? `<div style="color:#64748b;font-size:12px;">
                                ¿Deseas enviar la OC al proveedor por WhatsApp ahora?
                            </div>` : `<div style="background:#fef9c3;border-radius:6px;padding:8px 12px;
                                font-size:12px;color:#854d0e;">
                                El proveedor no tiene teléfono registrado. Puedes copiar el link del PDF y enviarlo manualmente.
                            </div>`}
                        </div>`,
                    showCancelButton: true,
                    confirmButtonText: tel ? '📲 Enviar por WhatsApp' : 'Cerrar',
                    cancelButtonText: 'Cerrar',
                    confirmButtonColor: tel ? '#25D366' : '#0f172a',
                    showConfirmButton: true,
                });

                if (abrirWsp && tel) {
                    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgOC)}`, '_blank');
                }

                cargarLogisticaExterna();
            } catch(e) { Swal.fire('Error', e.message, 'error'); }
        }
        return;
    }

    // ETAPA 4 → Orden Enviada / En Tránsito: marcar recibido o actualizar estado
    if (['Orden Enviada', 'En Tránsito', 'Confirmado', 'Pagado'].includes(estado)) {
        let estadosPosibles = ['Orden Enviada','Confirmado','En Tránsito','Pagado','Listo para Recojo','Recibido','Cancelado'];
        const opsEstado = estadosPosibles.map(e => {
            const label = e === 'Listo para Recojo' ? '📢 Enviar a Cola de Recojo' : e;
            return `<option value="${e}" ${e === estado ? 'selected' : ''}>${label}</option>`;
        }).join('');

        const tienePago = !!item.url_comprobante_pago;

        const { value: datos, isConfirmed } = await Swal.fire({
            title: `📦 Actualizar estado`,
            html: `
                <div style="text-align:left;font-size:13px;">
                    <div style="background:#f3e8ff;border:1px solid #d8b4fe;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#7e22ce;">
                        Orden enviada a <b>${item.proveedor}</b>. Actualiza el estado según el avance.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                        <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Precio acordado</span><br><b style="font-size:16px;">S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</b></div>
                        <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">F. entrega pactada</span><br><b>${item.fecha_entrega_proveedor || '—'}</b></div>
                    </div>
                    <label style="font-weight:700;display:block;margin-bottom:4px;">Nuevo estado</label>
                    <select id="sl-estado" class="swal2-input" style="margin:0 0 14px;width:100%;"
                        onchange="
                            const v = this.value;
                            document.getElementById('bloque-voucher').style.display = v === 'Pagado' ? 'block' : 'none';
                        "
                    >${opsEstado}</select>

                    <!-- Bloque voucher: visible solo si se elige Pagado -->
                    <div id="bloque-voucher" style="display:${estado === 'Pagado' ? 'block' : 'none'};">
                        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                                    padding:10px 12px;margin-bottom:10px;font-size:12px;color:#854d0e;">
                            <b>Registrar pago al proveedor</b> — Adjunta el comprobante (foto o PDF).
                            ${tienePago ? `<br><a href="${item.url_comprobante_pago}" target="_blank"
                                style="color:#1d4ed8;font-weight:700;">📄 Ver comprobante anterior</a>` : ''}
                        </div>
                        <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">
                            Comprobante de pago ${tienePago ? '(reemplazar)' : '*'}
                        </label>
                        <div style="display:flex;gap:8px;margin-bottom:6px;">
                            <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:9px 6px;
                                          border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:5px;">
                                📷 Tomar foto
                                <input type="file" id="inp-voucher-cam" accept="image/*" capture="environment"
                                       style="display:none;" onchange="_previewVoucher(this)">
                            </label>
                            <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:9px 6px;
                                          border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                          align-items:center;justify-content:center;gap:5px;">
                                📁 Seleccionar archivo
                                <input type="file" id="inp-voucher" accept="image/*,application/pdf"
                                       style="display:none;" onchange="_previewVoucher(this)">
                            </label>
                        </div>
                        <div id="voucher-preview" style="margin-top:8px;display:none;">
                            <img id="voucher-img" src="" alt="preview"
                                 style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;object-fit:contain;">
                            <div id="voucher-pdf-label" style="display:none;background:#f1f5f9;border-radius:6px;
                                 padding:8px 12px;font-size:12px;font-weight:700;color:#475569;">
                                📄 <span id="voucher-pdf-nombre"></span>
                            </div>
                        </div>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText:  'Cancelar',
            confirmButtonColor: '#7e22ce',
            preConfirm: () => {
                const nuevoEstado = document.getElementById('sl-estado').value;
                const archivoCam = document.getElementById('inp-voucher-cam')?.files[0] || null;
                const archivoGal = document.getElementById('inp-voucher')?.files[0] || null;
                const archivo = archivoCam || archivoGal;
                if (nuevoEstado === 'Pagado' && !archivo && !tienePago) {
                    Swal.showValidationMessage('Adjunta el comprobante de pago para continuar.');
                    return false;
                }
                const detectado = window._ultimoVoucherLogisticaOCR;
                if (nuevoEstado === 'Pagado' && detectado?.monto_bruto && item.precio_cotizado) {
                    const dif = Math.abs(Number(detectado.monto_bruto) - Number(item.precio_cotizado));
                    if (dif > 1) {
                        Swal.showValidationMessage(`El voucher parece ser por S/ ${Number(detectado.monto_bruto).toFixed(2)}, pero el precio acordado es S/ ${Number(item.precio_cotizado).toFixed(2)}. Revisa antes de guardar.`);
                        return false;
                    }
                }
                return { id: item.id, estado: nuevoEstado, archivo };
            }
        });
        if (!isConfirmed || !datos) return;

        try {
            // Si el estado es Pagado y hay archivo nuevo → subir voucher primero
            if (datos.estado === 'Pagado' && datos.archivo) {
                Swal.fire({ title: 'Subiendo comprobante...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const fd = new FormData();
                fd.append('comprobante', datos.archivo);
                const resPago = await apiFetch(`${API_URL}/api/logistica/${item.id}/registrar-pago`, {
                    method: 'POST',
                    body: fd,
                });
                const dPago = await resPago.json();
                Swal.close();
                if (!resPago.ok || !dPago.exito) throw new Error(dPago.error || 'Error al subir el comprobante');
                Swal.fire({
                    icon: 'success',
                    title: '💳 Pago registrado',
                    html: `El comprobante fue subido correctamente.<br>
                           <a href="${dPago.url}" target="_blank"
                              style="color:#1d4ed8;font-weight:700;font-size:13px;">📄 Ver comprobante</a>`,
                    timer: 3000,
                    showConfirmButton: false,
                });
                cargarLogisticaExterna();
                return;
            }

            // Para cualquier otro estado → actualizar normalmente
            const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: datos.id, estado: datos.estado })
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            const msg = datos.estado === 'Recibido'
                ? '¡Material recibido! Los tickets relacionados fueron desbloqueados.'
                : '¡Estado actualizado!';
            Swal.fire({ icon: 'success', title: msg, timer: 2000, showConfirmButton: false });
            cargarLogisticaExterna();
        } catch(e) { Swal.fire('Error', e.message, 'error'); }
        return;
    }

    // ETAPA FINAL → Recibido / Cancelado: solo lectura con opción de cancelar
    const opsEstadoFinal = ['Recibido','Cancelado']
        .map(e => `<option value="${e}" ${e === estado ? 'selected' : ''}>${e}</option>`).join('');

    const { value: datos, isConfirmed } = await Swal.fire({
        title: `${estado === 'Recibido' ? '✅' : '❌'} ${estado}`,
        html: `
            <div style="text-align:left;font-size:13px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Proveedor</span><br><b>${item.proveedor}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Insumo</span><br><b>${item.insumo}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Precio final</span><br><b>S/ ${item.precio_cotizado ? item.precio_cotizado.toFixed(2) : '—'}</b></div>
                    <div><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;">Entrega</span><br><b>${item.fecha_entrega_proveedor || '—'}</b></div>
                </div>
                <label style="font-weight:700;display:block;margin-bottom:4px;">Cambiar estado</label>
                <select id="sl-estado" class="swal2-input" style="margin:0;width:100%;">${opsEstadoFinal}</select>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText:  'Cerrar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => ({ id: item.id, estado: document.getElementById('sl-estado').value })
    });
    if (!isConfirmed || !datos) return;

    try {
        const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        Swal.fire({ icon:'success', title:'Actualizado', timer:1500, showConfirmButton:false });
        cargarLogisticaExterna();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

// Helper: ingresar cotización manualmente (cuando el proveedor confirma por teléfono/WhatsApp)
// Renombrado y mejorado: registrar respuesta del proveedor (precio + fecha + foto opcional)
async function _registrarRespuestaProveedor(item) {
    const { value: datos, isConfirmed } = await Swal.fire({
        title: `✅ Registrar respuesta del proveedor`,
        width: 500,
        html: `
            <div style="text-align:left;font-size:13px;">
                <!-- Resumen del insumo -->
                <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin-bottom:14px;
                            display:flex;gap:10px;align-items:center;">
                    ${item.foto_url
                        ? `<img src="${item.foto_url}" id="img-insumo-header"
                               style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;"
                               onerror="this.style.display='none';var fb=document.getElementById('icon-insumo-fb');if(fb)fb.style.display='flex';">
                           <div id="icon-insumo-fb" style="display:none;width:52px;height:52px;border-radius:6px;background:#f1f5f9;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>`
                        : `<div style="width:52px;height:52px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>`}
                    <div>
                        <div style="font-weight:800;font-size:14px;">${item.insumo}</div>
                        ${item.detalle_insumo ? `<div style="font-size:11px;color:#64748b;">${item.detalle_insumo}</div>` : ''}
                        ${item.producto_item ? `<div style="font-size:11px;color:#0369a1;font-weight:700;">🛋️ ${item.producto_item}</div>` : ''}
                        <div style="font-size:11px;color:#d97706;font-weight:700;">Proveedor: ${item.proveedor}</div>
                    </div>
                </div>

                <!-- Precio y fecha -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">Precio total (S/) *</label>
                        <input id="sl-precio" class="swal2-input" type="number" step="0.01" min="0.01"
                            placeholder="0.00" value="${item.precio_cotizado || ''}"
                            style="margin:0;width:100%;">
                    </div>
                    <div>
                        <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                                      text-transform:uppercase;color:#475569;">Fecha de entrega *</label>
                        <input id="sl-fecha" class="swal2-input" type="date"
                            value="${item.fecha_entrega_proveedor
                                ? item.fecha_entrega_proveedor.split('/').reverse().join('-') : ''}"
                            style="margin:0;width:100%;">
                    </div>
                </div>

                <!-- Notas del proveedor -->
                <label style="font-weight:700;display:block;margin-bottom:4px;font-size:11px;
                              text-transform:uppercase;color:#475569;">Notas / condiciones (opcional)</label>
                <textarea id="sl-notas" class="swal2-textarea"
                    placeholder="Ej: precio por metro, incluye flete, etc."
                    style="margin:0 0 12px;width:100%;font-size:12px;min-height:55px;resize:vertical;"
                >${item.notas_proveedor || ''}</textarea>

                <!-- Adjuntar cotización (foto o PDF del WA) -->
                <label style="font-weight:700;display:block;margin-bottom:6px;font-size:11px;
                              text-transform:uppercase;color:#475569;">
                    Adjuntar cotización (foto o PDF, opcional)
                </label>
                <div style="display:flex;gap:8px;margin-bottom:6px;">
                    <label style="flex:1;cursor:pointer;background:#0f172a;color:#fff;padding:9px 6px;
                                  border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                  align-items:center;justify-content:center;gap:5px;">
                        📷 Tomar foto
                        <input type="file" id="inp-cotizacion-cam" accept="image/*" capture="environment"
                               style="display:none;" onchange="_previewCotizacion(this)">
                    </label>
                    <label style="flex:1;cursor:pointer;background:#e2e8f0;color:#0f172a;padding:9px 6px;
                                  border-radius:8px;font-size:11px;font-weight:700;display:flex;
                                  align-items:center;justify-content:center;gap:5px;">
                        📁 Seleccionar archivo
                        <input type="file" id="inp-cotizacion" accept="image/*,application/pdf"
                               style="display:none;" onchange="_previewCotizacion(this)">
                    </label>
                </div>
                <div id="cot-preview" style="margin-top:6px;display:none;">
                    <img id="cot-img" src="" alt="preview"
                         style="max-height:100px;border-radius:6px;border:1px solid #e2e8f0;">
                    <div id="cot-pdf-label" style="display:none;background:#f1f5f9;border-radius:6px;
                         padding:8px 12px;font-size:12px;font-weight:700;color:#475569;">
                        📄 <span id="cot-pdf-nombre"></span>
                    </div>
                </div>
                ${item.url_cotizacion_adjunta
                    ? `<div style="margin-top:6px;font-size:11px;">
                           📎 Ya hay una cotización adjunta:
                           <a href="${item.url_cotizacion_adjunta}" target="_blank"
                              style="color:#1d4ed8;font-weight:700;">Ver archivo</a>
                       </div>`
                    : ''}
            </div>`,
        showCancelButton: true,
        confirmButtonText: '💾 Guardar cotización',
        cancelButtonText:  'Cancelar',
        confirmButtonColor: '#166534',
        preConfirm: () => {
            const precio = document.getElementById('sl-precio').value;
            const fecha  = document.getElementById('sl-fecha').value;
            if (!precio || parseFloat(precio) <= 0) { Swal.showValidationMessage('Ingresa un precio válido'); return false; }
            if (!fecha) { Swal.showValidationMessage('Ingresa la fecha de entrega'); return false; }
            // Tomar el archivo de whichever input fue usado (cámara o galería)
            const archivoCam = document.getElementById('inp-cotizacion-cam')?.files[0] || null;
            const archivoGal = document.getElementById('inp-cotizacion')?.files[0] || null;
            return {
                precio,
                fecha,
                notas:   document.getElementById('sl-notas').value.trim(),
                archivo: archivoCam || archivoGal,
            };
        }
    });
    if (!isConfirmed || !datos) return;

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Si hay archivo adjunto → subirlo primero como voucher de cotización
        let url_cotizacion = null;
        if (datos.archivo) {
            const fd = new FormData();
            fd.append('archivo', datos.archivo);
            const resUp = await apiFetch(`${API_URL}/api/upload-voucher`, { method: 'POST', body: fd });
            const dUp = await resUp.json();
            if (dUp.url) url_cotizacion = dUp.url;
        }

        // Guardar precio, fecha, notas y marcar como Cotizado
        const payload = {
            id:                      item.id,
            precio_cotizado:         datos.precio,
            fecha_entrega_proveedor: datos.fecha,
            estado:                  'Cotizado',
        };
        if (datos.notas)       payload.notas_proveedor       = datos.notas;
        if (url_cotizacion)    payload.url_cotizacion_adjunta = url_cotizacion;

        const res = await apiFetch(`${API_URL}/api/logistica/actualizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        Swal.close();
        if (d.error) throw new Error(d.error);

        Swal.fire({
            icon: 'success',
            title: '¡Cotización registrada!',
            html: `Precio: <b>S/ ${parseFloat(datos.precio).toFixed(2)}</b><br>
                   ${url_cotizacion ? `📎 <a href="${url_cotizacion}" target="_blank" style="color:#1d4ed8;">Ver cotización adjunta</a><br>` : ''}
                   Ahora puedes revisar y aprobar la Orden de Compra.`,
            timer: 3000,
            showConfirmButton: false,
        });
        cargarLogisticaExterna();
    } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}

// Alias para compatibilidad con ETAPA 3 que aún lo referencia
async function _ingresarCotizacionManual(item) {
    return _registrarRespuestaProveedor(item);
}

/**
 * _previewCotizacion — muestra preview inteligente al seleccionar foto o PDF.
 * Funciona con ambos inputs (cámara y galería/archivo).
 * Se llama con onchange="..." directamente en el HTML del Swal.
 */
/**
 * _previewVoucher — igual que _previewCotizacion pero para el comprobante de pago.
 */
function _voucherLogisticaStatus(texto, tipo = 'info') {
    const previewDiv = document.getElementById('voucher-preview');
    if (!previewDiv) return;
    let box = document.getElementById('voucher-ocr-status-logistica');
    if (!box) {
        box = document.createElement('div');
        box.id = 'voucher-ocr-status-logistica';
        box.style.cssText = 'display:none;margin-top:8px;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:700;line-height:1.35;';
        previewDiv.insertAdjacentElement('afterend', box);
    }
    const colores = {
        info: ['#eff6ff', '#1d4ed8'],
        ok: ['#ecfdf5', '#047857'],
        warn: ['#fffbeb', '#b45309'],
        error: ['#fef2f2', '#b91c1c'],
    };
    const [bg, color] = colores[tipo] || colores.info;
    box.style.display = 'block';
    box.style.background = bg;
    box.style.color = color;
    box.textContent = texto;
}

async function _leerVoucherLogisticaAutomatico(file) {
    window._ultimoVoucherLogisticaOCR = null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        _voucherLogisticaStatus('Voucher subido. La lectura automática por ahora acepta imágenes; registra el pago manualmente.', 'warn');
        return;
    }
    _voucherLogisticaStatus('Leyendo comprobante automáticamente...', 'info');
    try {
        const fd = new FormData();
        fd.append('archivo', file);
        const res = await apiFetch(`${API_URL}/api/voucher/leer`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo leer el comprobante');
        if (data.ok === false) {
            window._ultimoVoucherLogisticaOCR = null;
            _voucherLogisticaStatus(`Voucher subido. ${data.error || 'No se pudo autoleer'}. Puedes continuar manualmente.`, 'warn');
            return;
        }
        window._ultimoVoucherLogisticaOCR = data;
        const partes = [];
        if (data.entidad) partes.push(data.entidad);
        if (data.monto_bruto != null) partes.push(`S/ ${Number(data.monto_bruto).toFixed(2)}`);
        if (data.numero_operacion) partes.push(`Op. ${data.numero_operacion}`);
        _voucherLogisticaStatus(`Comprobante leído: ${partes.join(' · ') || 'revisa el comprobante'}. Se validará contra el precio acordado al guardar.`, 'ok');
    } catch (e) {
        _voucherLogisticaStatus(`Voucher subido. No se pudo autoleer: ${e.message}. Puedes continuar manualmente.`, 'warn');
    }
}

function _previewVoucher(inputEl) {
    const file = inputEl?.files[0];
    if (!file) return;
    const previewDiv = document.getElementById('voucher-preview');
    const imgEl      = document.getElementById('voucher-img');
    const pdfLabel   = document.getElementById('voucher-pdf-label');
    const pdfNombre  = document.getElementById('voucher-pdf-nombre');
    if (!previewDiv) return;

    if (file.type.startsWith('image/')) {
        if (pdfLabel) pdfLabel.style.display = 'none';
        if (imgEl)    imgEl.style.display = 'block';
        const reader = new FileReader();
        reader.onload = e => {
            imgEl.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        if (imgEl)    { imgEl.style.display = 'none'; imgEl.src = ''; }
        if (pdfLabel) pdfLabel.style.display = 'block';
        if (pdfNombre) pdfNombre.textContent = file.name;
        previewDiv.style.display = 'block';
    }
    _leerVoucherLogisticaAutomatico(file);
}

function _previewCotizacion(inputEl) {
    const file = inputEl?.files[0];
    if (!file) return;
    const previewDiv  = document.getElementById('cot-preview');
    const imgEl       = document.getElementById('cot-img');
    const pdfLabel    = document.getElementById('cot-pdf-label');
    const pdfNombre   = document.getElementById('cot-pdf-nombre');
    if (!previewDiv) return;

    if (file.type.startsWith('image/')) {
        // Mostrar imagen, ocultar etiqueta PDF
        if (pdfLabel) pdfLabel.style.display = 'none';
        if (imgEl)    imgEl.style.display = 'block';
        const reader = new FileReader();
        reader.onload = e => {
            imgEl.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        // PDF u otro: mostrar nombre, ocultar img para no romper layout
        if (imgEl)    { imgEl.style.display = 'none'; imgEl.src = ''; }
        if (pdfLabel) pdfLabel.style.display = 'block';
        if (pdfNombre) pdfNombre.textContent = file.name;
        previewDiv.style.display = 'block';
    }
}

