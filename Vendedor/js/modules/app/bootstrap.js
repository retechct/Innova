// App - punto de entrada
// ==========================================
// PUNTO DE ENTRADA — se ejecuta al cargar la página
// FIX: un solo DOMContentLoaded que llama init() + cargarUsuariosLogin()
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const sesion = localStorage.getItem('usuarioInnova');
    let tieneSesionERP = false;
    try {
        const usuario = sesion ? JSON.parse(sesion) : null;
        tieneSesionERP = !!(usuario && ROLES_ERP.includes(usuario.rol));
    } catch (_) {
        tieneSesionERP = false;
    }
    if (!tieneSesionERP) cargarDatosInicialesLogin(); // Carga Sedes y Usuarios
    verificarSesionExistente(); // oculta el login si ya hay sesión guardada
    init();                  // carga catálogo + materiales y rutea según sesión
});
