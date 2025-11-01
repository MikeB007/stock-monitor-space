# Stock Monitor Backend - MySQL Integration

## Overview
The Stock Monitor Backend now includes comprehensive MySQL database integration for portfolio management and price history tracking.

## Features

### Database Services
- **Portfolio Management**: Store and manage stock portfolio with symbol, description, country, and market information
- **Price History**: Automatic recording of real stock price data from Yahoo Finance
- **Connection Pooling**: Efficient MySQL connection management
- **Auto-Initialization**: Database tables created automatically on startup

### Portfolio API Endpoints
- `GET /api/portfolio` - Get all portfolio stocks
- `POST /api/portfolio` - Add stock to portfolio
- `PUT /api/portfolio/:id` - Update portfolio stock
- `DELETE /api/portfolio/:id` - Remove stock from portfolio
- `GET /api/portfolio/stats` - Get portfolio statistics

### Database Schema

#### portfolio_stocks
```sql
CREATE TABLE portfolio_stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255),
    description TEXT,
    country VARCHAR(100),
    market VARCHAR(100),
    quantity DECIMAL(10,2) DEFAULT 0,
    average_cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### stock_prices_history
```sql
CREATE TABLE stock_prices_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    volume BIGINT,
    provider VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_date (symbol, recorded_at)
);
```

## Configuration

### Environment Variables (.env)
```
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=stock_monitor

# Application Settings
PORT=4000
USE_REAL_PRICES=true
```

### MySQL Setup
1. Install MySQL Server (8.0 or later recommended)
2. Create database: `CREATE DATABASE stock_monitor;`
3. Update `.env` file with your MySQL credentials
4. Start the backend - tables will be created automatically

## Default Portfolio Stocks
The system automatically populates default stocks on initialization:
- AAPL (Apple Inc.) - US Market
- SMR (NuScale Power) - US Market  
- BTC (Bitcoin) - Cryptocurrency
- GOOGL (Alphabet Inc.) - US Market
- MSFT (Microsoft) - US Market

## Real-Time Price Recording
- Only real price data (not simulated) is recorded to the database
- Prices are recorded automatically when fetched from Yahoo Finance
- Price history enables portfolio performance tracking

## Error Handling
- Database connection failures are gracefully handled
- Server continues to operate with limited functionality if database is unavailable
- All database operations include comprehensive error logging

## Development
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Run in development mode
npm run dev

# Build for production
npm run build
npm start
```

## Portfolio Management Usage

### Add Stock to Portfolio
```javascript
POST /api/portfolio
{
  "symbol": "TSLA",
  "name": "Tesla Inc.",
  "description": "Electric vehicle manufacturer",
  "country": "USA",
  "market": "NASDAQ",
  "quantity": 10,
  "average_cost": 250.00
}
```

### Get Portfolio Statistics
```javascript
GET /api/portfolio/stats
{
  "total_stocks": 5,
  "total_value": 12500.00,
  "top_holding": "AAPL"
}
```

## Logging
Enhanced logging provides visibility into:
- Database connection status
- Portfolio operations
- Price recording events
- Error conditions

The enhanced backend now provides a complete stock monitoring solution with persistent data storage and portfolio management capabilities.