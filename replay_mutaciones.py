"""
Reintenta las mutaciones de stock encoladas en `mutaciones_pendientes`
(ventas o recepciones confirmadas localmente mientras la API de inventario
no respondía — ver design.md §D7 y
specs/pos-inventory-integration/spec.md).

Corre en orden cronológico (por id). Si una venta ya no tiene stock
suficiente en el momento del replay, se aplica igual mediante un ajuste
absoluto con clamp en 0 (el desfase físico ya ocurrió; no aplicarlo
ocultaría stock vendido) y queda marcada con el detalle del error para
revisión manual.

Uso: python replay_mutaciones.py
"""
from database import DbConnection, init_db
from utils import inventory_client
from utils.helpers import fecha_ahora


def _stock_actual(sku):
    data = inventory_client.buscar_catalogo(sku, use_cache=False)
    for p in data.get("products", []):
        for v in p.get("variantes", []):
            if v["sku"] == sku:
                return v["stock"]
    return None


def replay():
    db = DbConnection()
    try:
        pendientes = db.execute(
            "SELECT * FROM mutaciones_pendientes WHERE procesado=0 ORDER BY id ASC"
        ).fetchall()

        if not pendientes:
            print("No hay mutaciones pendientes.")
            return

        print(f"Procesando {len(pendientes)} mutaciones pendientes...")
        aplicadas = 0
        con_error = 0

        for m in pendientes:
            try:
                if m["tipo"] == "venta":
                    inventory_client.registrar_venta(
                        [{"sku": m["sku"], "cantidad": m["cantidad"]}], referencia=m["referencia"]
                    )
                elif m["tipo"] == "recepcion":
                    inventory_client.recibir_mercaderia(
                        [{"sku": m["sku"], "cantidad": m["cantidad"]}], referencia=m["referencia"]
                    )
                else:
                    raise ValueError(f"tipo de mutación desconocido: {m['tipo']}")

                db.execute(
                    "UPDATE mutaciones_pendientes SET procesado=1, procesado_en=%s, error=NULL WHERE id=%s",
                    (fecha_ahora(), m["id"]),
                )
                db.commit()
                aplicadas += 1
                print(f"  OK  id={m['id']} {m['tipo']} {m['sku']} x{m['cantidad']}")

            except inventory_client.InsufficientStockError:
                actual = _stock_actual(m["sku"]) or 0
                nuevo = max(0, actual - m["cantidad"])
                motivo = f"Replay venta contingente {m['referencia']} — stock insuficiente, clamp a 0"
                inventory_client.ajustar_stock(m["sku"], nuevo, motivo, referencia=m["referencia"])
                db.execute(
                    "UPDATE mutaciones_pendientes SET procesado=1, procesado_en=%s, error=%s WHERE id=%s",
                    (fecha_ahora(), "stock insuficiente al replay; se forzó ajuste absoluto (revisar)", m["id"]),
                )
                db.commit()
                con_error += 1
                print(f"  AJUSTADO id={m['id']} {m['sku']} — stock insuficiente, se forzó a {nuevo}")

            except Exception as e:
                # No se marca como procesada: se reintenta en la próxima corrida.
                con_error += 1
                print(f"  FALLA id={m['id']} sigue sin poder aplicarse: {e}")

        print(f"\nAplicadas: {aplicadas} | Con error/forzadas (revisar): {con_error}")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    replay()
