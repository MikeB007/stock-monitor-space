import axios from 'axios'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class FinancialModelingPrepProvider extends BaseDataProvider {
    private lastRequestTime: number = 0
    private requestsToday: number = 0
    private dayResetTime: number = 0

    constructor(apiKey: string) {
        super({
            name: 'Financial Modeling Prep',
            priority: 3, // Third priority
            apiKey: apiKey,
            baseUrl: 'https://financialmodelingprep.com/api/v3',
            timeout: 8000,
            rateLimitDelay: 350, // Conservative rate limiting (roughly 250 requests per day)
            maxRetries: 2
        })
    }

    private checkRateLimit(): boolean {
        const now = Date.now()

        // Reset counter every day
        if (now > this.dayResetTime) {
            this.requestsToday = 0
            this.dayResetTime = now + 86400000 // Next day (24 hours)
        }

        // FMP free tier: 250 requests per day
        return this.requestsToday < 250
    }

    async fetchQuote(symbol: string): Promise<StockQuote | null> {
        this.trackRequest()

        if (!this.apiKey || this.apiKey === 'demo') {
            console.warn('FMP: No valid API key provided')
            return null
        }

        if (!this.checkRateLimit()) {
            console.warn('FMP: Daily rate limit exceeded (250 requests per day)')
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
            this.requestsToday++

            // Get current quote
            const response = await axios.get(`${this.baseUrl}/quote/${symbol.toUpperCase()}`, {
                params: {
                    apikey: this.apiKey
                },
                timeout: this.timeout
            })

            const data = response.data?.[0]

            if (!data || !data.price) {
                console.warn(`FMP: No data found for ${symbol}`)
                return null
            }

            const currentPrice = data.price
            const previousClose = data.previousClose || currentPrice
            const change = data.change || (currentPrice - previousClose)
            const changePercent = data.changesPercentage || ((change / previousClose) * 100)

            if (!this.isValidPrice(currentPrice)) {
                console.warn(`FMP: Invalid price data for ${symbol}`)
                return null
            }

            // Get additional data if available
            const volume = data.volume || data.avgVolume || 0
            const marketCap = data.marketCap ? this.formatMarketCap(data.marketCap) : 'N/A'
            const companyName = data.name || `${symbol.toUpperCase()} Corporation`

            const quote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: companyName,
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: volume,
                marketCap: marketCap,
                previousClose: Number(previousClose.toFixed(2)),
                dayHigh: Number((data.dayHigh || currentPrice).toFixed(2)),
                dayLow: Number((data.dayLow || currentPrice).toFixed(2)),
                yearHigh: Number((data.yearHigh || currentPrice).toFixed(2)),
                yearLow: Number((data.yearLow || currentPrice).toFixed(2)),
                lastUpdate: new Date().toISOString()
            }

            this.trackSuccess()
            console.log(`✅ FMP: Fetched ${symbol} at $${currentPrice.toFixed(2)} (${changePercent.toFixed(2)}%)`)

            return quote

        } catch (error) {
            this.trackError(error)

            if (axios.isAxiosError(error)) {
                if (error.response?.status === 403) {
                    console.warn(`FMP: API key invalid or quota exceeded for ${symbol}`)
                } else if (error.response?.status === 429) {
                    console.warn(`FMP: Rate limited for ${symbol}`)
                    this.requestsToday = 250 // Max out for today
                } else {
                    console.error(`FMP: HTTP ${error.response?.status} for ${symbol}:`, error.message)
                }
            } else {
                console.error(`FMP: Error for ${symbol}:`, error)
            }

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
            console.warn('FMP: Daily rate limit exceeded for search')
            return []
        }

        try {
            await this.delay(this.rateLimitDelay)
            this.requestsToday++

            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    query: query,
                    limit: 10,
                    apikey: this.apiKey
                },
                timeout: this.timeout
            })

            const results = (response.data || [])
                .slice(0, 10)
                .map((item: any) => ({
                    symbol: item.symbol,
                    name: item.name || item.symbol
                }))

            this.trackSuccess()
            console.log(`✅ FMP: Found ${results.length} symbols for query "${query}"`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`FMP: Search error for "${query}":`, error)
            return []
        }
    }

    // FMP supports batch quotes
    async fetchMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
        this.trackRequest()
        const results = new Map<string, StockQuote>()

        if (symbols.length === 0) return results

        if (!this.apiKey || this.apiKey === 'demo') {
            console.warn('FMP: No valid API key for batch quotes')
            return results
        }

        if (!this.checkRateLimit()) {
            console.warn('FMP: Daily rate limit exceeded for batch quotes')
            return results
        }

        try {
            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()
            this.requestsToday++

            // FMP supports batch requests with comma-separated symbols
            const symbolsParam = symbols.map(s => s.toUpperCase()).join(',')

            const response = await axios.get(`${this.baseUrl}/quote/${symbolsParam}`, {
                params: {
                    apikey: this.apiKey
                },
                timeout: this.timeout * 2 // Longer timeout for batch
            })

            const quotes = response.data || []

            for (const data of quotes) {
                try {
                    if (!data.symbol || !data.price) continue

                    const currentPrice = data.price
                    const previousClose = data.previousClose || currentPrice
                    const change = data.change || (currentPrice - previousClose)
                    const changePercent = data.changesPercentage || ((change / previousClose) * 100)

                    if (!this.isValidPrice(currentPrice)) continue

                    const quote: StockQuote = {
                        symbol: data.symbol,
                        name: data.name || `${data.symbol} Corporation`,
                        price: Number(currentPrice.toFixed(2)),
                        change: Number(change.toFixed(2)),
                        changePercent: Number(changePercent.toFixed(2)),
                        volume: data.volume || 0,
                        marketCap: data.marketCap ? this.formatMarketCap(data.marketCap) : 'N/A',
                        previousClose: Number(previousClose.toFixed(2)),
                        dayHigh: Number((data.dayHigh || currentPrice).toFixed(2)),
                        dayLow: Number((data.dayLow || currentPrice).toFixed(2)),
                        yearHigh: Number((data.yearHigh || currentPrice).toFixed(2)),
                        yearLow: Number((data.yearLow || currentPrice).toFixed(2)),
                        lastUpdate: new Date().toISOString()
                    }

                    results.set(data.symbol, quote)

                } catch (error) {
                    console.warn(`FMP Batch: Error processing ${data.symbol}:`, error)
                }
            }

            this.trackSuccess()
            console.log(`✅ FMP Batch: Fetched ${results.size}/${symbols.length} quotes`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`FMP Batch: Error for symbols [${symbols.join(', ')}]:`, error)

            // Fallback to individual requests
            console.log(`📡 FMP: Falling back to individual requests...`)
            return super.fetchMultipleQuotes(symbols.slice(0, 5)) // Limit to 5 to preserve rate limit
        }
    }

    public getStatus(): import('./BaseDataProvider').ProviderStatus {
        const baseStatus = super.getStatus()
        return {
            ...baseStatus,
            rateLimitRemaining: Math.max(0, 250 - this.requestsToday),
            nextResetTime: new Date(this.dayResetTime)
        }
    }
}