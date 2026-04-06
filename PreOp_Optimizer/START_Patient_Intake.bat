@echo off
REM SRO Patient Intake - One-Click Launcher
REM Opens in web browser - elder-friendly interface

echo Starting SRO Patient Intake...
echo.
echo This will open in your web browser.
echo Close this window when done.
echo.

REM Check if streamlit is installed
pip show streamlit >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install streamlit
)

REM Run the app
streamlit run sro_patient_intake.py --server.headless true

pause
