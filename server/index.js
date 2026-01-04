import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { fetchAllReceipts } from './imap-client.js';
import { parseReceipt } from './receipt-parser.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// In-memory cache for app categories
const categoryCache = new Map();

// Keyword-based fallback (Legacy logic moved to backend)
const getFallbackCategory = (appName) => {
    const lowerName = appName.toLowerCase();
    const keywords = {
        '게임': ['game', 'games', '게임', 'play', 'quest', 'clash', 'puzzle', 'plus'],
        '생산성': ['task', 'notes', 'office', 'work', 'manager', 'editor', 'study'],
        '엔터': ['music', 'video', 'photo', 'player', 'stream', 'media'],
        '건강': ['fitness', 'health', 'workout', 'tracker', 'diet'],
    };

    for (const [category, kws] of Object.entries(keywords)) {
        if (kws.some(kw => lowerName.includes(kw))) return category;
    }
    return '기타';
};

// Fetch category from iTunes Search API
const fetchAppCategory = async (appName) => {
    if (!appName) return '기타';

    // Check cache first
    if (categoryCache.has(appName)) {
        return categoryCache.get(appName);
    }

    try {
        console.log(`Searching category for: ${appName}`);
        const response = await axios.get('https://itunes.apple.com/search', {
            params: {
                term: appName,
                entity: 'software',
                limit: 1,
                country: 'kr',
                lang: 'en_us' // Request English response
            },
            timeout: 3000 // 3s timeout
        });

        if (response.data.resultCount > 0) {
            const rawGenre = response.data.results[0].primaryGenreName;
            const genre = rawGenre.toLowerCase(); // Normalized for matching
            let category = '기타';

            // Map iTunes genres to our categories (English & Korean keywords)
            // Games
            if (['games', 'action', 'rpg', 'arcade', 'adventure', 'strategy', 'simulation', 'puzzle', 'board', 'card', 'casino', 'casual', 'racing', 'sports', 'trivia', 'word',
                '게임', '액션', '롤플레잉', '아케이드', '어드벤처', '전략', '시뮬레이션', '퍼즐', '보드', '카드', '카지노', '캐주얼', '레이싱', '스포츠'].some(g => genre.includes(g))) {
                category = '게임';
            }
            // Productivity & Utility
            else if (['productivity', 'utilities', 'business', 'education', 'reference', 'finance', 'news', 'navigation', 'books', 'magazines',
                '생산성', '유틸리티', '비즈니스', '교육', '참고', '금융', '뉴스', '내비게이션', '도서'].some(g => genre.includes(g))) {
                category = '생산성';
            }
            // Entertainment
            else if (['music', 'entertainment', 'photo', 'video', 'social', 'lifestyle', 'travel', 'food', 'drink', 'shopping',
                '음악', '엔터테인먼트', '사진', '비디오', '소셜', '라이프스타일', '여행', '음식'].some(g => genre.includes(g))) {
                category = '엔터';
            }
            // Health
            else if (['health', 'fitness', 'medical', 'sports',
                '건강', '피트니스', '의료'].some(g => genre.includes(g))) {
                category = '건강';
            }

            console.log(`Found category for ${appName}: ${rawGenre} -> ${category}`);
            categoryCache.set(appName, category);
            return category;
        }
    } catch (error) {
        console.warn(`Failed to fetch category for ${appName}:`, error.message);
    }

    // Fallback if API fails or no result
    const fallback = getFallbackCategory(appName);
    console.log(`Using fallback for ${appName}: ${fallback}`);
    categoryCache.set(appName, fallback);
    return fallback;
};

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

    // Process receipts sequentially to handle async category fetching
    for (const r of rawReceipts) {
        const parsed = parseReceipt(r.html);

        for (const item of parsed.items) {
            const category = await fetchAppCategory(item.appName);

            allItems.push({
                uid: r.uid,
                platform: r.platform,
                subject: r.subject,
                date: r.date,
                orderId: parsed.orderId,
                appName: item.appName,
                productName: item.productName,
                price: item.price,
                category: category // Added field
            });
        }
    }

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allItems;
};

// Demo data generator for README screenshots
const generateDummyData = () => {
    const apps = [
        { platform: 'Apple', appName: 'Game Plus', products: ['월간 구독권', '스타터 팩', '보석 500개'], category: '게임' },
        { platform: 'Apple', appName: 'Music Pro', products: ['프리미엄 구독', '고음질 패키지'], category: '엔터' },
        { platform: 'Apple', appName: 'Photo Editor', products: ['필터 팩', '프로 기능 해제', '클라우드 저장소'], category: '엔터' },
        { platform: 'Samsung', appName: 'Fitness Tracker', products: ['연간 멤버십', '개인 코치', '식단 플래너'], category: '건강' },
        { platform: 'Samsung', appName: 'Study Notes', products: ['광고 제거', '무제한 노트', 'PDF 내보내기'], category: '생산성' },
        { platform: 'Apple', appName: 'Weather Live', products: ['프리미엄 업그레이드', '위젯 팩'], category: '생산성' },
        { platform: 'Samsung', appName: 'Video Player', products: ['4K 지원', '자막 다운로드'], category: '엔터' },
        { platform: 'Apple', appName: 'Task Manager', products: ['팀 협업', '캘린더 연동'], category: '생산성' }
    ];

    const prices = [1000, 1200, 2200, 3300, 4400, 5500, 6500, 7700, 9900, 12000, 15000];
    const items = [];
    const now = new Date();

    // Generate 25 dummy receipts over the past 3 months
    for (let i = 0; i < 25; i++) {
        const app = apps[Math.floor(Math.random() * apps.length)];
        const product = app.products[Math.floor(Math.random() * app.products.length)];
        const price = prices[Math.floor(Math.random() * prices.length)];

        // Random date within last 3 months
        const daysAgo = Math.floor(Math.random() * 90);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        items.push({
            uid: `demo-${i + 1}`,
            platform: app.platform,
            subject: `${app.appName} 구매 확인`,
            date: date.toISOString(),
            orderId: `${app.platform === 'Apple' ? 'ML' : 'GS'}${String(Math.floor(Math.random() * 900000000) + 100000000)}`,
            appName: app.appName,
            productName: product,
            price: `₩${price.toLocaleString()}`,
            category: app.category // Include preset category
        });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items;
};

// Demo endpoint for README screenshots
app.get('/api/demo', (req, res) => {
    try {
        const dummyData = generateDummyData();
        res.json(dummyData);
    } catch (error) {
        console.error('Error generating demo data:', error);
        res.status(500).json({ error: error.message });
    }
});

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
