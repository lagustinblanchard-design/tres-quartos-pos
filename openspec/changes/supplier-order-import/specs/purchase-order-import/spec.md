# purchase-order-import — Carga del pedido al proveedor por código

## ADDED Requirements

### Requirement: Parseo del Cuadro de Pedido por secciones
El sistema SHALL parsear el Cuadro de Pedido del proveedor como una matriz con múltiples secciones, cada una con su propia fila de encabezado (`MODELOS`, `CODIGO`, seguido de las columnas de talle vigentes para esa sección). El set de talles reconocido SHALL poder variar de una sección a otra dentro del mismo archivo.

#### Scenario: Dos secciones con distinto set de talles
- **WHEN** una sección declara talles `XS,S,M,L,XL,2XL,3XL,4XL` y la siguiente declara solo `S,M,L,XL,2XL,3XL`
- **THEN** cada fila de producto se interpreta usando el mapeo columna→talla de su propia sección

#### Scenario: Sección sin talles (columna CANT)
- **WHEN** una sección usa una columna "CANT" en vez de talles (ej. pelotas)
- **THEN** las líneas emitidas para esa sección tienen talla vacía y la cantidad se toma de esa columna

### Requirement: Solo se emiten líneas con cantidad pedida
El parser SHALL emitir una línea de pedido únicamente para las combinaciones producto×talle con una cantidad numérica mayor a cero cargada en esa celda. Las combinaciones sin cantidad (la mayoría del catálogo del proveedor en un pedido típico) NO SHALL generar líneas.

#### Scenario: Producto sin ninguna cantidad cargada
- **WHEN** una fila de producto no tiene ningún valor mayor a cero en sus columnas de talle
- **THEN** no se emite ninguna línea de pedido para esa fila

### Requirement: Detección de código de proveedor duplicado dentro del archivo
El sistema SHALL detectar cuando un mismo código de proveedor aparece en más de una fila de producto dentro del mismo archivo, y SHALL marcar todas las líneas de ese código como `codigo-duplicado` sin asignarlas automáticamente a ningún producto.

#### Scenario: Código repetido en dos filas de color distinto
- **WHEN** el archivo tiene dos filas de producto con el mismo código de proveedor
- **THEN** todas las líneas de ese código se marcan como `codigo-duplicado` y quedan excluidas de la creación automática de la orden

### Requirement: Clasificación contra el catálogo existente
Cada línea de pedido válida (código no duplicado) SHALL clasificarse, contra el catálogo indexado por `supplierCode`, en una de: `matched` (producto y variante de ese talle ya existen), `variante-nueva` (el producto existe pero falta la variante de ese talle) o `producto-nuevo` (el código no está registrado en ningún producto).

#### Scenario: Código conocido, talle nuevo
- **WHEN** el código de proveedor de una línea corresponde a un producto existente pero ese producto no tiene variante para el talle pedido
- **THEN** la línea se clasifica como `variante-nueva` con el producto existente identificado

#### Scenario: Código no registrado
- **WHEN** el código de proveedor de una línea no corresponde a ningún `Product.supplierCode` existente
- **THEN** la línea se clasifica como `producto-nuevo`

### Requirement: El stock se suma solo al confirmar la recepción
Cargar y confirmar un pedido SHALL crear una orden de compra en estado `PENDIENTE` sin modificar el stock de ninguna variante. El stock SHALL incrementarse únicamente cuando se confirma la recepción de esa orden, mediante el mismo mecanismo auditado (`StockMovement` tipo `ENTRADA`) usado en el resto del sistema.

#### Scenario: Confirmar el pedido no altera el stock
- **WHEN** se confirma un pedido con ítems `matched` y `producto-nuevo`
- **THEN** la orden queda en estado `PENDIENTE` y el stock de las variantes involucradas no cambia

#### Scenario: Recibir la orden suma el stock
- **WHEN** se confirma la recepción de una orden `PENDIENTE`
- **THEN** el stock de cada variante aumenta en la cantidad pedida, queda un `StockMovement` tipo `ENTRADA` por ítem, y la orden pasa a estado `RECIBIDA`

#### Scenario: Una orden ya recibida no se puede recibir de nuevo
- **WHEN** se intenta confirmar la recepción de una orden que ya está en estado `RECIBIDA`
- **THEN** la operación se rechaza sin modificar el stock

### Requirement: El código de proveedor duplicado no se resuelve automáticamente en ningún punto del flujo
Ni la previsualización ni la confirmación de la orden SHALL asignar productoId/varianteId a una línea marcada como `codigo-duplicado`. Confirmar una orden con líneas en ese estado SHALL rechazarse.

#### Scenario: Intentar confirmar con duplicados sin resolver
- **WHEN** se envía una orden a confirmar que incluye líneas `codigo-duplicado`
- **THEN** la creación de la orden se rechaza indicando los códigos en conflicto
