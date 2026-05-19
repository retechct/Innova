from flask import Blueprint, request, jsonify
from models import db, Sede, CatalogoProducto, PiezaFisica

# Creamos el Blueprint para el módulo Kardex
kardex_bp = Blueprint('kardex', __name__)

# ==========================================
# RUTA ESPECIAL: Inicializar Sedes Base
# ==========================================
@kardex_bp.route('/inicializar-sedes', methods=['POST'])
def inicializar_sedes():
    # Verificar si ya existen sedes para no duplicar
    if Sede.query.first():
        return jsonify({'mensaje': 'Las sedes ya fueron inicializadas previamente.'}), 200
        
    sedes_base = [
        {'nombre': 'Tienda del Medio', 'tipo': 'Tienda'},
        {'nombre': 'Tienda Grande', 'tipo': 'Tienda'},
        {'nombre': 'Tienda de Plaza Vea', 'tipo': 'Tienda'},
        {'nombre': 'Tienda del Sol', 'tipo': 'Tienda'},
        {'nombre': 'Taller', 'tipo': 'Taller + Tienda'}
    ]
    
    for s in sedes_base:
        nueva_sede = Sede(nombre=s['nombre'], tipo=s['tipo'])
        db.session.add(nueva_sede)
        
    db.session.commit()
    return jsonify({'mensaje': 'Las 5 sedes operativas han sido creadas con éxito.'}), 201

# ==========================================
# RUTAS PARA LAS SEDES
# ==========================================
@kardex_bp.route('/sedes', methods=['GET'])
def obtener_sedes():
    sedes = Sede.query.all()
    resultado = [{'id': s.id, 'nombre': s.nombre, 'tipo': s.tipo} for s in sedes]
    return jsonify(resultado), 200

# ==========================================
# RUTAS PARA EL CATÁLOGO
# ==========================================
@kardex_bp.route('/catalogo', methods=['GET'])
def obtener_catalogo():
    productos = CatalogoProducto.query.all()
    resultado = [{
        'id': p.id, 
        'nombre': p.nombre, 
        'tipo_producto': p.tipo_producto, 
        'categoria': p.categoria
    } for p in productos]
    return jsonify(resultado), 200

@kardex_bp.route('/catalogo', methods=['POST'])
def crear_producto_catalogo():
    data = request.json
    if not data or not data.get('nombre') or not data.get('tipo_producto') or not data.get('categoria'):
        return jsonify({'error': 'Faltan campos obligatorios en el catálogo'}), 400
        
    nuevo_producto = CatalogoProducto(
        nombre=data['nombre'],
        tipo_producto=data['tipo_producto'], # 'Entero' o 'Compuesto'
        categoria=data['categoria']          # 'Sofá', 'Mesa', 'Tela', etc.
    )
    db.session.add(nuevo_producto)
    db.session.commit()
    
    return jsonify({'mensaje': 'Producto agregado al catálogo', 'id': nuevo_producto.id}), 201