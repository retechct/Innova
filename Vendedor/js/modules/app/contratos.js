// App - contratos, reportes y cambios de precio
// ==========================================
// MÓDULO: CONTRATOS / REPORTES Y VENTAS
// ==========================================
let _contratosData = [];
let _contratosFiltroTimer = null;

async function loadContratos() {
    const tbody = document.getElementById('contratos-tbody');
    const cards = document.getElementById('contratos-cards');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#94a3b8;">
        <i class="fa-solid fa-spinner fa-spin"></i> Cargando contratos...</td></tr>`;

    try {
        const params = new URLSearchParams({ limit: 500 });
        const q      = (document.getElementById('contratos-search')?.value || '').trim();
        const estado = document.getElementById('contratos-filtro-estado')?.value || '';
        const desde  = document.getElementById('contratos-desde')?.value || '';
        const hasta  = document.getElementById('contratos-hasta')?.value || '';
        if (q)      params.set('q', q);
        if (estado) params.set('estado', estado);
        if (desde)  params.set('desde', desde);
        if (hasta)  params.set('hasta', hasta);

        const res = await apiFetch(`${API_URL}/api/ventas?${params.toString()}`);
        _contratosData = await res.json();
        if (_contratosData.error) throw new Error(_contratosData.error);
        renderContratos(_contratosData);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#ef4444;">
            Error al cargar: ${e.message}</td></tr>`;
    }
}

function filtrarContratos() {
    clearTimeout(_contratosFiltroTimer);
    _contratosFiltroTimer = setTimeout(loadContratos, 300);
}

function _filtrarContratosLocal() {
    const q      = (document.getElementById('contratos-search')?.value || '').toLowerCase();
    const estado = document.getElementById('contratos-filtro-estado')?.value || '';
    const desde  = document.getElementById('contratos-desde')?.value || '';
    const hasta  = document.getElementById('contratos-hasta')?.value || '';

    const filtrado = _contratosData.filter(v => {
        const texto = `${v.codigo} ${v.cliente} ${v.productos || ''}`.toLowerCase();
        const okQ      = !q      || texto.includes(q);
        const okEstado = !estado || v.estado === estado;
        const okDesde  = !desde  || v.fecha_emision >= desde;
        const okHasta  = !hasta  || v.fecha_emision <= hasta;
        return okQ && okEstado && okDesde && okHasta;
    });

    renderContratos(filtrado);
}

const ESTADO_COLORS = {
    'Pendiente':      { bg:'#fef3c7', color:'#92400e' },
    'En producción':  { bg:'#dbeafe', color:'#1e40af' },
    'Listo':          { bg:'#d1fae5', color:'#065f46' },
    'Entregado':      { bg:'#f1f5f9', color:'#475569' },
    'Despachado':     { bg:'#e0f2fe', color:'#0369a1' },
    'Cancelado':      { bg:'#fee2e2', color:'#b91c1c' },
};

function renderContratos(lista) {
    const tbody  = document.getElementById('contratos-tbody');
    const cards  = document.getElementById('contratos-cards');
    const stats  = document.getElementById('contratos-stats');
    const isMobile = window.innerWidth < 640;

    // Mover el contenedor de estadísticas a la parte superior de la vista
    const tableWrapper = document.getElementById('contratos-table-wrapper');
    if (stats && tableWrapper && tableWrapper.parentElement) {
        // Insertar stats antes del contenedor de la tabla para que aparezca arriba.
        // Esto asegura que las estadísticas estén visibles justo debajo de los filtros.
        tableWrapper.parentElement.insertBefore(stats, tableWrapper);
    }

    // Estadísticas rápidas
    const totalVentas  = lista.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const totalSaldo   = lista.reduce((s, v) => s + (parseFloat(v.saldo)  || 0), 0);
    stats.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#64748b; font-weight:700;">CONTRATOS</div>
            <div style="font-size:22px; font-weight:900; color:#0f172a;">${lista.length}</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#166534; font-weight:700;">TOTAL VENTAS</div>
            <div style="font-size:22px; font-weight:900; color:#166534;">S/ ${totalVentas.toFixed(2)}</div>
        </div>
        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 18px; flex:1; min-width:150px;">
            <div style="font-size:11px; color:#9a3412; font-weight:700;">SALDO PENDIENTE</div>
            <div style="font-size:22px; font-weight:900; color:#9a3412;">S/ ${totalSaldo.toFixed(2)}</div>
        </div>`;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#94a3b8;">No hay contratos para estos filtros.</td></tr>`;
        cards.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:40px;">No hay contratos para estos filtros.</p>`;
        return;
    }

    // === Tabla (desktop) === CORREGIDO PARA INCLUIR SEDE Y BALANCEAR COLUMNAS
document.getElementById('contratos-table-wrapper').style.display = isMobile ? 'none' : 'block';
cards.style.display = isMobile ? 'block' : 'none';

const ec = (v) => {
    const e = ESTADO_COLORS[v.estado] || { bg:'#f1f5f9', color:'#475569' };
    return `<span style="background:${e.bg}; color:${e.color}; font-size:10px; font-weight:800;
                    padding:3px 8px; border-radius:20px; white-space:nowrap;">${escapeHTML(v.estado || '—')}</span>`;
};

tbody.innerHTML = lista.map((v, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; background:${i%2===0?'white':'#fafafa'};"
        onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${i%2===0?'white':'#fafafa'}'">
        <td style="padding:11px 14px; font-weight:800; color:#d4af37;">#${escapeHTML(v.codigo)}</td>
        <td style="padding:11px 14px;">
            <div style="font-weight:700; font-size:13px;">${escapeHTML(v.cliente)}</div>
            <div style="font-size:11px; color:#94a3b8;">${escapeHTML(v.vendedor || 'Sin asignar')}</div>
        </td>
        
        <td style="padding:11px 14px; font-size:12px; color:#64748b;">
            ${escapeHTML(v.fecha_emision ? v.fecha_emision.split('-').reverse().join('/') : '—')}
        </td>
        
        <td style="padding:11px 14px; font-weight:800; color:#10b981;">S/ ${parseFloat(v.total||0).toFixed(2)}</td>
        <td style="padding:11px 14px; color:#0f172a;">S/ ${parseFloat(v.adelanto||0).toFixed(2)}</td>
        <td style="padding:11px 14px; color:#ef4444; font-weight:700;">S/ ${parseFloat(v.saldo||0).toFixed(2)}</td>
        <td style="padding:11px 14px;">${ec(v)}</td>
        <td style="padding:11px 14px; font-size:12px; color:#64748b;">${escapeHTML(v.fecha_entrega || '—')}</td>
        <td style="padding:11px 14px; white-space:nowrap; display:flex; gap:6px; align-items:center;">
            <button onclick="verDetalleContrato(${jsStringAttr(v.codigo)})" title="Ver pedido"
                    style="background:#0f172a; color:white; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button onclick="verHistorialPrecios(${jsStringAttr(v.codigo)})" title="Historial de precios"
                    style="background:#f1f5f9; color:#475569; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-clock-rotate-left"></i>
            </button>
            <button onclick="verSeguimientoVendedor(${jsStringAttr(v.codigo)})" title="Ver progreso y operarios"
                    style="background:#3b82f6; color:white; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-list-check"></i>
            </button>
            ${(['Admin', 'Jefe_Taller'].includes(usuarioActivo?.rol)) ? `
            <button onclick="abrirEditorFichaContrato(${jsStringAttr(v.codigo)})" title="Editar ficha / tela / notas"
                    style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>` : ''}
            ${(usuarioActivo?.rol === 'Admin') ? `
            <button onclick="gestionarEstadoVenta(${Number(v.id || 0)}, ${jsStringAttr(v.estado || '')})" title="Cambiar Estado / Anular"
                    style="background:#fee2e2; color:#b91c1c; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer;">
                <i class="fa-solid fa-gear"></i>
            </button>` : ''}
            ${(usuarioActivo?.rol === 'Vendedor' && v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
            <button onclick="abrirModalCambioPrecio(${jsStringAttr(v.codigo)}, ${Number(v.total || 0)})"
                    title="Proponer cambio de precio"
                    style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700;">
                <i class="fa-solid fa-tag"></i>
            </button>` : ''}
        </td>
    </tr>`).join('');

// === Cards (mobile) === CORREGIDO PARA MOSTRAR LA SEDE EN CELULARES
cards.style.display = isMobile ? 'grid' : 'none';
cards.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';
cards.style.gap = '15px';
cards.innerHTML = lista.map(v => `
    <div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <span style="font-weight:900; font-size:15px; color:#d4af37;">#${escapeHTML(v.codigo)}</span>
            ${ec(v)}
        </div>
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${escapeHTML(v.cliente)}</div>
        
        <div style="font-size:12px; color:#64748b; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
            <span>${escapeHTML(v.vendedor || 'Vendedor')}</span> ·
            <span>Emisión: <b>${escapeHTML(v.fecha_emision ? v.fecha_emision.split('-').reverse().join('/') : '—')}</b></span>
            · Entrega: <b>${escapeHTML(v.fecha_entrega || '—')}</b>
        </div>
        
        <div style="display:flex; gap:10px; font-size:13px; margin-bottom:12px;">
            <div style="flex:1; background:#f0fdf4; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:10px; color:#166534; font-weight:700;">TOTAL</div>
                <div style="font-weight:900; color:#166534;">S/ ${parseFloat(v.total||0).toFixed(2)}</div>
            </div>
            <div style="flex:1; background:#fff7ed; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:10px; color:#9a3412; font-weight:700;">SALDO</div>
                <div style="font-weight:900; color:#9a3412;">S/ ${parseFloat(v.saldo||0).toFixed(2)}</div>
            </div>
        </div>
        <button onclick="verDetalleContrato(${jsStringAttr(v.codigo)})"
                style="width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:${(usuarioActivo?.rol==='Vendedor'&&v.estado!=='Entregado'&&v.estado!=='Cancelado')?'8px':'0'};">
            <i class="fa-solid fa-eye"></i> Ver contrato
        </button>
        <button onclick="verSeguimientoVendedor(${jsStringAttr(v.codigo)})"
                style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:8px; margin-top:8px;">
            <i class="fa-solid fa-list-check"></i> Ver progreso de fabricación
        </button>
        ${(['Admin', 'Jefe_Taller'].includes(usuarioActivo?.rol)) ? `
        <button onclick="abrirEditorFichaContrato(${jsStringAttr(v.codigo)})"
                style="width:100%; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:8px;">
            <i class="fa-solid fa-pen-to-square"></i> Editar ficha / tela / notas
        </button>` : ''}
        ${(usuarioActivo?.rol === 'Vendedor' && v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
        <button onclick="abrirModalCambioPrecio(${jsStringAttr(v.codigo)}, ${Number(v.total || 0)})"
                style="width:100%; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
            <i class="fa-solid fa-tag"></i> Proponer cambio de precio
        </button>` : ''}
    </div>`).join('');
}

function verDetalleContrato(codigo) {
    // Abre el modal de detalle de pedido que ya existe en el sistema
    abrirDetallePedido(codigo);
}

async function abrirEditorFichaContrato(codigo) {
    if (!['Admin', 'Jefe_Taller'].includes(usuarioActivo?.rol)) {
        return Swal.fire('Sin permiso', 'Solo Admin o Jefe de Taller puede editar la ficha del contrato.', 'warning');
    }

    try {
        Swal.fire({ title: 'Cargando ficha...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/ventas/${codigo}/items-editables`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el contrato');
        Swal.close();

        const items = data.items || [];
        if (!items.length) return Swal.fire('Sin productos', 'Este contrato no tiene productos para editar.', 'info');

        let seleccionado = 0;
        const renderForm = () => {
            const it = items[seleccionado] || items[0];
            const opciones = items.map((x, idx) =>
                `<option value="${idx}" ${idx === seleccionado ? 'selected' : ''}>${escapeHTML(x.producto || 'Producto')}</option>`
            ).join('');
            return `
                <div style="text-align:left;font-size:12px;color:#334155;">
                    <label style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">Producto del contrato</label>
                    <select id="efc-item" class="swal2-input" style="margin:5px 0 12px;width:100%;"
                        onchange="window._efcCambiarItemContrato(this.value)">
                        ${opciones}
                    </select>

                    <label style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">Nombre del mueble</label>
                    <input id="efc-producto" class="swal2-input" style="margin:5px 0 12px;width:100%;" value="${escapeAttr(it.producto || '')}">

                    <label style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">Precio S/</label>
                    <input id="efc-precio" type="number" step="0.01" min="0" class="swal2-input" style="margin:5px 0 12px;width:100%;" value="${Number(it.precio_unitario || 0).toFixed(2)}">

                    <label style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">Plantilla / tela / notas de casqueria</label>
                    <textarea id="efc-detalles" class="swal2-textarea"
                        style="margin:5px 0 0;width:100%;min-height:260px;font-size:12px;line-height:1.45;resize:vertical;"
                        placeholder="Aqui puedes cambiar tela, medidas, notas de casqueria, zocalo, brazos, pinterest, etc.">${escapeHTML(it.detalles || '')}</textarea>
                    <div style="font-size:10px;color:#64748b;margin-top:7px;">
                        Esto actualiza la ficha tecnica del item del contrato. Las areas que lean la ficha del mueble veran este texto actualizado.
                    </div>
                </div>`;
        };

        window._efcCambiarItemContrato = (idx) => {
            seleccionado = Number(idx) || 0;
            const container = document.getElementById('efc-editor-wrap');
            if (container) container.innerHTML = renderForm();
        };

        const { value: datos, isConfirmed } = await Swal.fire({
            title: `Editar ficha #${escapeHTML(codigo)}`,
            width: 760,
            html: `<div id="efc-editor-wrap">${renderForm()}</div>`,
            showCancelButton: true,
            confirmButtonText: 'Guardar ficha',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#047857',
            preConfirm: () => {
                const it = items[seleccionado] || items[0];
                const producto = document.getElementById('efc-producto')?.value.trim();
                const precio = parseFloat(document.getElementById('efc-precio')?.value || 0);
                const detalles = document.getElementById('efc-detalles')?.value.trim();
                if (!producto) {
                    Swal.showValidationMessage('El nombre del mueble es obligatorio');
                    return false;
                }
                if (Number.isNaN(precio) || precio < 0) {
                    Swal.showValidationMessage('Ingresa un precio valido');
                    return false;
                }
                return { item_id: it.id, producto, precio_unitario: precio, detalles };
            }
        });
        if (!isConfirmed || !datos) return;

        const payload = {
            producto: datos.producto,
            precio_unitario: datos.precio_unitario,
            detalles: datos.detalles,
        };

        const save = await apiFetch(`${API_URL}/api/ventas/${codigo}/items/${datos.item_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const out = await save.json();
        if (!save.ok || out.error) throw new Error(out.error || 'No se pudo guardar');

        Swal.fire({ icon:'success', title:'Ficha actualizada', text: out.mensaje || 'Contrato actualizado.', timer:1800, showConfirmButton:false });
        loadContratos();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo editar la ficha.', 'error');
    }
}

async function verHistorialPrecios(codigo) {
    try {
        Swal.fire({ title: 'Cargando historial...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/ventas/${codigo}/historial-precios`);
        const data = await res.json();
        Swal.close();

        if (!data.length) return Swal.fire('Sin cambios', 'Este contrato mantiene su precio original.', 'info');

        let html = `
            <div style="text-align:left; max-height:400px; overflow-y:auto; padding:5px;">
                ${data.map(h => {
                    const colorEstado = h.estado === 'Aprobado' ? '#10b981' : (h.estado === 'Rechazado' ? '#ef4444' : '#f59e0b');
                    return `
                    <div style="border-bottom:1px solid #eee; padding:10px 0; font-size:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-weight:900; color:${colorEstado}">${escapeHTML(String(h.estado || '').toUpperCase())}</span>
                            <span style="color:gray;">${escapeHTML(h.fecha_solicitud || '')}</span>
                        </div>
                        <div style="margin-bottom:5px;">
                            De <b>S/ ${h.price_original?.toFixed(2) || h.precio_original?.toFixed(2)}</b> 
                            a <b style="color:#d4af37">S/ ${h.price_nuevo?.toFixed(2) || h.precio_nuevo?.toFixed(2)}</b>
                        </div>
                        <div style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:5px; color:#475569;">
                            <b>Motivo:</b> ${escapeHTML(h.motivo || '')}
                        </div>
                        <div style="font-size:11px;">
                            Solicitó: <b>${escapeHTML(h.vendedor || '')}</b><br>
                            ${h.admin ? `Resuelto por: <b>${escapeHTML(h.admin)}</b>` : ''}
                            ${h.notas_admin ? `<br><i style="color:gray;">"${escapeHTML(h.notas_admin)}"</i>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        Swal.fire({
            title: `Historial de Precios #${escapeHTML(codigo)}`,
            html: html,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a',
            width: '450px'
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el historial.', 'error');
    }
}

// ==========================================
// MÓDULO: CAMBIO DE PRECIO / MATERIAL / PRODUCTO NUEVO
// ==========================================
// Flujo:
//   Paso 1 → se listan los productos del contrato (o "Agregar producto nuevo")
//   Paso 2 → según lo elegido, se pide precio, tela/material, o nombre+precio
// _cambioPrecioActual guarda todo el contexto necesario para armar el POST.
let _cambioPrecioActual = null; // { codigo, item: {id, producto, precio_unitario} | null }

async function abrirModalCambioPrecio(codigo) {
    _cambioPrecioActual = { codigo, item: null, tipo: null };
    document.getElementById('cambio-precio-codigo-label').textContent = `Contrato #${codigo}`;
    document.getElementById('cp-paso-1').style.display = 'block';
    document.getElementById('cp-paso-2').style.display = 'none';
    document.getElementById('modal-cambio-precio').style.display = 'flex';

    const lista = document.getElementById('cp-lista-productos');
    lista.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">Cargando productos...</p>';

    try {
        const res  = await apiFetch(`${API_URL}/api/ventas/${codigo}/items-editables`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el contrato');

        _cambioPrecioActual.items = data.items || [];

        if (_cambioPrecioActual.items.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">Este contrato no tiene productos registrados.</p>';
            return;
        }

        lista.innerHTML = _cambioPrecioActual.items.map((it, idx) => `
            <div onclick="cpSeleccionarProducto(${idx})" style="display:flex; align-items:center; gap:10px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:8px 10px; cursor:pointer; transition:0.15s;">
                <img src="${escapeAttr(it.foto || 'imagenes/sin_foto.jpg')}" onerror="this.src='imagenes/sin_foto.jpg'" style="width:42px; height:42px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:800; color:#0f172a; font-size:13px;">${escapeHTML(it.producto || '')}</div>
                    <div style="font-size:11px; color:#64748b;">${escapeHTML(it.detalles || 'Sin tela registrada')}</div>
                </div>
                <div style="font-weight:800; color:#065f46; font-size:13px; white-space:nowrap;">S/ ${Number(it.precio_unitario || 0).toFixed(2)}</div>
            </div>
        `).join('');
    } catch (e) {
        lista.innerHTML = `<p style="color:#ef4444; font-size:12px;">Error: ${escapeHTML(e.message)}</p>`;
    }
}

function cpSeleccionarProducto(idx) {
    // idx === null → el usuario eligió "Agregar producto nuevo al contrato"
    _cambioPrecioActual.item = (idx === null) ? null : _cambioPrecioActual.items[idx];

    document.getElementById('cp-paso-1').style.display = 'none';
    document.getElementById('cp-paso-2').style.display = 'block';

    const box = document.getElementById('cp-producto-actual-box');
    const selectorTipo   = document.getElementById('cp-selector-tipo');
    const campoNombre    = document.getElementById('cp-campo-nombre-nuevo');

    document.getElementById('input-precio-nuevo').value    = '';
    document.getElementById('input-material-nuevo').value  = '';
    document.getElementById('input-precio-material').value = '';
    document.getElementById('input-nombre-producto-nuevo').value = '';
    document.getElementById('input-motivo-precio').value   = '';

    if (_cambioPrecioActual.item) {
        box.innerHTML = `<strong>${escapeHTML(_cambioPrecioActual.item.producto || '')}</strong><br>Precio actual: <strong style="color:#d97706;">S/ ${Number(_cambioPrecioActual.item.precio_unitario || 0).toFixed(2)}</strong>`;
        selectorTipo.style.display = 'flex';
        campoNombre.style.display  = 'none';
        cpElegirTipo('precio');
    } else {
        box.innerHTML = `<strong>Producto nuevo</strong> — se agregará como un ítem adicional al contrato.`;
        selectorTipo.style.display = 'none';
        campoNombre.style.display  = 'block';
        document.getElementById('cp-campo-precio').style.display    = 'block';
        document.getElementById('cp-campo-material').style.display  = 'none';
        _cambioPrecioActual.tipo = 'nuevo_producto';
    }
}

function cpVolverPaso1() {
    document.getElementById('cp-paso-1').style.display = 'block';
    document.getElementById('cp-paso-2').style.display = 'none';
}

function cpElegirTipo(tipo) {
    _cambioPrecioActual.tipo = tipo;
    document.querySelectorAll('.cp-tipo-btn').forEach(btn => {
        const activo = btn.dataset.tipo === tipo;
        btn.style.background  = activo ? '#fef3c7' : 'white';
        btn.style.borderColor = activo ? '#d97706' : '#e2e8f0';
        btn.style.color       = activo ? '#92400e' : '#475569';
    });
    document.getElementById('cp-campo-precio').style.display   = (tipo === 'precio') ? 'block' : 'none';
    document.getElementById('cp-campo-material').style.display = (tipo === 'material') ? 'block' : 'none';
}

function cerrarModalCambioPrecio() {
    document.getElementById('modal-cambio-precio').style.display = 'none';
    _cambioPrecioActual = null;
}

async function enviarCambioPrecio() {
    if (!_cambioPrecioActual || !_cambioPrecioActual.tipo) return;
    const { codigo, item, tipo } = _cambioPrecioActual;
    const motivo = document.getElementById('input-motivo-precio').value.trim();

    if (!motivo) {
        return Swal.fire('Campo requerido', 'Debes ingresar el motivo del cambio.', 'warning');
    }

    const payload = {
        tipo_cambio:     tipo,
        motivo:          motivo,
        vendedor_id:     usuarioActivo?.id,
        vendedor_nombre: usuarioActivo?.nombre
    };

    if (tipo === 'precio') {
        const precioNuevo = parseFloat(document.getElementById('input-precio-nuevo').value);
        if (!precioNuevo || precioNuevo <= 0) {
            return Swal.fire('Campo requerido', 'Ingresa el nuevo precio.', 'warning');
        }
        payload.item_id      = item.id;
        payload.precio_nuevo = precioNuevo;
    } else if (tipo === 'material') {
        const materialNuevo = document.getElementById('input-material-nuevo').value.trim();
        const precioMaterial = document.getElementById('input-precio-material').value;
        if (!materialNuevo) {
            return Swal.fire('Campo requerido', 'Describe la tela o material nuevo.', 'warning');
        }
        payload.item_id       = item.id;
        payload.detalle_nuevo = materialNuevo;
        if (precioMaterial) payload.precio_nuevo = parseFloat(precioMaterial);
    } else if (tipo === 'nuevo_producto') {
        const nombreNuevo = document.getElementById('input-nombre-producto-nuevo').value.trim();
        const precioNuevo = parseFloat(document.getElementById('input-precio-nuevo').value);
        if (!nombreNuevo) {
            return Swal.fire('Campo requerido', 'Ingresa el nombre del producto nuevo.', 'warning');
        }
        if (!precioNuevo || precioNuevo <= 0) {
            return Swal.fire('Campo requerido', 'Ingresa el precio del producto nuevo.', 'warning');
        }
        payload.producto_nombre = nombreNuevo;
        payload.precio_nuevo    = precioNuevo;
    }

    try {
        const res = await apiFetch(`${API_URL}/api/ventas/${codigo}/proponer-cambio-precio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        cerrarModalCambioPrecio();
        Swal.fire('✅ Enviado', 'Tu solicitud fue enviada al administrador para aprobación.', 'success');
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function cargarCambiosPrecioPendientes() {
    const contenedor = document.getElementById('lista-cambios-precio');
    const badge      = document.getElementById('badge-cambios-precio');
    if (!contenedor) return;

    contenedor.style.display = 'grid';
    contenedor.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))';
    contenedor.style.gap = '15px';

    try {
        const res  = await apiFetch(`${API_URL}/api/cambios-precio/pendientes`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.length === 0) {
            contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px; grid-column:1/-1;">Sin solicitudes pendientes.</p>';
            badge.style.display = 'none';
            return;
        }

        badge.textContent     = `${data.length} pendiente${data.length > 1 ? 's' : ''}`;
        badge.style.display   = 'inline-block';

        const ETIQUETA_TIPO = {
            precio:         { texto: 'Cambio de precio',   color: '#1d4ed8', bg: '#eff6ff' },
            material:       { texto: 'Tela / Material',    color: '#7c3aed', bg: '#f5f3ff' },
            nuevo_producto: { texto: 'Producto nuevo',     color: '#0f766e', bg: '#f0fdfa' },
        };

        contenedor.innerHTML = data.map(c => {
            const diff      = c.precio_nuevo - c.precio_original;
            const esSube    = diff > 0;
            const diffLabel = `${esSube ? '▲' : '▼'} S/ ${Math.abs(diff).toFixed(2)}`;
            const diffColor = esSube ? '#ef4444' : '#10b981';
            const tipoInfo  = ETIQUETA_TIPO[c.tipo_cambio] || ETIQUETA_TIPO.precio;
            const mostrarDiff = c.tipo_cambio !== 'nuevo_producto';
            return `
            <div style="background:white; border:1px solid #fde68a; border-radius:12px; padding:16px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                        <span style="font-weight:900; color:#d97706; font-size:14px;">#${escapeHTML(c.codigo_venta)}</span>
                        <span style="font-size:12px; color:#64748b; margin-left:8px;">${escapeHTML(c.cliente)}</span>
                    </div>
                    ${mostrarDiff ? `<span style="font-size:11px; font-weight:700; color:${diffColor}; background:${esSube?'#fef2f2':'#f0fdf4'}; padding:2px 8px; border-radius:20px;">${diffLabel}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <span style="font-size:10px; font-weight:800; color:${tipoInfo.color}; background:${tipoInfo.bg}; padding:2px 8px; border-radius:20px; text-transform:uppercase;">${tipoInfo.texto}</span>
                    <span style="font-size:12px; font-weight:700; color:#334155;"><i class="fa-solid fa-couch"></i> ${escapeHTML(c.producto)}</span>
                </div>
                ${c.tipo_cambio === 'material' ? `
                <div style="background:#f5f3ff; border-radius:8px; padding:8px 10px; margin-bottom:10px; font-size:12px; color:#5b21b6;">
                    <strong>Tela/material nuevo:</strong> ${escapeHTML(c.detalle_nuevo || '—')}
                </div>` : ''}
                <div style="display:flex; gap:10px; margin-bottom:10px; font-size:13px;">
                    <div style="flex:1; text-align:center; background:#f8fafc; border-radius:8px; padding:8px;">
                        <div style="font-size:10px; color:#64748b; font-weight:700;">${c.tipo_cambio === 'nuevo_producto' ? 'ANTES' : 'ACTUAL'}</div>
                        <div style="font-weight:900; color:#0f172a;">S/ ${c.precio_original.toFixed(2)}</div>
                    </div>
                    <div style="flex:1; text-align:center; background:#fffbeb; border-radius:8px; padding:8px;">
                        <div style="font-size:10px; color:#92400e; font-weight:700;">${c.tipo_cambio === 'nuevo_producto' ? 'PRECIO NUEVO ITEM' : 'PROPUESTO'}</div>
                        <div style="font-weight:900; color:#d97706;">S/ ${c.precio_nuevo.toFixed(2)}</div>
                    </div>
                </div>
                <div style="background:#f8fafc; border-radius:8px; padding:10px; margin-bottom:12px; font-size:12px; color:#475569;">
                    <strong>Motivo:</strong> ${escapeHTML(c.motivo || '')}
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">
                    Solicitado por <strong>${escapeHTML(c.vendedor || '')}</strong> · ${escapeHTML(c.fecha_solicitud || '')}
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="resolverCambioPrecio(${Number(c.id || 0)}, 'aprobar')"
                            style="flex:1; padding:9px; background:#065f46; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:800; font-size:12px;">
                        <i class="fa-solid fa-check"></i> Aprobar
                    </button>
                    <button onclick="resolverCambioPrecio(${Number(c.id || 0)}, 'rechazar')"
                            style="flex:1; padding:9px; background:#7f1d1d; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:800; font-size:12px;">
                        <i class="fa-solid fa-xmark"></i> Rechazar
                    </button>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        contenedor.innerHTML = `<p style="color:#ef4444; font-size:13px;">Error: ${escapeHTML(e.message)}</p>`;
    }
}

async function resolverCambioPrecio(cambioId, accion) {
    const esAprobar = accion === 'aprobar';
    let notasAdmin  = '';

    if (!esAprobar) {
        const { value, isConfirmed } = await Swal.fire({
            title: 'Rechazar solicitud',
            input: 'textarea',
            inputLabel: 'Motivo del rechazo (opcional)',
            inputPlaceholder: 'Ej: El precio ya fue acordado con el cliente...',
            showCancelButton: true,
            confirmButtonText: 'Rechazar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#991b1b',
        });
        if (!isConfirmed) return;
        notasAdmin = value || '';
    } else {
        const confirm = await Swal.fire({
            title: '¿Aprobar cambio de precio?',
            text: 'El monto total de la venta se actualizará inmediatamente.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#065f46',
        });
        if (!confirm.isConfirmed) return;
    }

    try {
        const url = `${API_URL}/api/cambios-precio/${cambioId}/${esAprobar ? 'aprobar' : 'rechazar'}`;
        const res = await apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id:     usuarioActivo?.id,
                admin_nombre: usuarioActivo?.nombre,
                notas_admin:  notasAdmin
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        Swal.fire('✅ Listo', data.mensaje, 'success');
        cargarCambiosPrecioPendientes();
        if (typeof loadContratos === 'function') loadContratos();

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function descargarExcelContratos() {
    const desde = document.getElementById('contratos-desde')?.value;
    const hasta = document.getElementById('contratos-hasta')?.value;
    const btn = document.getElementById('btn-exportar-excel-contratos');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    try {
        let url = `${API_URL}/api/ventas/exportar`;
        const params = [];
        if (desde) params.push(`inicio=${desde}`);
        if (hasta) params.push(`fin=${hasta}`);
        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const res = await apiFetch(url);

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'No se pudo generar el Excel. El servidor devolvió un error.');
        }

        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = `reporte_ventas_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
    } catch (e) {
        Swal.fire('Error', e.message || 'Fallo al generar el Excel. Revisa la conexión.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Exportar Excel';
        }
    }
}

// ==========================================
// GESTIÓN MANUAL DE ESTADO Y ANULACIÓN (ADMIN)
// ==========================================
async function gestionarEstadoVenta(ventaId, estadoActual) {
    const { value: accion } = await Swal.fire({
        title: 'Gestionar Venta',
        input: 'select',
        inputOptions: {
            'Estados': {
                'Pendiente': 'Marcar como Pendiente',
                'En producción': 'Marcar como En Producción',
                'Listo': 'Marcar como Listo',
                'Despachado': 'Marcar como Despachado',
                'Entregado': 'Marcar como Entregado'
            },
            'Peligro': {
                'ANULAR': '❌ ANULAR VENTA (cancela, conserva el registro)',
                'ELIMINAR': '🗑️ ELIMINAR POR COMPLETO ESTA VENTA (borra todo)'
            }
        },
        inputPlaceholder: 'Selecciona una acción',
        showCancelButton: true,
        confirmButtonColor: '#0f172a'
    });

    if (!accion) return;

    if (accion === 'ELIMINAR') {
        return _eliminarVentaCompleta(ventaId);
    }

    try {
        let url, body;
        if (accion === 'ANULAR') {
            const confirm = await Swal.fire({ title: '¿Seguro?', text: 'Esto cancelará el pedido, vaciará los tickets del taller y cancelará la logística externa.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#b91c1c' });
            if (!confirm.isConfirmed) return;
            url = `${API_URL}/api/ventas/${ventaId}/anular`;
        } else {
            url = `${API_URL}/api/ventas/${ventaId}/estado`;
            body = JSON.stringify({ estado: accion });
        }

        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(url, { method: accion === 'ANULAR' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: body });
        const data = await res.json();
        
        if (data.exito) {
            Swal.fire('Éxito', data.mensaje, 'success');
            loadContratos();
        } else throw new Error(data.error);
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function _limpiarHtmlReporteRapido(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

async function abrirReporteVentasRapidas() {
    const desde = document.getElementById('contratos-desde')?.value || '';
    const hasta = document.getElementById('contratos-hasta')?.value || '';
    const params = new URLSearchParams({ limit: 300 });
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);

    try {
        Swal.fire({ title: 'Cargando ventas rapidas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/ventas/rapidas?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'No se pudo cargar el reporte');

        const items = data.items || [];
        const resumen = `
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;">
                    <div style="font-size:10px;font-weight:900;color:#9a3412;">ITEMS</div>
                    <div style="font-size:22px;font-weight:900;color:#9a3412;">${data.total_items || 0}</div>
                </div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;">
                    <div style="font-size:10px;font-weight:900;color:#166534;">MONTO</div>
                    <div style="font-size:22px;font-weight:900;color:#166534;">S/ ${parseFloat(data.total_monto || 0).toFixed(2)}</div>
                </div>
            </div>
        `;

        const lista = items.length
            ? items.map(it => `
                <div style="display:grid;grid-template-columns:58px 1fr auto;gap:10px;align-items:start;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:8px;background:white;text-align:left;">
                    <img src="${it.foto_url || 'imagenes/sin_foto.jpg'}" onerror="this.src='imagenes/sin_foto.jpg'"
                         style="width:58px;height:58px;object-fit:cover;border-radius:6px;background:#f8fafc;">
                    <div>
                        <div style="font-size:12px;font-weight:900;color:#0f172a;">${it.producto || 'Venta rapida'}</div>
                        <div style="font-size:11px;color:#64748b;">#${it.codigo} · ${it.cliente || ''}</div>
                        <div style="font-size:11px;color:#64748b;">${it.sede || 'Sin sede'} · ${it.vendedor || 'Sin vendedor'} · ${it.fecha_emision || ''}</div>
                        <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${_limpiarHtmlReporteRapido(it.detalles).slice(0, 180)}</div>
                    </div>
                    <div style="font-size:12px;font-weight:900;color:#166534;white-space:nowrap;">S/ ${parseFloat(it.precio || 0).toFixed(2)}</div>
                </div>
            `).join('')
            : '<p style="text-align:center;color:#94a3b8;padding:24px;">No hay ventas rapidas para este rango.</p>';

        Swal.fire({
            title: '<i class="fa-solid fa-bolt" style="color:#d97706;"></i> Ventas rapidas',
            html: `<div style="max-height:65vh;overflow:auto;">${resumen}${lista}</div>`,
            width: '760px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function enviarResumenOperativo() {
    try {
        Swal.fire({
            title: 'Enviando resumen operativo...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        const res = await apiFetch(`${API_URL}/api/notificaciones/resumen-operativo`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'No se pudo enviar el resumen');

        const notif = data.notificaciones || {};
        Swal.fire({
            title: 'Resumen enviado',
            html: `
                <div style="text-align:left;font-size:13px;line-height:1.55;">
                    <p><b>Correos enviados:</b> ${notif.enviados || 0}</p>
                    <p><b>Omitidos:</b> ${notif.omitidos || 0}</p>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:10px 0;">
                    <p><b>Tickets pendientes:</b> ${data.tickets_pendientes || 0}</p>
                    <p><b>Tickets bloqueados:</b> ${data.tickets_bloqueados || 0}</p>
                    <p><b>Logistica externa pendiente:</b> ${data.logistica_externa_pendiente || 0}</p>
                    <p><b>Cambios de precio pendientes:</b> ${data.cambios_precio_pendientes || 0}</p>
                </div>
            `,
            icon: (notif.enviados || 0) > 0 ? 'success' : 'warning',
            confirmButtonColor: '#0f172a'
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

/**
 * Elimina una venta POR COMPLETO (DELETE real en cascada: items, tickets
 * de taller, pagos, logística y cambios de precio) — a diferencia de
 * "Anular", que solo cambia el estado y conserva el registro.
 * Exige un motivo, porque la acción es irreversible y queda auditada
 * en el backend (ventas_eliminadas_log) junto con quién la ejecutó.
 */
async function _eliminarVentaCompleta(ventaId) {
    const { value: motivo, isConfirmed: pasoMotivo } = await Swal.fire({
        title: '🗑️ Eliminar venta por completo',
        html: `
            <p style="text-align:left; font-size:13px; color:#7f1d1d; background:#fef2f2; border-left:4px solid #dc2626; padding:10px 12px; border-radius:6px; margin-bottom:14px;">
                Esta acción <b>borra la venta y todo lo relacionado</b> (productos, tickets de taller, pagos, logística
                y cambios de precio) <b>como si nunca hubiera existido</b>. No se puede deshacer.
            </p>
        `,
        input: 'textarea',
        inputLabel: 'Motivo de la eliminación (obligatorio)',
        inputPlaceholder: 'Ej: Venta duplicada por error, pedido de prueba, cliente nunca pagó y se registró por error...',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#7f1d1d',
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'Debes indicar el motivo para poder continuar.';
        }
    });
    if (!pasoMotivo || !motivo) return;

    const { isConfirmed: confirmoFinal } = await Swal.fire({
        title: '¿Confirmas la eliminación definitiva?',
        text: 'Se borrará todo rastro operativo de esta venta. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar para siempre',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7f1d1d',
    });
    if (!confirmoFinal) return;

    try {
        Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/ventas/${ventaId}/eliminar-completo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                motivo:       motivo.trim(),
                admin_id:     usuarioActivo?.id,
                admin_nombre: usuarioActivo?.nombre
            })
        });
        const data = await res.json();
        if (!res.ok || !data.exito) throw new Error(data.error || 'No se pudo eliminar la venta');

        Swal.fire('Eliminada', data.mensaje, 'success');
        loadContratos();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function abrirModalLote() {
    try {
        const res = await apiFetch(`${API_URL}/api/logistica/pendientes-por-proveedor`);
        const proveedores = await res.json();

        if (!proveedores || proveedores.length === 0) {
            return Swal.fire('Sin pendientes', 'No hay materiales pendientes asignados a un proveedor.', 'info');
        }

        const opcionesProv = proveedores.map(p => `<option value="${p.proveedor_id}">${p.proveedor_nombre} (${p.items.length} items)</option>`).join('');

        const { value: provId } = await Swal.fire({
            title: 'Cotización por lote',
            html: `
                <label style="font-weight:bold;display:block;margin-bottom:8px;text-align:left;">Selecciona el proveedor:</label>
                <select id="swal-prov-lote" class="swal2-input" style="width:100%; margin:0;">
                    ${opcionesProv}
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: 'Siguiente',
            preConfirm: () => document.getElementById('swal-prov-lote').value
        });

        if (!provId) return;
        const proveedorSelec = proveedores.find(p => p.proveedor_id == provId);

        let itemsHtml = proveedorSelec.items.map((item, idx) => `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; text-align:left; background:#f8fafc; padding:8px; border-radius:6px;">
                <input type="checkbox" id="chk-lote-${idx}" class="chk-lote-item" value="${idx}" checked style="width:18px;height:18px;">
                <img src="${item.foto_url || 'imagenes/sin_foto.jpg'}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
                <div style="line-height:1.2;">
                    <strong style="font-size:13px;">${item.insumo_nombre}</strong><br>
                    <span style="font-size:11px;color:#64748b;">SKU: ${item.sku || 'N/A'} | Cant: ${item.cantidad || 0} ${item.unidad || ''}</span>
                </div>
            </div>
        `).join('');

        const { value: confirmLote } = await Swal.fire({
            title: 'Seleccionar Materiales',
            html: `<div style="max-height:300px; overflow-y:auto; margin-bottom:10px;">${itemsHtml}</div>`,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-brands fa-whatsapp"></i> Crear Lote y Enviar',
            confirmButtonColor: '#25D366',
            preConfirm: () => {
                const checkboxes = document.querySelectorAll('.chk-lote-item:checked');
                if (checkboxes.length === 0) { Swal.showValidationMessage('Debes seleccionar al menos un material'); return false; }
                return Array.from(checkboxes).map(chk => proveedorSelec.items[chk.value]);
            }
        });
        if (!confirmLote) return;

        Swal.fire({ title: 'Generando link...', didOpen: () => Swal.showLoading() });
        const resLote = await apiFetch(`${API_URL}/api/logistica/crear-lote-cotizacion`, {
            method: 'POST', body: JSON.stringify({ proveedor_id: provId, items: confirmLote })
        });
        const dLote = await resLote.json();
        if (!resLote.ok || !dLote.exito) throw new Error(dLote.error || 'Error al generar el lote');

        let tel = (dLote.telefono || '').replace(/[\s\-\(\)]/g, '');
        if (!tel.startsWith('+')) tel = '51' + tel.replace(/^0+/, '');

        let msgItems = dLote.items.map((it, i) => `${i+1}. 📦 *${it.sku ? it.sku + ' — ' : ''}${it.insumo_nombre}* | Cant: ${it.cantidad || 0} ${it.unidad || ''}`).join('\n');

        const msgWsp = [
            `Hola ${dLote.nombre_proveedor} 👋, somos *Innova Möbili*.`,``,`Le solicitamos cotización de los siguientes materiales:`,``,msgItems,``,
            `Por favor ingrese al siguiente link para enviarnos sus precios y fechas:`,`👉 ${dLote.link}`,``,`Tiene 3 días hábiles para responder. Gracias 🙏`
        ].join('\n');

        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWsp)}`, '_blank');
        cargarLogisticaExterna();
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
}

