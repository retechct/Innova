// Inventario - fotos, previews y lightbox.

async function _invManejarFotosAdicionales(event, previewContainerId) {
    const files = event.target.files;
    if (!files.length) return;

    const previewContainer = document.getElementById(previewContainerId);
    if (!previewContainer) return;

    const loader = document.createElement('div');
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
    loader.style.cssText = 'color: #94a3b8; font-size: 12px;';
    previewContainer.appendChild(loader);

    for (const file of files) {
        let blobFinal = file;
        if (file.type.startsWith('image/')) {
            try {
                blobFinal = await _comprimirImagen(file);
            } catch (compErr) {
                console.warn('Compresión de imagen falló, usando original:', compErr);
            }
        }

        const formData = new FormData();
        formData.append('foto', blobFinal, 'inv-foto.webp');
        try {
            const res = await apiFetch(`${API_URL}/api/upload-foto`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                _fotosAdicionalesActuales.push(data.url);
            }
        } catch (e) {
            console.error("Error subiendo foto adicional:", e);
            Swal.fire('Error', 'No se pudo subir una de las imágenes.', 'error');
        }
    }
    loader.remove();
    _invRenderizarFotosPreview(previewContainerId);
}

function _invRenderizarFotosPreview(containerId, fotoMaestro = null) {
    const previewContainer = document.getElementById(containerId);
    if (!previewContainer) return;
    previewContainer.innerHTML = '';

    // Tomar solo la primera foto del maestro para el preview
    const fotoPrincipal = (fotoMaestro || '').split('|')[0].trim();

    if (fotoPrincipal) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
            <img src="${fotoPrincipal}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--accent);">
            <span style="position:absolute;top:-5px;left:-5px;background:var(--accent);color:white;font-size:8px;padding:1px 4px;border-radius:4px;font-weight:bold;">Catálogo</span>
        `;
        previewContainer.appendChild(div);
    }

    _fotosAdicionalesActuales.forEach((url, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
            <img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
            <button onclick="_invEliminarFotoAdicional(${index}, '${containerId}')"
                    style="position:absolute;top:-5px;right:-5px;background:var(--danger);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:18px;">
                &times;
            </button>
        `;
        previewContainer.appendChild(div);
    });
}

function _invEliminarFotoAdicional(index, containerId) {
    _fotosAdicionalesActuales.splice(index, 1);
    const fotoMaestro = document.querySelector(`#${containerId} img`)?.src || null;
    _invRenderizarFotosPreview(containerId, fotoMaestro);
}

/* ─── Helpers ────────────────────────────────────────────────── */
/**
 * Comprime una imagen (File/Blob) en el browser usando Canvas.
 * Reduce a máx 1200px de ancho y calidad 0.82 WebP.
 * Retorna una Promise<Blob>.
 */
function _comprimirImagen(file, maxWidth = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
        reader.onload = e => {
            const img = new Image();
            img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
            img.onload = () => {
                // Calcular nuevas dimensiones respetando proporción
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round(h * maxWidth / w);
                    w = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width  = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Error al comprimir')), 'image/webp', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function _invLightbox(url, titulo) {
    // Crear overlay si no existe
    let lb = document.getElementById('_inv-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = '_inv-lightbox';
        lb.style.cssText = [
            'position:fixed','inset:0','z-index:99999',
            'background:rgba(0,0,0,0.85)',
            'display:flex','align-items:center','justify-content:center',
            'flex-direction:column','gap:12px',
            'cursor:zoom-out','padding:20px'
        ].join(';');
        lb.addEventListener('click', () => lb.remove());
        document.body.appendChild(lb);
    }
    lb.innerHTML = `
        <img src="${url}" alt="${titulo}"
             style="max-width:92vw;max-height:82vh;object-fit:contain;
                    border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6);"
             onerror="this.src='imagenes/sin_foto.jpg'">
        <div style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:600;
                    text-align:center;max-width:80vw;">${titulo}</div>
        <div style="color:rgba(255,255,255,0.4);font-size:12px;">
            Toca o haz clic para cerrar
        </div>`;
    lb.style.display = 'flex';
}
