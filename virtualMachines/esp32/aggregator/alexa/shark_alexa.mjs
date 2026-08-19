/**
 * Shark/Ninja vacuum control via Alexa smarthome device API.
 *
 * alexa-remote2 authenticates against Amazon using a stored cookie file, then
 * calls the Alexa smarthome graph directly — the same path Alexa uses internally
 * when you say "Alexa, start Steve McClean".  No named routines needed.
 *
 * Auth flow (first run):
 *   1. Call initAlexa({ email, password, cookiePath }) — launches a proxy server
 *      on localhost:2000 and prints a URL.
 *   2. Open that URL in a browser, log in to Amazon, close the tab.
 *   3. The cookie is saved to cookiePath and reused on every subsequent start.
 *
 * Usage:
 *   const alexa = await createAlexaVacuumController({ cookiePath, ... });
 *   const vacuums = await alexa.discoverVacuums();
 *   await alexa.sendAction(entityId, 'start');
 *   await alexa.sendAction(entityId, 'stop');
 *   await alexa.sendAction(entityId, 'dock');
 *   const state = await alexa.getState(entityId);
 */

import AlexaRemote from 'alexa-remote2';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_COOKIE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/alexa-cookie.json'
);

// Smarthome action namespaces Alexa uses for robot vacuums
const NS_POWER     = 'Alexa.PowerController';
const NS_MODE      = 'Alexa.ModeController';
const NS_RANGE     = 'Alexa.RangeController';

// Map our simple action names to Alexa smarthome directives
const ACTION_MAP = {
  start:  { namespace: NS_POWER, name: 'TurnOn',  payload: {} },
  stop:   { namespace: NS_POWER, name: 'TurnOff', payload: {} },
  dock:   { namespace: NS_POWER, name: 'TurnOff', payload: {} },
  pause:  { namespace: NS_POWER, name: 'TurnOff', payload: {} },
};

function promisify1(fn, ctx) {
  return (...args) => new Promise((resolve, reject) => {
    fn.call(ctx, ...args, (err, result) => {
      if (err) reject(typeof err === 'string' ? new Error(err) : err);
      else resolve(result);
    });
  });
}

function isVacuumDevice(device) {
  const name = String(device?.friendlyName || device?.name || '').toLowerCase();
  const caps = Array.isArray(device?.capabilities) ? device.capabilities : [];
  const hasVacuumCap = caps.some((c) =>
    String(c?.interface || c?.namespace || '').toLowerCase().includes('vacuum')
  );
  // Shark IQ/AI devices have "vacuum" in the category or friendly name, or expose
  // a PowerController alongside a RangeController (clean level).
  const hasPower = caps.some((c) => String(c?.interface || '').includes('PowerController'));
  const hasRange = caps.some((c) => String(c?.interface || '').includes('RangeController'));
  const looksLikeVacuum = /vacuum|shark|roomba|robot.*clean|clean.*robot/i.test(name);
  return hasVacuumCap || looksLikeVacuum || (hasPower && hasRange);
}

function normaliseDevice(raw) {
  return {
    entityId: raw.entityId || raw.applianceId || raw.id,
    name: raw.friendlyName || raw.name || 'Unknown',
    model: raw.modelName || raw.model || '',
    manufacturer: raw.manufacturerName || raw.manufacturer || '',
    online: raw.online !== false,
    capabilities: (raw.capabilities || []).map((c) => c.interface || c.namespace).filter(Boolean),
    raw
  };
}

export async function createAlexaVacuumController({
  cookiePath = DEFAULT_COOKIE_PATH,
  proxyPort = 2000,
  amazonPage = 'amazon.com',
} = {}) {
  let alexa = null;
  let ready = false;

  async function loadCookie() {
    try {
      const raw = await fs.readFile(cookiePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function connect() {
    const cookie = await loadCookie();
    alexa = new AlexaRemote();
    ready = false;

    return new Promise((resolve, reject) => {
      const options = {
        acceptLanguage: 'en-US',
        amazonPage,
        useWsMqtt: false,
        logger: () => {},
        ...(cookie
          ? { cookie, refreshCookie: true }
          : {
              proxyOnly: true,
              proxyPort,
              onProxyRequestCookies: async (c) => {
                await fs.mkdir(path.dirname(cookiePath), { recursive: true });
                await fs.writeFile(cookiePath, JSON.stringify(c, null, 2), 'utf8');
                console.log(`[AlexaVacuum] Cookie saved to ${cookiePath}`);
              }
            }
        )
      };

      alexa.init(options, (err) => {
        if (err) {
          const msg = typeof err === 'string' ? err : (err?.message || String(err));
          // In proxy mode, alexa-remote2 signals "proxy is ready, please log in"
          // via an error string — this is expected, not a real failure.
          if (!cookie && msg.includes('Please open')) {
            console.log(`[AlexaVacuum] Proxy listening on port ${proxyPort} — waiting for browser login`);
            return resolve(); // proxy is up, resolve so the caller can return the URL
          }
          return reject(typeof err === 'string' ? new Error(err) : err);
        }
        ready = true;
        // Persist refreshed cookie
        if (cookie && alexa.cookieData) {
          fs.mkdir(path.dirname(cookiePath), { recursive: true })
            .then(() => fs.writeFile(cookiePath, JSON.stringify(alexa.cookieData, null, 2), 'utf8'))
            .catch(() => {});
        }
        resolve();
      });
    });
  }

  async function ensureConnected() {
    if (!ready) await connect();
  }

  async function discoverVacuums() {
    await ensureConnected();
    const getDevices = promisify1(alexa.getSmarthomeDevices, alexa);
    const result = await getDevices();
    const devices = Array.isArray(result)
      ? result
      : Array.isArray(result?.devices) ? result.devices : [];
    return devices.filter(isVacuumDevice).map(normaliseDevice);
  }

  async function getState(entityId) {
    await ensureConnected();
    const query = promisify1(alexa.querySmarthomeDevices, alexa);
    try {
      const result = await query([entityId], ['Alexa.PowerController', 'Alexa.EndpointHealth']);
      const props = result?.deviceStates?.[0]?.capabilityStates || [];
      const power = props.find((p) => p.namespace === NS_POWER || p.name === 'powerState');
      return {
        entityId,
        powerState: power?.value ?? null,
        running: String(power?.value || '').toLowerCase() === 'on',
        rawProperties: props
      };
    } catch {
      return { entityId, powerState: null, running: null, rawProperties: [] };
    }
  }

  async function sendAction(entityId, action) {
    await ensureConnected();
    const directive = ACTION_MAP[String(action).toLowerCase()];
    if (!directive) throw new Error(`Unknown action: ${action}. Valid: ${Object.keys(ACTION_MAP).join(', ')}, status`);

    const execAction = promisify1(alexa.executeSmarthomeDeviceAction, alexa);
    const result = await execAction(
      [entityId],
      { action: directive.name, ...directive.payload },
      'APPLIANCE'
    );
    return result;
  }

  // Returns the proxy URL to open in a browser for first-time auth.
  // Only needed if no cookie file exists yet.
  function getProxyAuthUrl() {
    return `http://localhost:${proxyPort}/`;
  }

  function hasCookie() {
    return loadCookie().then(Boolean);
  }

  function stop() {
    try { alexa?.stop?.(); } catch { /* ignore */ }
    ready = false;
    alexa = null;
  }

  return { connect, discoverVacuums, getState, sendAction, getProxyAuthUrl, hasCookie, stop };
}
