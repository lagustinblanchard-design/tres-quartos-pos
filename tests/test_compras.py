import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_categoria, seed_producto, seed_variante, seed_turno


@pytest.fixture
def compras_setup(app):
    with app.app_context():
        conn = db_module.DbConnection()
        cid = seed_categoria(conn, "CompraCat")
        pid = seed_producto(conn, "ProdCompra", cat_id=cid)
        vid = seed_variante(conn, pid, talla="L", stock=5)
        conn.close()
    return pid, vid, cid


def test_lista_requires_login(client):
    rv = client.get("/compras/")
    assert rv.status_code == 302


def test_lista_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/compras/")
    assert rv.status_code == 200


def test_proveedores_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/compras/proveedores")
    assert rv.status_code == 200


def test_nuevo_proveedor_missing_name_flashes(auth_client):
    client, _ = auth_client
    rv = client.post("/compras/proveedores/nuevo", data={"nombre": ""}, follow_redirects=True)
    assert b"obligatorio" in rv.data


def test_nuevo_proveedor_creates_record(auth_client, app):
    client, _ = auth_client
    client.post("/compras/proveedores/nuevo", data={"nombre": "ProvTest"}, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT id FROM proveedores WHERE nombre=%s", ("ProvTest",)).fetchone()
        conn.close()
    assert row is not None


def test_editar_proveedor_updates(auth_client, app):
    client, _ = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        conn.execute("INSERT INTO proveedores (nombre) VALUES (%s)", ("ProvEditar",))
        conn.commit()
        prov = conn.execute("SELECT id FROM proveedores WHERE nombre=%s", ("ProvEditar",)).fetchone()
        conn.close()
    client.post(f"/compras/proveedores/{prov['id']}/editar", data={"nombre": "ProvEditado"})
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT nombre FROM proveedores WHERE id=%s", (prov["id"],)).fetchone()
        conn.close()
    assert row["nombre"] == "ProvEditado"


def test_nueva_get_renders(auth_client):
    client, _ = auth_client
    rv = client.get("/compras/nueva")
    assert rv.status_code == 200


def test_nueva_post_empty_items_flashes(auth_client):
    client, _ = auth_client
    rv = client.post("/compras/nueva", data={}, follow_redirects=True)
    assert b"menos un" in rv.data


def test_nueva_post_creates_compra_pendiente(auth_client, app, compras_setup):
    client, vid = auth_client
    pid, var_id, cid = compras_setup
    client.post("/compras/nueva", data={
        "variante_id[]": [str(var_id)],
        "cantidad[]": ["3"],
        "precio_costo[]": ["1500"],
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        compra = conn.execute("SELECT * FROM compras ORDER BY id DESC LIMIT 1").fetchone()
        conn.close()
    assert compra["estado"] == "pendiente"
    assert compra["total"] == 4500.0


def test_recibir_increments_stock(auth_client, app, compras_setup):
    client, vid = auth_client
    pid, var_id, cid = compras_setup
    with app.app_context():
        conn = db_module.DbConnection()
        cid_compra = conn.execute(
            "INSERT INTO compras (vendedor_id, fecha, total, estado) VALUES (%s,'2026-01-01',3000,'pendiente') RETURNING id",
            (vid,)
        ).lastrowid
        conn.execute(
            "INSERT INTO items_compra (compra_id, variante_id, cantidad, precio_costo, subtotal) VALUES (%s,%s,%s,%s,%s)",
            (cid_compra, var_id, 3, 1000, 3000)
        )
        conn.commit()
        stock_before = conn.execute("SELECT stock FROM variantes WHERE id=%s", (var_id,)).fetchone()["stock"]
        conn.close()
    client.post(f"/compras/{cid_compra}/recibir", follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        stock_after = conn.execute("SELECT stock FROM variantes WHERE id=%s", (var_id,)).fetchone()["stock"]
        conn.close()
    assert stock_after == stock_before + 3


def test_recibir_updates_precio_costo(auth_client, app, compras_setup):
    client, vid = auth_client
    pid, var_id, cid = compras_setup
    with app.app_context():
        conn = db_module.DbConnection()
        cid_compra = conn.execute(
            "INSERT INTO compras (vendedor_id, fecha, total, estado) VALUES (%s,'2026-01-01',2000,'pendiente') RETURNING id",
            (vid,)
        ).lastrowid
        conn.execute(
            "INSERT INTO items_compra (compra_id, variante_id, cantidad, precio_costo, subtotal) VALUES (%s,%s,%s,%s,%s)",
            (cid_compra, var_id, 1, 999, 999)
        )
        conn.commit()
        conn.close()
    client.post(f"/compras/{cid_compra}/recibir")
    with app.app_context():
        conn = db_module.DbConnection()
        prod = conn.execute("SELECT precio_costo FROM productos WHERE id=%s", (pid,)).fetchone()
        conn.close()
    assert prod["precio_costo"] == 999.0


def test_recibir_marks_recibida(auth_client, app, compras_setup):
    client, vid = auth_client
    pid, var_id, cid = compras_setup
    with app.app_context():
        conn = db_module.DbConnection()
        cid_compra = conn.execute(
            "INSERT INTO compras (vendedor_id, fecha, total, estado) VALUES (%s,'2026-01-01',0,'pendiente') RETURNING id",
            (vid,)
        ).lastrowid
        conn.commit()
        conn.close()
    client.post(f"/compras/{cid_compra}/recibir")
    with app.app_context():
        conn = db_module.DbConnection()
        compra = conn.execute("SELECT estado FROM compras WHERE id=%s", (cid_compra,)).fetchone()
        conn.close()
    assert compra["estado"] == "recibida"


def test_recibir_invalid_redirects(auth_client):
    client, _ = auth_client
    rv = client.post("/compras/99999/recibir", follow_redirects=True)
    assert b"no v" in rv.data.lower()


def test_detalle_returns_200(auth_client, app, compras_setup):
    client, vid = auth_client
    pid, var_id, cid = compras_setup
    with app.app_context():
        conn = db_module.DbConnection()
        cid_compra = conn.execute(
            "INSERT INTO compras (vendedor_id, fecha, total, estado) VALUES (%s,'2026-01-01',0,'pendiente') RETURNING id",
            (vid,)
        ).lastrowid
        conn.commit()
        conn.close()
    rv = client.get(f"/compras/{cid_compra}/detalle")
    assert rv.status_code == 200
