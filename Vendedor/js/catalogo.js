// === MÓDULO: Catálogo y configuradores de muebles ===

// ─────────────────────────────────────────────────────────────────────────────
// renderGrid — VERSIÓN CON STOCK REAL
//   · Muestra la cantidad disponible en el badge de la tarjeta de stock
//   · Deshabilita "AÑADIR" cuando stock_cantidad llega a 0
//   · Marca la tarjeta como AGOTADO con estilo visual diferente
//   · En catálogo normal (a medida) el comportamiento es idéntico al anterior
// ─────────────────────────────────────────────────────────────────────────────
function renderGrid() {
    const grid = document.getElementById('product-grid');
    let filtered = [];

    if (currentMode === 'stock') {
        filtered = allProducts.filter(p => p.en_stock === true && p.es_plantilla === false);
    } else if (currentMode === 'catalogo') {
        filtered = allProducts.filter(p => p.en_stock === false && p.es_plantilla === false);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: gray; padding: 40px;">No hay productos disponibles en esta categoría.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const qty          = typeof p.stock_cantidad === 'number' ? p.stock_cantidad : 1;
        const agotado      = p.en_stock && qty <= 0;
        const pocasUnidades = p.en_stock && qty > 0 && qty <= 3;

        // ── Badge superior ─────────────────────────────────────────────────
        let badge = '';
        if (p.en_stock) {
            if (agotado) {
                badge = `<span class="status-badge" style="background:#fee2e2; color:#b91c1c;">
                            <i class="fa-solid fa-ban" style="font-size:9px;"></i> AGOTADO
                         </span>`;
            } else {
                const colorQty = pocasUnidades ? '#f59e0b' : 'var(--success)';
                const bgQty    = pocasUnidades ? '#fffbeb' : '#f0fdf4';
                badge = `<span class="status-badge" style="background:${bgQty}; color:${colorQty};">
                            <i class="fa-solid fa-box" style="font-size:9px;"></i>
                            ${pocasUnidades ? 'ÚLTIMAS' : 'DISPONIBLE'} · ${qty} ${qty === 1 ? 'und.' : 'unds.'}
                         </span>`;
            }
        } else {
            badge = `<span class="status-badge" style="background:#f1f5f9; color:var(--text-muted);">
                        <i class="fa-solid fa-ruler-combined" style="font-size:9px;"></i> A MEDIDA
                     </span>`;
        }

        // ── Botón de acción ────────────────────────────────────────────────
        let btnHtml = '';
        if (p.en_stock) {
            if (agotado) {
                btnHtml = `<button class="btn-action" disabled
                               style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed; width:100%; padding:12px; border:none; border-radius:12px; font-weight:800;">
                               <i class="fa-solid fa-ban"></i> AGOTADO
                           </button>`;
            } else {
                // Pasamos el id del producto de catálogo para que el backend
                // pueda hacer el descuento correcto en stock_cantidad
                btnHtml = `<button class="btn-action btn-primary"
                               onclick="addStockItemToCart(${p.id}, '${p.nombre.replace(/'/g,"\\'")}', ${p.precio}, '${p.foto}')">
                               <i class="fa-solid fa-bolt"></i> COMPRAR AHORA
                           </button>`;
            }
        } else {
            btnHtml = `<button class="btn-action btn-primary"
                           onclick="addToCart('${p.nombre.replace(/'/g,"\\'")}', ${p.precio}, '${p.foto}', 'Venta Estándar')">
                           <i class="fa-solid fa-plus"></i> AÑADIR AL CARRO
                       </button>`;
        }

        // ── Overlay agotado ────────────────────────────────────────────────
        const agotadoOverlay = agotado
            ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%;
                           background:rgba(255,255,255,0.5); border-radius:18px; z-index:1;"></div>`
            : '';

        return `
        <div class="card" style="position:relative; ${agotado ? 'opacity:0.75;' : ''}">
            ${agotadoOverlay}
            <img src="${p.foto}" onerror="this.src='imagenes/sin_foto.jpg'"
                 style="${agotado ? 'filter:grayscale(60%);' : ''}">
            <div class="card-info">
                ${badge}
                <h4>${p.nombre}</h4>
                <span class="price-tag">${p.precio > 0 ? 'S/ ' + p.precio.toFixed(2) : 'A Cotizar'}</span>
                ${btnHtml}
            </div>
        </div>`;
    }).join('');
}

/**
 * addStockItemToCart — wrapper para ítems de Stock en Tienda.
// =============================================================================
// PATCH para catalogo.js
// =============================================================================
// INSTRUCCIÓN: Reemplaza toda la función addStockItemToCart (líneas ~97-115
// en catalogo.js original) con el bloque de abajo.
//
// Qué cambia:
//   - Antes: pushaba el ítem al carrito directamente.
//   - Ahora: primero consulta /api/inventario/disponibles/<id> para obtener
//     las unidades físicas disponibles. Si hay más de una, muestra un picker.
//     El ítem que se agrega al carrito lleva stock_producto_id con el id real
//     de la fila en stock_productos — el "puente" con el inventario.
// =============================================================================

/**
 * addStockItemToCart — wrapper para ítems de Stock en Tienda.
 *
 * 1. Consulta las unidades físicas disponibles para este producto de catálogo.
 * 2. Si hay una sola, la selecciona automáticamente.
 * 3. Si hay varias, muestra un picker para que el vendedor elija cuál pieza
 *    física está vendiendo (por código de barras / sede).
 * 4. Agrega el ítem al carrito con stock_producto_id para que el backend
 *    marque esa unidad específica como "Reservado" al guardar la venta.
 */
async function addStockItemToCart(catalogoId, nombre, precio, foto) {
    // Indicar que estamos consultando
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });

    let unidades = [];
    try {
        const res = await apiFetch(`${API_URL}/api/inventario/disponibles/${catalogoId}`);
        unidades  = await res.json();
    } catch (e) {
        // Si el endpoint aún no está disponible (p.ej. deploy en curso),
        // caemos al comportamiento anterior para no bloquear las ventas.
        console.warn('addStockItemToCart: no se pudo consultar disponibles, modo legacy.', e);
        _addStockLegacy(catalogoId, nombre, precio, foto);
        return;
    }

    if (unidades.error) {
        console.warn('addStockItemToCart: error del servidor:', unidades.error);
        _addStockLegacy(catalogoId, nombre, precio, foto);
        return;
    }

    if (!unidades.length) {
        return Swal.fire({
            icon: 'warning',
            title: 'Sin unidades disponibles',
            text:  `No hay unidades físicas registradas de "${nombre}" en el inventario. ` +
                   'Si el producto existe en tienda, regístralo primero en el módulo de Inventario.',
            confirmButtonColor: 'var(--accent)'
        });
    }

    // ── Selección de la unidad física ────────────────────────────────────────
    let unidad;

    if (unidades.length === 1) {
        // Una sola unidad disponible: selección automática
        unidad = unidades[0];
    } else {
        // Varias unidades: el vendedor elige cuál está vendiendo
        const opciones = unidades
            .map(u => `<option value="${u.id}">${u.label}</option>`)
            .join('');

        const { value: idSeleccionado, isConfirmed } = await Swal.fire({
            title: `Seleccionar unidad — ${nombre}`,
            html: `
                <p style="font-size:13px;color:#6b7280;margin-bottom:12px;">
                    Hay <strong>${unidades.length}</strong> unidades disponibles.<br>
                    Elige la que estás vendiendo físicamente:
                </p>
                <select id="swal-picker-unidad"
                    style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;
                           border-radius:8px;font-size:13px;font-family:inherit;">
                    ${opciones}
                </select>`,
            confirmButtonText: 'Seleccionar esta unidad',
            confirmButtonColor: '#0f172a',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            preConfirm: () => document.getElementById('swal-picker-unidad').value
        });

        if (!isConfirmed || !idSeleccionado) return; // El vendedor canceló

        unidad = unidades.find(u => u.id == idSeleccionado);
    }

    if (!unidad) return;

    // ── Agregar al carrito con la referencia física ───────────────────────────
    const detalleLabel = [
        `Cód: ${unidad.codigo_barra}`,
        unidad.sede       && unidad.sede,
        unidad.color_tela && unidad.color_tela,
        unidad.acabado    && unidad.acabado,
    ].filter(Boolean).join(' · ');

    cart.push({
        name:              nombre,
        price:             precio,
        img:               foto,
        details:           detalleLabel,
        componentes:       {},
        es_stock:          true,
        catalogo_id:       catalogoId,
        stock_producto_id: unidad.id,    // ← EL PUENTE con stock_productos
    });

    document.getElementById('cart-count').innerText = cart.length;
    updateCartUI();

    Toast.fire({ icon: 'success', title: `"${nombre}" añadido al carrito` });
}

/**
 * Comportamiento de respaldo (modo legacy) cuando el endpoint de inventario
 * no responde. Permite seguir vendiendo sin el puente de inventario.
 * @private
 */
function _addStockLegacy(catalogoId, nombre, precio, foto) {
    cart.push({
        name:        nombre,
        price:       precio,
        img:         foto,
        details:     'Venta Estándar',
        componentes: {},
        es_stock:    true,
        catalogo_id: catalogoId
        // stock_producto_id ausente → solo descuenta el contador genérico
    });
    document.getElementById('cart-count').innerText = cart.length;
    updateCartUI();
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'success', title: `"${nombre}" añadido al carrito` });
}
/* --- LÓGICA DEL NUEVO MODAL DE SOFÁS --- */
/* --- REEMPLAZA TU FUNCIÓN openConfig COMPLETA --- */
function openConfig(name, img) {
    tempItem = { name, img };
    const modal = document.getElementById('modal-config');
    document.getElementById('conf-title').innerText = `Personalizar: ${name}`;
    
    // 🧹 Limpieza Genérica
    modal.querySelectorAll('input:not([type="button"]), select, textarea').forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
    modal.querySelectorAll('.custom-options').forEach(el => el.classList.remove('show'));
    modal.querySelectorAll('img[id^="img-preview-"]').forEach(img => img.style.display = 'none');
    document.getElementById('conf-precio').value = ""; 
    document.getElementById('check-banqueta').checked = false;
    toggleBanqueta();

    // Forzamos que el input de fotos acepte múltiples archivos
    const fInp = document.getElementById('sofa-fotos');
    if (fInp) {
        fInp.setAttribute('multiple', 'multiple');
        if (!fInp.dataset.bound) {
            fInp.addEventListener('change', function() { _mostrarPreviewMultiplesFotos(this, 'sofa'); });
            fInp.dataset.bound = '1';
        }
    }
    const prevCont = document.getElementById('preview-multiples-sofa');
    if (prevCont) prevCont.innerHTML = '';

    document.getElementById('modal-config').style.display = 'flex';
    document.getElementById('sofa-modelo').value = 'multi3'; 
    actualizarVistaSofa(); 
}

function closeModal() { document.getElementById('modal-config').style.display = 'none'; }

// Mostrar / Ocultar Banqueta
function toggleBanqueta() {
    const isChecked = document.getElementById('check-banqueta').checked;
    document.getElementById('banqueta-inputs').style.display = isChecked ? 'block' : 'none';
}

// ─── Toggle altura condicional en sofás ────────────────────────────────────
function toggleAltura(target) {
    // target puede ser un ID (string) o directamente el elemento DOM
    const el = (typeof target === 'string') ? document.getElementById(target) : target;
    if (!el) return;
    const visible = el.style.display !== 'none';
    el.style.display = visible ? 'none' : 'inline-block';
    // Limpiar el input si se oculta para que no quede valor fantasma
    if (visible) {
        const inp = el.querySelector('input');
        if (inp) inp.value = '';
    }
}
function toggleMedidasEstandar(btnId, containerId, hiddenId) {
    const btn = document.getElementById(btnId);
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    const activo = btn.dataset.estandar === '1';
    if (activo) {
        btn.dataset.estandar = '0';
        btn.style.background = '#f1f5f9';
        btn.style.color = '#64748b';
        btn.innerHTML = '📐 Medidas Estándar';
        container.style.display = '';
        hidden.value = '';
    } else {
        btn.dataset.estandar = '1';
        btn.style.background = 'var(--accent)';
        btn.style.color = 'white';
        btn.innerHTML = '✅ Medidas Estándar ACTIVADO';
        container.style.display = 'none';
        hidden.value = 'MEDIDAS ESTÁNDAR';
    }
}
function actualizarVistaSofa() {
    const modelo = document.getElementById('sofa-modelo').value;
    const imgPreview = document.getElementById('preview-sofa');
    const medContainer = document.getElementById('medidas-container');

    imgPreview.src = imagenesSofa[modelo] || (tempItem && tempItem.img) || 'imagenes/sin_foto.jpg';

    // Resolver el tipo de medidas real:
    // Para modelos fijos lo sabemos de memoria.
    // Para modelos custom lo leemos del localStorage (campo 'medidas').
    const MODELOS_FIJOS = { juego: 'juego', multi3: 'multi3', multi4: 'multi4', u: 'u' };
    let tipoMedidas = MODELOS_FIJOS[modelo] || null;

    if (!tipoMedidas) {
        // Modelo custom: buscar en innova_modelos_sofa
        try {
            const guardados = JSON.parse(localStorage.getItem('innova_modelos_sofa') || '[]');
            const encontrado = guardados.find(m => m.key === modelo);
            tipoMedidas = encontrado ? (encontrado.medidas || 'general') : 'general';
        } catch(e) {
            tipoMedidas = 'general';
        }
    }

    if (tipoMedidas === 'juego') {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">CONSTRUIR JUEGO (L, A, F, H)</label>
                <button onclick="addCuerpoSofa(prompt('¿De cuántos cuerpos es esta pieza? (Ej: 3, 2, 1)'))" style="background:var(--accent); color:white; border:none; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:10px;">+ Añadir Pieza</button>
            </div>
            <div id="lista-cuerpos"></div>
        `;
        addCuerpoSofa('3');

    } else if (tipoMedidas === 'multi3') {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MULTI 3 PIEZAS (Largo, Profundidad)</label>
                <button type="button" id="btn-estandar-sofa" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-sofa','sofa-medidas-inputs','sofa-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="sofa-medidas-inputs">
                <div class="medida-row" style="align-items:center;">
                    <span style="font-size:10px; width:50px; font-weight:bold;">Grande:</span>
                    <input type="number" id="m3-l1" class="form-input-sm" placeholder="Largo">
                    <input type="number" id="m3-f1" class="form-input-sm" placeholder="Prof.">
                    <button type="button" onclick="toggleAltura('m3-h1-wrap')" title="Agregar altura" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;white-space:nowrap;">+ Alt</button>
                    <span id="m3-h1-wrap" style="display:none;"><input type="number" id="m3-h1" class="form-input-sm" placeholder="Alto"></span>
                </div>
                <div class="medida-row" style="align-items:center;">
                    <span style="font-size:10px; width:50px; font-weight:bold;">Modular:</span>
                    <input type="number" id="m3-l2" class="form-input-sm" placeholder="Largo">
                    <input type="number" id="m3-f2" class="form-input-sm" placeholder="Prof.">
                    <button type="button" onclick="toggleAltura('m3-h2-wrap')" title="Agregar altura" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;white-space:nowrap;">+ Alt</button>
                    <span id="m3-h2-wrap" style="display:none;"><input type="number" id="m3-h2" class="form-input-sm" placeholder="Alto"></span>
                </div>
            </div>
            <input type="hidden" id="sofa-medidas-estandar" value="">
        `;

    } else if (tipoMedidas === 'multi4') {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MULTI 4 PIEZAS (Largo, Profundidad)</label>
                <button type="button" id="btn-estandar-sofa" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-sofa','sofa-medidas-inputs','sofa-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="sofa-medidas-inputs">
                <div class="medida-row" style="align-items:center;">
                    <span style="font-size:10px; width:50px; font-weight:bold;">Gnde 1:</span>
                    <input type="number" id="m4-l1" class="form-input-sm" placeholder="Largo">
                    <input type="number" id="m4-f1" class="form-input-sm" placeholder="Prof.">
                    <button type="button" onclick="toggleAltura('m4-h1-wrap')" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;white-space:nowrap;">+ Alt</button>
                    <span id="m4-h1-wrap" style="display:none;"><input type="number" id="m4-h1" class="form-input-sm" placeholder="Alto"></span>
                </div>
                <div class="medida-row" style="align-items:center;">
                    <span style="font-size:10px; width:50px; font-weight:bold;">Gnde 2:</span>
                    <input type="number" id="m4-l2" class="form-input-sm" placeholder="Largo">
                    <input type="number" id="m4-f2" class="form-input-sm" placeholder="Prof.">
                    <button type="button" onclick="toggleAltura('m4-h2-wrap')" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;white-space:nowrap;">+ Alt</button>
                    <span id="m4-h2-wrap" style="display:none;"><input type="number" id="m4-h2" class="form-input-sm" placeholder="Alto"></span>
                </div>
                <div class="medida-row" style="align-items:center;">
                    <span style="font-size:10px; width:50px; font-weight:bold;">Modular:</span>
                    <input type="number" id="m4-l3" class="form-input-sm" placeholder="Largo">
                    <input type="number" id="m4-f3" class="form-input-sm" placeholder="Prof.">
                    <button type="button" onclick="toggleAltura('m4-h3-wrap')" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;white-space:nowrap;">+ Alt</button>
                    <span id="m4-h3-wrap" style="display:none;"><input type="number" id="m4-h3" class="form-input-sm" placeholder="Alto"></span>
                </div>
            </div>
            <input type="hidden" id="sofa-medidas-estandar" value="">
        `;

    } else if (tipoMedidas === 'u') {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS EN "U" (cm)</label>
                <button type="button" id="btn-estandar-sofa" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-sofa','sofa-medidas-inputs','sofa-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="sofa-medidas-inputs">
                <div class="medida-row" style="flex-wrap: wrap; align-items:center; gap:5px;">
                    <input type="number" id="u-largo-izq" class="form-input-sm" placeholder="Largo Izq." style="width: 46%;">
                    <input type="number" id="u-largo-der" class="form-input-sm" placeholder="Largo Der." style="width: 46%;">
                    <input type="number" id="u-fondo" class="form-input-sm" placeholder="Profundidad Gen." style="width: 60%; margin-top:5px;">
                    <button type="button" onclick="toggleAltura('u-alto-wrap')" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;margin-top:5px;white-space:nowrap;">+ Altura</button>
                    <span id="u-alto-wrap" style="display:none; margin-top:5px; width:100%;">
                        <input type="number" id="u-alto" class="form-input-sm" placeholder="Alto Gen." style="width:60%;">
                    </span>
                </div>
            </div>
            <input type="hidden" id="sofa-medidas-estandar" value="">
        `;

    } else {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS TOTALES (cm)</label>
                <button type="button" id="btn-estandar-sofa" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-sofa','sofa-medidas-inputs','sofa-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="sofa-medidas-inputs">
                <div class="medida-row" style="flex-wrap: wrap; align-items:center; gap:5px;">
                    <input type="number" id="med-largo" class="form-input-sm" placeholder="Largo" style="width: 46%;">
                    <input type="number" id="med-fondo" class="form-input-sm" placeholder="Profundidad" style="width: 46%;">
                    <button type="button" onclick="toggleAltura('med-alto-wrap')" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 6px;margin-top:5px;white-space:nowrap;">+ Altura</button>
                    <span id="med-alto-wrap" style="display:none; margin-top:5px; width:100%;">
                        <input type="number" id="med-alto" class="form-input-sm" placeholder="Alto" style="width:46%;">
                    </span>
                </div>
            </div>
            <input type="hidden" id="sofa-medidas-estandar" value="">
        `;
    }
}

function addCuerpoSofa(cuerpos) {
    if (!cuerpos) return;
    cuerpos = cuerpos.trim();
    
    const div = document.createElement('div');
    div.className = 'medida-row cuerpos-medida';
    
    div.onclick = function() { seleccionarPieza(this, cuerpos); };

    div.innerHTML = `
        <span style="font-size:11px; font-weight:bold; width:35px; text-align:center;">${cuerpos} C.</span>
        <input type="number" class="form-input-sm c-largo" title="Largo" placeholder="Largo">
        <input type="number" class="form-input-sm c-fondo" title="Profundidad" placeholder="Prof.">
        <button type="button" onclick="event.stopPropagation(); toggleAltura(this.nextElementSibling)" title="Agregar altura" style="background:none;border:1px dashed #94a3b8;border-radius:5px;color:#94a3b8;cursor:pointer;font-size:10px;padding:2px 5px;white-space:nowrap;">+ Alt</button>
        <span class="alto-wrap" style="display:none;"><input type="number" class="form-input-sm c-alto" title="Alto" placeholder="Alto"></span>
        <button onclick="event.stopPropagation(); this.parentElement.remove()" style="border:none; color:red; background:none; cursor:pointer; padding:2px;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    document.getElementById('lista-cuerpos').appendChild(div);
    seleccionarPieza(div, cuerpos);
}

function seleccionarPieza(elementoFila, tipoCuerpo) {
    document.querySelectorAll('.cuerpos-medida').forEach(el => el.classList.remove('activa'));
    elementoFila.classList.add('activa');
    
    const imgPreview = document.getElementById('preview-sofa');
    
    if (imagenesSofa[tipoCuerpo]) {
        imgPreview.src = imagenesSofa[tipoCuerpo];
        imgPreview.onerror = function() { 
            this.src = 'imagenes/sin_foto.jpg';
        };
    } else {
        imgPreview.src = 'imagenes/sin_foto.jpg';
    }
}
/* ----------------------------------------------- */

// ─── Toggle: Cojines "Por confirmar al final" ──────────────────────────────
function toggleCojinPendiente() {
    const checked = document.getElementById('cojin-pendiente').checked;
    const wrap = document.getElementById('cojin-detalle-wrap');
    wrap.style.display = checked ? 'none' : 'block';
    // Limpiar campos al marcar pendiente para no dejar datos viejos
    if (checked) {
        document.getElementById('c-enteros').value = '';
        document.getElementById('c-diseno').value = '';
        document.getElementById('search-cojin-entero').value = '';
        document.getElementById('search-cojin-diseno').value = '';
        document.getElementById('sku-cojin-entero').value = '';
        document.getElementById('sku-cojin-diseno').value = '';
        document.getElementById('img-preview-cojin-entero').style.display = 'none';
        document.getElementById('img-preview-cojin-diseno').style.display = 'none';
        // Limpiar también campos de reversibles y resetear su toggle
        const ids = ['c-reversible','search-cojin-rev-diseno','search-cojin-rev-entero',
                     'sku-cojin-rev-diseno','sku-cojin-rev-entero',
                     'proveedor-cojin-rev-diseno','proveedor-cojin-rev-entero','nota-cojin-reversible'];
        ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        const imgRevD = document.getElementById('img-preview-cojin-rev-diseno');
        const imgRevE = document.getElementById('img-preview-cojin-rev-entero');
        if(imgRevD) imgRevD.style.display = 'none';
        if(imgRevE) imgRevE.style.display = 'none';
        // Volver a modo normal en el toggle de reversibles
        const modoNormal = document.getElementById('cojin-modo-normal');
        const modoRev    = document.getElementById('cojin-modo-reversible');
        const btnRev     = document.getElementById('btn-toggle-reversible');
        if(modoNormal) modoNormal.style.display = 'block';
        if(modoRev)    modoRev.style.display    = 'none';
        if(btnRev)   { btnRev.innerHTML = '🔄 Agregar cojines reversibles'; btnRev.style.background = '#f5f3ff'; btnRev.style.color = '#7c3aed'; }
    }
}

// ─── Toggle: Cojines reversibles (botón) ────────────────────────────────────
function toggleCojinReversible() {
    const modoNormal     = document.getElementById('cojin-modo-normal');
    const modoReversible = document.getElementById('cojin-modo-reversible');
    const btn            = document.getElementById('btn-toggle-reversible');
    const abierto        = modoReversible.style.display !== 'none';

    if (abierto) {
        // Volver a modo normal
        modoReversible.style.display = 'none';
        modoNormal.style.display     = 'block';
        btn.innerHTML = '🔄 Agregar cojines reversibles';
        btn.style.background = '#f5f3ff';
        btn.style.color      = '#7c3aed';
        // Limpiar campos reversibles
        ['c-reversible','search-cojin-rev-diseno','search-cojin-rev-entero',
         'sku-cojin-rev-diseno','sku-cojin-rev-entero',
         'proveedor-cojin-rev-diseno','proveedor-cojin-rev-entero'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        const imgD = document.getElementById('img-preview-cojin-rev-diseno');
        const imgE = document.getElementById('img-preview-cojin-rev-entero');
        if(imgD) imgD.style.display = 'none';
        if(imgE) imgE.style.display = 'none';
    } else {
        // Abrir modo reversible, ocultar enteros/diseño
        modoReversible.style.display = 'block';
        modoNormal.style.display     = 'none';
        btn.innerHTML = '✖ Quitar cojines reversibles';
        btn.style.background = '#ede9fe';
        btn.style.color      = '#5b21b6';
        // Limpiar campos normales para no mezclar datos
        ['c-enteros','c-diseno','search-cojin-entero','search-cojin-diseno',
         'sku-cojin-entero','sku-cojin-diseno','proveedor-cojin-entero','proveedor-cojin-diseno'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        const imgE2 = document.getElementById('img-preview-cojin-entero');
        const imgD2 = document.getElementById('img-preview-cojin-diseno');
        if(imgE2) imgE2.style.display = 'none';
        if(imgD2) imgD2.style.display = 'none';
    }
}

/* --- REEMPLAZA LA FUNCIÓN confirmarPersonalizadoSofa COMPLETA --- */
async function confirmarPersonalizadoSofa() {
    const precio = parseFloat(document.getElementById('conf-precio').value);
    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Debe ingresar el precio total.', 'warning');

    const modeloSelect = document.getElementById('sofa-modelo');
    const modeloBase = modeloSelect.options[modeloSelect.selectedIndex].text;
    const modeloVal = modeloSelect.value;

    // Resolver tipoMedidas real (igual que en actualizarVistaSofa)
    const _MODELOS_FIJOS = { juego: 'juego', multi3: 'multi3', multi4: 'multi4', u: 'u' };
    let tipoMedidas = _MODELOS_FIJOS[modeloVal] || null;
    if (!tipoMedidas) {
        try {
            const _guardados = JSON.parse(localStorage.getItem('innova_modelos_sofa') || '[]');
            const _enc = _guardados.find(m => m.key === modeloVal);
            tipoMedidas = _enc ? (_enc.medidas || 'general') : 'general';
        } catch(e) { tipoMedidas = 'general'; }
    }
    
    // 1. Capturar Medidas
    let medidasText = "";

    // Detectar modo estándar (aplica a todos los modelos excepto juego)
    const estandarHidden = document.getElementById('sofa-medidas-estandar');
    if (estandarHidden && estandarHidden.value === 'MEDIDAS ESTÁNDAR') {
        medidasText = ' [MEDIDAS ESTÁNDAR]';
    } else if (tipoMedidas === 'juego') {
        const filas = document.querySelectorAll('.cuerpos-medida');
        filas.forEach(f => {
            const c = f.querySelector('span').innerText;
            const l = f.querySelector('.c-largo').value || '0';
            const fon = f.querySelector('.c-fondo').value || '0';
            const altWrap = f.querySelector('.alto-wrap');
            const a = (altWrap && altWrap.style.display !== 'none') ? (f.querySelector('.c-alto')?.value || '') : '';
            medidasText += `[${c}: L${l}xP${fon}${a ? `xH${a}` : ''}] `;
        });
    } else if (tipoMedidas === 'multi3') {
        const l1 = document.getElementById('m3-l1').value||'0', f1 = document.getElementById('m3-f1').value||'0';
        const l2 = document.getElementById('m3-l2').value||'0', f2 = document.getElementById('m3-f2').value||'0';
        const h1El = document.getElementById('m3-h1'), h2El = document.getElementById('m3-h2');
        const h1 = (document.getElementById('m3-h1-wrap')?.style.display !== 'none' && h1El) ? h1El.value||'' : '';
        const h2 = (document.getElementById('m3-h2-wrap')?.style.display !== 'none' && h2El) ? h2El.value||'' : '';
        medidasText = `<br>-> [Grande: L${l1}xP${f1}${h1?`xH${h1}`:''}]<br>-> [Modular: L${l2}xP${f2}${h2?`xH${h2}`:''}]`;
    } else if (tipoMedidas === 'multi4') {
        const l1 = document.getElementById('m4-l1').value||'0', f1 = document.getElementById('m4-f1').value||'0';
        const l2 = document.getElementById('m4-l2').value||'0', f2 = document.getElementById('m4-f2').value||'0';
        const l3 = document.getElementById('m4-l3').value||'0', f3 = document.getElementById('m4-f3').value||'0';
        const h1El = document.getElementById('m4-h1'), h2El = document.getElementById('m4-h2'), h3El = document.getElementById('m4-h3');
        const h1 = (document.getElementById('m4-h1-wrap')?.style.display !== 'none' && h1El) ? h1El.value||'' : '';
        const h2 = (document.getElementById('m4-h2-wrap')?.style.display !== 'none' && h2El) ? h2El.value||'' : '';
        const h3 = (document.getElementById('m4-h3-wrap')?.style.display !== 'none' && h3El) ? h3El.value||'' : '';
        medidasText = `<br>-> [Grande 1: L${l1}xP${f1}${h1?`xH${h1}`:''}]<br>-> [Grande 2: L${l2}xP${f2}${h2?`xH${h2}`:''}]<br>-> [Modular: L${l3}xP${f3}${h3?`xH${h3}`:''}]`;
    } else if (tipoMedidas === 'u') {
        const li = document.getElementById('u-largo-izq').value || '0', ld = document.getElementById('u-largo-der').value || '0';
        const f = document.getElementById('u-fondo').value || '0';
        const uAltoWrap = document.getElementById('u-alto-wrap');
        const h = (uAltoWrap && uAltoWrap.style.display !== 'none') ? (document.getElementById('u-alto')?.value||'') : '';
        medidasText = `[Izq: L${li}] [Der: L${ld}] [Prof: ${f}${h?` xH${h}`:''}]`;
    } else {
        const l = document.getElementById('med-largo').value || '0';
        const f = document.getElementById('med-fondo').value || '0';
        const medAltoWrap = document.getElementById('med-alto-wrap');
        const a = (medAltoWrap && medAltoWrap.style.display !== 'none') ? (document.getElementById('med-alto')?.value||'') : '';
        medidasText = `[Total: L${l}xP${f}${a?`xH${a}`:''}]`;
    }

    // 2. Banqueta
    let banquetaText = "";
    if (document.getElementById('check-banqueta').checked) {
        const bMod = document.getElementById('bq-mod').value || 'Estándar';
        const bL = document.getElementById('bq-largo').value || '0';
        const bF = document.getElementById('bq-fondo').value || '0';
        const bqAltoWrap = document.getElementById('bq-alto-wrap');
        const bA = (bqAltoWrap && bqAltoWrap.style.display !== 'none') ? (document.getElementById('bq-alto')?.value||'') : '';
        banquetaText = `<br><b style="color:var(--accent)">BANQUETA:</b> Mod: ${bMod} | L${bL} x P${bF}${bA?` x H${bA}`:''}`;
    }

    // 3. CAPTURAR DATOS DE ERP
    const skuTela = document.getElementById('sku-tela').value;
    const nombreTela = document.getElementById('search-tela').value;
    const notaTela = document.getElementById('nota-tela')?.value || '';
    if(!skuTela) return Swal.fire('Dato Faltante', 'Debe seleccionar una Tela Principal', 'warning');

    const espuma = document.getElementById('c-espuma').value;
    const costura = document.getElementById('c-costura').value;
    const respaldo = document.getElementById('c-respaldo').value;
    const brazo = document.getElementById('med-brazo').value || '0';

    const cojinPendiente = document.getElementById('cojin-pendiente')?.checked || false;

    // ── Cojines Enteros ──────────────────────────────────────────────────────
    const cEnteros          = cojinPendiente ? '⏳ POR CONFIRMAR' : (document.getElementById('c-enteros').value || '0');
    const skuCojinEnt       = cojinPendiente ? 'PENDIENTE' : (document.getElementById('sku-cojin-entero').value || 'N/A');
    const nombreCojinEnt    = cojinPendiente ? '' : (document.getElementById('search-cojin-entero').value || '');
    const provCojinEnt      = cojinPendiente ? '' : (document.getElementById('proveedor-cojin-entero')?.value || '');

    // ── Cojines c/Diseño ─────────────────────────────────────────────────────
    const cDiseno           = cojinPendiente ? '' : (document.getElementById('c-diseno').value || '0');
    const skuCojinDis       = cojinPendiente ? 'PENDIENTE' : (document.getElementById('sku-cojin-diseno').value || 'N/A');
    const nombreCojinDis    = cojinPendiente ? '' : (document.getElementById('search-cojin-diseno').value || '');
    const tipoCojinDis      = cojinPendiente ? '' : (document.getElementById('tipo-tela-cojin-diseno')?.value || '');
    const provCojinDis      = cojinPendiente ? '' : (document.getElementById('proveedor-cojin-diseno')?.value || '');

    // ── Cojines Reversibles ──────────────────────────────────────────────────
    const cReversible       = cojinPendiente ? '' : (document.getElementById('c-reversible')?.value || '0');
    const skuRevDiseno      = cojinPendiente ? '' : (document.getElementById('sku-cojin-rev-diseno')?.value || '');
    const nombreRevDiseno   = cojinPendiente ? '' : (document.getElementById('search-cojin-rev-diseno')?.value || '');
    const provRevDiseno     = cojinPendiente ? '' : (document.getElementById('proveedor-cojin-rev-diseno')?.value || '');
    const skuRevEntero      = cojinPendiente ? '' : (document.getElementById('sku-cojin-rev-entero')?.value || '');
    const nombreRevEntero   = cojinPendiente ? '' : (document.getElementById('search-cojin-rev-entero')?.value || '');
    const provRevEntero     = cojinPendiente ? '' : (document.getElementById('proveedor-cojin-rev-entero')?.value || '');
    const notaReversible    = cojinPendiente ? '' : (document.getElementById('nota-cojin-reversible')?.value || '');
    const hayReversible     = !cojinPendiente && parseInt(cReversible) > 0 && (skuRevDiseno || skuRevEntero);

    const skuBase = document.getElementById('sku-base').value;
    const nombreBase = document.getElementById('search-base').value;
    const provTela = document.getElementById('proveedor-tela')?.value || '';
    const provBase = document.getElementById('proveedor-base')?.value || '';

    const notas = await procesarNotasConFotos(['tela', 'espuma', 'cojin-entero', 'cojin-diseno', 'cojin-rev-diseno', 'cojin-rev-entero', 'base']);

    // ── Línea de cojines reversibles para el specs ───────────────────────────
    const lineaReversible = hayReversible ? `
        - ${cReversible} Reversibles:<br>
          &nbsp;&nbsp;Cara A (diseño): [SKU: ${skuRevDiseno}] ${nombreRevDiseno}${provRevDiseno ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provRevDiseno}]</span>` : ''}${notas['cojin-rev-diseno']}<br>
          &nbsp;&nbsp;Cara B (entero): [SKU: ${skuRevEntero}] ${nombreRevEntero}${provRevEntero ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provRevEntero}]</span>` : ''}${notas['cojin-rev-entero']}${notaReversible ? `<br>&nbsp;&nbsp;💬 ${notaReversible}` : ''}<br>` : '';

    const specs = `
        <b>MOD:</b> ${modeloBase} ${medidasText}<br>
        <b>TELA PRINCIPAL:</b> [SKU: ${skuTela}] ${nombreTela}${provTela ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provTela}]</span>` : ''}${notas['tela']}<br>
        <b>INTERIOR/ESTRUCTURA:</b> ${espuma} | ${costura} | ${respaldo} | Brazo: ${brazo}cm${notas['espuma']}<br>
        <b style="color:#7c3aed;">COJINERÍA:</b><br>
        ${cojinPendiente
            ? `- ⏳ <b style="color:#7c3aed;">POR CONFIRMAR AL FINAL</b> (cliente decide después)<br>`
            : `${parseInt(cEnteros) > 0 || skuCojinEnt !== 'N/A' ? `- ${cEnteros} Enteros: [SKU: ${skuCojinEnt}] ${nombreCojinEnt}${provCojinEnt ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provCojinEnt}]</span>` : ''}${notas['cojin-entero']}<br>` : ''}
        ${parseInt(cDiseno) > 0 || skuCojinDis !== 'N/A' ? `- ${cDiseno} c/Diseño: [SKU: ${skuCojinDis}] ${nombreCojinDis}${tipoCojinDis ? ` (${tipoCojinDis})` : ''}${provCojinDis ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provCojinDis}]</span>` : ''}${notas['cojin-diseno']}<br>` : ''}
        ${lineaReversible}`
        }
        <b>BASE:</b> [SKU: ${skuBase}] ${nombreBase}${provBase ? ` <span style="color:#6b7280;font-size:10px;">[Prov: ${provBase}]</span>` : ''}${notas['base']}
        ${banquetaText}
    `;

    const componentes = {
        tela:                document.getElementById('sku-tela').value,
        'cojin-entero':      document.getElementById('sku-cojin-entero').value,
        'cojin-diseno':      document.getElementById('sku-cojin-diseno').value,
        'cojin-rev-diseno':  skuRevDiseno,
        'cojin-rev-entero':  skuRevEntero,
        base:                document.getElementById('sku-base').value
    };

    const imagenUrl = document.getElementById('preview-sofa').src;
    const imagenFinal = await subirFotosReferencia('sofa-fotos', imagenUrl);
    addToCart(tempItem.name, precio, imagenFinal, specs, componentes);
    closeModal();

    Swal.fire({
        title: '¡Mueble Añadido al Carrito!',
        text: '¿Deseas ir al área de pago e imprimir el contrato ahora?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--text-muted)',
        confirmButtonText: 'Sí, ir a cobrar',
        cancelButtonText: 'Seguir configurando'
    }).then((result) => {
        if (result.isConfirmed) {
            toggleCart();
        }
    });
}
/* ================================================================= */
/* --- ENVIAR COMEDOR AL CARRITO --- */
/* ================================================================= */

async function confirmarComedor() {
    const precio = parseFloat(document.getElementById('conf-precio-comedor').value);
    const skuTablero = document.getElementById('sku-tablero').value;
    const skuBaseMesa = document.getElementById('sku-base-mesa').value;
    const skuSilla = document.getElementById('sku-silla').value;

    if (isNaN(precio) || precio <= 0) {
        return Swal.fire('Error', 'Por favor ingresa un Precio Negociado válido.', 'warning');
    }
    if (!skuTablero || !skuBaseMesa || !skuSilla) {
        return Swal.fire('Faltan Datos', 'Debes buscar y seleccionar un Tablero, una Base de Mesa y un modelo de Silla.', 'warning');
    }

    const formatoVal = document.getElementById('comedor-formato').value; 
    const esRectangular = formatoVal.startsWith('rect');
    const cantidadSillas = formatoVal.split('-')[1]; 
    const formatoTexto = esRectangular ? 'Rectangular' : 'Circular';

   let medidasTexto = "";
    const estandarComedor = document.getElementById('comedor-medidas-estandar');
    if (estandarComedor && estandarComedor.value === 'MEDIDAS ESTÁNDAR') {
        medidasTexto = 'MEDIDAS ESTÁNDAR';
    } else if (esRectangular) {
        const largo = document.getElementById('med-tablero-largo')?.value || "0";
        const ancho = document.getElementById('med-tablero-ancho')?.value || "0";
        medidasTexto = `L${largo}cm x A${ancho}cm`;
    } else {
        const diametro = document.getElementById('med-tablero-diametro')?.value || "0";
        medidasTexto = `Diámetro ${diametro}cm`;
    }

    const nombreTablero = document.getElementById('search-tablero').value;
    const corte = document.getElementById('tablero-corte').value;
    const canto = document.getElementById('tablero-canto').value;

    const nombreBaseMesa = document.getElementById('search-base-mesa').value;
    const alturaBase = document.getElementById('base-altura').value || "0";
    const anchoBase = document.getElementById('base-ancho').value || "0";

    const nombreSilla = document.getElementById('search-silla').value;
    const nombreTelaSilla = document.getElementById('search-tela-silla').value;
    const skuTelaSilla = document.getElementById('sku-tela-silla').value;

    const notas = await procesarNotasConFotos(['tablero', 'base-mesa', 'silla', 'tela-silla']);

    const specs = `
        <b>FORMATO:</b> ${formatoTexto} para ${cantidadSillas} personas<br>
        <b>MEDIDAS:</b> ${medidasTexto}<br>
        <b>TABLERO:</b> [SKU: ${skuTablero}] ${nombreTablero} (Corte: ${corte}, Canto: ${canto})${notas['tablero']}<br>
        <b>BASE MESA:</b> [SKU: ${skuBaseMesa}] ${nombreBaseMesa} (Alto: ${alturaBase}cm, Ancho: ${anchoBase}cm)${notas['base-mesa']}<br>
        <b>SILLERÍA:</b> ${cantidadSillas} Unds x [SKU: ${skuSilla}] ${nombreSilla}${notas['silla']}<br>
        <b>TAPIZ SILLAS:</b> ${skuTelaSilla ? `[SKU: ${skuTelaSilla}] ${nombreTelaSilla}` : "Sin tapiz específico"}${notas['tela-silla']}
    `;

    const nombreProducto = `Comedor Pro ${formatoTexto} (${cantidadSillas} Sillas)`;
    const imagenUrl = document.getElementById('preview-comedor').src;
    
    const componentes = {
        tablero: skuTablero,
        'base-mesa': skuBaseMesa,
        silla: skuSilla,
        'tela-silla': skuTelaSilla
    };

    const imagenFinal = await subirFotosReferencia('comedor-fotos', imagenUrl);
    addToCart(nombreProducto, precio, imagenFinal, specs, componentes);

    document.getElementById('modal-config-comedor').style.display = 'none';
    
    Swal.fire({
        title: '¡Comedor Añadido al Carrito!',
        text: '¿Deseas ir al área de pago e imprimir el contrato ahora?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--text-muted)',
        confirmButtonText: 'Sí, ir a cobrar',
        cancelButtonText: 'Seguir configurando'
    }).then((result) => {
        if (result.isConfirmed) {
            toggleCart();
        }
    });
}

/* ----------------------------------------------------------- */

/* --- 6. CARRITO Y STEPPER --- */
function openConfigComedor() {
    document.querySelectorAll('#modal-config-comedor input[type="text"], #modal-config-comedor input[type="number"], #modal-config-comedor input[type="hidden"]').forEach(inp => inp.value = '');
    document.querySelectorAll('#modal-config-comedor select').forEach(sel => sel.selectedIndex = 0);
    
    ['tablero', 'base-mesa', 'silla', 'tela-silla'].forEach(tipo => {
        const imgEl = document.getElementById(`img-preview-${tipo}`);
        const searchEl = document.getElementById(`search-${tipo}`);
        if(imgEl) imgEl.style.display = 'none';
        if(searchEl) searchEl.value = '';
    });

    const fInp = document.getElementById('comedor-fotos');
    if (fInp) {
        fInp.setAttribute('multiple', 'multiple');
        if (!fInp.dataset.bound) {
            fInp.addEventListener('change', function() { _mostrarPreviewMultiplesFotos(this, 'comedor'); });
            fInp.dataset.bound = '1';
        }
    }
    const prevCont = document.getElementById('preview-multiples-comedor');
    if (prevCont) prevCont.innerHTML = '';

    document.getElementById('modal-config-comedor').style.display = 'flex';
    document.getElementById('comedor-formato').value = 'rect-6';
    actualizarVistaComedor();
}

function actualizarVistaComedor() {
    const formato = document.getElementById('comedor-formato').value;
    const imgPreview = document.getElementById('preview-comedor');
    const medContainer = document.getElementById('medidas-comedor-container');

    if (formato.startsWith('rect')) {
        imgPreview.src = `imagenes/comedor_${formato}.jpg`;
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS DEL TABLERO RECTANGULAR (cm)</label>
                <button type="button" id="btn-estandar-comedor" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-comedor','comedor-medidas-inputs','comedor-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="comedor-medidas-inputs" style="display:flex; gap:10px; margin-top:5px;">
                <input type="number" id="med-tablero-largo" class="form-input-sm" placeholder="Largo (cm)" style="flex:1;">
                <input type="number" id="med-tablero-ancho" class="form-input-sm" placeholder="Ancho (cm)" style="flex:1;">
            </div>
            <input type="hidden" id="comedor-medidas-estandar" value="">
        `;
    } else if (formato.startsWith('circ')) {
        imgPreview.src = `imagenes/comedor_${formato}.jpg`;
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDA DEL TABLERO CIRCULAR (cm)</label>
                <button type="button" id="btn-estandar-comedor" data-estandar="0"
                    onclick="toggleMedidasEstandar('btn-estandar-comedor','comedor-medidas-inputs','comedor-medidas-estandar')"
                    style="font-size:10px;padding:3px 8px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#64748b;cursor:pointer;white-space:nowrap;">
                    📐 Medidas Estándar
                </button>
            </div>
            <div id="comedor-medidas-inputs" style="display:flex; gap:10px; margin-top:5px;">
                <input type="number" id="med-tablero-diametro" class="form-input-sm" placeholder="Diámetro (cm)" style="flex:1;">
            </div>
            <input type="hidden" id="comedor-medidas-estandar" value="">
        `;
    }

    imgPreview.onerror = function() {
        this.src = 'imagenes/sin_foto.jpg';
    };
}
/* ------------------------------------------------------------------------- */

/* --- 7. PYTHON GUARDAR --- */

function openConfigCentro() {
    document.querySelectorAll('#modal-config-centro input').forEach(inp => inp.value = '');
    document.getElementById('centro-notas').value = '';
    
    ['tablero-centro', 'base-centro'].forEach(tipo => {
        const imgEl = document.getElementById(`img-preview-${tipo}`);
        if(imgEl) imgEl.style.display = 'none';
    });

    const fInp = document.getElementById('centro-fotos');
    if (fInp) {
        fInp.setAttribute('multiple', 'multiple');
        if (!fInp.dataset.bound) {
            fInp.addEventListener('change', function() { _mostrarPreviewMultiplesFotos(this, 'centro'); });
            fInp.dataset.bound = '1';
        }
    }
    const prevCont = document.getElementById('preview-multiples-centro');
    if (prevCont) prevCont.innerHTML = '';

    document.getElementById('modal-config-centro').style.display = 'flex';
    document.getElementById('centro-tipo').selectedIndex = 0;
    actualizarVistaCentro();
}

function actualizarVistaCentro() {
    const tipo = document.getElementById('centro-tipo').value;
    const imgPreview = document.getElementById('preview-centro');
    
    const imgMap = {
        'Mesa de Centro': 'imagenes/mesa_centro.jpg',
        'Consola': 'imagenes/consola.jpg',
        'Mesa Lateral': 'imagenes/mesa_lateral.jpg'
    };
    
    imgPreview.onerror = null; 
    imgPreview.src = imgMap[tipo];
    
    imgPreview.onerror = function() {
        this.onerror = null;
        this.src = 'imagenes/sin_foto.jpg';
    };
}

async function confirmarCentro() {
    const precio = parseFloat(document.getElementById('conf-precio-centro').value);
    const skuTablero = document.getElementById('sku-tablero-centro').value;
    const skuBase = document.getElementById('sku-base-centro').value;

    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Ingresa el precio.', 'warning');
    if (!skuTablero || !skuBase) return Swal.fire('Faltan Datos', 'Debes seleccionar un Tablero y una Base.', 'warning');

    const tipo = document.getElementById('centro-tipo').value;
    const l = document.getElementById('centro-largo').value || '0';
    const a = document.getElementById('centro-ancho').value || '0';
    const e = document.getElementById('centro-espesor').value || '0';
    const hBase = document.getElementById('base-centro-altura').value || '0';
    const aBase = document.getElementById('base-centro-ancho').value || '0';
    
    const nombreTablero = document.getElementById('search-tablero-centro').value;
    const nombreBase = document.getElementById('search-base-centro').value;
    const notas = await procesarNotasConFotos(['tablero-centro', 'base-centro']);
    const notasTexto = document.getElementById('centro-notas').value;

    const specs = `
        <b>FORMATO:</b> ${tipo}<br>
        <b>TABLERO:</b> [SKU: ${skuTablero}] ${nombreTablero} (L${l}cm x A${a}cm x Espesor: ${e}cm)${notas['tablero-centro']}<br>
        <b>BASE ESTRUCTURAL:</b> [SKU: ${skuBase}] ${nombreBase} (Alto: ${hBase}cm x Ancho: ${aBase}cm)${notas['base-centro']}<br>
        ${notasTexto ? `<b style="color:var(--accent);">NOTAS:</b> ${notasTexto}` : ''}
    `;

    const imagenUrl = document.getElementById('preview-centro').src;
    
    const componentes = {
        'tablero-centro': skuTablero,
        'base-centro': skuBase
    };
    
    const imagenFinal = await subirFotosReferencia('centro-fotos', imagenUrl);
    addToCart(tipo + " Personalizada", precio, imagenFinal, specs, componentes);

    document.getElementById('modal-config-centro').style.display = 'none';
    
    Swal.fire({
        title: '¡Añadido al Carrito!',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#d4af37',
        confirmButtonText: 'Ir a cobrar',
        cancelButtonText: 'Seguir comprando'
    }).then((result) => {
        if (result.isConfirmed) toggleCart();
    });
}
/* ================================================================= */
/* --- LÓGICA DE BUTACAS Y SILLERÍA SUELTA --- */
/* ================================================================= */
function openConfigButaca() {
    document.querySelectorAll('#modal-config-butaca input').forEach(inp => inp.value = '');
    document.getElementById('butaca-cantidad').value = '1';
    document.getElementById('butaca-notas').value = '';
    
    ['estructura-butaca', 'tela-butaca'].forEach(tipo => {
        const imgEl = document.getElementById(`img-preview-${tipo}`);
        if(imgEl) imgEl.style.display = 'none';
    });

    const fInp = document.getElementById('butaca-fotos');
    if (fInp) {
        fInp.setAttribute('multiple', 'multiple');
        if (!fInp.dataset.bound) {
            fInp.addEventListener('change', function() { _mostrarPreviewMultiplesFotos(this, 'butaca'); });
            fInp.dataset.bound = '1';
        }
    }
    const prevCont = document.getElementById('preview-multiples-butaca');
    if (prevCont) prevCont.innerHTML = '';

    document.getElementById('modal-config-butaca').style.display = 'flex';
    document.getElementById('butaca-tipo').selectedIndex = 0;
    actualizarVistaButaca();
}

function actualizarVistaButaca() {
    const tipo = document.getElementById('butaca-tipo').value;
    const imgPreview = document.getElementById('preview-butaca');
    
    const imgMap = {
        'Butaca': 'imagenes/butaca.jpg',
        'Silla Suelta': 'imagenes/silla_suelta.jpg',
        'Sitial': 'imagenes/sitial.jpg',
        'Puff / Banqueta': 'imagenes/puff.jpg'
    };
    
    imgPreview.onerror = null; 
    imgPreview.src = imgMap[tipo];
    
    imgPreview.onerror = function() {
        this.onerror = null; 
        this.src = 'imagenes/sin_foto.jpg';
    };
}

async function confirmarButaca() {
    const precio = parseFloat(document.getElementById('conf-precio-butaca').value);
    const cantidad = document.getElementById('butaca-cantidad').value || "1";
    const skuEstructura = document.getElementById('sku-estructura-butaca').value;
    const skuTela = document.getElementById('sku-tela-butaca').value;

    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Ingresa el precio total negociado.', 'warning');
    if (!skuEstructura) return Swal.fire('Faltan Datos', 'Debes seleccionar la estructura o modelo base.', 'warning');

    const tipo = document.getElementById('butaca-tipo').value;
    const nombreEstructura = document.getElementById('search-estructura-butaca').value;
    const nombreTela = document.getElementById('search-tela-butaca').value || "Sin tapiz específico";
    const notas = await procesarNotasConFotos(['estructura-butaca', 'tela-butaca']);
    const notasTexto = document.getElementById('butaca-notas').value;

    const specs = `
        <b>PRODUCTO:</b> ${cantidad} Und(s) de ${tipo}<br>
        <b>ESTRUCTURA/MODELO:</b> [SKU: ${skuEstructura}] ${nombreEstructura}${notas['estructura-butaca']}<br>
        <b>TAPIZ:</b> ${skuTela ? `[SKU: ${skuTela}] ${nombreTela}` : nombreTela}${notas['tela-butaca']}<br>
        ${notasTexto ? `<b style="color:var(--accent);">NOTAS:</b> ${notasTexto}` : ''}
    `;

    const imagenUrl = document.getElementById('preview-butaca').src;
    const tituloCarrito = cantidad > 1 ? `${tipo} Personalizada (x${cantidad})` : `${tipo} Personalizada`;
    
    const componentes = {
        'estructura-butaca': skuEstructura,
        'tela-butaca': skuTela
    };
    
    const imagenFinal = await subirFotosReferencia('butaca-fotos', imagenUrl);
    addToCart(tituloCarrito, precio, imagenFinal, specs, componentes);

    document.getElementById('modal-config-butaca').style.display = 'none';
    
    Swal.fire({
        title: '¡Añadido al Carrito!',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#d4af37',
        confirmButtonText: 'Ir a cobrar',
        cancelButtonText: 'Seguir comprando'
    }).then((result) => {
        if (result.isConfirmed) toggleCart();
    });
}
// NOTA: El manejo de 'gestor-aprobacion' en changeView se hace en app.js,
// donde changeView ya está definida. No hacerlo aquí para evitar ReferenceError.

/* ================================================================= */
/* --- HELPER: SUBIR FOTOS DE REFERENCIA AL SERVIDOR             --- */
/* ================================================================= */
async function subirFotosReferencia(inputId, fallbackUrl) {
    const input = document.getElementById(inputId);
    if (!input || !input.files || input.files.length === 0) {
        return fallbackUrl;
    }

    let urls = [];
    Swal.fire({ title: 'Subiendo foto(s)...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        for (let i = 0; i < input.files.length; i++) {
            const formData = new FormData();
            formData.append('foto', input.files[i]); 

            const res = await apiFetch(`${API_URL}/api/upload-foto`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                urls.push(data.url);
            }
        }
        Swal.close();
        if (urls.length > 0) {
            return [fallbackUrl, ...urls].join('|');
        } else {
            return fallbackUrl;
        }
    } catch (e) {
        console.error("Error al subir fotos:", e);
        Swal.close();
        return fallbackUrl;
    }
}

/* ================================================================= */
/* --- HELPER: PROCESAR NOTAS CON FOTOS ADJUNTAS                 --- */
/* ================================================================= */
async function procesarNotasConFotos(tipos) {
    let resultados = {};
    let hayFotos = false;
    for (let tipo of tipos) {
        let input = document.getElementById(`foto-nota-${tipo}`);
        if (input && input.files && input.files.length > 0) hayFotos = true;
    }
    
    if (hayFotos) {
        Swal.fire({ title: 'Subiendo imágenes adjuntas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    }
    
    for (let tipo of tipos) {
        let notaTexto = document.getElementById(`nota-${tipo}`)?.value || '';
        let fotoUrl = '';
        let input = document.getElementById(`foto-nota-${tipo}`);
        
        if (input && input.files && input.files.length > 0) {
            const formData = new FormData();
            formData.append('foto', input.files[0]);
            try {
                const res = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.url) fotoUrl = data.url;
            } catch(e) {
                console.error("Error al subir foto de nota para", tipo, e);
            }
        }
        
        let notaHtml = '';
        if (notaTexto || fotoUrl) {
            notaHtml = ` <span style="color:#2563eb; font-size:11px;">↳ Nota: ${notaTexto}`;
            if (fotoUrl) {
                notaHtml += ` <a href="${fotoUrl}" target="_blank" style="color:#d97706; text-decoration:underline; font-weight:bold; margin-left:4px;">[Ver Foto]</a>`;
            }
            notaHtml += `</span>`;
        }
        resultados[tipo] = notaHtml;
    }
    
    if (hayFotos) Swal.close();
    return resultados;
}