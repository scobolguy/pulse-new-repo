import http from 'node:http';
import https from 'node:https';

export function requestEsp32(url, { method = 'GET', body, headers = {}, signal, timeoutMs = 60000 } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Expected an HTTP(S) URL');
  const payload = body instanceof URLSearchParams ? body.toString() : body;
  const requestHeaders = { ...headers };
  if (body instanceof URLSearchParams) requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  if (payload !== undefined) requestHeaders['Content-Length'] = Buffer.byteLength(payload);
  const transport = target.protocol === 'https:' ? https : http;
  const deadline = AbortSignal.timeout(timeoutMs);
  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method, headers: requestHeaders, agent: false,
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: response.statusCode,
          ok: response.statusCode >= 200 && response.statusCode < 300,
          text: async () => text
        });
      });
    });
    request.on('error', reject);
    request.end(payload);
  });
}
