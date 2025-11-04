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
    PREFERENCES: (userId: number) => `${API_BASE_URL}/api/preferences/${userId}`,
    USER_PREFERENCES: (browserId: string) => `${API_BASE_URL}/api/preferences/${browserId}`,
    SAVE_PREFERENCES: `${API_BASE_URL}/api/preferences`,
    
    // Portfolio endpoints
    PORTFOLIO: `${API_BASE_URL}/api/portfolio`,
    PORTFOLIOS: `${API_BASE_URL}/api/portfolios`,
    PORTFOLIO_BY_USER: (userId: number) => `${API_BASE_URL}/api/portfolios/user/${userId}`,
    PORTFOLIO_BY_ID: (portfolioId: number) => `${API_BASE_URL}/api/portfolio/${portfolioId}`,
    PORTFOLIO_STOCK: (portfolioId: number, symbol: string) => `${API_BASE_URL}/api/portfolio/${portfolioId}/${symbol}`,
    PORTFOLIO_PERFORMANCE: `${API_BASE_URL}/api/portfolio/performance`,
    PORTFOLIO_INTERVALS: `${API_BASE_URL}/api/portfolio/intervals`,
    
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
