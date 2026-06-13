// === MÓDULO: Materiales, buscadores e insumos ===
function filtrarMaterial(tipoInput) {
    let tipoData = '';
    let listContainer = document.getElementById(`list-${tipoInput}`);
    let searchInput = document.getElementById(`search-${tipoInput}`).value.toLowerCase();
    
    if (searchInput.trim() === '') {
        document.getElementById(`img-preview-${tipoInput}`).style.display = 'none';
        document.getElementById(`sku-${tipoInput}`).value = '';
    }

   // 1. SEPARACIÓN ABSOLUTA (Butacas tienen su propio almacén)
    if (tipoInput === 'tela' || tipoInput === 'cojin-entero' || tipoInput === 'tela-silla' || tipoInput === 'tela-butaca' || tipoInput === 'tela-cojin' || tipoInput === 'cojin-rev-entero') tipoData = 'telas';
    else if (tipoInput === 'cojin-diseno' || tipoInput === 'cojin-rev-diseno') tipoData = 'cojines';
    else if (tipoInput === 'base') tipoData = 'bases';
    else if (tipoInput === 'tablero' || tipoInput === 'tablero-centro') tipoData = 'tableros'; 
    else if (tipoInput === 'base-mesa' || tipoInput === 'base-centro') tipoData = 'bases_comedor'; 
    else if (tipoInput === 'silla') tipoData = 'sillas';
    else if (tipoInput === 'estructura-butaca') tipoData = 'butacas';

    // Protección por si el catálogo aún no carga
    if (!maestroMateriales[tipoData]) return;

    let opciones = maestroMateriales[tipoData].filter(item => {
        let textoCompleto = Object.values(item).join(' ').toLowerCase();
        return textoCompleto.includes(searchInput);
    });

    // --- MAGIA FASE 2: El botón de Pinterest estático siempre al inicio ---
    // --- MAGIA FASE 2: El botón de Pinterest estático siempre al inicio ---
    let htmlPinterest = `
        <div class="custom-option-item" style="background: #fffcf0; border-left: 4px solid #f59e0b;" onclick="abrirModalPinterest('${tipoInput}')">
            <div style="width: 45px; height: 45px; border-radius: 5px; background: #f59e0b; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                <i class="fa-brands fa-pinterest-p"></i>
            </div>
            <div>
                <span class="custom-option-sku" style="color: #d97706;">COMPRA A MEDIDA</span>
                <div class="custom-option-text"><strong style="color: #b45309;">✨ DISEÑO PINTEREST / ESPECIAL</strong><br>Añadir detalles de esta pieza</div>
            </div>
        </div>
    `;

    // 2. ENSEÑAMOS AL SISTEMA A DIBUJAR CADA COSA (Datos de la BD)
    let htmlOpcionesBD = opciones.map(item => {
        let titulo = '', subtitulo = '';
        
        if (tipoData === 'telas') { titulo = `${item.coleccion} - ${item.color}`; subtitulo = item.proveedor; }
        else if (tipoData === 'cojines') { titulo = item.nombre_diseno; subtitulo = item.tipo_tela; }
        else if (tipoData === 'bases') { titulo = `${item.modelo} - ${item.color}`; subtitulo = `${item.tipo} ${item.material} ${item.medida}`; }
        else if (tipoData === 'tableros') { titulo = `${item.nombre} (${item.color})`; subtitulo = `${item.material_base} - ${item.acabado}`; }
        else if (tipoData === 'bases_comedor') { titulo = item.modelo; subtitulo = `${item.material} - ${item.color}`; }
        else if (tipoData === 'sillas') { titulo = item.modelo; subtitulo = `${item.material} - ${item.color}`; }
        else if (tipoData === 'butacas') { titulo = item.modelo; subtitulo = `${item.material} - ${item.color}`; }

        let safeTitulo = titulo.replace(/'/g, "\\'"); 
        
        const isAgotado       = item.estado === 'Agotado';
        const isDescontinuado = item.estado === 'Descontinuado';
        const noDisponible    = isAgotado || isDescontinuado;
        const styleAgotado    = noDisponible ? 'filter: grayscale(1); opacity: 0.5; cursor: not-allowed; background: #f1f5f9;' : '';
        const provSeguro      = (item.proveedor || '').replace(/'/g, "\'");
        const action          = noDisponible ? '' : `onclick="seleccionarMaterial('${tipoInput}', '${item.sku}', '${safeTitulo}', '${item.foto_url}', '${provSeguro}')"`;
        const badge           = isAgotado       ? '<b style="color:red;">(AGOTADO)</b>'
                              : isDescontinuado ? '<b style="color:#6b7280;">(DESCONTINUADO)</b>'
                              : '';

        return `
            <div class="custom-option-item" ${action} style="${styleAgotado}">
                <img src="${item.foto_url}" class="custom-option-img" onerror="this.src='imagenes/sin_foto.jpg'">
                <div style="flex-grow:1;">
                    <span class="custom-option-sku">${item.sku} ${badge}</span>
                    <div class="custom-option-text"><strong>${titulo}</strong><br>${subtitulo}</div>
                </div>
            </div>`;
    }).join('');
    
    // 3. Unimos la opción Pinterest + Las opciones de la Base de Datos
    listContainer.innerHTML = htmlPinterest + htmlOpcionesBD;
    
    listContainer.classList.add('show');
}
function seleccionarMaterial(tipoInput, sku, nombre, fotoUrl, proveedor) {
    // Guardamos el SKU secreto
    document.getElementById(`sku-${tipoInput}`).value = sku;
    // Ponemos el nombre en el buscador
    document.getElementById(`search-${tipoInput}`).value = nombre;

    // Guardamos el proveedor en su campo hidden (si existe)
    const provHidden = document.getElementById(`proveedor-${tipoInput}`);
    if (provHidden) provHidden.value = proveedor || '';
    
    // MOSTRAMOS LA IMAGEN EN MINIATURA
    let imgPreview = document.getElementById(`img-preview-${tipoInput}`);
    if (imgPreview) {
        imgPreview.src = fotoUrl;
        imgPreview.style.display = 'block'; 
    }

    // INYECTAMOS CAMPO DE NOTA DINÁMICO
    let searchInput = document.getElementById(`search-${tipoInput}`);
    let noteInputId = `nota-${tipoInput}`;
    let fileInputId = `foto-nota-${tipoInput}`;
    let noteInput = document.getElementById(noteInputId);
    
    if (!noteInput && searchInput) {
        let container = document.createElement('div');
        container.style.cssText = 'display: flex; gap: 5px; margin-top: 6px; width: 100%;';

        noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.id = noteInputId;
        noteInput.className = 'form-input-sm';
        noteInput.placeholder = 'Añadir nota a esta pieza (opcional)';
        noteInput.style.cssText = 'flex: 1; font-size: 11px; border: 1px dashed #a78bfa; background-color: #fdf4ff; box-sizing: border-box; margin: 0;';

        // Input oculto real (el que catalogo.js lee por ID)
        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = fileInputId;
        fileInput.accept = 'image/*,application/pdf';
        fileInput.style.cssText = 'display:none;';

        // Botón 📷 Tomar foto
        let lblCam = document.createElement('label');
        lblCam.style.cssText = 'cursor:pointer;background:#0f172a;color:#fff;padding:5px 7px;border-radius:6px;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;';
        lblCam.innerHTML = '📷';
        lblCam.title = 'Tomar foto';
        let inputCam = document.createElement('input');
        inputCam.type = 'file';
        inputCam.accept = 'image/*';
        inputCam.setAttribute('capture', 'environment');
        inputCam.style.cssText = 'display:none;';
        inputCam.addEventListener('change', function() { _syncPiezaFoto(this, fileInputId); });
        lblCam.appendChild(inputCam);

        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            const labelEl = document.getElementById(`foto-nota-label-${tipoInput}`);
            if (labelEl) {
                labelEl.textContent = file.type.startsWith('image/') ? '📷 ' + file.name : '📄 ' + file.name;
                labelEl.style.display = 'inline';
            }
            // Mostrar miniatura con zoom para imágenes
            if (file.type.startsWith('image/')) {
                const imgPreviewNota = document.getElementById(`img-preview-${tipoInput}`);
                if (imgPreviewNota) {
                    const reader = new FileReader();
                    reader.onload = e => {
                        imgPreviewNota.src = e.target.result;
                        imgPreviewNota.style.display = 'block';
                        _activarZoomEnImagen(imgPreviewNota);
                    };
                    reader.readAsDataURL(file);
                }
            }
        });

        // Botón 📁 Seleccionar
        let lblGal = document.createElement('label');
        lblGal.style.cssText = 'cursor:pointer;background:#e2e8f0;color:#0f172a;padding:5px 7px;border-radius:6px;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;';
        lblGal.innerHTML = '📁';
        lblGal.title = 'Seleccionar archivo';
        lblGal.appendChild(fileInput);

        // Indicador visual de archivo seleccionado
        let fileLabel = document.createElement('span');
        fileLabel.id = `foto-nota-label-${tipoInput}`;
        fileLabel.style.cssText = 'font-size:9px;color:#7c3aed;display:none;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

        container.appendChild(noteInput);
        container.appendChild(lblCam);
        container.appendChild(lblGal);
        container.appendChild(fileLabel);
        
        searchInput.parentNode.insertBefore(container, searchInput.nextSibling);
    }
    
    if (noteInput) {
        if (sku.startsWith('REQ-PIN-')) {
            noteInput.value = `Ver foto adjunta: ${fotoUrl}`;
        } else {
            noteInput.value = ''; 
        }
    }
    
    // Cerramos la lista
    let listContainer = document.getElementById(`list-${tipoInput}`);
    if (listContainer) listContainer.classList.remove('show');
}

// Para cerrar las listas desplegables si se hace clic afuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-options').forEach(el => el.classList.remove('show'));
    }
});
// NOTA: destinoActual y tipoActual se declaran en config.js — no redeclarar aquí


/* --- LÓGICA PARA AMPLIAR IMAGEN (ZOOM) --- */
function ampliarImagen(url) {
    if (!url || url === '') return;

    // Crear overlay de zoom interactivo (mejor que Swal para imágenes)
    let overlay = document.getElementById('_innova_zoom_overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = '_innova_zoom_overlay';
        overlay.style.cssText = `
            display:none; position:fixed; inset:0; z-index:99999;
            background:rgba(10,8,5,0.92); cursor:zoom-out;
            align-items:center; justify-content:center;
            touch-action:none;
        `;
        // Botón cerrar
        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.style.cssText = `
            position:absolute; top:14px; right:18px; background:transparent;
            border:none; color:#fff; font-size:26px; cursor:pointer;
            z-index:2; line-height:1; opacity:0.8;
        `;
        btnClose.onclick = () => _cerrarZoom();

        const imgEl = document.createElement('img');
        imgEl.id = '_innova_zoom_img';
        imgEl.style.cssText = `
            max-width:90vw; max-height:88vh; border-radius:8px;
            object-fit:contain; user-select:none; transition:transform 0.15s ease;
            transform-origin:center center;
        `;
        // Hint de zoom
        const hint = document.createElement('div');
        hint.style.cssText = `
            position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
            color:rgba(255,255,255,0.45); font-size:11px; font-family:sans-serif;
            pointer-events:none; white-space:nowrap;
        `;
        hint.textContent = 'Pinch para zoom · Rueda para zoom · Click para cerrar';

        overlay.appendChild(btnClose);
        overlay.appendChild(imgEl);
        overlay.appendChild(hint);
        document.body.appendChild(overlay);

        // Cerrar al click en el fondo
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === imgEl) _cerrarZoom();
        });

        // Zoom con rueda del ratón (desktop)
        let _scale = 1;
        imgEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            _scale = Math.min(Math.max(_scale + (e.deltaY < 0 ? 0.15 : -0.15), 1), 5);
            imgEl.style.transform = `scale(${_scale})`;
        }, { passive: false });

        // Pinch-to-zoom (móvil)
        let _touches = [], _lastDist = 0;
        overlay.addEventListener('touchstart', (e) => {
            _touches = Array.from(e.touches);
            if (_touches.length === 2) {
                _lastDist = Math.hypot(
                    _touches[0].clientX - _touches[1].clientX,
                    _touches[0].clientY - _touches[1].clientY
                );
            }
        }, { passive: true });
        overlay.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (_lastDist > 0) {
                _scale = Math.min(Math.max(_scale * (dist / _lastDist), 1), 5);
                imgEl.style.transform = `scale(${_scale})`;
            }
            _lastDist = dist;
        }, { passive: false });
        overlay.addEventListener('touchend', () => { _lastDist = 0; }, { passive: true });

        // Cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') _cerrarZoom();
        });

        function _cerrarZoom() {
            overlay.style.display = 'none';
            imgEl.style.transform = 'scale(1)';
            _scale = 1;
        }
        overlay._cerrar = _cerrarZoom;
    }

    const imgEl = document.getElementById('_innova_zoom_img');
    imgEl.src = url;
    imgEl.style.transform = 'scale(1)';
    overlay.style.display = 'flex';
}

// Helper: aplicar zoom a imágenes de nota subidas dinámicamente
function _activarZoomEnImagen(imgEl) {
    if (!imgEl) return;
    imgEl.style.cursor = 'zoom-in';
    imgEl.onclick = () => ampliarImagen(imgEl.src);
}

/* ================================================================= */
/* --- LÓGICA DE MÚLTIPLES PAGOS Y COMPROBANTES --- */
/* ================================================================= */
function abrirModalCreacion() {
    // 1. Limpiamos solo el nombre (las notas y fotos ya están en el otro formulario)
    document.getElementById('creacion-nombre').value = '';
    
    // 2. Mostramos el modal flotante de la estrella directamente
    document.getElementById('modal-creacion').style.display = 'flex';
}

async function enviarCreacionBD() {
    const nombre = document.getElementById('creacion-nombre').value;
    if (!nombre) {
        return Swal.fire('Falta el Nombre', 'Ponle un nombre a tu plantilla para encontrarla fácil luego.', 'warning');
    }

    let detalles_extraidos = "";
    let categoria_detectada = "Personalizado";
    let notas = "";
    let inputFotos = null;

    const modalSofa = document.getElementById('modal-config').style.display;
    const modalComedor = document.getElementById('modal-config-comedor').style.display;

    // ABSORBEMOS DATOS SEGÚN QUÉ MODAL ESTÉ ABIERTO
    if (modalSofa === 'flex' || modalSofa === 'block') {
        categoria_detectada = "Sofá";
        notas = document.getElementById('sofa-notas').value;
        inputFotos = document.getElementById('sofa-fotos');
        
        const modeloSofa = document.getElementById('sofa-modelo').options[document.getElementById('sofa-modelo').selectedIndex].text;
        const telaPrincipal = document.getElementById('search-tela').value || 'Sin definir';
        detalles_extraidos = `Modelo: ${modeloSofa}\nTela: ${telaPrincipal}`;
    } 
    else if (modalComedor === 'flex' || modalComedor === 'block') {
        categoria_detectada = "Comedor";
        notas = document.getElementById('comedor-notas').value;
        inputFotos = document.getElementById('comedor-fotos');
        
        const formatoComedor = document.getElementById('comedor-formato').options[document.getElementById('comedor-formato').selectedIndex].text;
        const tablero = document.getElementById('search-tablero').value || 'Sin definir';
        detalles_extraidos = `Formato: ${formatoComedor}\nTablero: ${tablero}`;
    }

    const formData = new FormData();
    
    // CORRECCIÓN 1: Ahora detecta al usuario logueado en vez de usar siempre "1"
    const idVendedor = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.id : 1;
    formData.append('vendedor_id', idVendedor); 
    
    formData.append('nombre_modelo', nombre);
    formData.append('categoria', categoria_detectada);
    formData.append('detalles_tecnicos', detalles_extraidos);
    formData.append('notas_casqueria', notas);

    // CORRECCIÓN 2: Unificamos todo en un solo gran ADN
    let adn = { ...tempItem }; // Tomamos la base (foto y nombre)
    const selectorContenedor = categoria_detectada === "Comedor" ? '#modal-config-comedor' : '#modal-config';
    
    // Escaneamos todos los campos del formulario y los sumamos al ADN
    document.querySelectorAll(`${selectorContenedor} input, ${selectorContenedor} select, ${selectorContenedor} textarea`).forEach(el => {
        if(el.id && el.type !== 'file') {
            adn[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        }
    });
    
    // Lo enviamos una sola vez
    formData.append('config_json', JSON.stringify(adn));

    if (inputFotos && inputFotos.files.length > 0) {
        for (let i = 0; i < inputFotos.files.length; i++) {
            formData.append('fotos', inputFotos.files[i]);
        }
    }

    try {
        Swal.fire({ title: 'Guardando plantilla...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        const response = await apiFetch(`${API_URL}/api/creaciones`, { method: 'POST', body: formData });
        const result = await response.json();

        if (response.ok) {
            Swal.fire({ title: '¡Plantilla Guardada!', icon: 'success', confirmButtonColor: '#d4af37' });
            document.getElementById('modal-creacion').style.display = 'none';
        } else {
            Swal.fire('Error', result.error || 'No se pudo guardar.', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'No hay conexión con el servidor.', 'error');
    }
}
async function verMisCreaciones() {
    try {
        // 1. Ocultar TODAS las secciones igual que changeView
        ['view-productos','view-plantillas','view-pedidos','view-taller',
         'view-inventario','view-gestor-aprobacion','view-logistica',
         'view-usuarios-admin','view-proveedores','vista-contratos'
        ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

        // Mostrar solo view-productos
        document.getElementById('view-productos').style.display = 'block';

        // 2. Cambiamos el Título Principal
        document.getElementById('view-title').innerText = 'MIS CREACIONES (PLANTILLAS)';
        document.getElementById('view-icon').className = 'fa-solid fa-wand-magic-sparkles';
        
        // 3. Pedimos los datos a tu servidor Python
        const response = await apiFetch(`${API_URL}/api/creaciones`);
        const creaciones = await response.json();
        
        // ¡AQUÍ ESTABA EL ERROR! Ahora usamos el ID correcto de tu HTML: 'product-grid'
        const container = document.getElementById('product-grid'); 
        container.innerHTML = ""; 
        
        // Si Python devuelve un error, lo atrapamos
        if (creaciones.error) { throw new Error(creaciones.error); }

        if (creaciones.length === 0) {
            container.innerHTML = "<p style='grid-column: 1/-1; text-align:center; padding:50px; color:gray;'>Aún no tienes plantillas guardadas. ¡Crea una usando la estrella!</p>";
            if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
            return;
        }

        // 4. Dibujamos las tarjetas doradas
        container.innerHTML = creaciones.map(item => `
            <div class="card card-template" style="position: relative;">
                <div class="badge-template"><i class="fa-solid fa-star"></i> PLANTILLA</div>
                <img src="${API_URL}/uploads/${item.foto_url}" onerror="this.src='imagenes/sin_foto.jpg'">
                <div class="card-info">
                    <span class="status-badge status-template">${item.categoria.toUpperCase()}</span>
                    <h4>${item.nombre}</h4>
                    <p style="font-size: 11px; color: #64748b; line-height: 1.3; margin-bottom: 15px; text-align: left;">
                        ${(item.detalles || "Sin detalles").replace(/\n/g, '<br>')}
                    </p>
                    <div style="display:flex; gap:5px; margin-top: auto;">
                        <button class="btn-action btn-ghost" onclick="editarPlantilla(${item.id})" style="flex:1; font-size:10px; margin-top:0; padding:10px;">
                            <i class="fa-solid fa-pen"></i> EDITAR
                        </button>
                        <button class="btn-action btn-primary" onclick="cargarPlantilla(${item.id})" style="flex:2; font-size:12px; margin-top:0; padding:10px;">
                            <i class="fa-solid fa-bolt"></i> USAR
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Cerramos el menú lateral automáticamente
        if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
        
    } catch (error) {
        console.error("Error detectado:", error);
        Swal.fire('Error', 'No se pudo cargar tu catálogo personal. Revisa la consola.', 'error');
    }
}
//// ==========================================
// SISTEMA DE SESIÓN PERMANENTE
// ==========================================

async function editarPlantilla(id) {
    try {
        Swal.fire({ title: 'Cargando diseño en el taller...', didOpen: () => Swal.showLoading() });
        
        const response = await apiFetch(`${API_URL}/api/creaciones`);
        const creaciones = await response.json();
        const plantilla = creaciones.find(c => c.id === id);

        if (!plantilla || !plantilla.config_json) {
            Swal.close();
            return Swal.fire('Aviso', 'Esta plantilla se guardó antes de la actualización y no se puede editar automáticamente. Solo las creadas a partir de hoy tienen esta función.', 'info');
        }

        const adn = typeof plantilla.config_json === 'string' ? JSON.parse(plantilla.config_json) : plantilla.config_json;

        // 1. Cerramos la vista de catálogo
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

        // 2. Abrimos el modal y disparamos la vista base
        if (plantilla.categoria.toLowerCase() === 'comedor') {
            openConfigComedor();
            if (adn['comedor-formato']) {
                document.getElementById('comedor-formato').value = adn['comedor-formato'];
                actualizarVistaComedor();
            }
        } else {
            const fotoResucitada = `${API_URL}/uploads/${plantilla.foto_url}`;
            openConfig(plantilla.nombre, fotoResucitada);
            if (adn['sofa-modelo']) {
                document.getElementById('sofa-modelo').value = adn['sofa-modelo'];
                actualizarVistaSofa();
            }
        }

        // 3. MAGIA: Esperamos un instante a que el HTML reaccione, y rellenamos todo
        setTimeout(() => {
            for (const [idElemento, valor] of Object.entries(adn)) {
                const el = document.getElementById(idElemento);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = valor;
                        if (el.onchange) el.onchange(); // Dispara la banqueta si estaba activa
                    } else {
                        el.value = valor;
                    }
                }
            }
            
            Swal.close();
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'success', title: 'Diseño cargado y listo para modificar.' });
            
        }, 300); // 300ms es el tiempo perfecto para que el DOM se dibuje

    } catch (error) {
        console.error("Error al editar plantilla:", error);
        Swal.fire('Error', 'No se pudo conectar con el servidor para cargar el diseño.', 'error');
    }
}
// FUNCIÓN PARA CERRAR SESIÓN (Importante para que otro vendedor pueda entrar)
async function cargarPlantilla(id) {
    try {
        // 1. Buscamos la plantilla específica en el servidor
        Swal.fire({ title: 'Cargando...', didOpen: () => Swal.showLoading() });
        const response = await apiFetch(`${API_URL}/api/creaciones`);
        const creaciones = await response.json();
        const plantilla = creaciones.find(c => c.id === id);

        if (!plantilla) return Swal.fire('Error', 'No se encontró la plantilla.', 'error');

        // 2. Armamos el bloque de texto con todo el resumen técnico para Casquería
        const especificaciones = `
            <b>PLANTILLA GUARDADA:</b> ${plantilla.categoria.toUpperCase()}<br>
            <b>DETALLES TÉCNICOS:</b><br>${plantilla.detalles.replace(/\n/g, '<br>')}<br>
            <b style="color:var(--accent);">NOTAS DE TALLER:</b><br>${plantilla.notas || 'Sin notas adicionales'}
        `;

        // 3. Mostramos un modal rápido pidiendo solo el precio de venta de hoy
        const { value: precioFinal } = await Swal.fire({
            title: 'Vender Plantilla',
            html: `
                <div style="text-align: left; font-size: 11px; color: #475569; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed #cbd5e1; line-height: 1.5;">
                    ${especificaciones}
                </div>
                <label style="font-weight: 900; color: #1a1a1a; font-size: 14px;">¿A qué precio lo vas a vender hoy? (S/)</label>
            `,
            input: 'number',
            inputAttributes: { min: 1, step: '0.50', placeholder: 'Ej: 1500.00' },
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-cart-plus"></i> Añadir al Carrito',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d4af37',
            // Validamos que no metan un precio en cero
            inputValidator: (value) => {
                if (!value || value <= 0) return 'Debes ingresar un precio válido mayor a 0';
            }
        });

        // 4. Si el vendedor puso el precio y aceptó, lo mandamos de frente al carrito
        if (precioFinal) {
            const fotoParaCarrito = `${API_URL}/uploads/${plantilla.foto_url}`;
            
            // Usamos tu misma función universal del carrito
            addToCart(plantilla.nombre, parseFloat(precioFinal), fotoParaCarrito, especificaciones);
            
            Swal.fire({
                title: '¡Añadido al Carrito!',
                text: 'Mueble listo para cobrar al cliente.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Abrimos la barra lateral del carrito
            toggleCart(); 
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Hubo un problema al cargar la plantilla.', 'error');
    }
}
function pdSyncFoto(input) {
    // Sincroniza ambos inputs y muestra preview
    const file = input.files[0];
    if (!file) return;
    // Copiar el archivo al otro input no es posible directamente;
    // guardamos referencia en el input principal (pd-foto) vía DataTransfer
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('pd-foto').files = dt.files;
    // Preview
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('pd-foto-preview').src = e.target.result;
        document.getElementById('pd-foto-nombre').textContent = file.name;
        document.getElementById('pd-foto-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function abrirModalProductoDirecto() {
    // Limpiamos la ventana
    document.getElementById('pd-foto').value = '';
    const cam = document.getElementById('pd-foto-cam');
    if (cam) cam.value = '';
    const prev = document.getElementById('pd-foto-preview-container');
    if (prev) prev.style.display = 'none';
    document.getElementById('pd-nombre').value = '';
    document.getElementById('pd-precio').value = '';
    document.getElementById('pd-cantidad').value = '1';
    document.getElementById('pd-origen').value = 'Externo';
    
    document.getElementById('modal-producto-directo').style.display = 'flex';
}

async function guardarProductoDirecto() {
    const foto = document.getElementById('pd-foto-cam')?.files[0]
               || document.getElementById('pd-foto').files[0];
    const nombre = document.getElementById('pd-nombre').value;
    const precio = document.getElementById('pd-precio').value;
    const cantidad = document.getElementById('pd-cantidad').value;
    const origen = document.getElementById('pd-origen').value;

    if (!foto) return Swal.fire('Falta Foto', 'Debes subir la imagen del producto.', 'warning');
    if (!nombre || !precio) return Swal.fire('Faltan Datos', 'El nombre y el precio son obligatorios.', 'warning');

    const formData = new FormData();
    formData.append('foto', foto);
    formData.append('nombre', nombre);
    formData.append('precio', precio);
    formData.append('cantidad', cantidad);
    formData.append('origen', origen);

    Swal.fire({ title: 'Publicando en Catálogo...', didOpen: () => Swal.showLoading() });

    try {
        const res = await apiFetch(`${API_URL}/api/catalogo/nuevo`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Éxito!', 'Producto publicado para todos los vendedores.', 'success');
            document.getElementById('modal-producto-directo').style.display = 'none';
            init(); // Recargar el catálogo visualmente
        } else {
            Swal.fire('Error', data.error, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Fallo de conexión.', 'error');
    }
}
/* ================================================================= */
/* --- MÓDULO: INTERCEPTOR PINTEREST (Piezas Especiales) --- */
/* ================================================================= */
async function abrirModalPinterest(tipoInput) {
    const { value: formValues } = await Swal.fire({
        title: '✨ Diseño Pinterest / Especial',
        html: `
            <p style="font-size: 13px; color: #64748b; text-align: left; margin-bottom: 10px;">
                1. Describe las instrucciones para esta pieza:
            </p>
            <textarea id="swal-pin-desc" class="swal2-textarea" placeholder="Ej: Patas cruzadas en forma de X, color negro mate..." style="margin-top: 0; height: 80px; font-size: 14px;"></textarea>
            
            <p style="font-size: 13px; color: #64748b; text-align: left; margin: 15px 0 10px 0;">
                2. Sube la foto de referencia (Obligatorio para el taller):
            </p>
            <input type="file" id="swal-pin-img" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Subir y Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        preConfirm: async () => {
            const desc = document.getElementById('swal-pin-desc').value;
            const file = document.getElementById('swal-pin-img').files[0];
            
            if (!desc || desc.trim() === '') {
                Swal.showValidationMessage('Debes escribir una descripción.');
                return false;
            }
            if (!file) {
                Swal.showValidationMessage('Debes subir una foto de referencia.');
                return false;
            }

            Swal.getConfirmButton().innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo foto...';
            Swal.disableButtons();

            try {
                const formData = new FormData();
                formData.append('archivo', file);
                const res = await apiFetch(`${API_URL}/api/upload-voucher`, { method: 'POST', body: formData });
                const data = await res.json();
                if (!data.url) throw new Error('No se pudo obtener la URL de la imagen');
                return { desc, url: data.url };
            } catch (e) {
                Swal.showValidationMessage('Error al subir la imagen. Intenta de nuevo.');
                Swal.enableButtons();
                Swal.getConfirmButton().innerHTML = 'Subir y Guardar';
                return false;
            }
        }
    });

    if (formValues) {
        let tituloEspecial = `✨ PINTEREST: ${formValues.desc}`;
        let skuTemporal = `REQ-PIN-${Date.now().toString().slice(-6)}`;
        seleccionarMaterial(tipoInput, skuTemporal, tituloEspecial, formValues.url);
    }
}
/* ================================================================= */
/* --- MÓDULO: SUGERENCIAS (FASE 3) --- */
/* ================================================================= */

// Sincroniza la foto elegida (cámara o archivo) al input principal nm-foto
function sincronizarFoto(inputOrigen) {
    if (!inputOrigen.files || inputOrigen.files.length === 0) return;
    
    const archivo = inputOrigen.files[0];
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(archivo);
    
    // Propagamos el archivo a ambos inputs para que guardarNuevoMaterial lo lea bien
    const inputPrincipal = document.getElementById('nm-foto');
    const inputCamara    = document.getElementById('nm-foto-camara');
    if (inputPrincipal) inputPrincipal.files = dataTransfer.files;
    if (inputCamara)    inputCamara.files    = dataTransfer.files;
    
    // Mostramos preview de la foto elegida
    const previewContainer = document.getElementById('nm-foto-preview-container');
    const previewImg       = document.getElementById('nm-foto-preview');
    const previewNombre    = document.getElementById('nm-foto-nombre');
    
    if (previewContainer && previewImg) {
        const reader = new FileReader();
        reader.onload = e => {
            previewImg.src = e.target.result;
            if (previewNombre) previewNombre.innerText = archivo.name;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(archivo);
    }
}

function abrirModalSugerencia() {
    document.getElementById('modal-sugerencia').style.display = 'flex';
}

async function enviarSugerencia() {
    const nombre   = document.getElementById('sug-nombre').value.trim();
    const tipo     = document.getElementById('sug-tipo')?.value || 'General';
    const foto_ref = document.getElementById('sug-foto')?.value || '';

    if (!nombre) return Swal.fire('Atención', 'Escribe un nombre para el insumo', 'warning');

    // Botón de carga para evitar doble envío
    const btnEnviar = document.querySelector('#modal-sugerencia .btn-primary');
    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerText = 'Enviando...'; }

    try {
        const res = await apiFetch(`${API_URL}/api/sugerencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre,
                tipo,
                foto_ref,
                usuario_id: usuarioActivo ? usuarioActivo.id : null
            })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        Swal.fire('¡Recibido!', 'Tu sugerencia ha sido enviada al Administrador.', 'success');
        document.getElementById('modal-sugerencia').style.display = 'none';

    } catch (err) {
        Swal.fire('Error', `No se pudo enviar la sugerencia: ${err.message}`, 'error');
    } finally {
        if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerText = 'Enviar Sugerencia'; }
    }
}

/* ================================================================= */
/* --- GESTIÓN DE PERSONAL (ADMIN) --- */
/* ================================================================= */
async function listarUsuarios() {
    const container = document.getElementById('lista-usuarios-sistema');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; padding:20px; color:gray;">Cargando personal...</p>';
    try {
        const res = await apiFetch(`${API_URL}/api/usuarios/detalle`);
        const usuarios = await res.json();
        if (usuarios.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:gray;">No hay usuarios registrados.</p>';
            return;
        }
        container.innerHTML = usuarios.map(u => `
            <div class="card" style="padding:15px; border-left: 5px solid #a78bfa; background:white; position:relative;">
                <div style="position:absolute; top:10px; right:10px; font-size:9px; background:#f3f4f6; padding:2px 6px; border-radius:4px; font-weight:bold; color:#4b5563;">RUC: ${u.ruc}</div>
                <div style="font-size:10px; font-weight:900; color:#a78bfa; margin-bottom:5px;">${u.rol.toUpperCase()}</div>
                <h4 style="margin:0; color:#1e293b;">${u.nombre}</h4>
                <p style="font-size:12px; margin:5px 0; color:#64748b;">Sede: <b>${u.empresa}</b></p>
                <p style="font-size:11px; margin:2px 0; color:#64748b;">Área: ${u.area || 'GENERAL'}</p>
                <div style="font-size:11px; color:#94a3b8;"><i class="fa-solid fa-envelope"></i> ${u.email}</div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Error al cargar personal.</p>'; }
}

function actualizarReglasEmpresa() {
    const rol = document.getElementById('nu-rol').value;
    const empresaSelect = document.getElementById('nu-empresa');
    
    if (rol !== 'Vendedor') {
        // Forzar S.A.C. para Operarios, Jefes y Admin
        empresaSelect.value = "20600768175";
        empresaSelect.disabled = true;
        empresaSelect.style.background = "#f1f5f9";
    } else {
        // Permitir elección para Vendedores
        empresaSelect.disabled = false;
        empresaSelect.style.background = "#ffffff";
    }
}

async function guardarUsuario() {
    const nombre = document.getElementById('nu-nombre').value;
    const correo = document.getElementById('nu-correo').value;
    const pin = document.getElementById('nu-pin').value;
    const rol = document.getElementById('nu-rol').value;
    const area = document.getElementById('nu-area').value;
    const empresaSelect = document.getElementById('nu-empresa');
    const empresa_nombre = empresaSelect.options[empresaSelect.selectedIndex].text;
    const empresa_ruc = empresaSelect.value;

    if(!nombre || !pin || !correo) return Swal.fire('Faltan Datos', 'Nombre, Correo y PIN son obligatorios.', 'warning');

    try {
        const res = await apiFetch(`${API_URL}/api/usuarios/nuevo`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nombre, correo, pin, rol, area, empresa_nombre, empresa_ruc })
        });
        if(res.ok) {
            Swal.fire('¡Éxito!', 'Usuario creado correctamente.', 'success');
            document.getElementById('nu-nombre').value = '';
            document.getElementById('nu-correo').value = '';
            document.getElementById('nu-pin').value = '';
            listarUsuarios();
        }
    } catch(e) { Swal.fire('Error', 'Fallo de conexión', 'error'); }
}

/* ================================================================= */
/* --- GESTIÓN DE PROVEEDORES (ADMIN) --- */
/* ================================================================= */
async function listarProveedores() {
    const container = document.getElementById('lista-proveedores-sistema');
    if (!container) return;
    try {
        const res = await apiFetch(`${API_URL}/api/proveedores`);
        const provs = await res.json();
        container.innerHTML = provs.map(p => `
            <div class="card" style="padding:15px; border-left: 5px solid #2dd4bf; background:white;">
                <div style="font-size:10px; font-weight:900; color:#2dd4bf; margin-bottom:5px;">${p.especialidad.toUpperCase()}</div>
                <h4 style="margin:0; color:#1e293b;">${p.nombre}</h4>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <a href="mailto:${p.correo}" class="btn-action" style="padding:8px; font-size:12px; background:#f1f5f9; color:var(--primary); flex:1; text-decoration:none; border-radius:6px; text-align:center;"><i class="fa-solid fa-envelope"></i> Email</a>
                    <a href="https://wa.me/${p.telefono}" target="_blank" class="btn-action" style="padding:8px; font-size:12px; background:#dcfce7; color:#166534; flex:1; text-decoration:none; border-radius:6px; text-align:center;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
                </div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Error al cargar proveedores.</p>'; }
}

async function guardarProveedor() {
    const nombre = document.getElementById('np-nombre').value;
    const especialidad = document.getElementById('np-especialidad').value;
    const correo = document.getElementById('np-correo').value;
    const telefono = document.getElementById('np-whatsapp').value; // El ID del input sigue siendo 'np-whatsapp'

    if(!nombre || !correo || !telefono) return Swal.fire('Error', 'Nombre, Correo y WhatsApp son obligatorios.', 'warning');

    try {
        const res = await apiFetch(`${API_URL}/api/proveedores/nuevo`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nombre, especialidad, correo, telefono })
        });
        if(res.ok) {
            Swal.fire('¡Guardado!', 'Proveedor registrado con éxito.', 'success');
            document.getElementById('np-nombre').value = '';
            document.getElementById('np-correo').value = '';
            document.getElementById('np-whatsapp').value = '';
            listarProveedores();
        }
    } catch(e) { Swal.fire('Error', 'Fallo de conexión', 'error'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// B3 — actualizarEstadoInsumo: cambia Disponible / Agotado / Descontinuado
// Llamado desde el selector de cada tarjeta generada por dibujarTarjetaMaterial
// ─────────────────────────────────────────────────────────────────────────────
async function actualizarEstadoInsumo(itemId, categoria, nuevoEstado) {
    const catToEndpoint = {
        'TELA':         'telas',
        'TELAS':        'telas',
        'COJIN':        'cojines',
        'COJ':          'cojines',
        'BASE':         'bases',
        'BASE-COMEDOR': 'bases-comedor',
        'TABLERO':      'tableros',
        'SILLA':        'sillas',
        'BUTACA':       'butacas',
    };

    const catUpper = (categoria || '').toUpperCase();
    const endpoint = catToEndpoint[catUpper];

    if (!endpoint) {
        return Swal.fire('Error', 'Categoría no reconocida: ' + categoria, 'error');
    }

    const listaKey = {
        'telas': 'telas', 'cojines': 'cojines', 'bases': 'bases',
        'bases-comedor': 'bases_comedor', 'tableros': 'tableros',
        'sillas': 'sillas', 'butacas': 'butacas'
    }[endpoint];

    const lista = maestroMateriales[listaKey] || [];
    const item  = lista.find(i => i.id === itemId);

    if (!item) {
        return Swal.fire('Error', `Material id=${itemId} no encontrado. Recarga la página.`, 'error');
    }

    try {
        const res = await apiFetch(`${API_URL}/api/materiales/${endpoint}/${encodeURIComponent(item.sku)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        const data = await res.json();
        if (!res.ok || !data.exito) {
            return Swal.fire('Error', data.error || 'No se pudo actualizar el estado.', 'error');
        }
        item.estado = nuevoEstado;

        // Actualizar color del select en la tarjeta sin recargar
        const colorEstado = { 'Disponible': '#dcfce7', 'Agotado': '#fee2e2', 'Descontinuado': '#f3f4f6' };
        const selectEl = document.querySelector(`select[data-item-id='${itemId}']`);
        if (selectEl) selectEl.style.background = colorEstado[nuevoEstado] || '#f3f4f6';

        // Toast de confirmación
        const iconos = { 'Disponible': '🟢', 'Agotado': '🔴', 'Descontinuado': '⚫' };
        Swal.fire({ icon: 'success', title: `${iconos[nuevoEstado] || ''} Estado actualizado`,
            text: `${item.sku} ahora está como ${nuevoEstado}.`,
            timer: 1800, showConfirmButton: false, toast: true,
            position: 'top-end' });
    } catch (e) {
        Swal.fire('Error', 'Fallo de conexión al actualizar estado.', 'error');
    }
}

async function abrirModalNuevo(tipo, destino) {
    tipoActual    = tipo;
    destinoActual = destino;

    const modal              = document.getElementById('modal-nuevo-material');
    const contenedorCampos   = document.getElementById('nm-campos-dinamicos');
    const titleElem          = document.getElementById('nm-title');

    if (!modal || !contenedorCampos) return;

    // Limpiar foto previa
    const nmFoto      = document.getElementById('nm-foto');
    const nmFotoCamara = document.getElementById('nm-foto-camara');
    if (nmFoto)      nmFoto.value      = '';
    if (nmFotoCamara) nmFotoCamara.value = '';
    const prevContainer = document.getElementById('nm-foto-preview-container');
    if (prevContainer) prevContainer.style.display = 'none';

    // Título dinámico
    titleElem.innerText = destino === 'sugerencia'
        ? `💡 Sugerir Insumo: ${tipo.toUpperCase()}`
        : `➕ Registrar Insumo: ${tipo.toUpperCase()}`;

    // Ocultar selector de origen para vendedores
    const divOrigen = document.getElementById('nm-origen')?.parentElement;
    if (divOrigen) divOrigen.style.display = (destino === 'sugerencia') ? 'none' : 'block';

    // ── Estilos reutilizables ──────────────────────────────────────────────
    const labelStyle = 'font-size:11px; font-weight:bold; color:var(--primary);';
    const inputStyle = 'class="form-input"';

    // Helper: construye un <select> con las opciones dadas
    const mkSelect = (id, opciones, required = true) => `
        <select id="${id}" class="form-input" ${required ? 'required' : ''}>
            <option value="">— Seleccionar —</option>
            ${opciones.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>`;

    let htmlCampos = '';
    let optionsProv = '';
    if (tipo === 'tela') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            }
        } catch(e) {}
    }

    // ── TELA ──────────────────────────────────────────────────────────────
    if (tipo === 'tela') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Proveedor (Texto - Opcional / Legacy)</label>
                <input type="text" id="nm-proveedor" ${inputStyle} placeholder="Ej. Textil San Jacinto" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Proveedor (Vinculado) *Nuevo</label>
                <select id="nm-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Colección / Línea</label>
                <input type="text" id="nm-coleccion" ${inputStyle} placeholder="Ej. Velvet, Ipanema, Lino Rústico" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color / Código de Color</label>
                <input type="text" id="nm-color" ${inputStyle} placeholder="Ej. Gris Plata, Beige 05" required>
            </div>`;
    }

    // ── COJÍN ─────────────────────────────────────────────────────────────
    else if (tipo === 'cojin') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Nombre del Diseño / Patrón</label>
                <input type="text" id="nm-nombre-diseno" ${inputStyle} placeholder="Ej. Geométrico, Floral, Capitoneado..." required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Material / Composición (Texto libre)</label>
                <input type="text" id="nm-tipo-tela" ${inputStyle} placeholder="Ej. Jacquard estampado, Lino bordado, Terciopelo..." required>
            </div>`;
    }

    // ── BASE DE SOFÁ ──────────────────────────────────────────────────────
    // B2: Campos propios de sofá — Tipo Estructural (Zócalo / Patas / Combinado),
    //     Material, Acabado. Nombre = texto libre.
    else if (tipo === 'base') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Nombre / Referencia <span style="font-weight:400;color:#64748b;">(identifica esta base)</span></label>
                <input type="text" id="nm-modelo" ${inputStyle} placeholder="Ej. Zócalo Bajo Nogal, Patas Doradas Torneadas" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Tipo Estructural</label>
                ${mkSelect('nm-tipo-base', ['Zócalo','Patas','Combinado (Zócalo + Patas)'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Material</label>
                ${mkSelect('nm-material', ['Madera','Acero','Fierro','Aluminio','Mixto'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Acabado</label>
                ${mkSelect('nm-acabado', ['Natural','Lacado','Pintado','Tapizado','Oxidado'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-color" ${inputStyle} placeholder="Ej. Nogal, Negro Mate, Dorado Champagne" required>
            </div>`;
    }

    // ── BASE DE COMEDOR ───────────────────────────────────────────────────
    // B2: Campos propios de comedor — sin "Zócalo" en ningún lugar,
    //     Material (Acero Inoxidable, Fierro Negro…), Acabado.
    else if (tipo === 'base-comedor') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Nombre / Referencia <span style="font-weight:400;color:#64748b;">(identifica esta base)</span></label>
                <input type="text" id="nm-modelo" ${inputStyle} placeholder="Ej. Base Pedestal Cónico, Base Cruz Negra" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Material</label>
                ${mkSelect('nm-material', ['Acero','Acero Inoxidable','Fierro Negro','Madera','Aluminio','Mixto'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Acabado</label>
                ${mkSelect('nm-acabado', ['Mate','Brillante','Lacado','Natural','Oxidado','Cromado','Pintado'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-color" ${inputStyle} placeholder="Ej. Negro Satinado, Dorado Champagne" required>
            </div>`;
        // Nota: el backend usa los campos 'tipo', 'material', 'modelo', 'color' para base-comedor.
        // El campo 'tipo' se fija programáticamente en guardarNuevoMaterial() como 'Base de Comedor'.
    }

    // ── TABLERO ───────────────────────────────────────────────────────────
    // B1: Material Base pasa a selector
    else if (tipo === 'tablero') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Material Base</label>
                ${mkSelect('nm-material-base', ['MDF','Madera','Vidrio','Cuarzo','Mármol','Porcelanato','Piedra Sinterizada'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Nombre del Modelo / Diseño <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-nombre-modelo" ${inputStyle} placeholder="Ej. Blanco Carrara, Roble Novopán" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color de Veta / Tonalidad <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-color-veta" ${inputStyle} placeholder="Ej. Gris tenue, Tonalidad Miel">
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Acabado / Textura</label>
                ${mkSelect('nm-acabado', ['Alto Brillo','Brillante y Mate','Texturizado','Pulido','Satinado'])}
            </div>`;
    }

    // ── SILLA ─────────────────────────────────────────────────────────────
    // B1: Material de la Estructura pasa a selector
    else if (tipo === 'silla') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Modelo / Diseño Estructural <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-modelo" ${inputStyle} placeholder="Ej. Escandinava, Capitoné, Industrial" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Material de la Estructura</label>
                ${mkSelect('nm-material', ['Madera','Madera MDF','Acero','Fierro','Aluminio','Polipropileno'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color de Estructura / Barniz <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-color-estructura" ${inputStyle} placeholder="Ej. Nogal, Negro Satinado" required>
            </div>`;
    }

    // ── BUTACA ────────────────────────────────────────────────────────────
    // B1: Material de la Estructura pasa a selector
    else if (tipo === 'butaca') {
        htmlCampos = `
            <div class="form-group">
                <label style="${labelStyle}">Modelo / Diseño Estructural <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-modelo" ${inputStyle} placeholder="Ej. Bergère, Orejero, Capitoné" required>
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Material de la Estructura</label>
                ${mkSelect('nm-material', ['Madera','Acero','Fierro','Aluminio'])}
            </div>
            <div class="form-group">
                <label style="${labelStyle}">Color de Estructura / Barniz <span style="font-weight:400;color:#64748b;">(texto libre)</span></label>
                <input type="text" id="nm-color-estructura" ${inputStyle} placeholder="Ej. Wengue, Dorado Satinado" required>
            </div>`;
    }

    contenedorCampos.innerHTML = htmlCampos;
    modal.style.display = 'flex';
}


/**
 * Reemplaza guardarNuevoMaterial() de materiales.js.
 * La lógica es idéntica; solo se adapta la recolección de campos
 * para los nuevos IDs (nm-acabado, nm-tipo-base que ya no existe en base-comedor, etc.)
 */
async function guardarNuevoMaterial() {
    const fotoInput = document.getElementById('nm-foto');
    if (!fotoInput || fotoInput.files.length === 0) {
        return Swal.fire('Error', 'Debe adjuntar una foto de referencia', 'warning');
    }

    const esSugerencia = (destinoActual === 'sugerencia' ||
        (usuarioActivo && usuarioActivo.rol === 'Vendedor'));

    const formData = new FormData();
    formData.append('foto', fotoInput.files[0]);

    let datosObj = {};
    let nombreInsumoCalculado = '';

    try {
        if (tipoActual === 'tela') {
            datosObj.proveedor = document.getElementById('nm-proveedor').value;
            datosObj.proveedor_id = document.getElementById('nm-proveedor-id')?.value || null;
            datosObj.coleccion = document.getElementById('nm-coleccion').value;
            datosObj.color     = document.getElementById('nm-color').value;
            nombreInsumoCalculado = `Tela ${datosObj.coleccion} — ${datosObj.color}`;

        } else if (tipoActual === 'cojin') {
            datosObj.nombre_diseno = document.getElementById('nm-nombre-diseno').value;
            datosObj.tipo_tela     = document.getElementById('nm-tipo-tela').value;
            nombreInsumoCalculado  = `Cojín ${datosObj.nombre_diseno}`;

        } else if (tipoActual === 'base') {
            // B2: recolectar los campos del formulario separado de BASE sofá
            datosObj.modelo        = document.getElementById('nm-modelo').value;
            datosObj.tipo          = document.getElementById('nm-tipo-base')?.value || 'Patas';
            datosObj.material      = document.getElementById('nm-material').value;
            datosObj.acabado       = document.getElementById('nm-acabado')?.value || '';
            datosObj.color         = document.getElementById('nm-color').value;
            datosObj.medida_altura = document.getElementById('nm-medida-altura')?.value || '';
            nombreInsumoCalculado  = `Base Sofá ${datosObj.modelo} ${datosObj.color}`;

        } else if (tipoActual === 'base-comedor') {
            // B2: BASE-COMEDOR no tiene 'tipo' de zócalo — se fija como identificador de categoría
            datosObj.modelo   = document.getElementById('nm-modelo').value;
            datosObj.material = document.getElementById('nm-material').value;
            datosObj.acabado  = document.getElementById('nm-acabado')?.value || '';
            datosObj.color    = document.getElementById('nm-color').value;
            datosObj.tipo     = 'Base de Comedor'; // fijo, no editable por el usuario
            nombreInsumoCalculado = `Base Comedor ${datosObj.modelo} ${datosObj.color}`;

        } else if (tipoActual === 'tablero') {
            datosObj.material_base = document.getElementById('nm-material-base').value;
            datosObj.nombre_modelo = document.getElementById('nm-nombre-modelo').value;
            datosObj.color_veta    = document.getElementById('nm-color-veta')?.value || '';
            datosObj.acabado       = document.getElementById('nm-acabado').value;
            nombreInsumoCalculado  = `Tablero ${datosObj.nombre_modelo}`;

        } else if (tipoActual === 'silla' || tipoActual === 'butaca') {
            datosObj.modelo           = document.getElementById('nm-modelo').value;
            datosObj.material         = document.getElementById('nm-material').value;
            datosObj.color_estructura = document.getElementById('nm-color-estructura').value;
            nombreInsumoCalculado     = `${tipoActual === 'silla' ? 'Silla' : 'Butaca'} ${datosObj.modelo}`;
        }
    } catch {
        return Swal.fire('Formulario Incompleto', 'Por favor llena todos los campos requeridos.', 'warning');
    }

    Swal.fire({ title: 'Procesando requerimiento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let endpointUrl = `${API_URL}/api/materiales/nuevo`;

    if (esSugerencia) {
        endpointUrl = `${API_URL}/api/sugerencias`;
        formData.append('nombre', nombreInsumoCalculado);
        formData.append('tipo', tipoActual);
        if (!usuarioActivo) return Swal.fire('Sesión', 'Debes iniciar sesión.', 'warning');
        formData.append('usuario_id', usuarioActivo.id);
        formData.append('datos_json', JSON.stringify(datosObj));
    } else {
        formData.append('tipo_material', tipoActual);
        const origenElem = document.getElementById('nm-origen');
        formData.append('origen_produccion', origenElem ? origenElem.value : 'Externo');
        for (const [key, value] of Object.entries(datosObj)) {
            formData.append(key, value);
        }
    }

    try {
        const res = await apiFetch(endpointUrl, { method: 'POST', body: formData });
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: esSugerencia ? '¡Sugerencia Enviada!' : '¡Insumo Guardado!',
                text:  esSugerencia
                    ? 'Aparecerá en el Gestor del Admin para su oficialización.'
                    : 'Disponible inmediatamente en el catálogo.',
                confirmButtonColor: '#0f172a'
            });
            document.getElementById('modal-nuevo-material').style.display = 'none';
            init();
        } else {
            const err = await res.json();
            Swal.fire('Error', err.error || 'No se pudo procesar', 'error');
        }
    } catch {
        Swal.fire('Error de red', 'No se pudo contactar al servidor', 'error');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN B3 — Tarjetas con foto + descripción + botón Editar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML de una tarjeta de material mejorada.
 * Muestra foto, SKU, campos descriptivos, selector de estado y botón Editar.
 *
 * @param {Object} item   - Objeto devuelto por /api/taller/inventario
 * @param {string} tipo   - 'tela'|'cojin'|'base'|'base-comedor'|'tablero'|'silla'|'butaca'
 */
function dibujarTarjetaMaterial(item, tipo) {
    const colorEstado = {
        'Disponible':    '#dcfce7',
        'Agotado':       '#fee2e2',
        'Descontinuado': '#f3f4f6',
    };
    const bgEstado = colorEstado[item.estado] || '#f3f4f6';

    // Construir líneas descriptivas según el tipo
    let lineas = [];
    if (tipo === 'tela') {
        if (item.proveedor) lineas.push(`<b>Proveedor:</b> ${item.proveedor}`);
        if (item.coleccion) lineas.push(`<b>Colección:</b> ${item.coleccion}`);
        if (item.color)     lineas.push(`<b>Color:</b> ${item.color}`);
    } else if (tipo === 'cojin') {
        if (item.nombre_diseno) lineas.push(`<b>Diseño:</b> ${item.nombre_diseno}`);
        if (item.tipo_tela)     lineas.push(`<b>Tela req.:</b> ${item.tipo_tela}`);
    } else if (tipo === 'base') {
        if (item.tipo)     lineas.push(`<b>Tipo:</b> ${item.tipo}`);
        if (item.material) lineas.push(`<b>Material:</b> ${item.material}`);
        if (item.modelo)   lineas.push(`<b>Modelo:</b> ${item.modelo}`);
        if (item.color)    lineas.push(`<b>Color:</b> ${item.color}`);
        if (item.medida)   lineas.push(`<b>Altura:</b> ${item.medida}`);
    } else if (tipo === 'base-comedor') {
        if (item.material) lineas.push(`<b>Material:</b> ${item.material}`);
        if (item.modelo)   lineas.push(`<b>Modelo:</b> ${item.modelo}`);
        if (item.color)    lineas.push(`<b>Color:</b> ${item.color}`);
    } else if (tipo === 'tablero') {
        if (item.material_base) lineas.push(`<b>Material:</b> ${item.material_base}`);
        if (item.nombre)        lineas.push(`<b>Modelo:</b> ${item.nombre}`);
        if (item.color)         lineas.push(`<b>Veta:</b> ${item.color}`);
        if (item.acabado)       lineas.push(`<b>Acabado:</b> ${item.acabado}`);
    } else if (tipo === 'silla' || tipo === 'butaca') {
        if (item.material) lineas.push(`<b>Material:</b> ${item.material}`);
        if (item.modelo)   lineas.push(`<b>Modelo:</b> ${item.modelo}`);
        if (item.color)    lineas.push(`<b>Color:</b> ${item.color}`);
    }

    const descHTML = lineas.length
        ? lineas.map(l => `<p style="margin:2px 0;font-size:11px;color:#475569;line-height:1.5;">${l}</p>`).join('')
        : '<p style="font-size:11px;color:#94a3b8;">Sin descripción registrada.</p>';

    const skuDisplay = item.sku || item.id || '—';
    const foto       = item.foto_url || 'imagenes/sin_foto.jpg';
    const catLabel   = item.categoria || tipo.toUpperCase();

    return `
    <div style="
        background:white;
        border:1px solid #e2e8f0;
        border-radius:12px;
        overflow:hidden;
        box-shadow:0 2px 6px rgba(0,0,0,0.04);
        display:flex;
        flex-direction:column;
        position:relative;
    ">
        <!-- SKU badge -->
        <div style="
            position:absolute; top:8px; left:8px; z-index:2;
            background:rgba(15,23,42,0.75); color:#f0dfa0;
            font-size:9px; font-weight:900; letter-spacing:0.1em;
            padding:3px 8px; border-radius:20px;
        ">${skuDisplay}</div>

        <!-- Foto -->
        <div style="position:relative; cursor:pointer;" onclick="ampliarImagen('${foto}')">
            <img src="${foto}"
                 onerror="this.src='imagenes/sin_foto.jpg'"
                 style="width:100%; height:140px; object-fit:cover; display:block;">
            <div style="
                position:absolute; bottom:0; left:0; right:0;
                background:linear-gradient(transparent,rgba(0,0,0,0.35));
                height:40px;
            "></div>
        </div>

        <!-- Cuerpo -->
        <div style="padding:12px; flex:1; display:flex; flex-direction:column; gap:8px;">
            <!-- Categoría -->
            <div style="font-size:9px; font-weight:900; color:#a78bfa; letter-spacing:0.1em;">${catLabel}</div>

            <!-- Campos descriptivos -->
            <div>${descHTML}</div>

            <!-- Selector de estado -->
            <select
                data-item-id="${item.id}"
                onchange="actualizarEstadoInsumo(${item.id}, '${item.categoria}', this.value)"
                style="
                    width:100%; padding:6px 8px; border-radius:6px;
                    border:1px solid #e2e8f0; font-size:11px; font-weight:700;
                    background:${bgEstado}; cursor:pointer;
                    margin-top:auto;
                ">
                <option value="Disponible"    ${item.estado==='Disponible'    ? 'selected':''}>🟢 Disponible</option>
                <option value="Agotado"       ${item.estado==='Agotado'       ? 'selected':''}>🔴 Agotado</option>
                <option value="Descontinuado" ${item.estado==='Descontinuado' ? 'selected':''}>⚫ Descontinuado</option>
            </select>

            <!-- Botón Editar -->
            <button
                onclick="abrirEditorMaterial('${skuDisplay}', '${tipo}')"
                style="
                    width:100%; padding:8px;
                    background:#f1f5f9; color:#475569;
                    border:1px solid #e2e8f0; border-radius:6px;
                    font-size:11px; font-weight:700; cursor:pointer;
                    display:flex; align-items:center; justify-content:center; gap:6px;
                    transition:background 0.2s;
                "
                onmouseover="this.style.background='#e2e8f0'"
                onmouseout="this.style.background='#f1f5f9'"
            >
                <i class="fa-solid fa-pen"></i> Editar
            </button>
        </div>
    </div>`;
}


/**
 * Abre el modal de edición para un material, cargando sus datos actuales.
 * Hace GET al backend para obtener el estado más reciente del SKU.
 */
async function abrirEditorMaterial(sku, tipo) {
    // Mapa de tipo → clave en el objeto del maestro en memoria
    const tipoAData = {
        'tela':         'telas',
        'cojin':        'cojines',
        'base':         'bases',
        'base-comedor': 'bases_comedor',
        'tablero':      'tableros',
        'silla':        'sillas',
        'butaca':       'butacas',
    };

    const listaKey = tipoAData[tipo];
    const lista    = maestroMateriales[listaKey] || [];
    const item     = lista.find(i => i.sku === sku);

    if (!item) {
        return Swal.fire('Error', `No se encontró el registro con SKU ${sku}.`, 'error');
    }

    // Guardar contexto de edición
    _editorSku   = sku;
    _editorTipo  = tipo;
    _editorFotoActual = item.foto_url || '';

    const modal = document.getElementById('modal-editar-material');
    if (!modal) {
        return Swal.fire('Error de Configuración', 'El modal #modal-editar-material no está en el HTML. Agrégalo según las instrucciones al final de materiales_parteB.js.', 'error');
    }

    // Construir campos del formulario según tipo
    const labelStyle = 'font-size:11px;font-weight:bold;color:var(--primary);display:block;margin-bottom:4px;';
    const mkSelect = (id, opciones, valorActual = '') => `
        <select id="em-${id}" class="form-input">
            ${opciones.map(o => `<option value="${o}" ${o===valorActual?'selected':''}>${o}</option>`).join('')}
        </select>`;

    let campos = '';
    let optionsProv = '';

    if (tipo === 'tela') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Texto - Legacy)</label>
                <input id="em-proveedor" class="form-input" value="${item.proveedor || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Colección</label>
                <input id="em-coleccion" class="form-input" value="${item.coleccion || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Color</label>
                <input id="em-color" class="form-input" value="${item.color || ''}"></div>`;

    } else if (tipo === 'cojin') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Nombre del Diseño / Patrón</label>
                <input id="em-nombre-diseno" class="form-input" value="${item.nombre_diseno || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Material / Composición</label>
                <input id="em-tipo-tela" class="form-input" value="${item.tipo_tela || ''}" placeholder="Ej. Jacquard, Lino bordado..."></div>`;

    } else if (tipo === 'base') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Nombre / Referencia</label>
                <input id="em-modelo" class="form-input" value="${item.modelo || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Tipo Estructural</label>
                ${mkSelect('tipo-base', ['Zócalo','Patas','Combinado (Zócalo + Patas)'], item.tipo)}</div>
            <div class="form-group"><label style="${labelStyle}">Material</label>
                ${mkSelect('material', ['Madera','Acero','Fierro','Aluminio','Mixto'], item.material)}</div>
            <div class="form-group"><label style="${labelStyle}">Acabado</label>
                ${mkSelect('acabado', ['Natural','Lacado','Pintado','Tapizado','Oxidado'], item.acabado)}</div>
            <div class="form-group"><label style="${labelStyle}">Color</label>
                <input id="em-color" class="form-input" value="${item.color || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Altura (cm)</label>
                <input id="em-medida-altura" class="form-input" value="${item.medida || ''}"></div>`;

    } else if (tipo === 'base-comedor') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Nombre / Referencia</label>
                <input id="em-modelo" class="form-input" value="${item.modelo || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Material</label>
                ${mkSelect('material', ['Acero','Acero Inoxidable','Fierro Negro','Madera','Aluminio','Mixto'], item.material)}</div>
            <div class="form-group"><label style="${labelStyle}">Acabado</label>
                ${mkSelect('acabado', ['Mate','Brillante','Lacado','Natural','Oxidado','Cromado','Pintado'], item.acabado)}</div>
            <div class="form-group"><label style="${labelStyle}">Color</label>
                <input id="em-color" class="form-input" value="${item.color || ''}"></div>`;

    } else if (tipo === 'tablero') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Material Base</label>
                ${mkSelect('material-base', ['MDF','Madera','Vidrio','Cuarzo','Mármol','Porcelanato','Piedra Sinterizada'], item.material_base)}</div>
            <div class="form-group"><label style="${labelStyle}">Nombre del Modelo</label>
                <input id="em-nombre-modelo" class="form-input" value="${item.nombre || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Color de Veta</label>
                <input id="em-color-veta" class="form-input" value="${item.color || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Acabado</label>
                ${mkSelect('acabado', ['Alto Brillo','Brillante y Mate','Texturizado','Pulido','Satinado', 'Mate'], item.acabado)}</div>`;

    } else if (tipo === 'silla' || tipo === 'butaca') {
        try {
            const resProv = await apiFetch(`${API_URL}/api/proveedores`);
            if (resProv.ok) {
                const provs = await resProv.json();
                optionsProv = provs.map(p => `<option value="${p.id}" ${item.proveedor_id == p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
            }
        } catch(e) {}

        const matOpts = tipo === 'silla'
            ? ['Madera','Madera MDF','Acero','Fierro','Aluminio','Polipropileno']
            : ['Madera','Acero','Fierro','Aluminio'];
        campos = `
            <div class="form-group"><label style="${labelStyle}">Origen de Producción</label>
                <select id="em-origen-produccion" class="form-input">
                    <option value="Externo" ${(item.origen_produccion||'Externo')==='Externo'?'selected':''}>Externo</option>
                    <option value="Interno" ${item.origen_produccion==='Interno'?'selected':''}>Interno</option>
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Proveedor (Vinculado)</label>
                <select id="em-proveedor-id" class="form-input">
                    <option value="">-- Sin vincular --</option>
                    ${optionsProv}
                </select>
            </div>
            <div class="form-group"><label style="${labelStyle}">Modelo / Diseño</label>
                <input id="em-modelo" class="form-input" value="${item.modelo || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Material</label>
                ${mkSelect('material', matOpts, item.material)}</div>
            <div class="form-group"><label style="${labelStyle}">Color de Estructura</label>
                <input id="em-color-estructura" class="form-input" value="${item.color || ''}"></div>`;
    }

    // Inyectar contenido en el modal
    document.getElementById('em-sku-display').textContent  = sku;
    document.getElementById('em-tipo-display').textContent = tipo.toUpperCase();
    document.getElementById('em-campos').innerHTML          = campos;

    // Foto actual
    const fotoPreview = document.getElementById('em-foto-preview');
    if (fotoPreview) {
        fotoPreview.src     = _editorFotoActual || 'imagenes/sin_foto.jpg';
        fotoPreview.style.display = 'block';
    }

    modal.style.display = 'flex';
}

// Variables de estado del editor
let _editorSku        = '';
let _editorTipo       = '';
let _editorFotoActual = '';

/**
 * Recoge los valores del modal de edición y hace PUT al backend.
 * Si se seleccionó una nueva foto, primero la sube y luego actualiza.
 */
async function guardarCambiosMaterial() {
    const sku  = _editorSku;
    const tipo = _editorTipo;

    if (!sku || !tipo) return;

    Swal.fire({ title: 'Guardando cambios...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Recoger campos según tipo
    const get = id => document.getElementById(id)?.value?.trim() || '';
    let payload = {};

    if (tipo === 'tela') {
        payload = { 
            origen_produccion: get('em-origen-produccion'),
            proveedor: get('em-proveedor'), 
            proveedor_id: get('em-proveedor-id') || null, 
            coleccion: get('em-coleccion'), 
            color: get('em-color') 
        };
    } else if (tipo === 'cojin') {
        payload = { origen_produccion: get('em-origen-produccion'), proveedor_id: get('em-proveedor-id') || null, nombre_diseno: get('em-nombre-diseno'), tipo_tela: get('em-tipo-tela') };
    } else if (tipo === 'base') {
        payload = {
            origen_produccion: get('em-origen-produccion'),
            proveedor_id: get('em-proveedor-id') || null,
            modelo: get('em-modelo'), tipo: get('em-tipo-base'),
            material: get('em-material'), acabado: get('em-acabado'),
            color: get('em-color'), medida_altura: get('em-medida-altura')
        };
    } else if (tipo === 'base-comedor') {
        payload = { origen_produccion: get('em-origen-produccion'), proveedor_id: get('em-proveedor-id') || null, modelo: get('em-modelo'), material: get('em-material'), acabado: get('em-acabado'), color: get('em-color') };
    } else if (tipo === 'tablero') {
        payload = {
            origen_produccion: get('em-origen-produccion'),
            proveedor_id: get('em-proveedor-id') || null,
            material_base: get('em-material-base'), nombre_modelo: get('em-nombre-modelo'),
            color_veta: get('em-color-veta'), acabado: get('em-acabado')
        };
    } else if (tipo === 'silla' || tipo === 'butaca') {
        payload = { origen_produccion: get('em-origen-produccion'), proveedor_id: get('em-proveedor-id') || null, modelo: get('em-modelo'), material: get('em-material'), color_estructura: get('em-color-estructura') };
    }

    // ¿Hay nueva foto?
    const nuevaFotoInput = document.getElementById('em-nueva-foto');
    if (nuevaFotoInput && nuevaFotoInput.files.length > 0) {
        const fd = new FormData();
        fd.append('archivo', nuevaFotoInput.files[0]);
        try {
            const uploadRes = await apiFetch(`${API_URL}/api/upload-voucher`, { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData.url) payload.foto_url = uploadData.url;
        } catch {
            Swal.close();
            return Swal.fire('Error', 'No se pudo subir la foto. Los demás cambios no se guardaron.', 'error');
        }
    }

    // Mapa de tipo → segmento de URL del endpoint PUT
    const tipoEndpoint = {
        'tela':         'telas',
        'cojin':        'cojines',
        'base':         'bases',
        'base-comedor': 'bases-comedor',
        'tablero':      'tableros',
        'silla':        'sillas',
        'butaca':       'butacas',
    };

    const urlPUT = `${API_URL}/api/materiales/${tipoEndpoint[tipo]}/${encodeURIComponent(sku)}`;

    try {
        const res = await apiFetch(urlPUT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.exito) {
            Swal.fire({ icon: 'success', title: '¡Cambios guardados!', timer: 1800, showConfirmButton: false });
            document.getElementById('modal-editar-material').style.display = 'none';
            await _refreshMaestro(); // Recarga el maestro y re-renderiza las tarjetas
        } else {
            Swal.fire('Error', data.error || 'No se pudo guardar.', 'error');
        }
    } catch {
        Swal.fire('Error', 'Fallo de conexión al intentar guardar.', 'error');
    }
}

/**
 * Recarga el maestro de materiales desde el backend y vuelve a renderizar
 * todas las secciones del Maestro en la vista de taller/admin.
 */
async function _refreshMaestro() {
    try {
        const res = await apiFetch(`${API_URL}/api/materiales/listas`);
        const mat = await res.json();
        // Actualizar el estado global
        maestroMateriales.telas        = mat.telas        || [];
        maestroMateriales.cojines      = mat.cojines      || [];
        maestroMateriales.bases        = mat.bases        || [];
        maestroMateriales.tableros     = mat.tableros     || [];
        maestroMateriales.bases_comedor = mat.bases_comedor || [];
        maestroMateriales.sillas       = mat.sillas       || [];
        maestroMateriales.butacas      = mat.butacas      || [];
    } catch { /* ignorar error de red — no re-lanzar */ }

    // Re-renderizar si la función está disponible (taller.js)
    if (typeof cargarInventarioTaller === 'function') {
        await cargarInventarioTaller();
    }
}



/* ================================================================= */
/* --- INICIO DEL SISTEMA --- */
/* ================================================================= */
/**
 * _syncPiezaFoto — sincroniza la foto de nota de pieza.
 * Propaga el archivo al input real (foto-nota-${tipo}) que catalogo.js ya lee,
 * y muestra el nombre del archivo como indicador visual.
 */
function _syncPiezaFoto(inputCam, targetId) {
    const file = inputCam?.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const target = document.getElementById(targetId);
    if (target) target.files = dt.files;
    // Mostrar nombre/icono indicador
    const tipoInput = targetId.replace('foto-nota-', '');
    const labelEl = document.getElementById(`foto-nota-label-${tipoInput}`);
    if (labelEl) {
        labelEl.textContent = file.type.startsWith('image/') ? '📷 ' + file.name : '📄 ' + file.name;
        labelEl.style.display = 'inline';
    }
    // Mostrar miniatura con zoom
    if (file.type.startsWith('image/')) {
        const imgPreviewNota = document.getElementById(`img-preview-${tipoInput}`);
        if (imgPreviewNota) {
            const reader = new FileReader();
            reader.onload = e => {
                imgPreviewNota.src = e.target.result;
                imgPreviewNota.style.display = 'block';
                _activarZoomEnImagen(imgPreviewNota);
            };
            reader.readAsDataURL(file);
        }
    }
}