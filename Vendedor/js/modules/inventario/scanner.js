// Inventario - lector de codigo de barras con camara.

let _html5QrcodeInv = null;

function _abrirEscanerGlobal() {
    _iniciarEscaneoCamara();
}

function _ensureScannerInventarioModal() {
    let modal = document.getElementById('modal-scanner-inv');
    if (modal) return modal;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-scanner-inv" data-global-scanner="true" class="modal-overlay" style="display:none;align-items:center;justify-content:center;z-index:99999;">
            <div class="modal-content" style="width:92%;max-width:500px;border-radius:16px;padding:20px;text-align:center;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="margin:0;"><i class="fas fa-camera"></i> Escanear Codigo</h3>
                    <button onclick="_cerrarEscaneoCamara()" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
                </div>
                <div id="reader-inv" style="width:100%; min-height:250px; background:#f1f5f9; border-radius:8px; overflow:hidden;"></div>
                <p style="font-size:12px;color:gray;margin-top:10px;">Apunta la camara del celular al codigo de barras impreso.</p>
                <div id="scanner-inv-error" style="display:none;margin:10px 0;padding:9px;background:#fff7ed;color:#9a3412;border-radius:6px;font-size:12px;text-align:left;"></div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <input id="scanner-inv-codigo-manual" type="text" class="form-input"
                           placeholder="Escribir o pegar codigo"
                           onkeydown="if(event.key === 'Enter') _usarCodigoManualScanner()"
                           style="flex:1;min-width:0;">
                    <button type="button" class="btn-action btn-primary" onclick="_usarCodigoManualScanner()"
                            title="Buscar codigo" style="width:auto;white-space:nowrap;">
                        <i class="fas fa-search"></i> Buscar
                    </button>
                </div>
            </div>
        </div>
    `);
    return document.getElementById('modal-scanner-inv');
}

function _iniciarEscaneoCamara() {
    _ensureScannerInventarioModal().style.display = 'flex';
    const aviso = document.getElementById('scanner-inv-error');
    if (aviso) aviso.style.display = 'none';

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        _mostrarErrorScanner('La cámara requiere abrir el sistema desde una conexión segura (HTTPS). También puedes escribir el código abajo.');
        return;
    }

    // Cargar la libreria dinamicamente solo cuando se necesita.
    if (typeof Html5Qrcode === 'undefined') {
        if (document.getElementById('html5-qrcode-script')) return;
        const script = document.createElement('script');
        script.id = 'html5-qrcode-script';
        script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
        script.onload = () => _iniciarLectorLibreria();
        script.onerror = () => {
            script.remove();
            _mostrarErrorScanner('No se pudo cargar el lector de códigos. Revisa tu conexión e inténtalo nuevamente.');
        };
        document.head.appendChild(script);
    } else {
        _iniciarLectorLibreria();
    }
}

async function _iniciarLectorLibreria() {
    if (_html5QrcodeInv && _html5QrcodeInv.isScanning) {
        return;
    }
    _html5QrcodeInv = new Html5Qrcode("reader-inv", { verbose: false });

    const formatos = window.Html5QrcodeSupportedFormats
        ? [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
        ].filter(Boolean)
        : undefined;
    const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.92), 460);
            const height = Math.min(Math.max(Math.floor(width * 0.34), 130), Math.floor(viewfinderHeight * 0.5));
            return { width, height };
        },
        aspectRatio: 1.777778,
        disableFlip: false,
        ...(formatos ? { formatsToSupport: formatos } : {}),
    };
    const alLeer = (textoDecodificado) => {
        _cerrarEscaneoCamara();
        _procesarBarcodeEscaneado(String(textoDecodificado || '').trim());
    };
    const alFallarLectura = () => { /* Ignorar mientras busca un codigo. */ };

    try {
        try {
            await _html5QrcodeInv.start({ facingMode: "environment" }, config, alLeer, alFallarLectura);
        } catch (errorCamaraTrasera) {
            const camaras = await Html5Qrcode.getCameras();
        if (!camaras.length) throw new DOMException('No se detectaron cámaras', 'NotFoundError');

            const preferida = camaras.find(c => /back|rear|environment|trasera/i.test(c.label)) || camaras[0];
            await _html5QrcodeInv.start(preferida.id, config, alLeer, alFallarLectura);
        }
    } catch (error) {
        console.warn('No se pudo iniciar el escáner:', error);
        const nombre = error?.name || '';
        const detalle = String(error?.message || error || '').toLowerCase();
        let mensaje = 'No se pudo iniciar la cámara. Cierra otras aplicaciones que la estén usando e inténtalo nuevamente.';

        if (nombre === 'NotAllowedError' || /permission|permiso|denied|denegad/.test(detalle)) {
            mensaje = 'El permiso de cámara está bloqueado. Habilítalo en el candado del navegador y vuelve a presionar Escanear.';
        } else if (nombre === 'NotFoundError' || /not found|no se detectaron|requested device not found/.test(detalle)) {
            mensaje = 'No se detectó una cámara en este equipo. Puedes escribir el código en el campo de abajo.';
        } else if (nombre === 'NotReadableError' || /could not start|notreadable|in use|ocupad/.test(detalle)) {
            mensaje = 'La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a presionar Escanear.';
        }

        _mostrarErrorScanner(mensaje);
        document.getElementById('scanner-inv-codigo-manual')?.focus();
    }
}

function _mostrarErrorScanner(mensaje) {
    const aviso = document.getElementById('scanner-inv-error');
    if (!aviso) return;
    aviso.textContent = mensaje;
    aviso.style.display = 'block';
}

function _usarCodigoManualScanner() {
    const input = document.getElementById('scanner-inv-codigo-manual');
    const codigo = (input?.value || '').trim();
    if (!codigo) {
        _mostrarErrorScanner('Escribe o pega un codigo de barras para buscarlo.');
        input?.focus();
        return;
    }
    _cerrarEscaneoCamara();
    _procesarBarcodeEscaneado(codigo);
}

function _cerrarEscaneoCamara() {
    if (_html5QrcodeInv && _html5QrcodeInv.isScanning) {
        _html5QrcodeInv.stop().catch(e => console.error("Error al detener escaner.", e));
    }
    const modal = document.getElementById('modal-scanner-inv');
    if (modal) modal.style.display = 'none';
}

function _procesarBarcodeEscaneado(textoDecodificado) {
    const input = document.getElementById('inv-barcode-input');
    if (input) input.value = textoDecodificado;

    const inventarioListo = document.getElementById('modal-inv-detalle')
        && typeof _invBuscarBarcode === 'function';

    if (inventarioListo) {
        _invBuscarBarcode(textoDecodificado);
        return;
    }

    if (typeof changeView === 'function') {
        const modalGlobal = document.querySelector('#modal-scanner-inv[data-global-scanner="true"]');
        if (modalGlobal) {
            modalGlobal.remove();
            _html5QrcodeInv = null;
        }
        changeView('inv-tienda');
        _buscarBarcodeCuandoInventarioEsteListo(textoDecodificado);
        return;
    }

    if (typeof _invBuscarBarcode === 'function') {
        _invBuscarBarcode(textoDecodificado);
    }
}

function _buscarBarcodeCuandoInventarioEsteListo(textoDecodificado, intento = 0) {
    const detalleExiste = document.getElementById('modal-inv-detalle');
    const buscadorExiste = typeof _invBuscarBarcode === 'function';
    const input = document.getElementById('inv-barcode-input');

    if (input) input.value = textoDecodificado;

    if (detalleExiste && buscadorExiste) {
        _invBuscarBarcode(textoDecodificado);
        return;
    }

    if (intento < 40) {
        setTimeout(() => _buscarBarcodeCuandoInventarioEsteListo(textoDecodificado, intento + 1), 150);
        return;
    }

    Swal.fire('Escaneo listo', `Codigo leido: ${textoDecodificado}`, 'info');
}
