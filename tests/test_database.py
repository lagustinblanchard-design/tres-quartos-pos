import os
import pytest
import database as db_module
from database import DbConnection, DbCursor


@pytest.fixture
def sqlite_db(app):
    with app.app_context():
        conn = DbConnection()
        yield conn
        conn.close()


def test_dbconnection_creates_sqlite_when_no_env(app):
    with app.app_context():
        conn = DbConnection()
        assert conn._is_pg is False
        conn.close()


def test_dbcursor_adapt_replaces_percent_s(app):
    with app.app_context():
        conn = DbConnection()
        import sqlite3
        cur = DbCursor(conn._conn.cursor(), is_pg=False)
        adapted = cur._adapt("SELECT * FROM vendedores WHERE id=%s")
        assert "?" in adapted
        assert "%s" not in adapted
        conn.close()


def test_dbcursor_adapt_replaces_ilike(app):
    with app.app_context():
        conn = DbConnection()
        cur = DbCursor(conn._conn.cursor(), is_pg=False)
        adapted = cur._adapt("SELECT * FROM productos WHERE nombre ILIKE %s")
        assert "ILIKE" not in adapted.upper()
        assert "LIKE" in adapted.upper()
        conn.close()


def test_dbcursor_adapt_strips_returning_id(app):
    with app.app_context():
        conn = DbConnection()
        cur = DbCursor(conn._conn.cursor(), is_pg=False)
        adapted = cur._adapt("INSERT INTO vendedores (nombre) VALUES (?) RETURNING id")
        assert "RETURNING" not in adapted.upper()
        conn.close()


def test_dbcursor_adapt_strips_returning_id_nombre(app):
    with app.app_context():
        conn = DbConnection()
        cur = DbCursor(conn._conn.cursor(), is_pg=False)
        adapted = cur._adapt("INSERT INTO productos (nombre) VALUES (?) RETURNING id, nombre")
        assert "RETURNING" not in adapted.upper()
        conn.close()


def test_execute_returns_lastrowid_after_insert(sqlite_db):
    cur = sqlite_db.execute(
        "INSERT INTO vendedores (nombre) VALUES (%s) RETURNING id", ("Test",)
    )
    assert isinstance(cur.lastrowid, int)
    assert cur.lastrowid > 0


def test_execute_fetchone_returns_dict_like_row(sqlite_db):
    sqlite_db.execute("INSERT INTO vendedores (nombre) VALUES (%s)", ("DictTest",))
    sqlite_db.commit()
    row = sqlite_db.execute("SELECT nombre FROM vendedores WHERE nombre=%s", ("DictTest",)).fetchone()
    assert row["nombre"] == "DictTest"


def test_execute_fetchall_returns_list(sqlite_db):
    for n in ["A", "B", "C"]:
        sqlite_db.execute("INSERT INTO vendedores (nombre) VALUES (%s)", (n,))
    sqlite_db.commit()
    rows = sqlite_db.execute("SELECT nombre FROM vendedores WHERE nombre IN (%s,%s,%s)", ("A","B","C")).fetchall()
    assert len(rows) == 3


def test_commit_persists_data(app):
    with app.app_context():
        c1 = DbConnection()
        c1.execute("INSERT INTO vendedores (nombre) VALUES (%s)", ("Persist",))
        c1.commit()
        c1.close()
        c2 = DbConnection()
        row = c2.execute("SELECT nombre FROM vendedores WHERE nombre=%s", ("Persist",)).fetchone()
        c2.close()
        assert row is not None


def test_close_does_not_raise(sqlite_db):
    sqlite_db.close()


def test_get_db_returns_same_instance_within_context(app):
    with app.app_context():
        db1 = db_module.get_db()
        db2 = db_module.get_db()
        assert db1 is db2
