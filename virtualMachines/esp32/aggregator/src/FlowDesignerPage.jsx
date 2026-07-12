import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCatalogSnapshot } from './catalogStudio/catalogApi'
import { getJsonAsActor } from './http-client'
import nodeVariantRegistry from './catalogStudio/nodeVariantRegistry.json'
import platformioProfiles from './catalogStudio/platformioProfiles.json'

const EDGE_TYPES = [
  { id: 'message-broker-call', label: 'Message Broker Call' },
  { id: 'file-feed', label: 'File Feed' },
  { id: 'service-call', label: 'Service Call' },
]

const PALETTE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'daemon', label: 'Daemons' },
  { id: 'service', label: 'Services' },
  { id: 'device', label: 'Devices' },
  { id: 'map', label: 'Maps' },
  { id: 'queue', label: 'Queues' },
  { id: 'site', label: 'Sites' },
]

const VARIANTS = Array.isArray(nodeVariantRegistry?.variants) ? nodeVariantRegistry.variants : []
const VARIANT_BY_ID = new Map(VARIANTS.map((variant) => [variant.id, variant]))

function normalizeCapability(value) {
  return String(value || '').trim().toLowerCase()
}

function inferVariantFromNode(node) {
  const fallback = VARIANT_BY_ID.get(nodeVariantRegistry?.defaultVariantId) || VARIANTS[0] || {
    id: 'unknown-variant',
    label: 'Unknown Variant',
    runtimeKind: 'unknown',
    capabilities: [],
    wiring: { provides: [], constraints: [] },
    buildProfile: { platformioEnv: null, requiredFlags: [] },
  }
  const fingerprint = [node?.id, node?.name, node?.type].map((value) => String(value || '').toLowerCase()).join(' ')
  for (const variant of VARIANTS) {
    const keywords = Array.isArray(variant?.detectionKeywords) ? variant.detectionKeywords : []
    if (keywords.some((keyword) => fingerprint.includes(String(keyword || '').toLowerCase()))) {
      return variant
    }
  }
  return fallback
}

function inferRequiredCapabilitiesFromItem(item) {
  const explicit = Array.isArray(item?.capabilities) ? item.capabilities.map(normalizeCapability).filter(Boolean) : []
  if (explicit.length) {
    return Array.from(new Set(explicit))
  }
  const type = String(item?.type || '').toLowerCase()
  const id = String(item?.id || '').toLowerCase()
  if (type.includes('message-broker') || id.includes('broker')) return ['queue.publish', 'queue.consume']
  if (type.includes('queue-manager') || id.includes('queue')) return ['queue.consume']
  if (type.includes('mapper')) return ['service.call']
  if (id.includes('camera') || type.includes('camera')) return ['camera.capture']
  if (id.includes('display') || type.includes('display')) return ['display.render']
  if (id.includes('upnp') || type.includes('upnp')) return ['upnp.discover']
  if (id.includes('relay') || id.includes('switch')) return ['relay.switch']
  return []
}

function inferRequiredWiringFromItem(item) {
  const type = String(item?.type || '').toLowerCase()
  const id = String(item?.id || '').toLowerCase()
  if (id.includes('camera') || type.includes('camera')) return ['camera.module']
  if (id.includes('display') || type.includes('display')) return ['display.panel']
  if (id.includes('relay') || id.includes('switch')) return ['relay.channel']
  if (id.includes('button') || type.includes('button')) return ['button.input']
  if (id.includes('sensor') || type.includes('sensor') || id.includes('temp') || type.includes('temperature')) return ['sensor.input']
  return []
}

function isHardwarePaletteItem(item) {
  const capabilities = inferRequiredCapabilitiesFromItem(item)
  const wiring = inferRequiredWiringFromItem(item)
  if (String(item?.kind || '') === 'device') {
    return true
  }
  return capabilities.length > 0 || wiring.length > 0
}

function isItemInPaletteTab(item, tabId) {
  if (tabId === 'all') {
    return true
  }
  if (tabId === 'hardware') {
    return isHardwarePaletteItem(item)
  }
  return String(item?.kind || '').toLowerCase() === tabId
}

function resolvePlatformioBuildProfile(buildProfile) {
  const platformioEnv = String(buildProfile?.platformioEnv || '')
  if (!platformioEnv) {
    return {
      platformioEnv: null,
      envExists: true,
      missingFlags: [],
      buildFlags: [],
    }
  }
  const env = platformioProfiles?.environments?.[platformioEnv]
  const buildFlags = Array.isArray(env?.buildFlags) ? env.buildFlags : []
  const requiredFlags = Array.isArray(buildProfile?.requiredFlags) ? buildProfile.requiredFlags : []
  const missingFlags = requiredFlags.filter((flag) => !buildFlags.includes(flag))
  return {
    platformioEnv,
    envExists: Boolean(env),
    missingFlags,
    buildFlags,
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTargetPayload(payload) {
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : Array.isArray(payload) ? payload : []
  return nodes.map((node) => ({
    ...node,
    id: String(node?.id || node?.nodeId || node?.ip || 'node'),
    name: String(node?.name || node?.nodeName || node?.id || node?.ip || 'Node'),
    ip: String(node?.ip || ''),
    type: String(node?.type || node?.role || 'node'),
    services: node?.capabilities && typeof node.capabilities === 'object' ? Object.keys(node.capabilities) : [],
  })).map((node) => {
    const variant = inferVariantFromNode(node)
    const servicesAsCapabilities = (node.services || []).map((value) => normalizeCapability(String(value).replace(/^\//, '').replaceAll('/', '.'))).filter(Boolean)
    const capabilities = Array.from(new Set([...
      (variant?.capabilities || []).map(normalizeCapability),
      ...servicesAsCapabilities,
    ]))
    return {
      ...node,
      variantId: variant.id,
      variantLabel: variant.label,
      runtimeKind: variant.runtimeKind,
      buildProfile: resolvePlatformioBuildProfile(variant.buildProfile),
      constraints: variant?.wiring?.constraints || [],
      wiringProvides: Array.isArray(variant?.wiring?.provides) ? variant.wiring.provides : [],
      capabilities,
    }
  })
}

function buildLazyTargetDetails(target) {
  return [
    {
      id: 'variant',
      text: `Variant: ${target.variantLabel} (${target.runtimeKind})`,
      className: 'flow-target-variant',
    },
    {
      id: 'build',
      text: target.buildProfile?.platformioEnv
        ? `Build: ${target.buildProfile.platformioEnv}${target.buildProfile.envExists ? '' : ' (missing in platformio profiles)'}`
        : 'Build: runtime managed',
      className: 'flow-target-build',
    },
    {
      id: 'wiring',
      text: `Wiring provides: ${(target.wiringProvides || []).join(', ') || 'none declared'}`,
      className: 'flow-target-build',
    },
    {
      id: 'services',
      text: `Services: ${target.services.slice(0, 6).join(', ') || 'No services listed.'}`,
      className: 'flow-target-services',
    },
  ]
}

function getNodeCenter(node) {
  return { x: node.x + 100, y: node.y + 38 }
}

function CatalogItemIcon({ iconGraphic, alt, className = 'flow-item-icon', fallbackClassName = 'flow-icon-fallback' }) {
  if (!iconGraphic) {
    return <span className={fallbackClassName} />
  }
  return <img className={className} src={iconGraphic} alt={alt} />
}

export default function FlowDesignerPage() {
  const [catalog, setCatalog] = useState([])
  const [targets, setTargets] = useState([])
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [edgeSourceNodeId, setEdgeSourceNodeId] = useState(null)
  const [edgeType, setEdgeType] = useState('message-broker-call')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('Ready')
  const [activeEdgeIndex, setActiveEdgeIndex] = useState(null)
  const [requiredCapabilitiesDraft, setRequiredCapabilitiesDraft] = useState('')
  const [requiredWiringDraft, setRequiredWiringDraft] = useState('')
  const [paletteTab, setPaletteTab] = useState('all')
  const [expandedTargets, setExpandedTargets] = useState({})
  const [targetLazyDetails, setTargetLazyDetails] = useState({})
  const [targetLazyLoading, setTargetLazyLoading] = useState({})

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        const [snapshot, targetsPayload] = await Promise.all([
          fetchCatalogSnapshot(),
          getJsonAsActor('/api/nodes', 'Node request failed').catch(() => ({ nodes: [] })),
        ])
        if (!active) return
        setCatalog(Array.isArray(snapshot?.objects) ? snapshot.objects : [])
        setTargets(normalizeTargetPayload(targetsPayload))
        setStatusText('Catalog and deployment targets loaded.')
      } catch (error) {
        if (!active) return
        setStatusText(`Load warning: ${String(error?.message || error)}`)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [])

  const searchableCatalog = useMemo(() => {
    const normalizedQuery = String(query || '').trim().toLowerCase()
    return catalog
      .filter((item) => {
        if (!normalizedQuery) return true
        const haystack = [
          item?.id,
          item?.name,
          item?.kind,
          item?.type,
          item?.description,
          item?.usageNotes,
        ].join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
  }, [catalog, query])

  const paletteTabCounts = useMemo(() => {
    const counts = {}
    for (const tab of PALETTE_TABS) {
      counts[tab.id] = searchableCatalog.filter((item) => isItemInPaletteTab(item, tab.id)).length
    }
    return counts
  }, [searchableCatalog])

  const filteredCatalog = useMemo(() => {
    return searchableCatalog.filter((item) => isItemInPaletteTab(item, paletteTab))
  }, [searchableCatalog, paletteTab])

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) || null : null

  useEffect(() => {
    setRequiredCapabilitiesDraft((selectedNode?.requiredCapabilities || []).join(', '))
    setRequiredWiringDraft((selectedNode?.requiredWiring || []).join(', '))
  }, [selectedNode?.id, selectedNode?.requiredCapabilities, selectedNode?.requiredWiring])

  function updateSelectedRequiredCapabilities(textValue) {
    if (!selectedNodeId) return
    const nextCapabilities = String(textValue || '')
      .split(',')
      .map((value) => normalizeCapability(value))
      .filter(Boolean)
    setNodes((previous) => previous.map((node) => {
      if (node.id !== selectedNodeId) return node
      return {
        ...node,
        requiredCapabilities: Array.from(new Set(nextCapabilities)),
      }
    }))
  }

  function updateSelectedRequiredWiring(textValue) {
    if (!selectedNodeId) return
    const nextWiring = String(textValue || '')
      .split(',')
      .map((value) => normalizeCapability(value))
      .filter(Boolean)
    setNodes((previous) => previous.map((node) => {
      if (node.id !== selectedNodeId) return node
      return {
        ...node,
        requiredWiring: Array.from(new Set(nextWiring)),
      }
    }))
  }

  const compatibilityByTarget = useMemo(() => {
    const required = (selectedNode?.requiredCapabilities || []).map(normalizeCapability).filter(Boolean)
    const requiredWiring = (selectedNode?.requiredWiring || []).map(normalizeCapability).filter(Boolean)
    const result = new Map()
    for (const target of targets) {
      const available = (target.capabilities || []).map(normalizeCapability)
      const wiringProvides = (target.wiringProvides || []).map(normalizeCapability)
      const missing = required.filter((capability) => !available.includes(capability))
      const missingWiring = requiredWiring.filter((item) => !wiringProvides.includes(item))
      const buildIssues = []
      if (!target.buildProfile?.envExists) {
        buildIssues.push(`platformio env missing: ${target.buildProfile?.platformioEnv || 'unknown'}`)
      }
      if (Array.isArray(target.buildProfile?.missingFlags) && target.buildProfile.missingFlags.length) {
        buildIssues.push(`missing build flags: ${target.buildProfile.missingFlags.join(', ')}`)
      }
      result.set(target.id, {
        isCompatible: missing.length === 0 && missingWiring.length === 0 && buildIssues.length === 0,
        missing,
        missingWiring,
        buildIssues,
        available,
        wiringProvides,
      })
    }
    return result
  }, [targets, selectedNode])

  const loadTargetChildren = useCallback(async (target) => {
    const targetId = String(target?.id || '')
    if (!targetId) return
    if (targetLazyDetails[targetId] || targetLazyLoading[targetId]) return
    setTargetLazyLoading((previous) => ({ ...previous, [targetId]: true }))
    try {
      // Keep this asynchronous so each tree node resolves children on demand.
      await Promise.resolve()
      setTargetLazyDetails((previous) => ({
        ...previous,
        [targetId]: buildLazyTargetDetails(target),
      }))
    } finally {
      setTargetLazyLoading((previous) => ({ ...previous, [targetId]: false }))
    }
  }, [targetLazyDetails, targetLazyLoading])

  const toggleTargetExpanded = useCallback((target) => {
    const targetId = String(target?.id || '')
    if (!targetId) return
    const shouldExpand = !expandedTargets[targetId]
    setExpandedTargets((previous) => ({ ...previous, [targetId]: shouldExpand }))
    if (shouldExpand) {
      void loadTargetChildren(target)
    }
  }, [expandedTargets, loadTargetChildren])

  function addNodeFromItem(item, position = null) {
    const count = nodes.length
    const x = Number.isFinite(position?.x) ? position.x : 26 + ((count % 4) * 228)
    const y = Number.isFinite(position?.y) ? position.y : 24 + (Math.floor(count / 4) * 130)
    setNodes((previous) => ([
      ...previous,
      {
        id: createId(item.kind || 'node'),
        label: item.name || item.id || 'Node',
        kind: item.kind || 'service',
        type: item.type || 'untyped',
        iconGraphic: item.iconGraphic || '',
        description: item.description || '',
        usageNotes: item.usageNotes || '',
        requiredCapabilities: inferRequiredCapabilitiesFromItem(item),
        requiredWiring: inferRequiredWiringFromItem(item),
        x,
        y,
        target: null,
      },
    ]))
  }

  function deleteNode(nodeId) {
    setNodes((previous) => previous.filter((node) => node.id !== nodeId))
    setEdges((previous) => previous.filter((edge) => edge.from !== nodeId && edge.to !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    if (edgeSourceNodeId === nodeId) setEdgeSourceNodeId(null)
  }

  function createEdge(targetId) {
    if (!edgeSourceNodeId || edgeSourceNodeId === targetId) return
    setEdges((previous) => {
      const exists = previous.some((edge) => edge.from === edgeSourceNodeId && edge.to === targetId && edge.type === edgeType)
      if (exists) return previous
      return [...previous, { id: createId('edge'), from: edgeSourceNodeId, to: targetId, type: edgeType, label: edgeType }]
    })
    setEdgeSourceNodeId(null)
  }

  function bindSelectedToTarget(target) {
    if (!selectedNodeId) {
      setStatusText('Select a node first, then bind a deployment target.')
      return
    }
    setNodes((previous) => previous.map((node) => {
      if (node.id !== selectedNodeId) return node
      return {
        ...node,
        target: {
          id: target.id,
          name: target.name,
          ip: target.ip,
          services: target.services,
        },
      }
    }))
  }

  function handleCanvasDrop(event) {
    event.preventDefault()
    const payload = event.dataTransfer.getData('application/vnd.pulse.catalog+json')
    if (!payload) return
    try {
      const data = JSON.parse(payload)
      const rect = event.currentTarget.getBoundingClientRect()
      addNodeFromItem(data.item, {
        x: Math.max(16, Math.round(event.clientX - rect.left - 96)),
        y: Math.max(16, Math.round(event.clientY - rect.top - 32)),
      })
    } catch {
      setStatusText('Drop failed due to malformed drag payload.')
    }
  }

  function runPlayback(stepByStep = false) {
    if (!edges.length) {
      setStatusText('Add at least one edge to play the flow.')
      return
    }
    setActiveEdgeIndex(null)
    if (stepByStep) {
      setActiveEdgeIndex((previous) => {
        if (previous === null) return 0
        if (previous >= edges.length - 1) return 0
        return previous + 1
      })
      return
    }
    edges.forEach((_, index) => {
      window.setTimeout(() => setActiveEdgeIndex(index), index * 380)
    })
    window.setTimeout(() => setActiveEdgeIndex(null), edges.length * 380 + 280)
  }

  const nodeById = useMemo(() => {
    const map = new Map()
    for (const node of nodes) map.set(node.id, node)
    return map
  }, [nodes])

  return (
    <div className="flow-designer-page">
      <header className="flow-designer-header">
        <div>
          <div className="flow-designer-title">Flow Designer</div>
          <div className="flow-designer-subtitle">Drag reusable catalog objects to the center canvas and connect typed edges.</div>
        </div>
        <div className="flow-designer-actions">
          <label>
            Edge
            <select value={edgeType} onChange={(event) => setEdgeType(event.target.value)}>
              {EDGE_TYPES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => runPlayback(false)}>Run</button>
          <button type="button" onClick={() => runPlayback(true)}>Step</button>
        </div>
      </header>

      <div className="flow-designer-shell">
        <aside className="flow-pane flow-pane-palette">
          <div className="flow-pane-header">Catalog Palette</div>
          <div className="flow-palette-search-wrap">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, id, type, description, or usage notes"
            />
          </div>
          <div className="flow-list flow-list-palette">
            {!filteredCatalog.length ? <div className="flow-empty-side">No palette items in this tab for the current search.</div> : null}
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="flow-catalog-card"
                draggable
                onClick={() => addNodeFromItem(item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/vnd.pulse.catalog+json', JSON.stringify({ item }))
                  event.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <div className="flow-catalog-head">
                  <CatalogItemIcon
                    iconGraphic={item.iconGraphic}
                    alt={`${item.name} icon`}
                    className="flow-palette-item-icon"
                    fallbackClassName="flow-palette-icon-fallback"
                  />
                  <div className="flow-catalog-head-copy">
                    <div className="flow-catalog-name">{item.name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flow-palette-tabs" role="tablist" aria-label="Palette categories">
            {PALETTE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={paletteTab === tab.id}
                className={`flow-palette-tab ${paletteTab === tab.id ? 'active' : ''}`}
                onClick={() => setPaletteTab(tab.id)}
              >
                {tab.label}
                <span className="flow-palette-tab-count">{paletteTabCounts[tab.id] || 0}</span>
              </button>
            ))}
          </div>
        </aside>

        <main
          className="flow-pane flow-pane-canvas"
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={handleCanvasDrop}
        >
          <div className="flow-pane-header">Workflow Canvas</div>
          <div className="flow-canvas-stage">
            <svg className="flow-edge-layer" viewBox="0 0 2200 1200" preserveAspectRatio="none">
              {edges.map((edge, index) => {
                const from = nodeById.get(edge.from)
                const to = nodeById.get(edge.to)
                if (!from || !to) return null
                const start = getNodeCenter(from)
                const end = getNodeCenter(to)
                const curve = Math.max(44, Math.abs(end.x - start.x) * 0.3)
                const d = `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`
                const isActive = index === activeEdgeIndex
                return (
                  <g key={edge.id}>
                    <path className={`flow-edge ${isActive ? 'active' : ''}`} d={d} />
                    <text className={`flow-edge-label ${isActive ? 'active' : ''}`} x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle">{edge.label}</text>
                  </g>
                )
              })}
            </svg>
            {!nodes.length ? <div className="flow-empty">Drop catalog items here to create your workflow.</div> : null}
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`flow-node ${selectedNodeId === node.id ? 'selected' : ''} ${edgeSourceNodeId === node.id ? 'link-source' : ''}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                onClick={() => {
                  if (edgeSourceNodeId && edgeSourceNodeId !== node.id) {
                    createEdge(node.id)
                    return
                  }
                  setSelectedNodeId(node.id)
                }}
              >
                <div className="flow-node-head">
                  <CatalogItemIcon iconGraphic={node.iconGraphic} alt={`${node.label} icon`} />
                  <div>
                    <div className="flow-node-name">{node.label}</div>
                    <div className="flow-node-meta">{node.type}</div>
                  </div>
                </div>
                <div className="flow-node-target">{node?.target?.id ? `Target: ${node.target.id}` : 'Target: not bound'}</div>
                <div className="flow-node-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedNodeId(node.id) }}>Select</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); setEdgeSourceNodeId(node.id); setSelectedNodeId(node.id) }}>Link</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); deleteNode(node.id) }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="flow-pane flow-pane-targets">
          <div className="flow-pane-header">Deployment Targets</div>
          <div className="flow-target-tree-wrap">
            {!targets.length ? <div className="flow-empty-side">No deployment targets available.</div> : null}
            {targets.length ? (
              <ul className="flow-target-tree-root">
                {targets.map((target) => {
                  const compatibility = compatibilityByTarget.get(target.id)
                  const compatClass = compatibility?.isCompatible ? 'compatible' : 'incompatible'
                  const isExpanded = Boolean(expandedTargets[target.id])
                  const lazyRows = targetLazyDetails[target.id]
                  const isLoadingRows = Boolean(targetLazyLoading[target.id])
                  return (
                    <li key={target.id} className={`flow-target-tree-node ${compatClass}`}>
                      <button
                        type="button"
                        className="flow-target-tree-toggle"
                        aria-expanded={isExpanded}
                        onClick={() => toggleTargetExpanded(target)}
                      >
                        <span className="flow-target-tree-toggle-label">
                          <span className="flow-target-name">{target.name}</span>
                          <span className="flow-target-meta">{target.ip || 'n/a'}</span>
                        </span>
                      </button>
                      {isExpanded ? (
                        <ul className="flow-target-tree-children">
                          {isLoadingRows ? <li className="flow-target-tree-loading">Loading target details...</li> : null}
                          {!isLoadingRows && Array.isArray(lazyRows) ? lazyRows.map((row) => (
                            <li key={`${target.id}-${row.id}`} className={row.className}>{row.text}</li>
                          )) : null}
                          {selectedNode ? (
                            compatibility?.isCompatible ? (
                              <li><div className="flow-compat-ok">Compatible with selected workflow node.</div></li>
                            ) : (
                              <li>
                                <div className="flow-compat-missing">
                                  {compatibility?.missing?.length ? <div>Missing capabilities: {compatibility.missing.join(', ')}</div> : null}
                                  {compatibility?.missingWiring?.length ? <div>Missing wiring: {compatibility.missingWiring.join(', ')}</div> : null}
                                  {compatibility?.buildIssues?.length ? <div>Build issues: {compatibility.buildIssues.join(' | ')}</div> : null}
                                </div>
                              </li>
                            )
                          ) : null}
                          <li>
                            <button type="button" onClick={() => bindSelectedToTarget(target)}>Bind Selected Node</button>
                          </li>
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>

          <div className="flow-pane-header">Selection</div>
          <div className="flow-selection-box">
            {selectedNode ? (
              <>
                <div className="flow-selection-name">{selectedNode.label}</div>
                <div>{selectedNode.description || 'No description provided.'}</div>
                <div className="flow-selection-usage">{selectedNode.usageNotes || 'No usage notes provided.'}</div>
                <div className="flow-selection-capabilities">
                  Required capabilities:
                  <input
                    type="text"
                    value={requiredCapabilitiesDraft}
                    onChange={(event) => setRequiredCapabilitiesDraft(event.target.value)}
                    onBlur={() => updateSelectedRequiredCapabilities(requiredCapabilitiesDraft)}
                    placeholder="camera.capture, display.render, upnp.discover"
                  />
                </div>
                <div className="flow-selection-capabilities">
                  Required wiring:
                  <input
                    type="text"
                    value={requiredWiringDraft}
                    onChange={(event) => setRequiredWiringDraft(event.target.value)}
                    onBlur={() => updateSelectedRequiredWiring(requiredWiringDraft)}
                    placeholder="camera.module, display.panel, relay.channel"
                  />
                </div>
              </>
            ) : (
              <div className="flow-empty-side">Select a node to inspect description and usage notes.</div>
            )}
          </div>
        </aside>
      </div>

      <footer className="flow-designer-footer">
        <div>{loading ? 'Loading...' : statusText}</div>
        <div>{nodes.length} nodes · {edges.length} edges</div>
      </footer>
    </div>
  )
}
