import { object } from './dataMapperModel.js';
const MAX_TRANSACTION_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 250;
export class LogicalServiceTransactions {
    signal;
    timeoutMs;
    baseUrl;
    constructor(baseUrl, signal, timeoutMs = MAX_TRANSACTION_WAIT_MS) {
        this.signal = signal;
        this.timeoutMs = timeoutMs;
        let url;
        try {
            url = new URL(baseUrl);
        }
        catch {
            throw new Error('pulse-pmachine.backendUrl must be an HTTP/HTTPS base URL without credentials, query or fragment.');
        }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
            throw new Error('pulse-pmachine.backendUrl must be an HTTP/HTTPS base URL without credentials, query or fragment.');
        }
        this.baseUrl = url.toString().replace(/\/+$/, '');
    }
    async request(serviceId, request) {
        const timeoutMs = Math.max(1, Math.min(this.timeoutMs, MAX_TRANSACTION_WAIT_MS));
        const deadline = Date.now() + timeoutMs;
        const accepted = await this.fetchJson(`${this.baseUrl}/api/runtime/services/${encodeURIComponent(serviceId)}/transactions`, {
            method: 'POST',
            body: JSON.stringify({
                method: request.method,
                path: request.path,
                ...(request.body === undefined ? {} : { body: request.body }),
                ...(request.headers === undefined ? {} : { headers: request.headers }),
            }),
        }, Math.min(10000, timeoutMs));
        if (!object(accepted) || typeof accepted.transactionId !== 'string' || !accepted.transactionId
            || (accepted.status !== 'held' && accepted.status !== 'allocated')
            || typeof accepted.statusUrl !== 'string') {
            throw new Error('Aggregator returned an invalid transaction acceptance response.');
        }
        const transactionId = accepted.transactionId;
        let statusUrl;
        try {
            statusUrl = new URL(accepted.statusUrl, `${this.baseUrl}/`);
        }
        catch {
            throw new Error(`Aggregator returned an invalid status URL for transaction ${transactionId}.`);
        }
        if (statusUrl.origin !== new URL(this.baseUrl).origin
            || !statusUrl.pathname.startsWith('/api/runtime/transactions/')
            || statusUrl.search || statusUrl.hash) {
            throw new Error(`Aggregator returned a transaction status URL outside the configured backend for ${transactionId}.`);
        }
        while (Date.now() < deadline) {
            this.signal?.throwIfAborted();
            const remaining = deadline - Date.now();
            let status;
            try {
                status = await this.fetchJson(statusUrl.toString(), {}, Math.min(10000, remaining));
            }
            catch (error) {
                this.signal?.throwIfAborted();
                if (Date.now() >= deadline)
                    break;
                if (error instanceof Error && error.name === 'TimeoutError') {
                    throw new Error(`Timed out checking transaction ${transactionId}; check its status at ${accepted.statusUrl}.`);
                }
                throw error;
            }
            if (!object(status) || status.transactionId !== transactionId || status.serviceId !== serviceId
                || typeof status.status !== 'string') {
                throw new Error(`Aggregator returned invalid status for transaction ${transactionId}.`);
            }
            if (status.status === 'completed') {
                if (!object(status.result) || typeof status.result.status !== 'number'
                    || status.result.status < 100 || status.result.status > 599 || !('body' in status.result)) {
                    throw new Error(`Aggregator returned an invalid result for transaction ${transactionId}.`);
                }
                return { status: status.result.status, body: status.result.body };
            }
            if (status.status === 'failed' || status.status === 'uncertain') {
                const reason = typeof status.reason === 'string' && status.reason ? `: ${status.reason}` : '';
                throw new Error(`Transaction ${transactionId} ${status.status}${reason}`);
            }
            if (status.status !== 'held' && status.status !== 'allocated' && status.status !== 'waiting-child') {
                throw new Error(`Aggregator returned unknown status for transaction ${transactionId}.`);
            }
            await this.delay(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
        }
        throw new Error(`Transaction ${transactionId} did not complete within ${timeoutMs / 1000} seconds; check its status at ${accepted.statusUrl}.`);
    }
    async delay(ms) {
        if (!this.signal) {
            await new Promise(resolve => setTimeout(resolve, ms));
            return;
        }
        this.signal.throwIfAborted();
        await new Promise((resolve, reject) => {
            const onAbort = () => {
                clearTimeout(timer);
                reject(this.signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
            };
            const timer = setTimeout(() => {
                this.signal?.removeEventListener('abort', onAbort);
                resolve();
            }, ms);
            this.signal?.addEventListener('abort', onAbort, { once: true });
        });
    }
    async fetchJson(url, init, requestTimeoutMs) {
        const signals = [AbortSignal.timeout(Math.max(1, requestTimeoutMs))];
        if (this.signal)
            signals.push(this.signal);
        const response = await fetch(url, {
            ...init,
            redirect: 'error',
            signal: AbortSignal.any(signals),
            ...(init.body === undefined ? {} : { headers: { 'content-type': 'application/json' } }),
        });
        let data;
        try {
            data = await response.json();
        }
        catch {
            throw new Error(`Aggregator returned invalid JSON (HTTP ${response.status}).`);
        }
        if (!response.ok) {
            const detail = object(data) && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
            throw new Error(`Aggregator transaction request failed: ${detail}`);
        }
        return data;
    }
}
//# sourceMappingURL=logicalServiceTransactions.js.map