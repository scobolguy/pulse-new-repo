/**
 * Alexa smarthome driver.
 * Controls robot vacuums (and any other Alexa smarthome device) via alexa-remote2.
 * Requires a one-time browser login — see GET /api/home-automation/alexa/auth-url.
 */
import fs from 'node:fs/promises';
import { createAlexaVacuumController } from '../../../../../alexa/shark_alexa.mjs';
import { normalizeId } from '../utils.mjs';

export function createAlexaDriver({ devices, cookiePath }) {
  let controller = null;

  async function getController() {
    if (controller) return controller;
    controller = await createAlexaVacuumController({ cookiePath });
    return controller;
  }

  function upsert(found) {
    const entityId = String(found?.entityId || '').trim();
    if (!entityId) return;
    const id = `alexa:${entityId}`;
    const key = normalizeId(id);
    devices.set(key, {
      id, protocol: 'alexa',
      vendor: String(found?.manufacturer || 'SharkNinja').trim(),
      name: String(found?.name || `Alexa Device ${entityId.slice(-6)}`).trim(),
      ip: null, port: null, entityId,
      deviceType: 'robot-vacuum', model: String(found?.model || '').trim(),
      manageable: true, online: found?.online !== false,
      running: null, powerState: null,
      lastSeen: Date.now()
    });
  }

  async function discover() {
    try { await fs.access(cookiePath); } catch { return []; } // skip if not yet authenticated
    try {
      const ctrl = await getController();
      const vacuums = await ctrl.discoverVacuums();
      for (const v of vacuums) upsert(v);
      return vacuums;
    } catch (err) {
      console.warn(`[AlexaDriver] Discovery failed: ${err.message}`);
      return [];
    }
  }

  async function invokeStatus(device) {
    const ctrl = await getController();
    const state = await ctrl.getState(device.entityId);
    device.running = state.running;
    device.powerState = state.powerState;
    device.lastSeen = Date.now();
    return state;
  }

  async function invokeAction(device, action) {
    const ctrl = await getController();
    const result = await ctrl.sendAction(device.entityId, action);
    device.running = action === 'start';
    device.lastSeen = Date.now();
    return { action, result };
  }

  return { discover, invokeStatus, invokeAction, getController };
}
