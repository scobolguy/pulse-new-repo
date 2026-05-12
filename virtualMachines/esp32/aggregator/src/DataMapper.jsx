import React, { useEffect, useMemo, useState } from 'react';

const SECTION_STYLE = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

const PANEL_STYLE = {
  border: '1px solid #d6dbe1',
  borderRadius: 6,
  minHeight: 400,
  maxHeight: 560,
  overflow: 'auto',
  background: '#fafbfd',
};

function flattenStructure(node, prefix = '', depth = 0) {
  if (!node) return [];
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) return [];

  const rows = [];
  for (const child of children) {
    const path = prefix ? `${prefix}.${child.name}` : String(child.name || '');
    const kind = child.kind === 'branch' ? 'branch' : 'leaf';
    const valueType = String(child.valueType || 'unknown').toLowerCase();
    rows.push({ path, kind, valueType, depth });
    rows.push(...flattenStructure(child, path, depth + 1));
  }
  return rows;
}

function isCompatible(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.kind !== targetNode.kind) return false;
  if (sourceNode.kind === 'branch') return true;
  if (sourceNode.valueType === targetNode.valueType) return true;
  if (sourceNode.valueType === 'unknown' || targetNode.valueType === 'unknown') return true;
  return false;
}

function mappingTitle(mapping) {
  return String(mapping?.name || `${mapping?.sourceTypeId || ''} -> ${mapping?.targetTypeId || ''}` || '').trim();
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function resolveSchemaByPath(schemasByPath, rawPath) {
  const direct = schemasByPath.get(rawPath);
  if (direct) return direct;

  const normalizedTarget = normalizePath(rawPath);
  if (!normalizedTarget) return null;

  for (const [candidatePath, schema] of schemasByPath.entries()) {
    const candidate = normalizePath(candidatePath);
    if (!candidate) continue;
    if (candidate === normalizedTarget) return schema;
    if (candidate.endsWith(normalizedTarget)) return schema;
    if (normalizedTarget.endsWith(candidate)) return schema;
  }
  return null;
}

function formatSwiftLikePath(path) {
  const raw = String(path || '');
  const match = raw.match(/^finEnvelope\.block4\.fields\.([A-Za-z0-9]+)(?:\.(.+))?$/);
  if (!match) return raw;
  const fieldTag = match[1];
  const suffix = match[2] ? `.${match[2]}` : '';
  return `:${fieldTag}:${suffix}`;
}

function extractMtFieldDefs(rawSchema) {
  const messageType = String(rawSchema?.messageType || '').toUpperCase();
  const fields = rawSchema?.finEnvelope?.block4?.fields;
  if (!messageType.startsWith('MT') || !fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return null;
  }
  const byTag = new Map();
  for (const [tag, def] of Object.entries(fields)) {
    if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
    byTag.set(String(tag), {
      name: String(def.name || tag),
      format: String(def.format || ''),
    });
  }
  return byTag;
}

function formatPathForDisplay(path, mtFieldDefs) {
  const raw = String(path || '');
  if (!mtFieldDefs) return formatSwiftLikePath(raw);

  const match = raw.match(/^finEnvelope\.block4\.fields\.([A-Za-z0-9]+)(?:\.(.+))?$/);
  if (!match) return formatSwiftLikePath(raw);

  const fieldTag = String(match[1]);
  const rest = match[2] ? `.${match[2]}` : '';
  return `:${fieldTag}:${rest}`;
}

function labelForPath(path, mtFieldDefs) {
  return formatPathForDisplay(path, mtFieldDefs);
}

function isMtSchemaPath(schemaPath) {
  return /swift-mt/i.test(String(schemaPath || ''));
}

function isXsdSchemaPath(schemaPath) {
  return /\.xsd$/i.test(String(schemaPath || ''));
}

function getParentPath(path) {
  const raw = String(path || '');
  const lastDot = raw.lastIndexOf('.');
  if (lastDot < 0) return '';
  return raw.slice(0, lastDot);
}

function getPathTail(path) {
  const raw = String(path || '');
  const lastDot = raw.lastIndexOf('.');
  if (lastDot < 0) return raw;
  return raw.slice(lastDot + 1);
}

function buildNodeIndex(nodes) {
  const nodeByPath = new Map();
  const childrenByParent = new Map();

  for (const node of nodes) {
    nodeByPath.set(node.path, node);
  }

  for (const node of nodes) {
    const parentPath = getParentPath(node.path);
    const siblings = childrenByParent.get(parentPath) || [];
    siblings.push(node);
    childrenByParent.set(parentPath, siblings);
  }

  return { nodeByPath, childrenByParent };
}

function getInitialExpandedPaths(indexData) {
  const roots = indexData.childrenByParent.get('') || [];
  const hasDocument = roots.some(node => node.path === 'Document');
  if (hasDocument) return new Set(['Document']);
  return new Set(roots.map(node => node.path));
}

function filterNodesForSchema(nodes, schemaPath) {
  if (!isMtSchemaPath(schemaPath)) return nodes;
  return nodes.filter(node => /^finEnvelope\.block4\.fields\.[A-Za-z0-9]+$/.test(String(node.path || '')));
}

export default function DataMapper() {
  const [mappings, setMappings] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [status, setStatus] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [sourceTypeId, setSourceTypeId] = useState('');
  const [targetTypeId, setTargetTypeId] = useState('');
  const [sourceSchemaPath, setSourceSchemaPath] = useState('');
  const [targetSchemaPath, setTargetSchemaPath] = useState('');
  const [items, setItems] = useState([]);
  const [sourceMtFieldDefs, setSourceMtFieldDefs] = useState(null);
  const [targetMtFieldDefs, setTargetMtFieldDefs] = useState(null);
  const [expandedSourcePaths, setExpandedSourcePaths] = useState(new Set());
  const [expandedTargetPaths, setExpandedTargetPaths] = useState(new Set());

  async function loadAll() {
    try {
      const [schemasRes, mappingsRes] = await Promise.all([
        fetch('/api/librarian/schemas'),
        fetch('/api/mapper/mappings'),
      ]);
      const nextSchemas = schemasRes.ok ? ((await schemasRes.json()).schemas || []) : [];
      const nextMappings = mappingsRes.ok ? ((await mappingsRes.json()).mappings || []) : [];
      setSchemas(Array.isArray(nextSchemas) ? nextSchemas : []);
      setMappings(Array.isArray(nextMappings) ? nextMappings : []);
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const schemasByPath = useMemo(() => {
    const map = new Map();
    for (const schema of schemas) {
      map.set(String(schema.path || ''), schema);
    }
    return map;
  }, [schemas]);

  const sourceSchema = useMemo(() => resolveSchemaByPath(schemasByPath, sourceSchemaPath), [schemasByPath, sourceSchemaPath]);
  const targetSchema = useMemo(() => resolveSchemaByPath(schemasByPath, targetSchemaPath), [schemasByPath, targetSchemaPath]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMtDefs(schemaPath, setter) {
      if (!schemaPath || !/swift-mt/i.test(schemaPath) || !/\.json$/i.test(schemaPath)) {
        setter(null);
        return;
      }
      try {
        const res = await fetch(`/api/librarian/file/${schemaPath}`);
        if (!res.ok) {
          setter(null);
          return;
        }
        const raw = await res.json();
        if (isCancelled) return;
        setter(extractMtFieldDefs(raw));
      } catch {
        if (!isCancelled) setter(null);
      }
    }

    const effectiveSourcePath = sourceSchema?.path || sourceSchemaPath;
    const effectiveTargetPath = targetSchema?.path || targetSchemaPath;

    loadMtDefs(effectiveSourcePath, setSourceMtFieldDefs);
    loadMtDefs(effectiveTargetPath, setTargetMtFieldDefs);

    return () => {
      isCancelled = true;
    };
  }, [sourceSchemaPath, targetSchemaPath, sourceSchema, targetSchema]);

  const sourceNodes = useMemo(() => {
    const allNodes = flattenStructure(sourceSchema?.structure);
    return filterNodesForSchema(allNodes, sourceSchemaPath);
  }, [sourceSchema, sourceSchemaPath]);

  const targetNodes = useMemo(() => {
    const allNodes = flattenStructure(targetSchema?.structure);
    return filterNodesForSchema(allNodes, targetSchemaPath);
  }, [targetSchema, targetSchemaPath]);

  const effectiveSourceSchemaPath = sourceSchema?.path || sourceSchemaPath;
  const effectiveTargetSchemaPath = targetSchema?.path || targetSchemaPath;
  const sourceIsXsd = isXsdSchemaPath(effectiveSourceSchemaPath);
  const targetIsXsd = isXsdSchemaPath(effectiveTargetSchemaPath);

  const sourceIndex = useMemo(() => buildNodeIndex(sourceNodes), [sourceNodes]);
  const targetIndex = useMemo(() => buildNodeIndex(targetNodes), [targetNodes]);

  const sourceRoots = useMemo(() => {
    const roots = sourceIndex.childrenByParent.get('') || [];
    const documentNode = roots.find(node => node.path === 'Document');
    return documentNode ? [documentNode] : roots;
  }, [sourceIndex]);

  const targetRoots = useMemo(() => {
    const roots = targetIndex.childrenByParent.get('') || [];
    const documentNode = roots.find(node => node.path === 'Document');
    return documentNode ? [documentNode] : roots;
  }, [targetIndex]);

  useEffect(() => {
    if (!sourceIsXsd) {
      setExpandedSourcePaths(new Set());
      return;
    }
    setExpandedSourcePaths(getInitialExpandedPaths(sourceIndex));
  }, [sourceIsXsd, sourceIndex, sourceSchemaPath]);

  useEffect(() => {
    if (!targetIsXsd) {
      setExpandedTargetPaths(new Set());
      return;
    }
    setExpandedTargetPaths(getInitialExpandedPaths(targetIndex));
  }, [targetIsXsd, targetIndex, targetSchemaPath]);

  const sourceNodeByPath = useMemo(() => {
    const map = new Map();
    for (const node of sourceNodes) map.set(node.path, node);
    return map;
  }, [sourceNodes]);

  const targetNodeByPath = useMemo(() => {
    const map = new Map();
    for (const node of targetNodes) map.set(node.path, node);
    return map;
  }, [targetNodes]);

  const editorReady = !!editingId && !!sourceSchema && !!targetSchema;

  const linkedSourcePaths = useMemo(() => {
    return new Set(items.map(item => String(item.sourcePath || '')).filter(Boolean));
  }, [items]);

  const linkedTargetPaths = useMemo(() => {
    return new Set(items.map(item => String(item.targetPath || '')).filter(Boolean));
  }, [items]);

  function toggleExpandPath(path, pane) {
    const setter = pane === 'source' ? setExpandedSourcePaths : setExpandedTargetPaths;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderXsdTreeNode(node, pane, depth = 0) {
    const isSourcePane = pane === 'source';
    const indexData = isSourcePane ? sourceIndex : targetIndex;
    const linkedPaths = isSourcePane ? linkedSourcePaths : linkedTargetPaths;
    const expandedPaths = isSourcePane ? expandedSourcePaths : expandedTargetPaths;

    const isLinked = linkedPaths.has(node.path);
    const children = indexData.childrenByParent.get(node.path) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedPaths.has(node.path);
    const typeText = String(node.valueType || 'unknown');

    const row = (
      <div
        key={`${pane}:${node.path}`}
        draggable={isSourcePane}
        onDragStart={isSourcePane ? (event => onSourceDragStart(event, node)) : undefined}
        onDragOver={!isSourcePane ? (event => event.preventDefault()) : undefined}
        onDrop={!isSourcePane ? (event => onTargetDrop(event, node)) : undefined}
        style={{
          marginLeft: depth * 14,
          padding: '4px 8px',
          borderBottom: '1px solid #eef2f7',
          fontSize: 12,
          cursor: isSourcePane ? 'grab' : 'default',
          background: isSourcePane ? (isLinked ? '#fff6e8' : '#fff') : (isLinked ? '#eaf8ef' : '#fff'),
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        title={isSourcePane ? 'Drag to destination' : 'Drop source node here'}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (hasChildren) toggleExpandPath(node.path, pane);
          }}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: hasChildren ? 'pointer' : 'default',
            width: 14,
            textAlign: 'center',
            color: '#475569',
          }}
          disabled={!hasChildren}
          aria-label={hasChildren ? (isExpanded ? 'Collapse node' : 'Expand node') : 'Leaf node'}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
        </button>
        <span>{getPathTail(node.path)}</span>
        <span style={{ color: '#64748b' }}>({typeText})</span>
      </div>
    );

    if (!hasChildren || !isExpanded) return [row];
    const descendants = children.flatMap(child => renderXsdTreeNode(child, pane, depth + 1));
    return [row, ...descendants];
  }

  function openMapping(mapping) {
    setEditingId(String(mapping.id || ''));
    setName(String(mapping.name || ''));
    setSourceTypeId(String(mapping.sourceTypeId || '').toLowerCase());
    setTargetTypeId(String(mapping.targetTypeId || '').toLowerCase());
    setSourceSchemaPath(String(mapping.sourceSchemaPath || ''));
    setTargetSchemaPath(String(mapping.targetSchemaPath || ''));
    setItems(Array.isArray(mapping.items) ? mapping.items : []);
    setStatus(`Opened mapping: ${mappingTitle(mapping)}`);
  }

  function onSourceDragStart(event, sourceNode) {
    event.dataTransfer.setData('application/json', JSON.stringify(sourceNode));
    event.dataTransfer.effectAllowed = 'copy';
  }

  function onTargetDrop(event, targetNode) {
    event.preventDefault();
    try {
      const payloadRaw = event.dataTransfer.getData('application/json');
      if (!payloadRaw) return;
      const sourceNode = JSON.parse(payloadRaw);
      if (!isCompatible(sourceNode, targetNode)) {
        setStatus(`Incompatible mapping: ${sourceNode.path} -> ${targetNode.path}`);
        return;
      }

      const nextItem = {
        sourcePath: sourceNode.path,
        targetPath: targetNode.path,
        kind: sourceNode.kind,
        sourceValueType: sourceNode.valueType,
        targetValueType: targetNode.valueType,
      };

      setItems(prev => {
        const exists = prev.some(item => item.sourcePath === nextItem.sourcePath && item.targetPath === nextItem.targetPath);
        if (exists) return prev;
        return [...prev, nextItem];
      });
    } catch {
      setStatus('Drop failed: invalid drag payload');
    }
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function saveMapping() {
    try {
      const payload = {
        id: editingId,
        name: String(name || '').trim() || `${sourceTypeId} -> ${targetTypeId}`,
        sourceTypeId,
        targetTypeId,
        sourceSchemaPath,
        targetSchemaPath,
        items,
      };
      const res = await fetch('/api/mapper/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setStatus(`Saved mapping: ${mappingTitle(data.mapping)}`);
      await loadAll();
      openMapping(data.mapping);
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 1300 }}>
      <div style={{ ...SECTION_STYLE, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setMenuOpen(prev => !prev)}>File ▾</button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 5, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, minWidth: 130, boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenDialog(true);
                    setMenuOpen(false);
                  }}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', cursor: 'pointer' }}
                >
                  Open...
                </button>
              </div>
            )}
          </div>

          <h3 style={{ margin: 0 }}>Data Mapper Drag and Drop</h3>
        </div>

        <p style={{ marginTop: 0, fontSize: 12, color: '#5a6470' }}>
          Use File &gt; Open, then drag source nodes from the left panel and drop them on destination nodes in the right panel.
        </p>

        {status && (
          <div style={{ marginBottom: 10, fontSize: 12, background: '#f5f5f5', borderRadius: 4, padding: '6px 10px' }}>
            {status}
          </div>
        )}

        {!!editingId && (
          <div style={{ marginBottom: 10, fontSize: 12, border: '1px solid #d8e0ea', borderRadius: 6, padding: '8px 10px', background: '#f8fbff' }}>
            <div><strong>Opened Map:</strong> {name || editingId}</div>
            <div><strong>Source:</strong> {sourceTypeId} | {sourceSchemaPath} {sourceSchema ? '' : '(schema not resolved)'}</div>
            <div><strong>Destination:</strong> {targetTypeId} | {targetSchemaPath} {targetSchema ? '' : '(schema not resolved)'}</div>
            <div><strong>Links In Map:</strong> {items.length}</div>
          </div>
        )}

        {!editorReady && (
          <div style={{ border: '1px dashed #9ca3af', borderRadius: 8, padding: 22, background: '#fbfcff', color: '#4b5563' }}>
            Open a mapping to launch the drag-and-drop screen.
          </div>
        )}

        {editorReady && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#334155' }}>
                <strong>{name || editingId}</strong> | {sourceTypeId}{' -> '}{targetTypeId}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setItems([])}>Clear Links</button>
                <button type="button" onClick={saveMapping} disabled={items.length === 0}>Save</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Source</div>
                <div style={PANEL_STYLE}>
                  {sourceIsXsd
                    ? sourceRoots.flatMap(node => renderXsdTreeNode(node, 'source', 0))
                    : sourceNodes.map((node, index) => {
                      const isLinked = linkedSourcePaths.has(node.path);
                      const displayPath = labelForPath(node.path, sourceMtFieldDefs);
                      return (
                        <div
                          key={`src:${index}:${node.path}`}
                          draggable
                          onDragStart={event => onSourceDragStart(event, node)}
                          style={{
                            marginLeft: node.depth * 14,
                            padding: '4px 8px',
                            cursor: 'grab',
                            borderBottom: '1px solid #eef2f7',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: isLinked ? '#fff6e8' : '#fff',
                          }}
                          title="Drag to destination"
                        >
                          <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                          <span>{displayPath}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Destination</div>
                <div style={PANEL_STYLE}>
                  {targetIsXsd
                    ? targetRoots.flatMap(node => renderXsdTreeNode(node, 'target', 0))
                    : targetNodes.map((node, index) => {
                      const isLinked = linkedTargetPaths.has(node.path);
                      const displayPath = labelForPath(node.path, targetMtFieldDefs);
                      return (
                        <div
                          key={`dst:${index}:${node.path}`}
                          onDragOver={event => event.preventDefault()}
                          onDrop={event => onTargetDrop(event, node)}
                          style={{
                            marginLeft: node.depth * 14,
                            padding: '4px 8px',
                            borderBottom: '1px solid #eef2f7',
                            fontSize: 12,
                            cursor: 'default',
                            background: isLinked ? '#eaf8ef' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                          title="Drop source node here"
                        >
                          <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                          <span>{displayPath}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, border: '1px solid #dce3eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '8px 10px', background: '#f7f9fc', fontSize: 12, fontWeight: 600 }}>
                <div>Link (Source {'->'} Destination)</div>
                <div>Action</div>
              </div>
              {items.map((item, index) => (
                <div key={`item:${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '8px 10px', borderTop: '1px solid #edf2f7', fontSize: 12, alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Consolas, monospace' }}>
                    {labelForPath(item.sourcePath, sourceMtFieldDefs)} {'->'} {labelForPath(item.targetPath, targetMtFieldDefs)}
                  </div>
                  <button type="button" onClick={() => removeItem(index)}>Remove</button>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>No links yet. Drag from source and drop on destination.</div>
              )}
            </div>
          </>
        )}
      </div>

      {openDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ width: 'min(760px, 92vw)', maxHeight: '80vh', overflow: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #d4dbe3', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Open Mapping</strong>
              <button type="button" onClick={() => setOpenDialog(false)}>Close</button>
            </div>

            {mappings.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>No saved mappings found.</div>}
            {mappings.length > 0 && mappings
              .slice()
              .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
              .map(mapping => (
                <div key={mapping.id} style={{ border: '1px solid #e3e8ef', borderRadius: 6, marginBottom: 8, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{mappingTitle(mapping)}</div>
                    <div style={{ fontSize: 12, color: '#667085' }}>{mapping.sourceTypeId}{' -> '}{mapping.targetTypeId}</div>
                    <div style={{ fontSize: 11, color: '#788292' }}>{mapping.sourceSchemaPath}{' -> '}{mapping.targetSchemaPath}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      openMapping(mapping);
                      setOpenDialog(false);
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
