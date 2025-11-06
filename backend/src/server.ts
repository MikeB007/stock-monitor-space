import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { setupRoutes } from './routes'
import ocrRoutes from './routes/ocrRoutes'
import watchlistRoutes from './routes/watchlistRoutes'
import watchlistManagementRoutes from './routes/watchlistManagementRoutes'
import preferencesRoutes from './routes/preferencesRoutes'
import userRoutes from './routes/userRoutes'
import { databaseService } from './services/databaseService'
import { enhancedStockPriceService as stockPriceService } from './services/enhancedStockPriceService'

dotenv.config()

// Configuration
const USE_REAL_PRICES = process.env.USE_REAL_PRICES !== 'false' // Default to true
const PORT = process.env.PORT || 4000
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000']

const app = express()
const server = createServer(app)
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
})

// Middleware
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}))
app.use(express.json())

app.post('/api/validate-symbol', async (req, res) => {
    const { symbol } = req.body

    if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
            valid: false,
            error: 'Symbol is required and must be a string'
        })
    }

    const cleanSymbol = symbol.trim().toUpperCase()

    // Enhanced format validation for international exchanges
    const isValidFormat = /^[A-Z]{1,8}(\.[A-Z]{1,4})?$/.test(cleanSymbol)
    if (!isValidFormat) {
        return res.status(400).json({
            valid: false,
            error: 'Symbol must be 1-8 letters, optionally followed by exchange suffix (e.g., TD.TO, AAPL, BP.L)'
        })
    }

    try {
        // Use enhanced service with multi-provider support
        const validation = await stockPriceService.validateSymbol(cleanSymbol)

        if (validation.valid) {
            return res.json({
                valid: true,
                symbol: cleanSymbol,
                name: validation.name,
                currentPrice: validation.price,
                provider: validation.provider
            })
        } else {
            return res.status(400).json({
                valid: false,
                error: `Symbol '${cleanSymbol}' not found or invalid`
            })
        }
    } catch (error) {
        console.error(`Symbol validation failed for ${cleanSymbol}:`, error)
        return res.status(400).json({
            valid: false,
            error: `Unable to validate symbol '${cleanSymbol}' - symbol may not exist`
        })
    }
})

// Provider health and statistics endpoint
app.get('/api/provider-status', (req, res) => {
    try {
        const stats = stockPriceService.getProviderStats()
        res.json({
            success: true,
            stats: stats,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Provider status error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to get provider status'
        })
    }
})

// Search symbols endpoint
app.get('/api/search-symbols', async (req, res) => {
    const { q } = req.query

    if (!q || typeof q !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Query parameter "q" is required'
        })
    }

    try {
        const results = await stockPriceService.searchSymbols(q)
        return res.json({
            success: true,
            query: q,
            results: results,
            count: results.length
        })
    } catch (error) {
        console.error(`Symbol search failed for "${q}":`, error)
        return res.status(500).json({
            success: false,
            error: 'Symbol search failed'
        })
    }
})

// Refresh specific stock endpoint
app.post('/api/refresh-stock', async (req, res) => {
    const { symbol } = req.body

    if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Symbol is required'
        })
    }

    try {
        const refreshedStock = await stockPriceService.refreshStock(symbol.toUpperCase())

        if (refreshedStock) {
            return res.json({
                success: true,
                stock: refreshedStock
            })
        } else {
            return res.status(404).json({
                success: false,
                error: `Unable to refresh stock data for ${symbol}`
            })
        }
    } catch (error) {
        console.error(`Stock refresh failed for ${symbol}:`, error)
        return res.status(500).json({
            success: false,
            error: 'Stock refresh failed'
        })
    }
})
// Logging middleware to debug routes
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`)
    next()
})

// Basic routes (health, stocks info)
console.log('📋 Registering basic routes (health, stocks)...')
setupRoutes(app)

// OCR routes for image processing
console.log('📋 Registering OCR routes at /api...')
app.use('/api', ocrRoutes)

// User routes
console.log('📋 Registering user routes at /api...')
app.use('/api', userRoutes)

// Watchlist management routes
console.log('📋 Registering watchlist management routes at /api...')
app.use('/api', watchlistManagementRoutes)

// Watchlist routes
console.log('📋 Registering watchlist routes at /api...')
app.use('/api', watchlistRoutes)

// Preferences routes (already includes /api prefix in routes)
console.log('📋 Registering preferences routes...')
app.use(preferencesRoutes)

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    // Track this client's subscribed equities for cleanup on disconnect
    let clientEquities: string[] = []

    socket.emit('connected', { message: 'Connected to Stock Monitor Backend' })

    // Handle equity subscriptions
    socket.on('subscribeEquities', async (data: { symbols: string[] }) => {
        console.log(`Client ${socket.id} subscribing to equities:`, data.symbols)

        // Store client's equities for cleanup later
        clientEquities = data.symbols

        // Subscribe to equities with callback to emit updates to this socket
        stockPriceService.subscribeToEquities(data.symbols, (stockData) => {
            socket.emit('stockUpdate', stockData)
        })
    })

    socket.on('unsubscribeEquities', (data: { symbols: string[] }) => {
        console.log(`Client ${socket.id} unsubscribing from equities:`, data.symbols)
        stockPriceService.unsubscribeFromEquities(data.symbols)

        // Remove from client's tracked equities
        clientEquities = clientEquities.filter(symbol => !data.symbols.includes(symbol))
    })

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)

        // Clean up: unsubscribe all of this client's equities
        if (clientEquities.length > 0) {
            console.log(`🧹 Cleaning up subscriptions for disconnected client: ${clientEquities.join(', ')}`)
            stockPriceService.unsubscribeFromEquities(clientEquities)
            clientEquities = []
        }
    })
})

// Start stock price service with WebSocket broadcasting
stockPriceService.setRealPricesMode(USE_REAL_PRICES)
stockPriceService.startPriceUpdates((stockData) => {
    io.emit('stockUpdate', stockData)
})

// Start equity updates service
stockPriceService.startEquityUpdates()

// Initialize database service
async function initializeDatabase() {
    try {
        await databaseService.initialize()
        console.log('✅ Database initialized successfully')
    } catch (error) {
        console.error('❌ Database initialization failed:', error)
        console.log('⚠️  Server will continue without database features')
    }
}

// Start server with database initialization
async function startServer() {
    await initializeDatabase()

    server.listen(PORT, () => {
        console.log(`🚀 Stock Monitor Backend running on port ${PORT} - NODEMON HOT RELOAD ACTIVE! 🔥`)
        console.log(`📊 WebSocket server ready for real-time updates`)
        console.log(`🔗 Frontend should connect to: http://localhost:${PORT}`)
        console.log(`💰 Enhanced Multi-Provider System: ${USE_REAL_PRICES ? 'REAL PRICES from Yahoo Finance + fallbacks' : 'SIMULATED PRICES'}`)
        console.log(`🗄️  MySQL Watchlist Management: Enabled`)
        if (USE_REAL_PRICES) {
            console.log(`📡 Real-time data with automatic provider fallback`)
            console.log(`🔍 Provider health monitoring enabled`)
            console.log(`📈 Enhanced endpoints: /api/provider-status, /api/search-symbols, /api/refresh-stock`)
            console.log(`💼 Watchlist endpoints: /api/Watchlist (GET, POST, PUT, DELETE)`)
        }
    })
}

startServer().catch(console.error)

