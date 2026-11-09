@echo off
title Mini Google Launcher
echo ========================================================
echo          Starting Mini Google (Full Stack)
echo ========================================================
echo.
echo 1. Launching Backend API server (Port 8000)...
start "Mini Google Backend" cmd /k run_backend.bat

echo 2. Waiting 2 seconds for backend to start...
timeout /t 2 /nobreak >nul

echo 3. Launching Frontend server (Port 8080) and browser...
start "Mini Google Frontend" cmd /k run_frontend.bat

echo.
echo ========================================================
echo   Mini Google is running!
echo   Frontend: http://127.0.0.1:8080
echo   Backend:  http://127.0.0.1:8000
echo ========================================================
echo.

