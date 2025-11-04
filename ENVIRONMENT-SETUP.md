# Environment Configuration Guide

## Overview

This application uses environment variables for configuration management to support multiple deployment environments (development, staging, production) and CI/CD pipelines.

---

## Frontend Configuration (Next.js)

### Environment Variables

All frontend environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

#### Required Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000  # Backend API base URL
NEXT_PUBLIC_WS_URL=http://localhost:4000   # WebSocket server URL (optional, defaults to API_URL)
```

### Environment Files

- **`.env.local`** - Local development (git ignored)
  - Used when running `npm run dev`
  - Points to localhost:4000 backend
- **`.env.production`** - Production deployment

  - Used when running `npm run build` or `npm start`
  - Must point to production backend domain
  - Example: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

- **`.env.example`** - Template file (committed to git)
  - Copy this to `.env.local` for local development
  - Documents all required variables

### Setup Steps

1. Copy the example file:

   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Update `.env.local` with your local backend URL (usually default is fine):

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

3. For production, update `.env.production` with your actual production URL:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
   ```

### Centralized API Configuration

All API endpoints are managed in `frontend/src/config/api.config.ts`:

```typescript
import API_CONFIG from "@/config/api.config";

// Use endpoints like this:
fetch(API_CONFIG.ENDPOINTS.USERS);
fetch(API_CONFIG.ENDPOINTS.PREFERENCES(userId));
fetch(`${API_CONFIG.BASE_URL}/custom/endpoint`);

// WebSocket connection:
io(API_CONFIG.WS_URL);
```

**Never hardcode URLs directly in components!** Always use `API_CONFIG`.

---

## Backend Configuration (Express)

### Environment Variables

#### Required Variables

```bash
# Application Settings
PORT=4000
NODE_ENV=development
USE_REAL_PRICES=true

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mystocks

# CORS Settings - Comma-separated frontend URLs
FRONTEND_URL=http://localhost:3000,http://127.0.0.1:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# API Settings
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# External API Keys (Optional)
ALPHA_VANTAGE_API_KEY=demo
```

### Environment Files

- **`.env`** - Local development (git ignored)
  - Active configuration for `npm run dev`
  - Contains local database credentials
- **`.env.production`** - Production template

  - Template for production deployment
  - Must be configured in production environment (Docker, AWS, Azure, etc.)
  - **Never commit actual production credentials!**

- **`.env.example`** - Setup template (committed to git)
  - Copy this to `.env` for local development
  - Documents all configuration options

### Setup Steps

1. Copy the example file:

   ```bash
   cd backend
   cp .env.example .env
   ```

2. Update `.env` with your local database credentials:

   ```bash
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=mystocks
   ```

3. Create the database:

   ```sql
   CREATE DATABASE mystocks;
   ```

4. Start the backend:
   ```bash
   npm run dev
   ```

---

## Production Deployment

### Docker Deployment

Create a `docker-compose.yml`:

```yaml
version: "3.8"

services:
  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
    ports:
      - "3000:3000"

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      PORT: 4000
      DB_HOST: mysql
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: mystocks
      ALLOWED_ORIGINS: https://yourdomain.com
    ports:
      - "4000:4000"
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: mystocks
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### CI/CD Pipeline Example (GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Build Frontend
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.PRODUCTION_API_URL }}
        run: |
          cd frontend
          npm install
          npm run build

      - name: Build Backend
        env:
          NODE_ENV: production
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
        run: |
          cd backend
          npm install
          npm run build

      - name: Deploy to Server
        # Your deployment steps here
```

### Environment Variables in CI/CD

**GitHub Secrets to Configure:**

- `PRODUCTION_API_URL` - Production backend URL
- `DB_HOST` - Production database host
- `DB_USER` - Production database user
- `DB_PASSWORD` - Production database password
- `ALPHA_VANTAGE_API_KEY` - API key for financial data

### Azure/AWS Deployment

#### Azure App Service

Set environment variables in:

- Portal: Configuration → Application Settings
- CLI: `az webapp config appsettings set`

#### AWS Elastic Beanstalk

Configure in:

- Console: Configuration → Software → Environment properties
- CLI: `.ebextensions/` configuration files

---

## Security Best Practices

### ✅ DO:

- Use environment variables for all configuration
- Keep `.env` files in `.gitignore`
- Use different credentials for dev/staging/prod
- Rotate production credentials regularly
- Use secrets management (AWS Secrets Manager, Azure Key Vault)
- Validate all environment variables at startup

### ❌ DON'T:

- Hardcode URLs, credentials, or API keys in source code
- Commit `.env` files with real credentials
- Use production credentials in development
- Share `.env` files via email or chat
- Expose environment variables in client-side code (except `NEXT_PUBLIC_*`)

---

## Troubleshooting

### Frontend can't connect to backend

1. Check `NEXT_PUBLIC_API_URL` in `.env.local`:

   ```bash
   echo $NEXT_PUBLIC_API_URL  # Should show http://localhost:4000
   ```

2. Verify backend is running on correct port:

   ```bash
   curl http://localhost:4000/api/users
   ```

3. Check browser console for CORS errors

### Backend database connection fails

1. Verify `.env` credentials:

   ```bash
   cat backend/.env | grep DB_
   ```

2. Test MySQL connection:

   ```bash
   mysql -h localhost -u root -p
   ```

3. Check database exists:
   ```sql
   SHOW DATABASES LIKE 'mystocks';
   ```

### Environment variables not loading

1. Restart development servers after changing `.env` files
2. For Next.js, environment variables are locked at build time for production
3. Check variable names start with `NEXT_PUBLIC_` for client-side access
4. Verify `.env` file is in correct directory (frontend/ or backend/)

---

## Quick Reference

### Development URLs

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000
- **WebSocket**: ws://localhost:4000

### File Structure

```
stock-monitor-space/
├── frontend/
│   ├── .env.local          # Local development (git ignored)
│   ├── .env.production     # Production template
│   ├── .env.example        # Setup template (committed)
│   └── src/
│       └── config/
│           └── api.config.ts  # Centralized API config
├── backend/
│   ├── .env                # Local development (git ignored)
│   ├── .env.production     # Production template
│   └── .env.example        # Setup template (committed)
└── .gitignore              # Excludes all .env files
```

### Testing Environment Configuration

```bash
# Test frontend config
cd frontend
npm run build  # Should use .env.production
npm run dev    # Should use .env.local

# Test backend config
cd backend
npm run dev    # Uses .env
NODE_ENV=production npm start  # Would use .env.production
```

---

## Support

For questions about environment configuration, refer to:

- Next.js Environment Variables: https://nextjs.org/docs/basic-features/environment-variables
- Node.js dotenv: https://github.com/motdotla/dotenv
- This project's README.md

---

**Last Updated**: Generated during environment configuration migration
**Related Files**:

- `frontend/src/config/api.config.ts` - API configuration
- `backend/src/server.ts` - CORS and server configuration
- `.gitignore` - Environment file exclusions
