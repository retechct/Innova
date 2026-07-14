'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const escapeHTML = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const escapeAttr = value => escapeHTML(value).replace(/`/g, '&#96;');
const jsStringAttr = value => escapeAttr(JSON.stringify(String(value ?? '')));

function listElement() {
    return {
        innerHTML: '',
        classList: { add() {} },
        insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    };
}

function load(relativePath, context) {
    vm.createContext(context);
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
    return context;
}

function evalIn(context, code) {
    return vm.runInContext(code, context);
}

function testMateriales() {
    const elements = {
        'search-tela': { value: '' },
        'list-tela': listElement(),
    };
    const items = Array.from({ length: 23 }, (_, i) => ({
        sku: `TEL-${i}`,
        coleccion: 'Coleccion',
        color: String(i),
        proveedor: 'Proveedor',
        foto_url: '',
        estado: 'Activo',
    }));
    items[0].coleccion = '<script>alert(1)</script>';
    items[0].proveedor = "Proveedor O'Neil";
    const context = load('Vendedor/js/materiales.js', {
        API_URL: '',
        console,
        maestroMateriales: { telas: items },
        window: {},
        escapeHTML,
        escapeAttr,
        jsStringAttr,
        document: {
            getElementById: id => elements[id] || null,
            addEventListener() {},
        },
    });

    evalIn(context, "mostrarUltimasMaterial('tela')");
    assert.strictEqual(evalIn(context, '_smartSearchState.tela.offset'), 10);
    assert.match(elements['list-tela'].innerHTML, /Ver 10/);
    assert.doesNotMatch(elements['list-tela'].innerHTML, /<script>/);
    assert.match(elements['list-tela'].innerHTML, /&lt;script&gt;/);

    evalIn(context, "mostrarMasMaterial('tela')");
    assert.strictEqual(evalIn(context, '_smartSearchState.tela.offset'), 20);
    assert.match(elements['list-tela'].innerHTML, /Ver 3/);

    evalIn(context, "mostrarMasMaterial('tela')");
    assert.strictEqual(evalIn(context, '_smartSearchState.tela.offset'), 23);
    assert.doesNotMatch(elements['list-tela'].innerHTML, /ver-mas-tela/);

    elements['search-tela'].value = 'coleccion';
    evalIn(context, "filtrarMaterial('tela')");
    assert.strictEqual(evalIn(context, '_smartSearchState.tela.offset'), 10);
    return context;
}

async function testRefreshFailureDoesNotRecurse(context) {
    let inventoryReloads = 0;
    context.apiFetch = async () => ({
        ok: false,
        json: async () => ({ error: 'fallo controlado' }),
    });
    context.cargarInventarioTaller = async () => { inventoryReloads += 1; };

    const loaded = await evalIn(context, '_refreshMaestro()');
    assert.strictEqual(loaded, false);
    assert.strictEqual(inventoryReloads, 0);
}

function testInventario() {
    const elements = {
        'search-inv-prod': { value: '' },
        'list-inv-prod': listElement(),
        'nf-cat': { value: '' },
    };
    const items = Array.from({ length: 23 }, (_, i) => ({
        id: i + 1,
        nombre: `Modelo ${i + 1}`,
        categoria: 'Sofa',
        foto_url: '',
    }));
    const context = load('Vendedor/js/modules/inventario/modals.js', {
        console,
        window: {},
        document: { getElementById: id => elements[id] || null },
        _invSmartSearchState: {},
        _maestroInv: { catalogo: items, sillas: [], butacas: [] },
        escapeHTML: value => String(value),
        escapeAttr: value => String(value),
        jsStringAttr: value => JSON.stringify(value),
    });

    evalIn(context, '_invRenderCatalogoBuscador(false)');
    assert.strictEqual(evalIn(context, '_invSmartSearchState.catalogo.offset'), 10);
    assert.match(elements['list-inv-prod'].innerHTML, /Ver 10/);

    evalIn(context, '_invMostrarMasCatalogo()');
    assert.strictEqual(evalIn(context, '_invSmartSearchState.catalogo.offset'), 20);
    assert.match(elements['list-inv-prod'].innerHTML, /Ver 3/);

    evalIn(context, '_invMostrarMasCatalogo()');
    assert.strictEqual(evalIn(context, '_invSmartSearchState.catalogo.offset'), 23);
}

function testMaestro() {
    const grid = listElement();
    const items = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }));
    const context = load('Vendedor/js/modules/taller/maestro_aprobacion.js', {
        console,
        window: {},
        items,
        document: { getElementById: id => (id === 'grid' ? grid : null) },
        dibujarTarjetaMaterial: item => `<article data-id="${item.id}"></article>`,
    });

    evalIn(context, "_setMaestroSeccion('grid', items, () => 'tela', 'test')");
    assert.strictEqual(evalIn(context, '_maestroRenderState.test.offset'), 10);
    assert.match(grid.innerHTML, /Ver 10/);

    evalIn(context, "_verMasMaestro('test')");
    assert.strictEqual(evalIn(context, '_maestroRenderState.test.offset'), 20);
    assert.match(grid.innerHTML, /Ver 3/);

    evalIn(context, "_renderMaestroSeccion('test', true, items.slice(0, 17))");
    assert.strictEqual(evalIn(context, '_maestroRenderState.test.offset'), 10);
    evalIn(context, "_verMasMaestro('test')");
    assert.strictEqual(evalIn(context, '_maestroRenderState.test.offset'), 17);
}

function testOrdenesAceptanNombresDelApi() {
    const context = load('Vendedor/js/busqueda_filtros.js', {
        console,
        window: {},
        document: { getElementById: () => null },
        debounce: fn => fn,
        escapeHTML: value => String(value),
        escapeAttr: value => String(value),
        renderTrazabilidadTela: () => '',
    });

    assert.strictEqual(
        evalIn(context, "_opCodigoOrden({ codigo: 'C-100' })"),
        'C-100',
    );
    assert.strictEqual(
        evalIn(context, "_opCodigoOrden({ codigo_venta: 'C-200' })"),
        'C-200',
    );
    assert.strictEqual(
        evalIn(context, "_opEstadoOrden({ estado: 'Listo' })"),
        'Listo',
    );
    assert.strictEqual(
        evalIn(context, "_opEstadoOrden({ estado_general: 'Pendiente' })"),
        'Pendiente',
    );
}

function testTrazabilidadTela() {
    const context = load('Vendedor/js/modules/taller/orden_pedido.js', {
        console,
        window: {},
        document: {},
        escapeHTML: value => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),
        escapeAttr,
        jsStringAttr,
    });
    const html = evalIn(
        context,
        "renderTrazabilidadTela({ recogido_por: '<Ana>', distribuido_por: 'Luis', tapicero_destino: 'Marta' })",
    );
    assert.match(html, /Ingresó\/recogió: <b>&lt;Ana&gt;<\/b>/);
    assert.match(html, /Distribuyó: <b>Luis<\/b>/);
    assert.match(html, /Destino: <b>Marta<\/b>/);

    const accionAdmin = evalIn(
        context,
        "renderBotonTicket({ id: 7, es_logistica: true, estado: 'En espera', tipo_gestion: 'Interno' }, false, false, false, true)",
    );
    assert.match(accionAdmin, /Bandeja compartida de Telas/);
    assert.match(accionAdmin, /Entregar a Tapicería/);

    const accionExterna = evalIn(
        context,
        "renderBotonTicket({ id: 8, es_logistica: true, estado: 'En espera', tipo_gestion: 'Externo', url_comprobante_pago: 'https:\/\/voucher' }, false, false, false, false)",
    );
    assert.match(accionExterna, /Comprobante ya registrado/);
    assert.doesNotMatch(accionExterna, /type=\"file\"/);
}

async function main() {
    const materialesContext = testMateriales();
    await testRefreshFailureDoesNotRecurse(materialesContext);
    testInventario();
    testMaestro();
    testOrdenesAceptanNombresDelApi();
    testTrazabilidadTela();
    console.log('Smart search batches: OK');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
