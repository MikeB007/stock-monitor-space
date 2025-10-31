const axios = require('axios');

async function testYahooFinanceData() {
    try {
        console.log('🔍 Testing Yahoo Finance data structure for AAPL...\n');

        const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const data = response.data?.chart?.result?.[0];
        if (!data || !data.meta) {
            console.log('❌ No data found');
            return;
        }

        const meta = data.meta;

        console.log('📊 Available Meta Fields:');
        console.log('========================');
        Object.keys(meta).forEach(key => {
            console.log(`${key}: ${meta[key]}`);
        });

        console.log('\n🕐 Extended Hours Fields (if available):');
        console.log('==========================================');

        // Check for extended hours specific fields
        const extendedHoursFields = [
            'preMarketPrice', 'preMarketChange', 'preMarketChangePercent',
            'postMarketPrice', 'postMarketChange', 'postMarketChangePercent',
            'marketState', 'postMarketTime', 'preMarketTime',
            'bid', 'ask', 'bidSize', 'askSize'
        ];

        extendedHoursFields.forEach(field => {
            if (meta[field] !== undefined) {
                console.log(`✅ ${field}: ${meta[field]}`);
            } else {
                console.log(`❌ ${field}: not available`);
            }
        });

        console.log('\n⏰ Market State Information:');
        console.log('============================');
        if (meta.marketState) {
            console.log(`Market State: ${meta.marketState}`);
        }
        if (meta.exchangeTimezoneName) {
            console.log(`Timezone: ${meta.exchangeTimezoneName}`);
        }
        if (meta.gmtoffset) {
            console.log(`GMT Offset: ${meta.gmtoffset}`);
        }

    } catch (error) {
        if (error.response?.status === 401) {
            console.log('❌ 401 Unauthorized - Yahoo Finance API access denied');
            console.log('This is expected for direct API calls. The backend handles this differently.');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testYahooFinanceData();