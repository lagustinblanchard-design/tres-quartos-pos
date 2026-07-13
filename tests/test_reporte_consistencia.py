from reporte_consistencia import calcular_esperado, calcular_real, comparar


def test_calcular_esperado_agrupa_por_venta():
    rows = [
        {"venta_id": 1, "cantidad": 2},
        {"venta_id": 1, "cantidad": 1},
        {"venta_id": 2, "cantidad": 5},
    ]
    esperado = calcular_esperado(rows)
    assert esperado == {"FLASK-POS #1": 3, "FLASK-POS #2": 5}


def test_calcular_real_solo_cuenta_ventas():
    movements = [
        {"reference": "FLASK-POS #1", "type": "VENTA", "quantity": 3},
        {"reference": "FLASK-POS #1", "type": "AJUSTE", "quantity": 100},
        {"reference": "FLASK-POS #2", "type": "VENTA", "quantity": 5},
    ]
    real = calcular_real(movements)
    assert real == {"FLASK-POS #1": 3, "FLASK-POS #2": 5}


def test_comparar_sin_discrepancias():
    esperado = {"FLASK-POS #1": 3}
    real = {"FLASK-POS #1": 3}
    faltantes, sobrantes = comparar(esperado, real)
    assert faltantes == []
    assert sobrantes == []


def test_comparar_detecta_venta_no_aplicada():
    esperado = {"FLASK-POS #1": 3}
    real = {}
    faltantes, sobrantes = comparar(esperado, real)
    assert faltantes == [("FLASK-POS #1", 3, 0)]
    assert sobrantes == []


def test_comparar_detecta_movimiento_sin_venta_local():
    esperado = {}
    real = {"FLASK-POS #99": 2}
    faltantes, sobrantes = comparar(esperado, real)
    assert faltantes == []
    assert sobrantes == [("FLASK-POS #99", 2)]
