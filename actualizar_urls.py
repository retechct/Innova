import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# ── Conexión a Neon ──────────────────────────────────────────
conn = psycopg2.connect(
    host     = os.getenv("DB_HOST"),
    database = os.getenv("DB_NAME"),
    user     = os.getenv("DB_USER"),
    password = os.getenv("DB_PASSWORD"),
)
cur = conn.cursor()

# ── Tu cloud name de Cloudinary ──────────────────────────────
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
BASE_URL   = f"https://res.cloudinary.com/{CLOUD_NAME}/image/upload/uploads"

# ── Tablas y columnas que tienen foto_url ────────────────────
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
    ("creaciones_vendedores", "foto_url"),
]

def limpiar_nombre(url):
    """Extrae solo el nombre de archivo de una ruta local."""
    return os.path.basename(url)

total_actualizadas = 0

for tabla, columna in TABLAS:
    try:
        # Traer registros con URLs locales (no empiezan con http)
        cur.execute(f"""
            SELECT id, {columna} FROM {tabla}
            WHERE {columna} IS NOT NULL
              AND {columna} != ''
              AND {columna} NOT LIKE 'http%'
              AND {columna} NOT LIKE 'imagenes/sin_foto%'
        """)
        filas = cur.fetchall()

        if not filas:
            print(f"✅ {tabla}: sin URLs locales que actualizar")
            continue

        print(f"\n📋 {tabla}: {len(filas)} registros a actualizar")

        for fila_id, url_actual in filas:
            nombre = limpiar_nombre(url_actual)
            nueva_url = f"{BASE_URL}/{nombre}"

            cur.execute(f"""
                UPDATE {tabla} SET {columna} = %s WHERE id = %s
            """, (nueva_url, fila_id))

            print(f"   [{fila_id}] {url_actual}")
            print(f"         → {nueva_url}")
            total_actualizadas += 1

    except Exception as e:
        print(f"❌ Error en tabla {tabla}: {e}")
        conn.rollback()
        continue

# ── También actualizar fotos_creaciones ─────────────────────
try:
    cur.execute("""
        SELECT id, foto_url FROM fotos_creaciones
        WHERE foto_url IS NOT NULL
          AND foto_url != ''
          AND foto_url NOT LIKE 'http%'
    """)
    filas = cur.fetchall()
    if filas:
        print(f"\n📋 fotos_creaciones: {len(filas)} registros a actualizar")
        for fila_id, url_actual in filas:
            nombre = limpiar_nombre(url_actual)
            nueva_url = f"{BASE_URL}/{nombre}"
            cur.execute("UPDATE fotos_creaciones SET foto_url = %s WHERE id = %s", (nueva_url, fila_id))
            print(f"   [{fila_id}] {url_actual} → {nueva_url}")
            total_actualizadas += 1
    else:
        print("✅ fotos_creaciones: sin URLs locales que actualizar")
except Exception as e:
    print(f"❌ Error en fotos_creaciones: {e}")

conn.commit()
cur.close()
conn.close()

print("\n" + "=" * 50)
print(f"✅ Total de registros actualizados: {total_actualizadas}")
print("=" * 50)
print("\n🎉 ¡Listo! Todas las URLs apuntan ahora a Cloudinary.")