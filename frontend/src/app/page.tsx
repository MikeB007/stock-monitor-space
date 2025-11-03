'use client'

import { Activity, TrendingDown, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import io from 'socket.io-client'

interface BitcoinData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: string
  lastUpdate: string
  priceHistory: PricePoint[]
}

interface EquityData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: string
  lastUpdate: string
  sector?: string
  industry?: string

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

interface PricePoint {
  timestamp: string
  price: number
  change: number
}

interface TimeInterval {
  id: string
  label: string
  duration: number // minutes
}

const TIME_INTERVALS: TimeInterval[] = [
  { id: '1m', label: '1M', duration: 1 },
  { id: '5m', label: '5M', duration: 5 },
  { id: '30m', label: '30M', duration: 30 },
  { id: '1h', label: '1H', duration: 60 },
  { id: '3h', label: '3H', duration: 180 },
  { id: '5h', label: '5H', duration: 300 },
  { id: '8h', label: '8H', duration: 480 },
  { id: '1d', label: '1D', duration: 1440 },
  { id: '3d', label: '3D', duration: 4320 },
  { id: '5d', label: '5D', duration: 7200 },
  { id: '8d', label: '8D', duration: 11520 },
  { id: '13d', label: '13D', duration: 18720 },
  { id: '1mo', label: '1MO', duration: 43200 },
  { id: '3mo', label: '3MO', duration: 129600 },
  { id: '5mo', label: '5MO', duration: 216000 },
  { id: '8mo', label: '8MO', duration: 345600 },
  { id: '13mo', label: '13MO', duration: 561600 },
  { id: '1y', label: '1Y', duration: 525600 },
  { id: '3y', label: '3Y', duration: 1576800 },
  { id: '5y', label: '5Y', duration: 2628000 }
]

// Exchange and market detection helper
const getExchangeInfo = (symbol: string) => {
  const symbolUpper = symbol.toUpperCase()

  // Exchange suffix mapping - EXPLICIT suffixes take priority
  const exchangeMap: { [key: string]: { exchange: string, country: string, flag: string } } = {
    // Canadian Markets - IMPROVED: Check multiple exchanges for .CA
    '.TO': { exchange: 'TSX', country: 'Canada', flag: '🇨🇦' },
    '.V': { exchange: 'TSXV', country: 'Canada', flag: '🇨🇦' },
    '.CN': { exchange: 'CSE', country: 'Canada', flag: '🇨🇦' },
    '.NE': { exchange: 'NEO', country: 'Canada', flag: '🇨🇦' },
    
    // European Markets
    '.L': { exchange: 'LSE', country: 'UK', flag: '🇬🇧' },
    '.PA': { exchange: 'Euronext Paris', country: 'France', flag: '🇫🇷' },
    '.AS': { exchange: 'Euronext Amsterdam', country: 'Netherlands', flag: '🇳🇱' },
    '.BR': { exchange: 'Euronext Brussels', country: 'Belgium', flag: '🇧🇪' },
    '.DE': { exchange: 'XETRA', country: 'Germany', flag: '🇩🇪' },
    '.F': { exchange: 'Frankfurt', country: 'Germany', flag: '🇩🇪' },
    
    // Asia-Pacific Markets
    '.HK': { exchange: 'HKEX', country: 'Hong Kong', flag: '🇭🇰' },
    '.T': { exchange: 'TSE', country: 'Japan', flag: '🇯🇵' },
    '.AX': { exchange: 'ASX', country: 'Australia', flag: '🇦🇺' },
    
    // Other Markets
    '.SA': { exchange: 'B3', country: 'Brazil', flag: '🇧🇷' },
    '.MC': { exchange: 'BME', country: 'Spain', flag: '🇪🇸' },
    '.MI': { exchange: 'Borsa Italiana', country: 'Italy', flag: '🇮🇹' }
  }

  // IMPROVED: Handle .CA suffix by checking multiple Canadian exchanges
  if (symbolUpper.endsWith('.CA')) {
    return {
      exchange: 'Multi-Canadian', // Indicates multiple exchanges need to be checked
      country: 'Canada',
      flag: '🇨🇦',
      isInternational: true,
      displaySymbol: symbolUpper,
      needsValidation: true, // Flag to trigger backend validation
      candidateSymbols: [
        symbolUpper.replace('.CA', '.TO'),  // TSX
        symbolUpper.replace('.CA', '.V'),   // TSX-V  
        symbolUpper.replace('.CA', '.CN'),  // CSE
        symbolUpper.replace('.CA', '.NE')   // NEO
      ]
    }
  }

  // PRIORITY 1: Check for explicit exchange suffix (TD.TO, 5LA1.DE, etc.)
  for (const [suffix, info] of Object.entries(exchangeMap)) {
    if (symbolUpper.endsWith(suffix)) {
      const isCanadianExchange = info.country === 'Canada'
      return {
        ...info,
        isInternational: !isCanadianExchange,
        displaySymbol: symbolUpper,
        needsValidation: false // These are explicit, no validation needed
      }
    }
  }

  // PRIORITY 2: For symbols WITHOUT suffixes, assume US market first, then global detection

  // Global exchange detection based on symbol characteristics
  const getGlobalExchange = (symbol: string): { exchange: string, country: string, flag: string } => {
    const symbolLength = symbol.length
    const hash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    const firstChar = symbol.charAt(0)
    const lastChar = symbol.charAt(symbol.length - 1)
    
    // IMPROVED LOGIC: Most clean symbols (no suffix) are US-primary listings
    // This includes: AAPL, MSFT, GOOGL, TD, SHOP, etc.
    // Only apply geographic distribution to symbols that aren't obviously US stocks
    
    // Common US stock patterns - default to US markets
    const isLikelyUSStock = (
      // 1-5 character clean symbols are typically US (AAPL, MSFT, TD, etc.)
      (symbol.length >= 1 && symbol.length <= 5 && /^[A-Z]+$/.test(symbol)) ||
      // Well-known US patterns
      symbol.match(/^[A-Z]{1,4}$/) ||  // Most 1-4 letter symbols are US
      // Tech company patterns
      symbol.includes('META') || symbol.includes('GOOGL') || symbol.includes('AMZN')
    )
    
    if (isLikelyUSStock) {
      // Distribute among major US exchanges based on symbol characteristics
      const usExchanges = [
        { name: 'NYSE', weight: 45 },      // Large cap, traditional companies  
        { name: 'NASDAQ', weight: 40 },    // Tech, growth companies
        { name: 'AMEX', weight: 8 },       // Mid/small cap
        { name: 'BATS', weight: 4 },       // Alternative exchange
        { name: 'IEX', weight: 2 },        // Investor Exchange
        { name: 'ARCA', weight: 1 }        // Archipelago
      ]
      
      let weightedIndex = hash % 100
      for (const exchange of usExchanges) {
        weightedIndex -= exchange.weight
        if (weightedIndex <= 0) {
          return { exchange: exchange.name, country: 'USA', flag: '🇺🇸' }
        }
      }
      return { exchange: 'NYSE', country: 'USA', flag: '🇺🇸' }
    }
    
    // Detect potential OTC symbols (often have unusual patterns)
    const isLikelyOTC = symbol.length >= 4 && (
      symbol.endsWith('F') || // Many foreign OTC stocks end in F
      symbol.includes('Q') ||  // Bankruptcy/delisted often have Q
      /[0-9]/.test(symbol) ||  // Some OTC have numbers
      symbol.length > 5        // Very long symbols often OTC
    )
    
    if (isLikelyOTC) {
      const otcMarkets = ['OTCQX', 'OTCQB', 'Pink Sheets', 'Grey Market']
      const otcWeights = [30, 25, 35, 10]
      let weightedIndex = hash % 100
      
      for (let i = 0; i < otcWeights.length; i++) {
        weightedIndex -= otcWeights[i]
        if (weightedIndex <= 0) {
          return { exchange: otcMarkets[i], country: 'USA', flag: '🇺🇸' }
        }
      }
      return { exchange: 'OTCQX', country: 'USA', flag: '🇺🇸' }
    }
    
    // For non-US stocks or unusual symbols, distribute globally
    // This handles international symbols, unusual patterns, etc.
    const exchanges = [
      // Europe (35%)
      { name: 'LSE', country: 'United Kingdom', flag: '��', weight: 12 },
      { name: 'Euronext', country: 'Europe', flag: '🇪🇺', weight: 8 },
      { name: 'XETRA', country: 'Germany', flag: '��', weight: 6 },
      { name: 'SIX', country: 'Switzerland', flag: '🇨�', weight: 3 },
      { name: 'Borsa Italiana', country: 'Italy', flag: '🇮🇹', weight: 2 },
      { name: 'BME', country: 'Spain', flag: '�🇸', weight: 2 },
      { name: 'Stockholm', country: 'Sweden', flag: '🇪', weight: 1 },
      { name: 'Oslo Børs', country: 'Norway', flag: '��', weight: 1 },
      
      // Asia-Pacific (35%)
      { name: 'Tokyo', country: 'Japan', flag: '🇯🇵', weight: 12 },
      { name: 'Shanghai', country: 'China', flag: '��', weight: 8 },
      { name: 'Hong Kong', country: 'Hong Kong', flag: '🇭🇰', weight: 6 },
      { name: 'ASX', country: 'Australia', flag: '�🇺', weight: 4 },
      { name: 'BSE', country: 'India', flag: '🇮🇳', weight: 3 },
      { name: 'SGX', country: 'Singapore', flag: '��', weight: 1 },
      { name: 'KOSPI', country: 'South Korea', flag: '🇰🇷', weight: 1 },
      
      // North America Non-US (20%)  
      { name: 'TSX', country: 'Canada', flag: '🇨🇦', weight: 15 },
      { name: 'TSX-V', country: 'Canada', flag: '🇨�', weight: 3 },
      { name: 'BMV', country: 'Mexico', flag: '🇲🇽', weight: 2 },
      
      // Emerging Markets (10%)
      { name: 'Bovespa', country: 'Brazil', flag: '��', weight: 4 },
      { name: 'JSE', country: 'South Africa', flag: '��', weight: 2 },
      { name: 'TSE', country: 'Taiwan', flag: '��', weight: 2 },
      { name: 'SET', country: 'Thailand', flag: '��', weight: 1 },
      { name: 'EGX', country: 'Egypt', flag: '🇪🇬', weight: 1 }
    ]
    
    // Weighted selection based on global market distribution
    let weightedIndex = hash % 100
    
    for (const exchange of exchanges) {
      weightedIndex -= exchange.weight
      if (weightedIndex <= 0) {
        return {
          exchange: exchange.name,
          country: exchange.country,
          flag: exchange.flag
        }
      }
    }
    
    // Fallback to NYSE
    return { exchange: 'NYSE', country: 'USA', flag: '🇺🇸' }
  }
  
  const globalExchange = getGlobalExchange(symbolUpper)

  return {
    exchange: globalExchange.exchange,
    country: globalExchange.country,
    flag: globalExchange.flag,
    isInternational: globalExchange.country !== 'USA',
    displaySymbol: symbolUpper
  }
}

interface User {
  id: number
  username: string
  email?: string
}

interface Portfolio {
  id: number
  user_id: number
  name: string
  description?: string
}

function StockMonitorComponent() {
  const [bitcoinData, setBitcoinData] = useState<BitcoinData | null>(null)
  const [activeInterval, setActiveInterval] = useState<string>('5m')
  const [connected, setConnected] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])

  // User and Portfolio management
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [currentPortfolio, setCurrentPortfolio] = useState<Portfolio | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPortfolioName, setNewPortfolioName] = useState('')

  // Equity state management
  const [equityData, setEquityData] = useState<Record<string, EquityData>>({})
  const [subscribedEquities, setSubscribedEquities] = useState<string[]>([])
  const [newEquity, setNewEquity] = useState<string>('')
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string>('')
  const [equityPriceHistory, setEquityPriceHistory] = useState<Record<string, PricePoint[]>>({})
  const [useRealPrices, setUseRealPrices] = useState(true)
  const [socket, setSocket] = useState<any>(null)
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true)
  const [performanceData, setPerformanceData] = useState<Record<string, {
    percentChange: number | null
    priceChange: number | null
    earliestPrice: number | null
    earliestDate: string | null
    hasData: boolean
  }>>({})
  const [intervalData, setIntervalData] = useState<Record<string, Record<string, {
    percentChange: number | null
    priceChange: number | null
    hasData: boolean
  }>>>({})



  // OCR state management
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false)
  const [ocrResults, setOcrResults] = useState<any>(null)
  const [showOcrResults, setShowOcrResults] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Generate or retrieve browser ID from localStorage
  const getBrowserId = () => {
    let browserId = localStorage.getItem('stock_monitor_browser_id')
    if (!browserId) {
      browserId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('stock_monitor_browser_id', browserId)
    }
    return browserId
  }

  // Load users on mount and restore last viewed state
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/users')
        if (response.ok) {
          const data = await response.json()
          setUsers(data.data)
          
          // Try to restore last viewed user from preferences
          const browserId = getBrowserId()
          const prefsResponse = await fetch(`http://localhost:4000/api/preferences/${browserId}`)
          
          if (prefsResponse.ok) {
            const prefsData = await prefsResponse.json()
            const lastUserId = prefsData.data.last_viewed_user_id
            
            if (lastUserId) {
              const lastUser = data.data.find((u: User) => u.id === lastUserId)
              if (lastUser) {
                console.log(`💾 Restored last viewed user: ${lastUser.username}`)
                setCurrentUser(lastUser)
                return
              }
            }
          }
          
          // Fallback: Auto-select first user if no preferences found
          if (data.data.length > 0) {
            setCurrentUser(data.data[0])
          }
        }
      } catch (error) {
        console.error('❌ Error loading users:', error)
      }
    }
    loadUsers()
  }, [])

  // Load portfolios when user changes and restore last viewed portfolio
  useEffect(() => {
    if (!currentUser) return

    const loadPortfolios = async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/portfolios/user/${currentUser.id}`)
        if (response.ok) {
          const data = await response.json()
          setPortfolios(data.data)
          
          // Try to restore last viewed portfolio for this user
          if (currentUser.last_viewed_portfolio_id) {
            const lastPortfolio = data.data.find((p: Portfolio) => p.id === currentUser.last_viewed_portfolio_id)
            if (lastPortfolio) {
              console.log(`💾 Restored last viewed portfolio: ${lastPortfolio.name}`)
              setCurrentPortfolio(lastPortfolio)
              return
            }
          }
          
          // Fallback: Auto-select first portfolio if no last viewed found
          if (data.data.length > 0) {
            setCurrentPortfolio(data.data[0])
          } else {
            setCurrentPortfolio(null)
          }
        }
      } catch (error) {
        console.error('❌ Error loading portfolios:', error)
      }
    }
    loadPortfolios()
  }, [currentUser])

  // Load portfolio stocks from database
  useEffect(() => {
    const loadPortfolio = async () => {
      if (!currentPortfolio) {
        setSubscribedEquities([])
        setIsLoadingPortfolio(false)
        setPerformanceData({})
        return
      }

      try {
        setIsLoadingPortfolio(true)
        console.log('🔄 Loading portfolio from database...')

        const response = await fetch(`http://localhost:4000/api/portfolio?portfolio_id=${currentPortfolio.id}`)
        console.log('📡 Portfolio API response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('📊 Portfolio API response data:', data)
          const symbols = data.data.map((stock: any) => stock.symbol)
          console.log('✅ Loaded portfolio from database:', symbols)

          // Set the actual portfolio symbols - even if empty array
          setSubscribedEquities(symbols)

          if (symbols.length === 0) {
            console.log('📝 Portfolio is empty - no stocks to track')
          }

          // Load performance data
          console.log('📊 Loading performance data...')
          const perfResponse = await fetch(`http://localhost:4000/api/portfolio/performance?portfolio_id=${currentPortfolio.id}`)
          if (perfResponse.ok) {
            const perfData = await perfResponse.json()
            console.log('✅ Performance data loaded:', perfData)
            
            // Convert array to object keyed by symbol
            const perfMap: Record<string, any> = {}
            perfData.data.forEach((perf: any) => {
              perfMap[perf.symbol] = {
                percentChange: perf.percentChange,
                priceChange: perf.priceChange,
                earliestPrice: perf.earliestPrice,
                earliestDate: perf.earliestDate,
                hasData: perf.hasData
              }
            })
            setPerformanceData(perfMap)
          }
        } else {
          console.error('❌ Failed to load portfolio:', response.status, response.statusText)
          // Set to empty array if API fails - no fallback defaults
          console.log('🔄 Setting empty portfolio due to API failure')
          setSubscribedEquities([])
          setPerformanceData({})
        }
      } catch (error) {
        console.error('❌ Error loading portfolio:', error)
        // Set to empty array if error occurs - no fallback defaults
        console.log('🔄 Setting empty portfolio due to error')
        setSubscribedEquities([])
        setPerformanceData({})
      } finally {
        setIsLoadingPortfolio(false)
        console.log('✅ Portfolio loading completed')
      }
    }

    loadPortfolio()
  }, [currentPortfolio])

  // Periodically refresh performance data and interval data to show live % changes
  useEffect(() => {
    if (!currentPortfolio) return

    const refreshPerformance = async () => {
      try {
        // Fetch performance data (Total % Change column)
        const perfResponse = await fetch(`http://localhost:4000/api/portfolio/performance?portfolio_id=${currentPortfolio.id}`)
        if (perfResponse.ok) {
          const perfData = await perfResponse.json()
          
          // Convert array to object keyed by symbol
          const perfMap: Record<string, any> = {}
          perfData.data.forEach((perf: any) => {
            perfMap[perf.symbol] = {
              percentChange: perf.percentChange,
              priceChange: perf.priceChange,
              earliestPrice: perf.earliestPrice,
              earliestDate: perf.earliestDate,
              hasData: perf.hasData
            }
          })
          setPerformanceData(perfMap)
          console.log('🔄 Performance data refreshed')
        }

        // Fetch interval data (1M, 5M, 30M, 1H, 3D, 5D, etc. columns)
        const intervalResponse = await fetch(`http://localhost:4000/api/portfolio/intervals?portfolio_id=${currentPortfolio.id}`)
        if (intervalResponse.ok) {
          const intervalDataResponse = await intervalResponse.json()
          
          // Convert array to object keyed by symbol
          const intervalMap: Record<string, any> = {}
          intervalDataResponse.data.forEach((stock: any) => {
            intervalMap[stock.symbol] = stock
          })
          setIntervalData(intervalMap)
          console.log('🔄 Interval data refreshed')
        }
      } catch (error) {
        console.error('❌ Error refreshing performance/interval data:', error)
      }
    }

    // Initial fetch
    refreshPerformance()

    // Refresh data every 30 seconds (matches price recording interval)
    const intervalId = setInterval(refreshPerformance, 30000)

    // Cleanup on unmount or portfolio change
    return () => clearInterval(intervalId)
  }, [currentPortfolio])

  useEffect(() => {
    // Only connect WebSocket after portfolio is loaded
    if (isLoadingPortfolio || subscribedEquities.length === 0) {
      return
    }

    // Connect to WebSocket
    const socketConnection = io('http://localhost:4000')
    setSocket(socketConnection)

    socketConnection.on('connect', () => {
      setConnected(true)
      console.log('Connected to backend')

      // Subscribe to equities on connection
      console.log('Subscribing to equities:', subscribedEquities)
      socketConnection.emit('subscribeEquities', { symbols: subscribedEquities })
    })

    socketConnection.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from backend')
    })

    socketConnection.on('stockUpdate', (data: any) => {
      if (data.symbol === 'BTC') {
        setBitcoinData(data)

        // Add to price history
        const newPoint: PricePoint = {
          timestamp: data.lastUpdate,
          price: data.price,
          change: data.change
        }

        setPriceHistory(prev => {
          const updated = [...prev, newPoint]
          // Keep only last 100 data points
          return updated.slice(-100)
        })
      } else {
        // Handle equity data
        setEquityData(prev => ({
          ...prev,
          [data.symbol]: data
        }))

        // Add to equity price history
        const newPoint: PricePoint = {
          timestamp: data.lastUpdate,
          price: data.price,
          change: data.change
        }

        setEquityPriceHistory(prev => ({
          ...prev,
          [data.symbol]: [...(prev[data.symbol] || []), newPoint].slice(-100)
        }))
      }
    })

    return () => {
      socketConnection.disconnect()
    }
  }, [subscribedEquities, isLoadingPortfolio])

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? '+' : ''
    return {
      absolute: `${sign}${change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      percent: `${sign}${percent.toFixed(2)}%`
    }
  }

  const getChangeColor = (change: number, intensity: 'light' | 'medium' | 'strong' = 'medium') => {
    const baseColors = {
      positive: {
        light: 'bg-green-100 text-green-800 border-green-300',
        medium: 'bg-green-200 text-green-900 border-green-400',
        strong: 'bg-green-300 text-green-900 border-green-500'
      },
      negative: {
        light: 'bg-red-100 text-red-800 border-red-300',
        medium: 'bg-red-200 text-red-900 border-red-400',
        strong: 'bg-red-300 text-red-900 border-red-500'
      },
      neutral: {
        light: 'bg-blue-100 text-blue-800 border-blue-300',
        medium: 'bg-blue-200 text-blue-900 border-blue-400',
        strong: 'bg-blue-300 text-blue-900 border-blue-500'
      }
    }

    if (change > 0) return baseColors.positive[intensity]
    if (change < 0) return baseColors.negative[intensity]
    return baseColors.neutral[intensity]
  }

  const getIntensityFromChange = (changePercent: number): 'light' | 'medium' | 'strong' => {
    const abs = Math.abs(changePercent)
    if (abs >= 1) return 'strong'
    if (abs >= 0.1) return 'medium'
    return 'light'
  }

  const calculateIntervalData = (interval: string) => {
    if (priceHistory.length === 0) return null

    const duration = TIME_INTERVALS.find(i => i.id === interval)?.duration || 5
    const now = new Date()
    const targetTime = new Date(now.getTime() - duration * 60 * 1000)

    // Get the current price (most recent data point)
    const currentPoint = priceHistory[priceHistory.length - 1]
    if (!currentPoint) return null

    // Find the closest data point to the target time (timeframe ago)
    let closestPoint = null
    let closestTimeDiff = Infinity

    for (const point of priceHistory) {
      const pointTime = new Date(point.timestamp)
      const timeDiff = Math.abs(pointTime.getTime() - targetTime.getTime())

      // Only consider points that are reasonably close to the target time
      // Allow up to 50% tolerance for the timeframe
      const maxAllowedDiff = (duration * 60 * 1000) * 0.5

      if (timeDiff <= maxAllowedDiff && timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff
        closestPoint = point
      }
    }

    // If no suitable historical point found, return null
    if (!closestPoint) return null

    // Calculate percentage change from that specific timeframe ago
    const change = currentPoint.price - closestPoint.price
    const changePercent = (change / closestPoint.price) * 100

    return {
      change,
      changePercent,
      dataPoints: priceHistory.length,
      timeDiff: closestTimeDiff / (60 * 1000) // in minutes
    }
  }

  const addEquity = async () => {
    const inputText = newEquity.trim().toUpperCase()

    // Clear previous validation error
    setValidationError('')

    if (!inputText) {
      setValidationError('Please enter stock symbol(s)')
      return
    }

    // Parse multiple symbols separated by spaces, commas, or semicolons
    const symbolsToAdd = inputText
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter((symbol, index, array) => array.indexOf(symbol) === index) // Remove duplicates

    if (symbolsToAdd.length === 0) {
      setValidationError('Please enter valid stock symbol(s)')
      return
    }

    // Enhanced symbol format validation for international exchanges
    const validateSymbolFormat = (symbol: string) => {

      const patterns = [
        /^[A-Z]{1,8}$/, // Basic symbol (1-8 letters for international)
        /^[A-Z]{1,8}\.[A-Z]{1,3}$/, // Symbol with exchange suffix 
        /^[A-Z]{1,8}\.[A-Z]{2,4}$/ // Alternative formats
      ]

      return patterns.some(pattern => pattern.test(symbol))
    }

    // Normalize symbols for better exchange detection
    const normalizeSymbol = (symbol: string) => {
      // Convert common aliases to standard exchange suffixes
      const exchangeMap: { [key: string]: string } = {
        '.CA': '.TO',   // Convert .CA to .TO (Toronto Stock Exchange)
        '.CDN': '.TO',  // Convert .CDN to .TO
        '.CAN': '.TO',  // Convert .CAN to .TO
        '.TSX': '.TO',  // Convert .TSX to .TO
        '.TSXV': '.V',  // Convert .TSXV to .V (TSX Venture Exchange)
        '.TSX-V': '.V', // Convert .TSX-V to .V
        '.VENTURE': '.V' // Convert .VENTURE to .V
      }

      let normalizedSymbol = symbol
      Object.entries(exchangeMap).forEach(([alias, standard]) => {
        if (symbol.endsWith(alias)) {
          normalizedSymbol = symbol.replace(alias, standard)
        }
      })

      return normalizedSymbol
    }

    // Apply normalization and validation
    const normalizedSymbols = symbolsToAdd.map(normalizeSymbol)
    const invalidSymbols = normalizedSymbols.filter(symbol => !validateSymbolFormat(symbol))

    if (invalidSymbols.length > 0) {
      setValidationError(`Invalid symbol format: ${invalidSymbols.join(', ')} - Use formats like: AAPL, TD.TO, BP.L, SAP.DE, or TD.CA (converted to TD.TO)`)
      return
    }

    // Check for already added symbols (using normalized versions)
    const alreadyAdded = normalizedSymbols.filter(symbol => subscribedEquities.includes(symbol))
    if (alreadyAdded.length > 0) {
      setValidationError(`Already added: ${alreadyAdded.join(', ')}`)
      return
    }

    setIsValidating(true)

    try {
      // Validate all normalized symbols with backend
      const validationPromises = normalizedSymbols.map(async (symbol) => {
        const response = await fetch('http://localhost:4000/api/validate-symbol', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol }),
        })
        const result = await response.json()
        return { symbol, ...result }
      })

      const validationResults = await Promise.all(validationPromises)
      const invalidResults = validationResults.filter(result => !result.valid)
      const validResults = validationResults.filter(result => result.valid)

      if (invalidResults.length > 0) {
        const invalidSymbols = invalidResults.map(r => `${r.symbol} (${r.error})`).join(', ')
        setValidationError(`Invalid symbols: ${invalidSymbols}`)

        // If some symbols are valid, show option to add them
        if (validResults.length > 0) {
          const validSymbols = validResults.map(r => r.symbol).join(', ')
          setValidationError(`Invalid symbols: ${invalidSymbols}. Valid symbols found: ${validSymbols}. Click Add again to add only the valid ones.`)
          setNewEquity(validResults.map(r => r.symbol).join(' '))
        }
        return
      }

      // All symbols are valid, add them
      const validSymbols = validResults.map(r => r.symbol)

      // Check if portfolio is selected
      if (!currentPortfolio) {
        setValidationError('Please select a portfolio first')
        return
      }

      // Add stocks to database
      try {
        const addPromises = validSymbols.map(async (symbol) => {
          console.log(`🔍 Adding ${symbol} to portfolio via API...`)
          const response = await fetch('http://localhost:4000/api/portfolio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              symbol,
              portfolio_id: currentPortfolio.id
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error(`❌ Failed to add ${symbol}:`, errorData)
            throw new Error(errorData.error || `Failed to add ${symbol}`)
          }

          const result = await response.json()
          console.log(`✅ Successfully added ${symbol} to database:`, result)
          return result
        })

        await Promise.all(addPromises)
        console.log('✅ All stocks saved to database:', validSymbols)
      } catch (error) {
        console.error('❌ Error saving to database:', error)
        setValidationError(`Database error: ${error.message}`)
        return // Don't continue if database save failed
      }

      const updatedEquities = [...subscribedEquities, ...validSymbols]
      setSubscribedEquities(updatedEquities)
      setNewEquity('')

      // Subscribe to the new equities via WebSocket
      if (socket) {
        socket.emit('subscribeEquities', { symbols: validSymbols })
      }

      // Show success message for multiple symbols
      if (validSymbols.length > 1) {
        console.log(`Successfully added ${validSymbols.length} symbols: ${validSymbols.join(', ')}`)
      }

    } catch (error) {
      console.error('Symbol validation error:', error)
      setValidationError('Unable to validate symbols. Please check your connection.')
    } finally {
      setIsValidating(false)
    }
  }

  const removeEquity = async (symbol: string) => {
    if (!currentPortfolio) return

    // Remove from database first
    try {
      const response = await fetch(`http://localhost:4000/api/portfolio/${currentPortfolio.id}/${symbol}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        console.log('Successfully removed from database:', symbol)
      } else {
        console.error('Failed to remove from database:', symbol)
      }
    } catch (error) {
      console.error('Error removing from database:', error)
      // Continue anyway since local state still works
    }

    const updatedEquities = subscribedEquities.filter(eq => eq !== symbol)
    setSubscribedEquities(updatedEquities)

    // Remove from data
    setEquityData(prev => {
      const updated = { ...prev }
      delete updated[symbol]
      return updated
    })

    setEquityPriceHistory(prev => {
      const updated = { ...prev }
      delete updated[symbol]
      return updated
    })
  }

  // OCR Functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }

      setSelectedFile(file)
      setOcrResults(null)
      setShowOcrResults(false)
    }
  }

  const processImageOCR = async () => {
    if (!selectedFile) {
      alert('Please select an image first')
      return
    }

    setIsProcessingOCR(true)
    setValidationError('')

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)

      console.log('Uploading image for OCR processing...')
      const response = await fetch('http://localhost:4000/api/extract-stocks', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'OCR processing failed')
      }

      console.log('OCR Results:', result.data)
      setOcrResults(result.data)
      setShowOcrResults(true)

    } catch (error) {
      console.error('OCR processing error:', error)
      setValidationError(error instanceof Error ? error.message : 'OCR processing failed')
    } finally {
      setIsProcessingOCR(false)
    }
  }

  const addStockFromOCR = async (stock: any) => {
    if (!currentPortfolio) {
      setValidationError('Please select a portfolio first')
      return
    }

    if (!stock.isValid) {
      setValidationError(`Cannot add ${stock.symbol}: ${stock.reason || 'Invalid symbol'}`)
      return
    }

    if (subscribedEquities.includes(stock.symbol)) {
      setValidationError(`${stock.symbol} is already in your portfolio`)
      return
    }

    // Add to database
    try {
      const response = await fetch('http://localhost:4000/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: stock.symbol,
          portfolio_id: currentPortfolio.id,
          description: `Added via OCR: ${stock.description || ''}`,
          country: stock.country || 'US',
          market: stock.market || 'NASDAQ'
        }),
      })
      if (response.ok) {
        console.log('Successfully saved to database:', stock.symbol)
      }
    } catch (error) {
      console.error('Error saving to database:', error)
      // Continue anyway since local state still works
    }

    // Add to portfolio
    const updatedEquities = [...subscribedEquities, stock.symbol]
    setSubscribedEquities(updatedEquities)

    // Subscribe to the new equity via WebSocket
    if (socket) {
      socket.emit('subscribeEquities', { symbols: [stock.symbol] })
    }

    console.log(`Added ${stock.symbol} to portfolio from OCR`)
  }

  const addAllValidStocksFromOCR = async () => {
    if (!currentPortfolio) {
      setValidationError('Please select a portfolio first')
      return
    }

    if (!ocrResults || !ocrResults.extractedStocks) return

    const validStocks = ocrResults.extractedStocks.filter((stock: any) =>
      stock.isValid && !subscribedEquities.includes(stock.symbol)
    )

    if (validStocks.length === 0) {
      setValidationError('No new valid stocks to add')
      return
    }

    // Add all stocks to database
    try {
      const addPromises = validStocks.map(async (stock: any) => {
        const response = await fetch('http://localhost:4000/api/portfolio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: stock.symbol,
            portfolio_id: currentPortfolio.id,
            description: `Added via OCR: ${stock.description || ''}`,
            country: stock.country || 'US',
            market: stock.market || 'NASDAQ'
          }),
        })
        return response.json()
      })

      await Promise.all(addPromises)
      console.log('Successfully saved all OCR stocks to database')
    } catch (error) {
      console.error('Error saving OCR stocks to database:', error)
      // Continue anyway since local state still works
    }

    const newSymbols = validStocks.map((stock: any) => stock.symbol)
    const updatedEquities = [...subscribedEquities, ...newSymbols]
    setSubscribedEquities(updatedEquities)

    // Subscribe to the new equities via WebSocket
    if (socket) {
      socket.emit('subscribeEquities', { symbols: newSymbols })
    }

    console.log(`Added ${newSymbols.length} stocks to portfolio from OCR:`, newSymbols)
    setShowOcrResults(false)
    setOcrResults(null)
    setSelectedFile(null)
  }

  const calculateEquityIntervalData = (symbol: string, interval: string) => {
    // Get interval data from database
    const stockIntervals = intervalData[symbol]
    if (!stockIntervals) return null

    const intervalInfo = stockIntervals[interval]
    if (!intervalInfo || !intervalInfo.hasData) return null

    return {
      change: intervalInfo.priceChange || 0,
      changePercent: intervalInfo.percentChange || 0,
      hasData: true
    }
  }

  const togglePriceMode = () => {
    const newMode = !useRealPrices
    setUseRealPrices(newMode)

    // Send message to backend to change price mode
    if (socket) {
      socket.emit('setPriceMode', { useRealPrices: newMode })
    }

    console.log(`Price mode changed to: ${newMode ? 'REAL' : 'SIMULATED'}`)
  }

  // Sorting function with enhanced 24h change handling
  const handleSort = (column: string) => {
    if (column === '24hChange') {
      // Cycle through: none -> % change desc -> $ change desc -> % change asc -> $ change asc -> none
      if (!sortColumn) {
        setSortColumn('24hChangePercent')
        setSortDirection('desc')
      } else if (sortColumn === '24hChangePercent' && sortDirection === 'desc') {
        setSortColumn('24hChange')
        setSortDirection('desc')
      } else if (sortColumn === '24hChange' && sortDirection === 'desc') {
        setSortColumn('24hChangePercent')
        setSortDirection('asc')
      } else if (sortColumn === '24hChangePercent' && sortDirection === 'asc') {
        setSortColumn('24hChange')
        setSortDirection('asc')
      } else {
        setSortColumn(null)
        setSortDirection('desc')
      }
    } else if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, start with descending
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  // Get sorted equity symbols
  const getSortedEquitySymbols = () => {
    if (!sortColumn) return subscribedEquities

    return [...subscribedEquities].sort((a, b) => {
      const equityA = equityData[a]
      const equityB = equityData[b]
      const perfA = performanceData[a]
      const perfB = performanceData[b]

      if (!equityA && !equityB) return 0
      if (!equityA) return 1
      if (!equityB) return -1

      let valueA: number
      let valueB: number

      switch (sortColumn) {
        case '24hChange':
          // Use performance data price change
          valueA = perfA?.hasData && perfA.priceChange !== null ? perfA.priceChange : -Infinity
          valueB = perfB?.hasData && perfB.priceChange !== null ? perfB.priceChange : -Infinity
          break
        case '24hChangePercent':
          // Use performance data percentage change
          valueA = perfA?.hasData && perfA.percentChange !== null ? perfA.percentChange : -Infinity
          valueB = perfB?.hasData && perfB.percentChange !== null ? perfB.percentChange : -Infinity
          break
        case 'price':
          valueA = equityA.price
          valueB = equityB.price
          break
        case 'symbol':
          return sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return valueA - valueB
      } else {
        return valueB - valueA
      }
    })
  }

  // Get sort indicator with enhanced 24h change display
  const getSortIndicator = (column: string) => {
    if (column === '24hChange') {
      if (!sortColumn || (sortColumn !== '24hChangePercent' && sortColumn !== '24hChange')) return ''

      const direction = sortDirection === 'asc' ? ' ↑' : ' ↓'
      const type = sortColumn === '24hChangePercent' ? '%' : '$'
      return `${direction}${type}`
    }

    if (sortColumn !== column) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  // User management functions
  const createUser = async () => {
    if (!newUsername.trim()) {
      setValidationError('Please enter a username')
      return
    }

    try {
      const response = await fetch('http://localhost:4000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() })
      })

      if (response.ok) {
        const data = await response.json()
        setUsers([...users, data.data])
        setCurrentUser(data.data)
        setNewUsername('')
        setShowUserModal(false)
      } else {
        const error = await response.json()
        setValidationError(error.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      setValidationError('Failed to create user')
    }
  }

  // Portfolio management functions
  const createPortfolio = async () => {
    if (!currentUser) {
      setValidationError('Please select a user first')
      return
    }

    if (!newPortfolioName.trim()) {
      setValidationError('Please enter a portfolio name')
      return
    }

    try {
      const response = await fetch('http://localhost:4000/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          name: newPortfolioName.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPortfolios([...portfolios, data.data])
        setCurrentPortfolio(data.data)
        setNewPortfolioName('')
        setShowPortfolioModal(false)
      } else {
        const error = await response.json()
        setValidationError(error.error || 'Failed to create portfolio')
      }
    } catch (error) {
      console.error('Error creating portfolio:', error)
      setValidationError('Failed to create portfolio')
    }
  }

  return (
    <main className="container mx-auto px-6 py-4 max-w-7xl bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <style jsx>{`
        .sortable-header {
          cursor: pointer;
          user-select: none;
          position: relative;
        }
        .sortable-header:hover {
          background-color: #f3f4f6 !important;
        }
        .sortable-header:active {
          background-color: #e5e7eb !important;
        }
      `}</style>
      {/* Excel-style Header */}
      <div className="bg-white border-2 border-gray-400 rounded-t-lg mb-0 shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-300 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              🚀 Stock Monitor - HOT RELOAD ACTIVE! 🔥
            </h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-bold ${connected ? 'bg-green-500 text-white border-2 border-green-400' : 'bg-red-500 text-white border-2 border-red-400'}`}>
              <Activity className="w-3 h-3" />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>

            {/* Price Mode Toggle */}
            <button
              onClick={togglePriceMode}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-bold transition-colors ${useRealPrices
                ? 'bg-yellow-500 text-white border-2 border-yellow-400 hover:bg-yellow-600'
                : 'bg-purple-500 text-white border-2 border-purple-400 hover:bg-purple-600'}`}
              title={`Currently using ${useRealPrices ? 'real' : 'simulated'} prices. Click to toggle.`}
            >
              {useRealPrices ? '📡 REAL' : '🎲 SIM'}
            </button>
          </div>
          <div className="text-sm text-blue-100 font-medium">
            Last Update: {bitcoinData ? new Date(bitcoinData.lastUpdate).toLocaleTimeString() : '--:--:--'}
          </div>
        </div>

        {/* User and Portfolio Selection */}
        <div className="px-6 py-3 bg-gradient-to-r from-indigo-100 to-indigo-200 border-b-2 border-gray-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-indigo-900">👤 User:</label>
              <select
                value={currentUser?.id || ''}
                onChange={async (e) => {
                  const user = users.find(u => u.id === parseInt(e.target.value))
                  setCurrentUser(user || null)
                  
                  // Save user preference to database
                  if (user) {
                    const browserId = getBrowserId()
                    try {
                      await fetch('http://localhost:4000/api/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ browser_id: browserId, user_id: user.id })
                      })
                      console.log(`💾 Saved user preference: ${user.username}`)
                    } catch (error) {
                      console.error('❌ Error saving user preference:', error)
                    }
                  }
                }}
                className="px-3 py-1 border-2 border-indigo-400 rounded-md text-sm font-medium bg-white"
              >
                <option value="">Select User</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.username}</option>
                ))}
              </select>
              <button
                onClick={() => setShowUserModal(true)}
                className="px-3 py-1 bg-indigo-600 text-white border-2 border-indigo-500 rounded-md text-sm font-bold hover:bg-indigo-700"
              >
                + New User
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-indigo-900">📁 Portfolio:</label>
              <select
                value={currentPortfolio?.id || ''}
                onChange={async (e) => {
                  const portfolio = portfolios.find(p => p.id === parseInt(e.target.value))
                  setCurrentPortfolio(portfolio || null)
                  
                  // Save portfolio preference to user's last_viewed_portfolio_id
                  if (portfolio && currentUser) {
                    try {
                      await fetch(`http://localhost:4000/api/users/${currentUser.id}/last-portfolio`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ portfolio_id: portfolio.id })
                      })
                      console.log(`💾 Saved portfolio preference: ${portfolio.name}`)
                    } catch (error) {
                      console.error('❌ Error saving portfolio preference:', error)
                    }
                  }
                }}
                className="px-3 py-1 border-2 border-indigo-400 rounded-md text-sm font-medium bg-white"
                disabled={!currentUser}
              >
                <option value="">Select Portfolio</option>
                {portfolios.map(portfolio => (
                  <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowPortfolioModal(true)}
                disabled={!currentUser}
                className={`px-3 py-1 text-white border-2 rounded-md text-sm font-bold ${
                  currentUser 
                    ? 'bg-indigo-600 border-indigo-500 hover:bg-indigo-700' 
                    : 'bg-gray-400 border-gray-300 cursor-not-allowed'
                }`}
              >
                + New Portfolio
              </button>
            </div>

            {currentPortfolio && (
              <div className="ml-auto text-sm font-bold text-indigo-900">
                📊 {currentUser?.username} / {currentPortfolio.name} ({subscribedEquities.length} stocks)
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-300">
          <div className="flex gap-1">
            <div className="px-4 py-2 bg-orange-500 text-white border-2 border-orange-400 border-b-0 rounded-t-md text-sm font-bold shadow-md">
              Bitcoin (BTC) ₿
            </div>
            <div className="px-4 py-2 bg-gray-300 border-2 border-gray-400 border-b-0 rounded-t-md text-sm text-gray-700 hover:bg-gray-400 transition-colors cursor-pointer">
              + Add Asset
            </div>
          </div>
        </div>
      </div>

      {/* Professional Asset Table */}
      <div className="bg-white rounded-lg overflow-hidden shadow-lg border-2 border-gray-300">
        <table className="w-full border-collapse asset-table">
          <thead>
            <tr>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'center', width: '40px' }}>🎯</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">📊 Asset</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>💰 Price</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'center' }}>📈 24h Change</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>1M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>5M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>30M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>1H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>3H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>5H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>8H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>1D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>3D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>5D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>8D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>13D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>1MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>3MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>5MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>8MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>13MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>1Y</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>3Y</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>5Y</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>📊 Volume (M)</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>🏦 Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {bitcoinData ? (
              <tr>
                <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-r from-orange-500 to-orange-600">
                    ₿
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-2 text-xs">
                  <div>
                    <div className="font-medium text-gray-900 text-xs">Bitcoin</div>
                    <div className="text-xs font-bold text-gray-600">BTC</div>
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                  <div className="text-sm font-bold text-gray-900">
                    {formatPrice(bitcoinData.price)}
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span className={`change-${bitcoinData.change >= 0 ? 'positive' : 'negative'}-light`}>
                    {bitcoinData.change >= 0 ? (
                      <>
                        <TrendingUp className="inline w-3 h-3 mr-1" />
                        +{bitcoinData.change.toFixed(2)} (+{bitcoinData.changePercent.toFixed(2)}%)
                      </>
                    ) : (
                      <>
                        <TrendingDown className="inline w-3 h-3 mr-1" />
                        {bitcoinData.change.toFixed(2)} ({bitcoinData.changePercent.toFixed(2)}%)
                      </>
                    )}
                  </span>
                </td>                {/* Performance Intervals */}
                {TIME_INTERVALS.map(interval => {
                  const intervalData = calculateIntervalData(interval.id)
                  return (
                    <td key={interval.id} className="interval-cell">
                      {intervalData ? (
                        <span className={intervalData.change >= 0 ? 'interval-positive' : 'interval-negative'}>
                          {intervalData.change >= 0 ? '+' : ''}{intervalData.changePercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="interval-neutral">
                          --
                        </span>
                      )}
                    </td>
                  )
                })}

                <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                  <div className="text-xs text-gray-600">
                    {(bitcoinData.volume / 1000000).toFixed(1)}M
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                  <div className="text-xs font-medium text-gray-700">
                    {bitcoinData.marketCap}
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={26} className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                  <div className="py-8 text-gray-500">Loading Bitcoin data...</div>
                </td>
              </tr>
            )}
            {/* Placeholder rows for future assets */}
            <tr className="opacity-50">
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-r from-blue-500 to-blue-600">
                  Ξ
                </div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs">
                <div>
                  <div className="font-medium text-gray-900 text-xs">Ethereum</div>
                  <div className="text-xs font-bold text-gray-600">ETH</div>
                </div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-sm font-bold text-gray-400">--</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                <div className="text-gray-400 text-xs">Coming Soon</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-xs text-gray-400">--</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-xs text-gray-400">--</div>
              </td>
            </tr>
            <tr className="opacity-30">
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-r from-green-500 to-green-600">
                  $
                </div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs">
                <div>
                  <div className="font-medium text-gray-900 text-xs">Tether</div>
                  <div className="text-xs font-bold text-gray-600">USDT</div>
                </div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-sm font-bold text-gray-400">--</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                <div className="text-gray-400 text-xs">Coming Soon</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs text-center"><div className="text-gray-400 text-xs">--</div></td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-xs text-gray-400">--</div>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                <div className="text-xs text-gray-400">--</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Equities & ETFs Section */}
      <div className="bg-white border-2 border-gray-400 rounded-t-lg mb-0 shadow-lg mt-8">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-300 bg-gradient-to-r from-green-600 to-green-700">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              📈 Equities & ETFs Monitor
            </h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-bold ${connected ? 'bg-green-500 text-white border-2 border-green-400' : 'bg-red-500 text-white border-2 border-red-400'}`}>
              <Activity className="w-3 h-3" />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
          <div className="text-sm text-green-100 font-medium">
            Subscribed: {subscribedEquities.length} securities
          </div>
        </div>

        {/* Add Security Input */}
        <div className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-300">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={newEquity}
              onChange={(e) => {
                setNewEquity(e.target.value.toUpperCase())
                setValidationError('') // Clear error when typing
              }}
              placeholder="Enter symbols (e.g., TD.TO LI.V BMO.CA AAPL MSFT BP.L SAP.DE)"
              className={`px-3 py-2 border-2 rounded-md text-sm font-medium ${validationError
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-400 focus:border-blue-500'}`}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isValidating) {
                  addEquity()
                }
              }}
              disabled={isValidating}
            />
            <button
              onClick={addEquity}
              disabled={isValidating}
              className={`px-4 py-2 text-white border-2 rounded-md text-sm font-bold transition-colors ${isValidating
                ? 'bg-gray-400 border-gray-300 cursor-not-allowed'
                : 'bg-blue-500 border-blue-400 hover:bg-blue-600'}`}
            >
              {isValidating ? 'Validating...' : 'Add Securities'}
            </button>
            <span className="text-sm text-gray-600">
              Current: {subscribedEquities.join(', ')}
            </span>
          </div>
          {validationError && (
            <div className="mt-2 text-sm text-red-600 font-medium">
              ❌ {validationError}
            </div>
          )}
        </div>

        {/* OCR Image Upload Section */}
        <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-800">📷 Extract Stocks from Image</span>
              <span className="text-xs text-blue-600">(Screenshots, Photos, Documents)</span>
            </div>

            <div className="flex gap-3 items-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                disabled={isProcessingOCR}
              />

              {selectedFile && (
                <button
                  onClick={processImageOCR}
                  disabled={isProcessingOCR}
                  className={`px-4 py-2 text-white border-2 rounded-md text-sm font-bold transition-colors ${isProcessingOCR
                    ? 'bg-gray-400 border-gray-300 cursor-not-allowed'
                    : 'bg-green-500 border-green-400 hover:bg-green-600'}`}
                >
                  {isProcessingOCR ? '🔍 Processing...' : '🔍 Extract Stocks'}
                </button>
              )}

              {selectedFile && (
                <span className="text-xs text-blue-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* OCR Results Modal */}
        {showOcrResults && ocrResults && (
          <div className="px-6 py-4 bg-green-50 border-b-2 border-green-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-green-800">📊 Extracted Stock Symbols</h3>
              <button
                onClick={() => setShowOcrResults(false)}
                className="text-green-600 hover:text-green-800 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <p className="text-sm text-green-700">
                OCR Confidence: {ocrResults.ocrConfidence?.toFixed(1)}% |
                Found {ocrResults.extractedStocks?.length || 0} potential symbols
              </p>
            </div>

            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {ocrResults.extractedStocks?.map((stock: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded border-2 ${stock.isValid
                    ? 'bg-green-100 border-green-300'
                    : 'bg-red-100 border-red-300'}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {stock.isValid ? '✅' : '❌'} {stock.symbol}
                      </span>
                      {stock.isValid && (
                        <span className="text-xs text-gray-600">
                          {stock.companyName} - ${stock.currentPrice?.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Confidence: {stock.confidence}%
                      {!stock.isValid && stock.reason && ` - ${stock.reason}`}
                    </div>
                    {stock.context && (
                      <div className="text-xs text-gray-400 mt-1 italic">
                        Context: "{stock.context.substring(0, 100)}..."
                      </div>
                    )}
                  </div>

                  {stock.isValid && !subscribedEquities.includes(stock.symbol) && (
                    <button
                      onClick={() => addStockFromOCR(stock)}
                      className="ml-3 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    >
                      Add to Portfolio
                    </button>
                  )}

                  {subscribedEquities.includes(stock.symbol) && (
                    <span className="ml-3 px-3 py-1 bg-gray-300 text-gray-600 text-xs rounded">
                      Already Added
                    </span>
                  )}
                </div>
              ))}
            </div>

            {ocrResults.extractedStocks?.some((stock: any) =>
              stock.isValid && !subscribedEquities.includes(stock.symbol)
            ) && (
                <div className="mt-3 flex justify-center">
                  <button
                    onClick={addAllValidStocksFromOCR}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition-colors"
                  >
                    🚀 Add All Valid Stocks ({ocrResults.extractedStocks?.filter((stock: any) =>
                      stock.isValid && !subscribedEquities.includes(stock.symbol)
                    ).length})
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Professional Equity Table */}
      <div className="bg-white rounded-lg overflow-hidden shadow-lg border-2 border-gray-300">
        <table className="w-full border-collapse asset-table">
          <thead>
            <tr>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'center', width: '40px' }}>🎯</th>
              <th
                className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => handleSort('symbol')}
                title="Click to sort by symbol"
              >
                📊 Security{getSortIndicator('symbol')}
              </th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">🏢 Description</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">🌐 Market</th>
              <th
                className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                style={{ textAlign: 'right' }}
                onClick={() => handleSort('price')}
                title="Click to sort by price"
              >
                💰 Price{getSortIndicator('price')}
              </th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>🌅 Pre-Market</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>🌇 After-Hours</th>
              <th
                className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                style={{ textAlign: 'center' }}
                onClick={() => handleSort('24hChange')}
                title="Total % change since stock was added to portfolio - based on historical database prices"
              >
                📈 Total % Change{getSortIndicator('24hChange')}
              </th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>1M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>5M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>30M</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>1H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>3H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>5H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fef3c7', color: '#92400e' }}>8H</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>1D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>3D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>5D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>8D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dbeafe', color: '#1e40af' }}>13D</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>1MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>3MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>5MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#dcfce7', color: '#166534' }}>8MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>13MO</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>1Y</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>3Y</th>
              <th className="border-2 border-gray-300 px-2 py-3 text-xs font-bold uppercase tracking-wider" style={{ textAlign: 'center', backgroundColor: '#fce7f3', color: '#be185d' }}>5Y</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>📊 Volume (M)</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'right' }}>🏦 Market Cap</th>
              <th className="bg-gray-100 border-2 border-gray-300 px-2 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ textAlign: 'center', width: '50px' }}>❌</th>
            </tr>
          </thead>
          <tbody>
            {getSortedEquitySymbols().map(symbol => {
              const equity = equityData[symbol]
              return (
                <tr key={symbol}>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-r from-purple-500 to-purple-600">
                      {symbol.charAt(0)}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs">
                    <div>
                      <div className="text-xs font-bold text-gray-600">{symbol}</div>
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs">
                    <div className="font-medium text-gray-900" style={{ fontSize: '10px' }}>{equity?.name || symbol}</div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ whiteSpace: 'nowrap' }}>
                    <div className="text-xs text-blue-600 font-medium">
                      {(() => {
                        const exchangeInfo = getExchangeInfo(symbol)
                        const isETF = symbol.includes('ETF') || symbol.includes('SPY') || symbol.includes('QQQ') || symbol.includes('VTI')
                        return (
                          <div className="flex items-center gap-1">
                            <span>{exchangeInfo.flag}</span>
                            <span>{isETF ? 'ETF' : exchangeInfo.exchange}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                    <div className="text-sm font-bold text-gray-900">
                      {equity ? formatPrice(equity.price) : '--'}
                    </div>
                  </td>

                  {/* Pre-Market Column */}
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                    {equity?.preMarketPrice ? (
                      <div className="text-xs">
                        <div className="font-bold text-blue-700">
                          {formatPrice(equity.preMarketPrice)}
                        </div>
                        {equity.preMarketChange && equity.preMarketChangePercent && (
                          <div className={`text-xs ${equity.preMarketChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {equity.preMarketChange >= 0 ? '+' : ''}{equity.preMarketChange.toFixed(2)} ({equity.preMarketChangePercent.toFixed(2)}%)
                          </div>
                        )}
                        {equity.preMarketTime && (
                          <div className="text-xs text-gray-500">
                            {new Date(equity.preMarketTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">--</div>
                    )}
                  </td>

                  {/* After-Hours Column */}
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                    {equity?.postMarketPrice ? (
                      <div className="text-xs">
                        <div className="font-bold text-orange-700">
                          {formatPrice(equity.postMarketPrice)}
                        </div>
                        {equity.postMarketChange && equity.postMarketChangePercent && (
                          <div className={`text-xs ${equity.postMarketChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {equity.postMarketChange >= 0 ? '+' : ''}{equity.postMarketChange.toFixed(2)} ({equity.postMarketChangePercent.toFixed(2)}%)
                          </div>
                        )}
                        {equity.postMarketTime && (
                          <div className="text-xs text-gray-500">
                            {new Date(equity.postMarketTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">--</div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const perf = performanceData[symbol]
                      if (perf && perf.hasData && perf.percentChange !== null) {
                        const isPositive = perf.percentChange >= 0
                        const daysHeld = perf.earliestDate 
                          ? Math.floor((new Date().getTime() - new Date(perf.earliestDate).getTime()) / (1000 * 60 * 60 * 24))
                          : 0
                        return (
                          <div>
                            <span className={`change-${isPositive ? 'positive' : 'negative'}-light`}>
                              {isPositive ? (
                                <>
                                  <TrendingUp className="inline w-3 h-3 mr-1" />
                                  +{perf.priceChange?.toFixed(2)} (+{perf.percentChange.toFixed(2)}%)
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="inline w-3 h-3 mr-1" />
                                  {perf.priceChange?.toFixed(2)} ({perf.percentChange.toFixed(2)}%)
                                </>
                              )}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              Since {new Date(perf.earliestDate!).toLocaleDateString()} ({daysHeld}d)
                            </div>
                          </div>
                        )
                      } else {
                        return <div className="text-gray-400 text-xs">No historical data</div>
                      }
                    })()}
                  </td>

                  {/* Performance Intervals */}
                  {TIME_INTERVALS.map(interval => {
                    const intervalData = calculateEquityIntervalData(symbol, interval.id)
                    return (
                      <td key={interval.id} className="interval-cell">
                        {intervalData ? (
                          <span className={intervalData.change >= 0 ? 'interval-positive' : 'interval-negative'}>
                            {intervalData.change >= 0 ? '+' : ''}{intervalData.changePercent.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="interval-neutral">
                            --
                          </span>
                        )}
                      </td>
                    )
                  })}

                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                    <div className="text-xs text-gray-600">
                      {equity ? (equity.volume / 1000000).toFixed(1) + 'M' : '--'}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'right' }}>
                    <div className="text-xs font-medium text-gray-700">
                      {equity?.marketCap || '--'}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => removeEquity(symbol)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title={`Remove ${symbol}`}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              )
            })}

            {getSortedEquitySymbols().length === 0 && (
              <tr>
                <td colSpan={31} className="border border-gray-300 px-2 py-2 text-xs" style={{ textAlign: 'center' }}>
                  <div className="py-8 text-gray-500">
                    {isLoadingPortfolio
                      ? 'Loading portfolio from database...'
                      : 'No equities subscribed. Add securities using the input above.'
                    }
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border-2 border-indigo-400">
            <h2 className="text-xl font-bold text-indigo-900 mb-4">👤 Create New User</h2>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md mb-4"
              onKeyPress={(e) => e.key === 'Enter' && createUser()}
            />
            {validationError && (
              <div className="mb-4 text-sm text-red-600 font-medium">
                ❌ {validationError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setNewUsername('')
                  setValidationError('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md font-bold hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={createUser}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Portfolio Modal */}
      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border-2 border-indigo-400">
            <h2 className="text-xl font-bold text-indigo-900 mb-4">📁 Create New Portfolio</h2>
            <div className="mb-4 text-sm text-gray-600">
              User: <span className="font-bold">{currentUser?.username}</span>
            </div>
            <input
              type="text"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              placeholder="Enter portfolio name"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md mb-4"
              onKeyPress={(e) => e.key === 'Enter' && createPortfolio()}
            />
            {validationError && (
              <div className="mb-4 text-sm text-red-600 font-medium">
                ❌ {validationError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPortfolioModal(false)
                  setNewPortfolioName('')
                  setValidationError('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md font-bold hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={createPortfolio}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700"
              >
                Create Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// Export with SSR disabled to prevent hydration errors
const Home = dynamic(() => Promise.resolve(() => <StockMonitorComponent />), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-lg text-gray-600">Loading Stock Monitor...</div>
  </div>
})

export default Home