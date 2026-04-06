@echo off
echo Killing any process on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo Starting SRO Intelligence server...
cd /d "C:\DocVault\DocProjectVault\02_Products\SRO_Intelligence\sro-local"
start http://localhost:3000/dashboard.html
node server.js
