import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const [mapperRulesets, setMapperRulesets] = useState([]);
  const [msg, setMsg] = useState('');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [treeExpanded, setTreeExpanded] = useState({ types: true, untyped: true });
  const [itemExpanded, setItemExpanded] = useState({});
  const [lifecycleDrafts, setLifecycleDrafts] = useState({});
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [contextMenu, setContextMenu] = useState(null);
  const [subschemaEditor, setSubschemaEditor] = useState(null);
  const [subschemaFieldSearch, setSubschemaFieldSearch] = useState('');

  function toLocalDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const loadAll = useCallback(async () => {
    try {
      const [typesRes, schemasRes, rulesetsRes] = await Promise.all([
        fetch('/api/librarian/data-types'),
        fetch('/api/librarian/schemas'),
        fetch('/api/librarian/mapper-rulesets'),
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
      if (rulesetsRes.ok) {
        const payload = await rulesetsRes.json();
        setMapperRulesets(Array.isArray(payload.rulesets) ? payload.rulesets : []);
      }
    } catch (e) {
      setMsg(`Load failed: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      loadAll();
      setNowTs(Date.now());
    }, 0);
    const interval = setInterval(() => {
      loadAll();
      setNowTs(Date.now());
    }, 5000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [loadAll]);

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
    setContextMenu(null);
  }

  function openContextMenu(event, kind, item) {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    setContextMenu({
      kind,
      item,
      x: event.clientX,
      y: event.clientY,
    });
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

  async function renameDataType(type) {
    closeMenus();
    const currentId = String(type?.id || '').trim();
    if (!currentId) return;
    const nextIdInput = window.prompt('Rename type ID:', currentId);
    if (nextIdInput === null) return;
    const nextId = nextIdInput.trim().toLowerCase();
    if (!nextId) {
      setMsg('Rename type cancelled: type ID is required.');
      return;
    }
    const nextLabelInput = window.prompt('Display label:', String(type?.label || nextId));
    if (nextLabelInput === null) return;
    const nextLabel = nextLabelInput.trim();

    try {
      const res = await fetch(`/api/librarian/data-types/${encodeURIComponent(currentId)}/rename`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newId: nextId, label: nextLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Rename type failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Type renamed to ${data.type.id}`);
      await loadAll();
    } catch (e) {
      setMsg(`Rename type failed: ${e.message}`);
    }
  }

  async function deleteDataType(type) {
    closeMenus();
    const currentId = String(type?.id || '').trim();
    if (!currentId) return;
    if (!window.confirm(`Delete data type "${currentId}"?`)) return;

    try {
      const res = await fetch(`/api/librarian/data-types/${encodeURIComponent(currentId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Delete type failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Type deleted: ${currentId}`);
      await loadAll();
    } catch (e) {
      setMsg(`Delete type failed: ${e.message}`);
    }
  }

  function formatPatternListForPrompt(values) {
    return Array.isArray(values) ? values.join(', ') : '';
  }

  function parsePatternListFromPrompt(value) {
    return String(value || '')
      .split(',')
      .map(part => part.trim().toLowerCase().replace(/\s+/g, ''))
      .filter(Boolean);
  }

  async function createMapperRuleset() {
    closeMenus();
    const idInput = window.prompt('Ruleset ID:', 'MY_RULESET');
    if (idInput === null) return;
    const id = idInput.trim();
    if (!id) {
      setMsg('Create ruleset cancelled: ID is required.');
      return;
    }

    const labelInput = window.prompt('Ruleset label:', id);
    if (labelInput === null) return;
    const label = labelInput.trim();
    if (!label) {
      setMsg('Create ruleset cancelled: label is required.');
      return;
    }

    const sourcePatternsInput = window.prompt('Source patterns (comma-separated):', '*');
    if (sourcePatternsInput === null) return;
    const sourcePatterns = parsePatternListFromPrompt(sourcePatternsInput);
    if (sourcePatterns.length === 0) {
      setMsg('Create ruleset cancelled: source patterns are required.');
      return;
    }

    const targetPatternsInput = window.prompt('Target patterns (comma-separated):', '*');
    if (targetPatternsInput === null) return;
    const targetPatterns = parsePatternListFromPrompt(targetPatternsInput);
    if (targetPatterns.length === 0) {
      setMsg('Create ruleset cancelled: target patterns are required.');
      return;
    }

    const descriptionInput = window.prompt('Description:', '');
    if (descriptionInput === null) return;
    const recommended = window.confirm('Mark as recommended?');
    const priorityInput = window.prompt('Priority (higher = stronger match):', '0');
    if (priorityInput === null) return;
    const priority = Number.parseInt(priorityInput.trim(), 10);

    try {
      const res = await fetch('/api/librarian/mapper-rulesets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          label,
          description: descriptionInput.trim(),
          sourcePatterns,
          targetPatterns,
          recommended,
          priority: Number.isFinite(priority) ? priority : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Create ruleset failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Ruleset created: ${data.ruleset?.id || id}`);
      await loadAll();
    } catch (e) {
      setMsg(`Create ruleset failed: ${e.message}`);
    }
  }

  async function editMapperRuleset(ruleset) {
    closeMenus();
    const currentId = String(ruleset?.id || '').trim();
    if (!currentId) return;
    const nextIdInput = window.prompt('Ruleset ID:', currentId);
    if (nextIdInput === null) return;
    const nextId = nextIdInput.trim();
    if (!nextId) {
      setMsg('Edit ruleset cancelled: ID is required.');
      return;
    }

    const nextLabelInput = window.prompt('Ruleset label:', String(ruleset?.label || currentId));
    if (nextLabelInput === null) return;
    const nextLabel = nextLabelInput.trim();
    if (!nextLabel) {
      setMsg('Edit ruleset cancelled: label is required.');
      return;
    }

    const sourcePatternsInput = window.prompt('Source patterns (comma-separated):', formatPatternListForPrompt(ruleset?.sourcePatterns));
    if (sourcePatternsInput === null) return;
    const sourcePatterns = parsePatternListFromPrompt(sourcePatternsInput);
    if (sourcePatterns.length === 0) {
      setMsg('Edit ruleset cancelled: source patterns are required.');
      return;
    }

    const targetPatternsInput = window.prompt('Target patterns (comma-separated):', formatPatternListForPrompt(ruleset?.targetPatterns));
    if (targetPatternsInput === null) return;
    const targetPatterns = parsePatternListFromPrompt(targetPatternsInput);
    if (targetPatterns.length === 0) {
      setMsg('Edit ruleset cancelled: target patterns are required.');
      return;
    }

    const nextDescriptionInput = window.prompt('Description:', String(ruleset?.description || ''));
    if (nextDescriptionInput === null) return;
    const recommended = window.confirm(`Mark as recommended?\nCurrent: ${ruleset?.recommended ? 'yes' : 'no'}`);
    const priorityInput = window.prompt('Priority (higher = stronger match):', String(ruleset?.priority ?? 0));
    if (priorityInput === null) return;
    const priority = Number.parseInt(priorityInput.trim(), 10);

    try {
      const res = await fetch(`/api/librarian/mapper-rulesets/${encodeURIComponent(currentId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: nextId,
          label: nextLabel,
          description: nextDescriptionInput.trim(),
          sourcePatterns,
          targetPatterns,
          recommended,
          priority: Number.isFinite(priority) ? priority : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Update ruleset failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Ruleset updated: ${data.ruleset?.id || currentId}`);
      await loadAll();
    } catch (e) {
      setMsg(`Update ruleset failed: ${e.message}`);
    }
  }

  async function deleteMapperRuleset(ruleset) {
    closeMenus();
    const currentId = String(ruleset?.id || '').trim();
    if (!currentId) return;
    if (!window.confirm(`Delete ruleset "${currentId}"?`)) return;

    try {
      const res = await fetch(`/api/librarian/mapper-rulesets/${encodeURIComponent(currentId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Delete ruleset failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Ruleset deleted: ${currentId}`);
      await loadAll();
    } catch (e) {
      setMsg(`Delete ruleset failed: ${e.message}`);
    }
  }

  async function renameSchema(schema) {
    closeMenus();
    const currentPath = String(schema?.path || '').trim();
    if (!currentPath) return;
    const currentName = String(schema?.name || '').trim();
    const nextNameInput = window.prompt('Rename schema file name:', currentName || currentPath);
    if (nextNameInput === null) return;
    const nextName = nextNameInput.trim();
    if (!nextName) {
      setMsg('Rename schema cancelled: file name is required.');
      return;
    }

    try {
      const res = await fetch('/api/librarian/schemas/rename', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: currentPath, newName: nextName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Rename schema failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Schema renamed to ${data.path}`);
      await loadAll();
    } catch (e) {
      setMsg(`Rename schema failed: ${e.message}`);
    }
  }

  async function deleteSchema(schema) {
    closeMenus();
    const currentPath = String(schema?.path || '').trim();
    if (!currentPath) return;
    if (!window.confirm(`Delete schema "${currentPath}"?`)) return;

    try {
      const res = await fetch('/api/librarian/schemas', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: currentPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Delete schema failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Schema deleted: ${currentPath}`);
      await loadAll();
    } catch (e) {
      setMsg(`Delete schema failed: ${e.message}`);
    }
  }

  function collectSubschemaFieldPaths(structure) {
    const paths = [];
    const containerTypes = new Set(['sequence', 'choice', 'all', 'complextype']);
    function visit(node, parentPath = '') {
      if (!node || typeof node !== 'object') return;
      const name = String(node.name || '').trim();
      const contributesPath = name && name !== 'root' && !containerTypes.has(String(node.valueType || '').toLowerCase());
      const currentPath = contributesPath ? (parentPath ? `${parentPath}.${name}` : name) : parentPath;
      if (contributesPath && !paths.includes(currentPath)) paths.push(currentPath);
      for (const child of Array.isArray(node.children) ? node.children : []) visit(child, currentPath);
    }
    visit(structure);
    return paths;
  }

  function openSubschemaEditor(schema) {
    closeMenus();
    setSubschemaFieldSearch('');
    setSubschemaEditor({
      mode: schema.virtual ? 'edit' : 'create',
      schema,
      id: schema.virtual ? schema.name : '',
      label: schema.virtual ? (schema.label || schema.name) : '',
      selectedFields: schema.virtual ? [...(schema.accessibleFields || [])] : [],
    });
  }

  function toggleSubschemaField(fieldPath) {
    setSubschemaEditor(current => {
      if (!current) return current;
      const selected = new Set(current.selectedFields || []);
      if (selected.has(fieldPath)) selected.delete(fieldPath);
      else selected.add(fieldPath);
      return { ...current, selectedFields: Array.from(selected).sort((a, b) => a.localeCompare(b)) };
    });
  }

  async function saveSubschema() {
    if (!subschemaEditor) return;
    const id = String(subschemaEditor.id || '').trim();
    const label = String(subschemaEditor.label || '').trim();
    const accessibleFields = subschemaEditor.selectedFields || [];
    if (!id || !label || accessibleFields.length === 0) {
      setMsg('Subschema ID, label, and at least one accessible field are required.');
      return;
    }
    const isEdit = subschemaEditor.mode === 'edit';
    const parentSchemaPath = isEdit
      ? subschemaEditor.schema.parentSchemaPath
      : subschemaEditor.schema.path;
    const endpoint = isEdit
      ? `/api/librarian/subschemas/${encodeURIComponent(subschemaEditor.schema.name)}`
      : '/api/librarian/subschemas';
    try {
      const response = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, label, parentSchemaPath, accessibleFields }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMsg(`Subschema save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Subschema ${isEdit ? 'updated' : 'created'}: ${data.subschema?.name || id}`);
      setSubschemaEditor(null);
      await loadAll();
    } catch (e) {
      setMsg(`Subschema save failed: ${e.message}`);
    }
  }

  async function deleteSubschema(schema) {
    closeMenus();
    if (!window.confirm(`Delete subschema "${schema.name}"?`)) return;
    try {
      const response = await fetch(`/api/librarian/subschemas/${encodeURIComponent(schema.name)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setMsg(`Delete subschema failed: ${data.error || 'unknown error'}`);
        return;
      }
      setMsg(`Subschema deleted: ${schema.name}`);
      await loadAll();
    } catch (e) {
      setMsg(`Delete subschema failed: ${e.message}`);
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
    const now = nowTs;
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

  const subschemaFieldOptions = useMemo(() => {
    if (!subschemaEditor) return [];
    const available = subschemaEditor.schema.virtual
      ? (subschemaEditor.schema.availableFields || [])
      : collectSubschemaFieldPaths(subschemaEditor.schema.structure);
    const query = subschemaFieldSearch.trim().toLowerCase();
    return available.filter(field => !query || field.toLowerCase().includes(query));
  }, [subschemaEditor, subschemaFieldSearch]);

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
    <div className="data-librarian-root" style={{ maxWidth: 860 }} onClick={closeMenus}>

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
              <button
                onClick={createMapperRuleset}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                New Mapper Ruleset…
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

      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Mapper Rulesets</h3>
          <button type="button" onClick={createMapperRuleset} style={{ fontSize: 12 }}>
            New Ruleset
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginTop: 0 }}>
          Rulesets define mapper behavior by source and destination pattern matching.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>Source Patterns</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>Target Patterns</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>Recommended</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>Priority</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mapperRulesets.map((ruleset) => (
                <tr key={`ruleset:${ruleset.id}`}>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>
                    <div style={{ fontWeight: 600 }}>{ruleset.id}</div>
                    <div style={{ color: '#777' }}>{ruleset.label}</div>
                    <div style={{ color: '#777' }}>{ruleset.description || ''}</div>
                    <div style={{ color: '#1d6b2a', fontSize: 11 }}>filesystem</div>
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{(ruleset.sourcePatterns || []).join(', ')}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{(ruleset.targetPatterns || []).join(', ')}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{ruleset.recommended ? 'yes' : 'no'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{Number(ruleset.priority || 0)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => editMapperRuleset(ruleset)} style={{ fontSize: 11, marginRight: 6 }}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMapperRuleset(ruleset)}
                      style={{ fontSize: 11 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {mapperRulesets.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '10px 8px', color: '#888' }}>
                    No mapper rulesets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                        onContextMenu={e => openContextMenu(e, 'type', item)}
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
                                  onContextMenu={e => openContextMenu(e, format.virtual ? 'subschema' : 'schema', format)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 4px', borderRadius: 4, cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <span style={{ width: 12, color: '#5a6b7b' }}>{itemExpanded[format.path] ? '▾' : '▸'}</span>
                                  <span>{format.type === 'copybook' ? '📘' : (format.virtual ? '◫' : '📄')}</span>
                                  <span style={{ fontWeight: 600, fontSize: 12 }}>{format.name}</span>
                                  <span style={{ fontSize: 11, color: '#777' }}>{format.type}</span>
                                  {!format.virtual && <span style={{ fontSize: 10, color: '#555' }}>v{format.version ?? '-'}</span>}
                                  <span style={{ fontSize: 10, color: '#555' }}>{format.size} B</span>
                                  {format.virtual && <span style={{ fontSize: 10, color: '#555' }}>{format.accessibleFields?.length || 0} accessible field(s)</span>}
                                  <span style={{ fontSize: 10, borderRadius: 12, padding: '2px 8px', ...badge.style }}>{badge.label}</span>
                                </div>
                                {itemExpanded[format.path] && (
                                  <div style={{ marginTop: 4, marginLeft: 20, display: 'grid', gap: 8 }}>
                                    {format.virtual && (
                                      <div style={{ fontSize: 11, color: '#555' }}>
                                        Parent schema: <code>{format.parentSchemaPath}</code>
                                      </div>
                                    )}
                                    {format.structure && (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                          <div style={{ fontSize: 12, color: '#444' }}>Message Structure</div>
                                          <button type="button" onClick={() => speakStructure(format)} style={{ fontSize: 11 }}>
                                            Speak summary
                                          </button>
                                          <button type="button" onClick={() => openSubschemaEditor(format)} style={{ fontSize: 11 }}>
                                            {format.virtual ? 'Edit Subschema' : 'New Subschema'}
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
                                    {!format.virtual && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
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
                                    </div>}
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
                      <div
                        onContextMenu={e => openContextMenu(e, 'schema', schema)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 4px', borderRadius: 4, cursor: 'context-menu' }}
                      >
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

      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 190 }}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 200,
              minWidth: 200,
              background: '#111827',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 8,
              boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
              overflow: 'hidden',
              fontFamily: 'Consolas, monospace',
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #374151', fontSize: 11, color: '#9ca3af' }}>
              {contextMenu.kind === 'type' ? `Type: ${contextMenu.item?.id || ''}` : `${contextMenu.kind === 'subschema' ? 'Subschema' : 'Schema'}: ${contextMenu.item?.name || contextMenu.item?.path || ''}`}
            </div>
            {contextMenu.kind === 'type' && (
              <>
                <button
                  type="button"
                  onClick={() => renameDataType(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  Rename Type
                </button>
                <button
                  type="button"
                  onClick={() => deleteDataType(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                >
                  Delete Type
                </button>
              </>
            )}
            {contextMenu.kind === 'schema' && (
              <>
                <button
                  type="button"
                  onClick={() => openSubschemaEditor(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  New Subschema
                </button>
                <button
                  type="button"
                  onClick={() => createTypeFromSchema(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  Create Type From Schema
                </button>
                <button
                  type="button"
                  onClick={() => renameSchema(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  Rename Schema File
                </button>
                <button
                  type="button"
                  onClick={() => deleteSchema(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                >
                  Delete Schema File
                </button>
              </>
            )}
            {contextMenu.kind === 'subschema' && (
              <>
                <button
                  type="button"
                  onClick={() => openSubschemaEditor(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  Edit Subschema
                </button>
                <button
                  type="button"
                  onClick={() => deleteSubschema(contextMenu.item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                >
                  Delete Subschema
                </button>
              </>
            )}
          </div>
        </>
      )}

      {subschemaEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(17,24,39,0.48)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div role="dialog" aria-modal="true" aria-label="Subschema editor" style={{ width: 'min(760px, 100%)', maxHeight: 'min(760px, 92vh)', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 24px 60px rgba(0,0,0,0.28)', display: 'grid', gridTemplateRows: 'auto auto minmax(180px, 1fr) auto', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700 }}>{subschemaEditor.mode === 'edit' ? 'Edit Subschema' : 'New Subschema'}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: '#64748b' }}>Parent: {subschemaEditor.schema.parentSchemaPath || subschemaEditor.schema.path}</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(220px, 2fr)', gap: 10, borderBottom: '1px solid #e5e7eb' }}>
              <label style={{ fontSize: 12 }}>ID
                <input value={subschemaEditor.id} onChange={event => setSubschemaEditor(current => ({ ...current, id: event.target.value }))} style={{ display: 'block', width: '100%' }} />
              </label>
              <label style={{ fontSize: 12 }}>Label
                <input value={subschemaEditor.label} onChange={event => setSubschemaEditor(current => ({ ...current, label: event.target.value }))} style={{ display: 'block', width: '100%' }} />
              </label>
              <label style={{ gridColumn: '1 / -1', fontSize: 12 }}>Find fields
                <input value={subschemaFieldSearch} onChange={event => setSubschemaFieldSearch(event.target.value)} placeholder="Filter canonical paths" style={{ display: 'block', width: '100%' }} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                <button type="button" onClick={() => setSubschemaEditor(current => ({ ...current, selectedFields: Array.from(new Set([...(current.selectedFields || []), ...subschemaFieldOptions])).sort((a, b) => a.localeCompare(b)) }))}>Select visible</button>
                <button type="button" onClick={() => setSubschemaEditor(current => ({ ...current, selectedFields: [] }))}>Clear</button>
                <span style={{ color: '#64748b' }}>{subschemaEditor.selectedFields.length} selected</span>
              </div>
            </div>
            <div style={{ overflow: 'auto', padding: '8px 16px' }}>
              {subschemaFieldOptions.map(fieldPath => (
                <label key={fieldPath} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 8, alignItems: 'start', padding: '5px 2px', borderBottom: '1px solid #f1f5f9', fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                  <input type="checkbox" checked={subschemaEditor.selectedFields.includes(fieldPath)} onChange={() => toggleSubschemaField(fieldPath)} />
                  <span style={{ overflowWrap: 'anywhere' }}>{fieldPath}</span>
                </label>
              ))}
              {subschemaFieldOptions.length === 0 && <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>No matching fields.</div>}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setSubschemaEditor(null)}>Cancel</button>
              <button type="button" onClick={saveSubschema}>Save Subschema</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
