import express from 'express'
import { databaseService, PortfolioStock } from '../services/databaseService'

const router = express.Router()

// GET /api/portfolio - Get all portfolio stocks
router.get('/portfolio', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const stocks = await databaseService.getPortfolioStocks()

        return res.json({
            success: true,
            data: stocks,
            count: stocks.length
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

        const { symbol } = req.body

        // Validate required field
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: symbol'
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

        // Step 2: Extract stock metadata from the validated data
        // Only set known values, use 'N/A' for unknown data that needs to be researched
        const isCanadianStock = cleanSymbol === 'TD' || cleanSymbol.includes('.TO')
        const isTDBankingStock = cleanSymbol === 'TD' || cleanSymbol === 'TD.TO'

        const newStock: PortfolioStock = {
            symbol: cleanSymbol,
            description: validationResult.name || `${cleanSymbol} Stock`,
            // Only set country if we can definitively determine it
            country: isCanadianStock ? 'Canada' : 'N/A',
            // Market should represent the geographic region - use N/A if unknown
            market: isCanadianStock ? 'Canada' : 'N/A',
            // Exchange should be the specific trading venue - use N/A if unknown  
            exchange: isCanadianStock ? 'TSX' : 'N/A',
            // Sector - only set if we know for certain
            sector: isTDBankingStock ? 'Financial Services' : 'N/A',
            // Industry - only set if we know for certain
            industry: isTDBankingStock ? 'Banking' : 'N/A'
        }

        console.log(`📊 Prepared stock data for ${cleanSymbol}:`, newStock)

        // Step 3: Add to database
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
                error: `Stock ${req.body.symbol} already exists in portfolio`
            })
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to add stock to portfolio'
        })
    }
})

// PUT /api/portfolio/:symbol - Update stock in portfolio
router.put('/portfolio/:symbol', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { symbol } = req.params
        const updates = req.body

        // Remove symbol from updates to prevent modification
        delete updates.symbol
        delete updates.id

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields provided for update'
            })
        }

        const updated = await databaseService.updatePortfolioStock(symbol.toUpperCase(), updates)

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: `Stock ${symbol} not found in portfolio`
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

// DELETE /api/portfolio/:symbol - Remove stock from portfolio
router.delete('/portfolio/:symbol', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { symbol } = req.params
        const removed = await databaseService.removePortfolioStock(symbol.toUpperCase())

        if (!removed) {
            return res.status(404).json({
                success: false,
                error: `Stock ${symbol} not found in portfolio`
            })
        }

        return res.json({
            success: true,
            message: `Stock ${symbol} removed from portfolio`
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

        const stocks = await databaseService.getPortfolioStocks()

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