import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import onvif from 'onvif';
import onvifPromises from 'onvif/promises/index.js';
import ffmpegPath from 'ffmpeg-static';
import { encryptSecret, decryptSecret } from './security/credentialStore.mjs';

const { Cam } = onvifPromises;
const DISCOVERY_CACHE_MS = 30_000;
const DEFAULT_ONVIF_PORT = 2020;
const DEFAULT_RTSP_PORT = 554;
const MOVE_DURATION_MS = 450;
const MOVE_SPEED = 0.45;
const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CREDENTIALS_PATH = path.resolve(AGGREGATOR_ROOT, 'data', 'camera-credentials.json');

let cameraCache = { cameras: [], expiresAt: 0 };
const connectedCameras = new Map();
let storedCredentials = null;
let storedCredentialsLoaded = false;

const normalizeName = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

async function loadStoredCredentials() {
  if (storedCredentialsLoaded) return storedCredentials;
  storedCredentialsLoaded = true;
  try {
    const raw = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8'));
    const username = await decryptSecret(raw?.username);
    const password = await decryptSecret(raw?.password);
    storedCredentials = username && password ? { username, password } : null;
  } catch {
    storedCredentials = null;
  }
  return storedCredentials;
}

async function cameraCredentials() {
  const stored = await loadStoredCredentials();
  if (stored?.username && stored?.password) return stored;
  return {
    username: String(process.env.TAPO_CAMERA_USERNAME || '').trim(),
    password: String(process.env.TAPO_CAMERA_PASSWORD || '')
  };
}

export async function saveCameraCredentials({ username, password } = {}) {
  const trimmedUsername = String(username || '').trim();
  const trimmedPassword = String(password || '');
  if (!trimmedUsername || !trimmedPassword) throw new Error('username and password are required');
  const payload = {
    version: 1,
    username: await encryptSecret(trimmedUsername),
    password: await encryptSecret(trimmedPassword)
  };
  await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
  await fs.writeFile(CREDENTIALS_PATH, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  storedCredentials = { username: trimmedUsername, password: trimmedPassword };
  storedCredentialsLoaded = true;
  connectedCameras.clear(); // force reconnect using the new credentials
  return { status: 'ok' };
}

function parseConfiguredHosts() {
  return String(process.env.TAPO_CAMERA_HOSTS || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const separator = entry.lastIndexOf('@');
      const label = separator > 0 ? entry.slice(0, separator).trim() : '';
      const address = separator > 0 ? entry.slice(separator + 1).trim() : entry;
      const url = new URL(`onvif://${address}`);
      const host = url.hostname;
      const port = Number(url.port || DEFAULT_ONVIF_PORT);
      return {
        id: normalizeName(label || host) || `camera${index + 1}`,
        name: label || `Tapo ${host.split('.').at(-1)}`,
        host,
        onvifPort: port,
        rtspPort: DEFAULT_RTSP_PORT,
        source: 'configured'
      };
    });
}

function activeIpv4Subnets() {
  const subnets = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal || address.netmask !== '255.255.255.0') continue;
      const prefix = address.address.split('.').slice(0, 3).join('.');
      if (!subnets.includes(prefix)) subnets.push(prefix);
    }
  }
  return subnets;
}

function tcpProbe(host, port, timeoutMs = 250) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = open => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function scanCameraPorts() {
  const jobs = [];
  for (const prefix of activeIpv4Subnets()) {
    for (let suffix = 1; suffix < 255; suffix += 1) {
      jobs.push({ host: `${prefix}.${suffix}`, port: DEFAULT_ONVIF_PORT });
      jobs.push({ host: `${prefix}.${suffix}`, port: DEFAULT_RTSP_PORT });
    }
  }

  const openByHost = new Map();
  let nextJob = 0;
  const worker = async () => {
    while (nextJob < jobs.length) {
      const job = jobs[nextJob++];
      if (!await tcpProbe(job.host, job.port)) continue;
      if (!openByHost.has(job.host)) openByHost.set(job.host, new Set());
      openByHost.get(job.host).add(job.port);
    }
  };
  await Promise.all(Array.from({ length: 64 }, () => worker()));

  return [...openByHost.entries()].map(([host, ports]) => ({
    id: normalizeName(host),
    name: `Camera ${host.split('.').at(-1)}`,
    host,
    onvifPort: ports.has(DEFAULT_ONVIF_PORT) ? DEFAULT_ONVIF_PORT : null,
    rtspPort: ports.has(DEFAULT_RTSP_PORT) ? DEFAULT_RTSP_PORT : null,
    source: 'port-scan'
  }));
}

function probeWsDiscovery(timeout = 3500) {
  return new Promise(resolve => {
    onvif.Discovery.probe({ timeout }, (error, devices = []) => {
      if (error) return resolve([]);
      resolve(devices.map((device, index) => {
        const xaddr = Array.isArray(device.xaddrs) ? device.xaddrs[0] : device.xaddrs;
        let parsed = null;
        try { parsed = new URL(xaddr); } catch { /* use discovery host below */ }
        const host = parsed?.hostname || device.hostname;
        const scopeName = (device.scopes || [])
          .map(scope => decodeURIComponent(String(scope)).match(/name\/([^/]+)$/i)?.[1])
          .find(Boolean);
        return {
          id: normalizeName(scopeName || device.urn || host) || `onvif${index + 1}`,
          name: scopeName || `ONVIF ${host}`,
          host,
          onvifPort: Number(parsed?.port || device.port || DEFAULT_ONVIF_PORT),
          rtspPort: DEFAULT_RTSP_PORT,
          source: 'ws-discovery',
          urn: device.urn || ''
        };
      }).filter(camera => camera.host));
    });
  });
}

function mergeCameras(groups) {
  const byHost = new Map();
  for (const camera of groups.flat()) {
    const existing = byHost.get(camera.host);
    byHost.set(camera.host, existing ? {
      ...camera,
      ...existing,
      onvifPort: existing.onvifPort || camera.onvifPort,
      rtspPort: existing.rtspPort || camera.rtspPort,
      source: existing.source === 'configured' ? existing.source : camera.source
    } : camera);
  }
  return [...byHost.values()].sort((left, right) => left.host.localeCompare(right.host, undefined, { numeric: true }));
}

export async function discoverOnvifCameras({ force = false } = {}) {
  if (!force && cameraCache.expiresAt > Date.now()) return cameraCache.cameras;
  const configured = parseConfiguredHosts();
  const [discovered, scanned] = await Promise.all([probeWsDiscovery(), scanCameraPorts()]);
  cameraCache = {
    cameras: mergeCameras([configured, discovered, scanned]),
    expiresAt: Date.now() + DISCOVERY_CACHE_MS
  };
  return cameraCache.cameras;
}

export async function resolveOnvifCamera(requestedName) {
  const requested = normalizeName(requestedName);
  const cameras = await discoverOnvifCameras();
  if (!requested && cameras.length === 1) return cameras[0];
  return cameras.find(camera => [camera.id, camera.name, camera.host]
    .map(normalizeName)
    .some(value => value === requested || value.includes(requested) || requested.includes(value))) || null;
}

async function connectCamera(camera) {
  if (!camera?.onvifPort) throw new Error('ONVIF is not enabled for this camera');
  const credentials = await cameraCredentials();
  if (!credentials.username || !credentials.password) {
    throw new Error('Tapo Camera Account credentials are not configured on the backend');
  }
  const key = `${camera.host}:${camera.onvifPort}`;
  if (connectedCameras.has(key)) return connectedCameras.get(key);

  const connection = new Cam({
    hostname: camera.host,
    port: camera.onvifPort,
    username: credentials.username,
    password: credentials.password,
    timeout: 8000
  });
  await connection.connect();
  connectedCameras.set(key, connection);
  return connection;
}

export async function moveOnvifCamera(requestedName, direction) {
  const camera = await resolveOnvifCamera(requestedName);
  if (!camera) throw new Error(`Camera "${requestedName}" was not found`);
  const cam = await connectCamera(camera);
  const moves = {
    left: { x: -MOVE_SPEED },
    right: { x: MOVE_SPEED },
    up: { y: MOVE_SPEED },
    down: { y: -MOVE_SPEED },
    'zoom-in': { zoom: MOVE_SPEED },
    'zoom-out': { zoom: -MOVE_SPEED }
  };
  if (direction === 'home') {
    await cam.gotoHomePosition({});
  } else if (direction === 'stop') {
    await cam.stop({ panTilt: true, zoom: true });
  } else {
    const velocity = moves[direction];
    if (!velocity) throw new Error(`Unsupported PTZ direction: ${direction}`);
    await cam.continuousMove({ ...velocity, timeout: MOVE_DURATION_MS });
    await new Promise(resolve => setTimeout(resolve, MOVE_DURATION_MS));
    await cam.stop({ panTilt: true, zoom: true });
  }
  return { camera, direction };
}

async function authenticatedRtspUri(camera) {
  const cam = await connectCamera(camera);
  const stream = await cam.getStreamUri({ protocol: 'RTSP' });
  const uri = new URL(stream.uri);
  const credentials = await cameraCredentials();
  uri.username = credentials.username;
  uri.password = credentials.password;
  return uri.toString();
}

export function registerOnvifCameraRoutes(app) {
  app.get('/api/cameras/discover', async (req, res) => {
    try {
      const cameras = await discoverOnvifCameras({ force: req.query.refresh === '1' });
      const credentials = await cameraCredentials();
      res.json({ cameras, credentialsConfigured: Boolean(credentials.username && credentials.password) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/cameras/:camera/status', async (req, res) => {
    try {
      const camera = await resolveOnvifCamera(req.params.camera);
      if (!camera) return res.status(404).json({ ok: false, error: 'Camera not found' });
      const credentials = await cameraCredentials();
      if (!credentials.username || !credentials.password) {
        return res.status(412).json({
          ok: false,
          needsCredentials: true,
          error: 'Tapo Camera Account credentials are not configured on the backend'
        });
      }
      res.json({ ok: true, camera: { id: camera.id, name: camera.name } });
    } catch (error) {
      res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/cameras/credentials', expressJsonGuard, async (req, res) => {
    try {
      const result = await saveCameraCredentials(req.body || {});
      res.json({ ...result, credentialsConfigured: true });
    } catch (error) {
      res.status(400).json({ status: 'error', error: error.message });
    }
  });

  app.post('/api/cameras/:camera/ptz', expressJsonGuard, async (req, res) => {
    try {
      const result = await moveOnvifCamera(req.params.camera, String(req.body?.direction || '').toLowerCase());
      res.json({ ok: true, camera: result.camera.name, direction: result.direction });
    } catch (error) {
      res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/cameras/:camera/viewer', async (req, res) => {
    const camera = await resolveOnvifCamera(req.params.camera);
    if (!camera) return res.status(404).send('Camera not found');
    const cameraId = encodeURIComponent(camera.id);
    const title = String(camera.name).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self'");
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
html,body{margin:0;background:#0b0d10;color:#f5f7fa;font-family:Verdana,sans-serif}main{display:grid;grid-template-rows:minmax(180px,1fr) auto;height:100vh}img{width:100%;height:100%;object-fit:contain;background:#000}.controls{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:10px;border-top:1px solid #343a40;background:#171a1f}.group{display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(2,32px);gap:4px}.group button:first-child{grid-column:2}.group button:nth-child(2){grid-column:1}.group button:nth-child(3){grid-column:2}.group button:nth-child(4){grid-column:3}button{width:36px;height:32px;border:1px solid #505863;background:#252a31;color:#fff;border-radius:4px;font-size:16px;cursor:pointer}button:hover{background:#343b44}.zoom{display:flex;gap:4px}.label{font-size:12px;color:#aeb7c2;margin-right:4px}.status{min-width:120px;font-size:11px;color:#aeb7c2}</style></head>
<body><main><img src="/api/cameras/${cameraId}/stream.mjpeg" alt="Live feed from ${title}">
<div class="controls"><span class="label">${title}</span><div class="group"><button title="Tilt up" data-direction="up">↑</button><button title="Pan left" data-direction="left">←</button><button title="Home" data-direction="home">⌂</button><button title="Pan right" data-direction="right">→</button><button title="Tilt down" data-direction="down">↓</button></div><div class="zoom"><button title="Zoom out" data-direction="zoom-out">−</button><button title="Zoom in" data-direction="zoom-in">+</button><button title="Stop" data-direction="stop">■</button></div><span class="status" id="status">Ready</span></div></main>
<script>const status=document.getElementById('status');document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',async()=>{const direction=button.dataset.direction;status.textContent=direction+'…';try{const response=await fetch('/api/cameras/${cameraId}/ptz',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction})});const data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));status.textContent=direction+' complete';}catch(error){status.textContent=error.message;}}));</script></body></html>`);
  });

  app.get('/api/cameras/:camera/stream.mjpeg', async (req, res) => {
    let ffmpeg = null;
    try {
      const camera = await resolveOnvifCamera(req.params.camera);
      if (!camera) return res.status(404).json({ error: 'Camera not found' });
      const input = await authenticatedRtspUri(camera);
      res.status(200);
      res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
      res.setHeader('Cache-Control', 'no-store');
      ffmpeg = spawn(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', input,
        '-an', '-vf', 'fps=5,scale=640:-2', '-q:v', '5', '-f', 'mpjpeg', '-boundary_tag', 'frame', 'pipe:1'
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      ffmpeg.stdout.pipe(res);
      ffmpeg.stderr.on('data', chunk => console.warn(`[CAMERA] FFmpeg ${camera.host}: ${String(chunk).trim()}`));
      ffmpeg.once('error', error => {
        if (!res.headersSent) res.status(500).json({ error: error.message });
        else res.end();
      });
      ffmpeg.once('close', () => res.end());
      req.once('close', () => ffmpeg?.kill());
    } catch (error) {
      if (!res.headersSent) res.status(502).json({ error: error.message });
      else res.end();
      ffmpeg?.kill();
    }
  });
}

function expressJsonGuard(req, _res, next) {
  if (req.body && typeof req.body === 'object') return next();
  req.body = {};
  next();
}
