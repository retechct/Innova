// =============================================================
// INNOVA MOBILI ERP — Configuración Global
// Para subir a producción, cambia SOLO esta línea:
const API_URL = "https://innova-4cnn.onrender.com";
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

// Cargar modelos personalizados guardados en localStorage
(function _cargarModelosPersonalizados() {
    try {
        const guardados = JSON.parse(localStorage.getItem('innova_modelos_sofa') || '[]');
        guardados.forEach(m => {
            if (m.key && m.foto) imagenesSofa[m.key] = m.foto;
        });
    } catch(e) {}
})();

// Estado global de la aplicación
let allProducts = [];
let cart = [];
let currentMode = 'catalogo';
let currentStep = 1;
let tempItem = null;
let filtroTaller = 'Pendientes';
let filtroAdminTaller = 'pendientes';
let maestroMateriales = { telas: [], cojines: [], bases: [] };
var usuarioActivo = null;
let listaPagos = [];
let destinoActual = "";
let tipoActual = "";

// ─── Roles con acceso al panel ERP ────────────────────────────────────────────
// Definido UNA sola vez aquí. Importar desde este archivo en vez de redeclarar.
// Si agregas un rol nuevo, cámbialo solo en esta línea.
const ROLES_ERP = ['Admin', 'Vendedor', 'Operario', 'Jefe_Taller', 'ALMACEN', 'Chofer'];