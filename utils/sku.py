"""
Generación determinística de SKU — debe producir EXACTAMENTE el mismo
resultado que scripts/import-inventory-lib.ts en tq-ecommerce (misma regla,
dos lenguajes) para que el mapeo `variantes.sku_canonico` del POS Flask
coincida con los SKU que crea el importador del ecommerce.
Ver design.md §D5 y specs/inventory-import/spec.md.
"""
import re
import unicodedata


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def category_code(categoria: str) -> str:
    slug = slugify(categoria).replace("-", "")
    if not slug:
        return "GEN"
    return slug[:3].upper().ljust(3, "X")


def build_product_sku(categoria: str, nombre: str) -> str:
    return f"TQ-{category_code(categoria)}-{slugify(nombre)}"


def build_variant_sku(categoria: str, nombre: str, talla: str) -> str:
    talla_norm = str(talla).strip().upper()
    return f"{build_product_sku(categoria, nombre)}-{talla_norm}"
