import express from 'express'
import { databaseService, PortfolioStock } from '../services/databaseService'

const router = express.Router()

// GET /api/portfolio - Get all portfolio stocks (optionally filtered by portfolio_id)
router.get('/portfolio', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = req.query.portfolio_id ? parseInt(req.query.portfolio_id as string) : undefined
        const stocks = await databaseService.getPortfolioStocks(portfolioId)

        return res.json({
            success: true,
            data: stocks,
            count: stocks.length,
            portfolio_id: portfolioId
        })

    } catch (error) {
        console.error('Portfolio API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio stocks'
        })
    }
})

// POST /api/portfolio - Add new stock to portfolio
router.post('/portfolio', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { symbol, portfolio_id } = req.body

        // Validate required fields
        if (!symbol || !portfolio_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: symbol, portfolio_id'
            })
        }

        const cleanSymbol = symbol.toUpperCase().trim()

        // Step 1: Validate symbol by fetching from stock data providers
        console.log(`🔍 Validating symbol: ${cleanSymbol}`)

        // Import the enhanced stock price service to validate the symbol
        const { enhancedStockPriceService } = require('../services/enhancedStockPriceService')

        let validationResult
        try {
            // Try to validate the symbol using the enhanced service
            validationResult = await enhancedStockPriceService.validateSymbol(cleanSymbol)

            if (!validationResult.valid) {
                return res.status(404).json({
                    success: false,
                    error: `Invalid stock symbol: ${cleanSymbol}. Symbol not found in market data.`
                })
            }

            console.log(`✅ Symbol ${cleanSymbol} validated successfully`)
        } catch (error) {
            console.error(`❌ Symbol validation failed for ${cleanSymbol}:`, error)
            return res.status(404).json({
                success: false,
                error: `Invalid stock symbol: ${cleanSymbol}. Unable to fetch market data.`
            })
        }

        // Step 2: Fetch company profile (sector/industry) from Yahoo Finance/Alpha Vantage
        let sector = 'N/A'
        let industry = 'N/A'
        
        try {
            console.log(`🏢 Fetching company profile for ${cleanSymbol}...`)
            const { dataProviderManager } = require('../services/dataProviders/DataProviderManager')
            const profile = await dataProviderManager.fetchCompanyProfile(cleanSymbol)
            if (profile) {
                sector = profile.sector || 'N/A'
                industry = profile.industry || 'N/A'
                console.log(`✅ Got sector/industry: ${sector} / ${industry}`)
            } else {
                console.log(`⚠️ No profile data available for ${cleanSymbol}`)
            }
        } catch (error) {
            console.warn(`⚠️ Failed to fetch company profile for ${cleanSymbol}:`, error)
            // Continue with N/A values
        }

        // Step 3: Extract stock metadata from the validated data
        // Only set known values, use 'N/A' for unknown data that needs to be researched
        const isCanadianStock = cleanSymbol === 'TD' || cleanSymbol.includes('.TO')

        const newStock: PortfolioStock = {
            portfolio_id: parseInt(portfolio_id),
            symbol: cleanSymbol,
            description: validationResult.name || `${cleanSymbol} Stock`,
            // Only set country if we can definitively determine it
            country: isCanadianStock ? 'Canada' : 'N/A',
            // Market should represent the geographic region - use N/A if unknown
            market: isCanadianStock ? 'Canada' : 'N/A',
            // Exchange should be the specific trading venue - use N/A if unknown  
            exchange: isCanadianStock ? 'TSX' : 'N/A',
            // Use fetched sector/industry from Alpha Vantage
            sector: sector,
            industry: industry
        }

        console.log(`📊 Prepared stock data for ${cleanSymbol} in portfolio ${portfolio_id}:`, newStock)

        // Step 4: Add to database
        const insertId = await databaseService.addPortfolioStock(newStock)

        console.log(`✅ Added ${cleanSymbol} to portfolio database with ID: ${insertId}`)

        return res.status(201).json({
            success: true,
            message: `Stock ${newStock.symbol} validated and added to portfolio`,
            data: { ...newStock, id: insertId }
        })

    } catch (error) {
        console.error('Add portfolio stock error:', error)

        const errorMessage = (error as Error).message
        if (errorMessage.includes('Duplicate entry')) {
            return res.status(409).json({
                success: false,
                error: `Stock ${req.body.symbol} already exists in this portfolio`
            })
        }
        if (errorMessage.includes('foreign key constraint') || errorMessage.includes('Cannot add or update a child row')) {
            return res.status(404).json({
                success: false,
                error: `Portfolio ${req.body.portfolio_id} does not exist`
            })
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to add stock to portfolio'
        })
    }
})

// PUT /api/portfolio/:portfolioId/:symbol - Update stock in portfolio
router.put('/portfolio/:portfolioId/:symbol', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { portfolioId, symbol } = req.params
        const updates = req.body

        // Remove symbol and portfolio_id from updates to prevent modification
        delete updates.symbol
        delete updates.id
        delete updates.portfolio_id

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields provided for update'
            })
        }

        const updated = await databaseService.updatePortfolioStock(parseInt(portfolioId), symbol.toUpperCase(), updates)

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: `Stock ${symbol} not found in portfolio ${portfolioId}`
            })
        }

        return res.json({
            success: true,
            message: `Stock ${symbol} updated successfully`
        })

    } catch (error) {
        console.error('Update portfolio stock error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to update stock in portfolio'
        })
    }
})

// DELETE /api/portfolio/:portfolioId/:symbol - Remove stock from portfolio
router.delete('/portfolio/:portfolioId/:symbol', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { portfolioId, symbol } = req.params
        const removed = await databaseService.removePortfolioStock(parseInt(portfolioId), symbol.toUpperCase())

        if (!removed) {
            return res.status(404).json({
                success: false,
                error: `Stock ${symbol} not found in portfolio ${portfolioId}`
            })
        }

        return res.json({
            success: true,
            message: `Stock ${symbol} removed from portfolio ${portfolioId}`
        })

    } catch (error) {
        console.error('Remove portfolio stock error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to remove stock from portfolio'
        })
    }
})

// GET /api/portfolio/:symbol/history - Get price history for a stock
router.get('/portfolio/:symbol/history', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { symbol } = req.params
        const hours = parseInt(req.query.hours as string) || 24

        const history = await databaseService.getStockPriceHistory(symbol.toUpperCase(), hours)

        return res.json({
            success: true,
            data: history,
            count: history.length,
            symbol: symbol.toUpperCase(),
            hours: hours
        })

    } catch (error) {
        console.error('Get price history error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to get price history'
        })
    }
})

// GET /api/portfolio/stats - Get portfolio statistics
router.get('/portfolio/stats', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = req.query.portfolio_id ? parseInt(req.query.portfolio_id as string) : undefined
        const stocks = await databaseService.getPortfolioStocks(portfolioId)

        // Group by market and country
        const marketStats = stocks.reduce((acc, stock) => {
            acc[stock.market] = (acc[stock.market] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const countryStats = stocks.reduce((acc, stock) => {
            acc[stock.country] = (acc[stock.country] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const sectorStats = stocks.reduce((acc, stock) => {
            if (stock.sector) {
                acc[stock.sector] = (acc[stock.sector] || 0) + 1
            }
            return acc
        }, {} as Record<string, number>)

        return res.json({
            success: true,
            data: {
                totalStocks: stocks.length,
                markets: marketStats,
                countries: countryStats,
                sectors: sectorStats
            }
        })

    } catch (error) {
        console.error('Get portfolio stats error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to get portfolio statistics'
        })
    }
})

// GET /api/portfolio/performance - Get performance data with % change from earliest recorded price
router.get('/portfolio/performance', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = req.query.portfolio_id ? parseInt(req.query.portfolio_id as string) : undefined
        const stocks = await databaseService.getPortfolioStocks(portfolioId)

        // Calculate performance for each stock
        const performance = await Promise.all(stocks.map(async (stock) => {
            try {
                // Get earliest and latest prices from database
                const earliestPrice = await databaseService.getEarliestStockPrice(stock.symbol)
                const latestPrice = await databaseService.getLatestStockPrice(stock.symbol)

                if (!earliestPrice || !latestPrice) {
                    return {
                        symbol: stock.symbol,
                        currentPrice: null,
                        earliestPrice: null,
                        earliestDate: null,
                        percentChange: null,
                        priceChange: null,
                        hasData: false
                    }
                }

                // Calculate percentage change from earliest to latest
                const priceChange = latestPrice.price - earliestPrice.price
                const percentChange = ((priceChange / earliestPrice.price) * 100)

                return {
                    symbol: stock.symbol,
                    currentPrice: latestPrice.price,
                    earliestPrice: earliestPrice.price,
                    earliestDate: earliestPrice.recorded_at,
                    latestDate: latestPrice.recorded_at,
                    percentChange: percentChange,
                    priceChange: priceChange,
                    hasData: true
                }
            } catch (error) {
                console.error(`Error calculating performance for ${stock.symbol}:`, error)
                return {
                    symbol: stock.symbol,
                    currentPrice: null,
                    earliestPrice: null,
                    earliestDate: null,
                    percentChange: null,
                    priceChange: null,
                    hasData: false
                }
            }
        }))

        return res.json({
            success: true,
            data: performance,
            portfolio_id: portfolioId
        })

    } catch (error) {
        console.error('Get portfolio performance error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to get portfolio performance'
        })
    }
})

// GET /api/portfolio/intervals - Get % change for all time intervals using database
router.get('/portfolio/intervals', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = req.query.portfolio_id ? parseInt(req.query.portfolio_id as string) : undefined
        const stocks = await databaseService.getPortfolioStocks(portfolioId)

        // Time intervals in minutes
        const intervals = [
            { id: '1m', minutes: 1 },
            { id: '5m', minutes: 5 },
            { id: '30m', minutes: 30 },
            { id: '1h', minutes: 60 },
            { id: '3h', minutes: 180 },
            { id: '5h', minutes: 300 },
            { id: '8h', minutes: 480 },
            { id: '1d', minutes: 1440 },
            { id: '3d', minutes: 4320 },
            { id: '5d', minutes: 7200 },
            { id: '8d', minutes: 11520 },
            { id: '13d', minutes: 18720 },
            { id: '1mo', minutes: 43200 },
            { id: '3mo', minutes: 129600 },
            { id: '5mo', minutes: 216000 },
            { id: '8mo', minutes: 345600 },
            { id: '13mo', minutes: 561600 },
            { id: '1y', minutes: 525600 },
            { id: '3y', minutes: 1576800 },
            { id: '5y', minutes: 2628000 }
        ]

        // Calculate intervals for each stock
        const intervalData = await Promise.all(stocks.map(async (stock) => {
            const stockIntervals: any = { symbol: stock.symbol }

            for (const interval of intervals) {
                try {
                    // Get price from X minutes ago
                    const connection = await databaseService.getConnection()
                    const [rows]: any = await connection.execute(
                        `SELECT price, recorded_at 
                         FROM stock_prices_history 
                         WHERE symbol = ? 
                         AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
                         AND recorded_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
                         ORDER BY ABS(TIMESTAMPDIFF(SECOND, recorded_at, DATE_SUB(NOW(), INTERVAL ? MINUTE)))
                         LIMIT 1`,
                        [stock.symbol, interval.minutes + 5, interval.minutes - 5, interval.minutes]
                    )
                    connection.release()

                    // Get latest price
                    const latestPrice = await databaseService.getLatestStockPrice(stock.symbol)

                    if (rows.length > 0 && latestPrice) {
                        const historicalPrice = rows[0].price
                        const priceChange = latestPrice.price - historicalPrice
                        const percentChange = ((priceChange / historicalPrice) * 100)

                        stockIntervals[interval.id] = {
                            percentChange: percentChange,
                            priceChange: priceChange,
                            historicalPrice: historicalPrice,
                            currentPrice: latestPrice.price,
                            hasData: true
                        }
                    } else {
                        stockIntervals[interval.id] = {
                            percentChange: null,
                            priceChange: null,
                            hasData: false
                        }
                    }
                } catch (error) {
                    console.error(`Error calculating ${interval.id} for ${stock.symbol}:`, error)
                    stockIntervals[interval.id] = {
                        percentChange: null,
                        priceChange: null,
                        hasData: false
                    }
                }
            }

            return stockIntervals
        }))

        return res.json({
            success: true,
            data: intervalData,
            portfolio_id: portfolioId
        })

    } catch (error) {
        console.error('Get portfolio intervals error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to get portfolio intervals'
        })
    }
})

export default router