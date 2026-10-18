import { object } from './dataMapperModel.js';
import { LogicalServiceTransactions } from './logicalServiceTransactions.js';
export const ESP32_LIBRARIAN_SERVICE_ID = 'pulse-librarian-s3-readonly';
export class Esp32LibrarianBackend {
    baseUrl;
    transactions;
    constructor(baseUrl, signal, transactionTimeoutMs) {
        this.transactions = new LogicalServiceTransactions(baseUrl, signal, transactionTimeoutMs);
        this.baseUrl = this.transactions.baseUrl;
    }
    async requestPage(path, cursor) {
        const response = await this.transactions.request(ESP32_LIBRARIAN_SERVICE_ID, {
            method: 'POST',
            path: '/api/librarian/schemas/page',
            body: { path, cursor, limit: 8 },
        });
        if (response.status < 200 || response.status >= 300 || !object(response.body)) {
            throw new Error(`ESP32 Librarian service returned HTTP ${response.status}.`);
        }
        const envelope = response.body;
        if (typeof envelope.status !== 'number' || typeof envelope.body !== 'string') {
            throw new Error('ESP32 Librarian returned an invalid Filesystem response envelope.');
        }
        if (envelope.status !== 200) {
            throw new Error(`ESP32 Filesystem HTTP ${envelope.status}: ${envelope.body.slice(0, 500)}`);
        }
        try {
            return JSON.parse(envelope.body);
        }
        catch {
            throw new Error('ESP32 Filesystem returned invalid schema page JSON.');
        }
    }
    async schemas(path = '') {
        const entries = [];
        const cursors = new Set();
        let cursor = '';
        for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
            const page = await this.requestPage(path, cursor);
            if (!object(page) || !Array.isArray(page.entries) || page.entries.length > 8 ||
                typeof page.nextCursor !== 'string') {
                throw new Error('ESP32 Filesystem returned an invalid schema page.');
            }
            for (const entry of page.entries) {
                if (!object(entry) || typeof entry.name !== 'string' || !entry.name ||
                    /[\\/:]/.test(entry.name) || entry.name === '.' || entry.name === '..' ||
                    (entry.kind !== 'file' && entry.kind !== 'directory') ||
                    (entry.size !== undefined && (typeof entry.size !== 'number' || !Number.isFinite(entry.size) || entry.size < 0)) ||
                    (entry.modifiedAt !== undefined && typeof entry.modifiedAt !== 'string')) {
                    throw new Error('ESP32 Filesystem returned an invalid schema entry.');
                }
                entries.push({
                    name: entry.name, path: path ? `${path}/${entry.name}` : entry.name, kind: entry.kind,
                    ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
                    ...(typeof entry.modifiedAt === 'string' ? { modifiedAt: entry.modifiedAt } : {}),
                });
            }
            if (!page.nextCursor)
                return entries;
            if (cursors.has(page.nextCursor))
                throw new Error('ESP32 schema pagination cursor did not advance.');
            cursors.add(page.nextCursor);
            cursor = page.nextCursor;
        }
        throw new Error('ESP32 schema listing exceeded the 100-page limit.');
    }
}
//# sourceMappingURL=esp32LibrarianBackend.js.map