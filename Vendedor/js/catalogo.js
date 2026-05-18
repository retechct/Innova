// === MÓDULO: Catálogo y configuradores de muebles ===
function renderGrid() {
    const grid = document.getElementById('product-grid');
    let filtered = [];

    // Filtramos los productos según la vista seleccionada (ignorando plantillas)
    if (currentMode === 'stock') {
        filtered = allProducts.filter(p => p.en_stock === true && p.es_plantilla === false);
    } else if (currentMode === 'catalogo') {
        filtered = allProducts.filter(p => p.en_stock === false && p.es_plantilla === false);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: gray; padding: 40px;">No hay productos disponibles en esta categoría.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="card">
            <img src="${p.foto}" onerror="this.src='imagenes/sin_foto.jpg'">
            <div class="card-info">
                ${p.en_stock ? '<span class="status-badge" style="background:#f0fdf4; color:var(--success)">ENTREGA INMEDIATA</span>' : '<span class="status-badge" style="background:#f1f5f9; color:var(--text-muted)">ESTÁNDAR</span>'}
                <h4>${p.nombre}</h4>
                <span class="price-tag">${p.precio > 0 ? 'S/ ' + p.precio.toFixed(2) : 'A Cotizar'}</span>
                <button class="btn-action btn-primary" onclick="addToCart('${p.nombre}', ${p.precio}, '${p.foto}', 'Venta Estándar')">
                    <i class="fa-solid fa-plus"></i> AÑADIR AL CARRO
                </button>
            </div>
        </div>
    `).join('');
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

function actualizarVistaSofa() {
    const modelo = document.getElementById('sofa-modelo').value;
    const imgPreview = document.getElementById('preview-sofa');
    const medContainer = document.getElementById('medidas-container');
    
    imgPreview.src = imagenesSofa[modelo] || tempItem.img;

    if (modelo === 'juego') {
        medContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:10px; font-weight:bold; color:gray;">CONSTRUIR JUEGO (L, A, F, H)</label>
                <button onclick="addCuerpoSofa(prompt('¿De cuántos cuerpos es esta pieza? (Ej: 3, 2, 1)'))" style="background:var(--accent); color:white; border:none; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:10px;">+ Añadir Pieza</button>
            </div>
            <div id="lista-cuerpos"></div>
        `;
        addCuerpoSofa('3'); 
    } else if (modelo === 'multi3') {
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MULTI 3 PIEZAS (L, A, F, Alto)</label>
            <div class="medida-row"><span style="font-size:10px; width:45px; font-weight:bold;">Grande:</span><input type="number" id="m3-l1" class="form-input-sm" placeholder="L"><input type="number" id="m3-a1" class="form-input-sm" placeholder="A"><input type="number" id="m3-f1" class="form-input-sm" placeholder="F"><input type="number" id="m3-h1" class="form-input-sm" placeholder="H"></div>
            <div class="medida-row"><span style="font-size:10px; width:45px; font-weight:bold;">Modular:</span><input type="number" id="m3-l2" class="form-input-sm" placeholder="L"><input type="number" id="m3-a2" class="form-input-sm" placeholder="A"><input type="number" id="m3-f2" class="form-input-sm" placeholder="F"><input type="number" id="m3-h2" class="form-input-sm" placeholder="H"></div>
        `;
    } else if (modelo === 'multi4') {
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MULTI 4 PIEZAS (L, A, F, Alto)</label>
            <div class="medida-row"><span style="font-size:10px; width:45px; font-weight:bold;">Gnde 1:</span><input type="number" id="m4-l1" class="form-input-sm" placeholder="L"><input type="number" id="m4-a1" class="form-input-sm" placeholder="A"><input type="number" id="m4-f1" class="form-input-sm" placeholder="F"><input type="number" id="m4-h1" class="form-input-sm" placeholder="H"></div>
            <div class="medida-row"><span style="font-size:10px; width:45px; font-weight:bold;">Gnde 2:</span><input type="number" id="m4-l2" class="form-input-sm" placeholder="L"><input type="number" id="m4-a2" class="form-input-sm" placeholder="A"><input type="number" id="m4-f2" class="form-input-sm" placeholder="F"><input type="number" id="m4-h2" class="form-input-sm" placeholder="H"></div>
            <div class="medida-row"><span style="font-size:10px; width:45px; font-weight:bold;">Modular:</span><input type="number" id="m4-l3" class="form-input-sm" placeholder="L"><input type="number" id="m4-a3" class="form-input-sm" placeholder="A"><input type="number" id="m4-f3" class="form-input-sm" placeholder="F"><input type="number" id="m4-h3" class="form-input-sm" placeholder="H"></div>
        `;
    } else if (modelo === 'u') {
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS EN "U" (cm)</label>
            <div class="medida-row" style="flex-wrap: wrap;">
                <input type="number" id="u-largo-izq" class="form-input-sm" placeholder="Largo Izq." style="width: 48%;">
                <input type="number" id="u-largo-der" class="form-input-sm" placeholder="Largo Der." style="width: 48%;">
                
                <input type="number" id="u-ancho" class="form-input-sm" placeholder="Ancho Gen." style="width: 31%; margin-top:5px;">
                <input type="number" id="u-fondo" class="form-input-sm" placeholder="Fondo Gen." style="width: 31%; margin-top:5px;">
                <input type="number" id="u-alto" class="form-input-sm" placeholder="Alto Gen." style="width: 31%; margin-top:5px;">
            </div>
        `;
    } else {
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS TOTALES (cm)</label>
            <div class="medida-row" style="flex-wrap: wrap;">
                <input type="number" id="med-largo" class="form-input-sm" placeholder="Largo" style="width: 48%;">
                <input type="number" id="med-ancho" class="form-input-sm" placeholder="Ancho" style="width: 48%;">
                <input type="number" id="med-fondo" class="form-input-sm" placeholder="Fondo" style="width: 48%; margin-top:5px;">
                <input type="number" id="med-alto" class="form-input-sm" placeholder="Alto" style="width: 48%; margin-top:5px;">
            </div>
        `;
    }
}

function addCuerpoSofa(cuerpos) {
    if (!cuerpos) return;
    cuerpos = cuerpos.trim();
    
    const div = document.createElement('div');
    div.className = 'medida-row cuerpos-medida';
    
    div.onclick = function() { seleccionarPieza(this, cuerpos); };

    // 4 inputs: L (Largo), A (Ancho), F (Fondo), H (Alto)
    div.innerHTML = `
        <span style="font-size:11px; font-weight:bold; width:35px; text-align:center;">${cuerpos} C.</span>
        <input type="number" class="form-input-sm c-largo" title="Largo" placeholder="L">
        <input type="number" class="form-input-sm c-ancho" title="Ancho" placeholder="A">
        <input type="number" class="form-input-sm c-fondo" title="Fondo" placeholder="F">
        <input type="number" class="form-input-sm c-alto" title="Alto" placeholder="H">
        <button onclick="event.stopPropagation(); this.parentElement.remove()" style="border:none; color:red; background:none; cursor:pointer; padding:2px;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    document.getElementById('lista-cuerpos').appendChild(div);
    seleccionarPieza(div, cuerpos);
}

function seleccionarPieza(elementoFila, tipoCuerpo) {
    // 1. Quitar la clase activa (azul) de todas las filas
    document.querySelectorAll('.cuerpos-medida').forEach(el => el.classList.remove('activa'));
    
    // 2. Pintar de azul la fila que acabamos de tocar
    elementoFila.classList.add('activa');
    
    // 3. Cambiar la imagen
    const imgPreview = document.getElementById('preview-sofa');
    
    if (imagenesSofa[tipoCuerpo]) {
        imgPreview.src = imagenesSofa[tipoCuerpo];
        
        // NUEVO: Si escribiste mal el nombre de la foto o es .png en vez de .jpg, 
        // muestra una imagen de aviso en lugar del ícono roto.
        imgPreview.onerror = function() { 
            this.src = 'imagenes/sin_foto.jpg';
        };
    } else {
        imgPreview.src = 'imagenes/sin_foto.jpg';
    }
}
/* ----------------------------------------------- */

/* --- REEMPLAZA LA FUNCIÓN confirmarPersonalizadoSofa COMPLETA --- */
function confirmarPersonalizadoSofa() {
    const precio = parseFloat(document.getElementById('conf-precio').value);
    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Debe ingresar el precio total.', 'warning');

    const modeloSelect = document.getElementById('sofa-modelo');
    const modeloBase = modeloSelect.options[modeloSelect.selectedIndex].text;
    const modeloVal = modeloSelect.value;
    
    // 1. Capturar Medidas
    let medidasText = "";
    if (modeloVal === 'juego') {
        const filas = document.querySelectorAll('.cuerpos-medida');
        filas.forEach(f => {
            const c = f.querySelector('span').innerText;
            const l = f.querySelector('.c-largo').value || '0', an = f.querySelector('.c-ancho').value || '0', fon = f.querySelector('.c-fondo').value || '0', a = f.querySelector('.c-alto').value || '0';
            medidasText += `[${c}: L${l}xA${an}xF${fon}xH${a}] `;
        });
    } else if (modeloVal === 'multi3') {
        const l1 = document.getElementById('m3-l1').value||'0', a1 = document.getElementById('m3-a1').value||'0', f1 = document.getElementById('m3-f1').value||'0', h1 = document.getElementById('m3-h1').value||'0';
        const l2 = document.getElementById('m3-l2').value||'0', a2 = document.getElementById('m3-a2').value||'0', f2 = document.getElementById('m3-f2').value||'0', h2 = document.getElementById('m3-h2').value||'0';
        medidasText = `<br>-> [Grande: L${l1}xA${a1}xF${f1}xH${h1}]<br>-> [Modular: L${l2}xA${a2}xF${f2}xH${h2}]`;
    } else if (modeloVal === 'multi4') {
        const l1 = document.getElementById('m4-l1').value||'0', a1 = document.getElementById('m4-a1').value||'0', f1 = document.getElementById('m4-f1').value||'0', h1 = document.getElementById('m4-h1').value||'0';
        const l2 = document.getElementById('m4-l2').value||'0', a2 = document.getElementById('m4-a2').value||'0', f2 = document.getElementById('m4-f2').value||'0', h2 = document.getElementById('m4-h2').value||'0';
        const l3 = document.getElementById('m4-l3').value||'0', a3 = document.getElementById('m4-a3').value||'0', f3 = document.getElementById('m4-f3').value||'0', h3 = document.getElementById('m4-h3').value||'0';
        medidasText = `<br>-> [Grande 1: L${l1}xA${a1}xF${f1}xH${h1}]<br>-> [Grande 2: L${l2}xA${a2}xF${f2}xH${h2}]<br>-> [Modular: L${l3}xA${a3}xF${f3}xH${h3}]`;
    } else if (modeloVal === 'u') {
        const li = document.getElementById('u-largo-izq').value || '0', ld = document.getElementById('u-largo-der').value || '0';
        const a = document.getElementById('u-ancho').value || '0', f = document.getElementById('u-fondo').value || '0', h = document.getElementById('u-alto').value || '0';
        medidasText = `[Izq: L${li}] [Der: L${ld}] [General: A${a}xF${f}xH${h}]`;
    } else {
        const l = document.getElementById('med-largo').value || '0', an = document.getElementById('med-ancho').value || '0';
        const f = document.getElementById('med-fondo').value || '0', a = document.getElementById('med-alto').value || '0';
        medidasText = `[Total: L${l}xA${an}xF${f}xH${a}]`;
    }

    // 2. Banqueta
    let banquetaText = "";
    if (document.getElementById('check-banqueta').checked) {
        const bMod = document.getElementById('bq-mod').value || 'Estándar', bL = document.getElementById('bq-largo').value || '0';
        const bAn = document.getElementById('bq-ancho').value || '0', bF = document.getElementById('bq-fondo').value || '0', bA = document.getElementById('bq-alto').value || '0';
        banquetaText = `<br><b style="color:var(--accent)">BANQUETA:</b> Mod: ${bMod} | L${bL} x A${bAn} x F${bF} x H${bA}`;
    }

    // 3. CAPTURAR DATOS DE ERP
    const skuTela = document.getElementById('sku-tela').value;
    const nombreTela = document.getElementById('search-tela').value;
    if(!skuTela) return Swal.fire('Dato Faltante', 'Debe seleccionar una Tela Principal', 'warning');

    const espuma = document.getElementById('c-espuma').value;
    const costura = document.getElementById('c-costura').value;
    const respaldo = document.getElementById('c-respaldo').value;
    const brazo = document.getElementById('med-brazo').value || '0';

    const cEnteros = document.getElementById('c-enteros').value || '0';
    const cDiseno = document.getElementById('c-diseno').value || '0';
    const skuCojinEnt = document.getElementById('sku-cojin-entero').value || 'N/A';
    const skuCojinDis = document.getElementById('sku-cojin-diseno').value || 'N/A';

    const skuBase = document.getElementById('sku-base').value;
    const nombreBase = document.getElementById('search-base').value;

    const specs = `
        <b>MOD:</b> ${modeloBase} ${medidasText}<br>
        <b>TELA PRINCIPAL:</b> [SKU: ${skuTela}] ${nombreTela}<br>
        <b>INTERIOR/ESTRUCTURA:</b> ${espuma} | ${costura} | ${respaldo} | Brazo: ${brazo}cm<br>
        <b style="color:#7c3aed;">COJINERÍA:</b><br>
        - ${cEnteros} Enteros (Telas): [SKU: ${skuCojinEnt}]<br>
        - ${cDiseno} c/Diseño (Patrones): [SKU: ${skuCojinDis}]<br>
        <b>BASE:</b> [SKU: ${skuBase}] ${nombreBase}
        ${banquetaText}
    `;

    // USAMOS TUS FUNCIONES EXACTAS PARA AGREGAR AL CARRO
    const componentes = {
        tela: document.getElementById('sku-tela').value,
        'cojin-entero': document.getElementById('sku-cojin-entero').value,
        'cojin-diseno': document.getElementById('sku-cojin-diseno').value,
        base: document.getElementById('sku-base').value
    };

    addToCart(tempItem.name, precio, tempItem.img, specs, componentes);
    closeModal();

    // NUEVO: PREGUNTAR SI QUIERE IR A PAGAR/IMPRIMIR
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
            toggleCart(); // Esto abre tu slider del carrito automáticamente
        }
    });
}
/* ================================================================= */
/* --- ENVIAR COMEDOR AL CARRITO --- */
/* ================================================================= */

function confirmarComedor() {
    // 1. Validaciones básicas
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

    // 2. Extraer el formato y calcular la cantidad de sillas
    const formatoVal = document.getElementById('comedor-formato').value; 
    const esRectangular = formatoVal.startsWith('rect');
    const cantidadSillas = formatoVal.split('-')[1]; 
    const formatoTexto = esRectangular ? 'Rectangular' : 'Circular';

    // 3. Extraer las medidas dinámicas
    let medidasTexto = "";
    if (esRectangular) {
        const largo = document.getElementById('med-tablero-largo')?.value || "0";
        const ancho = document.getElementById('med-tablero-ancho')?.value || "0";
        medidasTexto = `L${largo}cm x A${ancho}cm`;
    } else {
        const diametro = document.getElementById('med-tablero-diametro')?.value || "0";
        medidasTexto = `Diámetro ${diametro}cm`;
    }

    // 4. Extraer nombres y características
    const nombreTablero = document.getElementById('search-tablero').value;
    const corte = document.getElementById('tablero-corte').value;
    const canto = document.getElementById('tablero-canto').value;

    const nombreBaseMesa = document.getElementById('search-base-mesa').value;
    const alturaBase = document.getElementById('base-altura').value || "0";
    const anchoBase = document.getElementById('base-ancho').value || "0";

    const nombreSilla = document.getElementById('search-silla').value;
    const nombreTelaSilla = document.getElementById('search-tela-silla').value;
    const skuTelaSilla = document.getElementById('sku-tela-silla').value;

    // 5. ARMAR EL DESGLOSE FINAL (Igual que en el sofá)
    const specs = `
        <b>FORMATO:</b> ${formatoTexto} para ${cantidadSillas} personas<br>
        <b>MEDIDAS:</b> ${medidasTexto}<br>
        <b>TABLERO:</b> [SKU: ${skuTablero}] ${nombreTablero} (Corte: ${corte}, Canto: ${canto})<br>
        <b>BASE MESA:</b> [SKU: ${skuBaseMesa}] ${nombreBaseMesa} (Alto: ${alturaBase}cm, Ancho: ${anchoBase}cm)<br>
        <b>SILLERÍA:</b> ${cantidadSillas} Unds x [SKU: ${skuSilla}] ${nombreSilla}<br>
        <b>TAPIZ SILLAS:</b> ${skuTelaSilla ? `[SKU: ${skuTelaSilla}] ${nombreTelaSilla}` : "Sin tapiz específico"}
    `;

    // 6. ENVIAR AL CARRITO USANDO TU FUNCIÓN UNIVERSAL
    const nombreProducto = `Comedor Pro ${formatoTexto} (${cantidadSillas} Sillas)`;
    const imagenUrl = document.getElementById('preview-comedor').src;
    
    const componentes = {
        tablero: skuTablero,
        'base-mesa': skuBaseMesa,
        silla: skuSilla,
        'tela-silla': skuTelaSilla
    };

    addToCart(nombreProducto, precio, imagenUrl, specs, componentes);

    // 7. Cerrar modal y preguntar si quiere ir a pagar
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
            toggleCart(); // Abre tu slider del carrito automáticamente
        }
    });
}

/* ----------------------------------------------------------- */

/* --- 6. CARRITO Y STEPPER --- */
function openConfigComedor() {
    // 1. Limpieza de fantasmas
    document.querySelectorAll('#modal-config-comedor input[type="text"], #modal-config-comedor input[type="number"], #modal-config-comedor input[type="hidden"]').forEach(inp => inp.value = '');
    document.querySelectorAll('#modal-config-comedor select').forEach(sel => sel.selectedIndex = 0);
    
    ['tablero', 'base-mesa', 'silla', 'tela-silla'].forEach(tipo => {
        const imgEl = document.getElementById(`img-preview-${tipo}`);
        const searchEl = document.getElementById(`search-${tipo}`);
        if(imgEl) imgEl.style.display = 'none';
        if(searchEl) searchEl.value = '';
    });

    // 2. Abrir Modal
    document.getElementById('modal-config-comedor').style.display = 'flex';
    document.getElementById('comedor-formato').value = 'rect-6'; // Por defecto 6 sillas rect.
    actualizarVistaComedor();
}

function actualizarVistaComedor() {
    const formato = document.getElementById('comedor-formato').value;
    const imgPreview = document.getElementById('preview-comedor');
    const medContainer = document.getElementById('medidas-comedor-container');

    // Mapeo dinámico de inputs según la forma de la mesa
    if (formato.startsWith('rect')) {
        imgPreview.src = `imagenes/comedor_${formato}.jpg`; // Ej: imagenes/comedor_rect-6.jpg
        
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDAS DEL TABLERO RECTANGULAR (cm)</label>
            <div style="display:flex; gap:10px; margin-top:5px;">
                <input type="number" id="med-tablero-largo" class="form-input-sm" placeholder="Largo (cm)" style="flex:1;">
                <input type="number" id="med-tablero-ancho" class="form-input-sm" placeholder="Ancho (cm)" style="flex:1;">
            </div>
        `;
    } else if (formato.startsWith('circ')) {
        imgPreview.src = `imagenes/comedor_${formato}.jpg`; // Ej: imagenes/comedor_circ-4.jpg
        
        medContainer.innerHTML = `
            <label style="font-size:10px; font-weight:bold; color:gray;">MEDIDA DEL TABLERO CIRCULAR (cm)</label>
            <div style="display:flex; gap:10px; margin-top:5px;">
                <input type="number" id="med-tablero-diametro" class="form-input-sm" placeholder="Diámetro (cm)" style="flex:1;">
            </div>
        `;
    }

    // Por si aún no has guardado las fotos en tu carpeta
    imgPreview.onerror = function() {
        this.src = 'imagenes/sin_foto.jpg';
    };
}
/* ------------------------------------------------------------------------- */

/* --- 7. PYTHON GUARDAR --- */

function openConfigCentro() {
    // Limpieza de inputs
    document.querySelectorAll('#modal-config-centro input').forEach(inp => inp.value = '');
    document.getElementById('centro-notas').value = '';
    
    ['tablero-centro', 'base-centro'].forEach(tipo => {
        const imgEl = document.getElementById(`img-preview-${tipo}`);
        if(imgEl) imgEl.style.display = 'none';
    });

    document.getElementById('modal-config-centro').style.display = 'flex';
    document.getElementById('centro-tipo').selectedIndex = 0;
    actualizarVistaCentro();
}

function actualizarVistaCentro() {
    const tipo = document.getElementById('centro-tipo').value;
    const imgPreview = document.getElementById('preview-centro');
    
    // Puedes agregar imágenes en tu carpeta como: mesa_centro.jpg, consola.jpg
    const imgMap = {
        'Mesa de Centro': 'imagenes/mesa_centro.jpg',
        'Consola': 'imagenes/consola.jpg',
        'Mesa Lateral': 'imagenes/mesa_lateral.jpg'
    };
    
    // 1. Limpiamos cualquier error previo
    imgPreview.onerror = null; 
    
    // 2. Intentamos cargar la foto original
    imgPreview.src = imgMap[tipo];
    
    // 3. Sistema a prueba de bucles infinitos
    imgPreview.onerror = function() {
        this.onerror = null; // ¡Este es el freno de emergencia! Evita el bucle.
        this.src = 'imagenes/sin_foto.jpg'; // Usamos tu imagen local en lugar de la web bloqueada
    };
}

function confirmarCentro() {
    const precio = parseFloat(document.getElementById('conf-precio-centro').value);
    const skuTablero = document.getElementById('sku-tablero-centro').value;
    const skuBase = document.getElementById('sku-base-centro').value;

    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Ingresa el precio.', 'warning');
    if (!skuTablero || !skuBase) return Swal.fire('Faltan Datos', 'Debes seleccionar un Tablero y una Base.', 'warning');

    const tipo = document.getElementById('centro-tipo').value;
    // Medidas Tablero
    const l = document.getElementById('centro-largo').value || '0';
    const a = document.getElementById('centro-ancho').value || '0';
    const e = document.getElementById('centro-espesor').value || '0';
    // Medidas Base
    const hBase = document.getElementById('base-centro-altura').value || '0';
    const aBase = document.getElementById('base-centro-ancho').value || '0';
    
    const nombreTablero = document.getElementById('search-tablero-centro').value;
    const nombreBase = document.getElementById('search-base-centro').value;
    const notas = document.getElementById('centro-notas').value;

    const specs = `
        <b>FORMATO:</b> ${tipo}<br>
        <b>TABLERO:</b> [SKU: ${skuTablero}] ${nombreTablero} (L${l}cm x A${a}cm x Espesor: ${e}cm)<br>
        <b>BASE ESTRUCTURAL:</b> [SKU: ${skuBase}] ${nombreBase} (Alto: ${hBase}cm x Ancho: ${aBase}cm)<br>
        ${notas ? `<b style="color:var(--accent);">NOTAS:</b> ${notas}` : ''}
    `;

    const imagenUrl = document.getElementById('preview-centro').src;
    
    const componentes = {
        'tablero-centro': skuTablero,
        'base-centro': skuBase
    };
    
    addToCart(tipo + " Personalizada", precio, imagenUrl, specs, componentes);

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
        this.src = 'imagenes/sin_foto.jpg'; // Aseguramos el fallback local
    };
}

function confirmarButaca() {
    const precio = parseFloat(document.getElementById('conf-precio-butaca').value);
    const cantidad = document.getElementById('butaca-cantidad').value || "1";
    const skuEstructura = document.getElementById('sku-estructura-butaca').value;
    const skuTela = document.getElementById('sku-tela-butaca').value;

    if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Ingresa el precio total negociado.', 'warning');
    if (!skuEstructura) return Swal.fire('Faltan Datos', 'Debes seleccionar la estructura o modelo base.', 'warning');

    const tipo = document.getElementById('butaca-tipo').value;
    const nombreEstructura = document.getElementById('search-estructura-butaca').value;
    const nombreTela = document.getElementById('search-tela-butaca').value || "Sin tapiz específico";
    const notas = document.getElementById('butaca-notas').value;

    const specs = `
        <b>PRODUCTO:</b> ${cantidad} Und(s) de ${tipo}<br>
        <b>ESTRUCTURA/MODELO:</b> [SKU: ${skuEstructura}] ${nombreEstructura}<br>
        <b>TAPIZ:</b> ${skuTela ? `[SKU: ${skuTela}] ${nombreTela}` : nombreTela}<br>
        ${notas ? `<b style="color:var(--accent);">NOTAS:</b> ${notas}` : ''}
    `;

    const imagenUrl = document.getElementById('preview-butaca').src;
    const tituloCarrito = cantidad > 1 ? `${tipo} Personalizada (x${cantidad})` : `${tipo} Personalizada`;
    
    const componentes = {
        'estructura-butaca': skuEstructura,
        'tela-butaca': skuTela
    };
    
    addToCart(tituloCarrito, precio, imagenUrl, specs, componentes);

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