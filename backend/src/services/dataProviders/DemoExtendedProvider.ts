import axios from 'axios'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class DemoExtendedProvider extends BaseDataProvider {
    private lastRequestTime: number = 0

    constructor() {
        super({
            name: 'Demo Extended Hours',
            priority: 1,
            baseUrl: 'https://query1.finance.yahoo.com',
            timeout: 5000,
            rateLimitDelay: 500,
            maxRetries: 3
        })
    }

    async fetchQuote(symbol: string): Promise<StockQuote | null> {
        this.trackRequest()

        try {
            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()

            // Use regular Yahoo Finance API for basic data
            const url = `${this.baseUrl}/v8/finance/chart/${symbol.toUpperCase()}`

            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            })

            const data = response.data?.chart?.result?.[0]
            if (!data || !data.meta) {
                console.warn(`Demo Extended: No data found for ${symbol}`)
                return null
            }

            const meta = data.meta
            const currentPrice = meta.regularMarketPrice || meta.previousClose

            if (!this.isValidPrice(currentPrice)) {
                console.warn(`Demo Extended: Invalid price data for ${symbol}`)
                return null
            }

            const previousClose = meta.previousClose || currentPrice
            const change = currentPrice - previousClose
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

            // Create mock extended hours data for demonstration
            const extendedHoursData = this.generateMockExtendedHours(symbol.toUpperCase(), currentPrice)

            const quote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: meta.longName || meta.shortName || meta.symbol || symbol,
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: meta.regularMarketVolume || meta.averageVolume || 0,
                marketCap: meta.marketCap ? this.formatMarketCap(meta.marketCap) : 'N/A',
                previousClose: Number(previousClose.toFixed(2)),
                dayHigh: Number((meta.regularMarketDayHigh || currentPrice).toFixed(2)),
                dayLow: Number((meta.regularMarketDayLow || currentPrice).toFixed(2)),
                yearHigh: Number((meta.fiftyTwoWeekHigh || currentPrice).toFixed(2)),
                yearLow: Number((meta.fiftyTwoWeekLow || currentPrice).toFixed(2)),
                lastUpdate: new Date().toISOString(),
                ...extendedHoursData
            }

            this.trackSuccess()
            console.log(`✅ Demo Extended: Fetched ${symbol} - Regular: $${currentPrice.toFixed(2)}, Pre: ${quote.preMarketPrice ? '$' + quote.preMarketPrice : 'N/A'}, Post: ${quote.postMarketPrice ? '$' + quote.postMarketPrice : 'N/A'}, Market: ${quote.marketState}`)

            return quote

        } catch (error) {
            this.trackError(error)

            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    console.warn(`Demo Extended: Symbol ${symbol} not found (404)`)
                    return null
                } else if (error.response?.status === 429) {
                    console.warn(`Demo Extended: Rate limited for ${symbol}`)
                    this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 5000)
                } else {
                    console.error(`Demo Extended: HTTP ${error.response?.status} for ${symbol}:`, error.message)
                }
            } else if ((error as any).code === 'ECONNABORTED') {
                console.warn(`Demo Extended: Timeout for ${symbol}`)
            } else {
                console.error(`Demo Extended: Error for ${symbol}:`, error)
            }
            return null
        }
    }

    private generateMockExtendedHours(symbol: string, regularPrice: number): Partial<StockQuote> {
        const now = new Date()
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
        const hour = easternTime.getHours()
        const minute = easternTime.getMinutes()
        const timeMinutes = hour * 60 + minute
        const day = easternTime.getDay() // 0 = Sunday, 6 = Saturday

        // Weekend check
        if (day === 0 || day === 6) {
            return {
                marketState: 'CLOSED',
                hasPrePostMarketData: false
            }
        }

        // Market hours in ET (9:30 AM - 4:00 PM)
        const marketOpen = 9 * 60 + 30  // 9:30 AM
        const marketClose = 16 * 60     // 4:00 PM
        const preMarketStart = 4 * 60   // 4:00 AM
        const postMarketEnd = 20 * 60   // 8:00 PM

        const result: Partial<StockQuote> = {
            hasPrePostMarketData: false
        }

        // Generate mock data based on symbol and current time
        const variance = this.getSymbolVariance(symbol)

        if (timeMinutes >= preMarketStart && timeMinutes < marketOpen) {
            // Pre-market hours
            const preMarketPrice = regularPrice * (1 + variance.preMarket)
            const preMarketChange = preMarketPrice - regularPrice
            const preMarketChangePercent = (preMarketChange / regularPrice) * 100

            result.marketState = 'PRE'
            result.hasPrePostMarketData = true
            result.preMarketPrice = Number(preMarketPrice.toFixed(2))
            result.preMarketChange = Number(preMarketChange.toFixed(2))
            result.preMarketChangePercent = Number(preMarketChangePercent.toFixed(2))
            result.preMarketTime = new Date(easternTime.getTime() - 5 * 60 * 1000).toISOString() // 5 minutes ago

        } else if (timeMinutes >= marketOpen && timeMinutes < marketClose) {
            // Regular market hours
            result.marketState = 'REGULAR'

            // Still show pre-market data if it was active earlier
            if (Math.random() > 0.3) { // 70% chance to have pre-market data
                const preMarketPrice = regularPrice * (1 + variance.preMarket)
                const preMarketChange = preMarketPrice - regularPrice
                const preMarketChangePercent = (preMarketChange / regularPrice) * 100

                result.hasPrePostMarketData = true
                result.preMarketPrice = Number(preMarketPrice.toFixed(2))
                result.preMarketChange = Number(preMarketChange.toFixed(2))
                result.preMarketChangePercent = Number(preMarketChangePercent.toFixed(2))
                result.preMarketTime = new Date(easternTime.setHours(8, 30, 0, 0)).toISOString() // 8:30 AM
            }

        } else if (timeMinutes >= marketClose && timeMinutes < postMarketEnd) {
            // After-hours
            const postMarketPrice = regularPrice * (1 + variance.postMarket)
            const postMarketChange = postMarketPrice - regularPrice
            const postMarketChangePercent = (postMarketChange / regularPrice) * 100

            result.marketState = 'POST'
            result.hasPrePostMarketData = true
            result.postMarketPrice = Number(postMarketPrice.toFixed(2))
            result.postMarketChange = Number(postMarketChange.toFixed(2))
            result.postMarketChangePercent = Number(postMarketChangePercent.toFixed(2))
            result.postMarketTime = new Date(easternTime.getTime() - 3 * 60 * 1000).toISOString() // 3 minutes ago

            // Also show pre-market data from earlier
            if (Math.random() > 0.2) { // 80% chance to have pre-market data
                const preMarketPrice = regularPrice * (1 + variance.preMarket)
                const preMarketChange = preMarketPrice - regularPrice
                const preMarketChangePercent = (preMarketChange / regularPrice) * 100

                result.preMarketPrice = Number(preMarketPrice.toFixed(2))
                result.preMarketChange = Number(preMarketChange.toFixed(2))
                result.preMarketChangePercent = Number(preMarketChangePercent.toFixed(2))
                result.preMarketTime = new Date(easternTime.setHours(8, 45, 0, 0)).toISOString() // 8:45 AM
            }

        } else {
            // Market closed - Show last extended hours prices from previous session
            result.marketState = 'CLOSED'
            result.hasPrePostMarketData = true

            // Generate consistent "last session" extended hours data
            const preMarketPrice = regularPrice * (1 + variance.preMarket)
            const preMarketChange = preMarketPrice - regularPrice
            const preMarketChangePercent = (preMarketChange / regularPrice) * 100

            const postMarketPrice = regularPrice * (1 + variance.postMarket)
            const postMarketChange = postMarketPrice - regularPrice
            const postMarketChangePercent = (postMarketChange / regularPrice) * 100

            // Show last pre-market session (from this morning)
            if (Math.random() > 0.2) { // 80% chance to have pre-market data
                const lastPreMarketTime = new Date(easternTime)
                lastPreMarketTime.setHours(8, 45, 0, 0) // 8:45 AM this morning

                result.preMarketPrice = Number(preMarketPrice.toFixed(2))
                result.preMarketChange = Number(preMarketChange.toFixed(2))
                result.preMarketChangePercent = Number(preMarketChangePercent.toFixed(2))
                result.preMarketTime = lastPreMarketTime.toISOString()
            }

            // Show last after-hours session (yesterday's after-hours)
            if (Math.random() > 0.1) { // 90% chance to have after-hours data
                const lastPostMarketTime = new Date(easternTime)
                lastPostMarketTime.setDate(lastPostMarketTime.getDate() - (day === 1 ? 3 : 1)) // Handle Monday (go back to Friday)
                lastPostMarketTime.setHours(19, 30, 0, 0) // 7:30 PM yesterday (or Friday)

                result.postMarketPrice = Number(postMarketPrice.toFixed(2))
                result.postMarketChange = Number(postMarketChange.toFixed(2))
                result.postMarketChangePercent = Number(postMarketChangePercent.toFixed(2))
                result.postMarketTime = lastPostMarketTime.toISOString()
            }
        }

        return result
    }

    private getSymbolVariance(symbol: string): { preMarket: number, postMarket: number } {
        // Use real Apple data: Regular $271.40 → After-hours $277.77 (+2.35%)
        if (symbol === 'AAPL') {
            return {
                preMarket: 0.035,  // +3.5% pre-market (realistic movement)
                postMarket: 0.0235 // +2.35% after-hours (real Yahoo Finance data)
            }
        }

        // Generate consistent variance based on symbol for demo purposes
        const hash = symbol.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
        }, 0)

        const preMarketMultiplier = (Math.abs(hash) % 100) / 1000 // 0 to 0.099
        const postMarketMultiplier = (Math.abs(hash * 2) % 150) / 1000 // 0 to 0.149

        // Apply positive or negative based on symbol
        const preMarketSign = (hash % 2 === 0) ? 1 : -1
        const postMarketSign = ((hash * 3) % 2 === 0) ? 1 : -1

        return {
            preMarket: preMarketSign * preMarketMultiplier,
            postMarket: postMarketSign * postMarketMultiplier
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

        try {
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()

            const url = `${this.baseUrl}/v1/finance/search`

            const response = await axios.get(url, {
                params: {
                    q: query,
                    quotesCount: 10,
                    newsCount: 0
                },
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })

            const quotes = response.data?.quotes || []
            const results = quotes
                .filter((quote: any) => quote.symbol && quote.longname)
                .slice(0, 10)
                .map((quote: any) => ({
                    symbol: quote.symbol,
                    name: quote.longname || quote.shortname || quote.symbol
                }))

            this.trackSuccess()
            console.log(`✅ Demo Extended: Found ${results.length} symbols for query "${query}"`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`Demo Extended: Search error for "${query}":`, error)
            return []
        }
    }
}