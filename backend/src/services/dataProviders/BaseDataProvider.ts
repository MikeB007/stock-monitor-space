// Base Data Provider Interface
// All data providers must implement this interface

export interface StockQuote {
    symbol: string
    name: string
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap: string
    previousClose: number
    dayHigh: number
    dayLow: number
    yearHigh: number
    yearLow: number
    lastUpdate: string

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

export interface ProviderStatus {
    name: string
    isAvailable: boolean
    lastSuccess: Date | null
    lastError: string | null
    requestCount: number
    errorCount: number
    rateLimitRemaining?: number
    nextResetTime?: Date
}

export abstract class BaseDataProvider {
    protected name: string
    protected priority: number
    protected apiKey?: string
    protected baseUrl: string
    protected timeout: number
    protected rateLimitDelay: number
    protected maxRetries: number

    // Status tracking
    protected requestCount: number = 0
    protected errorCount: number = 0
    protected lastSuccess: Date | null = null
    protected lastError: string | null = null
    protected isHealthy: boolean = true

    constructor(config: {
        name: string
        priority: number
        apiKey?: string
        baseUrl: string
        timeout?: number
        rateLimitDelay?: number
        maxRetries?: number
    }) {
        this.name = config.name
        this.priority = config.priority
        this.apiKey = config.apiKey
        this.baseUrl = config.baseUrl
        this.timeout = config.timeout || 5000
        this.rateLimitDelay = config.rateLimitDelay || 1000
        this.maxRetries = config.maxRetries || 2
    }

    // Abstract methods that each provider must implement
    abstract fetchQuote(symbol: string): Promise<StockQuote | null>
    abstract validateSymbol(symbol: string): Promise<boolean>
    abstract searchSymbols(query: string): Promise<Array<{ symbol: string, name: string }>>

    // Optional: Batch quote fetching (if provider supports it)
    async fetchMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
        const results = new Map<string, StockQuote>()

        // Default implementation: fetch quotes one by one
        for (const symbol of symbols) {
            try {
                const quote = await this.fetchQuote(symbol)
                if (quote) {
                    results.set(symbol, quote)
                }
            } catch (error) {
                console.warn(`Failed to fetch quote for ${symbol} from ${this.name}:`, error)
            }
        }

        return results
    }

    // Provider health and status methods
    public getStatus(): ProviderStatus {
        return {
            name: this.name,
            isAvailable: this.isHealthy,
            lastSuccess: this.lastSuccess,
            lastError: this.lastError,
            requestCount: this.requestCount,
            errorCount: this.errorCount
        }
    }

    public getName(): string {
        return this.name
    }

    public getPriority(): number {
        return this.priority
    }

    public setPriority(priority: number): void {
        this.priority = priority
    }

    public isAvailable(): boolean {
        return this.isHealthy
    }

    // Health check method
    public async healthCheck(): Promise<boolean> {
        try {
            // Try to fetch a known symbol (AAPL) to test connectivity
            const result = await this.fetchQuote('AAPL')
            this.isHealthy = result !== null
            if (this.isHealthy) {
                this.lastSuccess = new Date()
                this.lastError = null
            }
            return this.isHealthy
        } catch (error) {
            this.isHealthy = false
            this.lastError = error instanceof Error ? error.message : String(error)
            this.errorCount++
            return false
        }
    }

    // Protected helper methods
    protected trackRequest(): void {
        this.requestCount++
    }

    protected trackSuccess(): void {
        this.lastSuccess = new Date()
        this.lastError = null
        this.isHealthy = true
    }

    protected trackError(error: any): void {
        this.errorCount++
        this.lastError = error instanceof Error ? error.message : String(error)

        // Mark as unhealthy if error rate is too high
        if (this.errorCount > 5 && this.requestCount > 0) {
            const errorRate = this.errorCount / this.requestCount
            if (errorRate > 0.5) { // More than 50% error rate
                this.isHealthy = false
            }
        }
    }

    protected async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    // Format market cap helper
    protected formatMarketCap(marketCap: number): string {
        if (marketCap >= 1e12) {
            return `$${(marketCap / 1e12).toFixed(2)}T`
        } else if (marketCap >= 1e9) {
            return `$${(marketCap / 1e9).toFixed(2)}B`
        } else if (marketCap >= 1e6) {
            return `$${(marketCap / 1e6).toFixed(0)}M`
        } else if (marketCap > 0) {
            return `$${marketCap.toFixed(0)}`
        }
        return 'N/A'
    }

    // Validate price data helper
    protected isValidPrice(price: any): boolean {
        return typeof price === 'number' && price > 0 && !isNaN(price) && isFinite(price)
    }

    // Reset error tracking (useful for periodic resets)
    public resetErrorTracking(): void {
        this.errorCount = 0
        this.lastError = null
        if (this.requestCount > 0 && this.lastSuccess) {
            this.isHealthy = true
        }
    }
}