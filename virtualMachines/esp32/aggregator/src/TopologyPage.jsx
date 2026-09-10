import { useEffect, useMemo, useState } from 'react';
import { Bell, Camera, ChevronDown, ChevronRight, Clock3, Database, Droplets, Fingerprint, Gauge, HousePlug, Lightbulb, Lock, LockOpen, Monitor, Network, Pencil, PlugZap, Power, PowerOff, RefreshCw } from 'lucide-react';

const REFRESH_MS = 30_000;

function normalizeNodeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getNodeKey(node) {
  return normalizeNodeKey(node?.topology?.nodeKey || node?.nodeId || node?.nodeName || node?.ip);
}

function getNodeLabel(node) {
  return String(node?.nodeName || node?.details?.nodeName || node?.nodeId || node?.ip || 'unknown').trim();
}

function getNodeTransport(node) {
  let rawMetadata = null;
  try { rawMetadata = typeof node?.raw === 'string' ? JSON.parse(node.raw) : node?.raw; } catch { rawMetadata = null; }
  const candidates = [
    node?.protocol,
    node?.scheme,
    node?.url,
    node?.baseUrl,
    node?.statusUrl,
    node?.servicesUrl,
    node?.details?.protocol,
    node?.details?.scheme,
    node?.details?.url,
    node?.details?.baseUrl,
    node?.details?.statusUrl,
    node?.details?.servicesUrl,
    rawMetadata?.statusUrl,
    rawMetadata?.servicesUrl
  ];
  const advertisedUrl = candidates.find((value) => /^https?:\/\//i.test(String(value || '').trim()));
  let advertisedPort = null;
  if (advertisedUrl) {
    try { advertisedPort = Number(new URL(String(advertisedUrl)).port || 0) || null; } catch { advertisedPort = null; }
  }
  const usesHttps = node?.httpsPort != null
    || node?.details?.httpsPort != null
    || node?.httpsEnabled === true
    || node?.details?.httpsEnabled === true
    || candidates.some((value) => /^https(?::|$)/i.test(String(value || '').trim()));
  const explicitProtocol = String(node?.protocol || node?.details?.protocol || '').trim().toLowerCase();
  const protocol = usesHttps ? 'https' : (explicitProtocol || 'http');
  if (protocol !== 'http' && protocol !== 'https') {
    const ip = String(node?.ip || '').trim();
    const port = Number(node?.port || 0);
    return {
      protocol,
      port,
      endpoint: ip ? `${protocol}://${ip}${port ? `:${port}` : ''}` : `${protocol}://n/a`
    };
  }
  const defaultPort = usesHttps ? 443 : 80;
  const port = Number(usesHttps
    ? (node?.httpsPort || node?.details?.httpsPort || advertisedPort || node?.port || defaultPort)
    : (advertisedPort || node?.port || node?.details?.httpPort || defaultPort));
  const ip = String(node?.ip || '').trim();
  return {
    protocol,
    port,
    endpoint: ip ? `${protocol}://${ip}${port === defaultPort ? '' : `:${port}`}` : `${protocol}://n/a`
  };
}

function getNodeCapabilities(node) {
  const details = node?.details || {};
  const serviceNames = (Array.isArray(details.services) ? details.services : [])
    .map((service) => String(typeof service === 'string' ? service : service?.name || '').toLowerCase());
  const metadata = [
    details.hardware,
    details.deviceRole,
    details.preferredTaskType,
    node?.hardware,
    node?.deviceRole,
    ...serviceNames
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  const doorbell = metadata.includes('doorbell');
  return {
    doorbell,
    camera: doorbell || metadata.includes('camera') || metadata.includes('esp32-cam'),
    display: metadata.includes('display'),
    sensor: metadata.includes('sensorservice') || metadata.includes('time-sensor'),
    timeAuthority: metadata.includes('timeauthorityservice') || metadata.includes('time-authority'),
    filesystem: serviceNames.some((name) => name === 'ffs'),
    uniqueId: metadata.includes('uniqueidservice'),
    homeAutomation: metadata.includes('home-automation'),
    light: metadata.includes('bulb') || metadata.includes('light'),
    plug: metadata.includes('plug') || metadata.includes('outlet') || metadata.includes('switch'),
    waterController: metadata.includes('water_controller') || metadata.includes('water controller') || metadata.includes('melnor')
  };
}

function NodeCapabilityIcons({ node }) {
  const capabilities = getNodeCapabilities(node);
  return (
    <span className="topology-device-icons" aria-label="Device capabilities">
      {capabilities.doorbell ? <Bell size={16} aria-label="Doorbell" /> : null}
      {capabilities.camera ? <Camera size={16} aria-label="Camera" /> : null}
      {capabilities.display ? <Monitor size={16} aria-label="Display" /> : null}
      {capabilities.sensor ? <Gauge size={16} aria-label="Sensors" /> : null}
      {capabilities.timeAuthority ? <Clock3 size={16} aria-label="Time authority" /> : null}
      {capabilities.filesystem ? <Database size={16} aria-label="File system" /> : null}
      {capabilities.uniqueId ? <Fingerprint size={16} aria-label="Unique ID" /> : null}
      {capabilities.homeAutomation ? <HousePlug size={16} aria-label="Home automation" /> : null}
      {capabilities.light ? <Lightbulb size={16} aria-label="Smart light" /> : null}
      {capabilities.plug ? <PlugZap size={16} aria-label="Smart plug" /> : null}
      {capabilities.waterController ? <Droplets size={16} aria-label="Water controller" /> : null}
    </span>
  );
}

function TransportBadge({ protocol }) {
  const secure = protocol === 'https';
  const webProtocol = protocol === 'http' || protocol === 'https';
  const TransportIcon = secure ? Lock : (webProtocol ? LockOpen : Network);
  return (
    <span
      title={`Communicating via ${protocol.toUpperCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '1px 5px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 700,
        color: secure ? '#1f6f43' : (webProtocol ? '#57606a' : '#8250df'),
        background: secure ? '#dafbe1' : (webProtocol ? '#eaeef2' : '#f5f0ff')
      }}
    >
      <TransportIcon size={13} aria-hidden="true" />
      {protocol.toUpperCase()}
    </span>
  );
}

function buildTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byKey = new Map();
  const childrenByParent = new Map();

  for (const node of list) {
    const key = getNodeKey(node);
    if (!key) continue;
    byKey.set(key, node);
  }

  for (const node of list) {
    const key = getNodeKey(node);
    if (!key) continue;
    const parent = normalizeNodeKey(node?.topology?.parentNodeId);
    if (!parent) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(key);
  }

  const roots = [];
  const freePool = [];
  for (const key of byKey.keys()) {
    const parent = normalizeNodeKey(byKey.get(key)?.topology?.parentNodeId);
    const hasChildren = (childrenByParent.get(key) || []).length > 0;
    if (!parent && hasChildren) roots.push(key);
    else if (!parent || !byKey.has(parent)) freePool.push(key);
  }

  roots.sort((a, b) => a.localeCompare(b));
  freePool.sort((a, b) => a.localeCompare(b));
  for (const [parent, childKeys] of childrenByParent.entries()) {
    childKeys.sort((a, b) => a.localeCompare(b));
    childrenByParent.set(parent, childKeys);
  }

  return { byKey, childrenByParent, roots, freePool };
}

function isHomeAutomationNode(node) {
  const topology = node?.topology || {};
  const role = String(node?.deviceRole || node?.details?.deviceRole || '').toLowerCase();
  return topology.activeClusterId === 'home-automation'
    || topology.parentNodeId === 'home-automation'
    || role.includes('home-automation');
}

function buildHomeAutomationNodes(devices) {
  const root = {
    nodeId: 'home-automation',
    nodeName: 'Home Automation',
    ip: '127.0.0.1',
    protocol: 'http',
    details: {
      hardware: 'Home Automation Gateway',
      deviceRole: 'home-automation',
      topologyManaged: true,
      services: [{ name: 'HomeAutomationService', status: 'online' }]
    },
    topology: { nodeKey: 'home-automation', parentNodeId: '', activeClusterId: 'home-automation' }
  };
  const children = (Array.isArray(devices) ? devices : []).map(device => ({
    nodeId: device.id,
    nodeName: device.name || device.id,
    ip: device.ip,
    port: device.port,
    protocol: device.protocol,
    status: device.online === false ? 'unavailable' : 'available',
    details: {
      hardware: `${device.vendor || ''} ${device.deviceType || ''}`.trim(),
      deviceRole: 'home-automation-device',
      topologyManaged: true,
      manageable: device.manageable === true,
      powerState: typeof device.powerState === 'boolean' ? device.powerState : null,
      managementReason: device.managementReason || '',
      rssi: device.rssi,
      distanceFeet: device.distanceFeet,
      services: [{ name: 'HomeAutomationDevice', status: device.online === false ? 'offline' : 'online' }]
    },
    topology: { nodeKey: normalizeNodeKey(device.id), parentNodeId: 'home-automation', activeClusterId: 'home-automation' }
  }));
  return [root, ...children];
}

function buildCameraNodes(cameras) {
  const root = {
    nodeId: 'cameras',
    nodeName: 'Cameras',
    ip: '127.0.0.1',
    protocol: 'http',
    details: {
      hardware: 'ONVIF Camera Gateway',
      deviceRole: 'camera-gateway',
      topologyManaged: true,
      services: [{ name: 'OnvifCameraService', status: 'online' }]
    },
    topology: { nodeKey: 'cameras', parentNodeId: '', activeClusterId: 'cameras' }
  };
  const children = (Array.isArray(cameras) ? cameras : []).map(camera => ({
    nodeId: camera.id,
    nodeName: camera.name || camera.id,
    ip: camera.host,
    port: camera.onvifPort || camera.rtspPort,
    protocol: 'onvif',
    status: (camera.onvifPort || camera.rtspPort) ? 'available' : 'unavailable',
    details: {
      hardware: 'Tapo/ONVIF Camera',
      deviceRole: 'camera',
      topologyManaged: true,
      manageable: false,
      services: [
        { name: 'ONVIF', status: camera.onvifPort ? 'online' : 'unavailable' },
        { name: 'RTSP', status: camera.rtspPort ? 'online' : 'unavailable' }
      ]
    },
    topology: { nodeKey: normalizeNodeKey(camera.id), parentNodeId: 'cameras', activeClusterId: 'cameras' }
  }));
  return [root, ...children];
}

function TreeNode({ nodeKey, tree, workloadsByNode, depth = 0, expanded, onToggle, onRename, onSetParent, onDeviceAction, busyNodeKey }) {
  const node = tree.byKey.get(nodeKey);
  if (!node) return null;

  const children = tree.childrenByParent.get(nodeKey) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded[nodeKey] === true;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | checking | ready | needs-credentials | error
  const [cameraStatusError, setCameraStatusError] = useState('');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState('');

  const nodeName = getNodeLabel(node);
  const clusterId = String(node?.topology?.activeClusterId || 'default');
  const clusterController = node?.topology?.clusterController === true;
  const siteName = String(node?.topology?.siteName || node?.topology?.siteId || 'primary-site');
  const siteMode = String(node?.topology?.siteMode || 'hot-warm');
  const siteCategory = String(node?.topology?.siteCategory || 'internal');
  const transport = getNodeTransport(node);
  const topologyManaged = node?.details?.topologyManaged === true;
  const manageable = node?.details?.manageable === true;
  const powerState = typeof node?.details?.powerState === 'boolean' ? node.details.powerState : null;
  const managementReason = String(node?.details?.managementReason || '').trim();
  const rssi = Number(node?.details?.rssi);
  const distanceFeet = Number(node?.details?.distanceFeet);
  const workloads = workloadsByNode.get(getNodeKey(node)) || [];
  const details = node?.details || {};
  const isCamera = String(details.deviceRole || '').toLowerCase() === 'camera';
  const cameraStreamUrl = isCamera ? `/api/cameras/${encodeURIComponent(node.nodeId)}/stream.mjpeg` : null;

  async function checkCameraStatus() {
    setCameraStatus('checking');
    setCameraStatusError('');
    try {
      const response = await fetch(`/api/cameras/${encodeURIComponent(node.nodeId)}/status`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCameraStatus(payload?.needsCredentials ? 'needs-credentials' : 'error');
        setCameraStatusError(String(payload?.error || `Camera unavailable (${response.status})`));
        return;
      }
      setCameraStatus('ready');
    } catch (nextError) {
      setCameraStatus('error');
      setCameraStatusError(String(nextError?.message || nextError));
    }
  }

  function handleCameraHoverEnter() {
    if (!isCamera) return;
    setPreviewOpen(true);
    if (cameraStatus === 'idle' || cameraStatus === 'error') void checkCameraStatus();
  }

  function handleCameraHoverLeave() {
    if (!isCamera) return;
    setPreviewOpen(false);
  }

  async function handleSaveCameraCredentials(event) {
    event.preventDefault();
    setCredSaving(true);
    setCredError('');
    try {
      const response = await fetch('/api/cameras/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: credUsername, password: credPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Save failed (${response.status})`);
      setCredPassword('');
      await checkCameraStatus();
    } catch (nextError) {
      setCredError(String(nextError?.message || nextError));
    } finally {
      setCredSaving(false);
    }
  }
  const devices = [
    ...(Array.isArray(details.devices) ? details.devices : []),
    ...(Array.isArray(details.localDevices) ? details.localDevices : []),
    ...(Array.isArray(node?.devices) ? node.devices : [])
  ];
  const staticServices = Array.isArray(details.services) ? details.services : [];
  const services = [
    ...staticServices,
    ...workloads.filter((workload) => workload.workloadKind === 'service')
  ];
  const daemons = workloads.filter((workload) => workload.workloadKind === 'daemon');
  const transientPrograms = workloads.filter((workload) => workload.workloadKind === 'transient');

  function resourceLabel(resource, fallback) {
    if (typeof resource === 'string') return resource;
    return String(resource?.name || resource?.id || resource?.serviceName || resource?.instanceId || fallback);
  }

  function ResourceDropdown({ label, items, kind }) {
    if (!items.length) return null;
    return (
      <details className="topology-resource-dropdown" style={{ marginLeft: `${(depth + 1) * 16 + 28}px`, marginTop: '4px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#57606a' }}>
          {label} ({items.length})
        </summary>
        <div style={{ display: 'grid', gap: '4px', margin: '5px 0 0 16px' }}>
          {items.map((item, index) => (
            <div key={`${kind}-${item?.instanceId || item?.id || item?.name || index}`} style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>{resourceLabel(item, `${label} ${index + 1}`)}</span>
              {item?.status || item?.state ? <span className="topology-node-badge">{item.status || item.state}</span> : null}
              {item?.inputQueue ? <span className="topology-node-meta">in: {item.inputQueue}</span> : null}
              {item?.outputQueue ? <span className="topology-node-meta">out: {item.outputQueue}</span> : null}
            </div>
          ))}
        </div>
      </details>
    );
  }

  const handleToggle = () => {
    onToggle(nodeKey);
  };

  return (
    <li
      style={{ position: 'relative' }}
      onMouseEnter={handleCameraHoverEnter}
      onMouseLeave={handleCameraHoverLeave}
    >
      <div
        className="topology-node"
        style={{ marginLeft: `${depth * 16}px`, display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: '12px',
              color: '#666',
              minWidth: '20px'
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={{ width: '20px', display: 'inline-block' }}></span>
        )}
        <span className="topology-node-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <NodeCapabilityIcons node={node} />
          {nodeName}
          <TransportBadge protocol={transport.protocol} />
        </span>
        <span className="topology-node-meta">{transport.endpoint}</span>
        <span className="topology-node-meta">cluster: {clusterId}</span>
        <span className="topology-node-meta">site: {siteName} ({siteMode}, {siteCategory})</span>
        {clusterController ? <span className="topology-node-badge">clusterController</span> : null}
        {hasChildren ? <span className="topology-node-badge" style={{ backgroundColor: '#e3f2fd' }}>+{children.length} children</span> : null}
        {manageable ? (
          <span
            className="topology-node-badge"
            aria-label={`${nodeName} power is ${powerState == null ? 'unknown' : powerState ? 'on' : 'off'}`}
            style={{
              color: powerState == null ? '#57606a' : powerState ? '#116329' : '#82071e',
              backgroundColor: powerState == null ? '#eaeef2' : powerState ? '#dafbe1' : '#ffebe9'
            }}
          >
            {powerState == null ? 'UNKNOWN' : powerState ? 'ON' : 'OFF'}
          </span>
        ) : null}
        {topologyManaged && !manageable && managementReason ? (
          <span className="topology-node-badge" title={managementReason} style={{ color: '#57606a', backgroundColor: '#eaeef2' }}>
            MONITOR ONLY
          </span>
        ) : null}
        {Number.isFinite(rssi) && rssi !== 0 ? (
          <span className="topology-node-meta">
            signal: {rssi} dBm{Number.isFinite(distanceFeet) && distanceFeet > 0 ? ` (~${distanceFeet.toFixed(1)} ft)` : ''}
          </span>
        ) : null}
        <span className="topology-node-tools">
          {manageable ? <>
            <button type="button" title="Turn on" aria-label={`Turn on ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'on')}><Power size={14} aria-hidden="true" /></button>
            <button type="button" title="Turn off" aria-label={`Turn off ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'off')}><PowerOff size={14} aria-hidden="true" /></button>
            <button type="button" title="Toggle power" aria-label={`Toggle ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'toggle')}><RefreshCw size={14} aria-hidden="true" /></button>
          </> : null}
          {!topologyManaged ? <>
            <button type="button" title="Rename node" aria-label={`Rename ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onRename(node)}><Pencil size={14} aria-hidden="true" /></button>
            <button type="button" title="Set parent node" aria-label={`Set parent for ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onSetParent(node)}><Network size={14} aria-hidden="true" /></button>
          </> : null}
        </span>
      </div>
      {isCamera && previewOpen ? (
        <div
          className="topology-camera-preview"
          style={{
            position: 'absolute',
            top: '100%',
            left: `${depth * 16 + 28}px`,
            zIndex: 20,
            width: '320px',
            minHeight: cameraStatus === 'ready' ? undefined : '80px',
            aspectRatio: cameraStatus === 'ready' ? '4 / 3' : undefined,
            background: '#0b0d10',
            color: '#f5f7fa',
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            fontSize: '12px'
          }}
        >
          {cameraStatus === 'checking' ? (
            <div style={{ padding: '12px' }}>Checking camera…</div>
          ) : null}
          {cameraStatus === 'ready' ? (
            <img
              src={cameraStreamUrl}
              alt={`Live preview of ${nodeName}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={() => { setCameraStatus('error'); setCameraStatusError('Stream connection failed.'); }}
            />
          ) : null}
          {cameraStatus === 'needs-credentials' ? (
            <form onSubmit={handleSaveCameraCredentials} style={{ padding: '10px', display: 'grid', gap: '6px' }}>
              <div style={{ fontWeight: 600 }}>Tapo camera account required</div>
              <div style={{ color: '#aeb7c2' }}>Enter the Camera Account credentials from the Tapo app (Advanced Settings).</div>
              <input
                type="text"
                placeholder="Username"
                value={credUsername}
                onChange={(event) => setCredUsername(event.target.value)}
                autoComplete="off"
                required
                style={{ padding: '4px 6px' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={credPassword}
                onChange={(event) => setCredPassword(event.target.value)}
                autoComplete="off"
                required
                style={{ padding: '4px 6px' }}
              />
              {credError ? <div style={{ color: '#ff8080' }}>{credError}</div> : null}
              <button type="submit" disabled={credSaving} style={{ padding: '4px 6px' }}>
                {credSaving ? 'Saving…' : 'Save & connect'}
              </button>
            </form>
          ) : null}
          {cameraStatus === 'error' ? (
            <div style={{ padding: '12px', color: '#ff8080' }}>{cameraStatusError || 'Camera unavailable.'}</div>
          ) : null}
        </div>
      ) : null}
      {workloads.length > 0 ? (
        <div className="topology-workloads" style={{ marginLeft: `${(depth + 1) * 16 + 28}px`, display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
          {workloads.map((workload) => (
            <span key={workload.instanceId} className="topology-node-badge" title={`${workload.workloadKind} ${workload.status}`}>
              {workload.workloadKind}: {workload.name} ({workload.status})
            </span>
          ))}
        </div>
      ) : null}
      <ResourceDropdown label="Devices" items={devices} kind="device" />
      <ResourceDropdown label="Services" items={services} kind="service" />
      <ResourceDropdown label="Daemons" items={daemons} kind="daemon" />
      <ResourceDropdown label="Transient Programs" items={transientPrograms} kind="transient" />
      {hasChildren && isExpanded && (
        <ul className="topology-tree-list">
          {children.map((childKey) => (
            <TreeNode key={childKey} nodeKey={childKey} tree={tree} workloadsByNode={workloadsByNode} depth={depth + 1} expanded={expanded} onToggle={onToggle} onRename={onRename} onSetParent={onSetParent} onDeviceAction={onDeviceAction} busyNodeKey={busyNodeKey} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TopologyPage() {
  const [nodes, setNodes] = useState([]);
  const [homeNodes, setHomeNodes] = useState([]);
  const [cameraNodes, setCameraNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homeLoading, setHomeLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [areas, setAreas] = useState({ infrastructure: true, home: false, cameras: false });
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState('');
  const [expanded, setExpanded] = useState({});
  const [busyNodeKey, setBusyNodeKey] = useState('');
  const [workloads, setWorkloads] = useState([]);

  async function loadInfrastructure() {
    try {
      const response = await fetch('/api/nodes');
      if (!response.ok) {
        throw new Error(`Topology request failed (${response.status})`);
      }
      const payload = await response.json();
      const nextNodes = (Array.isArray(payload) ? payload : []).filter(node => !isHomeAutomationNode(node));
      const workloadResponse = await fetch('/api/registry/workloads');
      const workloadPayload = workloadResponse.ok ? await workloadResponse.json() : { workloads: [] };
      setWorkloads(Array.isArray(workloadPayload?.workloads) ? workloadPayload.workloads : []);
      setNodes(nextNodes);
      setError('');
      setLastRefreshedAt(new Date().toISOString());
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setLoading(false);
    }
  }

  async function loadHomeAutomation() {
    setHomeLoading(true);
    try {
      const response = await fetch('/api/home-automation/devices');
      if (!response.ok) throw new Error(`Home automation request failed (${response.status})`);
      const payload = await response.json();
      setHomeNodes(buildHomeAutomationNodes(payload?.devices));
      setHomeLoaded(true);
      setError('');
      setLastRefreshedAt(new Date().toISOString());
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setHomeLoading(false);
    }
  }

  async function loadCameras() {
    setCameraLoading(true);
    try {
      const response = await fetch('/api/cameras/discover');
      if (!response.ok) throw new Error(`Camera discovery request failed (${response.status})`);
      const payload = await response.json();
      setCameraNodes(buildCameraNodes(payload?.cameras));
      setCameraLoaded(true);
      setError('');
      setLastRefreshedAt(new Date().toISOString());
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setCameraLoading(false);
    }
  }

  async function loadTopology() {
    const requests = [];
    if (areas.infrastructure) requests.push(loadInfrastructure());
    if (areas.home) requests.push(loadHomeAutomation());
    if (areas.cameras) requests.push(loadCameras());
    await Promise.all(requests);
  }

  function toggleArea(area) {
    const opening = !areas[area];
    setAreas(current => ({ ...current, [area]: opening }));
    if (area === 'home' && opening && !homeLoaded) void loadHomeAutomation();
    if (area === 'cameras' && opening && !cameraLoaded) void loadCameras();
    if (area === 'infrastructure' && opening && nodes.length === 0) void loadInfrastructure();
  }

  const handleToggleNode = (nodeKey) => {
    setExpanded(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  const workloadsByNode = useMemo(() => {
    const grouped = new Map();
    for (const workload of workloads) {
      const key = normalizeNodeKey(workload?.nodeId || workload?.ip);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(workload);
    }
    return grouped;
  }, [workloads]);

  async function postNodeChange(node, action, body) {
    const nodeId = String(node?.nodeId || node?.topology?.nodeKey || node?.nodeName || node?.ip || '').trim();
    const nodeKey = getNodeKey(node);
    if (!nodeId || !nodeKey) return;

    setBusyNodeKey(nodeKey);
    setError('');
    try {
      const response = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip: node?.ip || '', ...body })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Node update failed (${response.status})`);
      await loadTopology();
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusyNodeKey('');
    }
  }

  function handleRenameNode(node) {
    const currentName = getNodeLabel(node);
    const nextName = window.prompt('Node name', currentName);
    if (nextName == null || nextName.trim() === '' || nextName.trim() === currentName) return;
    postNodeChange(node, 'rename', { nodeName: nextName.trim() });
  }

  function handleSetParent(node) {
    const currentKey = getNodeKey(node);
    const candidates = nodes
      .filter((candidate) => getNodeKey(candidate) !== currentKey)
      .sort((a, b) => getNodeLabel(a).localeCompare(getNodeLabel(b)));
    const choices = candidates.map((candidate, index) => `${index + 1}. ${getNodeLabel(candidate)}`).join('\n');
    const answer = window.prompt(`Choose parent number for ${getNodeLabel(node)}, or 0 for Free Pool:\n${choices}`, '0');
    if (answer == null) return;
    const selected = Number.parseInt(answer, 10);
    if (!Number.isInteger(selected) || selected < 0 || selected > candidates.length) {
      setError('Choose a valid parent number.');
      return;
    }
    const parent = selected === 0 ? null : candidates[selected - 1];
    postNodeChange(node, 'parent', {
      parentNodeId: parent ? getNodeKey(parent) : '',
      parentHost: parent?.ip || '',
      activeClusterId: parent?.topology?.activeClusterId || node?.topology?.activeClusterId || 'default'
    });
  }

  async function handleDeviceAction(node, action) {
    const nodeId = String(node?.nodeId || '').trim();
    const nodeKey = getNodeKey(node);
    if (!nodeId || !nodeKey) return;
    setBusyNodeKey(nodeKey);
    setError('');
    try {
      const response = await fetch(`/api/home-automation/devices/${encodeURIComponent(nodeId)}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Device action failed (${response.status})`);
      await loadHomeAutomation();
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusyNodeKey('');
    }
  }

  useEffect(() => {
    loadInfrastructure();
    const intervalId = window.setInterval(() => {
      if (areas.infrastructure) void loadInfrastructure();
      if (areas.home) void loadHomeAutomation();
      if (areas.cameras) void loadCameras();
    }, REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [areas.infrastructure, areas.home, areas.cameras]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const homeTree = useMemo(() => buildTree(homeNodes), [homeNodes]);
  const cameraTree = useMemo(() => buildTree(cameraNodes), [cameraNodes]);

  return (
    <div className="topology-page">
      <header className="topology-header">
        <h1>Network Topology</h1>
        <p>Infrastructure and home automation load independently. Expanded areas refresh every 30 seconds.</p>
        <div className="topology-actions">
          <button type="button" onClick={loadTopology}>Refresh now</button>
          <span className="topology-last-refresh">Last refresh: {lastRefreshedAt || 'never'}</span>
        </div>
      </header>

      {error ? <div className="topology-error">{error}</div> : null}

      <section className="topology-area">
        <button type="button" className="topology-area-toggle" onClick={() => toggleArea('infrastructure')} aria-expanded={areas.infrastructure}>
          {areas.infrastructure ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Network size={18} />
          <span>Nodes &amp; Clusters</span>
          <span className="topology-area-count">{nodes.length}</span>
        </button>
        {areas.infrastructure ? <div className="topology-area-content">
          {loading ? <div className="topology-info">Loading nodes and clusters...</div> : null}
          {tree.roots.length > 0 ? (
            <ul className="topology-tree-list">
              {tree.roots.map((rootKey) => (
                <TreeNode key={rootKey} nodeKey={rootKey} tree={tree} workloadsByNode={workloadsByNode} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
              ))}
            </ul>
          ) : null}
          <div className="topology-free-pool">
            <h3>Free Pool <span>{tree.freePool.length}</span></h3>
            {tree.freePool.length === 0 ? <div className="topology-info">No unassigned or waiting nodes.</div> : (
              <ul className="topology-tree-list">
                {tree.freePool.map((nodeKey) => (
                  <TreeNode key={nodeKey} nodeKey={nodeKey} tree={tree} workloadsByNode={workloadsByNode} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
                ))}
              </ul>
            )}
          </div>
          <details className="topology-raw-list">
            <summary>Raw node list ({nodes.length})</summary>
            <div className="topology-table-wrap">
              <table className="topology-table">
                <thead><tr><th>Node</th><th>IP</th><th>Transport</th><th>Parent</th><th>Cluster</th><th>Site</th><th>Children</th><th>Controller</th></tr></thead>
                <tbody>{nodes.map(node => {
                  const key = getNodeKey(node);
                  const children = tree.childrenByParent.get(key) || [];
                  const transport = getNodeTransport(node);
                  return <tr key={key || node.ip}>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><NodeCapabilityIcons node={node} />{getNodeLabel(node)}</span></td>
                    <td>{String(node?.ip || 'n/a')}</td><td><TransportBadge protocol={transport.protocol} /> {transport.endpoint}</td>
                    <td>{String(node?.topology?.parentNodeId || '-')}</td><td>{String(node?.topology?.activeClusterId || 'default')}</td>
                    <td>{String(node?.topology?.siteName || node?.topology?.siteId || 'primary-site')}</td><td>{children.length}</td><td>{node?.topology?.clusterController ? 'yes' : 'no'}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </details>
        </div> : null}
      </section>

      <section className="topology-area">
        <button type="button" className="topology-area-toggle" onClick={() => toggleArea('home')} aria-expanded={areas.home}>
          {areas.home ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <HousePlug size={18} />
          <span>Home Automation</span>
          <span className="topology-area-count">{homeLoaded ? Math.max(0, homeNodes.length - 1) : 'lazy'}</span>
        </button>
        {areas.home ? <div className="topology-area-content">
          {homeLoading ? <div className="topology-info">Loading home automation devices...</div> : null}
          {!homeLoading && homeTree.roots.length === 0 ? <div className="topology-info">No home automation devices found.</div> : null}
          {homeTree.roots.length > 0 ? <ul className="topology-tree-list">
            {homeTree.roots.map(rootKey => (
              <TreeNode key={rootKey} nodeKey={rootKey} tree={homeTree} workloadsByNode={new Map()} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
            ))}
          </ul> : null}
        </div> : null}
      </section>

      <section className="topology-area">
        <button type="button" className="topology-area-toggle" onClick={() => toggleArea('cameras')} aria-expanded={areas.cameras}>
          {areas.cameras ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Camera size={18} />
          <span>Cameras</span>
          <span className="topology-area-count">{cameraLoaded ? Math.max(0, cameraNodes.length - 1) : 'lazy'}</span>
        </button>
        {areas.cameras ? <div className="topology-area-content">
          {cameraLoading ? <div className="topology-info">Discovering cameras...</div> : null}
          {!cameraLoading && cameraTree.roots.length === 0 ? <div className="topology-info">No Tapo/ONVIF cameras found.</div> : null}
          {cameraTree.roots.length > 0 ? <ul className="topology-tree-list">
            {cameraTree.roots.map(rootKey => (
              <TreeNode key={rootKey} nodeKey={rootKey} tree={cameraTree} workloadsByNode={new Map()} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
            ))}
          </ul> : null}
        </div> : null}
      </section>
    </div>
  );
}