import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

export default function QueueManagerDashboard() {
  const DEFAULT_QUEUE_CONFIG = {
    maxSize: 1000,
    priority: 'normal',
    frozen: false,
    dataTypeId: 'text-string',
    dataTypeIds: ['text-string'],
    queueClass: 'permanent',
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
  const [dataTypes, setDataTypes] = useState([]);

  const prevManagersRef = useRef(null);
  const prevQueuesRef = useRef(null);
  const prevConfiguredRef = useRef(null);
  const prevLengthsRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const [publishQueue, setPublishQueue] = useState('default');
  const [publishPayload, setPublishPayload] = useState('hello');
  const [publishResult, setPublishResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [queueDialog, setQueueDialog] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedInstances, setExpandedInstances] = useState({});
  const [expandedMaintenanceFolders, setExpandedMaintenanceFolders] = useState({});
  const [subscriptions, setSubscriptions] = useState({});
  const [newSubTopic, setNewSubTopic] = useState('');
  const [newSubService, setNewSubService] = useState('');
  const [subResult, setSubResult] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [brokerProvider, setBrokerProvider] = useState('legacy');
  const [showBrokerConfig, setShowBrokerConfig] = useState(false);
  const brokerProviderInitializedRef = useRef(false);
  const [brokerConfigDraft, setBrokerConfigDraft] = useState({
    url: '', exchangeName: '', queuePrefix: '',
    msmqBaseQueuePath: '', msmqQueuePrefix: '',
    kafkaBrokers: '', kafkaClientId: '', kafkaTopicPrefix: '',
    ibmQueueManager: '', ibmChannel: '', ibmConnName: '', ibmQueuePrefix: '', ibmUsername: '', ibmPassword: '',
    apacheHost: '', apachePort: '', apacheTopicPrefix: '', apacheUsername: '', apachePassword: ''
  });
  const [brokerConfigLoading, setBrokerConfigLoading] = useState(false);
  const [brokerConfigError, setBrokerConfigError] = useState('');
  const importFileRef = useRef(null);
  const [importTargetManagerId, setImportTargetManagerId] = useState(null);
  const [expandedQueues, setExpandedQueues] = useState({});
  const [queueMessagesByKey, setQueueMessagesByKey] = useState({});
  const [queueMessagesLoadingByKey, setQueueMessagesLoadingByKey] = useState({});
  const queueImportFileRef = useRef(null);
  const [queueImportTarget, setQueueImportTarget] = useState(null);
  const messageImportFileRef = useRef(null);
  const [messageImportTarget, setMessageImportTarget] = useState(null);

  function toggleQueueExpanded(managerId, queueName) {
    const key = `${managerId}:${queueName}`;
    setExpandedQueues(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isQueueExpanded(managerId, queueName) {
    return expandedQueues[`${managerId}:${queueName}`] || false;
  }

  function getQueueKey(managerId, queueName) {
    return `${managerId}:${queueName}`;
  }

  async function fetchQueueMessages(managerId, queueName, { force = false } = {}) {
    const key = getQueueKey(managerId, queueName);
    if (!force && queueMessagesByKey[key]) return;

    setQueueMessagesLoadingByKey(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/export`);
      const payload = await readJsonResponse(res, 'Queue export');
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      setQueueMessagesByKey(prev => ({ ...prev, [key]: messages }));
    } catch (e) {
      setQueueMessagesByKey(prev => ({ ...prev, [key]: [] }));
      setPublishResult(`Failed loading ${queueName} messages: ${e.message || e}`);
    } finally {
      setQueueMessagesLoadingByKey(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleToggleQueueExpanded(managerId, queueName) {
    const expanded = isQueueExpanded(managerId, queueName);
    toggleQueueExpanded(managerId, queueName);
    if (!expanded) {
      await fetchQueueMessages(managerId, queueName, { force: true });
    }
  }

  function hasPermission(requiredPermission) {
    if (!requiredPermission) return true;
    if (!Array.isArray(permissions)) return false;
    if (permissions.includes('*')) return true;
    if (permissions.includes(requiredPermission)) return true;
    const parts = String(requiredPermission).split('.');
    if (parts.length > 1) {
      const wildcard = `${parts[0]}.*`;
      if (permissions.includes(wildcard)) return true;
    }
    return false;
  }

  const canQueueView = hasPermission('queue.view');
  const canQueueOperate = hasPermission('queue.operate');
  const canQueueConfigure = hasPermission('queue.configure');
  const canBrokerRead = hasPermission('broker.read');
  const canBrokerConfigure = hasPermission('broker.configure');

  async function refreshSubscriptions() {
    if (!canBrokerRead) return;
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
    if (!canBrokerConfigure) {
      setSubResult('Permission denied: broker.configure is required.');
      return;
    }
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
    if (!canQueueView) return;
    if (isInitialLoadRef.current) setLoading(true);
    try {
      const typesPromise = fetch('/api/librarian/data-types')
        .then(async res => {
          if (!res.ok) return [];
          const payload = await res.json();
          return Array.isArray(payload.types) ? payload.types : [];
        })
        .catch(() => []);

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
      const managersSerialized = JSON.stringify(managerList);
      if (managersSerialized !== prevManagersRef.current) {
        prevManagersRef.current = managersSerialized;
        setManagers(managerList);
      }

      const queueList = Array.isArray(queueData.queues) ? queueData.queues : [];
      const queuesSerialized = JSON.stringify(queueList);
      if (queuesSerialized !== prevQueuesRef.current) {
        prevQueuesRef.current = queuesSerialized;
        setQueues(queueList);
      }

      setRoutes(Array.isArray(routeData.routes) ? routeData.routes : []);
      setDataTypes(await typesPromise);

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
      const newConfigured = Object.fromEntries(configuredEntries.map(([managerId, data]) => [managerId, data.queues]));
      const newLengths = Object.fromEntries(configuredEntries.map(([managerId, data]) => [managerId, data.queueLengths]));

      const configuredSerialized = JSON.stringify(newConfigured);
      if (configuredSerialized !== prevConfiguredRef.current) {
        prevConfiguredRef.current = configuredSerialized;
        setConfiguredQueuesByManager(newConfigured);
      }

      const lengthsSerialized = JSON.stringify(newLengths);
      if (lengthsSerialized !== prevLengthsRef.current) {
        prevLengthsRef.current = lengthsSerialized;
        setQueueLengthsByManager(newLengths);
      }
    } catch (e) {
      setPublishResult(`Refresh failed: ${e.message || e}`);
    }
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    async function refreshAuthz() {
      try {
        const res = await fetch('/api/authz/me');
        const payload = await res.json();
        if (!res.ok) return;
        setPermissions(Array.isArray(payload.permissions) ? payload.permissions : []);
      } catch {
        setPermissions([]);
      }
    }

    async function refreshBrokerConfig() {
      try {
        const res = await fetch('/api/broker/config');
        if (!res.ok) return;
        const data = await res.json();
        const broker = data.broker || {};
        if (!brokerProviderInitializedRef.current) {
          setBrokerProvider(broker.provider || 'legacy');
          brokerProviderInitializedRef.current = true;
        }
        setBrokerConfigDraft(prev => ({
          url: broker.rabbitmq?.url || prev.url || '',
          exchangeName: broker.rabbitmq?.exchangeName || prev.exchangeName || '',
          queuePrefix: broker.rabbitmq?.queuePrefix || prev.queuePrefix || '',
          msmqBaseQueuePath: broker.msmq?.baseQueuePath || prev.msmqBaseQueuePath || '',
          msmqQueuePrefix: broker.msmq?.queuePrefix || prev.msmqQueuePrefix || '',
          kafkaBrokers: broker.kafka?.brokers || prev.kafkaBrokers || '',
          kafkaClientId: broker.kafka?.clientId || prev.kafkaClientId || '',
          kafkaTopicPrefix: broker.kafka?.topicPrefix || prev.kafkaTopicPrefix || '',
          ibmQueueManager: broker.ibm?.queueManager || prev.ibmQueueManager || '',
          ibmChannel: broker.ibm?.channel || prev.ibmChannel || '',
          ibmConnName: broker.ibm?.connName || prev.ibmConnName || '',
          ibmQueuePrefix: broker.ibm?.queuePrefix || prev.ibmQueuePrefix || '',
          ibmUsername: broker.ibm?.username || prev.ibmUsername || '',
          ibmPassword: '',
          apacheHost: broker.apache?.host || prev.apacheHost || '',
          apachePort: String(broker.apache?.port || prev.apachePort || ''),
          apacheTopicPrefix: broker.apache?.topicPrefix || prev.apacheTopicPrefix || '',
          apacheUsername: broker.apache?.username || prev.apacheUsername || '',
          apachePassword: ''
        }));
      } catch {
        // silently ignore
      }
    }

    refreshAuthz();
    refresh();
    refreshSubscriptions();
    refreshBrokerConfig();
  }, [canQueueView, canBrokerRead]);

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
          dataTypeId: configuredEntry.dataTypeId || 'text-string',
          dataTypeIds: normalizeTypeIdsForQueue(configuredEntry),
          queueClass: String(configuredEntry.queueClass || 'permanent').toLowerCase(),
          configuredOnly: false,
          createdByUser: configuredEntry.createdByUser === true,
        });
      }
      for (const [queueName, queueConfig] of Object.entries(configured)) {
        if (!byName.has(queueName)) {
          byName.set(queueName, {
            queueName,
            queueLength: knownLengths[queueName] ?? null,
            dataTypeId: queueConfig?.dataTypeId || 'text-string',
            dataTypeIds: normalizeTypeIdsForQueue(queueConfig),
            queueClass: String(queueConfig?.queueClass || 'permanent').toLowerCase(),
            configuredOnly: true,
            createdByUser: queueConfig?.createdByUser === true,
          });
        }
      }

      merged[managerId] = Array.from(byName.values()).sort((a, b) => a.queueName.localeCompare(b.queueName));
    }
    return merged;
  }, [managers, queuesByManager, configuredQueuesByManager, queueLengthsByManager]);

  const totalQueueCount = useMemo(
    () => Object.values(visibleQueuesByManager).reduce((sum, arr) => sum + arr.length, 0),
    [visibleQueuesByManager]
  );

  const availableDataTypes = useMemo(() => {
    const sorted = [...dataTypes].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    if (sorted.some(item => item.id === 'text-string')) {
      return sorted;
    }
    return [{ id: 'text-string', label: 'Text String' }, ...sorted];
  }, [dataTypes]);

  function normalizeTypeIdsForQueue(config) {
    const raw = Array.isArray(config?.dataTypeIds)
      ? config.dataTypeIds
      : (config?.dataTypeId ? [config.dataTypeId] : ['text-string']);
    const normalized = raw.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : ['text-string'];
  }

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



  function getDefaultTypeId() {
    return availableDataTypes[0]?.id || 'text-string';
  }

  function getDefaultTypeIds() {
    return [getDefaultTypeId()];
  }

  function normalizeQueueTypeIds(candidateIds, primaryTypeId) {
    const uniqueIds = Array.from(new Set((candidateIds || []).map(item => String(item || '').trim().toLowerCase()).filter(Boolean)));
    const normalizedPrimary = String(primaryTypeId || uniqueIds[0] || getDefaultTypeId()).trim().toLowerCase();
    const reordered = [normalizedPrimary, ...uniqueIds.filter(typeId => typeId !== normalizedPrimary)];
    return reordered.length > 0 ? reordered : getDefaultTypeIds();
  }

  function getGroupQueueEntries(group) {
    const byName = new Map();
    for (const instance of group.instances) {
      for (const queueItem of visibleQueuesByManager[instance.managerId] || []) {
        if (!byName.has(queueItem.queueName)) {
          byName.set(queueItem.queueName, queueItem);
        }
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.queueName.localeCompare(b.queueName));
  }

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
    const queueName = String(queueItem?.queueName || '').trim().toLowerCase();
    if (!queueName) return false;

    // Maintenance queues are explicitly marked internals, not every auto-created queue.
    return queueItem?.maintenance === true
      || queueName.startsWith('.')
      || queueName.startsWith('_')
      || queueName.startsWith('sys.')
      || queueName.startsWith('internal.');
  }

  async function handlePublish() {
    if (!canQueueOperate) {
      setPublishResult('Permission denied: queue.operate is required.');
      return;
    }
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
    if (!canQueueOperate) {
      setPublishResult('Permission denied: queue.operate is required.');
      return;
    }
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
    if (!canQueueOperate) {
      setPublishResult('Permission denied: queue.operate is required.');
      return;
    }
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
    if (!canQueueConfigure) {
      setPublishResult('Permission denied: queue.configure is required.');
      return;
    }
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
    if (!canQueueConfigure) {
      throw new Error('Permission denied: queue.configure is required.');
    }
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

  function openCreateQueueDialog(group) {
    if (!canQueueConfigure) {
      setPublishResult('Permission denied: queue.configure is required.');
      return;
    }
    setContextMenu(null);
    const defaultTypes = getDefaultTypeIds();
    setQueueDialog({
      mode: 'create',
      group,
      queueName: '',
      dataTypeIds: defaultTypes,
      primaryTypeId: defaultTypes[0],
      queueOptions: [],
    });
  }

  function openUpdateQueueDialog(group, preferredQueueName = null) {
    if (!canQueueConfigure) {
      setPublishResult('Permission denied: queue.configure is required.');
      return;
    }
    setContextMenu(null);
    const queueOptions = getGroupQueueEntries(group);
    if (queueOptions.length === 0) {
      setPublishResult(`Modify queue cancelled: ${group.groupId} has no queues.`);
      return;
    }
    const initialSelection = preferredQueueName
      ? queueOptions.find(item => item.queueName === preferredQueueName) || queueOptions[0]
      : queueOptions[0];
    setQueueDialog({
      mode: 'update',
      group,
      queueName: initialSelection.queueName,
      dataTypeIds: initialSelection.dataTypeIds || getDefaultTypeIds(),
      primaryTypeId: (initialSelection.dataTypeIds || getDefaultTypeIds())[0],
      queueOptions,
    });
  }

  async function submitQueueDialog() {
    if (!queueDialog) return;
    const queueName = queueDialog.queueName.trim();
    const dataTypeIds = normalizeQueueTypeIds(queueDialog.dataTypeIds, queueDialog.primaryTypeId);
    if (!queueName) {
      setPublishResult(`${queueDialog.mode === 'create' ? 'Create' : 'Modify'} queue cancelled: queue name is required.`);
      return;
    }
    if (dataTypeIds.length === 0) {
      setPublishResult(`${queueDialog.mode === 'create' ? 'Create' : 'Modify'} queue cancelled: at least one queue data type is required.`);
      return;
    }

    const group = queueDialog.group;
    setQueueDialog(null);

    try {
      if (queueDialog.mode === 'create') {
        const config = { ...DEFAULT_QUEUE_CONFIG, dataTypeId: dataTypeIds[0], dataTypeIds };
        const applied = await runQueueActionAcrossGroup(group, 'create', { queueName, config });
        setPublishResult(`Queue created for ${group.groupId}: ${queueName} [types=${dataTypeIds.join(', ')}] on ${applied} instance(s)`);
      } else {
        const updates = { ...DEFAULT_QUEUE_UPDATES, dataTypeId: dataTypeIds[0], dataTypeIds };
        const applied = await runQueueActionAcrossGroup(group, 'update', { queueName, updates });
        setPublishResult(`Queue modified for ${group.groupId}: ${queueName} [types=${dataTypeIds.join(', ')}] on ${applied} instance(s)`);
      }
      await refresh();
    } catch (e) {
      setPublishResult(`${queueDialog.mode === 'create' ? 'Create' : 'Modify'} queue failed: ${e.message || e}`);
    }
  }

  async function deleteQueue(group, initialQueueName = null) {
    if (!canQueueConfigure) {
      setPublishResult('Permission denied: queue.configure is required.');
      return;
    }
    setContextMenu(null);
    try {
      const queueName = String(initialQueueName || '').trim() || (() => {
        const queueNameInput = window.prompt(`Queue name to delete from queue manager ${group.groupId}:`, '');
        if (queueNameInput === null) return null;
        return queueNameInput.trim();
      })();

      if (queueName === null) return;
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

  function getGroupForManagerId(managerId) {
    const groupId = getManagerGroupId(managerId);
    return managerGroups.find(group => group.groupId === groupId) || null;
  }

  function handleQueueContextMenu(event, instance, queueItem) {
    if (!canQueueConfigure) return;
    event.preventDefault();
    const group = getGroupForManagerId(instance.managerId);
    if (!group) {
      setPublishResult(`Queue action unavailable: could not resolve queue manager group for ${instance.managerId}.`);
      return;
    }
    setContextMenu({
      type: 'queue',
      target: {
        queue: queueItem,
        queueName: queueItem.queueName,
        managerId: instance.managerId,
        group,
      },
      x: event.clientX,
      y: event.clientY,
    });
  }

  function copyQueueToFile(target) {
    try {
      const queueName = target.queueName;
      const managerId = target.managerId;
      const queueConfig = configuredQueuesByManager?.[managerId]?.[queueName] || {};
      const payload = {
        queueName,
        managerId,
        groupId: target.group.groupId,
        exportedAt: new Date().toISOString(),
        config: {
          ...queueConfig,
          dataTypeId: target.queue.dataTypeIds?.[0] || target.queue.dataTypeId || queueConfig.dataTypeId || 'text-string',
          dataTypeIds: target.queue.dataTypeIds || normalizeTypeIdsForQueue(queueConfig),
          createdByUser: target.queue.createdByUser === true,
        },
      };

      const fileSafeQueueName = queueName.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'queue';
      const filename = `${fileSafeQueueName}.queue.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPublishResult(`Queue exported to file: ${filename}`);
    } catch (e) {
      setPublishResult(`Copy queue to file failed: ${e.message || e}`);
    } finally {
      setContextMenu(null);
    }
  }

  function handleGroupContextMenu(event, group) {
    if (!canQueueConfigure && !canQueueOperate) return;
    event.preventDefault();
    setContextMenu({
      type: 'group',
      target: group,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleInstanceContextMenu(event, instance) {
    if (!canQueueOperate) return;
    event.preventDefault();
    setContextMenu({
      type: 'instance',
      target: instance,
      x: event.clientX,
      y: event.clientY,
    });
  }

  async function handleExportManager(managerId) {
    try {
      const res = await fetch(`/api/queues/${encodeURIComponent(managerId)}/export`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qm-export-${managerId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const queueCount = Object.keys(data.queues || {}).length;
      setPublishResult(`Exported ${queueCount} queue(s) from ${managerId}`);
    } catch (e) {
      setPublishResult(`Export failed: ${e.message || e}`);
    }
  }

  function handleImportClick(managerId) {
    setImportTargetManagerId(managerId);
    if (importFileRef.current) importFileRef.current.click();
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !importTargetManagerId) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const queues = data.queues;
      if (!queues || typeof queues !== 'object') throw new Error('Invalid export file: missing queues object');
      const overwrite = window.confirm(
        `Import ${Object.keys(queues).length} queue(s) into ${importTargetManagerId}?\n\nClick OK to also overwrite existing queue configs, or Cancel to skip existing queues.`
      );
      const res = await fetch(`/api/queues/${encodeURIComponent(importTargetManagerId)}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queues, overwrite })
      });
      const result = await readJsonResponse(res, 'Import');
      setPublishResult(
        `Imported into ${importTargetManagerId}: ${result.created?.length ?? 0} created, ${result.skipped?.length ?? 0} skipped, ${result.messagesImported ?? 0} message(s) loaded`
      );
      await refresh();
    } catch (e) {
      setPublishResult(`Import failed: ${e.message || e}`);
    }
  }

  async function handleExportQueue(managerId, queueName) {
    try {
      const res = await fetch(`/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/export`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `queue-export-${queueName}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPublishResult(`Queue ${queueName} exported`);
    } catch (e) {
      setPublishResult(`Queue export failed: ${e.message}`);
    }
  }

  async function handleImportQueueClick(managerId, queueName) {
    setQueueImportTarget({ managerId, queueName });
    if (queueImportFileRef.current) queueImportFileRef.current.click();
  }

  async function handleQueueImportFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !queueImportTarget) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const messages = data.messages || [];
      if (!Array.isArray(messages)) throw new Error('Invalid export file: messages must be an array');
      const updateConfig = window.confirm(
        `Import ${messages.length} message(s) into queue ${queueImportTarget.queueName}?\n\nClick OK to also update queue config, or Cancel to import messages only.`
      );
      const res = await fetch(
        `/api/queues/${encodeURIComponent(queueImportTarget.managerId)}/${encodeURIComponent(queueImportTarget.queueName)}/import`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages, updateConfig, config: data.config })
        }
      );
      const result = await readJsonResponse(res, 'Import');
      setPublishResult(
        `Imported into ${queueImportTarget.queueName}: ${result.messagesImported ?? 0} message(s) loaded, ${result.errors?.length ?? 0} error(s)`
      );
      await refresh();
    } catch (e) {
      setPublishResult(`Queue import failed: ${e.message}`);
    }
  }

  async function handleExportMessage(managerId, queueName, messageId) {
    try {
      const res = await fetch(
        `/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/messages/${encodeURIComponent(messageId)}/export`,
        { method: 'GET', headers: { 'content-type': 'application/json' } }
      );
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `message-export-${queueName}-${messageId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPublishResult(`Message ${messageId} exported`);
    } catch (e) {
      setPublishResult(`Message export failed: ${e.message}`);
    }
  }

  async function handleDeleteMessage(managerId, queueName, messageId) {
    if (!window.confirm(`Delete message ${messageId} from queue ${queueName}?`)) return;
    try {
      const res = await fetch(
        `/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/messages/${encodeURIComponent(messageId)}`,
        { method: 'DELETE', headers: { 'content-type': 'application/json' } }
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setPublishResult(`Message ${messageId} deleted from queue ${queueName}`);
      await refresh();
    } catch (e) {
      setPublishResult(`Message delete failed: ${e.message}`);
    }
  }

  async function saveBrokerConfig({ selfApprove = false } = {}) {
    if (!canBrokerConfigure) {
      setBrokerConfigError('Permission denied: broker.configure is required.');
      return;
    }
    setBrokerConfigLoading(true);
    setBrokerConfigError('');
    try {
      const payload = {
        provider: brokerProvider,
        url: brokerConfigDraft.url,
        exchangeName: brokerConfigDraft.exchangeName,
        queuePrefix: brokerConfigDraft.queuePrefix,
        msmqBaseQueuePath: brokerConfigDraft.msmqBaseQueuePath,
        msmqQueuePrefix: brokerConfigDraft.msmqQueuePrefix,
        kafkaBrokers: brokerConfigDraft.kafkaBrokers,
        kafkaClientId: brokerConfigDraft.kafkaClientId,
        kafkaTopicPrefix: brokerConfigDraft.kafkaTopicPrefix,
        ibmQueueManager: brokerConfigDraft.ibmQueueManager,
        ibmChannel: brokerConfigDraft.ibmChannel,
        ibmConnName: brokerConfigDraft.ibmConnName,
        ibmQueuePrefix: brokerConfigDraft.ibmQueuePrefix,
        ibmUsername: brokerConfigDraft.ibmUsername,
        ibmPassword: brokerConfigDraft.ibmPassword,
        apacheHost: brokerConfigDraft.apacheHost,
        apachePort: Number(brokerConfigDraft.apachePort || 0),
        apacheTopicPrefix: brokerConfigDraft.apacheTopicPrefix,
        apacheUsername: brokerConfigDraft.apacheUsername,
        apachePassword: brokerConfigDraft.apachePassword
      };
      if (selfApprove) payload.selfApprove = true;
      const res = await fetch('/api/broker/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Config update failed');
      }
      setShowBrokerConfig(false);
      brokerProviderInitializedRef.current = false; // reload active provider after apply
    } catch (e) {
      setBrokerConfigError(e.message || 'Config update failed');
    }
    setBrokerConfigLoading(false);
  }

  return (
    <div className="dashboard-container" style={{ position: 'relative' }}>
      <h2>Queue Manager Dashboard (Live)</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={refresh}>Refresh</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#42566b' }}>
          Queue manager backend
          <select
            value={brokerProvider}
            onChange={event => setBrokerProvider(event.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="legacy">Internal (legacy)</option>
            <option value="memory">In-Memory</option>
            <option value="rabbitmq">RabbitMQ</option>
            <option value="msmq">MSMQ</option>
            <option value="kafka">Kafka</option>
            <option value="ibm">IBM MQ</option>
            <option value="apache">Apache ActiveMQ</option>
          </select>
        </label>
        <button
          onClick={() => setShowBrokerConfig(prev => !prev)}
          disabled={!canBrokerConfigure}
          title={canBrokerConfigure ? 'Configure broker backend settings' : 'Requires broker.configure permission'}
        >
          {showBrokerConfig ? 'Hide Config' : 'Configure'}
        </button>
        <span style={{ fontSize: 12, color: '#555' }}>{loading ? 'Loading...' : `${managers.length} managers, ${totalQueueCount} queues`}</span>
        <span style={{ fontSize: 12, color: '#42566b' }}>Mode: {!canQueueView ? 'no access' : (canQueueConfigure ? 'configure' : (canQueueOperate ? 'operate' : 'view-only'))}</span>
        <span style={{ fontSize: 12, color: '#777' }}>Right-click a queue manager for queue actions, an instance for lifecycle actions, or an individual queue for modify/delete/copy actions.</span>
      </div>

      {showBrokerConfig && (
        <div style={{ border: '1px solid #b8d4f3', borderRadius: 6, padding: 14, background: '#f0f7ff', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f4c81', marginBottom: 2 }}>Broker Backend Configuration — {brokerProvider}</div>
          {brokerConfigError && <div style={{ color: 'red', fontSize: 12 }}>{brokerConfigError}</div>}

          {brokerProvider === 'rabbitmq' && (<>
            <input value={brokerConfigDraft.url} onChange={e => setBrokerConfigDraft(d => ({ ...d, url: e.target.value }))} placeholder="RabbitMQ URL (amqp://...)" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.exchangeName} onChange={e => setBrokerConfigDraft(d => ({ ...d, exchangeName: e.target.value }))} placeholder="Exchange name" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.queuePrefix} onChange={e => setBrokerConfigDraft(d => ({ ...d, queuePrefix: e.target.value }))} placeholder="Queue prefix" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
          </>)}

          {brokerProvider === 'msmq' && (<>
            <input value={brokerConfigDraft.msmqBaseQueuePath} onChange={e => setBrokerConfigDraft(d => ({ ...d, msmqBaseQueuePath: e.target.value }))} placeholder="MSMQ base queue path" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.msmqQueuePrefix} onChange={e => setBrokerConfigDraft(d => ({ ...d, msmqQueuePrefix: e.target.value }))} placeholder="MSMQ queue prefix" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
          </>)}

          {brokerProvider === 'kafka' && (<>
            <input value={brokerConfigDraft.kafkaBrokers} onChange={e => setBrokerConfigDraft(d => ({ ...d, kafkaBrokers: e.target.value }))} placeholder="Kafka brokers (comma-separated)" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.kafkaClientId} onChange={e => setBrokerConfigDraft(d => ({ ...d, kafkaClientId: e.target.value }))} placeholder="Kafka client ID" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.kafkaTopicPrefix} onChange={e => setBrokerConfigDraft(d => ({ ...d, kafkaTopicPrefix: e.target.value }))} placeholder="Kafka topic prefix" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
          </>)}

          {brokerProvider === 'ibm' && (<>
            <input value={brokerConfigDraft.ibmQueueManager} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmQueueManager: e.target.value }))} placeholder="IBM Queue Manager name" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.ibmChannel} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmChannel: e.target.value }))} placeholder="Channel (e.g. DEV.APP.SVRCONN)" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.ibmConnName} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmConnName: e.target.value }))} placeholder="Connection name (host(port))" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.ibmQueuePrefix} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmQueuePrefix: e.target.value }))} placeholder="IBM queue prefix" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.ibmUsername} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmUsername: e.target.value }))} placeholder="Username" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.ibmPassword} onChange={e => setBrokerConfigDraft(d => ({ ...d, ibmPassword: e.target.value }))} placeholder="Password" type="password" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
          </>)}

          {brokerProvider === 'apache' && (<>
            <input value={brokerConfigDraft.apacheHost} onChange={e => setBrokerConfigDraft(d => ({ ...d, apacheHost: e.target.value }))} placeholder="ActiveMQ host" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.apachePort} onChange={e => setBrokerConfigDraft(d => ({ ...d, apachePort: e.target.value }))} placeholder="Port (e.g. 61613)" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.apacheTopicPrefix} onChange={e => setBrokerConfigDraft(d => ({ ...d, apacheTopicPrefix: e.target.value }))} placeholder="Topic prefix" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.apacheUsername} onChange={e => setBrokerConfigDraft(d => ({ ...d, apacheUsername: e.target.value }))} placeholder="Username" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
            <input value={brokerConfigDraft.apachePassword} onChange={e => setBrokerConfigDraft(d => ({ ...d, apachePassword: e.target.value }))} placeholder="Password" type="password" style={{ fontSize: 12 }} disabled={brokerConfigLoading} />
          </>)}

          {(brokerProvider === 'legacy' || brokerProvider === 'memory') && (
            <div style={{ fontSize: 12, color: '#555' }}>No additional settings required for the {brokerProvider === 'legacy' ? 'internal (legacy)' : 'in-memory'} broker.</div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => saveBrokerConfig()} disabled={brokerConfigLoading} style={{ fontSize: 12 }}>
              {brokerConfigLoading ? 'Applying...' : 'Apply (needs 2nd approver)'}
            </button>
            <button
              onClick={() => saveBrokerConfig({ selfApprove: true })}
              disabled={brokerConfigLoading}
              style={{ fontSize: 12, background: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}
              title="Bypass two-person rule — requires broker.self-approve permission"
            >
              {brokerConfigLoading ? 'Applying...' : 'Self-Approve & Apply'}
            </button>
            <button onClick={() => { setShowBrokerConfig(false); setBrokerConfigError(''); }} disabled={brokerConfigLoading} style={{ fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fafbfc', minWidth: 320 }}>
        <h3 style={{ marginTop: 0 }}>Queue Managers and Broker Instances</h3>
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFileChange}
        />
        <input
          ref={queueImportFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleQueueImportFileChange}
        />
        <input
          ref={messageImportFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!file || !messageImportTarget) return;
            file.text().then(text => {
              const data = JSON.parse(text);
              const msg = data.message;
              if (!msg) throw new Error('Invalid message file: missing message object');
              // Re-enqueue this single message
              fetch(`/api/queues/${encodeURIComponent(messageImportTarget.managerId)}/${encodeURIComponent(messageImportTarget.queueName)}/import`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messages: [msg] })
              }).then(res => res.json()).then(result => {
                setPublishResult(`Message re-imported: ${result.messagesImported ?? 0} loaded`);
                refresh();
              }).catch(err => setPublishResult(`Message import failed: ${err.message}`));
            }).catch(err => setPublishResult(`File read failed: ${err.message}`));
          }}
        />
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
                {group.instances.length > 0 && (<>
                  <button
                    onClick={e => { e.stopPropagation(); handleExportManager(group.instances[0].managerId); }}
                    style={{ fontSize: 10, padding: '1px 7px', marginLeft: 4 }}
                    title={`Export queues & messages from ${group.instances[0].managerId} to a JSON file`}
                  >Export</button>
                  {canQueueConfigure && (
                    <button
                      onClick={e => { e.stopPropagation(); handleImportClick(group.instances[0].managerId); }}
                      style={{ fontSize: 10, padding: '1px 7px' }}
                      title={`Import queues & messages into ${group.instances[0].managerId} from a JSON file`}
                    >Import</button>
                  )}
                </>)}
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
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px', flexWrap: 'wrap' }}
                                onContextMenu={event => handleQueueContextMenu(event, instance, q)}
                              >
                                <span
                                  style={{ width: 12, color: '#5a6b7b', cursor: 'pointer', userSelect: 'none' }}
                                  onClick={() => handleToggleQueueExpanded(instance.managerId, q.queueName)}
                                >
                                  {isQueueExpanded(instance.managerId, q.queueName) ? '▾' : '▸'}
                                </span>
                                <span>📬</span>
                                <span style={{ fontSize: 12 }}>{q.queueName}</span>
                                {q.queueClass === 'temporary' && (
                                  <span style={{ fontSize: 10, color: '#8a4b00', background: '#ffe8cc', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                                    TEMP
                                  </span>
                                )}
                                {(q.dataTypeIds || [q.dataTypeId || 'text-string']).map((typeId, index) => (
                                  <span
                                    key={`${q.queueName}:${typeId}`}
                                    style={{
                                      fontSize: 10,
                                      color: index === 0 ? '#143b6f' : '#1e4c9a',
                                      background: index === 0 ? '#d6e7ff' : '#e6f0ff',
                                      borderRadius: 10,
                                      padding: '1px 6px',
                                      fontWeight: index === 0 ? 700 : 400,
                                    }}
                                    title={index === 0 ? 'Primary message type' : 'Allowed message type'}
                                  >
                                    {index === 0 ? '★ ' : ''}{typeId}
                                  </span>
                                ))}
                                <span style={{ fontSize: 10, color: '#555' }}>
                                  len: {q.queueLength ?? queueMessagesByKey[getQueueKey(instance.managerId, q.queueName)]?.length ?? 'n/a'}
                                </span>
                                {q.configuredOnly && <span style={{ fontSize: 10, color: '#777' }}>configured</span>}
                                {canQueueView && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleExportQueue(instance.managerId, q.queueName); }}
                                    style={{ fontSize: 9, padding: '1px 5px', marginLeft: 4 }}
                                    title={`Export queue ${q.queueName} and its messages`}
                                  >↓</button>
                                )}
                                {canQueueConfigure && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleImportQueueClick(instance.managerId, q.queueName); }}
                                    style={{ fontSize: 9, padding: '1px 5px' }}
                                    title={`Import messages into queue ${q.queueName}`}
                                  >↑</button>
                                )}
                              </div>
                              {isQueueExpanded(instance.managerId, q.queueName) && (
                                <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2, fontSize: 10, background: '#fafafa', borderRadius: 3, padding: '4px 0' }}>
                                  {queueMessagesLoadingByKey[getQueueKey(instance.managerId, q.queueName)] && (
                                    <li style={{ padding: '2px 4px', color: '#666' }}>Loading messages...</li>
                                  )}
                                  {!queueMessagesLoadingByKey[getQueueKey(instance.managerId, q.queueName)] && (queueMessagesByKey[getQueueKey(instance.managerId, q.queueName)] || []).length === 0 && (
                                    <li style={{ padding: '2px 4px', color: '#888' }}>No messages in queue</li>
                                  )}
                                  {(queueMessagesByKey[getQueueKey(instance.managerId, q.queueName)] || []).map((msg, idx) => (
                                    <li key={`${instance.managerId}:${q.queueName}:${idx}`} style={{ padding: '2px 4px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontSize: 9, color: '#999', minWidth: 20 }}>#{idx + 1}</span>
                                      <span style={{ flex: 1, wordBreak: 'break-word', color: '#555', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {typeof msg.message === 'string' ? msg.message.substring(0, 100) : JSON.stringify(msg.message).substring(0, 100)}
                                      </span>
                                      {canQueueView && (
                                        <button
                                          onClick={() => handleExportMessage(instance.managerId, q.queueName, msg.messageId || `msg-${idx}`)}
                                          style={{ fontSize: 8, padding: '1px 3px', flexShrink: 0 }}
                                          title="Copy message to file"
                                        >📋</button>
                                      )}
                                      {canQueueConfigure && (
                                        <button
                                          onClick={() => handleDeleteMessage(instance.managerId, q.queueName, msg.messageId || `msg-${idx}`)}
                                          style={{ fontSize: 8, padding: '1px 3px', flexShrink: 0, color: '#c33', borderColor: '#c33' }}
                                          title="Delete this message"
                                        >✕</button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
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
                                <span style={{ fontSize: 12 }}>.maintenance</span>
                                <span style={{ fontSize: 10, color: '#777' }}>
                                  {(visibleQueuesByManager[instance.managerId] || []).filter(q => isMaintenanceQueue(q)).length} item(s)
                                </span>
                              </div>
                              {isMaintenanceFolderExpanded(instance.managerId) && (
                                <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
                                  {(visibleQueuesByManager[instance.managerId] || []).filter(q => isMaintenanceQueue(q)).map(q => (
                                    <li key={`${instance.managerId}:maintenance:${q.queueName}`} style={{ marginBottom: 2 }}>
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px' }}
                                        onContextMenu={event => handleQueueContextMenu(event, instance, q)}
                                      >
                                        <span style={{ width: 12, color: '#5a6b7b' }}>•</span>
                                        <span>🧰</span>
                                        <span style={{ fontSize: 12 }}>{q.queueName}</span>
                                        {q.queueClass === 'temporary' && (
                                          <span style={{ fontSize: 10, color: '#8a4b00', background: '#ffe8cc', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                                            TEMP
                                          </span>
                                        )}
                                        {(q.dataTypeIds || [q.dataTypeId || 'text-string']).map((typeId, index) => (
                                          <span
                                            key={`${q.queueName}:maintenance:${typeId}`}
                                            style={{
                                              fontSize: 10,
                                              color: index === 0 ? '#143b6f' : '#1e4c9a',
                                              background: index === 0 ? '#d6e7ff' : '#e6f0ff',
                                              borderRadius: 10,
                                              padding: '1px 6px',
                                              fontWeight: index === 0 ? 700 : 400,
                                            }}
                                            title={index === 0 ? 'Primary message type' : 'Allowed message type'}
                                          >
                                            {index === 0 ? '★ ' : ''}{typeId}
                                          </span>
                                        ))}
                                        <span style={{ fontSize: 10, color: '#555' }}>
                                          len: {q.queueLength ?? queueMessagesByKey[getQueueKey(instance.managerId, q.queueName)]?.length ?? 'n/a'}
                                        </span>
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
            {contextMenu.type === 'group'
              ? contextMenu.target.groupId
              : contextMenu.type === 'instance'
                ? contextMenu.target.managerId
                : `${contextMenu.target.queueName} (${contextMenu.target.group.groupId})`}
          </div>
          {contextMenu.type === 'group' && (
            <>
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => openCreateQueueDialog(contextMenu.target)}
              >
                Add queue
              </button>}
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => openUpdateQueueDialog(contextMenu.target)}
              >
                Modify queue
              </button>}
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => deleteQueue(contextMenu.target)}
              >
                Delete queue
              </button>}
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleCreateManagerInstance(contextMenu.target)}
              >
                Create instance on localhost
              </button>}
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'quiesce')}
              >
                Quiesce all instances
              </button>}
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'maintenance')}
              >
                Put all instances in maintenance
              </button>}
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleGroupAction(contextMenu.target, 'return-service')}
              >
                Return all instances to service
              </button>}
            </>
          )}
          {contextMenu.type === 'instance' && (
            <>
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'quiesce')}
              >
                Quiesce instance
              </button>}
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'maintenance')}
              >
                Put instance in maintenance
              </button>}
              {canQueueOperate && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleManagerAction(contextMenu.target.managerId, 'return-service')}
              >
                Return instance to service
              </button>}
            </>
          )}
          {contextMenu.type === 'queue' && (
            <>
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => openUpdateQueueDialog(contextMenu.target.group, contextMenu.target.queueName)}
              >
                Modify queue
              </button>}
              {canQueueConfigure && <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => deleteQueue(contextMenu.target.group, contextMenu.target.queueName)}
              >
                Delete queue
              </button>}
              <button
                style={{ width: '100%', border: 'none', background: '#fff', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => copyQueueToFile(contextMenu.target)}
              >
                Copy queue to file
              </button>
            </>
          )}
        </div>
      )}

      {queueDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
          onClick={() => setQueueDialog(null)}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #d7dee5',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
              padding: 18,
            }}
            onClick={event => event.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>
              {queueDialog.mode === 'create' ? 'Add Queue' : 'Modify Queue'}
            </h3>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              Queue manager: {queueDialog.group.groupId}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {queueDialog.mode === 'create' ? (
                <label style={{ fontSize: 12, color: '#444' }}>
                  Queue Name
                  <input
                    autoFocus
                    value={queueDialog.queueName}
                    onChange={e => setQueueDialog(prev => ({ ...prev, queueName: e.target.value }))}
                    placeholder="new-queue"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
              ) : (
                <label style={{ fontSize: 12, color: '#444' }}>
                  Queue Name
                  <select
                    autoFocus
                    value={queueDialog.queueName}
                    onChange={e => {
                      const nextQueueName = e.target.value;
                      const selected = queueDialog.queueOptions.find(item => item.queueName === nextQueueName);
                      setQueueDialog(prev => ({
                        ...prev,
                        queueName: nextQueueName,
                        dataTypeIds: selected?.dataTypeIds || prev.dataTypeIds,
                      }));
                    }}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  >
                    {queueDialog.queueOptions.map(item => (
                      <option key={item.queueName} value={item.queueName}>{item.queueName}</option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ fontSize: 12, color: '#444' }}>
                Allowed Message Types
                <div style={{ display: 'grid', gap: 6, marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid #d7dee5', borderRadius: 6, padding: 8, background: '#fafbfc' }}>
                  {availableDataTypes.map(item => {
                    const checked = (queueDialog.dataTypeIds || []).includes(item.id);
                    return (
                      <label key={item.id} style={{ fontSize: 12, color: '#444', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setQueueDialog(prev => ({
                            ...prev,
                            dataTypeIds: e.target.checked
                              ? Array.from(new Set([...(prev.dataTypeIds || []), item.id]))
                              : (prev.dataTypeIds || []).filter(typeId => typeId !== item.id),
                          }))}
                        />
                        <span>{item.id}{item.label ? ` (${item.label})` : ''}</span>
                      </label>
                    );
                  })}
                </div>
              </label>

              <label style={{ fontSize: 12, color: '#444' }}>
                Primary Message Type
                <select
                  value={queueDialog.primaryTypeId || queueDialog.dataTypeIds?.[0] || getDefaultTypeId()}
                  onChange={e => {
                    const nextPrimary = e.target.value;
                    setQueueDialog(prev => {
                      const nextIds = Array.from(new Set([...(prev.dataTypeIds || []), nextPrimary]));
                      return {
                        ...prev,
                        primaryTypeId: nextPrimary,
                        dataTypeIds: normalizeQueueTypeIds(nextIds, nextPrimary),
                      };
                    });
                  }}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                >
                  {availableDataTypes.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.id}{item.label ? ` (${item.label})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setQueueDialog(null)}>
                Cancel
              </button>
              <button type="button" onClick={submitQueueDialog}>
                {queueDialog.mode === 'create' ? 'Create Queue' : 'Save Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
