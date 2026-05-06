from datetime import datetime


def formato_pesos(valor):
    if valor is None:
        return "$0"
    return f"${int(valor):,}".replace(",", ".")


def fecha_ahora():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def fecha_display(fecha_str):
    if not fecha_str:
        return ""
    try:
        dt = datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return fecha_str
