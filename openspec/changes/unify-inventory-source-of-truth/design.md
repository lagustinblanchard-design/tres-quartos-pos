# Design — Unificar el inventario: fuente única de stock

## Context

Cuatro copias de stock sin sincronización: Excel en Dropbox (matriz por talla, desactualizado, sin espacio), TiendaNube (desactualizado, en proceso de abandono), POS Flask (`variantes.stock`, SQLite local o Supabase vía `DATABASE_URL`) y ecommerce nuevo (`product_variants.stock` en Postgres/Prisma).

Estado real del código (relevante — reduce el trabajo):

- `tq-ecommerce` **ya tiene** un módulo POS propio (`src/components/admin/pos-terminal.tsx`, `POST /api/admin/pos/checkout`) que crea `Order` con `channel: POS`, descuenta stock y registra `StockMovement` dentro de una transacción Prisma.
- Ya existen `GET /api/stock`, `POST /api/stock/adjust` y `GET /api/stock/movements` con ledger correcto (`previousQty`/`newQty`).
- Toda la API existente autentica con sesión NextAuth (`auth()`), inutilizable desde Flask.
- El POS Flask descuenta stock con `UPDATE variantes SET stock = stock - %s` sin validar disponibilidad ni registrar movimiento ([ventas.py:127](routes/ventas.py#L127)).
- `convertir_excel.py` ya parsea el Excel matriz a formato plano (`nombre, categoria, talla, stock, precio_venta, precio_costo`). No hay SKU ni color en el Excel.
- El equipo son 3 personas; la operación diaria no puede detenerse durante la migración.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad de stock: la base Postgres del ecommerce, con `StockMovement` obligatorio para toda mutación.
- Importación inicial del Excel con conciliación explícita (vista previa + diff + confirmación) para no consagrar datos viejos.
- El POS Flask opera contra el stock canónico sin duplicar datos.
- Eliminar la posibilidad de sobreventa: descuento de stock condicional y atómico en todos los canales.

**Non-Goals:**

- Sincronización automática con TiendaNube (se congela y se abandona en el switchover; actualización manual mientras tanto).
- Modo offline completo del POS (se define contingencia mínima, no un sistema de sincronización bidireccional).
- Migrar ventas/caja/turnos históricos del POS Flask a la base del ecommerce (quedan donde están; solo el inventario cambia de dueño).
- Facturación AFIP, envíos, y cualquier otra capacidad del ecommerce no relacionada con stock.

## Decisions

### D1 — La base del ecommerce es la canónica (no la del POS)

**Elección**: Postgres del ecommerce con el esquema Prisma existente.
**Alternativas descartadas**:
- *Base del POS como canónica*: su esquema es más pobre (sin ledger, sin barcode, sin SKU por variante, REAL en vez de Decimal) y el ecommerce ya modela todo lo necesario.
- *Base nueva compartida*: costo de migración doble sin beneficio; el esquema Prisma ya es el destino final.

### D2 — El POS Flask se vuelve cliente de una API de integración; no se deprecia todavía

**Elección**: fase A — el POS Flask consume `inventory-api`; fase B (fuera de este change) — evaluar reemplazarlo por el POS integrado del ecommerce.
**Razón**: el POS integrado del ecommerce existe pero no está probado en operación real; el equipo ya opera con el POS Flask. Cambiar el origen de datos sin cambiar la herramienta de trabajo minimiza el riesgo humano. La deprecación del Flask POS queda como decisión posterior con datos reales.
**Alternativa descartada**: deprecar el Flask POS ya mismo — atractivo (menos código) pero acopla la migración de inventario a un cambio de herramienta de trabajo diaria; dos riesgos en un solo salto.

### D3 — Rutas de integración dedicadas con API key, no reutilizar las rutas de sesión

**Elección**: namespace `POST/GET /api/integration/*` en `tq-ecommerce`, autenticado con header `X-API-Key` contra `INTEGRATION_API_KEY` (env). Endpoints:
- `GET /api/integration/catalog?q=` — búsqueda de productos con variantes y stock (reemplaza `api_productos` del POS).
- `POST /api/integration/sale` — venta POS: valida y descuenta stock de N ítems atómicamente, crea `StockMovement` tipo `VENTA` con referencia externa (`FLASK-POS #<venta_id>`). **No** crea `Order` en el ecommerce (la venta vive en la base del POS; evita doble contabilidad).
- `POST /api/integration/receive` — recepción de compra: incrementa stock, `StockMovement` tipo `ENTRADA`, actualiza `costPrice`.
- `POST /api/integration/adjust` — ajuste absoluto con motivo.

**Razón**: NextAuth no es consumible desde Flask sin browser; una API key simple es proporcional al riesgo (una sola tienda, red conocida). Reutilizar los handlers existentes extrayendo la lógica a `src/lib/inventory.ts` compartido.
**Alternativa descartada**: darle a Flask acceso directo a la base Postgres del ecommerce — funciona, pero duplica reglas de negocio (validación, ledger) en dos lenguajes y garantiza divergencia futura.

### D4 — Descuento de stock condicional (arregla carrera existente)

El checkout actual del ecommerce hace check-then-decrement con datos leídos fuera del `UPDATE` — dos ventas concurrentes del último ítem pueden sobrevender. Toda mutación (nueva y existente) pasa a:

```
updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })
```

y si `count === 0` → abort de la transacción con error 409. Se aplica en `checkout`, `admin/pos/checkout` y las rutas nuevas de integración.

### D5 — SKU generado y determinístico como clave de mapeo

El Excel no trae SKU. Regla de generación en el import: `TQ-<CAT>-<slug-producto>-<TALLA>` (ej. `TQ-RUG-camiseta-lions-XL`), normalizado, único por variante. El POS Flask mapea sus `variante_id` locales a SKU canónico en una tabla `variantes.sku_canonico` (columna nueva) poblada durante la importación. Toda llamada a la API usa SKU, nunca IDs internos de ninguna de las dos bases.
**Alternativa descartada**: mapear por `nombre+talla` — frágil ante renombres; el SKU es estable y además habilita códigos de barra después.

### D6 — Importación con conciliación en dos pasos (dry-run obligatorio)

Script `tq-ecommerce/scripts/import-inventory.ts` (ts-node, como el seed):

1. **Dry-run (default)**: lee el Excel plano (salida de `convertir_excel.py`), lo compara contra la base canónica y emite `import-report.md`: productos nuevos, variantes nuevas, diferencias de stock (Excel vs. DB), diferencias de precio, y filas inválidas. No escribe nada.
2. **Confirmación (`--apply`)**: aplica el plan aprobado. Cada stock inicial genera `StockMovement` tipo `AJUSTE` con `reason: "Importación inicial Excel <fecha>"`. Idempotente: re-ejecutar con el mismo archivo no duplica (upsert por SKU).

El paso de conciliación es donde Gianluca/Fabricio corrigen contra conteo físico **antes** del apply — el reporte es la lista de trabajo del conteo.

### D7 — Contingencia del POS ante caída de conectividad

Si `inventory-api` no responde: el POS permite **cerrar la venta igualmente** (no se frena la caja) y encola la mutación en una tabla local `mutaciones_pendientes` (SQL: sku, tipo, cantidad, referencia, timestamp). Un comando/endpoint de replay las aplica cuando vuelve la conectividad, en orden. El stock canónico puede quedar temporalmente desfasado — se acepta: perder una venta presencial es peor que un desfase de minutos.
**Alternativa descartada**: bloquear la venta sin conectividad — inaceptable en tienda física.

### D8 — Postgres (Supabase) en producción del POS; SQLite solo para dev/tests

**Elección (confirmada por el equipo)**: el POS Flask en producción usa Supabase vía `DATABASE_URL` (como ya está desplegado en Render). SQLite queda exclusivamente como fallback de desarrollo local y suite de tests — comportamiento actual de `database.py`, sin cambios.
**Razón**: el filesystem de Render es efímero (SQLite perdería ventas/caja en cada redeploy); acceso multi-dispositivo para el equipo de 3; backups automáticos de Supabase.
**Consecuencia**: la migración de la columna `variantes.sku_canonico` y la tabla `mutaciones_pendientes` deben escribirse para ambos motores — se aplican en Supabase en producción y en SQLite para que los tests sigan corriendo. Evaluar durante la implementación consolidar POS y ecommerce en el mismo proyecto de Supabase con schemas separados (una sola credencial y backup que administrar).

## Risks / Trade-offs

- **[Excel desactualizado se importa como verdad]** → el dry-run + reporte de diferencias fuerza revisión humana; el stock importado entra como `AJUSTE` auditado y se corrige con ajustes posteriores, nunca sobrescribiendo silenciosamente.
- **[Doble contabilidad de ventas POS]** (venta en base Flask + movimiento en base canónica) → el `StockMovement.reference` lleva el ID de venta Flask; un reporte de consistencia (task) cruza ambos. La venta como entidad no se duplica (D3: no se crea `Order`).
- **[La cola de contingencia aplica descuentos sobre stock ya vendido online]** → el replay usa el mismo descuento condicional; si el stock quedó negativo lógicamente, el movimiento se registra igual con stock resultante real y alerta en el reporte del admin (el desfase ya ocurrió en el mundo físico; ocultarlo sería peor).
- **[API key única compartida]** → suficiente para una tienda; si se filtra, se rota por env var. HTTPS obligatorio (Render/Vercel ya lo dan).
- **[Latencia de red en cada búsqueda del POS]** → el catálogo se cachea en el POS 60s (solo lectura); las mutaciones nunca se cachean.
- **[El equipo sigue actualizando el Excel por costumbre]** → riesgo operativo, no técnico: el Excel se archiva (solo lectura en Dropbox) tras el apply y se comunica el corte; el reporte semanal de stock del admin reemplaza su función.

## Migration Plan

1. Implementar `inventory-api` + descuento condicional en `tq-ecommerce` (sin tocar el POS). Deploy.
2. Correr `convertir_excel.py` sobre el Excel de Dropbox → dry-run del import → entregar `import-report.md` al equipo para conteo físico → correcciones → `--apply`.
3. Cambiar el POS Flask a modo API (feature flag `INVENTORY_MODE=api|local`, default `local`). Probar en paralelo: ventas reales siguen en modo local, se verifica lectura vía API.
4. Switchover: `INVENTORY_MODE=api`. Las tablas `productos`/`variantes` del POS quedan congeladas (solo lectura para históricos).
5. Archivar Excel en Dropbox. Congelar stock TiendaNube (manual).

**Rollback**: volver `INVENTORY_MODE=local` restaura el comportamiento anterior por completo (las tablas locales no se borran en este change). El stock canónico acumulado se re-importa al POS solo si se abandona definitivamente el enfoque (no esperado).

## Open Questions

- ~~¿El POS Flask en producción usa SQLite local o Supabase?~~ **Resuelto → D8**: Supabase en producción, SQLite solo dev/tests.
- ¿Existen ventas históricas en el POS que referencien variantes que ya no existen en el Excel? El import no las resuelve; el mapeo `sku_canonico` puede quedar NULL para variantes muertas (aceptable, confirmar).
- ¿Se exporta el catálogo de TiendaNube (CSV) como segunda fuente para el diff del import, o el Excel + conteo físico alcanza? (El diseño lo soporta como input opcional; decidir por esfuerzo/valor.)
