/**
 * Tuya LAN driver.
 * Handles upsert, discovery, configuration, and DPS invoke for tuya: devices.
 */
import TuyAPI from 'tuyapi';
import { normalizeId } from '../utils.mjs';

export function createTuyaDriver({ devices, credentials, saveCredentials }) {
  function upsert(found) {
    const deviceId = String(found?.id || found?.gwId || '').trim();
    const ip = String(found?.ip || '').trim();
    if (!deviceId && !ip) return;
    const id = `tuya:${deviceId || ip}`;
    const config = credentials[normalizeId(id)] || credentials[normalizeId(deviceId)] || {};
    devices.set(normalizeId(id), {
      id, protocol: 'tuya', vendor: 'Tuya',
      name: String(config.name || `Tuya ${deviceId.slice(-6) || ip}`).trim(),
      ip, port: Number(config.port || 6668),
      deviceType: String(config.deviceType || 'device').trim(),
      model: String(config.model || '').trim(),
      version: String(config.version || found?.version || '3.3'),
      manageable: typeof config.localKey === 'string' && config.localKey.length === 16,
      online: true, lastSeen: Date.now(),
      localKey: String(config.localKey || '')
    });
  }

  async function discover(timeoutMs) {
    const scanner = new TuyAPI({ ip: '0.0.0.0', key: '0000000000000000' });
    const found = await scanner.find({ timeout: Math.max(1, Math.ceil(timeoutMs / 1000)), all: true });
    for (const device of Array.isArray(found) ? found : []) upsert(device);
    return Array.isArray(found) ? found : [];
  }

  async function configure(deviceId, config = {}) {
    const key = normalizeId(deviceId);
    const localKey = String(config.localKey || '').trim();
    if (localKey.length !== 16) throw new Error('Tuya localKey must be exactly 16 characters');
    credentials[key] = {
      ...(credentials[key] || {}),
      localKey,
      name: String(config.name || credentials[key]?.name || '').trim(),
      version: String(config.version || credentials[key]?.version || '3.3').trim(),
      deviceType: String(config.deviceType || credentials[key]?.deviceType || 'device').trim()
    };
    await saveCredentials();
    const current = devices.get(key);
    if (current) upsert({ id: current.id.replace(/^tuya:/i, ''), ip: current.ip, version: credentials[key].version });
    return devices.has(key) ? devices.get(key) : { id: deviceId, manageable: true };
  }

  async function invoke(device, action, options = {}) {
    if (!device.manageable || !device.localKey) throw new Error('Tuya local key is required before this device can be managed');
    const tuya = new TuyAPI({ id: device.id.replace(/^tuya:/i, ''), ip: device.ip, key: device.localKey, version: device.version });
    await tuya.connect();
    try {
      const dps = Number(options.dps || 1);
      if (action === 'status') return { power: await tuya.get({ dps }) };
      if (action === 'toggle') return { power: await tuya.toggle(dps) };
      await tuya.set({ dps, set: action === 'on' });
      return { power: action === 'on' };
    } finally {
      tuya.disconnect();
    }
  }

  return { discover, configure, invoke };
}
