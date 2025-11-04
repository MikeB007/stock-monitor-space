# PowerShell script to replace all 'portfolio' references with 'watchlist'
# Recursively processes all files in stock-monitor-space directory

$rootPath = "G:\GIT_REPOSITORY\REPO\stock-monitor-space"

# File extensions to process
$extensions = @('*.ts', '*.tsx', '*.js', '*.jsx', '*.json', '*.md', '*.html', '*.css', '*.scss')

# Directories to exclude
$excludeDirs = @('node_modules', '.next', 'dist', 'build', '.git', 'coverage', 'target')

Write-Host "Starting portfolio -> watchlist refactoring..." -ForegroundColor Cyan
Write-Host "Root path: $rootPath" -ForegroundColor Yellow
Write-Host ""

$filesProcessed = 0
$filesChanged = 0
$errors = 0

foreach ($extension in $extensions) {
    Write-Host "Processing $extension files..." -ForegroundColor Green
    
    # Get all files with current extension, excluding specified directories
    $files = Get-ChildItem -Path $rootPath -Filter $extension -Recurse -File | Where-Object { 
        $path = $_.FullName
        $exclude = $false
        foreach ($dir in $excludeDirs) {
            if ($path -like "*\$dir\*") {
                $exclude = $true
                break
            }
        }
        -not $exclude
    }
    
    foreach ($file in $files) {
        try {
            $filesProcessed++
            $originalContent = Get-Content $file.FullName -Raw -ErrorAction Stop
            
            # Skip empty files
            if ([string]::IsNullOrWhiteSpace($originalContent)) {
                continue
            }
            
            # Perform replacements
            $newContent = $originalContent -replace 'Portfolio', 'Watchlist' -replace 'portfolio', 'watchlist' -replace 'PORTFOLIO', 'WATCHLIST'
            
            # Only write if content changed
            if ($originalContent -ne $newContent) {
                Set-Content -Path $file.FullName -Value $newContent -NoNewline
                $filesChanged++
                Write-Host "  Updated: $($file.FullName.Replace($rootPath, '.'))" -ForegroundColor Yellow
            }
            
        }
        catch {
            $errors++
            Write-Host "  Error processing $($file.FullName): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Refactoring Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files processed: $filesProcessed" -ForegroundColor White
Write-Host "Files changed:   $filesChanged" -ForegroundColor Yellow
Write-Host "Errors:          $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review changes with: git diff" -ForegroundColor White
Write-Host "2. Test the application" -ForegroundColor White
Write-Host "3. Commit changes with git" -ForegroundColor White
