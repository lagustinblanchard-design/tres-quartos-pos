"""
Convierte el Excel de stock (formato matriz) al formato plano que necesita la app.
Uso: python convertir_excel.py stock.xlsx
El archivo de salida se guarda como stock_convertido.xlsx
"""
import sys
import pandas as pd

TALLAS_VALIDAS = {'8', '10', '12', '14', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'}


def normalizar(v):
    """Convierte '8.0' → '8', '10.0' → '10', deja 'XS' igual."""
    try:
        f = float(v)
        if f == int(f):
            return str(int(f))
    except (ValueError, TypeError):
        pass
    return str(v).strip()


def convertir(input_file):
    sheet = sys.argv[2] if len(sys.argv) > 2 else 0
    df = pd.read_excel(input_file, sheet_name=sheet, header=None)
    ncols = df.shape[1]

    # Paso 1: recolectar precio por categoría escaneando col 15
    precio_por_categoria = {}
    categoria_actual = ""
    for _, row in df.iterrows():
        nombre = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        if not nombre or nombre.lower() == 'nan':
            continue
        vals_resto = [normalizar(row.iloc[i]) for i in range(1, ncols) if pd.notna(row.iloc[i])]
        if any(v in TALLAS_VALIDAS for v in vals_resto):
            categoria_actual = nombre
            continue
        # Detectar "PRECIO DE VENTA" en col 15
        if ncols > 15:
            label = str(row.iloc[15]).strip() if pd.notna(row.iloc[15]) else ""
            if "PRECIO" in label.upper() and "VENTA" in label.upper() and ncols > 16:
                try:
                    precio_por_categoria[categoria_actual] = float(row.iloc[16])
                except (ValueError, TypeError):
                    pass

    # Paso 2: generar filas con precios correctos
    resultados = []
    categoria_actual = ""
    cols_talla = {}

    for _, row in df.iterrows():
        nombre = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        if not nombre or nombre.lower() == 'nan':
            continue

        vals_resto = [normalizar(row.iloc[i]) for i in range(1, ncols) if pd.notna(row.iloc[i])]
        es_header = any(v in TALLAS_VALIDAS for v in vals_resto)

        if es_header:
            categoria_actual = nombre
            cols_talla = {}
            for i in range(1, ncols):
                v = normalizar(row.iloc[i]) if pd.notna(row.iloc[i]) else ""
                if v in TALLAS_VALIDAS:
                    cols_talla[i] = v
            continue

        precio_venta = precio_por_categoria.get(categoria_actual, 0)

        for col_idx, talla in cols_talla.items():
            try:
                stock = row.iloc[col_idx]
                if pd.isna(stock):
                    continue
                stock_val = int(float(stock))
                if stock_val > 0:
                    resultados.append({
                        'nombre': nombre,
                        'categoria': categoria_actual,
                        'talla': talla,
                        'stock': stock_val,
                        'precio_venta': precio_venta,
                        'precio_costo': 0,
                    })
            except (ValueError, TypeError):
                continue

    out = pd.DataFrame(resultados, columns=['nombre', 'categoria', 'talla', 'stock', 'precio_venta', 'precio_costo'])
    base = input_file.rsplit('.', 1)[0]
    output_file = base + '_convertido.xlsx'
    out.to_excel(output_file, index=False)

    print(f"Listo: {len(resultados)} variantes, {out['nombre'].nunique()} productos")
    print(f"Archivo guardado: {output_file}")
    return output_file

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python convertir_excel.py archivo.xlsx")
        sys.exit(1)
    convertir(sys.argv[1])
