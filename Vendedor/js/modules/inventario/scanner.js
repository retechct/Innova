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
            </div>
        </div>
    `);
    return document.getElementById('modal-scanner-inv');
}

function _iniciarEscaneoCamara() {
    _ensureScannerInventarioModal().style.display = 'flex';

    // Cargar la libreria dinamicamente solo cuando se necesita.
    if (typeof Html5Qrcode === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = () => _iniciarLectorLibreria();
        document.head.appendChild(script);
    } else {
        _iniciarLectorLibreria();
    }
}

function _iniciarLectorLibreria() {
    if (_html5QrcodeInv && _html5QrcodeInv.isScanning) {
        return;
    }
    _html5QrcodeInv = new Html5Qrcode("reader-inv");

    _html5QrcodeInv.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (textoDecodificado) => {
            _cerrarEscaneoCamara();
            _procesarBarcodeEscaneado(textoDecodificado);
        },
        () => { /* Ignorar errores de lectura en progreso. */ }
    ).catch(err => {
        console.error("Error camara:", err);
        Swal.fire('Aviso', 'No se pudo acceder a la camara trasera. Asegurate de dar permisos en tu navegador.', 'warning');
    });
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
