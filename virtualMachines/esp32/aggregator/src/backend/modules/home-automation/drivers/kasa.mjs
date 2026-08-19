/**
 * TP-Link Kasa driver (python-kasa bridge).
 * Handles upsert, discovery, and power-action invoke for kasa: devices.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLanDiscoveryTarget, normalizeId } from '../utils.mjs';

const execFileAsync = promisify(execFile);

export function createKasaDriver({ devices, pythonPath, kasaBridgePath }) {
  async function runBridge(args, timeoutMs) {
    const result = await execFileAsync(pythonPath, [kasaBridgePath, ...args], {
      timeout: Math.max(5000, timeoutMs), windowsHide: true, maxBuffer: 1024 * 1024
    });
    return JSON.parse(String(result.stdout || 'null').trim() || 'null');
  }

  function upsert(found) {
    const ip = String(found?.host || '').trim();
    const mac = String(found?.mac || '').trim();
    if (!ip) return;
    const legacy = Array.from(devices.values()).find((d) => d.protocol === 'tplink' && d.ip === ip);
    if (legacy) {
      legacy.deviceType = String(found?.deviceType || legacy.deviceType || 'device').trim();
      legacy.model = String(found?.model || legacy.model || '').trim();
      legacy.lastSeen = Date.now();
      return;
    }
    const id = `kasa:${mac || ip}`;
    devices.set(normalizeId(id), {
      id, protocol: 'kasa', vendor: 'TP-Link Kasa',
      name: String(found?.alias || `Kasa ${ip}`).trim(),
      ip, port: 0,
      deviceType: String(found?.deviceType || 'device').trim(),
      model: String(found?.model || '').trim(),
      mac, manageable: true, online: true,
      powerState: found?.isOn === true,
      lastSeen: Date.now()
    });
  }

  async function discover(timeoutMs) {
    const lan = getLanDiscoveryTarget();
    const args = ['discover', '--target', lan.broadcast, '--timeout', String(Math.max(2, Math.ceil(timeoutMs / 1000))), '--packets', '5'];
    if (lan.interfaceAddress) args.push('--interface', lan.interfaceAddress);
    const found = await runBridge(args, timeoutMs + 5000);
    for (const device of Array.isArray(found) ? found : []) upsert(device);
    return Array.isArray(found) ? found : [];
  }

  async function invoke(device, action) {
    const result = await runBridge(['action', '--host', device.ip, '--action', action], 15000);
    device.powerState = result?.isOn === true;
    return { ...result, power: device.powerState };
  }

  return { discover, invoke };
}
