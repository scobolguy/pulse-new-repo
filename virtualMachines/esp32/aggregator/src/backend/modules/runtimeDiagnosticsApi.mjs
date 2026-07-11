export function createRuntimeDiagnosticsApi(deps = {}) {
  const {
    os,
    v8,
    performance,
    monitorEventLoopDelay,
    execFileSync,
    processRef = process,
    queueManagerInstances,
    queueManagerRegistry,
    serviceInstanceRegistry,
    queueRoutes,
    getQueueManagers,
    normalizeNodeId,
    BROKER_SERVICE,
    SQL_INSTANCE_NAME,
    SQL_SERVER_HOST
  } = deps;

  const nodeRuntimeStartedAt = Date.now();
  const eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
  eventLoopDelayHistogram.enable();
  let lastCpuUsageSample = processRef.cpuUsage();
  let lastCpuSampleHrtimeNs = processRef.hrtime.bigint();

  const systemPerformanceCache = {
    sampledAt: 0,
    value: null
  };

  function bytesToMb(value) {
    return Number.isFinite(value) ? Number((value / (1024 * 1024)).toFixed(2)) : 0;
  }

  function toMsFromNs(value) {
    return Number.isFinite(value) ? Number((value / 1e6).toFixed(3)) : 0;
  }

  function getNodeRuntimeDiagnosticsSnapshot() {
    const mem = processRef.memoryUsage();
    const heap = v8.getHeapStatistics();
    const elu = performance.eventLoopUtilization();
    const handles = typeof processRef._getActiveHandles === 'function' ? processRef._getActiveHandles().length : null;
    const requests = typeof processRef._getActiveRequests === 'function' ? processRef._getActiveRequests().length : null;
    const nowHrtimeNs = processRef.hrtime.bigint();
    const cpuDiff = processRef.cpuUsage(lastCpuUsageSample);
    const elapsedSampleMs = Number(nowHrtimeNs - lastCpuSampleHrtimeNs) / 1e6;
    lastCpuUsageSample = processRef.cpuUsage();
    lastCpuSampleHrtimeNs = nowHrtimeNs;
    const cpuTotalMs = (cpuDiff.user + cpuDiff.system) / 1000;
    const cpuPercentSingleCore = elapsedSampleMs > 0 ? Number(((cpuTotalMs / elapsedSampleMs) * 100).toFixed(2)) : 0;
    const cpuCount = Math.max(1, os.cpus().length || 1);
    const cpuPercentAllCores = Number((cpuPercentSingleCore / cpuCount).toFixed(2));

    return {
      timestamp: Date.now(),
      uptimeSeconds: Math.round(processRef.uptime()),
      process: {
        pid: processRef.pid,
        platform: processRef.platform,
        nodeVersion: processRef.version,
        rssMb: bytesToMb(mem.rss),
        heapUsedMb: bytesToMb(mem.heapUsed),
        heapTotalMb: bytesToMb(mem.heapTotal),
        externalMb: bytesToMb(mem.external),
        arrayBuffersMb: bytesToMb(mem.arrayBuffers),
        heapUsedPercent: mem.heapTotal > 0 ? Number(((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)) : 0,
        activeHandles: handles,
        activeRequests: requests
      },
      v8: {
        heapLimitMb: bytesToMb(heap.heap_size_limit),
        mallocedMb: bytesToMb(heap.malloced_memory),
        peakMallocedMb: bytesToMb(heap.peak_malloced_memory),
        nativeContexts: Number(heap.number_of_native_contexts || 0),
        detachedContexts: Number(heap.number_of_detached_contexts || 0)
      },
      eventLoop: {
        utilization: Number((elu.utilization || 0).toFixed(4)),
        activeMs: Number((elu.active || 0).toFixed(3)),
        idleMs: Number((elu.idle || 0).toFixed(3)),
        delayMeanMs: toMsFromNs(eventLoopDelayHistogram.mean),
        delayStddevMs: toMsFromNs(eventLoopDelayHistogram.stddev),
        delayP95Ms: toMsFromNs(eventLoopDelayHistogram.percentile(95)),
        delayP99Ms: toMsFromNs(eventLoopDelayHistogram.percentile(99)),
        delayMaxMs: toMsFromNs(eventLoopDelayHistogram.max)
      },
      cpu: {
        sampleWindowMs: Number(elapsedSampleMs.toFixed(3)),
        usagePercentSingleCore: cpuPercentSingleCore,
        usagePercentAllCores: cpuPercentAllCores,
        cpuCount,
        loadAvg1m: Number((os.loadavg()[0] || 0).toFixed(3)),
        loadAvg5m: Number((os.loadavg()[1] || 0).toFixed(3)),
        loadAvg15m: Number((os.loadavg()[2] || 0).toFixed(3))
      },
      sinceStart: {
        startedAt: nodeRuntimeStartedAt,
        elapsedSeconds: Math.round((Date.now() - nodeRuntimeStartedAt) / 1000)
      }
    };
  }

  function setNodeLifecycleState(nodeId, state) {
    const normalized = normalizeNodeId(nodeId);
    if (!normalized) return false;
    let changed = false;

    for (const [managerId, manager] of queueManagerRegistry.entries()) {
      if (normalizeNodeId(manager.nodeId || manager.ip) === normalized) {
        manager.status = state;
        manager.updatedAt = new Date().toISOString();
        queueManagerRegistry.set(managerId, manager);
        changed = true;
      }
    }

    for (const [instanceId, instance] of serviceInstanceRegistry.entries()) {
      if (normalizeNodeId(instance.nodeId || instance.ip) === normalized) {
        instance.status = state;
        instance.updatedAt = new Date().toISOString();
        serviceInstanceRegistry.set(instanceId, instance);
        changed = true;
      }
    }

    return changed;
  }

  function getNodeQueueManagers(nodeId) {
    const normalized = normalizeNodeId(nodeId);
    return Array.from(queueManagerRegistry.values()).filter((manager) => normalizeNodeId(manager.nodeId || manager.ip) === normalized);
  }

  function getNodeDrainStatus(nodeId) {
    const managers = getNodeQueueManagers(nodeId);
    const managerIds = new Set(managers.map((manager) => manager.managerId));
    const queueAssignments = [];

    let pendingMessagesKnown = 0;
    let unknownQueueDepthCount = 0;

    for (const route of queueRoutes.values()) {
      if (!managerIds.has(route.managerId)) continue;
      const manager = queueManagerRegistry.get(route.managerId);
      let queueLength = null;
      if (manager?.local) {
        const localManagers = typeof getQueueManagers === 'function' ? getQueueManagers() : [];
        const localManager = Array.isArray(localManagers) ? localManagers[manager.localIndex] : null;
        queueLength = localManager ? localManager.getQueueLength(route.queueName) : null;
        if (Number.isFinite(queueLength)) {
          pendingMessagesKnown += queueLength;
        } else {
          unknownQueueDepthCount += 1;
        }
      } else {
        unknownQueueDepthCount += 1;
      }

      queueAssignments.push({
        queueName: route.queueName,
        managerId: route.managerId,
        queueLength
      });
    }

    const drainReady = pendingMessagesKnown === 0 && unknownQueueDepthCount === 0;
    return {
      nodeId,
      managerCount: managers.length,
      managers,
      queueAssignments,
      pendingMessagesKnown,
      unknownQueueDepthCount,
      drainReady
    };
  }

  function getBrokerNodeDetails() {
    return { status: 'ok', service: BROKER_SERVICE };
  }

  function getWindowsPerformanceSnapshot() {
    if (processRef.platform !== 'win32') {
      return null;
    }

    try {
      const script = `
      $process = Get-Process -Id $PID | Select-Object Id,ProcessName,CPU,WorkingSet64,Handles,StartTime
      $os = Get-CimInstance Win32_OperatingSystem | Select-Object CSName,Caption,Version,FreePhysicalMemory,TotalVisibleMemorySize,LastBootUpTime
      $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace,VolumeName
      [ordered]@{
        process = $process
        os = $os
        disks = $disks
      } | ConvertTo-Json -Depth 4 -Compress
    `;

      const raw = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        encoding: 'utf8',
        timeout: 2500,
        windowsHide: true
      });

      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return { error: e.message };
    }
  }

  function getSystemPerformanceSnapshot() {
    const now = Date.now();
    if (systemPerformanceCache.value && now - systemPerformanceCache.sampledAt < 5000) {
      return systemPerformanceCache.value;
    }

    const cpuSamples = os.cpus();
    const cpuModel = cpuSamples[0] ? cpuSamples[0].model : null;
    const cpuSpeedMHz = cpuSamples[0] ? cpuSamples[0].speed : null;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsed = Math.max(totalMemory - freeMemory, 0);
    const queueManagersSummary = Array.from(queueManagerInstances.entries()).map(([managerId, queueManager]) => ({
      managerId,
      queueCount: Object.keys(queueManager.queueConfig || {}).length,
      totalQueuedMessages: Object.keys(queueManager.queueConfig || {}).reduce((sum, queueName) => sum + queueManager.getQueueLength(queueName), 0),
      configVersion: Number(queueManager.configVersion || 0)
    }));

    const value = {
      sampledAt: new Date(now).toISOString(),
      platform: processRef.platform,
      arch: processRef.arch,
      node: {
        version: processRef.version,
        pid: processRef.pid,
        uptimeSeconds: Number(processRef.uptime().toFixed(3)),
        cpuUsage: processRef.cpuUsage(),
        memoryUsage: processRef.memoryUsage()
      },
      os: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release(),
        uptimeSeconds: Number(os.uptime().toFixed(3)),
        loadAverage: typeof os.loadavg === 'function' ? os.loadavg() : [],
        totalMemory,
        freeMemory,
        memoryUsed,
        memoryUsedPercent: totalMemory > 0 ? Number(((memoryUsed / totalMemory) * 100).toFixed(2)) : 0,
        cpuCount: cpuSamples.length,
        cpuModel,
        cpuSpeedMHz
      },
      queueManagers: queueManagersSummary,
      windows: getWindowsPerformanceSnapshot(),
      database: {
        host: SQL_SERVER_HOST,
        instanceName: SQL_INSTANCE_NAME || 'MSSQLSERVER'
      }
    };

    systemPerformanceCache.sampledAt = now;
    systemPerformanceCache.value = value;
    return value;
  }

  return {
    getNodeRuntimeDiagnosticsSnapshot,
    setNodeLifecycleState,
    getNodeDrainStatus,
    getBrokerNodeDetails,
    getSystemPerformanceSnapshot
  };
}
