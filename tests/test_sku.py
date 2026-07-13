from utils.sku import slugify, category_code, build_product_sku, build_variant_sku


def test_slugify_normaliza_acentos_y_espacios():
    assert slugify("Camiseta Lions México") == "camiseta-lions-mexico"


def test_category_code_tres_letras():
    assert category_code("Rugby") == "RUG"
    assert category_code("Pádel") == "PAD"


def test_category_code_vacia_cae_a_gen():
    assert category_code("") == "GEN"


def test_build_variant_sku_formato():
    # Debe coincidir exactamente con el importador en tq-ecommerce
    # (scripts/import-inventory-lib.ts) para que el mapeo funcione.
    assert build_variant_sku("Rugby", "Camiseta Lions", "xl") == "TQ-RUG-camiseta-lions-XL"
    assert build_product_sku("Rugby", "Camiseta Lions") == "TQ-RUG-camiseta-lions"


def test_sku_estable_entre_llamadas():
    a = build_variant_sku("Pádel", "Paleta Pro", "U")
    b = build_variant_sku("Pádel", "Paleta Pro", "U")
    assert a == b
