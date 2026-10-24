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
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`upload ${remotePath} failed (${response.status}): ${text}`);
  return text;
}
