// Financial Data API Configuration
// Replace with your own API keys for production use

process.env.ALPHA_VANTAGE_API_KEY = "ivpcjYxlGv9ookMHatrhfuMhM3jBdM13"
export const API_KEYS = {
    // Alpha Vantage - Get free API key: https://www.alphavantage.co/support/#api-key
    // Free tier: 5 API requests per minute, 500 per day
    ALPHA_VANTAGE: process.env.ALPHA_VANTAGE_API_KEY || 'demo',

    // Financial Modeling Prep - Get free API key: https://financialmodelingprep.com/developer/docs
    // Free tier: 250 API requests per day
    FINANCIAL_MODELING_PREP: process.env.FMP_API_KEY || 'demo',

    // Twelve Data - Get free API key: https://twelvedata.com/pricing
    // Free tier: 800 API requests per day
    TWELVE_DATA: process.env.TWELVE_DATA_API_KEY || 'demo'
}

export const API_CONFIG = {
    // Request timeout in milliseconds
    TIMEOUT: 3000,

    // Maximum retries per API
    MAX_RETRIES: 2,

    // Rate limiting (milliseconds between requests)
    RATE_LIMIT_DELAY: 1000,

    // Cache duration for equity data (milliseconds)
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

    // Enable/disable specific APIs
    APIS: {
        YAHOO_FINANCE: true,    // Free, no API key required
        ALPHA_VANTAGE: true,    // Requires API key
        FINANCIAL_MODELING_PREP: true,  // Requires API key
        TWELVE_DATA: false      // Disabled by default, requires API key
    }
}

// Instructions for users:
console.log(`
📈 Stock Monitor - External API Configuration

To get real stock data, configure your API keys:

1. Yahoo Finance (FREE - No API key needed)
   ✅ Already enabled - provides real-time quotes

2. Alpha Vantage (FREE tier available)
   🔑 Get API key: https://www.alphavantage.co/support/#api-key
   📝 Set environment variable: ALPHA_VANTAGE_API_KEY=your_key_here

3. Financial Modeling Prep (FREE tier available)
   🔑 Get API key: https://financialmodelingprep.com/developer/docs
   📝 Set environment variable: FMP_API_KEY=your_key_here

4. Twelve Data (Premium features)
   🔑 Get API key: https://twelvedata.com/pricing
   📝 Set environment variable: TWELVE_DATA_API_KEY=your_key_here

💡 Tip: Yahoo Finance works without API keys for basic functionality
`)