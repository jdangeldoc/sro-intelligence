@echo off
REM SRO Patient Intake - One Question at a Time
REM Perfect for elderly patients - NO SCROLLING!

echo ========================================
echo    SRO Patient Intake
echo    One Question at a Time
echo ========================================
echo.

pip show customtkinter >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install customtkinter
)

python sro_intake_onequestion.py

pause
