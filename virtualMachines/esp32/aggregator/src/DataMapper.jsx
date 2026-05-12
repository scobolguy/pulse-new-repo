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

  const sourceSchema = useMemo(() => schemasByPath.get(sourceSchemaPath) || null, [schemasByPath, sourceSchemaPath]);
  const targetSchema = useMemo(() => schemasByPath.get(targetSchemaPath) || null, [schemasByPath, targetSchemaPath]);

  const sourceNodes = useMemo(() => flattenStructure(sourceSchema?.structure), [sourceSchema]);
  const targetNodes = useMemo(() => flattenStructure(targetSchema?.structure), [targetSchema]);

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
                  {sourceNodes.map(node => (
                    <div
                      key={`src:${node.path}`}
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
                      }}
                      title="Drag to destination"
                    >
                      <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                      <span>{node.path}</span>
                      <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{node.valueType}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Destination</div>
                <div style={PANEL_STYLE}>
                  {targetNodes.map(node => {
                    const dragNode = sourceNodes.find(sourceNode => isCompatible(sourceNode, node));
                    return (
                      <div
                        key={`dst:${node.path}`}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => onTargetDrop(event, node)}
                        style={{
                          marginLeft: node.depth * 14,
                          padding: '4px 8px',
                          borderBottom: '1px solid #eef2f7',
                          fontSize: 12,
                          background: dragNode ? '#fff' : '#f7f8fa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                        title="Drop source node here"
                      >
                        <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                        <span>{node.path}</span>
                        <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{node.valueType}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, border: '1px solid #dce3eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 0.8fr 0.8fr 0.8fr auto', gap: 8, padding: '8px 10px', background: '#f7f9fc', fontSize: 12, fontWeight: 600 }}>
                <div>Source Path</div>
                <div>Target Path</div>
                <div>Kind</div>
                <div>Source Type</div>
                <div>Target Type</div>
                <div>Action</div>
              </div>
              {items.map((item, index) => (
                <div key={`item:${index}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 0.8fr 0.8fr 0.8fr auto', gap: 8, padding: '8px 10px', borderTop: '1px solid #edf2f7', fontSize: 12, alignItems: 'center' }}>
                  <div>{item.sourcePath}</div>
                  <div>{item.targetPath}</div>
                  <div>{item.kind}</div>
                  <div>{item.sourceValueType}</div>
                  <div>{item.targetValueType}</div>
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
