# Plan tecnico para convertir Innova en un ERP solido

Este documento ordena las mejoras por impacto operativo. La meta no es
reescribir todo: es bajar riesgo, hacer el sistema mantenible y permitir que
cada modulo crezca sin romper ventas, taller, inventario o logistica.

## 1. Seguridad y sesiones

- Mantener `JWT_SECRET_KEY` obligatorio en entorno.
- No devolver tracebacks ni errores internos al navegador en produccion.
- Usar `password_hash` para usuarios internos. `contrasena` y `pin_acceso`
  quedan solo como compatibilidad legacy.
- Migrar usuarios antiguos al hash durante login por correo/contrasena.
- Auditar `innerHTML` por modulo y envolver datos variables con `escapeHTML`
  o `escapeAttr`.
- A mediano plazo, mover access/refresh tokens desde `localStorage` hacia
  cookies `HttpOnly` cuando el frontend y backend compartan dominio estable.

## 2. Base de datos y migraciones

- Dejar de crear o alterar tablas dentro de requests normales.
- Consolidar un esquema base reproducible: `schema_completo.sql` o Alembic
  puro con `DATABASE_URL`.
- Cada cambio de estructura debe vivir en una migracion revisable.
- Los helpers `_asegurar_*` pueden quedarse temporalmente como red de seguridad,
  pero no deben ser la fuente principal del esquema.

## 3. Backend

- Dividir `routes_produccion.py` por dominio:
  - taller
  - logistica
  - despacho
  - cotizaciones
  - stock de estructuras
- Dividir `routes_ventas.py` en ventas, contratos, precios, comisiones y
  exportaciones.
- Centralizar respuestas de error: mensajes genericos para usuarios, logs
  detallados para servidor.
- Centralizar SQL dinamico con listas blancas explicitas para tablas/columnas.
- Agregar validadores de payload por endpoint antes de tocar base de datos.

## 4. Frontend

- Reducir `index.html` y scripts grandes en pantallas/modulos cargables.
- Evitar concatenar HTML con datos de usuario sin escape.
- Usar `textContent` cuando se pinta texto simple.
- Mantener estados de carga, vacio y error en todos los modulos operativos.
- Normalizar helpers de API: todo endpoint protegido debe pasar por `apiFetch`.

## 5. Pruebas minimas

Crear pruebas para:

- Login por PIN.
- Login por correo con hash y compatibilidad legacy.
- Refresh token.
- Permisos por rol.
- Registro de venta.
- Movimiento de inventario.
- Cotizacion por token de proveedor.
- Exportaciones criticas.

## 6. Operacion

- Variables requeridas: `JWT_SECRET_KEY`, `DB_HOST`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`.
- Variables recomendadas: `FRONTEND_URL`, `BACKEND_URL`, `DB_POOL_MAXCONN`.
- Activar `DEBUG_API_ERRORS=true` solo en desarrollo o diagnostico temporal.
