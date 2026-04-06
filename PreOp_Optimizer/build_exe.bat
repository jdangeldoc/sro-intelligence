@echo off
REM Build PreOp Optimizer into standalone EXE
setlocal ENABLEEXTENSIONS
cd /d "%~dp0"

echo ============================================
echo    PreOp Optimizer EXE Builder
echo ============================================

where py >nul 2>nul || (echo Python required.& pause & exit /b 1)

if not exist venv (py -3 -m venv venv)
call venv\Scripts\activate.bat

python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

pyinstaller --onefile --windowed --name PreOpOptimizer ^
    --add-data "hcc_library.json;." ^
    --add-data "local_database.py;." ^
    --add-data "cms_proms_intake.py;." ^
    app.py

echo Building PROMS Intake standalone...
pyinstaller --onefile --windowed --name CMSPromsIntake ^
    --add-data "local_database.py;." ^
    cms_proms_intake.py

echo.
echo DONE: dist\PreOpOptimizer.exe
pause
