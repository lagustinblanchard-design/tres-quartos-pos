import os
import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import database as db_module


@pytest.fixture(scope="session")
def tmp_db_path(tmp_path_factory):
    return str(tmp_path_factory.mktemp("db") / "test_pos.db")


@pytest.fixture(scope="session")
def app(tmp_db_path):
    from main import app as flask_app
    flask_app.config["TESTING"] = True

    original_path = db_module.DB_PATH
    original_url = db_module.DATABASE_URL
    db_module.DB_PATH = tmp_db_path
    db_module.DATABASE_URL = None

    with flask_app.app_context():
        db_module.init_db()
        yield flask_app

    db_module.DB_PATH = original_path
    db_module.DATABASE_URL = original_url


@pytest.fixture
def client(app):
    with app.test_client() as c:
        yield c


@pytest.fixture
def db(app):
    with app.app_context():
        conn = db_module.DbConnection()
        yield conn
        conn.close()


def seed_vendedor(db, nombre="Test", pin=None):
    vid = db.execute(
        "INSERT INTO vendedores (nombre, pin) VALUES (%s, %s) RETURNING id",
        (nombre, pin)
    ).lastrowid
    db.commit()
    return vid


def seed_turno(db, vendedor_id):
    tid = db.execute(
        "INSERT INTO turnos_caja (vendedor_id, fecha_apertura, monto_inicial, estado) VALUES (%s,'2026-01-01 09:00:00',0,'abierto') RETURNING id",
        (vendedor_id,)
    ).lastrowid
    db.commit()
    return tid


def seed_categoria(db, nombre="Ropa"):
    cid = db.execute(
        "INSERT INTO categorias (nombre) VALUES (%s) RETURNING id", (nombre,)
    ).lastrowid
    db.commit()
    return cid


def seed_producto(db, nombre="Camiseta", cat_id=None, precio_venta=5000.0, precio_costo=2000.0):
    pid = db.execute(
        "INSERT INTO productos (nombre, categoria_id, precio_venta, precio_costo) VALUES (%s,%s,%s,%s) RETURNING id",
        (nombre, cat_id, precio_venta, precio_costo)
    ).lastrowid
    db.commit()
    return pid


def seed_variante(db, producto_id, talla="M", color="", stock=10):
    vid = db.execute(
        "INSERT INTO variantes (producto_id, talla, color, stock) VALUES (%s,%s,%s,%s) RETURNING id",
        (producto_id, talla, color, stock)
    ).lastrowid
    db.commit()
    return vid


@pytest.fixture
def auth_client(client, app):
    with app.app_context():
        conn = db_module.DbConnection()
        vid = seed_vendedor(conn, f"Vendedor_{id(client)}")
        conn.close()
    with client.session_transaction() as sess:
        sess["vendedor_id"] = vid
        sess["vendedor_nombre"] = "Vendedor Test"
    return client, vid


@pytest.fixture
def auth_client_with_turno(auth_client, app):
    client, vid = auth_client
    with app.app_context():
        conn = db_module.DbConnection()
        tid = seed_turno(conn, vid)
        conn.close()
    with client.session_transaction() as sess:
        sess["turno_id"] = tid
    return client, vid, tid
