# Tasks — Carga del pedido al proveedor por código

## 0. Relevamiento (bloqueante, hecho)

- [x] 0.1 Inspeccionar el Excel real del proveedor (`IMAGO Cuadro Pedido Junio 2026.xls`) y documentar su estructura real (secciones, encabezados por sección, columna CANT, códigos duplicados) — ver design.md

## 1. Modelo de datos

- [x] 1.1 `Product.supplierCode String? @unique` en `schema.prisma`
- [x] 1.2 `PurchaseOrderItem.unitCost` y `PurchaseOrder.total` pasan a nullable (el costo no se auto-completa desde el Excel)
- [x] 1.3 `npx prisma generate` (validado); `db push` contra Supabase real queda pendiente de deploy

## 2. Parser (`scripts/supplier-order-lib.ts`)

- [x] 2.1 `parseSupplierOrderSheet`: máquina de estados por fila (categoría → header de sección → filas de producto), header dinámico por sección, soporte de columna "CANT"
- [x] 2.2 Solo emitir líneas con cantidad > 0; descartar texto suelto sin nombre+código (ej. membrete)
- [x] 2.3 Detección de códigos duplicados dentro del archivo
- [x] 2.4 `buildOrderPlan`: clasificación matched / variante-nueva / producto-nuevo / codigo-duplicado contra el catálogo existente, reutilizando `buildProductSku`/`buildVariantSku` de `import-inventory-lib.ts`
- [x] 2.5 Tests con fixture basada en la estructura real (12 tests) + verificación manual contra el archivo real completo (482 filas, 0 inválidas, duplicados detectados correctamente)

## 3. API admin (`/api/admin/compras/*`)

- [x] 3.1 `POST /api/admin/compras/preview` — recibe el archivo, parsea, arma el plan contra el catálogo (dry-run, no escribe)
- [x] 3.2 `POST /api/admin/compras` — crea productos/variantes nuevos (agrupando por código para no duplicar producto entre talles), crea la orden en estado `PENDIENTE`; rechaza si quedan líneas `codigo-duplicado` sin resolver
- [x] 3.3 `POST /api/admin/compras/[id]/recibir` — `receiveStock()` por ítem + `PurchaseOrder.status = RECIBIDA`; idempotente (409 si ya fue recibida)
- [x] 3.4 `GET /api/admin/compras` — listado de órdenes
- [x] 3.5 Tests de las 3 rutas (12 tests) usando fake-prisma extendido (product/category/supplier/purchaseOrder)

## 4. UI admin

- [x] 4.1 Página `/admin/compras` + componente `CompraUploader`: subir archivo, previsualizar el plan con badges por tipo, editar precio/costo antes de confirmar, listar órdenes con botón "Recibir"
- [x] 4.2 Entrada "Compras" en el sidebar admin
- [x] 4.3 Campo `supplierCode` en el alta/edición manual de producto (mapeo manual para productos ya existentes)

## 5. Verificación

- [x] 5.1 `npx vitest run` — 63/63 tests (suite completa, incluye lo de `unify-inventory-source-of-truth`)
- [x] 5.2 `npx tsc --noEmit` limpio
- [ ] 5.3 Prueba end-to-end manual con `npm run dev` contra una base real: subir el Cuadro de Pedido real, revisar el preview, confirmar, recibir, verificar stock y movimientos en `/admin/stock` — **pendiente: requiere `DATABASE_URL` real (Supabase) y decidir si se corre contra dev o staging**
- [ ] 5.4 Mapear `supplierCode` en los productos ya cargados que correspondan al proveedor, antes de la primera carga real del pedido — **tarea humana (Agustín/Gianluca)**
