'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
        toggle(name, force) {
            const enabled = force === undefined ? !classes.has(name) : Boolean(force);
            if (enabled) classes.add(name);
            else classes.delete(name);
            return enabled;
        },
    };
}

function createElement(value = '') {
    return {
        value,
        innerHTML: '',
        innerText: '',
        textContent: '',
        style: {},
        dataset: {},
        classList: createClassList(),
        addEventListener() {},
    };
}

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
    };
}

function runIn(context, source) {
    return vm.runInContext(source, context);
}

function main() {
    const fieldIds = [
        'c-codigo', 'c-nombre', 'c-tipo-doc', 'c-dni', 'c-celular',
        'c-direccion', 'c-comprobante-tipo', 'c-emision', 'c-entrega',
        'v-moneda', 'v-tipo-cambio', 'pago-tipo', 'pago-entidad',
        'pago-operacion', 'pago-monto', 'pago-empresa', 'pago-comision',
    ];
    const elements = Object.fromEntries(fieldIds.map(id => [id, createElement()]));
    Object.assign(elements, {
        'modal-reg-cliente': createElement(),
        'cart-slider': createElement(),
        'overlay-cart': createElement(),
        'cart-count': createElement(),
        'lista-carrito': createElement(),
        'lista-pagos-agregados': createElement(),
        'res-total': createElement(),
        'res-adelanto': createElement(),
        'res-saldo': createElement(),
        'div-comision-pos': createElement(),
        'btn-main': createElement(),
    });
    for (let step = 1; step <= 3; step += 1) {
        elements[`step-${step}`] = createElement();
        elements[`s${step}`] = createElement();
    }
    elements['c-tipo-doc'].value = 'DNI';
    elements['c-comprobante-tipo'].value = 'Contrato';
    elements['v-moneda'].value = 'PEN';
    elements['pago-tipo'].value = 'Efectivo';

    const localStorage = createStorage({
        usuarioInnova: JSON.stringify({ id: 9, nombre: 'Vendedor Prueba' }),
    });
    const sessionStorage = createStorage();
    let timerId = 0;
    const context = vm.createContext({
        API_URL: 'https://example.test',
        cart: [],
        listaPagos: [],
        currentStep: 1,
        usuarioActivo: { id: 9, nombre: 'Vendedor Prueba' },
        localStorage,
        sessionStorage,
        console,
        window: { addEventListener() {} },
        document: {
            visibilityState: 'visible',
            body: { insertAdjacentHTML() {} },
            getElementById: id => elements[id] || null,
            querySelectorAll: selector => {
                if (selector === '.step-content') {
                    return [elements['step-1'], elements['step-2'], elements['step-3']];
                }
                if (selector === '.step') return [elements.s1, elements.s2, elements.s3];
                return [];
            },
            addEventListener() {},
        },
        setTimeout() { timerId += 1; return timerId; },
        clearTimeout() {},
        setInterval() { timerId += 1; return timerId; },
        clearInterval() {},
        Swal: { fire() {}, close() {}, showLoading() {} },
    });

    const carritoSource = fs.readFileSync(path.join(ROOT, 'Vendedor/js/carrito.js'), 'utf8');
    vm.runInContext(carritoSource, context, { filename: 'Vendedor/js/carrito.js' });

    assert.strictEqual(runIn(context, "_sanearCodigoContrato('  F-2026/0042  ')"), 'F-2026/0042');
    assert.strictEqual(
        runIn(context, "_sanearCodigoContrato('Ver foto adjunta: https://res.cloudinary.com/demo/image.jpg')"),
        '',
    );

    elements['c-codigo'].value = 'F-2026/0042';
    elements['c-nombre'].value = 'Cliente Ficticio';
    elements['c-dni'].value = '12345678';
    elements['c-celular'].value = '999888777';
    elements['pago-tipo'].value = 'Transferencia';
    elements['pago-entidad'].value = 'BCP';
    elements['pago-operacion'].value = 'OP-123';
    elements['cart-slider'].classList.add('open');
    runIn(context, `
        cart.push({ name: 'Sofa prueba', price: 2500, details: 'Tela ficticia' });
        listaPagos.push({ tipo: 'Transferencia', entidad: 'BCP', operacion: 'OP-123', monto: 500 });
        clienteSeleccionadoId = 77;
        currentStep = 2;
        _guardarBorradorVenta();
    `);

    const storageKey = 'innova_venta_borrador:9';
    const savedDraft = JSON.parse(sessionStorage.getItem(storageKey));
    assert.strictEqual(savedDraft.cart.length, 1);
    assert.strictEqual(savedDraft.campos['c-codigo'], 'F-2026/0042');
    assert.strictEqual(savedDraft.currentStep, 2);

    runIn(context, 'cart = []; listaPagos = []; clienteSeleccionadoId = null; currentStep = 1;');
    elements['c-codigo'].value = 'Ver foto adjunta: https://res.cloudinary.com/bad/image.jpg';
    elements['c-nombre'].value = '';
    elements['cart-slider'].classList.remove('open');

    assert.strictEqual(runIn(context, '_restaurarBorradorVenta()'), true);
    assert.strictEqual(runIn(context, 'cart.length'), 1);
    assert.strictEqual(runIn(context, 'listaPagos.length'), 1);
    assert.strictEqual(runIn(context, 'clienteSeleccionadoId'), 77);
    assert.strictEqual(runIn(context, 'currentStep'), 2);
    assert.strictEqual(elements['c-codigo'].value, 'F-2026/0042');
    assert.strictEqual(elements['c-nombre'].value, 'Cliente Ficticio');
    assert.strictEqual(elements['cart-count'].innerText, '1');
    assert.strictEqual(elements['cart-slider'].classList.contains('open'), true);

    runIn(context, '_descartarBorradorVenta()');
    elements['c-codigo'].value = 'https://res.cloudinary.com/bad/again.jpg';
    assert.strictEqual(runIn(context, '_restaurarBorradorVenta()'), false);
    assert.strictEqual(elements['c-codigo'].value, '');

    elements['c-codigo'].value = 'F-2026/0042';
    runIn(context, '_guardarBorradorVenta(); limpiarFormularioVenta();');
    assert.strictEqual(sessionStorage.getItem(storageKey), null);
    assert.strictEqual(runIn(context, 'cart.length'), 0);
    assert.strictEqual(runIn(context, 'listaPagos.length'), 0);

    const materialesSource = fs.readFileSync(path.join(ROOT, 'Vendedor/js/materiales.js'), 'utf8');
    assert.doesNotMatch(materialesSource, /noteInput\.value\s*=\s*`Ver foto adjunta:/);

    console.log('Cart draft navigation: OK');
}

main();
