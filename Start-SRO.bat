@echo off
set "PATH=C:\nvm4w\nodejs;%PATH%"
cd /d "%~dp0sro-local"
if not exist "server.js" (
    echo Could not find sro-local!
    pause
    exit /b 1
)
if not exist "node_modules" call npm install
start "SRO Server" /min node server.js
timeout /t 5 /nobreak >nul
start http://localhost:3000/dashboard.html
echo SRO is running!pause