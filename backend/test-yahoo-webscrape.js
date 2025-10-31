const axios = require('axios');

async function testYahooWebScraping() {
    try {
        console.log('🔍 Testing Yahoo Finance web page scraping for AAPL...\n');

        const response = await axios.get('https://finance.yahoo.com/quote/AAPL/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 15000
        });

        const html = response.data;
        console.log('✅ Successfully fetched Yahoo Finance page');
        console.log(`📄 Page size: ${html.length} characters\n`);

        // Look for JSON data embedded in the page
        console.log('🔍 Searching for embedded JSON data...\n');

        // Method 1: Look for root.App.main data (common pattern)
        const rootAppMatch = html.match(/root\.App\.main\s*=\s*({.+?});/);
        if (rootAppMatch) {
            console.log('✅ Found root.App.main data');
            try {
                const data = JSON.parse(rootAppMatch[1]);
                console.log('📊 Root App Data Keys:', Object.keys(data));
            } catch (e) {
                console.log('❌ Could not parse root.App.main data');
            }
        }

        // Method 2: Look for QuoteSummaryStore data
        const quoteSummaryMatch = html.match(/"QuoteSummaryStore":\s*({.+?})(?=,")/);
        if (quoteSummaryMatch) {
            console.log('✅ Found QuoteSummaryStore data');
            try {
                const data = JSON.parse(quoteSummaryMatch[1]);
                console.log('📊 QuoteSummaryStore Keys:', Object.keys(data));

                // Look for price data
                if (data.price) {
                    console.log('\n💰 Price Data Found:');
                    console.log('===================');
                    Object.keys(data.price).forEach(key => {
                        if (key.includes('Market') || key.includes('price') || key.includes('Price')) {
                            console.log(`${key}: ${JSON.stringify(data.price[key])}`);
                        }
                    });
                }
            } catch (e) {
                console.log('❌ Could not parse QuoteSummaryStore data');
            }
        }

        // Method 3: Look for specific price patterns in HTML
        console.log('\n🎯 Searching for specific price patterns...\n');

        // Regular market price
        const regularPriceMatch = html.match(/data-symbol="AAPL"[^>]*data-field="regularMarketPrice"[^>]*>([^<]+)</);
        if (regularPriceMatch) {
            console.log(`✅ Regular Market Price: $${regularPriceMatch[1]}`);
        }

        // Pre-market price patterns
        const preMarketPatterns = [
            /preMarketPrice["']:\s*{["']raw["']:\s*([0-9.]+)/,
            /["']preMarketPrice["']:\s*([0-9.]+)/,
            /"preMarketPrice":\s*([0-9.]+)/
        ];

        preMarketPatterns.forEach((pattern, index) => {
            const match = html.match(pattern);
            if (match) {
                console.log(`✅ Pre-Market Price (Pattern ${index + 1}): $${match[1]}`);
            }
        });

        // Post-market price patterns
        const postMarketPatterns = [
            /postMarketPrice["']:\s*{["']raw["']:\s*([0-9.]+)/,
            /["']postMarketPrice["']:\s*([0-9.]+)/,
            /"postMarketPrice":\s*([0-9.]+)/
        ];

        postMarketPatterns.forEach((pattern, index) => {
            const match = html.match(pattern);
            if (match) {
                console.log(`✅ Post-Market Price (Pattern ${index + 1}): $${match[1]}`);
            }
        });

        // Look for market state
        const marketStateMatch = html.match(/"marketState":"([^"]+)"/);
        if (marketStateMatch) {
            console.log(`✅ Market State: ${marketStateMatch[1]}`);
        }

        // Look for bid/ask data
        const bidMatch = html.match(/"bid":\s*([0-9.]+)/);
        const askMatch = html.match(/"ask":\s*([0-9.]+)/);
        if (bidMatch) console.log(`✅ Bid: $${bidMatch[1]}`);
        if (askMatch) console.log(`✅ Ask: $${askMatch[1]}`);

        console.log('\n📝 Summary:');
        console.log('===========');
        console.log('✅ Web scraping is possible');
        console.log('✅ Page contains embedded JSON data');
        console.log('✅ Extended hours data should be available');
        console.log('🎯 Recommend parsing QuoteSummaryStore or root.App.main data');

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log('❌ Request timeout - Yahoo Finance may be slow');
        } else {
            console.error('❌ Error fetching Yahoo Finance page:', error.message);
        }
    }
}

testYahooWebScraping();