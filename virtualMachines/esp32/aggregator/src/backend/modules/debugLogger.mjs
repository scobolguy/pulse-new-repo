/**
 * Small shared logging utilities used across backend.mjs route handlers.
 */
export function createDebugLog(enabled) {
  return function debugLog(...args) {
    if (enabled) console.debug(...args);
  };
}

export function formatErrorDetails(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const details = {
    name: error?.name || undefined,
    message: error?.message || undefined,
    code: error?.code || undefined,
    originalMessage: error?.original?.message || undefined,
    originalCode: error?.original?.code || undefined
  };

  if (details.message) {
    if (details.code || details.originalCode) {
      return `${details.message} (code=${details.code || details.originalCode})`;
    }
    return details.message;
  }

  try {
    const compact = JSON.stringify(details);
    if (compact && compact !== '{}') return compact;
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
