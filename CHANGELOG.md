# Changelog

All notable changes to the Stock Monitor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2025-11-05

### Breaking Changes
- **Terminology Migration**: Complete refactoring from "Portfolio" to "Watchlist" throughout the application
- **Database Schema Changes**: All portfolio-related tables renamed to watchlist equivalents
- **API Endpoints**: All routes updated from `/api/portfolio` to `/api/watchlist`

### Added
- **User Settings Page**: New `/settings` page for configuring display preferences
- **Color Scheme Options**: Two color schemes for performance intervals
  - Standard: Simple 0% = grey, positive = green, negative = red
  - Graded: Intensity increases every 3% (Light → Medium → Dark → Bold)
- **User Settings Table**: New `user_settings` table for per-user preferences
- **Settings API Endpoints**: 
  - `GET /api/preferences/:userId` - Retrieve user settings
  - `PUT /api/preferences/:userId` - Update user settings
- **PowerShell Automation Scripts**:
  - `start.ps1` - Starts backend and frontend in separate windows with verification
  - `stop.ps1` - Gracefully stops all Node.js processes and clears ports
- **Automated Refactoring Script**: `refactor-portfolio-to-watchlist.ps1` for bulk code changes

### Changed

#### Backend
- **Database Service** (`backend/src/services/databaseService.ts`):
  - All Portfolio interfaces renamed to Watchlist
  - `portfolios` table → `watchlists` table
  - `portfolio_stocks` table → `watchlist_stocks` table
  - All method names updated (e.g., `getPortfolios` → `getWatchlists`)
  - Added `getUserSettings()` and `updateUserSettings()` methods
- **Route Files**:
  - `portfolioRoutes.ts` → `watchlistRoutes.ts`
  - `portfolioManagementRoutes.ts` → `watchlistManagementRoutes.ts`
  - Added `preferencesRoutes.ts` for user settings
- **User Routes** (`backend/src/routes/userRoutes.ts`):
  - Updated `last-portfolio` endpoint → `last-Watchlist`
- **OCR Service** (`backend/src/services/ocrService.ts`):
  - Comments updated to reflect watchlist terminology
- **Enhanced Stock Price Service**:
  - Documentation updated with watchlist references

#### Frontend
- **API Configuration** (`frontend/src/config/api.config.ts`):
  - All PORTFOLIO endpoints renamed to WATCHLIST
  - Added `USER_PREFERENCES` endpoint for settings
  - Added `BROWSER_PREFERENCES` endpoint distinction
- **Main Dashboard** (`frontend/src/app/page.tsx`):
  - All Portfolio interfaces → Watchlist interfaces
  - State variables: `portfolios` → `watchlists`, `currentPortfolio` → `currentWatchlist`
  - UI labels: "Portfolio" → "Watchlist" throughout
  - Methods: `loadPortfolios` → `loadWatchlists`, etc.
  - Added color scheme loading from user preferences
- **Settings Page** (`frontend/src/app/settings/page.tsx`):
  - New page for user settings configuration
  - Radio button selection for color schemes
  - Save/load functionality with backend integration
  - User ID selection dropdown
- **LocalStorage Keys**:
  - `lastViewedPortfolioId` → `lastViewedWatchlistId`
  - Added `colorScheme` key for user preference caching

#### Database
- **Schema Updates**:
  - Table `portfolios` renamed to `watchlists`
  - Table `portfolio_stocks` renamed to `watchlist_stocks`
  - Column `portfolio_id` renamed to `watchlist_id` in relevant tables
  - New table `user_settings` created for user preferences
  - Column `color_scheme` added to `user_preferences` table (browser-level)

#### Documentation
- **README.md**:
  - Added version history section
  - Updated features list with watchlist terminology
  - Added MySQL setup instructions
  - Expanded API endpoints documentation
  - Added PowerShell script usage instructions
- **TECHNICAL-DOCUMENTATION.md**:
  - Updated status date to November 5, 2025
  - Added v4.0.0 change summary
  - Architecture overview updated
- **DATABASE-SETUP-GUIDE.md**:
  - Added auto-created tables list
  - Updated success messages
  - Added settings tables documentation
- **BUSINESS-DOCUMENTATION.md**:
  - Added v4.0.0 updates section
  - Updated database persistence section
  - Enhanced user preferences documentation

### Fixed
- **API Config Export**: Added missing `API_CONFIG` export in `frontend/src/config/api.ts`
- **Settings Page Bug**: Fixed preferences loading to call correct endpoint (`USER_PREFERENCES` instead of `PREFERENCES`)
- **Database Service**: Fixed `getUserSettings` and `updateUserSettings` to use `user_settings` table instead of `user_preferences`
- **Route Registration**: Ensured all routes properly registered in `backend/src/server.ts`

### Migration Notes

#### For Existing Installations
1. **Database Migration Required**:
   ```sql
   -- Rename tables
   RENAME TABLE portfolios TO watchlists;
   RENAME TABLE portfolio_stocks TO watchlist_stocks;
   
   -- Update column names
   ALTER TABLE watchlist_stocks 
     CHANGE COLUMN portfolio_id watchlist_id INT;
   
   -- Add color_scheme to user_preferences
   ALTER TABLE user_preferences 
     ADD COLUMN color_scheme VARCHAR(50) DEFAULT 'standard' AFTER browser_id;
   
   -- Create user_settings table
   CREATE TABLE IF NOT EXISTS user_settings (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT UNIQUE NOT NULL,
     color_scheme VARCHAR(50) DEFAULT 'standard',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   ```

2. **Code Updates**: Pull latest code from `feature/portfolio-to-watchlist-refactor` branch

3. **Clear Browser Cache**: Clear localStorage to reset old portfolio IDs

4. **Restart Services**: Use `.\start.ps1` to restart both backend and frontend

#### API Breaking Changes
- All `/api/portfolio*` endpoints now `/api/watchlist*` or `/api/Watchlist*`
- Response objects now use `watchlist`, `watchlists`, `watchlist_id` keys instead of portfolio equivalents

## [3.x.x] - 2025-11-01

### Previous Features
- Real-time stock price monitoring with WebSocket
- Multi-provider stock data (Yahoo Finance, Alpha Vantage, Financial Modeling Prep)
- MySQL database persistence
- Portfolio management (renamed to Watchlist in v4.0.0)
- Pre/post market data support
- Global exchange support (25+ exchanges)
- Historical price tracking
- Provider health monitoring with automatic failover
- Response caching (60-second TTL)
- Symbol validation and search
- OCR text extraction for stock symbols

---

## Release Methodology

### Version Numbering
- **Major (X.0.0)**: Breaking changes, major refactoring
- **Minor (x.X.0)**: New features, backward compatible
- **Patch (x.x.X)**: Bug fixes, minor improvements

### Branch Strategy
- `master`: Stable production-ready code
- `feature/*`: Feature development branches
- Tags: Version releases (e.g., `v4.0.0`)

### Commit Messages
Following conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `refactor:` Code refactoring
- `chore:` Maintenance tasks
- `test:` Testing updates

---

**For detailed technical information, see [TECHNICAL-DOCUMENTATION.md](./TECHNICAL-DOCUMENTATION.md)**  
**For business features, see [BUSINESS-DOCUMENTATION.md](./BUSINESS-DOCUMENTATION.md)**
