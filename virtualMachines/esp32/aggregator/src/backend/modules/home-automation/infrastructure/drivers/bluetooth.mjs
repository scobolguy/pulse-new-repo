/**
 * Bluetooth gateway driver (Melnor water controllers via ESP32 BLE proxy).
 * Read-only discovery — no invoke supported.
 */
import { normalizeId } from '../../shared/utils.mjs';

export function createBluetoothDriver({ devices, backendPort }) {
  function upsert(found, gatewayHost) {
    const name = String(found?.name || '').trim();
    const manufacturer = String(found?.manufacturer || '').trim();
    const deviceType = String(found?.type || '').trim().toLowerCase();
    const isMelnor = /melnor/i.test(`${name} ${manufacturer}`) || deviceType === 'water_controller';
    const address = String(found?.address || '').trim();
    if (!isMelnor || !address) return;
    const id = `bluetooth:${address}`;
    devices.set(normalizeId(id), {
      id, protocol: 'bluetooth',
      vendor: /melnor/i.test(`${name} ${manufacturer}`) ? 'Melnor' : (manufacturer || 'Bluetooth'),
      name: name && name.toLowerCase() !== 'unknown' ? name : `Melnor ${address.slice(-5)}`,
      ip: gatewayHost, port: 80, address, gatewayHost,
      deviceType: deviceType || 'water_controller', model: '',
      manageable: false,
      managementReason: 'Melnor GATT valve commands are not implemented in the ESP32 Bluetooth service',
      online: true,
      rssi: Number(found?.rssi || 0), distanceFeet: Number(found?.distanceFeet || 0),
      lastSeen: Date.now()
    });
  }

  async function discover(timeoutMs) {
    const found = [];
    const registryResponse = await fetch(`http://127.0.0.1:${backendPort}/api/nodes`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!registryResponse.ok) {
      throw new Error(`Node registry returned HTTP ${registryResponse.status}`);
    }
    const registryPayload = await registryResponse.json();
    const nodes = Array.isArray(registryPayload) ? registryPayload : registryPayload?.nodes;
    if (!Array.isArray(nodes)) {
      throw new Error('Node registry response has an invalid format');
    }
    const bluetoothGateways = nodes
      .filter((node) => {
        const hardware = String(node?.details?.hardware || node?.hardware || '').toLowerCase();
        const services = Array.isArray(node?.details?.services) ? node.details.services : [];
        return /esp32/.test(hardware) || services.some((service) =>
          /bluetooth/i.test(typeof service === 'string' ? service : service?.name || '')
        );
      })
      .map((node) => ({
        host: String(node?.ip || '').trim(),
        port: Number(node?.details?.httpPort || node?.port || 80)
      }))
      .filter((gateway) => gateway.host);

    for (const gatewayHost of bluetoothGateways) {
      const durationSeconds = Math.max(2, Math.min(30, Math.ceil(timeoutMs / 1000)));
      await fetch(`http://${gatewayHost.host}:${gatewayHost.port}/api/bluetooth/scan`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ duration: String(durationSeconds) }),
        signal: AbortSignal.timeout(Math.min(5000, timeoutMs))
      }).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, timeoutMs + 250));
      const response = await fetch(`http://${gatewayHost.host}:${gatewayHost.port}/api/bluetooth/devices?type=water_controller`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Bluetooth gateway ${gatewayHost.host} returned HTTP ${response.status}`);
      const payload = await response.json();
      for (const device of Array.isArray(payload?.devices) ? payload.devices : []) {
        upsert(device, gatewayHost.host);
        found.push(device);
      }
    }
    return found;
  }

  return { discover };
}
