// ────────────────────────────────────────────────────────────────
// PORTAL DE SEGUIMIENTO — Innova Mobili
// ────────────────────────────────────────────────────────────────

let _psEmailActual = '';

function abrirSeguimiento() {
  document.getElementById('portal-seguimiento').style.display = 'block';
  document.body.style.overflow = 'hidden';

  // Adaptamos el buscador para que acepte tanto correos como número de contrato
// Forzar la actualización visual de los textos desde JavaScript al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('ps-email-input');
  if (input) {
      input.placeholder = "Correo o N° de contrato (ej: INV-0001)";
      input.type = "text";
  }
  
  // Buscar y reemplazar el texto estático en el portal de seguimiento
  const portal = document.getElementById('portal-seguimiento');
  if (portal) {
      const cambiarTexto = (nodo) => {
          if (nodo.nodeType === 3 && nodo.nodeValue.includes('Ingresa tu correo para ver el avance')) {
              nodo.nodeValue = nodo.nodeValue.replace('Ingresa tu correo para ver el avance de tus muebles', 'Ingresa tu correo o N° de contrato para ver el avance de tus pedidos');
          } else if (nodo.nodeType === 1 && nodo.nodeName !== 'SCRIPT') {
              nodo.childNodes.forEach(cambiarTexto);
          }
      };
      cambiarTexto(portal);
  }
});

function abrirSeguimiento() {
  document.getElementById('portal-seguimiento').style.display = 'block';
  document.body.style.overflow = 'hidden';

  // Si el cliente ya está logueado, autocargar
  const sesion = localStorage.getItem('usuarioInnova');
  if (sesion) {
    try {
      const u = JSON.parse(sesion);
      if (u.email && u.rol === 'Cliente') {
        document.getElementById('ps-email-input').value = u.email;
        buscarPedidos();
        return;
      }
    } catch(e) {}
  }
}

function abrirPortalCliente(email) {
  /* Llamar desde el login cuando rol === 'Cliente' */
  document.getElementById('portal-seguimiento').style.display = 'block';
  document.body.style.overflow = 'hidden';
  document.getElementById('ps-email-input').value = email;
  buscarPedidos();
}

function cerrarSeguimiento() {
  document.getElementById('portal-seguimiento').style.display = 'none';
  document.body.style.overflow = '';
  _psReset();
}

function _psReset() {
  ['ps-loader','ps-error','ps-saludo','ps-lista','ps-detalle'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

async function buscarPedidos() {
  const inputVal = document.getElementById('ps-email-input').value.trim();
  if (!inputVal) {
    document.getElementById('ps-email-input').focus();
    return;
  }
  _psEmailActual = inputVal;
  _psReset();
  document.getElementById('ps-loader').style.display = 'flex';

  // Si contiene un "@", asumimos que busca por correo como antes
  if (inputVal.includes('@')) {
    try {
      const res = await fetch(`${API_URL}/api/seguimiento/mis-pedidos?email=${encodeURIComponent(inputVal)}`);
      const data = await res.json();
      document.getElementById('ps-loader').style.display = 'none';
  
      if (!res.ok || data.error) {
        _psShowError(data.error || 'No se encontraron pedidos para este correo.');
        return;
      }
  
      if (!data.pedidos || data.pedidos.length === 0) {
        const saludo = document.getElementById('ps-saludo');
        saludo.style.display = 'block';
        document.getElementById('ps-saludo-nombre').innerHTML =
          `Hola, <em>${(data.nombre_cliente || inputVal).split(' ')[0]}</em>`;
        const lista = document.getElementById('ps-lista');
        lista.style.display = 'block';
        document.getElementById('ps-lista-titulo').textContent = 'Aún no tienes pedidos registrados';
        document.getElementById('ps-cards-container').innerHTML = `
          <div style="text-align:center;padding:40px 20px;color:#6b7280;font-size:14px;">
            <div style="font-size:40px;margin-bottom:12px;">🛋️</div>
            <p style="margin:0 0 8px;font-weight:600;color:#374151;">Sin pedidos por ahora</p>
            <p style="margin:0;">Cuando realices una compra aparecerá aquí.<br>
            ¿Tienes dudas? Escríbenos al WhatsApp.</p>
          </div>`;
        return;
      }
  
      // Mostrar saludo
      const saludo = document.getElementById('ps-saludo');
      saludo.style.display = 'block';
      document.getElementById('ps-saludo-nombre').innerHTML =
        `Hola, <em>${(data.nombre_cliente || inputVal).split(' ')[0]}</em>`;
  
      // Renderizar lista
      const lista = document.getElementById('ps-lista');
      lista.style.display = 'block';
      document.getElementById('ps-lista-titulo').textContent =
        `${data.pedidos.length} pedido${data.pedidos.length !== 1 ? 's' : ''} encontrado${data.pedidos.length !== 1 ? 's' : ''}`;
  
      document.getElementById('ps-cards-container').innerHTML =
        data.pedidos.map(p => _psCardHTML(p)).join('');
  
    } catch(e) {
      document.getElementById('ps-loader').style.display = 'none';
      _psShowError('Error de conexión. Intenta de nuevo.');
    }
  } else {
    // Si NO tiene "@", es un código de contrato. Vamos directo al detalle
    document.getElementById('ps-loader').style.display = 'none';
    let codigoLimpio = inputVal.toUpperCase();

    // Si el usuario ingresó solo números, rellenamos con ceros y agregamos 'INV-'
    if (/^\d+$/.test(codigoLimpio)) {
      codigoLimpio = 'INV-' + codigoLimpio.padStart(4, '0');
    }

    verDetallePedido(codigoLimpio, true);
  }
}

function _psShowError(msg) {
  const el = document.getElementById('ps-error');
  document.getElementById('ps-error-msg').innerHTML = msg;
  el.style.display = 'block';
}

function _psCardHTML(p) {
  const badgeClass = p.estado.raw === 'Entregado' ? 'entregado' :
                     p.estado.raw === 'Cancelado'  ? 'cancelado' : '';
  const pct = p.estado.raw === 'Entregado' ? 100 : (p.progreso?.porcentaje || 0);

  return `
  <div class="ps-card" onclick="verDetallePedido('${p.codigo}')">
    <div class="ps-card-inner">
      <img class="ps-card-thumb" src="${p.thumbnail}" alt="${p.primer_producto}"
           onerror="this.src='imagenes/sin_foto.jpg'">
      <div class="ps-card-body">
        <div class="ps-card-codigo">${p.codigo}</div>
        <div class="ps-card-producto">${p.primer_producto}</div>
        <div class="ps-card-meta">
          <div class="ps-meta-item">Emisión: <strong>${p.fecha_emision}</strong></div>
          <div class="ps-meta-item">Entrega: <strong>${p.fecha_entrega}</strong></div>
          ${p.saldo > 0 ? `<div class="ps-meta-item">Saldo: <strong>S/ ${p.saldo.toFixed(2)}</strong></div>` : ''}
        </div>
      </div>
      <div class="ps-card-right">
        <div class="ps-estado-badge ${badgeClass}">${p.estado.label}</div>
        <div class="ps-progreso-wrap">
          <div class="ps-progreso-bar-bg">
            <div class="ps-progreso-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="ps-progreso-pct">${pct}% completado</div>
        </div>
      </div>
    </div>
  </div>`;
}

async function verDetallePedido(codigo, isDirectSearch = false) {
  document.getElementById('ps-saludo').style.display = 'none';
  document.getElementById('ps-lista').style.display = 'none';
  document.getElementById('ps-error').style.display = 'none';
  document.getElementById('ps-loader').style.display = 'flex';

  try {
    const res = await fetch(
      `${API_URL}/api/seguimiento/pedido/${codigo}?email=${encodeURIComponent(_psEmailActual)}`
    );
    const d = await res.json();
    document.getElementById('ps-loader').style.display = 'none';

    if (!res.ok || d.error) {
      _psShowError(d.error || (isDirectSearch ? `No encontramos el pedido #${codigo}. Verifica el número.` : 'No se pudo cargar el detalle.'));
      return;
    }

    const pct = d.estado.raw === 'Entregado' ? 100 : (d.progreso?.porcentaje || 0);
    const moneda = d.moneda === 'USD' ? '$' : 'S/';

    // Áreas de producción
    const areasHTML = (d.areas || []).length > 0 ? `
      <div class="ps-seccion-label">Avance por área</div>
      <div class="ps-areas-grid">
        ${d.areas.map(a => `
          <div class="ps-area-item ${a.listo ? 'ps-area-listo' : ''}">
            <div class="ps-area-nombre">${_formatArea(a.area)}</div>
            <div class="ps-area-mini-bg">
              <div class="ps-area-mini-fill" style="width:${a.porcentaje}%"></div>
            </div>
            <div class="ps-area-mini-pct">${a.listo ? '✓ Listo' : `${a.porcentaje}%`}</div>
          </div>`).join('')}
      </div>` : '';

    // Ítems
    const itemsHTML = d.items.map(i => `
      <div class="ps-item">
        <img class="ps-item-thumb" src="${i.foto}" alt="${i.producto}"
             onerror="this.src='imagenes/sin_foto.jpg'">
        <div>
          <div class="ps-item-nombre">${i.producto}</div>
          ${i.detalles ? `<div class="ps-item-detalles">${i.detalles}</div>` : ''}
        </div>
      </div>`).join('');

    // Pagos
    const pagosHTML = (d.pagos || []).length > 0
      ? d.pagos.map(p => `
          <div class="ps-pago">
            <div class="ps-pago-info">${p.tipo} · ${p.entidad} · ${p.fecha}</div>
            <div class="ps-pago-monto">${moneda} ${p.monto.toFixed(2)}</div>
          </div>`).join('')
      : '<div style="color:rgba(245,240,232,0.3);font-size:12px;padding:12px 0;">Sin pagos registrados aún.</div>';

    document.getElementById('ps-detalle-contenido').innerHTML = `
      <div class="ps-det-header">
        <div class="ps-det-codigo">${d.codigo}</div>
        <div class="ps-det-estado-label">${d.estado.label}</div>
        <div class="ps-det-descripcion">${d.estado.descripcion}</div>
      </div>

      <div class="ps-entrega-box">
        <div>
          <div class="ps-entrega-label">Fecha de entrega estimada</div>
          <div class="ps-entrega-fecha">${d.fecha_entrega}</div>
        </div>
        <div class="ps-seccion-label" style="text-align:right">
          Sede: ${d.sede || '—'}<br>
          Asesor: ${d.vendedor || '—'}
        </div>
      </div>

      <div class="ps-progreso-global">
        <div class="ps-seccion-label">Progreso de fabricación</div>
        <div class="ps-prog-grande-bg">
          <div class="ps-prog-grande-fill" style="width:${pct}%"></div>
        </div>
        <div class="ps-prog-texto">
          <span>${d.progreso.terminados} de ${d.progreso.total} etapas</span>
          <strong>${pct}%</strong>
        </div>
      </div>

      ${areasHTML}

      <div class="ps-seccion-label" style="margin-bottom:12px">Tu pedido incluye</div>
      <div class="ps-items-lista">${itemsHTML}</div>

      <div class="ps-seccion-label" style="margin-bottom:12px">Pagos registrados</div>
      <div class="ps-pagos-lista">${pagosHTML}</div>

      <div class="ps-financiero">
        <div class="ps-fin-row">
          <span class="ps-fin-label">Total del pedido</span>
          <span class="ps-fin-valor">${moneda} ${d.total.toFixed(2)}</span>
        </div>
        <div class="ps-fin-row">
          <span class="ps-fin-label">Adelanto pagado</span>
          <span class="ps-fin-valor">${moneda} ${d.adelanto.toFixed(2)}</span>
        </div>
        <div class="ps-fin-row saldo">
          <span class="ps-fin-label">Saldo pendiente</span>
          <span class="ps-fin-valor">${moneda} ${d.saldo.toFixed(2)}</span>
        </div>
      </div>
    `;

    document.getElementById('ps-detalle').style.display = 'block';
    document.getElementById('portal-seguimiento').scrollTo({ top: 0, behavior: 'smooth' });

  } catch(e) {
    document.getElementById('ps-loader').style.display = 'none';
    _psShowError('Error al cargar el detalle. Intenta de nuevo.');
  }
}

function volverALista() {
  document.getElementById('ps-detalle').style.display = 'none';
  
  // Si la búsqueda fue por contrato (sin email), volvemos a mostrar el buscador limpio
  if (!_psEmailActual.includes('@')) {
    _psReset();
    document.getElementById('ps-email-input').value = '';
  } else {
    document.getElementById('ps-saludo').style.display = 'block';
    document.getElementById('ps-lista').style.display = 'block';
  }
  document.getElementById('portal-seguimiento').scrollTo({ top: 0, behavior: 'smooth' });
}

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
  return nombres[area] || area.replace(/_/g, ' ').toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}
}