import React, { useEffect, useMemo, useRef, useState } from 'react';
import { actorHeaders, getJsonAsActor, postJsonAsActor, putJson } from './http-client.js';

const TEST_TPS = 30;
const TEST_DURATION_SECONDS = 30;
const ACTIVITY_DECAY_MS = 5000;

function buildHappyPathMT103(sequence) {
  const referenceId = `TST${Date.now()}${String(sequence).padStart(6, '0')}`;
  const transDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const amount = (1000 + (sequence % 9000)).toFixed(2);

  return `MT103
:20:${referenceId}
:23B:CRED
:32A:${transDate}USD${amount}
:50K:/ACCT${String(sequence % 10000).padStart(4, '0')}
TEST SENDER ${sequence % 100}
:52A:BANK01USNY
:53A:BANK02GBLO
:57A:INTBANK
:59:/ACCT${String((sequence + 500) % 10000).padStart(4, '0')}
TEST BENEFICIARY ${sequence % 100}
:70:HAPPY PATH TEST ${sequence}
:71A:SHA
:72:TEST MODE`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'up' || status === 'degraded') return 'online';
  if (status === 'quiesced' || status === 'draining' || status === 'maintenance') return 'paused';
  return 'offline';
}

function toStatusClass(status) {
  if (status === 'online') return 'is-online';
  if (status === 'paused') return 'is-paused';
  return 'is-offline';
}

function getStatusLabel(status) {
  if (status === 'online') return 'Online';
  if (status === 'paused') return 'Paused';
  return 'Offline';
}

export default function ServerMonitorBoard() {
  const [databaseServers, setDatabaseServers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [brokerState, setBrokerState] = useState({ state: 'unknown', classStatus: 'unknown', brokers: {} });
  const [error, setError] = useState('');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [feedModeLabel, setFeedModeLabel] = useState('SSE connecting; polling fallback every 250ms');
  const [controlStatus, setControlStatus] = useState('');
  const testCancelledRef = useRef(false);
  const [trafficPulseTick, setTrafficPulseTick] = useState(0);
  const lastTrafficAtRef = useRef(0);
  const lastGatewayProcessedRef = useRef(null);

  function applyGatewayProcessedDelta(gatewayPayload) {
    const processedTotal = ['swift', 'boc', 'fed']
      .map((name) => Number(gatewayPayload?.[name]?.queueMetrics?.cumulativeProcessedCount || 0))
      .reduce((sum, value) => sum + value, 0);

    if (lastGatewayProcessedRef.current == null) {
      lastGatewayProcessedRef.current = processedTotal;
      return;
    }

    if (processedTotal > lastGatewayProcessedRef.current) {
      lastGatewayProcessedRef.current = processedTotal;
      lastTrafficAtRef.current = Date.now();
      setTrafficPulseTick(Date.now());
    }
  }

  async function refresh() {
    try {
      const [databaseResult, managerResult, queueResult, brokerResult, gatewayResult] = await Promise.allSettled([
        getJsonAsActor('/api/registry/databases', 'Database registry API failed'),
        getJsonAsActor('/api/registry/queue-managers', 'Queue manager API failed'),
        getJsonAsActor('/api/registry/queues', 'Queue registry API failed'),
        getJsonAsActor('/api/broker/state', 'Broker API failed'),
        getJsonAsActor('/api/gateways', 'Gateway API failed')
      ]);

      const errors = [];

      if (databaseResult.status === 'fulfilled') {
        const databasePayload = databaseResult.value || {};
        setDatabaseServers(Array.isArray(databasePayload.databases) ? databasePayload.databases : []);
      } else {
        errors.push(String(databaseResult.reason?.message || databaseResult.reason || 'Database registry API failed'));
      }

      if (managerResult.status === 'fulfilled') {
        const managerPayload = managerResult.value || {};
        setManagers(Array.isArray(managerPayload.queueManagers) ? managerPayload.queueManagers : []);
      } else {
        errors.push(String(managerResult.reason?.message || managerResult.reason || 'Queue manager API failed'));
      }

      if (queueResult.status === 'fulfilled') {
        const queuePayload = queueResult.value || {};
        setQueues(Array.isArray(queuePayload.queues) ? queuePayload.queues : []);
      } else {
        errors.push(String(queueResult.reason?.message || queueResult.reason || 'Queue registry API failed'));
      }

      if (brokerResult.status === 'fulfilled') {
        const brokerPayload = brokerResult.value || {};
        setBrokerState({
          state: String(brokerPayload.state || 'unknown'),
          classStatus: String(brokerPayload.classStatus || 'unknown'),
          brokers: brokerPayload.brokers && typeof brokerPayload.brokers === 'object' ? brokerPayload.brokers : {}
        });
      } else {
        errors.push(String(brokerResult.reason?.message || brokerResult.reason || 'Broker API failed'));
      }

      if (gatewayResult.status === 'fulfilled') {
        const gatewayPayload = gatewayResult.value || {};
        applyGatewayProcessedDelta(gatewayPayload);
        if (Date.now() - lastTrafficAtRef.current < ACTIVITY_DECAY_MS) {
          setTrafficPulseTick(Date.now());
        }
      } else {
        errors.push(String(gatewayResult.reason?.message || gatewayResult.reason || 'Gateway API failed'));
      }

      setError(errors.join(' | '));
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const actorUserId = localStorage.getItem('pulse.actorUserId') || 'system-admin';
    const source = new EventSource(`/api/gateways/stream?userId=${encodeURIComponent(actorUserId)}`);

    source.onopen = () => {
      setFeedModeLabel('SSE live; polling fallback every 250ms');
    };

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data || '{}'));
        applyGatewayProcessedDelta(payload?.gateways || {});
      } catch {
        // Ignore malformed stream event payloads.
      }
    };

    source.onerror = () => {
      setFeedModeLabel('SSE disconnected; polling fallback every 250ms');
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      testCancelledRef.current = true;
    };
  }, []);

  async function runHappyPathLoadTest() {
    if (isTestRunning) return;

    setIsTestRunning(true);
    setTestStatus(`Running test at ${TEST_TPS} tx/s for ${TEST_DURATION_SECONDS}s...`);
    testCancelledRef.current = false;

    let sequence = 0;

    try {
      for (let second = 1; second <= TEST_DURATION_SECONDS; second += 1) {
        if (testCancelledRef.current) break;

        const startedAt = Date.now();
        const batch = Array.from({ length: TEST_TPS }, () => {
          sequence += 1;
          return fetch('/api/queue/swift.mt103.inbound/enqueue', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              message: buildHappyPathMT103(sequence),
              sourceService: 'server-monitor-test-mode'
            })
          });
        });

        await Promise.all(batch);
        setTestStatus(`Test running... ${second}/${TEST_DURATION_SECONDS}s (${sequence} sent)`);

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 1000 - elapsed);
        if (remaining > 0) {
          await sleep(remaining);
        }
      }

      setTestStatus(`Test complete: sent ${sequence} happy-path MT103 messages.`);
    } catch (e) {
      setTestStatus(`Test failed: ${String(e.message || e)}`);
    } finally {
      setIsTestRunning(false);
    }
  }

  async function runClassAction(classId, action) {
    try {
      setControlStatus(`Applying ${action} on ${classId}...`);
      await postJsonAsActor(`/api/runtime/classes/${encodeURIComponent(classId)}/actions/${encodeURIComponent(action)}`, {}, `${classId} action failed`);
      setControlStatus(`Applied ${action} on ${classId}.`);
      await refresh();
    } catch (e) {
      setControlStatus(String(e.message || e));
    }
  }

  async function configureInstance(instanceId) {
    try {
      const configPayload = await getJsonAsActor(`/api/runtime/instances/${encodeURIComponent(instanceId)}/config`, `Failed to load config for ${instanceId}`);

      const draft = window.prompt(
        `Update configuration JSON for ${instanceId}`,
        JSON.stringify(configPayload.config || {}, null, 2)
      );
      if (draft == null) return;

      let parsed;
      try {
        parsed = JSON.parse(draft);
      } catch {
        throw new Error('Configuration must be valid JSON.');
      }

      await putJson(`/api/runtime/instances/${encodeURIComponent(instanceId)}/config`,
        { provider: configPayload.provider, config: parsed },
        `Failed to save config for ${instanceId}`,
        { headers: actorHeaders() }
      );

      setControlStatus(`Saved config for ${instanceId}.`);
      await refresh();
    } catch (e) {
      setControlStatus(String(e.message || e));
    }
  }

  const queueCountByManager = useMemo(() => {
    const bucket = {};
    for (const item of queues) {
      const managerId = String(item?.managerId || '');
      if (!managerId) continue;
      bucket[managerId] = (bucket[managerId] || 0) + 1;
    }
    return bucket;
  }, [queues]);

  const queueManagerCards = useMemo(
    () => managers
      .map((manager) => {
        const managerId = String(manager?.managerId || 'unknown-server');
        const status = normalizeStatus(manager?.status);
        const queueCount = queueCountByManager[managerId] || 0;
        const drawerCount = Math.max(3, Math.min(6, queueCount || 3));
        const hasRecentTraffic = Date.now() - lastTrafficAtRef.current < ACTIVITY_DECAY_MS;
        let accessTier = queueCount >= 20 ? 'heavy' : queueCount >= 8 ? 'medium' : queueCount >= 1 ? 'light' : 'idle';
        if (accessTier === 'idle' && hasRecentTraffic) {
          accessTier = 'light';
        }
        return {
          managerId,
          nodeName: String(manager?.nodeId || manager?.nodeName || 'Node'),
          status,
          drawerCount,
          queueCount,
          accessTier,
          accessPulseMs: Math.max(700, 1900 - (Math.min(queueCount, 30) * 35))
        };
      })
      .sort((a, b) => a.managerId.localeCompare(b.managerId)),
    [managers, queueCountByManager, trafficPulseTick]
  );

  const databaseCards = useMemo(
    () => databaseServers
      .map((db) => ({
        serverId: String(db?.serverId || db?.name || 'database-server'),
        name: String(db?.name || 'Database Server'),
        status: normalizeStatus(db?.status),
        host: String(db?.host || 'localhost'),
        port: Number(db?.port || 0),
        engine: String(db?.engine || 'database').toUpperCase(),
        instanceName: String(db?.instanceName || ''),
        serviceName: String(db?.serviceName || 'Unknown'),
        serviceState: String(db?.serviceState || 'Unknown')
      }))
      .sort((a, b) => a.serverId.localeCompare(b.serverId)),
    [databaseServers]
  );

  const brokerEntries = useMemo(
    () => Object.entries(brokerState.brokers || {}).sort((a, b) => a[0].localeCompare(b[0])),
    [brokerState]
  );

  const brokerNodes = brokerEntries.map(([id, instance]) => ({
    id,
    status: instance?.active ? (instance?.quiesced ? 'paused' : 'online') : 'offline'
  }));

  const brokerClass = normalizeStatus(brokerState.classStatus === 'unknown' ? brokerState.state : brokerState.classStatus);

  return (
    <div className="server-monitor-board">
      <h2 className="server-monitor-title">Server Monitor</h2>
      <div className="server-monitor-test-row">
        <button
          type="button"
          className="server-monitor-test-button"
          onClick={runHappyPathLoadTest}
          disabled={isTestRunning}
        >
          {isTestRunning ? 'Test Running...' : 'Test'}
        </button>
        <span className="server-monitor-test-status">{testStatus || 'Ready for test mode.'}</span>
      </div>
      <div className="server-monitor-feed-note">Feed mode: {feedModeLabel}, with 5s activity decay.</div>
      {controlStatus ? <div className="server-monitor-feed-note">Control: {controlStatus}</div> : null}

      <div className="server-monitor-grid">
        <section className="server-monitor-panel">
          <header className="server-monitor-panel-header">
            <h3>Database Servers</h3>
            <span>{databaseCards.length} servers</span>
          </header>

          {databaseCards.length === 0 ? (
            <div className="server-monitor-empty">No database servers registered.</div>
          ) : (
            <div className="server-card-grid">
              {databaseCards.map((card) => (
                <article key={card.serverId} className={`server-card server-card--database ${toStatusClass(card.status)}`}>
                  <div className="server-card-top-row">
                    <strong>{card.name}</strong>
                    <span className="server-pill">{getStatusLabel(card.status)}</span>
                  </div>

                  <div className="server-subtext">{card.host}{card.port > 0 ? `:${card.port}` : ''}</div>
                  <div className="server-meta">Engine: {card.engine}{card.instanceName ? ` (${card.instanceName})` : ''}</div>
                  <div className="server-meta">Service: {card.serviceName} ({card.serviceState})</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="server-monitor-panel">
          <header className="server-monitor-panel-header">
            <h3>Queue Managers</h3>
            <span>{queueManagerCards.length} servers</span>
          </header>
          <div className="server-monitor-test-row">
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('database', 'quiesce')}>Quiesce Class</button>
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('database', 'maintenance')}>Maintenance Class</button>
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('database', 'return-service')}>Return Class</button>
          </div>

          {queueManagerCards.length === 0 ? (
            <div className="server-monitor-empty">No queue managers registered.</div>
          ) : (
            <div className="server-card-grid">
              {queueManagerCards.map((card) => (
                <article
                  key={card.managerId}
                  className={`server-card server-card--database db-access-${card.accessTier} ${toStatusClass(card.status)}`}
                  style={{ '--db-access-pulse-ms': `${card.accessPulseMs}ms` }}
                >
                  <div className="server-card-top-row">
                    <strong>{card.managerId}</strong>
                    <span className="server-pill">{getStatusLabel(card.status)}</span>
                  </div>

                  <div className="server-subtext">{card.nodeName}</div>
                  <div className="server-meta">Role: Queue Manager</div>

                  <div className="filing-cabinet" aria-hidden="true">
                    {Array.from({ length: card.drawerCount }).map((_, index) => (
                      <div key={index} className="filing-drawer">
                        <span className="filing-handle" />
                      </div>
                    ))}
                  </div>

                  <div className="server-meta">Queues: {card.queueCount}</div>
                  <div className="server-meta">
                    <button type="button" className="server-monitor-test-button" onClick={() => configureInstance(`database:${card.managerId}`)}>Configure</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="server-monitor-panel">
          <header className="server-monitor-panel-header">
            <h3>Message Brokers</h3>
            <span>{brokerNodes.length} nodes</span>
          </header>
          <div className="server-monitor-test-row">
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('broker', 'up')}>Class Up</button>
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('broker', 'down')}>Class Down</button>
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('broker', 'quiesce')}>Class Quiesce</button>
            <button type="button" className="server-monitor-test-button" onClick={() => runClassAction('broker', 'unquiesce')}>Class Unquiesce</button>
            <button type="button" className="server-monitor-test-button" onClick={() => configureInstance('broker:class')}>Configure Class</button>
          </div>

          <article className={`server-card server-card--broker ${toStatusClass(brokerClass)}`}>
            <div className="server-card-top-row">
              <strong>Broker Network</strong>
              <span className="server-pill">{getStatusLabel(brokerClass)}</span>
            </div>

            <div className="server-subtext">Class state: {brokerState.classStatus || 'unknown'}</div>

            <div className="broker-network" aria-hidden="true">
              <div className="broker-core" />
              <div className="broker-ring" />
              {brokerNodes.slice(0, 8).map((node, index) => (
                <div
                  key={node.id}
                  className={`broker-node ${toStatusClass(node.status)}`}
                  style={{ '--node-index': index, '--node-count': Math.max(1, Math.min(8, brokerNodes.length)) }}
                />
              ))}
            </div>

            <div className="server-meta">
              {brokerEntries.length === 0
                ? 'No broker instances registered.'
                : brokerEntries.map(([id, instance]) => `${id}:${instance?.active ? (instance?.quiesced ? 'paused' : 'up') : 'down'}`).join(' | ')}
            </div>
            {brokerEntries.length > 0 ? (
              <div className="server-meta">
                {brokerEntries.map(([id]) => (
                  <button key={id} type="button" className="server-monitor-test-button" onClick={() => configureInstance(`broker:${id}`)}>
                    Configure {id}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        </section>
      </div>

      {error ? <div className="server-monitor-error">{error}</div> : null}
    </div>
  );
}
