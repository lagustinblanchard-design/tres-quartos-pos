import pytest
import database as db_module
from tests.conftest import seed_vendedor, seed_categoria, seed_producto, seed_variante, seed_turno


def test_dashboard_requires_login(client):
    rv = client.get("/reportes/")
    assert rv.status_code == 302


def test_dashboard_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/reportes/")
    assert rv.status_code == 200


def test_dashboard_shows_stock_bajo(auth_client, app):
    client, _ = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        pid = seed_producto(conn, "StockBajoTest")
        conn.execute(
            "INSERT INTO variantes (producto_id, talla, stock, stock_minimo) VALUES (%s,'S',0,5)",
            (pid,)
        )
        conn.commit()
        conn.close()
    rv = client.get("/reportes/")
    assert rv.status_code == 200
    assert b"StockBajoTest" in rv.data


def test_ventas_reporte_requires_login(client):
    rv = client.get("/reportes/ventas")
    assert rv.status_code == 302


def test_ventas_reporte_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/reportes/ventas")
    assert rv.status_code == 200


def test_ventas_reporte_filters_by_date(auth_client, app):
    client, vid = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        tid = seed_turno(conn, vid)
        conn.execute(
            "INSERT INTO ventas (turno_id, vendedor_id, fecha, metodo_pago, total, estado) VALUES (%s,%s,'2020-01-01 10:00:00','efectivo',100,'completada')",
            (tid, vid)
        )
        conn.commit()
        conn.close()
    rv = client.get("/reportes/ventas?desde=2026-01-01&hasta=2026-12-31")
    assert rv.status_code == 200
    # Venta from 2020 should not appear
    assert b"2020-01-01" not in rv.data


def test_stock_requires_login(client):
    rv = client.get("/reportes/stock")
    assert rv.status_code == 302


def test_stock_returns_200(auth_client):
    client, _ = auth_client
    rv = client.get("/reportes/stock")
    assert rv.status_code == 200


def test_stock_shows_valor_costo(auth_client, app):
    client, _ = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        pid = seed_producto(conn, "ValorCostoTest", precio_costo=1000.0)
        conn.execute(
            "INSERT INTO variantes (producto_id, talla, stock) VALUES (%s,'M',3)",
            (pid,)
        )
        conn.commit()
        conn.close()
    rv = client.get("/reportes/stock")
    assert rv.status_code == 200
    assert b"ValorCostoTest" in rv.data


def test_stock_excludes_inactive(auth_client, app):
    client, _ = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        pid = seed_producto(conn, "InactivoReporte")
        conn.execute("UPDATE productos SET activo=0 WHERE id=%s", (pid,))
        conn.commit()
        conn.close()
    rv = client.get("/reportes/stock")
    assert b"InactivoReporte" not in rv.data


def test_exportar_ventas_returns_xlsx(auth_client):
    client, _ = auth_client
    rv = client.get("/reportes/ventas/exportar")
    assert rv.status_code == 200
    assert "spreadsheetml" in rv.content_type


def test_exportar_stock_returns_xlsx(auth_client):
    client, _ = auth_client
    rv = client.get("/reportes/stock/exportar")
    assert rv.status_code == 200
    assert "spreadsheetml" in rv.content_type
