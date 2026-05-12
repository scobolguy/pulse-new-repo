import React, { useEffect, useMemo, useState } from 'react';

const SECTION_STYLE = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

function flattenStructure(node, prefix = '') {
  if (!node) return [];
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) return [];

  const list = [];
  for (const child of children) {
    const childPath = prefix ? `${prefix}.${child.name}` : String(child.name || '');
    const kind = child.kind === 'branch' ? 'branch' : 'leaf';
    const valueType = String(child.valueType || 'unknown').toLowerCase();
    list.push({ path: childPath, kind, valueType });
    if (kind === 'branch') {
      list.push(...flattenStructure(child, childPath));
    }
  }
  return list;
}

function isCompatible(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.kind !== targetNode.kind) return false;

  if (sourceNode.kind === 'branch') {
    return true;
  }

  if (sourceNode.valueType === targetNode.valueType) return true;
  if (sourceNode.valueType === 'unknown' || targetNode.valueType === 'unknown') return true;
  return false;
}

function buildDefaultName(sourceTypeId, targetTypeId) {
  if (!sourceTypeId || !targetTypeId) return '';
  return `${sourceTypeId} to ${targetTypeId}`;
}

export default function DataMapper() {
  const [dataTypes, setDataTypes] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [sourceTypeId, setSourceTypeId] = useState('');
  const [targetTypeId, setTargetTypeId] = useState('');
  const [sourceSchemaPath, setSourceSchemaPath] = useState('');
  const [targetSchemaPath, setTargetSchemaPath] = useState('');
  const [items, setItems] = useState([]);

  async function loadAll() {
    try {
      const [typesRes, schemasRes, mappingsRes] = await Promise.all([
        fetch('/api/librarian/data-types'),
        fetch('/api/librarian/schemas'),
        fetch('/api/mapper/mappings'),
      ]);

      const nextTypes = typesRes.ok ? ((await typesRes.json()).types || []) : [];
      const nextSchemas = schemasRes.ok ? ((await schemasRes.json()).schemas || []) : [];
      const nextMappings = mappingsRes.ok ? ((await mappingsRes.json()).mappings || []) : [];

      setDataTypes(Array.isArray(nextTypes) ? nextTypes : []);
      setSchemas(Array.isArray(nextSchemas) ? nextSchemas : []);
      setMappings(Array.isArray(nextMappings) ? nextMappings : []);
    } catch (e) {
      setMsg(`Load failed: ${e.message}`);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const schemasByType = useMemo(() => {
    const map = new Map();
    for (const schema of schemas) {
      const key = String(schema.typeId || schema.name || '').trim().toLowerCase();
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(schema);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return map;
  }, [schemas]);

  const sourceSchemas = useMemo(() => schemasByType.get(sourceTypeId) || [], [schemasByType, sourceTypeId]);
  const targetSchemas = useMemo(() => schemasByType.get(targetTypeId) || [], [schemasByType, targetTypeId]);

  useEffect(() => {
    if (!sourceSchemas.find(s => s.path === sourceSchemaPath)) {
      setSourceSchemaPath(sourceSchemas[0]?.path || '');
    }
  }, [sourceSchemas, sourceSchemaPath]);

  useEffect(() => {
    if (!targetSchemas.find(s => s.path === targetSchemaPath)) {
      setTargetSchemaPath(targetSchemas[0]?.path || '');
    }
  }, [targetSchemas, targetSchemaPath]);

  useEffect(() => {
    if (!name && sourceTypeId && targetTypeId) {
      setName(buildDefaultName(sourceTypeId, targetTypeId));
    }
  }, [name, sourceTypeId, targetTypeId]);

  const sourceSchema = useMemo(() => sourceSchemas.find(s => s.path === sourceSchemaPath) || null, [sourceSchemas, sourceSchemaPath]);
  const targetSchema = useMemo(() => targetSchemas.find(s => s.path === targetSchemaPath) || null, [targetSchemas, targetSchemaPath]);

  const sourceNodes = useMemo(() => flattenStructure(sourceSchema?.structure), [sourceSchema]);
  const targetNodes = useMemo(() => flattenStructure(targetSchema?.structure), [targetSchema]);

  const sourceNodeByPath = useMemo(() => {
    const m = new Map();
    for (const n of sourceNodes) m.set(n.path, n);
    return m;
  }, [sourceNodes]);

  const targetNodeByPath = useMemo(() => {
    const m = new Map();
    for (const n of targetNodes) m.set(n.path, n);
    return m;
  }, [targetNodes]);

  function addItem() {
    setItems(prev => [...prev, {
      sourcePath: '',
      targetPath: '',
      kind: 'leaf',
      sourceValueType: 'unknown',
      targetValueType: 'unknown',
    }]);
  }

  function updateItem(index, patch) {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function autoMapBySamePath() {
    const next = [];
    for (const sourceNode of sourceNodes) {
      const targetNode = targetNodeByPath.get(sourceNode.path);
      if (!targetNode) continue;
      if (!isCompatible(sourceNode, targetNode)) continue;
      next.push({
        sourcePath: sourceNode.path,
        targetPath: targetNode.path,
        kind: sourceNode.kind,
        sourceValueType: sourceNode.valueType,
        targetValueType: targetNode.valueType,
      });
    }
    setItems(next);
    setMsg(`Auto-map created ${next.length} compatible item(s).`);
  }

  function clearForm() {
    setEditingId('');
    setName('');
    setSourceTypeId('');
    setTargetTypeId('');
    setSourceSchemaPath('');
    setTargetSchemaPath('');
    setItems([]);
  }

  function openMapping(mapping) {
    setEditingId(mapping.id || '');
    setName(mapping.name || '');
    setSourceTypeId(String(mapping.sourceTypeId || '').toLowerCase());
    setTargetTypeId(String(mapping.targetTypeId || '').toLowerCase());
    setSourceSchemaPath(mapping.sourceSchemaPath || '');
    setTargetSchemaPath(mapping.targetSchemaPath || '');
    setItems(Array.isArray(mapping.items) ? mapping.items : []);
  }

  async function saveMapping() {
    try {
      const payload = {
        id: editingId || undefined,
        name: String(name || '').trim() || buildDefaultName(sourceTypeId, targetTypeId),
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
        setMsg(`Save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Mapping ${data.status}: ${data.mapping.name}`);
      await loadAll();
      openMapping(data.mapping);
    } catch (e) {
      setMsg(`Save failed: ${e.message}`);
    }
  }

  async function deleteMapping(mappingId) {
    if (!window.confirm(`Delete mapping ${mappingId}?`)) return;
    try {
      const res = await fetch(`/api/mapper/mappings/${encodeURIComponent(mappingId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Delete failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Mapping deleted: ${mappingId}`);
      await loadAll();
      if (editingId === mappingId) clearForm();
    } catch (e) {
      setMsg(`Delete failed: ${e.message}`);
    }
  }

  const typeOptions = useMemo(() => {
    return [...dataTypes]
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
      .map(t => ({ id: String(t.id || '').toLowerCase(), label: t.label || t.id }));
  }, [dataTypes]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={SECTION_STYLE}>
        <h3 style={{ marginTop: 0 }}>Data Mapper</h3>
        <p style={{ marginTop: 0, fontSize: 12, color: '#666' }}>
          Create mappings from one Data Librarian type/schema to another. Fields and composite branches can be mapped when the shape is compatible.
        </p>
        {msg && <div style={{ marginBottom: 10, fontSize: 12, background: '#f5f5f5', borderRadius: 4, padding: '6px 10px' }}>{msg}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label style={{ fontSize: 12 }}>
            Mapping Name
            <input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%' }} placeholder="pacs to msmq" />
          </label>
          <label style={{ fontSize: 12 }}>
            Source Type
            <select value={sourceTypeId} onChange={e => setSourceTypeId(e.target.value)} style={{ display: 'block', width: '100%' }}>
              <option value="">Select source type</option>
              {typeOptions.map(t => <option key={`src:${t.id}`} value={t.id}>{t.id} — {t.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Target Type
            <select value={targetTypeId} onChange={e => setTargetTypeId(e.target.value)} style={{ display: 'block', width: '100%' }}>
              <option value="">Select target type</option>
              {typeOptions.map(t => <option key={`dst:${t.id}`} value={t.id}>{t.id} — {t.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Source Schema
            <select value={sourceSchemaPath} onChange={e => setSourceSchemaPath(e.target.value)} style={{ display: 'block', width: '100%' }}>
              <option value="">Select source schema</option>
              {sourceSchemas.map(s => <option key={`src-schema:${s.path}`} value={s.path}>{s.name} ({s.type})</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Target Schema
            <select value={targetSchemaPath} onChange={e => setTargetSchemaPath(e.target.value)} style={{ display: 'block', width: '100%' }}>
              <option value="">Select target schema</option>
              {targetSchemas.map(s => <option key={`dst-schema:${s.path}`} value={s.path}>{s.name} ({s.type})</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={addItem}>Add Mapping Item</button>
          <button type="button" onClick={autoMapBySamePath} disabled={!sourceSchema || !targetSchema}>Auto-map Same Paths</button>
          <button type="button" onClick={saveMapping} disabled={!sourceTypeId || !targetTypeId || !sourceSchemaPath || !targetSchemaPath || items.length === 0}>
            {editingId ? 'Update Mapping' : 'Create Mapping'}
          </button>
          <button type="button" onClick={clearForm}>New Mapping</button>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 0.7fr 0.7fr auto', background: '#f7f9fc', fontSize: 12, fontWeight: 600, padding: '8px 10px', gap: 8 }}>
            <div>Source Path</div>
            <div>Target Path</div>
            <div>Kind</div>
            <div>Source Type</div>
            <div>Target Type</div>
            <div>Action</div>
          </div>
          {items.map((item, index) => {
            const selectedSource = sourceNodeByPath.get(item.sourcePath) || null;
            const compatibleTargets = targetNodes.filter(targetNode => isCompatible(selectedSource, targetNode));
            const selectedTarget = targetNodeByPath.get(item.targetPath) || null;
            const rowCompatible = isCompatible(selectedSource, selectedTarget);

            return (
              <div key={`row:${index}`} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 0.7fr 0.7fr auto', gap: 8, padding: '8px 10px', borderTop: '1px solid #edf2f7', alignItems: 'center', background: rowCompatible ? '#fff' : '#fff8f0' }}>
                <select
                  value={item.sourcePath}
                  onChange={e => {
                    const node = sourceNodeByPath.get(e.target.value) || null;
                    updateItem(index, {
                      sourcePath: e.target.value,
                      kind: node?.kind || item.kind,
                      sourceValueType: node?.valueType || 'unknown',
                    });
                  }}
                >
                  <option value="">Select source path</option>
                  {sourceNodes.map(n => (
                    <option key={`src-node:${n.path}`} value={n.path}>{n.path}</option>
                  ))}
                </select>

                <select
                  value={item.targetPath}
                  onChange={e => {
                    const node = targetNodeByPath.get(e.target.value) || null;
                    updateItem(index, {
                      targetPath: e.target.value,
                      targetValueType: node?.valueType || 'unknown',
                    });
                  }}
                >
                  <option value="">Select target path</option>
                  {(selectedSource ? compatibleTargets : targetNodes).map(n => (
                    <option key={`dst-node:${n.path}`} value={n.path}>{n.path}</option>
                  ))}
                </select>

                <div style={{ fontSize: 12 }}>{item.kind}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{item.sourceValueType || 'unknown'}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{item.targetValueType || 'unknown'}</div>
                <button type="button" onClick={() => removeItem(index)}>Remove</button>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ padding: '10px', fontSize: 12, color: '#666' }}>
              No mapping items yet. Add one manually or use Auto-map Same Paths.
            </div>
          )}
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <h4 style={{ marginTop: 0 }}>Saved Mappings</h4>
        {mappings.length === 0 && <div style={{ fontSize: 12, color: '#666' }}>No mappings saved yet.</div>}
        {mappings.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {mappings
              .slice()
              .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
              .map(mapping => (
                <div key={mapping.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, background: editingId === mapping.id ? '#f8fbff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{mapping.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {mapping.sourceTypeId} → {mapping.targetTypeId} • {Array.isArray(mapping.items) ? mapping.items.length : 0} item(s)
                      </div>
                      <div style={{ fontSize: 11, color: '#777' }}>
                        {mapping.sourceSchemaPath} → {mapping.targetSchemaPath}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => openMapping(mapping)}>Edit</button>
                      <button type="button" onClick={() => deleteMapping(mapping.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
