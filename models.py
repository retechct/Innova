from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz

db = SQLAlchemy()

tz_peru = pytz.timezone('America/Lima')

# ─────────────────────────────────────────────────────────────
# NOTA: Este models.py refleja el schema REAL de la BD.
# NO correr flask db migrate sin revisar — la BD ya tiene
# columnas adicionales que SQLAlchemy no conocía antes.
# ─────────────────────────────────────────────────────────────


# ── Tablas base (sin FK entrantes de otras) ──────────────────

class Sede(db.Model):
    __tablename__ = 'sedes'
    id     = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo   = db.Column(db.String(50),  nullable=False)


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id             = db.Column(db.Integer, primary_key=True)
    nombre         = db.Column(db.String(100), nullable=False)
    email          = db.Column(db.String(120), unique=True, nullable=False)
    contrasena     = db.Column(db.String(255), nullable=False)
    password_hash  = db.Column(db.String(255), nullable=True)
    rol            = db.Column(db.String(50),  nullable=False)
    pin_acceso     = db.Column(db.String(20),  nullable=True)
    area_asignada  = db.Column(db.String(100), nullable=True)
    empresa_nombre = db.Column(db.String(150), nullable=True)
    empresa_ruc    = db.Column(db.String(20),  nullable=True)
    sede_id        = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    estado         = db.Column(db.Boolean, default=True)


class CatalogoProducto(db.Model):
    __tablename__ = 'catalogo_productos'
    id                  = db.Column(db.Integer, primary_key=True)
    nombre_modelo       = db.Column(db.String(150), nullable=False)
    nombre              = db.Column(db.String(150), nullable=True)       # legacy
    categoria           = db.Column(db.String(50),  nullable=True)
    precio_base         = db.Column(db.Numeric(10, 2), nullable=True)
    foto_url            = db.Column(db.Text, nullable=True)
    tipo_producto       = db.Column(db.String(50),  nullable=True)
    requiere_tela       = db.Column(db.Boolean, default=False)
    requiere_madera     = db.Column(db.Boolean, default=False)
    requiere_superficie = db.Column(db.Boolean, default=False)
    es_plantilla        = db.Column(db.Boolean, default=False)
    en_stock            = db.Column(db.Boolean, default=False)
    origen_produccion   = db.Column(db.String(50), nullable=True)
    stock_cantidad      = db.Column(db.Integer, default=0)


class Proveedor(db.Model):
    __tablename__ = 'proveedores'
    id          = db.Column(db.Integer, primary_key=True)
    nombre      = db.Column(db.String(150), nullable=True)
    especialidad = db.Column(db.String(150), nullable=True)
    correo      = db.Column(db.String(150), nullable=True)
    telefono    = db.Column(db.String(50),  nullable=True)


class Cliente(db.Model):
    __tablename__ = 'clientes'
    id          = db.Column(db.Integer, primary_key=True)
    nombre      = db.Column(db.String(150), nullable=False)
    email       = db.Column(db.String(150), nullable=True)
    telefono    = db.Column(db.String(50),  nullable=True)
    dni         = db.Column(db.String(20),  nullable=True)
    direccion   = db.Column(db.Text, nullable=True)
    fecha_alta  = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    contrasena  = db.Column(db.String(255), nullable=True)


# ── Maestros de materiales ────────────────────────────────────

class MaestroTela(db.Model):
    __tablename__ = 'maestro_telas'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=False)
    proveedor        = db.Column(db.String(150), nullable=True)
    coleccion        = db.Column(db.String(150), nullable=True)
    color            = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    fecha_registro   = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    estado           = db.Column(db.String(50), nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)
    proveedor_id     = db.Column(db.Integer, db.ForeignKey('proveedores.id'), nullable=True)

    # SQL de migración a ejecutar:
    # ALTER TABLE maestro_telas ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);
    # Las tablas 'cotizaciones_lote' y 'cotizacion_lote_items' se crean manualmente en BD.


class MaestroBase(db.Model):
    __tablename__ = 'maestro_bases'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=False)
    tipo             = db.Column(db.String(100), nullable=True)
    material         = db.Column(db.String(100), nullable=True)
    modelo           = db.Column(db.String(150), nullable=True)
    color            = db.Column(db.String(100), nullable=True)
    medida_altura    = db.Column(db.String(50),  nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    fecha_registro   = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    estado           = db.Column(db.String(50), nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)
    acabado          = db.Column(db.String(100), nullable=True)


class MaestroBaseComedor(db.Model):
    __tablename__ = 'maestro_bases_comedor'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=True)
    material         = db.Column(db.String(100), nullable=True)
    modelo           = db.Column(db.String(150), nullable=True)
    color            = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    estado           = db.Column(db.String(50), nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)
    acabado          = db.Column(db.String(100), nullable=True)


class MaestroButaca(db.Model):
    __tablename__ = 'maestro_butacas'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=False)
    material         = db.Column(db.String(100), nullable=True)
    modelo           = db.Column(db.String(150), nullable=False)
    color_estructura = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    estado           = db.Column(db.String(50), nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)


class MaestroSilla(db.Model):
    __tablename__ = 'maestro_sillas'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=True)
    material         = db.Column(db.String(100), nullable=True)
    modelo           = db.Column(db.String(150), nullable=True)
    color_estructura = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)
    estado           = db.Column(db.Text, nullable=True)


class MaestroTablero(db.Model):
    __tablename__ = 'maestro_tableros'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=True)
    material_base    = db.Column(db.String(100), nullable=True)
    nombre_modelo    = db.Column(db.String(150), nullable=True)
    color_veta       = db.Column(db.String(100), nullable=True)
    acabado          = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    estado           = db.Column(db.String(50), nullable=True)
    origen_produccion = db.Column(db.Text, nullable=True)


class MaestroDisenoCojin(db.Model):
    __tablename__ = 'maestro_disenos_cojin'
    id               = db.Column(db.Integer, primary_key=True)
    sku              = db.Column(db.String(50), unique=True, nullable=False)
    nombre_diseno    = db.Column(db.String(150), nullable=True)
    tipo_tela        = db.Column(db.String(100), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    fecha_registro   = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    origen_produccion = db.Column(db.Text, nullable=True)
    estado           = db.Column(db.Text, nullable=True)


# ── Inventario de insumos ─────────────────────────────────────

class InventarioInsumo(db.Model):
    __tablename__ = 'inventario_insumos'
    id              = db.Column(db.Integer, primary_key=True)
    nombre_insumo   = db.Column(db.String(150), nullable=False)
    tipo_medida     = db.Column(db.String(50),  nullable=True)
    cantidad_actual = db.Column(db.Numeric(10, 3), nullable=True)


# ── Ventas e ítems ────────────────────────────────────────────

class Venta(db.Model):
    __tablename__ = 'ventas'
    id                   = db.Column(db.Integer, primary_key=True)
    codigo_venta         = db.Column(db.String(50), unique=True, nullable=False)
    nombre_cliente       = db.Column(db.String(150), nullable=False)
    dni_cliente          = db.Column(db.String(20),  nullable=True)
    celular_cliente      = db.Column(db.String(30),  nullable=True)
    direccion_cliente    = db.Column(db.Text, nullable=True)
    nombre_empresa_cliente = db.Column(db.String(150), nullable=True)
    fecha_creacion       = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    fecha_emision        = db.Column(db.Date, nullable=True)
    fecha_entrega        = db.Column(db.Date, nullable=True)
    fecha_registro       = db.Column(db.DateTime, nullable=True)
    fecha_venta          = db.Column(db.DateTime, nullable=True)
    estado_general       = db.Column(db.String(50), nullable=True)
    estado_pedido        = db.Column(db.String(50), nullable=True)
    vendedor_id          = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    vendedor_nombre      = db.Column(db.String(150), nullable=True)
    monto_adelanto       = db.Column(db.Numeric(10, 2), nullable=True)
    monto_total          = db.Column(db.Numeric(10, 2), nullable=True)
    saldo_pendiente      = db.Column(db.Numeric(10, 2), nullable=True)
    empresa_ruc          = db.Column(db.String(20),  nullable=True)
    empresa_pago         = db.Column(db.String(100), nullable=True)
    tipo_documento       = db.Column(db.String(50),  nullable=True)
    tipo_comprobante     = db.Column(db.String(50),  nullable=False)
    moneda               = db.Column(db.String(10),  nullable=False)
    tipo_cambio          = db.Column(db.Numeric(10, 4), nullable=False)
    sede                 = db.Column(db.String(100), nullable=True)

    items    = db.relationship('ItemVenta',       backref='venta', lazy=True)
    pagos    = db.relationship('Pago',            backref='venta', lazy=True)
    logistica = db.relationship('LogisticaExterna', backref='venta', lazy=True)
    historial_precios = db.relationship('HistorialPrecio', backref='venta', lazy=True)


class ItemVenta(db.Model):
    __tablename__ = 'items_venta'
    id               = db.Column(db.Integer, primary_key=True)
    venta_id         = db.Column(db.Integer, db.ForeignKey('ventas.id'), nullable=True)
    producto         = db.Column(db.Text, nullable=False)
    color_tela       = db.Column(db.Text, nullable=True)
    estado_item      = db.Column(db.String(50), nullable=True)
    foto_url         = db.Column(db.Text, nullable=True)
    detalles         = db.Column(db.Text, nullable=True)
    stock_producto_id = db.Column(db.Integer, nullable=True)
    stock_pieza_id   = db.Column(db.Integer, nullable=True)
    precio_unitario  = db.Column(db.Numeric(10, 2), nullable=True)

    tickets = db.relationship('TicketProduccion', backref='item', lazy=True)


class Pago(db.Model):
    __tablename__ = 'pagos'
    id               = db.Column(db.Integer, primary_key=True)
    venta_id         = db.Column(db.Integer, db.ForeignKey('ventas.id'), nullable=False)
    tipo_pago        = db.Column(db.String(50), nullable=False)
    entidad          = db.Column(db.String(100), nullable=True)
    numero_operacion = db.Column(db.String(100), nullable=True)
    monto_bruto      = db.Column(db.Numeric(10, 2), nullable=False)
    comision_pos     = db.Column(db.Numeric(10, 2), nullable=False)
    monto_neto       = db.Column(db.Numeric(10, 2), nullable=False)
    empresa_destino  = db.Column(db.String(100), nullable=False)
    comprobante_url  = db.Column(db.String(255), nullable=False)
    fecha_pago       = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))


class HistorialPrecio(db.Model):
    __tablename__ = 'historial_precios'
    id                 = db.Column(db.Integer, primary_key=True)
    venta_id           = db.Column(db.Integer, db.ForeignKey('ventas.id'), nullable=False)
    codigo_venta       = db.Column(db.String(50), nullable=True)
    precio_original    = db.Column(db.Numeric(10, 2), nullable=False)
    precio_nuevo       = db.Column(db.Numeric(10, 2), nullable=False)
    motivo             = db.Column(db.Text, nullable=False)
    vendedor_id        = db.Column(db.Integer, nullable=True)
    vendedor_nombre    = db.Column(db.String(150), nullable=True)
    admin_id           = db.Column(db.Integer, nullable=True)
    admin_nombre       = db.Column(db.String(150), nullable=True)
    estado             = db.Column(db.String(50), nullable=True)
    notas_admin        = db.Column(db.Text, nullable=True)
    fecha_solicitud    = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    fecha_resolucion   = db.Column(db.DateTime, nullable=True)


# ── Producción ────────────────────────────────────────────────

class TicketProduccion(db.Model):
    __tablename__ = 'tickets_produccion'
    id                       = db.Column(db.Integer, primary_key=True)
    item_id                  = db.Column(db.Integer, db.ForeignKey('items_venta.id'), nullable=True)
    area_trabajo             = db.Column(db.String(100), nullable=False)
    estado_ticket            = db.Column(db.String(50), nullable=True)
    trabajador_asignado_id   = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    foto_evidencia_url       = db.Column(db.Text, nullable=True)
    foto_evidencia           = db.Column(db.Text, nullable=True)
    fecha_inicio             = db.Column(db.DateTime, nullable=True)
    fecha_fin                = db.Column(db.DateTime, nullable=True)
    etapa                    = db.Column(db.Integer, nullable=True)
    ticket_details_override  = db.Column(db.Text, nullable=True)


class RecetaMueble(db.Model):
    __tablename__ = 'recetas_muebles'
    id                = db.Column(db.Integer, primary_key=True)
    producto_id       = db.Column(db.Integer, db.ForeignKey('catalogo_productos.id'), nullable=True)
    insumo_id         = db.Column(db.Integer, db.ForeignKey('inventario_insumos.id'), nullable=True)
    cantidad_necesaria = db.Column(db.Numeric(10, 3), nullable=False)


# ── Logística externa ─────────────────────────────────────────

class LogisticaExterna(db.Model):
    __tablename__ = 'logistica_externa'
    id                        = db.Column(db.Integer, primary_key=True)
    venta_id                  = db.Column(db.Integer, db.ForeignKey('ventas.id'), nullable=True)
    insumo_nombre             = db.Column(db.String(150), nullable=True)
    sku                       = db.Column(db.String(50),  nullable=True)
    proveedor_id              = db.Column(db.Integer, db.ForeignKey('proveedores.id'), nullable=True)
    cantidad                  = db.Column(db.Numeric(10, 3), nullable=True)
    unidad                    = db.Column(db.String(50),  nullable=True)
    # tipo_gestion: 'Externo' (proveedor formal), 'Interno' (lo fabrica el taller),
    #               'Informal' (proveedor sin sistema, jefe pide aparte y marca "Enviar al taller")
    tipo_gestion              = db.Column(db.String(20), default='Externo', nullable=True)
    precio_cotizado           = db.Column(db.Numeric(10, 2), nullable=True)
    fecha_entrega_proveedor   = db.Column(db.Date, nullable=True)
    estado                    = db.Column(db.String(50), nullable=True)
    token_respuesta           = db.Column(db.String(100), nullable=True)
    token_usado               = db.Column(db.Boolean, default=False)
    notas_proveedor           = db.Column(db.Text, nullable=True)
    url_comprobante_pago      = db.Column(db.Text, nullable=True)
    fecha_pago                = db.Column(db.DateTime, nullable=True)
    fecha_envio_cotizacion    = db.Column(db.DateTime, nullable=True)
    fecha_respuesta_proveedor = db.Column(db.DateTime, nullable=True)

    ordenes_compra = db.relationship('OrdenCompraSeq', backref='logistica', lazy=True)


class OrdenCompraSeq(db.Model):
    __tablename__ = 'ordenes_compra_seq'
    id           = db.Column(db.Integer, primary_key=True)
    logistica_id = db.Column(db.Integer, db.ForeignKey('logistica_externa.id'), nullable=True)
    numero_oc    = db.Column(db.String(50), nullable=False)
    url_pdf      = db.Column(db.Text, nullable=True)
    fecha_emision = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))


# ── Stock (inventario físico de tiendas) ──────────────────────

class StockProducto(db.Model):
    __tablename__ = 'stock_productos'
    id             = db.Column(db.Integer, primary_key=True)
    catalogo_id    = db.Column(db.Integer, db.ForeignKey('catalogo_productos.id'), nullable=True)
    nombre_modelo  = db.Column(db.String(150), nullable=False)
    categoria      = db.Column(db.String(50),  nullable=False)
    codigo_barra   = db.Column(db.String(100), unique=True, nullable=False)
    color_tela     = db.Column(db.String(100), nullable=True)
    acabado        = db.Column(db.String(100), nullable=True)
    observaciones  = db.Column(db.Text, nullable=True)
    foto_url       = db.Column(db.Text, nullable=True)
    sede_id        = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=False)
    estado         = db.Column(db.String(50),  nullable=False)
    costo_ingreso  = db.Column(db.Numeric(10, 2), nullable=True)
    precio_venta   = db.Column(db.Numeric(10, 2), nullable=True)
    fecha_ingreso  = db.Column(db.DateTime, nullable=False)
    creado_por     = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    actualizado_en = db.Column(db.DateTime, nullable=True)


class StockPieza(db.Model):
    __tablename__ = 'stock_piezas'
    id                = db.Column(db.Integer, primary_key=True)
    codigo_barra      = db.Column(db.String(100), unique=True, nullable=False)
    sku_maestro       = db.Column(db.String(50),  nullable=False)
    nombre_modelo     = db.Column(db.String(150), nullable=False)
    categoria         = db.Column(db.String(50),  nullable=False)
    material          = db.Column(db.String(100), nullable=True)
    color_acabado     = db.Column(db.String(100), nullable=True)
    forma             = db.Column(db.String(50),  nullable=False)
    largo_cm          = db.Column(db.Numeric(8, 2), nullable=True)
    ancho_cm          = db.Column(db.Numeric(8, 2), nullable=True)
    alto_cm           = db.Column(db.Numeric(8, 2), nullable=True)
    sede_id           = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=False)
    estado            = db.Column(db.String(50), nullable=False)
    costo_ingreso     = db.Column(db.Numeric(10, 2), nullable=True)
    proveedor         = db.Column(db.String(150), nullable=True)
    fecha_ingreso     = db.Column(db.DateTime, nullable=True)
    usuario_ingreso_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)


class StockUnidad(db.Model):
    __tablename__ = 'stock_unidades'
    id                = db.Column(db.Integer, primary_key=True)
    codigo_barra      = db.Column(db.String(100), unique=True, nullable=False)
    catalogo_id       = db.Column(db.Integer, db.ForeignKey('catalogo_productos.id'), nullable=True)
    nombre_modelo     = db.Column(db.String(150), nullable=False)
    categoria         = db.Column(db.String(50),  nullable=False)
    color_tela        = db.Column(db.String(100), nullable=True)
    acabado           = db.Column(db.String(100), nullable=True)
    observaciones     = db.Column(db.Text, nullable=True)
    sede_id           = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=False)
    estado            = db.Column(db.String(50), nullable=False)
    costo_ingreso     = db.Column(db.Numeric(10, 2), nullable=True)
    fecha_ingreso     = db.Column(db.DateTime, nullable=True)
    usuario_ingreso_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)


class StockMovimiento(db.Model):
    __tablename__ = 'stock_movimientos'
    id              = db.Column(db.Integer, primary_key=True)
    tipo_item       = db.Column(db.String(50), nullable=False)
    item_id         = db.Column(db.Integer,    nullable=False)
    codigo_barra    = db.Column(db.String(100), nullable=False)
    evento          = db.Column(db.String(100), nullable=False)
    estado_anterior = db.Column(db.String(50),  nullable=True)
    estado_nuevo    = db.Column(db.String(50),  nullable=True)
    sede_origen_id  = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    sede_destino_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    usuario_id      = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    usuario_nombre  = db.Column(db.String(150), nullable=True)
    usuario_rol     = db.Column(db.String(50),  nullable=True)
    notas           = db.Column(db.Text, nullable=True)
    fecha           = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(tz_peru))


# ── Kardex (piezas físicas legacy) ───────────────────────────

class PiezaFisica(db.Model):
    __tablename__ = 'piezas_fisicas'
    id             = db.Column(db.Integer, primary_key=True)
    codigo_interno = db.Column(db.String(50), unique=True, nullable=False)
    catalogo_id    = db.Column(db.Integer, db.ForeignKey('catalogo_productos.id'), nullable=False)
    sede_id        = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=False)
    estado         = db.Column(db.String(50), default='Disponible', nullable=False)
    costo_ingreso  = db.Column(db.Numeric(10, 2), nullable=False)
    fecha_ingreso  = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))

    movimientos = db.relationship('MovimientoKardex', backref='pieza', lazy=True)


class MovimientoKardex(db.Model):
    __tablename__ = 'movimientos_kardex'
    id              = db.Column(db.Integer, primary_key=True)
    pieza_id        = db.Column(db.Integer, db.ForeignKey('piezas_fisicas.id'), nullable=False)
    tipo_evento     = db.Column(db.String(50), nullable=False)
    sede_origen_id  = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    sede_destino_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    usuario_id      = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    fecha           = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    notas           = db.Column(db.String(255), nullable=True)


# ── Historial de inventario ───────────────────────────────────

class HistorialInventario(db.Model):
    __tablename__ = 'historial_inventario'
    id              = db.Column(db.Integer, primary_key=True)
    tipo_registro   = db.Column(db.String(50), nullable=False)
    registro_id     = db.Column(db.Integer,    nullable=False)
    codigo_barra    = db.Column(db.String(100), nullable=False)
    tipo_evento     = db.Column(db.String(100), nullable=False)
    sede_origen_id  = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    sede_destino_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    estado_anterior = db.Column(db.String(50),  nullable=True)
    estado_nuevo    = db.Column(db.String(50),  nullable=True)
    usuario_id      = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    usuario_nombre  = db.Column(db.String(150), nullable=True)
    venta_id        = db.Column(db.Integer, nullable=True)
    codigo_venta    = db.Column(db.String(50),  nullable=True)
    notas           = db.Column(db.Text, nullable=True)
    fecha           = db.Column(db.DateTime, nullable=False)


# ── Creaciones de vendedores ──────────────────────────────────

class CreacionVendedor(db.Model):
    __tablename__ = 'creaciones_vendedores'
    id               = db.Column(db.Integer, primary_key=True)
    vendedor_id      = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    nombre_modelo    = db.Column(db.String(150), nullable=False)
    categoria        = db.Column(db.String(50),  nullable=True)
    detalles_tecnicos = db.Column(db.Text, nullable=True)
    notas_casqueria  = db.Column(db.Text, nullable=True)
    fecha_creacion   = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    aprobado_admin   = db.Column(db.Boolean, default=False)
    config_json      = db.Column(db.JSON, nullable=True)
    estado           = db.Column(db.String(50), nullable=True)

    fotos = db.relationship('FotoCreacion', backref='creacion', lazy=True)


class FotoCreacion(db.Model):
    __tablename__ = 'fotos_creaciones'
    id           = db.Column(db.Integer, primary_key=True)
    creacion_id  = db.Column(db.Integer, db.ForeignKey('creaciones_vendedores.id'), nullable=True)
    foto_url     = db.Column(db.Text, nullable=False)
    fecha_subida = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))


# ── Sugerencias ───────────────────────────────────────────────

class SugerenciaInsumo(db.Model):
    __tablename__ = 'sugerencias_insumos'
    id             = db.Column(db.Integer, primary_key=True)
    nombre         = db.Column(db.Text, nullable=False)
    tipo           = db.Column(db.Text, nullable=True)
    foto_ref       = db.Column(db.Text, nullable=True)
    usuario_id     = db.Column(db.Integer, nullable=True)
    estado         = db.Column(db.Text, nullable=True)
    fecha_registro = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    datos_json     = db.Column(db.Text, nullable=True)


class SugerenciaERP(db.Model):
    __tablename__ = 'sugerencias_erp'
    id               = db.Column(db.Integer, primary_key=True)
    nombre_insumo    = db.Column(db.String(150), nullable=False)
    vendedor_id      = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    estado           = db.Column(db.String(50), default='Pendiente')
    tipo_origen      = db.Column(db.String(50), nullable=True)
    fecha_sugerencia = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))


class CotizacionLote(db.Model):
    __tablename__ = 'cotizaciones_lote'
    id               = db.Column(db.Integer, primary_key=True)
    token            = db.Column(db.String(100), unique=True, nullable=False)
    proveedor_id     = db.Column(db.Integer, db.ForeignKey('proveedores.id'), nullable=True)
    estado           = db.Column(db.String(50), default='Pendiente')
    notas_internas   = db.Column(db.Text, nullable=True)
    fecha_creacion   = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    fecha_envio      = db.Column(db.DateTime, nullable=True)
    fecha_respuesta  = db.Column(db.DateTime, nullable=True)
    token_usado      = db.Column(db.Boolean, default=False)
    items = db.relationship('CotizacionLoteItem', backref='lote', lazy=True)

class CotizacionLoteItem(db.Model):
    __tablename__ = 'cotizacion_lote_items'
    id                      = db.Column(db.Integer, primary_key=True)
    lote_id                 = db.Column(db.Integer, db.ForeignKey('cotizaciones_lote.id'), nullable=False)
    logistica_externa_id    = db.Column(db.Integer, db.ForeignKey('logistica_externa.id'), nullable=True)
    sku                     = db.Column(db.String(50), nullable=True)
    insumo_nombre           = db.Column(db.String(150), nullable=True)
    cantidad                = db.Column(db.Numeric(10,3), nullable=True)
    unidad                  = db.Column(db.String(50), nullable=True)
    foto_url                = db.Column(db.Text, nullable=True)
    precio_cotizado         = db.Column(db.Numeric(10,2), nullable=True)
    fecha_entrega_proveedor = db.Column(db.Date, nullable=True)
    notas_item              = db.Column(db.Text, nullable=True)
    respondido              = db.Column(db.Boolean, default=False)