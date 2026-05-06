from flask import Blueprint, render_template, request, redirect, url_for, session, Response
from database import get_db
import io

reportes_bp = Blueprint("reportes", __name__, url_prefix="/reportes")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("vendedor_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


@reportes_bp.route("/")
@login_required
def dashboard():
    db = get_db()
    from datetime import date
    hoy = date.today().strftime("%Y-%m-%d")

    ventas_hoy = db.execute(
        "SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM ventas WHERE fecha LIKE %s AND estado='completada'",
        (hoy + "%",)
    ).fetchone()

    metodos = db.execute(
        "SELECT metodo_pago, COALESCE(SUM(total),0) as total FROM ventas WHERE fecha LIKE %s AND estado='completada' GROUP BY metodo_pago",
        (hoy + "%",)
    ).fetchall()

    top_productos = db.execute("""
        SELECT p.nombre, SUM(iv.cantidad) as total_vendido, SUM(iv.subtotal) as total_pesos
        FROM items_venta iv
        LEFT JOIN variantes v ON v.id = iv.variante_id
        LEFT JOIN productos p ON p.id = v.producto_id
        JOIN ventas ve ON ve.id = iv.venta_id
        WHERE ve.fecha LIKE %s AND ve.estado='completada' AND p.id IS NOT NULL
        GROUP BY p.id ORDER BY total_vendido DESC LIMIT 5
    """, (hoy + "%",)).fetchall()

    stock_bajo = db.execute("""
        SELECT p.nombre, v.talla, v.color, v.stock, v.stock_minimo
        FROM variantes v JOIN productos p ON p.id=v.producto_id
        WHERE v.stock <= v.stock_minimo AND p.activo=1
        ORDER BY v.stock ASC LIMIT 10
    """).fetchall()

    db.close()
    return render_template("reportes/dashboard.html",
                           ventas_hoy=ventas_hoy,
                           metodos=metodos,
                           top_productos=top_productos,
                           stock_bajo=stock_bajo,
                           active="dashboard")


@reportes_bp.route("/ventas")
@login_required
def ventas_reporte():
    db = get_db()
    from datetime import date, timedelta
    fecha_desde = request.args.get("desde", (date.today() - timedelta(days=30)).strftime("%Y-%m-%d"))
    fecha_hasta = request.args.get("hasta", date.today().strftime("%Y-%m-%d"))

    ventas = db.execute("""
        SELECT v.*, vd.nombre as vendedor_nombre
        FROM ventas v JOIN vendedores vd ON vd.id=v.vendedor_id
        WHERE v.fecha BETWEEN %s AND %s AND v.estado='completada'
        ORDER BY v.fecha DESC
    """, (fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59")).fetchall()

    totales = db.execute("""
        SELECT COALESCE(SUM(total),0) as total, COUNT(*) as cantidad,
               COALESCE(AVG(total),0) as promedio
        FROM ventas WHERE fecha BETWEEN %s AND %s AND estado='completada'
    """, (fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59")).fetchone()

    por_metodo = db.execute("""
        SELECT metodo_pago, SUM(total) as total, COUNT(*) as cantidad
        FROM ventas WHERE fecha BETWEEN %s AND %s AND estado='completada'
        GROUP BY metodo_pago
    """, (fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59")).fetchall()

    top_productos = db.execute("""
        SELECT p.nombre, SUM(iv.cantidad) as total_vendido, SUM(iv.subtotal) as total_pesos
        FROM items_venta iv
        LEFT JOIN variantes v ON v.id = iv.variante_id
        LEFT JOIN productos p ON p.id = v.producto_id
        JOIN ventas ve ON ve.id = iv.venta_id
        WHERE ve.fecha BETWEEN %s AND %s AND ve.estado='completada' AND p.id IS NOT NULL
        GROUP BY p.id ORDER BY total_vendido DESC LIMIT 10
    """, (fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59")).fetchall()

    db.close()
    return render_template("reportes/ventas.html",
                           ventas=ventas, totales=totales,
                           por_metodo=por_metodo,
                           top_productos=top_productos,
                           fecha_desde=fecha_desde,
                           fecha_hasta=fecha_hasta,
                           active="reportes")


@reportes_bp.route("/stock")
@login_required
def stock():
    db = get_db()
    productos = db.execute("""
        SELECT p.nombre, p.sku, c.nombre as categoria,
               p.precio_costo, p.precio_venta,
               COALESCE(SUM(va.stock), 0) as stock_total,
               COALESCE(SUM(va.stock), 0) * p.precio_costo as valor_costo,
               COALESCE(SUM(va.stock), 0) * p.precio_venta as valor_venta
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN variantes va ON va.producto_id = p.id
        WHERE p.activo = 1
        GROUP BY p.id ORDER BY p.nombre
    """).fetchall()

    totales = {
        "valor_costo": sum(p["valor_costo"] for p in productos),
        "valor_venta": sum(p["valor_venta"] for p in productos),
        "stock_total": sum(p["stock_total"] for p in productos),
    }
    db.close()
    return render_template("reportes/stock.html", productos=productos,
                           totales=totales, active="reportes")


@reportes_bp.route("/ventas/exportar")
@login_required
def exportar_ventas():
    import pandas as pd
    from datetime import date, timedelta
    db = get_db()
    fecha_desde = request.args.get("desde", (date.today() - timedelta(days=30)).strftime("%Y-%m-%d"))
    fecha_hasta = request.args.get("hasta", date.today().strftime("%Y-%m-%d"))

    rows = db.execute("""
        SELECT v.id, v.fecha, vd.nombre as vendedor, v.metodo_pago,
               v.subtotal, v.descuento, v.total
        FROM ventas v JOIN vendedores vd ON vd.id=v.vendedor_id
        WHERE v.fecha BETWEEN %s AND %s AND v.estado='completada'
        ORDER BY v.fecha DESC
    """, (fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59")).fetchall()
    db.close()

    df = pd.DataFrame([dict(r) for r in rows])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Ventas")
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ventas_{fecha_desde}_{fecha_hasta}.xlsx"}
    )


@reportes_bp.route("/stock/exportar")
@login_required
def exportar_stock():
    import pandas as pd
    db = get_db()
    rows = db.execute("""
        SELECT p.nombre, p.sku, c.nombre as categoria,
               p.precio_costo, p.precio_venta,
               COALESCE(SUM(va.stock),0) as stock_total,
               COALESCE(SUM(va.stock),0)*p.precio_costo as valor_costo,
               COALESCE(SUM(va.stock),0)*p.precio_venta as valor_venta
        FROM productos p
        LEFT JOIN categorias c ON c.id=p.categoria_id
        LEFT JOIN variantes va ON va.producto_id=p.id
        WHERE p.activo=1 GROUP BY p.id ORDER BY p.nombre
    """).fetchall()
    db.close()
    df = pd.DataFrame([dict(r) for r in rows])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Stock")
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=stock.xlsx"}
    )
