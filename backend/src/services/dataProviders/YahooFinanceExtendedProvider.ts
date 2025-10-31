import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseDataProvider, StockQuote } from './BaseDataProvider'

export class YahooFinanceExtendedProvider extends BaseDataProvider {
    private lastRequestTime: number = 0

    constructor() {
        super({
            name: 'Yahoo Finance Extended',
            priority: 1, // Highest priority - includes extended hours
            baseUrl: 'https://finance.yahoo.com',
            timeout: 10000, // Longer timeout for web scraping
            rateLimitDelay: 1000, // More conservative for scraping
            maxRetries: 2
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

            // Use API endpoint for reliable basic data
            const apiQuote = await this.fetchFromAPI(symbol)
            if (!apiQuote) {
                return null
            }

            // For now, add placeholder extended hours data structure
            // This can be enhanced later with more sophisticated scraping
            const finalQuote: StockQuote = {
                ...apiQuote,
                marketState: this.determineCurrentMarketState(),
                hasPrePostMarketData: false, // Will be true when we have actual extended hours data
                // Extended hours placeholders - would be populated by actual extended hours API/scraping
                preMarketPrice: undefined,
                preMarketChange: undefined,
                preMarketChangePercent: undefined,
                preMarketTime: undefined,
                postMarketPrice: undefined,
                postMarketChange: undefined,
                postMarketChangePercent: undefined,
                postMarketTime: undefined
            }

            this.trackSuccess()
            console.log(`✅ Yahoo Extended: Fetched ${symbol} - Regular: $${apiQuote.price}, Market: ${finalQuote.marketState}`)

            return finalQuote

        } catch (error) {
            this.trackError(error)
            console.error(`Yahoo Extended: Error for ${symbol}:`, error)
            return null
        }
    }

    private async fetchFromAPI(symbol: string): Promise<StockQuote | null> {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`

            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Referer': 'https://finance.yahoo.com/'
                }
            })

            const data = response.data?.chart?.result?.[0]
            if (!data || !data.meta) {
                return null
            }

            const meta = data.meta
            const currentPrice = meta.regularMarketPrice || meta.previousClose

            if (!this.isValidPrice(currentPrice)) {
                return null
            }

            const previousClose = meta.previousClose || currentPrice
            const change = currentPrice - previousClose
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

            return {
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
                lastUpdate: new Date().toISOString()
            }

        } catch (error) {
            console.warn(`Yahoo API fallback failed for ${symbol}:`, error)
            return null
        }
    }

    private async scrapeExtendedHours(symbol: string): Promise<Partial<StockQuote>> {
        try {
            const url = `https://finance.yahoo.com/quote/${symbol.toUpperCase()}`

            const response = await axios.get(url, {
                timeout: this.timeout,
                maxContentLength: 50 * 1024 * 1024, // 50MB limit
                maxBodyLength: 50 * 1024 * 1024,    // 50MB limit
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                },
                responseType: 'text',
                // Skip extended hours scraping for now to avoid header overflow
                validateStatus: function (status) {
                    return status < 500; // Accept any status code less than 500
                }
            })

            if (response.status >= 400) {
                console.warn(`Yahoo scraping returned status ${response.status} for ${symbol}`)
                return {
                    marketState: 'REGULAR',
                    hasPrePostMarketData: false
                }
            }

            const html = response.data
            const $ = cheerio.load(html)

            // Extract extended hours data using multiple selectors
            const extendedData: Partial<StockQuote> = {}

            // Look for JSON data in script tags (most reliable method)
            const scriptContent = $('script').filter((i, el) => {
                const content = $(el).html() || ''
                return content.includes('postMarketPrice') || content.includes('preMarketPrice') || content.includes('marketState')
            }).html()

            if (scriptContent) {
                // Try to extract JSON data from script
                const jsonMatch = scriptContent.match(/root\.App\.main\s*=\s*({.*?});/)
                if (jsonMatch) {
                    try {
                        const jsonData = JSON.parse(jsonMatch[1])
                        const quoteData = this.extractQuoteDataFromJSON(jsonData, symbol)
                        if (quoteData) {
                            Object.assign(extendedData, quoteData)
                        }
                    } catch (e) {
                        console.warn(`Failed to parse JSON data for ${symbol}`)
                    }
                }
            }

            // Fallback: Look for specific selectors
            if (!extendedData.postMarketPrice && !extendedData.preMarketPrice) {
                this.extractFromSelectors($, extendedData)
            }

            // Determine market state
            extendedData.marketState = this.determineMarketState(extendedData)
            extendedData.hasPrePostMarketData = !!(extendedData.preMarketPrice || extendedData.postMarketPrice)

            return extendedData

        } catch (error) {
            // For now, gracefully handle scraping errors and just return basic market state
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorCode = (error as any)?.code

            if (errorCode === 'HPE_HEADER_OVERFLOW' || errorMessage?.includes('Header overflow')) {
                console.warn(`Header overflow for ${symbol} - skipping extended hours scraping`)
            } else {
                console.warn(`Extended hours scraping failed for ${symbol}:`, errorMessage)
            }

            return {
                marketState: 'REGULAR',
                hasPrePostMarketData: false
            }
        }
    }

    private extractQuoteDataFromJSON(jsonData: any, symbol: string): Partial<StockQuote> | null {
        try {
            // Navigate through the JSON structure to find quote data
            const stores = jsonData?.context?.dispatcher?.stores
            if (!stores) return null

            // Look for QuoteSummaryStore or similar
            for (const [key, store] of Object.entries(stores)) {
                if (key.includes('Quote') || key.includes('Summary')) {
                    const storeData = store as any
                    if (storeData?.price) {
                        return this.extractPriceData(storeData.price)
                    }
                }
            }

            // Alternative: look for streaming data
            if (stores.StreamDataStore?.quoteData?.[symbol.toUpperCase()]) {
                const quoteData = stores.StreamDataStore.quoteData[symbol.toUpperCase()]
                return this.extractPriceData(quoteData)
            }

            return null

        } catch (error) {
            console.warn(`JSON extraction failed for ${symbol}:`, error)
            return null
        }
    }

    private extractPriceData(priceData: any): Partial<StockQuote> {
        const result: Partial<StockQuote> = {}

        // Pre-market data
        if (priceData.preMarketPrice && this.isValidPrice(priceData.preMarketPrice)) {
            result.preMarketPrice = Number(priceData.preMarketPrice.toFixed(2))
            if (priceData.preMarketChange) {
                result.preMarketChange = Number(priceData.preMarketChange.toFixed(2))
            }
            if (priceData.preMarketChangePercent) {
                result.preMarketChangePercent = Number(priceData.preMarketChangePercent.toFixed(2))
            }
            if (priceData.preMarketTime) {
                result.preMarketTime = new Date(priceData.preMarketTime * 1000).toISOString()
            }
        }

        // Post-market data
        if (priceData.postMarketPrice && this.isValidPrice(priceData.postMarketPrice)) {
            result.postMarketPrice = Number(priceData.postMarketPrice.toFixed(2))
            if (priceData.postMarketChange) {
                result.postMarketChange = Number(priceData.postMarketChange.toFixed(2))
            }
            if (priceData.postMarketChangePercent) {
                result.postMarketChangePercent = Number(priceData.postMarketChangePercent.toFixed(2))
            }
            if (priceData.postMarketTime) {
                result.postMarketTime = new Date(priceData.postMarketTime * 1000).toISOString()
            }
        }

        // Market state
        if (priceData.marketState) {
            result.marketState = this.mapMarketState(priceData.marketState)
        }

        return result
    }

    private extractFromSelectors($: cheerio.CheerioAPI, extendedData: Partial<StockQuote>): void {
        // Try different selector patterns for pre/post market data
        const prePostSelectors = [
            '[data-symbol] [data-field="preMarketPrice"]',
            '[data-symbol] [data-field="postMarketPrice"]',
            '.Pre-value', '.Post-value',
            '.postMarket-value', '.preMarket-value',
            'fin-streamer[data-field="preMarketPrice"]',
            'fin-streamer[data-field="postMarketPrice"]'
        ]

        prePostSelectors.forEach(selector => {
            const element = $(selector)
            if (element.length > 0) {
                const value = parseFloat(element.text().replace(/[$,]/g, ''))
                if (this.isValidPrice(value)) {
                    if (selector.includes('pre') || selector.includes('Pre')) {
                        extendedData.preMarketPrice = Number(value.toFixed(2))
                    } else if (selector.includes('post') || selector.includes('Post')) {
                        extendedData.postMarketPrice = Number(value.toFixed(2))
                    }
                }
            }
        })
    }

    private mapMarketState(state: string): 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' {
        const stateUpper = state.toUpperCase()
        if (stateUpper.includes('PRE')) return 'PRE'
        if (stateUpper.includes('POST')) return 'POST'
        if (stateUpper.includes('REGULAR') || stateUpper.includes('OPEN')) return 'REGULAR'
        return 'CLOSED'
    }

    private determineCurrentMarketState(): 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' {
        // Determine market state based on current time
        const now = new Date()
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
        const hour = easternTime.getHours()
        const minute = easternTime.getMinutes()
        const timeMinutes = hour * 60 + minute
        const day = easternTime.getDay() // 0 = Sunday, 6 = Saturday

        // Weekend check
        if (day === 0 || day === 6) {
            return 'CLOSED'
        }

        // Market hours in ET (9:30 AM - 4:00 PM)
        const marketOpen = 9 * 60 + 30  // 9:30 AM
        const marketClose = 16 * 60     // 4:00 PM
        const preMarketStart = 4 * 60   // 4:00 AM
        const postMarketEnd = 20 * 60   // 8:00 PM

        if (timeMinutes >= preMarketStart && timeMinutes < marketOpen) {
            return 'PRE'
        } else if (timeMinutes >= marketOpen && timeMinutes < marketClose) {
            return 'REGULAR'
        } else if (timeMinutes >= marketClose && timeMinutes < postMarketEnd) {
            return 'POST'
        } else {
            return 'CLOSED'
        }
    }

    private determineMarketState(data: Partial<StockQuote>): 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' {
        // Determine market state based on current time and available data
        const now = new Date()
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
        const hour = easternTime.getHours()
        const minute = easternTime.getMinutes()
        const timeMinutes = hour * 60 + minute

        // Market hours in ET (9:30 AM - 4:00 PM)
        const marketOpen = 9 * 60 + 30  // 9:30 AM
        const marketClose = 16 * 60     // 4:00 PM
        const preMarketStart = 4 * 60   // 4:00 AM
        const postMarketEnd = 20 * 60   // 8:00 PM

        if (data.preMarketPrice && timeMinutes >= preMarketStart && timeMinutes < marketOpen) {
            return 'PRE'
        } else if (data.postMarketPrice && timeMinutes >= marketClose && timeMinutes < postMarketEnd) {
            return 'POST'
        } else if (timeMinutes >= marketOpen && timeMinutes < marketClose) {
            return 'REGULAR'
        } else {
            return 'CLOSED'
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
        // Use the regular Yahoo Finance API for search
        this.trackRequest()

        try {
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await this.delay(this.rateLimitDelay - timeSinceLastRequest)
            }
            this.lastRequestTime = Date.now()

            const url = `https://query1.finance.yahoo.com/v1/finance/search`

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
            return results

        } catch (error) {
            this.trackError(error)
            console.error(`Yahoo Extended Search error for "${query}":`, error)
            return []
        }
    }
}