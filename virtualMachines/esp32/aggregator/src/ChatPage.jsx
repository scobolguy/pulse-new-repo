import React, { useEffect, useRef, useState } from 'react';
import { getJsonAsActor, postJsonAsActor } from './http-client.js';

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'up' || status === 'online' || status === 'active') return 'online';
  if (status === 'paused' || status === 'quiesced' || status === 'draining' || status === 'maintenance' || status === 'syncing') return 'paused';
  return 'offline';
}

function getScreenBiasedIntent(screenContext) {
  const area = screenContext?.area;
  const operationsTask = screenContext?.operationsTask;
  if (area === 'operations') {
    if (operationsTask === 'deploy') return 'servers';   // gateways view
    if (operationsTask === 'manage') return 'flows';     // queue manager / flow targets
    return 'flows';                                       // monitor (default)
  }
  if (area === 'test') return 'entity';                  // transaction lifecycle dashboard
  if (area === 'develop') return 'servers';              // topology / infrastructure
  if (area === 'deploy') return 'servers';               // gateway dashboards
  if (area === 'analyze') return 'summary';              // data librarian

  // Secondary bias from person context when screen context is not decisive.
  const roleLabels = Array.isArray(screenContext?.roles)
    ? screenContext.roles.map(role => String(role?.label || role?.profileId || '').toLowerCase())
    : [];
  const permissions = Array.isArray(screenContext?.permissions)
    ? screenContext.permissions.map(item => String(item || '').toLowerCase())
    : [];
  const actor = screenContext?.actor || {};
  const department = String(actor.department || '').toLowerCase();
  const jobTitle = String(actor.jobTitle || '').toLowerCase();

  const isProject = /project|program|portfolio|pm\b/.test(jobTitle) || /project|program|portfolio/.test(department);
  if (isProject) return 'summary';

  const isTechnical = permissions.some(p => p.startsWith('topology.') || p.startsWith('registry.') || p.startsWith('queue.') || p.startsWith('broker.'))
    || roleLabels.some(label => /admin|config|technical|engineering/.test(label))
    || /engineering|technology|platform|it/.test(department);
  if (isTechnical) return 'servers';

  const isOperational = permissions.some(p => p.startsWith('lifecycle.') || p.startsWith('gateway.') || p.startsWith('router.'))
    || roleLabels.some(label => /operator|operations/.test(label))
    || /operations|ops|payments|settlement/.test(department);
  if (isOperational) return 'entity';

  return 'summary';
}

function getIntent(message, screenContext) {
  const text = String(message || '').toLowerCase();
  if (/(transaction|transactions|entit|entity|reference|reference transaction|where is|what state|current state|etat|etat actuel|fsm|lifecycle|cycle de vie|regle|reglees|reconcile|reconciled|settled)/.test(text)) return 'entity';
  if (/(flow|flows|flux)/.test(text)) return 'flows';
  if (/(service|services)/.test(text)) return 'services';
  if (/(server|servers|serveur|serveurs|database|base de donnees|queue manager|gestionnaire de files|broker|gateway|gateways|passerelle|passerelles)/.test(text)) return 'servers';
  // Open-ended question: bias to what is currently visible on screen
  return getScreenBiasedIntent(screenContext);
}

function tokenize(message) {
  return String(message || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(token => token.length > 2);
}

function matchesAnyToken(text, tokens) {
  const value = String(text || '').toLowerCase();
  return tokens.some(token => value.includes(token));
}

function findBestMatch(items, tokens, fields) {
  if (!Array.isArray(items) || tokens.length === 0) return null;
  return items.find((item) => fields.some((field) => matchesAnyToken(item?.[field], tokens))) || null;
}

function buildFlowRows(metricsPayload, dashboardPayload) {
  const dashboardStates = Array.isArray(dashboardPayload?.states) ? dashboardPayload.states : [];
  const stateCountsByQueue = dashboardStates.reduce((bucket, state) => {
    const queueName = String(state?.queueName || '').trim();
    if (!queueName) return bucket;
    bucket[queueName] = Number(state?.cumulativeCount || 0);
    return bucket;
  }, {});

  const queueDepths = metricsPayload?.metrics?.queueDepths || {};
  const latencyTargets = metricsPayload?.latencyPolicy?.targets || {};
  const latencyEvaluations = metricsPayload?.latencyPolicy?.evaluations || {};

  return Object.entries(latencyTargets).map(([flowId, target]) => {
    const evaluation = latencyEvaluations[flowId] || {};
    const queues = Array.isArray(target?.queues)
      ? target.queues
      : Array.isArray(evaluation?.sourceQueues)
        ? evaluation.sourceQueues
        : [];
    const queuedNow = queues.reduce((sum, queueName) => sum + Number(queueDepths?.[queueName]?.current || 0), 0);
    const cumulativeCount = queues.reduce((sum, queueName) => sum + Number(stateCountsByQueue[queueName] || 0), 0);
    const runtimeStatus = queuedNow > 0 || cumulativeCount > 0 ? 'running' : 'idle';

    return {
      id: flowId,
      name: String(target?.description || flowId),
      status: runtimeStatus,
      policyStatus: String(evaluation?.status || 'no-data'),
      targetThroughputTps: Number.isFinite(Number(target?.targetThroughputTps)) ? Number(target.targetThroughputTps) : null,
      queuedNow,
      cumulativeCount,
      queues
    };
  });
}

function buildServiceRows(servicesPayload) {
  const rows = [];
  for (const [serviceName, instances] of Object.entries(servicesPayload?.services || {})) {
    for (const instance of Array.isArray(instances) ? instances : []) {
      rows.push({
        id: `${serviceName}:${instance?.instanceId || instance?.nodeId || rows.length}`,
        serviceName,
        name: String(instance?.instanceId || instance?.serviceName || serviceName),
        nodeId: String(instance?.nodeId || instance?.ip || 'unknown'),
        state: String(instance?.status || 'unknown'),
        status: normalizeStatus(instance?.status)
      });
    }
  }
  return rows;
}

function buildServerRows(databasesPayload, queueManagersPayload, brokerPayload, gatewaysPayload) {
  const rows = [];

  for (const db of Array.isArray(databasesPayload?.databases) ? databasesPayload.databases : []) {
    rows.push({
      id: `database-${db?.serverId || db?.name || rows.length}`,
      family: 'Database',
      name: String(db?.name || db?.serverId || 'Database Server'),
      detail: `${String(db?.host || 'localhost')}${db?.port ? `:${db.port}` : ''}`,
      state: String(db?.status || db?.serviceState || 'unknown'),
      status: normalizeStatus(db?.status)
    });
  }

  for (const manager of Array.isArray(queueManagersPayload?.queueManagers) ? queueManagersPayload.queueManagers : []) {
    rows.push({
      id: `qm-${manager?.managerId || rows.length}`,
      family: 'Queue Manager',
      name: String(manager?.managerId || 'queue-manager'),
      detail: `${String(manager?.nodeId || manager?.ip || 'localhost')}${manager?.port ? `:${manager.port}` : ''}`,
      state: String(manager?.status || 'unknown'),
      status: normalizeStatus(manager?.status)
    });
  }

  const brokerEntries = Object.entries(brokerPayload?.brokers || {});
  for (const [brokerId, instance] of brokerEntries) {
    const status = instance?.active ? (instance?.quiesced ? 'paused' : 'online') : 'offline';
    rows.push({
      id: `broker-${brokerId}`,
      family: 'Broker',
      name: brokerId,
      detail: `Class ${String(brokerPayload?.classStatus || brokerPayload?.state || 'unknown')}`,
      state: instance?.active ? (instance?.quiesced ? 'quiesced' : 'active') : 'down',
      status
    });
  }

  for (const gatewayId of ['swift', 'boc', 'fed']) {
    const gateway = gatewaysPayload?.[gatewayId] || {};
    rows.push({
      id: `gateway-${gatewayId}`,
      family: 'Gateway',
      name: gatewayId.toUpperCase(),
      detail: gateway.running ? (gateway.quiesced ? 'Quiesced' : 'Running') : 'Stopped',
      state: gateway.running ? (gateway.quiesced ? 'quiesced' : 'running') : 'stopped',
      status: normalizeStatus(gateway.running ? (gateway.quiesced ? 'paused' : 'online') : 'offline')
    });
  }

  return rows;
}

function screenLabel(area, operationsTask, monitorClassId) {
  if (!area) return null;
  if (area === 'operations') {
    if (operationsTask === 'monitor') return `Operations Monitor (${monitorClassId || 'all'})`;
    if (operationsTask === 'deploy') return 'Operations Deploy';
    if (operationsTask === 'manage') return 'Operations Manage';
    return 'Operations';
  }
  const labels = { analyze: 'Analyze', develop: 'Develop', test: 'Test / Lifecycle', deploy: 'Deploy', 'user-admin': 'User Admin', 'project-manage': 'Project Manage' };
  return labels[area] || area;
}

function mapOverviewToSnapshot(overview) {
  if (!overview) return null;
  return {
    loadedAt: new Date().toISOString(),
    error: '',
    flows: (overview.flows || []).map(f => ({ ...f, status: f.runtimeStatus || f.status || 'idle' })),
    services: (overview.services || []).map(s => ({ ...s, serviceName: s.name, nodeId: s.id })),
    servers: (overview.servers || []).map(s => ({ ...s, state: s.statusText || s.state || s.status })),
    gateways: overview.gateways || {},
    dashboard: null,
    metrics: null,
  };
}

function buildSummaryReply(intent, text, snapshot, screenContext) {
  const tokens = tokenize(text);

  if (intent === 'flows') {
    const match = findBestMatch(snapshot.flows, tokens, ['name', 'id']);
    if (match) {
      return `Flow ${match.name} is ${match.status === 'running' ? 'running' : 'idle'}. Queue depth is ${match.queuedNow}. Cumulative count is ${match.cumulativeCount}.`;
    }

    const runningCount = snapshot.flows.filter(flow => flow.status === 'running').length;
    const busiest = [...snapshot.flows].sort((a, b) => Number(b.queuedNow || 0) - Number(a.queuedNow || 0))[0] || null;
    const topFlows = snapshot.flows.slice(0, 5).map(flow => `${flow.name}: ${flow.status} (${flow.queuedNow} queued)`).join('; ');
    return `I see ${runningCount}/${snapshot.flows.length} flows moving. ${busiest ? `The busiest flow is ${busiest.name} with ${busiest.queuedNow} queued.` : ''} ${topFlows ? `Current snapshot: ${topFlows}.` : ''}`.trim();
  }

  if (intent === 'services') {
    const match = findBestMatch(snapshot.services, tokens, ['serviceName', 'name', 'nodeId']);
    if (match) {
      return `Service ${match.name} on ${match.nodeId} is ${match.status === 'online' ? 'online' : match.status === 'paused' ? 'paused' : 'offline'}.`;
    }

    const onlineCount = snapshot.services.filter(service => service.status === 'online').length;
    const details = snapshot.services.slice(0, 6).map(service => `${service.serviceName}/${service.name}: ${service.state}`).join('; ');
    return `I see ${onlineCount}/${snapshot.services.length} services online. ${details ? `Snapshot: ${details}.` : ''}`.trim();
  }

  if (intent === 'servers') {
    const match = findBestMatch(snapshot.servers, tokens, ['name', 'family', 'detail']);
    if (match) {
      return `${match.family} ${match.name} is ${match.status === 'online' ? 'online' : match.status === 'paused' ? 'paused' : 'offline'}. ${match.detail ? `Detail: ${match.detail}.` : ''}`.trim();
    }

    const onlineCount = snapshot.servers.filter(server => server.status === 'online').length;
    const details = snapshot.servers.slice(0, 8).map(server => `${server.family} ${server.name}: ${server.state}`).join('; ');
    return `I see ${onlineCount}/${snapshot.servers.length} runtime servers online. ${details ? `Snapshot: ${details}.` : ''}`.trim();
  }

  const flowRunningCount = snapshot.flows.filter(flow => flow.status === 'running').length;
  const serviceOnlineCount = snapshot.services.filter(service => service.status === 'online').length;
  const serverOnlineCount = snapshot.servers.filter(server => server.status === 'online').length;
  const gatewayOnlineCount = Object.values(snapshot.gateways || {}).filter(gateway => gateway.running).length;

  const screenNote = screenContext
    ? `[Viewing: ${screenLabel(screenContext.area, screenContext.operationsTask, screenContext.monitorClassId)}] `
    : '';

  return screenNote + [
    `Flows: ${flowRunningCount}/${snapshot.flows.length} active.`,
    `Services: ${serviceOnlineCount}/${snapshot.services.length} online.`,
    `Servers: ${serverOnlineCount}/${snapshot.servers.length} online.`,
    `Gateways: ${gatewayOnlineCount}/3 running.`
  ].join(' ');
}

export default function ChatPage({ onNavigateHome, screenContext, askBoxActive = true, onSetAskBoxActive }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const [snapshot, setSnapshot] = useState({
    loadedAt: null,
    error: '',
    flows: [],
    services: [],
    servers: [],
    gateways: {},
    dashboard: null,
    metrics: null
  });
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about flows, services, servers, or a transaction reference. I will answer from the live runtime snapshot or the FSM store.'
    }
  ]);
  const scrollRef = useRef(null);

  async function persistInteraction({ message, intent, responseKind, confidence = 0.7, wasSuccessful = true, clarificationRequested = false, suggestions = null, metadata = null }) {
    try {
      await postJsonAsActor('/api/nlp/interaction', {
        message,
        intent,
        responseKind,
        intentConfidence: confidence,
        language: screenContext?.language || null,
        wasSuccessful,
        clarificationRequested,
        suggestions,
        screenContext: {
          area: screenContext?.area || null,
          operationsTask: screenContext?.operationsTask || null,
          monitorClassId: screenContext?.monitorClassId || null,
        },
        metadata,
      }, 'NLP interaction log failed');
    } catch {
      // Non-blocking analytics write.
    }
  }

  async function refreshSnapshot() {
    try {
      const [metricsResult, dashboardResult, servicesResult, databasesResult, queueManagersResult, brokerResult, gatewaysResult] = await Promise.allSettled([
        getJsonAsActor('/api/metrics/current', 'Metrics API failed'),
        getJsonAsActor('/api/lifecycle/dashboard', 'Lifecycle dashboard failed'),
        getJsonAsActor('/api/registry/services', 'Service registry failed'),
        getJsonAsActor('/api/registry/databases', 'Database registry failed'),
        getJsonAsActor('/api/registry/queue-managers', 'Queue manager registry failed'),
        getJsonAsActor('/api/broker/state', 'Broker state failed'),
        getJsonAsActor('/api/gateways', 'Gateway state failed')
      ]);

      const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
      const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const services = servicesResult.status === 'fulfilled' ? servicesResult.value : null;
      const databases = databasesResult.status === 'fulfilled' ? databasesResult.value : null;
      const queueManagers = queueManagersResult.status === 'fulfilled' ? queueManagersResult.value : null;
      const brokerState = brokerResult.status === 'fulfilled' ? brokerResult.value : null;
      const gateways = gatewaysResult.status === 'fulfilled' ? gatewaysResult.value : null;

      setSnapshot({
        loadedAt: new Date().toISOString(),
        error: [metricsResult, dashboardResult, servicesResult, databasesResult, queueManagersResult, brokerResult, gatewaysResult]
          .filter(result => result.status === 'rejected')
          .map(result => String(result.reason?.message || result.reason || 'Unknown error'))
          .join(' | '),
        flows: buildFlowRows(metrics, dashboard),
        services: buildServiceRows(services),
        servers: buildServerRows(databases, queueManagers, brokerState, gateways),
        gateways: gateways || {},
        dashboard,
        metrics
      });
    } catch (error) {
      setSnapshot(current => ({ ...current, error: String(error.message || error) }));
    }
  }

  // Sync snapshot from App's already-fetched overview when available
  useEffect(() => {
    const mapped = mapOverviewToSnapshot(screenContext?.overview);
    if (mapped) {
      setSnapshot(mapped);
    } else {
      refreshSnapshot();
    }
  }, [screenContext?.overview]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, snapshot.loadedAt]);

  useEffect(() => {
    if (!askBoxActive) return;
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    focusInput();

    const handleFocusIn = (event) => {
      if (!askBoxActive) return;
      const activeEl = event.target;
      const inComposer = activeEl instanceof HTMLElement && activeEl.closest('.chat-composer--minimal');
      if (!inComposer) {
        setTimeout(focusInput, 0);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => window.removeEventListener('focusin', handleFocusIn);
  }, [askBoxActive]);

  async function submitClarificationFeedback({ selectedOptionId, originalMessage, rewrittenMessage, alternatives }) {
    try {
      await postJsonAsActor('/api/nlp/feedback', {
        selectedOptionId,
        originalMessage,
        rewrittenMessage,
        alternatives,
        wasHelpful: true,
        source: 'chat-clarification-ui',
        language: screenContext?.language || null,
      }, 'NLP feedback log failed');
    } catch {
      // Non-blocking analytics write.
    }
  }

  async function handleClarificationSelect(option, meta) {
    const selectedOption = option || {};
    const rewrittenMessage = String(selectedOption.example || '').trim();
    if (!rewrittenMessage || busy) return;

    await submitClarificationFeedback({
      selectedOptionId: String(selectedOption.id || '').trim() || 'unspecified',
      originalMessage: String(meta?.originalMessage || '').trim() || '',
      rewrittenMessage,
      alternatives: Array.isArray(meta?.alternatives) ? meta.alternatives : null,
    });

    setMessages((current) => [
      ...current,
      {
        id: `assistant-system-${Date.now()}`,
        role: 'assistant',
        text: `Applied suggestion: ${rewrittenMessage}`,
      }
    ]);

    setQuery(rewrittenMessage);
    submitQuery(rewrittenMessage);
  }

  async function submitQuery(question) {
    const text = String(question || query || '').trim();
    if (!text || busy) return;

    const userMessage = { id: `user-${Date.now()}`, role: 'user', text };
    setMessages(current => [...current, userMessage]);
    setQuery('');
    setBusy(true);

    try {
      const intent = getIntent(text, screenContext);

      if (intent === 'entity') {
        const reply = await postJsonAsActor('/api/fsm/chat', { message: text, limit: 10 }, 'FSM chat request failed');
        setMessages(current => [...current, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: reply.reply || 'No FSM answer was returned.',
          meta: {
            ...reply,
            originalMessage: text
          }
        }]);
        return;
      }

      const replyText = buildSummaryReply(intent, text, snapshot, screenContext);
      setMessages(current => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        meta: {
          intent,
          snapshotAt: snapshot.loadedAt
        }
      }]);
      await persistInteraction({
        message: text,
        intent,
        responseKind: 'chat-summary',
        confidence: 0.72,
        wasSuccessful: true,
        metadata: { snapshotAt: snapshot.loadedAt }
      });
    } catch (error) {
      setMessages(current => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: String(error.message || error)
      }]);
      await persistInteraction({
        message: text,
        intent: 'unknown',
        responseKind: 'chat-error',
        confidence: 0.2,
        wasSuccessful: false,
        metadata: { error: String(error.message || error) }
      });
    } finally {
      setBusy(false);
    }
  }

  const quickPrompts = [
    'List all transactions that are reconciled (settled) successfully.',
    'Liste toutes les transactions reglees avec succes.',
    'Show flows that are currently running and any breaches.',
    'Show gateways and servers that are offline or paused.'
  ];

  if (!askBoxActive) {
    return (
      <div className="chat-page chat-page--minimized">
        <div className="chat-minimized-box">
          <strong>Ask box minimized</strong>
          <span>Press F1 to summon it, or click Reopen.</span>
          <button type="button" className="chat-send-button" onClick={() => onSetAskBoxActive?.(true)}>Reopen Ask Box</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-hero">
        <div>
          <div className="chat-kicker">Pulse Ops Chat</div>
          <h1>Query the live runtime snapshot</h1>
          <p>Ask about flows, servers, services, or a transaction reference. The page answers from the current dashboard data and the FSM store.</p>
        </div>
        <div className="chat-hero-actions">
          <button type="button" className="chat-hero-button chat-hero-button--ghost" onClick={() => onSetAskBoxActive?.(false)}>
            Minimize Ask Box
          </button>
          <button type="button" className="chat-hero-button chat-hero-button--ghost" onClick={() => onNavigateHome?.()}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="chat-simple-shell">
        <div className="chat-history chat-history--minimal" aria-live="polite">
          {messages.map(message => (
            <article key={message.id} className={`chat-bubble chat-bubble--${message.role}`}>
              <div className="chat-bubble-text">{message.text}</div>
              {message.role === 'assistant' && Array.isArray(message?.meta?.alternatives) && message.meta.alternatives.length > 0 && (
                <div className="chat-quick-prompts" role="group" aria-label="Clarification alternatives">
                  {message.meta.alternatives.map((option) => (
                    <button
                      key={`${message.id}-${option?.id || option?.example || Math.random()}`}
                      type="button"
                      className="chat-prompt-chip"
                      onClick={() => handleClarificationSelect(option, message.meta)}
                      disabled={busy}
                      title={option?.label || option?.id || 'Use this option'}
                    >
                      {option?.example || option?.label || 'Use this option'}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          <div ref={scrollRef} />
        </div>

        <form
          className="chat-composer chat-composer--minimal"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuery();
          }}
        >
          <label className="chat-input-label" htmlFor="chat-query-input">Ask a question</label>
          <input
            id="chat-query-input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type your question here (example: list all reconciled transactions)"
            aria-label="Chat query"
          />
          <div className="chat-input-hint">Press Enter to ask. Use one of the quick prompts below.</div>
          <div className="chat-quick-prompts" role="group" aria-label="Quick prompts">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-prompt-chip"
                onClick={() => {
                  setQuery(prompt);
                  submitQuery(prompt);
                }}
                disabled={busy}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="chat-composer-actions">
            <button type="submit" className="chat-send-button" disabled={busy}>
              {busy ? 'Thinking...' : 'Ask'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
