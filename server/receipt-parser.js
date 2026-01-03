import * as cheerio from 'cheerio';
import quotedPrintable from 'quoted-printable';

/**
 * Decodes QUOTED-PRINTABLE encoded strings
 */
function decodeQP(text) {
    try {
        const decoded = quotedPrintable.decode(text);
        return Buffer.from(decoded, 'binary').toString('utf-8');
    } catch (e) {
        return text;
    }
}

/**
 * Parser for Apple (iCloud) Receipts
 */
function parseAppleReceipt($, html) {
    const items = [];
    let orderId = '';

    // Order ID extraction
    $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text === '주문 ID:' || text.includes('주문 ID:')) {
            const nextP = $(el).next('p');
            if (nextP.length) {
                const potentialId = nextP.text().trim();
                if (/^[A-Z0-9]{6,15}$/i.test(potentialId)) {
                    orderId = potentialId;
                }
            }
        }
    });

    if (!orderId) {
        const orderMatch = html.match(/주문\s*ID\s*:?\s*(?:<[^>]*>)*\s*([A-Z0-9]{6,15})/i);
        if (orderMatch) orderId = orderMatch[1];
    }

    // Multi-item extraction
    $('table.subscription-lockup__container, table[class*="subscription-lockup"]').each((i, table) => {
        const $table = $(table);
        const appName = $table.find('p.custom-gzadzy, p[class*="gzadzy"]').first().text().trim();
        const productName = $table.find('p.custom-wogfc8, p[class*="wogfc8"]').first().text().trim();
        let price = $table.find('p.custom-137u684, p[class*="137u684"]').first().text().trim();
        price = price.replace(/<[^>]*>/g, '').trim();

        if (appName || price) {
            items.push({
                appName: appName || '알 수 없음',
                productName: productName || '',
                price: price || ''
            });
        }
    });

    return { orderId, items };
}

/**
 * Parser for Samsung (Galaxy Store) Receipts
 * 삼성 영수증은 테이블 기반, 각 행에 레이블-값 쌍으로 구성
 */
function parseSamsungReceipt($, html) {
    const items = [];
    let orderId = '';
    let appName = '';
    let productName = '';
    let totalPrice = '';

    // Samsung uses nested tables with key-value pairs
    // The structure is: <tr><td>label (e.g. "- 애플리케이션 이름")</td><td>value</td></tr>

    // Get all text content with labels
    const allText = html;

    // Extract using regex on decoded HTML - more reliable for nested tables
    // 애플리케이션 이름
    const appNameMatch = allText.match(/애플리케이션 이름<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (appNameMatch) {
        appName = appNameMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // 상품 이름
    const productMatch = allText.match(/상품 이름<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (productMatch) {
        productName = productMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // 주문 번호 (형식: P2025...)
    const orderMatch = allText.match(/주문 번호<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<td[^>]*>(P\d{10,20}[A-Z0-9]*)<\/td>/i);
    if (orderMatch) {
        orderId = orderMatch[1].trim();
    }

    // 합계 금액 (font-weight:bold가 있는 합계 행)
    const totalMatch = allText.match(/합계<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (totalMatch) {
        // Extract the price value, replacing ￦ with ₩
        totalPrice = totalMatch[1].replace(/<[^>]*>/g, '').replace('￦', '₩').trim();
    }

    if (appName || totalPrice) {
        items.push({
            appName: appName || 'Samsung 앱',
            productName: productName || '',
            price: totalPrice || ''
        });
    }

    return { orderId, items };
}

/**
 * Main Receipt Parsing Engine
 * V3.0: Automatically detects brand and parses accordingly
 */
export function parseReceipt(rawHtml) {
    const html = decodeQP(rawHtml);
    const $ = cheerio.load(html);

    let result;

    // Detection logic
    if (html.includes('apple.com') || html.includes('Apple ID') || html.includes('주문 ID:')) {
        result = parseAppleReceipt($, html);
    } else if (html.includes('samsung.com') || html.includes('Galaxy Store') || html.includes('애플리케이션 이름')) {
        result = parseSamsungReceipt($, html);
    } else {
        // Generic Fallback
        result = { orderId: '', items: [] };
        const wonMatches = html.match(/[₩￦][\s]*([\d,]+)/g);
        if (wonMatches) {
            let maxPrice = wonMatches[0].replace('￦', '₩');
            result.items.push({ appName: '알 수 없음', productName: '', price: maxPrice });
        }
    }

    // Calculate total
    const totalPriceNum = result.items.reduce((sum, item) => {
        const val = parseFloat((item.price || '0').replace(/[₩,]/g, '')) || 0;
        return sum + val;
    }, 0);

    return {
        orderId: result.orderId || '',
        totalPrice: totalPriceNum > 0 ? `₩${totalPriceNum.toLocaleString()}` : '',
        items: result.items,
    };
}
