# Testing Guide - Stock Monitor Application

## Testing Strategy Overview

This document outlines the comprehensive testing strategy for the Stock Monitor application, including unit tests, integration tests, and end-to-end (E2E) tests.

---

## Testing Philosophy

### Testing Pyramid

```
        /\
       /  \    E2E Tests (Few) - 5%
      /____\   
     /      \  Integration Tests (Some) - 15%
    /________\ 
   /          \ Unit Tests (Many) - 80%
  /____________\
```

### Core Principles

1. **Fast Feedback**: Unit tests run in milliseconds
2. **High Coverage**: Target 70%+ for critical paths
3. **Reliable**: Tests should not be flaky
4. **Maintainable**: Tests should be easy to understand and update
5. **Automated**: Run in CI/CD pipeline on every push

### Coverage Targets

- **Backend Critical Paths**: 70%+
- **Frontend Components**: 60%+
- **Integration Tests**: Major user flows
- **E2E Tests**: Critical user journeys

---

## Test Types

### 1. Unit Tests
**Purpose**: Test individual functions/methods in isolation

**Characteristics**:
- Fast (< 100ms per test)
- No external dependencies (mock everything)
- Test single responsibility
- 80% of total tests

**Tools**:
- Jest (test runner)
- ts-jest (TypeScript support)
- Supertest (API testing)

### 2. Integration Tests
**Purpose**: Test multiple components working together

**Characteristics**:
- Medium speed (< 1s per test)
- Use test database
- Test real integrations
- 15% of total tests

**Tools**:
- Jest
- Test MySQL database
- Real WebSocket connections

### 3. End-to-End (E2E) Tests
**Purpose**: Test complete user workflows

**Characteristics**:
- Slow (seconds per test)
- Real browser, database, APIs
- Test critical user journeys
- 5% of total tests

**Tools**:
- Playwright or Cypress
- Full application stack

---

## Backend Testing Strategy

### Test Cases by Component

#### Database Service (`databaseService.ts`)

**Unit Tests**:
```typescript
describe('DatabaseService', () => {
  describe('getUserSettings', () => {
    it('should return user settings when user exists')
    it('should create default settings when user does not exist')
    it('should throw error when database connection fails')
  })

  describe('updateUserSettings', () => {
    it('should update color_scheme successfully')
    it('should reject invalid color_scheme values')
    it('should handle database errors gracefully')
  })

  describe('getWatchlists', () => {
    it('should return all watchlists for a user')
    it('should return empty array when user has no watchlists')
    it('should handle non-existent user gracefully')
  })

  describe('createWatchlist', () => {
    it('should create new watchlist with valid data')
    it('should reject empty watchlist names')
    it('should handle duplicate watchlist names')
  })

  describe('addStockToWatchlist', () => {
    it('should add stock to watchlist successfully')
    it('should reject invalid stock symbols')
    it('should prevent duplicate stocks in same watchlist')
  })

  describe('removeStockFromWatchlist', () => {
    it('should remove stock from watchlist')
    it('should handle non-existent stocks gracefully')
  })
})
```

#### API Routes (`userRoutes.ts`, `preferencesRoutes.ts`)

**Unit Tests**:
```typescript
describe('User Routes', () => {
  describe('GET /api/users', () => {
    it('should return all users')
    it('should return 503 when database is disconnected')
    it('should handle database errors with 500')
  })

  describe('GET /api/users/:id', () => {
    it('should return specific user by ID')
    it('should return 404 when user not found')
    it('should return 400 for invalid ID format')
  })

  describe('POST /api/users', () => {
    it('should create new user with valid data')
    it('should reject missing required fields')
    it('should reject duplicate usernames')
  })
})

describe('Preferences Routes', () => {
  describe('GET /api/preferences/:userId', () => {
    it('should return user preferences')
    it('should create defaults if none exist')
    it('should return 400 for invalid userId')
  })

  describe('PUT /api/preferences/:userId', () => {
    it('should update color_scheme to "standard"')
    it('should update color_scheme to "graded"')
    it('should reject invalid color_scheme values')
    it('should return 400 for missing color_scheme')
  })
})
```

#### Stock Price Service (`enhancedStockPriceService.ts`)

**Unit Tests**:
```typescript
describe('EnhancedStockPriceService', () => {
  describe('Provider Failover', () => {
    it('should use Yahoo Finance as primary provider')
    it('should fallback to Alpha Vantage when Yahoo fails')
    it('should fallback to FMP when both Yahoo and Alpha Vantage fail')
    it('should throw error when all providers fail')
  })

  describe('Caching', () => {
    it('should cache responses for 60 seconds')
    it('should return cached data within TTL')
    it('should refetch after cache expires')
    it('should cache per stock symbol')
  })

  describe('Real-time Updates', () => {
    it('should broadcast price updates via WebSocket')
    it('should update subscribed equities every 10 seconds')
    it('should handle WebSocket disconnections gracefully')
  })
})
```

---

## Frontend Testing Strategy

### Test Cases by Component

#### Settings Page (`settings/page.tsx`)

**Unit Tests**:
```typescript
describe('Settings Page', () => {
  it('should render color scheme options')
  it('should load user preferences on mount')
  it('should save preferences when Save button clicked')
  it('should display success message on save')
  it('should display error message on save failure')
  it('should pre-select current color scheme')
})
```

#### Main Dashboard (`page.tsx`)

**Unit Tests**:
```typescript
describe('Dashboard', () => {
  describe('Watchlist Management', () => {
    it('should display all user watchlists')
    it('should create new watchlist')
    it('should switch between watchlists')
    it('should delete watchlist with confirmation')
  })

  describe('Stock Operations', () => {
    it('should add stock to watchlist')
    it('should validate stock symbol before adding')
    it('should remove stock from watchlist')
    it('should display stock prices')
  })

  describe('Real-time Updates', () => {
    it('should connect to WebSocket on mount')
    it('should update prices when WebSocket emits data')
    it('should reconnect on disconnection')
  })

  describe('Color Scheme', () => {
    it('should load color scheme from preferences')
    it('should apply standard colors correctly')
    it('should apply graded colors correctly')
  })
})
```

#### API Integration

**Unit Tests**:
```typescript
describe('API Config', () => {
  it('should construct correct URLs for endpoints')
  it('should handle WATCHLIST endpoints')
  it('should handle USER_PREFERENCES endpoints')
})

describe('API Error Handling', () => {
  it('should handle 404 errors gracefully')
  it('should handle 500 errors gracefully')
  it('should handle network errors')
  it('should retry failed requests')
})
```

---

## Integration Tests

### Backend + Database

**Test Cases**:
```typescript
describe('Watchlist CRUD Operations', () => {
  beforeAll(async () => {
    // Connect to test database
    await setupTestDatabase()
  })

  afterAll(async () => {
    // Clean up test database
    await teardownTestDatabase()
  })

  it('should create, read, update, delete watchlist')
  it('should add and remove stocks from watchlist')
  it('should handle concurrent operations safely')
})

describe('User Preferences Integration', () => {
  it('should persist preferences to database')
  it('should retrieve saved preferences')
  it('should update preferences atomically')
})
```

### WebSocket Integration

**Test Cases**:
```typescript
describe('WebSocket Real-time Updates', () => {
  it('should broadcast stock updates to all connected clients')
  it('should handle client subscription changes')
  it('should clean up on client disconnect')
})
```

### Frontend + Backend

**Test Cases**:
```typescript
describe('Frontend-Backend Integration', () => {
  it('should fetch users from API')
  it('should create watchlist via API')
  it('should add stock to watchlist via API')
  it('should save preferences via API')
  it('should handle API errors in UI')
})
```

---

## End-to-End (E2E) Tests

### Critical User Journeys

**Test Cases**:
```typescript
describe('E2E: User Workflow', () => {
  it('should complete full user journey', async () => {
    // 1. User selects/creates user account
    // 2. User creates new watchlist
    // 3. User adds stocks to watchlist
    // 4. User sees real-time price updates
    // 5. User changes color scheme in settings
    // 6. User sees updated colors on dashboard
    // 7. User deletes stock from watchlist
    // 8. User deletes watchlist
  })
})

describe('E2E: Settings Management', () => {
  it('should save and apply color scheme preferences')
})

describe('E2E: Real-time Updates', () => {
  it('should display live price updates via WebSocket')
})
```

---

## Testing Tools & Frameworks

### Backend Stack

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0"
  }
}
```

**Jest Configuration** (`backend/jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}
```

### Frontend Stack

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

**Jest Configuration** (`frontend/jest.config.js`):
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
}
```

### E2E Stack

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

---

## Running Tests

### Local Development

**Backend Tests**:
```bash
cd backend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
npm run test:integration # Integration tests only
```

**Frontend Tests**:
```bash
cd frontend
npm test                # Run all tests
npm run test:watch     # Watch mode
npm run test:ui        # With coverage report
```

**All Tests** (from root):
```bash
npm test                    # Run all tests
npm run test:backend       # Backend only
npm run test:frontend      # Frontend only
```

### CI/CD Pipeline

Tests run automatically on:
- Every push to any branch
- Every pull request
- Before deployment

---

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ master, develop, feature/* ]
  pull_request:
    branches: [ master, develop ]

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: mystocks_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        run: cd backend && npm ci
      
      - name: Run unit tests
        run: cd backend && npm test
      
      - name: Run integration tests
        run: cd backend && npm run test:integration
        env:
          DB_HOST: localhost
          DB_USER: root
          DB_PASSWORD: test
          DB_NAME: mystocks_test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend

  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run tests
        run: cd frontend && npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
          npx playwright install
      
      - name: Start backend
        run: cd backend && npm start &
        env:
          DB_HOST: localhost
          DB_USER: root
          DB_PASSWORD: test
      
      - name: Start frontend
        run: cd frontend && npm start &
      
      - name: Wait for services
        run: |
          npx wait-on http://localhost:4000/api/health
          npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Test Scripts (Option C)

### Root Package.json

Add these scripts to `package.json` at the root:

```json
{
  "scripts": {
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd backend && npm test",
    "test:frontend": "cd frontend && npm test",
    "test:watch": "concurrently \"npm run test:backend:watch\" \"npm run test:frontend:watch\"",
    "test:backend:watch": "cd backend && npm run test:watch",
    "test:frontend:watch": "cd frontend && npm run test:watch",
    "test:coverage": "npm run test:backend:coverage && npm run test:frontend:coverage",
    "test:backend:coverage": "cd backend && npm run test:coverage",
    "test:frontend:coverage": "cd frontend && npm run test:coverage",
    "test:integration": "cd backend && npm run test:integration",
    "test:e2e": "playwright test"
  }
}
```

### Backend Package.json

Add these scripts to `backend/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/*.integration.test.ts'",
    "test:unit": "jest --testMatch='**/*.test.ts' --testPathIgnorePatterns='integration'"
  }
}
```

### Frontend Package.json

Add these scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:ui": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

---

## Execution Plan

### Phase 1: Setup (Week 1)
- [x] Create TESTING-GUIDE.md
- [ ] Install testing dependencies (Jest, ts-jest, Supertest)
- [ ] Configure Jest for backend
- [ ] Configure Jest for frontend
- [ ] Create test database configuration
- [ ] Add test scripts to package.json files

### Phase 2: Backend Unit Tests (Week 2)
- [ ] Write database service tests
- [ ] Write API route tests (users, preferences, watchlists)
- [ ] Write stock service tests
- [ ] Mock external APIs
- [ ] Target: 70% code coverage

### Phase 3: Frontend Unit Tests (Week 3)
- [ ] Write component rendering tests
- [ ] Write user interaction tests
- [ ] Write API integration tests
- [ ] Mock fetch calls
- [ ] Target: 60% code coverage

### Phase 4: Integration Tests (Week 4)
- [ ] Setup test database
- [ ] Write backend + database integration tests
- [ ] Write WebSocket integration tests
- [ ] Write frontend + backend integration tests

### Phase 5: CI/CD Integration (Week 5)
- [ ] Create GitHub Actions workflow
- [ ] Configure test database in CI
- [ ] Setup coverage reporting
- [ ] Add status badges to README
- [ ] Configure branch protection rules

### Phase 6: E2E Tests (Week 6)
- [ ] Install Playwright
- [ ] Write critical user journey tests
- [ ] Configure E2E in CI/CD
- [ ] Setup screenshot capture on failure

---

## Best Practices

### Writing Good Tests

1. **Follow AAA Pattern**:
   ```typescript
   it('should do something', () => {
     // Arrange - Setup test data
     const input = 'test'
     
     // Act - Execute the code
     const result = functionUnderTest(input)
     
     // Assert - Verify the result
     expect(result).toBe('expected')
   })
   ```

2. **Test Behavior, Not Implementation**:
   - ✅ Test what the function does
   - ❌ Don't test how it does it

3. **Use Descriptive Test Names**:
   - ✅ `it('should return 404 when user not found')`
   - ❌ `it('test user function')`

4. **Keep Tests Independent**:
   - Each test should run independently
   - Don't rely on test execution order
   - Clean up after each test

5. **Mock External Dependencies**:
   - Mock database calls
   - Mock HTTP requests
   - Mock file system operations

6. **Test Edge Cases**:
   - Empty inputs
   - Null/undefined values
   - Large datasets
   - Error conditions

### Test Organization

```
backend/
├── src/
│   ├── services/
│   │   ├── databaseService.ts
│   │   └── __tests__/
│   │       ├── databaseService.test.ts
│   │       └── databaseService.integration.test.ts
│   └── routes/
│       ├── userRoutes.ts
│       └── __tests__/
│           └── userRoutes.test.ts
```

---

## Coverage Reports

### Viewing Coverage Locally

After running `npm run test:coverage`:

```bash
# Backend
open backend/coverage/lcov-report/index.html

# Frontend
open frontend/coverage/lcov-report/index.html
```

### Coverage Badges

Add to README.md:
```markdown
![Backend Coverage](https://codecov.io/gh/MikeB007/stock-monitor-space/branch/master/graph/badge.svg?flag=backend)
![Frontend Coverage](https://codecov.io/gh/MikeB007/stock-monitor-space/branch/master/graph/badge.svg?flag=frontend)
```

---

## Troubleshooting

### Common Issues

**Tests timing out**:
```typescript
jest.setTimeout(10000) // Increase timeout to 10 seconds
```

**Mock not working**:
```typescript
// Ensure mock is called before importing the module
jest.mock('./module')
const module = require('./module')
```

**Database connection errors**:
```typescript
beforeAll(async () => {
  await databaseService.connect()
})

afterAll(async () => {
  await databaseService.disconnect()
})
```

**WebSocket tests failing**:
```typescript
// Wait for connection
await new Promise(resolve => {
  socket.on('connect', resolve)
})
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## Next Steps

1. **Review this guide** with the team
2. **Install dependencies** for backend and frontend
3. **Write first test** for a critical component
4. **Setup CI/CD** to run tests automatically
5. **Iterate** and improve coverage over time

---

**Last Updated**: November 6, 2025  
**Version**: 1.0.0  
**Status**: Ready for implementation 🚀

This comprehensive document includes:

✅ Testing Strategy Overview - Philosophy, pyramid, coverage targets
✅ Detailed Test Cases - Backend, Frontend, Integration, E2E
✅ Tools & Frameworks - Jest, Supertest, Playwright configurations
✅ Option C Implementation - Root package.json test scripts
✅ CI/CD Integration - Complete GitHub Actions workflow
✅ 6-Week Execution Plan - Phase-by-phase rollout
✅ Best Practices - How to write good tests
✅ Troubleshooting - Common issues and solutions
Next steps:

Review the document
Install testing dependencies
Start with Phase 1 (Setup)

📋 Next Steps (Phase 2)
Ready to implement:

More DatabaseService tests (watchlists, stocks, users)
API route handler tests (GET/POST/PUT/DELETE)
StockPriceService tests (provider failover, caching)