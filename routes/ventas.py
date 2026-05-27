from collections import defaultdict
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from database import get_db
from utils.helpers import fecha_ahora

ventas_bp = Blueprint("ventas", __name__, url_prefix="/ventas")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("vendedor_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


@ventas_bp.route("/")
@login_required
def pos():
    db = get_db()
    categorias = db.execute("SELECT * FROM categorias ORDER BY nombre").fetchall()
    return render_template("ventas/pos.html", categorias=categorias, active="pos")


@ventas_bp.route("/api/productos")
@login_required
def api_productos():
    db = get_db()
    q = request.args.get("q", "").strip()
    cat = request.args.get("cat", "")
    sql = """
        SELECT p.id, p.nombre, p.sku, p.precio_venta,
               c.nombre as categoria
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.activo=1
    """
    params = []
    if q:
        sql += " AND (p.nombre ILIKE %s OR p.sku ILIKE %s)"
        params += [f"%{q}%", f"%{q}%"]
    if cat:
        sql += " AND p.categoria_id=%s"
        params.append(cat)
    sql += " ORDER BY p.nombre LIMIT 50"
    productos = db.execute(sql, params).fetchall()

    resultado = []
    if productos:
        prod_ids = [p["id"] for p in productos]
        placeholders = ",".join(["%s"] * len(prod_ids))
        todas_variantes = db.execute(
            f"SELECT id, producto_id, talla, color, stock FROM variantes WHERE producto_id IN ({placeholders}) ORDER BY producto_id, talla, color",
            prod_ids
        ).fetchall()
        variantes_by_prod = defaultdict(list)
        for v in todas_variantes:
            variantes_by_prod[v["producto_id"]].append(dict(v))
        for p in productos:
            resultado.append({
                "id": p["id"],
                "nombre": p["nombre"],
                "sku": p["sku"],
                "precio_venta": p["precio_venta"],
                "categoria": p["categoria"],
                "variantes": variantes_by_prod[p["id"]],
            })
    return jsonify(resultado)


@ventas_bp.route("/api/variante/<int:vid>")
@login_required
def api_variante(vid):
    db = get_db()
    v = db.execute(
        "SELECT v.*, p.nombre as producto_nombre, p.precio_venta FROM variantes v JOIN productos p ON p.id=v.producto_id WHERE v.id=%s",
        (vid,)
    ).fetchone()
    if not v:
        return jsonify({"error": "no encontrado"}), 404
    return jsonify(dict(v))


@ventas_bp.route("/cobrar", methods=["POST"])
@login_required
def cobrar():
    tid = session.get("turno_id")
    if not tid:
        return jsonify({"error": "Sin turno activo. Abrí la caja primero."}), 400

    datos = request.get_json()
    items = datos.get("items", [])
    metodo_pago = datos.get("metodo_pago", "efectivo")
    descuento_global = float(datos.get("descuento_global", 0))
    notas = datos.get("notas", "")

    if not items:
        return jsonify({"error": "El carrito está vacío."}), 400

    db = get_db()
    subtotal = 0
    lineas = []
    for item in items:
        vid = item["variante_id"]
        qty = int(item["cantidad"])
        precio = float(item["precio_unitario"])
        desc_item = float(item.get("descuento", 0))
        sub = precio * qty * (1 - desc_item / 100)
        subtotal += sub
        lineas.append((vid, qty, precio, desc_item, sub))

    total = subtotal * (1 - descuento_global / 100)

    venta_id = db.execute(
        "INSERT INTO ventas (turno_id, vendedor_id, fecha, metodo_pago, subtotal, descuento, total, notas) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (tid, session["vendedor_id"], fecha_ahora(), metodo_pago, subtotal, descuento_global, total, notas)
    ).lastrowid

    for vid, qty, precio, desc_item, sub in lineas:
        db.execute(
            "INSERT INTO items_venta (venta_id, variante_id, cantidad, precio_unitario, descuento, subtotal) VALUES (%s,%s,%s,%s,%s,%s)",
            (venta_id, vid, qty, precio, desc_item, sub)
        )
        if vid:
            db.execute("UPDATE variantes SET stock = stock - %s WHERE id=%s", (qty, vid))

    db.commit()
    items_ticket = db.execute("""
        SELECT iv.cantidad, iv.precio_unitario, iv.descuento, iv.subtotal,
               COALESCE(p.nombre, '—') as nombre,
               COALESCE(v.talla, '') as talla,
               COALESCE(v.color, '') as color
        FROM items_venta iv
        LEFT JOIN variantes v ON v.id = iv.variante_id
        LEFT JOIN productos p ON p.id = v.producto_id
        WHERE iv.venta_id = %s
    """, (venta_id,)).fetchall()

    ticket = {
        "venta_id": venta_id,
        "fecha": fecha_ahora(),
        "metodo_pago": metodo_pago,
        "subtotal": subtotal,
        "descuento_global": descuento_global,
        "total": total,
        "items": [dict(i) for i in items_ticket],
        "vendedor": session.get("vendedor_nombre"),
    }
    return jsonify({"ok": True, "ticket": ticket})


@ventas_bp.route("/historial")
@login_required
def historial():
    db = get_db()
    fecha_desde = request.args.get("desde", "")
    fecha_hasta = request.args.get("hasta", "")
    sql = """
        SELECT v.*, vd.nombre as vendedor_nombre
        FROM ventas v JOIN vendedores vd ON vd.id = v.vendedor_id
        WHERE v.estado = 'completada'
    """
    params = []
    if fecha_desde:
        sql += " AND v.fecha >= %s"
        params.append(fecha_desde + " 00:00:00")
    if fecha_hasta:
        sql += " AND v.fecha <= %s"
        params.append(fecha_hasta + " 23:59:59")
    sql += " ORDER BY v.id DESC LIMIT 200"
    ventas = db.execute(sql, params).fetchall()
    return render_template("ventas/historial.html", ventas=ventas,
                           fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, active="historial")


@ventas_bp.route("/<int:vid>/detalle")
@login_required
def detalle(vid):
    db = get_db()
    venta = db.execute(
        "SELECT v.*, vd.nombre as vendedor_nombre FROM ventas v JOIN vendedores vd ON vd.id=v.vendedor_id WHERE v.id=%s",
        (vid,)
    ).fetchone()
    items = db.execute("""
        SELECT iv.*, COALESCE(p.nombre,'—') as nombre,
               COALESCE(va.talla,'') as talla,
               COALESCE(va.color,'') as color
        FROM items_venta iv
        LEFT JOIN variantes va ON va.id = iv.variante_id
        LEFT JOIN productos p ON p.id = va.producto_id
        WHERE iv.venta_id = %s
    """, (vid,)).fetchall()
    if not venta:
        flash("Venta no encontrada.", "danger")
        return redirect(url_for("ventas.historial"))
    return render_template("ventas/detalle.html", venta=venta, items=items)
