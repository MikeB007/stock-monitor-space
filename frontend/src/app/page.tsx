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

  // Exchange suffix mapping
  const exchangeMap: { [key: string]: { exchange: string, country: string, flag: string } } = {
    '.TO': { exchange: 'TSX', country: 'Canada', flag: '🇨🇦' },
    '.V': { exchange: 'TSXV', country: 'Canada', flag: '🇨🇦' },
    '.CN': { exchange: 'CSE', country: 'Canada', flag: '🇨🇦' },
    '.L': { exchange: 'LSE', country: 'UK', flag: '🇬🇧' },
    '.PA': { exchange: 'Euronext Paris', country: 'France', flag: '🇫🇷' },
    '.AS': { exchange: 'Euronext Amsterdam', country: 'Netherlands', flag: '🇳🇱' },
    '.BR': { exchange: 'Euronext Brussels', country: 'Belgium', flag: '🇧🇪' },
    '.DE': { exchange: 'XETRA', country: 'Germany', flag: '🇩🇪' },
    '.F': { exchange: 'Frankfurt', country: 'Germany', flag: '🇩🇪' },
    '.HK': { exchange: 'HKEX', country: 'Hong Kong', flag: '🇭🇰' },
    '.T': { exchange: 'TSE', country: 'Japan', flag: '🇯🇵' },
    '.AX': { exchange: 'ASX', country: 'Australia', flag: '🇦🇺' },
    '.SA': { exchange: 'B3', country: 'Brazil', flag: '🇧🇷' },
    '.MC': { exchange: 'BME', country: 'Spain', flag: '🇪🇸' },
    '.MI': { exchange: 'Borsa Italiana', country: 'Italy', flag: '🇮🇹' }
  }

  // Check for exchange suffix
  for (const [suffix, info] of Object.entries(exchangeMap)) {
    if (symbolUpper.endsWith(suffix)) {
      return {
        ...info,
        isInternational: true,
        displaySymbol: symbolUpper
      }
    }
  }

  // US market detection for symbols without suffix
  // Most common US exchanges
  const commonUSSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']
  const usExchange = commonUSSymbols.includes(symbolUpper) ? 'NASDAQ' :
    symbolUpper.length <= 3 ? 'NYSE' : 'NASDAQ'

  return {
    exchange: usExchange,
    country: 'USA',
    flag: '🇺🇸',
    isInternational: false,
    displaySymbol: symbolUpper
  }
}

function StockMonitorComponent() {
  const [bitcoinData, setBitcoinData] = useState<BitcoinData | null>(null)
  const [activeInterval, setActiveInterval] = useState<string>('5m')
  const [connected, setConnected] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])

  // Equity state management
  const [equityData, setEquityData] = useState<Record<string, EquityData>>({})
  const [subscribedEquities, setSubscribedEquities] = useState<string[]>(['AAPL', 'SMR', 'IONX', 'IBM'])
  const [newEquity, setNewEquity] = useState<string>('')
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string>('')
  const [equityPriceHistory, setEquityPriceHistory] = useState<Record<string, PricePoint[]>>({})
  const [useRealPrices, setUseRealPrices] = useState(true)
  const [socket, setSocket] = useState<any>(null)

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

  useEffect(() => {
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
  }, [subscribedEquities])

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

  const removeEquity = (symbol: string) => {
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
    if (!stock.isValid) {
      setValidationError(`Cannot add ${stock.symbol}: ${stock.reason || 'Invalid symbol'}`)
      return
    }

    if (subscribedEquities.includes(stock.symbol)) {
      setValidationError(`${stock.symbol} is already in your portfolio`)
      return
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

  const addAllValidStocksFromOCR = () => {
    if (!ocrResults || !ocrResults.extractedStocks) return

    const validStocks = ocrResults.extractedStocks.filter((stock: any) =>
      stock.isValid && !subscribedEquities.includes(stock.symbol)
    )

    if (validStocks.length === 0) {
      setValidationError('No new valid stocks to add')
      return
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
    const history = equityPriceHistory[symbol] || []
    if (history.length === 0) return null

    const duration = TIME_INTERVALS.find(i => i.id === interval)?.duration || 5
    const now = new Date()
    const targetTime = new Date(now.getTime() - duration * 60 * 1000)

    // Get the current price (most recent data point)
    const currentPoint = history[history.length - 1]
    if (!currentPoint) return null

    // Find the closest data point to the target time (timeframe ago)
    let closestPoint = null
    let closestTimeDiff = Infinity

    for (const point of history) {
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
      dataPoints: history.length,
      timeDiff: closestTimeDiff / (60 * 1000) // in minutes
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

      if (!equityA && !equityB) return 0
      if (!equityA) return 1
      if (!equityB) return -1

      let valueA: number
      let valueB: number

      switch (sortColumn) {
        case '24hChange':
          valueA = equityA.change
          valueB = equityB.change
          break
        case '24hChangePercent':
          valueA = equityA.changePercent
          valueB = equityB.changePercent
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
              ₿ Bitcoin Monitor
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
                title="Click to sort by 24h change - cycles through: % desc → $ desc → % asc → $ asc → none"
              >
                📈 24h Change{getSortIndicator('24hChange')}
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
                  <td className="border border-gray-300 px-2 py-2 text-xs">
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
                    {equity ? (
                      <span className={`change-${equity.change >= 0 ? 'positive' : 'negative'}-light`}>
                        {equity.change >= 0 ? (
                          <>
                            <TrendingUp className="inline w-3 h-3 mr-1" />
                            +{equity.change.toFixed(2)} (+{equity.changePercent.toFixed(2)}%)
                          </>
                        ) : (
                          <>
                            <TrendingDown className="inline w-3 h-3 mr-1" />
                            {equity.change.toFixed(2)} ({equity.changePercent.toFixed(2)}%)
                          </>
                        )}
                      </span>
                    ) : (
                      <div className="text-gray-400 text-xs">Loading...</div>
                    )}
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
                    No equities subscribed. Add securities using the input above.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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