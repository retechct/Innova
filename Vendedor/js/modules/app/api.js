// App - API fetch y refresh de token
// ─── Helper: fetch con token JWT automático ──────────────────
// A3: Maneja FormData correctamente (no sobreescribe Content-Type)
// FIX-1: Token en localStorage para que persista al recargar la página.
// FIX-JWT: Intercepta 401 → intenta refresh automático → si falla, avisa.
// FIX-PARALLEL: _promesaRefresh evita que requests paralelos hagan múltiples
//   refreshes simultáneos. Con _refreshEnCurso (bool), el 2° request veía
//   true y caía al modal de logout sin intentar refresh. Con la promesa
//   compartida, todos esperan el mismo resultado.
let _promesaRefresh = null;   // promesa compartida para refreshes paralelos
let _swalSesionMostrado = false; // evita mostrar el modal de sesión expirada más de una vez

async function _intentarRefresh() {
    const refreshToken = localStorage.getItem('innova_refresh_token');
    if (!refreshToken) return false;

    // Si ya hay un refresh en curso, todos los requests paralelos esperan
    // al mismo resultado en vez de lanzar llamadas duplicadas al backend.
    if (_promesaRefresh) return _promesaRefresh;

    _promesaRefresh = (async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${refreshToken}` }
            });
            if (!res.ok) return false;
            const data = await res.json();
            if (data.access) {
                localStorage.setItem('innova_token', data.access);
                return true;
            }
        } catch(e) {}
        return false;
    })();

    const resultado = await _promesaRefresh;
    _promesaRefresh = null;   // limpiar para el próximo ciclo
    return resultado;
}

function apiFetch(url, options = {}) {
    const token = localStorage.getItem('innova_token');
    const esFormData = options.body instanceof FormData;
    const fetchConToken = (tk) => fetch(url, {
        ...options,
        headers: {
            // Si es FormData, NO poner Content-Type: el browser lo pone con el boundary correcto
            ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {}),
            ...(tk ? { 'Authorization': `Bearer ${tk}` } : {})
        }
    });

    return fetchConToken(token).then(async res => {
        if (res.status !== 401) return res;

        const renovado = await _intentarRefresh();
        if (renovado) {
            return fetchConToken(localStorage.getItem('innova_token'));
        }

        // Refresh fallido → sesión expirada, forzar re-login.
        // FIX: si varios requests fallan a la vez, mostrar el Swal solo una vez.
        // FIX-LOOP: también hay que borrar usuarioInnova. Si se queda en localStorage,
        // init() cree que la sesión sigue activa al recargar, vuelve a meter al usuario
        // al panel ERP sin token válido, dispara otro 401 en la siguiente petición
        // protegida, y el modal "Sesión expirada" reaparece en bucle infinito.
        localStorage.removeItem('innova_token');
        localStorage.removeItem('innova_refresh_token');
        localStorage.removeItem('usuarioInnova');
        if (!_swalSesionMostrado) {
            _swalSesionMostrado = true;
            Swal.fire({
                background: '#14100a', color: '#f5f0e8', icon: 'warning',
                title: 'Sesión expirada',
                text: 'Tu sesión ha caducado. Por favor vuelve a iniciar sesión.',
                confirmButtonColor: '#c9a84c', confirmButtonText: 'Entendido'
            }).then(() => {
                _swalSesionMostrado = false;
                location.reload();
            });
        }

        return res;
    });
}
