import { useEffect, useState } from 'react';

function hasPermission(permissions, requiredPermission) {
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

export default function BrokerStatusCard({ permissions = [] }) {
  const [state, setState] = useState('');
  const [classStatus, setClassStatus] = useState('unknown');
  const [brokers, setBrokers] = useState({});
  const [newInstanceId, setNewInstanceId] = useState('');
  const [brokerConfig, setBrokerConfig] = useState({ provider: 'legacy', rabbitmq: {} });
  const [configDraft, setConfigDraft] = useState({
    provider: 'legacy',
    url: '',
    exchangeName: '',
    queuePrefix: '',
    msmqBaseQueuePath: '',
    msmqQueuePrefix: '',
    kafkaBrokers: '',
    kafkaClientId: '',
    kafkaTopicPrefix: '',
    ibmQueueManager: '',
    ibmChannel: '',
    ibmConnName: '',
    ibmQueuePrefix: '',
    ibmUsername: '',
    ibmPassword: '',
    apacheHost: '',
    apachePort: '',
    apacheTopicPrefix: '',
    apacheUsername: '',
    apachePassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState('');

  const canConfigure = hasPermission(permissions, 'broker.configure');

  async function fetchState() {
    try {
      const [stateRes, configRes] = await Promise.all([
        fetch('/api/broker/state'),
        fetch('/api/broker/config')
      ]);
      const data = await stateRes.json();
      const configData = await configRes.json().catch(() => ({}));
      setState(data.state);
      setClassStatus(data.classStatus || 'unknown');
      setBrokers(data.brokers || {});
      const broker = configData.broker || {};
      setBrokerConfig(broker);
      setConfigDraft(current => ({
        provider: broker.provider || current.provider || 'legacy',
        url: broker.rabbitmq?.url || current.url || '',
        exchangeName: broker.rabbitmq?.exchangeName || current.exchangeName || '',
        queuePrefix: broker.rabbitmq?.queuePrefix || current.queuePrefix || '',
        msmqBaseQueuePath: broker.msmq?.baseQueuePath || current.msmqBaseQueuePath || '',
        msmqQueuePrefix: broker.msmq?.queuePrefix || current.msmqQueuePrefix || '',
        kafkaBrokers: broker.kafka?.brokers || current.kafkaBrokers || '',
        kafkaClientId: broker.kafka?.clientId || current.kafkaClientId || '',
        kafkaTopicPrefix: broker.kafka?.topicPrefix || current.kafkaTopicPrefix || '',
        ibmQueueManager: broker.ibm?.queueManager || current.ibmQueueManager || '',
        ibmChannel: broker.ibm?.channel || current.ibmChannel || '',
        ibmConnName: broker.ibm?.connName || current.ibmConnName || '',
        ibmQueuePrefix: broker.ibm?.queuePrefix || current.ibmQueuePrefix || '',
        ibmUsername: broker.ibm?.username || current.ibmUsername || '',
        ibmPassword: '',
        apacheHost: broker.apache?.host || current.apacheHost || '',
        apachePort: String(broker.apache?.port || current.apachePort || ''),
        apacheTopicPrefix: broker.apache?.topicPrefix || current.apacheTopicPrefix || '',
        apacheUsername: broker.apache?.username || current.apacheUsername || '',
        apachePassword: ''
      }));
      setError('');
    } catch {
      setError('Error fetching broker state');
    }
  }

  useEffect(() => {
    const scheduleFetchState = () => {
      setTimeout(() => {
        fetchState();
      }, 0);
    };
    const initTimer = setTimeout(scheduleFetchState, 0);
    const interval = setInterval(scheduleFetchState, 3000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  async function sendAction(path) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(path, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Action failed');
      }
      await fetchState();
    } catch (e) {
      setError(e.message || 'Action failed');
    }
    setLoading(false);
  }

  async function saveBrokerConfig() {
    if (!canConfigure) {
      setError('Permission denied: broker.configure is required.');
      return;
    }

    setConfigLoading(true);
    setError('');
    try {
      const payload = {
        provider: configDraft.provider,
        url: configDraft.url,
        exchangeName: configDraft.exchangeName,
        queuePrefix: configDraft.queuePrefix,
        msmqBaseQueuePath: configDraft.msmqBaseQueuePath,
        msmqQueuePrefix: configDraft.msmqQueuePrefix,
        kafkaBrokers: configDraft.kafkaBrokers,
        kafkaClientId: configDraft.kafkaClientId,
        kafkaTopicPrefix: configDraft.kafkaTopicPrefix,
        ibmQueueManager: configDraft.ibmQueueManager,
        ibmChannel: configDraft.ibmChannel,
        ibmConnName: configDraft.ibmConnName,
        ibmQueuePrefix: configDraft.ibmQueuePrefix,
        ibmUsername: configDraft.ibmUsername,
        ibmPassword: configDraft.ibmPassword,
        apacheHost: configDraft.apacheHost,
        apachePort: Number(configDraft.apachePort || 0),
        apacheTopicPrefix: configDraft.apacheTopicPrefix,
        apacheUsername: configDraft.apacheUsername,
        apachePassword: configDraft.apachePassword
      };
      const res = await fetch('/api/broker/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Config update failed');
      }
      await fetchState();
    } catch (e) {
      setError(e.message || 'Config update failed');
    }
    setConfigLoading(false);
  }

  function renderInstanceStatus(instanceId, instance) {
    const statusText = instance.active
      ? (instance.quiesced ? 'quiesced' : 'up')
      : 'down';
    return (
      <div key={instanceId} style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 8, width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{instanceId}</div>
        <div style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>{statusText}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/up`)}>Up</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/down`)}>Down</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/quiesce`)}>Quiesce</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/unquiesce`)}>Unquiesce</button>
        </div>
      </div>
    );
  }

  async function handleAddInstance() {
    const id = newInstanceId.trim().toLowerCase();
    if (!id) return;
    await sendAction(`/api/broker/instances/${encodeURIComponent(id)}/up`);
    setNewInstanceId('');
  }

  const brokerEntries = Object.entries(brokers || {}).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div style={{ border: '1px solid #d4d4d4', background: '#e3f2fd', borderRadius: 4, padding: 12, minWidth: 220, maxWidth: 360, marginBottom: 16, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90caf9" stroke="#1976d2" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#1976d2" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#1976d2"/></svg>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1976d2', marginBottom: 2, textAlign: 'center' }}>Message Broker</div>
      <div style={{ fontSize: 12, color: '#333', marginBottom: 4, textAlign: 'center' }}>( {state || 'unknown'} )</div>
      <div style={{ fontSize: 12, color: classStatus === 'down' ? '#a32020' : '#1d6b2a', fontWeight: 600 }}>Class: {classStatus}</div>
      {error && <div style={{ color: 'red', fontSize: 11 }}>{error}</div>}
      <div style={{ width: '100%', border: '1px solid #b8d4f3', background: '#f7fbff', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f4c81' }}>Broker Provider</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={configDraft.provider}
            onChange={e => setConfigDraft(draft => ({ ...draft, provider: e.target.value }))}
            disabled={configLoading || !canConfigure}
            style={{ fontSize: 11, flex: '1 1 120px' }}
          >
            <option value="legacy">legacy</option>
            <option value="memory">memory</option>
            <option value="rabbitmq">rabbitmq</option>
            <option value="msmq">msmq</option>
            <option value="kafka">kafka</option>
            <option value="ibm">ibm</option>
            <option value="apache">apache</option>
          </select>
          <button disabled={configLoading || !canConfigure} style={{ fontSize: 11 }} onClick={saveBrokerConfig}>
            {configLoading ? 'Saving...' : 'Apply'}
          </button>
        </div>
        <input
          value={configDraft.url}
          onChange={e => setConfigDraft(draft => ({ ...draft, url: e.target.value }))}
          placeholder="RabbitMQ URL"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'rabbitmq'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.exchangeName}
          onChange={e => setConfigDraft(draft => ({ ...draft, exchangeName: e.target.value }))}
          placeholder="Exchange name"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'rabbitmq'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.queuePrefix}
          onChange={e => setConfigDraft(draft => ({ ...draft, queuePrefix: e.target.value }))}
          placeholder="Queue prefix"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'rabbitmq'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.msmqBaseQueuePath}
          onChange={e => setConfigDraft(draft => ({ ...draft, msmqBaseQueuePath: e.target.value }))}
          placeholder="MSMQ base queue path"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'msmq'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.msmqQueuePrefix}
          onChange={e => setConfigDraft(draft => ({ ...draft, msmqQueuePrefix: e.target.value }))}
          placeholder="MSMQ queue prefix"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'msmq'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.kafkaBrokers}
          onChange={e => setConfigDraft(draft => ({ ...draft, kafkaBrokers: e.target.value }))}
          placeholder="Kafka brokers (comma-separated)"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'kafka'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.kafkaClientId}
          onChange={e => setConfigDraft(draft => ({ ...draft, kafkaClientId: e.target.value }))}
          placeholder="Kafka client id"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'kafka'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.kafkaTopicPrefix}
          onChange={e => setConfigDraft(draft => ({ ...draft, kafkaTopicPrefix: e.target.value }))}
          placeholder="Kafka topic prefix"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'kafka'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmQueueManager}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmQueueManager: e.target.value }))}
          placeholder="IBM queue manager"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmChannel}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmChannel: e.target.value }))}
          placeholder="IBM channel"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmConnName}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmConnName: e.target.value }))}
          placeholder="IBM connection name"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmQueuePrefix}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmQueuePrefix: e.target.value }))}
          placeholder="IBM queue prefix"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmUsername}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmUsername: e.target.value }))}
          placeholder="IBM username"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.ibmPassword}
          onChange={e => setConfigDraft(draft => ({ ...draft, ibmPassword: e.target.value }))}
          placeholder="IBM password"
          type="password"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'ibm'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.apacheHost}
          onChange={e => setConfigDraft(draft => ({ ...draft, apacheHost: e.target.value }))}
          placeholder="Apache broker host"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'apache'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.apachePort}
          onChange={e => setConfigDraft(draft => ({ ...draft, apachePort: e.target.value }))}
          placeholder="Apache broker port"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'apache'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.apacheTopicPrefix}
          onChange={e => setConfigDraft(draft => ({ ...draft, apacheTopicPrefix: e.target.value }))}
          placeholder="Apache topic prefix"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'apache'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.apacheUsername}
          onChange={e => setConfigDraft(draft => ({ ...draft, apacheUsername: e.target.value }))}
          placeholder="Apache username"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'apache'}
          style={{ fontSize: 11 }}
        />
        <input
          value={configDraft.apachePassword}
          onChange={e => setConfigDraft(draft => ({ ...draft, apachePassword: e.target.value }))}
          placeholder="Apache password"
          type="password"
          disabled={configLoading || !canConfigure || configDraft.provider !== 'apache'}
          style={{ fontSize: 11 }}
        />
        <div style={{ fontSize: 11, color: '#4a4a4a' }}>
          Active: {brokerConfig.provider || 'unknown'} {brokerConfig.secondaryRunning ? '(secondary running)' : ''}
        </div>
        {!canConfigure && <div style={{ fontSize: 11, color: '#a32020' }}>Read-only: broker.configure required to change provider.</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('/api/broker/class/up')}>Class Up</button>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('/api/broker/class/down')}>Class Down</button>
      </div>
      <div style={{ width: '100%', display: 'flex', gap: 6 }}>
        <input
          value={newInstanceId}
          onChange={e => setNewInstanceId(e.target.value)}
          placeholder="new instance id"
          style={{ flex: 1, fontSize: 11 }}
          disabled={loading}
        />
        <button disabled={loading || !newInstanceId.trim()} style={{ fontSize: 11 }} onClick={handleAddInstance}>Add/Up</button>
      </div>
      <div style={{ width: '100%', fontSize: 11, color: '#4a4a4a' }}>Instances: {brokerEntries.length}</div>
      {brokerEntries.map(([instanceId, instance]) => renderInstanceStatus(instanceId, instance))}
    </div>
  );
}
