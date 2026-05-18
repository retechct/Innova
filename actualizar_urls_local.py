import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    host     = os.getenv("DB_HOST"),
    database = os.getenv("DB_NAME"),
    user     = os.getenv("DB_USER"),
    password = os.getenv("DB_PASSWORD"),
)
cur = conn.cursor()

CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
BASE_URL   = f"https://res.cloudinary.com/{CLOUD_NAME}/image/upload/uploads"

# URL local del backend anterior
LOCAL_PREFIX = "http://127.0.0.1:5000/uploads/"

TABLAS = [
    ("catalogo_productos",    "foto_url"),
    ("maestro_telas",         "foto_url"),
    ("maestro_disenos_cojin", "foto_url"),
    ("maestro_bases",         "foto_url"),
    ("maestro_tableros",      "foto_url"),
    ("maestro_bases_comedor", "foto_url"),
    ("maestro_sillas",        "foto_url"),
    ("maestro_butacas",       "foto_url"),
    ("items_venta",           "foto_url"),
    ("fotos_creaciones",      "foto_url"),
]

total = 0

for tabla, columna in TABLAS:
    try:
        cur.execute(f"""
            SELECT id, {columna} FROM {tabla}
            WHERE {columna} LIKE %s
        """, (LOCAL_PREFIX + '%',))
        filas = cur.fetchall()

        if not filas:
            print(f"✅ {tabla}: sin URLs locales")
            continue

        print(f"\n📋 {tabla}: {len(filas)} registros a actualizar")
        for fila_id, url_actual in filas:
            # Extraer solo el nombre del archivo
            nombre = url_actual.replace(LOCAL_PREFIX, '')
            nueva_url = f"{BASE_URL}/{nombre}"

            cur.execute(f"UPDATE {tabla} SET {columna} = %s WHERE id = %s", (nueva_url, fila_id))
            print(f"   [{fila_id}] {nombre}")
            print(f"         → {nueva_url}")
            total += 1

    except Exception as e:
        print(f"❌ Error en {tabla}: {e}")
        conn.rollback()

conn.commit()
cur.close()
conn.close()

print("\n" + "=" * 50)
print(f"✅ Total actualizados: {total}")
print("=" * 50)
print("🎉 ¡Listo! Recarga tu sistema en Render.")