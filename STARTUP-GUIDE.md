# 🚀 Stock Monitor - Easy Startup & Stop Scripts

## Quick Start Options

### Option 1: One-Click Startup (Recommended)
**Double-click: `start-all.bat`** - Starts both backend and frontend in separate windows

### Option 2: Individual Services
- **Backend only**: Double-click `start-backend.bat`
- **Frontend only**: Double-click `start-frontend.bat`

### Option 3: PowerShell (Advanced)
- **All services**: `.\start-all.ps1`
- **Backend only**: `.\start-backend.ps1`
- **Frontend only**: `.\start-frontend.ps1`

### Option 4: VS Code Tasks
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Tasks: Run Task"
3. Select "Start Full Stack" (or individual services)

## 🛑 Stop Options

### Option 1: One-Click Stop (Recommended)
**Double-click: `stop-all.bat`** - Stops all services and verifies they're down

### Option 2: Individual Stop Scripts
- **Stop backend**: Double-click `stop-backend.bat`
- **Stop frontend**: Double-click `stop-frontend.bat`

### Option 3: PowerShell Stop
- **Stop all**: `.\stop-all.ps1` (includes detailed verification)

### Option 4: VS Code Task
- Use "Stop All Services" task from Command Palette

## 🔧 What Each Script Does

### `start-all.bat` / `start-all.ps1`
- ✅ Stops any existing node processes
- 🚀 Starts backend in a new window (Port 4000)
- 🌐 Starts frontend in a new window (Port 3000)
- 🧪 Tests both services after startup
- 📊 Shows service status

### `stop-all.bat` / `stop-all.ps1`
- 🛑 Kills all Node.js processes
- 🧪 Verifies services are actually stopped
- 📊 Shows detailed process information
- ✅ Confirms successful shutdown

### Individual Scripts
- Navigate to correct directories automatically
- Verify package.json exists
- Start/stop the specific service
- Show helpful error messages if something goes wrong

## 🌐 Access URLs
- **Frontend (Stock Monitor Dashboard)**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/api/health
- **Bitcoin Price API**: http://localhost:4000/api/stocks/BTC

## 🔍 Troubleshooting

### If Services Won't Start:
1. Run `start-all.bat` - it automatically stops existing processes
2. Check the separate terminal windows for error messages
3. Make sure you're in the correct workspace directory

### If You See "package.json not found":
- The script will show you the current directory
- Make sure you're running from the workspace root: `G:\GIT_REPOSITORY\REPO\stock-monitor-space`

### Quick Service Test:
Use VS Code Task: "Test Services" to check if both are running

## 💡 Pro Tips
- Always use `start-all.bat` for the most reliable startup
- Keep the terminal windows open to see real-time logs
- The frontend takes longer to start than the backend (this is normal)
- Bitcoin prices update every 5 seconds once running