import { useEffect, useMemo, useState } from 'react';
import { actorHeaders, getJsonAsActor } from './http-client.js';

const BLUETOOTH_API_HOST = String(import.meta.env.VITE_BLUETOOTH_API_HOST || '192.168.2.246').replace(/^https?:\/\//, '').replace(/\/$/, '');

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesAny(value, tokens) {
  const haystack = normalizeText(value);
  return tokens.some((token) => haystack.includes(token));
}

function scoreBluetoothDevice(device, tokens) {
  let score = 0;
  const type = normalizeText(device?.type);
  const name = normalizeText(device?.name);
  const manufacturerData = normalizeText(device?.manufacturerData);
  const services = Array.isArray(device?.serviceUUIDs) ? device.serviceUUIDs.map(normalizeText) : [];

  if (tokens.includes('bluetooth')) score += 3;
  if (tokens.includes('switch')) {
    if (type === 'outlet') score += 50;
    if (name.includes('switch')) score += 20;
  }
  if (tokens.includes('light') || tokens.includes('lights') || tokens.includes('bulb') || tokens.includes('lamp')) {
    if (type === 'lightbulb') score += 50;
    if (name.includes('light') || name.includes('bulb') || name.includes('lamp')) score += 20;
  }
  if (tokens.includes('watch') && type === 'watch') score += 40;
  if (tokens.includes('coros') && name.includes('coros')) score += 40;
  if (tokens.includes('apple') && manufacturerData.startsWith('4c00')) score += 10;
  if (services.includes('0x0f09')) score += 2;
  if (type === 'watch') score += 4;
  if (type === 'unknown' && manufacturerData.startsWith('4c00')) score += 2;
  return score;
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function summarizeActions(provider) {
  const actions = Array.isArray(provider?.actions) ? provider.actions : [];
  if (actions.length === 0) return 'No explicit actions are advertised.';
  return actions.map((action) => `${action.id}${action.description ? `: ${action.description}` : ''}`).join('; ');
}

function buildSummary(snapshot, question) {
  const text = normalizeText(question);
  const tokens = tokenize(question);
  const bluetoothDevices = Array.isArray(snapshot.bluetoothDevices) ? snapshot.bluetoothDevices : [];
  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const clusters = Array.isArray(snapshot.clusters) ? snapshot.clusters : [];
  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];

  if (!text) {
    return 'Ask about bluetooth devices, switches, nodes, clusters, or what actions a provider exposes.';
  }

  if (text.includes('bluetooth')) {
    const filtered = bluetoothDevices.filter((device) => {
      if (tokens.includes('switch')) {
        return normalizeText(device.type) === 'outlet' || matchesAny(device.name, ['switch']);
      }
      if (tokens.includes('light') || tokens.includes('lights') || tokens.includes('bulb') || tokens.includes('lamp')) {
        return normalizeText(device.type) === 'lightbulb' || matchesAny(device.name, ['light', 'bulb', 'lamp']);
      }
      if (tokens.includes('watch') || tokens.includes('wearable')) {
        return normalizeText(device.type) === 'watch' || matchesAny(device.name, ['watch', 'fit', 'band', 'tracker', 'coros']);
      }
      return true;
    });

    const ranked = [...filtered].sort((a, b) => scoreBluetoothDevice(b, tokens) - scoreBluetoothDevice(a, tokens));
    const top = ranked.slice(0, 12);

    if (tokens.includes('switch')) {
      return top.length
        ? `I found ${filtered.length} bluetooth device(s) that look like switches or switchable accessories. Top matches: ${top.map((device) => `${device.name || device.address} (${device.type || 'unknown'})`).join('; ')}.`
        : 'I did not find any bluetooth devices that look like switches.';
    }

    if (tokens.includes('light') || tokens.includes('lights') || tokens.includes('bulb') || tokens.includes('lamp')) {
      return top.length
        ? `I found ${filtered.length} bluetooth device(s) that look like lights. Top matches: ${top.map((device) => `${device.name || device.address} (${device.type || 'unknown'})`).join('; ')}.`
        : 'I did not find any bluetooth devices that look like lights.';
    }

    if (tokens.includes('watch') || tokens.includes('wearable')) {
      return top.length
        ? `I found ${filtered.length} bluetooth wearable-like device(s). Top matches: ${top.map((device) => `${device.name || device.address} (${device.type || 'unknown'})`).join('; ')}.`
        : 'I did not find any bluetooth wearable-like devices.';
    }

    return bluetoothDevices.length
      ? `I can see ${bluetoothDevices.length} bluetooth device(s). The strongest candidate for a wearable is ${bluetoothDevices.find((device) => normalizeText(device.type) === 'watch' || matchesAny(device.name, ['coros', 'watch', 'band', 'tracker']))?.name || 'none'}.`
      : 'No bluetooth devices are currently visible.';
  }

  if (text.includes('upnp') || text.includes('dlna') || text.includes('ssdp')) {
    const upnpProviders = providers.filter((provider) => matchesAny(provider?.id || '', ['upnp', 'dlna', 'ssdp']) || matchesAny(provider?.name || '', ['upnp', 'dlna', 'ssdp']));
    if (tokens.includes('switch')) {
      const switchProviders = upnpProviders.filter((provider) => matchesAny(provider?.description || '', ['switch', 'relay', 'light', 'outlet']) || (Array.isArray(provider?.actions) && provider.actions.length > 0));
      return switchProviders.length
        ? `I found ${switchProviders.length} UPnP-like provider(s) that could map to switches. Actions: ${switchProviders.map((provider) => `${provider.name}: ${summarizeActions(provider)}`).join(' | ')}.`
        : 'I do not see an explicit UPnP switch provider in the current catalog.';
    }

    return upnpProviders.length
      ? `I found ${upnpProviders.length} UPnP-like provider(s): ${upnpProviders.map((provider) => provider.name).join(', ')}.`
      : 'I do not see an explicit UPnP/SSDP/DLNA provider in the current catalog.';
  }

  if (text.includes('cluster')) {
    return clusters.length
      ? `I see ${clusters.length} cluster(s): ${clusters.slice(0, 8).map((cluster) => `${cluster.label || cluster.clusterId} (${Array.isArray(cluster.nodes) ? cluster.nodes.length : 0} node(s))`).join('; ')}.`
      : 'No clusters are currently registered.';
  }

  if (text.includes('node') || text.includes('nodes')) {
    const summaryNodes = nodes.slice(0, 12).map((node) => `${node.nodeName || node.nodeId || node.ip} (${Array.isArray(node?.details?.devices) ? node.details.devices.length : 0} device(s), ${Array.isArray(node?.details?.services) ? node.details.services.length : 0} service(s))`);
    return nodes.length
      ? `I see ${nodes.length} node(s): ${summaryNodes.join('; ')}.`
      : 'No nodes are currently visible.';
  }

  if (text.includes('action') || text.includes('actions')) {
    const highlighted = providers
      .map((provider) => ({
        provider,
        score: (Array.isArray(provider?.actions) ? provider.actions.length : 0) + (matchesAny(provider?.description || '', ['switch', 'light', 'relay']) ? 1 : 0)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return highlighted.length
      ? highlighted.map(({ provider }) => `${provider.name}: ${summarizeActions(provider)}`).join(' | ')
      : 'I do not see any provider action metadata worth highlighting.';
  }

  const smartSignals = [
    `Nodes: ${nodes.length}`,
    `Clusters: ${clusters.length}`,
    `Bluetooth devices: ${bluetoothDevices.length}`,
    `Service providers: ${providers.length}`
  ];

  return `I can inspect the network inventory. ${smartSignals.join('. ')}.`;
}

export default function NetworkDevicesPage() {
  const [snapshot, setSnapshot] = useState({
    loadedAt: null,
    error: '',
    nodes: [],
    clusters: [],
    bluetoothDevices: [],
    providers: []
  });
  const [query, setQuery] = useState('Show me all bluetooth switches');
  const [history, setHistory] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about bluetooth switches, bluetooth lights, nodes, clusters, or what actions a provider can do.'
    }
  ]);
  const [busy, setBusy] = useState(false);

  async function refreshSnapshot() {
    try {
      const [nodesResult, clustersResult, bluetoothResult, providersResult] = await Promise.allSettled([
        getJsonAsActor('/api/nodes', 'Node topology request failed'),
        getJsonAsActor('/api/clusters', 'Cluster request failed'),
        fetch(`/api/proxy/${encodeURIComponent(BLUETOOTH_API_HOST)}?path=${encodeURIComponent('/api/bluetooth/devices?compact=1')}`, {
          headers: actorHeaders()
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Bluetooth device request failed (${response.status})`);
          }
          return response.json();
        }),
        fetch('/api/platform/providers', {
          headers: actorHeaders()
        }).then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || `Provider catalog request failed (${response.status})`);
          }
          return response.json();
        })
      ]);

      const nodes = nodesResult.status === 'fulfilled' ? nodesResult.value : null;
      const clusters = clustersResult.status === 'fulfilled' ? clustersResult.value : null;
      const bluetooth = bluetoothResult.status === 'fulfilled' ? bluetoothResult.value : null;
      const providers = providersResult.status === 'fulfilled' ? providersResult.value : null;

      setSnapshot({
        loadedAt: new Date().toISOString(),
        error: [nodesResult, clustersResult, bluetoothResult, providersResult]
          .filter((result) => result.status === 'rejected')
          .map((result) => String(result.reason?.message || result.reason || 'Unknown error'))
          .join(' | '),
        nodes: Array.isArray(nodes?.nodes) ? nodes.nodes : Array.isArray(nodes) ? nodes : [],
        clusters: Array.isArray(clusters?.clusters) ? clusters.clusters : [],
        bluetoothDevices: Array.isArray(bluetooth?.devices) ? bluetooth.devices : [],
        providers: Array.isArray(providers?.providers) ? providers.providers : []
      });
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: String(error.message || error) }));
    }
  }

  useEffect(() => {
    refreshSnapshot();
  }, []);

  const quickFacts = useMemo(() => {
    const bluetoothDevices = Array.isArray(snapshot.bluetoothDevices) ? snapshot.bluetoothDevices : [];
    const rankedBluetooth = dedupeBy(
      [...bluetoothDevices].sort((a, b) => scoreBluetoothDevice(b, tokenize('watch light switch')) - scoreBluetoothDevice(a, tokenize('watch light switch'))),
      (device) => device.address || device.name
    );
    return {
      topBluetooth: rankedBluetooth.slice(0, 5),
      switchLike: bluetoothDevices.filter((device) => normalizeText(device.type) === 'outlet' || matchesAny(device.name, ['switch', 'plug', 'outlet'])),
      lightLike: bluetoothDevices.filter((device) => normalizeText(device.type) === 'lightbulb' || matchesAny(device.name, ['light', 'bulb', 'lamp'])),
      watchLike: bluetoothDevices.filter((device) => normalizeText(device.type) === 'watch' || matchesAny(device.name, ['watch', 'coros', 'fit', 'band', 'tracker']))
    };
  }, [snapshot.bluetoothDevices]);

  async function submitQuestion(nextQuestion = query) {
    const text = String(nextQuestion || '').trim();
    if (!text || busy) return;
    setBusy(true);
    setHistory((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text }]);
    try {
      const reply = buildSummary(snapshot, text);
      setHistory((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: reply }]);
    } finally {
      setBusy(false);
    }
  }

  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const clusters = Array.isArray(snapshot.clusters) ? snapshot.clusters : [];
  const bluetoothDevices = Array.isArray(snapshot.bluetoothDevices) ? snapshot.bluetoothDevices : [];
  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];

  const upnpLikeProviders = useMemo(() => {
    return providers
      .filter((provider) => matchesAny(provider?.id || '', ['upnp', 'dlna', 'ssdp']) || matchesAny(provider?.name || '', ['upnp', 'dlna', 'ssdp']) || matchesAny(provider?.description || '', ['upnp', 'dlna', 'ssdp', 'switch', 'relay', 'light', 'outlet']))
      .slice(0, 8);
  }, [providers]);

  const bluetoothSwitchCount = quickFacts.switchLike.length;
  const bluetoothLightCount = quickFacts.lightLike.length;
  const bluetoothWatchCount = quickFacts.watchLike.length;

  return (
    <div className="network-page">
      <header className="network-hero">
        <div>
          <div className="network-kicker">Network Device Copilot</div>
          <h1>Ask about the network inventory</h1>
          <p>Query live nodes, clusters, bluetooth devices, and UPnP-like provider action catalogs. Try: “Show me all bluetooth switches” or “show me all upnp switches and what actions can be done to them”.</p>
        </div>
        <div className="network-hero-actions">
          <button type="button" className="network-button network-button--ghost" onClick={refreshSnapshot}>Refresh inventory</button>
          <button type="button" className="network-button network-button--ghost" onClick={() => submitQuestion('Show me all bluetooth switches')}>Try bluetooth switches</button>
        </div>
      </header>

      <section className="network-query-panel">
        <form
          className="network-query-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion();
          }}
        >
          <label className="network-input-label" htmlFor="network-query-input">Ask a question</label>
          <textarea
            id="network-query-input"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Show me all bluetooth switches"
          />
          <div className="network-query-actions">
            <button type="submit" className="network-button" disabled={busy}>{busy ? 'Working...' : 'Ask'}</button>
            <button type="button" className="network-button network-button--ghost" onClick={() => setQuery('show me all upnp switches and what actions can be done to them')}>Example: UPnP switches</button>
          </div>
        </form>

        <div className="network-summary-grid">
          <article className="network-card">
            <h3>Nodes</h3>
            <div className="network-card-stat">{nodes.length}</div>
            <p>{nodes.slice(0, 4).map((node) => `${node.nodeName || node.nodeId || node.ip}`).join(', ') || 'No nodes yet.'}</p>
          </article>
          <article className="network-card">
            <h3>Clusters</h3>
            <div className="network-card-stat">{clusters.length}</div>
            <p>{clusters.slice(0, 4).map((cluster) => `${cluster.label || cluster.clusterId}`).join(', ') || 'No clusters yet.'}</p>
          </article>
          <article className="network-card">
            <h3>Bluetooth devices</h3>
            <div className="network-card-stat">{bluetoothDevices.length}</div>
            {bluetoothDevices.length > 0 ? (
              <ul>
                {dedupeBy([...bluetoothDevices].sort((a, b) => Number(b.rssi || -999) - Number(a.rssi || -999)), (device) => device.address)
                  .map((device) => (
                    <li key={device.address}>
                      <strong>{device.name && device.name !== 'Unknown' ? device.name : device.address}</strong>
                      {' - '}{device.type && device.type !== 'unknown' ? device.type : 'type unknown'}
                      {' - '}{device.manufacturer && device.manufacturer !== 'Unknown' ? device.manufacturer : 'manufacturer unknown'}
                      {Number.isFinite(Number(device.rssi)) ? ` - ${device.rssi} dBm` : ''}
                    </li>
                  ))}
              </ul>
            ) : <p>No bluetooth devices yet.</p>}
          </article>
          <article className="network-card">
            <h3>UPnP-like providers</h3>
            <div className="network-card-stat">{providers.reduce((sum, provider) => sum + (Array.isArray(provider.actions) ? provider.actions.length : 0), 0)}</div>
            <p>{upnpLikeProviders.slice(0, 3).map((provider) => provider.name).join(', ') || 'No UPnP-like providers yet.'}</p>
          </article>
        </div>
      </section>

      <section className="network-results-layout">
        <div className="network-feed">
          {history.map((item) => (
            <article key={item.id} className={`network-bubble network-bubble--${item.role}`}>
              {item.text}
            </article>
          ))}
        </div>

        <aside className="network-sidebars">
          <article className="network-inspect-card">
            <h3>Bluetooth switches</h3>
            <p>{bluetoothSwitchCount} candidate(s)</p>
            <ul>
              {quickFacts.switchLike.length > 0
                ? quickFacts.switchLike.slice(0, 8).map((device) => <li key={device.address}>{device.name || device.address} - {device.type || 'unknown'}</li>)
                : <li>No obvious bluetooth switches.</li>}
            </ul>
          </article>
          <article className="network-inspect-card">
            <h3>Bluetooth lights</h3>
            <p>{bluetoothLightCount} candidate(s)</p>
            <ul>
              {quickFacts.lightLike.length > 0
                ? quickFacts.lightLike.slice(0, 8).map((device) => <li key={device.address}>{device.name || device.address} - {device.type || 'unknown'}</li>)
                : <li>No obvious bluetooth lights.</li>}
            </ul>
          </article>
          <article className="network-inspect-card">
            <h3>Bluetooth wearables</h3>
            <p>{bluetoothWatchCount} candidate(s)</p>
            <ul>
              {quickFacts.watchLike.length > 0
                ? quickFacts.watchLike.slice(0, 8).map((device) => <li key={device.address}>{device.name || device.address} - {device.type || 'unknown'}</li>)
                : <li>No obvious wearable devices.</li>}
            </ul>
          </article>
          <article className="network-inspect-card">
            <h3>UPnP-like actions</h3>
            <ul>
              {upnpLikeProviders.length > 0
                ? upnpLikeProviders.map((provider) => <li key={provider.id}>{provider.name}: {summarizeActions(provider)}</li>)
                : <li>No UPnP-like provider catalog entries found.</li>}
            </ul>
          </article>
        </aside>
      </section>

      {snapshot.error ? <div className="network-error">Partial data warning: {snapshot.error}</div> : null}
      <footer className="network-footer">
        Last refreshed: {snapshot.loadedAt || 'never'}
      </footer>
    </div>
  );
}