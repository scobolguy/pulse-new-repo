import crypto from 'crypto';

export const DEFAULT_PCODE_SIGNING_ALGORITHM = 'hmac-sha256';
export const DEFAULT_PCODE_SIGNING_KEY_ID = process.env.PCODE_SIGNING_KEY_ID || 'profile-default';
export const DEFAULT_PCODE_SIGNING_KEY = process.env.PCODE_SIGNING_KEY || 'dev-insecure-key-change-me';

function toHex(buffer) {
  return Buffer.from(buffer).toString('hex');
}

export function signPcodeText(pcodeText, {
  algorithm = DEFAULT_PCODE_SIGNING_ALGORITHM,
  key = DEFAULT_PCODE_SIGNING_KEY
} = {}) {
  const text = String(pcodeText || '');
  if (algorithm !== 'hmac-sha256') {
    throw new Error(`[pcode-signing] Unsupported algorithm: ${algorithm}`);
  }
  return toHex(crypto.createHmac('sha256', String(key)).update(text, 'utf8').digest());
}

export function attachPcodeSignature(programMap, pcodeText, {
  algorithm = DEFAULT_PCODE_SIGNING_ALGORITHM,
  key = DEFAULT_PCODE_SIGNING_KEY,
  keyId = DEFAULT_PCODE_SIGNING_KEY_ID
} = {}) {
  const map = programMap && typeof programMap === 'object' ? { ...programMap } : {};
  const signature = signPcodeText(pcodeText, { algorithm, key });

  map.signing = {
    algorithm,
    keyId: String(keyId || ''),
    signature,
    signedAt: new Date().toISOString(),
    pcodeLength: String(pcodeText || '').length,
    canonicalForm: 'raw-pcode-text-v1'
  };

  return map;
}
