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

export default router