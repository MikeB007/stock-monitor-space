import axios from 'axios'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class YahooFinanceProvider extends BaseDataProvider {
    private lastRequestTime: number = 0

    constructor() {
        super({
            name: 'Yahoo Finance',
            priority: 1, // Highest priority - most reliable free service
            baseUrl: 'https://query1.finance.yahoo.com',
            timeout: 5000,
            rateLimitDelay: 500, // Conservative rate limiting
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

            const url = `${this.baseUrl}/v8/finance/chart/${symbol.toUpperCase()}`

            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            })

            const data = response.data?.chart?.result?.[0]
            if (!data || !data.meta) {
                console.warn(`Yahoo Finance: No data found for ${symbol}`)
                return null
            }

            const meta = data.meta
            const currentPrice = meta.regularMarketPrice || meta.previousClose

            if (!this.isValidPrice(currentPrice)) {
                console.warn(`Yahoo Finance: Invalid price data for ${symbol}`)
                return null
            }

            const previousClose = meta.previousClose || currentPrice
            const change = currentPrice - previousClose
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

            // Extract additional data
            const volume = meta.regularMarketVolume || meta.averageVolume || 0
            const dayHigh = meta.regularMarketDayHigh || currentPrice
            const dayLow = meta.regularMarketDayLow || currentPrice
            const yearHigh = meta.fiftyTwoWeekHigh || currentPrice
            const yearLow = meta.fiftyTwoWeekLow || currentPrice

            // Format market cap
            const marketCap = meta.marketCap ? this.formatMarketCap(meta.marketCap) : 'N/A'

            // Get company name
            const companyName = meta.longName || meta.shortName || meta.symbol || symbol

            const quote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: companyName,
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: volume,
                marketCap: marketCap,
                previousClose: Number(previousClose.toFixed(2)),
                dayHigh: Number(dayHigh.toFixed(2)),
                dayLow: Number(dayLow.toFixed(2)),
                yearHigh: Number(yearHigh.toFixed(2)),
                yearLow: Number(yearLow.toFixed(2)),
                lastUpdate: new Date().toISOString()
            }

            this.trackSuccess()
            console.log(`✅ Yahoo Finance: Fetched ${symbol} at $${currentPrice.toFixed(2)} (${changePercent.toFixed(2)}%)`)

            return quote

        } catch (error) {
            this.trackError(error)

            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    console.warn(`Yahoo Finance: Symbol ${symbol} not found (404)`)
                    return null
                } else if (error.response?.status === 429) {
                    console.warn(`Yahoo Finance: Rate limited for ${symbol}`)
                    // Increase delay for future requests
                    this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 5000)
                } else {
                    console.error(`Yahoo Finance: HTTP ${error.response?.status} for ${symbol}:`, error.message)
                }
            } else if ((error as any).code === 'ECONNABORTED') {
                console.warn(`Yahoo Finance: Timeout for ${symbol}`)
            } else {
                console.error(`Yahoo Finance: Error for ${symbol}:`, error)
            } return null
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
            // Rate limiting
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
            console.log(`✅ Yahoo Finance: Found ${results.length} symbols for query "${query}"`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`Yahoo Finance: Search error for "${query}":`, error)
            return []
        }
    }

    // Yahoo Finance supports batch quotes through a single request
    async fetchMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
        this.trackRequest()
        const results = new Map<string, StockQuote>()

        if (symbols.length === 0) return results

        try {
            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()

            // Yahoo Finance batch request
            const symbolsParam = symbols.map(s => s.toUpperCase()).join(',')
            const url = `${this.baseUrl}/v7/finance/quote`

            const response = await axios.get(url, {
                params: {
                    symbols: symbolsParam,
                    formatted: false,
                    crumb: ''
                },
                timeout: this.timeout * 2, // Longer timeout for batch requests
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })

            const quotes = response.data?.quoteResponse?.result || []

            for (const quoteData of quotes) {
                try {
                    const symbol = quoteData.symbol
                    const currentPrice = quoteData.regularMarketPrice || quoteData.previousClose

                    if (!this.isValidPrice(currentPrice)) {
                        console.warn(`Yahoo Finance Batch: Invalid price for ${symbol}`)
                        continue
                    }

                    const previousClose = quoteData.previousClose || currentPrice
                    const change = currentPrice - previousClose
                    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

                    const quote: StockQuote = {
                        symbol: symbol,
                        name: quoteData.longName || quoteData.shortName || symbol,
                        price: Number(currentPrice.toFixed(2)),
                        change: Number(change.toFixed(2)),
                        changePercent: Number(changePercent.toFixed(2)),
                        volume: quoteData.regularMarketVolume || 0,
                        marketCap: quoteData.marketCap ? this.formatMarketCap(quoteData.marketCap) : 'N/A',
                        previousClose: Number(previousClose.toFixed(2)),
                        dayHigh: Number((quoteData.regularMarketDayHigh || currentPrice).toFixed(2)),
                        dayLow: Number((quoteData.regularMarketDayLow || currentPrice).toFixed(2)),
                        yearHigh: Number((quoteData.fiftyTwoWeekHigh || currentPrice).toFixed(2)),
                        yearLow: Number((quoteData.fiftyTwoWeekLow || currentPrice).toFixed(2)),
                        lastUpdate: new Date().toISOString()
                    }

                    results.set(symbol, quote)

                } catch (error) {
                    console.warn(`Yahoo Finance Batch: Error processing ${quoteData.symbol}:`, error)
                }
            }

            this.trackSuccess()
            console.log(`✅ Yahoo Finance Batch: Fetched ${results.size}/${symbols.length} quotes`)

            return results

        } catch (error) {
            this.trackError(error)
            console.error(`Yahoo Finance Batch: Error for symbols [${symbols.join(', ')}]:`, error)

            // Fallback to individual requests if batch fails
            console.log(`📡 Yahoo Finance: Falling back to individual requests...`)
            return super.fetchMultipleQuotes(symbols)
        }
    }
}