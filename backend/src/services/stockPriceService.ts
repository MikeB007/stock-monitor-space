import axios from 'axios'
import * as cron from 'node-cron'
import { API_CONFIG, API_KEYS } from '../config/apiKeys'

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: string
  lastUpdate: string
}

class StockPriceService {
  private stockDatabase: Record<string, StockData> = {}
  private updateCallback?: (stockData: StockData) => void
  private equityUpdateCallback?: (stockData: StockData) => void
  private btcInitialPrice: number = 114012.00
  private lastBitcoinFetch: number = 0
  private bitcoinFetchInterval: number = 5000 // 5 seconds minimum between API calls
  private bitcoinApiErrors: number = 0
  private subscribedEquities: Set<string> = new Set()
  private useRealPrices: boolean = true // Default to real prices
  private equityUpdateJob: any = null // Store the cron job reference

  constructor() {
    this.initializeSampleStocks()
    this.initializeBitcoinPrice()
  }

  public setRealPricesMode(enabled: boolean) {
    this.useRealPrices = enabled
    console.log(`💰 Price mode changed to: ${enabled ? 'REAL PRICES' : 'SIMULATED PRICES'}`)

    // Restart equity updates with new mode
    this.restartEquityUpdates()
  }

  public isUsingRealPrices(): boolean {
    return this.useRealPrices
  }

  private async initializeBitcoinPrice() {
    try {
      await this.fetchRealBitcoinPrice()
    } catch (error) {
      console.warn('Failed to fetch initial Bitcoin price, using fallback:', error)
    }
  }

  private async fetchRealBitcoinPrice(): Promise<void> {
    // Rate limiting: don't fetch more often than every 5 seconds
    const now = Date.now()
    if (now - this.lastBitcoinFetch < this.bitcoinFetchInterval) {
      return
    }

    this.lastBitcoinFetch = now

    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'bitcoin',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_market_cap: true,
          include_24hr_vol: true
        },
        timeout: 3000 // Reduced timeout for faster responses
      })

      const bitcoinData = response.data.bitcoin
      if (bitcoinData && bitcoinData.usd) {
        const currentPrice = bitcoinData.usd
        const change24h = bitcoinData.usd_24h_change || 0
        const marketCap = bitcoinData.usd_market_cap || 0
        const volume24h = bitcoinData.usd_24h_vol || 0

        // Calculate change from initial price if this is first fetch
        if (!this.stockDatabase['BTC']) {
          this.btcInitialPrice = currentPrice
        }

        const change = currentPrice - this.btcInitialPrice
        const changePercent = (change / this.btcInitialPrice) * 100

        this.stockDatabase['BTC'] = {
          symbol: 'BTC',
          name: 'Bitcoin',
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          volume: volume24h,
          marketCap: `$${(marketCap / 1e12).toFixed(2)}T`,
          lastUpdate: new Date().toISOString()
        }

        // Broadcast update if callback is set
        if (this.updateCallback) {
          this.updateCallback(this.stockDatabase['BTC'])
        }

        // Reset error counter on successful fetch
        this.bitcoinApiErrors = 0

        console.log(`🔄 Bitcoin price updated: $${currentPrice.toFixed(2)} (24h change: ${change24h.toFixed(2)}%)`)
      }
    } catch (error) {
      this.bitcoinApiErrors++
      console.error(`Failed to fetch Bitcoin price from CoinGecko (attempt ${this.bitcoinApiErrors}):`, error)

      // If too many errors, increase fetch interval to avoid hitting rate limits
      if (this.bitcoinApiErrors >= 3) {
        this.bitcoinFetchInterval = 10000 // Increase to 10 seconds
        console.warn('Multiple Bitcoin API errors detected, reducing fetch frequency')
      }

      // Fallback to simulated price if Bitcoin doesn't exist
      if (!this.stockDatabase['BTC']) {
        this.updateStockPrice('BTC')
      }
    }
  }

  private initializeSampleStocks() {
    const sampleStocks = [
      // Tech Giants
      { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 175.00, marketCap: '$2.7T' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 2430.00, marketCap: '$1.6T' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 378.00, marketCap: '$2.8T' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 142.00, marketCap: '$1.5T' },
      { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 235.00, marketCap: '$750B' },

      // Crypto
      { symbol: 'BTC', name: 'Bitcoin', basePrice: 114012.00, marketCap: '$830B' },
      { symbol: 'ETH', name: 'Ethereum', basePrice: 3201.00, marketCap: '$385B' },
      { symbol: 'ADA', name: 'Cardano', basePrice: 0.45, marketCap: '$16B' },
      { symbol: 'DOT', name: 'Polkadot', basePrice: 6.23, marketCap: '$7.8B' },
      { symbol: 'SOL', name: 'Solana', basePrice: 98.45, marketCap: '$42B' },

      // Finance
      { symbol: 'JPM', name: 'JPMorgan Chase', basePrice: 165.00, marketCap: '$485B' },
      { symbol: 'BAC', name: 'Bank of America', basePrice: 32.50, marketCap: '$265B' },
      { symbol: 'WFC', name: 'Wells Fargo', basePrice: 45.25, marketCap: '$175B' },
      { symbol: 'GS', name: 'Goldman Sachs', basePrice: 425.00, marketCap: '$145B' },
      { symbol: 'C', name: 'Citigroup Inc.', basePrice: 51.20, marketCap: '$95B' }
    ]

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
        lastUpdate: new Date().toISOString()
      }
    })
  }

  private generateRandomPrice(basePrice: number): number {
    // Generate price movement between -3% to +3%
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

    // Skip Bitcoin since it gets real data
    if (symbol === 'BTC') {
      return
    }

    // Get current price as new base for realistic movement
    const currentPrice = stock.price

    // Generate small price movement (-1% to +1%)
    const changePercent = (Math.random() - 0.5) * 2
    const newPrice = Math.max(0.01, currentPrice * (1 + changePercent / 100))

    // Calculate change from original base price (for display)
    const originalPrice = this.getOriginalPrice(symbol)
    const totalChange = newPrice - originalPrice
    const totalChangePercent = (totalChange / originalPrice) * 100

    this.stockDatabase[symbol] = {
      ...stock,
      price: newPrice,
      change: totalChange,
      changePercent: totalChangePercent,
      volume: this.generateRandomVolume(),
      lastUpdate: new Date().toISOString()
    }

    // Broadcast update
    if (this.updateCallback) {
      this.updateCallback(this.stockDatabase[symbol])
    }
  } private getOriginalPrice(symbol: string): number {
    // Base prices for reference
    const basePrices: Record<string, number> = {
      'AAPL': 175.00, 'GOOGL': 2430.00, 'MSFT': 378.00, 'AMZN': 142.00, 'TSLA': 235.00,
      'BTC': 114012.00, 'ETH': 3201.00, 'ADA': 0.45, 'DOT': 6.23, 'SOL': 98.45,
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

    // Update simulated stock prices every 5 seconds
    cron.schedule('*/5 * * * * *', () => {
      const symbols = Object.keys(this.stockDatabase).filter(symbol => symbol !== 'BTC')

      // Update 1-3 random stocks each cycle (excluding Bitcoin)
      const numUpdates = Math.floor(Math.random() * 3) + 1
      const symbolsToUpdate = symbols
        .sort(() => Math.random() - 0.5)
        .slice(0, numUpdates)

      symbolsToUpdate.forEach(symbol => {
        this.updateStockPrice(symbol)
      })
    })

    // Update Bitcoin price every 5 seconds from real API
    cron.schedule('*/5 * * * * *', () => {
      this.fetchRealBitcoinPrice()
    })

    console.log('📈 Stock price service started - Broadcasting real-time updates')
    console.log('₿ Bitcoin real-time price fetching enabled via CoinGecko API (5-second updates)')
  }

  public getStock(symbol: string): StockData | null {
    return this.stockDatabase[symbol] || null
  }

  public getAllStocks(): StockData[] {
    return Object.values(this.stockDatabase)
  }

  // Equity subscription management
  public async subscribeToEquities(symbols: string[], callback: (stockData: StockData) => void) {
    this.equityUpdateCallback = callback

    // Add symbols to subscription list and initialize them
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase()
      this.subscribedEquities.add(upperSymbol)

      // Initialize stock with real data if possible
      await this.initializeEquityWithRealData(upperSymbol)

      // Send initial data
      if (this.stockDatabase[upperSymbol]) {
        callback(this.stockDatabase[upperSymbol])
      }
    }

    console.log(`📊 Subscribed to equities with real-time data: ${Array.from(this.subscribedEquities).join(', ')}`)
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

  private async initializeEquityWithRealData(symbol: string) {
    try {
      // First try to get real-time data from external APIs
      const realData = await this.fetchRealEquityData(symbol)

      if (realData) {
        // Use real data from API
        this.stockDatabase[symbol] = {
          symbol,
          name: realData.name,
          price: realData.basePrice,
          change: 0, // Initial change is 0
          changePercent: 0,
          volume: this.generateRandomVolume(),
          marketCap: realData.marketCap,
          lastUpdate: new Date().toISOString()
        }
        console.log(`✅ Initialized ${symbol} with REAL data: ${realData.name} at $${realData.basePrice.toFixed(2)}`)
        return
      }
    } catch (error) {
      console.warn(`⚠️ Failed to fetch real data for ${symbol}, falling back to simulated:`, error)
    }

    // Fallback to original simulated data method
    await this.initializeEquity(symbol)
  }

  private async fetchRealEquityPrice(symbol: string): Promise<{ price: number, change: number, changePercent: number, volume: number } | null> {
    // Try to fetch current real-time price data
    try {
      // Try Yahoo Finance first (most reliable free API)
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const data = response.data?.chart?.result?.[0]
      if (!data || !data.meta) return null

      const meta = data.meta
      const currentPrice = meta.regularMarketPrice || meta.previousClose
      const previousClose = meta.previousClose || currentPrice
      const volume = meta.regularMarketVolume || this.generateRandomVolume()

      const change = currentPrice - previousClose
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

      return {
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: volume
      }
    } catch (error) {
      console.warn(`Failed to fetch real price for ${symbol}:`, error)
      return null
    }
  }

  private async initializeEquity(symbol: string) {
    const equityData = await this.getEquityBaseData(symbol)
    if (!equityData) {
      console.warn(`❌ Failed to initialize equity data for symbol: ${symbol}`)
      return
    }

    const price = this.generateRandomPrice(equityData.basePrice)
    const change = price - equityData.basePrice
    const changePercent = (change / equityData.basePrice) * 100

    this.stockDatabase[symbol] = {
      symbol,
      name: equityData.name,
      price,
      change,
      changePercent,
      volume: this.generateRandomVolume(),
      marketCap: equityData.marketCap,
      lastUpdate: new Date().toISOString()
    }

    console.log(`✅ Initialized equity: ${symbol} (${equityData.name}) at $${price.toFixed(2)}`)
  }

  private async getEquityBaseData(symbol: string): Promise<{ name: string, basePrice: number, marketCap: string } | null> {
    const upperSymbol = symbol.toUpperCase()

    // First try to fetch from external APIs
    try {
      const realData = await this.fetchRealEquityData(upperSymbol)
      if (realData) {
        console.log(`✅ Fetched real data for ${upperSymbol}: ${realData.name} at $${realData.basePrice}`)
        return realData
      }
    } catch (error) {
      console.warn(`⚠️ Failed to fetch real data for ${upperSymbol}, using fallback:`, error)
    }

    // Fallback to local database for known symbols
    const localEquityDatabase: Record<string, { name: string, basePrice: number, marketCap: string }> = {
      // Core requested securities
      'AAPL': { name: 'Apple Inc.', basePrice: 175.00, marketCap: '$2.7T' },
      'SMR': { name: 'NuScale Power Corp', basePrice: 14.25, marketCap: '$3.8B' },
      'IONX': { name: 'Ioneer Ltd', basePrice: 0.89, marketCap: '$142M' },
      'IBM': { name: 'International Business Machines', basePrice: 230.50, marketCap: '$213B' },

      // Major Tech Stocks (fallback data)
      'GOOGL': { name: 'Alphabet Inc.', basePrice: 2430.00, marketCap: '$1.6T' },
      'MSFT': { name: 'Microsoft Corp.', basePrice: 378.00, marketCap: '$2.8T' },
      'AMZN': { name: 'Amazon.com Inc.', basePrice: 142.00, marketCap: '$1.5T' },
      'TSLA': { name: 'Tesla Inc.', basePrice: 235.00, marketCap: '$750B' },
      'META': { name: 'Meta Platforms Inc.', basePrice: 325.00, marketCap: '$830B' },
      'NVDA': { name: 'NVIDIA Corp.', basePrice: 485.00, marketCap: '$1.2T' }
    }

    if (localEquityDatabase[upperSymbol]) {
      console.log(`📚 Using local fallback data for ${upperSymbol}`)
      return localEquityDatabase[upperSymbol]
    }

    // Final fallback: Generate dynamic data for unknown symbols
    console.log(`⚠️ Unknown equity symbol: ${symbol} - generating dynamic entry`)

    const basePrice = this.generateDynamicBasePrice(symbol)
    const marketCap = this.generateDynamicMarketCap(basePrice)

    return {
      name: `${symbol} Corporation`,
      basePrice: basePrice,
      marketCap: marketCap
    }
  }

  private async fetchRealEquityData(symbol: string): Promise<{ name: string, basePrice: number, marketCap: string } | null> {
    // Try multiple financial data sources in order of preference

    // 1. Try Yahoo Finance (free, no API key required)
    if (API_CONFIG.APIS.YAHOO_FINANCE) {
      try {
        const yahooData = await this.fetchFromYahooFinance(symbol)
        if (yahooData) return yahooData
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`Yahoo Finance failed for ${symbol}:`, errorMessage)
      }
    }

    // 2. Try Alpha Vantage (requires free API key)
    if (API_CONFIG.APIS.ALPHA_VANTAGE && API_KEYS.ALPHA_VANTAGE !== 'demo') {
      try {
        const alphaData = await this.fetchFromAlphaVantage(symbol)
        if (alphaData) return alphaData
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`Alpha Vantage failed for ${symbol}:`, errorMessage)
      }
    }

    // 3. Try Financial Modeling Prep (free tier available)
    if (API_CONFIG.APIS.FINANCIAL_MODELING_PREP && API_KEYS.FINANCIAL_MODELING_PREP !== 'demo') {
      try {
        const fmpData = await this.fetchFromFMP(symbol)
        if (fmpData) return fmpData
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`Financial Modeling Prep failed for ${symbol}:`, errorMessage)
      }
    }

    return null
  } private async fetchFromYahooFinance(symbol: string): Promise<{ name: string, basePrice: number, marketCap: string } | null> {
    try {
      // Using Yahoo Finance query API (public endpoint)
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
        timeout: API_CONFIG.TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const data = response.data?.chart?.result?.[0]
      if (!data) return null

      const meta = data.meta
      const currentPrice = meta.regularMarketPrice || meta.previousClose
      const companyName = meta.longName || meta.shortName || `${symbol} Inc.`

      // Get market cap if available
      let marketCap = 'N/A'
      if (meta.marketCap) {
        const cap = meta.marketCap
        if (cap >= 1e12) marketCap = `$${(cap / 1e12).toFixed(1)}T`
        else if (cap >= 1e9) marketCap = `$${(cap / 1e9).toFixed(1)}B`
        else if (cap >= 1e6) marketCap = `$${(cap / 1e6).toFixed(0)}M`
        else marketCap = `$${cap.toFixed(0)}`
      }

      return {
        name: companyName,
        basePrice: currentPrice,
        marketCap: marketCap
      }
    } catch (error) {
      throw new Error(`Yahoo Finance API error: ${error}`)
    }
  }

  private async fetchFromAlphaVantage(symbol: string): Promise<{ name: string, basePrice: number, marketCap: string } | null> {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: API_KEYS.ALPHA_VANTAGE
        },
        timeout: API_CONFIG.TIMEOUT
      })

      const quote = response.data['Global Quote']
      if (!quote || !quote['05. price']) return null

      const currentPrice = parseFloat(quote['05. price'])

      return {
        name: `${symbol} Corporation`,
        basePrice: currentPrice,
        marketCap: 'N/A'  // Alpha Vantage basic quote doesn't include market cap
      }
    } catch (error) {
      throw new Error(`Alpha Vantage API error: ${error}`)
    }
  } private async fetchFromFMP(symbol: string): Promise<{ name: string, basePrice: number, marketCap: string } | null> {
    // Financial Modeling Prep offers free tier
    // API key can be obtained from https://financialmodelingprep.com/developer/docs
    const API_KEY = 'demo'  // Replace with real API key

    try {
      const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}`, {
        params: {
          apikey: API_KEY
        },
        timeout: 3000
      })

      const data = response.data?.[0]
      if (!data || !data.price) return null

      let marketCap = 'N/A'
      if (data.marketCap) {
        const cap = data.marketCap
        if (cap >= 1e12) marketCap = `$${(cap / 1e12).toFixed(1)}T`
        else if (cap >= 1e9) marketCap = `$${(cap / 1e9).toFixed(1)}B`
        else if (cap >= 1e6) marketCap = `$${(cap / 1e6).toFixed(0)}M`
        else marketCap = `$${cap.toFixed(0)}`
      }

      return {
        name: data.name || `${symbol} Corporation`,
        basePrice: data.price,
        marketCap: marketCap
      }
    } catch (error) {
      throw new Error(`Financial Modeling Prep API error: ${error}`)
    }
  } private generateDynamicBasePrice(symbol: string): number {
    // Generate semi-realistic prices based on symbol characteristics
    const symbolLength = symbol.length
    const firstChar = symbol.charCodeAt(0)

    // Create deterministic but varied pricing
    const seed = symbolLength * firstChar
    const priceRange = [
      [0.50, 5.00],     // Penny stocks
      [5.00, 25.00],    // Small cap
      [25.00, 100.00],  // Mid cap
      [100.00, 500.00], // Large cap
      [500.00, 2000.00] // Mega cap
    ]

    const rangeIndex = seed % priceRange.length
    const [min, max] = priceRange[rangeIndex]

    return Number((min + (Math.random() * (max - min))).toFixed(2))
  }

  private generateDynamicMarketCap(basePrice: number): string {
    // Generate market cap based on stock price
    if (basePrice < 5) return `$${(Math.random() * 500 + 50).toFixed(0)}M`
    if (basePrice < 25) return `$${(Math.random() * 5 + 1).toFixed(1)}B`
    if (basePrice < 100) return `$${(Math.random() * 50 + 5).toFixed(0)}B`
    if (basePrice < 500) return `$${(Math.random() * 500 + 50).toFixed(0)}B`
    return `$${(Math.random() * 2 + 1).toFixed(1)}T`
  }

  public startEquityUpdates() {
    this.stopEquityUpdates() // Stop any existing updates first

    if (this.useRealPrices) {
      // Update subscribed equities every 10 seconds with real data
      this.equityUpdateJob = cron.schedule('*/10 * * * * *', async () => {
        if (this.subscribedEquities.size === 0) return

        // Update all subscribed equities with real prices
        for (const symbol of this.subscribedEquities) {
          await this.updateEquityWithRealPrice(symbol)
        }
      })

      console.log('📊 Equity update service started - 10-second intervals with REAL price data for subscribed securities')
    } else {
      // Update subscribed equities every 1 second with simulated data
      this.equityUpdateJob = cron.schedule('* * * * * *', () => {
        if (this.subscribedEquities.size === 0) return

        // Update all subscribed equities with simulated prices
        this.subscribedEquities.forEach(symbol => {
          this.updateStockPrice(symbol)

          // Send update if callback is set
          if (this.equityUpdateCallback && this.stockDatabase[symbol]) {
            this.equityUpdateCallback(this.stockDatabase[symbol])
          }
        })
      })

      console.log('📊 Equity update service started - 1-second intervals with SIMULATED price data for subscribed securities')
    }
  }

  private stopEquityUpdates() {
    if (this.equityUpdateJob) {
      this.equityUpdateJob.stop()
      this.equityUpdateJob = null
      console.log('📊 Stopped existing equity update service')
    }
  }

  private restartEquityUpdates() {
    console.log('🔄 Restarting equity update service with new price mode...')
    this.startEquityUpdates()
  }

  private async updateEquityWithRealPrice(symbol: string) {
    const existingStock = this.stockDatabase[symbol]
    if (!existingStock) return

    try {
      // Try to fetch real-time price data
      const realPriceData = await this.fetchRealEquityPrice(symbol)

      if (realPriceData) {
        // Update with real data
        this.stockDatabase[symbol] = {
          ...existingStock,
          price: realPriceData.price,
          change: realPriceData.change,
          changePercent: realPriceData.changePercent,
          volume: realPriceData.volume,
          lastUpdate: new Date().toISOString()
        }

        console.log(`📈 Real price update for ${symbol}: $${realPriceData.price.toFixed(2)} (${realPriceData.changePercent.toFixed(2)}%)`)

        // Send update if callback is set
        if (this.equityUpdateCallback) {
          this.equityUpdateCallback(this.stockDatabase[symbol])
        }
      } else {
        // Fallback to simulated update if real data fails
        this.updateStockPrice(symbol)
        if (this.equityUpdateCallback && this.stockDatabase[symbol]) {
          this.equityUpdateCallback(this.stockDatabase[symbol])
        }
      }
    } catch (error) {
      console.warn(`Failed to update real price for ${symbol}, using simulated data:`, error)
      // Fallback to simulated update
      this.updateStockPrice(symbol)
      if (this.equityUpdateCallback && this.stockDatabase[symbol]) {
        this.equityUpdateCallback(this.stockDatabase[symbol])
      }
    }
  }
}

export const stockPriceService = new StockPriceService()