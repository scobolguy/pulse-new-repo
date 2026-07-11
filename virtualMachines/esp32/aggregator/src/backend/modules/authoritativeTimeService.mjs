import dgram from 'node:dgram';

const NTP_UNIX_EPOCH_OFFSET_SECONDS = 2208988800;

function parseNtpTransmitTimestampMs(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 48) {
    throw new Error('Invalid NTP packet');
  }

  const seconds = buffer.readUInt32BE(40);
  const fraction = buffer.readUInt32BE(44);
  const unixSeconds = seconds - NTP_UNIX_EPOCH_OFFSET_SECONDS;
  const fractionMs = Math.round((fraction / 0x100000000) * 1000);
  return (unixSeconds * 1000) + fractionMs;
}

async function requestNtpTime({ server, port = 123, timeoutMs = 2500, nowProvider = () => Date.now() } = {}) {
  const host = String(server || '').trim();
  if (!host) {
    throw new Error('NTP server is required');
  }

  const socket = dgram.createSocket('udp4');
  const requestBuffer = Buffer.alloc(48);
  requestBuffer[0] = 0x1B;

  return await new Promise((resolve, reject) => {
    let settled = false;
    const localSendMs = nowProvider();
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new Error(`NTP request timed out after ${timeoutMs}ms`));
    }, Math.max(200, Number(timeoutMs) || 2500));

    socket.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket.close();
      reject(error);
    });

    socket.once('message', (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      const localReceiveMs = nowProvider();
      socket.close();

      try {
        const ntpTransmitMs = parseNtpTransmitTimestampMs(msg);
        const midpointLocalMs = Math.round((localSendMs + localReceiveMs) / 2);
        const offsetMs = ntpTransmitMs - midpointLocalMs;
        const roundTripMs = Math.max(0, localReceiveMs - localSendMs);
        resolve({
          server: host,
          port: Number(port) || 123,
          ntpTransmitMs,
          offsetMs,
          roundTripMs,
          localSendMs,
          localReceiveMs
        });
      } catch (error) {
        reject(error);
      }
    });

    socket.send(requestBuffer, 0, requestBuffer.length, Number(port) || 123, host, (error) => {
      if (!error) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket.close();
      reject(error);
    });
  });
}

export function createAuthoritativeTimeService(options = {}) {
  const nowProvider = typeof options.nowProvider === 'function' ? options.nowProvider : () => Date.now();
  const authorityId = String(options.authorityId || 'local-clock').trim() || 'local-clock';
  const initialOffsetMs = Number(options.offsetMs || 0);

  const state = {
    authorityId,
    offsetMs: Number.isFinite(initialOffsetMs) ? initialOffsetMs : 0,
    source: String(options.source || 'local').trim() || 'local',
    updatedAtMs: nowProvider(),
    lastSyncStatus: 'ready',
    lastSyncError: null,
    lastSyncAtMs: null,
    lastSyncMeta: null
  };

  function getNowMs() {
    return nowProvider() + state.offsetMs;
  }

  function getNowIso() {
    return new Date(getNowMs()).toISOString();
  }

  function getNowDate() {
    return new Date(getNowMs());
  }

  function setOffsetMs(nextOffsetMs, syncMeta = {}) {
    const parsed = Number(nextOffsetMs);
    if (!Number.isFinite(parsed)) {
      throw new Error('offsetMs must be a finite number');
    }

    state.offsetMs = parsed;
    state.source = String(syncMeta.source || state.source || 'local').trim() || 'local';
    state.updatedAtMs = nowProvider();
    state.lastSyncStatus = 'ready';
    state.lastSyncError = null;
    state.lastSyncAtMs = state.updatedAtMs;
    state.lastSyncMeta = syncMeta && typeof syncMeta === 'object' ? { ...syncMeta } : null;
  }

  function syncFromAuthoritySample(authorityEpochMs, localObservedMs = nowProvider(), syncMeta = {}) {
    const authorityMs = Number(authorityEpochMs);
    const localMs = Number(localObservedMs);
    if (!Number.isFinite(authorityMs) || !Number.isFinite(localMs)) {
      throw new Error('authorityEpochMs and localObservedMs must be finite numbers');
    }

    const nextOffsetMs = authorityMs - localMs;
    setOffsetMs(nextOffsetMs, {
      source: String(syncMeta.source || 'authority-sample').trim() || 'authority-sample'
    });
    return nextOffsetMs;
  }

  function markSyncError(error, syncMeta = {}) {
    state.lastSyncStatus = 'error';
    state.lastSyncError = String(error?.message || error || 'unknown-sync-error');
    state.source = String(syncMeta.source || state.source || 'local').trim() || 'local';
    state.updatedAtMs = nowProvider();
    state.lastSyncAtMs = state.updatedAtMs;
    state.lastSyncMeta = syncMeta && typeof syncMeta === 'object' ? { ...syncMeta } : null;
  }

  async function syncFromNtp({ server = 'pool.ntp.org', port = 123, timeoutMs = 2500 } = {}) {
    const sample = await requestNtpTime({
      server,
      port,
      timeoutMs,
      nowProvider
    });

    setOffsetMs(sample.offsetMs, {
      source: `ntp:${sample.server}`,
      ntpServer: sample.server,
      ntpPort: sample.port,
      roundTripMs: sample.roundTripMs,
      localSendMs: sample.localSendMs,
      localReceiveMs: sample.localReceiveMs,
      ntpTransmitMs: sample.ntpTransmitMs
    });

    return {
      offsetMs: sample.offsetMs,
      roundTripMs: sample.roundTripMs,
      server: sample.server,
      port: sample.port,
      nowIso: getNowIso()
    };
  }

  async function probeNtp({ server = 'pool.ntp.org', port = 123, timeoutMs = 2500 } = {}) {
    const sample = await requestNtpTime({
      server,
      port,
      timeoutMs,
      nowProvider
    });

    return {
      server: sample.server,
      port: sample.port,
      ntpTransmitMs: sample.ntpTransmitMs,
      offsetMs: sample.offsetMs,
      roundTripMs: sample.roundTripMs,
      localSendMs: sample.localSendMs,
      localReceiveMs: sample.localReceiveMs
    };
  }

  function getSnapshot() {
    return {
      authorityId: state.authorityId,
      source: state.source,
      offsetMs: state.offsetMs,
      nowMs: getNowMs(),
      nowIso: getNowIso(),
      updatedAt: new Date(state.updatedAtMs).toISOString(),
      lastSyncStatus: state.lastSyncStatus,
      lastSyncError: state.lastSyncError,
      lastSyncAt: state.lastSyncAtMs ? new Date(state.lastSyncAtMs).toISOString() : null,
      lastSyncMeta: state.lastSyncMeta
    };
  }

  return {
    nowMs: getNowMs,
    nowIso: getNowIso,
    nowDate: getNowDate,
    setOffsetMs,
    syncFromAuthoritySample,
    syncFromNtp,
    probeNtp,
    markSyncError,
    getSnapshot
  };
}
