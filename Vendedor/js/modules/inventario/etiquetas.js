// Inventario - generacion e impresion de etiquetas.

function imprimirEtiqueta(codigo, nombre, sede, observaciones) {
    // Inyectar JsBarcode si aún no está cargado
    function _cargarJsBarcode(cb) {
        if (typeof JsBarcode !== 'undefined') { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = cb;
        document.head.appendChild(s);
    }

    _cargarJsBarcode(function() {
        // 1. Renderizar barcode en canvas oculto
        const bcCanvas = document.createElement('canvas');
        bcCanvas.style.display = 'none';
        document.body.appendChild(bcCanvas);
        JsBarcode(bcCanvas, codigo, {
            format: 'CODE128', width: 4, height: 120, displayValue: false, margin: 22,
            lineColor: '#000000', background: '#ffffff'
        });

        // 2. Construir imagen final (590×354px — Niimbot B21 50×30mm a 300dpi)
        const canvas  = document.createElement('canvas');
        canvas.width  = 590;
        canvas.height = 354;
        const ctx     = canvas.getContext('2d');

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Borde
        ctx.strokeStyle = '#1e140a';
        ctx.lineWidth   = 3;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

        ctx.textAlign = 'center';

        // Marca dorada
        ctx.fillStyle = '#c9a84c';
        ctx.font      = 'bold 18px Arial';
        ctx.fillText('INNOVA MÖBILI', canvas.width / 2, 46);

        // Nombre del producto
        ctx.fillStyle = '#1e140a';
        ctx.font      = 'bold 23px Arial';
        const nomCorto = nombre.length > 30 ? nombre.substring(0, 30) + '…' : nombre;
        ctx.fillText(nomCorto, canvas.width / 2, 74);

        // Sede
        ctx.fillStyle = '#8a7560';
        ctx.font      = '17px Arial';
        ctx.fillText(sede, canvas.width / 2, 98);

        // NEW: Observaciones (si existen)
        let barcodeY = 120;
        let barcodeHeight = 176;
        if (observaciones) {
            ctx.fillStyle = '#1e140a';
            ctx.font = 'italic 15px Arial';
            const obsCorto = observaciones.length > 40 ? observaciones.substring(0, 40) + '…' : observaciones;
            ctx.fillText(obsCorto, canvas.width / 2, 114);
        }

        // Barcode
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20, barcodeY - 4, 550, barcodeHeight + 8);
        ctx.drawImage(bcCanvas, 28, barcodeY, 534, barcodeHeight);

        // Código en texto
        ctx.fillStyle = '#1e140a';
        ctx.font      = 'bold 24px Arial';
        ctx.fillText(codigo, canvas.width / 2, 328);

        // Limpiar canvas temporal
        bcCanvas.remove();

        // 3. Mostrar modal de previsualización + botones
        // Eliminar modal anterior si existe
        document.getElementById('_modal-etiqueta')?.remove();

        const overlay = document.createElement('div');
        overlay.id    = '_modal-etiqueta';
        overlay.style.cssText = [
            'position:fixed','inset:0','z-index:99999',
            'background:rgba(0,0,0,0.7)',
            'display:flex','align-items:center','justify-content:center',
            'flex-direction:column','gap:14px','padding:20px'
        ].join(';');

        const img      = document.createElement('img');
        img.src        = canvas.toDataURL('image/png');
        img.style.cssText = 'max-width:320px;width:100%;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.4);';

        const btnDesc  = document.createElement('button');
        btnDesc.textContent = '📥 Descargar PNG para Niimbot';
        btnDesc.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;width:100%;max-width:320px;';
        btnDesc.onclick = function() {
            const link    = document.createElement('a');
            link.href     = canvas.toDataURL('image/png');
            link.download = 'etiqueta-' + codigo + '.png';
            document.body.appendChild(link);
            link.click();
            link.remove();
            aviso.style.display = 'block';
            aviso.innerHTML = '✅ Descargada. Abre Niimbot → <strong>+</strong> → <strong>Importar imagen</strong> → selecciónala.';
        };

        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '✕ Cerrar';
        btnCerrar.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:8px 24px;border-radius:8px;font-size:13px;cursor:pointer;';
        btnCerrar.onclick = function() { overlay.remove(); };

        const aviso = document.createElement('div');
        aviso.style.cssText = 'display:none;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:8px;padding:10px 16px;font-size:13px;text-align:center;max-width:320px;width:100%;';

        // Cerrar al tocar el fondo
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        overlay.appendChild(img);
        overlay.appendChild(btnDesc);
        overlay.appendChild(aviso);
        overlay.appendChild(btnCerrar);
        document.body.appendChild(overlay);
    });
}

/* ─── Impresión Masiva de Etiquetas Físicas ─────────────────────────────── */
async function _invImprimirMasivo() {
    const chks = document.querySelectorAll('.chk-prod:checked, .chk-pieza:checked');
    if (!chks.length) {
        return Swal.fire('Ningún ítem seleccionado', 'Selecciona al menos un modelo marcando su casilla en la tabla.', 'warning');
    }

    const res = await Swal.fire({
        title: 'Imprimir Etiquetas Físicas',
        text: `Has seleccionado ${chks.length} modelos. ¿Deseas imprimir el código físico de 1 unidad por modelo, o de TODAS las unidades disponibles?`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '1 por modelo',
        denyButtonText: 'Todas las disp.',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0f172a',
        denyButtonColor: '#16a34a'
    });

    if (res.isDismissed) return;

    const porCantidad = res.isDenied; 
    const items = Array.from(chks).map(chk => JSON.parse(decodeURIComponent(chk.value)));

    await _ejecutarImpresionFisica(items, porCantidad);
}

async function _invImprimirFisico(encodedObj) {
    const obj = JSON.parse(decodeURIComponent(encodedObj));
    await _ejecutarImpresionFisica([obj], false);
}

async function _ejecutarImpresionFisica(items, porCantidad) {
    Swal.fire({ title: 'Obteniendo códigos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await apiFetch(`${API_URL}/api/inventario/etiquetas-disponibles`, {
            method: 'POST',
            body: JSON.stringify({ items, por_cantidad: porCantidad })
        });
        const data = await res.json();
        Swal.close();
        if (data.error) throw new Error(data.error);

        if (data.etiquetas && data.etiquetas.length > 0) {
            imprimirEtiquetasMasivas(data.etiquetas);
        } else {
            Swal.fire('Aviso', 'No se encontraron unidades físicas disponibles para los modelos seleccionados.', 'info');
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function imprimirEtiquetasMasivas(lista) {
    // Sin window.open. Todo en un modal inline dentro de la misma página.
    function _cargarJsBarcode(cb) {
        if (typeof JsBarcode !== 'undefined') { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = cb;
        document.head.appendChild(s);
    }

    _cargarJsBarcode(function() {
        // Pre-generar todos los canvas de barcode
        const bcCanvases = lista.map(it => {
            const c = document.createElement('canvas');
            c.style.display = 'none';
            document.body.appendChild(c);
            JsBarcode(c, it.codigo, {
                format: 'CODE128',
                width: 4,
                height: 120,
                displayValue: false,
                margin: 22,
                lineColor: '#000000',
                background: '#ffffff'
            });
            return c;
        });

        function _generarPNG(i) {
            const it     = lista[i];
            const canvas = document.createElement('canvas');
            canvas.width  = 590;
            canvas.height = 354;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#1e140a'; ctx.lineWidth = 3;
            ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
            ctx.textAlign = 'center';

            ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 18px Arial';
            ctx.fillText('INNOVA MÖBILI', canvas.width / 2, 46);

            ctx.fillStyle = '#1e140a'; ctx.font = 'bold 23px Arial';
            const nom = it.nombre.length > 30 ? it.nombre.substring(0, 30) + '…' : it.nombre;
            ctx.fillText(nom, canvas.width / 2, 74);

            ctx.fillStyle = '#8a7560'; ctx.font = '17px Arial';
            ctx.fillText(it.sede, canvas.width / 2, 98);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 116, 550, 184);
            ctx.drawImage(bcCanvases[i], 28, 120, 534, 176);

            ctx.fillStyle = '#1e140a'; ctx.font = 'bold 24px Arial';
            ctx.fillText(it.codigo, canvas.width / 2, 328);

            return canvas.toDataURL('image/png');
        }

        function _limpiarCanvases() {
            bcCanvases.forEach(c => c.remove());
        }

        // Construir tarjetas del modal
        const tarjetas = lista.map((it, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'background:#fff;border-radius:10px;padding:12px;text-align:center;width:200px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);';

            const imgEl = document.createElement('img');
            imgEl.src = _generarPNG(i);
            imgEl.style.cssText = 'width:100%;border-radius:6px;margin-bottom:8px;';

            const nomEl = document.createElement('div');
            nomEl.textContent = it.nombre.length > 22 ? it.nombre.substring(0, 22) + '…' : it.nombre;
            nomEl.style.cssText = 'font-size:11px;font-weight:700;color:#1e140a;margin-bottom:2px;';

            const codEl = document.createElement('div');
            codEl.textContent = it.codigo;
            codEl.style.cssText = 'font-size:10px;color:#8a7560;margin-bottom:8px;';

            const btnEl = document.createElement('button');
            btnEl.textContent = '📥 Descargar';
            btnEl.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;width:100%;';
            btnEl.onclick = function() {
                const link = document.createElement('a');
                link.href = imgEl.src;
                link.download = 'etiqueta-' + it.codigo + '.png';
                document.body.appendChild(link); link.click(); link.remove();
                btnEl.textContent = '✅ Descargada';
                btnEl.style.background = '#86efac';
            };

            wrap.appendChild(imgEl);
            wrap.appendChild(nomEl);
            wrap.appendChild(codEl);
            wrap.appendChild(btnEl);
            return wrap;
        });

        // Overlay modal
        document.getElementById('_modal-masivo')?.remove();
        const overlay = document.createElement('div');
        overlay.id = '_modal-masivo';
        overlay.style.cssText = [
            'position:fixed','inset:0','z-index:99999',
            'background:rgba(0,0,0,0.85)',
            'display:flex','flex-direction:column',
            'overflow:hidden'
        ].join(';');

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'background:#1e140a;padding:14px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-shrink:0;';

        const titulo = document.createElement('span');
        titulo.textContent = `Etiquetas (${lista.length})`;
        titulo.style.cssText = 'color:#c9a84c;font-weight:800;font-size:15px;flex:1;';

        const btnTodas = document.createElement('button');
        btnTodas.textContent = '📥 Descargar todas';
        btnTodas.style.cssText = 'background:#c9a84c;color:#1e140a;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;';
        btnTodas.onclick = async function() {
            btnTodas.disabled = true;
            const aviso = document.getElementById('_aviso-masivo');
            for (let i = 0; i < lista.length; i++) {
                aviso.textContent = '⬇️ Descargando ' + (i + 1) + ' de ' + lista.length + '...';
                const link = document.createElement('a');
                link.href = tarjetas[i].querySelector('img').src;
                link.download = 'etiqueta-' + lista[i].codigo + '.png';
                document.body.appendChild(link); link.click(); link.remove();
                tarjetas[i].querySelector('button').textContent = '✅ Descargada';
                tarjetas[i].querySelector('button').style.background = '#86efac';
                await new Promise(r => setTimeout(r, 800));
            }
            aviso.textContent = '✅ ' + lista.length + ' imágenes descargadas. Importa en Niimbot → + → Importar imagen.';
            btnTodas.disabled = false;
        };

        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '✕ Cerrar';
        btnCerrar.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;';
        btnCerrar.onclick = function() { _limpiarCanvases(); overlay.remove(); };

        toolbar.appendChild(titulo);
        toolbar.appendChild(btnTodas);
        toolbar.appendChild(btnCerrar);

        const aviso = document.createElement('div');
        aviso.id = '_aviso-masivo';
        aviso.style.cssText = 'background:#1e2a3a;color:#93c5fd;font-size:12px;text-align:center;padding:6px 16px;flex-shrink:0;min-height:28px;';

        // Grid de tarjetas
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;padding:20px;overflow-y:auto;justify-content:center;flex:1;';
        tarjetas.forEach(t => grid.appendChild(t));

        overlay.appendChild(toolbar);
        overlay.appendChild(aviso);
        overlay.appendChild(grid);
        document.body.appendChild(overlay);
    });
}


/* ─── Lightbox de imagen ─────────────────────────────────────── */
