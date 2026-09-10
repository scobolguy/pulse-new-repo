/**
 * Local text-to-speech bridge: PowerShell/OS TTS script, Piper offline TTS,
 * WAV playback on the host, and forwarding TTS requests to an ESP32's
 * Bluetooth audio endpoint. Used by registerMediaGatewayRoutes.
 */
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvString, readEnvNumber } from '../../env-config.mjs';

const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const LOCAL_TTS_SCRIPT_PATH = path.join(AGGREGATOR_ROOT, 'scripts', 'local-tts.ps1');
export const LOCAL_TTS_OUTPUT_DIR = path.join(AGGREGATOR_ROOT, 'data', 'local-tts');
export const PIPER_BIN_PATH = readEnvString('PIPER_BIN_PATH', path.join(AGGREGATOR_ROOT, 'tools', 'piper', 'piper', 'piper.exe')).trim();
export const PIPER_MODEL_PATH = readEnvString('PIPER_MODEL_PATH', path.join(AGGREGATOR_ROOT, 'tools', 'piper', 'models', 'en_US-lessac-medium', 'en_US-lessac-medium.onnx')).trim();

export function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function runLocalTtsScript(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', LOCAL_TTS_SCRIPT_PATH, ...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const details = String(stderr || stdout || error.message || '').trim();
          return reject(new Error(details || 'Local TTS script failed'));
        }
        return resolve(String(stdout || '').trim());
      }
    );
  });
}

export function runPiperSynthesis({ text, outputFile, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(PIPER_BIN_PATH, ['--model', PIPER_MODEL_PATH, '--output_file', outputFile], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore kill errors
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(err?.message || 'Failed to start Piper process'));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error('Piper synthesis timed out'));
      }
      if (code !== 0) {
        const detail = String(stderr || stdout || `Piper exited with code ${code}`).trim();
        return reject(new Error(detail));
      }
      return resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.stdin.write(String(text || ''));
    child.stdin.end();
  });
}

export function playWavOnHost(filePath, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const command = `$p=New-Object System.Media.SoundPlayer '${String(filePath || '').replace(/'/g, "''")}';$p.PlaySync();$p.Dispose()`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const details = String(stderr || stdout || error.message || '').trim();
          return reject(new Error(details || 'Failed to play wav file'));
        }
        return resolve();
      }
    );
  });
}

function resolveEsp32BluetoothAudioOrigin() {
  const explicit = readEnvString('ESP32_BT_AUDIO_ORIGIN', '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const host = readEnvString('EDGE_ESP32_HOST', '127.0.0.1').trim() || '127.0.0.1';
  const port = Math.max(1, readEnvNumber('EDGE_ESP32_PORT', 80));
  return `http://${host}:${port}`;
}

export async function forwardEsp32BluetoothTts({ text, voice = 'default', timeoutMs = 15000, origin = '' }) {
  const base = String(origin || '').trim().replace(/\/$/, '') || resolveEsp32BluetoothAudioOrigin();
  const params = new URLSearchParams();
  params.set('text', String(text || ''));
  params.set('voice', String(voice || 'default'));
  const endpoint = `${base}/api/bluetooth-audio/tts?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal
    });
    const bodyText = await response.text();
    let payload = null;
    try {
      payload = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      payload = { raw: bodyText };
    }
    if (!response.ok) {
      throw new Error(`ESP32 Bluetooth TTS failed (${response.status}): ${bodyText}`);
    }
    return {
      ok: true,
      endpoint,
      payload
    };
  } catch (err) {
    throw new Error(err?.message || String(err));
  } finally {
    clearTimeout(timer);
  }
}
