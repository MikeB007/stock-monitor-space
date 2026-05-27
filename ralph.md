# RALPH LOOPS — Stock Monitor Enhancement Plan

> **RALPH Loop**: Reflect → Analyze → Learn → Plan → Hypothesize  
> Systematic, incremental execution for building capable AI-assisted features.  
> Source: IDEAS.txt | Generated: May 26, 2026

---

## LOOP 1 — ChatGPT Watchlist Assistant

### Reflect
The app currently has no natural language interface. Users must manually search and manage watchlists without AI guidance.

### Analyze
- OpenAI API integration is needed for NL query parsing
- Queries like "Show me tech stocks with P/E ratio under 20" require stock data + LLM reasoning
- Watchlist builder via natural language requires structured prompts and stock data context
- Stock comparison (AAPL vs MSFT) requires a data aggregation layer

### Learn
- OpenAI API key + usage budget required before starting
- Prompts must include current stock data as context (RAG pattern)
- Rate limiting and cost control are essential
- Sector rotation logic needs market condition signals

### Plan
1. [ ] Set up OpenAI API key in `backend/src/config/apiKeys.ts`
2. [ ] Create `chatAssistantService.ts` with prompt builder
3. [ ] Add `/api/chat` route to `routes.ts`
4. [ ] Build frontend chat widget component
5. [ ] Inject watchlist data + stock prices into prompts as context
6. [ ] Add stock comparison endpoint (`/api/compare?symbols=AAPL,MSFT`)

### Hypothesize
If implemented, users will interact with their watchlist in natural language, reducing friction and increasing engagement. Estimated effort: 2–3 weeks.

---

## LOOP 2 — Popular Stocks Dashboard

### Reflect
All user activity is isolated per session. There is no aggregate view of what stocks are trending across all users.

### Analyze
- Need a `stock_views` or `stock_activity` table to track symbol interactions
- Trending metrics: most added, most viewed, most watched, top gainers/losers
- Anonymization is required — no user-identifiable data should be exposed
- Leaderboard of community watchlists needs careful privacy design

### Learn
- Database aggregation queries (GROUP BY symbol, COUNT) can power popularity metrics
- Yahoo Finance or Alpha Vantage provide top gainers/losers data externally
- "What others are watching" widget can be a simple cached top-10 list
- Refresh interval should be configurable (e.g., every 15 min)

### Plan
1. [ ] Add `stock_activity` table to track anonymous symbol interactions
2. [ ] Create `popularityService.ts` to aggregate trending stocks
3. [ ] Add `/api/popular` and `/api/trending` routes
4. [ ] Build "Popular Stocks" dashboard page in frontend
5. [ ] Add top gainers/losers widgets with timeframe filters (24h, 7d, 30d, YTD)
6. [ ] Cache results with TTL to reduce DB load

### Hypothesize
A trending/popular stocks view will surface useful discovery signals and increase session time. Privacy-safe aggregation ensures GDPR alignment.

---

## LOOP 3 — Price Alerts System

### Reflect
Users currently have no way to be notified when a stock hits a target price or changes by a threshold percentage. They must manually check the app.

### Analyze
- Alerts require a persistent store of alert rules per user/session
- Threshold types: absolute price (above/below), percentage change (±X%)
- Delivery channels: in-app, email, SMS, push notification
- Volume spike alerts need a real-time data comparison baseline
- After-hours alerts require extended market data

### Learn
- Email delivery via SendGrid/Nodemailer; SMS via Twilio
- Alert evaluation should run on a scheduled job (cron) or during price updates
- Alerts must be one-time or repeating (configurable)
- WebSocket can push real-time in-app alerts to the frontend

### Plan
1. [ ] Create `alerts` table (symbol, type, threshold, delivery, triggered_at)
2. [ ] Build `alertService.ts` to evaluate rules against latest prices
3. [ ] Add `/api/alerts` CRUD routes
4. [ ] Integrate alert evaluation into the stock price update cycle
5. [ ] Build frontend alert management UI (set/delete/view alerts)
6. [ ] Add email notification via Nodemailer for threshold triggers

### Hypothesize
Price alerts will dramatically increase the utility of passive watchlist monitoring. Users who set alerts will return to the app on trigger events.

---

## LOOP 4 — User Authentication & Multi-User Support

### Reflect
The app uses browser ID for session identity. There is no persistent user account system, so watchlists are lost when the browser/device changes.

### Analyze
- Need user registration, login, and session management
- OAuth (Google, GitHub, Apple) reduces friction vs email/password only
- 2FA adds security layer for sensitive financial data
- Role-based access: view-only, editor, admin
- Current browser-ID model must migrate to user-ID model gracefully

### Learn
- `passport.js` or `better-auth` are solid auth libraries for Express
- JWT access tokens + refresh tokens for stateless auth
- `bcrypt` for password hashing (min 12 rounds)
- Migrate existing browser-ID watchlists to user accounts on first login
- Session timeout should be configurable per security policy

### Plan
1. [ ] Add `users` table (id, email, password_hash, oauth_provider, role, created_at)
2. [ ] Implement JWT-based auth middleware in `backend/src/`
3. [ ] Add `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` routes
4. [ ] Integrate Google OAuth via passport.js
5. [ ] Add 2FA support (TOTP via `speakeasy`)
6. [ ] Build login/register pages in frontend (`/app/auth/`)
7. [ ] Migrate browser-ID watchlists to authenticated user on login

### Hypothesize
Authenticated users will have persistent, cross-device watchlists. User retention and engagement will improve significantly.

---

## LOOP 5 — Technical Analysis Charts

### Reflect
The app displays price data in tabular form only. There are no interactive charts for historical price analysis or technical indicators.

### Analyze
- Candlestick charts need OHLCV (Open, High, Low, Close, Volume) historical data
- Technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, Fibonacci
- Multi-timeframe support: 1D, 1W, 1M, 3M, 1Y, 5Y
- Chart pattern recognition is a complex ML sub-problem (lower priority)
- Frontend charting library needed (Recharts, TradingView Lightweight Charts, or Chart.js)

### Learn
- `lightweight-charts` by TradingView is free, performant, and designed for financial data
- Yahoo Finance provides OHLCV historical data (already partially integrated)
- RSI/MACD calculations can be done client-side with `technicalindicators` npm package
- Chart state (symbol, timeframe, indicators) should be URL-serializable

### Plan
1. [ ] Add `/api/history/:symbol` endpoint returning OHLCV data
2. [ ] Install `lightweight-charts` in frontend
3. [ ] Build `StockChart` component with candlestick rendering
4. [ ] Add timeframe selector (1D / 1W / 1M / 3M / 1Y)
5. [ ] Overlay SMA and EMA indicators
6. [ ] Add RSI and MACD panels below main chart
7. [ ] Link chart to watchlist row click

### Hypothesize
Interactive charts will make the app competitive with consumer-grade tools (Yahoo Finance, TradingView). This is a major retention driver.

---

## LOOP 6 — Watchlist Analytics Dashboard

### Reflect
There are no portfolio-level analytics. Users see individual stock metrics but cannot assess their overall watchlist risk, diversification, or performance.

### Analyze
- Beta, Sharpe ratio, diversification score require position weights (not tracked yet)
- Sector allocation pie chart needs sector classification per stock
- Asset correlation heatmap needs historical return correlations between pairs
- Geographic exposure map requires country-of-domicile data per stock

### Learn
- Sector data available from Yahoo Finance (already in providers)
- Beta calculation: covariance(stock, market) / variance(market) over rolling window
- Sharpe ratio: (portfolio return - risk-free rate) / portfolio std dev
- `d3.js` or Recharts suitable for heatmaps and pie charts

### Plan
1. [ ] Add sector/geography fields to stock data model
2. [ ] Create `analyticsService.ts` for beta, Sharpe, correlation calculations
3. [ ] Add `/api/analytics/watchlist/:id` endpoint
4. [ ] Build analytics dashboard page with Recharts visualizations
5. [ ] Add sector allocation pie chart
6. [ ] Add asset correlation heatmap component

### Hypothesize
Portfolio-level analytics will elevate the app from a price tracker to a genuine investment analysis tool, attracting more sophisticated users.

---

## LOOP 7 — Transaction Tracking & Cost Basis

### Reflect
The app monitors live prices but has no record of actual buy/sell transactions. Users cannot track real P&L, cost basis, or tax exposure.

### Analyze
- Need `transactions` table: symbol, shares, price, date, type (buy/sell), lot method
- Cost basis methods: FIFO, LIFO, specific lot
- Realized vs unrealized gains calculation against current price
- Dividend tracking requires corporate actions data feed
- Tax reporting needs yearly capital gains/loss summaries

### Learn
- IRS wash-sale rules must be considered for tax lot accounting
- Dividend data available from Yahoo Finance (exDate, amount, frequency)
- Cost basis per share = total cost / total shares (weighted average or lot-specific)
- FIFO is the default and simplest to implement first

### Plan
1. [ ] Create `transactions` table (user_id, symbol, shares, price, type, date, lot_method)
2. [ ] Build `transactionService.ts` with FIFO cost basis engine
3. [ ] Add `/api/transactions` CRUD routes
4. [ ] Calculate unrealized gain/loss per holding (current price vs cost basis)
5. [ ] Build transaction entry UI (buy/sell form)
6. [ ] Add P&L summary dashboard with realized/unrealized breakdown

### Hypothesize
Transaction tracking converts the app into a true portfolio management tool, unlocking the entire tax reporting and performance analytics feature tree.

---

## LOOP 8 — Performance & Scalability

### Reflect
The app runs well at small scale. As users and watchlists grow, unoptimized DB queries and no caching will cause latency issues.

### Analyze
- Redis caching needed for frequently fetched prices (TTL-based)
- WebSocket connection management needs pooling for many concurrent clients
- Lazy loading required for watchlists with 50+ stocks
- Database indexes missing on frequently queried columns
- No CDN for static frontend assets

### Learn
- `ioredis` is the standard Redis client for Node.js
- Bull or BullMQ for background job queues (price refresh, alert evaluation)
- Next.js supports static export + CDN deployment natively
- PostgreSQL/MySQL EXPLAIN ANALYZE will surface slow queries
- Connection pooling via `mysql2` pool config already available

### Plan
1. [ ] Add Redis to Docker/infrastructure setup
2. [ ] Wrap stock price fetches in Redis cache with 60s TTL
3. [ ] Add DB indexes on `symbol`, `user_id`, `watchlist_id` columns
4. [ ] Implement pagination on `/api/watchlist/:id/stocks` endpoint
5. [ ] Set up BullMQ for background price refresh jobs
6. [ ] Configure Next.js for CDN-compatible static asset output

### Hypothesize
Caching and indexing alone should yield 5–10x latency reduction on repeat price queries. Background jobs will decouple UI responsiveness from data fetching.

---

## LOOP 9 — Data Sources & Broker Integrations

### Reflect
The app relies on Yahoo Finance and Alpha Vantage. There is no connection to real brokerage accounts, limiting the app to manual watchlist entry.

### Analyze
- Broker APIs (Interactive Brokers, Fidelity, Schwab) require OAuth and financial compliance
- Crypto integration (Coinbase, Binance API) is less regulated and faster to add
- Options chains need Greeks (delta, gamma, theta, vega) from options data providers
- ETF holdings breakdown requires a separate data source (ETF.com, iShares API)

### Learn
- Interactive Brokers has a free API (TWS API / Client Portal API) — no brokerage license needed for read-only
- Plaid can aggregate holdings from many brokers via a single API
- Crypto data: CoinGecko API is free and comprehensive
- Compliance: executing trades requires FINRA licensing; read-only is fine

### Plan
1. [ ] Add `CoinGeckoProvider.ts` to `dataProviders/` for crypto prices
2. [ ] Add cryptocurrency symbols to watchlist support
3. [ ] Integrate Plaid API for read-only brokerage holding imports
4. [ ] Add `ETFHoldingsProvider.ts` using a free ETF data source
5. [ ] Add options chain endpoint using a financial data API
6. [ ] Build broker connection UI in settings page

### Hypothesize
Crypto support is a quick win that broadens the user base. Plaid integration unlocks automatic portfolio sync, reducing manual data entry friction significantly.

---

## LOOP 10 — Security Hardening

### Reflect
The app has basic functionality but several OWASP Top 10 risks are unmitigated: no rate limiting, potential SQL injection surface, no CSRF protection, no HTTPS enforcement.

### Analyze
- All user inputs must be parameterized (SQL injection prevention)
- Rate limiting needed on all API endpoints (express-rate-limit)
- CSRF tokens required for state-changing requests
- HTTPS/TLS certificate setup for production
- API keys stored in `.env` must not be committed to git
- Audit logs needed for security-sensitive events

### Learn
- `helmet.js` adds essential HTTP security headers in one line
- `express-rate-limit` with Redis store for distributed rate limiting
- CSRF: `csurf` middleware or double-submit cookie pattern
- `.env` files must be in `.gitignore` — verify this is already the case
- Content Security Policy (CSP) headers prevent XSS

### Plan
1. [ ] Install and configure `helmet` middleware in `server.ts`
2. [ ] Add `express-rate-limit` to all public routes (100 req/15min default)
3. [ ] Audit all DB queries in `databaseService.ts` for parameterization
4. [ ] Add CSRF middleware for POST/PUT/DELETE routes
5. [ ] Create `.env.example` template, ensure `.env` is gitignored
6. [ ] Add security audit log table for login events and sensitive actions
7. [ ] Set up HTTPS with Let's Encrypt for production deployment

### Hypothesize
Completing this loop eliminates the most critical OWASP Top 10 vulnerabilities. It is a prerequisite before any public launch or user authentication rollout.

---

## LOOP EXECUTION ORDER (Priority-Based)

| Loop | Feature | Priority | Status |
|------|---------|----------|--------|
| 10 | Security Hardening | 🔴 Critical | Not Started |
| 3 | Price Alerts System | 🔴 Critical | Not Started |
| 1 | ChatGPT Watchlist Assistant | 🔴 Critical | Not Started |
| 2 | Popular Stocks Dashboard | 🔴 Critical | Not Started |
| 4 | User Authentication | 🟠 High | Not Started |
| 5 | Technical Analysis Charts | 🟠 High | Not Started |
| 6 | Watchlist Analytics | 🟡 Medium | Not Started |
| 7 | Transaction Tracking | 🟡 Medium | Not Started |
| 8 | Performance & Scalability | 🟡 Medium | Not Started |
| 9 | Broker Integrations | 🟢 Low | Not Started |

---

*Each loop feeds the next. Complete security (Loop 10) before auth (Loop 4). Complete auth before transactions (Loop 7). The RALPH method ensures no step is skipped and every hypothesis is validated before the next loop begins.*
