"""
Reporte de consistencia: cruza las ventas del POS Flask contra los
StockMovement del ecommerce por referencia (`FLASK-POS #<venta_id>`) y
lista discrepancias. Correr durante el período de prueba en paralelo y
los primeros días después del switchover (tasks.md 5.1/5.3).

Uso: python reporte_consistencia.py
"""
from collections import defaultdict

from database import DbConnection, init_db
from utils import inventory_client

REFERENCE_PREFIX = "FLASK-POS #"


def calcular_esperado(rows):
    """rows: filas con venta_id y cantidad (una por línea de venta con SKU
    mapeado). Devuelve {referencia: cantidad_total_esperada}."""
    esperado = defaultdict(int)
    for r in rows:
        ref = f"{REFERENCE_PREFIX}{r['venta_id']}"
        esperado[ref] += r["cantidad"]
    return esperado


def calcular_real(movements):
    """movements: lista de StockMovement (dicts con reference/type/quantity).
    Devuelve {referencia: cantidad_total_descontada} solo para tipo VENTA."""
    real = defaultdict(int)
    for m in movements:
        if m["type"] == "VENTA":
            real[m["reference"]] += m["quantity"]
    return real


def comparar(esperado, real):
    """Devuelve (faltantes, sobrantes):
    - faltantes: referencias donde lo esperado (POS local) no coincide con
      lo aplicado en el ecommerce (venta perdida, en cola, o parcial).
    - sobrantes: referencias con movimiento en el ecommerce sin venta local
      correspondiente (referencia inesperada / venta borrada localmente).
    """
    faltantes = [
        (ref, qty, real.get(ref, 0)) for ref, qty in esperado.items() if real.get(ref, 0) != qty
    ]
    sobrantes = [(ref, qty) for ref, qty in real.items() if ref not in esperado]
    return faltantes, sobrantes


def _ventas_locales_con_sku():
    db = DbConnection()
    try:
        return db.execute("""
            SELECT v.id as venta_id, iv.cantidad
            FROM ventas v
            JOIN items_venta iv ON iv.venta_id = v.id
            JOIN variantes va ON va.id = iv.variante_id
            WHERE v.estado = 'completada' AND va.sku_canonico IS NOT NULL
        """).fetchall()
    finally:
        db.close()


def generar_reporte():
    rows = _ventas_locales_con_sku()
    esperado = calcular_esperado(rows)

    data = inventory_client.buscar_movimientos(reference=REFERENCE_PREFIX)
    real = calcular_real(data.get("movements", []))

    faltantes, sobrantes = comparar(esperado, real)

    print(f"Ventas locales con SKU mapeado: {len(esperado)}")
    print(f"Referencias con discrepancia de cantidad: {len(faltantes)}")
    for ref, esp, rea in faltantes:
        print(f"  {ref}: esperado {esp}, en ecommerce {rea}")

    print(f"\nMovimientos en el ecommerce sin venta local correspondiente: {len(sobrantes)}")
    for ref, qty in sobrantes:
        print(f"  {ref}: {qty} unidades")

    if not faltantes and not sobrantes:
        print("\nSin discrepancias. Todo consistente.")


if __name__ == "__main__":
    init_db()
    generar_reporte()
