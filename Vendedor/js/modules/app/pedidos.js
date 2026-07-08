// App - seguimiento de pedidos del vendedor
/* --- SEGUIMIENTO DE PEDIDOS (CONEXIÓN CON PYTHON) --- */
/* ================================================================= */
async function loadMisPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;

    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))';
    container.style.gap = '15px';
    container.innerHTML = `<p style="text-align:center; padding:20px; color:gray; grid-column:1/-1;">Cargando seguimiento...</p>`;

    try {
       // ✅ CORRECCIÓN:
        if (!usuarioActivo) return; // salir sin hacer el fetch
        const idVendedor = usuarioActivo.id;
        const res = await apiFetch(`${API_URL}/api/mis-ventas/${idVendedor}`);
        const data = await res.json();
        
        if (data.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:40px; grid-column:1/-1;">No hay pedidos registrados.</p>`;
            return;
        }

        container.innerHTML = data.map(v => `
            <div class="pedido-card" onclick="verSeguimientoVendedor('${v.codigo}')" style="background:white; padding:15px; border-radius:10px; border:1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:800; color:#1a1a1a;">#${v.codigo}</span>
                    <small style="color:#d4af37; font-weight:800;">${v.estado.toUpperCase()}</small>
                </div>
                <p style="font-weight:700; margin:0 0 10px 0; font-size:14px; color:#1e293b;">${v.cliente.toUpperCase()}</p>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:900; color:#10b981; font-size:13px;">S/ ${v.monto_total.toFixed(2)}</span>
                    <span style="font-size:10px; color:#64748b;">Entrega: <b>${v.entrega}</b></span>
                </div>

                <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO: ${v.progreso}%</div>
                <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                    <div style="width:${v.progreso}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                </div>

                <div style="display:flex; gap:8px; margin-top:15px;">
                    <button onclick="event.stopPropagation(); abrirDetallePedido('${v.codigo}')" style="flex:1; background:#0f172a; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-eye"></i> Ver Ficha
                    </button>
                    <button onclick="event.stopPropagation(); verSeguimientoVendedor('${v.codigo}')" style="flex:1; background:#3b82f6; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-list-check"></i> Progreso
                    </button>
                    ${(v.estado !== 'Entregado' && v.estado !== 'Cancelado') ? `
                    <button onclick="event.stopPropagation(); abrirModalCambioPrecio('${v.codigo}', ${v.monto_total})" style="flex:1; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-tag"></i> Cambiar Precio
                    </button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</p>`;
    }
}


async function verSeguimientoVendedor(codigo) {
    try {
        Swal.fire({ title: 'Cargando progreso...', didOpen: () => Swal.showLoading() });
        const res = await apiFetch(`${API_URL}/api/seguimiento/pedido/${codigo}`);
        const d = await res.json();
        
        if (!res.ok || d.error) {
            return Swal.fire('Error', d.error || 'No se pudo cargar el progreso.', 'error');
        }

        const pct = d.estado.raw === 'Entregado' ? 100 : (d.progreso?.porcentaje || 0);
        
        function _formatArea(area) {
            const nombres = {
                'CORTE_Y_CONTROL_TELAS':    'Corte de telas',
                'TAPICERIA_SOFAS':          'Tapicería sofás',
                'TAPICERIA_SILLAS':         'Tapicería sillas',
                'ESTRUCTURAS_MUEBLES':      'Estructuras',
                'ESTRUCTURAS_SILLAS':       'Estructuras sillas',
                'ARMADO_COJINES':           'Cojines',
                'PREPARACION_PATAS_ZOCALO': 'Patas y zócalo',
                'TABLEROS_Y_PIEDRAS':       'Tableros',
                'DESPACHO_CENTRAL':         'Despacho',
            };
            return nombres[area] || area.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
        }

        const areasHTML = (d.areas || []).length > 0 ? `
            <div style="margin-top: 15px;">
                <div style="font-size:12px; font-weight:bold; color:gray; margin-bottom:10px;">AVANCE POR ÁREA</div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${d.areas.map(a => {
                        const trabajadores = a.trabajadores && a.trabajadores.length > 0 ? a.trabajadores.join(', ') : 'Sin asignar';
                        const colorBarra = a.listo ? '#22c55e' : (a.porcentaje > 0 ? '#3b82f6' : '#e2e8f0');
                        return `
                        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <strong style="font-size:12px; color:#1e293b;">${_formatArea(a.area)}</strong>
                                <span style="font-size:11px; font-weight:bold; color:${a.listo ? '#166534' : '#1e40af'};">${a.listo ? '✓ Listo' : a.porcentaje + '%'}</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-bottom:8px;">
                                <i class="fa-solid fa-user-gear"></i> ${trabajadores}
                            </div>
                            <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                                <div style="width:${a.porcentaje}%; height:100%; background:${colorBarra}; transition:0.3s;"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '<p style="font-size:12px; color:gray; margin-top:10px;">Sin áreas de producción registradas.</p>';

        Swal.fire({
            title: `Seguimiento #${codigo}`,
            html: `
                <div style="text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:14px; font-weight:800;">${d.cliente}</span>
                        <span style="font-size:11px; background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:4px; font-weight:bold;">${d.estado.label}</span>
                    </div>
                    
                    <div style="font-size:12px; color:gray; margin-bottom:15px;">
                        Entrega estimada: <b>${d.fecha_entrega}</b>
                    </div>

                    <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO GLOBAL: ${pct}%</div>
                    <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                    </div>

                    ${areasHTML}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a',
            width: '450px'
        });

    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

/* ================================================================= */
