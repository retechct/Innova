// =============================================================
// INNOVA MOBILI ERP — Configuración Global
// Para subir a producción, cambia SOLO esta línea:
const API_URL = "http://127.0.0.1:5000";
// =============================================================

const imagenesSofa = {
    'multi3': 'imagenes/multi3.jpg',
    'multi4': 'imagenes/multi4.jpg',
    'seccional': 'imagenes/seccional.jpg',
    'seccional_inv': 'imagenes/seccional_inv.jpg',
    'curvo': 'imagenes/curvo.jpg',
    'u': 'imagenes/u.jpg',
    'juego': 'imagenes/3.jpg', 
    '3': 'imagenes/3.jpg',
    '2': 'imagenes/2.jpg',
    '1': 'imagenes/1.jpg'
};

let allProducts = [], cart = [], currentMode = 'catalogo', currentStep = 1, tempItem = null, filtroTaller = 'Pendientes', filtroAdminTaller = 'pendientes';
let maestroMateriales = { telas: [], cojines: [], bases: [] }; // NUEVO: Almacén de insumos
let usuarioActivo = null;


async function init() {
    try {
        const [catRes, matRes] = await Promise.all([
            fetch(`${API_URL}/api/catalogo`),
            fetch(`${API_URL}/api/materiales/listas`) 
        ]);
        
        allProducts = await catRes.json();
        maestroMateriales = await matRes.json(); 
        
        // Verificamos si Python nos mandó un error de Base de Datos en lugar de la lista
        if (allProducts.error || maestroMateriales.error) {
            console.error("Error de BD:", allProducts.error || maestroMateriales.error);
            return Swal.fire('Error de Base de Datos', 'Revisa la consola (F12) para ver la tabla que falta.', 'error');
        }
        
        // Punto 4: Persistencia de Sesión al recargar
        const sesion = localStorage.getItem('usuarioInnova');
        if (sesion) {
            usuarioActivo = JSON.parse(sesion);
            configurarInterfazPorRol();
            document.getElementById('pantalla-login').style.display = 'none';
            // Lógica de ruteo inicial al cargar la sesión
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER') {
                changeView('taller');
            } else {
                changeView('catalogo');
            }
        }
    } catch (e) {
        console.error("Error crítico:", e);
        Swal.fire('Error de Conexión', 'El servidor no responde o hay un error de código. Mira la consola (F12).', 'error');
    }
}

// Función centralizada para manejar permisos de UI
function configurarInterfazPorRol() {
    if (!usuarioActivo) return;
    
    const btnTaller = document.getElementById('btn-menu-taller');
    const btnInventario = document.getElementById('btn-menu-inventario');
    const btnGestor = document.getElementById('btn-menu-gestor');
    const btnAddProd = document.getElementById('btn-add-producto');
    const btnLogistica = document.getElementById('btn-menu-logistica');
    const btnUsuarios = document.getElementById('btn-menu-usuarios');
    const btnProv = document.getElementById('btn-menu-proveedores');

    // Ocultar todos los botones por defecto
    if (btnTaller) btnTaller.style.display = 'none';
    if (btnInventario) btnInventario.style.display = 'none';
    if (btnGestor) btnGestor.style.display = 'none';
    if (btnAddProd) btnAddProd.style.display = 'none';
    if (btnLogistica) btnLogistica.style.display = 'none';
    if (btnUsuarios) btnUsuarios.style.display = 'none';
    if (btnProv) btnProv.style.display = 'none';

    // Mostrar botones según el rol
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'Operario'].includes(usuarioActivo.rol)) {
        if (btnTaller) btnTaller.style.display = 'flex'; // GESTIÓN DE TALLER
    }
    if (['Admin', 'Jefe_Taller', 'JEFE_TALLER', 'ALMACEN'].includes(usuarioActivo.rol)) {
        if (btnInventario) btnInventario.style.display = 'flex'; // CONTROL DE INSUMOS
    }
    if (usuarioActivo.rol === 'Admin') {
        if (btnGestor) btnGestor.style.display = 'flex';     // GESTOR DE MODELOS
        if (btnAddProd) btnAddProd.style.display = 'block'; // Añadir Producto (en catálogo)
        if (btnLogistica) btnLogistica.style.display = 'flex'; // LOGÍSTICA EXTERNA
        if (btnUsuarios) btnUsuarios.style.display = 'flex';   // GESTIÓN DE PERSONAL
        if (btnProv) btnProv.style.display = 'flex';         // PROVEEDORES
    }
}
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay-sidebar').classList.toggle('active');
}

/* ================================================================= */
/* --- SEGUIMIENTO DE PEDIDOS (CONEXIÓN CON PYTHON) --- */
/* ================================================================= */
/* --- FUNCIÓN DE SEGUIMIENTO (Dibuja en tu div "pedidos-container") --- */
/* --- FUNCIÓN DE SEGUIMIENTO (Dibuja en tu div "pedidos-container") --- */
async function loadMisPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center; padding:20px; color:gray;">Cargando seguimiento...</p>`;

    try {
        // CORRECCIÓN APLICADA: Leemos quién inició sesión en lugar de usar el "1" fijo
        const idVendedor = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.id : 1; 
        const res = await fetch(`${API_URL}/api/mis-ventas/${idVendedor}`);
        const data = await res.json();
        
        if (data.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:40px;">No hay pedidos registrados.</p>`;
            return;
        }

        // Usamos tus campos de Python: v.codigo, v.cliente, v.entrega, v.progreso
        // Usamos tus campos de Python: v.codigo, v.cliente, v.entrega, v.progreso
        container.innerHTML = data.map(v => `
            <div class="pedido-card" onclick="abrirDetallePedido('${v.codigo}')" style="background:white; padding:15px; border-radius:10px; margin-bottom:10px; border:1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:800; color:#1a1a1a;">#${v.codigo}</span>
                    <small style="color:#d4af37; font-weight:800;">Entrega: ${v.entrega}</small>
                </div>
                <p style="font-weight:700; margin:0 0 10px 0; font-size:14px; color:#1e293b;">${v.cliente.toUpperCase()}</p>
                <div style="font-size:10px; font-weight:bold; color:gray; margin-bottom:5px;">PROGRESO: ${v.progreso}%</div>
                <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                    <div style="width:${v.progreso}%; height:100%; background:linear-gradient(90deg, #d4af37, #b8860b);"></div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</p>`;
    }
}
/* --- FUNCIÓN BLINDADA CONTRA ERRORES "NULL" --- */
function changeView(view) {
    currentMode = view;
    if (document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
    
    // Actualizar encabezado
    const titles = { 
        'stock': 'STOCK EN TIENDA', 
        'catalogo': 'NUESTRA CARTA', 
        'contrato': 'DISEÑOS A MEDIDA', 
        'pedidos': 'SEGUIMIENTO', 
        'taller': 'GESTIÓN DE TALLER' ,
        'inventario': 'CONTROL DE INSUMOS'
    };
    
    if (titles[view]) {
        document.getElementById('view-title').innerText = titles[view];
    }

    // Ocultar TODAS las vistas que tienes en el HTML
    const secciones = ['view-productos', 'view-plantillas', 'view-pedidos', 'view-taller', 'view-inventario', 'view-gestor-aprobacion', 'view-logistica', 'view-usuarios-admin', 'view-proveedores'];
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Mostrar la vista seleccionada
    if (view === 'stock' || view === 'catalogo') {
        document.getElementById('view-productos').style.display = 'block';
        renderGrid(); 
    } 
    else if (view === 'contrato') {
        document.getElementById('view-plantillas').style.display = 'block';
    } 
    else if (view === 'pedidos') {
        document.getElementById('view-pedidos').style.display = 'block';
        loadMisPedidos();
    }
 else if (view === 'taller') {
        document.getElementById('view-taller').style.display = 'block';
        cargarTicketsTaller(); 
    }
    else if (view === 'inventario') {
        document.getElementById('view-inventario').style.display = 'block';
        cargarInventarioTaller(); 
    }
    else if (view === 'logistica') {
        document.getElementById('view-logistica').style.display = 'block';
        cargarLogisticaExterna();
    }
    else if (view === 'usuarios-admin') {
        document.getElementById('view-usuarios-admin').style.display = 'block';
        listarUsuarios();
    }
    else if (view === 'proveedores') {
        document.getElementById('view-proveedores').style.display = 'block';
        listarProveedores();
    }
}
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
function toggleCart() {
    document.getElementById('cart-slider').classList.toggle('open');
    document.getElementById('overlay-cart').classList.toggle('active');
    if(document.getElementById('cart-slider').classList.contains('open')) {
        document.getElementById('c-emision').value = new Date().toISOString().split('T')[0];
        goToStep(1);
    }
}

function addToCart(name, price, img, details, componentes = {}) {
    cart.push({ name, price, img, details, componentes });
    document.getElementById('cart-count').innerText = cart.length;
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('lista-carrito');
    list.innerHTML = cart.length === 0 ? '<p style="text-align:center; padding:40px; color:gray;">El carrito está vacío</p>' : cart.map((item, i) => `
        <div style="padding:15px; background:#f8fafc; border-radius:15px; margin-bottom:12px; border:1px solid #eee;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--primary); font-size:13px;">${item.name}</strong>
                <strong style="color:var(--success);">S/ ${item.price.toFixed(2)}</strong>
            </div>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">${item.details}</div>
            <div style="text-align:right; margin-top:5px;"><button onclick="removeItem(${i})" style="border:none; color:red; background:none; cursor:pointer; font-size:10px; font-weight:bold;">QUITAR</button></div>
        </div>
    `).join('');
    calcularTotales();
}

function removeItem(i) { cart.splice(i, 1); updateCartUI(); document.getElementById('cart-count').innerText = cart.length; }

/* --- REEMPLAZA ESTA FUNCIÓN COMPLETA --- */
function calcularTotales() {
    // 1. Sumar el total de los muebles en el carrito
    const total = cart.reduce((s, i) => s + i.price, 0);
    
    // 2. Sumar el total de los adelantos usando la nueva lógica de Múltiples Pagos
    let adelanto = 0;
    if (typeof listaPagos !== 'undefined') {
        adelanto = listaPagos.reduce((sum, p) => sum + p.monto, 0);
    }
    
    // 3. Imprimir los resultados en el carrito (protegido por si no existen los IDs)
    const elTotal = document.getElementById('res-total');
    const elAdelanto = document.getElementById('res-adelanto');
    const elSaldo = document.getElementById('res-saldo');

    if (elTotal) elTotal.innerText = `S/ ${total.toFixed(2)}`;
    if (elAdelanto) elAdelanto.innerText = `S/ ${adelanto.toFixed(2)}`;
    if (elSaldo) elSaldo.innerText = `S/ ${(total - adelanto).toFixed(2)}`;
}

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    for(let i = 1; i <= step; i++) document.getElementById(`s${i}`).classList.add('active');
    
    const btn = document.getElementById('btn-main');
    if(step === 1) btn.innerHTML = 'CONTINUAR A CLIENTE <i class="fa-solid fa-arrow-right"></i>';
    else if(step === 2) btn.innerHTML = 'CONTINUAR A PAGO <i class="fa-solid fa-arrow-right"></i>';
    else btn.innerHTML = '<i class="fa-solid fa-print"></i> FINALIZAR VENTA';
}

function handleNextStep() {
    if (currentStep === 1) { 
        if (cart.length === 0) return Swal.fire('Vacío', 'Agregue productos al carrito', 'info'); 
        goToStep(2); 
    }
    else if (currentStep === 2) { 
        // 1. Capturamos todos los datos importantes
        const codigo = document.getElementById('c-codigo').value;
        const nombre = document.getElementById('c-nombre').value;
        const dni = document.getElementById('c-dni').value;
        const celular = document.getElementById('c-celular').value;

        // 2. VALIDACIÓN: Obligamos a que DNI y Celular estén llenos
        if (!codigo || !nombre || !dni || !celular) {
            return Swal.fire({
                title: 'Faltan Datos',
                text: 'El N° de Contrato, Nombre, DNI y Celular son obligatorios para poder generar el contrato.',
                icon: 'warning',
                confirmButtonColor: '#d4af37'
            });
        }
        goToStep(3); 
    }
    else { 
        guardarVenta(); 
    }
}
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
let destinoActual = "";
let tipoActual = "";

function abrirModalNuevo(tipo, destino) {
    destinoActual = destino;
    tipoActual = tipo;
    
    document.getElementById('nm-foto').value = ""; 
    document.getElementById('nm-tipo').value = tipo;
    document.getElementById('modal-nuevo-material').style.display = 'flex';
    
    const container = document.getElementById('nm-campos-dinamicos');
    let html = '';

    // --- LÓGICA DE CAMPOS SEGÚN TIPO ---
    if (tipo === 'tela') {
        document.getElementById('nm-title').innerText = '🧵 Registrar Nueva Tela';
        html = `
            <input type="text" id="nm-proveedor" class="form-input" placeholder="Proveedor (Ej: Textil San Juan)" required style="margin-bottom:8px;">
            <input type="text" id="nm-coleccion" class="form-input" placeholder="Colección/Textura (Ej: Lino Premium)" required style="margin-bottom:8px;">
            <input type="text" id="nm-color" class="form-input" placeholder="Color (Ej: Beige Claro)" required>`;
    } else if (tipo === 'cojin') {
        document.getElementById('nm-title').innerText = '🎨 Registrar Diseño de Cojín';
        html = `
            <input type="text" id="nm-nombre-diseno" class="form-input" placeholder="Nombre del Diseño (Ej: Geométrico Otoño)" required style="margin-bottom:8px;">
            <input type="text" id="nm-tipo-tela" class="form-input" placeholder="Tipo de Tela (Ej: Jacquard)" required>`;
    } else if (tipo === 'base' || tipo === 'base-comedor') {
        document.getElementById('nm-title').innerText = tipo === 'base' ? '🛋️ Pata / Zócalo de Sofá' : '🍽️ Base de Mesa de Comedor';
        html = `
            <input type="text" id="nm-modelo" class="form-input" placeholder="Modelo (Ej: Araña, Cilíndrica, Reina)" required style="margin-bottom:8px;">
            <select id="nm-material" class="form-input" style="margin-bottom:8px;">
                <option value="Acero Inoxidable">Acero Inoxidable</option>
                <option value="Fierro Pintado">Fierro Pintado</option>
                <option value="Madera">Madera / Tornillo</option>
            </select>
            ${tipo === 'base' ? '<input type="number" id="nm-medida-altura" class="form-input" placeholder="Altura (cm)" style="margin-bottom:8px;">' : ''}
            ${tipo === 'base' ? '<input type="text" id="nm-tipo-base" class="form-input" placeholder="Tipo (Ej: Pata, Zócalo)" style="margin-bottom:8px;">' : ''}
            <input type="text" id="nm-color" class="form-input" placeholder="Color/Acabado (Ej: Dorado, Negro Mate)" required>`;
    } else if (tipo === 'tablero') {
        document.getElementById('nm-title').innerText = '💎 Registrar Nuevo Tablero';
        html = `
            <input type="text" id="nm-nombre-modelo" class="form-input" placeholder="Nombre Veta/Modelo (Ej: Calacatta, Carrara)" required style="margin-bottom:8px;">
            <select id="nm-material-base" class="form-input" style="margin-bottom:8px;">
                <option value="Piedra Sinterizada">Piedra Sinterizada</option>
                <option value="Madera">Madera Natural / Melamina</option>
                <option value="Vidrio Templado">Vidrio Templado</option>
            </select>
            <input type="text" id="nm-color-veta" class="form-input" placeholder="Color de Veta / Tono" style="margin-bottom:8px;">
            <select id="nm-acabado" class="form-input">
                <option value="Brillante">Brillante</option>
                <option value="Mate">Mate / Natural</option>
            </select>`;
    } else if (tipo === 'silla' || tipo === 'butaca') {
        document.getElementById('nm-title').innerText = '🪑 Registrar Estructura Silla/Butaca';
        html = `
            <input type="text" id="nm-modelo" class="form-input" placeholder="Modelo (Ej: Medallón, Nórdica)" required style="margin-bottom:8px;">
            <input type="text" id="nm-color-estructura" class="form-input" placeholder="Color de Estructura (Ej: Nogal, Dorado)" required>`;
    }

    // --- BLOQUE MAESTRO: ORIGEN DE PRODUCCIÓN (OBLIGATORIO PARA ADMIN) ---
    html += `
        <div style="margin-top:15px; padding:12px; background:#f8fafc; border: 1px solid #e2e8f0; border-radius:8px;">
            <label style="color:#0f172a; font-weight:800; font-size:11px; display:block; margin-bottom:5px;">
                <i class="fa-solid fa-industry"></i> ESPECIFICACIÓN DE PRODUCCIÓN:
            </label>
            <select id="nm-origen" class="form-input" style="border-color:#cbd5e1; background: white;">
                <option value="Interno">🛠️ INTERNO (Se fabrica en taller)</option>
                <option value="Externo" selected>📦 EXTERNO (Compra a proveedor)</option>
            </select>
            <p style="font-size:10px; color:#64748b; margin-top:5px; line-height:1.2;">
                * Selecciona <b>Interno</b> para generar tickets automáticos a tus áreas de producción.
            </p>
        </div>
    `;

    container.innerHTML = html;
}

async function guardarNuevoMaterial() {
    const fotoInput = document.getElementById('nm-foto');
    
    // 1. Validación de foto
    if (!fotoInput || fotoInput.files.length === 0) {
        return Swal.fire('Error', 'Debe adjuntar una foto de referencia', 'warning');
    }

    const formData = new FormData();
    formData.append('tipo_material', tipoActual);
    formData.append('foto', fotoInput.files[0]);

    // 2. Captura segura del Origen (Interno/Externo)
    const origenElem = document.getElementById('nm-origen');
    const origen = origenElem ? origenElem.value : 'Externo';
    formData.append('origen_produccion', origen);

    // 3. Captura dinámica por tipo (Evita errores de "null")
    try {
        if (tipoActual === 'tela') {
            formData.append('proveedor', document.getElementById('nm-proveedor').value);
            formData.append('coleccion', document.getElementById('nm-coleccion').value);
            formData.append('color', document.getElementById('nm-color').value);
        } 
        else if (tipoActual === 'cojin') {
            formData.append('nombre_diseno', document.getElementById('nm-nombre-diseno').value);
            formData.append('tipo_tela', document.getElementById('nm-tipo-tela').value);
        } 
        else if (tipoActual === 'base' || tipoActual === 'base-comedor') {
            // Unificamos la captura de bases
            const matBase = document.getElementById('nm-material');
            formData.append('material', matBase ? matBase.value : 'No especificado');
            formData.append('modelo', document.getElementById('nm-modelo').value);
            formData.append('color', document.getElementById('nm-color').value);
            
            // Altura solo existe en bases de sofá
            const altura = document.getElementById('nm-medida-altura');
            if (altura) formData.append('medida_altura', altura.value);
            
            const tipoBase = document.getElementById('nm-tipo-base');
            if (tipoBase) formData.append('tipo', tipoBase.value);
        } 
        else if (tipoActual === 'tablero') {
            formData.append('material_base', document.getElementById('nm-material-base').value);
            formData.append('nombre_modelo', document.getElementById('nm-nombre-modelo').value);
            
            const veta = document.getElementById('nm-color-veta'); // Agregado por seguridad
            if (veta) formData.append('color_veta', veta.value);
            
            formData.append('acabado', document.getElementById('nm-acabado').value);
        } 
        else if (tipoActual === 'silla' || tipoActual === 'butaca') {
            formData.append('modelo', document.getElementById('nm-modelo').value);
            formData.append('color_estructura', document.getElementById('nm-color-estructura').value);
        }
    } catch (error) {
        console.error("Error capturando campos:", error);
        return Swal.fire('Error', 'Faltan completar campos obligatorios del formulario', 'warning');
    }

    Swal.fire({ 
        title: 'Guardando en Base de Datos...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        const res = await fetch(`${API_URL}/api/materiales/nuevo`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Pieza Registrada!',
                text: `El insumo se guardó como origen: ${origen}`,
                confirmButtonColor: '#0f172a'
            });
            document.getElementById('modal-nuevo-material').style.display = 'none';
            init(); // Recarga las listas para que aparezca la nueva pieza
        } else {
            const err = await res.json();
            Swal.fire('Error del Servidor', err.error || 'No se pudo guardar', 'error');
        }
    } catch (e) {
        Swal.fire('Error de Conexión', 'El servidor no responde. Revisa si app.py está corriendo.', 'error');
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
let listaPagos = [];

function actualizarCamposPago() {
    const tipo = document.getElementById('pago-tipo').value;
    const entidad = document.getElementById('pago-entidad');
    const operacion = document.getElementById('pago-operacion');

    // Limpiamos los valores previos
    entidad.innerHTML = '';
    operacion.value = '';

    if (tipo === 'Transferencia') {
        entidad.style.display = 'block';
        operacion.style.display = 'block';
        entidad.innerHTML = `
            <option value="BCP">BCP</option>
            <option value="BBVA">BBVA</option>
            <option value="Yape">Yape</option>
            <option value="Plin">Plin</option>
        `;
    } else if (tipo === 'POS') {
        entidad.style.display = 'block';
        operacion.style.display = 'block'; // POS también genera un voucher con número de operación/lote
        entidad.innerHTML = `
            <option value="Izipay">Izipay</option>
            <option value="Niubis">Niubis</option>
            <option value="Culqui">Culqui</option>
            <option value="Openpay">Openpay</option>
        `;
    } else {
        // Efectivo
        entidad.style.display = 'none';
        operacion.style.display = 'none';
    }
}

function limpiarFormularioVenta() {
    const camposCliente = ['c-codigo', 'c-nombre', 'c-dni', 'c-celular', 'c-direccion', 'c-entrega'];
    camposCliente.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

    listaPagos = [];
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-operacion').value = '';
    document.getElementById('pago-comprobante').value = '';
    document.getElementById('pago-tipo').value = 'Efectivo';
    actualizarCamposPago(); // Resetear selectores visuales
    actualizarPagosUI();
    
    goToStep(1);
}

function agregarMetodoPago() {
    const tipo = document.getElementById('pago-tipo').value;
    const entidad = document.getElementById('pago-entidad').style.display !== 'none' ? document.getElementById('pago-entidad').value : '';
    const operacion = document.getElementById('pago-operacion').value;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    const comprobanteInput = document.getElementById('pago-comprobante');

    // Validaciones
    if (isNaN(monto) || monto <= 0) return Swal.fire('Error', 'Ingrese un monto mayor a 0', 'warning');
    if (tipo !== 'Efectivo' && operacion.trim() === '') return Swal.fire('Error', 'El Número de Operación es obligatorio para transferencias o POS', 'warning');

    // Capturar el nombre del archivo si subió uno
    let comprobanteNombre = "Sin comprobante";
    if (comprobanteInput.files.length > 0) {
        comprobanteNombre = comprobanteInput.files[0].name;
    }

    listaPagos.push({ 
        tipo: tipo, 
        entidad: entidad, 
        operacion: operacion, 
        monto: monto,
        comprobante_nombre: comprobanteNombre
        // Nota Arquitectónica: Aquí en la Fase 2 subiremos el archivo al servidor mediante una ruta API igual que hicimos con los materiales.
    });

    // Limpiar campos para el siguiente pago
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-operacion').value = '';
    comprobanteInput.value = '';
    actualizarPagosUI();
}

function eliminarPago(index) {
    listaPagos.splice(index, 1);
    actualizarPagosUI();
}

function actualizarPagosUI() {
    const container = document.getElementById('lista-pagos-agregados');
    const totalAdelanto = listaPagos.reduce((sum, p) => sum + p.monto, 0);
    
    container.innerHTML = listaPagos.map((p, i) => {
        const detalle = p.tipo === 'Efectivo' ? 'Efectivo' : `${p.entidad} (Op: ${p.operacion})`;
        const iconoComprobante = p.comprobante_nombre !== 'Sin comprobante' ? '<i class="fa-solid fa-image" style="color: var(--primary);"></i>' : '';
        
        return `
        <div style="background:#fff; border-left: 4px solid var(--accent); padding:8px 10px; border-radius:5px; margin-bottom:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items: center;">
                <div>
                    <strong style="font-size: 13px;">${p.tipo}</strong> <span style="font-size: 11px; color: gray;">${iconoComprobante}</span><br>
                    <span style="font-size: 11px; color: var(--text-muted);">${detalle}</span>
                </div>
                <div style="text-align: right;">
                    <strong style="color: var(--success); font-size: 14px;">S/ ${p.monto.toFixed(2)}</strong><br>
                    <button onclick="eliminarPago(${i})" style="border:none; color:red; background:none; cursor:pointer; font-size: 10px; font-weight: bold; margin-top: 3px;">QUITAR</button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const totalVenta = cart.reduce((s, i) => s + i.price, 0);
    document.getElementById('res-total').innerText = `S/ ${totalVenta.toFixed(2)}`;
    document.getElementById('res-adelanto').innerText = `S/ ${totalAdelanto.toFixed(2)}`;
    document.getElementById('res-saldo').innerText = `S/ ${(totalVenta - totalAdelanto).toFixed(2)}`;
}
/* ================================================================= */
/* ================================================================= */
/* --- LÓGICA DEL CONFIGURADOR DE COMEDORES --- */
/* ================================================================= */

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

async function guardarVenta() {
    const total = cart.reduce((s, i) => s + i.price, 0);
    const adelantoTotal = listaPagos.reduce((s, i) => s + i.monto, 0);
    
    const metodosTexto = listaPagos.map(p => 
        p.tipo === 'Efectivo' ? `Efectivo: S/${p.monto}` : `${p.tipo} ${p.entidad} (Op:${p.operacion}): S/${p.monto}`
    ).join(' | ');

   const payload = {
        codigo: document.getElementById('c-codigo').value,
        cliente: document.getElementById('c-nombre').value,
        dni: document.getElementById('c-dni').value,
        celular: document.getElementById('c-celular').value,
        direccion: document.getElementById('c-direccion').value,
        fecha_emision: document.getElementById('c-emision').value,
        fecha_entrega: document.getElementById('c-entrega').value || null,
        metodo_pago: metodosTexto,
        monto_adelanto: adelantoTotal,
        monto_total: total,
        
        // --- AQUÍ ESTÁ LA CONEXIÓN CON EL LOGIN ---
        vendedor_id: usuarioActivo.id,
        vendedor_nombre: usuarioActivo.nombre,
        empresa_ruc: usuarioActivo.ruc,
        // ------------------------------------------

        muebles: cart.map(c => ({ 
            tipo: c.name, 
            precio: c.price, 
            tela: typeof c.details === 'object' ? JSON.stringify(c.details) : (c.details || "Venta Estándar"), 
            foto: c.img,
            componentes: c.componentes // Enviamos los SKUs al backend
        }))
    };
    Swal.fire({ title: 'Guardando en Base de Datos...', didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/ventas`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Swal.fire({
                title: '¡Venta Exitosa!',
                text: '¿Deseas imprimir el contrato profesional?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Sí, Imprimir',
                cancelButtonText: 'Cerrar',
                confirmButtonColor: '#d4af37' 
            }).then((result) => {
                if (result.isConfirmed) {
                    imprimirContratoElegante(); // Llamamos a tu función de diseño dorado
                }
                cart = [];
                document.getElementById('cart-count').innerText = "0";
                toggleCart();
                changeView('pedidos'); 
            });
        } else {
            const err = await res.json();
            // El backend ya traduce el error de duplicado a un mensaje humano
            Swal.fire('No se pudo guardar', err.error || 'Error desconocido del servidor', 'error');
        }
    } catch(e) {
        // Error de red (sin internet, servidor caído, timeout)
        Swal.fire({
            title: 'Sin conexión',
            html: 'No se pudo contactar al servidor.<br><b>La venta NO fue guardada.</b><br><small>Verifica tu conexión y vuelve a intentarlo.</small>',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
    }
}
// ==========================================
// NUEVO: FUNCIONES PARA CREACIONES DE VENDEDOR (CORREGIDO PARA SOFÁS Y COMEDORES)
// ==========================================

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

document.addEventListener('DOMContentLoaded', () => {
    cargarUsuariosLogin();
    verificarSesionExistente(); // <--- Nueva función
});
async function cargarUsuariosLogin() {
    try {
        const response = await fetch(`${API_URL}/api/usuarios`);
        const usuarios = await response.json();
        const select = document.getElementById('login-usuario');
        select.innerHTML = '<option value="">-- Elige tu nombre --</option>';
        
        usuarios.forEach(u => {
            select.innerHTML += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
        });
    } catch (error) {
        console.error("No hay conexión con el servidor para cargar usuarios", error);
    }
}
function verificarSesionExistente() {
    const sesionGuardada = localStorage.getItem('usuarioInnova');
    
    if (sesionGuardada) {
        usuarioActivo = JSON.parse(sesionGuardada);
        document.getElementById('pantalla-login').style.display = 'none';
        configurarInterfazPorRol(); // Centraliza la configuración de la UI
        // Lógica de ruteo inicial al cargar la sesión
        if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER') {
            changeView('taller');
        } else {
            changeView('catalogo');
        }
    }
}
async function entrarAlSistema() {
    const usuarioId = document.getElementById('login-usuario').value;
    const pin = document.getElementById('login-pin').value;
    
    // NUEVO: Capturamos la tienda que seleccionó en el dropdown
    const tiendaSelect = document.getElementById('login-tienda');
    const tiendaSeleccionada = tiendaSelect ? tiendaSelect.value : 'No especificada';

    if (!usuarioId || !pin) {
        return Swal.fire('Error', 'Selecciona tu nombre y pon tu PIN.', 'warning');
    }

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId, pin: pin })
        });

        const result = await response.json();

        if (result.exito) {
            usuarioActivo = result.usuario; // Aquí guardamos id, nombre, rol, empresa y ruc
            
            // NUEVO: Agregamos la tienda y la hora al perfil del usuario
            usuarioActivo.tienda = tiendaSeleccionada;
            usuarioActivo.horaLogin = new Date().toLocaleTimeString();
            
            // Guardamos todo junto en la memoria del navegador
            localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));
            
            // 1. Ocultamos el login
            document.getElementById('pantalla-login').style.display = 'none';
            
            configurarInterfazPorRol(); // Centraliza la configuración de la UI

            // Lógica de ruteo inicial después del login
            if (usuarioActivo.rol === 'Operario' || usuarioActivo.rol === 'Jefe_Taller' || usuarioActivo.rol === 'JEFE_TALLER') {
                changeView('taller');
            } else {
                changeView('catalogo');
            }

            // Mensaje de bienvenida actualizado con su tienda
            Swal.fire({
                title: `¡Hola, ${usuarioActivo.nombre}!`,
                text: `Rol: ${usuarioActivo.rol} | Sede: ${usuarioActivo.tienda}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire('Acceso Denegado', 'El PIN es incorrecto.', 'error');
            document.getElementById('login-pin').value = '';
        }
    } catch (error) {
        Swal.fire('Error', 'No hay conexión con el servidor Python.', 'error');
    }
}

// ==========================================
// FUNCIÓN PARA EDITAR PLANTILLAS GUARDADAS
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
function cerrarSesion() {
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: "Tendrás que poner tu PIN de nuevo para entrar.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d4af37',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('usuarioInnova'); // Borramos la memoria
            location.reload(); // Recargamos para mostrar el login de nuevo
        }
    });
}

// Hacemos que los usuarios se carguen apenas se abre la página
document.addEventListener('DOMContentLoaded', () => {
    cargarUsuariosLogin();
});
// ==========================================
// FUNCIÓN PARA USAR UNA PLANTILLA GUARDADA
// ==========================================
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
function imprimirContratoElegante() {
    // 1. CAPTURA DE DATOS (IDs de tu HTML)
    const nroContrato = document.getElementById('c-codigo').value || '00000';
    const nombreCliente = document.getElementById('c-nombre').value || '---';
    const dniCliente = document.getElementById('c-dni').value || '---';
    const celCliente = document.getElementById('c-celular').value || '---';
    const direccionEntrega = document.getElementById('c-direccion').value || '---';
    const fechaEmision = document.getElementById('c-emision').value || new Date().toLocaleDateString('es-PE');
    const fechaEntrega = document.getElementById('c-entrega').value || '---';

    const totalVenta = document.getElementById('res-total').innerText || 'S/ 0.00';
    const totalPagado = document.getElementById('res-adelanto').innerText || 'S/ 0.00';
    const saldoPendiente = document.getElementById('res-saldo').innerText || 'S/ 0.00';

   // 2. GENERAR FILAS DE PRODUCTOS CON MATRIZ TÉCNICA
    let filasItems = '';
    cart.forEach((item, index) => {
        let detalleHTML = "";
        
        // ¡CORRECCIÓN!: Ahora leemos la variable correcta de tu carrito (item.details)
        if (item.details) {
            // Si por si acaso es un objeto (como en catálogos muy antiguos)
            if (typeof item.details === 'object') {
                detalleHTML += `<table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 10px;">`;
                for (const [key, value] of Object.entries(item.details)) {
                    detalleHTML += `
                        <tr>
                            <td style="padding: 3px 5px; border-bottom: 1px solid #e2e8f0; width: 30%; color: #64748b; font-weight: bold; text-transform: uppercase;">${key}:</td>
                            <td style="padding: 3px 5px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${value}</td>
                        </tr>`;
                }
                detalleHTML += `</table>`;
            } else {
                // Si es texto (Como vienen los Sofás Personalizados y Plantillas)
                detalleHTML = `<div style="padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">${item.details}</div>`;
            }
        } else {
            // Solo si realmente está vacío
            detalleHTML = `<div style="padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">Especificaciones estándar de fabricación.</div>`;
        }

        // Diseño visual con la variable corregida
        filasItems += `
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b; vertical-align: top;">${index + 1}</td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <div style="font-weight: 900; color: #0f172a; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">${item.name}</div>
                    
                    <div style="background: #f8fafc; border-left: 3px solid #d4af37; padding: 8px; font-size: 10.5px; color: #334155; line-height: 1.5; border-radius: 0 4px 4px 0;">
                        ${detalleHTML}
                    </div>
                    
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 900; color: #0f172a; vertical-align: top;">S/ ${parseFloat(item.price).toFixed(2)}</td>
            </tr>`;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
    <html>
    <head>
        <title>Innova Mobili - Contrato ${nroContrato}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap');
            
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #333; margin: 0; padding: 0; background-color: #fff; }
            .page { width: 210mm; min-height: 297mm; padding: 15mm; margin: auto; position: relative; box-sizing: border-box; overflow: hidden; }
            
            /* DECORACIÓN GEOMÉTRICA (Estilo Carey) */
            .corner-top { position: absolute; top: -50px; right: -50px; width: 250px; height: 250px; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); transform: rotate(45deg); z-index: 0; opacity: 0.9; }
            .corner-top-inner { position: absolute; top: 0; right: 80px; width: 100px; height: 300px; background: #e5e7eb; transform: rotate(45deg); z-index: -1; }
            .corner-bottom { position: absolute; bottom: -80px; left: -80px; width: 280px; height: 280px; background: #1f2937; transform: rotate(45deg); z-index: 0; }
            .corner-bottom-accent { position: absolute; bottom: 40px; left: 80px; width: 40px; height: 200px; background: #d4af37; transform: rotate(45deg); z-index: -1; }

            .content { position: relative; z-index: 10; }

            /* HEADER */
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .logo { height: 100px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.1)); }
            .contract-title { text-align: right; }
            .contract-title h1 { font-family: 'Playfair Display', serif; font-size: 32px; margin: 0; color: #1a1a1a; letter-spacing: 1px; }
            .contract-title p { margin: 5px 0; font-weight: 800; color: #ffffff; font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }

            /* INFO CLIENTE */
            .client-section { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; margin-bottom: 30px; background: rgba(249, 250, 251, 0.8); padding: 20px; border-radius: 4px; border-left: 5px solid #d4af37; }
            .info-box div { margin-bottom: 8px; font-size: 12px; }
            .info-box strong { color: #1f2937; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; display: inline-block; width: 110px; }

            /* TABLA */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            thead th { background: #1f2937; color: white; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            
            /* TOTALES */
            .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 30px; }
            .total-table { width: 280px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px; font-size: 12px; border-bottom: 1px solid #eee; }
            .total-row.final { background: #d4af37; color: white; font-weight: 800; font-size: 18px; border-radius: 4px; margin-top: 5px; }

            /* FIRMAS */
            .signature-section { display: flex; justify-content: space-around; margin-top: 80px; }
            .sig-block { width: 250px; border-top: 2px solid #1a1a1a; text-align: center; padding-top: 10px; }
            .sig-block p { margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; }

            /* PÁGINA 2 */
            .page-break { page-break-before: always; }
            .terms-header { text-align: center; margin-bottom: 40px; }
            .terms-header h2 { font-family: 'Playfair Display', serif; font-size: 24px; border-bottom: 2px solid #d4af37; display: inline-block; padding-bottom: 10px; }
            .terms-body { font-size: 11.5px; line-height: 1.8; text-align: justify; color: #444; padding: 0 20px; }
            .terms-body h4 { color: #b8860b; margin-bottom: 5px; text-transform: uppercase; }

            .warranty-stamp { margin-top: 50px; border: 3px double #d4af37; padding: 20px; text-align: center; font-weight: 800; background: #fffcf0; }

            @media print {
                body { -webkit-print-color-adjust: exact; }
                .page { margin: 0; border: none; }
            }
        </style>
    </head>
    <body>
        <div class="page">
            <div class="corner-top"></div>
            <div class="corner-top-inner"></div>
            
            <div class="content">
           <div class="header">
                    <img src="imagenes/Logo3.png" class="logo">
                    <div class="contract-title">
                        <h1>${typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.empresa : 'INNOVA MOBILI'}</h1>
                        <p>RUC: ${typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.ruc : '---'}</p>
                        <div style="margin-top: 5px; font-size: 18px; font-weight: 900; color: #1a1a1a; font-family: 'Plus Jakarta Sans', sans-serif;">N° ${nroContrato}</div>
                    </div>
                </div>
        </div>
                <div class="client-section">
                    <div class="info-box">
                        <div><strong>Cliente:</strong> ${nombreCliente}</div>
                        <div><strong>DNI / RUC:</strong> ${dniCliente}</div>
                        <div><strong>Dirección:</strong> ${direccionEntrega}</div>
                    </div>
                    <div class="info-box">
                        <div><strong>Emisión:</strong> ${fechaEmision}</div>
                        <div><strong>Entrega:</strong> <span style="background-color: #fef08a; color: #1a1a1a; font-weight: 900; padding: 2px 6px; border-radius: 3px;">${fechaEntrega}</span></div>
                        <div><strong>Celular:</strong> ${celCliente}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th>Ficha Técnica del Mueble</th>
                            <th style="width:120px; text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasItems}
                    </tbody>
                </table>

                <div class="summary-wrapper">
                    <div class="total-table">
                        <div class="total-row"><span>Total Venta</span> <span>${totalVenta}</span></div>
                        <div class="total-row" style="color:#059669; font-weight: 800;"><span>Adelanto / Pagado</span> <span>${totalPagado}</span></div>
                        <div class="total-row final"><span>SALDO PEND.</span> <span>${saldoPendiente}</span></div>
                    </div>
                </div>

               <div class="signature-section">
                    <div class="sig-block">
                        <p>Firma del Cliente</p>
                        <span style="font-size:8px;">DNI: ${dniCliente}</span>
                    </div>
                    <div class="sig-block">
                        <p>Innova Mobili</p>
                        <span style="font-size:8px; display:block; margin-bottom: 5px;">Departamento Comercial</span>
                        <span style="font-size:10px; font-weight:800; color:#1f2937; background:#f1f5f9; padding:3px 8px; border-radius:4px;">
                            Atendido por: ${usuarioActivo ? usuarioActivo.nombre : 'Vendedor'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="corner-bottom"></div>
            <div class="corner-bottom-accent"></div>
        </div>

    
<div class="page page-break" style="position:relative; background:#fff; padding:14mm; min-height:297mm; box-sizing:border-box; overflow:hidden;">

    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.05; z-index:0; width:55%; pointer-events:none;">
        <img src="imagenes/Logo2.png" style="width:100%;">
    </div>

    <div class="content" style="position:relative; z-index:10;">

        <div style="text-align:center; margin-bottom:18px;">
            <h2 style="font-family:'Playfair Display', serif; font-size:18px; color:#1a1a1a; margin:0; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #d4af37; display:inline-block; padding-bottom:6px;">
                TÉRMINOS Y CONDICIONES DE VENTA
            </h2>
        </div>

        <div style="font-size:9pt; line-height:1.35; text-align:justify; color:#222; font-family:'Plus Jakarta Sans', sans-serif;">

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    1. DE LA ELABORACIÓN Y PEDIDOS PERSONALIZADOS
                </h4>
                <p style="margin:0 0 5px 0;">Todos nuestros productos son fabricados bajo pedido y personalizados según las especificaciones (medidas, colores, materiales y diseño) proporcionadas por el cliente.</p>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Aceptación de Diseño:</strong> Al firmar la orden de trabajo o realizar el abono inicial, el cliente declara su conformidad con las especificaciones técnicas detalladas, conforme al principio de autonomía de la voluntad establecido en el Código Civil peruano (art. 1354).</li>
                    <li style="margin-bottom:4px;"><strong>Cambios:</strong> Una vez iniciada la etapa de corte o fabricación, no se aceptarán modificaciones al diseño original. Cualquier cambio posterior generará un costo adicional y afectará la fecha de entrega.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Código Civil - arts. 1351, 1354 (formación y contenido del contrato).</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    2. POLÍTICA DE NO DEVOLUCIÓN DE DINERO
                </h4>
                <p style="margin:0 0 5px 0;">De conformidad con la naturaleza del producto (bienes confeccionados conforme a las especificaciones del consumidor), no se realizan devoluciones de dinero ni cambios de producto una vez aceptado el contrato y realizado el pago (total o parcial). La empresa garantiza la entrega de un producto funcional y conforme a lo pactado.</p>
                <p style="margin:0;"><small><strong>Base legal:</strong> Código Civil - art. 1361 (obligatoriedad del contrato).</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    3. PRECIOS Y PROMOCIONES
                </h4>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Canales de Venta:</strong> Los precios, descuentos y promociones publicados en redes sociales (Facebook, Instagram, WhatsApp, etc.) son exclusivos para compras por dichos medios y pueden variar respecto a los precios vigentes en tienda física.</li>
                    <li style="margin-bottom:4px;"><strong>Vigencia:</strong> Las promociones tienen una duración limitada y están sujetas a cambios sin previo aviso hasta que se formalice el pedido con el pago correspondiente.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 Código de Protección y Defensa del Consumidor arts. 14 y 18.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    4. VERIFICACIÓN E INSTALACIÓN
                </h4>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Responsabilidad del Cliente:</strong> Es deber del cliente asegurar que los accesos (puertas, ascensores, pasadizos) permitan el ingreso del mueble.</li>
                    <li style="margin-bottom:4px;"><strong>Inspección:</strong> Todo producto será verificado por el cliente previo a la cancelación total y antes de la instalación.</li>
                    <li style="margin-bottom:4px;"><strong>Conformidad:</strong> Al finalizar la instalación, el cliente deberá firmar un acta de conformidad. La empresa no se responsabiliza por daños estéticos reportados con posterioridad al retiro del personal técnico.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 - art. 19 y Código Civil - art. 1314.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    5. COMPROBANTES DE PAGO Y SUNAT
                </h4>
                <p style="margin:0 0 5px 0;">Según lo dispuesto por la SUNAT, la emisión de Nota de Crédito solo procede para anular operaciones que cumplan con los requisitos legales.</p>
                <ul style="margin:0; padding-left:18px;">
                    <li style="margin-bottom:4px;"><strong>Elección del Comprobante:</strong> El cliente debe decidir si requiere Boleta de Venta o Factura al momento de la compra. Una vez emitido el documento, no procede el cambio entre estos.</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> SUNAT - Reglamento de Comprobantes de Pago.</small></p>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    6. GARANTÍA
                </h4>
                <p style="margin:0 0 5px 0;">Todo producto cuenta con una garantía de 1 año contra defectos de fabricación o fallas estructurales. <strong>La garantía no cubre:</strong></p>
                <ul style="margin:0; padding-left:18px; columns:2;">
                    <li>Daños por mal uso</li>
                    <li>Exposición a humedad extrema</li>
                    <li>Uso de productos abrasivos</li>
                    <li>Manipulaciones por terceros</li>
                </ul>
                <p style="margin:5px 0 0 0;"><small><strong>Base legal:</strong> Ley N° 29571 - arts. 18, 19 y 20.</small></p>
            </div>

            <div style="margin-bottom:0;">
                <h4 style="color:#b8860b; margin:0 0 5px 0; text-transform:uppercase; font-size:10pt; border-left:3px solid #d4af37; padding-left:7px;">
                    7. DISPOSICIONES FINALES
                </h4>
                <p style="margin:0;">Cualquier situación no prevista en estos términos se regirá por la normativa vigente del ordenamiento jurídico peruano.</p>
                <div class="warranty-stamp">GARANTÍA: TODO PRODUCTO CUENTA CON 1 AÑO DE GARANTÍA ESTRUCTURAL</div>
            </div>
        </div>
    </div>
</div>
    </body>
    </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 500); };
}
// ==========================================
// MÓDULO DE TALLER: DETALLES E IMPRESIÓN
// ==========================================

async function abrirDetallePedido(codigo) {
    try {
        Swal.fire({ title: 'Buscando ficha de taller...', didOpen: () => Swal.showLoading() });
        const res = await fetch(`${API_URL}/api/pedido/detalle/${codigo}`);
        const data = await res.json();

        if(data.error) return Swal.fire('Error', data.error, 'error');

        let itemsHTML = data.items.map(item => `
            <div style="text-align:left; background:#f8fafc; padding:8px 12px; margin-bottom:5px; border-radius:5px; border-left: 3px solid #d4af37; font-size:12px; color: #1e293b;">
                <i class="fa-solid fa-couch"></i> <b>${item.producto}</b>
            </div>`).join('');

        Swal.fire({
            title: `Pedido #${data.codigo}`,
            html: `
                <div style="text-align: left; margin-bottom: 15px;">
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Cliente:</b> ${data.cliente}</p>
                    <p style="margin:0; font-size: 13px; color: #475569;"><b>Entrega:</b> <span style="background: #fef08a; padding: 2px 5px; color: #1a1a1a; font-weight: bold; border-radius: 3px;">${data.entrega}</span></p>
                </div>
                ${itemsHTML}
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-print"></i> IMPRIMIR ORDEN TALLER',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#0f172a'
        }).then((result) => {
            if (result.isConfirmed) {
                imprimirOrdenTaller(data);
            }
        });
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

function imprimirOrdenTaller(data) {
    let filasItems = '';
    data.items.forEach((item, index) => {
        // Leemos el HTML exacto de la BD
        let detalleHTML = item.detalles || "Especificaciones estándar de fabricación.";
        
        filasItems += `
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b; vertical-align: top;">${index + 1}</td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <div style="font-weight: 900; color: #0f172a; font-size: 14px; margin-bottom: 8px; text-transform: uppercase;">${item.producto}</div>
                    
                    <div style="background: #f8fafc; border-left: 3px solid #d4af37; padding: 10px; font-size: 11.5px; color: #334155; line-height: 1.6; border-radius: 0 4px 4px 0;">
                        ${detalleHTML}
                    </div>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #cbd5e1; vertical-align: top; width: 140px;">
                    <div style="border: 2px dashed #cbd5e1; height: 100%; min-height: 110px; border-radius: 5px; background: #fff; padding: 5px; font-size: 9px; color: #94a3b8; text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                        <span style="border-top: 1px solid #cbd5e1; padding-top: 5px; width: 80%; margin: 0 auto;">Firma Taller / CC</span>
                    </div>
                </td>
            </tr>`;
    });

    const nomEmpresa = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.empresa : 'INNOVA MOBILI';
    const rucEmpresa = typeof usuarioActivo !== 'undefined' && usuarioActivo ? usuarioActivo.ruc : '---';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Orden Taller #${data.codigo}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@300;400;600;800;900&display=swap');
            
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #333; margin: 0; padding: 0; background-color: #fff; }
            .page { width: 210mm; min-height: 297mm; padding: 15mm; margin: auto; position: relative; box-sizing: border-box; overflow: hidden; }
            
            /* DECORACIÓN GEOMÉTRICA (Estilo Carey) */
            .corner-top { position: absolute; top: -50px; right: -50px; width: 250px; height: 250px; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); transform: rotate(45deg); z-index: 0; opacity: 0.9; }
            .corner-top-inner { position: absolute; top: 0; right: 80px; width: 100px; height: 300px; background: #e5e7eb; transform: rotate(45deg); z-index: -1; }
            .corner-bottom { position: absolute; bottom: -80px; left: -80px; width: 280px; height: 280px; background: #1f2937; transform: rotate(45deg); z-index: 0; }
            .corner-bottom-accent { position: absolute; bottom: 40px; left: 80px; width: 40px; height: 200px; background: #d4af37; transform: rotate(45deg); z-index: -1; }

            .content { position: relative; z-index: 10; }

            /* HEADER */
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .logo { height: 100px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.1)); }
            .contract-title { text-align: right; position: relative; z-index: 20; }
            .contract-title h1 { font-family: 'Playfair Display', serif; font-size: 30px; margin: 0; color: #1a1a1a; letter-spacing: 1px; }
            .contract-title p { margin: 5px 0 0 0; font-weight: 800; color: #ffffff; font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }

            /* INFO CLIENTE */
            .client-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; background: rgba(249, 250, 251, 0.8); padding: 20px; border-radius: 4px; border-left: 5px solid #0f172a; }
            .info-box div { margin-bottom: 8px; font-size: 13px; }
            .info-box strong { color: #1f2937; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; display: inline-block; width: 110px; }

            /* TABLA */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            thead th { background: #1f2937; color: white; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
            
            .warning-box { border: 2px dashed #b8860b; padding: 15px; text-align: center; margin-top: 40px; font-size: 11px; font-weight: 800; background: #fffcf0; color: #1a1a1a; text-transform: uppercase; border-radius: 6px; }

            /* FIRMAS */
            .signature-section { display: flex; justify-content: space-around; margin-top: 80px; }
            .sig-block { width: 250px; border-top: 2px solid #1a1a1a; text-align: center; padding-top: 10px; }
            .sig-block p { margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; }

            @media print {
                body { -webkit-print-color-adjust: exact; }
                .page { margin: 0; border: none; }
            }
        </style>
    </head>
    <body>
        <div class="page">
            <div class="corner-top"></div>
            <div class="corner-top-inner"></div>
            
            <div class="content">
                <div class="header">
                    <img src="imagenes/Logo3.png" class="logo">
                    <div class="contract-title">
                        <h1>ORDEN DE PRODUCCIÓN</h1>
                        
                        <div style="margin-top: 5px; font-size: 18pxpx; font-weight: 900; color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif;">N° ${data.codigo}</div>
                    </div>
                </div>

                <div class="client-section">
                    <div class="info-box">
                        <div><strong>Cliente:</strong> ${data.cliente.toUpperCase()}</div>
                        <div><strong>Emisión:</strong> ${new Date().toLocaleDateString('es-PE')}</div>
                    </div>
                    <div class="info-box">
                        <div style="font-size: 16px; margin-top: 5px;">
                            <strong>ENTREGA:</strong> 
                            <span style="background-color: #fef08a; color: #1a1a1a; font-weight: 900; padding: 3px 8px; border-radius: 4px; border: 1px solid #eab308;">${data.entrega}</span>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">#</th>
                            <th>Despiece Técnico y Tapicería</th>
                            <th style="width:140px; text-align:center;">Control Calidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasItems}
                    </tbody>
                </table>

                <div class="warning-box">
                    <i class="fa-solid fa-triangle-exclamation"></i> DOCUMENTO EXCLUSIVO DE TALLER. RESPETAR MEDIDAS Y ESPECIFICACIONES AL MILÍMETRO.<br>
                    CUALQUIER MODIFICACIÓN DEBE SER CONSULTADA CON EL VENDEDOR O ÁREA COMERCIAL ANTES DEL CORTE.
                </div>

               <div class="signature-section">
                    <div class="sig-block">
                        <p>Jefe de Taller / Producción</p>
                    </div>
                    <div class="sig-block">
                        <p>Sello de Salida (Despacho)</p>
                    </div>
                </div>
            </div>
            
            <div class="corner-bottom"></div>
            <div class="corner-bottom-accent"></div>
        </div>
    </body>
    </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 500); };
}
/* ── HELPER: Botón de acción correcto según rol, estado y área ── */
function renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin) {

    // ── ADMIN: solo ve botón para ASIGNAR, nunca para terminar ──
    if (esAdmin) {
        if (t.area === 'DESPACHO_CENTRAL') {
            if (isBloqueado) {
                return `<button disabled style="width:100%; background:#e2e8f0; color:#94a3b8; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:not-allowed;">
                            <i class="fa-solid fa-lock"></i> Esperando que terminen las demás áreas
                        </button>`;
            }
            if (isTerminado) {
                return `<div style="background:#dcfce7; color:#166534; padding:10px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                            <i class="fa-solid fa-circle-check"></i> DESPACHADO
                        </div>`;
            }
            if (isEnProceso) {
                return `<div style="background:#dbeafe; color:#1e40af; padding:10px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                            <i class="fa-solid fa-truck"></i> En ruta — Chofer: ${t.trabajador_nombre}
                        </div>`;
            }
            // Pendiente desbloqueado → admin puede asignar chofer
            return `<button onclick="asignarChoferDespacho(${t.id})"
                        style="width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-truck"></i> Asignar Chofer y Despachar
                    </button>`;
        }

        // Áreas normales: admin asigna maestro
        // Para tapicería bloqueada: admin puede asignar de antemano (ticket sigue Bloqueado)
        if (isBloqueado) {
            const areaTap = t.area === 'TAPICERIA_SOFAS' || t.area === 'TAPICERIA_SILLAS' || t.area === 'ARMADO_COJINES';
            if (areaTap) {
                const trabajadorInfo = t.trabajador
                    ? `<div style="background:#f0fdf4; color:#166534; padding:6px; border-radius:6px; text-align:center; font-size:10px; margin-bottom:6px;"><i class="fa-solid fa-user-check"></i> Pre-asignado: <b>${t.trabajador_nombre}</b></div>`
                    : '';
                return `${trabajadorInfo}
                    <button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                        style="width:100%; background:#94a3b8; color:white; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-user-clock"></i> ${t.trabajador ? 'Reasignar' : 'Pre-asignar'} Tapicero
                    </button>
                    <p style="font-size:9px; color:#94a3b8; text-align:center; margin:4px 0 0 0;">Esperando: estructuras + telas</p>`;
            }
            return `<div style="background:#e2e8f0; color:#64748b; padding:8px; border-radius:8px; text-align:center; font-size:11px;">
                        <i class="fa-solid fa-lock"></i> Bloqueado — prerrequisitos pendientes
                    </div>`;
        }
        if (isTerminado) {
            return `<div style="background:#dcfce7; color:#166534; padding:8px; border-radius:8px; text-align:center; font-size:11px; font-weight:bold;">
                        <i class="fa-solid fa-circle-check"></i> COMPLETADO
                    </div>`;
        }
        if (t.trabajador) {
            // Ya tiene asignado — mostrar nombre + botón para reasignar si es necesario
            const nombreSafe = (t.trabajador_nombre || 'Asignado').replace(/'/g, "\\'");
            return `<div style="background:#f0fdf4; color:#166534; padding:8px; border-radius:8px; text-align:center; font-size:11px; margin-bottom:6px;">
                        <i class="fa-solid fa-user-check"></i> <b>${t.trabajador_nombre || 'Asignado'}</b>
                    </div>
                    <button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                        style="width:100%; background:#e2e8f0; color:#475569; border:none; padding:7px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-arrows-rotate"></i> Reasignar
                    </button>`;
        }
        // Sin asignar → botón de asignación
        return `<button onclick="asignarTrabajador(${t.id}, '${t.area}')"
                    style="width:100%; background:#558fc5; color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">
                    <i class="fa-solid fa-user-plus"></i> Asignar Maestro
                </button>`;
    }

    // ── OPERARIO / JEFE (no admin) ──
    if (isBloqueado) {
        return `<button disabled style="width:100%; background:#e2e8f0; color:#94a3b8; border:none; padding:8px; border-radius:6px; font-size:12px; font-weight:bold; cursor:not-allowed;">
                    <i class="fa-solid fa-hourglass-half"></i> Esperando áreas previas
                </button>`;
    }

    if (isTerminado) {
        return `<div style="text-align:center; padding:10px; background:#dcfce7; color:#166534; border-radius:8px; font-size:11px; font-weight:bold;">
                    <i class="fa-solid fa-circle-check"></i> TRABAJO COMPLETADO
                </div>`;
    }

    if (isEnProceso) {
        // Despacho en proceso: chofer confirma entrega
        if (t.area === 'DESPACHO_CENTRAL') {
            return `<div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
                        <p style="font-size:11px; font-weight:bold; color:#475569; margin:0 0 10px 0; text-align:center;">
                            <i class="fa-solid fa-truck"></i> Chofer: <b>${t.trabajador_nombre}</b>
                        </p>
                        <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:5px;">📷 FOTO DE ENTREGA AL CLIENTE:</label>
                        <input type="file" id="foto-evid-${t.id}" accept="image/*" capture="environment" style="font-size:10px; width:100%; margin-bottom:8px;">
                        <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
                            style="width:100%; background:#22c55e; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-check-double"></i> CONFIRMAR ENTREGA
                        </button>
                    </div>`;
        }

        // Área de Telas: botón especial "Derivar material" (pase de posta)
        const esAreaTelas = t.area === 'CORTE_Y_CONTROL_TELAS' || t.area === 'TELAS';
        const usuarioEsTelas = usuarioActivo.area_asignada === 'CORTE_Y_CONTROL_TELAS' || usuarioActivo.area_asignada === 'TELAS';
        if (esAreaTelas && usuarioEsTelas) {
            // data-specs en base64 para que abrirModalDerivar detecte si hay cojines
            const specsB64Derivar = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
            return `<button onclick="abrirModalDerivar(${t.id})"
                        data-ticket-id="${t.id}"
                        data-specs="${specsB64Derivar}"
                        style="width:100%; background:#f97316; color:white; border:none; padding:10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; margin-top:4px;">
                        ✂️ Subir Foto y Derivar Material
                    </button>`;
        }

        // Cualquier otra área en proceso: evidencia + finalizar
        return `<div style="margin-top:10px; padding:10px; background:#f1f5f9; border-radius:8px; border:1px solid #cbd5e1;">
                    <label style="font-size:9px; font-weight:900; color:#475569; display:block; margin-bottom:5px;">📷 FOTO DE TRABAJO TERMINADO:</label>
                    <input type="file" id="foto-evid-${t.id}" accept="image/*" capture="environment" style="font-size:10px; width:100%; margin-bottom:8px;">
                    <button onclick="finalizarTicketTaller(${t.id}, document.getElementById('foto-evid-${t.id}'), '${t.area}', '${t.producto}')"
                        style="width:100%; background:#22c55e; color:white; border:none; padding:8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-check-double"></i> MARCAR COMO TERMINADO
                    </button>
                </div>`;
    }

    // Pendiente — vista del operario que aún no inicia
    return `<p style="font-size:11px; color:#f59e0b; text-align:center; font-weight:bold; margin:8px 0 0 0;">
                <i class="fa-solid fa-clock"></i> Asignado — esperando que inicies
            </p>`;
}

/* ================================================================= */
/* --- KANBAN DE PRODUCCIÓN — LÓGICA UNIFICADA POR ROL           --- */
/* ================================================================= */

const CONFIG_AREAS = {
    'ESTRUCTURAS_MUEBLES':    { icono: '<i class="fa-solid fa-tree"></i>',            nombre: 'Carpintería (Sofás)' },
    'ESTRUCTURAS_SILLAS':     { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Carpintería (Sillas)' },
    'CORTE_Y_CONTROL_TELAS':  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura (Telas)' },
    'TELAS':                  { icono: '<i class="fa-solid fa-scissors"></i>',        nombre: 'Corte y Costura' },
    'PREPARACION_PATAS_ZOCALO':{ icono: '<i class="fa-solid fa-shoe-prints"></i>',   nombre: 'Patas y Zócalos' },
    'TABLEROS_Y_PIEDRAS':     { icono: '<i class="fa-solid fa-table-cells-large"></i>',nombre: 'Tableros (Comedor)' },
    'TAPICERIA_SOFAS':        { icono: '<i class="fa-solid fa-couch"></i>',           nombre: 'Tapicería (Sofás)' },
    'TAPICERIA_SILLAS':       { icono: '<i class="fa-solid fa-chair"></i>',           nombre: 'Tapicería (Sillas)' },
    'ARMADO_COJINES':         { icono: '<i class="fa-solid fa-layer-group"></i>',     nombre: 'Armado de Cojines' },
    'DESPACHO_CENTRAL':       { icono: '<i class="fa-solid fa-truck"></i>',           nombre: 'Despacho Central' },
};

/* ================================================================= */
/* --- VISTA COLA DE RECOJO CON PDF                              --- */
/* ================================================================= */

async function cargarVistaColaRecojo(contenedor) {
    try {
        const res  = await fetch(`${API_URL}/api/taller/cola-recojo`);
        const cola = await res.json();

        if (!Array.isArray(cola) || cola.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#22c55e; display:block; margin-bottom:15px;"></i>
                    <p style="font-weight:800; font-size:16px; color:#475569;">Sin recojos pendientes</p>
                    <p style="font-size:13px;">Todas las estructuras terminadas ya fueron recogidas o no hay tapicería esperando.</p>
                </div>`;
            return;
        }

        // Botón PDF masivo
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="margin:0; color:#c2410c; font-size:15px; font-weight:900;">
                        <i class="fa-solid fa-truck-fast"></i> ${cola.length} estructura${cola.length>1?'s':''} lista${cola.length>1?'s':''} para recoger
                    </h3>
                    <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Descarga el PDF de cada item o genera una hoja de recojo masiva</p>
                </div>
                <button onclick="imprimirPDFRecojoMasivo()" 
                    style="background:#c2410c; color:white; border:none; padding:12px 20px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-file-pdf"></i> PDF MASIVO (${cola.length} items)
                </button>
            </div>
            <div style="display:flex; flex-direction:column; gap:15px;">`;

        cola.forEach((c, idx) => {
            const fotoEstructura = c.foto_url && !c.foto_url.includes('sin_foto') ? c.foto_url : null;
            const fotoEvidencia  = c.foto_evidencia || null;

            html += `
            <div style="background:white; border-radius:14px; border:1px solid #fed7aa; box-shadow:0 4px 12px rgba(249,115,22,0.08); overflow:hidden;">
                <!-- Cabecera naranja -->
                <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5); padding:14px 18px; border-bottom:2px solid #fed7aa; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span style="font-size:10px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:1px;">${c.area.replace(/_/g,' ')} · Terminado el ${c.fecha_fin}</span>
                        <h4 style="margin:4px 0 2px 0; font-size:15px; font-weight:900; color:#0f172a;">${c.producto}</h4>
                        <p style="margin:0; font-size:12px; color:#64748b;">
                            <b>Ref:</b> ${c.codigo_venta} &nbsp;|&nbsp; <b>Cliente:</b> ${c.cliente}
                            ${c.direccion ? `&nbsp;|&nbsp; <b>Entrega:</b> ${c.fecha_entrega}` : ''}
                        </p>
                        <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">
                            <i class="fa-solid fa-user-gear"></i> <b>Carpintero:</b> ${c.operario} &nbsp;
                            <i class="fa-solid fa-couch"></i> <b>Tapicero:</b> <span style="color:#0369a1; font-weight:bold;">${c.tapicero}</span>
                        </p>
                    </div>
                    <button onclick="imprimirPDFRecojoUnitario(${idx})" 
                        data-recojo-idx="${idx}"
                        style="background:#f97316; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                        <i class="fa-solid fa-file-pdf"></i> PDF Unitario
                    </button>
                </div>
                <!-- Cuerpo con fotos -->
                <div style="padding:15px 18px; display:flex; gap:15px; flex-wrap:wrap; align-items:flex-start;">
                    ${fotoEstructura ? `
                    <div style="text-align:center;">
                        <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Foto del Mueble</span>
                        <img src="${fotoEstructura}" alt="Mueble"
                            style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0;"
                            onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    ${fotoEvidencia ? `
                    <div style="text-align:center;">
                        <span style="font-size:9px; font-weight:900; color:#64748b; display:block; margin-bottom:4px; text-transform:uppercase;">Evidencia Terminado</span>
                        <img src="${fotoEvidencia}" alt="Evidencia"
                            style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #22c55e;"
                            onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    ${c.especificaciones ? `
                    <div style="flex:1; min-width:180px; background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #f97316;">
                        <span style="font-size:9px; font-weight:900; color:#f97316; display:block; margin-bottom:6px; text-transform:uppercase;">Especificaciones</span>
                        <div style="font-size:11px; color:#374151; line-height:1.5;">${c.especificaciones.replace(/\n/g,'<br>')}</div>
                    </div>` : ''}
                </div>
            </div>`;
        });

        html += `</div>`;
        contenedor.innerHTML = html;

        // Guardar los datos en window para que los PDF los lean
        window._colaRecojoData = cola;

    } catch(e) {
        console.error('Error cargando cola de recojo:', e);
        contenedor.innerHTML = `<p style="color:red; text-align:center;">Error al cargar la cola de recojo.</p>`;
    }
}

/* --- PDF UNITARIO DE RECOJO --- */
function imprimirPDFRecojoUnitario(idx) {
    const cola = window._colaRecojoData;
    if (!cola || !cola[idx]) return;
    const c = cola[idx];
    abrirVentanaPDFRecojo([c], `HOJA DE RECOJO — ${c.codigo_venta}`);
}

/* --- PDF MASIVO DE RECOJO --- */
function imprimirPDFRecojoMasivo() {
    const cola = window._colaRecojoData;
    if (!cola || cola.length === 0) return Swal.fire('Sin datos', 'No hay items en la cola.', 'info');
    abrirVentanaPDFRecojo(cola, `HOJA DE RECOJO MASIVO — ${cola.length} Estructuras`);
}

/* --- GENERADOR DE PDF DE RECOJO (unitario y masivo comparten el mismo motor) --- */
function abrirVentanaPDFRecojo(items, titulo) {
    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });

    const filas = items.map((c, i) => `
        <div class="recojo-item ${i > 0 ? 'page-break' : ''}">
            <!-- Encabezado del item -->
            <div class="item-header">
                <div class="item-numero">ITEM ${String(i+1).padStart(2,'0')}</div>
                <div class="item-info">
                    <div class="item-titulo">${c.producto}</div>
                    <div class="item-meta">
                        <span><b>Ref:</b> ${c.codigo_venta}</span>
                        <span><b>Cliente:</b> ${c.cliente.toUpperCase()}</span>
                        <span><b>Entrega:</b> ${c.fecha_entrega || 'S/F'}</span>
                    </div>
                    <div class="item-meta" style="margin-top:4px;">
                        <span><b>Área terminada:</b> ${c.area.replace(/_/g,' ')}</span>
                        <span><b>Terminado el:</b> ${c.fecha_fin}</span>
                    </div>
                </div>
                <div class="item-badge">PARA RECOGER</div>
            </div>

            <!-- Cuerpo: fotos + specs + operarios -->
            <div class="item-body">
                <!-- Columna de fotos -->
                <div class="fotos-col">
                    ${c.foto_url && !c.foto_url.includes('sin_foto') ? `
                    <div class="foto-box">
                        <div class="foto-label">Foto del Mueble</div>
                        <img src="${c.foto_url}" class="foto-img" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    ${c.foto_evidencia ? `
                    <div class="foto-box">
                        <div class="foto-label">Evidencia Terminado</div>
                        <img src="${c.foto_evidencia}" class="foto-img evidencia" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                </div>

                <!-- Columna de datos -->
                <div class="datos-col">
                    <table class="datos-tabla">
                        <tr><th>Carpintero / Operario</th><td>${c.operario}</td></tr>
                        <tr><th>Tapicero Asignado</th><td style="color:#0369a1; font-weight:bold;">${c.tapicero}</td></tr>
                        ${c.direccion ? `<tr><th>Dirección Entrega</th><td>${c.direccion}</td></tr>` : ''}
                        ${c.especificaciones ? `<tr><th>Especificaciones</th><td class="specs">${c.especificaciones.replace(/\n/g,'<br>').replace(/<b>/g,'<b>').replace(/<\/b>/g,'</b>')}</td></tr>` : ''}
                    </table>
                </div>
            </div>

            <!-- Firmas -->
            <div class="firmas">
                <div class="firma-box"><div class="firma-linea"></div><p>Carpintero / Entrega</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Chofer / Transporte</p></div>
                <div class="firma-box"><div class="firma-linea"></div><p>Tapicero / Recepción</p></div>
            </div>
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: white; font-size: 12px; }

    /* --- Encabezado de empresa --- */
    .empresa-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px 24px; border-bottom: 3px solid #f97316;
        margin-bottom: 20px;
    }
    .empresa-logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
    .empresa-logo span { color: #0f172a; }
    .empresa-doc { text-align: right; }
    .empresa-doc h2 { font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .empresa-doc p { font-size: 10px; color: #64748b; }
    .empresa-doc .badge-doc {
        background: #f97316; color: white; font-size: 10px; font-weight: 900;
        padding: 3px 10px; border-radius: 20px; display: inline-block; margin-bottom: 4px;
    }

    /* --- Item de recojo --- */
    .recojo-item { margin-bottom: 30px; }
    .page-break { page-break-before: always; padding-top: 20px; }

    .item-header {
        display: flex; align-items: flex-start; gap: 12px;
        background: linear-gradient(135deg, #fff7ed, #ffedd5);
        border: 2px solid #f97316; border-radius: 10px 10px 0 0;
        padding: 12px 16px;
    }
    .item-numero {
        background: #f97316; color: white; font-size: 11px; font-weight: 900;
        padding: 6px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }
    .item-info { flex: 1; }
    .item-titulo { font-size: 16px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .item-meta { display: flex; gap: 16px; font-size: 11px; color: #374151; flex-wrap: wrap; }
    .item-meta span b { color: #f97316; }
    .item-badge {
        background: #dc2626; color: white; font-size: 10px; font-weight: 900;
        padding: 5px 10px; border-radius: 6px; white-space: nowrap; align-self: flex-start;
    }

    .item-body {
        display: flex; gap: 0; border: 2px solid #f97316; border-top: none; border-radius: 0 0 0 0;
        min-height: 160px;
    }
    .fotos-col {
        display: flex; flex-direction: column; gap: 0;
        border-right: 1px solid #fed7aa; min-width: 140px; max-width: 180px;
    }
    .foto-box { padding: 10px; border-bottom: 1px solid #fed7aa; }
    .foto-box:last-child { border-bottom: none; }
    .foto-label { font-size: 9px; font-weight: 900; color: #f97316; text-transform: uppercase; margin-bottom: 5px; }
    .foto-img { width: 120px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; display: block; }
    .foto-img.evidencia { border-color: #22c55e; }

    .datos-col { flex: 1; padding: 12px; }
    .datos-tabla { width: 100%; border-collapse: collapse; }
    .datos-tabla th {
        text-align: left; font-size: 10px; font-weight: 900; color: #64748b;
        text-transform: uppercase; padding: 7px 8px; background: #f8fafc;
        border-bottom: 1px solid #e2e8f0; white-space: nowrap; width: 140px;
    }
    .datos-tabla td {
        font-size: 12px; padding: 7px 8px; border-bottom: 1px solid #f1f5f9;
        color: #1e293b; vertical-align: top;
    }
    .datos-tabla td.specs { font-size: 11px; line-height: 1.6; color: #374151; }

    /* Firmas */
    .firmas {
        display: flex; gap: 0;
        border: 2px solid #f97316; border-top: 1px solid #fed7aa;
        border-radius: 0 0 10px 10px; overflow: hidden;
    }
    .firma-box {
        flex: 1; padding: 14px 16px; text-align: center;
        border-right: 1px solid #fed7aa;
    }
    .firma-box:last-child { border-right: none; }
    .firma-linea { border-bottom: 1.5px solid #0f172a; margin-bottom: 6px; height: 30px; }
    .firma-box p { font-size: 10px; color: #64748b; font-weight: 700; }

    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none; }
    }
</style>
</head>
<body>

<div class="empresa-header">
    <div>
        <div class="empresa-logo">INNOVA <span>MOBILI</span></div>
        <p style="font-size:10px; color:#64748b; margin-top:3px;">Sistema de Producción y Despacho</p>
    </div>
    <div class="empresa-doc">
        <div class="badge-doc"><i>🚛</i> HOJA DE RECOJO</div>
        <h2>${titulo}</h2>
        <p>Fecha de emisión: ${fecha}</p>
        <p style="margin-top:2px; font-weight:bold; color:#f97316;">${items.length} ESTRUCTURA${items.length>1?'S':''} A RECOGER</p>
    </div>
</div>

${filas}

<div style="text-align:center; margin-top:20px; padding:10px; font-size:10px; color:#94a3b8; border-top:1px dashed #e2e8f0;">
    Documento generado por INNOVA MOBILI ERP · ${fecha}
</div>

<script>
    window.onload = function() {
        // Esperar que carguen las imágenes antes de imprimir
        const imgs = document.images;
        let loaded = 0;
        const total = imgs.length;
        if (total === 0) { setTimeout(() => window.print(), 300); return; }
        for (let i = 0; i < total; i++) {
            if (imgs[i].complete) {
                loaded++;
                if (loaded === total) { setTimeout(() => window.print(), 400); }
            } else {
                imgs[i].onload = imgs[i].onerror = function() {
                    loaded++;
                    if (loaded === total) { setTimeout(() => window.print(), 400); }
                };
            }
        }
    };
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return Swal.fire('Bloqueado', 'Permite ventanas emergentes en tu navegador para generar el PDF.', 'warning');
    win.document.write(html);
    win.document.close();
}

async function cargarTicketsTaller() {
    const contenedor = document.getElementById('contenedor-tickets-taller');
    if (!contenedor || !usuarioActivo) return;

    const esAdmin      = ['Admin', 'Jefe_Taller', 'JEFE_TALLER'].includes(usuarioActivo.rol);
    const esOperario   = usuarioActivo.rol === 'Operario';

    // ── TABS: solo para Operario y Jefe viendo sus tareas ──
    let tabsHeader = document.getElementById('tabs-taller-header');
    if (!tabsHeader) {
        tabsHeader = document.createElement('div');
        tabsHeader.id = 'tabs-taller-header';
        tabsHeader.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;';
        contenedor.parentNode.insertBefore(tabsHeader, contenedor);
    }

    if (esAdmin) {
        tabsHeader.innerHTML = `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                <button onclick="filtroAdminTaller='pendientes'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? '#0f172a' : '#e2e8f0'};
                    color:${(typeof filtroAdminTaller==='undefined'||filtroAdminTaller==='pendientes') ? 'white' : '#475569'};">
                    <i class="fa-solid fa-user-plus"></i> PENDIENTES DE ASIGNAR
                </button>
                <button onclick="filtroAdminTaller='recojo'; cargarTicketsTaller()"
                    style="flex:1; min-width:140px; padding:12px 16px; border-radius:10px; border:none; font-size:12px; font-weight:800; cursor:pointer;
                    background:${filtroAdminTaller==='recojo' ? '#c2410c' : '#fff7ed'};
                    color:${filtroAdminTaller==='recojo' ? 'white' : '#c2410c'};
                    border:2px solid #f97316;">
                    <i class="fa-solid fa-truck-fast"></i> COLA DE RECOJO
                </button>
                <button onclick="cargarTicketsTaller()"
                    style="padding:10px 16px; border-radius:10px; border:none; font-size:11px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#475569;">
                    <i class="fa-solid fa-rotate"></i> Actualizar
                </button>
            </div>`;

        // Si está en vista RECOJO, mostrar esa sección y salir
        if (filtroAdminTaller === 'recojo') {
            contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Cargando cola de recojo...</p>';
            await cargarVistaColaRecojo(contenedor);
            return;
        }
    } else {
        // Operario / Jefe de área: tabs Pendientes / Terminados
        tabsHeader.innerHTML = `
            <button onclick="filtroTaller='Pendientes'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Pendientes' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-clock"></i> MIS TAREAS
            </button>
            <button onclick="filtroTaller='Terminado'; cargarTicketsTaller()" class="btn-filter-taller ${filtroTaller === 'Terminado' ? 'active' : ''}" style="flex:1;">
                <i class="fa-solid fa-circle-check"></i> TRABAJOS TERMINADOS
            </button>`;
    }

    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; padding:20px;">Sincronizando...</p>';

    try {
        // Traer todos los tickets (el backend filtra por area si es operario vía query param)
        const url = esOperario
            ? `${API_URL}/api/taller/tickets?area=${encodeURIComponent(usuarioActivo.area_asignada)}`
            : `${API_URL}/api/taller/tickets`;

        const res     = await fetch(url);
        const tickets = await res.json();

        if (!Array.isArray(tickets)) {
            contenedor.innerHTML = `<p style="color:red; text-align:center;">Error: ${tickets.error || 'Respuesta inválida del servidor'}</p>`;
            return;
        }

        let ticketsFiltrados = tickets;

        if (esAdmin) {
            // Admin ve:
            // 1. Tickets SIN asignar (Pendiente sin trabajador) → para asignar
            // 2. Tickets ya asignados pero no terminados → para reasignar si es necesario
            // 3. DESPACHO_CENTRAL siempre → gestión de choferes
            ticketsFiltrados = tickets.filter(t =>
                t.estado !== 'Terminado' ||
                t.area === 'DESPACHO_CENTRAL'
            );
        } else if (esOperario) {
            // Operario: solo los asignados a él
            ticketsFiltrados = tickets.filter(t => Number(t.trabajador) === Number(usuarioActivo.id));
            // Luego aplica filtro de tab
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado !== 'Terminado');
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Terminado');
            }
        } else {
            // Jefe de taller: ve todos, con tabs
            if (filtroTaller === 'Pendientes') {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado !== 'Terminado');
            } else {
                ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Terminado');
            }
        }

        if (ticketsFiltrados.length === 0) {
            const msg = esAdmin
                ? '✅ Todos los tickets están asignados. No hay tareas pendientes de asignar.'
                : `No hay trabajos en esta pestaña.`;
            contenedor.innerHTML = `<p style="color:gray; font-size:13px; text-align:center; padding:30px;">${msg}</p>`;
            return;
        }

        // Agrupar por área
        const areas = {};
        ticketsFiltrados.forEach(t => {
            const key = t.area || 'Sin Área';
            if (!areas[key]) areas[key] = [];
            areas[key].push(t);
        });

        contenedor.style.gridTemplateColumns = '1fr';
        let html = '';

        for (const [areaId, listaTickets] of Object.entries(areas)) {
            const cfg = CONFIG_AREAS[areaId] || { icono: '<i class="fa-solid fa-gears"></i>', nombre: areaId };

            // Color de cabecera del área según si todos están terminados
            const todosTerminados = listaTickets.every(t => t.estado === 'Terminado');
            const algunoEnProceso = listaTickets.some(t => t.estado === 'En Proceso');
            let colorCab = todosTerminados ? '#22c55e' : (algunoEnProceso ? '#3b82f6' : '#cbd5e1');

            html += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:25px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; color:#0f172a; font-size:15px; border-bottom:3px solid ${colorCab}; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:${colorCab === '#22c55e' ? '#166534' : '#0f172a'};">${cfg.icono} ${cfg.nombre}</span>
                    <span style="background:#1e293b; color:white; padding:3px 10px; border-radius:20px; font-size:11px;">${listaTickets.length}</span>
                </h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:15px;">`;

            listaTickets.forEach(t => {
                const isBloqueado = t.estado === 'Bloqueado';
                const isTerminado = t.estado === 'Terminado';
                const isEnProceso = t.estado === 'En Proceso';
                const isPendiente = t.estado === 'Pendiente';

                const specsB64   = btoa(unescape(encodeURIComponent(t.especificaciones || '')));
                let colorBorde   = isBloqueado ? '#94a3b8' : (isTerminado ? '#22c55e' : (isEnProceso ? '#3b82f6' : '#f59e0b'));
                let bgCard       = isBloqueado ? '#f1f5f9' : '#ffffff';
                let opacidad     = isBloqueado ? '0.55' : '1';

                let badgeBg  = isBloqueado ? '#e2e8f0' : (isTerminado ? '#dcfce7' : (isEnProceso ? '#dbeafe' : '#fef3c7'));
                let badgeCol = isBloqueado ? '#64748b' : (isTerminado ? '#166534' : (isEnProceso ? '#1e40af' : '#b45309'));
                let badgeTxt = isBloqueado ? '🔒 BLOQUEADO' : (isTerminado ? '✅ TERMINADO' : (isEnProceso ? '🔵 EN PROCESO' : '🟡 PENDIENTE'));

                // Asignado a quién
                const asignadoA = t.trabajador_nombre && t.trabajador_nombre !== 'Sin asignar'
                    ? `<p style="font-size:10px; color:#64748b; margin:4px 0 12px 0;"><i class="fa-solid fa-user"></i> ${t.trabajador_nombre}</p>`
                    : `<p style="font-size:10px; color:#f59e0b; margin:4px 0 12px 0;"><i class="fa-solid fa-user-clock"></i> Sin asignar</p>`;

                // Escapar producto para evitar romper HTML con comillas/apóstrofes
                const productoSafe = (t.producto || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                const fotoBtoa    = (t.foto||'').replace(/"/g,'&quot;');

                html += `
                <div style="background:${bgCard}; border-left:5px solid ${colorBorde}; border-radius:8px; padding:15px; opacity:${opacidad}; box-shadow:0 1px 3px rgba(0,0,0,0.08); transition:0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:10px; font-weight:900; padding:4px 8px; border-radius:4px; background:${badgeBg}; color:${badgeCol};">${badgeTxt}</span>
                        <span style="font-size:10px; font-weight:bold; color:#94a3b8;">#${t.id}</span>
                    </div>
                    <h4 style="margin:0 0 2px 0; font-size:13px; color:${isBloqueado ? '#94a3b8' : '#0f172a'}; font-weight:800;">${productoSafe}</h4>
                    ${asignadoA}
                    <button class="btn-ver-ficha"
                        data-producto="${productoSafe}"
                        data-specs="${specsB64}"
                        data-foto="${fotoBtoa}"
                        data-ticket-id="${t.id}" data-area="${t.area}"
                        style="width:100%; background:#e0f2fe; color:#0369a1; border:none; padding:7px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; margin-bottom:8px;">
                        <i class="fa-solid fa-eye"></i> Ver Ficha
                    </button>
                    ${renderBotonTicket(t, isBloqueado, isTerminado, isEnProceso, esAdmin)}
                </div>`;
            });

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;

        // Event delegation para fichas técnicas
        contenedor.querySelectorAll('.btn-ver-ficha').forEach(btn => {
            btn.addEventListener('click', () => {
                verFichaTaller(
                    btn.dataset.producto,
                    decodeURIComponent(escape(atob(btn.dataset.specs))),
                    btn.dataset.foto,
                    btn.dataset.area
                );
            });
        });

    } catch (err) {
        console.error('Error cargando taller:', err);
        contenedor.innerHTML = '<p style="color:red; text-align:center;">❌ Error al conectar con el servidor.</p>';
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
        .map(l => `<div style="padding:5px 0; border-bottom:1px solid #e2e8f0; font-size:12px;">${l}</div>`)
        .join('');

    // ── Foto del mueble ──
    const fotoMueble = foto
        ? `<img src="${foto}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; margin-bottom:12px;" onerror="this.style.display='none'">`
        : '';

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
                const res  = await fetch(`${API_URL}/api/taller/fichatecnica-skus?skus=${[...skusEncontrados].join(',')}`);
                const data = await res.json();
                const galeria = document.getElementById('galeria-skus');
                if (!galeria) return;
                if (!Array.isArray(data) || data.length === 0) {
                    galeria.innerHTML = '<span style="color:#94a3b8; font-size:11px;">Sin fotos de materiales disponibles</span>';
                    return;
                }
                galeria.innerHTML = data.map(item => `
                    <div style="text-align:center; width:90px;">
                        <img src="${item.foto_url}" alt="${item.sku}"
                            style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${item.tipo === 'tela' ? '#93c5fd' : '#c4b5fd'}; display:block; margin:0 auto 4px;"
                            onerror="this.src='imagenes/sin_foto.jpg'">
                        <span style="font-size:9px; font-weight:900; color:${item.tipo === 'tela' ? '#1e40af' : '#5b21b6'}; display:block;">${item.sku}</span>
                        <span style="font-size:9px; color:#64748b; display:block; line-height:1.2;">${item.nombre}</span>
                    </div>
                `).join('');
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
            const r = await fetch(`${API_URL}/api/usuarios/choferes`);
            choferes = await r.json();
        } catch (_) {}
        if (!Array.isArray(choferes) || choferes.length === 0) {
            const r2 = await fetch(`${API_URL}/api/usuarios`);
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

        const response = await fetch(`${API_URL}/api/despacho/asignar-chofer`, {
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
        const resAll = await fetch(`${API_URL}/api/usuarios`);
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

                    <label style="font-size:10px; font-weight:900; color:#475569; display:block; margin-bottom:4px;">📷 FOTO DEL MATERIAL CORTADO *</label>
                    <input type="file" id="foto-derivar" accept="image/*" capture="environment"
                        style="width:100%; padding:8px; border:2px dashed #f97316; border-radius:8px; font-size:12px; margin-bottom:14px; box-sizing:border-box;">

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
        const resFin = await fetch(`${API_URL}/api/taller/ticket/${ticketId}/finalizar`, {
            method: 'POST', body: formData
        });
        const dataFin = await resFin.json();
        if (!dataFin.exito) {
            return Swal.fire('Error', dataFin.error || 'No se pudo cerrar el ticket de telas.', 'error');
        }

        // 2. Crear ticket de Tapicería
        const resTap = await fetch(`${API_URL}/api/taller/ticket/derivar`, {
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

/* --- NUEVA FUNCIÓN: ASIGNAR TRABAJADOR REAL --- */
async function asignarTrabajador(ticketId, areaTicket) {
    try {
        Swal.fire({ title: 'Buscando personal...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Traemos SOLO los operarios del área del ticket (+ jefes como respaldo)
        const res = await fetch(`${API_URL}/api/usuarios/por-area/${encodeURIComponent(areaTicket)}`);
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

        // Construimos HTML de select manualmente para mejor UX
        let selectHtml = `<select id="swal-select-trabajador" class="swal2-input" style="width:100%; margin:0; padding:10px; font-size:14px; border-radius:8px;">
            <option value="">-- Selecciona un trabajador --</option>`;

        if (operariosArea.length > 0) {
            selectHtml += `<optgroup label="✅ Operarios del área ${areaTicket.replace(/_/g,' ')}">`;
            operariosArea.forEach(u => {
                selectHtml += `<option value="${u.id}">${u.nombre}</option>`;
            });
            selectHtml += `</optgroup>`;
        }
        if (otrosUsuarios.length > 0) {
            selectHtml += `<optgroup label="👔 Jefes / Admins (respaldo)">`;
            otrosUsuarios.forEach(u => {
                selectHtml += `<option value="${u.id}">${u.nombre} (${u.rol})</option>`;
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
            
            const response = await fetch(`${API_URL}/api/taller/asignar`, {
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

        const res = await fetch(`${API_URL}/api/taller/ticket/${ticketId}/finalizar`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.exito) {
            Swal.fire('¡Trabajo Completado!', 'El ticket fue marcado como Terminado.', 'success');
            cargarTicketsTaller();
        } else {
            Swal.fire('Error', data.error || 'No se pudo finalizar el ticket.', 'error');
        }
    } catch (e) {
        console.error('Error finalizando ticket:', e);
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}


/* --- CARGAR INVENTARIO DE TALLER --- */
async function cargarInventarioTaller() {
    try {
        const res = await fetch(`${API_URL}/api/taller/inventario`);
        const insumos = await res.json();

        // Validación para evitar el error "filter is not a function"
        if (!Array.isArray(insumos)) {
            console.error("El servidor no devolvió un arreglo:", insumos);
            return;
        }

        const telas = insumos.filter(i => i.categoria === 'TELA');
        const cojines = insumos.filter(i => i.categoria === 'COJIN');
        const tableros = insumos.filter(i => i.categoria === 'TABLERO');
        const metal = insumos.filter(i => i.categoria === 'BASE' || i.categoria === 'BASE-COMEDOR');
        const madera = insumos.filter(i => i.categoria === 'SILLA' || i.categoria === 'BUTACA');

        const dibujarCard = (item) => {
            let color = item.estado === 'Agotado' ? '#fee2e2' : '#dcfce7';
            return `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size:10px; color:gray; font-weight:900; margin-bottom:5px;">${item.categoria}</div>
                <h4 style="margin:0 0 10px 0; font-size:13px;">${item.nombre}</h4>
                <select onchange="actualizarEstadoInsumo(${item.id}, '${item.categoria}', this.value)" 
                        style="width:100%; padding:5px; border-radius:5px; background:${color}; font-size:11px; font-weight:bold;">
                    <option value="Disponible" ${item.estado === 'Disponible' ? 'selected' : ''}>🟢 Disponible</option>
                    <option value="Agotado" ${item.estado === 'Agotado' ? 'selected' : ''}>🔴 Agotado</option>
                </select>
            </div>`;
        };

        const setHtml = (id, data) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = data.map(dibujarCard).join('');
        };

        setHtml('contenedor-telas-admin', telas);
        setHtml('contenedor-cojines-admin', cojines);
        setHtml('contenedor-tableros-admin', tableros);
        setHtml('contenedor-metal-admin', metal);
        setHtml('contenedor-madera-admin', madera);

    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}
async function actualizarEstadoInsumo(id, categoria, nuevoEstado) {
    try {
        const res = await fetch(`${API_URL}/api/inventario/actualizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, categoria: categoria, estado: nuevoEstado })
        });
        const data = await res.json();
        
        if (data.exito) {
            // Un mensaje chiquito que no moleste (Toast)
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'success', title: 'Inventario Actualizado' });
            
            cargarInventarioTaller(); // Recarga para actualizar los colores rojo/amarillo/verde
        } else {
            Swal.fire('Error', data.error, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
    }
}
/* ================================================================= */
/* --- LÓGICA DE MESA DE CENTRO Y CONSOLA --- */
/* ================================================================= */
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
/* ================================================================= */
/* --- MÓDULO: GESTOR DE APROBACIÓN (ADMIN) --- */
/* ================================================================= */

// Asegurarnos de que el menú cambia a esta pantalla
const oldChangeView = changeView;
changeView = function(view) {
    oldChangeView(view); // Llama a tu función original
    
    // Ocultamos la vista del gestor por defecto
    const gestorView = document.getElementById('view-gestor-aprobacion');
    if (gestorView) gestorView.style.display = 'none';

    // Si la vista solicitada es el gestor, la mostramos y cargamos los datos
    if (view === 'gestor-aprobacion') {
        document.getElementById('view-productos').style.display = 'none';
        document.getElementById('view-plantillas').style.display = 'none';
        document.getElementById('view-pedidos').style.display = 'none';
        document.getElementById('view-taller').style.display = 'none';
        document.getElementById('view-inventario').style.display = 'none';
        
        document.getElementById('view-title').innerText = 'GESTOR DE MODELOS (Make vs Buy)';
        document.getElementById('view-icon').className = 'fa-solid fa-clipboard-check';
        
        gestorView.style.display = 'block';
        cargarGestorAprobacion();
    }
};

async function cargarGestorAprobacion() {
    const contenedor = document.getElementById('lista-aprobacion-pendientes');
    contenedor.innerHTML = '<p style="color:gray; font-size:13px; text-align:center; grid-column: 1/-1;">Buscando creaciones de los vendedores...</p>';

    try {
        const res = await fetch(`${API_URL}/api/creaciones`);
        const creaciones = await res.json();

        // Filtramos solo los que están 'Pendiente' (por seguridad)
        const pendientes = creaciones.filter(c => c.estado === 'Pendiente');

        if (pendientes.length === 0) {
            contenedor.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 15px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-check-double" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                    <h3 style="margin:0 0 5px 0;">¡Bandeja Limpia!</h3>
                    <p style="margin:0; color:gray; font-size:13px;">No hay modelos nuevos esperando tu aprobación.</p>
                </div>`;
            return;
        }

        contenedor.innerHTML = pendientes.map(item => `
            <div class="card-produccion" style="position:relative;">
                <div class="badge-area" style="position:absolute; top:15px; left:15px; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">${item.categoria}</div>
                <img src="${item.foto_url.startsWith('http') ? item.foto_url : `${API_URL}/uploads/` + item.foto_url}" 
                     style="width: 100%; height: 180px; object-fit: cover; border-radius: 10px; margin-bottom: 15px;">
                
                <h4 style="margin: 0 0 8px 0; color:#0f172a;">${item.nombre}</h4>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 8px;">
                    ${item.detalles.replace(/\n/g, '<br>')}
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; gap: 8px;">
                    <button class="btn-action btn-primary" style="flex: 1; font-size: 11px; padding: 10px;" onclick="procesarAprobacion(${item.id}, '${item.nombre}')">
                        <i class="fa-solid fa-check"></i> APROBAR OFICIAL
                    </button>
                    <button class="btn-action" style="background: #fef2f2; color: #ef4444; flex: 0.3; padding: 10px; border: 1px solid #fca5a5;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error cargando gestor:", error);
        contenedor.innerHTML = '<p style="color:red; text-align:center; grid-column: 1/-1;">❌ Error de conexión con el servidor.</p>';
    }
}

async function procesarAprobacion(id, nombre) {
    const { value: formValues } = await Swal.fire({
        title: 'Aprobación Técnica y Contable',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p style="font-size: 13px; margin-bottom: 15px; color:#475569;">Configura los costos y estrategia para: <b style="color:#0f172a;">${nombre}</b></p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 15px;">
                    <label style="font-size: 10px; font-weight: 900; color:var(--danger); display: block;">1. COSTO REAL (Producción/Compra) S/</label>
                    <input id="swal-costo" class="swal2-input" type="number" placeholder="Ej: 800" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--warning); display: block;">2. PRECIO MÍNIMO PERMITIDO S/</label>
                    <input id="swal-precio-min" class="swal2-input" type="number" placeholder="Ej: 1200" style="margin-top: 5px; height: 35px; max-width:90%; margin-bottom: 15px;">
                    
                    <label style="font-size: 10px; font-weight: 900; color:var(--success); display: block;">3. PRECIO ETIQUETA / SUGERIDO S/</label>
                    <input id="swal-precio-sug" class="swal2-input" type="number" placeholder="Ej: 1500" style="margin-top: 5px; height: 35px; max-width:90%;">
                </div>
                
                <label style="font-size: 11px; font-weight: 900; color:var(--accent); display: block;">ESTRATEGIA (Make vs Buy)</label>
                <select id="swal-origen" class="swal2-input" style="width: 90%; max-width:90%; margin-top: 5px; height: 40px;">
                    <option value="Interno">🛠️ Fabricación Interna (Taller)</option>
                    <option value="Externo">📦 Compra Externa (Proveedor)</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Aprobar Modelo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        width: '500px',
        preConfirm: () => {
            return {
                costo: document.getElementById('swal-costo').value,
                precio_min: document.getElementById('swal-precio-min').value,
                precio_sug: document.getElementById('swal-precio-sug').value,
                origen: document.getElementById('swal-origen').value
            }
        }
    });

    if (formValues) {
        if (!formValues.costo || !formValues.precio_min || !formValues.precio_sug) {
            return Swal.fire('Error', 'Debes llenar los 3 campos contables.', 'error');
        }
        if (parseFloat(formValues.precio_min) < parseFloat(formValues.costo)) {
            return Swal.fire('Alerta Financiera', 'El precio mínimo no puede ser menor al costo.', 'error');
        }
        
        // Enviamos todo a Python — precio_base usa el precio mínimo como referencia
        ejecutarAprobacion(id, formValues.origen, formValues.precio_min);
    }
}
async function ejecutarAprobacion(id, origen, precio_base) {
    try {
        Swal.fire({ title: 'Aprobando y publicando...', didOpen: () => Swal.showLoading() });
        const res = await fetch(`${API_URL}/api/creaciones/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creacion_id: id,
                origen: origen,
                precio_base: precio_base
            })
        });

        const data = await res.json();
        if (data.exito) {
            Swal.fire('¡Aprobado!', 'El modelo ya está disponible en el Catálogo Principal para todos los vendedores.', 'success');
            cargarGestorAprobacion(); // Recargar bandeja
            init(); // Forzamos recarga del catálogo en segundo plano
        } else {
            Swal.fire('Error', data.error || 'No se pudo aprobar.', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}
/* ================================================================= */
/* --- MÓDULO: ENTRADA DIRECTA DE PRODUCTOS (CUADROS/ESPEJOS) --- */
/* ================================================================= */

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

function abrirModalSugerencia() {
    document.getElementById('sug-foto').value = '';
    document.getElementById('sug-nombre').value = '';
    document.getElementById('sug-tipo').selectedIndex = 0;
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
init();