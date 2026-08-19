/**
 * Home Automation Service
 * Owns the devices Map, credentials, discovery loop, and invoke dispatch.
 * All protocol-specific logic is delegated to individual drivers.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeId, publicDevice, normalizeAction, normalizeVacuumAction } from './utils.mjs';
import { createTpLinkDriver } from './drivers/tplink.mjs';
import { createKasaDriver } from './drivers/kasa.mjs';
import { createTuyaDriver } from './drivers/tuya.mjs';
import { createBluetoothDriver } from './drivers/bluetooth.mjs';
import { createSharkDriver } from './drivers/shark.mjs';
import { createAlexaDriver } from './drivers/alexa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGGREGATOR_ROOT = path.resolve(__dirname, '../../../..'); // home-automation -> modules -> backend -> src -> aggregator
const WORKSPACE_ROOT = path.resolve(AGGREGATOR_ROOT, '..');    // aggregator -> esp32
const ROOT_NODE_ID = 'home-automation';
const DEFAULT_DISCOVERY_TIMEOUT_MS = 5000;
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function createHomeAutomationService({
  dataPath = path.resolve(AGGREGATOR_ROOT, 'data', 'home-automation-devices.json'),
  backendPort = 4000,
  discoveryTimeoutMs = DEFAULT_DISCOVERY_TIMEOUT_MS,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  pythonPath = process.env.HOME_AUTOMATION_PYTHON || path.resolve(WORKSPACE_ROOT, '.venv', 'Scripts', 'python.exe'),
  kasaBridgePath = path.resolve(AGGREGATOR_ROOT, 'scripts', 'kasa_bridge.py'),
  sharkBridgePath = path.resolve(AGGREGATOR_ROOT, 'scripts', 'shark_bridge.py'),
  bluetoothGateways = String(process.env.HOME_AUTOMATION_BLUETOOTH_GATEWAYS || '192.168.2.157')
    .split(',').map((v) => v.trim()).filter(Boolean)
} = {}) {
  const devices = new Map();
  let credentials = {};
  let discoveryPromise = null;
  let refreshTimer = null;
  let lastDiscoveryAt = null;
  let lastDiscoveryError = null;

  async function loadCredentials() {
    try {
      const parsed = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      credentials = parsed && typeof parsed.devices === 'object' ? parsed.devices : {};
    } catch { credentials = {}; }
  }

  async function saveCredentials() {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, `${JSON.stringify({ version: 1, devices: credentials }, null, 2)}\n`, 'utf8');
  }

  // ── Instantiate drivers ────────────────────────────────────────────────────
  const alexaCookiePath = path.resolve(path.dirname(dataPath), 'alexa-cookie.json');

  const tplink    = createTpLinkDriver({ devices });
  const kasa      = createKasaDriver({ devices, pythonPath, kasaBridgePath });
  const tuya      = createTuyaDriver({ devices, credentials, saveCredentials });
  const bluetooth = createBluetoothDriver({ devices, bluetoothGateways });
  const shark     = createSharkDriver({ devices, credentials, saveCredentials, pythonPath, sharkBridgePath });
  const alexa     = createAlexaDriver({ devices, cookiePath: alexaCookiePath });

  // ── Discovery ──────────────────────────────────────────────────────────────
  async function discover({ timeoutMs = discoveryTimeoutMs } = {}) {
    if (discoveryPromise) return discoveryPromise;
    discoveryPromise = (async () => {
      const t = Math.max(1000, Math.min(30000, Number(timeoutMs) || discoveryTimeoutMs));
      const results = await Promise.allSettled([
        tplink.discover(t),
        tuya.discover(t),
        kasa.discover(t),
        bluetooth.discover(t),
        shark.discover(t),
        alexa.discover()
      ]);
      lastDiscoveryAt = new Date().toISOString();
      const errors = results.filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message || r.reason));
      lastDiscoveryError = errors.length > 0 ? errors.join(' | ') : null;
      return { status: errors.length === results.length ? 'error' : 'ok', discovered: devices.size, devices: listDevices(), errors };
    })().finally(() => { discoveryPromise = null; });
    return discoveryPromise;
  }

  // ── Device list & topology ─────────────────────────────────────────────────
  function listDevices() {
    return Array.from(devices.values()).map(publicDevice).sort((a, b) => a.name.localeCompare(b.name));
  }

  function getTopologyNodes() {
    const now = Date.now();
    const root = {
      id: ROOT_NODE_ID, nodeId: ROOT_NODE_ID, nodeName: 'Home Automation',
      ip: '127.0.0.1', port: Number(backendPort), protocol: 'http', lastSeen: now,
      details: {
        nodeName: 'Home Automation', hardware: 'Home Automation Gateway',
        deviceRole: 'home-automation', topologyManaged: true,
        cluster: { activeClusterId: 'home-automation', parentNodeId: '' },
        services: [{ name: 'HomeAutomationService', status: 'online', api: '/api/home-automation' }]
      },
      topology: { nodeKey: ROOT_NODE_ID, parentNodeId: '', activeClusterId: 'home-automation' }
    };
    const children = listDevices().map((device) => ({
      id: device.id, nodeId: device.id, nodeName: device.name,
      ip: device.ip, port: device.port, protocol: device.protocol,
      lastSeen: device.lastSeen, status: device.online ? 'available' : 'unavailable',
      details: {
        nodeName: device.name, hardware: `${device.vendor} ${device.deviceType}`.trim(),
        deviceRole: 'home-automation-device', vendor: device.vendor, deviceType: device.deviceType,
        model: device.model, manageable: device.manageable,
        powerState: typeof device.powerState === 'boolean' ? device.powerState : null,
        managementReason: device.managementReason || null,
        rssi: device.rssi, distanceFeet: device.distanceFeet, topologyManaged: true,
        cluster: { activeClusterId: 'home-automation', parentNodeId: ROOT_NODE_ID },
        services: [{ name: 'HomeAutomationDevice', status: device.online ? 'online' : 'offline' }]
      },
      topology: { nodeKey: normalizeId(device.id), parentNodeId: ROOT_NODE_ID, activeClusterId: 'home-automation' }
    }));
    return [root, ...children];
  }

  // ── Invoke ─────────────────────────────────────────────────────────────────
  async function invoke(deviceId, actionValue, options = {}) {
    const device = devices.get(normalizeId(deviceId));
    if (!device) throw new Error('Home automation device not found');

    if (device.protocol === 'alexa') {
      const action = normalizeVacuumAction(actionValue);
      const VALID = ['status', 'start', 'stop', 'pause', 'dock'];
      if (!VALID.includes(action)) throw new Error(`Unsupported vacuum action: ${action}. Valid: ${VALID.join(', ')}`);
      return action === 'status' ? alexa.invokeStatus(device) : alexa.invokeAction(device, action);
    }

    if (device.protocol === 'shark') {
      const action = normalizeVacuumAction(actionValue);
      const VALID = ['status', 'start', 'stop', 'pause', 'dock', 'explore'];
      if (!VALID.includes(action)) throw new Error(`Unsupported vacuum action: ${action}. Valid: ${VALID.join(', ')}`);
      const cred = credentials[normalizeId(deviceId)] || {};
      if (!cred.username || !cred.password) throw new Error('Shark account credentials are required. Configure via PUT /api/home-automation/shark/account');
      return shark.invoke(device, action, options, cred);
    }

    if (device.protocol === 'bluetooth') throw new Error(device.managementReason || 'Bluetooth control is not implemented for this device');

    const action = normalizeAction(actionValue);
    if (!['status', 'on', 'off', 'toggle'].includes(action)) throw new Error(`Unsupported action: ${action}`);
    if (device.protocol === 'tplink') return tplink.invoke(device, action);
    if (device.protocol === 'kasa')   return kasa.invoke(device, action);
    return tuya.invoke(device, action, options);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async function start() {
    await loadCredentials();
    void discover();
    if (!refreshTimer) {
      refreshTimer = setInterval(() => void discover(), Math.max(30000, refreshIntervalMs));
      refreshTimer.unref?.();
    }
  }

  function status() {
    return {
      status: 'ok',
      discovering: Boolean(discoveryPromise),
      lastDiscoveryAt,
      lastDiscoveryError,
      deviceCount: devices.size,
      manageableCount: listDevices().filter((d) => d.manageable).length
    };
  }

  // ── Name-based lookup & invoke ────────────────────────────────────────────
  function findDeviceByName(name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    const all = Array.from(devices.values());
    // exact match first
    const exact = all.find((d) => d.name.toLowerCase() === needle);
    if (exact) return exact;
    // substring match
    return all.find((d) => d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase())) || null;
  }

  async function invokeByName(name, actionValue, options = {}) {
    // If no devices discovered yet, run discovery first
    if (devices.size === 0) {
      await discover();
    }
    const device = findDeviceByName(name);
    if (!device) {
      // Try once more after a fresh discovery in case it's a new device
      await discover();
      const retry = findDeviceByName(name);
      if (!retry) throw new Error(`Device not found: "${name}"`);
      return invoke(retry.id, actionValue, options);
    }
    return invoke(device.id, actionValue, options);
  }

  return {
    start, discover, status, listDevices, getTopologyNodes, invoke, invokeByName, findDeviceByName,
    configureTuyaDevice: tuya.configure,
    configureSharkAccount: shark.configure,
    getAlexaController: alexa.getController
  };
}
