import sys
sys.argv = ['convertir_excel.py', r'C:\Users\agusj\Downloads\STOCK NUEVO IMAGO.xlsx', 'IMAGO']

# Override output path
import convertir_excel
import pandas as pd

TALLAS_VALIDAS = convertir_excel.TALLAS_VALIDAS
normalizar = convertir_excel.normalizar

input_file = sys.argv[1]
sheet = sys.argv[2]
df = pd.read_excel(input_file, sheet_name=sheet, header=None)
ncols = df.shape[1]

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
    if ncols > 15:
        label = str(row.iloc[15]).strip() if pd.notna(row.iloc[15]) else ""
        if "PRECIO" in label.upper() and "VENTA" in label.upper() and ncols > 16:
            try:
                precio_por_categoria[categoria_actual] = float(row.iloc[16])
            except (ValueError, TypeError):
                pass

print("Precios por categoría:", precio_por_categoria)

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
            if pd.isna(stock): continue
            stock_val = int(float(stock))
            if stock_val > 0:
                resultados.append({'nombre': nombre, 'categoria': categoria_actual, 'talla': talla,
                                   'stock': stock_val, 'precio_venta': precio_venta, 'precio_costo': 0})
        except: continue

out = pd.DataFrame(resultados, columns=['nombre','categoria','talla','stock','precio_venta','precio_costo'])
out.to_excel(r'C:\Users\agusj\tres_quartos_pos\stock_con_precios.xlsx', index=False)
print(f"Listo: {len(resultados)} variantes, precios: {out['precio_venta'].unique()}")
