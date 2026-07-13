# Unificar el inventario: fuente única de stock

## Why

Hoy el stock de TresQuartos vive en 4 lugares que no se hablan entre sí: un Excel en Dropbox (desactualizado y sin espacio disponible), TiendaNube (desactualizado), la base del POS Flask (`variantes.stock`) y la base del ecommerce nuevo (`product_variants.stock`). Nadie sabe cuál es el stock real, lo que produce sobreventa online, quiebres de stock invisibles y horas de conciliación manual. Antes de migrar de TiendaNube al ecommerce propio, se necesita UNA fuente de verdad de inventario que alimente tanto el POS como la tienda online.

## What Changes

- La base PostgreSQL del ecommerce (`tq-ecommerce`, esquema Prisma) pasa a ser la **única fuente de verdad** de productos, variantes y stock. Todo cambio de stock queda registrado en el ledger `StockMovement` (ya modelado, hoy sin uso obligatorio).
- Se crea un **importador de inventario inicial** que toma el Excel matriz (formato actual de Dropbox, ya parseado por `convertir_excel.py`) y lo carga en la base canónica, con un paso de **conciliación**: reporte de diferencias (Excel vs. base vs. conteo físico) antes de confirmar, para no consagrar datos desactualizados como verdad.
- El **POS Flask deja de tener stock propio**: sus operaciones de venta, compra/recepción e inventario leen y escriben el stock canónico a través de una API de inventario expuesta por `tq-ecommerce`. Las tablas `productos`/`variantes` del POS dejan de ser autoritativas. **BREAKING**: el POS ya no funciona sin conectividad a la base canónica (se define comportamiento de contingencia en design).
- Toda mutación de stock (venta POS, venta online, recepción de compra, ajuste manual, devolución) pasa por una única operación atómica de descuento/incremento con validación de stock disponible, generando siempre un `StockMovement` con motivo y referencia.
- El Excel de Dropbox y el stock de TiendaNube quedan **de solo lectura / legado**: el Excel se archiva tras la importación; TiendaNube se actualiza manualmente o se congela hasta el switchover (fuera de alcance automatizarlo).

## Capabilities

### New Capabilities

- `inventory-core`: stock canónico por variante en la base del ecommerce; reglas de mutación atómica, validación de disponibilidad, ledger obligatorio de movimientos (`StockMovement`) y alertas de stock mínimo.
- `inventory-import`: importación inicial y re-importaciones desde el Excel matriz (y opcionalmente el export CSV de TiendaNube) con vista previa, reporte de diferencias y confirmación explícita antes de escribir.
- `inventory-api`: API HTTP de inventario en `tq-ecommerce` (consulta de catálogo/stock, descuento por venta, incremento por recepción, ajuste) con autenticación por API key para consumo del POS Flask.
- `pos-inventory-integration`: el POS Flask consume `inventory-api` para búsqueda de productos, cobro (descuento de stock), recepción de compras y consulta de inventario; define el mapeo SKU↔variante y el comportamiento ante caída de conectividad.

### Modified Capabilities

<!-- No hay specs existentes en openspec/specs/ — proyecto recién inicializado. -->

## Impact

- **`tq-ecommerce` (Next.js/Prisma)**: nuevas rutas API de inventario; uso obligatorio de `StockMovement` en checkout y admin; script de importación (extiende `prisma/seed.ts` o script dedicado); posible índice/constraint sobre SKU de variante.
- **POS Flask**: `routes/ventas.py`, `routes/compras.py`, `routes/inventario.py` pasan de SQL directo sobre `variantes` a llamadas a la API; `database.py` conserva ventas/caja/turnos locales (esos módulos no cambian de dueño).
- **Datos**: migración one-shot Excel → Postgres; los SKUs se vuelven obligatorios y únicos por variante (hoy el Excel no trae SKU: se define regla de generación en design).
- **Operación**: Gianluca/Fabricio dejan de actualizar el Excel; el alta/ajuste de stock se hace en el admin del ecommerce o el POS. Dropbox deja de ser dependencia.
- **Dependencias**: el POS requiere `requests` (nueva dependencia Python) y una variable de entorno con la URL/API key del ecommerce.
