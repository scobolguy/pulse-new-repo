import React, { useMemo, useState } from 'react';

function safeJson(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return res.json();
}

export default function RemoteQueueManagerHelper() {
  const defaultHost = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';

  const [aggregatorIp, setAggregatorIp] = useState(defaultHost);
  const [agentId, setAgentId] = useState('macbook-agent');
  const [agentBaseUrl, setAgentBaseUrl] = useState('http://192.168.1.50:4310');
  const [agentToken, setAgentToken] = useState('change-me');
  const [allowedPrefix, setAllowedPrefix] = useState('qm-primary');
  const [managerId, setManagerId] = useState('qm-primary-101');
  const [nodeId, setNodeId] = useState('macbook');
  const [port, setPort] = useState('4301');
  const [advertiseIp, setAdvertiseIp] = useState('');
  const [statusMsg, setStatusMsg] = useState('Ready. Register and ping your MacBook agent, then start from here.');
  const [syncData, setSyncData] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [remoteLauncher, setRemoteLauncher] = useState(null);
  const [busy, setBusy] = useState(false);

  const startCommand = useMemo(() => {
    const agg = `http://${aggregatorIp}:4000`;
    const safeAdvertiseIp = advertiseIp.trim() || '<MACBOOK_LAN_IP>';
    return [
      'node queue-manager-node.mjs',
      `--aggregator=${agg}`,
      `--port=${Number(port) || 4301}`,
      `--manager-id=${managerId.trim() || 'qm-primary-101'}`,
      `--name=${managerId.trim() || 'qm-primary-101'}`,
      `--node-id=${nodeId.trim() || 'macbook'}`,
      `--advertise-ip=${safeAdvertiseIp}`,
    ].join(' ');
  }, [aggregatorIp, advertiseIp, managerId, nodeId, port]);

  async function copyCommand() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(startCommand);
        setStatusMsg('Command copied to clipboard. Paste and run it on your MacBook terminal.');
        return;
      }
      setStatusMsg('Clipboard unavailable in this browser. Copy command manually.');
    } catch (e) {
      setStatusMsg(`Copy failed: ${e.message || e}`);
    }
  }

  async function checkSyncStatus() {
    const id = managerId.trim();
    if (!id) {
      setStatusMsg('Manager ID is required to check sync status.');
      return;
    }
    setStatusMsg(`Checking sync status for ${id} ...`);
    try {
      const res = await fetch(`/api/replication/manager-sync-status/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const body = await safeJson(res);
        const text = body?.error || `HTTP ${res.status}`;
        setStatusMsg(`Status check failed: ${text}`);
        setSyncData(null);
        return;
      }
      const data = await res.json();
      setSyncData(data);
      setStatusMsg(`Status: ${data.status || 'unknown'}, sync: ${data.syncState || 'unknown'}`);
    } catch (e) {
      setStatusMsg(`Status check error: ${e.message || e}`);
      setSyncData(null);
    }
  }

  async function registerAgent() {
    setBusy(true);
    try {
      const res = await fetch('/api/remote-agents/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId.trim(),
          baseUrl: agentBaseUrl.trim(),
          token: agentToken,
          allowedManagerPrefix: allowedPrefix.trim() || 'qm-primary',
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setStatusMsg(`Register failed: ${body?.error || `HTTP ${res.status}`}`);
        return;
      }
      setAgentData(body?.agent || null);
      setStatusMsg(`Agent ${agentId.trim()} registered.`);
    } catch (e) {
      setStatusMsg(`Register failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function pingAgent() {
    const id = agentId.trim();
    if (!id) {
      setStatusMsg('Agent ID is required.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/remote-agents/${encodeURIComponent(id)}/ping`, {
        method: 'POST',
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setStatusMsg(`Ping failed: ${body?.error || `HTTP ${res.status}`}`);
        return;
      }
      setAgentData(prev => ({ ...(prev || {}), lastKnownHealth: body?.health || null }));
      setStatusMsg(`Ping ok. Agent host: ${body?.health?.hostname || 'unknown'}`);
    } catch (e) {
      setStatusMsg(`Ping failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function startOnMacbook() {
    setBusy(true);
    try {
      const res = await fetch('/api/remote-queue-managers/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId.trim(),
          managerId: managerId.trim(),
          nodeId: nodeId.trim(),
          port: Number(port) || 4301,
          advertiseIp: advertiseIp.trim(),
          aggregatorUrl: `http://${aggregatorIp}:4000`,
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setStatusMsg(`Start failed: ${body?.error || `HTTP ${res.status}`}`);
        return;
      }
      setRemoteLauncher(body?.remote || null);
      setStatusMsg(`Start requested for ${managerId.trim()}. Sync: ${body?.sync?.state || 'n/a'}`);
      await checkSyncStatus();
    } catch (e) {
      setStatusMsg(`Start failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function stopOnMacbook() {
    const id = managerId.trim();
    if (!id) {
      setStatusMsg('Manager ID is required to stop.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/remote-queue-managers/${encodeURIComponent(id)}/stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agentId.trim() }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setStatusMsg(`Stop failed: ${body?.error || `HTTP ${res.status}`}`);
        return;
      }
      setStatusMsg(`Stop requested for ${id}.`);
      setRemoteLauncher(body?.remote || null);
    } catch (e) {
      setStatusMsg(`Stop failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function checkRemoteStatus() {
    const id = managerId.trim();
    if (!id) {
      setStatusMsg('Manager ID is required to check remote status.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/remote-queue-managers/${encodeURIComponent(id)}/status`);
      const body = await safeJson(res);
      if (!res.ok) {
        setStatusMsg(`Remote status failed: ${body?.error || `HTTP ${res.status}`}`);
        return;
      }
      setRemoteLauncher(body);
      setStatusMsg(`Remote status: ${body?.remoteStatus?.status || 'unknown'}`);
    } catch (e) {
      setStatusMsg(`Remote status failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <h2>Remote Queue Manager Control (MacBook)</h2>
      <p style={{ color: '#555', maxWidth: 860 }}>
        Register your remote MacBook agent once, ping to verify connectivity, then start and stop queue managers directly from this UI.
      </p>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8fafc' }}>
        <div style={{ marginBottom: 10, fontWeight: 600 }}>Remote Agent</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label>
            <div>Agent ID</div>
            <input value={agentId} onChange={e => setAgentId(e.target.value)} style={{ width: '100%' }} placeholder="macbook-agent" />
          </label>
          <label>
            <div>Agent Base URL</div>
            <input value={agentBaseUrl} onChange={e => setAgentBaseUrl(e.target.value)} style={{ width: '100%' }} placeholder="http://192.168.x.x:4310" />
          </label>
          <label>
            <div>Agent Token</div>
            <input value={agentToken} onChange={e => setAgentToken(e.target.value)} style={{ width: '100%' }} type="password" placeholder="shared-secret" />
          </label>
          <label>
            <div>Allowed Manager Prefix</div>
            <input value={allowedPrefix} onChange={e => setAllowedPrefix(e.target.value)} style={{ width: '100%' }} placeholder="qm-primary" />
          </label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={registerAgent} disabled={busy}>Register Agent</button>
          <button onClick={pingAgent} disabled={busy}>Ping Agent</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
        <label>
          <div>Aggregator IP</div>
          <input value={aggregatorIp} onChange={e => setAggregatorIp(e.target.value)} style={{ width: '100%' }} placeholder="192.168.x.x" />
        </label>
        <label>
          <div>Manager ID</div>
          <input value={managerId} onChange={e => setManagerId(e.target.value)} style={{ width: '100%' }} placeholder="qm-primary-101" />
        </label>
        <label>
          <div>Node ID</div>
          <input value={nodeId} onChange={e => setNodeId(e.target.value)} style={{ width: '100%' }} placeholder="macbook" />
        </label>
        <label>
          <div>Port</div>
          <input value={port} onChange={e => setPort(e.target.value)} style={{ width: '100%' }} placeholder="4301" />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <div>MacBook Advertise IP</div>
          <input value={advertiseIp} onChange={e => setAdvertiseIp(e.target.value)} style={{ width: '100%' }} placeholder="e.g. 192.168.2.25" />
        </label>
      </div>

      <div style={{ marginBottom: 10, fontWeight: 600 }}>Run this on your MacBook terminal:</div>
      <div style={{ whiteSpace: 'pre-wrap', background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, fontFamily: 'Consolas, monospace', fontSize: 12, border: '1px solid #1e293b', marginBottom: 12 }}>
        {startCommand}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={startOnMacbook} disabled={busy}>Start On MacBook</button>
        <button onClick={stopOnMacbook} disabled={busy}>Stop On MacBook</button>
        <button onClick={checkRemoteStatus} disabled={busy}>Check Remote Status</button>
        <button onClick={checkSyncStatus} disabled={busy}>Check Sync Status</button>
        <button onClick={copyCommand} disabled={busy}>Copy Manual Command</button>
      </div>

      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#334155', background: '#f8fafc', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
        {statusMsg}
      </div>

      {syncData && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#f3f4f6', padding: 10, fontWeight: 600 }}>Sync Status</div>
          <div style={{ padding: 12, fontSize: 13 }}>
            <div><strong>Manager:</strong> {syncData.managerId}</div>
            <div><strong>Status:</strong> {syncData.status}</div>
            <div><strong>Sync State:</strong> {syncData.syncState}</div>
            <div><strong>Sync Source:</strong> {syncData.syncSourceManagerId || 'n/a'}</div>
            <div><strong>Last Sync Version:</strong> {syncData.lastSyncVersion ?? 'n/a'}</div>
            <div><strong>Last Sync At:</strong> {syncData.lastSyncAt || 'n/a'}</div>
            <div><strong>Pending Sync:</strong> {String(!!syncData.pendingSync)}</div>
            {syncData.lastSyncError && <div style={{ color: '#b91c1c' }}><strong>Last Error:</strong> {syncData.lastSyncError}</div>}
          </div>
        </div>
      )}

      {agentData && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
          <div style={{ background: '#f3f4f6', padding: 10, fontWeight: 600 }}>Agent Status</div>
          <div style={{ padding: 12, fontSize: 13 }}>
            <div><strong>Agent:</strong> {agentId}</div>
            <div><strong>Base URL:</strong> {agentBaseUrl}</div>
            <div><strong>Health:</strong> {agentData?.lastKnownHealth?.status || 'unknown'}</div>
            <div><strong>Host:</strong> {agentData?.lastKnownHealth?.hostname || 'n/a'}</div>
          </div>
        </div>
      )}

      {remoteLauncher && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
          <div style={{ background: '#f3f4f6', padding: 10, fontWeight: 600 }}>Remote Launcher</div>
          <div style={{ padding: 12, fontSize: 13 }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: 12 }}>
              {JSON.stringify(remoteLauncher, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
