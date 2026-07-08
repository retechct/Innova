// Inventario - lector de codigo de barras con camara.

let _html5QrcodeInv = null;

function _iniciarEscaneoCamara() {
    document.getElementById('modal-scanner-inv').style.display = 'flex';

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
    if (!_html5QrcodeInv) {
        _html5QrcodeInv = new Html5Qrcode("reader-inv");
    }

    _html5QrcodeInv.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (textoDecodificado) => {
            _cerrarEscaneoCamara();
            document.getElementById('inv-barcode-input').value = textoDecodificado;
            _invBuscarBarcode(textoDecodificado);
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
    document.getElementById('modal-scanner-inv').style.display = 'none';
}
