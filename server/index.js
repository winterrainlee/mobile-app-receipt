import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchAppleReceipts } from './imap-client.js';
import { parseReceipt } from './receipt-parser.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// API routes logic
const getSyncData = async () => {
    console.log('Fetching receipts...');
    const rawReceipts = await fetchAppleReceipts();

    if (rawReceipts.length > 0 && process.env.NODE_ENV !== 'production') {
        const debugDir = './debug';
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir);
        }
        fs.writeFileSync(
            path.join(debugDir, 'sample_receipt.html'),
            rawReceipts[0].html,
            'utf-8'
        );
    }

    const allItems = [];
    rawReceipts.forEach(r => {
        const parsed = parseReceipt(r.html);
        parsed.items.forEach(item => {
            allItems.push({
                uid: r.uid,
                subject: r.subject,
                date: r.date,
                orderId: parsed.orderId,
                appName: item.appName,
                productName: item.productName,
                price: item.price
            });
        });
    });

    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allItems;
};

app.get('/api/sync', async (req, res) => {
    try {
        const data = await getSyncData();
        res.json(data);
    } catch (error) {
        console.error('Error syncing receipts:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/export-csv', async (req, res) => {
    try {
        const allItems = await getSyncData();
        const csvHeader = '연도,월,일,주문번호,앱이름,상품명,금액,금액(숫자)\n';
        const csvRows = allItems.map(r => {
            const d = new Date(r.date);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const numericPrice = r.price ? parseFloat(r.price.replace(/[₩,]/g, '')) : 0;
            return `${year},${month},${day},"${r.orderId || 'N/A'}","${r.appName || ''}","${r.productName || ''}","${r.price || '미확인'}",${numericPrice}`;
        }).join('\n');

        const csvContent = '\uFEFF' + csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=apple_receipts_v2.csv');
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
