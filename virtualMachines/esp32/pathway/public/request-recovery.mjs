export function createPendingRequestStore(storage, key) {
  function load() {
    const text = storage.getItem(key);
    if (text === null) return null;
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || !/^[A-Za-z0-9_-]{16,96}$/.test(value.requestId) ||
        !value.values || typeof value.values !== 'object' || Array.isArray(value.values) ||
        Object.values(value.values).some(item => typeof item !== 'string')) {
      throw new Error('Saved requester recovery data is invalid; do not blindly repeat an uncertain transaction');
    }
    return value;
  }
  return {
    load,
    begin(values, requestId) {
      const previous = load();
      if (previous) return previous;
      const next = { requestId, values };
      storage.setItem(key, JSON.stringify(next));
      return next;
    },
    complete(requestId) {
      const pending = load();
      if (pending?.requestId !== requestId) throw new Error('Pending request identity changed; recovery data was not cleared');
      storage.removeItem(key);
    },
    abandon() { storage.removeItem(key); },
  };
}
