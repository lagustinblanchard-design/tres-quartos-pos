# Tasks — Unificar el inventario: fuente única de stock

## 1. Fundaciones en tq-ecommerce (inventory-core)

- [x] 1.1 Extraer la lógica de mutación de stock a `src/lib/inventory.ts`: funciones `decrementStock` (condicional atómico vía `updateMany` + `stock: { gte: qty }`, con `StockMovement` en la misma transacción), `incrementStock` y `adjustStock`
- [x] 1.2 Refactorizar `POST /api/admin/pos/checkout` para usar `src/lib/inventory.ts` (elimina la carrera check-then-decrement existente)
- [x] 1.3 Refactorizar `POST /api/checkout` (online) y `POST /api/stock/adjust` para usar la misma librería
- [x] 1.4 Agregar test de concurrencia: dos descuentos simultáneos del último ítem — exactamente uno gana, el otro recibe 409

## 2. API de integración (inventory-api)

- [x] 2.1 Middleware de autenticación por API key para `/api/integration/*`: header `X-API-Key` vs `INTEGRATION_API_KEY`; 401 si inválida, 503 si la env no está configurada; agregar la variable a `.env.example`
- [x] 2.2 `GET /api/integration/catalog?q=` — búsqueda por nombre/SKU con variantes y stock, respuesta keyed por SKU
- [x] 2.3 `POST /api/integration/sale` — venta multi-ítem todo-o-nada con referencia externa e idempotencia por referencia (verificar `StockMovement.reference` existente antes de aplicar)
- [x] 2.4 `POST /api/integration/receive` — incremento de stock + movimiento `ENTRADA` + actualización de `costPrice` si se informa
- [x] 2.5 `POST /api/integration/adjust` — ajuste absoluto con motivo obligatorio
- [x] 2.6 Tests de la API: auth (sin key / key mala / sin env), venta exitosa, venta con stock insuficiente (409 sin efectos), referencia duplicada, recepción con costo

## 3. Importador de inventario (inventory-import)

- [x] 3.1 Crear `tq-ecommerce/scripts/import-inventory.ts`: lectura del Excel plano (formato de salida de `convertir_excel.py`), parseo y validación de filas
- [x] 3.2 Generación determinística de SKU `TQ-<CAT>-<slug-producto>-<TALLA>` con normalización (mayúsculas, sin acentos, guiones)
- [x] 3.3 Modo dry-run (default): diff contra la base canónica y emisión de `import-report.md` (productos nuevos, variantes nuevas, diferencias de stock y precio, filas inválidas con motivo)
- [x] 3.4 Modo `--apply`: upsert por SKU de categorías/productos/variantes; stock inicial como `StockMovement` tipo `AJUSTE` con reason de importación; idempotente ante re-ejecución
- [x] 3.5 Tests del importador: dry-run no escribe, apply idempotente, SKU estable entre ejecuciones, fila sin precio va a inválidas
- [ ] 3.6 Correr el flujo real: `convertir_excel.py` sobre el Excel de Dropbox → dry-run → entregar `import-report.md` para conteo físico (tarea humana: Gianluca/Fabricio verifican) → `--apply` con datos corregidos — **pendiente: requiere el Excel real de Dropbox, credenciales de Supabase de producción y el conteo físico del equipo. No ejecutable en esta sesión.**

## 4. Integración del POS Flask (pos-inventory-integration)

- [x] 4.1 Agregar `requests` a `requirements.txt`; crear `utils/inventory_client.py` con cliente HTTP de la API (base URL y API key por env `INVENTORY_API_URL` / `INVENTORY_API_KEY`, timeouts cortos)
- [x] 4.2 Feature flag `INVENTORY_MODE` (`local` default | `api`) leído en un solo lugar; migración de columna `variantes.sku_canonico` (SQLite y Postgres)
- [x] 4.3 Poblar `sku_canonico` en las variantes locales con la misma regla de generación de SKU del importador (script one-shot con reporte de no-mapeadas)
- [x] 4.4 Modo api en búsqueda de productos (`routes/ventas.py::api_productos`): consulta al catálogo de la API con caché de 60s
- [x] 4.5 Modo api en cobro (`routes/ventas.py::cobrar`): llamada a `/api/integration/sale` con referencia `FLASK-POS #<venta_id>` antes de confirmar; 409 → mostrar detalle y abortar venta
- [x] 4.6 Tabla `mutaciones_pendientes` + encolado ante timeout/error de red en el cobro (la venta local se completa igual) + comando/endpoint de replay en orden cronológico
- [x] 4.7 Modo api en recepción de compras (`routes/compras.py::recibir`): llamada a `/api/integration/receive` en lugar del UPDATE local
- [x] 4.8 Tests del POS en modo api (API mockeada): venta exitosa, 409 aborta, caída de red encola y completa venta, replay aplica en orden, modo local intacto (suite existente sigue verde)

## 5. Switchover y cierre

- [x] 5.1 Reporte de consistencia: script que cruza ventas del POS Flask contra `StockMovement` por referencia y lista discrepancias
- [ ] 5.2 Período de prueba en paralelo: `INVENTORY_MODE=local` en ventas + verificación manual de lecturas vía API (tarea humana, checklist de verificación) — **pendiente: requiere deploy real y operación diaria del equipo.**
- [ ] 5.3 Switchover: `INVENTORY_MODE=api` en producción; monitorear el reporte de consistencia los primeros días — **pendiente: depende de 3.6 y 5.2.**
- [ ] 5.4 Archivar el Excel en Dropbox (solo lectura, renombrado con fecha de corte) y documentar el corte en el README del repo — **pendiente: depende de 3.6/5.3 (no archivar la fuente hasta confirmar el switchover).**
- [x] 5.5 Documentar en `CLAUDE.md` / README: la base del ecommerce es la fuente única de stock; el alta/ajuste se hace en el admin del ecommerce o el POS, nunca en Excel ni TiendaNube
