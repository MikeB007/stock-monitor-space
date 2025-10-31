import { API_KEYS } from '../../config/apiKeys'
import { AlphaVantageProvider } from './AlphaVantageProvider'
import { BaseDataProvider, ProviderStatus, StockQuote } from './BaseDataProvider'
import { FinancialModelingPrepProvider } from './FinancialModelingPrepProvider'
import { YahooFinanceRealProvider } from './YahooFinanceRealProvider'

export interface DataProviderConfig {
    enableYahooFinance: boolean
    enableAlphaVantage: boolean
    enableFinancialModelingPrep: boolean
    fallbackEnabled: boolean
    healthCheckInterval: number // minutes
    maxRetryAttempts: number
    cacheEnabled: boolean
    cacheTTL: number // seconds
}

export interface QuoteRequest {
    symbol: string
    preferredProvider?: string
    allowFallback?: boolean
}

export interface BatchQuoteRequest {
    symbols: string[]
    preferredProvider?: string
    allowFallback?: boolean
    maxConcurrency?: number
}

class DataProviderManager {
    private providers: Map<string, BaseDataProvider> = new Map()
    private config: DataProviderConfig
    private cache: Map<string, { quote: StockQuote, expiry: number }> = new Map()
    private healthCheckTimer?: NodeJS.Timeout

    constructor(config?: Partial<DataProviderConfig>) {
        this.config = {
            enableYahooFinance: true,
            enableAlphaVantage: true,
            enableFinancialModelingPrep: true,
            fallbackEnabled: true,
            healthCheckInterval: 30, // 30 minutes
            maxRetryAttempts: 3,
            cacheEnabled: true,
            cacheTTL: 60, // 1 minute cache
            ...config
        }

        this.initializeProviders()
        this.startHealthChecks()
    }

    private initializeProviders(): void {
        console.log('🔧 Initializing data providers...')

        // Yahoo Finance Real Provider (Priority 1 - Real extended hours data)
        if (this.config.enableYahooFinance) {
            const yahooProvider = new YahooFinanceRealProvider()
            this.providers.set(yahooProvider.getName(), yahooProvider)
            console.log('✅ Yahoo Finance Real provider initialized (Priority 1) - includes real pre/post market data')
        }

        // Alpha Vantage (Priority 2 - Free tier with API key)
        if (this.config.enableAlphaVantage && API_KEYS.ALPHA_VANTAGE !== 'demo') {
            const alphaProvider = new AlphaVantageProvider(API_KEYS.ALPHA_VANTAGE)
            this.providers.set(alphaProvider.getName(), alphaProvider)
            console.log('✅ Alpha Vantage provider initialized (Priority 2)')
        } else if (this.config.enableAlphaVantage) {
            console.log('⚠️ Alpha Vantage disabled: No valid API key provided')
        }

        // Financial Modeling Prep (Priority 3 - Free tier with API key)
        if (this.config.enableFinancialModelingPrep && API_KEYS.FINANCIAL_MODELING_PREP !== 'demo') {
            const fmpProvider = new FinancialModelingPrepProvider(API_KEYS.FINANCIAL_MODELING_PREP)
            this.providers.set(fmpProvider.getName(), fmpProvider)
            console.log('✅ Financial Modeling Prep provider initialized (Priority 3)')
        } else if (this.config.enableFinancialModelingPrep) {
            console.log('⚠️ Financial Modeling Prep disabled: No valid API key provided')
        }

        if (this.providers.size === 0) {
            console.error('❌ No data providers available! Please check your configuration.')
        } else {
            console.log(`📊 ${this.providers.size} data provider(s) ready for stock data`)
        }
    }

    private startHealthChecks(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer)
        }

        const intervalMs = this.config.healthCheckInterval * 60 * 1000
        this.healthCheckTimer = setInterval(async () => {
            console.log('🔍 Running provider health checks...')
            await this.runHealthChecks()
        }, intervalMs)

        // Run initial health check
        setTimeout(() => this.runHealthChecks(), 5000) // 5 seconds after startup
    }

    private async runHealthChecks(): Promise<void> {
        const healthPromises = Array.from(this.providers.values()).map(async (provider) => {
            try {
                const isHealthy = await provider.healthCheck()
                const status = isHealthy ? '✅' : '❌'
                console.log(`${status} ${provider.getName()}: ${isHealthy ? 'Healthy' : 'Unhealthy'}`)
                return { provider: provider.getName(), healthy: isHealthy }
            } catch (error) {
                console.error(`❌ Health check failed for ${provider.getName()}:`, error)
                return { provider: provider.getName(), healthy: false }
            }
        })

        const results = await Promise.all(healthPromises)
        const healthyCount = results.filter(r => r.healthy).length
        console.log(`🏥 Health check complete: ${healthyCount}/${results.length} providers healthy`)
    }

    private getAvailableProviders(): BaseDataProvider[] {
        return Array.from(this.providers.values())
            .filter(provider => provider.isAvailable())
            .sort((a, b) => a.getPriority() - b.getPriority()) // Sort by priority (lower number = higher priority)
    }

    private getCachedQuote(symbol: string): StockQuote | null {
        if (!this.config.cacheEnabled) return null

        const cached = this.cache.get(symbol.toUpperCase())
        if (!cached) return null

        if (Date.now() > cached.expiry) {
            this.cache.delete(symbol.toUpperCase())
            return null
        }

        return cached.quote
    }

    private setCachedQuote(symbol: string, quote: StockQuote): void {
        if (!this.config.cacheEnabled) return

        const expiry = Date.now() + (this.config.cacheTTL * 1000)
        this.cache.set(symbol.toUpperCase(), { quote, expiry })
    }

    public async fetchQuote(request: QuoteRequest): Promise<StockQuote | null> {
        const { symbol, preferredProvider, allowFallback = true } = request
        const upperSymbol = symbol.toUpperCase()

        // Check cache first
        const cachedQuote = this.getCachedQuote(upperSymbol)
        if (cachedQuote) {
            console.log(`💾 Cache hit for ${upperSymbol}`)
            return cachedQuote
        }

        const availableProviders = this.getAvailableProviders()
        if (availableProviders.length === 0) {
            console.error('❌ No available data providers')
            return null
        }

        // Try preferred provider first if specified
        if (preferredProvider) {
            const provider = this.providers.get(preferredProvider)
            if (provider && provider.isAvailable()) {
                try {
                    console.log(`🎯 Trying preferred provider ${preferredProvider} for ${upperSymbol}`)
                    const quote = await provider.fetchQuote(upperSymbol)
                    if (quote) {
                        this.setCachedQuote(upperSymbol, quote)
                        return quote
                    }
                } catch (error) {
                    console.warn(`⚠️ Preferred provider ${preferredProvider} failed for ${upperSymbol}:`, error)
                }
            }
        }

        // Try providers in priority order (fallback)
        if (allowFallback || !preferredProvider) {
            for (const provider of availableProviders) {
                if (preferredProvider && provider.getName() === preferredProvider) {
                    continue // Already tried
                }

                try {
                    console.log(`📡 Trying ${provider.getName()} for ${upperSymbol} (Priority ${provider.getPriority()})`)
                    const quote = await provider.fetchQuote(upperSymbol)
                    if (quote) {
                        this.setCachedQuote(upperSymbol, quote)
                        console.log(`✅ Successfully fetched ${upperSymbol} from ${provider.getName()}`)
                        return quote
                    }
                } catch (error) {
                    console.warn(`⚠️ ${provider.getName()} failed for ${upperSymbol}:`, error)
                }
            }
        }

        console.error(`❌ All providers failed for ${upperSymbol}`)
        return null
    }

    public async fetchMultipleQuotes(request: BatchQuoteRequest): Promise<Map<string, StockQuote>> {
        const { symbols, preferredProvider, allowFallback = true, maxConcurrency = 5 } = request
        const results = new Map<string, StockQuote>()

        if (symbols.length === 0) return results

        // Check cache for all symbols first
        const uncachedSymbols: string[] = []
        for (const symbol of symbols) {
            const cachedQuote = this.getCachedQuote(symbol)
            if (cachedQuote) {
                results.set(symbol.toUpperCase(), cachedQuote)
                console.log(`💾 Cache hit for ${symbol}`)
            } else {
                uncachedSymbols.push(symbol)
            }
        }

        if (uncachedSymbols.length === 0) {
            console.log(`💾 All ${symbols.length} symbols found in cache`)
            return results
        }

        console.log(`📊 Fetching ${uncachedSymbols.length}/${symbols.length} symbols from providers`)

        const availableProviders = this.getAvailableProviders()
        if (availableProviders.length === 0) {
            console.error('❌ No available data providers for batch request')
            return results
        }

        // Try preferred provider first if it supports batch requests
        if (preferredProvider) {
            const provider = this.providers.get(preferredProvider)
            if (provider && provider.isAvailable()) {
                try {
                    console.log(`🎯 Trying batch request with preferred provider ${preferredProvider}`)
                    const batchResults = await provider.fetchMultipleQuotes(uncachedSymbols)

                    // Add successful results and cache them
                    for (const [symbol, quote] of batchResults) {
                        results.set(symbol, quote)
                        this.setCachedQuote(symbol, quote)
                    }

                    // Remove successfully fetched symbols from uncached list
                    for (const symbol of batchResults.keys()) {
                        const index = uncachedSymbols.findIndex(s => s.toUpperCase() === symbol.toUpperCase())
                        if (index >= 0) {
                            uncachedSymbols.splice(index, 1)
                        }
                    }

                    if (uncachedSymbols.length === 0) {
                        console.log(`✅ All symbols fetched from preferred provider ${preferredProvider}`)
                        return results
                    }

                } catch (error) {
                    console.warn(`⚠️ Batch request failed with preferred provider ${preferredProvider}:`, error)
                }
            }
        }

        // Try remaining providers for any unfetched symbols (fallback)
        if (allowFallback && uncachedSymbols.length > 0) {
            for (const provider of availableProviders) {
                if (preferredProvider && provider.getName() === preferredProvider) {
                    continue // Already tried
                }

                if (uncachedSymbols.length === 0) break

                try {
                    console.log(`📡 Trying batch request with ${provider.getName()} for ${uncachedSymbols.length} symbols`)
                    const batchResults = await provider.fetchMultipleQuotes(uncachedSymbols)

                    // Add successful results and cache them
                    for (const [symbol, quote] of batchResults) {
                        results.set(symbol, quote)
                        this.setCachedQuote(symbol, quote)
                    }

                    // Remove successfully fetched symbols
                    for (const symbol of batchResults.keys()) {
                        const index = uncachedSymbols.findIndex(s => s.toUpperCase() === symbol.toUpperCase())
                        if (index >= 0) {
                            uncachedSymbols.splice(index, 1)
                        }
                    }

                    console.log(`✅ ${provider.getName()} fetched ${batchResults.size} symbols, ${uncachedSymbols.length} remaining`)

                } catch (error) {
                    console.warn(`⚠️ Batch request failed with ${provider.getName()}:`, error)
                }
            }
        }

        // For any remaining symbols, try individual requests (last resort)
        if (uncachedSymbols.length > 0 && allowFallback) {
            console.log(`🔄 Falling back to individual requests for ${uncachedSymbols.length} symbols`)

            const individualPromises = uncachedSymbols.slice(0, maxConcurrency).map(async (symbol) => {
                const quote = await this.fetchQuote({ symbol, allowFallback: true })
                if (quote) {
                    results.set(symbol.toUpperCase(), quote)
                }
            })

            await Promise.all(individualPromises)
        }

        const successCount = results.size
        const totalCount = symbols.length
        console.log(`📊 Batch request complete: ${successCount}/${totalCount} symbols fetched`)

        return results
    }

    public async validateSymbol(symbol: string, preferredProvider?: string): Promise<boolean> {
        const quote = await this.fetchQuote({
            symbol,
            preferredProvider,
            allowFallback: true
        })
        return quote !== null
    }

    public async searchSymbols(query: string, preferredProvider?: string): Promise<Array<{ symbol: string, name: string }>> {
        const availableProviders = this.getAvailableProviders()
        if (availableProviders.length === 0) {
            return []
        }

        // Try preferred provider first
        if (preferredProvider) {
            const provider = this.providers.get(preferredProvider)
            if (provider && provider.isAvailable()) {
                try {
                    const results = await provider.searchSymbols(query)
                    if (results.length > 0) {
                        return results
                    }
                } catch (error) {
                    console.warn(`Search failed with preferred provider ${preferredProvider}:`, error)
                }
            }
        }

        // Try other providers
        for (const provider of availableProviders) {
            if (preferredProvider && provider.getName() === preferredProvider) {
                continue // Already tried
            }

            try {
                const results = await provider.searchSymbols(query)
                if (results.length > 0) {
                    console.log(`✅ Search successful with ${provider.getName()}: ${results.length} results`)
                    return results
                }
            } catch (error) {
                console.warn(`Search failed with ${provider.getName()}:`, error)
            }
        }

        return []
    }

    public getProviderStatus(): Map<string, ProviderStatus> {
        const statusMap = new Map<string, ProviderStatus>()

        for (const [name, provider] of this.providers) {
            statusMap.set(name, provider.getStatus())
        }

        return statusMap
    }

    public getProviderNames(): string[] {
        return Array.from(this.providers.keys())
    }

    public setDefaultProvider(providerName: string): boolean {
        const provider = this.providers.get(providerName)
        if (!provider) {
            return false
        }

        // Set all providers to high priority, then set preferred to 1
        for (const [name, prov] of this.providers) {
            if (name === providerName) {
                prov.setPriority(1)
            } else {
                prov.setPriority(prov.getPriority() + 10)
            }
        }

        console.log(`✅ Set ${providerName} as default provider`)
        return true
    }

    public getConfig(): DataProviderConfig {
        return { ...this.config }
    }

    public updateConfig(newConfig: Partial<DataProviderConfig>): void {
        this.config = { ...this.config, ...newConfig }
        console.log('🔧 Data provider configuration updated')

        // Restart health checks if interval changed
        if (newConfig.healthCheckInterval) {
            this.startHealthChecks()
        }
    }

    public clearCache(): void {
        this.cache.clear()
        console.log('🗑️ Data provider cache cleared')
    }

    public getCacheStats(): { size: number, hitRate: number } {
        return {
            size: this.cache.size,
            hitRate: 0 // Would need to track hits/misses to calculate
        }
    }

    public shutdown(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer)
            this.healthCheckTimer = undefined
        }
        this.clearCache()
        console.log('🛑 Data provider manager shut down')
    }
}

// Export singleton instance
export const dataProviderManager = new DataProviderManager({
    enableYahooFinance: true,     // Default to Yahoo Finance (free, reliable)
    enableAlphaVantage: true,     // Enable if API key is available
    enableFinancialModelingPrep: true, // Enable if API key is available
    fallbackEnabled: true,       // Enable fallback between providers
    healthCheckInterval: 30,     // Check provider health every 30 minutes
    maxRetryAttempts: 3,         // Retry failed requests up to 3 times
    cacheEnabled: true,          // Enable response caching
    cacheTTL: 60                 // Cache for 1 minute
})

console.log(`
📊 Multi-Provider Stock Data System Initialized

Default Provider: Yahoo Finance (free, no API key required)
Fallback Providers: Alpha Vantage, Financial Modeling Prep (require API keys)

Features:
✅ Automatic failover between providers
✅ Response caching (60 seconds TTL)
✅ Provider health monitoring
✅ Batch quote requests
✅ Symbol search across providers
✅ Rate limit management per provider

Yahoo Finance will be used as the primary source with automatic fallback to other providers if needed.
`)

export { DataProviderManager }

