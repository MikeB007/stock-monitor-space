# 🗄️ MySQL Database Setup Guide for Stock Monitor

## Quick Setup Instructions

### Option 1: Using MySQL Workbench (Recommended)
1. **Open MySQL Workbench**
2. **Connect to your MySQL server** as root
3. **Run these SQL commands**:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS mystocks;

-- Create user if it doesn't exist
CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY 'Ilms2009';

-- Grant all privileges on the mystocks database to admin user
GRANT ALL PRIVILEGES ON mystocks.* TO 'admin'@'localhost';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Use the mystocks database
USE mystocks;

-- Verify setup
SHOW TABLES;
SELECT 'Database mystocks ready for Stock Monitor!' as Status;
```

### Option 2: Using Command Line (if MySQL is in PATH)
Open Command Prompt or PowerShell and run:
```bash
mysql -u root -p
```
Then paste the SQL commands from Option 1.

### Option 3: Using MySQL Command Line Client
1. **Find MySQL Command Line Client** in your Start Menu
2. **Enter your root password** when prompted
3. **Run the SQL commands** from Option 1

## Current Configuration
Your backend is configured with:
- **Host**: localhost
- **Port**: 3306  
- **Database**: mystocks
- **Username**: admin
- **Password**: Ilms2009

## Verification
After setting up the database, restart your backend server:
1. Stop the current backend (Ctrl+C in the terminal)
2. Run: `npm run dev`
3. Look for: `✅ Database initialized successfully!`

## Expected Success Messages
When the database is properly configured, you should see:
```
🗄️  Connecting to MySQL database...
✅ Database connection successful
✅ Tables initialized: portfolio_stocks, stock_prices_history  
✅ Default portfolio stocks added
✅ Database initialized successfully!
🗄️  MySQL Portfolio Management: Enabled
```

## If You See Errors
- **"Access denied"**: Check your admin user password
- **"Database doesn't exist"**: Run the CREATE DATABASE command
- **"User doesn't exist"**: Run the CREATE USER command
- **"Connection refused"**: Make sure MySQL server is running

## Need Help?
The setup-database.sql file contains all the commands you need.
Just copy and paste them into your MySQL client!

🚀 **Once the database is set up, the Stock Monitor will automatically create the required tables and start recording real stock prices!**