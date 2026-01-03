import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';

dotenv.config();

const createClient = (host, user, pass) => {
    return new ImapFlow({
        host: host,
        port: 993,
        secure: true,
        auth: {
            user: user,
            pass: pass
        },
        logger: false
    });
};

/**
 * Fetches Apple receipts from iCloud IMAP
 * @param {Date} startDate - The start date for filtering emails
 */
export async function fetchAppleReceipts(startDate) {
    const client = createClient('imap.mail.me.com', process.env.ICLOUD_EMAIL, process.env.ICLOUD_PASSWORD);
    await client.connect();

    let lock = await client.getMailboxLock('INBOX');
    const receipts = [];

    try {
        console.log(`Searching iCloud for Apple receipts since ${startDate.toISOString().split('T')[0]}...`);

        const searchCriteria = {
            from: 'no_reply@email.apple.com',
            since: startDate
        };

        const sequence = await client.search(searchCriteria);

        if (sequence.length > 0) {
            for await (let message of client.fetch(sequence, { envelope: true, source: true })) {
                const subject = message.envelope.subject || '';
                console.log(`- Found Apple mail: ${subject}`);
                const html = message.source.toString();

                const isReceipt = /receipt|영수증|주문|구입|purchase|₩|총계|합계/i.test(subject + html);

                if (isReceipt) {
                    receipts.push({
                        uid: message.uid,
                        subject,
                        date: message.envelope.date,
                        html,
                        platform: 'Apple'
                    });
                }
            }
        }
    } finally {
        lock.release();
        await client.logout();
    }

    return receipts;
}

/**
 * Fetches Samsung receipts from Gmail IMAP
 * @param {Date} startDate - The start date for filtering emails
 */
export async function fetchSamsungReceipts(startDate) {
    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_PASSWORD) {
        console.log('Gmail credentials not found in env, skipping Samsung receipts.');
        return [];
    }

    const client = createClient('imap.gmail.com', process.env.GMAIL_EMAIL, process.env.GMAIL_PASSWORD);
    await client.connect();

    const mailboxes = await client.list();
    const allMailBox = mailboxes.find(mb => mb.path.includes('All Mail') || mb.path.includes('전체 보관함'))?.path || 'INBOX';

    let lock = await client.getMailboxLock(allMailBox);
    const receipts = [];

    try {
        console.log(`Searching Samsung receipts in ${allMailBox} since ${startDate.toISOString().split('T')[0]}...`);

        const searchCriteria = {
            from: 'applicationstore@samsung.com',
            since: startDate
        };

        const sequence = await client.search(searchCriteria);

        if (sequence.length > 0) {
            for await (let message of client.fetch(sequence, { envelope: true, source: true })) {
                const subject = message.envelope.subject || '';
                console.log(`- Found Samsung mail: ${subject}`);
                const html = message.source.toString();

                if (subject.includes('구매 영수증') || subject.includes('Purchase Receipt')) {
                    receipts.push({
                        uid: message.uid,
                        subject,
                        date: message.envelope.date,
                        html,
                        platform: 'Samsung'
                    });
                }
            }
        }
    } finally {
        lock.release();
        await client.logout();
    }

    return receipts;
}

/**
 * Combined fetching for both platforms
 * @param {Date} startDate - The start date for filtering emails
 */
export async function fetchAllReceipts(startDate) {
    const [apple, samsung] = await Promise.all([
        fetchAppleReceipts(startDate).catch(e => { console.error('Apple fetch error:', e); return []; }),
        fetchSamsungReceipts(startDate).catch(e => { console.error('Samsung fetch error:', e); return []; })
    ]);

    return [...apple, ...samsung];
}
