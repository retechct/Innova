// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initEgresos() {
    egresosTab('pagos-carpinteros');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  NAVEGACIÃ“N
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function egresosTab(tab) {
    _egTab = tab;
    const tabs = ['pagos-carpinteros', 'historial-pagos', 'vendedores', 'logistica'];
    tabs.forEach(t => {
        const btn   = document.getElementById(`eg-tab-${t}`);
        const panel = document.getElementById(`eg-panel-${t}`);
        const active = (t === tab);
        if (btn)   btn.style.background = active ? 'var(--primary)' : '#94a3b8';
        if (panel) panel.style.display  = active ? 'block' : 'none';
    });
    if (tab === 'pagos-carpinteros') cargarPagosCarpinteros();
    if (tab === 'historial-pagos')   cargarHistorialPagos();
    if (tab === 'vendedores')        cargarComisionesVendedores();
    if (tab === 'logistica')         cargarLogistica();
}
