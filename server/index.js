import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchAllReceipts } from './imap-client.js';
import { parseReceipt } from './receipt-parser.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Parse startDate from query or default to 3 months ago
const getStartDate = (queryDate) => {
    if (queryDate) {
        return new Date(queryDate);
    }
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date;
};

// API routes logic
const getSyncData = async (startDate) => {
    console.log(`Fetching receipts from all sources since ${startDate.toISOString().split('T')[0]}...`);
    const rawReceipts = await fetchAllReceipts(startDate);
    console.log(`Found ${rawReceipts.length} total raw receipts.`);

    const allItems = [];

    rawReceipts.forEach(r => {
        const parsed = parseReceipt(r.html);

        parsed.items.forEach(item => {
            allItems.push({
                uid: r.uid,
                platform: r.platform,
                subject: r.subject,
                date: r.date,
                orderId: parsed.orderId,
                appName: item.appName,
                productName: item.productName,
                price: item.price
            });
        });
    });

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allItems;
};

app.get('/api/sync', async (req, res) => {
    try {
        const startDate = getStartDate(req.query.startDate);
        const data = await getSyncData(startDate);
        res.json(data);
    } catch (error) {
        console.error('Error syncing receipts:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/export-csv', async (req, res) => {
    try {
        const startDate = getStartDate(req.query.startDate);
        const allItems = await getSyncData(startDate);
        const csvHeader = '연도,월,일,플랫폼,주문번호,앱이름,상품명,금액,금액(숫자)\n';
        const csvRows = allItems.map(r => {
            const d = new Date(r.date);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const numericPrice = r.price ? parseFloat(r.price.replace(/[₩,]/g, '')) : 0;
            return `${year},${month},${day},"${r.platform}","${r.orderId || 'N/A'}","${r.appName || ''}","${r.productName || ''}","${r.price || '미확인'}",${numericPrice}`;
        }).join('\n');

        const csvContent = '\uFEFF' + csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=integrated_receipts_v3.csv');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: error.message });
    }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
