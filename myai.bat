@echo off
REM MyAI Commands Batch Runner - Always runs in new terminal
REM This prevents accidentally terminating dev servers

echo.
echo 🤖 MyAI Command Runner - Safe Terminal
echo =====================================
echo.

if "%1"=="" (
    echo Available commands:
    echo   check-db    - Check database contents
    echo   test-api    - Test watchlist API
    echo   add-stock   - Add a stock via API
    echo   check-ports - Check server ports
    echo   health-check - Health check services
    echo.
    echo Usage: myai check-db
    goto :end
)

powershell.exe -ExecutionPolicy Bypass -File "myai-commands.ps1" -Command %1

:end
pause