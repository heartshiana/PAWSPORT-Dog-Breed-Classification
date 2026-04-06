@echo off
title PAWSPORT Launcher
color 1F

echo.
echo  ==========================================
echo   PAWSPORT ^| AI Dog Breed Passport App
echo  ==========================================
echo.

REM ── Check Node.js ─────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    echo  Please install it from: https://nodejs.org
    pause
    exit /b 1
)

REM ── Check Python ──────────────────────────────────────────
where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [ERROR] Python not found.
        echo  Please install it from: https://python.org
        pause
        exit /b 1
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

echo  [OK] Node.js found
echo  [OK] Python found (%PYTHON_CMD%)
echo.

REM ── Install Python deps if needed ─────────────────────────
echo  Checking Python dependencies...
%PYTHON_CMD% -c "import flask, PIL, numpy" >nul 2>&1
if %errorlevel% neq 0 (
    echo  Installing Python dependencies...
    %PYTHON_CMD% -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo  [WARN] Some Python deps may not have installed correctly.
    )
)

REM ── Install Node deps if needed ───────────────────────────
if not exist "node_modules\electron" (
    echo  Installing Node.js dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo.
echo  Launching PAWSPORT...
echo.

REM ── Launch Electron (main.js auto-starts Python) ──────────
npm start

pause
