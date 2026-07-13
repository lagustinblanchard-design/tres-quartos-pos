# inventory-api — API de integración de inventario

## ADDED Requirements

### Requirement: Autenticación por API key
Todo endpoint bajo `/api/integration/*` SHALL exigir el header `X-API-Key` con el valor de `INTEGRATION_API_KEY`. Requests sin key o con key inválida SHALL recibir 401 sin filtrar información. Si `INTEGRATION_API_KEY` no está configurada, los endpoints SHALL responder 503 (integración deshabilitada), nunca permitir acceso abierto.

#### Scenario: Request sin API key
- **WHEN** un request llega a `/api/integration/catalog` sin header `X-API-Key`
- **THEN** la respuesta es 401 y no se ejecuta lógica de negocio

#### Scenario: Variable de entorno ausente
- **WHEN** el servidor no tiene `INTEGRATION_API_KEY` configurada
- **THEN** todo request a `/api/integration/*` recibe 503

### Requirement: Búsqueda de catálogo con stock
`GET /api/integration/catalog?q=<término>` SHALL devolver productos activos que coincidan por nombre o SKU, con sus variantes (SKU, talla, color, precio, stock actual). La respuesta usa SKUs como identificador, nunca IDs internos.

#### Scenario: Búsqueda por nombre parcial
- **WHEN** se consulta `?q=camiseta`
- **THEN** se devuelven los productos activos cuyo nombre contiene "camiseta" con stock actual por variante

### Requirement: Registro de venta externa
`POST /api/integration/sale` SHALL recibir una lista de ítems (SKU, cantidad) y una referencia externa, descontar el stock de todos los ítems en una única transacción con descuento condicional, y crear un `StockMovement` tipo `VENTA` por ítem con la referencia externa. La operación SHALL ser todo-o-nada. No SHALL crearse un `Order` en el ecommerce.

#### Scenario: Venta multi-ítem exitosa
- **WHEN** se envían 3 ítems con stock suficiente y referencia `FLASK-POS #841`
- **THEN** los 3 stocks se descuentan, se crean 3 movimientos con esa referencia y la respuesta es 200

#### Scenario: Un ítem sin stock suficiente
- **WHEN** de 3 ítems enviados uno no tiene stock suficiente
- **THEN** ningún stock se modifica, no se crea ningún movimiento y la respuesta es 409 identificando el SKU problemático

#### Scenario: Referencia duplicada
- **WHEN** se envía dos veces la misma referencia externa
- **THEN** la segunda llamada no descuenta stock nuevamente y responde indicando la duplicación (idempotencia por referencia)

### Requirement: Recepción de mercadería
`POST /api/integration/receive` SHALL incrementar el stock de los ítems recibidos (SKU, cantidad, costo unitario opcional), crear `StockMovement` tipo `ENTRADA` con referencia, y actualizar `costPrice` de la variante cuando se informe costo.

#### Scenario: Recepción con costo
- **WHEN** se recibe un ítem con cantidad 10 y costo 5000
- **THEN** el stock aumenta en 10, se crea movimiento `ENTRADA` y `costPrice` pasa a 5000

### Requirement: Ajuste absoluto de stock
`POST /api/integration/adjust` SHALL fijar el stock de una variante a un valor absoluto con motivo obligatorio, registrando `StockMovement` tipo `AJUSTE` con el delta.

#### Scenario: Ajuste por conteo físico
- **WHEN** se ajusta una variante de stock 7 a stock 5 con motivo "conteo físico"
- **THEN** el stock queda en 5 y el movimiento registra `previousQty: 7`, `newQty: 5`
