const axios = require('axios');

async function testYahooQuoteEndpoint() {
    try {
        console.log('🔍 Testing Yahoo Finance Quote endpoint for extended hours data...\n');

        // Try the quote endpoint which typically has more detailed data
        const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL&formatted=false', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const result = response.data?.quoteResponse?.result?.[0];
        if (!result) {
            console.log('❌ No quote data found');
            return;
        }

        console.log('📊 Available Quote Fields:');
        console.log('=========================');
        Object.keys(result).forEach(key => {
            console.log(`${key}: ${result[key]}`);
        });

        console.log('\n🕐 Extended Hours Fields (if available):');
        console.log('==========================================');

        const extendedHoursFields = [
            'preMarketPrice', 'preMarketChange', 'preMarketChangePercent',
            'postMarketPrice', 'postMarketChange', 'postMarketChangePercent',
            'marketState', 'postMarketTime', 'preMarketTime',
            'bid', 'ask', 'bidSize', 'askSize'
        ];

        extendedHoursFields.forEach(field => {
            if (result[field] !== undefined) {
                console.log(`✅ ${field}: ${result[field]}`);
            } else {
                console.log(`❌ ${field}: not available`);
            }
        });

    } catch (error) {
        if (error.response?.status === 401) {
            console.log('❌ 401 Unauthorized - Yahoo Finance Quote endpoint access denied');
            console.log('This suggests Yahoo Finance is blocking direct API access');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testYahooQuoteEndpoint();