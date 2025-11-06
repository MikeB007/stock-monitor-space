# MyAI Commands - Safe one-off commands that won't interfere with dev servers
# Always run this script in a NEW terminal to avoid terminating dev servers

param(
    [string]$Command
)

Write-Host "🤖 MyAI Command Runner - Running in isolated terminal" -ForegroundColor Green
Write-Host "Current Directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Command: $Command" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

switch ($Command) {
    "check-db" {
        Write-Host "📊 Checking database contents..." -ForegroundColor Blue
        & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pIlms2009 -e "USE mystocks; SELECT symbol, description, country, market, exchange, sector FROM watchlist_stocks ORDER BY symbol;"
    }
    "test-api" {
        Write-Host "🔌 Testing watchlist API..." -ForegroundColor Blue
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:4000/api/watchlist" -Method GET
            Write-Host "✅ API Response:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 3
        }
        catch {
            Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "add-stock" {
        Write-Host "➕ Adding test stock..." -ForegroundColor Blue
        $symbol = Read-Host "Enter stock symbol"
        try {
            $body = @{ symbol = $symbol } | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "http://localhost:4000/api/watchlist" -Method POST -Headers @{"Content-Type" = "application/json" } -Body $body
            Write-Host "✅ Stock added:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 3
        }
        catch {
            Write-Host "❌ Add Stock Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "check-ports" {
        Write-Host "🌐 Checking server ports..." -ForegroundColor Blue
        netstat -an | findstr ":3000\|:4000"
    }
    "health-check" {
        Write-Host "🏥 Health checking services..." -ForegroundColor Blue
        try {
            $frontend = Invoke-RestMethod -Uri "http://localhost:3000" -Method GET -TimeoutSec 5
            Write-Host "✅ Frontend: OK" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Frontend: Down" -ForegroundColor Red
        }
        
        try {
            $backend = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET -TimeoutSec 5
            Write-Host "✅ Backend: OK" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Backend: Down" -ForegroundColor Red
        }
    }
    default {
        Write-Host "❓ Available commands:" -ForegroundColor Yellow
        Write-Host "  check-db    - Check database contents" -ForegroundColor White
        Write-Host "  test-api    - Test watchlist API" -ForegroundColor White
        Write-Host "  add-stock   - Add a stock via API" -ForegroundColor White
        Write-Host "  check-ports - Check if ports 3000/4000 are open" -ForegroundColor White
        Write-Host "  health-check - Check if services are running" -ForegroundColor White
        Write-Host "" -ForegroundColor White
        Write-Host "Usage: .\myai-commands.ps1 -Command check-db" -ForegroundColor Cyan
    }
}

Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "🤖 MyAI Command completed" -ForegroundColor Green