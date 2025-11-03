-- Migration: Add User and Portfolio Management
-- Date: 2025-11-03
-- Description: Adds users and portfolios tables, updates portfolio_stocks table

USE mystocks;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    last_viewed_portfolio_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_portfolio (user_id, name)
);

-- Backup existing portfolio_stocks data (optional - comment out if not needed)
-- CREATE TABLE portfolio_stocks_backup AS SELECT * FROM portfolio_stocks;

-- Add portfolio_id column to portfolio_stocks
ALTER TABLE portfolio_stocks 
ADD COLUMN portfolio_id INT NOT NULL DEFAULT 1 FIRST;

-- Drop the old unique constraint on symbol only
ALTER TABLE portfolio_stocks 
DROP INDEX IF EXISTS symbol;

-- Add composite unique constraint for portfolio_id + symbol
ALTER TABLE portfolio_stocks 
ADD UNIQUE KEY unique_portfolio_symbol (portfolio_id, symbol);

-- Add foreign key constraint
ALTER TABLE portfolio_stocks 
ADD CONSTRAINT fk_portfolio 
FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE;

-- Create user_preferences table for session state
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    browser_id VARCHAR(255) NOT NULL UNIQUE,
    last_viewed_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (last_viewed_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert a default user and portfolio for existing data
INSERT INTO users (username, email) VALUES ('Default User', 'default@example.com')
ON DUPLICATE KEY UPDATE username=username;

INSERT INTO portfolios (user_id, name, description) 
SELECT 1, 'Default Portfolio', 'Auto-created portfolio for existing stocks'
WHERE NOT EXISTS (SELECT 1 FROM portfolios WHERE id = 1);

-- Update existing portfolio_stocks to use the default portfolio (id=1)
-- This is already handled by the DEFAULT 1 in the ALTER TABLE above

SELECT 'Migration completed successfully!' AS Status;
SELECT COUNT(*) AS TotalUsers FROM users;
SELECT COUNT(*) AS TotalPortfolios FROM portfolios;
SELECT COUNT(*) AS TotalStocks FROM portfolio_stocks;
