import json
import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_categoria, seed_producto, seed_variante, seed_turno  # noqa: F401


@pytest.fixture
def ventas_setup(app):
    with app.app_context():
        conn = db_module.DbConnection()
        cid = seed_categoria(conn, "VentaCat")
        pid = seed_producto(conn, "Remera", cat_id=cid, precio_venta=4000)
        vid = seed_variante(conn, pid, talla="M", stock=10)
        conn.close()
    return pid, vid, cid


def test_pos_requires_login(client):
    rv = client.get("/ventas/")
    assert rv.status_code == 302
    assert "login" in rv.headers["Location"]


def test_pos_renders(auth_client):
    client, _ = auth_client
    rv = client.get("/ventas/")
    assert rv.status_code == 200


def test_api_productos_returns_empty_for_no_match(auth_client):
    client, _ = auth_client
    rv = client.get("/ventas/api/productos?q=zzzzzznothing")
    assert rv.status_code == 200
    assert json.loads(rv.data) == []


def test_api_productos_returns_matching_products(auth_client, ventas_setup):
    client, _ = auth_client
    rv = client.get("/ventas/api/productos?q=Remera")
    data = json.loads(rv.data)
    assert len(data) >= 1
    assert data[0]["nombre"] == "Remera"


def test_api_productos_includes_variantes(auth_client, ventas_setup):
    client, _ = auth_client
    rv = client.get("/ventas/api/productos?q=Remera")
    data = json.loads(rv.data)
    assert "variantes" in data[0]
    assert len(data[0]["variantes"]) >= 1
    assert data[0]["variantes"][0]["talla"] == "M"


def test_api_productos_filters_by_categoria(auth_client, ventas_setup, app):
    client, _ = auth_client
    pid, vid, cid = ventas_setup
    rv = client.get(f"/ventas/api/productos?cat={cid}")
    data = json.loads(rv.data)
    assert all(p["categoria"] == "VentaCat" for p in data)


def test_api_productos_excludes_inactive(auth_client, app):
    client, _ = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        pid = seed_producto(conn, "RemeraInactiva", precio_venta=1000)
        conn.execute("UPDATE productos SET activo=0 WHERE id=%s", (pid,))
        conn.commit()
        conn.close()
    rv = client.get("/ventas/api/productos?q=RemeraInactiva")
    data = json.loads(rv.data)
    assert not any(p["id"] == pid for p in data)


def test_api_variante_returns_data(auth_client, ventas_setup):
    client, _ = auth_client
    pid, var_id, cid = ventas_setup
    rv = client.get(f"/ventas/api/variante/{var_id}")
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["talla"] == "M"


def test_api_variante_returns_404_for_missing(auth_client):
    client, _ = auth_client
    rv = client.get("/ventas/api/variante/999999")
    assert rv.status_code == 404


def test_cobrar_requires_turno(auth_client, ventas_setup):
    client, _ = auth_client
    pid, var_id, cid = ventas_setup
    rv = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": var_id, "cantidad": 1, "precio_unitario": 4000, "descuento": 0}],
        "metodo_pago": "efectivo",
    })
    assert rv.status_code == 400
    assert b"turno" in rv.data.lower()


def test_cobrar_empty_cart_returns_400(auth_client_with_turno):
    client, vid, tid = auth_client_with_turno
    rv = client.post("/ventas/cobrar", json={"items": [], "metodo_pago": "efectivo"})
    assert rv.status_code == 400


def test_cobrar_creates_venta(auth_client_with_turno, ventas_setup, app):
    client, vid, tid = auth_client_with_turno
    pid, var_id, cid = ventas_setup
    rv = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": var_id, "cantidad": 2, "precio_unitario": 4000, "descuento": 0}],
        "metodo_pago": "efectivo",
        "descuento_global": 0,
    })
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data["ok"] is True
    assert data["ticket"]["total"] == 8000.0
    with app.app_context():
        conn = db_module.DbConnection()
        venta = conn.execute("SELECT * FROM ventas WHERE id=%s", (data["ticket"]["venta_id"],)).fetchone()
        conn.close()
    assert venta is not None
    assert venta["total"] == 8000.0


def test_cobrar_decrements_stock(auth_client_with_turno, ventas_setup, app):
    client, vid, tid = auth_client_with_turno
    pid, var_id, cid = ventas_setup
    with app.app_context():
        conn = db_module.DbConnection()
        stock_before = conn.execute("SELECT stock FROM variantes WHERE id=%s", (var_id,)).fetchone()["stock"]
        conn.close()
    client.post("/ventas/cobrar", json={
        "items": [{"variante_id": var_id, "cantidad": 1, "precio_unitario": 4000, "descuento": 0}],
        "metodo_pago": "efectivo",
    })
    with app.app_context():
        conn = db_module.DbConnection()
        stock_after = conn.execute("SELECT stock FROM variantes WHERE id=%s", (var_id,)).fetchone()["stock"]
        conn.close()
    assert stock_after == stock_before - 1


def test_cobrar_applies_descuento_global(auth_client_with_turno, ventas_setup):
    client, vid, tid = auth_client_with_turno
    pid, var_id, cid = ventas_setup
    rv = client.post("/ventas/cobrar", json={
        "items": [{"variante_id": var_id, "cantidad": 1, "precio_unitario": 4000, "descuento": 0}],
        "metodo_pago": "efectivo",
        "descuento_global": 10,
    })
    data = json.loads(rv.data)
    assert data["ticket"]["total"] == 3600.0


def test_historial_requires_login(client):
    rv = client.get("/ventas/historial")
    assert rv.status_code == 302


def test_historial_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/ventas/historial")
    assert rv.status_code == 200


def test_detalle_nonexistent_redirects(auth_client):
    client, _ = auth_client
    rv = client.get("/ventas/99999/detalle", follow_redirects=True)
    assert b"no encontrada" in rv.data.lower()
