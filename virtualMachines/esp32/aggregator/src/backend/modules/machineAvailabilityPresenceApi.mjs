export function createMachineAvailabilityPresenceApi(deps = {}) {
  const {
    machineAvailability,
    discoveredNodes,
    buildMachineAvailabilityAnnouncement,
    udpServer,
    UDP_PORT,
    getMachineAvailabilityBeaconIntervalMs,
    machineWorkloadState,
    machineDrainDefaultTimeoutMs,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = deps;

  function sendMachineAvailabilityAnnouncement(reason = 'manual') {
    if (machineAvailability.udpBroadcastBlocked) {
      return;
    }
    const payload = buildMachineAvailabilityAnnouncement();
    payload.reason = reason;
    machineAvailability.advertisedAt = new Date().toISOString();
    machineAvailability.announceReason = reason;
    machineAvailability.capabilityHash = payload.capabilityHash;
    machineAvailability.lastBeaconAt = machineAvailability.advertisedAt;
    const message = Buffer.from(JSON.stringify(payload), 'utf-8');
    udpServer.send(message, 0, message.length, UDP_PORT, '255.255.255.255', (error) => {
      if (error) {
        if (error.code === 'EACCES') {
          machineAvailability.udpBroadcastBlocked = true;
          stopMachineAvailabilityAnnouncer();
          console.warn(`[UDP] Broadcast announcements disabled: ${error.message}`);
        } else {
          console.warn(`[UDP] Failed to send availability announcement: ${error.message}`);
        }
        return;
      }
      console.log(`[UDP] Beacon announced: ${payload.status} (${reason})`);
    });
  }

  function stopMachineAvailabilityAnnouncer() {
    if (!machineAvailability.announceTimerId) return;
    clearTimeoutFn(machineAvailability.announceTimerId);
    machineAvailability.announceTimerId = null;
  }

  function getMachineAvailabilityPayload() {
    return {
      nodeId: machineAvailability.nodeId,
      available: machineAvailability.available,
      draining: machineAvailability.draining,
      advertisedAt: machineAvailability.advertisedAt,
      announceReason: machineAvailability.announceReason,
      beaconAcknowledged: machineAvailability.beaconAcknowledged,
      beaconAckAt: machineAvailability.beaconAckAt,
      capabilityHash: machineAvailability.capabilityHash,
      status: machineAvailability.available ? 'available' : (machineAvailability.draining ? 'draining' : 'unavailable')
    };
  }

  function normalizePresenceIp(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'unknown';
    if (raw.startsWith('::ffff:')) return raw.substring(7);
    return raw;
  }

  function upsertBrowserPresenceNode({ clientId, nodeName, ip, userAgent, available = true }) {
    const key = `web:${String(clientId || '').trim()}`;
    if (!key || key === 'web:') return null;
    const now = Date.now();
    const previous = discoveredNodes.get(key) || {};
    const next = {
      ...previous,
      id: key,
      source: 'web-client',
      clientId: String(clientId || '').trim(),
      nodeName: String(nodeName || previous.nodeName || 'Web Client').trim(),
      ip: normalizePresenceIp(ip || previous.ip),
      userAgent: String(userAgent || previous.userAgent || '').trim(),
      availability: {
        available: Boolean(available),
        draining: false,
        status: available ? 'available' : 'unavailable'
      },
      lastSeen: now,
      raw: JSON.stringify({ kind: 'browserPresence', clientId, nodeName, ip, available })
    };
    discoveredNodes.set(key, next);
    return next;
  }

  function setBrowserPresenceUnavailable(clientId) {
    const key = `web:${String(clientId || '').trim()}`;
    const previous = discoveredNodes.get(key);
    if (!previous) return null;
    const next = {
      ...previous,
      availability: {
        available: false,
        draining: false,
        status: 'unavailable'
      },
      lastSeen: Date.now()
    };
    discoveredNodes.set(key, next);
    return next;
  }

  function getBrowserPresence(clientId) {
    const key = `web:${String(clientId || '').trim()}`;
    return discoveredNodes.get(key) || null;
  }

  function startMachineAvailabilityAnnouncer() {
    stopMachineAvailabilityAnnouncer();
    machineAvailability.announceTimerId = setTimeoutFn(() => {
      machineAvailability.announceTimerId = null;
      if (!machineAvailability.available) {
        return;
      }
      sendMachineAvailabilityAnnouncement('heartbeat');
      startMachineAvailabilityAnnouncer();
    }, getMachineAvailabilityBeaconIntervalMs());
  }

  function setMachineAvailable() {
    machineAvailability.available = true;
    machineAvailability.draining = false;
    machineAvailability.beaconAcknowledged = false;
    sendMachineAvailabilityAnnouncement('available');
    startMachineAvailabilityAnnouncer();
    return getMachineAvailabilityPayload();
  }

  function setMachineUnavailable() {
    machineAvailability.available = false;
    machineAvailability.draining = false;
    machineAvailability.beaconAcknowledged = false;
    stopMachineAvailabilityAnnouncer();
    sendMachineAvailabilityAnnouncement('unavailable');
    return getMachineAvailabilityPayload();
  }

  async function drainMachineAndSetUnavailable({ timeoutMs = machineDrainDefaultTimeoutMs } = {}) {
    machineAvailability.available = false;
    machineAvailability.draining = true;
    machineAvailability.beaconAcknowledged = false;
    sendMachineAvailabilityAnnouncement('draining');

    const startedAt = Date.now();
    const hardTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : machineDrainDefaultTimeoutMs;
    while (machineWorkloadState.inFlight > 0 && (Date.now() - startedAt) < hardTimeout) {
      await new Promise((resolve) => setTimeoutFn(resolve, 200));
    }

    const timedOut = machineWorkloadState.inFlight > 0;
    const next = setMachineUnavailable();
    return {
      availability: next,
      drain: {
        timedOut,
        timeoutMs: hardTimeout,
        inFlightAtCompletion: machineWorkloadState.inFlight
      }
    };
  }

  return {
    getMachineAvailabilityPayload,
    normalizePresenceIp,
    upsertBrowserPresenceNode,
    setBrowserPresenceUnavailable,
    getBrowserPresence,
    setMachineAvailable,
    setMachineUnavailable,
    drainMachineAndSetUnavailable
  };
}
