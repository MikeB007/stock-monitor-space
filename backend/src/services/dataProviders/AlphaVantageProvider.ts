import axios from 'axios'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class AlphaVantageProvider extends BaseDataProvider {
    private lastRequestTime: number = 0
    private requestsThisMinute: number = 0
    private minuteResetTime: number = 0

    constructor(apiKey: string) {
        super({
            name: 'Alpha Vantage',
            priority: 2, // Second priority after Yahoo Finance
            apiKey: apiKey,
            baseUrl: 'https://www.alphavantage.co/query',
            timeout: 10000, // Longer timeout for Alpha Vantage
            rateLimitDelay: 12000, // 5 requests per minute = 12 seconds between requests
            maxRetries: 2
        })
    }

    private checkRateLimit(): boolean {
        const now = Date.now()

        // Reset counter every minute
        if (now > this.minuteResetTime) {
            this.requestsThisMinute = 0
            this.minuteResetTime = now + 60000 // Next minute
        }

        // Alpha Vantage free tier: 5 requests per minute
        return this.requestsThisMinute < 5
    }

    async fetchQuote(symbol: string): Promise<StockQuote | null> {
        this.trackRequest()

        if (!this.apiKey || this.apiKey === 'demo') {
            console.warn('Alpha Vantage: No valid API key provided')
            return null
        }

        if (!this.checkRateLimit()) {
            console.warn('Alpha Vantage: Rate limit exceeded (5 requests per minute)')
            return null
        }

        try {
            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()
            this.requestsThisMinute++

            // Try Global Quote first (real-time data)
            const response = await axios.get(this.baseUrl, {
                params: {
                    function: 'GLOBAL_QUOTE',
                    symbol: symbol.toUpperCase(),
                    apikey: this.apiKey
                },
                timeout: this.timeout
            })

            const globalQuote = response.data['Global Quote']

            if (!globalQuote || !globalQuote['05. price']) {
                // If Global Quote fails, try Time Series Daily
                return await this.fetchFromTimeSeries(symbol)
            }

            const currentPrice = parseFloat(globalQuote['05. price'])
            const previousClose = parseFloat(globalQuote['08. previous close'])
            const change = parseFloat(globalQuote['09. change'])
            const changePercent = parseFloat(globalQuote['10. change percent'].replace('%', ''))
            const volume = parseInt(globalQuote['06. volume']) || 0

            if (!this.isValidPrice(currentPrice)) {
                console.warn(`Alpha Vantage: Invalid price data for ${symbol}`)
                return null
            }

            const quote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: `${symbol.toUpperCase()} Corporation`, // Alpha Vantage doesn't provide company names in Global Quote
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: volume,
                marketCap: 'N/A', // Not available in Global Quote
                previousClose: Number(previousClose.toFixed(2)),
                dayHigh: Number((parseFloat(globalQuote['03. high']) || currentPrice).toFixed(2)),
                dayLow: Number((parseFloat(globalQuote['04. low']) || currentPrice).toFixed(2)),
                yearHigh: Number((parseFloat(globalQuote['03. high']) || currentPrice).toFixed(2)), // Alpha Vantage doesn't provide 52-week data in Global Quote
                yearLow: Number((parseFloat(globalQuote['04. low']) || currentPrice).toFixed(2)),
                lastUpdate: new Date().toISOString()
            }

            this.trackSuccess()
            console.log(`✅ Alpha Vantage: Fetched ${symbol} at $${currentPrice.toFixed(2)} (${changePercent.toFixed(2)}%)`)

            return quote

        } catch (error) {
            this.trackError(error)

            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    console.warn(`Alpha Vantage: Rate limited for ${symbol}`)
                    // Reset rate limit tracking
                    this.requestsThisMinute = 5 // Max out for this minute
                } else {
                    console.error(`Alpha Vantage: HTTP ${error.response?.status} for ${symbol}:`, error.message)
                }
            } else {
                console.error(`Alpha Vantage: Error for ${symbol}:`, error)
            }

            return null
        }
    }

    private async fetchFromTimeSeries(symbol: string): Promise<StockQuote | null> {
        try {
            if (!this.checkRateLimit()) {
                return null
            }

            await this.delay(this.rateLimitDelay)
            this.requestsThisMinute++

            const response = await axios.get(this.baseUrl, {
                params: {
                    function: 'TIME_SERIES_DAILY',
                    symbol: symbol.toUpperCase(),
                    apikey: this.apiKey,
                    outputsize: 'compact'
                },
                timeout: this.timeout
            })

            const timeSeries = response.data['Time Series (Daily)']

            if (!timeSeries) {
                console.warn(`Alpha Vantage: No time series data for ${symbol}`)
                return null
            }

            // Get the most recent trading day
            const dates = Object.keys(timeSeries).sort().reverse()
            if (dates.length < 2) {
                return null
            }

            const todayData = timeSeries[dates[0]]
            const yesterdayData = timeSeries[dates[1]]

            const currentPrice = parseFloat(todayData['4. close'])
            const previousClose = parseFloat(yesterdayData['4. close'])
            const change = currentPrice - previousClose
            const changePercent = (change / previousClose) * 100
            const volume = parseInt(todayData['5. volume']) || 0

            if (!this.isValidPrice(currentPrice)) {
                return null
            }

            const quote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: `${symbol.toUpperCase()} Corporation`,
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: volume,
                marketCap: 'N/A',
                previousClose: Number(previousClose.toFixed(2)),
                dayHigh: Number((parseFloat(todayData['2. high']) || currentPrice).toFixed(2)),
                dayLow: Number((parseFloat(todayData['3. low']) || currentPrice).toFixed(2)),
                yearHigh: Number(currentPrice.toFixed(2)), // Would need separate API call for 52-week data
                yearLow: Number(currentPrice.toFixed(2)),
                lastUpdate: new Date().toISOString()
            }

            console.log(`✅ Alpha Vantage Time Series: Fetched ${symbol} at $${currentPrice.toFixed(2)}`)
            return quote

        } catch (error) {
            console.error(`Alpha Vantage Time Series: Error for ${symbol}:`, error)
            return null
        }
    }

    async validateSymbol(symbol: string): Promise<boolean> {
        try {
            const quote = await this.fetchQuote(symbol)
            return quote !== null
        } catch (error) {
            return false
        }
    }

    async searchSymbols(query: string): Promise<Array<{ symbol: string, name: string }>> {
        this.trackRequest()

        if (!this.apiKey || this.apiKey === 'demo') {
            return []
        }

        if (!this.checkRateLimit()) {
            console.warn('Alpha Vantage: Rate limit exceeded for search')
            return []
        }

        try {
            await this.delay(this.rateLimitDelay)
            this.requestsThisMinute++

            const response = await axios.get(this.baseUrl, {
                params: {
                    function: 'SYMBOL_SEARCH',
                    keywords: query,
                    apikey: this.apiKey
                },
                timeout: this.timeout
            })

            const matches = response.data.bestMatches || []
            const results = matches
                .slice(0, 10)
                .map((match: any) => ({
                    symbol: match['1. symbol'],
                    name: match['2. name']
                }))

            this.trackSuccess()
            console.log(`✅ Alpha Vantage: Found ${results.length} symbols for query "${query}"`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`Alpha Vantage: Search error for "${query}":`, error)
            return []
        }
    }

    // Alpha Vantage doesn't support batch requests, so use default implementation
    async fetchMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
        // For Alpha Vantage, we need to be very careful about rate limits
        // Only process a few symbols at a time to avoid hitting limits
        const results = new Map<string, StockQuote>()
        const maxSymbols = Math.min(symbols.length, 3) // Limit to 3 symbols per batch

        console.log(`📡 Alpha Vantage: Processing ${maxSymbols}/${symbols.length} symbols (rate limit protection)`)

        for (let i = 0; i < maxSymbols; i++) {
            const symbol = symbols[i]
            try {
                const quote = await this.fetchQuote(symbol)
                if (quote) {
                    results.set(symbol, quote)
                }
            } catch (error) {
                console.warn(`Alpha Vantage: Failed to fetch ${symbol}:`, error)
            }
        }

        return results
    }

    public getStatus(): import('./BaseDataProvider').ProviderStatus {
        const baseStatus = super.getStatus()
        return {
            ...baseStatus,
            rateLimitRemaining: Math.max(0, 5 - this.requestsThisMinute),
            nextResetTime: new Date(this.minuteResetTime)
        }
    }
}