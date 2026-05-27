import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_categoria, seed_producto, seed_variante


@pytest.fixture
def inv_client(auth_client):
    client, vid = auth_client
    return client


@pytest.fixture
def seeded_product(app):
    with app.app_context():
        conn = db_module.DbConnection()
        cid = seed_categoria(conn, "TestCat")
        pid = seed_producto(conn, "Producto Test", cat_id=cid)
        vid = seed_variante(conn, pid, talla="M", stock=5)
        conn.close()
    return pid, vid, cid


def test_lista_requires_login(client):
    rv = client.get("/inventario/")
    assert rv.status_code == 302
    assert "login" in rv.headers["Location"]


def test_lista_returns_products(inv_client, app, seeded_product):
    rv = inv_client.get("/inventario/")
    assert rv.status_code == 200
    assert b"Producto Test" in rv.data


def test_lista_filters_by_query(inv_client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        seed_producto(conn, "CamisetaUnica")
        conn.close()
    rv = inv_client.get("/inventario/?q=CamisetaUnica")
    assert rv.status_code == 200
    assert b"CamisetaUnica" in rv.data


def test_lista_filters_by_categoria(inv_client, app, seeded_product):
    pid, vid, cid = seeded_product
    rv = inv_client.get(f"/inventario/?cat={cid}")
    assert rv.status_code == 200
    assert b"Producto Test" in rv.data


def test_nuevo_get_renders_form(inv_client):
    rv = inv_client.get("/inventario/nuevo")
    assert rv.status_code == 200


def test_nuevo_post_missing_name_flashes(inv_client):
    rv = inv_client.post("/inventario/nuevo", data={"nombre": ""}, follow_redirects=True)
    assert b"obligatorio" in rv.data


def test_nuevo_post_creates_product(inv_client, app):
    rv = inv_client.post("/inventario/nuevo", data={
        "nombre": "Nuevo Producto",
        "precio_venta": "3000",
        "precio_costo": "1000",
        "talla[]": ["M"],
        "color[]": [""],
        "stock[]": ["5"],
        "stock_min[]": ["1"],
    }, follow_redirects=True)
    assert rv.status_code == 200
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT id FROM productos WHERE nombre=%s", ("Nuevo Producto",)).fetchone()
        conn.close()
    assert row is not None


def test_nuevo_post_creates_variantes(inv_client, app):
    inv_client.post("/inventario/nuevo", data={
        "nombre": "ProductoConVariante",
        "talla[]": ["L"],
        "color[]": ["Rojo"],
        "stock[]": ["3"],
        "stock_min[]": ["0"],
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        pid = conn.execute("SELECT id FROM productos WHERE nombre=%s", ("ProductoConVariante",)).fetchone()["id"]
        var = conn.execute("SELECT * FROM variantes WHERE producto_id=%s", (pid,)).fetchone()
        conn.close()
    assert var["talla"] == "L"
    assert var["color"] == "Rojo"


def test_editar_get_renders_form(inv_client, seeded_product):
    pid, vid, cid = seeded_product
    rv = inv_client.get(f"/inventario/{pid}/editar")
    assert rv.status_code == 200
    assert b"Producto Test" in rv.data


def test_editar_nonexistent_redirects(inv_client):
    rv = inv_client.get("/inventario/99999/editar")
    assert rv.status_code == 302


def test_editar_post_updates_product(inv_client, app, seeded_product):
    pid, vid, cid = seeded_product
    inv_client.post(f"/inventario/{pid}/editar", data={
        "nombre": "Producto Editado",
        "precio_venta": "6000",
        "precio_costo": "2500",
        "talla[]": [],
        "color[]": [],
        "stock[]": [],
        "stock_min[]": [],
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT nombre FROM productos WHERE id=%s", (pid,)).fetchone()
        conn.close()
    assert row["nombre"] == "Producto Editado"


def test_eliminar_deactivates_product(inv_client, app, seeded_product):
    pid, vid, cid = seeded_product
    inv_client.post(f"/inventario/{pid}/eliminar")
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT activo FROM productos WHERE id=%s", (pid,)).fetchone()
        conn.close()
    assert row["activo"] == 0


def test_ajuste_get_shows_variantes(inv_client):
    rv = inv_client.get("/inventario/ajuste")
    assert rv.status_code == 200


def test_ajuste_post_increments_stock(inv_client, app, seeded_product):
    pid, variante_id, cid = seeded_product
    inv_client.post("/inventario/ajuste", data={"variante_id": str(variante_id), "cantidad": "3"})
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT stock FROM variantes WHERE id=%s", (variante_id,)).fetchone()
        conn.close()
    assert row["stock"] == 8


def test_ajuste_post_decrements_with_negative(inv_client, app, seeded_product):
    pid, variante_id, cid = seeded_product
    inv_client.post("/inventario/ajuste", data={"variante_id": str(variante_id), "cantidad": "-2"})
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT stock FROM variantes WHERE id=%s", (variante_id,)).fetchone()
        conn.close()
    assert row["stock"] == 3


def test_importar_get_renders(inv_client):
    rv = inv_client.get("/inventario/importar")
    assert rv.status_code == 200


def test_importar_confirmar_missing_data_redirects(inv_client):
    rv = inv_client.post("/inventario/importar/confirmar", data={"datos_b64": ""}, follow_redirects=True)
    assert b"No hay archivo" in rv.data


def test_importar_confirmar_bad_b64_redirects(inv_client):
    rv = inv_client.post("/inventario/importar/confirmar", data={"datos_b64": "!!invalid!!"}, follow_redirects=True)
    assert b"Error" in rv.data


def test_importar_confirmar_creates_products(inv_client, app):
    import json, base64
    rows = [{"nombre": "ImportTest", "categoria": "Cat1", "talla": "M", "color": "", "stock": "2",
             "precio_venta": "3000", "precio_costo": "1000"}]
    datos_b64 = base64.b64encode(json.dumps(rows).encode()).decode()
    inv_client.post("/inventario/importar/confirmar", data={
        "datos_b64": datos_b64,
        "col_nombre": "nombre",
        "col_categoria": "categoria",
        "col_talla": "talla",
        "col_color": "color",
        "col_stock": "stock",
        "col_precio_venta": "precio_venta",
        "col_precio_costo": "precio_costo",
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT id FROM productos WHERE nombre=%s", ("ImportTest",)).fetchone()
        conn.close()
    assert row is not None


def test_importar_confirmar_skips_empty_nombre(inv_client, app):
    import json, base64
    rows = [{"nombre": "", "talla": "M", "stock": "1"}]
    datos_b64 = base64.b64encode(json.dumps(rows).encode()).decode()
    count_before = None
    with app.app_context():
        conn = db_module.DbConnection()
        count_before = conn.execute("SELECT COUNT(*) as c FROM productos").fetchone()["c"]
        conn.close()
    inv_client.post("/inventario/importar/confirmar", data={
        "datos_b64": datos_b64,
        "col_nombre": "nombre",
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        count_after = conn.execute("SELECT COUNT(*) as c FROM productos").fetchone()["c"]
        conn.close()
    assert count_after == count_before


def test_categorias_get_lists(inv_client):
    rv = inv_client.get("/inventario/categorias")
    assert rv.status_code == 200


def test_categorias_post_creates(inv_client, app):
    inv_client.post("/inventario/categorias", data={"nombre": "NuevaCat"}, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT id FROM categorias WHERE nombre=%s", ("NuevaCat",)).fetchone()
        conn.close()
    assert row is not None
