@echo off
REM Safe API Test - Double-click this file from Windows Explorer
REM This will NEVER interfere with VS Code terminals

title MyAI API Tester - Safe Terminal
echo.
echo 🤖 MyAI Safe API Tester  
echo =======================
echo This runs in a separate window and won't interfere with dev servers
echo.

cd /d "g:\GIT_REPOSITORY\REPO\stock-monitor-space"

echo 🔌 Testing portfolio API...
echo.
powershell.exe -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4000/api/portfolio' -Method GET; Write-Host '✅ API Response:' -ForegroundColor Green; $response | ConvertTo-Json -Depth 3 } catch { Write-Host '❌ API Error:' $_.Exception.Message -ForegroundColor Red }"

echo.
echo ✅ API test completed!
echo.
pause