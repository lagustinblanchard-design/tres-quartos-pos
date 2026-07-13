# inventory-core — Stock canónico y reglas de mutación

## ADDED Requirements

### Requirement: Fuente única de verdad del stock
El stock por variante de producto SHALL residir exclusivamente en la base PostgreSQL del ecommerce (`product_variants.stock`). Ningún otro sistema (POS Flask, Excel, TiendaNube) SHALL ser considerado autoritativo tras el switchover.

#### Scenario: Consulta de stock desde cualquier canal
- **WHEN** un canal (tienda online, POS integrado, POS Flask vía API) consulta el stock de una variante
- **THEN** el valor devuelto proviene de `product_variants.stock` en la base canónica

### Requirement: Ledger obligatorio de movimientos
Toda mutación de stock SHALL crear un registro `StockMovement` en la misma transacción que la mutación, con `type`, `quantity`, `previousQty`, `newQty`, `reason` y `reference` cuando aplique. Una mutación de stock sin movimiento asociado es un defecto.

#### Scenario: Venta descuenta stock con movimiento
- **WHEN** se confirma una venta (online o POS) de 2 unidades de una variante con stock 10
- **THEN** el stock queda en 8 y existe un `StockMovement` tipo `VENTA` con `previousQty: 10`, `newQty: 8` en la misma transacción

#### Scenario: Fallo de transacción no deja movimiento huérfano
- **WHEN** la transacción de venta falla después de descontar stock
- **THEN** ni el descuento ni el movimiento persisten (rollback completo)

### Requirement: Descuento condicional atómico (sin sobreventa)
El descuento de stock SHALL ser condicional y atómico: la operación solo procede si `stock >= cantidad` evaluado en la misma sentencia de UPDATE (`updateMany` con `stock: { gte: qty }`). Un check previo en memoria NO satisface este requisito. Aplica a checkout online, POS integrado y API de integración.

#### Scenario: Dos ventas concurrentes del último ítem
- **WHEN** dos requests concurrentes intentan comprar la última unidad de una variante
- **THEN** exactamente una venta se confirma y la otra recibe error 409 con detalle de stock insuficiente

#### Scenario: Venta con stock insuficiente
- **WHEN** una venta solicita 5 unidades de una variante con stock 3
- **THEN** la operación se rechaza con 409, no se modifica el stock y no se crea movimiento

### Requirement: Alerta de stock mínimo
El sistema SHALL exponer las variantes cuyo stock esté en o por debajo de `stockAlert` para su visualización en el panel de administración.

#### Scenario: Variante cae bajo el mínimo tras una venta
- **WHEN** una venta deja una variante con `stock <= stockAlert`
- **THEN** la variante aparece en el listado de alertas de stock del admin
