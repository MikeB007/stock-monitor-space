# 🔥 Stock Monitor - Hot Reload Development Guide

## 🚀 **Quick Start (No Restarts Needed!)**

### **Option 1: Single Command (Recommended)**
```bash
npm run dev
```
This starts both frontend and backend with hot reload in one terminal using concurrently.

### **Option 2: VS Code Tasks**
- Press `Ctrl+Shift+P`
- Type "Tasks: Run Task"
- Select "Start Full Stack"

### **Option 3: PowerShell Scripts**
```bash
npm run dev:simple
```

## 🔄 **Hot Reload Features**

### **Frontend (Next.js) - Port 3000**
- ✅ **Auto-refresh** on file save
- ✅ **Fast Refresh** preserves React state
- ✅ **Instant updates** for CSS/styling changes
- ✅ **Error overlay** shows compilation errors
- ✅ **Turbopack** for lightning-fast builds

**Supported file types:** `.tsx`, `.ts`, `.js`, `.jsx`, `.css`, `.scss`

### **Backend (Node.js + Nodemon) - Port 4000**
- ✅ **Auto-restart** on file save
- ✅ **TypeScript compilation** on-the-fly
- ✅ **Database connection** persists across restarts
- ✅ **WebSocket reconnection** automatic
- ✅ **1 second delay** to batch changes

**Supported file types:** `.ts`, `.js`, `.json`

## 📁 **Directory Rules (ALWAYS FOLLOWED)**

```bash
# Frontend commands
cd "g:\GIT_REPOSITORY\REPO\stock-monitor-space\frontend"
npm run dev

# Backend commands  
cd "g:\GIT_REPOSITORY\REPO\stock-monitor-space\backend"
npm run dev
```

## 🛠️ **Development Workflow**

### **Making Changes (No Restarts!)**

1. **Frontend Changes:**
   - Edit any file in `frontend/src/`
   - Save file (`Ctrl+S`)
   - Browser auto-refreshes instantly ⚡

2. **Backend Changes:**
   - Edit any file in `backend/src/`
   - Save file (`Ctrl+S`)
   - Server auto-restarts in ~1 second ⚡

3. **Database Changes:**
   - Backend automatically reconnects
   - No manual restart needed

## 🔧 **Available Commands**

```bash
# Start development (hot reload)
npm run dev                 # Both services with concurrently
npm run dev:frontend        # Frontend only
npm run dev:backend         # Backend only
npm run dev:simple          # PowerShell script version

# Stop everything
npm run stop                # Stop all services
npm run clean               # Kill all node processes

# Build for production
npm run build               # Build both
npm run build:frontend      # Build frontend only
npm run build:backend       # Build backend only

# Testing
npm run test:services       # Check if services are running
```

## 🎯 **VS Code Integration**

### **Tasks Available:**
- `Start Full Stack` - Starts both services
- `Start Frontend` - Frontend only
- `Start Backend` - Backend only  
- `Stop All Services` - Stops everything
- `Test Services` - Health check

### **Shortcuts:**
- `Ctrl+Shift+P` → "Tasks: Run Task"
- `Ctrl+Shift+B` → Build tasks

## 🐛 **Troubleshooting**

### **Port Already in Use:**
```bash
npm run clean  # Kill all node processes
npm run dev    # Restart
```

### **Hot Reload Not Working:**
1. Check if nodemon config exists: `backend/nodemon.json` ✅
2. Check Next.js config: `frontend/next.config.js` ✅
3. Restart VS Code if needed

### **Database Connection Issues:**
- Backend auto-reconnects on restart
- Check MySQL service is running
- Verify credentials in `.env`

## 📊 **Configuration Files**

### **Backend Hot Reload:**
- `backend/nodemon.json` - Nodemon configuration
- `backend/package.json` - Dev script with ts-node

### **Frontend Hot Reload:**
- `frontend/next.config.js` - Next.js with Turbopack
- Built-in Fast Refresh enabled

## ⚡ **Performance Tips**

1. **Use VS Code Terminal** for better performance
2. **Close unused browser tabs** to free memory
3. **Use Turbopack** (already enabled) for faster builds
4. **Watch specific directories** only (already configured)

## 🎉 **Benefits**

- **No manual restarts** needed
- **Instant feedback** on changes
- **State preservation** in React components
- **Automatic reconnection** for WebSockets
- **Error handling** with overlay displays
- **Consistent directory navigation** rules

---

**🔥 Happy Hot Reloading! Make changes and see them instantly!**