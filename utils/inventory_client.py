"""
Cliente HTTP hacia /api/integration/* del ecommerce (tq-ecommerce), la
fuente única de stock. Ver design.md D2/D3/D7 y
specs/pos-inventory-integration/spec.md.

INVENTORY_MODE controla si el POS usa este cliente ("api") o su
comportamiento local de siempre ("local", default). Nada de este módulo
se invoca en modo local.
"""
import os
import time

import requests

CACHE_TTL_SECONDS = 60
DEFAULT_TIMEOUT = 4

_catalog_cache = {"key": None, "data": None, "expires_at": 0.0}


class InventoryApiError(Exception):
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self.payload = payload
        super().__init__(f"Inventory API error {status_code}: {payload}")


class InsufficientStockError(InventoryApiError):
    """La API respondió 409: stock insuficiente para uno o más ítems."""


def modo_inventario():
    return os.environ.get("INVENTORY_MODE", "local")


def _base_url():
    return os.environ.get("INVENTORY_API_URL", "").rstrip("/")


def _headers():
    return {
        "X-API-Key": os.environ.get("INVENTORY_API_KEY", ""),
        "Content-Type": "application/json",
    }


def buscar_catalogo(q="", use_cache=True, timeout=DEFAULT_TIMEOUT):
    """GET /api/integration/catalog?q=. Cachea resultados de solo lectura
    hasta CACHE_TTL_SECONDS; nunca cachea mutaciones."""
    now = time.time()
    if use_cache and _catalog_cache["key"] == q and _catalog_cache["expires_at"] > now:
        return _catalog_cache["data"]

    resp = requests.get(
        f"{_base_url()}/api/integration/catalog",
        params={"q": q},
        headers=_headers(),
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()

    if use_cache:
        _catalog_cache.update({"key": q, "data": data, "expires_at": now + CACHE_TTL_SECONDS})

    return data


def registrar_venta(items, referencia, timeout=DEFAULT_TIMEOUT):
    """POST /api/integration/sale. `items`: lista de {"sku", "cantidad"}.
    Lanza InsufficientStockError en 409, requests.RequestException en
    fallo de red/timeout (el caller decide si encolar en mutaciones_pendientes)."""
    resp = requests.post(
        f"{_base_url()}/api/integration/sale",
        json={
            "reference": referencia,
            "items": [{"sku": i["sku"], "quantity": i["cantidad"]} for i in items],
        },
        headers=_headers(),
        timeout=timeout,
    )
    if resp.status_code == 409:
        raise InsufficientStockError(409, resp.json())
    resp.raise_for_status()
    return resp.json()


def recibir_mercaderia(items, referencia=None, timeout=DEFAULT_TIMEOUT):
    """POST /api/integration/receive. `items`: lista de
    {"sku", "cantidad", "precio_costo"(opcional)}."""
    payload_items = []
    for i in items:
        entry = {"sku": i["sku"], "quantity": i["cantidad"]}
        if i.get("precio_costo") is not None:
            entry["unitCost"] = i["precio_costo"]
        payload_items.append(entry)

    resp = requests.post(
        f"{_base_url()}/api/integration/receive",
        json={"reference": referencia, "items": payload_items},
        headers=_headers(),
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def buscar_movimientos(reference="", timeout=DEFAULT_TIMEOUT):
    """GET /api/integration/movements?reference=<prefijo>. Solo lectura,
    usado por reporte_consistencia.py."""
    resp = requests.get(
        f"{_base_url()}/api/integration/movements",
        params={"reference": reference},
        headers=_headers(),
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def ajustar_stock(sku, cantidad_absoluta, motivo, referencia=None, timeout=DEFAULT_TIMEOUT):
    """POST /api/integration/adjust (ajuste absoluto por conteo físico)."""
    resp = requests.post(
        f"{_base_url()}/api/integration/adjust",
        json={"sku": sku, "quantity": cantidad_absoluta, "reason": motivo, "reference": referencia},
        headers=_headers(),
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()
