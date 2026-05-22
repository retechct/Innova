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
    if (tipoInput === 'tela' || tipoInput === 'cojin-entero' || tipoInput === 'tela-silla' || tipoInput === 'tela-butaca' || tipoInput === 'tela-cojin') tipoData = 'telas';
    else if (tipoInput === 'cojin-diseno') tipoData = 'cojines';
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
        
        const isAgotado = item.estado === 'Agotado';
        const styleAgotado = isAgotado ? 'filter: grayscale(1); opacity: 0.5; cursor: not-allowed; background: #f1f5f9;' : '';
        const action = isAgotado ? '' : `onclick="seleccionarMaterial('${tipoInput}', '${item.sku}', '${safeTitulo}', '${item.foto_url}')"`;

        return `
            <div class="custom-option-item" ${action} style="${styleAgotado}">
                <img src="${item.foto_url}" class="custom-option-img" onerror="this.src='imagenes/sin_foto.jpg'">
                <div style="flex-grow:1;">
                    <span class="custom-option-sku">${item.sku} ${isAgotado ? '<b style="color:red;">(AGOTADO)</b>' : ''}</span>
                    <div class="custom-option-text"><strong>${titulo}</strong><br>${subtitulo}</div>
                </div>
            </div>`;
    }).join('');
    
    // 3. Unimos la opción Pinterest + Las opciones de la Base de Datos
    listContainer.innerHTML = htmlPinterest + htmlOpcionesBD;
    
    listContainer.classList.add('show');
}
function seleccionarMaterial(tipoInput, sku, nombre, fotoUrl) {
    // Guardamos el SKU secreto
    document.getElementById(`sku-${tipoInput}`).value = sku;
    // Ponemos el nombre en el buscador
    document.getElementById(`search-${tipoInput}`).value = nombre;
    
    // MOSTRAMOS LA IMAGEN EN MINIATURA
    let imgPreview = document.getElementById(`img-preview-${tipoInput}`);
    imgPreview.src = fotoUrl;
    imgPreview.style.display = 'block'; 
    
    // Cerramos la lista
    document.getElementById(`list-${tipoInput}`).classList.remove('show');
}

// Para cerrar las listas desplegables si se hace clic afuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-options').forEach(el => el.classList.remove('show'));
    }
});
// NOTA: destinoActual y tipoActual se declaran en config.js — no redeclarar aquí

function abrirModalNuevo(tipo, destino) {
    tipoActual = tipo;
    destinoActual = destino; // 'directo' (Admin) o 'sugerencia' (Vendedor)

    const modal = document.getElementById('modal-nuevo-material');
    const contenedorCampos = document.getElementById('nm-campos-dinamicos');
    const titleElem = document.getElementById('nm-title');
    
    if (!modal || !contenedorCampos) return;

    // Limpiar archivos e imágenes previas
    const nmFoto = document.getElementById('nm-foto');
    const nmFotoCamara = document.getElementById('nm-foto-camara');
    if (nmFoto) nmFoto.value = '';
    if (nmFotoCamara) nmFotoCamara.value = '';
    const prevContainer = document.getElementById('nm-foto-preview-container');
    if (prevContainer) prevContainer.style.display = 'none';

    // Ajuste dinámico del encabezado para dar contexto
    if (destino === 'sugerencia') {
        titleElem.innerText = `💡 Sugerir Insumo: ${tipo.toUpperCase()}`;
    } else {
        titleElem.innerText = `➕ Registrar Insumo: ${tipo.toUpperCase()}`;
    }

    // Ocultar el selector de origen para el vendedor (tú lo decides al aprobar)
    const divOrigen = document.getElementById('nm-origen')?.parentElement;
    if (divOrigen) {
        divOrigen.style.display = (destino === 'sugerencia') ? 'none' : 'block';
    }

    // INYECCIÓN DE CAMPOS TÉCNICOS COMPLETOS
    let htmlCampos = "";

    if (tipo === 'tela') {
        htmlCampos = `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Proveedor</label>
                <input type="text" id="nm-proveedor" class="form-input" placeholder="Ej. Textil San Jacinto" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Colección / Línea</label>
                <input type="text" id="nm-coleccion" class="form-input" placeholder="Ej. Velvet, Ipanema, lino Rustico" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Color / Código de Color</label>
                <input type="text" id="nm-color" class="form-input" placeholder="Ej. Gris Plata, Beige 05" required>
            </div>
        `;
    } 
    else if (tipo === 'cojin') {
        htmlCampos = `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Nombre del Diseño / Modelo</label>
                <input type="text" id="nm-nombre-diseno" class="form-input" placeholder="Ej. Cojín de Respaldar Capitoneado" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Tipo de Tela Requerida</label>
                <input type="text" id="nm-tipo-tela" class="form-input" placeholder="Ej. Terciopelo o Lino" required>
            </div>
        `;
    } 
    else if (tipo === 'base' || tipo === 'base-comedor') {
        htmlCampos = `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Tipo de Base</label>
                <input type="text" id="nm-tipo-base" class="form-input" placeholder="Ej. Pata Metálica, Zócalo" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Material Estructural</label>
                <input type="text" id="nm-material" class="form-input" placeholder="Ej. Acero Inoxidable, Madera Pino" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Modelo / Estilo</label>
                <input type="text" id="nm-modelo" class="form-input" placeholder="Ej. Pata Aguja, Base de Mesa Cruzada" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Color / Acabado Superficial</label>
                <input type="text" id="nm-color" class="form-input" placeholder="Ej. Dorado Cromado, Negro Mate" required>
            </div>
            ${tipo === 'base' ? `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Medida de Altura (cm)</label>
                <input type="text" id="nm-medida-altura" class="form-input" placeholder="Ej. 15 cm" required>
            </div>` : ''}
        `;
    } 
    else if (tipo === 'tablero') {
        htmlCampos = `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Material Base</label>
                <input type="text" id="nm-material-base" class="form-input" placeholder="Ej. MDF, Cuarzo, Vidrio Templado" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Nombre del Modelo / Diseño</label>
                <input type="text" id="nm-nombre-modelo" class="form-input" placeholder="Ej. Blanco Carrara, Roble Novopán" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Color de Veta / Tonalidad</label>
                <input type="text" id="nm-color-veta" class="form-input" placeholder="Ej. Gris tenue, Tonalidad Miel">
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Acabado / Textura</label>
                <input type="text" id="nm-acabado" class="form-input" placeholder="Ej. Alto Brillo, Mate texturizado" required>
            </div>
        `;
    } 
    else if (tipo === 'silla' || tipo === 'butaca') {
        htmlCampos = `
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Modelo / Diseño Estructural</label>
                <input type="text" id="nm-modelo" class="form-input" placeholder="Ej. Escandinava, Capitoné" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Material de la Estructura</label>
                <input type="text" id="nm-material" class="form-input" placeholder="Ej. Madera Cachimbo, Fierro" required>
            </div>
            <div class="form-group">
                <label style="font-size: 11px; font-weight: bold; color: var(--primary);">Color de Estructura / Barniz</label>
                <input type="text" id="nm-color-estructura" class="form-input" placeholder="Ej. Nogal, Negro Satinado" required>
            </div>
        `;
    }

    contenedorCampos.innerHTML = htmlCampos;
    modal.style.display = 'flex';
}
async function guardarNuevoMaterial() {
    const fotoInput = document.getElementById('nm-foto');
    if (!fotoInput || fotoInput.files.length === 0) {
        return Swal.fire('Error', 'Debe adjuntar una foto de referencia', 'warning');
    }

    // Detectamos si el guardado actual es una sugerencia de vendedor
    const esSugerencia = (destinoActual === 'sugerencia' || (usuarioActivo && usuarioActivo.rol === 'Vendedor'));

    const formData = new FormData();
    formData.append('foto', fotoInput.files[0]);

    // Recolectamos dinámicamente las propiedades según el tipo actual
    let datosObj = {};
    let nombreInsumoCalculado = "";

    try {
        if (tipoActual === 'tela') {
            datosObj.proveedor = document.getElementById('nm-proveedor').value;
            datosObj.coleccion = document.getElementById('nm-coleccion').value;
            datosObj.color = document.getElementById('nm-color').value;
            nombreInsumoCalculado = `Tela ${datosObj.coleccion} - ${datosObj.color}`;
        } 
        else if (tipoActual === 'cojin') {
            datosObj.nombre_diseno = document.getElementById('nm-nombre-diseno').value;
            datosObj.tipo_tela = document.getElementById('nm-tipo-tela').value;
            nombreInsumoCalculado = `Cojín ${datosObj.nombre_diseno}`;
        } 
        else if (tipoActual === 'base' || tipoActual === 'base-comedor') {
            const matBase = document.getElementById('nm-material');
            datosObj.material = matBase ? matBase.value : 'No especificado';
            datosObj.modelo = document.getElementById('nm-modelo').value;
            datosObj.color = document.getElementById('nm-color').value;
            if (document.getElementById('nm-medida-altura')) datosObj.medida_altura = document.getElementById('nm-medida-altura').value;
            if (document.getElementById('nm-tipo-base')) datosObj.tipo = document.getElementById('nm-tipo-base').value;
            nombreInsumoCalculado = `Base ${datosObj.modelo} ${datosObj.color}`;
        } 
        else if (tipoActual === 'tablero') {
            datosObj.material_base = document.getElementById('nm-material-base').value;
            datosObj.nombre_modelo = document.getElementById('nm-nombre-modelo').value;
            if (document.getElementById('nm-color-veta')) datosObj.color_veta = document.getElementById('nm-color-veta').value;
            datosObj.acabado = document.getElementById('nm-acabado').value;
            nombreInsumoCalculado = `Tablero ${datosObj.nombre_modelo}`;
        } 
        else if (tipoActual === 'silla' || tipoActual === 'butaca') {
            datosObj.modelo = document.getElementById('nm-modelo').value;
            datosObj.material = document.getElementById('nm-material').value;
            datosObj.color_estructura = document.getElementById('nm-color-estructura').value;
            nombreInsumoCalculado = `${tipoActual.charAt(0).toUpperCase() + tipoActual.slice(1)} ${datosObj.modelo}`;
        }
    } catch (error) {
        return Swal.fire('Formulario Incompleto', 'Por favor llena los campos requeridos', 'warning');
    }

    Swal.fire({ title: 'Procesando requerimiento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // RUTA BIFURCADA INTELIGENTE
    let endpointUrl = `${API_URL}/api/materiales/nuevo`;
    
    if (esSugerencia) {
        endpointUrl = `${API_URL}/api/sugerencias`;
        formData.append('nombre', nombreInsumoCalculado);
        formData.append('tipo', tipoActual);
        if (!usuarioActivo) return Swal.fire('Sesión', 'Debes iniciar sesión.', 'warning');
        formData.append('usuario_id', usuarioActivo.id)
        formData.append('datos_json', JSON.stringify(datosObj));
    } else {
        // Flujo tradicional Admin Directo
        formData.append('tipo_material', tipoActual);
        const origenElem = document.getElementById('nm-origen');
        formData.append('origen_produccion', origenElem ? origenElem.value : 'Externo');
        
        // Mapear al formData tradicional para no romper el backend original de inserción directa
        for (const [key, value] of Object.entries(datosObj)) {
            formData.append(key, value);
        }
    }

    try {
        const res = await fetch(endpointUrl, { method: 'POST', body: formData });
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: esSugerencia ? '¡Sugerencia Enviada!' : '¡Insumo Guardado!',
                text: esSugerencia ? 'Aparecerá en el Gestor del Admin para su oficialización.' : 'Disponible inmediatamente.',
                confirmButtonColor: '#0f172a'
            });
            document.getElementById('modal-nuevo-material').style.display = 'none';
            init();
        } else {
            const err = await res.json();
            Swal.fire('Error', err.error || 'No se pudo procesar', 'error');
        }
    } catch (e) {
        Swal.fire('Error de red', 'No se pudo contactar al servidor', 'error');
    }
}
/* --- LÓGICA PARA AMPLIAR IMAGEN (ZOOM) --- */
function ampliarImagen(url) {
    if (!url || url === '') return;
    
    Swal.fire({
        imageUrl: url,
        imageAlt: 'Vista ampliada del material',
        showConfirmButton: false,
        showCloseButton: true,
        width: 'auto',
        padding: '1em',
        background: '#fff',
        backdrop: `rgba(15, 23, 42, 0.85)` // Fondo oscuro elegante
    });
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
        const response = await fetch(`${API_URL}/api/creaciones`, { method: 'POST', body: formData });
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
        // 1. Encendemos la caja de productos y apagamos las demás
        document.getElementById('view-productos').style.display = 'block';
        document.getElementById('view-plantillas').style.display = 'none';
        document.getElementById('view-pedidos').style.display = 'none';
        
        // 2. Cambiamos el Título Principal
        document.getElementById('view-title').innerText = 'MIS CREACIONES (PLANTILLAS)';
        document.getElementById('view-icon').className = 'fa-solid fa-wand-magic-sparkles';
        
        // 3. Pedimos los datos a tu servidor Python
        const response = await fetch(`${API_URL}/api/creaciones`);
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
        
        const response = await fetch(`${API_URL}/api/creaciones`);
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
        const response = await fetch(`${API_URL}/api/creaciones`);
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
function abrirModalProductoDirecto() {
    // Limpiamos la ventana
    document.getElementById('pd-foto').value = '';
    document.getElementById('pd-nombre').value = '';
    document.getElementById('pd-precio').value = '';
    document.getElementById('pd-cantidad').value = '1';
    document.getElementById('pd-origen').value = 'Externo';
    
    document.getElementById('modal-producto-directo').style.display = 'flex';
}

async function guardarProductoDirecto() {
    const foto = document.getElementById('pd-foto').files[0];
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
        const res = await fetch(`${API_URL}/api/catalogo/nuevo`, {
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
    const { value: descripcion } = await Swal.fire({
        title: '📐 Especificación de la Pieza',
        html: `
            <p style="font-size: 13px; color: #64748b; text-align: left; margin-bottom: 10px;">
                Escribe las instrucciones <b>solo para esta parte del mueble</b>:
            </p>
            <textarea id="swal-pin-desc" class="swal2-textarea" placeholder="Ej: Patas cruzadas en forma de X, color negro mate..." style="margin-top: 0; height: 80px; font-size: 14px;"></textarea>
            
            <div style="background: #fffcf0; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-top: 15px; text-align: left; font-size: 12px; color: #b45309;">
                <b>📷 IMPORTANTE:</b> Recuerda subir la imagen de esta pieza usando el botón <b>"Fotos de Referencia"</b> que está en el menú izquierdo.
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Pieza',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        preConfirm: () => {
            const desc = document.getElementById('swal-pin-desc').value;
            if (!desc || desc.trim() === '') {
                Swal.showValidationMessage('Debes escribir una descripción para el taller.');
                return false;
            }
            return desc;
        }
    });

    if (descripcion) {
        // Formateamos el texto para que se vea claro en el ticket del taller
        let tituloEspecial = `✨ ESP: ${descripcion}`;
        
        // Creamos un SKU único temporal para esta pieza basada en la hora
        let skuTemporal = `REQ-PIN-${Date.now().toString().slice(-6)}`;
        
        // Usamos tu misma función para inyectar esto en el formulario visual
        seleccionarMaterial(tipoInput, skuTemporal, tituloEspecial, 'imagenes/sin_foto.jpg');
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
        const res = await fetch(`${API_URL}/api/sugerencias`, {
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
        const res = await fetch(`${API_URL}/api/usuarios/detalle`);
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
        const res = await fetch(`${API_URL}/api/usuarios/nuevo`, {
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
        const res = await fetch(`${API_URL}/api/proveedores`);
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
        const res = await fetch(`${API_URL}/api/proveedores/nuevo`, {
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

/* ================================================================= */
/* --- INICIO DEL SISTEMA --- */
/* ================================================================= */