// App - punto de entrada
// ==========================================
// PUNTO DE ENTRADA — se ejecuta al cargar la página
// El login actual usa correo; no necesita precargar sedes ni usuarios.
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    verificarSesionExistente();
    init();
});
