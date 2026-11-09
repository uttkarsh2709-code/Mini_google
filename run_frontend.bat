@echo off
title Mini Google Frontend
echo ========================================================
echo   Starting Mini Google Frontend Server
echo ========================================================
echo.
echo Opening browser to http://127.0.0.1:8080 ...
start http://127.0.0.1:8080
echo Serving frontend directory on port 8080 ...
python -m http.server 8080 --directory frontend
pause

