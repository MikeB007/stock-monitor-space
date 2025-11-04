# Stock Monitor System - Business Documentation

## Current Status: November 1, 2025

### System Overview

Real-time stock monitoring application with MySQL database persistence, multi-provider data fetching, and WebSocket live updates.

---

## Operational Features

### 1. Real-Time Stock Price Monitoring

- **Status**: Fully Operational
- **Update Frequency**: 10-second intervals for equities, 60-second intervals for Bitcoin
- **Data Source**: Yahoo Finance (primary, free, no API key required)
- **Pre/Post Market Data**: Supported for US stocks
- **Market State Detection**: PRE, REGULAR, POST market states tracked

### 2. Multi-Exchange Support

- **Global Coverage**: 25+ international stock exchanges
- **Supported Markets**:
  - US: NYSE, NASDAQ, AMEX, OTC, Pink Sheets
  - Canada: TSX, TSX-V
  - Europe: LSE, Euronext, XETRA, BME
  - Asia: HKEX, Tokyo, Shanghai, Shenzhen, BSE, NSE
  - Other: ASX, JSE, B3
- **Exchange Detection**: Automatic global exchange identification with US-first logic for clean symbols
- **Canadian Market**: .CA and .TO suffix support

### 3. Database Persistence

- **Status**: Fully Operational
- **Database**: MySQL (mystocks database)
- **Tables**:
  - Watchlist_stocks: User Watchlist with 10 stocks currently loaded
  - stock_prices_history: Historical price tracking
- **Watchlist Management**: Add, update, delete stocks via REST API
- **Data Integrity**: No hardcoded defaults, database-only loading

### 4. Current Watchlist Holdings

```
Symbol    | Description                          | Market  | Exchange | Status
----------|--------------------------------------|---------|----------|--------
TD        | Toronto-Dominion Bank               | Canada  | TSX      | Active
MSFT      | Microsoft Corporation               | US      | NASDAQ   | Active
TSLA      | Tesla, Inc.                         | US      | NASDAQ   | Active
AAPL      | Apple Inc.                          | US      | NASDAQ   | Active
LITH.V    | Lithium Chile Inc.                  | Canada  | TSX-V    | Active
LI.V      | American Lithium Corp.              | Canada  | TSX-V    | Active
KDK.V     | Kodiak Copper Corp.                 | Canada  | TSX-V    | Active
IBM       | International Business Machines     | US      | NYSE     | Active
CM        | Canadian Imperial Bank of Commerce  | Canada  | TSX      | Active
RY.TO     | Royal Bank of Canada                | Canada  | TSX      | Active
WMT       | Walmart Inc.                        | US      | NYSE     | Active
JNJ       | Johnson & Johnson                   | US      | NYSE     | Active
```

### 5. Cryptocurrency Support

- **Bitcoin**: Real-time BTC-USD tracking
- **Current Price**: ~$110,355 (as of latest update)
- **Provider**: Yahoo Finance

### 6. Stock Metadata

- **Price Data**: Current price, change, percent change, volume
- **Trading Ranges**: Day high/low, 52-week high/low
- **Market Cap**: Available for most US stocks
- **Sector/Industry**: Implementation in progress (currently returns N/A)

### 7. User Interface

- **Technology**: Next.js 16.0.0 with Turbopack
- **Real-Time Updates**: WebSocket connection to backend
- **Port**: http://localhost:3000
- **Features**:
  - Live price updates
  - Stock search and validation
  - Add/remove stocks from Watchlist
  - Market column with no-wrap formatting

---

## Known Limitations

### Sector/Industry Data

- **Status**: Not Currently Working
- **Issue**: Yahoo Finance quoteSummary API integration incomplete
- **Workaround**: Values default to 'N/A'
- **Impact**: Users cannot see sector/industry classifications

### API Rate Limits

- **Yahoo Finance**: 2-second delay between requests (self-imposed)
- **Alpha Vantage**: 5 requests/minute (when configured)
- **Caching**: 60-second TTL to reduce API calls

---

## System Requirements

### Backend Requirements

- Node.js with TypeScript
- MySQL Server (version not specified)
- Port 4000 available
- Internet connection for Yahoo Finance API

### Frontend Requirements

- Node.js
- Port 3000 available
- Modern web browser with WebSocket support

### Database Requirements

- MySQL database named 'mystocks'
- Tables: Watchlist_stocks, stock_prices_history
- User: root
- Password: (configured in .env)

---

## Operational Status

### Services Running

- ✅ Backend Server: Port 4000 (Express + WebSocket)
- ✅ Frontend Server: Port 3000 (Next.js)
- ✅ MySQL Database: Connected and operational
- ✅ Yahoo Finance API: Primary provider (healthy)
- ⚠️ Alpha Vantage API: Secondary provider (unhealthy - demo key)
- ❌ Financial Modeling Prep: Disabled (no API key)

### Current Performance

- Stock Price Updates: 10-second intervals
- Bitcoin Updates: 60-second intervals
- Database Queries: Sub-second response times
- WebSocket Latency: Real-time (<100ms)
- Cache Hit Rate: High (60-second TTL working effectively)

---

## Business Continuity

### Single Point of Failure

- **Yahoo Finance API**: Primary dependency with no active failover
- **Mitigation**: 60-second caching reduces impact of temporary outages
- **Recovery**: Automatic retry with exponential backoff

### Data Backup

- **Status**: Not documented
- **Recommendation**: Database backup strategy not specified

### Monitoring

- **Health Checks**: Provider health monitoring every 5 minutes
- **Error Tracking**: Console logging only
- **Alerting**: None configured

---

## Cost Structure

- **Yahoo Finance**: Free (no API key required)
- **Alpha Vantage**: Free tier available (currently using demo key)
- **Financial Modeling Prep**: Not configured
- **Infrastructure**: Self-hosted (no cloud costs)
- **Database**: MySQL (open source, no licensing costs)

---

## Compliance & Security

- **API Keys**: Stored in .env file (not in version control)
- **CORS**: Configured for localhost:3000
- **Authentication**: None implemented
- **Data Privacy**: No user authentication or PII collected
- **Rate Limiting**: Self-imposed (100 requests/minute configured)

---

## Support & Maintenance

### Hot Reload

- **Backend**: Nodemon active (auto-restart on code changes)
- **Frontend**: Next.js development mode (auto-refresh)

### Error Handling

- **Provider Failures**: Automatic fallback to secondary providers
- **Database Errors**: Logged, service continues
- **Invalid Symbols**: Validation before database insertion

### Logging

- **Level**: Console output (info, warnings, errors)
- **Format**: Emoji-prefixed structured logs
- **Persistence**: None (console only)

---

## Future Roadmap (Not Implemented)

- Sector/industry data fetching
- User authentication
- Watchlist performance tracking
- Historical price charts
- Email/SMS alerts
- Mobile application
- Multi-user support
- Advanced analytics
