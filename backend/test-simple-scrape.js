const axios = require('axios');

async function testSimpleYahooScraping() {
    try {
        console.log('🔍 Testing simplified Yahoo Finance web scraping...\n');

        const response = await axios.get('https://finance.yahoo.com/quote/AAPL/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
            maxRedirects: 5
        });

        const html = response.data;
        console.log('✅ Successfully fetched Yahoo Finance page');
        console.log(`📄 Page size: ${html.length} characters\n`);

        // Look for the window.__INITIAL_STATE__ or similar data
        const patterns = {
            'Initial State': /window\.__INITIAL_STATE__\s*=\s*({.+?});/,
            'App Main': /root\.App\.main\s*=\s*({.+?});/,
            'Quote Summary': /"QuoteSummaryStore":\s*({.+?})(?=,"[^"]*":)/,
            'Simple Quote Data': /"AAPL":\s*({.+?})(?=,"[^"]*":)/
        };

        for (const [name, pattern] of Object.entries(patterns)) {
            const match = html.match(pattern);
            if (match) {
                console.log(`✅ Found ${name} data`);
                try {
                    const data = JSON.parse(match[1]);
                    console.log(`📊 ${name} top-level keys:`, Object.keys(data).slice(0, 10));

                    // Look for price-related data
                    const priceKeys = Object.keys(data).filter(key =>
                        key.toLowerCase().includes('price') ||
                        key.toLowerCase().includes('market') ||
                        key.toLowerCase().includes('quote')
                    );

                    if (priceKeys.length > 0) {
                        console.log(`💰 Price-related keys in ${name}:`, priceKeys);
                    }
                } catch (e) {
                    console.log(`❌ Could not parse ${name} JSON`);
                }
                console.log('');
                break; // Found data, no need to continue
            }
        }

        // Direct pattern matching for key values
        console.log('🎯 Direct pattern matching for key data:\n');

        const directPatterns = {
            'Regular Market Price': /regularMarketPrice["\']?:\s*{[^}]*raw["\']?:\s*([0-9.]+)/,
            'Pre-Market Price': /preMarketPrice["\']?:\s*{[^}]*raw["\']?:\s*([0-9.]+)/,
            'Post-Market Price': /postMarketPrice["\']?:\s*{[^}]*raw["\']?:\s*([0-9.]+)/,
            'Market State': /marketState["\']?:\s*["\']([^"']+)["\']/,
            'Current Price': /["\']regularMarketPrice["\']:\s*([0-9.]+)/,
            'Symbol': /["\']symbol["\']:\s*["\']AAPL["\']/,
        };

        for (const [name, pattern] of Object.entries(directPatterns)) {
            const match = html.match(pattern);
            if (match) {
                console.log(`✅ ${name}: ${match[1]}`);
            } else {
                console.log(`❌ ${name}: not found`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Alternative approaches:');
        console.log('1. Use a headless browser (Puppeteer/Playwright)');
        console.log('2. Try different Yahoo Finance endpoints');
        console.log('3. Use alternative data sources (Alpha Vantage, IEX)');
    }
}

testSimpleYahooScraping();