from flask import Blueprint, render_template, request, redirect, url_for, flash, session, Response
from database import get_db
from utils.helpers import fecha_ahora
import io

inventario_bp = Blueprint("inventario", __name__, url_prefix="/inventario")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("vendedor_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


@inventario_bp.route("/")
@login_required
def lista():
    db = get_db()
    q = request.args.get("q", "").strip()
    cat = request.args.get("cat", "")
    sql = """
        SELECT p.*, c.nombre as categoria_nombre,
               COALESCE(vs.stock_total, 0) as stock_total
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN (SELECT producto_id, SUM(stock) as stock_total FROM variantes GROUP BY producto_id) vs ON vs.producto_id = p.id
        WHERE p.activo = 1
    """
    params = []
    if q:
        sql += " AND (p.nombre LIKE %s OR p.sku LIKE %s)"
        params += [f"%{q}%", f"%{q}%"]
    if cat:
        sql += " AND p.categoria_id = %s"
        params.append(cat)
    sql += " ORDER BY p.nombre"
    productos = db.execute(sql, params).fetchall()
    categorias = db.execute("SELECT * FROM categorias ORDER BY nombre").fetchall()
    db.close()
    return render_template("inventario/lista.html", productos=productos,
                           categorias=categorias, q=q, cat=cat, active="inventario")


@inventario_bp.route("/nuevo", methods=["GET", "POST"])
@login_required
def nuevo():
    db = get_db()
    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        if not nombre:
            flash("El nombre es obligatorio.", "danger")
            return redirect(url_for("inventario.nuevo"))
        sku = request.form.get("sku", "").strip() or None
        cat = request.form.get("categoria_id") or None
        desc = request.form.get("descripcion", "").strip()
        costo = float(request.form.get("precio_costo") or 0)
        venta = float(request.form.get("precio_venta") or 0)
        pid = db.execute(
            "INSERT INTO productos (sku, nombre, categoria_id, descripcion, precio_costo, precio_venta) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
            (sku, nombre, cat, desc, costo, venta)
        ).lastrowid

        tallas = request.form.getlist("talla[]")
        colores = request.form.getlist("color[]")
        stocks = request.form.getlist("stock[]")
        stock_mins = request.form.getlist("stock_min[]")
        for i in range(len(tallas)):
            t = tallas[i].strip()
            c = colores[i].strip() if i < len(colores) else ""
            s = int(stocks[i] or 0) if i < len(stocks) else 0
            sm = int(stock_mins[i] or 0) if i < len(stock_mins) else 0
            if t or c or s:
                db.execute(
                    "INSERT INTO variantes (producto_id, talla, color, stock, stock_minimo) VALUES (%s,%s,%s,%s,%s)",
                    (pid, t, c, s, sm)
                )

        db.commit()
        db.close()
        flash(f"Producto '{nombre}' creado.", "success")
        return redirect(url_for("inventario.lista"))

    categorias = db.execute("SELECT * FROM categorias ORDER BY nombre").fetchall()
    db.close()
    return render_template("inventario/producto.html", producto=None, variantes=[],
                           categorias=categorias, active="inventario")


@inventario_bp.route("/<int:pid>/editar", methods=["GET", "POST"])
@login_required
def editar(pid):
    db = get_db()
    producto = db.execute("SELECT * FROM productos WHERE id=%s", (pid,)).fetchone()
    if not producto:
        flash("Producto no encontrado.", "danger")
        return redirect(url_for("inventario.lista"))

    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        sku = request.form.get("sku", "").strip() or None
        cat = request.form.get("categoria_id") or None
        desc = request.form.get("descripcion", "").strip()
        costo = float(request.form.get("precio_costo") or 0)
        venta = float(request.form.get("precio_venta") or 0)
        db.execute(
            "UPDATE productos SET sku=%s, nombre=%s, categoria_id=%s, descripcion=%s, precio_costo=%s, precio_venta=%s WHERE id=%s",
            (sku, nombre, cat, desc, costo, venta, pid)
        )

        db.execute("DELETE FROM variantes WHERE producto_id=%s", (pid,))
        tallas = request.form.getlist("talla[]")
        colores = request.form.getlist("color[]")
        stocks = request.form.getlist("stock[]")
        stock_mins = request.form.getlist("stock_min[]")
        for i in range(len(tallas)):
            t = tallas[i].strip()
            c = colores[i].strip() if i < len(colores) else ""
            s = int(stocks[i] or 0) if i < len(stocks) else 0
            sm = int(stock_mins[i] or 0) if i < len(stock_mins) else 0
            if t or c or s:
                db.execute(
                    "INSERT INTO variantes (producto_id, talla, color, stock, stock_minimo) VALUES (%s,%s,%s,%s,%s)",
                    (pid, t, c, s, sm)
                )

        db.commit()
        db.close()
        flash("Producto actualizado.", "success")
        return redirect(url_for("inventario.lista"))

    variantes = db.execute("SELECT * FROM variantes WHERE producto_id=%s ORDER BY talla, color", (pid,)).fetchall()
    categorias = db.execute("SELECT * FROM categorias ORDER BY nombre").fetchall()
    db.close()
    return render_template("inventario/producto.html", producto=producto, variantes=variantes,
                           categorias=categorias, active="inventario")


@inventario_bp.route("/<int:pid>/eliminar", methods=["POST"])
@login_required
def eliminar(pid):
    db = get_db()
    db.execute("UPDATE productos SET activo=0 WHERE id=%s", (pid,))
    db.commit()
    db.close()
    flash("Producto desactivado.", "success")
    return redirect(url_for("inventario.lista"))


@inventario_bp.route("/ajuste", methods=["GET", "POST"])
@login_required
def ajuste():
    db = get_db()
    if request.method == "POST":
        variante_id = request.form.get("variante_id")
        cantidad = int(request.form.get("cantidad", 0))
        db.execute("UPDATE variantes SET stock = stock + %s WHERE id=%s", (cantidad, variante_id))
        db.commit()
        db.close()
        flash("Stock ajustado.", "success")
        return redirect(url_for("inventario.lista"))

    variantes = db.execute("""
        SELECT v.*, p.nombre as producto_nombre
        FROM variantes v JOIN productos p ON p.id = v.producto_id
        WHERE p.activo=1
        ORDER BY p.nombre, v.talla, v.color
    """).fetchall()
    db.close()
    return render_template("inventario/ajuste.html", variantes=variantes, active="inventario")


@inventario_bp.route("/importar", methods=["GET", "POST"])
@login_required
def importar():
    preview = None
    error = None
    if request.method == "POST" and "archivo" in request.files:
        archivo = request.files["archivo"]
        if archivo.filename:
            import pandas as pd
            try:
                df = pd.read_excel(io.BytesIO(archivo.read()))
                df.columns = [str(c).strip() for c in df.columns]
                preview = df.head(10).to_dict("records")
                session["excel_cols"] = list(df.columns)
                import tempfile, os
                tmp = os.path.join(os.path.dirname(__file__), "..", "data", "_import_tmp.xlsx")
                archivo.seek(0)
                archivo.save(tmp)
            except Exception as e:
                error = str(e)

    cols = session.get("excel_cols", [])
    return render_template("inventario/importar.html", preview=preview, cols=cols,
                           error=error, active="importar")


@inventario_bp.route("/importar/confirmar", methods=["POST"])
@login_required
def importar_confirmar():
    import pandas as pd, os
    tmp = os.path.join(os.path.dirname(__file__), "..", "data", "_import_tmp.xlsx")
    if not os.path.exists(tmp):
        flash("No hay archivo para importar.", "danger")
        return redirect(url_for("inventario.importar"))

    col_nombre = request.form.get("col_nombre")
    col_sku = request.form.get("col_sku", "")
    col_categoria = request.form.get("col_categoria", "")
    col_precio_costo = request.form.get("col_precio_costo", "")
    col_precio_venta = request.form.get("col_precio_venta", "")
    col_talla = request.form.get("col_talla", "")
    col_color = request.form.get("col_color", "")
    col_stock = request.form.get("col_stock", "")

    df = pd.read_excel(tmp)
    df.columns = [str(c).strip() for c in df.columns]

    db = get_db()
    importados = 0
    for _, row in df.iterrows():
        nombre = str(row.get(col_nombre, "")).strip() if col_nombre else ""
        if not nombre or nombre == "nan":
            continue
        sku = str(row.get(col_sku, "")).strip() if col_sku else None
        if sku == "nan" or sku == "":
            sku = None
        cat_nombre = str(row.get(col_categoria, "")).strip() if col_categoria else None
        cat_id = None
        if cat_nombre and cat_nombre != "nan":
            cat = db.execute("SELECT id FROM categorias WHERE nombre=%s", (cat_nombre,)).fetchone()
            if not cat:
                cat_id = db.execute(
                    "INSERT INTO categorias (nombre) VALUES (%s) RETURNING id", (cat_nombre,)
                ).lastrowid
            else:
                cat_id = cat["id"]

        costo = float(row.get(col_precio_costo, 0) or 0) if col_precio_costo else 0
        venta = float(row.get(col_precio_venta, 0) or 0) if col_precio_venta else 0
        talla = str(row.get(col_talla, "")).strip() if col_talla else ""
        if talla == "nan": talla = ""
        color = str(row.get(col_color, "")).strip() if col_color else ""
        if color == "nan": color = ""
        stock = int(float(row.get(col_stock, 0) or 0)) if col_stock else 0

        p = db.execute("SELECT id FROM productos WHERE nombre=%s", (nombre,)).fetchone()
        if not p:
            pid = db.execute(
                "INSERT INTO productos (sku, nombre, categoria_id, precio_costo, precio_venta) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (sku, nombre, cat_id, costo, venta)
            ).lastrowid
        else:
            pid = p["id"]

        if talla or color or stock:
            db.execute(
                "INSERT INTO variantes (producto_id, talla, color, stock) VALUES (%s,%s,%s,%s)",
                (pid, talla, color, stock)
            )
        importados += 1

    db.commit()
    db.close()
    os.remove(tmp)
    flash(f"Se importaron {importados} productos.", "success")
    return redirect(url_for("inventario.lista"))


@inventario_bp.route("/categorias", methods=["GET", "POST"])
@login_required
def categorias():
    db = get_db()
    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        if nombre:
            db.execute("INSERT INTO categorias (nombre) VALUES (%s)", (nombre,))
            db.commit()
            flash("Categoría creada.", "success")
    cats = db.execute("SELECT * FROM categorias ORDER BY nombre").fetchall()
    db.close()
    return render_template("inventario/categorias.html", categorias=cats, active="inventario")
