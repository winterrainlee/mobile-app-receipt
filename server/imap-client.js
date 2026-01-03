import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

/**
 * Fetches Apple receipt emails from iCloud IMAP
 */
export async function fetchAppleReceipts() {
    const client = new ImapFlow({
        host: 'imap.mail.me.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.ICLOUD_EMAIL,
            pass: process.env.ICLOUD_PASSWORD
        },
        logger: false
    });

    await client.connect();

    let receipts = [];
    let lock = await client.getMailboxLock('INBOX');
    try {
        // Search for actual receipt emails from Apple Store/iTunes
        // Look for emails with "receipt" or "영수증" in subject OR body
        // from Apple's receipt sender
        console.log('Searching for receipt emails...');

        // Strategy: Get all emails from Apple's receipt sender first
        let messages = await client.search({
            from: 'no_reply@email.apple.com'
        });

        console.log(`Found ${messages.length} emails from no_reply@email.apple.com`);

        for (let uid of messages) {
            let message = await client.fetchOne(uid, { source: true, envelope: true });
            const subject = message.envelope.subject || '';
            const html = message.source.toString();

            // Filter: Only keep emails that are actually receipts
            // Receipt emails contain keywords like "receipt", "invoice", "영수증", "주문" etc.
            const isReceipt = /receipt|invoice|영수증|주문|구입|purchase/i.test(subject) ||
                /주문\s*ID|Order\s*ID|문서.*\d{12}|₩|총계|합계/i.test(html);

            if (isReceipt) {
                receipts.push({
                    uid: message.uid,
                    subject: subject,
                    date: message.envelope.date,
                    html: html
                });
            } else {
                console.log(`Skipping non-receipt email: ${subject.substring(0, 50)}...`);
            }
        }

        console.log(`Filtered to ${receipts.length} actual receipt emails`);
    } finally {
        lock.release();
    }

    await client.logout();
    return receipts;
}
