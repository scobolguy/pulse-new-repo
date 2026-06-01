import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJsonAsActor } from './http-client.js';

function normalizeGatewayStatus(gateway, seenRunning) {
  const running = Boolean(gateway?.running);
  const quiesced = Boolean(gateway?.quiesced);
  if (quiesced) return 'quiesced';
  if (running) return 'up';
  if (!seenRunning) return 'not logged in';
  return 'down';
}

export default function TransactionLifecycleDashboard() {
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState({ lifecycleWorkers: [], bridgeWorkers: [] });
  const [gateways, setGateways] = useState({
    swift: { running: false, quiesced: false },
    boc: { running: false, quiesced: false }
  });
  const [gatewaySeenRunning, setGatewaySeenRunning] = useState({ swift: false, boc: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [dashboardPayload, workersPayloadRaw, gatewaysPayloadRaw] = await Promise.all([
        getJsonAsActor('/api/lifecycle/dashboard', 'Dashboard API failed'),
        getJsonAsActor('/api/lifecycle/workers', 'Workers API failed'),
        getJsonAsActor('/api/gateways', 'Gateway API failed')
      ]);

      const workersPayload = workersPayloadRaw || { lifecycleWorkers: [], bridgeWorkers: [] };
      const gatewaysPayload = gatewaysPayloadRaw || {
        swift: { running: false, quiesced: false },
        boc: { running: false, quiesced: false }
      };

      setData(dashboardPayload);
      setWorkers({
        lifecycleWorkers: Array.isArray(workersPayload.lifecycleWorkers) ? workersPayload.lifecycleWorkers : [],
        bridgeWorkers: Array.isArray(workersPayload.bridgeWorkers) ? workersPayload.bridgeWorkers : []
      });
      setGateways(gatewaysPayload);
      setGatewaySeenRunning((prev) => ({
        swift: Boolean(prev.swift || gatewaysPayload?.swift?.running),
        boc: Boolean(prev.boc || gatewaysPayload?.boc?.running)
      }));
      setError('');
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const run = async () => {
      if (cancelled) return;
      await refresh();
      if (!cancelled) {
        timerId = setTimeout(run, 60000);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [refresh]);

  const summary = useMemo(() => {
    const stateCount = Array.isArray(data?.states) ? data.states.length : 0;
    const transitionCount = Array.isArray(data?.transitions) ? data.transitions.length : 0;
    const activeTxCount = Array.isArray(data?.activeTransactions) ? data.activeTransactions.length : 0;
    const lifecycleWorkerCount = Array.isArray(workers.lifecycleWorkers) ? workers.lifecycleWorkers.length : 0;
    const bridgeWorkerCount = Array.isArray(workers.bridgeWorkers) ? workers.bridgeWorkers.length : 0;

    return {
      stateCount,
      transitionCount,
      activeTxCount,
      lifecycleWorkerCount,
      bridgeWorkerCount,
      swiftStatus: normalizeGatewayStatus(gateways?.swift, gatewaySeenRunning.swift),
      bocStatus: normalizeGatewayStatus(gateways?.boc, gatewaySeenRunning.boc)
    };
  }, [data, workers, gateways, gatewaySeenRunning]);

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

  return (
    <div style={{ padding: 12, display: 'grid', gap: 10 }}>
      <h2 style={{ margin: 0 }}>Transaction Lifecycle Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>States</strong>
          <div>{summary.stateCount}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>Transitions</strong>
          <div>{summary.transitionCount}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>Active Transactions</strong>
          <div>{summary.activeTxCount}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>Lifecycle Workers</strong>
          <div>{summary.lifecycleWorkerCount}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>Bridge Workers</strong>
          <div>{summary.bridgeWorkerCount}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>SWIFT Gateway</strong>
          <div>{summary.swiftStatus}</div>
        </div>
        <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
          <strong>BoC Gateway</strong>
          <div>{summary.bocStatus}</div>
        </div>
      </div>
      <div>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </div>
    </div>
  );
}
