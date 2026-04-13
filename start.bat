@echo off
title Quality Check Audit

echo Starting Quality Check Audit...
echo.

:: Start backend in a new window
start "Backend (port 8000)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Give backend a moment to initialise
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "Frontend (port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Give Vite a moment to start
timeout /t 4 /nobreak >nul

:: Open Chrome
start chrome "http://localhost:5173"

echo.
echo Both servers started. App opening in Chrome...
echo Close the server windows to stop.
