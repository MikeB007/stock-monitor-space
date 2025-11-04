import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

export interface User {
    id?: number
    username: string
    email?: string
    created_at?: Date
    updated_at?: Date
}

export interface Portfolio {
    id?: number
    user_id: number
    name: string
    description?: string
    created_at?: Date
    updated_at?: Date
}

export interface Stock {
    id?: number
    symbol: string
    description: string
    country: string
    market: string
    exchange?: string
    sector?: string
    industry?: string
    created_at?: Date
    updated_at?: Date
}

export interface PortfolioStock {
    id?: number
    portfolio_id: number
    stock_id: number
    created_at?: Date
    updated_at?: Date
}

// Extended interface for API responses that include stock details
export interface PortfolioStockWithDetails extends PortfolioStock {
    symbol: string
    description: string
    country: string
    market: string
    exchange?: string
    sector?: string
    industry?: string
}

export interface UserPreferences {
    id?: number
    user_id: number
    color_scheme: string
    created_at?: Date
    updated_at?: Date
}

export interface DatabaseConfig {
    host: string
    port: number
    user: string
    password: string
    database: string
}

class DatabaseService {
    private pool: mysql.Pool | null = null
    private config: DatabaseConfig

    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Ilms2009',
            database: process.env.DB_NAME || 'mystocks'
        }
    }

    public async initialize(): Promise<void> {
        try {
            console.log('🗄️  Connecting to MySQL database...')

            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            })

            // Test connection
            const connection = await this.pool.getConnection()
            await connection.ping()
            connection.release()

            console.log('✅ Connected to MySQL database successfully')

            // Initialize tables
            await this.initializeTables()

        } catch (error) {
            console.error('❌ Database connection failed:', error)
            throw error
        }
    }

    private async initializeTables(): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            console.log('📊 Creating database tables...')

            // Create users table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            // Create portfolios table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS portfolios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    UNIQUE KEY unique_user_portfolio (user_id, name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            // Create stocks table (unique stock metadata)
            await this.pool.execute(`
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            // Create portfolio_stocks junction table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS portfolio_stocks (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            // Create user_preferences table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    color_scheme VARCHAR(50) DEFAULT 'standard',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_preferences (user_id),
                    INDEX idx_user_id (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            // Create stock_prices_history table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS stock_prices_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    symbol VARCHAR(20) NOT NULL,
                    price DECIMAL(15,4) NOT NULL,
                    change_amount DECIMAL(15,4),
                    change_percent DECIMAL(8,4),
                    volume BIGINT,
                    market_cap VARCHAR(50),
                    provider VARCHAR(50),
                    market_state ENUM('PRE', 'REGULAR', 'POST', 'CLOSED') DEFAULT 'REGULAR',
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_symbol_date (symbol, recorded_at),
                    INDEX idx_recorded_at (recorded_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci



                
            `)

            console.log('✅ Database tables created successfully')

        } catch (error) {
            console.error('❌ Failed to create database tables:', error)
            throw error
        }
    }

    // ==================== USER MANAGEMENT ====================
    
    public async createUser(user: User): Promise<number> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                `INSERT INTO users (username, email) VALUES (?, ?)`,
                [user.username, user.email || null]
            )

            const insertId = (result as any).insertId
            console.log(`👤 Created user: ${user.username} (ID: ${insertId})`)
            return insertId

        } catch (error) {
            console.error(`❌ Failed to create user ${user.username}:`, error)
            throw error
        }
    }

    public async getUsers(): Promise<User[]> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM users ORDER BY username ASC'
            )
            return rows as User[]

        } catch (error) {
            console.error('❌ Failed to get users:', error)
            throw error
        }
    }

    public async getUserById(userId: number): Promise<User | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM users WHERE id = ?',
                [userId]
            ) as any

            return rows.length > 0 ? rows[0] : null

        } catch (error) {
            console.error(`❌ Failed to get user ${userId}:`, error)
            throw error
        }
    }

    // ==================== PORTFOLIO MANAGEMENT ====================

    public async createPortfolio(portfolio: Portfolio): Promise<number> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                `INSERT INTO portfolios (user_id, name, description) VALUES (?, ?, ?)`,
                [portfolio.user_id, portfolio.name, portfolio.description || null]
            )

            const insertId = (result as any).insertId
            console.log(`📁 Created portfolio: ${portfolio.name} (ID: ${insertId})`)
            return insertId

        } catch (error) {
            console.error(`❌ Failed to create portfolio ${portfolio.name}:`, error)
            throw error
        }
    }

    public async getPortfoliosByUserId(userId: number): Promise<Portfolio[]> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM portfolios WHERE user_id = ? ORDER BY name ASC',
                [userId]
            )
            return rows as Portfolio[]

        } catch (error) {
            console.error(`❌ Failed to get portfolios for user ${userId}:`, error)
            throw error
        }
    }

    public async getPortfolioById(portfolioId: number): Promise<Portfolio | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM portfolios WHERE id = ?',
                [portfolioId]
            ) as any

            return rows.length > 0 ? rows[0] : null

        } catch (error) {
            console.error(`❌ Failed to get portfolio ${portfolioId}:`, error)
            throw error
        }
    }

    public async updatePortfolio(portfolioId: number, updates: Partial<Portfolio>): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const setClause = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'user_id')
                .map(key => `${key} = ?`)
                .join(', ')

            if (!setClause) {
                throw new Error('No valid fields to update')
            }

            const values = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'user_id')
                .map(key => (updates as any)[key])

            const [result] = await this.pool.execute(
                `UPDATE portfolios SET ${setClause} WHERE id = ?`,
                [...values, portfolioId]
            )

            const affectedRows = (result as any).affectedRows
            return affectedRows > 0

        } catch (error) {
            console.error(`❌ Failed to update portfolio ${portfolioId}:`, error)
            throw error
        }
    }

    public async deletePortfolio(portfolioId: number): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                'DELETE FROM portfolios WHERE id = ?',
                [portfolioId]
            )

            const affectedRows = (result as any).affectedRows
            if (affectedRows > 0) {
                console.log(`🗑️ Deleted portfolio ${portfolioId}`)
                return true
            }
            return false

        } catch (error) {
            console.error(`❌ Failed to delete portfolio ${portfolioId}:`, error)
            throw error
        }
    }

    // ==================== USER PREFERENCES / STATE MANAGEMENT ====================

    public async updateUserLastViewedPortfolio(userId: number, portfolioId: number): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                'UPDATE users SET last_viewed_portfolio_id = ? WHERE id = ?',
                [portfolioId, userId]
            )

            const affectedRows = (result as any).affectedRows
            return affectedRows > 0

        } catch (error) {
            console.error(`❌ Failed to update last viewed portfolio for user ${userId}:`, error)
            throw error
        }
    }

    public async getUserPreferences(browserId: string): Promise<{ last_viewed_user_id: number | null } | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT last_viewed_user_id FROM user_preferences WHERE browser_id = ?',
                [browserId]
            ) as any

            return rows.length > 0 ? rows[0] : null

        } catch (error) {
            console.error(`❌ Failed to get user preferences for browser ${browserId}:`, error)
            throw error
        }
    }

    public async saveUserPreferences(browserId: string, userId: number): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            await this.pool.execute(
                `INSERT INTO user_preferences (browser_id, last_viewed_user_id) 
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE last_viewed_user_id = ?, updated_at = CURRENT_TIMESTAMP`,
                [browserId, userId, userId]
            )

            console.log(`💾 Saved user preference: browser ${browserId} -> user ${userId}`)

        } catch (error) {
            console.error(`❌ Failed to save user preferences:`, error)
            throw error
        }
    }

    // ==================== STOCKS MANAGEMENT ====================

    public async createOrGetStock(stockData: Omit<Stock, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            // Try to insert, or update if symbol already exists
            const [result] = await this.pool.execute(
                `INSERT INTO stocks (symbol, description, country, market, exchange, sector, industry) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    description = VALUES(description),
                    country = VALUES(country),
                    market = VALUES(market),
                    exchange = VALUES(exchange),
                    sector = VALUES(sector),
                    industry = VALUES(industry),
                    id = LAST_INSERT_ID(id)`,
                [stockData.symbol, stockData.description, stockData.country, stockData.market, 
                 stockData.exchange, stockData.sector, stockData.industry]
            )

            const stockId = (result as any).insertId
            console.log(`📊 Stock ${stockData.symbol} created/updated with ID: ${stockId}`)
            return stockId

        } catch (error) {
            console.error(`❌ Failed to create/get stock ${stockData.symbol}:`, error)
            throw error
        }
    }

    public async getStockBySymbol(symbol: string): Promise<Stock | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM stocks WHERE symbol = ?',
                [symbol]
            ) as any

            return rows.length > 0 ? rows[0] : null

        } catch (error) {
            console.error(`❌ Failed to get stock ${symbol}:`, error)
            throw error
        }
    }

    // ==================== PORTFOLIO STOCKS MANAGEMENT ====================

    public async addPortfolioStock(portfolioId: number, stockData: Omit<Stock, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            // First, create or get the stock
            const stockId = await this.createOrGetStock(stockData)

            // Then, create the portfolio-stock relationship
            const [result] = await this.pool.execute(
                `INSERT INTO portfolio_stocks (portfolio_id, stock_id) 
                 VALUES (?, ?)`,
                [portfolioId, stockId]
            )

            const insertId = (result as any).insertId
            console.log(`📈 Added stock ${stockData.symbol} (ID: ${stockId}) to portfolio ${portfolioId}`)
            return insertId

        } catch (error) {
            console.error(`❌ Failed to add stock ${stockData.symbol} to portfolio:`, error)
            throw error
        }
    }

    public async getPortfolioStocks(portfolioId?: number): Promise<PortfolioStockWithDetails[]> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            let query = `
                SELECT 
                    ps.id,
                    ps.portfolio_id,
                    ps.stock_id,
                    ps.created_at,
                    ps.updated_at,
                    s.symbol,
                    s.description,
                    s.country,
                    s.market,
                    s.exchange,
                    s.sector,
                    s.industry
                FROM portfolio_stocks ps
                INNER JOIN stocks s ON ps.stock_id = s.id
            `
            const params: any[] = []
            
            if (portfolioId !== undefined) {
                query += ' WHERE portfolio_id = ?'
                params.push(portfolioId)
            }
            
            query += ' ORDER BY symbol ASC'
            
            const [rows] = await this.pool.execute(query, params)
            return rows as PortfolioStockWithDetails[]

        } catch (error) {
            console.error('❌ Failed to get portfolio stocks:', error)
            throw error
        }
    }

    public async removePortfolioStock(portfolioId: number, symbol: string): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            // First get the stock_id for this symbol
            const stock = await this.getStockBySymbol(symbol)
            if (!stock) {
                console.log(`⚠️ Stock ${symbol} not found`)
                return false
            }

            const [result] = await this.pool.execute(
                'DELETE FROM portfolio_stocks WHERE portfolio_id = ? AND stock_id = ?',
                [portfolioId, stock.id]
            )

            const affectedRows = (result as any).affectedRows
            if (affectedRows > 0) {
                console.log(`📉 Removed stock from portfolio ${portfolioId}: ${symbol}`)
                return true
            }
            return false

        } catch (error) {
            console.error(`❌ Failed to remove stock ${symbol} from portfolio:`, error)
            throw error
        }
    }

    public async updateStock(symbol: string, updates: Partial<Omit<Stock, 'id' | 'symbol' | 'created_at' | 'updated_at'>>): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const setClause = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'symbol')
                .map(key => `${key} = ?`)
                .join(', ')

            if (!setClause) {
                throw new Error('No valid fields to update')
            }

            const values = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'symbol')
                .map(key => (updates as any)[key])

            const [result] = await this.pool.execute(
                `UPDATE stocks SET ${setClause} WHERE symbol = ?`,
                [...values, symbol]
            )

            const affectedRows = (result as any).affectedRows
            if (affectedRows > 0) {
                console.log(`📊 Updated stock metadata: ${symbol}`)
                return true
            }
            return false

        } catch (error) {
            console.error(`❌ Failed to update stock ${symbol}:`, error)
            throw error
        }
    }

    public async recordStockPrice(stockData: any): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            await this.pool.execute(
                `INSERT INTO stock_prices_history 
                 (symbol, price, change_amount, change_percent, volume, market_cap, provider, market_state)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    stockData.symbol,
                    stockData.price,
                    stockData.change,
                    stockData.changePercent,
                    stockData.volume,
                    stockData.marketCap,
                    stockData.provider || 'Yahoo Finance',
                    stockData.marketState || 'REGULAR'
                ]
            )

        } catch (error) {
            // Only log error if it's not a foreign key constraint (stock not in portfolio)
            const errorMessage = (error as Error).message
            if (!errorMessage.includes('foreign key constraint')) {
                console.error(`❌ Failed to record price for ${stockData.symbol}:`, errorMessage)
            }
        }
    }

    public async getStockPriceHistory(symbol: string, hours: number = 24): Promise<any[]> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                `SELECT * FROM stock_prices_history 
                 WHERE symbol = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                 ORDER BY recorded_at DESC`,
                [symbol, hours]
            )
            return rows as any[]

        } catch (error) {
            console.error(`❌ Failed to get price history for ${symbol}:`, error)
            throw error
        }
    }

    public async getEarliestStockPrice(symbol: string): Promise<{ price: number, recorded_at: Date } | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                `SELECT price, recorded_at FROM stock_prices_history 
                 WHERE symbol = ? 
                 ORDER BY recorded_at ASC 
                 LIMIT 1`,
                [symbol]
            )
            const result = rows as any[]
            return result.length > 0 ? result[0] : null

        } catch (error) {
            console.error(`❌ Failed to get earliest price for ${symbol}:`, error)
            throw error
        }
    }

    public async getLatestStockPrice(symbol: string): Promise<{ price: number, recorded_at: Date } | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                `SELECT price, recorded_at FROM stock_prices_history 
                 WHERE symbol = ? 
                 ORDER BY recorded_at DESC 
                 LIMIT 1`,
                [symbol]
            )
            const result = rows as any[]
            return result.length > 0 ? result[0] : null

        } catch (error) {
            console.error(`❌ Failed to get latest price for ${symbol}:`, error)
            throw error
        }
    }

    public async getConnection() {
        if (!this.pool) throw new Error('Database not initialized')
        return await this.pool.getConnection()
    }

    // User Settings methods (color scheme preferences)
    public async getUserSettings(userId: number): Promise<UserPreferences | null> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM user_preferences WHERE user_id = ?',
                [userId]
            )
            const result = rows as UserPreferences[]
            
            // If no preferences exist, create default ones
            if (result.length === 0) {
                await this.pool.execute(
                    'INSERT INTO user_preferences (user_id, color_scheme) VALUES (?, ?)',
                    [userId, 'standard']
                )
                return {
                    user_id: userId,
                    color_scheme: 'standard'
                }
            }
            
            return result[0]

        } catch (error) {
            console.error(`❌ Failed to get user settings for user ${userId}:`, error)
            throw error
        }
    }

    public async updateUserSettings(userId: number, preferences: Partial<UserPreferences>): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const updates: string[] = []
            const values: any[] = []

            if (preferences.color_scheme !== undefined) {
                updates.push('color_scheme = ?')
                values.push(preferences.color_scheme)
            }

            if (updates.length === 0) {
                return
            }

            values.push(userId)

            await this.pool.execute(
                `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`,
                values
            )

            console.log(`✅ Updated settings for user ${userId}`)

        } catch (error) {
            console.error(`❌ Failed to update user settings for user ${userId}:`, error)
            throw error
        }
    }

    public async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end()
            console.log('🗄️  Database connection closed')
        }
    }

    public isConnected(): boolean {
        return this.pool !== null
    }
}

export const databaseService = new DatabaseService()