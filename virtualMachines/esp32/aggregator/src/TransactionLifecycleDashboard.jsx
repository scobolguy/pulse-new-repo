import React, { useEffect, useMemo, useState } from 'react';
import { getJsonAsActor, postJsonAsActor } from './http-client.js';

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
}

function parseContextFromTransitionWhen(whenExpression) {
  const text = String(whenExpression || '').trim().toLowerCase();
  if (text.includes('status = approved')) return { status: 'approved' };
  if (text.includes('status = rejected')) return { status: 'rejected' };
  if (text.includes('statement_match = true')) return { statementMatch: true };
  return {};
}

export default function TransactionLifecycleDashboard() {
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState({ lifecycleWorkers: [], bridgeWorkers: [] });
  const [gateways, setGateways] = useState({
    swift: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } },
    boc: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [maintenanceByState, setMaintenanceByState] = useState({});
  const [gatewaySeenRunning, setGatewaySeenRunning] = useState({ swift: false, boc: false });

  async function refresh() {
    try {
      const [dashboardPayload, workersPayloadRaw, gatewaysPayloadRaw] = await Promise.all([
        getJsonAsActor('/api/lifecycle/dashboard', 'Dashboard API failed'),
        getJsonAsActor('/api/lifecycle/workers', 'Workers API failed'),
        getJsonAsActor('/api/gateways', 'Gateway API failed')
      ]);
      const workersPayload = workersPayloadRaw || { lifecycleWorkers: [], bridgeWorkers: [] };
      const gatewaysPayload = gatewaysPayloadRaw || {
        swift: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } },
        boc: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } }
      };

      setData(dashboardPayload);
      setWorkers({
        lifecycleWorkers: Array.isArray(workersPayload.lifecycleWorkers) ? workersPayload.lifecycleWorkers : [],
        bridgeWorkers: Array.isArray(workersPayload.bridgeWorkers) ? workersPayload.bridgeWorkers : []
      });
      setGateways(
        gatewaysPayload || {
          swift: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } },
          boc: { running: false, mode: 'live', queueMetrics: { currentQueueCount: 0, cumulativeProcessedCount: 0 } }
        }
      );
      setGatewaySeenRunning(prev => ({
        swift: Boolean(prev.swift || gatewaysPayload?.swift?.running),
        boc: Boolean(prev.boc || gatewaysPayload?.boc?.running)
      }));
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  async function callLifecycleApi(url, body = {}) {
    return postJsonAsActor(url, body, 'Request failed');
  }

  async function runAction(action) {
    try {
      if (action === 'run-async') {
        const gateways = await callLifecycleApi('/api/runtime/classes/gateway/actions/start', { intervalMs: 300, batchSize: 50, mode: 'test' });
        const workers = await callLifecycleApi('/api/lifecycle/workers/start-default', { intervalMs: 300, batchSize: 50 });
        const subflows = await callLifecycleApi('/api/lifecycle/subflows/workers/start-default', { intervalMs: 300, batchSize: 50 });
        setActionResult(`Async flows running: gateways=${gateways?.status || 'started'}, workers=${workers?.workersStarted || 0}, subflows=${subflows?.workersStarted || 0}`);
      } else if (action === 'start') {
        const txId = `TX-${Date.now()}`;
        const payload = await callLifecycleApi('/api/lifecycle/test/start', { txId });
        setActionResult(`Started test transaction ${payload?.active?.transactionId || txId}`);
      } else if (action === 'step-default') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', {});
        setActionResult(`Stepped by event ${payload?.transition?.event || 'auto'}`);
      } else if (action === 'step-map') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'mapped_to_pacs' });
        setActionResult(`Stepped mapped_to_pacs -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'step-submit') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'submitted_to_lynx' });
        setActionResult(`Stepped submitted_to_lynx -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'step-send-correspondent') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'sent_to_correspondent' });
        setActionResult(`Stepped sent_to_correspondent -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-boc-approve') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/bank-of-canada/approve', {});
        setActionResult(`Simulated BoC approve -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-boc-reject') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/bank-of-canada/reject', {});
        setActionResult(`Simulated BoC reject -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-mt940') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/correspondent/send-mt940', {});
        setActionResult(`Simulated correspondent MT940 -> ${payload?.active?.currentState || ''}`);
      }
      await refresh();
    } catch (e) {
      setActionResult(`Action failed: ${e.message || e}`);
    }
  }

  async function runAsyncFlows() {
    try {
      const gatewaysStart = await callLifecycleApi('/api/runtime/classes/gateway/actions/start', { intervalMs: 300, batchSize: 50, mode: 'test' });
      const workersStart = await callLifecycleApi('/api/lifecycle/workers/start-default', { intervalMs: 300, batchSize: 50 });
      const subflowsStart = await callLifecycleApi('/api/lifecycle/subflows/workers/start-default', { intervalMs: 300, batchSize: 50 });
      setActionResult(`Async flows running: gateways=${gatewaysStart?.status || 'started'}, workers=${workersStart?.workersStarted || 0}, subflows=${subflowsStart?.workersStarted || 0}`);
      await refresh();
    } catch (e) {
      setActionResult(`Run failed: ${e.message || e}`);
    }
  }

  async function stepUp(stateName) {
    const transitions = (data?.transitions || []).filter(t => t.from === stateName);
    if (transitions.length === 0) {
      setActionResult(`No runnable transitions found for ${stateName}.`);
      return;
    }

    let started = 0;
    let alreadyRunning = 0;
    let failed = 0;

    for (const transition of transitions) {
      const workerId = `manual-${sanitizeToken(stateName)}-${sanitizeToken(transition.event)}`;
      const context = parseContextFromTransitionWhen(transition.when);
      try {
        await callLifecycleApi('/api/lifecycle/workers/start', {
          workerId,
          fromState: stateName,
          eventName: transition.event,
          context,
          intervalMs: 300,
          batchSize: 25,
          consumerService: workerId,
          sourceService: workerId
        });
        started += 1;
      } catch (e) {
        if (String(e.message || '').toLowerCase().includes('already running')) {
          alreadyRunning += 1;
        } else {
          failed += 1;
        }
      }
    }

    setMaintenanceByState(prev => ({ ...prev, [stateName]: false }));
    setActionResult(`Step up ${stateName}: started=${started}, alreadyRunning=${alreadyRunning}, failed=${failed}`);
    await refresh();
  }

  async function stepDown(stateName) {
    const matchingWorkers = (workers.lifecycleWorkers || []).filter(w => w.fromState === stateName);
    if (matchingWorkers.length === 0) {
      setActionResult(`No running workers found for ${stateName}.`);
      return;
    }

    let stopped = 0;
    let failed = 0;
    for (const worker of matchingWorkers) {
      try {
        await callLifecycleApi(`/api/lifecycle/workers/${encodeURIComponent(worker.workerId)}/stop`, {});
        stopped += 1;
      } catch {
        failed += 1;
      }
    }

    setActionResult(`Step down ${stateName}: stopped=${stopped}, failed=${failed}`);
    await refresh();
  }

  async function toggleMaintenance(stateName) {
    const next = !maintenanceByState[stateName];
    if (next) {
      await stepDown(stateName);
    }
    setMaintenanceByState(prev => ({ ...prev, [stateName]: next }));
    setActionResult(next ? `Step ${stateName} set to maintenance mode.` : `Step ${stateName} maintenance mode cleared.`);
  }

  async function gatewayLogin(name) {
    try {
      const payload = await callLifecycleApi('/api/runtime/classes/gateway/actions/start', {
        [name]: { intervalMs: 300, batchSize: 50, mode: 'live' }
      });
      setActionResult(`${name.toUpperCase()} gateway login (live): ${payload?.status || 'started'}`);
      await refresh();
    } catch (e) {
      setActionResult(`${name.toUpperCase()} gateway login failed: ${e.message || e}`);
    }
  }

  async function gatewayTestMode(name) {
    try {
      if (name !== 'boc') {
        setActionResult(`${name.toUpperCase()} gateway does not support test mode.`);
        return;
      }
      const payload = await callLifecycleApi('/api/runtime/classes/gateway/actions/start', {
        [name]: { intervalMs: 300, batchSize: 50, mode: 'test' }
      });
      setActionResult(`${name.toUpperCase()} gateway login (test): ${payload?.status || 'started'}`);
      await refresh();
    } catch (e) {
      setActionResult(`${name.toUpperCase()} gateway test login failed: ${e.message || e}`);
    }
  }

  async function gatewayLogout(name) {
    try {
      const payload = await callLifecycleApi('/api/runtime/classes/gateway/actions/stop', {
        [name]: {}
      });
      setActionResult(`${name.toUpperCase()} gateway logout: ${payload?.status || 'stopped'}`);
      await refresh();
    } catch (e) {
      setActionResult(`${name.toUpperCase()} gateway logout failed: ${e.message || e}`);
    }
  }

  async function gatewayQuiesce(name) {
    try {
      const payload = await callLifecycleApi('/api/runtime/classes/gateway/actions/quiesce', {
        [name]: {}
      });
      setActionResult(`${name.toUpperCase()} gateway quiesce: ${payload?.status || 'quiesced'}`);
      await refresh();
    } catch (e) {
      setActionResult(`${name.toUpperCase()} gateway quiesce failed: ${e.message || e}`);
    }
  }

  async function runHappyTester() {
    try {
      const payload = await callLifecycleApi('/api/lifecycle/happy-path/run', {});
      setActionResult(`Happy tester completed: tx=${payload?.result?.transactionId || 'unknown'} terminal=${payload?.result?.terminalState || 'unknown'}`);
      await refresh();
    } catch (e) {
      setActionResult(`Happy tester failed: ${e.message || e}`);
    }
  }

  async function runSadTester() {
    try {
      const payload = await callLifecycleApi('/api/lifecycle/sad-path/run', {});
      setActionResult(`Sad tester completed: tx=${payload?.result?.transactionId || 'unknown'} terminal=${payload?.result?.terminalState || 'unknown'}`);
      await refresh();
    } catch (e) {
      setActionResult(`Sad tester failed: ${e.message || e}`);
    }
  }

  const stateByName = useMemo(() => {
    const map = new Map();
    for (const state of data?.states || []) {
      map.set(state.stateName, state);
    }
    return map;
  }, [data]);

  const transitionLookup = useMemo(() => {
    const map = new Map();
    for (const transition of data?.transitions || []) {
      const key = `${transition.from}__${transition.to}`;
      map.set(key, transition.event || '');
    }
    return map;
  }, [data]);

  const workersByFromState = useMemo(() => {
    const map = new Map();
    for (const worker of workers.lifecycleWorkers || []) {
      const key = String(worker.fromState || '');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(worker);
    }
    return map;
  }, [workers]);

  function getStepStatus(stateName) {
    if (maintenanceByState[stateName]) {
      return { label: 'maintenance', color: '#facc15', textColor: '#1f2937' };
    }

    const outgoing = (data?.transitions || []).filter(t => t.from === stateName);
    if (outgoing.length === 0) {
      return { label: 'uncertain', color: '#facc15', textColor: '#1f2937' };
    }

    const activeWorkers = workersByFromState.get(stateName) || [];
    if (activeWorkers.length === 0) {
      return { label: 'down', color: '#ef4444', textColor: '#ffffff' };
    }

    const requiredEvents = new Set(outgoing.map(t => String(t.event || '')));
    const activeEvents = new Set(activeWorkers.map(w => String(w.eventName || '')));
    let covered = 0;
    for (const eventName of requiredEvents) {
      if (activeEvents.has(eventName)) covered += 1;
    }

    if (covered === requiredEvents.size) {
      return { label: 'ready', color: '#22c55e', textColor: '#052e16' };
    }
    return { label: 'uncertain', color: '#facc15', textColor: '#1f2937' };
  }

  function getGatewayStatus(name) {
    const quiesced = Boolean(gateways?.[name]?.quiesced);
    if (quiesced) {
      return { label: 'quiesced', color: '#facc15', textColor: '#1f2937' };
    }

    const activeTransactionsCount = Array.isArray(data?.activeTransactions) ? data.activeTransactions.length : 0;
    if (activeTransactionsCount === 0) {
      return { label: 'clear', color: '#e2e8f0', textColor: '#475569' };
    }

    const running = Boolean(gateways?.[name]?.running);
    if (running) {
      return { label: 'up', color: '#22c55e', textColor: '#052e16' };
    }
    if (!gatewaySeenRunning[name]) {
      return { label: 'not logged in', color: '#facc15', textColor: '#1f2937' };
    }
    return { label: 'down', color: '#ef4444', textColor: '#ffffff' };
  }

  if (loading) {
    return <div style={{ padding: 12 }}>Loading transaction lifecycle dashboard...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 12, color: '#7a1f1f' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load lifecycle dashboard</div>
        <div>{error}</div>
      </div>
    );
  }

  return null;
}
