/**
 * API Configuration
 * Centralized configuration for all API endpoints
 * Environment variables are loaded from .env files
 */

// Get the base API URL from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
const ENV = process.env.NEXT_PUBLIC_ENV || 'development'

// API endpoints
export const API_ENDPOINTS = {
  // Base URLs
  BASE_URL: API_BASE_URL,
  WS_URL: WS_BASE_URL,
  
  // User endpoints
  USERS: `${API_BASE_URL}/api/users`,
  USER_BY_ID: (userId: number) => `${API_BASE_URL}/api/users/${userId}`,
  USER_LAST_PORTFOLIO: (userId: number) => `${API_BASE_URL}/api/users/${userId}/last-portfolio`,
  
  // Portfolio endpoints
  PORTFOLIOS: `${API_BASE_URL}/api/portfolios`,
  PORTFOLIO: `${API_BASE_URL}/api/portfolio`,
  PORTFOLIO_BY_ID: (portfolioId: number) => `${API_BASE_URL}/api/portfolio?portfolio_id=${portfolioId}`,
  PORTFOLIO_PERFORMANCE: (portfolioId: number) => `${API_BASE_URL}/api/portfolio/performance?portfolio_id=${portfolioId}`,
  PORTFOLIO_INTERVALS: (portfolioId: number) => `${API_BASE_URL}/api/portfolio/intervals?portfolio_id=${portfolioId}`,
  PORTFOLIOS_BY_USER: (userId: number) => `${API_BASE_URL}/api/portfolios/user/${userId}`,
  DELETE_PORTFOLIO_STOCK: (portfolioId: number, symbol: string) => `${API_BASE_URL}/api/portfolio/${portfolioId}/${symbol}`,
  
  // Preferences endpoints
  PREFERENCES: `${API_BASE_URL}/api/preferences`,
  PREFERENCES_BY_USER: (userId: number | string) => `${API_BASE_URL}/api/preferences/${userId}`,
  
  // Stock endpoints
  VALIDATE_SYMBOL: `${API_BASE_URL}/api/validate-symbol`,
  EXTRACT_STOCKS: `${API_BASE_URL}/api/extract-stocks`,
  
  // Health check
  HEALTH: `${API_BASE_URL}/api/health`,
}

// Configuration
export const CONFIG = {
  ENV,
  IS_PRODUCTION: ENV === 'production',
  IS_DEVELOPMENT: ENV === 'development',
  API_TIMEOUT: 30000, // 30 seconds
}

// Export individual values for convenience
export const { BASE_URL, WS_URL } = API_ENDPOINTS
export default API_ENDPOINTS
