# inventory-import — Importación y conciliación desde Excel

## ADDED Requirements

### Requirement: Importación en dos pasos con dry-run obligatorio
El importador SHALL operar en modo dry-run por defecto: leer el Excel plano (salida de `convertir_excel.py`), compararlo contra la base canónica y emitir un reporte de conciliación sin escribir ningún dato. La escritura SHALL requerir el flag explícito `--apply`.

#### Scenario: Ejecución sin flags
- **WHEN** se ejecuta `import-inventory.ts` con un archivo Excel y sin `--apply`
- **THEN** se genera `import-report.md` con el plan de cambios y la base de datos no se modifica

#### Scenario: Ejecución con --apply
- **WHEN** se ejecuta con `--apply` sobre un archivo previamente revisado
- **THEN** se aplican altas y ajustes según el plan y se registra el resultado

### Requirement: Reporte de conciliación
El reporte SHALL detallar: productos nuevos a crear, variantes nuevas, diferencias de stock (valor Excel vs. valor en base), diferencias de precio, y filas inválidas o ambiguas con el motivo. El reporte sirve como lista de trabajo para el conteo físico previo al apply.

#### Scenario: Variante existente con stock distinto
- **WHEN** el Excel indica stock 12 para una variante que en la base tiene stock 8
- **THEN** el reporte lista la variante con ambos valores y la marca como "requiere verificación física"

#### Scenario: Fila sin precio de categoría
- **WHEN** una fila del Excel pertenece a una categoría sin precio de venta detectado
- **THEN** la fila aparece en la sección de inválidas con motivo "precio no detectado" y no forma parte del plan de apply

### Requirement: Generación determinística de SKU
El importador SHALL generar para cada variante un SKU único y determinístico con el formato `TQ-<CAT>-<slug-producto>-<TALLA>`, estable ante re-ejecuciones. Los SKUs generados SHALL ser la clave de mapeo entre sistemas.

#### Scenario: Re-importación del mismo archivo
- **WHEN** se importa dos veces el mismo Excel
- **THEN** cada variante recibe el mismo SKU en ambas ejecuciones y no se crean duplicados (upsert por SKU)

### Requirement: Stock inicial auditado como ajuste
Todo stock establecido por importación SHALL registrarse como `StockMovement` tipo `AJUSTE` con `reason` que identifique la importación y su fecha, nunca como escritura directa sin ledger.

#### Scenario: Alta de variante nueva con stock
- **WHEN** el apply crea una variante con stock inicial 5
- **THEN** existe un `StockMovement` tipo `AJUSTE` con `previousQty: 0`, `newQty: 5` y `reason` indicando la importación

### Requirement: Idempotencia del apply
Re-ejecutar el apply con el mismo archivo SHALL ser inocuo: no duplica productos, variantes ni movimientos de stock.

#### Scenario: Apply ejecutado dos veces
- **WHEN** se ejecuta `--apply` dos veces consecutivas con el mismo archivo
- **THEN** la segunda ejecución no crea entidades nuevas ni altera el stock resultante

### Requirement: Columna de código de proveedor opcional
El Excel de importación MAY incluir una columna `codigo` (código del proveedor a nivel producto). Cuando está presente y no hay conflicto, el importador SHALL mapear `Product.supplierCode` al crear el producto o al completarlo si el producto ya existe sin código asignado. El importador NUNCA SHALL sobreescribir un `supplierCode` ya asignado (manual o de una importación previa).

#### Scenario: Producto nuevo con código de proveedor
- **WHEN** el Excel trae `codigo: "1001"` para un producto que no existe todavía
- **THEN** el producto se crea con `supplierCode: "1001"`

#### Scenario: Mismo producto con dos códigos distintos en el archivo
- **WHEN** dos filas del mismo producto (mismo nombre+categoría) traen códigos de proveedor distintos
- **THEN** ninguna de esas filas mapea `supplierCode` automáticamente y el reporte las lista como conflicto

#### Scenario: Código ya usado por otro producto
- **WHEN** el código de proveedor de una fila ya pertenece a otro producto existente
- **THEN** no se mapea automáticamente y el reporte/consola lo advierte

#### Scenario: Producto existente ya mapeado
- **WHEN** un producto existente ya tiene `supplierCode` asignado
- **THEN** el importador no lo modifica aunque el Excel traiga un valor distinto
