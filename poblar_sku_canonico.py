"""
Script one-shot: puebla variantes.sku_canonico en el POS Flask con la misma
regla de generación de SKU que usa el importador de tq-ecommerce
(utils/sku.py — debe coincidir con scripts/import-inventory-lib.ts).

Uso:
    python poblar_sku_canonico.py            (dry-run: solo reporta)
    python poblar_sku_canonico.py --apply     (escribe sku_canonico)

Variantes sin nombre de producto o sin talla quedan "no mapeadas" (por
ejemplo, variantes históricas de productos dados de baja) y no participan
del modo api del POS — ver specs/pos-inventory-integration/spec.md.
"""
import sys

from database import DbConnection, init_db
from utils.sku import build_variant_sku


def poblar(apply=False):
    db = DbConnection()
    try:
        variantes = db.execute("""
            SELECT v.id, v.talla, v.sku_canonico,
                   p.nombre as producto_nombre, c.nombre as categoria_nombre
            FROM variantes v
            JOIN productos p ON p.id = v.producto_id
            LEFT JOIN categorias c ON c.id = p.categoria_id
        """).fetchall()

        mapeadas = []
        no_mapeadas = []
        for v in variantes:
            categoria = v["categoria_nombre"] or ""
            nombre = v["producto_nombre"] or ""
            talla = v["talla"] or ""
            if not nombre or not talla:
                no_mapeadas.append((v["id"], "falta nombre de producto o talla"))
                continue
            sku = build_variant_sku(categoria, nombre, talla)
            mapeadas.append((v["id"], sku, v["sku_canonico"]))

        print(f"Variantes totales: {len(variantes)}")
        print(f"Mapeables: {len(mapeadas)} | No mapeables: {len(no_mapeadas)}")

        if no_mapeadas:
            print("\nNo mapeadas (quedan sin sku_canonico):")
            for vid, motivo in no_mapeadas:
                print(f"  variante id={vid}: {motivo}")

        if not apply:
            print("\nDry-run: no se escribió nada. Correr con --apply para confirmar.")
            return

        actualizadas = 0
        for vid, sku, actual in mapeadas:
            if actual != sku:
                db.execute("UPDATE variantes SET sku_canonico=%s WHERE id=%s", (sku, vid))
                actualizadas += 1
        db.commit()
        print(f"\n{actualizadas} variantes actualizadas con sku_canonico (de {len(mapeadas)} mapeables).")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    poblar(apply="--apply" in sys.argv)
