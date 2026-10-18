export async function fetchServiceResponse(input, options = {}, fetchImpl = globalThis.fetch) {
  const started = Date.now();
  const response = await fetchImpl(input, options);
  const transactionId = response.headers.get('x-pulse-transaction-id');
  if (response.status !== 202 || !transactionId) return response;
  if (!/^[a-f0-9-]{36}$/.test(transactionId)) throw new Error('Invalid durable transaction identity');
  await response.body?.cancel();
  const statusUrl = `/api/runtime/transactions/${transactionId}`;
  try {
    while (true) {
      const statusResponse = await fetchImpl(`${statusUrl}?elapsedMs=${Date.now() - started}`, {
        signal: options.signal, credentials: options.credentials, redirect: 'error',
      });
      if (!statusResponse.ok) throw new Error(`Status HTTP ${statusResponse.status}`);
      const transaction = await statusResponse.json();
      if (transaction.transactionId !== transactionId) throw new Error('Transaction status identity mismatch');
      const decision = transaction.clientDecision;
      if (decision?.action === 'return') {
        const result = transaction.result;
        if (!result || !Number.isInteger(result.status)) throw new Error('Missing transaction result');
        const body = result.bodyEncoding === 'base64'
          ? Uint8Array.from(atob(result.body), character => character.charCodeAt(0))
          : typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
        return new Response([204, 205, 304].includes(result.status) ? null : body, {
          status: result.status,
          headers: { 'content-type': result.contentType || 'application/json',
            'x-pulse-transaction-id': transactionId },
        });
      }
      if (decision?.action !== 'poll') {
        throw new Error(decision?.action === 'timeout' ? 'Still pending; not cancelled or resubmitted'
          : transaction.transportError || transaction.reason || transaction.status);
      }
      if (!Number.isInteger(decision.pollMs) || decision.pollMs <= 0) throw new Error('Invalid polling interval');
      await new Promise((resolve, reject) => {
        options.signal?.throwIfAborted();
        const cleanup = () => options.signal?.removeEventListener('abort', abort);
        const timer = setTimeout(() => { cleanup(); resolve(); }, decision.pollMs);
        function abort() { clearTimeout(timer); cleanup(); reject(options.signal.reason); }
        options.signal?.addEventListener('abort', abort, { once: true });
      });
    }
  } catch (error) {
    throw Object.assign(new Error(`Durable transaction ${transactionId}: ${error.message}`), { transactionId });
  }
}
