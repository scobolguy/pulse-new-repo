import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const nativeDll = fileURLToPath(new URL('../native/BluetoothDiscovery/bin/Release/net9.0-windows10.0.19041.0/BluetoothDiscovery.dll', import.meta.url));

export async function createWindowsBluetoothSource({ logger = console, maxPending = 4096 } = {}) {
  if (process.platform !== 'win32') throw new Error('PC Bluetooth discovery currently requires Windows');
  if (!Number.isInteger(maxPending) || maxPending < 128 || maxPending > 8192) throw new Error('Invalid Bluetooth intake capacity');
  await fs.access(nativeDll).catch(error => {
    throw new Error(`Build the BluetoothDiscovery native host in Release before starting discovery: ${error.message}`);
  });
  const child = spawn('dotnet', [nativeDll], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const events = [];
  const state = { running: false, adapterId: '', classic: false, ble: false,
    classicEnumerated: false, bleEnumerated: false, received: 0, overflow: 0, lastError: '' };
  let closing = false, stderr = '';
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const exited = new Promise(resolve => child.once('close', (code, signal) => {
    state.running = false;
    if (!closing) fault(`Bluetooth native host exited (${code ?? signal})${stderr ? `: ${stderr}` : ''}`);
    resolve();
  }));
  function fault(message) {
    state.lastError = message;
    logger.error(`[BLUETOOTH] ${message}`);
    rejectReady(new Error(message));
  }
  child.on('error', error => fault(error.message));
  child.stdin.on('error', error => { if (!closing) fault(error.message); });
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4096); });
  lines.on('line', line => {
    if (state.lastError) return;
    try {
      if (Buffer.byteLength(line) > 8192) throw new Error('Bluetooth native frame exceeds transport capacity');
      const frame = JSON.parse(line);
      if (frame.kind === 'error') fault(frame.error);
      else if (frame.kind === 'ready') {
        Object.assign(state, { running: true, adapterId: frame.adapterId, classic: frame.classic, ble: frame.ble });
        resolveReady();
      } else if (frame.kind === 'enumerated') {
        state[`${frame.transport}Enumerated`] = true;
      } else if (frame.kind === 'endpoint' || frame.kind === 'advertisement') {
        state.received++;
        if (events.length >= maxPending) {
          state.overflow++;
          throw new Error('Bluetooth intake overflow; restart discovery to re-enumerate instead of silently losing devices');
        }
        events.push(frame);
      } else throw new Error('Unknown Bluetooth native transport frame');
    } catch (error) { fault(error.message); }
  });
  let stopping;
  const stop = () => stopping ??= (async () => {
    closing = true;
    if (child.exitCode === null && child.signalCode === null) child.stdin.end('stop\n');
    let timer;
    await Promise.race([exited, new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        child.kill();
        reject(new Error('Bluetooth native host shutdown timed out; terminated owned process'));
      }, 5000);
    })]).finally(() => { clearTimeout(timer); lines.close(); });
    events.length = 0;
  })();
  const timeout = setTimeout(() => fault('Bluetooth discovery startup timed out'), 15000);
  try { await ready; }
  catch (error) {
    try { await stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Bluetooth startup and cleanup failed'); }
    throw error;
  } finally { clearTimeout(timeout); }
  return {
    read(limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error('Bluetooth read limit must be 1..128');
      if (state.lastError || !state.running) throw new Error(state.lastError || 'Bluetooth discovery stopped');
      return JSON.stringify(events.splice(0, limit));
    },
    status() { return JSON.stringify({ ...state, pending: events.length }); },
    stop
  };
}
