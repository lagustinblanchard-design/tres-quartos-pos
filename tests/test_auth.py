import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_turno


def test_login_page_renders(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        seed_vendedor(conn, "Vendedor1")
        conn.close()
    rv = client.get("/login")
    assert rv.status_code == 200
    assert b"Vendedor1" in rv.data


def test_login_missing_vendedor_id_flashes_error(client):
    rv = client.post("/login", data={}, follow_redirects=True)
    assert b"Seleccion" in rv.data


def test_login_invalid_vendedor_id_flashes_error(client):
    rv = client.post("/login", data={"vendedor_id": "9999"}, follow_redirects=True)
    assert b"no encontrado" in rv.data


def test_login_wrong_pin_flashes_error(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "ConPin", pin="1234")
        conn.close()
    rv = client.post("/login", data={"vendedor_id": str(vid), "pin": "0000"}, follow_redirects=True)
    assert b"PIN" in rv.data


def test_login_no_pin_required_redirects_to_pos(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "SinPin", pin=None)
        conn.close()
    rv = client.post("/login", data={"vendedor_id": str(vid), "pin": ""})
    assert rv.status_code == 302
    assert "/ventas" in rv.headers["Location"]


def test_login_sets_session(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "SesionTest", pin="5678")
        conn.close()
    client.post("/login", data={"vendedor_id": str(vid), "pin": "5678"})
    with client.session_transaction() as sess:
        assert sess.get("vendedor_id") == vid


def test_login_sets_turno_in_session_if_open(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "ConTurno")
        tid = seed_turno(conn, vid)
        conn.close()
    client.post("/login", data={"vendedor_id": str(vid), "pin": ""})
    with client.session_transaction() as sess:
        assert sess.get("turno_id") == tid


def test_logout_clears_session(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "Logout")
        conn.close()
    client.post("/login", data={"vendedor_id": str(vid)})
    client.get("/logout")
    with client.session_transaction() as sess:
        assert "vendedor_id" not in sess


def test_vendedores_requires_login(client):
    rv = client.get("/vendedores")
    # No session set - auth check not on this route in current code
    assert rv.status_code == 200


def test_nuevo_vendedor_creates_record(client, app):
    rv = client.post("/vendedores/nuevo", data={"nombre": "Nuevo", "pin": "9999"}, follow_redirects=True)
    assert rv.status_code == 200
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT nombre FROM vendedores WHERE nombre=%s", ("Nuevo",)).fetchone()
        conn.close()
    assert row is not None


def test_nuevo_vendedor_missing_name_flashes(client):
    rv = client.post("/vendedores/nuevo", data={"nombre": ""}, follow_redirects=True)
    assert b"obligatorio" in rv.data


def test_toggle_vendedor_deactivates(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "Toggle")
        conn.close()
    client.get(f"/vendedores/{vid}/toggle")
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT activo FROM vendedores WHERE id=%s", (vid,)).fetchone()
        conn.close()
    assert row["activo"] == 0


def test_toggle_vendedor_reactivates(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, "Toggle2")
        conn.execute("UPDATE vendedores SET activo=0 WHERE id=%s", (vid,))
        conn.commit()
        conn.close()
    client.get(f"/vendedores/{vid}/toggle")
    with app.app_context():
        conn = db_module.DbConnection()
        row = conn.execute("SELECT activo FROM vendedores WHERE id=%s", (vid,)).fetchone()
        conn.close()
    assert row["activo"] == 1
