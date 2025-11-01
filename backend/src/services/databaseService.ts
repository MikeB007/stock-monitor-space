import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

export interface PortfolioStock {
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

            // Create portfolio_stocks table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS portfolio_stocks (
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
                    INDEX idx_country (country)
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
                    INDEX idx_recorded_at (recorded_at),
                    FOREIGN KEY (symbol) REFERENCES portfolio_stocks(symbol) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            console.log('✅ Database tables created successfully')

        } catch (error) {
            console.error('❌ Failed to create database tables:', error)
            throw error
        }
    }

    public async addPortfolioStock(stock: PortfolioStock): Promise<number> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                `INSERT INTO portfolio_stocks (symbol, description, country, market, exchange, sector, industry) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [stock.symbol, stock.description, stock.country, stock.market, stock.exchange, stock.sector, stock.industry]
            )

            const insertId = (result as any).insertId
            console.log(`📈 Added stock to portfolio: ${stock.symbol} - ${stock.description}`)
            return insertId

        } catch (error) {
            console.error(`❌ Failed to add stock ${stock.symbol} to portfolio:`, error)
            throw error
        }
    }

    public async getPortfolioStocks(): Promise<PortfolioStock[]> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM portfolio_stocks ORDER BY symbol ASC'
            )
            return rows as PortfolioStock[]

        } catch (error) {
            console.error('❌ Failed to get portfolio stocks:', error)
            throw error
        }
    }

    public async removePortfolioStock(symbol: string): Promise<boolean> {
        if (!this.pool) throw new Error('Database not initialized')

        try {
            const [result] = await this.pool.execute(
                'DELETE FROM portfolio_stocks WHERE symbol = ?',
                [symbol]
            )

            const affectedRows = (result as any).affectedRows
            if (affectedRows > 0) {
                console.log(`📉 Removed stock from portfolio: ${symbol}`)
                return true
            }
            return false

        } catch (error) {
            console.error(`❌ Failed to remove stock ${symbol} from portfolio:`, error)
            throw error
        }
    }

    public async updatePortfolioStock(symbol: string, updates: Partial<PortfolioStock>): Promise<boolean> {
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
                `UPDATE portfolio_stocks SET ${setClause} WHERE symbol = ?`,
                [...values, symbol]
            )

            const affectedRows = (result as any).affectedRows
            if (affectedRows > 0) {
                console.log(`📊 Updated stock in portfolio: ${symbol}`)
                return true
            }
            return false

        } catch (error) {
            console.error(`❌ Failed to update stock ${symbol} in portfolio:`, error)
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

    public async getConnection() {
        if (!this.pool) throw new Error('Database not initialized')
        return await this.pool.getConnection()
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