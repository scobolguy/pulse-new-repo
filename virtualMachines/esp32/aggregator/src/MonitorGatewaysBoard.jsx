import React, { useEffect, useMemo, useState } from 'react';
import { actorHeaders, getJsonAsActor, postJsonAsActor, putJson } from './http-client.js';

function toSvgDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SWIFT_NETWORK_FALLBACK_LOGO = toSvgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90"><rect width="220" height="90" fill="#ffffff"/><g transform="translate(12,12)"><circle cx="26" cy="26" r="21" fill="none" stroke="#1f4b99" stroke-width="2.5"/><path d="M8 26h36M26 8v36M12 14c10 8 20 8 29 0M12 38c10-8 20-8 29 0" stroke="#1f4b99" stroke-width="1.6" fill="none"/><text x="58" y="33" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#1f4b99">SWIFT</text><text x="58" y="52" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#375b9c">NETWORK</text></g></svg>'
);

const BOC_FALLBACK_LOGO = toSvgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80" viewBox="0 0 180 80"><rect width="180" height="80" fill="#ffffff"/><text x="15" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#9f2e24">BoC</text><text x="76" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#3d4959">Bank of Canada</text></svg>'
);

const FED_FALLBACK_LOGO = toSvgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80" viewBox="0 0 180 80"><rect width="180" height="80" fill="#ffffff"/><text x="18" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#214a7a">Federal</text><text x="18" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#214a7a">Reserve</text></svg>'
);

const SWIFT_NETWORK_GLOBE_ASSET_LOGO = '/assets/logos/swift-network-globe.svg';
const SWIFT_NETWORK_ASSET_LOGO = '/assets/logos/swift-network-2023.svg';
const BOC_BW_ASSET_LOGO = '/assets/logos/bank-of-canada-bw.svg';
const BOC_BUILDING_ASSET_LOGO = '/assets/logos/bank-of-canada-building.svg';
const BOC_ASSET_LOGO = '/assets/logos/bank-of-canada.svg';
const FED_BW_ASSET_LOGO = '/assets/logos/us-federal-reserve-bw.svg';
const FED_ASSET_LOGO = '/assets/logos/us-federal-reserve-seal.svg';

const LOGO_SOURCES = {
  swift: [
    SWIFT_NETWORK_GLOBE_ASSET_LOGO,
    SWIFT_NETWORK_ASSET_LOGO,
    SWIFT_NETWORK_FALLBACK_LOGO
  ],
  boc: [
    BOC_BW_ASSET_LOGO,
    BOC_BUILDING_ASSET_LOGO,
    BOC_ASSET_LOGO,
    BOC_FALLBACK_LOGO
  ],
  fed: [
    FED_BW_ASSET_LOGO,
    FED_ASSET_LOGO,
    FED_FALLBACK_LOGO
  ]
};

function normalizeGatewayId(gatewayId) {
  return String(gatewayId || '').trim().toLowerCase();
}

function hashGatewayName(value) {
  const text = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getGatewayRubeProfile(gatewayId, label) {
  const seed = hashGatewayName(`${normalizeGatewayId(gatewayId)}|${String(label || '').toLowerCase()}`);
  const intensity = 0.58; // medium variation profile
  const whistleX = 24 + Math.round(((seed % 52) - 26) * intensity);
  const whistleTop = 10 + Math.round((((seed >>> 6) % 12) - 6) * intensity);
  const whistleTilt = Math.round(((((seed >>> 12) % 23) - 11) * intensity));
  const whistleScale = 1 + ((((seed >>> 17) % 21) - 10) / 100) * intensity;
  const steamDuration = 3600 + Math.round((((seed >>> 4) % 2200) - 1100) * intensity);
  const steamDelay = seed % 1200;
  const steamHue = Math.round((((seed >>> 20) % 29) - 14) * intensity);
  const steamStrength = 0.84 + ((((seed >>> 24) % 18) - 9) / 100) * intensity;
  return {
    variantClass: `gateway-rube-variant-${seed % 4}`,
    style: {
      '--gw-whistle-x': `${whistleX}%`,
      '--gw-whistle-top': `${whistleTop}%`,
      '--gw-whistle-tilt': `${whistleTilt}deg`,
      '--gw-whistle-scale': whistleScale,
      '--gw-steam-duration': `${steamDuration}ms`,
      '--gw-steam-delay': `${steamDelay}ms`,
      '--gw-steam-hue': `${steamHue}deg`,
      '--gw-steam-strength': steamStrength
    }
  };
}

function detectGatewayBrand(gatewayId, label) {
  const id = normalizeGatewayId(gatewayId);
  const combined = `${id} ${String(label || '').toLowerCase()}`;
  if (combined.includes('swift')) return 'swift';
  if (combined.includes('boc') || combined.includes('bank of canada')) return 'boc';
  if (combined.includes('fed') || combined.includes('federal reserve')) return 'fed';
  return null;
}

function getGatewayLogoSources(gatewayId, label) {
  const brand = detectGatewayBrand(gatewayId, label);
  if (!brand) return [];
  return LOGO_SOURCES[brand] || [];
}

function getFallbackIcon(gatewayId, label) {
  const brand = detectGatewayBrand(gatewayId, label);
  if (brand === 'swift') return 'SW';
  if (brand === 'boc') return 'BoC';
  if (brand === 'fed') return 'FED';
  return 'GW';
}

function getTileLogoUrl(gatewayId, label) {
  const brand = detectGatewayBrand(gatewayId, label);
  if (brand === 'swift') return SWIFT_NETWORK_GLOBE_ASSET_LOGO;
  if (brand === 'boc') return BOC_BW_ASSET_LOGO;
  if (brand === 'fed') return FED_BW_ASSET_LOGO;
  return null;
}

function getGatewayDisplayLabel(gatewayId, label) {
  const brand = detectGatewayBrand(gatewayId, label);
  if (brand === 'boc') return 'BOC';
  return String(label || '').toUpperCase();
}


function GatewayLogo({ sources, alt, fallbackIcon, tone, brand, size = 20 }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const hasLogo = Array.isArray(sources) && sourceIndex < sources.length;

  return (
    <>
      {hasLogo ? (
        <img
          className={`gateway-logo-icon${brand ? ` gateway-logo-icon--${brand}` : ''}`}
          src={sources[sourceIndex]}
          alt={alt}
          style={{ width: size, height: size, objectFit: 'contain' }}
          onError={() => setSourceIndex((prev) => prev + 1)}
        />
      ) : null}
      <span
        className="gateway-logo-fallback"
        style={{
          display: hasLogo ? 'none' : 'inline',
          fontSize: 11,
          fontWeight: 700,
          color: '#111111'
        }}
      >
        {fallbackIcon}
      </span>
    </>
  );
}

function toGatewayRows(payload, activeTransactionsCount) {
  if (!payload || typeof payload !== 'object') return [];
  return Object.entries(payload)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([gatewayId, value]) => {
      const running = value.running === true;
      const paused = value.quiesced === true;
      let state = 'stopped';
      if (paused) state = 'paused';
      else if (running && activeTransactionsCount > 0) state = 'working';
      else if (running) state = 'idle';

      return {
        gatewayId,
        label: String(gatewayId || '').toUpperCase(),
        state,
        running,
        paused
      };
    })
    .sort((a, b) => a.gatewayId.localeCompare(b.gatewayId));
}

function stateStyle(state) {
  if (state === 'working') {
    return {
      color: '#d8f0de',
      background: 'rgba(41, 71, 49, 0.72)',
      border: 'rgba(135, 171, 143, 0.74)',
      lanternCore: '#8ee59d',
      lanternGlow: 'rgba(109, 232, 128, 0.62)',
      lanternEdge: 'rgba(151, 221, 159, 0.92)'
    };
  }
  if (state === 'paused') {
    return {
      color: '#f4e2bd',
      background: 'rgba(90, 70, 35, 0.72)',
      border: 'rgba(196, 165, 114, 0.74)',
      lanternCore: '#f2cb63',
      lanternGlow: 'rgba(242, 203, 99, 0.62)',
      lanternEdge: 'rgba(243, 219, 151, 0.92)'
    };
  }
  if (state === 'idle') {
    return {
      color: '#dce5ee',
      background: 'rgba(58, 67, 79, 0.68)',
      border: 'rgba(153, 172, 195, 0.72)',
      lanternCore: '#d7e4f2',
      lanternGlow: 'rgba(190, 211, 232, 0.26)',
      lanternEdge: 'rgba(219, 231, 243, 0.84)'
    };
  }
  return {
    color: '#f8c5d2',
    background: 'rgba(98, 36, 53, 0.72)',
    border: 'rgba(194, 111, 135, 0.74)',
    lanternCore: '#e66f88',
    lanternGlow: 'rgba(230, 111, 136, 0.62)',
    lanternEdge: 'rgba(238, 158, 177, 0.92)'
  };
}

function stateClassName(state) {
  if (state === 'working') return 'is-working';
  if (state === 'paused') return 'is-paused';
  if (state === 'idle') return 'is-idle';
  return 'is-stopped';
}

export default function MonitorGatewaysBoard() {
  const [gatewayPayload, setGatewayPayload] = useState({});
  const [activeTransactionsCount, setActiveTransactionsCount] = useState(0);
  const [error, setError] = useState('');
  const [controlStatus, setControlStatus] = useState('');
  const [ravenFlight, setRavenFlight] = useState(null);

  const rows = useMemo(() => toGatewayRows(gatewayPayload, activeTransactionsCount), [gatewayPayload, activeTransactionsCount]);

  async function refresh() {
    try {
      const [payload, dashboard] = await Promise.all([
        getJsonAsActor('/api/gateways', 'Gateway API failed'),
        getJsonAsActor('/api/lifecycle/dashboard', 'Lifecycle dashboard API failed')
      ]);
      setGatewayPayload(payload || {});
      setActiveTransactionsCount(Array.isArray(dashboard?.activeTransactions) ? dashboard.activeTransactions.length : 0);
      setError('');
    } catch (e) {
      setError(String(e.message || e));
      setGatewayPayload({});
      setActiveTransactionsCount(0);
    }
  }

  async function runGatewayClassAction(action) {
    try {
      setControlStatus(`Applying ${action} on gateway class...`);
      await postJsonAsActor(`/api/runtime/classes/gateway/actions/${encodeURIComponent(action)}`, {}, 'Gateway class action failed');
      setControlStatus(`Applied ${action} on gateway class.`);
      await refresh();
    } catch (e) {
      setControlStatus(String(e.message || e));
    }
  }

  async function configureGatewayInstance(gatewayId) {
    try {
      const instanceId = `gateway:${gatewayId}`;
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

      await putJson(`/api/runtime/instances/${encodeURIComponent(instanceId)}/config`, {
        provider: configPayload.provider,
        config: parsed
      }, `Failed to save config for ${instanceId}`, {
        headers: actorHeaders()
      });

      setControlStatus(`Saved config for ${instanceId}.`);
      await refresh();
    } catch (e) {
      setControlStatus(String(e.message || e));
    }
  }

  function triggerRavenFlyby() {
    const direction = Math.random() > 0.5 ? 'ltr' : 'rtl';
    const top = 5 + Math.random() * 78;
    const duration = 7000 + Math.floor(Math.random() * 3000);
    const key = Date.now();
    setRavenFlight({ key, direction, top, duration });
    setTimeout(() => {
      setRavenFlight((current) => (current && current.key === key ? null : current));
    }, duration + 300);
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    const ravenTimer = setInterval(() => {
      triggerRavenFlyby();
      refresh();
    }, 60000);
    return () => {
      clearInterval(timer);
      clearInterval(ravenTimer);
    };
  }, []);

  return (
    <div className="gothic-screen" style={{ display: 'grid', gap: 12, position: 'relative', overflow: 'hidden' }}>
      <h2 className="gothic-title">Gateways</h2>
      {ravenFlight ? (
        <div
          key={ravenFlight.key}
          className={`raven-flyby ${ravenFlight.direction}`}
          style={{ top: `${ravenFlight.top}%`, animationDuration: `${ravenFlight.duration}ms` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="gothic-panel poe-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <button type="button" className="server-monitor-test-button" onClick={() => runGatewayClassAction('start')}>Start Class</button>
          <button type="button" className="server-monitor-test-button" onClick={() => runGatewayClassAction('stop')}>Stop Class</button>
          <button type="button" className="server-monitor-test-button" onClick={() => runGatewayClassAction('quiesce')}>Quiesce Class</button>
        </div>
        {controlStatus ? <div style={{ marginBottom: 10, fontSize: 12, color: '#5a6574' }}>Control: {controlStatus}</div> : null}

        {rows.length === 0 && !error && (
          <div style={{ fontSize: 13, color: '#5a6574' }}>No gateways defined.</div>
        )}

        {rows.length > 0 && (
          <div className="gateway-card-grid">
            {rows.map(row => {
              const brand = detectGatewayBrand(row.gatewayId, row.label);
              const tone = stateStyle(row.state);
              const logoSources = getGatewayLogoSources(row.gatewayId, row.label);
              const tileLogoUrl = getTileLogoUrl(row.gatewayId, row.label);
              const fallbackIcon = getFallbackIcon(row.gatewayId, row.label);
              const displayLabel = getGatewayDisplayLabel(row.gatewayId, row.label);
              const stateClass = stateClassName(row.state);
              const rubeProfile = getGatewayRubeProfile(row.gatewayId, row.label);
              return (
                <div
                  key={row.gatewayId}
                  className={`gateway-card-wrapper ${stateClass} ${rubeProfile.variantClass}`}
                  style={rubeProfile.style}
                >
                  <div className={`gateway-portrait-card ${stateClass}`}>
                    <div className="gateway-rube-whistle" aria-hidden="true" />
                    <div className="gateway-rube-steam" aria-hidden="true" />
                    <div className="gateway-rube-steam gateway-rube-steam--alt" aria-hidden="true" />
                    <div className="gateway-health-aura" aria-hidden="true" />
                    <div className="gateway-health-badge" aria-hidden="true" />
                    <div className="gateway-title-horizontal">
                      {displayLabel}
                    </div>

                  <div
                    className="gateway-card-body"
                    style={{
                      backgroundImage: tileLogoUrl
                        ? `linear-gradient(145deg, rgba(255,247,226,0.24), rgba(255,247,226,0) 35%), linear-gradient(180deg, #2a2420, #1b1715), url(${tileLogoUrl})`
                        : 'linear-gradient(145deg, rgba(255,247,226,0.24), rgba(255,247,226,0) 35%), linear-gradient(180deg, #2a2420, #1b1715)',
                      backgroundRepeat: tileLogoUrl ? 'no-repeat, no-repeat, repeat' : 'no-repeat, no-repeat',
                      backgroundSize: tileLogoUrl ? 'auto, auto, 72px 72px' : 'auto, auto',
                      backgroundPosition: tileLogoUrl ? '0 0, 0 0, 2px 2px' : '0 0, 0 0'
                    }}
                  >
                    <div className="gateway-gate-emblem" style={{ borderColor: tone.border }}>
                      <GatewayLogo
                        sources={logoSources}
                        alt={row.label}
                        fallbackIcon={fallbackIcon}
                        tone={tone}
                        brand={brand}
                        size={36}
                      />
                    </div>
                    <div style={{ position: 'absolute', right: 8, bottom: 8 }}>
                      <button type="button" className="server-monitor-test-button" onClick={() => configureGatewayInstance(row.gatewayId)}>
                        Configure
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <div style={{ marginTop: 10, color: '#9a2b2b', fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  );
}
