function parseCsvValues(raw) {
  return String(raw || '')
    .split(/[;,]/)
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeAuthorityBaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  const noTrailing = value.endsWith('/') ? value.slice(0, -1) : value;
  return /^https?:\/\//i.test(noTrailing) ? noTrailing : null;
}

function buildPeerAuthorityUrl(baseUrl) {
  const normalized = normalizeAuthorityBaseUrl(baseUrl);
  if (!normalized) return null;
  return `${normalized}/api/time/authority`;
}

async function probePeerAuthority(fetchFn, baseUrl, timeoutMs) {
  const url = buildPeerAuthorityUrl(baseUrl);
  if (!url) {
    throw new Error(`Invalid peer authority url: ${baseUrl}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(200, Number(timeoutMs) || 2500));
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const nowMs = Number(payload?.time?.nowMs ?? payload?.nowMs);
    if (!Number.isFinite(nowMs)) {
      throw new Error('peer response missing numeric nowMs');
    }

    return {
      source: `peer:${baseUrl}`,
      nowMs,
      payload
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatDelta(deltaMs) {
  const sign = deltaMs >= 0 ? '+' : '-';
  return `${sign}${Math.abs(Math.round(deltaMs))}ms`;
}

export function createTimeConsistencyMonitor(options = {}) {
  const timeService = options.timeService;
  if (!timeService || typeof timeService.nowMs !== 'function') {
    throw new Error('timeService with nowMs() is required');
  }

  const fetchFn = typeof options.fetchFn === 'function' ? options.fetchFn : fetch;
  const intervalMs = Math.max(1000, Number(options.intervalMs || 60000));
  const toleranceMs = Math.max(1, Number(options.toleranceMs || 2000));
  const ntpServer = String(options.ntpServer || '').trim();
  const ntpPort = Math.max(1, Number(options.ntpPort || 123));
  const ntpTimeoutMs = Math.max(200, Number(options.ntpTimeoutMs || 2500));
  const peerUrls = Array.isArray(options.peerUrls)
    ? options.peerUrls
    : parseCsvValues(options.peerUrlsCsv || '');

  const state = {
    running: false,
    timerId: null,
    lastRunAt: null,
    lastRunError: null,
    checks: 0,
    warnings: 0
  };

  async function runCheck() {
    if (state.running) return;
    state.running = true;

    try {
      const authoritativeNow = Number(timeService.nowMs());
      const systemNow = Date.now();
      const sources = [];

      sources.push({ source: 'system', nowMs: systemNow });

      if (ntpServer && typeof timeService.probeNtp === 'function') {
        try {
          const ntp = await timeService.probeNtp({
            server: ntpServer,
            port: ntpPort,
            timeoutMs: ntpTimeoutMs
          });
          sources.push({ source: `ntp:${ntp.server}`, nowMs: Number(ntp.ntpTransmitMs), roundTripMs: ntp.roundTripMs });
        } catch (error) {
          sources.push({ source: `ntp:${ntpServer}`, error: String(error?.message || error || 'probe-failed') });
        }
      }

      for (const peer of peerUrls) {
        try {
          const result = await probePeerAuthority(fetchFn, peer, ntpTimeoutMs);
          sources.push({ source: result.source, nowMs: result.nowMs });
        } catch (error) {
          sources.push({ source: `peer:${peer}`, error: String(error?.message || error || 'probe-failed') });
        }
      }

      const evaluated = [];
      let warning = false;
      for (const source of sources) {
        if (!Number.isFinite(source.nowMs)) {
          evaluated.push({
            source: source.source,
            ok: false,
            error: source.error || 'unavailable'
          });
          warning = true;
          continue;
        }

        const deltaMs = Number(source.nowMs) - authoritativeNow;
        const ok = Math.abs(deltaMs) <= toleranceMs;
        if (!ok) warning = true;
        evaluated.push({
          source: source.source,
          ok,
          deltaMs,
          roundTripMs: source.roundTripMs
        });
      }

      state.checks += 1;
      if (warning) state.warnings += 1;
      state.lastRunAt = new Date().toISOString();
      state.lastRunError = null;

      const summary = evaluated
        .map((entry) => {
          if (!entry.ok && entry.error) return `${entry.source}=error(${entry.error})`;
          const rtt = Number.isFinite(entry.roundTripMs) ? ` rtt=${Math.round(entry.roundTripMs)}ms` : '';
          return `${entry.source}=${entry.ok ? 'ok' : 'drift'}(${formatDelta(entry.deltaMs)})${rtt}`;
        })
        .join(', ');

      const level = warning ? 'warn' : 'log';
      console[level](`[TIME][CONSISTENCY] now=${authoritativeNow} tolerance=${toleranceMs}ms checks=${state.checks} ${summary}`);
    } catch (error) {
      state.lastRunAt = new Date().toISOString();
      state.lastRunError = String(error?.message || error || 'consistency-check-failed');
      state.checks += 1;
      state.warnings += 1;
      console.warn(`[TIME][CONSISTENCY] check failed: ${state.lastRunError}`);
    } finally {
      state.running = false;
    }
  }

  function start() {
    if (state.timerId) return;
    void runCheck();
    state.timerId = setInterval(() => {
      void runCheck();
    }, intervalMs);
  }

  function stop() {
    if (!state.timerId) return;
    clearInterval(state.timerId);
    state.timerId = null;
  }

  function getSnapshot() {
    return {
      enabled: true,
      running: state.running,
      intervalMs,
      toleranceMs,
      checks: state.checks,
      warnings: state.warnings,
      lastRunAt: state.lastRunAt,
      lastRunError: state.lastRunError,
      ntpServer: ntpServer || null,
      peerCount: peerUrls.length
    };
  }

  return {
    start,
    stop,
    runCheck,
    getSnapshot
  };
}
