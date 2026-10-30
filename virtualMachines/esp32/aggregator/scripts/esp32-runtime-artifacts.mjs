import http from 'node:http';
import https from 'node:https';

// Helpers for shipping compiled programs to an ESP32 node.
//
// The full program map (source map, symbols, field layouts, file list) stays on the
// developer machine for the VS Code / Node debugger. The device only needs the runtime
// subset, and the signature covers the raw pcode text only, so stripping is safe.

export const DEBUG_ONLY_PROGRAM_MAP_KEYS = Object.freeze([
  'sourceMap', 'symbols', 'fields', 'files', 'generatedAt',
  'classDeclarations', 'typeDeclarations'
]);

export function toRuntimeProgramMap(programMap) {
  const runtime = { ...(programMap || {}) };
  for (const key of DEBUG_ONLY_PROGRAM_MAP_KEYS) delete runtime[key];
  if (runtime.procedures && !Array.isArray(runtime.procedures)) {
    runtime.procedures = Object.fromEntries(Object.entries(runtime.procedures).map(([label, procedure]) =>
      [label, {
        params: procedure.params || [],
        ...(procedure.locals ? { locals: procedure.locals } : {})
      }]));
  }
  if (Array.isArray(runtime.entries)) {
    // The device executes compiled `ops`; it discards `conversionRule` text when ops exist.
    runtime.entries = runtime.entries.map((entry) => (!Array.isArray(entry?.items) ? entry : {
      ...entry,
      items: entry.items.map((item) => {
        if (!item?.ops || item.conversionRule === undefined) return item;
        const { conversionRule, ...rest } = item;
        return rest;
      })
    }));
  }
  return runtime;
}

// Raw streaming upload: the form-encoded /ffs/upload route rejects (413) bodies the
// device heap cannot buffer, so artifacts always go through /ffs/upload_stream.
export async function uploadFfsFile(baseUrl, remotePath, content, { timeoutMs = 60000 } = {}) {
  const body = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  const url = `${String(baseUrl).replace(/\/+$/, '')}/ffs/upload_stream?file=${encodeURIComponent(remotePath)}`;
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Expected an HTTP(S) ESP32 origin');
  // Avoid pooled connections: the device may close a streaming response before a
  // fetch connection can safely be reused for the next artifact.
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? https : http).request(target, {
      method: 'POST', agent: false, signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length }
    }, response => {
      const chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 65536) response.destroy(new Error(`upload ${remotePath} response exceeds 64 KiB`));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`upload ${remotePath} failed (${response.statusCode}): ${text}`));
        } else resolve(text);
      });
    });
    request.on('error', error => reject(new Error(`upload ${remotePath}: ${error.message}`, { cause: error })));
    request.end(body);
  });
}
