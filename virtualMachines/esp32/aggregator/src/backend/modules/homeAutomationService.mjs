import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import tpLinkSmartHome from 'tplink-smarthome-api';
import TuyAPI from 'tuyapi';
import { createAlexaVacuumController } from '../../../alexa/shark_alexa.mjs';

const { Client: TpLinkClient } = tpLinkSmartHome;
const execFileAsync = promisify(execFile);
const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKSPACE_ROOT = path.resolve(AGGREGATOR_ROOT, '..');
const ROOT_NODE_ID = 'home-automation';
const DEFAULT_DISCOVERY_TIMEOUT_MS = 5000;
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function publicDevice(device) {
  const { handle, localKey, ...safe } = device;
  return safe;
}

function normalizeAction(value) {
  const action = String(value || 'status').trim().toLowerCase();
  return action === 'turnon' ? 'on' : action === 'turnoff' ? 'off' : action;
}

function getLanDiscoveryTarget() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      const octets = entry.address.split('.');
      const privateAddress = octets.length === 4 && (
        octets[0] === '10'
        || octets[0] === '192'
        || (octets[0] === '172' && Number(octets[1]) >= 16 && Number(octets[1]) <= 31)
      );
      if (privateAddress) {
        return { interfaceAddress: entry.address, broadcast: `${octets[0]}.${octets[1]}.${octets[2]}.255` };
      }
    }
  }
  return { interfaceAddress: '', broadcast: '255.255.255.255' };
}

export function createHomeAutomationService({
  dataPath = path.resolve(AGGREGATOR_ROOT, 'data', 'home-automation-devices.json'),
  backendPort = 4000,
  discoveryTimeoutMs = DEFAULT_DISCOVERY_TIMEOUT_MS,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  pythonPath = process.env.HOME_AUTOMATION_PYTHON || path.resolve(WORKSPACE_ROOT, '.venv', 'Scripts', 'python.exe'),
  kasaBridgePath = path.resolve(AGGREGATOR_ROOT, 'scripts', 'kasa_bridge.py'),
  sharkBridgePath = path.resolve(AGGREGATOR_ROOT, 'scripts', 'shark_bridge.py'),
  bluetoothGateways = String(process.env.HOME_AUTOMATION_BLUETOOTH_GATEWAYS || '192.168.2.157')
    .split(',').map((value) => value.trim()).filter(Boolean)
} = {}) {
  const devices = new Map();
  const tpLinkClient = new TpLinkClient();
  let credentials = {};
  let discoveryPromise = null;
  let refreshTimer = null;
  let lastDiscoveryAt = null;
  let lastDiscoveryError = null;
  let alexaController = null;

  async function loadCredentials() {
    try {
      const parsed = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      credentials = parsed && typeof parsed.devices === 'object' ? parsed.devices : {};
    } catch {
      credentials = {};
    }
  }

  async function saveCredentials() {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, `${JSON.stringify({ version: 1, devices: credentials }, null, 2)}\n`, 'utf8');
  }

  // ── Alexa smarthome vacuum control ────────────────────────────────────────

  async function getAlexaController() {
    if (alexaController) return alexaController;
    const alexaCookiePath = path.resolve(path.dirname(dataPath), 'alexa-cookie.json');
    alexaController = await createAlexaVacuumController({ cookiePath: alexaCookiePath });
    return alexaController;
  }

  function upsertAlexaDevice(found) {
    const entityId = String(found?.entityId || '').trim();
    if (!entityId) return;
    const id = `alexa:${entityId}`;
    const key = normalizeId(id);
    devices.set(key, {
      id,
      protocol: 'alexa',
      vendor: String(found?.manufacturer || 'SharkNinja').trim(),
      name: String(found?.name || `Alexa Device ${entityId.slice(-6)}`).trim(),
      ip: null,
      port: null,
      entityId,
      deviceType: 'robot-vacuum',
      model: String(found?.model || '').trim(),
      manageable: true,
      online: found?.online !== false,
      running: null,
      powerState: null,
      lastSeen: Date.now()
    });
  }

  async function discoverAlexa() {
    const alexaCookiePath = path.resolve(path.dirname(dataPath), 'alexa-cookie.json');
    try { await fs.access(alexaCookiePath); } catch { return []; } // skip if not authed yet
    try {
      const ctrl = await getAlexaController();
      const vacuums = await ctrl.discoverVacuums();
      for (const v of vacuums) upsertAlexaDevice(v);
      return vacuums;
    } catch (err) {
      console.warn(`[HomeAutomation] Alexa discovery failed: ${err.message}`);
      return [];
    }
  }

  // ── Shark/Ninja robot vacuums (cloud/Ayla path — legacy) ──────────────────

  async function runSharkBridge(args, timeoutMs) {
    const result = await execFileAsync(pythonPath, [sharkBridgePath, ...args], {
      timeout: Math.max(15000, timeoutMs),
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(String(result.stdout || 'null').trim() || 'null');
  }

  function upsertSharkDevice(found) {
    const serial = String(found?.serial || '').trim();
    if (!serial) return;
    const id = `shark:${serial}`;
    const key = normalizeId(id);
    const config = credentials[key] || {};
    devices.set(key, {
      id,
      protocol: 'shark',
      vendor: 'SharkNinja',
      name: String(found?.name || config.name || `Shark ${serial.slice(-6)}`).trim(),
      ip: null,
      port: null,
      serial,
      deviceType: 'robot-vacuum',
      model: String(found?.model || '').trim(),
      manageable: true,
      online: true,
      operatingMode: found?.operatingMode ?? null,
      running: found?.running ?? false,
      batteryPercent: found?.batteryPercent ?? null,
      errorCode: found?.errorCode ?? null,
      firmware: found?.firmware ?? null,
      lastSeen: Date.now()
    });
  }

  async function discoverShark(timeoutMs) {
    // Collect all unique Shark accounts from credentials
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
      const vacuums = await runSharkBridge(args, timeoutMs + 10000);
      for (const v of Array.isArray(vacuums) ? vacuums : []) {
        // Attach the account credentials key so invoke() can look them up
        const key = normalizeId(`shark:${v.serial}`);
        if (!credentials[key]) credentials[key] = {};
        credentials[key].protocol = 'shark';
        credentials[key].username = cred.username;
        credentials[key].password = cred.password;
        credentials[key].europe = cred.europe || false;
        upsertSharkDevice(v);
        found.push(v);
      }
    }
    return found;
  }

  function upsertTpLinkDevice(handle) {
    const deviceId = String(handle?.deviceId || handle?.id || handle?.macNormalized || handle?.host || '').trim();
    if (!deviceId) return;
    const ip = String(handle?.host || '').trim();
    for (const [key, device] of devices.entries()) {
      if (device.protocol === 'kasa' && device.ip === ip) devices.delete(key);
    }
    const id = `tplink:${deviceId}`;
    devices.set(normalizeId(id), {
      id,
      protocol: 'tplink',
      vendor: 'TP-Link',
      name: String(handle?.alias || handle?.name || `TP-Link ${deviceId.slice(-6)}`).trim(),
      ip,
      port: Number(handle?.port || 9999),
      deviceType: String(handle?.deviceType || 'device').trim(),
      model: String(handle?.model || '').trim(),
      mac: String(handle?.mac || '').trim(),
      manageable: true,
      online: true,
      powerState: typeof handle?.sysInfo?.relay_state === 'number' ? handle.sysInfo.relay_state === 1 : null,
      lastSeen: Date.now(),
      handle
    });
  }

  function upsertTuyaDevice(found) {
    const deviceId = String(found?.id || found?.gwId || '').trim();
    const ip = String(found?.ip || '').trim();
    if (!deviceId && !ip) return;
    const id = `tuya:${deviceId || ip}`;
    const config = credentials[normalizeId(id)] || credentials[normalizeId(deviceId)] || {};
    devices.set(normalizeId(id), {
      id,
      protocol: 'tuya',
      vendor: 'Tuya',
      name: String(config.name || `Tuya ${deviceId.slice(-6) || ip}`).trim(),
      ip,
      port: Number(config.port || 6668),
      deviceType: String(config.deviceType || 'device').trim(),
      model: String(config.model || '').trim(),
      version: String(config.version || found?.version || '3.3'),
      manageable: typeof config.localKey === 'string' && config.localKey.length === 16,
      online: true,
      lastSeen: Date.now(),
      localKey: String(config.localKey || '')
    });
  }

  function upsertKasaDevice(found) {
    const ip = String(found?.host || '').trim();
    const mac = String(found?.mac || '').trim();
    if (!ip) return;
    const legacy = Array.from(devices.values()).find((device) => device.protocol === 'tplink' && device.ip === ip);
    if (legacy) {
      legacy.deviceType = String(found?.deviceType || legacy.deviceType || 'device').trim();
      legacy.model = String(found?.model || legacy.model || '').trim();
      legacy.lastSeen = Date.now();
      return;
    }
    const id = `kasa:${mac || ip}`;
    devices.set(normalizeId(id), {
      id,
      protocol: 'kasa',
      vendor: 'TP-Link Kasa',
      name: String(found?.alias || `Kasa ${ip}`).trim(),
      ip,
      port: 0,
      deviceType: String(found?.deviceType || 'device').trim(),
      model: String(found?.model || '').trim(),
      mac,
      manageable: true,
      online: true,
      powerState: found?.isOn === true,
      lastSeen: Date.now()
    });
  }

  function upsertBluetoothDevice(found, gatewayHost) {
    const name = String(found?.name || '').trim();
    const manufacturer = String(found?.manufacturer || '').trim();
    const deviceType = String(found?.type || '').trim().toLowerCase();
    const isMelnor = /melnor/i.test(`${name} ${manufacturer}`) || deviceType === 'water_controller';
    const address = String(found?.address || '').trim();
    if (!isMelnor || !address) return;
    const id = `bluetooth:${address}`;
    devices.set(normalizeId(id), {
      id,
      protocol: 'bluetooth',
      vendor: /melnor/i.test(`${name} ${manufacturer}`) ? 'Melnor' : (manufacturer || 'Bluetooth'),
      name: name && name.toLowerCase() !== 'unknown' ? name : `Melnor ${address.slice(-5)}`,
      ip: gatewayHost,
      port: 80,
      address,
      gatewayHost,
      deviceType: deviceType || 'water_controller',
      model: '',
      manageable: false,
      managementReason: 'Melnor GATT valve commands are not implemented in the ESP32 Bluetooth service',
      online: true,
      rssi: Number(found?.rssi || 0),
      distanceFeet: Number(found?.distanceFeet || 0),
      lastSeen: Date.now()
    });
  }

  async function runKasaBridge(args, timeoutMs) {
    const result = await execFileAsync(pythonPath, [kasaBridgePath, ...args], {
      timeout: Math.max(5000, timeoutMs),
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(String(result.stdout || 'null').trim() || 'null');
  }

  async function discoverTpLink(timeoutMs) {
    const found = [];
    const onDevice = (device) => {
      upsertTpLinkDevice(device);
      found.push(device);
    };
    const lan = getLanDiscoveryTarget();
    tpLinkClient.on('device-new', onDevice);
    tpLinkClient.startDiscovery({
      broadcast: lan.broadcast,
      discoveryInterval: 1000,
      discoveryTimeout: timeoutMs,
      offlineTolerance: 30
    });
    await new Promise((resolve) => setTimeout(resolve, timeoutMs + 100));
    tpLinkClient.removeListener('device-new', onDevice);
    tpLinkClient.stopDiscovery();
    await Promise.allSettled(found.map(async (handle) => {
      const deviceId = String(handle?.deviceId || handle?.id || handle?.macNormalized || handle?.host || '').trim();
      const device = devices.get(normalizeId(`tplink:${deviceId}`));
      if (device) device.powerState = Boolean(await handle.getPowerState());
    }));
    return found;
  }

  async function discoverTuya(timeoutMs) {
    const scanner = new TuyAPI({ ip: '0.0.0.0', key: '0000000000000000' });
    const found = await scanner.find({ timeout: Math.max(1, Math.ceil(timeoutMs / 1000)), all: true });
    for (const device of Array.isArray(found) ? found : []) upsertTuyaDevice(device);
    return Array.isArray(found) ? found : [];
  }

  async function discoverKasa(timeoutMs) {
    const lan = getLanDiscoveryTarget();
    const args = [
      'discover', '--target', lan.broadcast,
      '--timeout', String(Math.max(2, Math.ceil(timeoutMs / 1000))),
      '--packets', '5'
    ];
    if (lan.interfaceAddress) args.push('--interface', lan.interfaceAddress);
    const found = await runKasaBridge(args, timeoutMs + 5000);
    for (const device of Array.isArray(found) ? found : []) upsertKasaDevice(device);
    return Array.isArray(found) ? found : [];
  }

  async function discoverBluetooth(timeoutMs) {
    const found = [];
    for (const gatewayHost of bluetoothGateways) {
      const durationSeconds = Math.max(2, Math.min(30, Math.ceil(timeoutMs / 1000)));
      await fetch(`http://${gatewayHost}/api/bluetooth/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ duration: String(durationSeconds) }),
        signal: AbortSignal.timeout(Math.min(5000, timeoutMs))
      }).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, timeoutMs + 250));
      const response = await fetch(`http://${gatewayHost}/api/bluetooth/devices?type=water_controller`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Bluetooth gateway ${gatewayHost} returned HTTP ${response.status}`);
      const payload = await response.json();
      for (const device of Array.isArray(payload?.devices) ? payload.devices : []) {
        upsertBluetoothDevice(device, gatewayHost);
        found.push(device);
      }
    }
    return found;
  }

  async function discover({ timeoutMs = discoveryTimeoutMs } = {}) {
    if (discoveryPromise) return discoveryPromise;
    discoveryPromise = (async () => {
      const boundedTimeoutMs = Math.max(1000, Math.min(30000, Number(timeoutMs) || discoveryTimeoutMs));
      const results = await Promise.allSettled([
        discoverTpLink(boundedTimeoutMs),
        discoverTuya(boundedTimeoutMs),
        discoverKasa(boundedTimeoutMs),
        discoverBluetooth(boundedTimeoutMs),
        discoverShark(boundedTimeoutMs),
        discoverAlexa()
      ]);
      lastDiscoveryAt = new Date().toISOString();
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => String(result.reason?.message || result.reason));
      lastDiscoveryError = errors.length > 0 ? errors.join(' | ') : null;
      return {
        status: errors.length === results.length ? 'error' : 'ok',
        discovered: devices.size,
        devices: listDevices(),
        errors
      };
    })().finally(() => {
      discoveryPromise = null;
    });
    return discoveryPromise;
  }

  function listDevices() {
    return Array.from(devices.values()).map(publicDevice).sort((a, b) => a.name.localeCompare(b.name));
  }

  function getTopologyNodes() {
    const now = Date.now();
    const root = {
      id: ROOT_NODE_ID,
      nodeId: ROOT_NODE_ID,
      nodeName: 'Home Automation',
      ip: '127.0.0.1',
      port: Number(backendPort),
      protocol: 'http',
      lastSeen: now,
      details: {
        nodeName: 'Home Automation',
        hardware: 'Home Automation Gateway',
        deviceRole: 'home-automation',
        topologyManaged: true,
        cluster: { activeClusterId: 'home-automation', parentNodeId: '' },
        services: [{ name: 'HomeAutomationService', status: 'online', api: '/api/home-automation' }]
      },
      topology: { nodeKey: ROOT_NODE_ID, parentNodeId: '', activeClusterId: 'home-automation' }
    };
    const children = listDevices().map((device) => ({
      id: device.id,
      nodeId: device.id,
      nodeName: device.name,
      ip: device.ip,
      port: device.port,
      protocol: device.protocol,
      lastSeen: device.lastSeen,
      status: device.online ? 'available' : 'unavailable',
      details: {
        nodeName: device.name,
        hardware: `${device.vendor} ${device.deviceType}`.trim(),
        deviceRole: 'home-automation-device',
        vendor: device.vendor,
        deviceType: device.deviceType,
        model: device.model,
        manageable: device.manageable,
        powerState: typeof device.powerState === 'boolean' ? device.powerState : null,
        managementReason: device.managementReason || null,
        rssi: device.rssi,
        distanceFeet: device.distanceFeet,
        topologyManaged: true,
        cluster: { activeClusterId: 'home-automation', parentNodeId: ROOT_NODE_ID },
        services: [{ name: 'HomeAutomationDevice', status: device.online ? 'online' : 'offline' }]
      },
      topology: { nodeKey: normalizeId(device.id), parentNodeId: ROOT_NODE_ID, activeClusterId: 'home-automation' }
    }));
    return [root, ...children];
  }

  async function configureTuyaDevice(deviceId, config = {}) {
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
    if (current) {
      upsertTuyaDevice({ id: current.id.replace(/^tuya:/i, ''), ip: current.ip, version: credentials[key].version });
    }
    return devices.has(key) ? publicDevice(devices.get(key)) : { id: deviceId, manageable: true };
  }

  // Configure Shark account credentials so the bridge can authenticate.
  // Body: { username, password, europe? }
  // If the id is 'shark-account' (or any sentinel), we store under a shared account key
  // and trigger a discover to populate the device list.
  async function configureSharkAccount(config = {}) {
    const username = String(config.username || '').trim();
    const password = String(config.password || '').trim();
    if (!username || !password) throw new Error('username and password are required for Shark account');
    const accountKey = `shark-account:${username.toLowerCase()}`;
    credentials[accountKey] = {
      protocol: 'shark',
      username,
      password,
      europe: Boolean(config.europe),
      name: String(config.name || '').trim()
    };
    await saveCredentials();
    // Immediately discover devices on this account
    await discoverShark(15000);
    const sharkDevices = Array.from(devices.values()).filter((d) => d.protocol === 'shark');
    return { status: 'ok', accountKey, devicesFound: sharkDevices.length, devices: sharkDevices.map(publicDevice) };
  }

  // Shark-specific actions — not power switches so we extend normalizeAction's domain here.
  function normalizeVacuumAction(value) {
    const a = String(value || 'status').trim().toLowerCase();
    const aliases = { clean: 'start', vacuum: 'start', run: 'start', begin: 'start', go: 'start', resume: 'start',
      stop: 'stop', halt: 'stop', cancel: 'stop',
      pause: 'pause', hold: 'pause',
      dock: 'dock', home: 'dock', return: 'dock', charge: 'dock',
      explore: 'explore', map: 'explore' };
    return aliases[a] || a;
  }

  async function invoke(deviceId, actionValue, options = {}) {
    const device = devices.get(normalizeId(deviceId));
    if (!device) throw new Error('Home automation device not found');

    // Route Alexa-managed vacuums
    if (device.protocol === 'alexa') {
      const action = normalizeVacuumAction(actionValue);
      const VACUUM_ACTIONS = ['status', 'start', 'stop', 'pause', 'dock'];
      if (!VACUUM_ACTIONS.includes(action)) {
        throw new Error(`Unsupported vacuum action: ${action}. Valid: ${VACUUM_ACTIONS.join(', ')}`);
      }
      const ctrl = await getAlexaController();
      if (action === 'status') {
        const state = await ctrl.getState(device.entityId);
        const existing = devices.get(normalizeId(deviceId));
        if (existing) {
          existing.running = state.running;
          existing.powerState = state.powerState;
          existing.lastSeen = Date.now();
        }
        return state;
      }
      const result = await ctrl.sendAction(device.entityId, action);
      const existing = devices.get(normalizeId(deviceId));
      if (existing) {
        existing.running = ['start'].includes(action);
        existing.lastSeen = Date.now();
      }
      return { action, result };
    }

    // Route Shark vacuums (legacy Ayla cloud path)
    if (device.protocol === 'shark') {
      const action = normalizeVacuumAction(actionValue);
      const VACUUM_ACTIONS = ['status', 'start', 'stop', 'pause', 'dock', 'explore'];
      if (!VACUUM_ACTIONS.includes(action)) {
        throw new Error(`Unsupported vacuum action: ${action}. Valid: ${VACUUM_ACTIONS.join(', ')}`);
      }
      const cred = credentials[normalizeId(deviceId)] || {};
      if (!cred.username || !cred.password) {
        throw new Error('Shark account credentials are required. Configure them via PUT /api/home-automation/devices/:id/credentials');
      }
      const args = [
        'action',
        '--username', cred.username,
        '--password', cred.password,
        '--serial', device.serial,
        '--action', action
      ];
      if (options.power) args.push('--power', String(options.power).toLowerCase());
      if (cred.europe) args.push('--europe');
      const result = await runSharkBridge(args, 30000);
      // Update cached device state
      const existing = devices.get(normalizeId(deviceId));
      if (existing && result) {
        existing.operatingMode = result.operatingMode ?? existing.operatingMode;
        existing.running = result.running ?? existing.running;
        existing.batteryPercent = result.batteryPercent ?? existing.batteryPercent;
        existing.errorCode = result.errorCode ?? existing.errorCode;
        existing.lastSeen = Date.now();
      }
      return result;
    }

    const action = normalizeAction(actionValue);
    if (!['status', 'on', 'off', 'toggle'].includes(action)) throw new Error(`Unsupported action: ${action}`);

    if (device.protocol === 'tplink') {
      const handle = device.handle || await tpLinkClient.getDevice({ host: device.ip, port: device.port });
      const power = action === 'status'
        ? await handle.getPowerState()
        : action === 'toggle'
          ? await handle.togglePowerState()
          : await handle.setPowerState(action === 'on');
      device.powerState = typeof power === 'boolean' ? power : action === 'on';
      return { power: device.powerState };
    }

    if (device.protocol === 'kasa') {
      const result = await runKasaBridge(['action', '--host', device.ip, '--action', action], 15000);
      device.powerState = result?.isOn === true;
      return { ...result, power: device.powerState };
    }

    if (device.protocol === 'bluetooth') {
      throw new Error(device.managementReason || 'Bluetooth control is not implemented for this device');
    }

    if (!device.manageable || !device.localKey) {
      throw new Error('Tuya local key is required before this device can be managed');
    }
    const tuya = new TuyAPI({
      id: device.id.replace(/^tuya:/i, ''),
      ip: device.ip,
      key: device.localKey,
      version: device.version
    });
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
      manageableCount: listDevices().filter((device) => device.manageable).length
    };
  }

  return { start, discover, status, listDevices, getTopologyNodes, configureTuyaDevice, configureSharkAccount, getAlexaController, invoke };
}

export function registerHomeAutomationRoutes(app, service) {
  app.get('/api/home-automation/status', (req, res) => res.json(service.status()));
  app.get('/api/home-automation/devices', (req, res) => res.json({ status: 'ok', devices: service.listDevices() }));
  app.post('/api/home-automation/discover', async (req, res) => {
    try {
      res.json(await service.discover({ timeoutMs: req.body?.timeoutMs }));
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  // Generic device credentials (Tuya local key, etc.)
  app.put('/api/home-automation/devices/:deviceId/credentials', async (req, res) => {
    try {
      const device = await service.configureTuyaDevice(req.params.deviceId, req.body || {});
      res.json({ status: 'ok', device });
    } catch (error) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  // Register a Shark/Ninja account — triggers immediate device discovery
  // PUT /api/home-automation/shark/account
  // Body: { username, password, europe? }
  app.put('/api/home-automation/shark/account', async (req, res) => {
    try {
      const result = await service.configureSharkAccount(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  // ── Alexa auth ─────────────────────────────────────────────────────────────
  // Step 1: GET /api/home-automation/alexa/auth-url
  //   Returns the proxy URL to open in a browser for first-time login.
  app.get('/api/home-automation/alexa/auth-url', async (req, res) => {
    try {
      const ctrl = await service.getAlexaController();
      const hasCookie = await ctrl.hasCookie();
      res.json({
        status: hasCookie ? 'already-authed' : 'needs-auth',
        url: ctrl.getProxyAuthUrl(),
        instructions: hasCookie
          ? 'Already authenticated. Call POST /api/home-automation/discover to refresh devices.'
          : 'Open this URL in a browser, log in to Amazon, then close the tab. Cookie will be saved automatically.'
      });
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  // Step 2 (automatic after browser login) — or force a rediscover:
  // POST /api/home-automation/alexa/discover
  app.post('/api/home-automation/alexa/discover', async (req, res) => {
    try {
      const ctrl = await service.getAlexaController();
      await ctrl.connect();
      const vacuums = await ctrl.discoverVacuums();
      res.json({ status: 'ok', found: vacuums.length, vacuums });
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  app.post('/api/home-automation/devices/:deviceId/action', async (req, res) => {
    try {
      const result = await service.invoke(req.params.deviceId, req.body?.action, req.body || {});
      res.json({ status: 'ok', deviceId: req.params.deviceId, action: req.body?.action, result });
    } catch (error) {
      const message = String(error?.message || error);
      res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
    }
  });
}
