/**
 * At-rest encryption helper for locally-stored device credentials (AES-256-GCM).
 * The symmetric key is a random 32-byte file generated on first use and never
 * checked into source control; losing it means stored secrets must be re-entered.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KEY_PATH = path.resolve(AGGREGATOR_ROOT, 'data', '.credential-key');
const ALGO = 'aes-256-gcm';

let keyPromise = null;

async function loadOrCreateKey() {
  try {
    const existing = await fs.readFile(KEY_PATH);
    if (existing.length === 32) return existing;
  } catch { /* not created yet */ }
  const key = crypto.randomBytes(32);
  await fs.mkdir(path.dirname(KEY_PATH), { recursive: true });
  await fs.writeFile(KEY_PATH, key, { mode: 0o600 });
  return key;
}

function getKey() {
  if (!keyPromise) keyPromise = loadOrCreateKey();
  return keyPromise;
}

export async function encryptSecret(plaintext) {
  const key = await getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext ?? ''), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), data: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export async function decryptSecret(payload) {
  if (!payload || !payload.iv || !payload.data || !payload.tag) return '';
  const key = await getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
