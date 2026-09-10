/**
 * Periodic NTP sync monitor for the authoritative time service.
 */
export function createAuthoritativeTimeSyncMonitor({
  authoritativeTimeService,
  enabled,
  server,
  port,
  timeoutMs,
  intervalMs
}) {
  const state = {
    running: false,
    timerId: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null
  };

  async function sync({ reason = 'scheduled' } = {}) {
    if (state.running) {
      return { skipped: true, reason: 'sync-already-running' };
    }

    state.running = true;
    state.lastAttemptAt = authoritativeTimeService.nowIso();
    try {
      const result = await authoritativeTimeService.syncFromNtp({ server, port, timeoutMs });
      state.lastSuccessAt = authoritativeTimeService.nowIso();
      state.lastError = null;
      return {
        ok: true,
        reason,
        ...result
      };
    } catch (error) {
      authoritativeTimeService.markSyncError(error, {
        source: `ntp:${server}`,
        ntpServer: server,
        ntpPort: port,
        reason
      });
      state.lastError = String(error?.message || error || 'ntp-sync-failed');
      return {
        ok: false,
        reason,
        error: state.lastError
      };
    } finally {
      state.running = false;
    }
  }

  function start() {
    if (!enabled || state.timerId) {
      return;
    }

    void sync({ reason: 'startup' });
    state.timerId = setInterval(() => {
      void sync({ reason: 'interval' });
    }, intervalMs);
  }

  return { state, sync, start };
}
