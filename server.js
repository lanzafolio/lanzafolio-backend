// --- server.js (המוח של LanzaFolio) ---
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

// --- בדיקה זמנית - למחוק מיד אחרי! ---
const ALPHA_VANTAGE_KEY = "TX49ZKO7ONIAKEU6 ALPHA VANTAGE";
const FINNHUB_KEY = "d3stje9r01qpdd5l8sjgd3stje9r01qpdd5l8sk0 FINNHUB";
// --- סוף בדיקה זמנית ---

// קריאת המפתחות הסודיים ממשתני הסביבה (נגדיר אותם ב-Render)
// const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
// const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// --- נקודה 1: נתונים לדף הבית (עד 20 מכל סוג) ---
app.get('/market-movers', async (req, res) => {
    try {
        const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        // לוקחים עד 20 מכל רשימה (כמו שביקשת)
        const marketData = {
            topGainers: data.top_gainers ? data.top_gainers.slice(0, 20) : [],
            mostActive: data.most_actively_traded ? data.most_actively_traded.slice(0, 20) : [],
        };
        res.json(marketData);

    } catch (error) {
        console.error("Error fetching market movers:", error);
        res.status(500).json({ error: 'Failed to fetch market movers' });
    }
});

// --- נקודה 2: נתונים עבור מניה ספציפית ---
app.get('/stock-data', async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res.status(400).json({ error: 'חסר סימול מניה' });
    }

    if (!ALPHA_VANTAGE_KEY || !FINNHUB_KEY) {
        return res.status(500).json({ error: 'שגיאת תצורה בשרת: מפתחות API חסרים' });
    }

    try {
        // הכנת כל הבקשות ל-API במקביל
        const requests = [
            fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`),
            fetch(`https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`),
            fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`),
            fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`),
            fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FINNHUB_KEY}`),
            fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${Math.floor((Date.now() / 1000) - 31536000)}&to=${Math.floor(Date.now() / 1000)}&token=${FINNHUB_KEY}`)
        ];

        const responses = await Promise.all(requests);

        const [
            overviewRes,
            incomeRes,
            newsRes,
            quoteRes,
            recommendationRes,
            candleRes
        ] = await Promise.all(responses.map(r => r.json()));

        // בדיקת "Unusual Volume"
        const currentVolume = quoteRes.v; 
        const isUnusualVolume = currentVolume > 10000000; // לוגיקה בסיסית, ניתן לשכלל בעתיד

        // איחוד כל המידע לחבילה אחת
        const combinedData = {
            overview: overviewRes,
            incomeStatement: incomeRes.quarterlyReports ? incomeRes.quarterlyReports[0] : {}, // דוח רבעוני אחרון
            news: newsRes.feed || [],
            quote: quoteRes,
            recommendations: recommendationRes[0] || {},
            chartData: candleRes,
            flags: {
                isUnusualVolume: isUnusualVolume,
            }
        };

        res.json(combinedData);

    } catch (error) {
        console.error("Error fetching stock data:", error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`שרת מאזין בפורט ${PORT}`);

});



