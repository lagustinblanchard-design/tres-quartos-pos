import os
import re
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL")
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "pos.db")


class DbCursor:
    """Wraps a raw cursor to normalize behavior between SQLite and PostgreSQL."""

    def __init__(self, raw_cur, is_pg):
        self._cur = raw_cur
        self._is_pg = is_pg
        self.lastrowid = None

    def _adapt(self, sql):
        if not self._is_pg:
            sql = sql.replace("%s", "?")
            sql = re.sub(r'\bILIKE\b', 'LIKE', sql, flags=re.IGNORECASE)
            sql = re.sub(r'\s+RETURNING\s+id\s*$', '', sql, flags=re.IGNORECASE).strip()
        return sql

    def execute(self, sql, params=()):
        has_returning = bool(re.search(r'RETURNING\s+id\s*$', sql, flags=re.IGNORECASE))
        adapted = self._adapt(sql)
        self._cur.execute(adapted, params if params else [])
        if self._is_pg and has_returning:
            row = self._cur.fetchone()
            self.lastrowid = row["id"] if row else None
        elif not self._is_pg:
            self.lastrowid = self._cur.lastrowid
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


class DbConnection:
    def __init__(self):
        self._is_pg = bool(DATABASE_URL)
        if self._is_pg:
            import psycopg2
            import psycopg2.extras
            import urllib.parse
            p = urllib.parse.urlparse(DATABASE_URL)
            self._conn = psycopg2.connect(
                host=p.hostname,
                port=p.port or 5432,
                user=p.username,
                password=p.password,
                dbname=(p.path or '/postgres').lstrip('/') or 'postgres',
                sslmode='require',
                cursor_factory=psycopg2.extras.RealDictCursor,
            )
        else:
            self._conn = sqlite3.connect(DB_PATH)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql, params=()):
        raw_cur = self._conn.cursor()
        cur = DbCursor(raw_cur, self._is_pg)
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_db():
    return DbConnection()


_SQLITE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS vendedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        pin TEXT,
        activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        padre_id INTEGER REFERENCES categorias(id)
    );

    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        nombre TEXT NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id),
        descripcion TEXT,
        precio_costo REAL DEFAULT 0,
        precio_venta REAL DEFAULT 0,
        activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS variantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL REFERENCES productos(id),
        talla TEXT DEFAULT '',
        color TEXT DEFAULT '',
        stock INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        contacto TEXT,
        telefono TEXT,
        email TEXT,
        notas TEXT,
        activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS turnos_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
        fecha_apertura TEXT NOT NULL,
        fecha_cierre TEXT,
        monto_inicial REAL DEFAULT 0,
        monto_final REAL,
        estado TEXT DEFAULT 'abierto'
    );

    CREATE TABLE IF NOT EXISTS movimientos_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turno_id INTEGER NOT NULL REFERENCES turnos_caja(id),
        tipo TEXT NOT NULL,
        concepto TEXT NOT NULL,
        monto REAL NOT NULL,
        fecha TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turno_id INTEGER NOT NULL REFERENCES turnos_caja(id),
        vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
        fecha TEXT NOT NULL,
        metodo_pago TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        descuento REAL DEFAULT 0,
        total REAL DEFAULT 0,
        estado TEXT DEFAULT 'completada',
        notas TEXT
    );

    CREATE TABLE IF NOT EXISTS items_venta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL REFERENCES ventas(id),
        variante_id INTEGER REFERENCES variantes(id),
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        descuento REAL DEFAULT 0,
        subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor_id INTEGER REFERENCES proveedores(id),
        vendedor_id INTEGER REFERENCES vendedores(id),
        fecha TEXT NOT NULL,
        total REAL DEFAULT 0,
        estado TEXT DEFAULT 'pendiente',
        notas TEXT
    );

    CREATE TABLE IF NOT EXISTS items_compra (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_id INTEGER NOT NULL REFERENCES compras(id),
        variante_id INTEGER NOT NULL REFERENCES variantes(id),
        cantidad INTEGER NOT NULL,
        precio_costo REAL NOT NULL,
        subtotal REAL NOT NULL
    );
"""

_PG_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS vendedores (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        pin TEXT,
        activo INTEGER DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        padre_id INTEGER REFERENCES categorias(id)
    )""",
    """CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        sku TEXT UNIQUE,
        nombre TEXT NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id),
        descripcion TEXT,
        precio_costo REAL DEFAULT 0,
        precio_venta REAL DEFAULT 0,
        activo INTEGER DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS variantes (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id),
        talla TEXT DEFAULT '',
        color TEXT DEFAULT '',
        stock INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS proveedores (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        contacto TEXT,
        telefono TEXT,
        email TEXT,
        notas TEXT,
        activo INTEGER DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS turnos_caja (
        id SERIAL PRIMARY KEY,
        vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
        fecha_apertura TEXT NOT NULL,
        fecha_cierre TEXT,
        monto_inicial REAL DEFAULT 0,
        monto_final REAL,
        estado TEXT DEFAULT 'abierto'
    )""",
    """CREATE TABLE IF NOT EXISTS movimientos_caja (
        id SERIAL PRIMARY KEY,
        turno_id INTEGER NOT NULL REFERENCES turnos_caja(id),
        tipo TEXT NOT NULL,
        concepto TEXT NOT NULL,
        monto REAL NOT NULL,
        fecha TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        turno_id INTEGER NOT NULL REFERENCES turnos_caja(id),
        vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
        fecha TEXT NOT NULL,
        metodo_pago TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        descuento REAL DEFAULT 0,
        total REAL DEFAULT 0,
        estado TEXT DEFAULT 'completada',
        notas TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS items_venta (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER NOT NULL REFERENCES ventas(id),
        variante_id INTEGER REFERENCES variantes(id),
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        descuento REAL DEFAULT 0,
        subtotal REAL NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS compras (
        id SERIAL PRIMARY KEY,
        proveedor_id INTEGER REFERENCES proveedores(id),
        vendedor_id INTEGER REFERENCES vendedores(id),
        fecha TEXT NOT NULL,
        total REAL DEFAULT 0,
        estado TEXT DEFAULT 'pendiente',
        notas TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS items_compra (
        id SERIAL PRIMARY KEY,
        compra_id INTEGER NOT NULL REFERENCES compras(id),
        variante_id INTEGER NOT NULL REFERENCES variantes(id),
        cantidad INTEGER NOT NULL,
        precio_costo REAL NOT NULL,
        subtotal REAL NOT NULL
    )""",
]


def init_db():
    db = get_db()

    if db._is_pg:
        for stmt in _PG_SCHEMA:
            db.execute(stmt)
        db.commit()
    else:
        db._conn.executescript(_SQLITE_SCHEMA)

    cnt = db.execute("SELECT COUNT(*) as cnt FROM categorias").fetchone()["cnt"]
    if int(cnt) == 0:
        for nombre in ["Hombre", "Mujer", "Niños", "Accesorios"]:
            db.execute("INSERT INTO categorias (nombre) VALUES (%s)", (nombre,))
        db.commit()

    db.close()
