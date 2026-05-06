@echo off
chcp 65001 >nul
title TRES QUARTOS POS

:: Ruta directa de Python (instalado en este equipo)
set PYTHON=C:\Users\agusj\AppData\Local\Programs\Python\Python311\python.exe

:: Fallback: buscar en PATH
if not exist "%PYTHON%" (
    set PYTHON=python
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        py --version >nul 2>&1
        if %errorlevel% neq 0 (
            echo [ERROR] Python no encontrado. Ejecuta instalar.bat primero.
            pause
            exit /b 1
        )
        set PYTHON=py
    )
)

:: Verificar Flask
%PYTHON% -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Faltan dependencias. Ejecuta instalar.bat primero.
    pause
    exit /b 1
)

echo.
echo  Iniciando TRES QUARTOS POS...
echo  Abriendo navegador en http://localhost:5000
echo.
echo  Para cerrar el sistema: cierra esta ventana o presiona Ctrl+C
echo.

cd /d "%~dp0"
%PYTHON% main.py
