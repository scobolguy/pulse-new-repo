import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

export default function QueueManagerDashboard() {
  const DEFAULT_QUEUE_CONFIG = {
    maxSize: 1000,
    priority: 'normal',
    frozen: false,
    createdByUser: true,
  };

  const DEFAULT_QUEUE_UPDATES = {
    frozen: false,
  };

  const [managers, setManagers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [configuredQueuesByManager, setConfiguredQueuesByManager] = useState({});
  const [queueLengthsByManager, setQueueLengthsByManager] = useState({});
  const [routes, setRoutes] = useState([]);
  const [publishQueue, setPublishQueue] = useState('default');
  const [publishPayload, setPublishPayload] = useState('hello');
  const [publishResult, setPublishResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedInstances, setExpandedInstances] = useState({});
  const [expandedMaintenanceFolders, setExpandedMaintenanceFolders] = useState({});
  const [subscriptions, setSubscriptions] = useState({});
  const [newSubTopic, setNewSubTopic] = useState('');
  const [newSubService, setNewSubService] = useState('');
  const [subResult, setSubResult] = useState('');

  async function refreshSubscriptions() {
    try {
      const res = await fetch('/api/broker/subscriptions');
      if (!res.ok) throw new Error('Failed to load subscriptions');
      const data = await res.json();
      setSubscriptions(data.subscriptions || {});
    } catch (e) {
      setSubResult(`Failed to load subscriptions: ${e.message || e}`);
    }
  }

  async function handleAddSubscription() {
    if (!newSubTopic.trim() || !newSubService.trim()) {
      setSubResult('Topic and service name are required');
      return;
    }

    try {
      const res = await fetch('/api/broker/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: newSubTopic.trim(), serviceName: newSubService.trim() })
      });
      if (!res.ok) throw new Error('Failed to add subscription');
      setSubResult('Subscription added');
      setNewSubTopic('');
      setNewSubService('');
      await refreshSubscriptions();
    } catch (e) {
      setSubResult(`Add failed: ${e.message || e}`);
    }
  }

  async function readJsonResponse(res, label) {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${label} failed (${res.status}): ${text.slice(0, 160)}`);
    }
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`${label} returned non-JSON response: ${text.slice(0, 160)}`);
    }
    return res.json();
  }

  function statusStyle(status) {
    if (status === 'up') return { background: '#dff5e1', color: '#1d6b2a' };
    if (status === 'quiesced') return { background: '#fff4d8', color: '#8a5a00' };
    if (status === 'maintenance') return { background: '#e6f0ff', color: '#1e4c9a' };
    return { background: '#ffe6e6', color: '#7a1f1f' };
  }

  async function refresh() {
    setLoading(true);
    try {
      const [mgrRes, queueRes, routeRes] = await Promise.all([
        fetch('/api/registry/queue-managers'),
        fetch('/api/registry/queues'),
        fetch('/api/broker/routes')
      ]);
      const [mgrData, queueData, routeData] = await Promise.all([
        readJsonResponse(mgrRes, 'Queue manager registry'),
        readJsonResponse(queueRes, 'Queue assignment registry'),
        readJsonResponse(routeRes, 'Broker routes'),
      ]);
      const managerList = Array.isArray(mgrData.queueManagers) ? mgrData.queueManagers : [];
      setManagers(managerList);
      setQueues(Array.isArray(queueData.queues) ? queueData.queues : []);
      setRoutes(Array.isArray(routeData.routes) ? routeData.routes : []);

      // Load configured queues per manager so newly created queues show immediately
      const configuredEntries = await Promise.all(
        managerList.map(async manager => {
          try {
            const response = await fetch(`/api/queues/${encodeURIComponent(manager.managerId)}/config`);
            if (!response.ok) return [manager.managerId, { queues: {}, queueLengths: {} }];
            const data = await response.json();
            return [manager.managerId, { queues: data.queues || {}, queueLengths: data.queueLengths || {} }];
          } catch {
            return [manager.managerId, { queues: {}, queueLengths: {} }];
          }
        })
      );
      setConfiguredQueuesByManager(Object.fromEntries(configuredEntries.map(([managerId, data]) => [managerId, data.queues])));
      setQueueLengthsByManager(Object.fromEntries(configuredEntries.map(([managerId, data]) => [managerId, data.queueLengths])));
    } catch (e) {
      setPublishResult(`Refresh failed: ${e.message || e}`);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    refreshSubscriptions();
    const t = setInterval(() => {
      refresh();
      refreshSubscriptions();
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
    }

    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  const queuesByManager = useMemo(() => {
    const bucket = {};
    for (const q of queues) {
      if (!bucket[q.managerId]) bucket[q.managerId] = [];
      bucket[q.managerId].push(q);
    }
    return bucket;
  }, [queues]);

  const visibleQueuesByManager = useMemo(() => {
    const merged = {};
    for (const manager of managers) {
      const managerId = manager.managerId;
      const assigned = queuesByManager[managerId] || [];
      const configured = configuredQueuesByManager[managerId] || {};
      const knownLengths = queueLengthsByManager[managerId] || {};

      const byName = new Map();
      for (const queueItem of assigned) {
        const configuredEntry = configured[queueItem.queueName] || {};
        byName.set(queueItem.queueName, {
          queueName: queueItem.queueName,
          queueLength: queueItem.queueLength ?? knownLengths[queueItem.queueName] ?? null,
          configuredOnly: false,
          createdByUser: configuredEntry.createdByUser === true,
        });
      }
      for (const [queueName, queueConfig] of Object.entries(configured)) {
        if (!byName.has(queueName)) {
          byName.set(queueName, {
            queueName,
            queueLength: knownLengths[queueName] ?? null,
            configuredOnly: true,
            createdByUser: queueConfig?.createdByUser === true,
          });
        }
      }

      merged[managerId] = Array.from(byName.values()).sort((a, b) => a.queueName.localeCompare(b.queueName));
    }
    return merged;
  }, [managers, queuesByManager, configuredQueuesByManager, queueLengthsByManager]);

  function getManagerGroupId(managerId) {
    return String(managerId || '').replace(/-\d+$/, '');
  }

  const managerGroups = useMemo(() => {
    const groups = new Map();

    for (const manager of managers) {
      const groupId = getManagerGroupId(manager.managerId);
      const existing = groups.get(groupId) || { groupId, instances: [] };
      existing.instances.push(manager);
      groups.set(groupId, existing);
    }

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        instances: group.instances.sort((a, b) => {
          const aPort = Number(a.port || 0);
          const bPort = Number(b.port || 0);
          return aPort - bPort || a.managerId.localeCompare(b.managerId);
        })
      }))
      .sort((a, b) => a.groupId.localeCompare(b.groupId));
  }, [managers]);

  useEffect(() => {
    setExpandedGroups(prev => {
      const next = { ...prev };
      for (const group of managerGroups) {
        if (next[group.groupId] === undefined) {
          next[group.groupId] = true;
        }
      }
      return next;
    });

    setExpandedInstances(prev => {
      const next = { ...prev };
      for (const group of managerGroups) {
        for (const instance of group.instances) {
          if (next[instance.managerId] === undefined) {
            next[instance.managerId] = true;
          }
        }
      }
      return next;
    });
  }, [managerGroups]);

  function isGroupExpanded(groupId) {
    return expandedGroups[groupId] !== false;
  }

  function isInstanceExpanded(instanceId) {
    return expandedInstances[instanceId] !== false;
  }

  function isMaintenanceFolderExpanded(instanceId) {
    return expandedMaintenanceFolders[instanceId] === true;
  }

  function toggleGroupExpanded(groupId) {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !isGroupExpanded(groupId) }));
  }

  function toggleInstanceExpanded(instanceId) {
    setExpandedInstances(prev => ({ ...prev, [instanceId]: !isInstanceExpanded(instanceId) }));
  }

  function toggleMaintenanceFolderExpanded(instanceId) {
    setExpandedMaintenanceFolders(prev => ({ ...prev, [instanceId]: !isMaintenanceFolderExpanded(instanceId) }));
  }

  function isMaintenanceQueue(queueItem) {
    return queueItem?.createdByUser !== true;
  }

  async function handlePublish() {
    setPublishResult('Publishing...');
    try {
      const payload = {
        queueName: publishQueue,
        message: publishPayload,
        sourceService: 'dashboard'
      };
      const res = await fetch('/api/broker/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await readJsonResponse(res, 'Publish');
      setPublishResult(`${res.status}: ${JSON.stringify(data)}`);
      refresh();
    } catch (e) {
      setPublishResult(`Publish failed: ${e.message || e}`);
    }
  }

  async function handleManagerAction(managerId, action) {
    setContextMenu(null);
    setPublishResult(`Applying ${action} to ${managerId}...`);
    try {
      const res = await fetch(`/api/registry/queue-managers/${managerId}/${action}`, { method: 'POST' });
      const data = await readJsonResponse(res, `Manager action ${action}`);
      setPublishResult(`${res.status}: ${JSON.stringify(data)}`);
      refresh();
    } catch (e) {
      setPublishResult(`Manager action failed: ${e.message || e}`);
    }
  }

  async function handleGroupAction(group, action) {
    setContextMenu(null);
    setPublishResult(`Applying ${action} to ${group.groupId}...`);

    try {
      const results = await Promise.all(group.instances.map(async instance => {
        const res = await fetch(`/api/registry/queue-managers/${instance.managerId}/${action}`, { method: 'POST' });
        const data = await readJsonResponse(res, `Manager action ${action}`);
        return { managerId: instance.managerId, data };
      }));

      setPublishResult(`${action} applied to ${results.length} instance(s) for ${group.groupId}`);
      refresh();
    } catch (e) {
      setPublishResult(`Group action failed: ${e.message || e}`);
    }
  }

  function getNextManagerInstanceId(managerId) {
    const baseId = getManagerGroupId(managerId);
    const siblingIds = managers
      .map(manager => manager.managerId)
      .filter(id => id === baseId || id.startsWith(`${baseId}-`));

    let nextIndex = 2;
    while (siblingIds.includes(`${baseId}-${nextIndex}`)) {
      nextIndex += 1;
    }

    return `${baseId}-${nextIndex}`;
  }

  function getNextLocalPort() {
    const usedPorts = new Set(
      managers
        .map(manager => Number(manager.port))
        .filter(port => Number.isFinite(port))
    );

    let candidate = 4100;
    while (usedPorts.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  async function handleCreateManagerInstance(manager) {
    setContextMenu(null);
    const sourceManagerId = manager.groupId || manager.managerId;
    const nextManagerId = getNextManagerInstanceId(sourceManagerId);
    const nextPort = getNextLocalPort();
    setPublishResult(`Creating ${nextManagerId} from ${sourceManagerId} on localhost...`);

    try {
      const res = await fetch('/api/local-queue-managers/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          managerId: nextManagerId,
          nodeId: 'localhost',
          port: nextPort,
          advertiseIp: '127.0.0.1',
          aggregatorUrl: 'http://127.0.0.1:4000'
        })
      });
      const data = await readJsonResponse(res, 'Create queue manager instance');
      setPublishResult(`${res.status}: Created ${nextManagerId} on 127.0.0.1:${nextPort}`);
      await refresh();
      return data;
    } catch (e) {
      setPublishResult(`Create instance failed: ${e.message || e}`);
      return null;
    }
  }

  async function runQueueActionAcrossGroup(group, action, body) {
    const settled = await Promise.allSettled(
      group.instances.map(async instance => {
        const res = await fetch(`/api/queues/${encodeURIComponent(instance.managerId)}/${action}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await readJsonResponse(res, `${action} queue`);
        return { managerId: instance.managerId, data };
      })
    );

    const successCount = settled.filter(result => result.status === 'fulfilled').length;
    const failed = settled.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      const firstError = failed[0].reason?.message || failed[0].reason || 'unknown error';
      throw new Error(`${failed.length} of ${settled.length} instance(s) failed. First error: ${firstError}`);
    }
    return successCount;
  }

  async function createQueue(group) {
    setContextMenu(null);
    try {
      const queueName = window.prompt(`Queue name to create on queue manager ${group.groupId}:`, 'new-queue');
      if (queueName === null) return;
      const normalizedQueueName = queueName.trim();
      if (!normalizedQueueName) {
        setPublishResult('Create queue cancelled: queue name is required.');
        return;
      }

      const config = { ...DEFAULT_QUEUE_CONFIG };

      const applied = await runQueueActionAcrossGroup(group, 'create', { queueName: normalizedQueueName, config });
      setPublishResult(`Queue created for ${group.groupId}: ${normalizedQueueName} on ${applied} instance(s)`);
      await refresh();
    } catch (e) {
      setPublishResult(`Create queue failed: ${e.message || e}`);
    }
  }

  async function updateQueue(group) {
    setContextMenu(null);
    try {
      const queueNameInput = window.prompt(`Queue name to modify on queue manager ${group.groupId}:`, '');
      if (queueNameInput === null) return;
      const queueName = queueNameInput.trim();
      if (!queueName) {
        setPublishResult('Modify queue cancelled: queue name is required.');
        return;
      }

      const updates = { ...DEFAULT_QUEUE_UPDATES };

      const applied = await runQueueActionAcrossGroup(group, 'update', { queueName, updates });
      setPublishResult(`Queue modified for ${group.groupId}: ${queueName} on ${applied} instance(s)`);
      await refresh();
    } catch (e) {
      setPublishResult(`Modify queue failed: ${e.message || e}`);
    }
  }

  async function deleteQueue(group) {
    setContextMenu(null);
    try {
      const queueNameInput = window.prompt(`Queue name to delete from queue manager ${group.groupId}:`, '');
      if (queueNameInput === null) return;
      const queueName = queueNameInput.trim();
      if (!queueName) {
        setPublishResult('Delete queue cancelled: queue name is required.');
        return;
      }

      if (!window.confirm(`Delete queue "${queueName}" from queue manager ${group.groupId} (all instances)?`)) {
        return;
      }

      const applied = await runQueueActionAcrossGroup(group, 'delete', { queueName });
      setPublishResult(`Queue deleted for ${group.groupId}: ${queueName} on ${applied} instance(s)`);
      await refresh();
    } catch (e) {
      setPublishResult(`Delete queue failed: ${e.message || e}`);
    }
  }

  function handleGroupContextMenu(event, group) {
    event.preventDefault();
    setContextMenu({
      type: 'group',
      target: group,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleInstanceContextMenu(event, instance) {
    event.preventDefault();
    setContextMenu({
      type: 'instance',
      target: instance,
      x: event.clientX,
      y: event.clientY,
    });
  }

  return (
    <div className="dashboard-container" style={{ position: 'relative' }}>
      {/* Broker Subscriptions Panel */}
      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fff', marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Broker Subscriptions</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={newSubTopic} onChange={e => setNewSubTopic(e.target.value)} placeholder="topic" style={{ minWidth: 120 }} />
          <input value={newSubService} onChange={e => setNewSubService(e.target.value)} placeholder="service name" style={{ minWidth: 120 }} />
          <button onClick={handleAddSubscription}>Add Subscription</button>
        </div>
        {subResult && <div style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>{subResult}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Topic</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Service Name</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(subscriptions).length === 0 && (
              <tr><td colSpan={2} style={{ color: '#888', fontSize: 12 }}>No subscriptions found.</td></tr>
            )}
            {Object.entries(subscriptions).map(([topic, subs]) => (
              subs.map((sub, idx) => (
                <tr key={topic + ':' + sub.serviceName + ':' + idx}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{topic}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{sub.serviceName}</td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
      <h2>Queue Manager Dashboard (Live)</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={refresh}>Refresh</button>
        <span style={{ fontSize: 12, color: '#555' }}>{loading ? 'Loading...' : `${managers.length} managers, ${queues.length} queues`}</span>
        <span style={{ fontSize: 12, color: '#777' }}>Right-click a queue manager for queue actions. Right-click an instance for lifecycle actions.</span>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12, marginBottom: 16, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Publish Test Message</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={publishQueue} onChange={e => setPublishQueue(e.target.value)} placeholder="queue name" />
          <input value={publishPayload} onChange={e => setPublishPayload(e.target.value)} placeholder="message payload" style={{ minWidth: 260 }} />
          <button onClick={handlePublish}>Publish</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#444', whiteSpace: 'pre-wrap' }}>{publishResult}</div>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fafbfc', minWidth: 320 }}>
        <h3 style={{ marginTop: 0 }}>Queue Managers and Broker Instances</h3>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {managerGroups.map(group => (
            <li key={group.groupId} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => toggleGroupExpanded(group.groupId)}
                onContextMenu={event => handleGroupContextMenu(event, group)}
              >
                <span style={{ width: 12, color: '#5a6b7b' }}>{isGroupExpanded(group.groupId) ? '▾' : '▸'}</span>
                <span style={{ marginRight: 2 }}>🗄️</span>
                <span>{group.groupId}</span>
                <span style={{ fontSize: 11, color: '#666' }}>{group.instances.length} instance(s)</span>
              </div>
              {isGroupExpanded(group.groupId) && (
                <ul style={{ listStyle: 'none', paddingLeft: 20, borderLeft: '1px solid #dfe6eb', marginLeft: 10, marginTop: 2 }}>
                  {group.instances.map(instance => (
                    <li key={instance.managerId} style={{ marginBottom: 4, paddingLeft: 6 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          padding: '2px 4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => toggleInstanceExpanded(instance.managerId)}
                        onContextMenu={event => handleInstanceContextMenu(event, instance)}
                      >
                        <span style={{ width: 12, color: '#5a6b7b' }}>{isInstanceExpanded(instance.managerId) ? '▾' : '▸'}</span>
                        <span style={{ marginRight: 1 }}>🖥️</span>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{instance.ip}:{instance.port}</span>
                        <span style={{ fontSize: 11, color: '#777' }}>{instance.managerId}</span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, ...statusStyle(instance.status) }}>{instance.status}</span>
                      </div>
                      {isInstanceExpanded(instance.managerId) && (
                        <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
                          {(visibleQueuesByManager[instance.managerId] || []).filter(q => !isMaintenanceQueue(q)).map(q => (
                            <li key={`${instance.managerId}:${q.queueName}`} style={{ marginBottom: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px' }}>
                                <span style={{ width: 12, color: '#5a6b7b' }}>•</span>
                                <span>📬</span>
                                <span style={{ fontSize: 12 }}>{q.queueName}</span>
                                <span style={{ fontSize: 10, color: '#555' }}>len: {q.queueLength ?? 'n/a'}</span>
                                {q.configuredOnly && <span style={{ fontSize: 10, color: '#777' }}>configured</span>}
                              </div>
                            </li>
                          ))}
                          {(visibleQueuesByManager[instance.managerId] || []).filter(q => isMaintenanceQueue(q)).length > 0 && (
                            <li style={{ marginBottom: 2 }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => toggleMaintenanceFolderExpanded(instance.managerId)}
                              >
                                <span style={{ width: 12, color: '#5a6b7b' }}>{isMaintenanceFolderExpanded(instance.managerId) ? '▾' : '▸'}</span>
                                <span>📁</span>
                                <span style={{ fontSize: 12 }}>.maintenence</span>
                                <span style={{ fontSize: 10, color: '#777' }}>
                                  {(visibleQueuesByManager[instance.managerId] || []).filter(q => isMaintenanceQueue(q)).length} item(s)
                                </span>
                              </div>
                              {isMaintenanceFolderExpanded(instance.managerId) && (
                                <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
                                  {(visibleQueuesByManager[instance.managerId] || []).filter(q => isMaintenanceQueue(q)).map(q => (
                                    <li key={`${instance.managerId}:maintenance:${q.queueName}`} style={{ marginBottom: 2 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px' }}>
                                        <span style={{ width: 12, color: '#5a6b7b' }}>•</span>
                                        <span>🧰</span>
                                        <span style={{ fontSize: 12 }}>{q.queueName}</span>
                                        <span style={{ fontSize: 10, color: '#555' }}>len: {q.queueLength ?? 'n/a'}</span>
                                        {q.configuredOnly && <span style={{ fontSize: 10, color: '#777' }}>configured</span>}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )}
                          {(visibleQueuesByManager[instance.managerId] || []).length === 0 && (
                            <li style={{ marginBottom: 2, color: '#888', fontSize: 11, paddingLeft: 18 }}>No queues</li>
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {managerGroups.length === 0 && <li style={{ color: '#888' }}>No queue managers found.</li>}
        </ul>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fff', marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Broker Route Table</h3>
        {routes.length === 0 && <div style={{ color: '#888', fontSize: 12 }}>No routes assigned yet. Publish a message to create one.</div>}
        {routes.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Queue</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Manager</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(route => (
                <tr key={`${route.queueName}:${route.managerId}`}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.queueName}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.managerId}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.assignedAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #cfd8dc',
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
            minWidth: 220,
            zIndex: 1000,
            overflow: 'hidden'
          }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ padding: '10px 12px', fontSize: 12, color: '#546e7a', borderBottom: '1px solid #eceff1' }}>
            {contextMenu.type === 'group' ? contextMenu.target.groupId : contextMenu.target.managerId}
          </div>
          {contextMenu.type === 'group' && (
            <>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => createQueue(contextMenu.target)}
              >
                Add queue
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => updateQueue(contextMenu.target)}
              >
                Modify queue
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => deleteQueue(contextMenu.target)}
              >
                Delete queue
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleCreateManagerInstance(contextMenu.target)}
              >
                Create instance on localhost
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'quiesce')}
              >
                Quiesce all instances
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'maintenance')}
              >
                Put all instances in maintenance
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'return-service')}
              >
                Return all instances to service
              </button>
            </>
          )}
          {contextMenu.type === 'instance' && (
            <>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'quiesce')}
              >
                Quiesce instance
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'maintenance')}
              >
                Put instance in maintenance
              </button>
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'return-service')}
              >
                Return instance to service
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
