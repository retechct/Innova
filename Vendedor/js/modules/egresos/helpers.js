// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function _egLoading() {
    return '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;margin-bottom:8px;display:block;"></i>Cargando...</div>';
}
function _egError(msg) {
    return `<div style="color:#ef4444;padding:16px 20px;background:#fee2e2;border-radius:8px;border-left:4px solid #dc2626;">
        <i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i>${msg}</div>`;
}
function _egTh(align = 'left') {
    return `padding:10px 12px;text-align:${align};color:#64748b;font-weight:700;white-space:nowrap;font-size:12px;text-transform:uppercase;letter-spacing:.5px;`;
}
function _egCardStyle(color) {
    return `background:${color};color:white;border-radius:12px;padding:14px 20px;min-width:170px;box-shadow:0 2px 8px rgba(0,0,0,.15);`;
}
function _egFechaLocalISO(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  FALLBACK apiFetch (por si no estÃ¡ definido globalmente)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
if (typeof apiFetch === 'undefined') {
    window.apiFetch = function(url, options = {}) {
        const token =
            localStorage.getItem('innova_token') ||
            sessionStorage.getItem('token') ||
            localStorage.getItem('token') ||
            '';
        const esFormData = options.body instanceof FormData;
        return fetch(url, {
            ...options,
            headers: {
                ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
    };
}
