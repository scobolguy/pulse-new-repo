#!/usr/bin/env node
/**
 * gen-tls-cert.mjs
 *
 * Generates a self-signed TLS certificate for an ESP32 device and uploads it
 * via HTTP to /tls/cert and /tls/key.
 *
 * Usage:
 *   node scripts/gen-tls-cert.mjs <device-ip>
 *   node scripts/gen-tls-cert.mjs 192.168.2.115
 *
 * Requirements:
 *   - openssl must be on PATH  (git-bash / WSL / Linux / macOS all have it)
 *   - Device must be reachable on HTTP port 80 (upload happens over HTTP)
 *   - After upload the device auto-restarts HTTPS – no reboot needed
 *
 * The generated cert is valid for 10 years and uses a 2048-bit RSA key.
 * Browsers will show a "not trusted" warning (self-signed), but all API
 * traffic will be encrypted.  Add -k / --insecure to curl to skip the
 * warning, or import cert.pem into your browser/OS trust store.
 */

import { execSync }    from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join }        from 'node:path';
import { tmpdir }      from 'node:os';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const deviceIp   = process.argv[2];
const httpPort   = process.argv[3] ?? '80';

if (!deviceIp) {
  console.error('Usage: node scripts/gen-tls-cert.mjs <device-ip> [http-port]');
  console.error('  e.g: node scripts/gen-tls-cert.mjs 192.168.2.115');
  process.exit(1);
}

const baseUrl = `http://${deviceIp}:${httpPort}`;
const certPath = join(tmpdir(), `esp32-cert-${deviceIp.replace(/\./g, '_')}.pem`);
const keyPath  = join(tmpdir(), `esp32-key-${deviceIp.replace(/\./g, '_')}.pem`);

// ---------------------------------------------------------------------------
// Generate cert + key with openssl
// ---------------------------------------------------------------------------
console.log(`[TLS] Generating self-signed cert for ${deviceIp} ...`);

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" ` +
    `-days 3650 -nodes -subj "/CN=${deviceIp}/O=ESP32-Device/OU=IoT"`,
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
} catch (err) {
  console.error('[TLS] openssl failed – is openssl on your PATH?');
  console.error(err.stderr?.toString() ?? err.message);
  process.exit(1);
}

const cert = readFileSync(certPath, 'utf8');
const key  = readFileSync(keyPath,  'utf8');

console.log(`[TLS] Generated cert (${cert.length} bytes) and key (${key.length} bytes)`);

// ---------------------------------------------------------------------------
// Upload to device
// ---------------------------------------------------------------------------
async function upload(path, pem, label) {
  const url = `${baseUrl}${path}`;
  console.log(`[TLS] Uploading ${label} to ${url} ...`);
  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    pem,
    });
  } catch (err) {
    console.error(`[TLS] Network error uploading ${label}: ${err.message}`);
    process.exit(1);
  }

  const body = await res.text();
  if (res.ok) {
    console.log(`[TLS] ${label} upload OK (${res.status}):`, body);
  } else {
    console.error(`[TLS] ${label} upload FAILED (${res.status}):`, body);
    process.exit(1);
  }
  return JSON.parse(body);
}

const certResult = await upload('/tls/cert', cert, 'cert');
const keyResult  = await upload('/tls/key',  key,  'key');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const httpsRunning = certResult.httpsRunning || keyResult.httpsRunning;

if (httpsRunning) {
  console.log(`\n[TLS] HTTPS is now running on https://${deviceIp}/`);
  console.log('[TLS] Note: browser will warn about self-signed cert – this is expected.');
  console.log('[TLS] HTTP on port 80 remains active for the dual-stack transition period.');
} else {
  console.log('\n[TLS] Cert and key uploaded. Restart the device to activate HTTPS.');
  console.log('      (If both files are present on LittleFS, HTTPS starts automatically on next boot.)');
}

// Save copies alongside the script for reference
const outDir = new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const certOut = join(outDir, `esp32-tls-${deviceIp.replace(/\./g, '_')}.cert.pem`);
const keyOut  = join(outDir, `esp32-tls-${deviceIp.replace(/\./g, '_')}.key.pem`);

readFileSync(certPath); // already in memory as `cert`
writeFileSync(certOut, cert);
writeFileSync(keyOut,  key);
console.log(`\n[TLS] Cert saved locally: ${certOut}`);
console.log(`[TLS] Key  saved locally: ${keyOut}`);
console.log('[TLS] Keep the key file secure – it is the private key for this device.');

// Clean up tmp files
[certPath, keyPath].forEach(p => { try { unlinkSync(p); } catch {} });
