const enabled = () => /^(1|true|yes|on)$/i.test(String(process.env.PULSE_DSL_DEBUG || ''));

export function dslDebug(language, phase, details = {}) {
  if (!enabled()) return;
  const payload = details && typeof details === 'object' ? details : { value: details };
  console.error(`[DSL:${String(language).toUpperCase()}:${phase}] ${JSON.stringify(payload)}`);
}

export function dslError(language, phase, error, details = {}) {
  const message = error?.message || String(error);
  dslDebug(language, `${phase}:error`, { ...details, message, stack: error?.stack || null });
  const wrapped = new Error(`[DSL:${String(language).toUpperCase()}:${phase}] ${message}`, { cause: error });
  wrapped.dslLanguage = language;
  wrapped.dslPhase = phase;
  return wrapped;
}

export async function withDslDebug(language, phase, operation, details = {}) {
  dslDebug(language, `${phase}:start`, details);
  try {
    const result = await operation();
    dslDebug(language, `${phase}:complete`, {
      ...details,
      resultType: result?.constructor?.name || typeof result
    });
    return result;
  } catch (error) {
    throw dslError(language, phase, error, details);
  }
}
