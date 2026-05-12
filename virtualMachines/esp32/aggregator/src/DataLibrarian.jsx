import React, { useEffect, useMemo, useRef, useState } from 'react';

const SECTION_STYLE = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

export default function DataLibrarian() {
  const [dataTypes, setDataTypes] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [msg, setMsg] = useState('');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [treeExpanded, setTreeExpanded] = useState({ types: true, untyped: true });
  const [itemExpanded, setItemExpanded] = useState({});
  const [lifecycleDrafts, setLifecycleDrafts] = useState({});

  function toLocalDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function loadAll() {
    try {
      const [typesRes, schemasRes] = await Promise.all([
        fetch('/api/librarian/data-types'),
        fetch('/api/librarian/schemas'),
      ]);
      if (typesRes.ok) {
        const typePayload = await typesRes.json();
        setDataTypes(Array.isArray(typePayload.types) ? typePayload.types : []);
      }
      if (schemasRes.ok) {
        const d = await schemasRes.json();
        const nextSchemas = d.schemas || [];
        setSchemas(nextSchemas);
        setLifecycleDrafts(prev => {
          const next = { ...prev };
          for (const item of nextSchemas) {
            if (!next[item.path]) {
              next[item.path] = {
                activeFrom: toLocalDateTimeInput(item.lifecycle?.activeFrom),
                rejectAfter: toLocalDateTimeInput(item.lifecycle?.rejectAfter),
                keepForDisplay: item.lifecycle?.keepForDisplay !== false,
              };
            }
          }
          return next;
        });
      }
    } catch (e) {
      setMsg(`Load failed: ${e.message}`);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      loadAll();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const [menuOpen, setMenuOpen] = useState(null);
  const [submenuOpen, setSubmenuOpen] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const schemaInputRef = useRef(null);
  const copybookInputRef = useRef(null);

  function openMenu(name) {
    setMenuOpen(prev => prev === name ? null : name);
    setSubmenuOpen(null);
  }

  function closeMenus() {
    setMenuOpen(null);
    setSubmenuOpen(null);
  }

  async function uploadFiles(files, dest) {
    if (!files.length) return;
    setImporting(true);
    setImportMsg('');
    closeMenus();
    const results = [];
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const res = await fetch(`/api/librarian/upload/${dest}`, {
          method: 'POST',
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-filename': file.name,
          },
          body: buffer,
        });
        const data = await res.json();
        results.push(res.ok ? `✓ ${file.name} (${data.size} B)` : `✗ ${file.name}: ${data.error}`);
      } catch (err) {
        results.push(`✗ ${file.name}: ${err.message}`);
      }
    }
    setImportMsg(results.join('\n'));
    setImporting(false);
    await loadAll();
  }

  async function createDataType() {
    closeMenus();
    const idInput = window.prompt('New type ID:', 'customer-order');
    if (idInput === null) return;
    const id = idInput.trim().toLowerCase();
    if (!id) {
      setMsg('New type cancelled: type ID is required.');
      return;
    }

    const defaultLabel = id
      .split(/[-_]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const labelInput = window.prompt('Display label:', defaultLabel || id);
    if (labelInput === null) return;
    const label = labelInput.trim();
    if (!label) {
      setMsg('New type cancelled: display label is required.');
      return;
    }

    try {
      const res = await fetch('/api/librarian/data-types', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Create type failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Type created: ${data.type.id} (${data.type.label})`);
      await loadAll();
    } catch (e) {
      setMsg(`Create type failed: ${e.message}`);
    }
  }

  async function createTypeFromSchema(schema) {
    const inferredId = String(schema?.typeId || schema?.name || '').trim().toLowerCase();
    if (!inferredId) {
      setMsg('Create type cancelled: no schema type ID could be inferred.');
      return;
    }

    const defaultLabel = inferredId
      .split(/[-_]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    try {
      const res = await fetch('/api/librarian/data-types', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: inferredId, label: defaultLabel || inferredId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Create type from schema failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Type created from schema: ${data.type.id} (${data.type.label})`);
      await loadAll();
    } catch (e) {
      setMsg(`Create type from schema failed: ${e.message}`);
    }
  }

  function setDraftValue(path, key, value) {
    setLifecycleDrafts(prev => ({
      ...prev,
      [path]: {
        activeFrom: prev[path]?.activeFrom || '',
        rejectAfter: prev[path]?.rejectAfter || '',
        keepForDisplay: prev[path]?.keepForDisplay !== false,
        [key]: value,
      },
    }));
  }

  async function saveLifecycle(item) {
    const draft = lifecycleDrafts[item.path] || { activeFrom: '', rejectAfter: '', keepForDisplay: true };
    try {
      const res = await fetch('/api/librarian/schema-lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: item.path,
          activeFrom: draft.activeFrom || null,
          rejectAfter: draft.rejectAfter || null,
          keepForDisplay: draft.keepForDisplay !== false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Lifecycle save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Lifecycle updated for ${item.name}`);
      await loadAll();
    } catch (e) {
      setMsg(`Lifecycle save failed: ${e.message}`);
    }
  }

  function getLifecycleBadge(item) {
    const lifecycle = item.lifecycle || {};
    const status = lifecycle.status || 'active';
    const now = Date.now();
    const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
    const rejectAfterMs = lifecycle.rejectAfter ? Date.parse(lifecycle.rejectAfter) : NaN;
    const isExpiringSoon = Number.isFinite(rejectAfterMs) && rejectAfterMs > now && (rejectAfterMs - now) <= threeMonthsMs;

    if (status === 'rejected') {
      return {
        label: 'no longer used',
        style: { background: '#fde2e2', color: '#9f1d1d' },
      };
    }
    if (isExpiringSoon) {
      return {
        label: 'expiring within 3 months',
        style: { background: '#fff6db', color: '#8a5a00' },
      };
    }
    if (status === 'active') {
      return {
        label: 'active',
        style: { background: '#dff5e1', color: '#1d6b2a' },
      };
    }
    return {
      label: status,
      style: { background: '#eef2ff', color: '#2f3b8f' },
    };
  }

  const filteredSchemas = useMemo(() => schemas.filter(s =>
    !schemaSearch ||
    s.name.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    s.type.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    String(s.typeId || '').toLowerCase().includes(schemaSearch.toLowerCase())
  ), [schemas, schemaSearch]);

  const filteredTypes = useMemo(
    () => dataTypes
      .filter(t =>
        !schemaSearch ||
        String(t.id || '').toLowerCase().includes(schemaSearch.toLowerCase()) ||
        String(t.label || '').toLowerCase().includes(schemaSearch.toLowerCase())
      )
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''))),
    [dataTypes, schemaSearch]
  );

  const typeTreeItems = useMemo(() => {
    const itemById = new Map();
    for (const typeItem of filteredTypes) {
      const id = String(typeItem.id || '').trim();
      if (!id) continue;
      itemById.set(id, {
        ...typeItem,
        id,
        formats: filteredSchemas
          .filter(schema => String(schema.typeId || schema.name) === id)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      });
    }

    const childrenByParentId = new Map();
    const rootIds = [];
    for (const item of itemById.values()) {
      const candidateParentIds = [];
      if (item.parentTypeId) candidateParentIds.push(String(item.parentTypeId));
      if (item.categoryId && item.categoryId !== item.id) candidateParentIds.push(String(item.categoryId));
      const parentId = candidateParentIds.find(parent => itemById.has(parent));

      if (!parentId) {
        rootIds.push(item.id);
        continue;
      }
      if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
      childrenByParentId.get(parentId).push(item.id);
    }

    for (const [parentId, childIds] of childrenByParentId.entries()) {
      childrenByParentId.set(parentId, childIds.sort((a, b) => a.localeCompare(b)));
    }

    const sortedRootIds = rootIds.sort((a, b) => a.localeCompare(b));
    const flattened = [];

    function visit(id, depth, ancestors) {
      const item = itemById.get(id);
      if (!item) return;
      const childIds = childrenByParentId.get(id) || [];
      flattened.push({
        ...item,
        depth,
        ancestors,
        hasChildren: childIds.length > 0,
      });
      for (const childId of childIds) {
        visit(childId, depth + 1, [...ancestors, id]);
      }
    }

    for (const rootId of sortedRootIds) {
      visit(rootId, 0, []);
    }

    return flattened;
  }, [filteredTypes, filteredSchemas]);

  const visibleTypeTreeItems = useMemo(() => {
    return typeTreeItems.filter(item => item.ancestors.every(ancestorId => itemExpanded[`type:${ancestorId}`]));
  }, [typeTreeItems, itemExpanded]);

  const untypedSchemas = useMemo(() => {
    const knownTypeIds = new Set(filteredTypes.map(item => String(item.id || '').trim().toLowerCase()).filter(Boolean));
    return filteredSchemas
      .filter(schema => !knownTypeIds.has(String(schema.typeId || schema.name || '').trim().toLowerCase()))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [filteredSchemas, filteredTypes]);

  function summarizeStructure(node) {
    if (!node) return 'Structure unavailable.';

    let branchCount = 0;
    let leafCount = 0;
    const names = [];

    function visit(current, depth = 0) {
      const children = Array.isArray(current.children) ? current.children : [];
      if (depth > 0) {
        names.push(current.name);
      }
      if (children.length > 0) {
        branchCount += 1;
        children.forEach(child => visit(child, depth + 1));
      } else if (depth > 0) {
        leafCount += 1;
      }
    }

    visit(node, 0);
    const preview = names.slice(0, 8).join(', ');
    return `Structure contains ${branchCount} branch${branchCount === 1 ? '' : 'es'} and ${leafCount} leaf${leafCount === 1 ? '' : 's'}. ${preview ? `Fields include ${preview}.` : ''}`.trim();
  }

  function speakStructure(item) {
    const structure = item?.structure;
    if (!structure) {
      setMsg(`No structure available to speak for ${item?.name || 'this format'}.`);
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setMsg('Speech synthesis is not available in this browser.');
      return;
    }

    const summary = summarizeStructure(structure);
    const utterance = new window.SpeechSynthesisUtterance(`${item.name}. ${summary}`);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setMsg(`Speaking summary for ${item.name}.`);
  }

  function renderStructureNode(node, keyPrefix = 'node') {
    if (!node) return null;
    const children = Array.isArray(node.children) ? node.children : [];
    const enumValues = Array.isArray(node.enumValues) ? node.enumValues : [];
    return (
      <li key={`${keyPrefix}:${node.name}`} style={{ marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 4px', flexWrap: 'wrap' }} aria-label={`${node.name}, ${children.length > 0 ? 'branch' : 'leaf'}, ${node.valueType || 'unknown'}${enumValues.length > 0 ? `, enum ${enumValues.join(', ')}` : ''}`}>
          <span style={{ width: 12, color: '#5a6b7b' }}>{children.length > 0 ? '▸' : '•'}</span>
          <span>{children.length > 0 ? '🌿' : '🍃'}</span>
          <span style={{ fontSize: 12 }}>{node.name}</span>
          <span style={{ fontSize: 10, color: '#777' }}>{node.valueType || 'unknown'}</span>
          {enumValues.length > 0 && (
            <span style={{ fontSize: 10, color: '#8a5a00' }}>enum: {enumValues.join(', ')}</span>
          )}
        </div>
        {children.length > 0 && (
          <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
            {children.map((child, index) => renderStructureNode(child, `${keyPrefix}:${node.name}:${index}`))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div style={{ maxWidth: 860 }} onClick={closeMenus}>

      {/* Hidden file inputs */}
      <input ref={schemaInputRef} type="file" multiple accept=".xsd,.avro,.json,.json-schema,.proto,.sql,.xml,.csv" style={{ display: 'none' }}
        onChange={e => { uploadFiles(Array.from(e.target.files), 'schemas'); e.target.value = ''; }} />
      <input ref={copybookInputRef} type="file" multiple accept=".copybook,.cpy,.cbl" style={{ display: 'none' }}
        onChange={e => { uploadFiles(Array.from(e.target.files), 'schemas'); e.target.value = ''; }} />

      {/* Menu bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f3f4f6', borderBottom: '1px solid #ddd', marginBottom: 16, padding: '0 4px', userSelect: 'none', position: 'relative' }}>
        {/* File menu */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openMenu('file')}
            style={{ background: menuOpen === 'file' ? '#dbeafe' : 'none', border: 'none', padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4 }}
          >
            File
          </button>
          {menuOpen === 'file' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 200 }}>
              <button
                onClick={createDataType}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                New Type…
              </button>
              {/* Import submenu trigger */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setSubmenuOpen('import')}
                onMouseLeave={() => setSubmenuOpen(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', fontSize: 13, cursor: 'default', background: submenuOpen === 'import' ? '#f0f4ff' : 'transparent' }}>
                  <span>Import</span>
                  <span style={{ fontSize: 10, color: '#888' }}>▸</span>
                </div>
                {submenuOpen === 'import' && (
                  <div style={{ position: 'absolute', top: 0, left: '100%', background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 201 }}>
                    <button
                      disabled={importing}
                      onClick={() => { closeMenus(); schemaInputRef.current.click(); }}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                    >
                      Schema…
                    </button>
                    <button
                      disabled={importing}
                      onClick={() => { closeMenus(); copybookInputRef.current.click(); }}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                    >
                      Copybook…
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <span style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12, color: importing ? '#1d6b2a' : '#555' }}>
          {importing ? 'Importing…' : 'Data Librarian'}
        </span>
      </div>

      {importMsg && (
        <pre aria-live="polite" style={{ fontSize: 12, color: '#444', background: '#f5f5f5', borderRadius: 4, padding: '8px 12px', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          {importMsg}
        </pre>
      )}

      {msg && (
        <div aria-live="polite" style={{ fontSize: 12, color: '#444', marginBottom: 12, padding: '6px 10px', background: '#f5f5f5', borderRadius: 4 }}>
          {msg}
        </div>
      )}

      {/* Data Librarian Tree */}
      <div style={SECTION_STYLE}>
        <h3 style={{ marginTop: 0 }}>Data Librarian</h3>
        <input
          value={schemaSearch}
          onChange={e => setSchemaSearch(e.target.value)}
          placeholder="Search by name or type…"
          style={{ marginBottom: 10, minWidth: 240 }}
        />
        <p style={{ fontSize: 12, color: '#666', marginTop: 0 }}>
          Types are the primary contract. Each type can have zero or more attached formats, and each format can expose a browsable field structure.
        </p>
        {untypedSchemas.length > 0 && (
          <p style={{ fontSize: 12, color: '#8a5a00', marginTop: 0 }}>
            {untypedSchemas.length} schema file(s) are currently untyped and listed under the Schemas folder below.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#555', marginBottom: 10 }}>
          <span style={{ padding: '2px 8px', borderRadius: 12, background: '#dff5e1', color: '#1d6b2a' }}>active</span>
          <span style={{ padding: '2px 8px', borderRadius: 12, background: '#fff6db', color: '#8a5a00' }}>expiring within 3 months</span>
          <span style={{ padding: '2px 8px', borderRadius: 12, background: '#fde2e2', color: '#9f1d1d' }}>no longer used</span>
        </div>

        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <div
                onClick={() => setTreeExpanded(prev => ({ ...prev, types: !prev.types }))}
                style={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ width: 12, color: '#5a6b7b' }}>{treeExpanded.types ? '▾' : '▸'}</span>
                <span>📁 Types</span>
                <span style={{ fontSize: 11, color: '#777' }}>{filteredTypes.length}</span>
              </div>
              {treeExpanded.types && (
                <ul style={{ listStyle: 'none', paddingLeft: 20, borderLeft: '1px solid #dfe6eb', marginLeft: 10, marginTop: 2 }}>
                  {visibleTypeTreeItems.map(item => {
                    const expandable = item.hasChildren || item.formats.length > 0;
                    return (
                    <li key={item.id} style={{ marginBottom: 4, paddingLeft: 6 + (item.depth * 16) }}>
                      <div
                        onClick={() => setItemExpanded(prev => ({ ...prev, [`type:${item.id}`]: !prev[`type:${item.id}`] }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          padding: '2px 4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <span style={{ width: 12, color: '#5a6b7b' }}>{expandable ? (itemExpanded[`type:${item.id}`] ? '▾' : '▸') : '•'}</span>
                        <span style={{ marginRight: 1 }}>{item.kind === 'category' ? '🗂️' : '🏷️'}</span>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{item.id}</span>
                        <span style={{ fontSize: 11, color: '#777' }}>{item.label}</span>
                        <span style={{ fontSize: 10, color: '#777' }}>{item.formats.length} format(s)</span>
                        <span style={{ fontSize: 10, borderRadius: 12, padding: '2px 8px', background: item.builtin ? '#eef2ff' : '#eaf7ee', color: item.builtin ? '#2f3b8f' : '#1d6b2a' }}>
                          {item.kind === 'category' ? 'category' : (item.builtin ? 'built-in' : 'forward defined')}
                        </span>
                      </div>
                      {itemExpanded[`type:${item.id}`] && (
                        <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
                          {item.formats.map(format => {
                            const draft = lifecycleDrafts[format.path] || { activeFrom: '', rejectAfter: '', keepForDisplay: true };
                            const badge = getLifecycleBadge(format);
                            return (
                              <li key={format.path} style={{ marginBottom: 4 }}>
                                <div
                                  onClick={() => setItemExpanded(prev => ({ ...prev, [format.path]: !prev[format.path] }))}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 4px', borderRadius: 4, cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <span style={{ width: 12, color: '#5a6b7b' }}>{itemExpanded[format.path] ? '▾' : '▸'}</span>
                                  <span>{format.type === 'copybook' ? '📘' : '📄'}</span>
                                  <span style={{ fontWeight: 600, fontSize: 12 }}>{format.name}</span>
                                  <span style={{ fontSize: 11, color: '#777' }}>{format.type}</span>
                                  <span style={{ fontSize: 10, color: '#555' }}>v{format.version ?? '-'}</span>
                                  <span style={{ fontSize: 10, color: '#555' }}>{format.size} B</span>
                                  <span style={{ fontSize: 10, borderRadius: 12, padding: '2px 8px', ...badge.style }}>{badge.label}</span>
                                </div>
                                {itemExpanded[format.path] && (
                                  <div style={{ marginTop: 4, marginLeft: 20, display: 'grid', gap: 8 }}>
                                    {format.structure && (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <div style={{ fontSize: 12, color: '#444' }}>Message Structure</div>
                                          <button type="button" onClick={() => speakStructure(format)} style={{ fontSize: 11 }}>
                                            Speak summary
                                          </button>
                                        </div>
                                        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                                          {renderStructureNode(format.structure, format.path)}
                                        </ul>
                                      </div>
                                    )}
                                    {!format.structure && (
                                      <div style={{ fontSize: 12, color: '#777' }}>Structure preview unavailable for this format type.</div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                                      <label style={{ fontSize: 12, color: '#444' }}>
                                        Active From
                                        <input
                                          type="datetime-local"
                                          value={draft.activeFrom}
                                          onChange={e => setDraftValue(format.path, 'activeFrom', e.target.value)}
                                          style={{ display: 'block', width: '100%' }}
                                        />
                                      </label>
                                      <label style={{ fontSize: 12, color: '#444' }}>
                                        Reject After
                                        <input
                                          type="datetime-local"
                                          value={draft.rejectAfter}
                                          onChange={e => setDraftValue(format.path, 'rejectAfter', e.target.value)}
                                          style={{ display: 'block', width: '100%' }}
                                        />
                                      </label>
                                      <label style={{ fontSize: 12, color: '#444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                          type="checkbox"
                                          checked={draft.keepForDisplay !== false}
                                          onChange={e => setDraftValue(format.path, 'keepForDisplay', e.target.checked)}
                                        />
                                        Keep for historical display
                                      </label>
                                      <div>
                                        <button type="button" onClick={() => saveLifecycle(format)} style={{ marginTop: 18 }}>
                                          Save Lifecycle
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                          {item.formats.length === 0 && !item.hasChildren && <li style={{ fontSize: 12, color: '#888', paddingLeft: 4 }}>No attached formats yet.</li>}
                        </ul>
                      )}
                    </li>
                  );})}
                  {filteredTypes.length === 0 && <li style={{ fontSize: 12, color: '#888' }}>No type definitions.</li>}
                </ul>
              )}
            </li>

            <li style={{ marginBottom: 8 }}>
              <div
                onClick={() => setTreeExpanded(prev => ({ ...prev, untyped: !prev.untyped }))}
                style={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ width: 12, color: '#5a6b7b' }}>{treeExpanded.untyped ? '▾' : '▸'}</span>
                <span>📁 Schemas</span>
                <span style={{ fontSize: 11, color: '#777' }}>{untypedSchemas.length}</span>
              </div>
              {treeExpanded.untyped && (
                <ul style={{ listStyle: 'none', paddingLeft: 20, borderLeft: '1px solid #dfe6eb', marginLeft: 10, marginTop: 2 }}>
                  {untypedSchemas.map(schema => (
                    <li key={`untyped:${schema.path}`} style={{ marginBottom: 4, paddingLeft: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 4px', borderRadius: 4 }}>
                        <span style={{ width: 12, color: '#5a6b7b' }}>•</span>
                        <span>{schema.type === 'copybook' ? '📘' : '📄'}</span>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{schema.name}</span>
                        <span style={{ fontSize: 11, color: '#777' }}>{schema.type}</span>
                        <span style={{ fontSize: 10, color: '#555' }}>v{schema.version ?? '-'}</span>
                        <span style={{ fontSize: 10, color: '#555' }}>{schema.size} B</span>
                        <span style={{ fontSize: 10, color: '#777' }}>typeId: {schema.typeId || schema.name}</span>
                        <button type="button" onClick={() => createTypeFromSchema(schema)} style={{ fontSize: 11 }}>
                          Create Type
                        </button>
                      </div>
                    </li>
                  ))}
                  {untypedSchemas.length === 0 && <li style={{ fontSize: 12, color: '#888' }}>No untyped schemas.</li>}
                </ul>
              )}
            </li>
          </ul>
      </div>
    </div>
  );
}
