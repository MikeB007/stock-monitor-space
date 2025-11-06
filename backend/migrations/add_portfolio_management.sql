-- Migration: Add User and watchlist Management
-- Date: 2025-11-03
-- Description: Adds users and watchlists tables, updates watchlist_stocks table

USE mystocks;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    last_viewed_watchlist_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_watchlist (user_id, name)
);

-- Backup existing watchlist_stocks data (optional - comment out if not needed)
-- CREATE TABLE watchlist_stocks_backup AS SELECT * FROM watchlist_stocks;

-- Add watchlist_id column to watchlist_stocks
ALTER TABLE watchlist_stocks 
ADD COLUMN watchlist_id INT NOT NULL DEFAULT 1 FIRST;

-- Drop the old unique constraint on symbol only
ALTER TABLE watchlist_stocks 
DROP INDEX IF EXISTS symbol;

-- Add composite unique constraint for watchlist_id + symbol
ALTER TABLE watchlist_stocks 
ADD UNIQUE KEY unique_watchlist_symbol (watchlist_id, symbol);

-- Add foreign key constraint
ALTER TABLE watchlist_stocks 
ADD CONSTRAINT fk_watchlist 
FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE;

-- Create user_preferences table for session state
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    browser_id VARCHAR(255) NOT NULL UNIQUE,
    last_viewed_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (last_viewed_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert a default user and watchlist for existing data
INSERT INTO users (username, email) VALUES ('Default User', 'default@example.com')
ON DUPLICATE KEY UPDATE username=username;

INSERT INTO watchlists (user_id, name, description) 
SELECT 1, 'Default watchlist', 'Auto-created watchlist for existing stocks'
WHERE NOT EXISTS (SELECT 1 FROM watchlists WHERE id = 1);

-- Update existing watchlist_stocks to use the default watchlist (id=1)
-- This is already handled by the DEFAULT 1 in the ALTER TABLE above

SELECT 'Migration completed successfully!' AS Status;
SELECT COUNT(*) AS TotalUsers FROM users;
SELECT COUNT(*) AS Totalwatchlists FROM watchlists;
SELECT COUNT(*) AS TotalStocks FROM watchlist_stocks;
