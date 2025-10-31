# Stock Monitor Workspace

A comprehensive full-stack application for real-time stock price monitoring with WebSocket connectivity.

## 🏗️ Project Structure

```
stock-monitor-space/
├── frontend/                 # Next.js React application
│   ├── src/
│   │   └── app/             # Next.js 13+ App Router
│   │       ├── page.tsx     # Main dashboard
│   │       ├── layout.tsx   # Root layout
│   │       └── globals.css  # Global styles
│   ├── package.json         # Frontend dependencies
│   └── tsconfig.json        # TypeScript config
├── backend/                 # Node.js Express API server
│   ├── src/
│   │   ├── server.ts        # Main server file
│   │   ├── routes.ts        # API routes
│   │   └── services/
│   │       └── stockPriceService.ts  # Stock price simulation
│   ├── package.json         # Backend dependencies
│   └── tsconfig.json        # TypeScript config
├── .vscode/
│   ├── tasks.json          # VS Code tasks
│   ├── launch.json         # Debug configurations
│   └── settings.json       # Workspace settings
└── stock-monitor-workspace.code-workspace  # VS Code workspace
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- VS Code (recommended)

### Setup
1. **Open workspace**: Open `stock-monitor-workspace.code-workspace` in VS Code
2. **Install dependencies**: 
   ```bash
   # Frontend
   cd frontend && npm install
   
   # Backend
   cd backend && npm install
   ```
3. **Build projects**:
   ```bash
   # Use VS Code task: Ctrl+Shift+P -> "Tasks: Run Task" -> "Build All"
   # Or manually:
   cd frontend && npm run build
   cd backend && npm run build
   ```

### Running the Application

#### Option 1: VS Code Tasks (Recommended)
- **Start Full Stack**: `Ctrl+Shift+P` -> "Tasks: Run Task" -> "Start Full Stack"
- **Start Frontend Only**: "Tasks: Run Task" -> "Start Frontend"
- **Start Backend Only**: "Tasks: Run Task" -> "Start Backend"

#### Option 2: Manual Commands
```bash
# Terminal 1: Backend
cd backend && npm run start

# Terminal 2: Frontend  
cd frontend && npm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **WebSocket**: ws://localhost:4000

## 🎯 Features

### Frontend (Next.js + React)
- **Real-time Dashboard**: Live stock price updates
- **WebSocket Integration**: Socket.io client for real-time data
- **Responsive UI**: Tailwind CSS styling
- **Stock Watchlist**: Add/remove stocks from watchlist
- **Price Charts**: Visual representation with Recharts
- **Modern React**: Using React 19.2.0 with Next.js 16.0.0

### Backend (Node.js + Express)
- **REST API**: Stock data endpoints
- **WebSocket Server**: Real-time price broadcasting
- **Stock Simulation**: Realistic price movements with cron jobs
- **TypeScript**: Full type safety
- **CORS Support**: Configured for frontend connectivity

### WebSocket Communication
- **Real-time Updates**: Stock prices update every 5 seconds
- **Event-driven**: `stockUpdate` events with price data
- **Bi-directional**: Support for client subscriptions

## 📡 API Endpoints

### REST API
```
GET /api/health          # Health check
GET /api/stocks          # Get all stocks
GET /api/stocks/:symbol  # Get specific stock
GET /api                 # API information
```

### WebSocket Events
```javascript
// Client subscription
socket.emit('subscribe', { symbols: ['AAPL', 'GOOGL'] })

// Server broadcasts
socket.emit('stockUpdate', { 
  symbol: 'AAPL', 
  price: 150.25, 
  change: +2.15,
  timestamp: '2024-01-01T12:00:00Z'
})
```

## 🛠️ Development

### VS Code Integration
- **Tasks**: Predefined tasks for building and running
- **Debugging**: Launch configurations for both frontend and backend
- **Extensions**: Recommended extensions for full-stack development
- **Multi-folder**: Organized workspace with frontend/backend separation

### Scripts

#### Frontend (`frontend/package.json`)
```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run start    # Start production server
npm run lint     # Run ESLint
```

#### Backend (`backend/package.json`)
```bash
npm run start    # Start production server
npm run dev      # Start with nodemon (auto-reload)
npm run build    # Compile TypeScript
```

### Tech Stack

#### Frontend
- **Framework**: Next.js 16.0.0
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 3.4.17
- **Charts**: Recharts 2.15.0
- **WebSocket**: Socket.io-client 4.8.1
- **Icons**: Lucide React 0.294.0
- **Language**: TypeScript 5.7.2

#### Backend
- **Runtime**: Node.js
- **Framework**: Express 4.21.1
- **WebSocket**: Socket.io 4.8.1
- **Scheduling**: node-cron 3.0.3
- **CORS**: cors 2.8.5
- **Language**: TypeScript 5.7.2

## 🔧 Configuration

### Environment Variables
Create `.env.local` files as needed:

#### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

#### Backend (`.env`)
```env
PORT=4000
NODE_ENV=development
```

### VS Code Settings
The workspace includes optimized settings for:
- TypeScript development
- Auto-formatting on save
- ESLint integration
- File associations

## 📊 Stock Data

### Sample Stocks
The application includes realistic simulation for:
- **AAPL** (Apple Inc.)
- **GOOGL** (Alphabet Inc.)
- **MSFT** (Microsoft Corporation)
- **AMZN** (Amazon.com Inc.)
- **TSLA** (Tesla Inc.)
- **BTC** (Bitcoin)
- **ETH** (Ethereum)

### Price Simulation
- **Realistic movements**: Based on percentage changes
- **Volume simulation**: Random trading volumes
- **Market hours**: Continuous updates
- **Volatility**: Different volatility levels per asset

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
# Deploy to Vercel, Netlify, or similar platform
```

### Backend (Production)
```bash
npm run build
npm start
# Deploy to Railway, Heroku, or similar platform
```

### Environment Variables for Production
Update API URLs for production deployment:
- Frontend: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`
- Backend: `PORT`, `NODE_ENV`, `CORS_ORIGIN`

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: 
   - Frontend: Change port in `package.json` dev script
   - Backend: Modify `PORT` in environment or `server.ts`

2. **WebSocket connection failed**:
   - Ensure backend is running before frontend
   - Check CORS configuration
   - Verify WebSocket URL in frontend

3. **TypeScript errors**:
   - Run `npm run build` to check compilation
   - Update `tsconfig.json` if needed

4. **Dependencies issues**:
   - Delete `node_modules` and `package-lock.json`
   - Run `npm install` again

### Debugging
- Use VS Code debugger with provided launch configurations
- Check browser console for frontend errors
- Monitor backend logs for API issues
- Use WebSocket debugging tools for connection issues

## 📝 Development Notes

### Code Organization
- **Frontend**: Component-based React architecture
- **Backend**: Service-oriented with separation of concerns
- **TypeScript**: Full type coverage for both projects
- **WebSocket**: Event-driven real-time communication

### Best Practices
- Error handling throughout the stack
- TypeScript strict mode enabled
- ESLint for code quality
- Responsive design principles
- Real-time data synchronization

## 🎉 Next Steps

### Potential Enhancements
- [ ] User authentication and portfolios
- [ ] Historical price charts
- [ ] Real market data integration (Alpha Vantage, IEX Cloud)
- [ ] Stock alerts and notifications
- [ ] Technical indicators and analysis
- [ ] Mobile app development
- [ ] Database integration for persistence
- [ ] Advanced charting features
- [ ] News feed integration
- [ ] Social features and sharing

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Happy Trading! 📈**