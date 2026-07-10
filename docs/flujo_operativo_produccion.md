# Flujo operativo objetivo de Innova

Este documento traduce la operacion real de Innova a una base tecnica para el
ERP. La meta es reemplazar contratos fisicos y coordinacion por WhatsApp por
tarjetas de trabajo, trazabilidad por contrato, stock escaneable y logistica
ordenada por proveedor/insumo.

## Problema actual

- Los contratos viven en papel y el seguimiento operativo ocurre por WhatsApp.
- El catalogo mezcla productos terminados, plantillas, partes e insumos.
- La produccion se apoya en texto libre del carrito, lo que obliga al backend a
  inferir si algo va a estructura, tapiceria, telas, despacho o logistica.
- Logistica externa puede duplicar cotizaciones si no hay una regla clara para
  reutilizar cotizaciones por contrato, proveedor y SKU.
- Stock de tienda y catalogo no tienen una frontera suficientemente fuerte:
  una cosa es vender una unidad fisica ya existente y otra fabricar desde una
  plantilla con partes definidas.

## Modelo mental correcto

## Decisiones confirmadas

- Roles ERP: Admin, Jefe de Taller, Vendedor, Telas, Tapicero, Estructura,
  Cojineria, Despacho y Chofer.
- Cada operario tiene una cuenta propia.
- El sistema trabaja con codigo de barras.
- El area historica "Carpinteria de sofa" pasa a llamarse "Estructura de
  Sofa".
- "Carpinteria" queda reservada como area nueva para futuro.
- El rol/area Telas se usa para ver las telas que se deben comprar, recoger y
  distribuir.
- Prioridad de implementacion: sofas primero, luego sillas/comedor, luego
  mesas/piedras.

### 1. Catalogo

El catalogo debe guardar productos reutilizables con su receta:

- Producto: sofa, silla, comedor, mesa, butaca, cojin, etc.
- Variante o plantilla: medidas, forma, cantidad de plazas, configuracion.
- Componentes: estructura, tela principal, patas o zocalo, cojines, tablero,
  base, silla, tapiz de silla, piedra, etc.
- Origen de cada componente: Interno, Externo, Stock o Pendiente.
- Area responsable cuando es interno.
- Proveedor sugerido cuando es externo.

Una plantilla a medida debe poder guardarse como plantilla de catalogo. Desde
ese momento, cuando se agrega al carrito, debe nacer con sus partes definidas,
no como texto suelto.

### 2. Stock de tienda

Stock de tienda debe representar unidades fisicas reales:

- Cada unidad tiene codigo de barras o QR.
- Cada unidad tiene sede, estado, foto, producto/plantilla origen y medidas.
- Vender stock reserva una unidad especifica.
- Entregar stock cambia la unidad a Vendido.
- Anular una venta devuelve la unidad a Disponible.

Stock de tienda no debe ser el catalogo. El catalogo es la receta/modelo; stock
es la unidad fisica escaneable.

### 3. Contrato

Cada contrato debe crear una orden de produccion por contrato, con items y
componentes estructurados.

Ejemplo:

- Contrato C-001
- Item 1: Sofa
  - Estructura: Interno, area ESTRUCTURAS_MUEBLES, con medidas.
  - Tapiceria: Interno, bloqueado hasta tener estructura y tela.
  - Tela: Externo o Interno/Stock, agrupada en tarjeta de telas del contrato.
  - Patas o zocalo: segun configuracion.
  - Cojines: revisar stock o crear ticket/coordinacion.
- Item 2: Silla comedor
  - Silla: Externo o interno segun maestro.
  - Tela silla: se suma a la tarjeta de telas del mismo contrato.
- Item 3: Mesa centro
  - Tablero/piedra/base: normalmente externo, segun maestro.

### 4. Tarjetas por operario

Cada operario debe ver tarjetas filtradas por su area y rol:

- Estructuras: medidas, modelo, fotos, notas, contrato, fecha.
- Telas/Corte: una tarjeta por contrato, agrupando todas las telas necesarias
  para sofa, silla, comedor, cojines y butaca.
- Tapiceria: bloqueada hasta que estructura este recogida/entregada y la tela
  este distribuida.
- Cojineria: bloqueada hasta que la tela/cojin necesario este listo.
- Despacho: bloqueado hasta que todas las areas terminen.
- Chofer: ficha de entrega con fotos finales, cliente, direccion, productos,
  evidencias y boton Entregado.

Cada area debe subir foto al terminar. Esa foto debe quedar en el ticket y
viajar a la ficha del siguiente responsable.

## Flujo objetivo para sofa

1. Venta agrega sofa desde catalogo o plantilla.
2. El sistema crea item de contrato con componentes estructurados.
3. Crea ticket de estructura con medidas.
4. Crea ticket de tapiceria en Bloqueado.
5. Si lleva patas, busca componentes tipo patas; si lleva zocalo, busca zocalos.
6. La tela se evalua:
   - Si existe stock interno suficiente, va a tarjeta de Telas/Corte.
   - Si es externa y no tiene cotizacion, va a Logistica Externa para cotizar.
   - Si ya tiene cotizacion valida, no se cotiza de nuevo; se manda a compra o
     gestion interna segun estado.
7. Cuando tela llega/se recoge, el operario de telas confirma recojo y sube
   comprobante/foto.
8. Telas distribuye a tapiceria y cojineria si corresponde.
9. Estructuras termina y queda Listo para Recojo, pero no se puede entregar a
   tapiceria si la tela no esta distribuida.
10. Jefe de taller recoge/entrega estructura al tapicero.
11. Tapicero termina, sube foto y el item pasa a despacho.
12. Despacho asigna chofer.
13. Chofer ve ficha con fotos finales y confirma Entregado.
14. El contrato se cierra cuando todos los items estan entregados.

## Logistica externa objetivo

Logistica externa debe tener tres bandejas:

- Requerimientos: lo que falta resolver.
- Cotizaciones: lo que se pidio al proveedor y espera respuesta.
- Compras/Recojos: lo ya cotizado o comprado que debe recogerse, pagarse o
  distribuirse.

Regla clave: no duplicar cotizacion si ya existe una cotizacion vigente para el
mismo contrato, SKU/insumo y proveedor. En ese caso, el nuevo requerimiento se
agrupa a la misma tarjeta.

Las telas deben agruparse por contrato. Si un contrato tiene sofa, silla y
comedor que usan telas, el operario debe ver una sola tarjeta de telas del
contrato con lineas internas por item/componente.

### Estados practicos de logistica externa

Logistica externa no significa "cotizar siempre". Significa que ese componente
no se fabrica directamente en el taller y necesita una gestion externa o de
proveedor.

Aplica a:

- Sillas compradas.
- Butacas compradas.
- Tableros.
- Piedras.
- Bases.
- Patas/zocalos externos.
- Telas externas.
- Insumos especiales de proveedor.

Flujo correcto:

1. `Pendiente` o `POR_PEDIR`: falta definir proveedor, cantidad, unidad o
   confirmar si se compra externo, informal o se fabrica interno.
2. `Cotizacion Enviada`: se pidio precio al proveedor. Aqui no se compra
   todavia; se espera respuesta.
3. `Cotizacion Recibida` o `Cotizado`: ya hay precio/fecha/proveedor. Desde
   aqui no debe volver a cotizarse; el siguiente paso es revisar y generar la
   orden de compra o pedido.
4. `Orden Enviada`: ya se emitio la orden de compra/pedido al proveedor. Debe
   poder descargarse o abrirse el PDF de la orden y enviarse al proveedor.
5. `Pagado`: ya se subio comprobante de pago. Si es tela, queda visible para
   Telas como lista para recojo; si es estructural, pasa a cola de recojo o
   recepcion segun corresponda.
6. `Recibido`: el componente ya llego al taller o tienda. Desde aqui desbloquea
   la parte de produccion o despacho que dependia de ese componente.
7. `Cancelado`: no se compra ni se espera.

Regla importante para cotizaciones ya existentes:

- Si en el mismo contrato ya existe una fila de `logistica_externa` para el
  mismo `sku` y proveedor, se debe reutilizar esa fila y sumar el item/componente
  relacionado, no crear otra cotizacion.
- Si esa fila ya esta `Cotizado`, `Cotizacion Recibida`, `Orden Enviada`,
  `Pagado` o `Recibido`, no se vuelve a mandar cotizacion. El contrato debe
  continuar desde el estado que ya existe.
- Si el componente comparte proveedor con otros componentes del contrato, se
  puede agrupar para pedido/orden, pero sin perder las lineas internas por
  item.

Regla para despacho:

- Despacho no debe mirar solo tickets de taller. Tambien debe esperar que las
  filas de `logistica_externa` del contrato esten resueltas.
- Un contrato se junta para despacho cuando todos sus items y componentes estan
  terminados o recibidos:
  - tickets internos terminados,
  - telas distribuidas,
  - estructuras recogidas/entregadas al tapicero cuando aplique,
  - sillas/tableros/piedras/bases externas recibidas,
  - tapiceria/cojineria terminadas,
  - componentes de stock reservados o entregados.

Regla de comprobantes:

- El comprobante de pago pertenece a la compra/recojo del componente.
- La orden de compra/pedido pertenece al estado `Orden Enviada`.
- Ambos deben quedar asociados a la fila de `logistica_externa` para que el
  contrato tenga trazabilidad completa.

## Base de datos objetivo

La base debe avanzar hacia estas entidades:

- `catalogo_productos`: modelo/plantilla vendible.
- `catalogo_componentes`: receta estructurada del producto.
- `stock_productos` y `stock_piezas`: unidades fisicas escaneables.
- `ventas`: contrato.
- `items_venta`: productos vendidos dentro del contrato.
- `item_componentes_venta`: copia congelada de los componentes usados en la
  venta.
- `tickets_produccion`: tarjetas de trabajo por area.
- `ticket_dependencias`: reglas de bloqueo entre tickets.
- `logistica_externa`: requerimientos de compra/cotizacion/recojo.
- `logistica_grupos`: agrupacion por contrato/proveedor/categoria, especialmente
  telas.
- `ticket_evidencias`: fotos y comprobantes por paso.

## Implementacion por fases

### Fase 1: estabilizar base y flujo actual

- Documentar estados oficiales de tickets y logistica.
- Agregar migraciones para componentes estructurados de venta.
- Evitar inferencias por texto cuando el carrito ya pueda enviar categoria y
  componentes.
- Mejorar consolidacion de logistica para agrupar por contrato, SKU, proveedor
  y categoria.
- Crear endpoint de bandeja de telas por contrato.

### Fase 2: catalogo con receta

- Guardar plantillas con componentes estructurados.
- Separar claramente catalogo de stock fisico.
- Permitir "guardar como plantilla" desde configuracion a medida.
- Soportar reglas de sofa: medidas, tela, patas/zocalo, cojines.

### Fase 3: operarios por tarjetas

- Cada rol ve su bandeja.
- Tickets con bloqueo real en backend.
- Evidencia obligatoria al finalizar cada area.
- Recojo de estructura controlado por jefe de taller.
- Ficha de chofer con fotos finales.

### Fase 4: logistica externa completa

- Cotizacion por proveedor sin duplicados.
- Tarjetas agrupadas por contrato.
- Compra/recojo/distribucion de telas.
- Comprobantes y fotos.
- Historial de proveedor y precio.

### Fase 5: produccion tipo empresa grande

- Codigos QR por unidad, componente y contrato.
- Auditoria por usuario.
- Reportes de tiempos por area.
- Alertas de bloqueos.
- Kardex real de insumos.
- Backups y controles de produccion.
