export function createInventoryClient(grant) {
  if (!grant || typeof grant.endpoint !== 'string' || typeof grant.token !== 'string' || grant.token.length < 32) {
    throw new Error('Invalid inventory transaction deployment grant');
  }
  const endpoint = new URL(grant.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/apply' ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Inventory authority must be an explicitly granted loopback /apply endpoint');
  }
  return async (record, requestId, { signal } = {}) => {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${grant.token}` },
      body: JSON.stringify({ requestId, record }),
    });
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 4096) throw new Error('Inventory response exceeds 4 KiB');
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!response.ok) throw Object.assign(new Error(result.error || `Inventory HTTP ${response.status}`), { status: response.status });
    if (typeof result.reply !== 'string' || result.reply.length > 128 || !/^[\x20-\x7e]+$/.test(result.reply)) {
      throw new Error('Invalid inventory reply');
    }
    return result.reply;
  };
}
