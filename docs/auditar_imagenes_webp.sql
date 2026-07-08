-- Auditoria de imagenes en Neon/PostgreSQL.
-- Esto no convierte archivos: identifica columnas candidatas y filas con URLs
-- Cloudinary que aun no guardan .webp/f_webp en la base.

-- 1) Ver todas las columnas que probablemente guardan fotos o imagenes.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%foto%'
    OR column_name ILIKE '%imagen%'
    OR column_name ILIKE '%url%'
  )
ORDER BY table_name, column_name;

-- 2) Generar SELECTs para revisar URLs Cloudinary sin marca WebP.
-- Copia y ejecuta los SELECT que te interesen del resultado.
SELECT format(
    'SELECT %L AS tabla, %L AS columna, id, %I AS url FROM %I WHERE %I ILIKE %L AND %I NOT ILIKE %L AND %I NOT ILIKE %L LIMIT 50;',
    table_name,
    column_name,
    column_name,
    table_name,
    column_name,
    '%res.cloudinary.com%',
    column_name,
    '%f_webp%',
    column_name,
    '%.webp%'
) AS consulta_revision
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN (
    'foto_url',
    'fotos_urls',
    'foto_ref',
    'foto',
    'url',
    'comprobante_url',
    'url_comprobante'
  )
ORDER BY table_name, column_name;

-- 3) Si quieres convertir fisicamente los assets antiguos en Cloudinary:
-- no lo hagas con UPDATE directo a la BD. Primero exporta esas URLs,
-- ejecuta una migracion con la Admin API de Cloudinary que cree derivados WebP,
-- y luego actualiza la URL solo si el recurso nuevo existe.
-- En este ERP ya se entrega WebP al vuelo desde database.limpiar_foto().
