/**
 * Shared utilities used across all home-automation drivers and the service.
 */
import os from 'node:os';

export function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

export function publicDevice(device) {
  const { handle, localKey, ...safe } = device;
  return safe;
}

export function normalizeAction(value) {
  const action = String(value || 'status').trim().toLowerCase();
  return action === 'turnon' ? 'on' : action === 'turnoff' ? 'off' : action;
}

export function normalizeVacuumAction(value) {
  const a = String(value || 'status').trim().toLowerCase();
  const aliases = {
    clean: 'start', vacuum: 'start', run: 'start', begin: 'start', go: 'start', resume: 'start',
    stop: 'stop', halt: 'stop', cancel: 'stop',
    pause: 'pause', hold: 'pause',
    dock: 'dock', home: 'dock', return: 'dock', charge: 'dock',
    explore: 'explore', map: 'explore'
  };
  return aliases[a] || a;
}

export function getLanDiscoveryTarget() {
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
