@echo off
REM Safe Database Check - Double-click this file from Windows Explorer
REM This will NEVER interfere with VS Code terminals

title MyAI Database Checker - Safe Terminal
echo.
echo 🤖 MyAI Safe Database Checker
echo ============================
echo This runs in a separate window and won't interfere with dev servers
echo.

cd /d "g:\GIT_REPOSITORY\REPO\stock-monitor-space"

echo 📊 Checking database contents...
echo.
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pIlms2009 -e "USE mystocks; SELECT COUNT(*) as 'Total Stocks' FROM watchlist_stocks; SELECT symbol, description, country, market, exchange, sector FROM watchlist_stocks ORDER BY symbol;"

echo.
echo 📈 Current status:
echo - If Total Stocks = 0, database is empty
echo - If Total Stocks > 0, those are the stocks that should be tracked
echo.
echo ✅ Database check completed!
echo.
pause