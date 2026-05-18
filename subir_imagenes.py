import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key    = os.getenv('CLOUDINARY_API_KEY'),
    api_secret = os.getenv('CLOUDINARY_API_SECRET')
)

CARPETA_UPLOADS = 'uploads'  # Ruta relativa desde donde ejecutas el script

EXTENSIONES = ('.jpg', '.jpeg', '.png', '.webp', '.gif')

def subir_todas():
    archivos = [f for f in os.listdir(CARPETA_UPLOADS) if f.lower().endswith(EXTENSIONES)]
    total = len(archivos)
    print(f"📁 Se encontraron {total} imágenes en '{CARPETA_UPLOADS}'\n")

    subidas = 0
    errores = 0

    for i, archivo in enumerate(archivos, 1):
        ruta_local = os.path.join(CARPETA_UPLOADS, archivo)
        nombre_sin_ext = os.path.splitext(archivo)[0]

        try:
            resultado = cloudinary.uploader.upload(
                ruta_local,
                folder="uploads",
                public_id=nombre_sin_ext,
                overwrite=False  # No sobreescribe si ya existe
            )
            url = resultado.get('secure_url')
            print(f"[{i}/{total}] ✅ {archivo}")
            print(f"         → {url}\n")
            subidas += 1
        except Exception as e:
            print(f"[{i}/{total}] ❌ {archivo} — Error: {e}\n")
            errores += 1

    print("=" * 50)
    print(f"✅ Subidas: {subidas}  |  ❌ Errores: {errores}")
    print("=" * 50)
    print("\n✅ Listo. Ahora tus imágenes están en Cloudinary.")
    print("   Las URLs tienen el formato:")
    print("   https://res.cloudinary.com/TU_CLOUD/image/upload/uploads/NOMBRE_ARCHIVO")

if __name__ == '__main__':
    subir_todas()