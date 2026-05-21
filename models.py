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

class Sede(db.Model):
    __tablename__ = 'sedes'
    id     = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo   = db.Column(db.String(50),  nullable=False)

    usuarios = db.relationship('Usuario',    backref='sede_origen', lazy=True)
    piezas   = db.relationship('PiezaFisica', backref='sede_actual', lazy=True)


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id              = db.Column(db.Integer, primary_key=True)
    nombre          = db.Column(db.String(100), nullable=False)
    email           = db.Column(db.String(120), unique=True, nullable=False)
    contrasena      = db.Column(db.String(255), nullable=False)          # columna real en BD
    password_hash   = db.Column(db.String(255), nullable=True)           # columna legacy
    rol             = db.Column(db.String(50),  nullable=False)
    pin_acceso      = db.Column(db.String(20),  nullable=True)
    area_asignada   = db.Column(db.String(100), nullable=True)
    empresa_nombre  = db.Column(db.String(150), nullable=True)
    empresa_ruc     = db.Column(db.String(20),  nullable=True)
    sede_id         = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    estado          = db.Column(db.Boolean, default=True)

    sugerencias_hechas = db.relationship('SugerenciaInsumo', backref='vendedor', lazy=True)


class CatalogoProducto(db.Model):
    __tablename__ = 'catalogo_productos'
    id                 = db.Column(db.Integer, primary_key=True)
    nombre_modelo      = db.Column(db.String(150), nullable=False)       # campo principal en BD
    nombre             = db.Column(db.String(150), nullable=True)        # columna legacy (no usar)
    categoria          = db.Column(db.String(50),  nullable=True)
    precio_base        = db.Column(db.Numeric(10, 2), nullable=True)
    foto_url           = db.Column(db.Text, nullable=True)
    tipo_producto      = db.Column(db.String(50),  nullable=True)
    requiere_tela      = db.Column(db.Boolean, default=False)
    requiere_madera    = db.Column(db.Boolean, default=False)
    requiere_superficie = db.Column(db.Boolean, default=False)
    es_plantilla       = db.Column(db.Boolean, default=False)
    en_stock           = db.Column(db.Boolean, default=False)
    origen_produccion  = db.Column(db.String(50),  nullable=True)
    stock_cantidad     = db.Column(db.Integer, default=0)

    piezas = db.relationship('PiezaFisica', backref='catalogo', lazy=True)


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


class SugerenciaInsumo(db.Model):
    __tablename__ = 'sugerencias_erp'
    id            = db.Column(db.Integer, primary_key=True)
    nombre_insumo = db.Column(db.String(150), nullable=False)
    vendedor_id   = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    estado        = db.Column(db.String(50), default='Pendiente')
    tipo_origen   = db.Column(db.String(50), nullable=True)
    fecha_sugerencia = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))