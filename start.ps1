# Stock Monitor - Start Script
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Stock Monitor - Starting All Services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# First, ensure any existing processes are stopped
Write-Host "Stopping any existing Stock Monitor processes..." -ForegroundColor Yellow
& "$PSScriptRoot\stop.ps1"

# Wait a moment for processes to fully stop
Write-Host "Waiting 3 seconds for complete shutdown..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

Write-Host "Starting Backend Server..." -ForegroundColor Green
$BackendPath = Join-Path $ScriptDir "backend"
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "Waiting 5 seconds for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verify backend started
if (Test-Port 4000) {
    Write-Host "Backend started successfully on port 4000" -ForegroundColor Green
}
else {
    Write-Host "Backend may not have started properly on port 4000" -ForegroundColor Red
}

Write-Host ""
Write-Host "Starting Frontend Server..." -ForegroundColor Green
$FrontendPath = Join-Path $ScriptDir "frontend"
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Waiting 3 seconds for frontend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verify frontend started
if (Test-Port 3000) {
    Write-Host "Frontend started successfully on port 3000" -ForegroundColor Green
}
else {
    Write-Host "Frontend may not have started properly on port 3000" -ForegroundColor Red
}

Write-Host ""
Write-Host "Stock Monitor Application startup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:4000" -ForegroundColor White
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "WARNING: Keep both PowerShell windows open to keep services running" -ForegroundColor Yellow
Write-Host "Use stop.ps1 to stop all services" -ForegroundColor Red
Write-Host ""

# Wait for user input
Read-Host "Press Enter to exit this window (services will continue running)"