export async function startCompanionServiceSupervisor(options) {
  const {
    name,
    scriptPath,
    healthUrl,
    spawn,
    checkIntervalMs = 5000,
    restartDelayMs = 2000,
    healthTimeoutMs = 2000,
    unhealthyCheckLimit = 3,
    startupGraceMs = 15000,
    env = process.env,
    stdio = 'inherit',
    logger = console,
  } = options;

  let childProcess = null;
  let checkTimer = null;
  let stopping = false;
  let unhealthyChecks = 0;
  let childStartedAt = 0;

  const isHealthy = async () => {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(healthTimeoutMs) });
      return response.ok;
    } catch {
      return false;
    }
  };

  const scheduleCheck = (delayMs = checkIntervalMs) => {
    if (stopping || checkTimer) return;
    checkTimer = setTimeout(() => {
      checkTimer = null;
      ensureRunning().catch(error => logger.error(`[${name}] Supervisor check failed:`, error.message));
    }, delayMs);
    if (typeof checkTimer.unref === 'function') checkTimer.unref();
  };

  const startChild = () => {
    logger.log(`[${name}] Starting companion service (${scriptPath})`);
    unhealthyChecks = 0;
    childStartedAt = Date.now();
    childProcess = spawn(process.execPath, [scriptPath], {
      stdio,
      env: { ...env },
    });
    childProcess.on('error', error => logger.error(`[${name}] Failed to start:`, error.message));
    childProcess.on('exit', (code, signal) => {
      childProcess = null;
      if (stopping) return;
      logger.warn(`[${name}] Exited with code=${code} signal=${signal}; restart scheduled`);
      scheduleCheck(restartDelayMs);
    });
  };

  const ensureRunning = async () => {
    if (stopping) return;
    if (await isHealthy()) {
      unhealthyChecks = 0;
      scheduleCheck();
      return;
    }

    if (childProcess && childProcess.exitCode === null) {
      if (Date.now() - childStartedAt < startupGraceMs) {
        scheduleCheck();
        return;
      }
      unhealthyChecks += 1;
      if (unhealthyChecks >= unhealthyCheckLimit) {
        logger.warn(`[${name}] Health check failed ${unhealthyChecks} times; restarting companion service`);
        childProcess.kill();
      } else {
        scheduleCheck();
      }
      return;
    }

    startChild();
    scheduleCheck();
  };

  const stop = () => {
    stopping = true;
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = null;
    if (childProcess && childProcess.exitCode === null) childProcess.kill();
  };

  await ensureRunning();
  return {
    stop,
    check: ensureRunning,
    isHealthy,
    getChildPid: () => childProcess?.pid || null,
  };
}