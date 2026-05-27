from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from database import get_db
from utils.helpers import fecha_ahora

compras_bp = Blueprint("compras", __name__, url_prefix="/compras")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("vendedor_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


@compras_bp.route("/")
@login_required
def lista():
    db = get_db()
    compras = db.execute("""
        SELECT c.*, p.nombre as proveedor_nombre, v.nombre as vendedor_nombre
        FROM compras c
        LEFT JOIN proveedores p ON p.id = c.proveedor_id
        LEFT JOIN vendedores v ON v.id = c.vendedor_id
        ORDER BY c.id DESC LIMIT 100
    """).fetchall()
    return render_template("compras/lista.html", compras=compras, active="compras")


@compras_bp.route("/proveedores")
@login_required
def proveedores():
    db = get_db()
    lista = db.execute("SELECT * FROM proveedores WHERE activo=1 ORDER BY nombre").fetchall()
    return render_template("compras/proveedores.html", proveedores=lista, active="proveedores")


@compras_bp.route("/proveedores/nuevo", methods=["POST"])
@login_required
def nuevo_proveedor():
    nombre = request.form.get("nombre", "").strip()
    if not nombre:
        flash("El nombre es obligatorio.", "danger")
        return redirect(url_for("compras.proveedores"))
    db = get_db()
    db.execute(
        "INSERT INTO proveedores (nombre, contacto, telefono, email, notas) VALUES (%s,%s,%s,%s,%s)",
        (nombre, request.form.get("contacto",""), request.form.get("telefono",""),
         request.form.get("email",""), request.form.get("notas",""))
    )
    db.commit()
    flash(f"Proveedor '{nombre}' creado.", "success")
    return redirect(url_for("compras.proveedores"))


@compras_bp.route("/proveedores/<int:pid>/editar", methods=["POST"])
@login_required
def editar_proveedor(pid):
    db = get_db()
    db.execute(
        "UPDATE proveedores SET nombre=%s, contacto=%s, telefono=%s, email=%s, notas=%s WHERE id=%s",
        (request.form.get("nombre",""), request.form.get("contacto",""),
         request.form.get("telefono",""), request.form.get("email",""),
         request.form.get("notas",""), pid)
    )
    db.commit()
    flash("Proveedor actualizado.", "success")
    return redirect(url_for("compras.proveedores"))


@compras_bp.route("/nueva", methods=["GET", "POST"])
@login_required
def nueva():
    db = get_db()
    if request.method == "POST":
        proveedor_id = request.form.get("proveedor_id") or None
        notas = request.form.get("notas", "")
        variantes_ids = request.form.getlist("variante_id[]")
        cantidades = request.form.getlist("cantidad[]")
        precios = request.form.getlist("precio_costo[]")

        total = 0
        lineas = []
        for i in range(len(variantes_ids)):
            vid = variantes_ids[i]
            qty = int(cantidades[i] or 0)
            precio = float(precios[i] or 0)
            if vid and qty > 0:
                sub = qty * precio
                total += sub
                lineas.append((vid, qty, precio, sub))

        if not lineas:
            flash("Agregá al menos un ítem.", "danger")
            return redirect(url_for("compras.nueva"))

        cid = db.execute(
            "INSERT INTO compras (proveedor_id, vendedor_id, fecha, total, estado, notas) VALUES (%s,%s,%s,%s,'pendiente',%s) RETURNING id",
            (proveedor_id, session["vendedor_id"], fecha_ahora(), total, notas)
        ).lastrowid

        for vid, qty, precio, sub in lineas:
            db.execute(
                "INSERT INTO items_compra (compra_id, variante_id, cantidad, precio_costo, subtotal) VALUES (%s,%s,%s,%s,%s)",
                (cid, vid, qty, precio, sub)
            )
        db.commit()
        flash("Compra registrada.", "success")
        return redirect(url_for("compras.lista"))

    proveedores_lista = db.execute("SELECT * FROM proveedores WHERE activo=1 ORDER BY nombre").fetchall()
    variantes = db.execute("""
        SELECT v.id, p.nombre as producto_nombre, v.talla, v.color, v.stock, p.precio_costo
        FROM variantes v JOIN productos p ON p.id = v.producto_id
        WHERE p.activo=1 ORDER BY p.nombre, v.talla, v.color
    """).fetchall()
    variantes_dict = [dict(v) for v in variantes]
    return render_template("compras/nueva.html", proveedores=proveedores_lista,
                           variantes=variantes_dict, active="compras")


@compras_bp.route("/<int:cid>/recibir", methods=["POST"])
@login_required
def recibir(cid):
    db = get_db()
    compra = db.execute("SELECT * FROM compras WHERE id=%s", (cid,)).fetchone()
    if not compra or compra["estado"] == "recibida":
        flash("Compra no válida.", "danger")
        return redirect(url_for("compras.lista"))

    items = db.execute("SELECT * FROM items_compra WHERE compra_id=%s", (cid,)).fetchall()
    if items:
        case_parts = " ".join("WHEN %s THEN stock + %s" for _ in items)
        ids_placeholder = ",".join(["%s"] * len(items))
        params_stock = []
        for item in items:
            params_stock += [item["variante_id"], item["cantidad"]]
        params_stock += [item["variante_id"] for item in items]
        db.execute(
            f"UPDATE variantes SET stock = CASE id {case_parts} END WHERE id IN ({ids_placeholder})",
            params_stock
        )
        prod_prices = {}
        for item in items:
            var = db.execute("SELECT producto_id FROM variantes WHERE id=%s", (item["variante_id"],)).fetchone()
            if var:
                prod_prices[var["producto_id"]] = item["precio_costo"]
        for prod_id, precio in prod_prices.items():
            db.execute("UPDATE productos SET precio_costo=%s WHERE id=%s", (precio, prod_id))

    db.execute("UPDATE compras SET estado='recibida' WHERE id=%s", (cid,))
    db.commit()
    flash("Mercadería recibida. Stock actualizado.", "success")
    return redirect(url_for("compras.lista"))


@compras_bp.route("/<int:cid>/detalle")
@login_required
def detalle(cid):
    db = get_db()
    compra = db.execute("""
        SELECT c.*, p.nombre as proveedor_nombre, v.nombre as vendedor_nombre
        FROM compras c
        LEFT JOIN proveedores p ON p.id=c.proveedor_id
        LEFT JOIN vendedores v ON v.id=c.vendedor_id
        WHERE c.id=%s
    """, (cid,)).fetchone()
    items = db.execute("""
        SELECT ic.*, p.nombre, va.talla, va.color
        FROM items_compra ic
        JOIN variantes va ON va.id=ic.variante_id
        JOIN productos p ON p.id=va.producto_id
        WHERE ic.compra_id=%s
    """, (cid,)).fetchall()
    return render_template("compras/detalle.html", compra=compra, items=items)
