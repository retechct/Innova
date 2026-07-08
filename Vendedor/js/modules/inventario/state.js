// Inventario - estado compartido y constantes
// Carga antes de js/inventario.js. Mantiene nombres globales por compatibilidad
// con los handlers inline que ya existen en la vista.

let _invTab        = 'productos';   // 'productos' | 'piezas' | 'historial'
let _invDataProd   = { sedes: [], modelos: [] };
let _invDataPiezas = { sedes: [], piezas:  [] };
let _invFiltroCat  = '';
let _fotosAdicionalesActuales = [];
let _invFiltroQ    = '';
let _invFiltroSede = '';
let _maestroInv = { tableros: [], bases_comedor: [], sillas: [], butacas: [], cojines: [], catalogo: [], cargado: false };
let _invSedesList = [];

// Estado para paginacion del buscador inteligente de catalogo.
let _invSmartSearchState = {};

const CATEGORIAS_PRODUCTO = [
    'Sofa','Butaca','Silla','Espejo','Cuadro','Cojin','Mesa Centro','Consola',
    'Esquinero', 'Florero', 'Manta', 'Puff'
];

const CATEGORIAS_PIEZA = [
    { val: 'tablero',          label: 'Tablero (piedra / vidrio / madera)' },
    { val: 'base-comedor',     label: 'Base de Comedor' },
    { val: 'base-consola',     label: 'Base de Consola' },
    { val: 'base-mesa-centro', label: 'Base de Mesa de Centro' },
    { val: 'silla',            label: 'Silla' },
    { val: 'butaca',           label: 'Butaca' },
];
