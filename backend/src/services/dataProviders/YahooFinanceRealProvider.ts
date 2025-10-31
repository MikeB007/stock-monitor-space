import axios from 'axios'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class YahooFinanceRealProvider extends BaseDataProvider {
    private lastRequestTime: number = 0

    constructor() {
        super({
            name: 'Yahoo Finance Real',
            priority: 1,
            baseUrl: 'https://query1.finance.yahoo.com',
            timeout: 10000,
            rateLimitDelay: 2000,
            maxRetries: 3
        })
    }

    async fetchQuote(symbol: string): Promise<StockQuote | null> {
        this.requestCount++

        try {
            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()

            // Fetch real data from Yahoo Finance API
            const response = await axios.get(`${this.baseUrl}/v8/finance/chart/${symbol}`, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })

            if (!response.data?.chart?.result?.[0]) {
                console.log(`Yahoo Real: No data available for ${symbol}`)
                return null
            }

            const result = response.data.chart.result[0]
            const meta = result.meta
            const quote = result.indicators?.quote?.[0]

            if (!meta || !quote) {
                console.log(`Yahoo Real: Invalid data structure for ${symbol}`)
                return null
            }

            // Get the latest values
            const latestIndex = quote.close?.length - 1
            if (latestIndex < 0) {
                console.log(`Yahoo Real: No price data for ${symbol}`)
                return null
            }

            const price = quote.close[latestIndex] || meta.regularMarketPrice || 0
            const previousClose = meta.previousClose || meta.chartPreviousClose || price
            const change = price - previousClose
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

            this.lastSuccess = new Date()

            const stockQuote: StockQuote = {
                symbol: symbol.toUpperCase(),
                name: meta.longName || meta.shortName || symbol,
                price: price,
                change: change,
                changePercent: changePercent,
                volume: quote.volume?.[latestIndex] || meta.regularMarketVolume || 0,
                marketCap: this.formatMarketCap(meta.marketCap),
                previousClose: previousClose,
                dayHigh: meta.regularMarketDayHigh || quote.high?.[latestIndex] || price,
                dayLow: meta.regularMarketDayLow || quote.low?.[latestIndex] || price,
                yearHigh: meta.fiftyTwoWeekHigh || price,
                yearLow: meta.fiftyTwoWeekLow || price,
                lastUpdate: new Date().toISOString()
            }

            // Add extended hours data if available
            if (meta.preMarketPrice) {
                stockQuote.preMarketPrice = meta.preMarketPrice
                stockQuote.preMarketChange = meta.preMarketChange || 0
                stockQuote.preMarketChangePercent = meta.preMarketChangePercent || 0
                stockQuote.preMarketTime = new Date(meta.preMarketTime * 1000).toISOString()
            }

            if (meta.postMarketPrice) {
                stockQuote.postMarketPrice = meta.postMarketPrice
                stockQuote.postMarketChange = meta.postMarketChange || 0
                stockQuote.postMarketChangePercent = meta.postMarketChangePercent || 0
                stockQuote.postMarketTime = new Date(meta.postMarketTime * 1000).toISOString()
            }

            // Determine market state
            if (meta.marketState) {
                stockQuote.marketState = meta.marketState
            } else if (meta.postMarketPrice) {
                stockQuote.marketState = 'POST'
            } else if (meta.preMarketPrice) {
                stockQuote.marketState = 'PRE'
            } else {
                stockQuote.marketState = 'REGULAR'
            }

            stockQuote.hasPrePostMarketData = !!(meta.preMarketPrice || meta.postMarketPrice)

            console.log(`Yahoo Real: Successfully fetched ${symbol} - $${price.toFixed(2)}`)
            return stockQuote

        } catch (error) {
            this.errorCount++
            this.lastError = `Error fetching ${symbol}: ${error}`
            console.error(`Yahoo Real: Error for ${symbol}:`, error)
            return null
        }
    }

    async validateSymbol(symbol: string): Promise<boolean> {
        try {
            const quote = await this.fetchQuote(symbol)
            return quote !== null
        } catch {
            return false
        }
    }

    async searchSymbols(query: string): Promise<Array<{ symbol: string, name: string }>> {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/finance/search`, {
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
            return quotes
                .filter((quote: any) => quote.symbol && quote.shortname)
                .slice(0, 10)
                .map((quote: any) => ({
                    symbol: quote.symbol,
                    name: quote.shortname || quote.longname || quote.symbol
                }))
        } catch (error) {
            console.error('Yahoo Real: Search error:', error)
            return []
        }
    }

    protected delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.fetchQuote('AAPL')
            return result !== null
        } catch {
            return false
        }
    }
}