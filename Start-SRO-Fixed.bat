@echo off
title SRO Intelligence Server
echo ============================================
echo   SRO INTELLIGENCE - Starting...
echo ============================================

call nvm use 20.20.0

cd /d "C:\Users\jdang\OneDrive – Jefferygroup\DocProjectVault\02_Products\SRO_Intelligence\sro-local"

echo.
echo Starting server...
echo.

timeout /t 3 /nobreak >nul
start "" http://localhost:3000/dashboard.html

call npm start

pause
