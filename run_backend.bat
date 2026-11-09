@echo off
title Mini Google Backend
echo ========================================================
echo   Starting Mini Google Backend (FastAPI + MongoDB)
echo ========================================================
echo.

:: 1. Try activating virtual environment if present
if exist ".venv312\Scripts\activate.bat" (
    echo Activating .venv312...
    call .venv312\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    echo Activating .venv...
    call .venv\Scripts\activate.bat
)

:: 2. Verify uvicorn is available, otherwise install requirements
python -c "import uvicorn, fastapi" 2>nul
if errorlevel 1 (
    echo [INFO] Installing required backend dependencies...
    pip install -r requirements.txt
)

echo.
echo ========================================================
echo   Backend is running at http://127.0.0.1:8000
echo   Leave this window open while using Mini Google!
echo ========================================================
echo.

python -m uvicorn search_api.main:app --reload --host 127.0.0.1 --port 8000
pause
