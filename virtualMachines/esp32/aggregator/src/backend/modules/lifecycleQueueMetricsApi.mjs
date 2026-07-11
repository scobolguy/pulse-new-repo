export function createLifecycleQueueMetricsApi(deps = {}) {
  const {
    queueRoutes,
    queueManagerRegistry,
    queueManagers,
    lifecycleStateCumulativeCounts,
    readTransactionLifecycleCompiled,
    dlqEvents,
    lifecycleHarness,
    getLifecycleHeartbeatPayload,
    lifecycleTesterStats
  } = deps;

  function getQueueLengthForLifecycleState(queueName) {
    const q = String(queueName || '').trim();
    if (!q) return 0;

    const routed = queueRoutes.get(q);
    if (routed) {
      const manager = queueManagerRegistry.get(routed.managerId);
      if (manager?.local) {
        return queueManagers[manager.localIndex].getQueueLength(q);
      }
    }

    let maxObserved = 0;
    for (const qm of queueManagers) {
      maxObserved = Math.max(maxObserved, qm.getQueueLength(q));
    }
    return maxObserved;
  }

  function incrementLifecycleStateCumulativeCount(stateName, amount = 1) {
    const key = String(stateName || '').trim();
    if (!key) return;
    const next = Number(lifecycleStateCumulativeCounts.get(key) || 0) + Number(amount || 0);
    lifecycleStateCumulativeCounts.set(key, next < 0 ? 0 : next);
  }

  function getLifecycleStateCumulativeCount(stateName) {
    const key = String(stateName || '').trim();
    if (!key) return 0;
    return Number(lifecycleStateCumulativeCounts.get(key) || 0);
  }

  function getLifecycleStateByName(compiled, stateName) {
    const states = Array.isArray(compiled?.states) ? compiled.states : [];
    return states.find(s => s.name === stateName) || null;
  }

  function getLifecycleStateByQueueName(compiled, queueName) {
    const states = Array.isArray(compiled?.states) ? compiled.states : [];
    const target = String(queueName || '').trim().toLowerCase();
    if (!target) return null;
    return states.find(s => String(s?.queueName || '').trim().toLowerCase() === target) || null;
  }

  function getLifecycleOutgoingTransitions(compiled, fromState) {
    const transitions = Array.isArray(compiled?.transitions) ? compiled.transitions : [];
    return transitions.filter(t => t.from === fromState);
  }

  function incrementLifecycleCumulativeByQueue(queueName, amount = 1) {
    const q = String(queueName || '').trim();
    if (!q) return;

    const compiled = readTransactionLifecycleCompiled();
    const states = Array.isArray(compiled?.states) ? compiled.states : [];
    for (const state of states) {
      if (String(state?.queueName || '').trim() === q) {
        incrementLifecycleStateCumulativeCount(state.name, amount);
      }
    }
  }

  function getGatewayQueueMetrics(workers, compiled) {
    const queueNames = new Set();
    let cumulativeProcessedCount = 0;

    for (const worker of workers || []) {
      cumulativeProcessedCount += Number(worker?.processedMessages || 0);

      const fromState = String(worker?.fromState || '').trim();
      if (fromState) {
        const state = getLifecycleStateByName(compiled, fromState);
        const queueName = String(state?.queueName || '').trim();
        if (queueName) queueNames.add(queueName);
      }

      const inputQueue = String(worker?.inputQueue || '').trim();
      if (inputQueue) {
        queueNames.add(inputQueue);
      }
    }

    const queues = Array.from(queueNames).map(queueName => ({
      queueName,
      currentCount: getQueueLengthForLifecycleState(queueName)
    }));
    const currentQueueCount = queues.reduce((sum, q) => sum + Number(q.currentCount || 0), 0);

    return {
      currentQueueCount,
      cumulativeProcessedCount,
      queues
    };
  }

  function getLifecycleQueueTransformErrorSummary(queueName, { limit = 500 } = {}) {
    const key = String(queueName || '').trim();
    if (!key) {
      return {
        count: 0,
        latestReason: null,
        latestAt: null
      };
    }

    const items = dlqEvents
      .slice(-Math.max(1, Number(limit) || 500))
      .filter(item => String(item?.sourceQueue || '').trim() === key || String(item?.targetQueue || '').trim() === key);

    const latest = items.length > 0 ? items[items.length - 1] : null;
    return {
      count: items.length,
      latestReason: latest?.errorReason || null,
      latestAt: latest?.timestamp || null
    };
  }

  function getLifecycleTesterStatsPayload() {
    return {
      happy: { ...lifecycleTesterStats.happy },
      sad: { ...lifecycleTesterStats.sad }
    };
  }

  function buildTransactionLifecycleDashboardPayload(compiled) {
    if (!compiled || !Array.isArray(compiled.states)) {
      return null;
    }

    const states = compiled.states.map(state => {
      const queueName = state.queueName || null;
      const queueLength = queueName ? getQueueLengthForLifecycleState(queueName) : 0;
      return {
        stateName: state.name,
        label: state.label || state.name,
        queueName,
        subflow: state.subflow || null,
        layer: Number(state.layer || 0),
        isInitial: Boolean(state.initial),
        queueLength,
        cumulativeCount: getLifecycleStateCumulativeCount(state.name),
        transformErrors: getLifecycleQueueTransformErrorSummary(queueName)
      };
    });

    const totalsByLayer = {};
    for (const state of states) {
      totalsByLayer[state.layer] = (totalsByLayer[state.layer] || 0) + state.queueLength;
    }

    return {
      version: compiled.version || 1,
      transactionId: compiled.transactionId || null,
      description: compiled.description || '',
      initialState: compiled.initialState || null,
      topology: compiled.topology || { order: [], layers: [] },
      transitions: Array.isArray(compiled.transitions) ? compiled.transitions : [],
      harness: {
        active: lifecycleHarness.active,
        historyTail: lifecycleHarness.history.slice(-20)
      },
      heartbeat: getLifecycleHeartbeatPayload(),
      testers: getLifecycleTesterStatsPayload(),
      states,
      totalsByLayer,
      totalMessagesAcrossStates: states.reduce((sum, state) => sum + state.queueLength, 0),
      generatedAt: new Date().toISOString()
    };
  }

  function recordLifecycleTesterRun(testerType, { status = 'completed', transitionCount = 0, transactionId = null, error = null } = {}) {
    const key = testerType === 'sad' ? 'sad' : 'happy';
    const stats = lifecycleTesterStats[key];
    stats.runs += 1;
    stats.lastRunAt = new Date().toISOString();
    stats.lastStatus = status;
    stats.lastTransactionId = transactionId || null;
    stats.lastError = error || null;

    if (status === 'completed') {
      stats.completed += 1;
      stats.totalTransitions += Number(transitionCount || 0);
    } else {
      stats.failed += 1;
    }
  }

  return {
    getQueueLengthForLifecycleState,
    incrementLifecycleStateCumulativeCount,
    getLifecycleStateCumulativeCount,
    incrementLifecycleCumulativeByQueue,
    getGatewayQueueMetrics,
    getLifecycleQueueTransformErrorSummary,
    buildTransactionLifecycleDashboardPayload,
    getLifecycleTesterStatsPayload,
    recordLifecycleTesterRun,
    getLifecycleStateByName,
    getLifecycleStateByQueueName,
    getLifecycleOutgoingTransitions
  };
}
