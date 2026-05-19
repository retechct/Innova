from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz

db = SQLAlchemy()

# Zona horaria de Perú para los registros
tz_peru = pytz.timezone('America/Lima')

class Sede(db.Model):
    __tablename__ = 'sedes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False) # Ej: Tienda del Medio, Taller
    tipo = db.Column(db.String(50), nullable=False)    # Ej: Tienda, Taller+Tienda
    
    # Relaciones
    usuarios = db.relationship('Usuario', backref='sede_origen', lazy=True)
    piezas = db.relationship('PiezaFisica', backref='sede_actual', lazy=True)

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(50), nullable=False) # Admin, Vendedor, Jefe de taller, Chofer, Operario
    sede_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True) # Sede donde está operando
    estado = db.Column(db.Boolean, default=True)

class CatalogoProducto(db.Model):
    __tablename__ = 'catalogo_productos'
    # Esto unifica tus CSV: maestro_sillas, maestro_tableros, maestro_telas, etc.
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    tipo_producto = db.Column(db.String(50), nullable=False) # 'Entero' (Sofá) o 'Compuesto' (Base comedor)
    categoria = db.Column(db.String(50), nullable=False)     # Tela, Tablero, Silla, Espejo, etc.
    
    piezas = db.relationship('PiezaFisica', backref='catalogo', lazy=True)

class PiezaFisica(db.Model):
    __tablename__ = 'piezas_fisicas'
    # ESTO ES EL INVENTARIO REAL - Cada objeto físico tiene 1 fila aquí
    id = db.Column(db.Integer, primary_key=True)
    codigo_interno = db.Column(db.String(50), unique=True, nullable=False) # Para futuro cód. de barras
    catalogo_id = db.Column(db.Integer, db.ForeignKey('catalogo_productos.id'), nullable=False)
    sede_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=False)
    
    # Estados del Plan Maestro: Disponible, Reservado, En traslado, En producción, Dado de baja
    estado = db.Column(db.String(50), default='Disponible', nullable=False)
    costo_ingreso = db.Column(db.Numeric(10, 2), nullable=False) # Para saber ganancia neta luego
    
    fecha_ingreso = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    
    # Relación con su historial
    movimientos = db.relationship('MovimientoKardex', backref='pieza', lazy=True)

class MovimientoKardex(db.Model):
    __tablename__ = 'movimientos_kardex'
    # HISTORIAL INTOCABLE: ¿Qué le pasó a la pieza, quién lo hizo y cuándo?
    id = db.Column(db.Integer, primary_key=True)
    pieza_id = db.Column(db.Integer, db.ForeignKey('piezas_fisicas.id'), nullable=False)
    
    # Tipos: Ingreso, Traslado, Reserva, Incidencia, Salida definitiva
    tipo_evento = db.Column(db.String(50), nullable=False) 
    
    sede_origen_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    sede_destino_id = db.Column(db.Integer, db.ForeignKey('sedes.id'), nullable=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    
    fecha = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    notas = db.Column(db.String(255), nullable=True) # Ej: "Se rompió en tránsito", "Venta #001"
    
class SugerenciaInsumo(db.Model):
    __tablename__ = 'sugerencias_erp'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre_insumo = db.Column(db.String(150), nullable=False)
    vendedor_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    
    # Pendiente, Aprobado (pasa al catálogo), o Rechazado
    estado = db.Column(db.String(50), default='Pendiente') 
    
    # Aquí el Admin indicará si es Interno o Externo al aprobarlo
    tipo_origen = db.Column(db.String(50), nullable=True) 
    
    fecha_sugerencia = db.Column(db.DateTime, default=lambda: datetime.now(tz_peru))
    
    # Relación con el usuario que la creó
    vendedor = db.relationship('Usuario', backref='sugerencias_hechas', lazy=True)