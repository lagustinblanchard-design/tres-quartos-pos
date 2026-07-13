from poblar_sku_canonico import poblar
from utils.sku import build_variant_sku
from tests.conftest import seed_categoria, seed_producto, seed_variante


def test_poblar_dry_run_no_escribe(db):
    cat_id = seed_categoria(db, "Rugby")
    prod_id = seed_producto(db, "Camiseta Lions", cat_id=cat_id)
    vid = seed_variante(db, prod_id, talla="M")

    poblar(apply=False)

    row = db.execute("SELECT sku_canonico FROM variantes WHERE id=%s", (vid,)).fetchone()
    assert row["sku_canonico"] is None


def test_poblar_apply_escribe_sku_esperado(db):
    cat_id = seed_categoria(db, "Rugby")
    prod_id = seed_producto(db, "Camiseta Lions", cat_id=cat_id)
    vid = seed_variante(db, prod_id, talla="M")

    poblar(apply=True)

    row = db.execute("SELECT sku_canonico FROM variantes WHERE id=%s", (vid,)).fetchone()
    assert row["sku_canonico"] == build_variant_sku("Rugby", "Camiseta Lions", "M")


def test_poblar_variante_sin_talla_no_mapeada(db):
    cat_id = seed_categoria(db, "Rugby")
    prod_id = seed_producto(db, "Camiseta Sin Talla", cat_id=cat_id)
    vid = seed_variante(db, prod_id, talla="")

    poblar(apply=True)

    row = db.execute("SELECT sku_canonico FROM variantes WHERE id=%s", (vid,)).fetchone()
    assert row["sku_canonico"] is None


def test_poblar_es_idempotente(db):
    cat_id = seed_categoria(db, "Rugby")
    prod_id = seed_producto(db, "Camiseta Lions", cat_id=cat_id)
    vid = seed_variante(db, prod_id, talla="M")

    poblar(apply=True)
    first = db.execute("SELECT sku_canonico FROM variantes WHERE id=%s", (vid,)).fetchone()["sku_canonico"]

    poblar(apply=True)
    second = db.execute("SELECT sku_canonico FROM variantes WHERE id=%s", (vid,)).fetchone()["sku_canonico"]

    assert first == second
