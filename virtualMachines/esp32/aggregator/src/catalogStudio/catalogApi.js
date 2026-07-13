import { getJsonAsActor } from '../http-client.js'
import { createVisualObject, deriveVisualObject } from './catalogModel'
import { SEEDED_CATALOG_OBJECTS } from './seededCatalog'

function normalizeNodePayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.nodes)) return payload.nodes
  return []
}

function normalizeProviderPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.providers)) return payload.providers
  return []
}

function normalizeSitePayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.sites)) return payload.sites
  return []
}

function inferProviderObjectKind(provider) {
  const providerId = String(provider?.id || '').trim().toLowerCase()
  if (['platform', 'topology', 'queue', 'broker', 'librarian', 'observability', 'iam'].includes(providerId)) {
    return 'daemon'
  }
  return 'service'
}

function inferProviderObjectType(provider) {
  const providerId = String(provider?.id || '').trim().toLowerCase()
  if (providerId === 'broker') return 'message-broker'
  if (providerId === 'queue') return 'queue-manager'
  if (providerId === 'librarian') return 'data-librarian'
  if (providerId === 'topology' || providerId === 'platform') return 'gateway'
  if (providerId === 'router') return 'router-service'
  if (providerId === 'mapper') return 'mapper-service'
  return `${providerId || 'provider'}-provider`
}

function mapProviderToCatalogObject(provider) {
  const kind = inferProviderObjectKind(provider)
  const type = inferProviderObjectType(provider)
  return createVisualObject({
    id: `provider.${provider.id}`,
    name: provider.name || provider.id,
    kind,
    type,
    source: 'discovered',
    status: 'available',
    location: 'aggregator/providers',
    description: provider.description || '',
    usageNotes: `Reuse provider ${provider.name || provider.id} for standard platform operations before introducing custom provider implementations.`,
    tags: [provider.category || 'provider'],
    properties: [
      { id: 'category', label: 'Category', valueType: 'string', value: provider.category || '', readOnly: true },
      { id: 'actionCount', label: 'Action Count', valueType: 'integer', value: provider.actionCount ?? (Array.isArray(provider.actions) ? provider.actions.length : 0), readOnly: true },
      { id: 'propertyCount', label: 'Property Count', valueType: 'integer', value: provider.propertyCount ?? (Array.isArray(provider.properties) ? provider.properties.length : 0), readOnly: true },
    ],
    actions: Array.isArray(provider.actions)
      ? provider.actions.map((action) => ({
          id: action.id,
          label: action.name || action.id,
          kind: action.kind || 'query',
          description: action.description || '',
          http: action.http || null,
        }))
      : [],
  })
}

function mapNodeToCatalogObjects(node) {
  const nodeId = String(node?.id || node?.nodeId || node?.ip || '').trim()
  if (!nodeId) return []

  const baseObject = createVisualObject({
    id: `node.${nodeId}`,
    name: node?.name || node?.nodeName || nodeId,
    kind: 'device',
    type: 'esp-node',
    source: 'discovered',
    status: 'available',
    location: String(node?.ip || ''),
    description: String(node?.type || 'Discovered node').trim(),
    usageNotes: 'Use this discovered node as a deployment target for workflows that need device-local execution.',
    tags: [String(node?.type || 'node').trim(), 'aggregator'],
    properties: [
      { id: 'ip', label: 'IP', valueType: 'string', value: node?.ip || '', readOnly: true },
      { id: 'role', label: 'Role', valueType: 'string', value: node?.type || 'node', readOnly: true },
      { id: 'lastSeen', label: 'Last Seen', valueType: 'string', value: node?.lastSeen || '', readOnly: true },
    ],
  })

  const capabilityEntries = node?.capabilities && typeof node.capabilities === 'object'
    ? Object.entries(node.capabilities)
    : []

  const serviceObjects = capabilityEntries.map(([capabilityId, path]) => deriveVisualObject(baseObject, {
    id: `service.${nodeId}.${capabilityId}`,
    name: capabilityId,
    kind: 'service',
    type: 'router-service',
    source: 'discovered',
    status: 'available',
    location: String(node?.ip || ''),
    description: `Node capability exposed at ${path}`,
    usageNotes: `Reuse capability ${capabilityId} when this node already exposes the required endpoint.`,
    tags: ['node-capability'],
    properties: [
      { id: 'path', label: 'Path', valueType: 'string', value: path, readOnly: true },
      { id: 'nodeId', label: 'Node', valueType: 'string', value: nodeId, readOnly: true },
    ],
    relationships: [
      { type: 'hosts', targetId: `node.${nodeId}`, label: 'hosted by node' },
    ],
  }))

  return [baseObject, ...serviceObjects]
}

function mapSiteToCatalogObject(site) {
  const siteId = String(site?.siteId || site?.id || site?.label || '').trim()
  if (!siteId) return null
  return createVisualObject({
    id: `site.${siteId}`,
    name: site?.label || siteId,
    kind: 'site',
    type: 'site',
    source: 'discovered',
    status: 'available',
    location: String(site?.region || site?.siteMode || '').trim(),
    description: String(site?.description || '').trim(),
    usageNotes: 'Use this site to constrain deployment and routing decisions by geography or operating mode.',
    properties: [
      { id: 'siteMode', label: 'Mode', valueType: 'string', value: site?.siteMode || '', readOnly: true },
      { id: 'siteCategory', label: 'Category', valueType: 'string', value: site?.siteCategory || '', readOnly: true },
    ],
  })
}

function dedupeCatalogObjects(objects) {
  const seen = new Map()
  objects.forEach((object) => {
    if (object?.id) {
      seen.set(object.id, object)
    }
  })
  return Array.from(seen.values())
}

function loadCatalogOverrides() {
  try {
    const raw = localStorage.getItem('pulse.catalogOverrides')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

function applyCatalogOverrides(objects) {
  const overrides = loadCatalogOverrides()
  if (!overrides || typeof overrides !== 'object') {
    return objects
  }
  return objects.map((object) => {
    const patch = overrides[object?.id]
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return object
    }
    return createVisualObject({
      ...object,
      ...patch,
    })
  })
}

export async function fetchCatalogSnapshot() {
  const [nodesResult, providersResult, sitesResult] = await Promise.allSettled([
    getJsonAsActor('/api/nodes', 'Node request failed'),
    getJsonAsActor('/api/platform/providers', 'Provider request failed'),
    getJsonAsActor('/api/sites', 'Site request failed'),
  ])

  const nodes = nodesResult.status === 'fulfilled' ? normalizeNodePayload(nodesResult.value) : []
  const providers = providersResult.status === 'fulfilled' ? normalizeProviderPayload(providersResult.value) : []
  const sites = sitesResult.status === 'fulfilled' ? normalizeSitePayload(sitesResult.value) : []

  const discoveredObjects = [
    ...nodes.flatMap(mapNodeToCatalogObjects),
    ...providers.map(mapProviderToCatalogObject),
    ...sites.map(mapSiteToCatalogObject).filter(Boolean),
  ]

  return {
    loadedAt: new Date().toISOString(),
    errors: [nodesResult, providersResult, sitesResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => String(result.reason?.message || result.reason || 'Unknown error')),
    objects: applyCatalogOverrides(dedupeCatalogObjects([...SEEDED_CATALOG_OBJECTS, ...discoveredObjects])),
  }
}