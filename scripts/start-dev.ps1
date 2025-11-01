#!/usr/bin/env pwsh
# Development Hot Reload Script

Write-Host "🚀 Stock Monitor - Development Hot Reload Setup" -ForegroundColor Green
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $null = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $true
    }
    catch {
        return $false
    }
}

# Clean existing processes
Write-Host "🧹 Cleaning existing processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Start Backend with Hot Reload
Write-Host "🔧 Starting Backend (Hot Reload)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PSScriptRoot\..\backend'; npm run dev" -WindowStyle Normal

# Wait for backend
$backendReady = $false
$attempts = 0
while (-not $backendReady -and $attempts -lt 30) {
    Start-Sleep 1
    $attempts++
    if (Test-Port 4000) {
        $backendReady = $true
        Write-Host "✅ Backend ready on port 4000" -ForegroundColor Green
    }
    else {
        Write-Host "⏳ Waiting for backend... ($attempts/30)" -ForegroundColor Yellow
    }
}

if (-not $backendReady) {
    Write-Host "❌ Backend failed to start" -ForegroundColor Red
    exit 1
}

# Start Frontend with Hot Reload
Write-Host "🎨 Starting Frontend (Hot Reload)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PSScriptRoot\..\frontend'; npm run dev" -WindowStyle Normal

# Wait for frontend
$frontendReady = $false
$attempts = 0
while (-not $frontendReady -and $attempts -lt 30) {
    Start-Sleep 1
    $attempts++
    if (Test-Port 3000) {
        $frontendReady = $true
        Write-Host "✅ Frontend ready on port 3000" -ForegroundColor Green
    }
    else {
        Write-Host "⏳ Waiting for frontend... ($attempts/30)" -ForegroundColor Yellow
    }
}

if (-not $frontendReady) {
    Write-Host "❌ Frontend failed to start" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Development servers running with hot reload!" -ForegroundColor Green
Write-Host "🌐 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔌 Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Hot Reload Features:" -ForegroundColor Yellow
Write-Host "   • Frontend: Auto-refresh on save (Next.js Fast Refresh)" -ForegroundColor White
Write-Host "   • Backend:  Auto-restart on save (Nodemon)" -ForegroundColor White
Write-Host ""
Write-Host "🛑 To stop servers: Ctrl+C in each terminal or run stop-dev.ps1" -ForegroundColor Red