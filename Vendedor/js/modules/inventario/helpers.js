// Inventario - helpers de UI, formato, filtros y exportacion.

function _carouselNav(carouselId, direction) {
    const container = document.getElementById(carouselId);
    if (container) {
        const scrollAmount = container.clientWidth;
        container.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
    }
}

function _fmtMedida(p) {
    if (p.forma === 'Circular') return p.largo_cm ? `⌀ ${p.largo_cm} cm` : 'Circular';
    if (p.forma === 'Rectangular') {
        const l = p.largo_cm ? `${p.largo_cm}` : '?';
        const a = p.ancho_cm ? ` × ${p.ancho_cm}` : '';
        const h = p.alto_cm  ? ` / H:${p.alto_cm}` : '';
        return `${l}${a} cm${h}`;
    }
    return p.largo_cm ? `${p.largo_cm} cm` : 'Irregular';
}

function _fmtMedidaObj(d) {
    if (d.forma === 'Circular') return d.largo_cm ? `⌀ ${d.largo_cm} cm` : '—';
    const l = d.largo_cm ? `${d.largo_cm}` : '?';
    const a = d.ancho_cm ? ` × ${d.ancho_cm}` : '';
    const h = d.alto_cm  ? ` / H:${d.alto_cm}` : '';
    return `${l}${a} cm${h}`;
}

function _htmlVacio(tipo) {
    return `<div style="padding:50px;text-align:center;color:var(--text-muted);">
        <i class="fas fa-box-open" style="font-size:3rem;opacity:0.3;margin-bottom:15px;"></i>
        <p style="font-weight:700;">Sin ${tipo} registrados aún.</p>
        ${_puedeEditarInv() ? `<button onclick="abrirModalNuevoItem()"
            style="margin-top:10px;background:var(--accent);color:white;border:none;
                   padding:10px 20px;border-radius:10px;font-weight:800;cursor:pointer;">
            + Registrar el primero</button>` : ''}
    </div>`;
}

async function _invExportarCSV() {
    // FIX: antes usaba window.open(), que no puede mandar el header
    // Authorization: Bearer <token>. El endpoint /api/inventario/exportar
    // requiere rol Admin/Jefe_Taller, así que sin el JWT el backend
    // devolvía 401 y la descarga nunca ocurría (sin error visible).
    // Ahora usamos apiFetch (manda el token) + blob + link temporal.
    // El backend ahora genera un .xlsx (Excel real) con productos y
    // piezas juntos en una sola tabla, en vez de CSV.
    try {
        const res = await apiFetch(`${API_URL}/api/inventario/exportar`);

        if (!res.ok) {
            let mensaje = 'No se pudo exportar el inventario';
            try {
                const err = await res.json();
                mensaje = err.error || mensaje;
            } catch (e) {}
            return Swal.fire('Error', mensaje, 'error');
        }

        const blob = await res.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const fecha = new Date().toISOString().slice(0, 10);

        a.href = url;
        a.download = `inventario_${fecha}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (e) {
        Swal.fire('Error', 'Error de conexión al exportar el inventario', 'error');
    }
}

/* ─── Bind eventos (filtros con debounce) ───────────────────── */
function _bindInvEventos() {
    // Poblar categorías iniciales (tab Productos)
    const selCat = document.getElementById('inv-filtro-cat');
    if (selCat) CATEGORIAS_PRODUCTO.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c; selCat.appendChild(o);
    });

    document.getElementById('inv-filtro-cat')?.addEventListener('change', async e => {
        _invFiltroCat = e.target.value;
        await _cargarDatosTab();
    });

    document.getElementById('inv-filtro-sede')?.addEventListener('change', async e => {
        _invFiltroSede = e.target.value;
        await _cargarDatosTab();
    });

    let debounce;
    document.getElementById('inv-filtro-q')?.addEventListener('input', e => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            _invFiltroQ = e.target.value.trim();
            await _cargarDatosTab();
        }, 350);
    });
}

/* ─── Limpiar filtros de búsqueda ──────────────────────────── */
function _invLimpiarFiltros() {
    _invFiltroCat = '';
    _invFiltroSede = '';
    _invFiltroQ = '';

    const selCat = document.getElementById('inv-filtro-cat');
    const selSede = document.getElementById('inv-filtro-sede');
    const inputQ = document.getElementById('inv-filtro-q');

    if (selCat) selCat.value = '';
    if (selSede) selSede.value = '';
    if (inputQ) inputQ.value = '';

    _cargarDatosTab();
}

/* ─── Imprimir Etiqueta de Código de Barras ─────────────────── */
// Genera la imagen PNG directamente en la página (sin window.open / document.write)
// y la descarga al instante. Funciona en PC y Android Chrome sin popups.
