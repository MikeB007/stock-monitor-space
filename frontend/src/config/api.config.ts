// API Configuration
// Centralized configuration for all API endpoints

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  WS_URL: WS_BASE_URL,
  
  // API Endpoints
  ENDPOINTS: {
    // User endpoints
    USERS: `${API_BASE_URL}/api/users`,
    USER_BY_ID: (userId: number) => `${API_BASE_URL}/api/users/${userId}`,
    
    // Preferences endpoints
    BROWSER_PREFERENCES: (browserId: string) => `${API_BASE_URL}/api/preferences/${browserId}`, // Get last viewed user for this browser
    USER_PREFERENCES: (userId: number) => `${API_BASE_URL}/api/preferences/${userId}`, // Get/update user's color scheme settings
    SAVE_PREFERENCES: `${API_BASE_URL}/api/preferences`,
    
    // Watchlist endpoints
    Watchlist: `${API_BASE_URL}/api/Watchlist`,
    WatchlistS: `${API_BASE_URL}/api/Watchlists`,
    Watchlist_BY_USER: (userId: number) => `${API_BASE_URL}/api/Watchlists/user/${userId}`,
    Watchlist_BY_ID: (WatchlistId: number) => `${API_BASE_URL}/api/Watchlist/${WatchlistId}`,
    Watchlist_STOCK: (WatchlistId: number, symbol: string) => `${API_BASE_URL}/api/Watchlist/${WatchlistId}/${symbol}`,
    Watchlist_PERFORMANCE: `${API_BASE_URL}/api/Watchlist/performance`,
    Watchlist_INTERVALS: `${API_BASE_URL}/api/Watchlist/intervals`,
    
    // Stock endpoints
    VALIDATE_SYMBOL: `${API_BASE_URL}/api/validate-symbol`,
    STOCK_QUOTE: `${API_BASE_URL}/api/stock-quote`,
    PROVIDER_STATUS: `${API_BASE_URL}/api/provider-status`,
    SEARCH_SYMBOLS: `${API_BASE_URL}/api/search-symbols`,
    REFRESH_STOCK: `${API_BASE_URL}/api/refresh-stock`,
    
    // OCR endpoints
    OCR_EXTRACT: `${API_BASE_URL}/api/ocr/extract-text`,
    EXTRACT_STOCKS: `${API_BASE_URL}/api/ocr/extract-stocks`,
  },
  
  // WebSocket endpoint
  WS_ENDPOINT: WS_BASE_URL,
  
  // CORS allowed origins (for backend)
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.NEXT_PUBLIC_FRONTEND_URL,
  ].filter(Boolean),
}

export default API_CONFIG

