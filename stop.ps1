# Stock Monitor - Stop All Services
Write-Host "=========================================" -ForegroundColor Red
Write-Host "   Stock Monitor - Stopping All Services" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Red
Write-Host ""

Write-Host "Stopping all Node.js processes..." -ForegroundColor Yellow
try {
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "Stopped $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
    }
    else {
        Write-Host "No Node.js processes were running" -ForegroundColor Blue
    }
}
catch {
    Write-Host "No Node.js processes found to stop" -ForegroundColor Blue
}

Write-Host ""
Write-Host "Stopping NPM processes..." -ForegroundColor Yellow
try {
    $npmProcesses = Get-Process -Name "npm" -ErrorAction SilentlyContinue
    if ($npmProcesses) {
        $npmProcesses | Stop-Process -Force
        Write-Host "Stopped $($npmProcesses.Count) NPM process(es)" -ForegroundColor Green
    }
    else {
        Write-Host "No NPM processes were running" -ForegroundColor Blue
    }
}
catch {
    Write-Host "No NPM processes found to stop" -ForegroundColor Blue
}

Write-Host ""
Write-Host "Checking for processes on ports 3000 and 4000..." -ForegroundColor Yellow

# Function to kill process on specific port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    
    try {
        $netstatOutput = netstat -ano | Select-String ":$Port "
        if ($netstatOutput) {
            foreach ($line in $netstatOutput) {
                $tokens = $line.ToString().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
                if ($tokens.Length -ge 5) {
                    $processId = $tokens[-1]
                    if ($processId -match '^\d+$') {
                        Write-Host "Found $ServiceName process on port $Port (PID: $processId)" -ForegroundColor Cyan
                        try {
                            Stop-Process -Id $processId -Force -ErrorAction Stop
                            Write-Host "Stopped $ServiceName process (PID: $processId)" -ForegroundColor Green
                        }
                        catch {
                            Write-Host "Could not stop process $processId" -ForegroundColor Yellow
                        }
                    }
                }
            }
        }
        else {
            Write-Host "No processes found on port $Port" -ForegroundColor Blue
        }
    }
    catch {
        Write-Host "Could not check port $Port" -ForegroundColor Blue
    }
}

# Stop processes on frontend and backend ports
Stop-ProcessOnPort -Port 3000 -ServiceName "Frontend"
Stop-ProcessOnPort -Port 4000 -ServiceName "Backend"

Write-Host ""
Write-Host "Stopping any remaining PowerShell windows with Node/NPM..." -ForegroundColor Yellow
try {
    $powershellProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -like "*Stock Monitor*" -or 
        $_.MainWindowTitle -like "*npm*" -or 
        $_.MainWindowTitle -like "*node*"
    }
    if ($powershellProcesses) {
        $powershellProcesses | Stop-Process -Force
        Write-Host "Closed $($powershellProcesses.Count) related PowerShell window(s)" -ForegroundColor Green
    }
}
catch {
    Write-Host "No related PowerShell windows found" -ForegroundColor Blue
}

Write-Host ""
Write-Host "All Stock Monitor services have been stopped" -ForegroundColor Green
Write-Host ""
Write-Host "Use start.ps1 to restart all services" -ForegroundColor White
Write-Host ""

# Wait for user input
Read-Host "Press Enter to close this window"