from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from database import get_db
from utils.helpers import fecha_ahora

caja_bp = Blueprint("caja", __name__, url_prefix="/caja")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("vendedor_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


@caja_bp.route("/")
@login_required
def turno():
    db = get_db()
    turno_activo = db.execute(
        "SELECT t.*, v.nombre as vendedor_nombre FROM turnos_caja t JOIN vendedores v ON v.id=t.vendedor_id WHERE t.id=%s",
        (session.get("turno_id"),)
    ).fetchone() if session.get("turno_id") else None

    resumen = None
    if turno_activo:
        ventas = db.execute(
            "SELECT metodo_pago, SUM(total) as total FROM ventas WHERE turno_id=%s AND estado='completada' GROUP BY metodo_pago",
            (turno_activo["id"],)
        ).fetchall()
        total_ventas = db.execute(
            "SELECT COALESCE(SUM(total),0) as t FROM ventas WHERE turno_id=%s AND estado='completada'",
            (turno_activo["id"],)
        ).fetchone()["t"]
        movimientos = db.execute(
            "SELECT tipo, SUM(monto) as total FROM movimientos_caja WHERE turno_id=%s GROUP BY tipo",
            (turno_activo["id"],)
        ).fetchall()
        ingresos_extra = sum(m["total"] for m in movimientos if m["tipo"] == "ingreso")
        egresos_extra = sum(m["total"] for m in movimientos if m["tipo"] == "egreso")
        efectivo_ventas = next((v["total"] for v in ventas if v["metodo_pago"] == "efectivo"), 0)
        arqueo_esperado = turno_activo["monto_inicial"] + efectivo_ventas + ingresos_extra - egresos_extra
        resumen = {
            "ventas": ventas,
            "total_ventas": total_ventas,
            "ingresos_extra": ingresos_extra,
            "egresos_extra": egresos_extra,
            "arqueo_esperado": arqueo_esperado,
        }

    turnos_hist = db.execute(
        "SELECT t.*, v.nombre as vendedor_nombre FROM turnos_caja t JOIN vendedores v ON v.id=t.vendedor_id WHERE t.estado='cerrado' ORDER BY t.id DESC LIMIT 10"
    ).fetchall()
    return render_template("caja/turno.html", turno=turno_activo, resumen=resumen,
                           turnos_hist=turnos_hist, active="caja")


@caja_bp.route("/abrir", methods=["POST"])
@login_required
def abrir():
    db = get_db()
    vid = session["vendedor_id"]
    monto = float(request.form.get("monto_inicial", 0) or 0)
    turno_id = db.execute(
        "INSERT INTO turnos_caja (vendedor_id, fecha_apertura, monto_inicial, estado) VALUES (%s,%s,%s,'abierto') RETURNING id",
        (vid, fecha_ahora(), monto)
    ).lastrowid
    db.commit()
    session["turno_id"] = turno_id
    flash("Turno abierto correctamente.", "success")
    return redirect(url_for("caja.turno"))


@caja_bp.route("/cerrar", methods=["POST"])
@login_required
def cerrar():
    tid = session.get("turno_id")
    if not tid:
        flash("No hay turno abierto.", "danger")
        return redirect(url_for("caja.turno"))
    db = get_db()
    monto_final = float(request.form.get("monto_final", 0) or 0)
    db.execute(
        "UPDATE turnos_caja SET estado='cerrado', fecha_cierre=%s, monto_final=%s WHERE id=%s",
        (fecha_ahora(), monto_final, tid)
    )
    db.commit()
    session.pop("turno_id", None)
    flash("Turno cerrado.", "success")
    return redirect(url_for("caja.turno"))


@caja_bp.route("/movimientos")
@login_required
def movimientos():
    db = get_db()
    tid = session.get("turno_id")
    movs = []
    if tid:
        movs = db.execute(
            "SELECT * FROM movimientos_caja WHERE turno_id=%s ORDER BY id DESC",
            (tid,)
        ).fetchall()
    return render_template("caja/movimientos.html", movimientos=movs, active="movimientos")


@caja_bp.route("/movimientos/nuevo", methods=["POST"])
@login_required
def nuevo_movimiento():
    tid = session.get("turno_id")
    if not tid:
        flash("No hay turno abierto.", "danger")
        return redirect(url_for("caja.movimientos"))
    tipo = request.form.get("tipo")
    concepto = request.form.get("concepto", "").strip()
    monto = float(request.form.get("monto", 0) or 0)
    if not concepto or monto <= 0:
        flash("Completá concepto y monto.", "danger")
        return redirect(url_for("caja.movimientos"))
    db = get_db()
    db.execute(
        "INSERT INTO movimientos_caja (turno_id, tipo, concepto, monto, fecha) VALUES (%s,%s,%s,%s,%s)",
        (tid, tipo, concepto, monto, fecha_ahora())
    )
    db.commit()
    flash("Movimiento registrado.", "success")
    return redirect(url_for("caja.movimientos"))
