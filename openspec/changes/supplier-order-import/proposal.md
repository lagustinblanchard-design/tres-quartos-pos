## Why

La reposición de stock hoy es manual: se arma el pedido al proveedor en un Excel, y al llegar la mercadería alguien carga prenda por prenda en el sistema. El proveedor principal (IMAGO Indumentarias) ya identifica cada producto con un **código propio** en su "Cuadro de Pedido". Reutilizar ese mismo archivo como entrada de carga elimina la doble tipeada y la principal fuente de error humano en la reposición.

## What Changes

- `Product` gana un campo `supplierCode` (único, opcional) que mapea el producto interno al código del proveedor.
- Nuevo parser (`scripts/supplier-order-lib.ts`) que lee el Cuadro de Pedido del proveedor — una matriz con secciones por categoría, encabezado de talles propio por sección, y una columna "CANT" para productos sin talle (ej. pelotas) — y lo convierte en líneas de pedido, emitiendo solo las combinaciones producto×talle con cantidad cargada (el pedido real nunca cubre todo el catálogo del proveedor).
- Nuevo flujo admin (`/admin/compras`): subir el Excel → previsualizar el plan de compra (clasificado en directo / talle nuevo / producto nuevo / código duplicado) → confirmar → la orden queda `PENDIENTE` → **recibir** suma el stock recién en ese momento (nunca al cargar el Excel).
- Activa los modelos `Supplier`/`PurchaseOrder`/`PurchaseOrderItem` de `schema.prisma`, que existían sin uso.
- El costo por unidad **no se auto-completa** desde el Excel del proveedor: sus columnas de precio son por rango de talle (niños/adultos/especial) sin una regla fija de qué talles caen en qué rango, así que se carga a mano (opcional, editable en el preview o después).

## Capabilities

### New Capabilities

- `purchase-order-import`: parseo del Cuadro de Pedido del proveedor, clasificación contra el catálogo existente por `supplierCode`, y flujo de confirmación/recepción que sólo suma stock al confirmar la llegada de la mercadería.

### Modified Capabilities

<!-- `inventory-core` (del change unify-inventory-source-of-truth) todavía no está archivado como spec base en openspec/specs/, así que no hay contra qué generar un delta formal. El detalle del ajuste de nullability en PurchaseOrder/PurchaseOrderItem queda documentado en design.md §D3. -->

## Impact

- **`tq-ecommerce`**: schema (`Product.supplierCode`, nullability de costo en `PurchaseOrder*`), `scripts/supplier-order-lib.ts` (nuevo, reutiliza `buildProductSku`/`buildVariantSku`/`productSlug`/`categoryCode`/`slugify` de `import-inventory-lib.ts`), 3 rutas nuevas bajo `/api/admin/compras/*`, página `/admin/compras` + componente `CompraUploader`, campo `supplierCode` agregado al alta/edición manual de productos.
- **POS Flask**: sin cambios — este flujo vive enteramente en el admin del ecommerce, igual que el resto de la gestión de catálogo.
- **Datos**: ningún dato existente se modifica; `supplierCode` es nullable y no rompe productos que no lo tengan.
