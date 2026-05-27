-- ============================================================
-- Stock Monitor - MySQL Database Schema
-- Database: mystocks
-- ============================================================

CREATE DATABASE IF NOT EXISTS mystocks
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mystocks;

-- ============================================================
-- TABLE: users
-- Stores application user accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(100) NOT NULL UNIQUE,
    email      VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: watchlists
-- Each user can have multiple named watchlists
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlists (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_watchlist (user_id, name),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: stocks
-- Canonical stock/asset metadata (one row per symbol)
-- ============================================================
CREATE TABLE IF NOT EXISTS stocks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    symbol      VARCHAR(20)  NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    country     VARCHAR(100) NOT NULL,
    market      VARCHAR(100) NOT NULL,
    exchange    VARCHAR(50),
    sector      VARCHAR(100),
    industry    VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol  (symbol),
    INDEX idx_market  (market),
    INDEX idx_country (country),
    INDEX idx_sector  (sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: watchlist_stocks
-- Junction table linking watchlists to stocks (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist_stocks (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    watchlist_id INT NOT NULL,
    stock_id     INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id)     REFERENCES stocks(id)     ON DELETE CASCADE,
    UNIQUE KEY unique_watchlist_stock (watchlist_id, stock_id),
    INDEX idx_watchlist_id (watchlist_id),
    INDEX idx_stock_id     (stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: user_preferences
-- Per-user UI preferences (colour scheme, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    color_scheme VARCHAR(50) DEFAULT 'standard',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preferences (user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: stock_prices_history
-- Time-series price snapshots recorded by the backend service
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_prices_history (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    symbol         VARCHAR(20)                              NOT NULL,
    price          DECIMAL(15,4)                            NOT NULL,
    change_amount  DECIMAL(15,4),
    change_percent DECIMAL(8,4),
    volume         BIGINT,
    market_cap     VARCHAR(50),
    provider       VARCHAR(50),
    market_state   ENUM('PRE','REGULAR','POST','CLOSED')    DEFAULT 'REGULAR',
    recorded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_date  (symbol, recorded_at),
    INDEX idx_recorded_at  (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
