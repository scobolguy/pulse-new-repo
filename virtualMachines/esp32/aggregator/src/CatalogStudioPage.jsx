import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCatalogSnapshot } from './catalogStudio/catalogApi'
import { buildCatalogIndex, groupCatalogObjects } from './catalogStudio/catalogModel'

const LANE_ORDER = ['daemon', 'service', 'device', 'map', 'queue', 'site']

function formatKindLabel(kind) {
  return String(kind || '').replace(/(^|[-_])(\w)/g, (_, boundary, letter) => `${boundary ? ' ' : ''}${letter.toUpperCase()}`).trim()
}

function catalogObjectMatchesQuery(object, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return true
  const haystack = [
    object.id,
    object.name,
    object.kind,
    object.type,
    object.source,
    object.description,
    object.usageNotes,
    object.location,
    ...(object.tags || []),
    ...(object.capabilities || []),
  ].join(' ').toLowerCase()
  return haystack.includes(normalizedQuery)
}

function isReusableObject(object) {
  return object.source === 'seeded' || (object.tags || []).includes('permanent')
}

function CatalogIcon({ item, className }) {
  if (item?.iconGraphic) {
    return <img className={className} src={item.iconGraphic} alt={`${item.name} icon`} />
  }
  return <span className={className} />
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

function saveCatalogOverrides(overrides) {
  localStorage.setItem('pulse.catalogOverrides', JSON.stringify(overrides))
}

function CatalogTreeGroup({ label, items, selectedId, onSelect }) {
  if (!items.length) return null
  return (
    <div className="catalog-studio-tree-group">
      <div className="catalog-studio-tree-title">{label}</div>
      <div className="catalog-studio-tree-items">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`catalog-studio-tree-item ${selectedId === item.id ? 'selected' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <CatalogIcon item={item} className={`catalog-studio-tree-accent ${item.accentToken || item.kind}`} />
            <span className="catalog-studio-tree-copy">
              <span className="catalog-studio-tree-name">{item.name}</span>
              <span className="catalog-studio-tree-meta">{item.type} · {item.source}</span>
              <span className="catalog-studio-tree-notes">{item.usageNotes || item.description || 'No usage notes yet.'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PropertyGrid({ item, onPatch }) {
  const iconFileRef = useRef(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [usageNotesDraft, setUsageNotesDraft] = useState('')
  const [iconDraft, setIconDraft] = useState('')

  useEffect(() => {
    setDescriptionDraft(item?.description || '')
    setUsageNotesDraft(item?.usageNotes || '')
    setIconDraft(item?.iconGraphic || '')
  }, [item?.id, item?.description, item?.usageNotes, item?.iconGraphic])

  if (!item) {
    return <div className="catalog-studio-empty-panel">Select an item to inspect its typed properties.</div>
  }

  function commitPatch(patch) {
    if (typeof onPatch === 'function') {
      onPatch(item.id, patch)
    }
  }

  function handleIconUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const nextValue = String(reader.result || '')
      setIconDraft(nextValue)
      commitPatch({ iconGraphic: nextValue })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="catalog-studio-property-grid">
      <div className="catalog-studio-property-row"><span>Name</span><strong>{item.name}</strong></div>
      <div className="catalog-studio-property-row"><span>Kind</span><strong>{item.kind}</strong></div>
      <div className="catalog-studio-property-row"><span>Type</span><strong>{item.type || 'untyped'}</strong></div>
      <div className="catalog-studio-property-row"><span>Source</span><strong>{item.source}</strong></div>
      <div className="catalog-studio-property-row"><span>Status</span><strong>{item.status}</strong></div>
      <div className="catalog-studio-property-row"><span>Location</span><strong>{item.location || 'n/a'}</strong></div>

      <div className="catalog-studio-property-section">Description</div>
      <textarea
        className="catalog-studio-property-edit"
        value={descriptionDraft}
        onChange={(event) => setDescriptionDraft(event.target.value)}
        onBlur={() => commitPatch({ description: descriptionDraft.trim() })}
      />

      <div className="catalog-studio-property-section">Usage Notes</div>
      <textarea
        className="catalog-studio-property-edit"
        value={usageNotesDraft}
        onChange={(event) => setUsageNotesDraft(event.target.value)}
        onBlur={() => commitPatch({ usageNotes: usageNotesDraft.trim() })}
      />

      <div className="catalog-studio-property-section">Icon Graphic</div>
      <div className="catalog-studio-property-icon-tools">
        {iconDraft ? <img className="catalog-studio-property-icon-preview" src={iconDraft} alt={`${item.name} icon preview`} /> : null}
        <input
          className="catalog-studio-property-input"
          type="text"
          value={iconDraft}
          placeholder="Paste icon URL or data URI"
          onChange={(event) => setIconDraft(event.target.value)}
          onBlur={() => commitPatch({ iconGraphic: iconDraft.trim() })}
        />
        <div className="catalog-studio-property-actions">
          <button type="button" onClick={() => iconFileRef.current?.click()}>Upload Image</button>
          <button
            type="button"
            onClick={() => {
              setIconDraft('')
              commitPatch({ iconGraphic: '' })
            }}
          >
            Reset Icon
          </button>
        </div>
        <input
          ref={iconFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleIconUpload}
        />
      </div>

      <div className="catalog-studio-property-section">Typed Schema</div>
      {(item.typeDefinition?.propertySchema || []).length === 0 ? (
        <div className="catalog-studio-empty-panel">No permanent schema has been defined for this type yet.</div>
      ) : (
        (item.typeDefinition?.propertySchema || []).map((property) => (
          <div key={property.id} className="catalog-studio-property-row catalog-studio-property-row-schema">
            <span>{property.id}</span>
            <strong>{property.valueType}</strong>
          </div>
        ))
      )}

      <div className="catalog-studio-property-section">Values</div>
      {(item.properties || []).length === 0 ? (
        <div className="catalog-studio-empty-panel">No property values are loaded for this item.</div>
      ) : (
        item.properties.map((property) => (
          <div key={property.id} className="catalog-studio-property-row">
            <span>{property.label}</span>
            <strong>{String(property.value || '')}</strong>
          </div>
        ))
      )}
    </div>
  )
}

function RelationshipPanel({ item, index }) {
  if (!item) {
    return <div className="catalog-studio-empty-panel">Relationships will appear here after you select a catalog item.</div>
  }

  if (!item.relationships.length) {
    return <div className="catalog-studio-empty-panel">This item has no declared relationships yet.</div>
  }

  return (
    <div className="catalog-studio-relationship-list">
      {item.relationships.map((relationship) => {
        const target = index.get(relationship.targetId)
        return (
          <div key={`${item.id}-${relationship.type}-${relationship.targetId}`} className="catalog-studio-relationship-card">
            <div className="catalog-studio-relationship-label">{relationship.label || relationship.type}</div>
            <div className="catalog-studio-relationship-target">{target?.name || relationship.targetId}</div>
            <div className="catalog-studio-relationship-meta">{relationship.type}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function CatalogStudioPage() {
  const [snapshot, setSnapshot] = useState({ loadedAt: '', errors: [], objects: [] })
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('daemon.data-librarian.primary')
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [reuseOnly, setReuseOnly] = useState(false)
  const [overrides, setOverrides] = useState(() => loadCatalogOverrides())

  async function loadSnapshot() {
    setLoading(true)
    try {
      const nextSnapshot = await fetchCatalogSnapshot()
      setSnapshot(nextSnapshot)
      if (!selectedId && nextSnapshot.objects[0]?.id) {
        setSelectedId(nextSnapshot.objects[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  function patchCatalogObject(objectId, patch) {
    if (!objectId || !patch || typeof patch !== 'object') {
      return
    }
    setSnapshot((previous) => ({
      ...previous,
      objects: previous.objects.map((object) => object.id === objectId ? { ...object, ...patch } : object),
    }))
    setOverrides((previous) => {
      const next = {
        ...previous,
        [objectId]: {
          ...(previous[objectId] || {}),
          ...patch,
        },
      }
      saveCatalogOverrides(next)
      return next
    })
  }

  const visibleObjects = useMemo(() => snapshot.objects
    .filter((object) => {
      if (sourceFilter !== 'all' && object.source !== sourceFilter) return false
      if (reuseOnly && !isReusableObject(object)) return false
      return catalogObjectMatchesQuery(object, query)
    })
    .sort((left, right) => {
      const leftRank = isReusableObject(left) ? 0 : 1
      const rightRank = isReusableObject(right) ? 0 : 1
      if (leftRank !== rightRank) return leftRank - rightRank
      return String(left.name || '').localeCompare(String(right.name || ''))
    }), [snapshot.objects, query, sourceFilter, reuseOnly, overrides])

  const grouped = useMemo(() => groupCatalogObjects(visibleObjects), [visibleObjects])
  const index = useMemo(() => buildCatalogIndex(snapshot.objects), [snapshot.objects])
  const selectedItem = selectedId ? index.get(selectedId) || visibleObjects[0] || null : visibleObjects[0] || null

  useEffect(() => {
    if (selectedItem?.id && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id)
    }
  }, [selectedItem, selectedId])

  const counts = useMemo(() => {
    return LANE_ORDER.reduce((accumulator, kind) => {
      accumulator[kind] = Array.isArray(grouped[kind]) ? grouped[kind].length : 0
      return accumulator
    }, {})
  }, [grouped])

  return (
    <div className="catalog-studio-page">
      <header className="catalog-studio-titlebar">
        <div>
          <div className="catalog-studio-product">Pulse Catalog Studio</div>
          <div className="catalog-studio-subtitle">Typed infrastructure design surface driven by the aggregator and seeded by the data librarian.</div>
        </div>
        <div className="catalog-studio-title-actions">
          <button type="button" onClick={loadSnapshot}>Refresh Catalog</button>
          <div className="catalog-studio-last-refresh">Loaded: {snapshot.loadedAt || 'never'}</div>
        </div>
      </header>

      <div className="catalog-studio-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, id, type, description, usage notes, tags, or capabilities"
        />
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">All Sources</option>
          <option value="seeded">Seeded</option>
          <option value="discovered">Discovered</option>
          <option value="user-defined">User Defined</option>
        </select>
        <label className="catalog-studio-toggle">
          <input
            type="checkbox"
            checked={reuseOnly}
            onChange={(event) => setReuseOnly(event.target.checked)}
          />
          Reuse-first
        </label>
        <div className="catalog-studio-counts">
          {LANE_ORDER.map((kind) => (
            <span key={kind} className="catalog-studio-count-pill">{formatKindLabel(kind)} {counts[kind]}</span>
          ))}
        </div>
      </div>

      <div className="catalog-studio-search-help">
        Reuse-first prioritizes seeded and permanent objects so teams compose flows from approved building blocks.
      </div>

      {snapshot.errors.length > 0 ? (
        <div className="catalog-studio-errors">{snapshot.errors.join(' | ')}</div>
      ) : null}

      <div className="catalog-studio-shell">
        <aside className="catalog-studio-pane catalog-studio-pane-explorer">
          <div className="catalog-studio-pane-header">Catalog Explorer</div>
          <CatalogTreeGroup label="Daemons" items={grouped.daemon || []} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogTreeGroup label="Services" items={grouped.service || []} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogTreeGroup label="Devices" items={grouped.device || []} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogTreeGroup label="Maps" items={grouped.map || []} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogTreeGroup label="Queues" items={grouped.queue || []} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogTreeGroup label="Sites" items={grouped.site || []} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>

        <main className="catalog-studio-pane catalog-studio-pane-designer">
          <div className="catalog-studio-pane-header">Design Surface</div>
          <div className="catalog-studio-canvas-tabs">
            <span className="active">Infrastructure.graph</span>
            <span>Catalog.types</span>
            <span>Queries.panel</span>
          </div>
          <div className="catalog-studio-canvas-grid">
            {LANE_ORDER.map((kind) => (
              <section key={kind} className="catalog-studio-lane">
                <div className="catalog-studio-lane-header">
                  <span>{formatKindLabel(kind)}</span>
                  <span>{counts[kind]}</span>
                </div>
                <div className="catalog-studio-lane-cards">
                  {(grouped[kind] || []).length === 0 ? (
                    <div className="catalog-studio-lane-empty">No {kind} objects loaded.</div>
                  ) : (
                    (grouped[kind] || []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`catalog-studio-card ${selectedId === item.id ? 'selected' : ''}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="catalog-studio-card-head">
                          <CatalogIcon item={item} className={`catalog-studio-card-icon ${item.accentToken || item.kind}`} />
                          <span className="catalog-studio-card-source">{item.source}</span>
                        </div>
                        <div className="catalog-studio-card-name">{item.name}</div>
                        <div className="catalog-studio-card-type">{item.type || 'untyped'}</div>
                        <div className="catalog-studio-card-description">{item.description || 'No description loaded.'}</div>
                        <div className="catalog-studio-card-usage">{item.usageNotes || 'No usage notes yet.'}</div>
                        <div className="catalog-studio-card-foot">
                          <span>{item.properties.length} properties</span>
                          <span>{item.actions.length} actions</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside className="catalog-studio-pane catalog-studio-pane-properties">
          <div className="catalog-studio-pane-header">Properties</div>
          <PropertyGrid item={selectedItem} onPatch={patchCatalogObject} />
          <div className="catalog-studio-pane-header catalog-studio-pane-subheader">Relationships</div>
          <RelationshipPanel item={selectedItem} index={index} />
        </aside>
      </div>

      <footer className="catalog-studio-output">
        <div className="catalog-studio-pane-header">Output</div>
        {loading ? (
          <div className="catalog-studio-empty-panel">Loading live catalog snapshot from the aggregator.</div>
        ) : (
          <div className="catalog-studio-output-grid">
            <div>
              <div className="catalog-studio-output-label">Selected Object</div>
              <div className="catalog-studio-output-value">{selectedItem?.id || 'none'}</div>
            </div>
            <div>
              <div className="catalog-studio-output-label">Typed Advantage</div>
              <div className="catalog-studio-output-value">Maps, queues, and daemons can declare stable kinds and concrete types before discovery.</div>
            </div>
            <div>
              <div className="catalog-studio-output-label">Catalog Authority</div>
              <div className="catalog-studio-output-value">Seeded by Data Librarian, hydrated by Aggregator</div>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}