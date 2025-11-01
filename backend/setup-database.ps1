# MySQL Database Setup Script for Stock Monitor
# Run this script to create the mystocks database and admin user

Write-Host "🗄️  Setting up MySQL database for Stock Monitor..." -ForegroundColor Green

# Check if MySQL is accessible
try {
    $mysqlPath = Get-Command mysql -ErrorAction Stop
    Write-Host "✅ MySQL found at: $($mysqlPath.Source)" -ForegroundColor Green
}
catch {
    Write-Host "❌ MySQL not found in PATH. Please install MySQL Server or add it to PATH." -ForegroundColor Red
    Write-Host "Download MySQL: https://dev.mysql.com/downloads/mysql/" -ForegroundColor Yellow
    exit 1
}

# Prompt for MySQL root password
$rootPassword = Read-Host "Enter MySQL root password" -AsSecureString
$rootPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($rootPassword))

Write-Host "📊 Creating database and user..." -ForegroundColor Blue

# Execute the SQL setup script
try {
    mysql -u root -p$rootPasswordPlain -e "source setup-database.sql"
    Write-Host "✅ Database setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database Configuration:" -ForegroundColor Cyan
    Write-Host "  Database: mystocks" -ForegroundColor White
    Write-Host "  User: admin" -ForegroundColor White
    Write-Host "  Password: Ilms2009" -ForegroundColor White
    Write-Host "  Host: localhost" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ Your .env file has been updated with these credentials." -ForegroundColor Green
    Write-Host "🚀 You can now restart the backend server to use the database." -ForegroundColor Green
}
catch {
    Write-Host "❌ Database setup failed. Please check your MySQL root password and try again." -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart the backend server: npm run dev" -ForegroundColor White
Write-Host "2. The backend will automatically create the required tables" -ForegroundColor White
Write-Host "3. Check the logs for successful database initialization" -ForegroundColor White