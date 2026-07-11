// Inventario - lector de codigo de barras con camara.

let _html5QrcodeInv = null;
let _scannerInvTorchOn = false;

function _abrirEscanerGlobal() {
    _iniciarEscaneoCamara();
}

function _ensureScannerInventarioModal() {
    let modal = document.getElementById('modal-scanner-inv');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-scanner-inv" data-global-scanner="true" class="modal-overlay" style="display:none;align-items:center;justify-content:center;z-index:99999;">
        </div>
    `);
        modal = document.getElementById('modal-scanner-inv');
    }

    modal.setAttribute('data-global-scanner', 'true');
    modal.style.cssText = 'display:none;align-items:center;justify-content:center;z-index:99999;';

    if (modal.dataset.scannerUiVersion !== '2') {
        modal.dataset.scannerUiVersion = '2';
        modal.innerHTML = `
            <div class="modal-content" style="width:92%;max-width:520px;border-radius:18px;padding:20px;text-align:center;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;">
                    <h3 style="margin:0;font-size:20px;text-align:left;"><i class="fas fa-camera"></i> Escanear Codigo</h3>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button id="scanner-inv-torch-btn" type="button" onclick="_toggleLinternaScanner()"
                                style="display:none;align-items:center;gap:7px;background:#fbbf24;color:#1f2937;border:none;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer;">
                            <i class="fas fa-bolt"></i> Linterna
                        </button>
                        <button onclick="_cerrarEscaneoCamara()" style="background:none;border:none;font-size:26px;line-height:1;cursor:pointer;">&times;</button>
                    </div>
                </div>
                <div id="reader-inv-wrap" style="position:relative;width:100%;background:#020617;border-radius:14px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);">
                    <div id="reader-inv" style="width:100%;min-height:330px;background:#020617;overflow:hidden;"></div>
                    <div id="scanner-inv-frame" style="pointer-events:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,430px);height:112px;border:3px solid rgba(255,255,255,0.98);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,0.32),0 0 24px rgba(251,191,36,0.35);">
                        <span style="position:absolute;left:50%;top:50%;width:92%;height:2px;transform:translate(-50%,-50%);background:rgba(251,191,36,0.95);box-shadow:0 0 12px rgba(251,191,36,0.7);"></span>
                    </div>
                    <div style="pointer-events:none;position:absolute;left:12px;right:12px;bottom:12px;background:rgba(15,23,42,0.72);color:white;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;">
                        Centra el codigo dentro del recuadro
                    </div>
                </div>
                <p style="font-size:12px;color:gray;margin-top:10px;">Activa la linterna si esta oscuro y acerca la etiqueta hasta que el codigo llene el recuadro.</p>
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
            </div>`;
    }

    return modal;
}

function _iniciarEscaneoCamara() {
    _ensureScannerInventarioModal().style.display = 'flex';
    _scannerInvTorchOn = false;
    _actualizarBotonLinternaScanner(false);
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
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.9), 460);
            const height = Math.min(Math.max(Math.floor(width * 0.26), 96), Math.floor(viewfinderHeight * 0.38));
            return { width, height };
        },
        aspectRatio: 1.777778,
        disableFlip: false,
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
        },
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
            _prepararVideoScanner();
            _prepararLinternaScanner();
        } catch (errorCamaraTrasera) {
            const camaras = await Html5Qrcode.getCameras();
        if (!camaras.length) throw new DOMException('No se detectaron cámaras', 'NotFoundError');

            const preferida = camaras.find(c => /back|rear|environment|trasera/i.test(c.label)) || camaras[0];
            await _html5QrcodeInv.start(preferida.id, config, alLeer, alFallarLectura);
            _prepararVideoScanner();
            _prepararLinternaScanner();
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

function _prepararVideoScanner() {
    const aplicar = () => {
        const reader = document.getElementById('reader-inv');
        if (!reader) return;

        reader.style.border = '0';
        reader.querySelectorAll('video').forEach(video => {
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.minHeight = '330px';
            video.style.objectFit = 'cover';
            video.style.filter = 'brightness(1.32) contrast(1.2) saturate(1.08)';
        });
        reader.querySelectorAll('img, canvas').forEach(el => {
            el.style.maxWidth = '100%';
        });
    };

    aplicar();
    setTimeout(aplicar, 250);
    setTimeout(aplicar, 900);
}

function _prepararLinternaScanner() {
    const btn = document.getElementById('scanner-inv-torch-btn');
    if (!btn) return;

    let tieneLinterna = false;
    try {
        const capacidades = _html5QrcodeInv?.getRunningTrackCapabilities?.();
        tieneLinterna = !!capacidades?.torch;
    } catch (e) {
        tieneLinterna = false;
    }

    btn.style.display = tieneLinterna ? 'inline-flex' : 'none';
    _actualizarBotonLinternaScanner(false);
}

function _actualizarBotonLinternaScanner(encendida) {
    const btn = document.getElementById('scanner-inv-torch-btn');
    if (!btn) return;

    btn.style.background = encendida ? '#f59e0b' : '#fbbf24';
    btn.innerHTML = encendida
        ? '<i class="fas fa-bolt"></i> Linterna ON'
        : '<i class="fas fa-bolt"></i> Linterna';
}

async function _toggleLinternaScanner() {
    if (!_html5QrcodeInv || !_html5QrcodeInv.isScanning) return;

    const siguienteEstado = !_scannerInvTorchOn;
    try {
        if (typeof _html5QrcodeInv.applyVideoConstraints !== 'function') {
            throw new Error('Torch no soportado por la libreria');
        }

        await _html5QrcodeInv.applyVideoConstraints({ advanced: [{ torch: siguienteEstado }] });
        _scannerInvTorchOn = siguienteEstado;
        _actualizarBotonLinternaScanner(_scannerInvTorchOn);
    } catch (e) {
        _scannerInvTorchOn = false;
        _actualizarBotonLinternaScanner(false);
        _mostrarErrorScanner('Este celular o navegador no permite activar la linterna desde la web. Si hace falta, activa la luz manualmente y vuelve a apuntar al recuadro.');
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
        if (_scannerInvTorchOn && typeof _html5QrcodeInv.applyVideoConstraints === 'function') {
            try {
                _html5QrcodeInv.applyVideoConstraints({ advanced: [{ torch: false }] }).catch(() => {});
            } catch (e) {}
        }
        _html5QrcodeInv.stop().catch(e => console.error("Error al detener escaner.", e));
    }
    _scannerInvTorchOn = false;
    _actualizarBotonLinternaScanner(false);
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
