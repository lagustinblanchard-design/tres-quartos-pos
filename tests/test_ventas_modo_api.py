import itertools
import requests
import pytest

from utils import inventory_client
from tests.conftest import seed_categoria, seed_producto, seed_variante

_sku_counter = itertools.count()


@pytest.fixture(autouse=True)
def modo_api(monkeypatch):
    monkeypatch.setenv("INVENTORY_MODE", "api")
    monkeypatch.setenv("INVENTORY_API_URL", "http://ecommerce.test")
    monkeypatch.setenv("INVENTORY_API_KEY", "secreta")
    inventory_client._catalog_cache.update({"key": None, "data": None, "expires_at": 0.0})
    yield
    monkeypatch.delenv("INVENTORY_MODE", raising=False)


def _seed_variante_mapeada(db, stock_local=999):
    # SKU único por invocación: la DB de tests es session-scoped y varios
    # tests/archivos comparten el mismo esquema, así que un SKU fijo
    # colisionaría entre ellos (falsos positivos/negativos en queries por sku).
    n = next(_sku_counter)
    sku = f"TQ-RUG-camiseta-lions-M-{n}"
    cat_id = seed_categoria(db, "Rugby")
    prod_id = seed_producto(db, f"Camiseta Lions {n}", cat_id=cat_id)
    vid = seed_variante(db, prod_id, talla="M", stock=stock_local)
    db.execute("UPDATE variantes SET sku_canonico=%s WHERE id=%s", (sku, vid))
    db.commit()
    return vid, sku


def test_api_productos_modo_api_usa_catalogo_canonico(auth_client_with_turno, db, monkeypatch):
    client, _, _ = auth_client_with_turno
    vid, sku = _seed_variante_mapeada(db)

    def fake_buscar_catalogo(q="", use_cache=True, timeout=4):
        return {
            "products": [
                {
                    "sku": "TQ-RUG-camiseta-lions",
                    "nombre": "Camiseta Lions",
                    "variantes": [
                        {"sku": sku, "talla": "M", "color": "", "precio": 15000, "stock": 7}
                    ],
                }
            ]
        }

    monkeypatch.setattr(inventory_client, "buscar_catalogo", fake_buscar_catalogo)

    resp = client.get("/ventas/api/productos?q=camiseta")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["variantes"][0]["id"] == vid
    assert data[0]["variantes"][0]["stock"] == 7  # stock canónico, no el local (999)


def test_api_productos_modo_api_falla_de_red_responde_503(auth_client_with_turno, monkeypatch):
    client, _, _ = auth_client_with_turno

    def fake_buscar_catalogo(q="", use_cache=True, timeout=4):
        raise requests.ConnectionError("sin conexión")

    monkeypatch.setattr(inventory_client, "buscar_catalogo", fake_buscar_catalogo)

    resp = client.get("/ventas/api/productos?q=x")
    assert resp.status_code == 503


def test_cobrar_modo_api_exitoso_no_toca_stock_local(auth_client_with_turno, db, monkeypatch):
    client, _, _ = auth_client_with_turno
    vid, sku = _seed_variante_mapeada(db, stock_local=50)

    calls = []
    monkeypatch.setattr(
        inventory_client, "registrar_venta",
        lambda items, referencia: calls.append((items, referencia))
    )

    resp = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": vid, "cantidad": 2, "precio_unitario": 15000}],
        "metodo_pago": "efectivo",
    })
    assert resp.status_code == 200
    assert calls == [([{"sku": sku, "cantidad": 2}], f"FLASK-POS #{resp.get_json()['ticket']['venta_id']}")]

    row = db.execute("SELECT stock FROM variantes WHERE id=%s", (vid,)).fetchone()
    assert row["stock"] == 50  # sin cambios: el stock local ya no es autoritativo


def test_cobrar_modo_api_stock_insuficiente_no_completa_la_venta(auth_client_with_turno, db, monkeypatch):
    client, _, _ = auth_client_with_turno
    vid, sku = _seed_variante_mapeada(db)

    def fake_registrar_venta(items, referencia):
        raise inventory_client.InsufficientStockError(409, {"details": [{"sku": sku, "available": 0}]})

    monkeypatch.setattr(inventory_client, "registrar_venta", fake_registrar_venta)

    ventas_antes = db.execute("SELECT COUNT(*) as c FROM ventas").fetchone()["c"]

    resp = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": vid, "cantidad": 5, "precio_unitario": 15000}],
        "metodo_pago": "efectivo",
    })
    assert resp.status_code == 409

    ventas_despues = db.execute("SELECT COUNT(*) as c FROM ventas").fetchone()["c"]
    assert ventas_despues == ventas_antes  # rollback: no quedó venta a medias


def test_cobrar_modo_api_falla_de_red_completa_venta_y_encola(auth_client_with_turno, db, monkeypatch):
    client, _, _ = auth_client_with_turno
    vid, sku = _seed_variante_mapeada(db)

    def fake_registrar_venta(items, referencia):
        raise requests.Timeout("timeout")

    monkeypatch.setattr(inventory_client, "registrar_venta", fake_registrar_venta)

    resp = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": vid, "cantidad": 3, "precio_unitario": 15000}],
        "metodo_pago": "efectivo",
    })
    assert resp.status_code == 200  # la venta se completa igual (D7)

    pendientes = db.execute("SELECT * FROM mutaciones_pendientes WHERE sku=%s", (sku,)).fetchall()
    assert len(pendientes) == 1
    assert pendientes[0]["tipo"] == "venta"
    assert pendientes[0]["cantidad"] == 3
    assert pendientes[0]["procesado"] == 0
