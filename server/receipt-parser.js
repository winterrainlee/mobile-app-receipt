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
 * Parses Apple receipt HTML to extract individual purchase items
 * V2.0: Returns array of items with app name, product name, and price
 */
export function parseReceipt(rawHtml) {
    const html = decodeQP(rawHtml);
    const $ = cheerio.load(html);

    const items = [];
    let orderId = '';

    // === 1. ORDER ID EXTRACTION ===
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
        if (orderMatch) {
            orderId = orderMatch[1];
        }
    }

    // === 2. MULTI-ITEM EXTRACTION ===
    // Each item is in a table with class "subscription-lockup__container"
    $('table.subscription-lockup__container, table[class*="subscription-lockup"]').each((i, table) => {
        const $table = $(table);

        // App name: in p.custom-gzadzy
        const appName = $table.find('p.custom-gzadzy, p[class*="gzadzy"]').first().text().trim();

        // Product name: first p.custom-wogfc8
        const productName = $table.find('p.custom-wogfc8, p[class*="wogfc8"]').first().text().trim();

        // Price: in p.custom-137u684
        let price = $table.find('p.custom-137u684, p[class*="137u684"]').first().text().trim();

        // Clean up price (remove <br/> etc)
        price = price.replace(/<[^>]*>/g, '').trim();

        if (appName || price) {
            items.push({
                appName: appName || '알 수 없음',
                productName: productName || '',
                price: price || ''
            });
        }
    });

    // Fallback: if no items found via table parsing, try text-based extraction
    if (items.length === 0) {
        const wonMatches = html.match(/₩[\s]*([\d,]+)/g);
        if (wonMatches && wonMatches.length > 0) {
            let maxValue = 0;
            let maxPrice = '';
            for (const priceStr of wonMatches) {
                const cleanPrice = priceStr.replace(/₩\s*/, '');
                const numericValue = parseFloat(cleanPrice.replace(/,/g, ''));
                if (numericValue > maxValue) {
                    maxValue = numericValue;
                    maxPrice = '₩' + cleanPrice;
                }
            }
            items.push({
                appName: '알 수 없음',
                productName: '',
                price: maxPrice
            });
        }
    }

    // Calculate total
    const totalPrice = items.reduce((sum, item) => {
        const val = parseFloat((item.price || '0').replace(/[₩,]/g, '')) || 0;
        return sum + val;
    }, 0);

    console.log(`Parsed receipt - Order ID: ${orderId || 'N/A'}, Items: ${items.length}, Total: ₩${totalPrice.toLocaleString()}`);

    return {
        orderId: orderId || '',
        totalPrice: totalPrice > 0 ? `₩${totalPrice.toLocaleString()}` : '',
        items: items,
    };
}
