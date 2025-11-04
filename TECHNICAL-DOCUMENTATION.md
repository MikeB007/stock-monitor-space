# Stock Monitor System - Technical Documentation

## Current Status: November 1, 2025

### Architecture Overview

Full-stack TypeScript application with Express backend, Next.js frontend, MySQL database, and WebSocket real-time communication.

---

## Technology Stack

### Backend

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 4.18.2
- **WebSocket**: Socket.IO 4.8.1
- **Database Client**: mysql2 3.15.3
- **HTTP Client**: Axios 1.6.2
- **Process Manager**: Nodemon 3.0.2 (development)
- **TypeScript**: 5.3.0
- **Port**: 4000

### Frontend

- **Framework**: Next.js 16.0.0
- **Build Tool**: Turbopack
- **Language**: TypeScript
- **WebSocket Client**: Socket.IO client
- **Port**: 3000

### Database

- **RDBMS**: MySQL
- **Database Name**: mystocks
- **Host**: localhost
- **Port**: 3306
- **User**: root

### External APIs

- **Yahoo Finance**: Primary data provider (free, no API key)
- **Alpha Vantage**: Secondary provider (requires API key)
- **Financial Modeling Prep**: Tertiary provider (requires API key, not configured)

---

## Database Schema

### Table: Watchlist_stocks

```sql
CREATE TABLE Watchlist_stocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(255),
    country VARCHAR(100),
    market VARCHAR(100),
    exchange VARCHAR(100),
    sector VARCHAR(100),
    industry VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Current Records**: 12 stocks
**Constraints**: Unique symbol constraint prevents duplicates

### Table: stock_prices_history

```sql
CREATE TABLE stock_prices_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(10,2),
    change_amount DECIMAL(10,2),
    change_percent DECIMAL(10,2),
    volume BIGINT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol (symbol),
    INDEX idx_recorded_at (recorded_at)
);
```

**Note**: No foreign key constraint to Watchlist_stocks (removed for flexibility)

---

## Backend Architecture

### Directory Structure

```
backend/
├── src/
│   ├── server.ts                 # Entry point
│   ├── routes/
│   │   └── WatchlistRoutes.ts    # REST API endpoints
│   ├── services/
│   │   ├── databaseService.ts    # MySQL operations
│   │   ├── enhancedStockPriceService.ts  # Main price service
│   │   └── dataProviders/
│   │       ├── BaseDataProvider.ts        # Abstract base class
│   │       ├── DataProviderManager.ts     # Provider orchestration
│   │       ├── YahooFinanceRealProvider.ts # Primary provider
│   │       ├── AlphaVantageProvider.ts    # Secondary provider
│   │       └── FMPProvider.ts             # Tertiary provider
│   └── types/
├── .env                          # Environment configuration
├── package.json
└── tsconfig.json
```

### Key Services

#### 1. EnhancedStockPriceService

**File**: `backend/src/services/enhancedStockPriceService.ts`

**Responsibilities**:

- Real-time stock price updates (10-second intervals)
- Bitcoin price updates (60-second intervals)
- Symbol validation
- WebSocket broadcasting
- Database persistence

**Key Methods**:

```typescript
startEnhancedUpdates()           // Initialize update intervals
validateSymbol(symbol: string)   // Validate stock symbol
refreshStock(symbol: string)     // Force refresh single stock
searchSymbols(query: string)     // Search for stock symbols
getProviderStatus()              // Get health of all providers
shutdown()                       // Cleanup on exit
```

**Data Flow**:

1. Fetch quotes from DataProviderManager
2. Convert to StockData format
3. Record to database (if configured)
4. Broadcast via WebSocket to connected clients

#### 2. DataProviderManager

**File**: `backend/src/services/dataProviders/DataProviderManager.ts`

**Responsibilities**:

- Provider priority management
- Automatic failover
- Response caching (60-second TTL)
- Health monitoring (5-minute intervals)
- Batch quote requests

**Key Methods**:

```typescript
fetchQuote(options); // Single quote with fallback
fetchMultipleQuotes(options); // Batch quote request
searchSymbols(query, provider); // Symbol search
getProviderStatus(); // Provider health status
fetchCompanyProfile(symbol); // Sector/industry (not working)
```

**Provider Priority**:

1. Yahoo Finance Real (Priority 1)
2. Alpha Vantage (Priority 2)
3. Financial Modeling Prep (Priority 3)

**Caching Strategy**:

- Key: `{provider}:{symbol}`
- TTL: 60 seconds
- Cache: In-memory Map

#### 3. DatabaseService

**File**: `backend/src/services/databaseService.ts`

**Responsibilities**:

- MySQL connection management
- Watchlist CRUD operations
- Price history recording
- Table creation

**Key Methods**:

```typescript
initialize(); // Connect and create tables
getWatchlistStocks(); // Fetch all Watchlist stocks
addWatchlistStock(stock); // Insert new stock
updateWatchlistStock(id, stock); // Update stock metadata
deleteWatchlistStock(id); // Remove stock
recordStockPrice(data); // Insert price history
```

**Connection Pool**: Not configured (single connection)

---

## REST API Endpoints

### Watchlist Management

#### GET /api/Watchlist

**Purpose**: Retrieve all Watchlist stocks from database

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "AAPL",
      "description": "Apple Inc.",
      "country": "N/A",
      "market": "N/A",
      "exchange": "N/A",
      "sector": "N/A",
      "industry": "N/A",
      "created_at": "2025-11-01T12:00:00Z",
      "updated_at": "2025-11-01T12:00:00Z"
    }
  ]
}
```

#### POST /api/Watchlist

**Purpose**: Add new stock to Watchlist

**Request Body**:

```json
{
  "symbol": "MSFT"
}
```

**Process**:

1. Validate symbol with Yahoo Finance
2. Fetch company profile (sector/industry) - currently failing
3. Extract metadata
4. Insert into Watchlist_stocks table
5. Return created stock

**Response** (201):

```json
{
  "success": true,
  "message": "Stock MSFT validated and added to Watchlist",
  "data": {
    "id": 2,
    "symbol": "MSFT",
    "description": "Microsoft Corporation",
    "country": "N/A",
    "market": "N/A",
    "exchange": "N/A",
    "sector": "N/A",
    "industry": "N/A"
  }
}
```

**Error Responses**:

- 400: Missing symbol
- 404: Invalid symbol
- 409: Duplicate symbol
- 503: Database not connected

#### PUT /api/Watchlist/:id

**Purpose**: Update stock metadata

**Request Body**:

```json
{
  "description": "Updated description",
  "sector": "Technology",
  "industry": "Software"
}
```

#### DELETE /api/Watchlist/:id

**Purpose**: Remove stock from Watchlist

**Response** (200):

```json
{
  "success": true,
  "message": "Stock deleted from Watchlist"
}
```

### Stock Data Endpoints

#### GET /api/provider-status

**Purpose**: Get health status of all data providers

**Response**:

```json
{
  "providers": [
    {
      "name": "Yahoo Finance Real",
      "priority": 1,
      "healthy": true,
      "requestCount": 1234,
      "errorCount": 5,
      "lastSuccess": "2025-11-01T17:00:00Z",
      "lastError": null
    }
  ]
}
```

#### POST /api/refresh-stock

**Purpose**: Force refresh specific stock price

**Request Body**:

```json
{
  "symbol": "AAPL"
}
```

#### GET /api/search-symbols?q=apple

**Purpose**: Search for stock symbols

**Response**:

```json
{
  "symbols": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc."
    }
  ]
}
```

---

## WebSocket Events

### Client → Server Events

#### subscribe_equities

**Purpose**: Subscribe to real-time updates for specific stocks

**Payload**:

```json
{
  "symbols": ["AAPL", "MSFT", "TSLA"]
}
```

**Process**:

1. Store symbols in client's subscription set
2. Fetch current prices from providers
3. Initialize stocks if not already tracking
4. Send current data immediately

#### unsubscribe_equities

**Purpose**: Stop receiving updates for specific stocks

**Payload**:

```json
{
  "symbols": ["AAPL"]
}
```

### Server → Client Events

#### bitcoin_update

**Purpose**: Broadcast Bitcoin price update

**Frequency**: Every 60 seconds

**Payload**:

```json
{
  "symbol": "BTC",
  "name": "Bitcoin USD",
  "price": 110355.09,
  "change": 796.07,
  "changePercent": 0.73,
  "volume": 31139057664,
  "marketCap": "N/A",
  "lastUpdate": "2025-11-01T17:23:00.210Z",
  "previousClose": 109559.016,
  "dayHigh": 110534.33,
  "dayLow": 109391.055,
  "yearHigh": 126198.07,
  "yearLow": 66803.65,
  "provider": "Yahoo Finance",
  "sector": "N/A",
  "industry": "N/A",
  "marketState": "REGULAR",
  "hasPrePostMarketData": false
}
```

#### equity_update

**Purpose**: Broadcast stock price update

**Frequency**: Every 10 seconds (for subscribed stocks)

**Payload**: Same structure as bitcoin_update with additional pre/post market fields:

```json
{
  "preMarketPrice": 270.5,
  "preMarketChange": 0.13,
  "preMarketChangePercent": 0.05,
  "preMarketTime": "2025-11-01T13:00:00Z",
  "postMarketPrice": null,
  "postMarketChange": null,
  "postMarketChangePercent": null,
  "postMarketTime": null,
  "marketState": "PRE"
}
```

---

## Data Providers

### Yahoo Finance Real Provider

**File**: `backend/src/services/dataProviders/YahooFinanceRealProvider.ts`

**Status**: Operational (Primary Provider)

**API Endpoints Used**:

- Chart API: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- Search API: `https://query1.finance.yahoo.com/v1/finance/search`

**Rate Limiting**: 2-second delay between requests (self-imposed)

**Data Points Extracted**:

- Price data: close, open, high, low
- Volume
- Previous close
- 52-week high/low
- Market cap
- Pre/post market data
- Market state

**Error Handling**: Returns null on failure, logs error

**Health Check**: Fetches AAPL every 5 minutes

### Alpha Vantage Provider

**File**: `backend/src/services/dataProviders/AlphaVantageProvider.ts`

**Status**: Unhealthy (demo API key, rate limited)

**API Endpoints**:

- Quote: `https://www.alphavantage.co/query?function=GLOBAL_QUOTE`
- Search: `https://www.alphavantage.co/query?function=SYMBOL_SEARCH`
- Company Overview: `https://www.alphavantage.co/query?function=OVERVIEW` (for sector/industry)

**Rate Limiting**: 5 requests/minute

**Current Issue**: Using demo key which is heavily rate-limited

**Configuration**: Set ALPHA_VANTAGE_API_KEY in .env file

### Financial Modeling Prep Provider

**File**: `backend/src/services/dataProviders/FMPProvider.ts`

**Status**: Disabled (no API key configured)

**Configuration**: Requires FMP_API_KEY in .env file

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Global styles
│   └── lib/
├── public/
├── package.json
├── next.config.js
└── tsconfig.json
```

### Main Dashboard Component

**File**: `frontend/src/app/page.tsx`

**Key Features**:

- WebSocket connection to backend
- Real-time price updates via WebSocket events
- Add/remove stocks from Watchlist
- Symbol validation before adding
- Global exchange detection with 25+ exchanges
- Market column with whiteSpace: 'nowrap' CSS

**State Management**:

```typescript
const [stocks, setStocks] = useState<StockData[]>([]);
const [bitcoinData, setBitcoinData] = useState<StockData | null>(null);
const [newSymbol, setNewSymbol] = useState("");
const [error, setError] = useState("");
const [successMessage, setSuccessMessage] = useState("");
```

**WebSocket Connection**:

```typescript
const socket = io("http://localhost:4000");

// Subscribe to Watchlist stocks
useEffect(() => {
  if (WatchlistSymbols.length > 0) {
    socket.emit("subscribe_equities", { symbols: WatchlistSymbols });
  }
}, [WatchlistSymbols]);

// Listen for updates
socket.on("bitcoin_update", (data) => setBitcoinData(data));
socket.on("equity_update", (data) => {
  // Update specific stock in array
});
```

**Exchange Detection Logic**:

```typescript
function getGlobalExchange(symbol: string) {
  // US-first logic for clean symbols (no suffix)
  if (/^[A-Z]{1,5}$/.test(symbol)) {
    // Check if likely US stock
    if (isLikelyUSStock(symbol)) return "NYSE/NASDAQ";
  }

  // Handle suffixed symbols (.TO, .V, .L, etc.)
  // 25+ exchange patterns

  // Default to detecting by length and patterns
}
```

### Next.js Configuration

**File**: `frontend/next.config.js`

**Settings**:

- Turbopack enabled for faster development
- swcMinify enabled
- reactStrictMode: true

**Known Warnings**:

- "turbo" key in experimental not recognized (Next.js 16.0.0 issue)
- swcMinify moved to different config location

---

## Environment Configuration

### Backend .env File

```bash
# Application Settings
PORT=4000
USE_REAL_PRICES=true

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Ilms2009
DB_NAME=mystocks

# CORS Settings
FRONTEND_URL=http://localhost:3000

# API Settings
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# Alpha Vantage API Key (for sector/industry data)
ALPHA_VANTAGE_API_KEY=demo
```

**Security Note**: .env file contains plaintext database password

---

## Known Issues & Bugs

### 1. Sector/Industry Fetching Not Working

**File**: `backend/src/services/dataProviders/YahooFinanceRealProvider.ts`

**Issue**:

```
⚠️ Yahoo Finance: Failed to fetch company profile for {symbol}:
yahooFinance.quoteSummary is not a function
```

**Root Cause**: Yahoo-finance2 npm package import not working correctly

**Current Import**:

```typescript
const yahooFinance = require("yahoo-finance2");
```

**Attempted Fix**:

```typescript
const quoteSummary: any = await(yahooFinance.quoteSummary as any)(symbol, {
  modules: ["assetProfile"],
});
```

**Status**: Still failing, quoteSummary method not accessible

**Impact**: All stocks show sector: 'N/A', industry: 'N/A'

**Workaround**: None currently functional

**Files Involved**:

- `backend/src/services/dataProviders/YahooFinanceRealProvider.ts` (lines 168-186)
- `backend/src/services/dataProviders/DataProviderManager.ts` (lines 438-464)
- `backend/src/routes/WatchlistRoutes.ts` (lines 80-99)

### 2. Alpha Vantage Provider Unhealthy

**Error**: "No time series data for AAPL"

**Root Cause**: Using demo API key which is heavily rate-limited

**Solution**: Obtain free API key from https://www.alphavantage.co/support/#api-key

**Impact**: No failover if Yahoo Finance fails

### 3. Foreign Key Constraint Removed

**Table**: stock_prices_history

**Change**: Removed foreign key constraint to Watchlist_stocks

**Reason**: Allow price history for stocks not in current Watchlist

**Impact**: No referential integrity enforcement

---

## Performance Characteristics

### Response Times

- Stock price fetch (cached): <10ms
- Stock price fetch (uncached): 200-500ms (Yahoo Finance API latency)
- Database query (Watchlist): 10-50ms
- WebSocket message delivery: <100ms
- Symbol validation: 200-500ms (requires API call)

### Cache Efficiency

- Hit Rate: ~90% for actively monitored stocks (10-second updates with 60-second cache)
- Miss Rate: ~10% (cache expiration)
- Memory Usage: Negligible (Map with ~12-20 entries)

### Scalability Limits

- **Concurrent Users**: Not tested (no authentication, shared WebSocket namespace)
- **Stock Symbols**: No hard limit, performance degrades linearly with number of subscribed symbols
- **Database**: MySQL can handle current load easily, no optimization done
- **Memory**: In-memory cache grows linearly with unique symbols requested

---

## Deployment Configuration

### Development Mode (Current)

- **Backend**: `npm run dev` (nodemon hot reload)
- **Frontend**: `npm run dev` (Next.js dev server with Turbopack)
- **Database**: MySQL running locally

### Production Build (Not Configured)

- **Backend**: `npm run build` → `npm start`
- **Frontend**: `npm run build` → Production Next.js server
- **Environment**: No production .env file
- **Process Manager**: PM2 or similar not configured
- **Reverse Proxy**: None (direct port access)
- **SSL/TLS**: Not configured
- **Domain**: Not configured

---

## Testing

### Unit Tests

**Status**: Not implemented

**Files**: None

### Integration Tests

**Status**: Not implemented

**Files**: None

### End-to-End Tests

**Status**: Not implemented

**Files**: None

### Manual Testing

**Status**: Performed during development

**Coverage**:

- Add stock to Watchlist ✅
- Remove stock from Watchlist ✅
- Real-time price updates ✅
- WebSocket connection ✅
- Database persistence ✅
- Symbol validation ✅
- Exchange detection ✅
- Sector/industry fetching ❌ (not working)

---

## Dependencies

### Backend Dependencies (package.json)

```json
{
  "axios": "^1.6.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "mysql2": "^3.15.3",
  "node-cron": "^3.0.3",
  "socket.io": "^4.8.1",
  "yahoo-finance2": "^3.10.0"
}
```

### Backend DevDependencies

```json
{
  "typescript": "^5.3.0",
  "@types/node": "^20.10.0",
  "@types/express": "^4.17.21",
  "@types/cors": "^2.8.17",
  "nodemon": "^3.0.2",
  "ts-node": "^10.9.1"
}
```

### Frontend Dependencies

- Next.js 16.0.0
- React
- Socket.IO client
- TypeScript

---

## Logging & Monitoring

### Log Format

Console output with emoji prefixes:

```
🔍 Validating symbol: AAPL
✅ Symbol AAPL validated successfully
🏢 Fetching company profile for AAPL...
⚠️ No profile data available for AAPL
📊 Prepared stock data for AAPL
📈 Added stock to Watchlist: AAPL
```

### Log Levels

- **Info**: Standard operations (✅, 📊, 📈, 📡)
- **Warning**: Non-critical issues (⚠️)
- **Error**: Failures (❌)
- **Debug**: Cache hits, provider status (💾, 🏥)

### Log Destinations

- **Console Only**: No file logging
- **No Persistence**: Logs lost on restart
- **No Aggregation**: No centralized logging

### Monitoring Tools

**Status**: Not implemented

**Suggestions**:

- Winston or Pino for structured logging
- PM2 for process monitoring
- Prometheus for metrics
- Grafana for visualization

---

## Security Considerations

### Current Security Posture

#### Authentication & Authorization

**Status**: Not implemented

**Risk**: Anyone with network access can:

- View all Watchlist stocks
- Add/remove stocks
- Access stock price data
- Connect to WebSocket

#### API Key Management

**Storage**: .env file (plaintext)

**Exposure Risk**:

- .env file in git repository (should be in .gitignore)
- No secrets management system

**Best Practice**: Use environment variables, secrets manager, or vault

#### Database Security

**Password**: Hardcoded in .env file

**User**: root (overprivileged)

**Encryption**: No encryption at rest or in transit (localhost only)

**SQL Injection**: Protected by mysql2 parameterized queries

#### CORS Configuration

**Setting**: `FRONTEND_URL=http://localhost:3000`

**Implementation**: Basic CORS middleware

**Risk**: Development-only, not production-ready

#### Rate Limiting

**Setting**: 100 requests/minute (configured but not enforced)

**Implementation**: Not enforced at application level

**Protection**: Relying on provider rate limits only

#### Input Validation

**Symbol Validation**: Yes (via Yahoo Finance API)

**SQL Injection**: Protected (parameterized queries)

**XSS**: Not explicitly handled (React provides some protection)

**CSRF**: Not protected

---

## Git Repository Information

### Repository

- **Name**: stock-monitor-space
- **Owner**: MikeB007
- **Branch**: master
- **Default Branch**: master

### Project Structure

```
stock-monitor-space/
├── backend/
├── frontend/
├── BUSINESS-DOCUMENTATION.md      # This file
├── TECHNICAL-DOCUMENTATION.md     # Technical details
└── .github/
    └── copilot-instructions.md
```

---

## Troubleshooting Guide

### Backend Won't Start

1. Check MySQL is running: `mysql -u root -p`
2. Verify database exists: `SHOW DATABASES;`
3. Check port 4000 is available: `netstat -ano | findstr :4000`
4. Verify .env file exists and has correct credentials
5. Check Node.js version: `node --version`

### Frontend Won't Start

1. Check port 3000 is available
2. Verify backend is running on port 4000
3. Check Node.js version
4. Clear Next.js cache: `rm -rf .next`

### WebSocket Not Connecting

1. Check backend WebSocket server is running
2. Verify CORS settings in backend
3. Check browser console for connection errors
4. Verify Socket.IO versions match (backend and frontend)

### Database Connection Failed

1. Check MySQL service is running
2. Verify credentials in .env file
3. Test connection: `mysql -u root -p -h localhost`
4. Check database exists: `USE mystocks;`
5. Verify port 3306 is open

### Stock Prices Not Updating

1. Check Yahoo Finance API is accessible
2. Verify cache is working (look for 💾 Cache hit logs)
3. Check provider health: GET /api/provider-status
4. Verify WebSocket connection (browser dev tools)
5. Check console for errors

### Sector/Industry Shows N/A

**Status**: Known issue, not currently working

**See**: Known Issues section above

---

## Build & Run Commands

### Backend

```bash
# Development (hot reload)
cd backend
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check only
npm run type-check
```

### Frontend

```bash
# Development (hot reload)
cd frontend
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Database

```bash
# Connect to MySQL
mysql -u root -p

# Use database
USE mystocks;

# Show tables
SHOW TABLES;

# Show Watchlist
SELECT * FROM Watchlist_stocks;

# Show recent prices
SELECT * FROM stock_prices_history ORDER BY recorded_at DESC LIMIT 20;
```

---

## Code Quality

### TypeScript Configuration

**Strict Mode**: Not enforced

**Target**: ES2020 or later

**Module**: CommonJS

**Linting**: ESLint configured but not actively enforced

### Code Style

**Format**: Not enforced (no Prettier configuration)

**Conventions**: Inconsistent (mix of styles)

**Comments**: Minimal, emoji-based log messages

### Error Handling

**Pattern**: Try-catch blocks with console.error

**Recovery**: Graceful degradation (return null/N/A)

**User Feedback**: HTTP status codes + error messages

---

## Performance Optimization Opportunities

### Database

- [ ] Add connection pooling
- [ ] Add indexes on frequently queried columns
- [ ] Implement query result caching
- [ ] Archive old price history data

### API Calls

- [ ] Batch more requests together
- [ ] Implement request deduplication
- [ ] Add persistent cache (Redis)
- [ ] Implement circuit breaker pattern

### Frontend

- [ ] Implement virtual scrolling for large Watchlists
- [ ] Add service worker for offline support
- [ ] Optimize bundle size
- [ ] Add image optimization

### WebSocket

- [ ] Implement rooms per user (when auth added)
- [ ] Add message compression
- [ ] Implement reconnection backoff
- [ ] Add heartbeat/keepalive

---

## Maintenance Tasks

### Daily

- Monitor Yahoo Finance API availability
- Check error logs for unusual patterns

### Weekly

- Review database growth
- Check cache hit rates
- Verify all stocks updating correctly

### Monthly

- Update dependencies (npm audit)
- Review and archive old price history
- Performance testing
- Security audit

### Quarterly

- Dependency security updates
- Database backup verification
- Disaster recovery testing

---

## Contact & Support

**Primary Developer**: Not specified

**Repository**: https://github.com/MikeB007/stock-monitor-space

**Last Updated**: November 1, 2025

**Documentation Version**: 1.0
