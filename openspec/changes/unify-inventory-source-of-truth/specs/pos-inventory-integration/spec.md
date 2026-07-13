# pos-inventory-integration — POS Flask como cliente del stock canónico

## ADDED Requirements

### Requirement: Modo de inventario configurable con default seguro
El POS Flask SHALL soportar dos modos vía `INVENTORY_MODE`: `local` (comportamiento actual, default) y `api` (stock canónico vía `inventory-api`). El cambio de modo no SHALL requerir cambios de código ni migración de datos.

#### Scenario: Modo local por defecto
- **WHEN** `INVENTORY_MODE` no está definida
- **THEN** el POS opera exactamente como hoy, contra sus tablas locales

#### Scenario: Rollback de switchover
- **WHEN** se revierte `INVENTORY_MODE` de `api` a `local`
- **THEN** el POS vuelve al comportamiento anterior sin pérdida de funcionalidad

### Requirement: Búsqueda de productos vía API en modo api
En modo `api`, la búsqueda de productos del POS (`api_productos`) SHALL consultar `GET /api/integration/catalog` y presentar SKU, tallas, precios y stock canónico. El resultado MAY cachearse hasta 60 segundos; las mutaciones nunca se cachean.

#### Scenario: Búsqueda en el POS
- **WHEN** un vendedor busca "pelota" en el POS en modo api
- **THEN** los resultados muestran el stock actual de la base canónica

### Requirement: Venta descuenta stock canónico
En modo `api`, el cobro de una venta SHALL invocar `POST /api/integration/sale` con los SKUs, cantidades y la referencia `FLASK-POS #<venta_id>` antes de confirmar la venta local. Si la API responde 409 (stock insuficiente), el POS SHALL mostrar el detalle y no completar la venta.

#### Scenario: Venta exitosa en modo api
- **WHEN** se cobra una venta de 2 ítems con stock disponible
- **THEN** la venta se registra en la base local del POS y el stock canónico refleja el descuento con movimientos referenciados

#### Scenario: Stock insuficiente detectado por la API
- **WHEN** la API responde 409 para un ítem
- **THEN** la venta no se confirma y el vendedor ve qué producto no tiene stock

### Requirement: Contingencia ante pérdida de conectividad
Si la API no responde (timeout o error de red) durante un cobro, el POS SHALL completar la venta localmente y encolar la mutación en `mutaciones_pendientes` (SKU, tipo, cantidad, referencia, timestamp). Un mecanismo de replay SHALL aplicar las mutaciones pendientes en orden cuando la conectividad se restablezca.

#### Scenario: Venta durante caída de la API
- **WHEN** la API no responde al cobrar
- **THEN** la venta se completa localmente y queda una mutación pendiente encolada

#### Scenario: Replay al recuperar conectividad
- **WHEN** se ejecuta el replay con la API disponible
- **THEN** las mutaciones pendientes se aplican en orden cronológico y se marcan como procesadas; las que resulten en stock negativo lógico se aplican igual y se reportan

### Requirement: Mapeo por SKU canónico
El POS SHALL almacenar el SKU canónico de cada variante local (`variantes.sku_canonico`) y usar exclusivamente SKUs en la comunicación con la API. Variantes locales sin SKU canónico (históricas/muertas) MAY quedar sin mapear y no participan del modo api.

#### Scenario: Variante histórica sin mapeo
- **WHEN** una venta antigua referencia una variante sin `sku_canonico`
- **THEN** los reportes históricos del POS siguen funcionando; la variante no aparece en búsquedas en modo api

### Requirement: Recepción de compras vía API
En modo `api`, recibir una compra SHALL invocar `POST /api/integration/receive` con los ítems y costos, en lugar de actualizar `variantes.stock` local.

#### Scenario: Recepción de compra en modo api
- **WHEN** se recibe una compra de 10 unidades con costo
- **THEN** el stock canónico aumenta con movimiento `ENTRADA` y el costo se actualiza en la base canónica
