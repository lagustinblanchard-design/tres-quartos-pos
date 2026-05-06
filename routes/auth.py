from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from database import get_db
from utils.helpers import fecha_ahora

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    db = get_db()
    if request.method == "POST":
        vendedor_id = request.form.get("vendedor_id")
        pin = request.form.get("pin", "").strip()
        if not vendedor_id:
            flash("Seleccioná un vendedor.", "danger")
            return redirect(url_for("auth.login"))

        v = db.execute("SELECT * FROM vendedores WHERE id=%s AND activo=1", (vendedor_id,)).fetchone()
        if not v:
            flash("Vendedor no encontrado.", "danger")
            return redirect(url_for("auth.login"))

        if v["pin"] and v["pin"] != pin:
            flash("PIN incorrecto.", "danger")
            return redirect(url_for("auth.login"))

        session["vendedor_id"] = v["id"]
        session["vendedor_nombre"] = v["nombre"]

        turno = db.execute(
            "SELECT id FROM turnos_caja WHERE vendedor_id=%s AND estado='abierto' ORDER BY id DESC LIMIT 1",
            (v["id"],)
        ).fetchone()
        if turno:
            session["turno_id"] = turno["id"]

        db.close()
        return redirect(url_for("ventas.pos"))

    vendedores = db.execute("SELECT * FROM vendedores WHERE activo=1 ORDER BY nombre").fetchall()
    db.close()
    return render_template("login.html", vendedores=vendedores)


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.route("/vendedores", methods=["GET"])
def vendedores():
    db = get_db()
    lista = db.execute("SELECT * FROM vendedores ORDER BY nombre").fetchall()
    db.close()
    return render_template("vendedores.html", vendedores=lista, active="vendedores")


@auth_bp.route("/vendedores/nuevo", methods=["POST"])
def nuevo_vendedor():
    nombre = request.form.get("nombre", "").strip()
    pin = request.form.get("pin", "").strip()
    if not nombre:
        flash("El nombre es obligatorio.", "danger")
        return redirect(url_for("auth.vendedores"))
    db = get_db()
    db.execute("INSERT INTO vendedores (nombre, pin) VALUES (%s, %s)", (nombre, pin or None))
    db.commit()
    db.close()
    flash(f"Vendedor '{nombre}' creado.", "success")
    return redirect(url_for("auth.vendedores"))


@auth_bp.route("/vendedores/<int:vid>/toggle")
def toggle_vendedor(vid):
    db = get_db()
    v = db.execute("SELECT activo FROM vendedores WHERE id=%s", (vid,)).fetchone()
    if v:
        db.execute("UPDATE vendedores SET activo=%s WHERE id=%s", (0 if v["activo"] else 1, vid))
        db.commit()
    db.close()
    return redirect(url_for("auth.vendedores"))
