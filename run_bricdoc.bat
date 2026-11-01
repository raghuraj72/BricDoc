@echo off
title BricDoc Platform Runner
echo ========================================================
echo         Launching BricDoc Production Platform
echo ========================================================
echo.
echo [1/2] Starting Backend API on http://127.0.0.1:8005 ...
start "BricDoc Backend" /min cmd /k "cd /d "%~dp0" && python backend\run_backend.py"

echo [2/2] Starting Frontend App on http://localhost:3005 ...
start "BricDoc Frontend" /min cmd /k "cd /d "%~dp0frontend" && npm run start"

echo.
echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo.
echo Opening BricDoc in your browser...
start http://localhost:3005/

echo.
echo ========================================================
echo  BricDoc is live and running!
echo    - Web App:      http://localhost:3005/
echo    - Word to PDF:  http://localhost:3005/tools/docx-to-pdf
echo    - API Docs:     http://127.0.0.1:8005/api/v1/docs
echo ========================================================
