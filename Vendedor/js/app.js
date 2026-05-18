// === MÓDULO: App principal, init, vistas, sesión ===
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
}
