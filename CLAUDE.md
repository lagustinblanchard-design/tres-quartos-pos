# TRES QUARTOS — Contexto y reglas de trabajo (ecommerce)

Este archivo es el contexto persistente para cualquier sesión de Claude Code sobre este repo, sea con Fable 5 (planificación) o Sonnet 5 (ejecución). Léelo antes de proponer o ejecutar cambios.

## Negocio

- **Marca:** TRES QUARTOS (TQ) — artículos deportivos, foco en rugby, expandiendo a pádel y gimnasio.
- **Modelo actual:** venta de stock **nuevo**, comprado a proveedores/marcas (confirmado con el owner). El lenguaje de marca en `BRAND.md` ("compraventa", "Jugado. Vendido. Vuelto a jugar.") sugiere reventa/consignación de usado — **no es así hoy**, puede ser identidad aspiracional o un negocio futuro. No tratar reventa de usados como requerimiento funcional sin confirmarlo de nuevo.
- **Canal de venta:** local físico con POS diario activo + tienda online (en desarrollo). El POS físico es operación real, no un canal secundario.
- **Prioridad de negocio actual (próximos 3 meses):** profesionalizar stock/operaciones — evitar quiebres y descoordinación entre el local y la tienda online. No es, por ahora, foco en marketing/crecimiento ni en TRY Club, aunque son las siguientes prioridades.
- **TiendaNube:** sigue activa, sin fecha límite dura, pero cada mes que continúa es costo/fricción a minimizar. No cortarla hasta paridad funcional validada.

## Equipo y roles

- **Agustín** — owner. Único que interactúa directamente con Claude Code / Fable 5 / Sonnet 5. Decide qué se aprueba y qué se despliega.
- **Gianluca** — Operaciones / Stock y logística. Nivel técnico básico: puede seguir pasos de configuración guiados, no escribe ni revisa código. Su rol en la migración: validar que el stock unificado POS↔online sea correcto antes de cualquier corte, y probar flujos de venta física con el sistema nuevo antes de que Agustín los apruebe.
- **Fabricio** — Atención al cliente / soporte. Su rol: validar la experiencia de compra de punta a punta (checkout, pagos, emails, tracking) desde la óptica del cliente, y ser la primera línea para detectar fricciones durante la migración.

Ni Gianluca ni Fabricio ejecutan tareas técnicas por su cuenta: validan resultados en el flujo real. Cualquier tarea que requiera que "alguien" configure algo paso a paso (sin código) puede asignarse a Gianluca con instrucciones explícitas y verificables.

## Arquitectura actual (dos sistemas — punto crítico)

- **POS Flask** (raíz del repo, `main.py`, `routes/`, `database.py`) — SQLite/Supabase. Es la operación real del local hoy. Ya tiene un `OPTIMIZATION_REPORT.md` con hallazgos aplicados (conexiones, N+1, excepciones) — no repetir ese trabajo, partir de ahí.
- **tq-ecommerce** (`tq-ecommerce/`, Next.js 14 + Prisma + Postgres) — tienda online + panel admin + POS + facturación + fidelización (TRY Club), todo modelado en `schema.prisma`. **Todavía en desarrollo/testing, sin clientes reales.** Hay margen para cambios estructurales sin romper nada en producción.
- El schema de `tq-ecommerce` ya está pensado para unificar POS y tienda online en una sola base — hoy no lo está, son dos sistemas con dos bases de datos separadas. Esa unificación es el trabajo de la Fase 1 (abajo).

## Cómo orquestar: Fable 5 vs Sonnet 5

Regla base: **la complejidad y el riesgo deciden quién piensa la solución, no quién la escribe.**

**Usar Fable 5** (vía `/opsx:explore` y `/opsx:propose`, ya configurado en `.claude/skills/openspec-*`) cuando la tarea:
- toca dinero, stock o facturación de forma no trivial (unificación de stock POS↔online, lógica de precios, TRY Club, AFIP)
- involucra decisiones de arquitectura o migración de datos (qué sistema es la fuente de verdad, cómo migrar catálogo desde TiendaNube)
- es ambigua, tiene varias soluciones razonables, o un error sería costoso de revertir

Fable 5 debe dejar `proposal.md` + `design.md` + `tasks.md` antes de que se toque una sola línea de código.

**Usar Sonnet 5 directamente** cuando la tarea:
- es mecánica, acotada y de bajo riesgo (fix puntual, copy, estilos, un endpoint bien definido)
- ya tiene un plan aprobado por Fable 5 (`/opsx:apply` ejecuta `tasks.md`)

Ante la duda, tratar la tarea como compleja: un plan de más sale barato; romper stock o facturación en producción no.

## Reglas de no-regresión (no negociables)

- Ningún cambio de stock/precio/checkout va a producción sin validación de Gianluca (stock) o Fabricio (experiencia de cliente), según corresponda.
- El POS Flask sigue siendo la operación real del local — no se reemplaza hasta que `tq-ecommerce` tenga paridad funcional confirmada y haya corrido en paralelo sin incidentes.
- TiendaNube no se corta hasta que catálogo, clientes e histórico estén migrados **y** el checkout nuevo haya procesado ventas reales sin errores.
- Todo cambio que toque `database.py`, `schema.prisma`, o rutas de pagos/facturación pasa primero por Fable 5.

## Fases del plan

0. **Descubrimiento** — completar lo que falta saber antes de estimar tiempos reales: tamaño de catálogo, ticket promedio, proveedores, medios de envío, KPIs actuales de TiendaNube (línea base pre-migración).
1. **Unificar stock** — fuente única de verdad de inventario entre POS Flask y tq-ecommerce. **Código implementado** (ver "Fuente única de stock" abajo); falta el switchover operativo real.
2. **Cerrar tq-ecommerce a paridad operativa** — checkout + MercadoPago + panel admin de stock funcionando de punta a punta, suficiente para reemplazar el uso diario de TiendaNube y del POS Flask.
3. **Migrar catálogo/clientes/histórico desde TiendaNube.**
4. **Correr en paralelo, cortar TiendaNube cuando esté validado.**
5. **Automatizar y crecer** — TRY Club, facturación AFIP real, marketing de catálogo.

## Fuente única de stock (Fase 1 — código implementado, switchover pendiente)

**Ya no es una hipótesis**: la base Postgres de `tq-ecommerce` (Prisma) es la fuente única de verdad del stock. Ver `openspec/changes/unify-inventory-source-of-truth/` (proposal/design/specs/tasks) para el detalle completo de la decisión y su justificación (D8: Supabase en producción, confirmado por Agustín).

- Toda mutación de stock pasa por `tq-ecommerce/src/lib/inventory.ts` (descuento condicional atómico, sin sobreventa) y queda auditada en `StockMovement`.
- El POS Flask consume el stock canónico vía `/api/integration/*` (autenticado con `INTEGRATION_API_KEY`/`INVENTORY_API_KEY`) cuando `INVENTORY_MODE=api`. El default sigue siendo `local` (comportamiento anterior intacto) — el cambio de modo es una variable de entorno, reversible sin deploy.
- El Excel de Dropbox y TiendaNube dejan de ser fuente de datos: el Excel se importa una única vez con conciliación humana (`tq-ecommerce/scripts/import-inventory.ts` — dry-run obligatorio, revisar `import-report.md` y hacer conteo físico antes de `--apply`) y luego se archiva. El alta/ajuste de stock se hace en el admin de `tq-ecommerce` o desde el POS — **nunca** editando el Excel o TiendaNube directamente.
- Si la API de inventario no responde, el POS completa la venta igual (nunca se frena la caja) y encola la mutación en `mutaciones_pendientes`; `replay_mutaciones.py` la aplica cuando vuelve la conectividad. `reporte_consistencia.py` cruza ventas del POS contra el ledger canónico para detectar discrepancias.
- **Pendiente — trabajo humano/operativo, no ejecutable por Claude**: correr la importación real del Excel de Dropbox con conteo físico (Gianluca), el período de prueba en paralelo, el switchover de `INVENTORY_MODE` a `api` en producción, y el archivado formal del Excel. Ver la sección 5 de `tasks.md` de ese change para el paso a paso.

## Reposición automática por código de proveedor (código implementado, pendiente prueba end-to-end real)

Ver `openspec/changes/supplier-order-import/`. El proveedor principal (IMAGO Indumentarias) identifica cada producto con un código propio en su "Cuadro de Pedido" (Excel real relevado y usado como base del parser — no es un formato inventado).

- `Product.supplierCode` mapea el producto interno a ese código.
- `tq-ecommerce/scripts/supplier-order-lib.ts` parsea el Cuadro de Pedido (múltiples secciones, header de talles propio por sección, columna "CANT" para productos sin talle) y solo toma las líneas con cantidad cargada.
- Flujo en `/admin/compras`: subir el mismo Excel que se le manda al proveedor → previsualizar (clasificado en directo / talle nuevo / producto nuevo / código duplicado, este último requiere corregir el Excel o mapear a mano) → confirmar (crea la orden `PENDIENTE`, sin tocar stock) → **Recibir** (recién ahí suma stock, vía el mismo `receiveStock()` de la fuente única de verdad).
- El costo por unidad **no se auto-completa** desde el Excel del proveedor (sus columnas de precio son por rango de talle sin regla fija verificable) — se carga a mano, opcional.
- **Pendiente**: prueba end-to-end contra una base real (`DATABASE_URL` de Supabase) y mapear `supplierCode` en el catálogo ya existente antes de la primera carga real.

## Automatizaciones propuestas (priorizar en Fase 5, algunas antes si son baratas)

- Alertas de stock bajo (`stockAlert` ya existe en el schema — falta el trigger/notificación).
- TRY Club: activar cupones/puntos automáticos post-compra (el modelo de datos ya existe — `LoyaltyAccount`, `LoyaltyCoupon` — falta la lógica conectada al checkout).
- Reportes automáticos de caja/ventas diarios (aprovechando `PosSession` y `reportes.py` ya existentes).
- Publicación semi-automática de catálogo a redes al dar de alta un producto (tono ya definido en `BRAND.md`).

## Autocrítica y supuestos a revisar (mantener actualizado)

- ~~La elección de Postgres/Prisma como fuente de verdad de stock es una hipótesis~~ — confirmada y construida (ver sección "Fuente única de stock" arriba). Lo que falta es el switchover real en producción, no la decisión.
- El lenguaje de marca sugiere reventa/consignación de usados; el negocio real hoy es solo stock nuevo. Si esto cambia, el modelo de `Product`/`Supplier` necesita revisión.
- Faltan datos de negocio (catálogo, ticket promedio, proveedores, logística, KPIs de TiendaNube) — no bloquean empezar, pero sin ellos Fase 0 es obligatoria.
- Este documento se escribió a partir de una revisión de arquitectura (schema, `package.json`, `main.py`, `OPTIMIZATION_REPORT.md`), no de una lectura línea por línea del checkout, panel admin o lógica de POS. Cualquier plan de Fase 1-2 debe empezar con una auditoría real de ese código, no asumir sobre lo que este documento describe.

## Cómo arrancar cada sesión

1. Agustín describe el objetivo concreto (no "mejorá el ecommerce" — la tarea puntual).
2. Si es compleja/riesgosa según las reglas de arriba → `/opsx:explore` o `/opsx:propose` primero (Fable 5).
3. Con el plan aprobado por Agustín → `/opsx:apply` (Sonnet 5) ejecuta.
4. Gianluca y/o Fabricio validan el resultado en el flujo real antes de cerrar la tarea.
