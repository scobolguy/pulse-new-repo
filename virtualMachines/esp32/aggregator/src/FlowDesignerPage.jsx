import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCatalogSnapshot } from './catalogStudio/catalogApi'
import { getJsonAsActor } from './http-client'
import { getDefaultProjectWorkspace, getProjectDefinition, hydrateProjectWorkspaceFromServer, loadProjectWorkspace, saveProjectWorkspace } from './projectWorkspace'
import nodeVariantRegistry from './catalogStudio/nodeVariantRegistry.json'
import platformioProfiles from './catalogStudio/platformioProfiles.json'

const FLOW_NODE_TYPES = [
  { id: 'mapper', label: 'Mapper' },
  { id: 'compute', label: 'Compute' },
  { id: 'gateway', label: 'Gateway' },
  { id: 'queue', label: 'Queue' },
  { id: 'service', label: 'Service' },
  { id: 'daemon', label: 'Daemon' },
  { id: 'contract', label: 'Contract' },
  { id: 'state', label: 'State' },
  { id: 'subflow', label: 'Subflow' },
]

const EDGE_TYPES = [
  { id: 'message-broker-call', label: 'Message Broker Call (legacy)' },
  { id: 'file-feed', label: 'File Feed (legacy)' },
  { id: 'service-call', label: 'Service Call (legacy)' },
  { id: 'logical-condition-edge', label: 'Logical Condition' },
  { id: 'file-transfer-edge', label: 'File Transfer' },
  { id: 'transform-edge', label: 'Transform Edge' },
  { id: 'compute-edge', label: 'Compute Edge' },
  { id: 'gateway-call-edge', label: 'Gateway Call Edge' },
  { id: 'queue-edge', label: 'Queue Edge' },
  { id: 'service-call-edge', label: 'Service Call Edge' },
  { id: 'daemon-trigger-edge', label: 'Daemon Trigger Edge' },
  { id: 'state-edge', label: 'State Edge' },
  { id: 'contract-edge', label: 'Contract Edge' },
  { id: 'retry-path', label: 'Retry Path' },
  { id: 'completion-edge', label: 'Completion Edge' },
]

const EDGE_LABEL_BY_ID = new Map(EDGE_TYPES.map((item) => [item.id, item.label]))
const EDGE_TYPE_ID_SET = new Set(EDGE_TYPES.map((item) => item.id))

const FLOW_FILE_KIND = 'pulse.canvas.generic-flow'
const FLOW_FILE_VERSION = '1.0.0'
const DEFAULT_FLOW_FILE_NAME = 'untitled.flw'

const ALL_FLOW_NODE_TYPE_IDS = FLOW_NODE_TYPES.map((item) => item.id)

const EDGE_VALIDATION_RULES = {
  // Legacy edges stay permissive for backward compatibility.
  'message-broker-call': { source: ALL_FLOW_NODE_TYPE_IDS, target: ALL_FLOW_NODE_TYPE_IDS },
  'file-feed': { source: ALL_FLOW_NODE_TYPE_IDS, target: ALL_FLOW_NODE_TYPE_IDS },
  'service-call': { source: ALL_FLOW_NODE_TYPE_IDS, target: ALL_FLOW_NODE_TYPE_IDS },
  'logical-condition-edge': { source: ['compute', 'gateway', 'state', 'service'], target: ALL_FLOW_NODE_TYPE_IDS },
  'file-transfer-edge': { source: ['service', 'gateway', 'queue', 'daemon'], target: ['queue', 'service', 'state', 'gateway'] },

  // New typed edges.
  'transform-edge': { source: ['mapper'], target: ['compute', 'service', 'gateway', 'queue', 'state'] },
  'compute-edge': { source: ['compute'], target: ['compute', 'gateway', 'queue', 'service', 'state'] },
  'gateway-call-edge': { source: ['mapper', 'compute', 'service', 'daemon'], target: ['gateway'] },
  'queue-edge': { source: ['mapper', 'compute', 'service', 'gateway', 'daemon', 'subflow', 'queue'], target: ['queue', 'subflow'] },
  'service-call-edge': { source: ['mapper', 'compute', 'gateway', 'queue', 'daemon', 'service', 'subflow'], target: ['service', 'subflow'] },
  'daemon-trigger-edge': { source: ['daemon'], target: ['mapper', 'compute', 'service', 'gateway', 'queue', 'state'] },
  'state-edge': { source: ['mapper', 'compute', 'gateway', 'queue', 'service', 'daemon'], target: ['state'] },
  'contract-edge': { source: ['service', 'gateway', 'daemon', 'compute'], target: ['contract'] },
  'retry-path': { source: ['queue'], target: ['mapper', 'compute', 'service', 'gateway'] },
  'completion-edge': { source: ['mapper', 'compute', 'gateway', 'queue', 'service', 'daemon', 'state'], target: ['service', 'gateway', 'state'] },
}

const PALETTE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'daemon', label: 'Daemons' },
  { id: 'service', label: 'Services' },
  { id: 'user-defined', label: 'User Defined' },
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

function normalizeFlowNodeType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'service'
  if (normalized === 'map' || normalized === 'mapper-engine') return 'mapper'
  if (normalized === 'decision') return 'compute'
  if (normalized === 'external') return 'gateway'
  if (normalized === 'buffer') return 'queue'
  return normalized
}

function inferFlowNodeTypeFromItem(item) {
  const kind = normalizeFlowNodeType(item?.kind)
  const type = String(item?.type || '').toLowerCase()
  const id = String(item?.id || '').toLowerCase()

  if (FLOW_NODE_TYPES.some((entry) => entry.id === kind)) {
    return kind
  }
  if (type.includes('mapper')) return 'mapper'
  if (type.includes('gateway') || id.includes('gateway')) return 'gateway'
  if (type.includes('queue') || id.includes('queue')) return 'queue'
  if (type.includes('daemon') || id.includes('daemon')) return 'daemon'
  if (type.includes('contract') || id.includes('contract')) return 'contract'
  if (type.includes('state') || id.includes('state')) return 'state'
  if (type.includes('compute') || id.includes('compute') || id.includes('rule')) return 'compute'
  return 'service'
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
  if (tabId === 'user-defined') {
    return String(item?.kind || '').toLowerCase() === 'subflow'
  }
  return String(item?.kind || '').toLowerCase() === tabId
}

function normalizeSubflowDefinition(subflow, index = 0) {
  const rawName = String(subflow?.subflowName || subflow?.name || subflow?.label || '').trim()
  const fallbackName = rawName || `subflow-${index + 1}`
  const id = String(subflow?.id || fallbackName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `subflow-${index + 1}`
  return {
    id,
    kind: 'subflow',
    type: 'subflow',
    name: rawName || fallbackName,
    label: rawName || fallbackName,
    subflowName: rawName || fallbackName,
    inputShape: normalizeShapeRef(subflow?.inputShape),
    outputShape: normalizeShapeRef(subflow?.outputShape),
    implementationRef: String(subflow?.implementationRef || '').trim(),
    typeParameters: normalizeParameterList(subflow?.typeParameters),
    typeBindings: normalizeBindingMap(subflow?.typeBindings),
    description: String(subflow?.description || '').trim(),
  }
}

function collectSubflowDefinitions(nodes, existingSubflows = []) {
  const merged = new Map()
  for (const subflow of Array.isArray(existingSubflows) ? existingSubflows : []) {
    const normalized = normalizeSubflowDefinition(subflow, merged.size)
    merged.set(normalized.id, normalized)
  }
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (String(node?.flowNodeType || node?.kind || node?.type).toLowerCase() !== 'subflow') continue
    const config = node?.config && typeof node.config === 'object' ? node.config : {}
    const normalized = normalizeSubflowDefinition({
      id: node?.subflowId || node?.id,
      name: config.subflowName || node?.label || node?.visualObjectName,
      label: config.subflowName || node?.label || node?.visualObjectName,
      subflowName: config.subflowName || node?.label || node?.visualObjectName,
      inputShape: config.inputShape,
      outputShape: config.outputShape,
      implementationRef: config.implementationRef,
      typeParameters: config.typeParameters,
      typeBindings: config.typeBindings,
      description: node?.description,
    }, merged.size)
    merged.set(normalized.id, normalized)
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function subflowDefinitionToPaletteItem(subflow) {
  const normalized = normalizeSubflowDefinition(subflow)
  return {
    id: normalized.id,
    name: normalized.name,
    kind: 'subflow',
    type: 'subflow',
    iconGraphic: createStubIconGraphic(normalized.name),
    description: normalized.description || 'User-defined subflow',
    usageNotes: normalized.implementationRef || '',
    subflowName: normalized.subflowName,
    inputShape: normalized.inputShape,
    outputShape: normalized.outputShape,
    implementationRef: normalized.implementationRef,
    typeParameters: normalized.typeParameters,
    typeBindings: normalized.typeBindings,
  }
}

function toRulesetPaletteItem(ruleset, index = 0) {
  const id = String(ruleset?.id || '').trim() || `ruleset-${index + 1}`
  const label = String(ruleset?.label || id).trim()
  const sourcePatterns = Array.isArray(ruleset?.sourcePatterns) ? ruleset.sourcePatterns.map((item) => String(item || '').trim()).filter(Boolean) : []
  const targetPatterns = Array.isArray(ruleset?.targetPatterns) ? ruleset.targetPatterns.map((item) => String(item || '').trim()).filter(Boolean) : []
  const sourceShape = sourcePatterns[0] || ''
  const targetShape = targetPatterns[0] || ''
  return {
    id,
    name: label,
    kind: 'map',
    type: 'ruleset',
    iconGraphic: createStubIconGraphic(label),
    description: String(ruleset?.description || 'Project ruleset').trim(),
    usageNotes: `${sourcePatterns.length ? sourcePatterns.join(', ') : '*'} -> ${targetPatterns.length ? targetPatterns.join(', ') : '*'}`,
    rulesetId: id,
    sourcePatterns,
    targetPatterns,
    sourceShape,
    targetShape,
  }
}

function toMessageDefinitionPaletteItem(definition, index = 0) {
  const id = String(definition?.id || '').trim() || `message-definition-${index + 1}`
  const name = String(definition?.name || id).trim()
  const schemaRef = String(definition?.schemaRef || '').trim()
  const format = String(definition?.format || '').trim()
  const version = String(definition?.version || '').trim()
  return {
    id,
    name,
    kind: 'contract',
    type: 'message-definition',
    iconGraphic: createStubIconGraphic(name),
    description: `Message definition${format ? ` (${format})` : ''}`,
    usageNotes: [schemaRef, version].filter(Boolean).join(' '),
    contractId: id,
    inputSchema: schemaRef || id,
    outputSchema: schemaRef || id,
    protocol: format || '',
  }
}

function collectProjectArtifactPaletteItems(projectModel) {
  const model = projectModel && typeof projectModel === 'object' ? projectModel : {}
  const rulesets = Array.isArray(model.rulesets) ? model.rulesets : []
  const messageDefinitions = Array.isArray(model.messageDefinitions) ? model.messageDefinitions : []
  return [
    ...rulesets.map((ruleset, index) => toRulesetPaletteItem(ruleset, index)),
    ...messageDefinitions.map((definition, index) => toMessageDefinitionPaletteItem(definition, index)),
  ]
}

function getPaletteItemBadge(item) {
  const type = String(item?.type || '').toLowerCase()
  if (type === 'ruleset') {
    return { label: 'Project Rule Set', className: 'artifact-ruleset' }
  }
  if (type === 'message-definition') {
    return { label: 'Message Definition', className: 'artifact-message-definition' }
  }
  return null
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
    const protocols = Array.from(new Set(capabilities
      .filter((capability) => capability.startsWith('protocol.'))
      .map((capability) => capability.slice('protocol.'.length))))
    const schemas = Array.from(new Set(capabilities
      .filter((capability) => capability.startsWith('schema.'))
      .map((capability) => capability.slice('schema.'.length))))
    const slaProfiles = Array.from(new Set(capabilities
      .filter((capability) => capability.startsWith('sla.'))
      .map((capability) => capability.slice('sla.'.length))))
    return {
      ...node,
      variantId: variant.id,
      variantLabel: variant.label,
      runtimeKind: variant.runtimeKind,
      buildProfile: resolvePlatformioBuildProfile(variant.buildProfile),
      constraints: variant?.wiring?.constraints || [],
      wiringProvides: Array.isArray(variant?.wiring?.provides) ? variant.wiring.provides : [],
      capabilities,
      protocols,
      schemas,
      slaProfiles,
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
    {
      id: 'protocols',
      text: `Protocols: ${(target.protocols || []).join(', ') || 'none declared'}`,
      className: 'flow-target-services',
    },
    {
      id: 'schemas',
      text: `Schemas: ${(target.schemas || []).join(', ') || 'none declared'}`,
      className: 'flow-target-services',
    },
    {
      id: 'slaProfiles',
      text: `SLA profiles: ${(target.slaProfiles || []).join(', ') || 'none declared'}`,
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

function readDraggedVisualObject(dataTransfer) {
  if (!dataTransfer) return null
  const payloadKeys = [
    'application/vnd.pulse.catalog+json',
    'application/json',
    'text/plain',
  ]
  for (const key of payloadKeys) {
    const rawValue = dataTransfer.getData(key)
    if (!rawValue) continue
    try {
      const parsed = JSON.parse(rawValue)
      if (parsed?.item) return parsed.item
      if (parsed?.id || parsed?.name) return parsed
    } catch {
      if (rawValue.trim()) {
        return { id: rawValue.trim(), name: rawValue.trim() }
      }
    }
  }
  return null
}

function createStubIconGraphic(label) {
  const initial = String(label || 'N').trim().slice(0, 1).toUpperCase() || 'N'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="7" fill="#d4e5fa" stroke="#9ab6d7"/><text x="16" y="21" text-anchor="middle" fill="#173a58" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function nextAvailableVisualObjectName(baseType, existingNodes) {
  const normalizedBase = String(baseType || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'node'
  const usedNames = new Set((Array.isArray(existingNodes) ? existingNodes : [])
    .map((node) => String(node?.visualObjectName || node?.label || '').toLowerCase().trim())
    .filter(Boolean))
  let index = 1
  let candidate = `${normalizedBase}${index}`
  while (usedNames.has(candidate.toLowerCase())) {
    index += 1
    candidate = `${normalizedBase}${index}`
  }
  return candidate
}

function getEdgeTypeLabel(edgeTypeId) {
  return EDGE_LABEL_BY_ID.get(edgeTypeId) || edgeTypeId
}

function ensureFlowFileName(value) {
  const trimmed = String(value || '').trim()
  const base = trimmed || DEFAULT_FLOW_FILE_NAME
  return base.toLowerCase().endsWith('.flw') ? base : `${base}.flw`
}

function normalizeShapeRef(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeShapeSignature(value) {
  return normalizeShapeRef(value).replace(/[^a-z0-9]/g, '')
}

function normalizeParameterList(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  const seen = new Set()
  const next = []
  for (const part of source.split(',')) {
    const token = String(part || '').trim()
    if (!token) continue
    const lower = token.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    next.push(token)
  }
  return next
}

function normalizeBindingMap(value) {
  const next = {}
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, raw] of Object.entries(value)) {
      const param = String(key || '').trim()
      const binding = String(raw || '').trim()
      if (!param || !binding) continue
      next[param] = binding
    }
    return next
  }
  for (const part of String(value || '').split(',')) {
    const [left, right] = String(part || '').split('=')
    const param = String(left || '').trim()
    const binding = String(right || '').trim()
    if (!param || !binding) continue
    next[param] = binding
  }
  return next
}

function mapperShapeMatches(candidateShape, allowedPatterns) {
  if (!Array.isArray(allowedPatterns) || allowedPatterns.length === 0) return false
  const normalizedCandidate = normalizeShapeRef(candidateShape)
  const signatureCandidate = normalizeShapeSignature(candidateShape)
  return allowedPatterns.some((pattern) => {
    const normalizedPattern = normalizeShapeRef(pattern)
    if (!normalizedPattern) return false
    if (normalizedPattern === '*') return true
    if (normalizedCandidate === normalizedPattern) return true
    return signatureCandidate === normalizeShapeSignature(normalizedPattern)
  })
}

function getMapperRulesetOptions(sourceShape, targetShape, catalog = []) {
  const source = normalizeShapeRef(sourceShape)
  const target = normalizeShapeRef(targetShape)
  if (!source || !target) return []

  const candidateCatalog = Array.isArray(catalog) ? catalog : []
  if (candidateCatalog.length === 0) return []

  return candidateCatalog
    .filter((ruleset) => mapperShapeMatches(source, ruleset.sourcePatterns) && mapperShapeMatches(target, ruleset.targetPatterns))
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
    .map((ruleset) => ({
      id: String(ruleset.id || '').trim(),
      label: String(ruleset.label || ruleset.id || '').trim(),
      description: String(ruleset.description || '').trim(),
      recommended: ruleset.recommended === true,
    }))
    .filter((ruleset) => !!ruleset.id)
}

  function getDefaultNodeConfig(flowNodeType) {
  const type = normalizeFlowNodeType(flowNodeType)
  if (type === 'mapper') {
    return { inputSchema: '', outputSchema: '', ruleset: '' }
  }
  if (type === 'compute') {
    return {
      policyRef: '',
      conditionExpr: '',
      routeSuccess: '',
      routeFailure: '',
      operationRef: '',
      argumentN: '3',
      runtimeKind: 'pmachine',
      deploymentTarget: 'esp32-native',
      outputMode: 'console',
      programSource: '',
    }
  }
  if (type === 'gateway') {
    return { endpoint: '', protocol: 'http', contractRef: '' }
  }
  if (type === 'queue') {
    return { queueName: '', inputShape: '', outputShape: '', retryPolicy: '', delayMs: '' }
  }
  if (type === 'daemon') {
    return { schedule: '', triggerType: '', maxConcurrency: '' }
  }
  if (type === 'subflow') {
    return { subflowName: '', inputShape: '', outputShape: '', implementationRef: '', typeParameters: [], typeBindings: {} }
  }
  if (type === 'state') {
    return { storeRef: '', stateSchema: '', retentionPolicy: '' }
  }
  if (type === 'contract') {
    return { contractId: '', inputSchema: '', outputSchema: '', protocol: '' }
  }
  if (type === 'service') {
    return { inputShape: '', outputShape: '', operationRef: '', capabilityRef: '', timeoutMs: '' }
  }
  return { operationRef: '', capabilityRef: '', timeoutMs: '' }
}

function getShapeFieldsForNodeType(flowNodeType) {
  const type = normalizeFlowNodeType(flowNodeType)
  if (type === 'queue' || type === 'service' || type === 'subflow') {
    return ['inputShape', 'outputShape']
  }
  return []
}

function getConfigFieldsForNodeType(flowNodeType) {
  const type = normalizeFlowNodeType(flowNodeType)
  if (type === 'mapper') {
    return [
      { key: 'inputSchema', label: 'Source map', placeholder: 'swift-mt103' },
      { key: 'outputSchema', label: 'Destination map', placeholder: 'pacs.008.001.14' },
      { key: 'ruleset', label: 'Ruleset', placeholder: 'CBDS_MT103_TO_PACS008' },
    ]
  }
  if (type === 'compute') {
    return [
      { key: 'policyRef', label: 'Policy ref', placeholder: 'RTGS_SLA_MON_FRI_9_17' },
      { key: 'conditionExpr', label: 'Condition expression', placeholder: 'now in slaWindow' },
      { key: 'routeSuccess', label: 'Success route', placeholder: 'gateway_RTGS' },
      { key: 'routeFailure', label: 'Failure route', placeholder: 'queue_RTGS_weekend_hold' },
      { key: 'operationRef', label: 'Operation ref', placeholder: 'towers-of-hanoi' },
      { key: 'argumentN', label: 'Argument n', placeholder: '3' },
      { key: 'runtimeKind', label: 'Runtime kind', placeholder: 'pmachine' },
      { key: 'deploymentTarget', label: 'Deployment target', placeholder: 'esp32-native' },
      { key: 'outputMode', label: 'Output mode', placeholder: 'console' },
      { key: 'programSource', label: 'Program source', placeholder: 'Optional PMachine/pcode source text' },
    ]
  }
  if (type === 'gateway') {
    return [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://api.partner.net/payments' },
      { key: 'protocol', label: 'Protocol', placeholder: 'http|grpc|mq|file' },
      { key: 'contractRef', label: 'Contract ref', placeholder: 'contract.payment.v1' },
    ]
  }
  if (type === 'queue') {
    return [
      { key: 'queueName', label: 'Queue name', placeholder: 'queue.iso20022.dispatch' },
      { key: 'inputShape', label: 'Input shape', placeholder: 'MT103' },
      { key: 'outputShape', label: 'Output shape', placeholder: 'PACS.008' },
      { key: 'retryPolicy', label: 'Retry policy', placeholder: 'retry.exponential.v1' },
      { key: 'delayMs', label: 'Delay (ms)', placeholder: '0' },
    ]
  }
  if (type === 'subflow') {
    return [
      { key: 'subflowName', label: 'Black box name', placeholder: 'enrichment.subflow' },
      { key: 'inputShape', label: 'Input shape', placeholder: 'QueueMessage.v1' },
      { key: 'outputShape', label: 'Output shape', placeholder: 'EnrichedMessage.v1' },
      { key: 'implementationRef', label: 'Implementation ref', placeholder: 'service-or-route-name' },
      { key: 'typeParameters', label: 'Type parameters', placeholder: 'TInput,TOutput' },
      { key: 'typeBindings', label: 'Type bindings', placeholder: 'TInput=swift-mt103,TOutput=pacs.008' },
    ]
  }
  if (type === 'daemon') {
    return [
      { key: 'schedule', label: 'Schedule', placeholder: '*/5 * * * *' },
      { key: 'triggerType', label: 'Trigger type', placeholder: 'timer|event|poll' },
      { key: 'maxConcurrency', label: 'Max concurrency', placeholder: '1' },
    ]
  }
  if (type === 'state') {
    return [
      { key: 'storeRef', label: 'Store ref', placeholder: 'audit-store.primary' },
      { key: 'stateSchema', label: 'State schema', placeholder: 'paymentState.v1' },
      { key: 'retentionPolicy', label: 'Retention policy', placeholder: 'retention.90d' },
    ]
  }
  if (type === 'contract') {
    return [
      { key: 'contractId', label: 'Contract ID', placeholder: 'contract.payment.transfer.v1' },
      { key: 'inputSchema', label: 'Input schema', placeholder: 'PaymentRequest.v1' },
      { key: 'outputSchema', label: 'Output schema', placeholder: 'PaymentResponse.v1' },
      { key: 'protocol', label: 'Protocol', placeholder: 'http|grpc|mq|file' },
    ]
  }
  if (type === 'service') {
    return [
      { key: 'inputShape', label: 'Input shape', placeholder: 'Command.v1' },
      { key: 'outputShape', label: 'Output shape', placeholder: 'Result.v1' },
      { key: 'operationRef', label: 'Operation ref', placeholder: 'service.operation.v1' },
      { key: 'capabilityRef', label: 'Capability ref', placeholder: 'service.call' },
      { key: 'timeoutMs', label: 'Timeout (ms)', placeholder: '10000' },
    ]
  }
  return [
    { key: 'operationRef', label: 'Operation ref', placeholder: 'service.operation.v1' },
    { key: 'capabilityRef', label: 'Capability ref', placeholder: 'service.call' },
    { key: 'timeoutMs', label: 'Timeout (ms)', placeholder: '10000' },
  ]
}

function getNodeShapeSpec(node) {
  const type = normalizeFlowNodeType(node?.flowNodeType || node?.kind || node?.type)
  const config = node?.config && typeof node.config === 'object' ? node.config : {}
  return {
    type,
    inputShape: normalizeShapeRef(config.inputShape || config.inputSchema),
    outputShape: normalizeShapeRef(config.outputShape || config.outputSchema),
  }
}

function validateShapeCompatibility(sourceNode, targetNode) {
  const sourceShape = getNodeShapeSpec(sourceNode)
  const targetShape = getNodeShapeSpec(targetNode)
  const sourceOutput = sourceShape.outputShape || sourceShape.inputShape
  const targetInput = targetShape.inputShape || targetShape.outputShape

  if (sourceOutput && targetInput && sourceOutput !== targetInput) {
    return {
      valid: false,
      reason: `Shape mismatch: ${sourceShape.type} outputs ${sourceOutput} but ${targetShape.type} expects ${targetInput}.`,
    }
  }

  return { valid: true, reason: '' }
}

function validateSubflowGenericBindings(node) {
  const nodeType = normalizeFlowNodeType(node?.flowNodeType || node?.kind || node?.type)
  if (nodeType !== 'subflow') {
    return { valid: true, reason: '' }
  }

  const config = node?.config && typeof node.config === 'object' ? node.config : {}
  const typeParameters = normalizeParameterList(config.typeParameters)
  const typeBindings = normalizeBindingMap(config.typeBindings)
  const subflowName = String(config.subflowName || node?.label || node?.visualObjectName || node?.id || 'subflow')

  if (!typeParameters.length) {
    const bindingKeys = Object.keys(typeBindings)
    if (bindingKeys.length) {
      return {
        valid: false,
        reason: `Subflow ${subflowName} defines bindings but has no type parameters.`,
      }
    }
    return { valid: true, reason: '' }
  }

  const parameterSet = new Set(typeParameters)
  const unknownBindings = Object.keys(typeBindings).filter((key) => !parameterSet.has(key))
  if (unknownBindings.length) {
    return {
      valid: false,
      reason: `Subflow ${subflowName} has unknown bindings: ${unknownBindings.join(', ')}.`,
    }
  }
  const missing = typeParameters.filter((parameter) => !String(typeBindings[parameter] || '').trim())
  if (missing.length) {
    const subflowName = String(config.subflowName || node?.label || node?.visualObjectName || node?.id || 'subflow')
    return {
      valid: false,
      reason: `Subflow ${subflowName} is missing bindings for: ${missing.join(', ')}.`,
    }
  }

  return { valid: true, reason: '' }
}

function validateAllSubflowBindings(nodes) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const result = validateSubflowGenericBindings(node)
    if (!result.valid) {
      return result
    }
  }
  return { valid: true, reason: '' }
}

function getNodeTypeForValidation(node) {
  const explicit = normalizeFlowNodeType(node?.flowNodeType)
  if (FLOW_NODE_TYPES.some((item) => item.id === explicit)) {
    return explicit
  }
  return inferFlowNodeTypeFromItem(node)
}

function validateEdgeConnection(edgeTypeId, sourceNode, targetNode) {
  const rule = EDGE_VALIDATION_RULES[edgeTypeId]
  if (!rule) {
    return { valid: true, reason: '' }
  }
  const sourceType = getNodeTypeForValidation(sourceNode)
  const targetType = getNodeTypeForValidation(targetNode)
  const sourceAllowed = Array.isArray(rule.source) ? rule.source.includes(sourceType) : true
  const targetAllowed = Array.isArray(rule.target) ? rule.target.includes(targetType) : true

  if (sourceAllowed && targetAllowed) {
    const shapeCheck = validateShapeCompatibility(sourceNode, targetNode)
    if (!shapeCheck.valid) {
      return shapeCheck
    }
    return { valid: true, reason: '' }
  }

  const edgeLabel = getEdgeTypeLabel(edgeTypeId)
  const sourceHint = Array.isArray(rule.source) ? rule.source.join(', ') : 'any'
  const targetHint = Array.isArray(rule.target) ? rule.target.join(', ') : 'any'
  return {
    valid: false,
    reason: `Invalid ${edgeLabel} link: ${sourceType} -> ${targetType}. Allowed source types: ${sourceHint}. Allowed target types: ${targetHint}.`,
  }
}

export default function FlowDesignerPage({ projectId, projectLabel }) {
  const [catalog, setCatalog] = useState([])
  const [librarianDataTypes, setLibrarianDataTypes] = useState([])
  const [librarianSchemas, setLibrarianSchemas] = useState([])
  const [mapperRulesets, setMapperRulesets] = useState([])
  const [userDefinedSubflows, setUserDefinedSubflows] = useState([])
  const [targets, setTargets] = useState([])
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [edgeSourceNodeId, setEdgeSourceNodeId] = useState(null)
  const [edgeType, setEdgeType] = useState('message-broker-call')
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [flowFileName, setFlowFileName] = useState(DEFAULT_FLOW_FILE_NAME)
  const [filePickerMode, setFilePickerMode] = useState('open')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('Ready')
  const [activeEdgeIndex, setActiveEdgeIndex] = useState(null)
  const [requiredCapabilitiesDraft, setRequiredCapabilitiesDraft] = useState('')
  const [requiredWiringDraft, setRequiredWiringDraft] = useState('')
  const [paletteTab, setPaletteTab] = useState('all')
  const [autoBindEnabled, setAutoBindEnabled] = useState(false)
  const [manualBindOverrides, setManualBindOverrides] = useState({})
  const [expandedTargets, setExpandedTargets] = useState({})
  const [targetLazyDetails, setTargetLazyDetails] = useState({})
  const [targetLazyLoading, setTargetLazyLoading] = useState({})
  const [nodeContextMenu, setNodeContextMenu] = useState(null)
  const [targetContextMenu, setTargetContextMenu] = useState(null)
  const [selectedInspectorTab, setSelectedInspectorTab] = useState('properties')
  const [selectedNodeDraft, setSelectedNodeDraft] = useState(null)
  const [draggingNode, setDraggingNode] = useState(null)
  const [leftPaneWidth, setLeftPaneWidth] = useState(160)
  const [rightPaneWidth, setRightPaneWidth] = useState(160)
  const [resizingPane, setResizingPane] = useState(null)
  const [canvasFocus, setCanvasFocus] = useState(false)
  const canvasStageRef = useRef(null)
  const flowFileInputRef = useRef(null)
  const shellRef = useRef(null)
  const activeProject = getProjectDefinition(projectId)
  const suppressNodeClickRef = useRef(false)
  const suppressPaletteClickRef = useRef(false)

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

    async function loadLibrarianDataTypes() {
      try {
        const [typesPayload, schemasPayload, rulesetsPayload] = await Promise.all([
          getJsonAsActor('/api/librarian/data-types', 'Data librarian request failed'),
          getJsonAsActor('/api/librarian/schemas', 'Librarian schema request failed').catch(() => ({ schemas: [] })),
          getJsonAsActor('/api/librarian/mapper-rulesets', 'Librarian mapper rulesets request failed').catch(() => ({ rulesets: [] })),
        ])
        if (!active) return
        setLibrarianDataTypes(Array.isArray(typesPayload?.types) ? typesPayload.types : [])
        setLibrarianSchemas(Array.isArray(schemasPayload?.schemas) ? schemasPayload.schemas : [])
        setMapperRulesets(Array.isArray(rulesetsPayload?.rulesets) ? rulesetsPayload.rulesets : [])
      } catch {
        if (!active) return
        setLibrarianDataTypes([])
        setLibrarianSchemas([])
        setMapperRulesets([])
      }
    }

    loadData()
    loadLibrarianDataTypes()
    return () => {
      active = false
    }
  }, [])

  const shapeOptions = useMemo(() => {
    const unique = new Map()
    for (const type of librarianDataTypes) {
      const id = String(type?.id || '').trim().toLowerCase()
      if (!id) continue
      unique.set(id, {
        id,
        label: String(type?.label || type?.id || id).trim(),
      })
    }
    return Array.from(unique.values()).sort((left, right) => left.label.localeCompare(right.label))
  }, [librarianDataTypes])

  const mapperMapOptions = useMemo(() => {
    const unique = new Map()

    for (const schema of librarianSchemas) {
      const id = normalizeShapeRef(schema?.name || schema?.typeId || '')
      if (!id) continue
      const schemaName = String(schema?.name || id).trim()
      const schemaPath = String(schema?.path || '').trim()
      const schemaLabel = schemaPath ? `${id} | ${schemaName} | ${schemaPath}` : `${id} | ${schemaName}`
      if (!unique.has(id)) {
        unique.set(id, { id, label: schemaLabel })
      }
    }

    for (const option of shapeOptions) {
      const id = normalizeShapeRef(option?.id)
      if (!id || unique.has(id)) continue
      unique.set(id, { id, label: String(option?.label || option?.id || id).trim() })
    }

    return Array.from(unique.values()).sort((left, right) => left.label.localeCompare(right.label))
  }, [librarianSchemas, shapeOptions])

  useEffect(() => {
    let active = true

    async function loadWorkspaceFlow() {
      const hydrated = await hydrateProjectWorkspaceFromServer(projectId)
      if (!active) return
      const workspace = hydrated?.workspace || loadProjectWorkspace(projectId)
      const savedFlow = workspace.flow?.payload
      if (savedFlow && typeof savedFlow === 'object') {
        applyFlowDocument(savedFlow, workspace.flow?.fileName || `${activeProject.id}.flw`)
        return
      }

      const defaultWorkspace = getDefaultProjectWorkspace(projectId)
      setNodes([])
      setEdges([])
      setUserDefinedSubflows([])
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setEdgeSourceNodeId(null)
      setFlowFileName(defaultWorkspace.flow?.fileName || `${activeProject.id}.flw`)
      setStatusText(`Project ${activeProject.label} loaded.`)
    }

    void loadWorkspaceFlow()
    return () => {
      active = false
    }
  }, [activeProject.id, activeProject.label, projectId])

  const searchableCatalog = useMemo(() => {
    const workspace = loadProjectWorkspace(projectId)
    const projectArtifactItems = collectProjectArtifactPaletteItems(workspace?.projectModel)
    const mergedCatalog = [...catalog, ...projectArtifactItems]
    const normalizedQuery = String(query || '').trim().toLowerCase()
    return mergedCatalog
      .filter((item) => {
        if (!normalizedQuery) return true
        const haystack = [
          item?.id,
          item?.name,
          item?.kind,
          item?.type,
          item?.description,
          item?.usageNotes,
          Array.isArray(item?.actions) ? item.actions.map((action) => [action?.id, action?.label, action?.description].filter(Boolean).join(' ')).join(' ') : '',
        ].join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
  }, [catalog, projectId, query])

  const searchableUserDefinedSubflows = useMemo(() => {
    const normalizedQuery = String(query || '').trim().toLowerCase()
    return userDefinedSubflows
      .filter((item) => {
        if (!normalizedQuery) return true
        const haystack = [
          item?.id,
          item?.name,
          item?.subflowName,
          item?.inputShape,
          item?.outputShape,
          item?.implementationRef,
          item?.description,
        ].join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .map(subflowDefinitionToPaletteItem)
  }, [query, userDefinedSubflows])

  const paletteTabCounts = useMemo(() => {
    const counts = {}
    for (const tab of PALETTE_TABS) {
      const sourceItems = tab.id === 'user-defined' ? searchableUserDefinedSubflows : searchableCatalog
      counts[tab.id] = sourceItems.filter((item) => isItemInPaletteTab(item, tab.id)).length
    }
    return counts
  }, [searchableCatalog, searchableUserDefinedSubflows])

  const filteredCatalog = useMemo(() => {
    const sourceItems = paletteTab === 'user-defined' ? searchableUserDefinedSubflows : searchableCatalog
    return sourceItems.filter((item) => isItemInPaletteTab(item, paletteTab))
  }, [paletteTab, searchableCatalog, searchableUserDefinedSubflows])

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) || null : null

  useEffect(() => {
    setRequiredCapabilitiesDraft((selectedNode?.requiredCapabilities || []).join(', '))
    setRequiredWiringDraft((selectedNode?.requiredWiring || []).join(', '))
    setSelectedNodeDraft(selectedNode ? {
      labelText: String(selectedNode.label || ''),
      xText: String(Number.isFinite(selectedNode.x) ? selectedNode.x : 0),
      yText: String(Number.isFinite(selectedNode.y) ? selectedNode.y : 0),
      config: {
        ...getDefaultNodeConfig(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type),
        ...(selectedNode.config || {}),
      },
      actionsText: (Array.isArray(selectedNode.visualObjectActions) ? selectedNode.visualObjectActions : []).map((action) => {
        const label = String(action?.label || action?.id || '').trim()
        const description = String(action?.description || '').trim()
        return description ? `${label}: ${description}` : label
      }).join('\n'),
    } : null)
  }, [selectedNode])

  function resetSelectedNodeDraft() {
    if (!selectedNode) return
    setRequiredCapabilitiesDraft((selectedNode.requiredCapabilities || []).join(', '))
    setRequiredWiringDraft((selectedNode.requiredWiring || []).join(', '))
    setSelectedNodeDraft({
      labelText: String(selectedNode.label || ''),
      xText: String(Number.isFinite(selectedNode.x) ? selectedNode.x : 0),
      yText: String(Number.isFinite(selectedNode.y) ? selectedNode.y : 0),
      config: {
        ...getDefaultNodeConfig(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type),
        ...(selectedNode.config || {}),
      },
      actionsText: (Array.isArray(selectedNode.visualObjectActions) ? selectedNode.visualObjectActions : []).map((action) => {
        const label = String(action?.label || action?.id || '').trim()
        const description = String(action?.description || '').trim()
        return description ? `${label}: ${description}` : label
      }).join('\n'),
    })
  }

  function updateSelectedRequiredCapabilities(textValue) {
    if (!selectedNodeId) return
    setRequiredCapabilitiesDraft(String(textValue || ''))
  }

  function updateSelectedRequiredWiring(textValue) {
    if (!selectedNodeId) return
    setRequiredWiringDraft(String(textValue || ''))
  }

  function applyComputeHanoiTemplate() {
    if (!selectedNodeId) return
    setRequiredCapabilitiesDraft((previous) => {
      const nextRequired = Array.from(new Set([
        ...String(previous || '').split(',').map((value) => normalizeCapability(value)).filter(Boolean),
        'workflow.execute',
      ]))
      return nextRequired.join(', ')
    })
    setSelectedNodeDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        config: {
          ...getDefaultNodeConfig('compute'),
          ...(previous.config || {}),
          operationRef: 'towers-of-hanoi',
          argumentN: '3',
          runtimeKind: 'pmachine',
          deploymentTarget: 'esp32-native',
          outputMode: 'console',
          programSource: [
            'procedure hanoi(n, fromPeg, toPeg, auxPeg):',
            '  if n == 1 then print("Move disk 1 from " + fromPeg + " to " + toPeg)',
            '  else',
            '    hanoi(n-1, fromPeg, auxPeg, toPeg)',
            '    print("Move disk " + n + " from " + fromPeg + " to " + toPeg)',
            '    hanoi(n-1, auxPeg, toPeg, fromPeg)',
            '',
            'hanoi(3, "A", "C", "B")',
          ].join('\n'),
        },
      }
    })
    setStatusText('Applied Towers of Hanoi n=3 template to selected compute node (ESP32 target profile).')
  }

  function executeComputeNode(node) {
    if (!node || normalizeFlowNodeType(node.flowNodeType || node.kind || node.type) !== 'compute') {
      return false
    }
    const config = {
      ...getDefaultNodeConfig('compute'),
      ...(node.config || {}),
    }
    const operation = String(config.operationRef || '').trim().toLowerCase()
    if (operation !== 'towers-of-hanoi' && operation !== 'hanoi') {
      setStatusText('Compute Run: set operationRef to towers-of-hanoi to run this exercise.')
      return true
    }

    const nParsed = Number.parseInt(String(config.argumentN || '3').trim(), 10)
    const n = Number.isFinite(nParsed) ? Math.max(1, Math.min(8, nParsed)) : 3
    const moves = []
    function solveHanoi(size, fromPeg, toPeg, auxPeg) {
      if (size === 1) {
        moves.push(`Move disk 1 from ${fromPeg} to ${toPeg}`)
        return
      }
      solveHanoi(size - 1, fromPeg, auxPeg, toPeg)
      moves.push(`Move disk ${size} from ${fromPeg} to ${toPeg}`)
      solveHanoi(size - 1, auxPeg, toPeg, fromPeg)
    }
    solveHanoi(n, 'A', 'C', 'B')

    for (const line of moves) {
      console.log(`[compute:${node.label}] ${line}`)
    }

    setNodes((previous) => previous.map((item) => {
      if (item.id !== node.id) return item
      return {
        ...item,
        runtime: {
          ...(item.runtime || {}),
          lastRunAt: new Date().toISOString(),
          lastRunSummary: `Towers of Hanoi n=${n}, moves=${moves.length}`,
          lastRunOutput: moves,
          runtimeKind: String(config.runtimeKind || 'pmachine'),
          deploymentTarget: String(config.deploymentTarget || 'esp32-native'),
        },
      }
    }))

    setStatusText(`Compute ${node.label} executed: Towers of Hanoi n=${n} (${moves.length} moves). Output printed to console.`)
    return true
  }

  const compatibilityByTarget = useMemo(() => {
    const required = (selectedNode?.requiredCapabilities || []).map(normalizeCapability).filter(Boolean)
    const requiredWiring = (selectedNode?.requiredWiring || []).map(normalizeCapability).filter(Boolean)
    const selectedConfig = selectedNode?.config || {}
    const requiredProtocols = Array.from(new Set([
      normalizeCapability(selectedConfig?.protocol || '').replace(/^protocol\./, ''),
    ].filter(Boolean)))
    const requiredSchemas = Array.from(new Set([
      normalizeCapability(selectedConfig?.inputSchema || ''),
      normalizeCapability(selectedConfig?.outputSchema || ''),
      normalizeCapability(selectedConfig?.inputShape || ''),
      normalizeCapability(selectedConfig?.outputShape || ''),
      normalizeCapability(selectedConfig?.stateSchema || ''),
    ].filter(Boolean)))
    const requiredSlaProfiles = Array.from(new Set([
      normalizeCapability(selectedConfig?.policyRef || ''),
      normalizeCapability(selectedConfig?.retryPolicy || ''),
      normalizeCapability(selectedConfig?.retentionPolicy || ''),
    ].filter(Boolean)))
    const result = new Map()
    for (const target of targets) {
      const available = (target.capabilities || []).map(normalizeCapability)
      const wiringProvides = (target.wiringProvides || []).map(normalizeCapability)
      const availableProtocols = (target.protocols || []).map(normalizeCapability)
      const availableSchemas = (target.schemas || []).map(normalizeCapability)
      const availableSlaProfiles = (target.slaProfiles || []).map(normalizeCapability)
      const missing = required.filter((capability) => !available.includes(capability))
      const missingWiring = requiredWiring.filter((item) => !wiringProvides.includes(item))
      const missingProtocols = requiredProtocols.filter((item) => !availableProtocols.includes(item))
      const missingSchemas = requiredSchemas.filter((item) => !availableSchemas.includes(item))
      const missingSlaProfiles = requiredSlaProfiles.filter((item) => !availableSlaProfiles.includes(item))
      const buildIssues = []
      if (!target.buildProfile?.envExists) {
        buildIssues.push(`platformio env missing: ${target.buildProfile?.platformioEnv || 'unknown'}`)
      }
      if (Array.isArray(target.buildProfile?.missingFlags) && target.buildProfile.missingFlags.length) {
        buildIssues.push(`missing build flags: ${target.buildProfile.missingFlags.join(', ')}`)
      }
      result.set(target.id, {
        isCompatible:
          missing.length === 0 &&
          missingWiring.length === 0 &&
          missingProtocols.length === 0 &&
          missingSchemas.length === 0 &&
          missingSlaProfiles.length === 0 &&
          buildIssues.length === 0,
        missing,
        missingWiring,
        missingProtocols,
        missingSchemas,
        missingSlaProfiles,
        buildIssues,
        available,
        wiringProvides,
        availableProtocols,
        availableSchemas,
        availableSlaProfiles,
      })
    }
    return result
  }, [targets, selectedNode])

  const targetScoring = useMemo(() => {
    const scores = new Map()
    for (const target of targets) {
      const compatibility = compatibilityByTarget.get(target.id)
      const reasons = []
      let score = 0
      if (compatibility?.isCompatible) {
        score += 1000
        reasons.push('compatible')
      } else {
        score -= 1000
        reasons.push('incompatible')
      }
      if (target.buildProfile?.envExists) {
        score += 80
        reasons.push('build env ok')
      }
      const ip = String(target?.ip || '')
      if (ip.startsWith('127.')) {
        score += 25
        reasons.push('locality loopback')
      } else if (ip.startsWith('192.168.')) {
        score += 10
        reasons.push('locality lan')
      }
      score += Math.min((target.services || []).length, 20)
      if ((target.services || []).length) {
        reasons.push(`services ${target.services.length}`)
      }

      const penalties = [
        (compatibility?.missing || []).length,
        (compatibility?.missingWiring || []).length,
        (compatibility?.missingProtocols || []).length,
        (compatibility?.missingSchemas || []).length,
        (compatibility?.missingSlaProfiles || []).length,
        (compatibility?.buildIssues || []).length,
      ].reduce((sum, value) => sum + value, 0)
      if (penalties > 0) {
        score -= penalties * 120
      }
      scores.set(target.id, {
        score,
        reasons,
        penalties,
      })
    }
    return scores
  }, [targets, compatibilityByTarget])

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
      (() => {
        const flowNodeType = inferFlowNodeTypeFromItem(item)
        const preferredName = String(item?.subflowName || item?.name || '').trim()
        const visualObjectName = flowNodeType === 'subflow' && preferredName
          ? preferredName
          : nextAvailableVisualObjectName(flowNodeType, previous)
        const rulesetShapeSource = String(item?.sourceShape || '').trim()
        const rulesetShapeTarget = String(item?.targetShape || '').trim()
        const artifactConfig = item?.type === 'ruleset'
          ? {
              inputSchema: rulesetShapeSource,
              outputSchema: rulesetShapeTarget,
              ruleset: String(item?.rulesetId || item?.id || '').trim(),
            }
          : (item?.type === 'message-definition'
            ? {
                contractId: String(item?.contractId || item?.id || '').trim(),
                inputSchema: String(item?.inputSchema || '').trim(),
                outputSchema: String(item?.outputSchema || '').trim(),
                protocol: String(item?.protocol || '').trim(),
              }
            : {})
        return {
          id: createId(item.kind || 'node'),
          label: visualObjectName,
          kind: item.kind || 'service',
          flowNodeType,
          type: item.type || 'untyped',
          iconGraphic: item.iconGraphic || createStubIconGraphic(item.name || flowNodeType),
          description: item.description || '',
          usageNotes: item.usageNotes || '',
          visualObjectId: item.id || '',
          visualObjectName,
          visualObjectActions: Array.isArray(item.actions) ? item.actions : [],
          requiredCapabilities: inferRequiredCapabilitiesFromItem(item),
          requiredWiring: inferRequiredWiringFromItem(item),
          config: {
            ...getDefaultNodeConfig(flowNodeType),
            ...artifactConfig,
            ...(flowNodeType === 'subflow' ? {
              subflowName: preferredName || visualObjectName,
              inputShape: normalizeShapeRef(item?.inputShape),
              outputShape: normalizeShapeRef(item?.outputShape),
              implementationRef: String(item?.implementationRef || '').trim(),
              typeParameters: normalizeParameterList(item?.typeParameters),
              typeBindings: normalizeBindingMap(item?.typeBindings),
            } : {}),
          },
          x,
          y,
          target: null,
        }
      })(),
    ]))
  }

  function buildFlowDocumentPayload(fileNameOverride = null, nodesOverride = nodes, edgesOverride = edges, subflowsOverride = userDefinedSubflows) {
    const fileName = ensureFlowFileName(fileNameOverride || flowFileName)
    return {
      kind: FLOW_FILE_KIND,
      version: FLOW_FILE_VERSION,
      savedAt: new Date().toISOString(),
      meta: {
        name: fileName,
        canvasModel: 'generic-node-edge',
        domain: 'flow-designer',
      },
      settings: {
        defaultEdgeType: edgeType,
      },
      libraries: {
        nodeTypes: FLOW_NODE_TYPES,
        edgeTypes: EDGE_TYPES,
      },
      subflows: collectSubflowDefinitions(nodesOverride, subflowsOverride),
      nodes: nodesOverride,
      edges: edgesOverride,
    }
  }

  function downloadFlowDocument(payload, fileNameOverride = null) {
    const fileName = ensureFlowFileName(fileNameOverride || payload?.meta?.name || flowFileName)
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
    setFlowFileName(fileName)
    setStatusText(`Saved ${fileName}.`)
  }

  function saveFlowDocumentToProject(payload, fileNameOverride = null) {
    const fileName = ensureFlowFileName(fileNameOverride || payload?.meta?.name || flowFileName)
    const nextWorkspace = {
      ...loadProjectWorkspace(projectId),
      projectId: activeProject.id,
      projectLabel: activeProject.label,
      flow: {
        fileName,
        payload,
        lastSavedAt: new Date().toISOString(),
      },
    }
    saveProjectWorkspace(projectId, nextWorkspace)
  }

  function normalizeLoadedNode(node, index) {
    const inferredType = normalizeFlowNodeType(node?.flowNodeType || node?.kind || node?.type)
    const fallbackLabel = `${inferredType}${index + 1}`
    const label = String(node?.label || node?.visualObjectName || fallbackLabel)
    const fallbackX = 26 + ((index % 4) * 228)
    const fallbackY = 24 + (Math.floor(index / 4) * 130)
    const parsedX = Number.parseInt(String(node?.x ?? ''), 10)
    const parsedY = Number.parseInt(String(node?.y ?? ''), 10)

    return {
      ...node,
      id: String(node?.id || createId('node')),
      label,
      kind: String(node?.kind || inferredType),
      flowNodeType: inferredType,
      type: String(node?.type || inferredType),
      iconGraphic: node?.iconGraphic || createStubIconGraphic(label),
      visualObjectName: String(node?.visualObjectName || label),
      visualObjectActions: Array.isArray(node?.visualObjectActions) ? node.visualObjectActions : [],
      requiredCapabilities: Array.isArray(node?.requiredCapabilities) ? node.requiredCapabilities.map(normalizeCapability).filter(Boolean) : [],
      requiredWiring: Array.isArray(node?.requiredWiring) ? node.requiredWiring.map(normalizeCapability).filter(Boolean) : [],
      config: {
        ...getDefaultNodeConfig(inferredType),
        ...(node?.config || {}),
        ...(inferredType === 'subflow' ? {
          typeParameters: normalizeParameterList(node?.config?.typeParameters),
          typeBindings: normalizeBindingMap(node?.config?.typeBindings),
        } : {}),
      },
      x: Number.isFinite(parsedX) ? Math.max(0, parsedX) : fallbackX,
      y: Number.isFinite(parsedY) ? Math.max(0, parsedY) : fallbackY,
      target: node?.target || null,
    }
  }

  function normalizeLoadedEdge(edge, nodeIdSet) {
    const from = String(edge?.from || edge?.source || '')
    const to = String(edge?.to || edge?.target || '')
    if (!from || !to) return null
    if (!nodeIdSet.has(from) || !nodeIdSet.has(to)) return null
    const type = String(edge?.type || 'message-broker-call')
    return {
      ...edge,
      id: String(edge?.id || createId('edge')),
      from,
      to,
      type,
      label: String(edge?.label || getEdgeTypeLabel(type)),
    }
  }

  function applyFlowDocument(payload, fileNameHint = DEFAULT_FLOW_FILE_NAME) {
    const rawNodes = Array.isArray(payload?.nodes) ? payload.nodes : []
    const rawEdges = Array.isArray(payload?.edges) ? payload.edges : []
    const normalizedNodes = rawNodes.map((node, index) => normalizeLoadedNode(node, index))
    const nodeIdSet = new Set(normalizedNodes.map((node) => node.id))
    const normalizedEdges = rawEdges
      .map((edge) => normalizeLoadedEdge(edge, nodeIdSet))
      .filter(Boolean)
    const normalizedSubflows = collectSubflowDefinitions(normalizedNodes, Array.isArray(payload?.subflows) ? payload.subflows : [])

    const nextEdgeType = String(payload?.settings?.defaultEdgeType || '')
    const resolvedEdgeType = EDGE_TYPE_ID_SET.has(nextEdgeType) ? nextEdgeType : 'message-broker-call'
    const resolvedName = ensureFlowFileName(payload?.meta?.name || fileNameHint || DEFAULT_FLOW_FILE_NAME)

    setNodes(normalizedNodes)
    setEdges(normalizedEdges)
    setUserDefinedSubflows(normalizedSubflows)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setEdgeSourceNodeId(null)
    setFlowFileName(resolvedName)
    setEdgeType(resolvedEdgeType)
    setStatusText(`Opened ${resolvedName}: ${normalizedNodes.length} nodes, ${normalizedEdges.length} edges.`)
  }

  function importFlowDocument(payload, fileNameHint = DEFAULT_FLOW_FILE_NAME) {
    const rawNodes = Array.isArray(payload?.nodes) ? payload.nodes : []
    const rawEdges = Array.isArray(payload?.edges) ? payload.edges : []
    const existingNodeIdSet = new Set(nodes.map((node) => node.id))
    const idMap = new Map()
    const importedSubflows = Array.isArray(payload?.subflows) ? payload.subflows : []

    const importedNodes = rawNodes.map((node, index) => {
      const normalized = normalizeLoadedNode(node, index)
      const sourceId = String(node?.id || normalized.id)
      let targetId = normalized.id
      while (existingNodeIdSet.has(targetId) || idMap.has(targetId)) {
        targetId = createId('node')
      }
      idMap.set(sourceId, targetId)
      return {
        ...normalized,
        id: targetId,
      }
    })

    const importedNodeIdSet = new Set(importedNodes.map((node) => node.id))
    const importedEdges = rawEdges
      .map((edge) => {
        const mappedFrom = idMap.get(String(edge?.from || ''))
        const mappedTo = idMap.get(String(edge?.to || ''))
        if (!mappedFrom || !mappedTo) return null
        return normalizeLoadedEdge(
          {
            ...edge,
            from: mappedFrom,
            to: mappedTo,
            id: createId('edge'),
          },
          importedNodeIdSet,
        )
      })
      .filter(Boolean)

    setNodes((previous) => [...previous, ...importedNodes])
    setEdges((previous) => [...previous, ...importedEdges])
    setUserDefinedSubflows((previous) => collectSubflowDefinitions([...nodes, ...importedNodes], [...previous, ...importedSubflows]))
    setStatusText(`Imported ${ensureFlowFileName(fileNameHint)}: +${importedNodes.length} nodes, +${importedEdges.length} edges.`)
  }

  function triggerFlowFilePicker(mode) {
    setFilePickerMode(mode)
    if (flowFileInputRef.current) {
      flowFileInputRef.current.value = ''
      flowFileInputRef.current.click()
    }
  }

  function saveFlowToFile(fileNameOverride = null) {
    const subflowValidation = validateAllSubflowBindings(nodes)
    if (!subflowValidation.valid) {
      setStatusText(`Save failed: ${subflowValidation.reason}`)
      return
    }
    const fileName = ensureFlowFileName(fileNameOverride || flowFileName)
    const payload = buildFlowDocumentPayload(fileName)
    setUserDefinedSubflows(Array.isArray(payload?.subflows) ? payload.subflows : [])
    saveFlowDocumentToProject(payload, fileName)
    downloadFlowDocument(payload, fileName)
  }

  function buildUserDefinedSubflowPaletteItem(subflow) {
    return subflowDefinitionToPaletteItem(subflow)
  }

  function handleNewFlow() {
    if ((nodes.length > 0 || edges.length > 0) && !window.confirm('Create a new flow? Unsaved canvas changes will be lost.')) {
      return
    }
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setEdgeSourceNodeId(null)
    setFlowFileName(DEFAULT_FLOW_FILE_NAME)
    setStatusText('Created new flow document.')
  }

  function handleSaveAsFlow() {
    const nextName = window.prompt('Save flow as', flowFileName)
    if (nextName === null) return
    saveFlowToFile(nextName)
  }

  async function handleFlowFileInputChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const isDocumentLike = payload && typeof payload === 'object' && Array.isArray(payload.nodes) && Array.isArray(payload.edges)
      if (!isDocumentLike) {
        setStatusText(`Open failed: ${file.name} is not a valid .flw document.`)
        return
      }
      if (filePickerMode === 'import') {
        importFlowDocument(payload, file.name)
        return
      }
      applyFlowDocument(payload, file.name)
    } catch (error) {
      setStatusText(`Open failed: ${String(error?.message || error)}`)
    }
  }

  function addNodeFromType(flowNodeType) {
    const paletteLikeItem = buildPaletteLikeItem(flowNodeType)
    addNodeFromItem(paletteLikeItem)
  }

  function buildPaletteLikeItem(flowNodeType) {
    const normalizedType = normalizeFlowNodeType(flowNodeType)
    const label = FLOW_NODE_TYPES.find((entry) => entry.id === normalizedType)?.label || 'Service'
    return {
      id: `${normalizedType}-node`,
      name: label,
      kind: normalizedType,
      type: normalizedType,
      iconGraphic: createStubIconGraphic(label),
      description: `${normalizedType} node`,
      usageNotes: '',
      capabilities: [],
    }
  }

  function deleteNode(nodeId) {
    setNodes((previous) => previous.filter((node) => node.id !== nodeId))
    setEdges((previous) => previous.filter((edge) => edge.from !== nodeId && edge.to !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    if (edgeSourceNodeId === nodeId) setEdgeSourceNodeId(null)
    setSelectedEdgeId((previous) => {
      if (!previous) return previous
      const stillExists = edges.some((edge) => edge.id === previous && edge.from !== nodeId && edge.to !== nodeId)
      return stillExists ? previous : null
    })
  }

  function beginEdgeFromNode(nodeId) {
    const sourceNode = nodes.find((node) => node.id === nodeId)
    if (!sourceNode) return
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
    setEdgeSourceNodeId(nodeId)
    setStatusText(`Connecting from ${sourceNode.label}. Click another node to create a ${getEdgeTypeLabel(edgeType)} edge.`)
  }

  function cancelEdgeConnection() {
    if (!edgeSourceNodeId) return
    setEdgeSourceNodeId(null)
    setStatusText('Edge connection canceled.')
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return
    const edgeToDelete = edges.find((edge) => edge.id === selectedEdgeId)
    setEdges((previous) => previous.filter((edge) => edge.id !== selectedEdgeId))
    if (edgeToDelete) {
      setStatusText(`Deleted ${edgeToDelete.label}.`)
    }
  }

  function openNodeContextMenu(node, event) {
    event.preventDefault()
    event.stopPropagation()
    setSelectedNodeId(node.id)
    setSelectedInspectorTab('properties')
    setNodeContextMenu({
      nodeId: node.id,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function closeNodeContextMenu() {
    setNodeContextMenu(null)
  }

  function openTargetContextMenu(target, event) {
    event.preventDefault()
    event.stopPropagation()
    setTargetContextMenu({
      targetId: target.id,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function closeTargetContextMenu() {
    setTargetContextMenu(null)
  }

  function focusNodeProperties(nodeId) {
    setSelectedNodeId(nodeId)
    setSelectedInspectorTab('properties')
    setStatusText('Use the on-canvas inspector next to the selected visual object.')
    closeNodeContextMenu()
  }

  function focusNodeActions(nodeId) {
    setSelectedNodeId(nodeId)
    setSelectedInspectorTab('actions')
    setStatusText('Use the on-canvas inspector next to the selected visual object.')
    closeNodeContextMenu()
  }

  function updateSelectedNodeActions(textValue) {
    if (!selectedNodeId) return
    setSelectedNodeDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        actionsText: String(textValue || ''),
      }
    })
  }

  function updateSelectedNodeName(textValue) {
    if (!selectedNodeId) return
    setSelectedNodeDraft((previous) => {
      if (!previous) return previous
      const nextValue = String(textValue || '')
      return {
        ...previous,
        labelText: nextValue,
        ...(selectedNode && normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) === 'subflow'
          ? {
              config: {
                ...previous.config,
                subflowName: nextValue,
              },
            }
          : {}),
      }
    })
  }

  function updateSelectedNodeConfigField(fieldKey, fieldValue) {
    if (!selectedNodeId) return
    setSelectedNodeDraft((previous) => {
      if (!previous) return previous
      const nextValue = String(fieldValue || '')
      const nodeType = normalizeFlowNodeType(selectedNode?.flowNodeType || selectedNode?.kind || selectedNode?.type)
      const nextConfig = {
        ...previous.config,
        [fieldKey]: fieldKey === 'typeParameters'
          ? normalizeParameterList(nextValue)
          : (fieldKey === 'typeBindings' ? normalizeBindingMap(nextValue) : nextValue),
      }

      if (nodeType === 'mapper' && (fieldKey === 'inputSchema' || fieldKey === 'outputSchema')) {
        const nextRulesetOptions = getMapperRulesetOptions(nextConfig.inputSchema, nextConfig.outputSchema, mapperRulesets)
        const currentRuleset = String(nextConfig.ruleset || '').trim()
        const currentIsAllowed = nextRulesetOptions.some((option) => option.id === currentRuleset)
        if (!currentIsAllowed) {
          const recommended = nextRulesetOptions.find((option) => option.recommended) || nextRulesetOptions[0]
          nextConfig.ruleset = recommended ? recommended.id : ''
        }
      }

      return {
        ...previous,
        config: nextConfig,
        ...(fieldKey === 'subflowName' ? { labelText: nextValue } : {}),
      }
    })
  }

  function updateSelectedNodePosition(axis, textValue) {
    if (!selectedNodeId) return
    setSelectedNodeDraft((previous) => {
      if (!previous) return previous
      const nextValue = String(textValue || '')
      if (axis === 'x') return { ...previous, xText: nextValue }
      if (axis === 'y') return { ...previous, yText: nextValue }
      return previous
    })
  }

  function saveSelectedNodeDraft() {
    if (!selectedNodeId || !selectedNode || !selectedNodeDraft) return
    const nextLabel = String(selectedNodeDraft.labelText || '').trim()
    if (!nextLabel) {
      setStatusText('Save failed: visual object name is required.')
      return
    }
    const nextX = Number.parseInt(String(selectedNodeDraft.xText || '').trim(), 10)
    const nextY = Number.parseInt(String(selectedNodeDraft.yText || '').trim(), 10)
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      setStatusText('Save failed: X and Y must be valid numbers.')
      return
    }
    const nextRequiredCapabilities = Array.from(new Set(String(requiredCapabilitiesDraft || '')
      .split(',')
      .map((value) => normalizeCapability(value))
      .filter(Boolean)))
    const nextRequiredWiring = Array.from(new Set(String(requiredWiringDraft || '')
      .split(',')
      .map((value) => normalizeCapability(value))
      .filter(Boolean)))
    const nextConfig = {
      ...getDefaultNodeConfig(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type),
      ...(selectedNodeDraft.config || {}),
    }
    const isSubflowNode = normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) === 'subflow'
    const nextSubflowName = isSubflowNode ? String(nextConfig.subflowName || nextLabel).trim() : ''
    if (isSubflowNode && nextSubflowName) {
      nextConfig.subflowName = nextSubflowName
    }
    const nextActions = String(selectedNodeDraft.actionsText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [labelPart, descriptionPart] = line.split(':')
        const label = String(labelPart || '').trim()
        const description = String(descriptionPart || '').trim()
        const normalizedId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `action-${index + 1}`
        return {
          id: normalizedId,
          label: label || `Action ${index + 1}`,
          description,
          kind: 'command',
          http: null,
        }
      })

    const nextNodes = nodes.map((node) => {
      if (node.id !== selectedNodeId) return node
      return {
        ...node,
        label: isSubflowNode && nextSubflowName ? nextSubflowName : nextLabel,
        visualObjectName: isSubflowNode && nextSubflowName ? nextSubflowName : nextLabel,
        x: Math.max(0, nextX),
        y: Math.max(0, nextY),
        requiredCapabilities: nextRequiredCapabilities,
        requiredWiring: nextRequiredWiring,
        config: nextConfig,
        visualObjectActions: nextActions,
      }
    })

    if (isSubflowNode) {
      const nextSubflowNode = nextNodes.find((node) => node.id === selectedNodeId)
      const subflowValidation = validateSubflowGenericBindings(nextSubflowNode)
      if (!subflowValidation.valid) {
        setStatusText(`Save failed: ${subflowValidation.reason}`)
        return
      }
    }

    setNodes(nextNodes)
    const nextSubflows = collectSubflowDefinitions(nextNodes, userDefinedSubflows)
    setUserDefinedSubflows(nextSubflows)
    setSelectedNodeDraft({
      labelText: isSubflowNode && nextSubflowName ? nextSubflowName : nextLabel,
      xText: String(Math.max(0, nextX)),
      yText: String(Math.max(0, nextY)),
      config: nextConfig,
      actionsText: String(selectedNodeDraft.actionsText || ''),
    })
    const payload = buildFlowDocumentPayload(flowFileName, nextNodes, edges)
    payload.subflows = nextSubflows
    saveFlowDocumentToProject(payload, flowFileName)
    downloadFlowDocument(payload, flowFileName)
    setSelectedNodeId(null)
  }

  function cancelSelectedNodeDraft() {
    if (!selectedNode) return
    resetSelectedNodeDraft()
    setStatusText('Inspector changes canceled.')
    setSelectedNodeId(null)
  }

  function handlePaletteItemClick(item) {
    if (suppressPaletteClickRef.current) {
      suppressPaletteClickRef.current = false
      return
    }
    addNodeFromItem(item)
  }

  function handleStubItemClick(flowNodeType) {
    if (suppressPaletteClickRef.current) {
      suppressPaletteClickRef.current = false
      return
    }
    addNodeFromType(flowNodeType)
  }

  function startPaneResize(side, event) {
    event.preventDefault()
    setResizingPane(side)
  }

  function handleNodePointerDown(node, event) {
    if (event.button !== 0) return
    event.stopPropagation()
    closeNodeContextMenu()
    setSelectedNodeId(node.id)
    const stageRect = canvasStageRef.current?.getBoundingClientRect()
    if (!stageRect) return
    const pointerX = event.clientX - stageRect.left
    const pointerY = event.clientY - stageRect.top
    setDraggingNode({
      nodeId: node.id,
      offsetX: pointerX - node.x,
      offsetY: pointerY - node.y,
      moved: false,
    })
  }

  function startVisualObjectDrag(event, item) {
    const payload = JSON.stringify({ item })
    event.dataTransfer.setData('application/vnd.pulse.catalog+json', payload)
    event.dataTransfer.setData('application/json', payload)
    event.dataTransfer.setData('text/plain', payload)
    event.dataTransfer.setData('text', payload)
    event.dataTransfer.effectAllowed = 'copy'
    setStatusText(`Dragging ${item.name || item.id || 'visual object'}.`)
  }

  function createEdge(targetId) {
    if (!edgeSourceNodeId || edgeSourceNodeId === targetId) return
    const sourceNode = nodes.find((node) => node.id === edgeSourceNodeId)
    const targetNode = nodes.find((node) => node.id === targetId)
    if (!sourceNode || !targetNode) return

    const validation = validateEdgeConnection(edgeType, sourceNode, targetNode)
    if (!validation.valid) {
      setStatusText(validation.reason)
      return
    }

    setEdges((previous) => {
      const exists = previous.some((edge) => edge.from === edgeSourceNodeId && edge.to === targetId && edge.type === edgeType)
      if (exists) return previous
      const newEdge = { id: createId('edge'), from: edgeSourceNodeId, to: targetId, type: edgeType, label: getEdgeTypeLabel(edgeType) }
      setSelectedEdgeId(newEdge.id)
      return [...previous, newEdge]
    })
    setStatusText(`Created ${getEdgeTypeLabel(edgeType)} link.`)
    setEdgeSourceNodeId(null)
  }

  function bindSelectedToTarget(target) {
    if (!selectedNodeId) {
      setStatusText('Select a node first, then bind a deployment target.')
      return
    }
    setManualBindOverrides((previous) => ({ ...previous, [selectedNodeId]: target.id }))
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
    setStatusText(`Manually bound ${selectedNode?.label || 'node'} to ${target.name}.`)
  }

  function serializeComputeNodeForDeploy(node) {
    if (!node) return null
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      flowNodeType: node.flowNodeType,
      type: node.type,
      visualObjectName: node.visualObjectName,
      requiredCapabilities: Array.isArray(node.requiredCapabilities) ? node.requiredCapabilities : [],
      requiredWiring: Array.isArray(node.requiredWiring) ? node.requiredWiring : [],
      config: node.config && typeof node.config === 'object' ? node.config : {},
      description: node.description || '',
      usageNotes: node.usageNotes || '',
    }
  }

  async function runSelectedComputeOnTarget(target) {
    if (!selectedNode || normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) !== 'compute') {
      setStatusText('Select a compute node first, then right-click a deployable node and choose Run selected compute here.')
      return
    }
    try {
      const targetHost = String(target?.ip || '').trim() || '127.0.0.1'
      const response = await fetch(`http://${targetHost}:4000/api/nodes/${encodeURIComponent(target.id)}/run-compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: target.id,
          computeNode: serializeComputeNodeForDeploy(selectedNode),
          inputQueue: 'default.in',
          message: selectedNode?.config?.programSource || selectedNode?.config?.operationRef || selectedNode?.label || '',
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }
      const summary = payload?.computeNode?.summaryLine || 'compute run completed'
      setStatusText(`Ran ${selectedNode.label} on ${target.name}: ${summary}`)
    } catch (error) {
      setStatusText(`Run failed: ${String(error?.message || error)}`)
    } finally {
      closeTargetContextMenu()
    }
  }

  function clearSelectedManualOverride() {
    if (!selectedNodeId) return
    setManualBindOverrides((previous) => {
      const next = { ...previous }
      delete next[selectedNodeId]
      return next
    })
  }

  function handleCanvasDrop(event) {
    event.preventDefault()
    const item = readDraggedVisualObject(event.dataTransfer)
    if (!item) {
      setStatusText('Drop failed because the dragged item did not provide a visual-object payload.')
      return
    }
    try {
      const rect = event.currentTarget.getBoundingClientRect()
      addNodeFromItem(item, {
        x: Math.max(16, Math.round(event.clientX - rect.left - 16)),
        y: Math.max(16, Math.round(event.clientY - rect.top - 16)),
      })
    } catch {
      setStatusText('Drop failed due to malformed drag payload.')
    }
  }

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return
      if (nodeContextMenu) {
        closeNodeContextMenu()
        return
      }
      if (edgeSourceNodeId) {
        cancelEdgeConnection()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [edgeSourceNodeId, nodeContextMenu])

  function runPlayback(stepByStep = false) {
    const subflowValidation = validateAllSubflowBindings(nodes)
    if (!subflowValidation.valid) {
      setStatusText(`Run blocked: ${subflowValidation.reason}`)
      return
    }
    if (!edges.length) {
      if (selectedNode && executeComputeNode(selectedNode)) {
        return
      }
      setStatusText('Add at least one edge to play the flow, or select a compute node configured for execution.')
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

  useEffect(() => {
    if (!draggingNode?.nodeId) return undefined

    function handlePointerMove(event) {
      const stageRect = canvasStageRef.current?.getBoundingClientRect()
      if (!stageRect) return
      const pointerX = event.clientX - stageRect.left
      const pointerY = event.clientY - stageRect.top
      const nextX = Math.max(0, Math.round(pointerX - draggingNode.offsetX))
      const nextY = Math.max(0, Math.round(pointerY - draggingNode.offsetY))
      setNodes((previous) => previous.map((node) => (node.id === draggingNode.nodeId ? { ...node, x: nextX, y: nextY } : node)))
      setDraggingNode((previous) => (previous ? { ...previous, moved: true } : previous))
    }

    function handlePointerUp() {
      if (draggingNode.moved) {
        suppressNodeClickRef.current = true
      }
      setDraggingNode(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [draggingNode])

  useEffect(() => {
    if (!resizingPane) return undefined

    function handlePointerMove(event) {
      const shellRect = shellRef.current?.getBoundingClientRect()
      if (!shellRect) return
      const minPane = 160
      const maxPane = 420
      if (resizingPane === 'left') {
        const next = Math.round(event.clientX - shellRect.left)
        setLeftPaneWidth(Math.max(minPane, Math.min(maxPane, next)))
      } else if (resizingPane === 'right') {
        const next = Math.round(shellRect.right - event.clientX)
        setRightPaneWidth(Math.max(minPane, Math.min(maxPane, next)))
      }
    }

    function handlePointerUp() {
      setResizingPane(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [resizingPane])

  useEffect(() => {
    if (!autoBindEnabled || !selectedNodeId) return
    if (manualBindOverrides[selectedNodeId]) return
    if (!targets.length) return

    const ranked = [...targets]
      .map((target) => ({
        target,
        compatibility: compatibilityByTarget.get(target.id),
        scoring: targetScoring.get(target.id) || { score: -9999, reasons: [], penalties: 0 },
      }))
      .filter((entry) => entry.compatibility?.isCompatible)
      .sort((a, b) => {
        if (b.scoring.score !== a.scoring.score) return b.scoring.score - a.scoring.score
        return String(a.target.id).localeCompare(String(b.target.id))
      })

    const best = ranked[0]
    if (!best) {
      setStatusText('Auto-bind could not find a compatible target for the selected node.')
      return
    }

    const currentTargetId = selectedNode?.target?.id
    if (currentTargetId === best.target.id) return

    setNodes((previous) => previous.map((node) => {
      if (node.id !== selectedNodeId) return node
      return {
        ...node,
        target: {
          id: best.target.id,
          name: best.target.name,
          ip: best.target.ip,
          services: best.target.services,
        },
      }
    }))
    setStatusText(`Auto-bound ${selectedNode?.label || 'node'} to ${best.target.name} (score ${best.scoring.score}).`)
  }, [autoBindEnabled, selectedNodeId, selectedNode?.target?.id, selectedNode?.label, targets, compatibilityByTarget, targetScoring, manualBindOverrides])

  useEffect(() => {
    if (selectedNodeId) {
      closeTargetContextMenu()
    }
  }, [selectedNodeId])

  return (
    <div className="flow-designer-page">
      {nodeContextMenu ? (
        <div
          className="flow-node-context-backdrop"
          onClick={closeNodeContextMenu}
          onContextMenu={(event) => {
            event.preventDefault()
            closeNodeContextMenu()
          }}
        >
          <div
            className="flow-node-context-menu"
            style={{ left: `${nodeContextMenu.x}px`, top: `${nodeContextMenu.y}px` }}
            role="menu"
            aria-label="Node actions"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button type="button" onClick={() => focusNodeProperties(nodeContextMenu.nodeId)}>Properties</button>
            <button type="button" onClick={() => focusNodeActions(nodeContextMenu.nodeId)}>Actions</button>
            <button type="button" onClick={() => {
              beginEdgeFromNode(nodeContextMenu.nodeId)
              closeNodeContextMenu()
            }}>
              Start Connection From Here
            </button>
            {edgeSourceNodeId === nodeContextMenu.nodeId ? (
              <button type="button" onClick={() => {
                cancelEdgeConnection()
                closeNodeContextMenu()
              }}>
                Cancel Connection
              </button>
            ) : null}
            <button type="button" onClick={() => deleteNode(nodeContextMenu.nodeId)}>Delete</button>
          </div>
        </div>
      ) : null}
      {targetContextMenu ? (
        <div
          className="flow-target-context-backdrop"
          onClick={closeTargetContextMenu}
          onContextMenu={(event) => {
            event.preventDefault()
            closeTargetContextMenu()
          }}
        >
          <div
            className="flow-target-context-menu"
            style={{ left: `${targetContextMenu.x}px`, top: `${targetContextMenu.y}px` }}
            role="menu"
            aria-label="Deployable node actions"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button
              type="button"
              disabled={!selectedNode || normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) !== 'compute'}
              onClick={() => {
                const target = targets.find((item) => item.id === targetContextMenu.targetId)
                if (!target) return
                void runSelectedComputeOnTarget(target)
              }}
            >
              Run selected compute here
            </button>
            <button
              type="button"
              onClick={() => {
                const target = targets.find((item) => item.id === targetContextMenu.targetId)
                if (!target) return
                bindSelectedToTarget(target)
                closeTargetContextMenu()
              }}
            >
              Bind selected node
            </button>
            <div className="flow-target-context-hint">
              {selectedNode && normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) === 'compute'
                ? `Selected compute: ${selectedNode.label}`
                : 'Select a compute node first.'}
            </div>
          </div>
        </div>
      ) : null}
      <header className="flow-designer-header">
        <input
          ref={flowFileInputRef}
          type="file"
          accept=".flw,application/json"
          style={{ display: 'none' }}
          onChange={handleFlowFileInputChange}
        />
        <div>
          <div className="flow-designer-title">Flow Designer</div>
          <div className="flow-designer-subtitle">Drag reusable visual objects to the center canvas and connect typed edges.</div>
          <div className="flow-designer-subtitle">Project: {projectLabel || activeProject.label}</div>
        </div>
        <div className="flow-designer-actions">
          <button type="button" onClick={handleNewFlow}>New</button>
          <button type="button" onClick={() => triggerFlowFilePicker('open')}>Open</button>
          <button type="button" onClick={() => triggerFlowFilePicker('import')}>Import</button>
          <button type="button" onClick={() => saveFlowToFile()}>Save</button>
          <button type="button" onClick={handleSaveAsFlow}>Save As</button>
          <button type="button" onClick={() => addNodeFromType('subflow')}>Add Black Box</button>
          <label>
            Edge
            <select value={edgeType} onChange={(event) => setEdgeType(event.target.value)}>
              {EDGE_TYPES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (!selectedNodeId) {
                setStatusText('Select a source node first, then click Connect.')
                return
              }
              beginEdgeFromNode(selectedNodeId)
            }}
          >
            Connect
          </button>
          <button
            type="button"
            onClick={cancelEdgeConnection}
            disabled={!edgeSourceNodeId}
          >
            Cancel Connect
          </button>
          <button
            type="button"
            onClick={deleteSelectedEdge}
            disabled={!selectedEdgeId}
          >
            Delete Edge
          </button>
          <label>
            <input
              type="checkbox"
              checked={autoBindEnabled}
              onChange={(event) => setAutoBindEnabled(event.target.checked)}
            />
            Auto-bind
          </label>
          <button type="button" onClick={() => runPlayback(false)}>Run</button>
          <button type="button" onClick={() => runPlayback(true)}>Step</button>
          <button type="button" onClick={() => setCanvasFocus((previous) => !previous)}>
            {canvasFocus ? 'Show Sidebars' : 'Canvas Focus'}
          </button>
        </div>
      </header>

      <div
        className="flow-designer-shell"
        ref={shellRef}
        style={{
          gridTemplateColumns: canvasFocus
            ? '0px 0px minmax(0, 1fr) 0px 0px'
            : `${leftPaneWidth}px 6px minmax(0, 1fr) 6px ${rightPaneWidth}px`,
        }}
      >
        <aside className="flow-pane flow-pane-palette" style={canvasFocus ? { display: 'none' } : undefined}>
          <div className="flow-pane-header">Visual Object Palette</div>
          <div className="flow-node-stub-strip" aria-label="Visual object stubs">
            {FLOW_NODE_TYPES.map((nodeType) => {
              const stubItem = buildPaletteLikeItem(nodeType.id)
              return (
              <div
                key={stubItem.id}
                role="button"
                tabIndex={0}
                draggable
                onClick={() => handleStubItemClick(nodeType.id)}
                onDragStart={(event) => {
                  suppressPaletteClickRef.current = true
                  startVisualObjectDrag(event, stubItem)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    addNodeFromType(nodeType.id)
                  }
                }}
                className="flow-node-stub"
              >
                <CatalogItemIcon
                  iconGraphic={stubItem.iconGraphic}
                  alt={`${stubItem.name} icon`}
                  className="flow-node-stub-icon-graphic"
                  fallbackClassName="flow-node-stub-icon"
                />
                <span className="flow-node-stub-label">{stubItem.name}</span>
              </div>
            )})}
          </div>
          <div className="flow-palette-search-wrap">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, id, type, description, usage notes, or actions"
            />
          </div>
          <div className="flow-list flow-list-palette">
            {!filteredCatalog.length ? <div className="flow-empty-side">No visual objects in this tab for the current search.</div> : null}
            {filteredCatalog.map((item) => (
              (() => {
                const badge = getPaletteItemBadge(item)
                return (
              <div
                key={item.id}
                className="flow-catalog-card"
                draggable
                onClick={() => handlePaletteItemClick(item)}
                onDragStart={(event) => {
                  suppressPaletteClickRef.current = true
                  startVisualObjectDrag(event, item)
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
                    {badge ? <span className={`flow-catalog-badge ${badge.className}`}>{badge.label}</span> : null}
                  </div>
                </div>
              </div>
                )
              })()
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

        <div
          className={`flow-pane-resizer ${resizingPane === 'left' ? 'active' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left sidebar"
          onPointerDown={(event) => startPaneResize('left', event)}
          style={canvasFocus ? { display: 'none' } : undefined}
        />

        <main
          className="flow-pane flow-pane-canvas"
        >
          <div className="flow-pane-header">Workflow Canvas</div>
          <div
            className="flow-canvas-stage"
            ref={canvasStageRef}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={handleCanvasDrop}
          >
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
                const isSelected = selectedEdgeId === edge.id
                return (
                  <g key={edge.id}>
                    <path
                      className={`flow-edge ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                      d={d}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedEdgeId(edge.id)
                      }}
                    />
                    <text
                      className={`flow-edge-label ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                      x={(start.x + end.x) / 2}
                      y={(start.y + end.y) / 2 - 8}
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}
            </svg>
            {!nodes.length ? <div className="flow-empty">Drop visual objects here to create your workflow.</div> : null}
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`flow-node ${selectedNodeId === node.id ? 'selected' : ''} ${edgeSourceNodeId === node.id ? 'link-source' : ''}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                onClick={() => {
                  if (suppressNodeClickRef.current) {
                    suppressNodeClickRef.current = false
                    return
                  }
                  setSelectedEdgeId(null)
                  if (edgeSourceNodeId === node.id) {
                    cancelEdgeConnection()
                    return
                  }
                  if (edgeSourceNodeId && edgeSourceNodeId !== node.id) {
                    createEdge(node.id)
                    return
                  }
                  setSelectedNodeId(node.id)
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  beginEdgeFromNode(node.id)
                }}
                onContextMenu={(event) => openNodeContextMenu(node, event)}
                onPointerDown={(event) => handleNodePointerDown(node, event)}
              >
                <div className="flow-node-head">
                  <CatalogItemIcon iconGraphic={node.iconGraphic} alt={`${node.label} icon`} />
                  <div className="flow-node-caption">{node.visualObjectName || node.label}</div>
                </div>
              </div>
            ))}
            {selectedNode && !edgeSourceNodeId ? (
              <div
                className="flow-canvas-inspector"
                style={{ left: `${Math.max(8, selectedNode.x + 46)}px`, top: `${Math.max(8, selectedNode.y - 6)}px` }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flow-canvas-inspector-title">{selectedNode.visualObjectName || selectedNode.label}</div>
                <div className="flow-selection-tabs" role="tablist" aria-label="Canvas inspector tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedInspectorTab === 'properties'}
                    className={`flow-selection-tab ${selectedInspectorTab === 'properties' ? 'active' : ''}`}
                    onClick={() => setSelectedInspectorTab('properties')}
                  >
                    Properties
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedInspectorTab === 'actions'}
                    className={`flow-selection-tab ${selectedInspectorTab === 'actions' ? 'active' : ''}`}
                    onClick={() => setSelectedInspectorTab('actions')}
                  >
                    Actions
                  </button>
                </div>
                {selectedInspectorTab === 'properties' ? (
                  <div className="flow-canvas-inspector-section">
                    <label className="flow-node-config-field">
                      Name
                      <input
                        type="text"
                        value={selectedNodeDraft?.labelText ?? ''}
                        onChange={(event) => updateSelectedNodeName(event.target.value)}
                        placeholder="Visual object name"
                      />
                    </label>
                    <div className="flow-position-grid">
                      <label className="flow-node-config-field">
                        X
                        <input
                          type="number"
                          value={selectedNodeDraft?.xText ?? ''}
                          onChange={(event) => updateSelectedNodePosition('x', event.target.value)}
                          min="0"
                          step="1"
                        />
                      </label>
                      <label className="flow-node-config-field">
                        Y
                        <input
                          type="number"
                          value={selectedNodeDraft?.yText ?? ''}
                          onChange={(event) => updateSelectedNodePosition('y', event.target.value)}
                          min="0"
                          step="1"
                        />
                      </label>
                    </div>
                    {normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type) === 'compute' ? (
                      <>
                        <button type="button" onClick={applyComputeHanoiTemplate}>Load Hanoi n=3 Template</button>
                        <button type="button" onClick={() => executeComputeNode(selectedNode)}>Run Compute Node</button>
                      </>
                    ) : null}
                    {getConfigFieldsForNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type).map((field) => {
                      const nodeType = normalizeFlowNodeType(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type)
                      const mergedConfig = {
                        ...getDefaultNodeConfig(selectedNode.flowNodeType || selectedNode.kind || selectedNode.type),
                        ...(selectedNodeDraft?.config || {}),
                      }
                      const value = field.key === 'typeParameters'
                        ? normalizeParameterList(mergedConfig[field.key]).join(',')
                        : (field.key === 'typeBindings'
                          ? Object.entries(normalizeBindingMap(mergedConfig[field.key])).map(([param, binding]) => `${param}=${binding}`).join(',')
                          : String(mergedConfig[field.key] || ''))
                      const isLargeField = field.key === 'programSource' || field.key === 'conditionExpr'
                      const isShapeField = ['inputShape', 'outputShape', 'inputSchema', 'outputSchema', 'stateSchema'].includes(field.key)
                      const isMapperMapField = nodeType === 'mapper' && (field.key === 'inputSchema' || field.key === 'outputSchema')
                      const isMapperRulesetField = nodeType === 'mapper' && field.key === 'ruleset'
                      const options = isMapperMapField ? mapperMapOptions : shapeOptions
                      const mapperRulesetOptions = isMapperRulesetField
                        ? getMapperRulesetOptions(mergedConfig.inputSchema, mergedConfig.outputSchema, mapperRulesets)
                        : []
                      const emptyOptionLabel = isMapperMapField ? 'Select a librarian map' : 'Select a librarian type'
                      return (
                        <label key={`${selectedNode.id}-${field.key}`} className="flow-node-config-field">
                          {field.label}
                          {isShapeField ? (
                            <select
                              value={value}
                              onChange={(event) => updateSelectedNodeConfigField(field.key, event.target.value)}
                            >
                              <option value="">{emptyOptionLabel}</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : isMapperRulesetField ? (
                            <select
                              value={value}
                              onChange={(event) => updateSelectedNodeConfigField(field.key, event.target.value)}
                            >
                              <option value="">Select a ruleset option</option>
                              {mapperRulesetOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.recommended ? `${option.label} (recommended)` : option.label}
                                </option>
                              ))}
                            </select>
                          ) : isLargeField ? (
                            <textarea
                              value={value}
                              placeholder={field.placeholder}
                              onChange={(event) => updateSelectedNodeConfigField(field.key, event.target.value)}
                            />
                          ) : (
                            <input
                              type="text"
                              value={value}
                              placeholder={field.placeholder}
                              onChange={(event) => updateSelectedNodeConfigField(field.key, event.target.value)}
                            />
                          )}
                        </label>
                      )
                    })}
                  </div>
                ) : null}
                {selectedInspectorTab === 'actions' ? (
                  <div className="flow-canvas-inspector-section">
                    <textarea
                      value={selectedNodeDraft?.actionsText ?? ''}
                      placeholder="Open ticket: Open service desk ticket"
                      onChange={(event) => updateSelectedNodeActions(event.target.value)}
                    />
                  </div>
                ) : null}
                <div className="flow-canvas-inspector-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={saveSelectedNodeDraft}>Save</button>
                  <button type="button" onClick={cancelSelectedNodeDraft}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <div
          className={`flow-pane-resizer ${resizingPane === 'right' ? 'active' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right sidebar"
          onPointerDown={(event) => startPaneResize('right', event)}
          style={canvasFocus ? { display: 'none' } : undefined}
        />

        <aside className="flow-pane flow-pane-targets" style={canvasFocus ? { display: 'none' } : undefined}>
          <div className="flow-pane-header">Deployable Nodes</div>
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
                        onContextMenu={(event) => openTargetContextMenu(target, event)}
                        onPointerDown={(event) => {
                          if (event.button === 2) {
                            openTargetContextMenu(target, event)
                          }
                        }}
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
                            <li className="flow-target-score">
                              Score: {targetScoring.get(target.id)?.score ?? 0}
                              {' '}
                              ({(targetScoring.get(target.id)?.reasons || []).join(' | ') || 'no reasons'})
                            </li>
                          ) : null}
                          {selectedNode ? (
                            compatibility?.isCompatible ? (
                              <li><div className="flow-compat-ok">Compatible with selected workflow node.</div></li>
                            ) : (
                              <li>
                                <div className="flow-compat-missing">
                                  {compatibility?.missing?.length ? <div>Missing capabilities: {compatibility.missing.join(', ')}</div> : null}
                                  {compatibility?.missingWiring?.length ? <div>Missing wiring: {compatibility.missingWiring.join(', ')}</div> : null}
                                  {compatibility?.missingProtocols?.length ? <div>Missing protocols: {compatibility.missingProtocols.join(', ')}</div> : null}
                                  {compatibility?.missingSchemas?.length ? <div>Missing schemas: {compatibility.missingSchemas.join(', ')}</div> : null}
                                  {compatibility?.missingSlaProfiles?.length ? <div>Missing SLA profiles: {compatibility.missingSlaProfiles.join(', ')}</div> : null}
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
                <div className="flow-node-meta">Type: {selectedNode.flowNodeType || selectedNode.kind || selectedNode.type}</div>
                <div>{selectedNode.description || 'No description provided.'}</div>
                <div className="flow-selection-usage">{selectedNode.usageNotes || 'No usage notes provided.'}</div>
                <div className="flow-selection-usage">
                  Edit this node directly on the canvas using the inline inspector next to the selected node.
                </div>
                {manualBindOverrides[selectedNode.id] ? (
                  <div className="flow-selection-capabilities">
                    Manual bind override active for this node.
                    <button type="button" onClick={clearSelectedManualOverride}>Clear Override</button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flow-empty-side">Select a node to inspect description and usage notes.</div>
            )}
            {!selectedNode && selectedEdgeId ? (
              (() => {
                const edge = edges.find((item) => item.id === selectedEdgeId)
                const fromNode = edge ? nodeById.get(edge.from) : null
                const toNode = edge ? nodeById.get(edge.to) : null
                if (!edge) return null
                return (
                  <>
                    <div className="flow-selection-name">{edge.label}</div>
                    <div className="flow-node-meta">Type: {edge.type}</div>
                    <div className="flow-selection-usage">From: {fromNode?.label || edge.from}</div>
                    <div className="flow-selection-usage">To: {toNode?.label || edge.to}</div>
                    <div className="flow-selection-capabilities">
                      <button type="button" onClick={deleteSelectedEdge}>Delete Selected Edge</button>
                    </div>
                  </>
                )
              })()
            ) : null}
          </div>
        </aside>
      </div>

      <footer className="flow-designer-footer">
        <div>{loading ? 'Loading...' : statusText}</div>
        <div>{nodes.length} nodes · {edges.length} edges · {flowFileName}</div>
      </footer>
    </div>
  )
}
