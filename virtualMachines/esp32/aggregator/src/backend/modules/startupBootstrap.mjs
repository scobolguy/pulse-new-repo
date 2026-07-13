export async function startBackendRuntime(deps = {}) {
  const {
    debugLog,
    app,
    HTTP_PORT,
    queueManagerInstances,
    registerMapperRoutes,
    registerRoutes,
    createNodeRegistry,
    RUNTIME_DATA_ROOT,
    pathJoin,
    createNodeRegistryRoutes,
    createPascalCompiler,
    pascalCompilerRoutes,
    express,
    publicRoot,
    openApiPath,
    pascalGrammarPath,
    loadWorkerConfig,
    validateRouterRuleCoverageForWorkerQueues,
    ensurePriorityInputQueuesConfigured,
    metricsCollector,
    SQL_INSTANCE_NAME,
    SQL_INSTANCE_MODE,
    SQL_SERVER_HOST,
    SQL_DATABASE,
    TX_STATE_REQUIRE_REALTIME_DB,
    getTransactionStateMssqlPool,
    FSM_MSSQL_CURRENT_TABLE,
    FSM_MSSQL_HISTORY_TABLE,
    formatErrorDetails,
    TX_STATE_EMERGENCY_LOG_SHIPPING,
    TX_STATE_LOG_SHIPPING_INTERVAL_MS,
    shipQueuedTransactionStateLogs,
    TX_STATE_LOG_SHIPPING_BATCH_SIZE,
    txStatePersistenceStats,
    BACKEND_WORKER_AUTOSTART,
    startDefaultRouterWorkers,
    startDefaultQueueDrivenLifecycleWorkers,
    startDefaultSubflowBridgeWorkers,
    startSwiftGateway,
    startBocGateway,
    gatewayModeState,
    startFedGateway,
    BACKEND_AUX_SERVICES_AUTOSTART,
    spawn,
    librarianScriptPath,
    mapperScriptPath
  } = deps;

  debugLog('[DEBUG] Starting backend server...');
  console.log('[STARTUP] Binding HTTP listener...');
  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Aggregator backend running on http://0.0.0.0:${HTTP_PORT} (LAN accessible)`);
  });

  console.log('[STARTUP] Registering queue manager sync callbacks...');
  for (const [managerId, qm] of queueManagerInstances) {
    qm.onConfigChange(async (operation) => {
      console.log(`[SYNC] Config change on ${managerId}: ${operation.type} - ${operation.queueName}`);
    });
  }

  console.log('[STARTUP] Registering API routes...');
  registerMapperRoutes(app);
  registerRoutes(app);

  console.log('[STARTUP] Initializing ESP32 Node Registry...');
  const esp32NodeRegistry = createNodeRegistry({
    persistPath: pathJoin(RUNTIME_DATA_ROOT, 'esp32-nodes.json'),
    autoSave: true,
    nodeTimeout: 600000
  });
  await esp32NodeRegistry.initialize();
  console.log(`[ESP32] Node Registry initialized with ${esp32NodeRegistry.getAllNodes().length} nodes`);

  const esp32Routes = createNodeRegistryRoutes(esp32NodeRegistry);
  app.use('/api', esp32Routes);
  console.log('[ESP32] Node Registry API routes registered at /api/nodes, /api/register');

  setInterval(async () => {
    const staleNodes = await esp32NodeRegistry.cleanupStaleNodes();
    if (staleNodes.length > 0) {
      console.log(`[ESP32] Cleaned up ${staleNodes.length} stale nodes`);
    }
  }, 300000);

  console.log('[STARTUP] Initializing Pascal Compiler Service...');
  createPascalCompiler({
    grammarPath: pascalGrammarPath,
    timeout: 30000
  });
  app.use('/api/pascal', pascalCompilerRoutes);
  console.log('[PASCAL] Compiler API routes registered at /api/pascal/*');

  app.get('/editor', (req, res) => {
    res.sendFile(pathJoin(publicRoot, 'pascal-editor.html'));
  });

  app.use('/public', express.static(publicRoot));
  console.log('[PASCAL] Editor available at /editor');

  app.get('/api/openapi.json', (req, res) => {
    res.sendFile(openApiPath);
  });
  console.log('[POWERAPP] OpenAPI specification available at /api/openapi.json');

  console.log('[STARTUP] Loading worker configuration...');
  loadWorkerConfig();

  console.log('[STARTUP] Validating router coverage...');
  try {
    const routerCoverage = validateRouterRuleCoverageForWorkerQueues();
    if (routerCoverage.ok) {
      console.log(`[PRECHECK] Router input rule coverage OK (strict=${routerCoverage.strictMode})`);
    }
  } catch (error) {
    console.warn(`[PRECHECK] Router coverage warning: ${formatErrorDetails(error)}`);
  }

  console.log('[STARTUP] Ensuring priority queue bindings...');
  const ensuredPriorityQueues = ensurePriorityInputQueuesConfigured();
  if (ensuredPriorityQueues.length > 0) {
    console.log(`[PRECHECK] Ensured ${ensuredPriorityQueues.length} priority queue binding(s) across local queue managers.`);
  }

  console.log('[STARTUP] Starting metrics collection...');
  metricsCollector.start();

  const fsmSqlSource = process.env.FSM_MSSQL_CONNECTION_STRING
    ? 'FSM_MSSQL_CONNECTION_STRING'
    : process.env.GROUP_MSSQL_CONNECTION_STRING
      ? 'GROUP_MSSQL_CONNECTION_STRING'
      : 'derived-default';
  const resolvedSqlTarget = SQL_INSTANCE_NAME ? `${SQL_SERVER_HOST}\\${SQL_INSTANCE_NAME}` : SQL_SERVER_HOST;
  console.log(`[FSM-SQL] Mode=${SQL_INSTANCE_MODE || 'sqlexpress'} source=${fsmSqlSource} target=${resolvedSqlTarget} database=${SQL_DATABASE}`);
  if (TX_STATE_REQUIRE_REALTIME_DB) {
    await getTransactionStateMssqlPool();
    console.log(`[FSM-SQL] Connected (required). Current table=${FSM_MSSQL_CURRENT_TABLE} history table=${FSM_MSSQL_HISTORY_TABLE}`);
  } else {
    getTransactionStateMssqlPool()
      .then(() => console.log(`[FSM-SQL] Connected. Current table=${FSM_MSSQL_CURRENT_TABLE} history table=${FSM_MSSQL_HISTORY_TABLE}`))
      .catch((e) => console.warn(`[FSM-SQL] Disabled: ${formatErrorDetails(e)}`));
  }

  if (TX_STATE_EMERGENCY_LOG_SHIPPING && TX_STATE_LOG_SHIPPING_INTERVAL_MS > 0) {
    const shipTimer = setInterval(() => {
      shipQueuedTransactionStateLogs({ maxEntries: TX_STATE_LOG_SHIPPING_BATCH_SIZE })
        .catch((e) => {
          txStatePersistenceStats.shippingFailures += 1;
          txStatePersistenceStats.lastShipFailureAt = new Date().toISOString();
          txStatePersistenceStats.lastShipError = formatErrorDetails(e);
          console.warn(`[TX-STATE] Log shipping cycle failed: ${formatErrorDetails(e)}`);
        });
    }, TX_STATE_LOG_SHIPPING_INTERVAL_MS);
    if (typeof shipTimer.unref === 'function') shipTimer.unref();
    console.warn(`[TX-STATE] Emergency log shipping is ENABLED (interval=${TX_STATE_LOG_SHIPPING_INTERVAL_MS}ms).`);
  } else {
    console.log('[TX-STATE] Emergency log shipping is disabled. Realtime DB writes are expected.');
  }

  if (BACKEND_WORKER_AUTOSTART) {
    try {
      const routerWorkerResults = startDefaultRouterWorkers();
      console.log(`[AUTOSTART] Router workers started: ${routerWorkerResults.length} (6 instances per queue x 4 priority queues)`);
      routerWorkerResults.slice(0, 3).forEach(w => {
        console.log(`  - ${w.workerId}: interval=${w.intervalMs}ms, batch=${w.batchSize}`);
      });
      if (routerWorkerResults.length > 3) {
        console.log(`  - ... and ${routerWorkerResults.length - 3} more`);
      }
    } catch (e) {
      console.warn(`[AUTOSTART] Router workers failed: ${e.message}`);
    }

    try {
      const lifecycleWorkerResults = startDefaultQueueDrivenLifecycleWorkers({ intervalMs: 250, batchSize: 50 });
      console.log(`[AUTOSTART] Lifecycle workers started: ${lifecycleWorkerResults.length}`);
    } catch (e) {
      console.warn(`[AUTOSTART] Lifecycle workers failed: ${e.message}`);
    }

    try {
      const subflowWorkerResults = startDefaultSubflowBridgeWorkers({ intervalMs: 500, batchSize: 25 });
      console.log(`[AUTOSTART] Subflow workers started: ${subflowWorkerResults.length}`);
    } catch (e) {
      console.warn(`[AUTOSTART] Subflow workers failed: ${e.message}`);
    }

    try {
      startSwiftGateway({ intervalMs: 500, batchSize: 25 });
      console.log('[AUTOSTART] SWIFT gateway started');
    } catch (e) {
      console.warn(`[AUTOSTART] SWIFT gateway failed: ${e.message}`);
    }

    try {
      startBocGateway({ intervalMs: 500, batchSize: 25, mode: gatewayModeState.boc });
      console.log(`[AUTOSTART] BoC gateway started (mode=${gatewayModeState.boc})`);
    } catch (e) {
      console.warn(`[AUTOSTART] BoC gateway failed: ${e.message}`);
    }

    try {
      startFedGateway({ intervalMs: 500, batchSize: 25 });
      console.log(`[AUTOSTART] Fed gateway started (mode=${gatewayModeState.fed})`);
    } catch (e) {
      console.warn(`[AUTOSTART] Fed gateway failed: ${e.message}`);
    }
  } else {
    console.log('[AUTOSTART] Worker and gateway autostart is disabled (BACKEND_WORKER_AUTOSTART=false).');
  }

  if (BACKEND_AUX_SERVICES_AUTOSTART) {
    const librarianPath = librarianScriptPath;
    const librarian = spawn(process.execPath, [librarianPath], {
      stdio: 'inherit',
      env: { ...process.env },
    });
    librarian.on('error', err => console.error('[Librarian] Failed to start:', err.message));
    librarian.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        console.warn(`[Librarian] Exited with code=${code} signal=${signal}`);
      }
    });

    const mapperPath = mapperScriptPath;
    const mapper = spawn(process.execPath, [mapperPath], {
      stdio: 'inherit',
      env: { ...process.env },
    });
    mapper.on('error', err => console.error('[Mapper] Failed to start:', err.message));
    mapper.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        console.warn(`[Mapper] Exited with code=${code} signal=${signal}`);
      }
    });

    process.on('exit', () => {
      librarian.kill();
      mapper.kill();
    });
    process.on('SIGINT', () => {
      librarian.kill();
      mapper.kill();
      process.exit();
    });
    process.on('SIGTERM', () => {
      librarian.kill();
      mapper.kill();
      process.exit();
    });
  } else {
    console.log('[AUTOSTART] Auxiliary child services are disabled (BACKEND_AUX_SERVICES_AUTOSTART=false).');
  }
}
