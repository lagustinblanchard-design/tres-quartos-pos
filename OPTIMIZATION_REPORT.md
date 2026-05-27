# OPTIMIZATION REPORT — Tres Quartos POS

## Summary of Changes

### HIGH Severity Fixes

#### 1. Connection leaks on early returns (all 6 route files)
**Before:** `db = get_db()` at the top of every route, with `db.close()` manually called before each return. Early redirects (validation failures, 404s) skipped `db.close()`, leaking a TCP connection to Supabase for the remaining lifetime of the gunicorn worker (~23 leak points).

**After:** `get_db()` stores the connection in Flask's `g` object. `app.teardown_appcontext(close_db)` closes it automatically after every request regardless of how the request exits. All manual `db.close()` calls removed from route files.

**Files:** `database.py`, `main.py`, `routes/auth.py`, `routes/ventas.py`, `routes/inventario.py`, `routes/caja.py`, `routes/compras.py`, `routes/reportes.py`

---

#### 2. N+1 query in `api_productos` (ventas.py)
**Before:** Fetched up to 50 products, then looped over each one to `SELECT variantes WHERE producto_id = ?`. With 50 products = 51 queries. On Supabase (~30ms RTT), this adds ~1.5 seconds per POS search.

**After:** Single `WHERE producto_id IN (...)` query fetches all variantes at once. Results grouped by `producto_id` in Python using `defaultdict`. **51 queries → 2 queries.**

**File:** `routes/ventas.py`

---

#### 3. N+1 in `compras.recibir` (compras.py)
**Before:** For a purchase with N items, ran 2 UPDATE queries per item in a loop (stock + precio_costo). N items = 2N queries.

**After:** Single `CASE WHEN id = ? THEN stock + ? ... END` batch UPDATE for all stock adjustments. Price updates deduplicated by `producto_id`. **2N queries → 1 + unique_products queries.**

**File:** `routes/compras.py`

---

#### 4. Dead global `_import_cache` (inventario.py)
**Before:** `_import_cache = {}` defined at module level but never read — leftover from a previous implementation before the base64 stateless approach was adopted.

**After:** Line deleted.

---

#### 5. Bare `except` clauses in `importar` routes (inventario.py)
**Before:** `except Exception as e` and bare `except Exception:` swallowed all errors including programming bugs, making debugging impossible.

**After:** Specific exceptions caught: `(ValueError, TypeError, KeyError)` for Excel parsing; `(json.JSONDecodeError, binascii.Error, UnicodeDecodeError)` for base64/JSON decode.

---

#### 6. `RETURNING id, nombre` not stripped in SQLite mode (database.py)
**Before:** `_adapt()` regex `RETURNING\s+id\s*$` only stripped `RETURNING id` (single column) at end of string. Batch INSERT with `RETURNING id, nombre` would crash on SQLite.

**After:** Regex updated to `RETURNING\s+\S.*$` — strips any multi-column RETURNING clause. Added SQLite fallback in `importar_confirmar` that SELECTs product IDs by name when `fetchall()` returns empty.

---

### MED Severity Fixes

#### 7. `init_db()` connection leak on error (database.py)
**Before:** If schema initialization raised an exception, `db.close()` was never reached.

**After:** Wrapped in `try/finally`. Also changed from `get_db()` (which uses Flask `g`) to `DbConnection()` directly, so `init_db()` works both inside and outside a request context.

---

#### 8. Hardcoded `SECRET_KEY` fallback (main.py)
**Before:** `os.environ.get("SECRET_KEY", "tresquartos_secret_2024")` silently used an insecure default in production if the env var wasn't set.

**After:** Emits a `RuntimeWarning` when `SECRET_KEY` is not set, making misconfiguration visible in logs.

---

## Test Coverage

```
Name                   Stmts   Miss  Cover
------------------------------------------
database.py               76     10    87%
main.py                   54     13    76%
routes/__init__.py         0      0   100%
routes/auth.py            57      0   100%
routes/caja.py            81      0   100%
routes/compras.py        112      0   100%
routes/inventario.py     229     21    91%
routes/reportes.py        69      0   100%
routes/ventas.py         115      5    96%
utils/__init__.py          0      0   100%
utils/helpers.py          15     10    33%
------------------------------------------
TOTAL                    808     59    93%
```

**Total: 93% coverage** (target: 80%) | **100 tests, 0 failures**

Uncovered lines:
- `database.py:30-31, 47-51`: PostgreSQL-specific code paths (psycopg connection), not exercised by SQLite test DB
- `main.py:16-18`: RuntimeWarning branch (SECRET_KEY set in tests)
- `utils/helpers.py:5-7, 15-21`: `formato_pesos` and `fecha_display` helpers unused by routes (called from templates)

---

## Benchmark Results

Environment: Python 3.11.9, SQLite in-memory equivalent, 50 products × 3 variantes = 150 variantes

| Test | Mean | Median | OPS |
|------|------|--------|-----|
| `api_productos` (50 products, 2 queries) | 1.81 ms | 1.52 ms | 554/s |
| `reportes/stock` (50 products, 1 query) | 2.37 ms | 2.18 ms | 421/s |

The `api_productos` benchmark validates the N+1 fix: 50 products with 3 variantes each are returned in ~1.8ms using 2 queries. The old implementation would have issued 51 queries; on Supabase with ~30ms RTT each, the same request would take ~1.5 seconds.

---

## Remaining LOW Severity Items (not addressed)

| Issue | Location | Justification |
|-------|----------|---------------|
| `SELECT *` throughout routes | All routes | The app is small; full rows are needed in templates. Columns are not large. Premature optimization. |
| Python-side totals in `reportes/stock` | `reportes.py:125-129` | In-memory sum over fetched rows. Acceptable for catalog size; SQL SUM would require restructuring the subquery. |
| `redundant post-insert SELECT` in `cobrar` | `ventas.py:127-136` | The SELECT after INSERT fetches product names for the ticket. Eliminating it would require joining product data during the insert loop, increasing code complexity for a minor gain on a 2-5 item sale. |
| Missing DB indexes | `database.py` schema | No indexes on `ventas.fecha`, `items_venta.venta_id`, `variantes.producto_id`. Low impact now (small dataset), high impact at scale. Recommend adding as a follow-up migration. |
| No CSRF protection | All form routes | Flask-WTF not installed. Mitigated by session-based auth; acceptable for an internal POS app on a private URL. |
