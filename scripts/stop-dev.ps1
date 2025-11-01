#!/usr/bin/env pwsh
# Stop Development Servers Script

Write-Host "🛑 Stopping Stock Monitor Development Servers..." -ForegroundColor Red
Write-Host ""

# Stop all Node.js processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⏹️  Stopping $($nodeProcesses.Count) Node.js process(es)..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force
    Start-Sleep 2
    Write-Host "✅ All Node.js processes stopped" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No Node.js processes were running" -ForegroundColor Blue
}

# Stop any remaining nodemon processes
$nodemonProcesses = Get-Process -Name "nodemon" -ErrorAction SilentlyContinue
if ($nodemonProcesses) {
    Write-Host "⏹️  Stopping nodemon processes..." -ForegroundColor Yellow
    $nodemonProcesses | Stop-Process -Force
    Write-Host "✅ Nodemon processes stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "🧪 Verifying services are stopped..." -ForegroundColor Cyan

# Check backend
try {
    Invoke-WebRequest -Uri "http://localhost:4000/api/health" -Method GET -TimeoutSec 2 | Out-Null
    Write-Host "❌ Backend still running on port 4000" -ForegroundColor Red
} catch {
    Write-Host "✅ Backend stopped" -ForegroundColor Green
}

# Check frontend  
try {
    Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 2 | Out-Null
    Write-Host "❌ Frontend still running on port 3000" -ForegroundColor Red
} catch {
    Write-Host "✅ Frontend stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎯 Development servers stopped successfully!" -ForegroundColor Green