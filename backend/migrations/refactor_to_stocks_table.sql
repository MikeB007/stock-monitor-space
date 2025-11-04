-- Migration: Refactor to Stocks Table (Remove Duplication)
-- Date: 2025-11-03
-- Description: Creates a stocks table for unique stock metadata and converts portfolio_stocks to a pure junction table

USE mystocks;

-- Step 1: Create the new stocks table with unique stock metadata
CREATE TABLE IF NOT EXISTS stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    exchange VARCHAR(50),
    sector VARCHAR(100),
    industry VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol (symbol),
    INDEX idx_market (market),
    INDEX idx_country (country),
    INDEX idx_sector (sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Migrate unique stock data from portfolio_stocks to stocks table
INSERT INTO stocks (symbol, description, country, market, exchange, sector, industry)
SELECT DISTINCT 
    symbol,
    description,
    country,
    market,
    exchange,
    sector,
    industry
FROM portfolio_stocks
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    country = VALUES(country),
    market = VALUES(market),
    exchange = VALUES(exchange),
    sector = VALUES(sector),
    industry = VALUES(industry);

-- Step 3: Backup the old portfolio_stocks table
CREATE TABLE IF NOT EXISTS portfolio_stocks_backup_20251103 AS 
SELECT * FROM portfolio_stocks;

-- Step 4: Create new portfolio_stocks junction table
CREATE TABLE IF NOT EXISTS portfolio_stocks_new (
    id INT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id INT NOT NULL,
    stock_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_portfolio_stock (portfolio_id, stock_id),
    INDEX idx_portfolio_id (portfolio_id),
    INDEX idx_stock_id (stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Migrate data from old portfolio_stocks to new junction table
INSERT INTO portfolio_stocks_new (portfolio_id, stock_id, created_at, updated_at)
SELECT 
    ps.portfolio_id,
    s.id as stock_id,
    ps.created_at,
    ps.updated_at
FROM portfolio_stocks ps
INNER JOIN stocks s ON ps.symbol = s.symbol;

-- Step 6: Drop old portfolio_stocks table and rename new one
DROP TABLE portfolio_stocks;
RENAME TABLE portfolio_stocks_new TO portfolio_stocks;

-- Verification queries
SELECT '=== MIGRATION COMPLETED ===' AS Status;
SELECT COUNT(*) AS TotalUniqueStocks FROM stocks;
SELECT COUNT(*) AS TotalPortfolioStockRelationships FROM portfolio_stocks;
SELECT 
    p.name as PortfolioName,
    s.symbol as StockSymbol,
    s.description as StockDescription,
    s.sector as Sector
FROM portfolio_stocks ps
INNER JOIN portfolios p ON ps.portfolio_id = p.id
INNER JOIN stocks s ON ps.stock_id = s.id
ORDER BY p.name, s.symbol;

SELECT '=== STOCKS TABLE SAMPLE ===' AS Info;
SELECT * FROM stocks LIMIT 10;

SELECT '=== PORTFOLIO_STOCKS JUNCTION TABLE ===' AS Info;
SELECT ps.id, ps.portfolio_id, ps.stock_id, s.symbol, p.name as portfolio_name
FROM portfolio_stocks ps
INNER JOIN stocks s ON ps.stock_id = s.id
INNER JOIN portfolios p ON ps.portfolio_id = p.id
LIMIT 10;
