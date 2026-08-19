/**
 * Shark/Ninja robot vacuum driver (Ayla cloud path via Python bridge).
 * Note: Ayla API marks newer devices as Offline. Use the Alexa driver instead
 * for RV1000A / RV750P and other post-2022 models.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeId } from '../utils.mjs';

const execFileAsync = promisify(execFile);

export function createSharkDriver({ devices, credentials, saveCredentials, pythonPath, sharkBridgePath }) {
  async function runBridge(args, timeoutMs) {
    const result = await execFileAsync(pythonPath, [sharkBridgePath, ...args], {
      timeout: Math.max(15000, timeoutMs), windowsHide: true, maxBuffer: 1024 * 1024
    });
    return JSON.parse(String(result.stdout || 'null').trim() || 'null');
  }

  function upsert(found) {
    const serial = String(found?.serial || '').trim();
    if (!serial) return;
    const id = `shark:${serial}`;
    const key = normalizeId(id);
    const config = credentials[key] || {};
    devices.set(key, {
      id, protocol: 'shark', vendor: 'SharkNinja',
      name: String(found?.name || config.name || `Shark ${serial.slice(-6)}`).trim(),
      ip: null, port: null, serial,
      deviceType: 'robot-vacuum', model: String(found?.model || '').trim(),
      manageable: true, online: true,
      operatingMode: found?.operatingMode ?? null,
      running: found?.running ?? false,
      batteryPercent: found?.batteryPercent ?? null,
      errorCode: found?.errorCode ?? null,
      firmware: found?.firmware ?? null,
      lastSeen: Date.now()
    });
  }

  async function discover(timeoutMs) {
    const accounts = new Map();
    for (const [, cred] of Object.entries(credentials)) {
      if (cred.protocol === 'shark' && cred.username && cred.password) {
        accounts.set(cred.username, cred);
      }
    }
    if (accounts.size === 0) return [];
    const found = [];
    for (const [, cred] of accounts) {
      const args = ['discover', '--username', cred.username, '--password', cred.password];
      if (cred.europe) args.push('--europe');
      const vacuums = await runBridge(args, timeoutMs + 10000);
      for (const v of Array.isArray(vacuums) ? vacuums : []) {
        const key = normalizeId(`shark:${v.serial}`);
        if (!credentials[key]) credentials[key] = {};
        Object.assign(credentials[key], { protocol: 'shark', username: cred.username, password: cred.password, europe: cred.europe || false });
        upsert(v);
        found.push(v);
      }
    }
    return found;
  }

  async function configure(config = {}) {
    const username = String(config.username || '').trim();
    const password = String(config.password || '').trim();
    if (!username || !password) throw new Error('username and password are required for Shark account');
    const accountKey = `shark-account:${username.toLowerCase()}`;
    credentials[accountKey] = { protocol: 'shark', username, password, europe: Boolean(config.europe), name: String(config.name || '').trim() };
    await saveCredentials();
    await discover(15000);
    const sharkDevices = Array.from(devices.values()).filter((d) => d.protocol === 'shark');
    return { status: 'ok', accountKey, devicesFound: sharkDevices.length, devices: sharkDevices };
  }

  async function invoke(device, action, options = {}, cred) {
    const args = ['action', '--username', cred.username, '--password', cred.password, '--serial', device.serial, '--action', action];
    if (options.power) args.push('--power', String(options.power).toLowerCase());
    if (cred.europe) args.push('--europe');
    const result = await runBridge(args, 30000);
    if (result) {
      device.operatingMode = result.operatingMode ?? device.operatingMode;
      device.running = result.running ?? device.running;
      device.batteryPercent = result.batteryPercent ?? device.batteryPercent;
      device.errorCode = result.errorCode ?? device.errorCode;
      device.lastSeen = Date.now();
    }
    return result;
  }

  return { discover, configure, invoke };
}
