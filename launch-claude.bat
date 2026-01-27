@echo off
REM Launch SRO_Intelligence in Claude with context

set PROJECT_NAME=SRO_Intelligence
set PROJECT_PATH=C:\Users\jdang\OneDrive – Jefferygroup\DocProjectVault\02_Products\SRO_Intelligence
set CONTEXT_FILE=%PROJECT_PATH%\CONTEXT.md

REM Read CONTEXT.md content
set CONTEXT_CONTENT=
for /f "delims=" %%i in ('type "%CONTEXT_FILE%"') do set CONTEXT_CONTENT=!CONTEXT_CONTENT!%%i\n

REM Open Claude with the project context pre-loaded
start "" "https://claude.ai/new?q=I'm working on %PROJECT_NAME%. Read the CONTEXT.md at %PROJECT_PATH% and continue where we left off."

REM Also open VS Code
code "%PROJECT_PATH%"

echo Launched %PROJECT_NAME% in Claude and VS Code
