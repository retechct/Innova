"""Constantes operativas del ERP Innova.

Mantener roles, areas y aliases en un solo lugar evita que el flujo de taller
dependa de nombres escritos a mano en cada endpoint.
"""

ROLES_ERP = {
    "Admin",
    "Jefe_Taller",
    "Vendedor",
    "Operario",
    "Chofer",
}

AREAS_PRODUCCION = {
    "ESTRUCTURAS_MUEBLES": "Estructura de Sofa",
    "ESTRUCTURAS_SILLAS": "Estructura de Sillas",
    "CARPINTERIA": "Carpinteria",
    "CORTE_Y_CONTROL_TELAS": "Telas",
    "TELAS": "Telas",
    "TAPICERIA_SOFAS": "Tapiceria Sofa",
    "TAPICERIA_SILLAS": "Tapiceria Sillas",
    "ARMADO_COJINES": "Cojineria",
    "DESPACHO_CENTRAL": "Despacho",
    "DESPACHO": "Despacho",
    "PREPARACION_PATAS_ZOCALO": "Patas y Zocalos",
    "TABLEROS_Y_PIEDRAS": "Tableros y Piedras",
}

AREA_ALIASES = {
    "CORTE_Y_CONTROL_TELAS": ["CORTE_Y_CONTROL_TELAS", "TELAS"],
    "TELAS": ["TELAS", "CORTE_Y_CONTROL_TELAS"],
    "TAPICERIA_SOFAS": ["TAPICERIA_SOFAS", "TAPICERIA"],
    "TAPICERIA_SILLAS": ["TAPICERIA_SILLAS", "TAPICERIA"],
    "ESTRUCTURAS_MUEBLES": ["ESTRUCTURAS_MUEBLES", "ESTRUCTURAS"],
    "ESTRUCTURAS_SILLAS": ["ESTRUCTURAS_SILLAS", "ESTRUCTURAS"],
    "CARPINTERIA": ["CARPINTERIA"],
    "ARMADO_COJINES": ["ARMADO_COJINES", "COJINES"],
    "PREPARACION_PATAS_ZOCALO": ["PREPARACION_PATAS_ZOCALO", "PATAS", "ZOCALO"],
    "TABLEROS_Y_PIEDRAS": ["TABLEROS_Y_PIEDRAS", "TABLEROS"],
    "DESPACHO_CENTRAL": ["DESPACHO_CENTRAL", "DESPACHO"],
    "DESPACHO": ["DESPACHO", "DESPACHO_CENTRAL"],
}


def aliases_area(area):
    area_upper = (area or "").upper()
    aliases = AREA_ALIASES.get(area_upper, [area_upper])
    return list(dict.fromkeys([a.upper() for a in aliases] + [area_upper]))
