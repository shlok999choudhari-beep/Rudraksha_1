@echo off
TITLE VeriGuard AI — Full-Stack Launcher (Backend & Frontend)

echo =========================================================================
echo  VeriGuard AI: AI-Based Identity & Document Screening System
echo  Problem Statement ID: 26188
echo =========================================================================
echo.

echo [1/2] Starting Python FastAPI Backend on http://127.0.0.1:8000 ...
start "VeriGuard AI Backend (FastAPI)" cmd /k ".\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting React Vite Frontend on http://127.0.0.1:3000 ...
cd frontend
start "VeriGuard AI Frontend (Vite)" cmd /k "npm run dev"

echo.
echo =========================================================================
echo  VeriGuard AI is running!
echo  - Frontend Web UI:  http://localhost:3000
echo  - Backend REST API: http://127.0.0.1:8000/docs
echo.
echo  Demo Credentials:
echo    Email:    officer@veriguard.gov
echo    Password: borderguard2026
echo =========================================================================
