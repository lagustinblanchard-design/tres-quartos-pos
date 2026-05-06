@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║    TRES QUARTOS POS — Instalacion    ║
echo  ╚══════════════════════════════════════╝
echo.

:: Verificar Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python encontrado.
    goto instalar_paquetes
)

py --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python (py) encontrado.
    set PYTHON=py
    goto instalar_paquetes
)

echo [!] Python no esta instalado. Instalando con winget...
echo.
winget install -e --id Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo instalar Python automaticamente.
    echo.
    echo Por favor instala Python manualmente:
    echo   1. Abri https://www.python.org/downloads/
    echo   2. Descarga Python 3.11 o superior
    echo   3. IMPORTANTE: marca "Add Python to PATH" al instalar
    echo   4. Vuelve a ejecutar este script
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Python instalado. Cerrando y volviendo a abrir para aplicar PATH...
echo Por favor, ejecuta instalar.bat nuevamente despues de que se cierre esta ventana.
pause
exit /b 0

:instalar_paquetes
echo.
echo [*] Instalando dependencias...
echo.

if "%PYTHON%"=="" set PYTHON=python

%PYTHON% -m pip install --upgrade pip --quiet
%PYTHON% -m pip install flask pandas openpyxl --quiet

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema instalando las dependencias.
    echo Intenta correr: python -m pip install flask pandas openpyxl
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Instalacion completada con exito   ║
echo  ║   Ejecuta "iniciar.bat" para abrir   ║
echo  ╚══════════════════════════════════════╝
echo.
pause
