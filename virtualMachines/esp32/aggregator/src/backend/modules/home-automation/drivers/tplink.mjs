/**
 * TP-Link smart device driver.
 * Handles upsert, discovery, and power-action invoke for tplink: devices.
 */
import tpLinkSmartHome from 'tplink-smarthome-api';
import { getLanDiscoveryTarget, normalizeId } from '../utils.mjs';

const { Client: TpLinkClient } = tpLinkSmartHome;

export function createTpLinkDriver({ devices }) {
  const client = new TpLinkClient();

  function upsert(handle) {
    const deviceId = String(handle?.deviceId || handle?.id || handle?.macNormalized || handle?.host || '').trim();
    if (!deviceId) return;
    const ip = String(handle?.host || '').trim();
    for (const [key, device] of devices.entries()) {
      if (device.protocol === 'kasa' && device.ip === ip) devices.delete(key);
    }
    const id = `tplink:${deviceId}`;
    devices.set(normalizeId(id), {
      id, protocol: 'tplink', vendor: 'TP-Link',
      name: String(handle?.alias || handle?.name || `TP-Link ${deviceId.slice(-6)}`).trim(),
      ip, port: Number(handle?.port || 9999),
      deviceType: String(handle?.deviceType || 'device').trim(),
      model: String(handle?.model || '').trim(),
      mac: String(handle?.mac || '').trim(),
      manageable: true, online: true,
      powerState: typeof handle?.sysInfo?.relay_state === 'number' ? handle.sysInfo.relay_state === 1 : null,
      lastSeen: Date.now(), handle
    });
  }

  async function discover(timeoutMs) {
    const found = [];
    const onDevice = (device) => { upsert(device); found.push(device); };
    const lan = getLanDiscoveryTarget();
    client.on('device-new', onDevice);
    client.startDiscovery({ broadcast: lan.broadcast, discoveryInterval: 1000, discoveryTimeout: timeoutMs, offlineTolerance: 30 });
    await new Promise((resolve) => setTimeout(resolve, timeoutMs + 100));
    client.removeListener('device-new', onDevice);
    client.stopDiscovery();
    await Promise.allSettled(found.map(async (handle) => {
      const deviceId = String(handle?.deviceId || handle?.id || handle?.macNormalized || handle?.host || '').trim();
      const device = devices.get(normalizeId(`tplink:${deviceId}`));
      if (device) device.powerState = Boolean(await handle.getPowerState());
    }));
    return found;
  }

  async function invoke(device, action) {
    const handle = device.handle || await client.getDevice({ host: device.ip, port: device.port });
    const power = action === 'status'
      ? await handle.getPowerState()
      : action === 'toggle' ? await handle.togglePowerState() : await handle.setPowerState(action === 'on');
    device.powerState = typeof power === 'boolean' ? power : action === 'on';
    return { power: device.powerState };
  }

  return { discover, invoke };
}
