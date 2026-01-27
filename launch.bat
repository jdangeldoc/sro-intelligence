@echo off
setlocal

set PROJECT=SRO_Intelligence
set CONTEXT_PATH=C:\Users\jdang\OneDrive – Jefferygroup\DocProjectVault\02_Products\SRO_Intelligence

REM Copy prompt to clipboard
echo I'm working on %PROJECT%. Read %CONTEXT_PATH%\CONTEXT.md and continue where we left off. Start coding. | clip

REM Open VS Code
code "%CONTEXT_PATH%"

REM Open Claude Desktop
start "" "claude://"

echo.
echo ========================================
echo  %PROJECT% launched!
echo  Prompt copied to clipboard - just paste into Claude Desktop
echo ========================================
timeout /t 3
