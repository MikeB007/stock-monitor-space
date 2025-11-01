import * as cron from 'node-cron'
import { StockQuote } from './dataProviders/BaseDataProvider'
import { dataProviderManager } from './dataProviders/DataProviderManager'
import { databaseService } from './databaseService'

export interface StockData {
    symbol: string
    name: string
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap: string
    lastUpdate: string
    // Additional fields from new provider system
    previousClose?: number
    dayHigh?: number
    dayLow?: number
    yearHigh?: number
    yearLow?: number
    provider?: string // Which provider supplied this data

    // Extended hours data
    preMarketPrice?: number
    preMarketChange?: number
    preMarketChangePercent?: number
    preMarketTime?: string

    postMarketPrice?: number
    postMarketChange?: number
    postMarketChangePercent?: number
    postMarketTime?: string

    marketState?: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'
    hasPrePostMarketData?: boolean
}

class EnhancedStockPriceService {
    private stockDatabase: Record<string, StockData> = {}
    private updateCallback?: (stockData: StockData) => void
    private equityUpdateCallback?: (stockData: StockData) => void
    private btcInitialPrice: number = 114012.00
    private subscribedEquities: Set<string> = new Set()
    private useRealPrices: boolean = true
    private equityUpdateJob: any = null
    private priceUpdateJob: any = null
    private bitcoinJob: any = null

    // Performance tracking
    private totalRequests: number = 0
    private successfulRequests: number = 0
    private failedRequests: number = 0
    private lastProviderUsed: string = ''

    constructor() {
        this.initializeSampleStocks()
        this.initializeBitcoinPrice()
    }

    public setRealPricesMode(enabled: boolean) {
        this.useRealPrices = enabled
        console.log(`💰 Enhanced price mode changed to: ${enabled ? 'REAL MULTI-PROVIDER PRICES' : 'SIMULATED PRICES'}`)

        // Restart all update services with new mode
        this.restartAllServices()
    }

    public isUsingRealPrices(): boolean {
        return this.useRealPrices
    }

    private async initializeBitcoinPrice() {
        if (this.useRealPrices) {
            try {
                // Try to get Bitcoin data from our providers (if they support crypto)
                const btcQuote = await dataProviderManager.fetchQuote({ symbol: 'BTC-USD', allowFallback: true })
                if (btcQuote) {
                    this.stockDatabase['BTC'] = this.convertQuoteToStockData(btcQuote, 'Multi-Provider')
                    this.btcInitialPrice = btcQuote.price
                    console.log(`✅ Bitcoin initialized from provider: $${btcQuote.price.toFixed(2)}`)
                    return
                }
            } catch (error) {
                console.warn('Bitcoin provider initialization failed, using fallback:', error)
            }
        }

        // Fallback to simulated Bitcoin
        this.initializeFallbackBitcoin()
    }

    private initializeFallbackBitcoin() {
        const price = this.generateRandomPrice(this.btcInitialPrice)
        const change = price - this.btcInitialPrice
        const changePercent = (change / this.btcInitialPrice) * 100

        this.stockDatabase['BTC'] = {
            symbol: 'BTC',
            name: 'Bitcoin',
            price,
            change,
            changePercent,
            volume: this.generateRandomVolume(),
            marketCap: `$${(price * 19.7 / 1e12).toFixed(2)}T`, // Rough calculation
            lastUpdate: new Date().toISOString(),
            provider: 'Simulated'
        }
    }

    private initializeSampleStocks() {
        const sampleStocks = [
            // Core holdings
            { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 175.00, marketCap: '$2.7T' },
            { symbol: 'SMR', name: 'NuScale Power Corp', basePrice: 14.25, marketCap: '$3.8B' },
            { symbol: 'IONX', name: 'Ioneer Ltd', basePrice: 0.89, marketCap: '$142M' },
            { symbol: 'IBM', name: 'International Business Machines', basePrice: 230.50, marketCap: '$213B' },

            // Tech Giants
            { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 2430.00, marketCap: '$1.6T' },
            { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 378.00, marketCap: '$2.8T' },
            { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 142.00, marketCap: '$1.5T' },
            { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 235.00, marketCap: '$750B' },
            { symbol: 'META', name: 'Meta Platforms Inc.', basePrice: 325.00, marketCap: '$830B' },
            { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 485.00, marketCap: '$1.2T' },

            // Finance
            { symbol: 'JPM', name: 'JPMorgan Chase', basePrice: 165.00, marketCap: '$485B' },
            { symbol: 'BAC', name: 'Bank of America', basePrice: 32.50, marketCap: '$265B' },
            { symbol: 'WFC', name: 'Wells Fargo', basePrice: 45.25, marketCap: '$175B' },
            { symbol: 'GS', name: 'Goldman Sachs', basePrice: 425.00, marketCap: '$145B' },
            { symbol: 'C', name: 'Citigroup Inc.', basePrice: 51.20, marketCap: '$95B' }
        ]

        // Initialize with simulated data first
        sampleStocks.forEach(stock => {
            const price = this.generateRandomPrice(stock.basePrice)
            const change = price - stock.basePrice
            const changePercent = (change / stock.basePrice) * 100

            this.stockDatabase[stock.symbol] = {
                symbol: stock.symbol,
                name: stock.name,
                price,
                change,
                changePercent,
                volume: this.generateRandomVolume(),
                marketCap: stock.marketCap,
                lastUpdate: new Date().toISOString(),
                provider: 'Simulated'
            }
        })

        // If using real prices, update with provider data
        if (this.useRealPrices) {
            this.updateSampleStocksWithRealData()
        }
    }

    private async updateSampleStocksWithRealData() {
        const symbols = Object.keys(this.stockDatabase).filter(s => s !== 'BTC')

        try {
            console.log(`📊 Fetching real data for ${symbols.length} stocks from providers...`)

            // Use batch request for efficiency
            const quotes = await dataProviderManager.fetchMultipleQuotes({
                symbols: symbols,
                allowFallback: true,
                maxConcurrency: 10
            })

            let updatedCount = 0
            for (const [symbol, quote] of quotes) {
                if (this.stockDatabase[symbol]) {
                    this.stockDatabase[symbol] = this.convertQuoteToStockData(quote, 'Yahoo Finance')
                    updatedCount++
                }
            }

            console.log(`✅ Updated ${updatedCount}/${symbols.length} stocks with real provider data`)
            this.successfulRequests += updatedCount
            this.totalRequests += symbols.length

        } catch (error) {
            console.error('Failed to update sample stocks with real data:', error)
            this.failedRequests += symbols.length
        }
    }

    private convertQuoteToStockData(quote: StockQuote, providerName: string): StockData {
        let symbol = quote.symbol

        // Convert BTC-USD to BTC for frontend compatibility
        if (symbol === 'BTC-USD') {
            symbol = 'BTC'
        }

        const stockData = {
            symbol: symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
            lastUpdate: quote.lastUpdate,
            previousClose: quote.previousClose,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            yearHigh: quote.yearHigh,
            yearLow: quote.yearLow,
            provider: providerName,

            // Extended hours data
            preMarketPrice: quote.preMarketPrice,
            preMarketChange: quote.preMarketChange,
            preMarketChangePercent: quote.preMarketChangePercent,
            preMarketTime: quote.preMarketTime,

            postMarketPrice: quote.postMarketPrice,
            postMarketChange: quote.postMarketChange,
            postMarketChangePercent: quote.postMarketChangePercent,
            postMarketTime: quote.postMarketTime,

            marketState: quote.marketState,
            hasPrePostMarketData: quote.hasPrePostMarketData
        }

        // Record to database asynchronously
        this.recordPriceToDatabase(stockData)

        return stockData
    }

    private async recordPriceToDatabase(stockData: StockData) {
        try {
            // Only record real price data, not simulated
            if (stockData.provider && !stockData.provider.includes('Simulated')) {
                await databaseService.recordStockPrice(stockData)
            }
        } catch (error) {
            console.error(`Failed to record price for ${stockData.symbol}:`, error)
        }
    }

    private generateRandomPrice(basePrice: number): number {
        const changePercent = (Math.random() - 0.5) * 6
        const change = basePrice * (changePercent / 100)
        return Math.max(0.01, basePrice + change)
    }

    private generateRandomVolume(): number {
        return Math.floor(Math.random() * 50000000) + 1000000
    }

    private updateStockPrice(symbol: string) {
        const stock = this.stockDatabase[symbol]
        if (!stock) return

        // Skip Bitcoin and stocks that should use real data
        if (symbol === 'BTC' || (this.useRealPrices && this.subscribedEquities.has(symbol))) {
            return
        }

        // Get current price as new base for realistic movement
        const currentPrice = stock.price
        const changePercent = (Math.random() - 0.5) * 2
        const newPrice = Math.max(0.01, currentPrice * (1 + changePercent / 100))

        // Calculate change from original base price
        const originalPrice = this.getOriginalPrice(symbol)
        const totalChange = newPrice - originalPrice
        const totalChangePercent = (totalChange / originalPrice) * 100

        this.stockDatabase[symbol] = {
            ...stock,
            price: newPrice,
            change: totalChange,
            changePercent: totalChangePercent,
            volume: this.generateRandomVolume(),
            lastUpdate: new Date().toISOString(),
            provider: 'Simulated'
        }

        // Broadcast update
        if (this.updateCallback) {
            this.updateCallback(this.stockDatabase[symbol])
        }
    }

    private getOriginalPrice(symbol: string): number {
        const basePrices: Record<string, number> = {
            'AAPL': 175.00, 'SMR': 14.25, 'IONX': 0.89, 'IBM': 230.50,
            'GOOGL': 2430.00, 'MSFT': 378.00, 'AMZN': 142.00, 'TSLA': 235.00,
            'META': 325.00, 'NVDA': 485.00, 'BTC': 114012.00,
            'JPM': 165.00, 'BAC': 32.50, 'WFC': 45.25, 'GS': 425.00, 'C': 51.20
        }
        return basePrices[symbol] || 100
    }

    public startPriceUpdates(callback: (stockData: StockData) => void) {
        this.updateCallback = callback

        // Send initial data
        Object.values(this.stockDatabase).forEach(stock => {
            callback(stock)
        })

        if (this.useRealPrices) {
            // Real price mode: Update sample stocks every 30 seconds
            this.priceUpdateJob = cron.schedule('*/30 * * * * *', async () => {
                const sampleSymbols = Object.keys(this.stockDatabase).filter(
                    symbol => symbol !== 'BTC' && !this.subscribedEquities.has(symbol)
                )

                if (sampleSymbols.length > 0) {
                    // Update 3-5 random stocks each cycle
                    const numUpdates = Math.floor(Math.random() * 3) + 3
                    const symbolsToUpdate = sampleSymbols
                        .sort(() => Math.random() - 0.5)
                        .slice(0, numUpdates)

                    try {
                        const quotes = await dataProviderManager.fetchMultipleQuotes({
                            symbols: symbolsToUpdate,
                            allowFallback: true
                        })

                        for (const [symbol, quote] of quotes) {
                            if (this.stockDatabase[symbol]) {
                                this.stockDatabase[symbol] = this.convertQuoteToStockData(quote, 'Provider Update')
                                this.updateCallback?.(this.stockDatabase[symbol])
                                this.successfulRequests++
                            }
                        }

                        this.totalRequests += symbolsToUpdate.length
                        if (quotes.size > 0) {
                            this.lastProviderUsed = 'Multi-Provider'
                        }

                    } catch (error) {
                        console.warn('Real price update failed, using simulated:', error)
                        symbolsToUpdate.forEach(symbol => this.updateStockPrice(symbol))
                        this.failedRequests += symbolsToUpdate.length
                    }
                }
            })

            console.log('📈 Enhanced stock price service started - Real-time multi-provider updates every 30 seconds')
        } else {
            // Simulated mode: Update every 5 seconds
            this.priceUpdateJob = cron.schedule('*/5 * * * * *', () => {
                const symbols = Object.keys(this.stockDatabase).filter(symbol => symbol !== 'BTC')
                const numUpdates = Math.floor(Math.random() * 3) + 1
                const symbolsToUpdate = symbols
                    .sort(() => Math.random() - 0.5)
                    .slice(0, numUpdates)

                symbolsToUpdate.forEach(symbol => {
                    this.updateStockPrice(symbol)
                })
            })

            console.log('📈 Enhanced stock price service started - Simulated price updates every 5 seconds')
        }

        // Bitcoin updates (always try real data first, fallback to simulated)
        this.bitcoinJob = cron.schedule('*/10 * * * * *', async () => {
            try {
                const btcQuote = await dataProviderManager.fetchQuote({
                    symbol: 'BTC-USD',
                    allowFallback: true,
                    preferredProvider: 'Yahoo Finance'
                })

                if (btcQuote) {
                    this.stockDatabase['BTC'] = this.convertQuoteToStockData(btcQuote, 'Yahoo Finance')
                    console.log(`₿ Bitcoin updated from provider: $${btcQuote.price.toFixed(2)}`)
                    console.log(`📡 Broadcasting Bitcoin via WebSocket:`, this.stockDatabase['BTC'])
                    this.updateCallback?.(this.stockDatabase['BTC'])
                } else {
                    throw new Error('No provider data available')
                }
            } catch (error) {
                // Fallback to simulated Bitcoin update
                this.updateStockPrice('BTC')
            }
        })
    }

    public async subscribeToEquities(symbols: string[], callback: (stockData: StockData) => void) {
        this.equityUpdateCallback = callback

        console.log(`📊 Subscribing to real-time equities: ${symbols.join(', ')}`)

        // Add symbols to subscription list
        for (const symbol of symbols) {
            const upperSymbol = symbol.toUpperCase()
            this.subscribedEquities.add(upperSymbol)

            // Initialize with real data if possible
            await this.initializeEquityWithProviderData(upperSymbol)

            // Send initial data
            if (this.stockDatabase[upperSymbol]) {
                callback(this.stockDatabase[upperSymbol])
            }
        }

        this.totalRequests += symbols.length
        console.log(`✅ Subscribed to ${symbols.length} equities with enhanced multi-provider data`)
    }

    private async initializeEquityWithProviderData(symbol: string) {
        try {
            if (this.useRealPrices) {
                const quote = await dataProviderManager.fetchQuote({
                    symbol: symbol,
                    allowFallback: true,
                    preferredProvider: 'Yahoo Finance'
                })

                if (quote) {
                    this.stockDatabase[symbol] = this.convertQuoteToStockData(quote, 'Yahoo Finance')
                    console.log(`✅ Initialized ${symbol} with provider data: ${quote.name} at $${quote.price.toFixed(2)}`)
                    this.successfulRequests++
                    return
                }
            }
        } catch (error) {
            console.warn(`⚠️ Failed to initialize ${symbol} with provider data:`, error)
            this.failedRequests++
        }

        // Fallback to simulated data
        await this.initializeEquityFallback(symbol)
    }

    private async initializeEquityFallback(symbol: string) {
        // Use existing fallback logic or create basic entry
        const price = this.generateRandomPrice(100) // Default base price
        this.stockDatabase[symbol] = {
            symbol: symbol,
            name: `${symbol} Corporation`,
            price: price,
            change: 0,
            changePercent: 0,
            volume: this.generateRandomVolume(),
            marketCap: 'N/A',
            lastUpdate: new Date().toISOString(),
            provider: 'Simulated'
        }

        console.log(`⚠️ Initialized ${symbol} with simulated data at $${price.toFixed(2)}`)
    }

    public unsubscribeFromEquities(symbols: string[]) {
        symbols.forEach(symbol => {
            this.subscribedEquities.delete(symbol.toUpperCase())
        })
        console.log(`📊 Unsubscribed from equities: ${symbols.join(', ')}`)
    }

    public getSubscribedEquities(): string[] {
        return Array.from(this.subscribedEquities)
    }

    public startEquityUpdates() {
        this.stopEquityUpdates()

        if (this.useRealPrices) {
            // Update subscribed equities every 10 seconds with real provider data
            this.equityUpdateJob = cron.schedule('*/10 * * * * *', async () => {
                if (this.subscribedEquities.size === 0) return

                const symbols = Array.from(this.subscribedEquities)

                try {
                    const quotes = await dataProviderManager.fetchMultipleQuotes({
                        symbols: symbols,
                        allowFallback: true,
                        preferredProvider: 'Yahoo Finance'
                    })

                    for (const [symbol, quote] of quotes) {
                        if (this.subscribedEquities.has(symbol)) {
                            this.stockDatabase[symbol] = this.convertQuoteToStockData(quote, 'Yahoo Finance')

                            console.log(`📈 Real equity update: ${symbol} at $${quote.price.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`)

                            // Send update
                            if (this.equityUpdateCallback) {
                                this.equityUpdateCallback(this.stockDatabase[symbol])
                            }

                            this.successfulRequests++
                        }
                    }

                    this.totalRequests += symbols.length
                    this.lastProviderUsed = 'Yahoo Finance'

                } catch (error) {
                    console.warn('Real equity update failed, using simulated data:', error)
                    symbols.forEach(symbol => {
                        this.updateStockPrice(symbol)
                        if (this.equityUpdateCallback && this.stockDatabase[symbol]) {
                            this.equityUpdateCallback(this.stockDatabase[symbol])
                        }
                    })
                    this.failedRequests += symbols.length
                }
            })

            console.log('📊 Enhanced equity update service started - 10-second intervals with REAL multi-provider data')
        } else {
            // Simulated mode: Update every second
            this.equityUpdateJob = cron.schedule('* * * * * *', () => {
                if (this.subscribedEquities.size === 0) return

                this.subscribedEquities.forEach(symbol => {
                    this.updateStockPrice(symbol)
                    if (this.equityUpdateCallback && this.stockDatabase[symbol]) {
                        this.equityUpdateCallback(this.stockDatabase[symbol])
                    }
                })
            })

            console.log('📊 Enhanced equity update service started - 1-second intervals with SIMULATED data')
        }
    }

    private stopEquityUpdates() {
        if (this.equityUpdateJob) {
            this.equityUpdateJob.stop()
            this.equityUpdateJob = null
        }
    }

    private restartAllServices() {
        console.log('🔄 Restarting all enhanced price services with new mode...')

        // Stop all jobs
        if (this.priceUpdateJob) {
            this.priceUpdateJob.stop()
            this.priceUpdateJob = null
        }
        if (this.bitcoinJob) {
            this.bitcoinJob.stop()
            this.bitcoinJob = null
        }

        this.stopEquityUpdates()

        // Restart with current callbacks if they exist
        if (this.updateCallback) {
            this.startPriceUpdates(this.updateCallback)
        }
        this.startEquityUpdates()
    }

    // New methods for provider management
    public async validateSymbol(symbol: string): Promise<{ valid: boolean, name?: string, price?: number, provider?: string }> {
        try {
            this.totalRequests++

            const quote = await dataProviderManager.fetchQuote({
                symbol: symbol,
                allowFallback: true,
                preferredProvider: 'Yahoo Finance'
            })

            if (quote) {
                this.successfulRequests++
                return {
                    valid: true,
                    name: quote.name,
                    price: quote.price,
                    provider: 'Yahoo Finance'
                }
            } else {
                this.failedRequests++
                return { valid: false }
            }
        } catch (error) {
            this.failedRequests++
            console.error(`Symbol validation failed for ${symbol}:`, error)
            return { valid: false }
        }
    }

    public async searchSymbols(query: string): Promise<Array<{ symbol: string, name: string }>> {
        try {
            return await dataProviderManager.searchSymbols(query, 'Yahoo Finance')
        } catch (error) {
            console.error(`Symbol search failed for "${query}":`, error)
            return []
        }
    }

    public getProviderStats() {
        const providerStatus = dataProviderManager.getProviderStatus()
        const stats = {
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            successRate: this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests * 100).toFixed(1) : '0',
            lastProviderUsed: this.lastProviderUsed,
            providers: Object.fromEntries(providerStatus)
        }

        return stats
    }

    public getStock(symbol: string): StockData | null {
        return this.stockDatabase[symbol] || null
    }

    public getAllStocks(): StockData[] {
        return Object.values(this.stockDatabase)
    }

    // Method to force refresh a specific stock
    public async refreshStock(symbol: string): Promise<StockData | null> {
        try {
            const quote = await dataProviderManager.fetchQuote({
                symbol: symbol,
                allowFallback: true
            })

            if (quote) {
                this.stockDatabase[symbol] = this.convertQuoteToStockData(quote, 'Manual Refresh')
                console.log(`🔄 Manually refreshed ${symbol}: $${quote.price.toFixed(2)}`)
                return this.stockDatabase[symbol]
            }
        } catch (error) {
            console.error(`Failed to refresh ${symbol}:`, error)
        }

        return null
    }

    public shutdown() {
        console.log('🛑 Shutting down enhanced stock price service...')

        if (this.priceUpdateJob) {
            this.priceUpdateJob.stop()
        }
        if (this.bitcoinJob) {
            this.bitcoinJob.stop()
        }
        this.stopEquityUpdates()

        dataProviderManager.shutdown()
    }
}

export const enhancedStockPriceService = new EnhancedStockPriceService()

// Legacy export for compatibility
export const stockPriceService = enhancedStockPriceService