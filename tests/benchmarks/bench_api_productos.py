import os
import tempfile
import pytest

os.environ.setdefault("SECRET_KEY", "bench-secret")

import database as db_module


@pytest.fixture(scope="module")
def bench_app():
    from main import app as flask_app
    flask_app.config["TESTING"] = True

    fd, db_path = tempfile.mkstemp(suffix="_bench.db")
    os.close(fd)

    original_path = db_module.DB_PATH
    original_url = db_module.DATABASE_URL
    db_module.DB_PATH = db_path
    db_module.DATABASE_URL = None

    with flask_app.app_context():
        db_module.init_db()
        conn = db_module.DbConnection()
        for i in range(50):
            pid = conn.execute(
                "INSERT INTO productos (nombre, precio_venta, activo) VALUES (%s,%s,1) RETURNING id",
                (f"BenchProd {i}", 3000)
            ).lastrowid
            for t in ["S", "M", "L"]:
                conn.execute(
                    "INSERT INTO variantes (producto_id, talla, stock) VALUES (%s,%s,%s)",
                    (pid, t, 5)
                )
        conn.commit()
        conn.close()
        yield flask_app

    db_module.DB_PATH = original_path
    db_module.DATABASE_URL = original_url
    os.unlink(db_path)


@pytest.fixture(scope="module")
def bench_client(bench_app):
    with bench_app.app_context():
        conn = db_module.DbConnection()
        vid = conn.execute(
            "INSERT INTO vendedores (nombre) VALUES (%s) RETURNING id", ("BenchUser",)
        ).lastrowid
        conn.commit()
        conn.close()
    with bench_app.test_client() as c:
        with c.session_transaction() as sess:
            sess["vendedor_id"] = vid
        yield c


def test_bench_api_productos(benchmark, bench_client):
    """Benchmark: api_productos with 50 products x 3 variantes each (2 queries vs old N+1=51)."""
    result = benchmark(bench_client.get, "/ventas/api/productos?q=")
    assert result.status_code == 200
    import json
    data = json.loads(result.data)
    assert len(data) == 50
    for p in data:
        assert len(p["variantes"]) == 3


def test_bench_reportes_stock(benchmark, bench_client):
    """Benchmark: stock report with 50 products."""
    result = benchmark(bench_client.get, "/reportes/stock")
    assert result.status_code == 200
