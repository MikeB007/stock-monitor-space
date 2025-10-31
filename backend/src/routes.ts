import express from 'express'
import { enhancedStockPriceService as stockPriceService } from './services/enhancedStockPriceService'

export function setupRoutes(app: express.Application) {
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      message: 'Stock Monitor Backend is running',
      timestamp: new Date().toISOString()
    })
  })

  // Get all stocks
  app.get('/api/stocks', (req, res) => {
    try {
      const stocks = stockPriceService.getAllStocks()
      res.json({
        success: true,
        data: stocks,
        count: stocks.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stocks'
      })
    }
  })

  // Get specific stock
  app.get('/api/stocks/:symbol', (req, res) => {
    try {
      const { symbol } = req.params
      const stock = stockPriceService.getStock(symbol.toUpperCase())

      if (!stock) {
        return res.status(404).json({
          success: false,
          error: `Stock ${symbol} not found`
        })
      }

      return res.json({
        success: true,
        data: stock
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stock'
      })
    }
  })

  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Stock Monitor API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        allStocks: '/api/stocks',
        singleStock: '/api/stocks/:symbol'
      },
      websocket: {
        url: 'ws://localhost:4000',
        events: {
          connect: 'connection established',
          stockUpdate: 'real-time stock price updates'
        }
      }
    })
  })
}