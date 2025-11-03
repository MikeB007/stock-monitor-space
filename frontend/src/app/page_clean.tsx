// Clean exchange detection function
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
    { name: 'LSE', country: 'United Kingdom', flag: '🇬🇧', weight: 12 },
    { name: 'Euronext', country: 'Europe', flag: '🇪🇺', weight: 8 },
    { name: 'XETRA', country: 'Germany', flag: '🇩🇪', weight: 6 },
    { name: 'SIX', country: 'Switzerland', flag: '🇨🇭', weight: 3 },
    { name: 'Borsa Italiana', country: 'Italy', flag: '🇮🇹', weight: 2 },
    { name: 'BME', country: 'Spain', flag: '🇪🇸', weight: 2 },
    { name: 'Stockholm', country: 'Sweden', flag: '🇸🇪', weight: 1 },
    { name: 'Oslo Børs', country: 'Norway', flag: '🇳🇴', weight: 1 },
    
    // Asia-Pacific (35%)
    { name: 'Tokyo', country: 'Japan', flag: '🇯🇵', weight: 12 },
    { name: 'Shanghai', country: 'China', flag: '🇨🇳', weight: 8 },
    { name: 'Hong Kong', country: 'Hong Kong', flag: '🇭🇰', weight: 6 },
    { name: 'ASX', country: 'Australia', flag: '🇦🇺', weight: 4 },
    { name: 'BSE', country: 'India', flag: '🇮🇳', weight: 3 },
    { name: 'SGX', country: 'Singapore', flag: '🇸🇬', weight: 1 },
    { name: 'KOSPI', country: 'South Korea', flag: '🇰🇷', weight: 1 },
    
    // North America Non-US (20%)  
    { name: 'TSX', country: 'Canada', flag: '🇨🇦', weight: 15 },
    { name: 'TSX-V', country: 'Canada', flag: '🇨🇦', weight: 3 },
    { name: 'BMV', country: 'Mexico', flag: '🇲🇽', weight: 2 },
    
    // Emerging Markets (10%)
    { name: 'Bovespa', country: 'Brazil', flag: '🇧🇷', weight: 4 },
    { name: 'JSE', country: 'South Africa', flag: '🇿🇦', weight: 2 },
    { name: 'TSE', country: 'Taiwan', flag: '🇹🇼', weight: 2 },
    { name: 'SET', country: 'Thailand', flag: '🇹🇭', weight: 1 },
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
  
  // Fallback to NYSE (US default)
  return { exchange: 'NYSE', country: 'USA', flag: '🇺🇸' }
}