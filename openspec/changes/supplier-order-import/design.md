## Context

Relevamiento del archivo real (`IMAGO Cuadro Pedido Junio 2026.xls`, hoja "Hoja1", 482 filas) — esto reemplazó varios supuestos del approach inicial:

- No es una tabla plana: son **múltiples secciones** (CAMISETAS, SHORTS RUGBY, BOXERS, PELOTAS N° 5, ...), cada una con su propia fila de encabezado (`MODELOS | CODIGO | <talles...>`). El set de talles **varía por sección** (algunas tienen 8/10/12/14/XS..4XL, otras solo XS-XL, "PELOTAS" usa una columna "CANT" sin talle).
- La columna `CODIGO` es el identificador estable del proveedor (confirmado: identifica el **producto**, no la variante — los talles son columnas dentro de esa misma fila).
- El archivo real tiene **códigos duplicados genuinos** (6101, 6102, 7101, 7102, 8000, 8101 — dos filas de color/modelo distinto comparten el mismo código, error del proveedor). El parser debe tolerarlo sin romperse y sin auto-resolverlo.
- Hay texto suelto fuera de la grilla (membrete "IMAGO INDUMENTARIAS S.A." en la columna B, fila 1) que no es un código de producto — se descarta si falta el nombre (columna A).
- Las columnas de precio (NIÑOS/ADULTOS/ESPECIAL o PRECIO según la sección) no tienen una regla fija de qué talles caen en qué rango — confirmado matemáticamente contra el único ejemplo cargado en la plantilla (6 unidades × $29.680 = $178.080, el total de la fila). Automatizar esto sería adivinar con datos de un solo caso.

## Goals / Non-Goals

**Goals:**
- Cargar el Cuadro de Pedido tal cual lo genera el proveedor, sin edición previa.
- Sumar stock solo al confirmar recepción, nunca al cargar el pedido.
- Tolerar códigos duplicados y datos nuevos (producto/talle inexistente) sin romper el parseo.

**Non-Goals:**
- Auto-completar el costo por talle desde las columnas de precio del proveedor (ver Context — ambiguo, se decidió no adivinar).
- Soporte multi-proveedor con esquemas de código distintos (un proveedor principal hoy; `supplierCode` único alcanza).
- Enviar el pedido al proveedor automáticamente (email/API) — solo se carga el archivo que ya se le manda.

## Decisions

### D1 — Parser basado en máquina de estados por fila, no en un header fijo

El parser recorre las filas manteniendo `categoriaActual` y `tallaColumns` (mapa columna→talla), que se reinicia cada vez que encuentra una fila `MODELOS|CODIGO`. Esto es lo único que soporta correctamente el hecho de que cada sección declara su propio set de talles.
**Alternativa descartada**: asumir un header único al principio del archivo (como hace `convertir_excel.py` para el Excel de stock) — no sirve acá porque el header cambia por sección.

### D2 — Códigos duplicados: detectar y bloquear, nunca auto-resolver

`parseSupplierOrderSheet` devuelve `duplicateCodigos` (códigos que aparecen en más de una fila de producto). `buildOrderPlan` marca esas líneas como `codigo-duplicado` y no les asigna producto: la UI las excluye del pedido y pide corregir el Excel o mapear a mano.
**Alternativa descartada**: quedarse con la primera aparición — mezclaría dos productos distintos bajo un mismo código sin que nadie lo note.

### D3 — Costo no se auto-parsea; `unitCost`/`total` pasan a nullable

Dado que no hay regla confiable de qué columna de precio corresponde a qué talle, el costo se deja para carga manual (editable en el preview antes de confirmar, o después). Esto requirió hacer `PurchaseOrderItem.unitCost` y `PurchaseOrder.total` nullable — antes eran `NOT NULL` pero estos modelos no tenían ningún uso real todavía, así que el cambio es seguro.
**Alternativa descartada**: inferir el rango de precio por posición de columna (kids=8/10/12/14, adultos=XS-2XL, especial=3XL-4XL) — matemáticamente consistente con el único ejemplo disponible, pero extrapolar una regla de un solo caso a todo el archivo es alto riesgo para un dato de plata. Se puede revisar si en el futuro hay más pedidos reales para validar el patrón.

### D4 — El stock se suma solo al confirmar recepción

`POST /api/admin/compras` crea la orden en estado `PENDIENTE` sin tocar stock (solo crea productos/variantes nuevas si hace falta, con `stock: 0`). `POST /api/admin/compras/[id]/recibir` es quien llama a `receiveStock()` (ya existente en `src/lib/inventory.ts`, del change `unify-inventory-source-of-truth`) — mismo patrón que ya usa el resto del sistema, sin código nuevo de mutación de stock.

### D5 — SKU de productos/variantes nuevos: mismo generador que el importador de Excel

Cuando el código de proveedor no existe todavía, se crea el producto con `buildProductSku`/`buildVariantSku` de `import-inventory-lib.ts` (formato `TQ-<CAT>-<slug>-<TALLA>`), igual que en `unify-inventory-source-of-truth`. Mantiene un único esquema de SKU interno sin importar por qué canal entró el producto.

## Risks / Trade-offs

- **[Precio de venta desconocido para productos/variantes nuevos]** → se crean con `price: 0` (o el valor que cargue el admin en el preview) — no vendible hasta que alguien fije el precio; es una limitación explícita, no un bug.
- **[El nombre del Cuadro de Pedido puede incluir un identificador extra, ej. "ARGENTINA AZUL #850"]** → se usa tal cual como nombre de producto; no se intenta parsear/limpiar el sufijo `#NNNN` (no es el `supplierCode`, es un dato decorativo del proveedor).
- **[Hoja de cálculo cambia de estructura mes a mes]** → el parser es tolerante a variaciones de columnas de talle por sección, pero si el proveedor cambia el layout general (otras palabras clave, no "MODELOS"/"CODIGO"/"CANT") habrá que ajustarlo — se valida con cada archivo real que llegue vía el preview (dry-run visible antes de confirmar).

## Migration Plan

1. `npx prisma db push` (o migración formal si ya hay datos de producción en `PurchaseOrder`/`PurchaseOrderItem` — hoy no los hay).
2. Mapear manualmente `supplierCode` en los productos existentes que correspondan (vía el formulario de producto) para que la primera carga del Cuadro de Pedido los reconozca como "matched" en vez de "producto nuevo".
3. Cargar el primer pedido real y revisar el preview con atención antes de confirmar (especialmente los códigos duplicados que el proveedor ya tiene en su archivo).

## Open Questions

- ¿Vale la pena, con más pedidos reales, confirmar si la regla niños=8/10/12/14 / adultos=XS-2XL / especial=3XL-4XL es consistente en todas las secciones? Si se confirma, se podría ofrecer el costo sugerido (editable) en vez de dejarlo en blanco.
