import itertools
import requests
import pytest
import database as db_module
from utils import inventory_client
from tests.conftest import seed_categoria, seed_producto, seed_variante

_sku_counter = itertools.count()


@pytest.fixture(autouse=True)
def modo_api(monkeypatch):
    monkeypatch.setenv("INVENTORY_MODE", "api")
    monkeypatch.setenv("INVENTORY_API_URL", "http://ecommerce.test")
    monkeypatch.setenv("INVENTORY_API_KEY", "secreta")
    yield
    monkeypatch.delenv("INVENTORY_MODE", raising=False)


@pytest.fixture
def compra_setup(app):
    # SKU único por test: ver nota equivalente en test_ventas_modo_api.py.
    n = next(_sku_counter)
    with app.app_context():
        conn = db_module.DbConnection()
        cat_id = seed_categoria(conn, "Rugby")
        prod_id = seed_producto(conn, f"Camiseta Lions Compra {n}", cat_id=cat_id)
        var_id = seed_variante(conn, prod_id, talla="M", stock=5)
        sku = f"TQ-RUG-camiseta-lions-compra-M-{n}"
        conn.execute("UPDATE variantes SET sku_canonico=%s WHERE id=%s", (sku, var_id))
        conn.commit()
        conn.close()
    return var_id, sku


def _crear_compra_pendiente(app, vendedor_id, var_id, cantidad=3, precio_costo=1000):
    with app.app_context():
        conn = db_module.DbConnection()
        cid = conn.execute(
            "INSERT INTO compras (vendedor_id, fecha, total, estado) VALUES (%s,'2026-01-01',3000,'pendiente') RETURNING id",
            (vendedor_id,)
        ).lastrowid
        conn.execute(
            "INSERT INTO items_compra (compra_id, variante_id, cantidad, precio_costo, subtotal) VALUES (%s,%s,%s,%s,%s)",
            (cid, var_id, cantidad, precio_costo, cantidad * precio_costo)
        )
        conn.commit()
        conn.close()
    return cid


def test_recibir_modo_api_no_modifica_stock_local(auth_client, app, compra_setup, monkeypatch):
    client, vid = auth_client
    var_id, sku = compra_setup
    cid = _crear_compra_pendiente(app, vid, var_id)

    calls = []
    monkeypatch.setattr(
        inventory_client, "recibir_mercaderia",
        lambda items, referencia: calls.append((items, referencia))
    )

    resp = client.post(f"/compras/{cid}/recibir", follow_redirects=True)
    assert resp.status_code == 200
    assert calls == [([{"sku": sku, "cantidad": 3, "precio_costo": 1000}], f"FLASK-POS-COMPRA #{cid}")]

    with app.app_context():
        conn = db_module.DbConnection()
        stock = conn.execute("SELECT stock FROM variantes WHERE id=%s", (var_id,)).fetchone()["stock"]
        compra = conn.execute("SELECT estado FROM compras WHERE id=%s", (cid,)).fetchone()
        conn.close()
    assert stock == 5  # sin cambios: el stock canónico es el autoritativo
    assert compra["estado"] == "recibida"


def test_recibir_modo_api_falla_de_red_confirma_y_encola(auth_client, app, compra_setup, monkeypatch):
    client, vid = auth_client
    var_id, sku = compra_setup
    cid = _crear_compra_pendiente(app, vid, var_id, cantidad=4)

    def fake_recibir(items, referencia):
        raise requests.ConnectionError("sin conexión")

    monkeypatch.setattr(inventory_client, "recibir_mercaderia", fake_recibir)

    resp = client.post(f"/compras/{cid}/recibir", follow_redirects=True)
    assert resp.status_code == 200

    with app.app_context():
        conn = db_module.DbConnection()
        compra = conn.execute("SELECT estado FROM compras WHERE id=%s", (cid,)).fetchone()
        pendientes = conn.execute(
            "SELECT * FROM mutaciones_pendientes WHERE sku=%s AND tipo='recepcion'", (sku,)
        ).fetchall()
        conn.close()

    assert compra["estado"] == "recibida"  # se confirma igual (D7)
    assert len(pendientes) == 1
    assert pendientes[0]["cantidad"] == 4
