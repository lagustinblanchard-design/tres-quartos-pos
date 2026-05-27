import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_turno


def test_turno_requires_login(client):
    rv = client.get("/caja/")
    assert rv.status_code == 302


def test_turno_no_active_shows_open_form(auth_client):
    client, _ = auth_client
    rv = client.get("/caja/")
    assert rv.status_code == 200


def test_abrir_creates_turno(auth_client, app):
    client, vid = auth_client
    rv = client.post("/caja/abrir", data={"monto_inicial": "500"}, follow_redirects=True)
    assert rv.status_code == 200
    with client.session_transaction() as sess:
        tid = sess.get("turno_id")
    assert tid is not None
    with app.app_context():
        conn = db_module.DbConnection()
        turno = conn.execute("SELECT * FROM turnos_caja WHERE id=%s", (tid,)).fetchone()
        conn.close()
    assert turno["estado"] == "abierto"
    assert turno["monto_inicial"] == 500.0


def test_cerrar_without_turno_flashes(auth_client):
    client, _ = auth_client
    rv = client.post("/caja/cerrar", data={"monto_final": "0"}, follow_redirects=True)
    assert b"No hay turno" in rv.data


def test_cerrar_marks_turno_closed(auth_client_with_turno, app):
    client, vid, tid = auth_client_with_turno
    client.post("/caja/cerrar", data={"monto_final": "1000"}, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        turno = conn.execute("SELECT estado, monto_final FROM turnos_caja WHERE id=%s", (tid,)).fetchone()
        conn.close()
    assert turno["estado"] == "cerrado"
    assert turno["monto_final"] == 1000.0


def test_cerrar_clears_session_turno(auth_client_with_turno):
    client, vid, tid = auth_client_with_turno
    client.post("/caja/cerrar", data={"monto_final": "0"})
    with client.session_transaction() as sess:
        assert "turno_id" not in sess


def test_movimientos_requires_login(client):
    rv = client.get("/caja/movimientos")
    assert rv.status_code == 302


def test_movimientos_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/caja/movimientos")
    assert rv.status_code == 200


def test_nuevo_movimiento_without_turno_flashes(auth_client):
    client, _ = auth_client
    rv = client.post("/caja/movimientos/nuevo", data={
        "tipo": "ingreso", "concepto": "Test", "monto": "100"
    }, follow_redirects=True)
    assert b"No hay turno" in rv.data


def test_nuevo_movimiento_missing_fields_flashes(auth_client_with_turno):
    client, vid, tid = auth_client_with_turno
    rv = client.post("/caja/movimientos/nuevo", data={
        "tipo": "ingreso", "concepto": "", "monto": "0"
    }, follow_redirects=True)
    assert b"concepto" in rv.data.lower() or b"monto" in rv.data.lower()


def test_nuevo_movimiento_creates_record(auth_client_with_turno, app):
    client, vid, tid = auth_client_with_turno
    client.post("/caja/movimientos/nuevo", data={
        "tipo": "ingreso", "concepto": "Venta efectivo", "monto": "250"
    }, follow_redirects=True)
    with app.app_context():
        conn = db_module.DbConnection()
        mov = conn.execute("SELECT * FROM movimientos_caja WHERE turno_id=%s AND concepto=%s",
                           (tid, "Venta efectivo")).fetchone()
        conn.close()
    assert mov is not None
    assert mov["monto"] == 250.0
