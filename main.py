import threading
import webbrowser
import os
from flask import Flask, redirect, url_for, session
from database import init_db
from routes.auth import auth_bp
from routes.ventas import ventas_bp
from routes.inventario import inventario_bp
from routes.caja import caja_bp
from routes.compras import compras_bp
from routes.reportes import reportes_bp

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "tresquartos_secret_2024")

app.register_blueprint(auth_bp)
app.register_blueprint(ventas_bp)
app.register_blueprint(inventario_bp)
app.register_blueprint(caja_bp)
app.register_blueprint(compras_bp)
app.register_blueprint(reportes_bp)

with app.app_context():
    init_db()


@app.route("/")
def index():
    if not session.get("vendedor_id"):
        return redirect(url_for("auth.login"))
    return redirect(url_for("ventas.pos"))


@app.template_filter("pesos")
def pesos_filter(valor):
    if valor is None:
        return "$0"
    return f"${int(valor):,}".replace(",", ".")


@app.template_filter("fecha_display")
def fecha_display_filter(fecha_str):
    if not fecha_str:
        return ""
    from datetime import datetime
    try:
        dt = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return fecha_str


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    if not os.environ.get("RENDER"):
        threading.Timer(1.0, open_browser).start()
    app.run(debug=False, host="0.0.0.0", port=port, use_reloader=False)
