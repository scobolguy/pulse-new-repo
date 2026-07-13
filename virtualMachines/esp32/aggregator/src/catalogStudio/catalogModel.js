export const CATALOG_KINDS = Object.freeze([
  'daemon',
  'service',
  'device',
  'map',
  'queue',
  'site',
  'provider',
])

export const CATALOG_SOURCES = Object.freeze([
  'seeded',
  'discovered',
  'user-defined',
])

export const PROPERTY_VALUE_TYPES = Object.freeze([
  'string',
  'integer',
  'boolean',
  'enum',
  'collection',
  'object',
  'type-ref',
])

export const RELATIONSHIP_TYPES = Object.freeze([
  'hosts',
  'exposes',
  'depends-on',
  'routes-to',
  'maps-to',
  'publishes-to',
  'consumes-from',
  'managed-by',
])

export const PERMANENT_OBJECT_TYPE_DEFINITIONS = Object.freeze({
  gateway: {
    kind: 'daemon',
    displayName: 'Gateway',
    accentToken: 'daemon',
    description: 'A long-running edge or ingress daemon that terminates transport and routes workloads.',
    propertySchema: [
      { id: 'protocols', valueType: 'collection', description: 'Inbound or outbound protocols handled by the gateway.' },
      { id: 'highAvailabilityMode', valueType: 'enum', description: 'Gateway failover behavior.' },
    ],
  },
  'message-broker': {
    kind: 'daemon',
    displayName: 'Message Broker',
    accentToken: 'daemon',
    description: 'A permanent daemon responsible for durable message transport and broker coordination.',
    propertySchema: [
      { id: 'brokerEngine', valueType: 'enum', description: 'Broker implementation or protocol family.' },
      { id: 'federationMode', valueType: 'enum', description: 'Broker federation or clustering behavior.' },
    ],
  },
  'data-librarian': {
    kind: 'daemon',
    displayName: 'Data Librarian',
    accentToken: 'daemon',
    description: 'Curates the seeded catalog, type metadata, object definitions, and reusable artifacts.',
    propertySchema: [
      { id: 'catalogDomains', valueType: 'collection', description: 'Catalog domains curated by the librarian.' },
      { id: 'authorityLevel', valueType: 'enum', description: 'How authoritative the librarian is for object definitions.' },
    ],
  },
  'queue-manager': {
    kind: 'daemon',
    displayName: 'Queue Manager',
    accentToken: 'daemon',
    description: 'A daemon that owns queue configuration, queue lifecycle, and durable queue state.',
    propertySchema: [
      { id: 'managerId', valueType: 'string', description: 'Stable queue manager identifier.' },
      { id: 'queueCount', valueType: 'integer', description: 'Number of managed queues.' },
    ],
  },
  'router-service': {
    kind: 'service',
    displayName: 'Router Service',
    accentToken: 'service',
    description: 'Typed routing logic exposed as a service surface.',
    propertySchema: [
      { id: 'inputTypes', valueType: 'collection', description: 'Accepted strongly typed message inputs.' },
      { id: 'outputQueues', valueType: 'collection', description: 'Target queues for routed messages.' },
    ],
  },
  'mapper-service': {
    kind: 'service',
    displayName: 'Mapper Service',
    accentToken: 'service',
    description: 'Transforms one strongly typed message shape into another.',
    propertySchema: [
      { id: 'sourceType', valueType: 'type-ref', description: 'Input type id.' },
      { id: 'targetType', valueType: 'type-ref', description: 'Output type id.' },
    ],
  },
  'esp-node': {
    kind: 'device',
    displayName: 'ESP Node',
    accentToken: 'device',
    description: 'A discovered ESP32 or related device participating in the network.',
    propertySchema: [
      { id: 'ip', valueType: 'string', description: 'Current network address.' },
      { id: 'role', valueType: 'string', description: 'Operational role of the device.' },
    ],
  },
  'message-map': {
    kind: 'map',
    displayName: 'Message Map',
    accentToken: 'map',
    description: 'A strongly typed map between canonical message contracts.',
    propertySchema: [
      { id: 'sourceType', valueType: 'type-ref', description: 'Source contract.' },
      { id: 'targetType', valueType: 'type-ref', description: 'Target contract.' },
    ],
  },
  'durable-queue': {
    kind: 'queue',
    displayName: 'Durable Queue',
    accentToken: 'queue',
    description: 'A durable queue used by brokers, daemons, or services.',
    propertySchema: [
      { id: 'messageType', valueType: 'type-ref', description: 'Expected message type.' },
      { id: 'retentionPolicy', valueType: 'enum', description: 'Message retention policy.' },
    ],
  },
})

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeProperty(property) {
  return {
    id: String(property?.id || '').trim(),
    label: String(property?.label || property?.id || '').trim(),
    value: property?.value ?? '',
    valueType: PROPERTY_VALUE_TYPES.includes(property?.valueType) ? property.valueType : 'string',
    description: String(property?.description || '').trim(),
    readOnly: property?.readOnly !== false,
  }
}

function normalizeAction(action) {
  return {
    id: String(action?.id || '').trim(),
    label: String(action?.label || action?.name || action?.id || '').trim(),
    kind: String(action?.kind || 'query').trim(),
    description: String(action?.description || '').trim(),
    http: action?.http || null,
  }
}

function normalizeRelationship(relationship) {
  return {
    type: RELATIONSHIP_TYPES.includes(relationship?.type) ? relationship.type : 'depends-on',
    targetId: String(relationship?.targetId || '').trim(),
    label: String(relationship?.label || relationship?.type || '').trim(),
  }
}

const KIND_ICON_COLORS = Object.freeze({
  daemon: '#24598a',
  service: '#1f7a61',
  device: '#915f14',
  map: '#81408c',
  queue: '#a04b2e',
  site: '#315370',
  provider: '#33617a',
})

function buildMonogramIcon(label, kind) {
  const text = String(label || kind || 'C').trim().slice(0, 1).toUpperCase() || 'C'
  const color = KIND_ICON_COLORS[String(kind || 'service')] || '#5f7389'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x="1" y="1" width="26" height="26" rx="6" fill="${color}"/><text x="14" y="18" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700">${text}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function getTypeDefinition(type) {
  return PERMANENT_OBJECT_TYPE_DEFINITIONS[String(type || '').trim()] || null
}

export function createCatalogObject(input) {
  const normalizedType = String(input?.type || '').trim()
  const typeDefinition = getTypeDefinition(normalizedType)
  const normalizedKind = String(input?.kind || typeDefinition?.kind || 'service').trim()

  return {
    id: String(input?.id || '').trim(),
    name: String(input?.name || input?.id || '').trim(),
    kind: CATALOG_KINDS.includes(normalizedKind) ? normalizedKind : 'service',
    type: normalizedType,
    source: CATALOG_SOURCES.includes(input?.source) ? input.source : 'seeded',
    description: String(input?.description || typeDefinition?.description || '').trim(),
    usageNotes: String(input?.usageNotes || '').trim(),
    status: String(input?.status || 'defined').trim(),
    location: String(input?.location || '').trim(),
    accentToken: String(input?.accentToken || typeDefinition?.accentToken || normalizedKind).trim(),
    iconGraphic: String(input?.iconGraphic || '').trim() || buildMonogramIcon(input?.name || input?.id || normalizedKind, normalizedKind),
    tags: normalizeArray(input?.tags).map((tag) => String(tag).trim()).filter(Boolean),
    capabilities: normalizeArray(input?.capabilities).map((item) => String(item).trim()).filter(Boolean),
    properties: normalizeArray(input?.properties).map(normalizeProperty).filter((property) => property.id),
    actions: normalizeArray(input?.actions).map(normalizeAction).filter((action) => action.id),
    relationships: normalizeArray(input?.relationships).map(normalizeRelationship).filter((relationship) => relationship.targetId),
    runtime: input?.runtime && typeof input.runtime === 'object' ? input.runtime : {},
    typeDefinition,
  }
}

function normalizeVisualActions(actions) {
  return normalizeArray(actions).map((action) => normalizeAction(action)).filter((action) => action.id)
}

export function createVisualObject(input) {
  const actions = normalizeVisualActions(input?.actions)
  return createCatalogObject({
    ...input,
    actions,
    runtime: {
      ...(input?.runtime && typeof input.runtime === 'object' ? input.runtime : {}),
      visualObject: {
        kind: 'visual-object',
        derivedFrom: String(input?.derivedFrom || '').trim(),
        visualName: String(input?.name || input?.id || '').trim(),
        actionIds: actions.map((action) => action.id),
      },
    },
  })
}

export function deriveVisualObject(baseObject, overrides = {}) {
  return createVisualObject({
    ...baseObject,
    ...overrides,
    derivedFrom: overrides?.derivedFrom || baseObject?.id || '',
    runtime: {
      ...(baseObject?.runtime && typeof baseObject.runtime === 'object' ? baseObject.runtime : {}),
      ...(overrides?.runtime && typeof overrides.runtime === 'object' ? overrides.runtime : {}),
    },
  })
}

export function isVisualObject(object) {
  return Boolean(object?.runtime?.visualObject?.kind === 'visual-object')
}

export function groupCatalogObjects(objects) {
  return normalizeArray(objects).reduce((accumulator, object) => {
    const key = object.kind || 'service'
    if (!accumulator[key]) {
      accumulator[key] = []
    }
    accumulator[key].push(object)
    return accumulator
  }, {})
}

export function buildCatalogIndex(objects) {
  const index = new Map()
  normalizeArray(objects).forEach((object) => {
    if (object?.id) {
      index.set(object.id, object)
    }
  })
  return index
}