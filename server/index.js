import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
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


// XLSX export with two sheets: Monthly Summary + All Receipts
app.get('/api/export-xlsx', async (req, res) => {
    try {
        const startDate = getStartDate(req.query.startDate);
        const allItems = await getSyncData(startDate);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'In-app Purchase Manager';
        workbook.created = new Date();

        // Sheet 1: Monthly Summary
        const summarySheet = workbook.addWorksheet('월별 요약');
        summarySheet.columns = [
            { header: '연도', key: 'year', width: 10 },
            { header: '월', key: 'month', width: 8 },
            { header: '총 금액', key: 'total', width: 15 },
            { header: '구매 건수', key: 'count', width: 12 }
        ];

        // Group by month
        const monthly = {};
        allItems.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) {
                monthly[key] = { year: d.getFullYear(), month: d.getMonth() + 1, total: 0, count: 0 };
            }
            const val = parseFloat((r.price || '0').replace(/[₩,]/g, '')) || 0;
            monthly[key].total += val;
            monthly[key].count += 1;
        });

        const monthlyRows = Object.values(monthly).sort((a, b) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
        );
        monthlyRows.forEach(row => summarySheet.addRow(row));

        // Style header row
        summarySheet.getRow(1).font = { bold: true };
        summarySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Sheet 2: All Receipts
        const detailSheet = workbook.addWorksheet('전체 내역');
        detailSheet.columns = [
            { header: '날짜', key: 'date', width: 12 },
            { header: '플랫폼', key: 'platform', width: 10 },
            { header: '주문번호', key: 'orderId', width: 20 },
            { header: '앱이름', key: 'appName', width: 20 },
            { header: '상품명', key: 'productName', width: 25 },
            { header: '금액', key: 'price', width: 12 },
            { header: '금액(숫자)', key: 'numericPrice', width: 12 }
        ];

        allItems.forEach(r => {
            const d = new Date(r.date);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const numericPrice = r.price ? parseFloat(r.price.replace(/[₩,]/g, '')) : 0;
            detailSheet.addRow({
                date: dateStr,
                platform: r.platform,
                orderId: r.orderId || 'N/A',
                appName: r.appName || '',
                productName: r.productName || '',
                price: r.price || '미확인',
                numericPrice: numericPrice
            });
        });

        // Style header row
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Generate file
        const today = new Date().toISOString().split('T')[0];
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=receipts_${today}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Error exporting XLSX:', error);
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
