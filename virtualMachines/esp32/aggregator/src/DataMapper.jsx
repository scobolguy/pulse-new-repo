import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const LazyDataMapperEditor = lazy(() => import('./archived-old-app/DataMapperEditor.jsx'));

const SECTION_STYLE = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

function validateConversionRule(ruleText) {
  const text = String(ruleText || '').trim();
  if (!text) return { valid: true };
  if (text.length > 1000) return { valid: false, error: 'too long (max 1000 chars)' };
  if (!/^[\w\s.,()'"{};:\-+*/%<>=!|&?#@\\~`]+$/.test(text)) {
    return { valid: false, error: 'unsupported characters' };
  }

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth -= 1;
    if (ch === '[') bracketDepth += 1;
    if (ch === ']') bracketDepth -= 1;
    if (ch === '{') braceDepth += 1;
    if (ch === '}') braceDepth -= 1;
    if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0) {
      return { valid: false, error: 'unbalanced delimiters' };
    }
  }
  if (quote || parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
    return { valid: false, error: 'unbalanced quotes or delimiters' };
  }

  // PL/0 validation: basic sanity check
  // Accept statements like "output := trim(src);" or more complex PL/0 code
  const hasAssignment = text.includes(':=') || text.match(/[A-Za-z_]\w*\s*=\s*/);
  const hasFunctionCall = /[A-Za-z_]\w*\s*\(/.test(text);
  const hasKeyword = /\b(if|then|else|while|do|for|to|begin|end|var|call|not)\b/i.test(text);
  
  if (!hasAssignment && !hasFunctionCall && !hasKeyword) {
    return { valid: false, error: 'must contain assignment, function call, or PL/0 keyword' };
  }

  return { valid: true };
}

function flattenStructure(node, prefix = '', depth = 0) {
  if (!node) return [];
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) return [];

  const rows = [];
  for (const child of children) {
    const childName = String(child.name || '');
    const path = prefix ? `${prefix}.${childName}` : childName;
    const kind = child.kind === 'branch' ? 'branch' : 'leaf';
    const valueType = String(child.valueType || 'unknown').toLowerCase();
    rows.push({
      name: childName,
      path,
      kind,
      valueType,
      depth,
      required: child.required === true,
      isEnum: child.isEnum === true,
      enumValues: Array.isArray(child.enumValues) ? child.enumValues : undefined,
    });
    rows.push(...flattenStructure(child, path, depth + 1));
  }
  return rows;
}

const CONVERSION_RULES = {
  xsd_to_xsd: {
    strictShape: true,
    liberalType: false,
  },
  mx_to_mt: {
    strictShape: false,
    liberalType: true,
  },
  mt_to_mx: {
    strictShape: false,
    liberalType: true,
  },
  fallback: {
    strictShape: true,
    liberalType: false,
  },
};

function getSchemaFamily(schemaPath) {
  if (isMtSchemaPath(schemaPath)) return 'mt';
  if (isXsdSchemaPath(schemaPath)) return 'xsd';
  return 'other';
}

function normalizeLogicalType(valueType) {
  const raw = String(valueType || 'unknown').toLowerCase();
  if (!raw || raw === 'unknown') return 'unknown';
  if (raw === 'object' || raw === 'array' || raw === 'group') return 'container';
  if (raw.includes('date') || raw.includes('time')) return 'date';
  if (raw.includes('decimal') || raw.includes('amount') || raw.includes('number') || raw.includes('numeric') || raw.includes('int') || raw.includes('float')) return 'number';
  if (raw.includes('bool') || raw.includes('indicator')) return 'boolean';
  if (raw.includes('code') || raw.includes('text') || raw.includes('string') || raw.includes('char') || raw.includes('id')) return 'string';
  if (raw.includes('bic') || raw.includes('iban') || raw.includes('account') || raw.includes('party') || raw.includes('composite')) return 'string';
  return 'string';
}

function isTypeConvertible(sourceType, targetType, liberalType) {
  if (sourceType === targetType) return true;
  if (sourceType === 'unknown' || targetType === 'unknown') return true;
  if (liberalType) return true;

  const key = `${sourceType}->${targetType}`;
  const strictPairs = new Set([
    'string->date',
    'date->string',
    'string->number',
    'number->string',
    'string->boolean',
    'boolean->string',
  ]);
  return strictPairs.has(key);
}

function getCompatibilityProfile(sourceSchemaPath, targetSchemaPath) {
  const sourceFamily = getSchemaFamily(sourceSchemaPath);
  const targetFamily = getSchemaFamily(targetSchemaPath);
  if (sourceFamily === 'xsd' && targetFamily === 'xsd') return CONVERSION_RULES.xsd_to_xsd;
  if (sourceFamily === 'xsd' && targetFamily === 'mt') return CONVERSION_RULES.mx_to_mt;
  if (sourceFamily === 'mt' && targetFamily === 'xsd') return CONVERSION_RULES.mt_to_mx;
  return CONVERSION_RULES.fallback;
}

function isCompatible(sourceNode, targetNode, sourceSchemaPath, targetSchemaPath) {
  if (!sourceNode || !targetNode) return false;

  const profile = getCompatibilityProfile(sourceSchemaPath, targetSchemaPath);
  if (profile.strictShape && sourceNode.kind !== targetNode.kind) return false;

  // Keep complex/container mapping conservative unless both sides are explicitly branches.
  if (sourceNode.kind === 'branch' || targetNode.kind === 'branch') {
    return sourceNode.kind === targetNode.kind;
  }

  const sourceType = normalizeLogicalType(sourceNode.valueType);
  const targetType = normalizeLogicalType(targetNode.valueType);
  return isTypeConvertible(sourceType, targetType, profile.liberalType);
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
      required: def.required === true,
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

function isMtRequiredPath(path, mtFieldDefs) {
  if (!mtFieldDefs) return false;
  const raw = String(path || '');
  const match = raw.match(/^finEnvelope\.block4\.fields\.([A-Za-z0-9]+)$/);
  if (!match) return false;
  const meta = mtFieldDefs.get(String(match[1]));
  return meta?.required === true;
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

function getXsdDisplayName(node) {
  const direct = String(node?.name || '').trim();
  if (direct) return direct;
  const tail = getPathTail(node?.path || '');
  if (tail) return tail;
  return String(node?.valueType || 'field');
}

function buildNodeIndex(nodes) {
  const nodeByPath = new Map();
  const nodeByPathLower = new Map();
  const childrenByParent = new Map();

  for (const node of nodes) {
    nodeByPath.set(node.path, node);
    nodeByPathLower.set(String(node.path || '').toLowerCase(), node);
  }

  for (const node of nodes) {
    const parentPath = getParentPath(node.path);
    const siblings = childrenByParent.get(parentPath) || [];
    siblings.push(node);
    childrenByParent.set(parentPath, siblings);
  }

  return { nodeByPath, nodeByPathLower, childrenByParent };
}

function getInitialExpandedPaths(indexData) {
  const roots = indexData.childrenByParent.get('') || [];
  const hasDocument = roots.some(node => node.path === 'Document');
  if (hasDocument) return new Set(['Document']);
  return new Set(roots.map(node => node.path));
}

function getAncestorPaths(rawPath) {
  const path = String(rawPath || '').trim();
  if (!path) return [];
  const parts = path.split('.').filter(Boolean);
  const ancestors = [];
  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

function getMappedExpansionPaths(items, pickPath) {
  const expanded = new Set();
  for (const item of items) {
    const path = pickPath(item);
    for (const ancestor of getAncestorPaths(path)) {
      expanded.add(ancestor);
    }
  }
  return expanded;
}

function getOneLevelChildPaths(indexData, parentPaths) {
  const childPaths = new Set();
  for (const parentPath of parentPaths) {
    const children = indexData.childrenByParent.get(parentPath) || [];
    for (const child of children) {
      childPaths.add(child.path);
    }
  }
  return childPaths;
}

function filterNodesForSchema(nodes, schemaPath) {
  if (!isMtSchemaPath(schemaPath)) return nodes;
  return nodes
    .filter(node => /^finEnvelope\.block4\.fields\.[A-Za-z0-9]+$/.test(String(node.path || '')))
    .map(node => ({
      ...node,
      // Treat MT top-level tags as terminal mapping fields.
      kind: 'leaf',
      valueType: node.valueType || 'string',
    }));
}

export default function DataMapper() {
  const [schemas, setSchemas] = useState([]);
  const [availableMaps, setAvailableMaps] = useState([]);
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
  const [isPersistedMap, setIsPersistedMap] = useState(false);
  const [testCases, setTestCases] = useState([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState('');
  const [runPayloadText, setRunPayloadText] = useState('');
  const [runResult, setRunResult] = useState(null);

  const loadSchemas = useCallback(async () => {
    try {
      const schemasRes = await fetch('/api/librarian/schemas');
      const nextSchemas = schemasRes.ok ? ((await schemasRes.json()).schemas || []) : [];
      setSchemas(Array.isArray(nextSchemas) ? nextSchemas : []);
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    }
  }, []);

  const loadAvailableMaps = useCallback(async () => {
    const res = await fetch('/api/mapper/maps');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load maps');
    }
    const nextMaps = Array.isArray(data.maps) ? data.maps : [];
    setAvailableMaps(nextMaps);
    return nextMaps;
  }, []);

  useEffect(() => {
    setTimeout(() => {
      void loadSchemas();
    }, 0);
  }, [loadSchemas]);

  useEffect(() => {
    let cancelled = false;
    async function loadTestCases() {
      try {
        const res = await fetch('/api/mapper/test-cases');
        const data = res.ok ? await res.json() : { testCases: [] };
        if (cancelled) return;
        const list = Array.isArray(data.testCases) ? data.testCases : [];
        setTestCases(list);
        if (list.length > 0 && !selectedTestCaseId) {
          setSelectedTestCaseId(String(list[0].id || ''));
        }
      } catch {
        if (!cancelled) setTestCases([]);
      }
    }
    setTimeout(() => {
      void loadTestCases();
    }, 0);
    return () => {
      cancelled = true;
    };
  }, []);

  const schemasByPath = useMemo(() => {
    const map = new Map();
    for (const schema of schemas) {
      map.set(String(schema.path || ''), schema);
    }
    return map;
  }, [schemas]);

  const schemaChoices = useMemo(() => {
    return schemas
      .map((schema) => {
        const path = String(schema.path || '');
        const typeId = String(schema.typeId || schema.area || schema.name || '').toLowerCase();
        const name = String(schema.name || path || typeId || 'schema');
        const label = `${typeId || 'type'} | ${name} | ${path}`;
        return {
          path,
          typeId,
          name,
          label,
          mtime: schema.mtime,
        };
      })
      .filter(choice => !!choice.path)
      .sort((a, b) => String(b.mtime || '').localeCompare(String(a.mtime || '')));
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
      setTimeout(() => {
        setExpandedSourcePaths(new Set());
      }, 0);
      return;
    }
    setTimeout(() => {
      setExpandedSourcePaths(getInitialExpandedPaths(sourceIndex));
    }, 0);
  }, [sourceIsXsd, sourceIndex, sourceSchemaPath]);

  useEffect(() => {
    if (!targetIsXsd) {
      setTimeout(() => {
        setExpandedTargetPaths(new Set());
      }, 0);
      return;
    }
    setTimeout(() => {
      const initial = getInitialExpandedPaths(targetIndex);
      if (!editingId || items.length === 0) {
        setExpandedTargetPaths(initial);
        return;
      }

      const mapped = getMappedExpansionPaths(items, (item) => item?.targetPath);
      const oneLevel = getOneLevelChildPaths(targetIndex, initial);
      setExpandedTargetPaths(new Set([...initial, ...oneLevel, ...mapped]));
    }, 0);
  }, [targetIsXsd, targetIndex, targetSchemaPath, editingId, items]);

  const conversionRuleErrors = useMemo(() => {
    return items.map((item) => {
      const result = validateConversionRule(item.conversionRule);
      return result.valid ? '' : result.error || 'invalid rule';
    });
  }, [items]);

  const hasConversionRuleErrors = useMemo(() => conversionRuleErrors.some(Boolean), [conversionRuleErrors]);

  function toggleExpandPath(path, pane) {
    const setter = pane === 'source' ? setExpandedSourcePaths : setExpandedTargetPaths;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const openMapping = useCallback((mapping) => {
    setEditingId(String(mapping.id || ''));
    setName(String(mapping.name || ''));
    setSourceTypeId(String(mapping.sourceTypeId || '').toLowerCase());
    setTargetTypeId(String(mapping.targetTypeId || '').toLowerCase());
    setSourceSchemaPath(String(mapping.sourceSchemaPath || ''));
    setTargetSchemaPath(String(mapping.targetSchemaPath || ''));
    setItems(Array.isArray(mapping.items) ? mapping.items : []);
    setIsPersistedMap(mapping.persisted !== false);
    setStatus(`Opened mapping: ${mappingTitle(mapping)}`);
  }, []);

  const createNewMap = useCallback(() => {
    const proposedName = prompt('New map name:', name || 'Untitled Map');
    if (!proposedName) return;

    const nextId = proposedName
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]/g, '_')
      .slice(0, 50);

    const fallbackSourceSchema = sourceSchemaPath || 'schemas/swift-mt103.json';
    const fallbackTargetSchema = targetSchemaPath || 'schemas/pacs.008.001.14.xsd';
    const fallbackSourceType = sourceTypeId || 'swift-mt103';
    const fallbackTargetType = targetTypeId || 'pacs';

    openMapping({
      id: nextId,
      name: proposedName.trim(),
      sourceTypeId: fallbackSourceType,
      targetTypeId: fallbackTargetType,
      sourceSchemaPath: fallbackSourceSchema,
      targetSchemaPath: fallbackTargetSchema,
      items: [],
      persisted: false,
    });
  }, [name, openMapping, sourceSchemaPath, sourceTypeId, targetSchemaPath, targetTypeId]);

  const openMapFile = useCallback(async (mapId) => {
    const res = await fetch(`/api/mapper/maps/${encodeURIComponent(mapId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to open map');
    }

    const map = data?.map || {};
    const rawRules = Array.isArray(map.rules) ? map.rules : [];
    const mappedItems = rawRules
      .map((rule) => {
        const sourcePath = String(rule.sourcePath || rule.from || '').trim();
        const targetPath = String(rule.targetPath || rule.to || '').trim();
        if (!sourcePath || !targetPath) return null;
        return {
          sourcePath,
          targetPath,
          kind: String(rule.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
          sourceValueType: String(rule.sourceValueType || 'unknown').toLowerCase() || 'unknown',
          targetValueType: String(rule.targetValueType || 'unknown').toLowerCase() || 'unknown',
          conversionRule: String(rule.conversionRule || rule.conversion || '').trim(),
        };
      })
      .filter(Boolean);

    const mappedTargetAncestors = getMappedExpansionPaths(mappedItems, (item) => item?.targetPath);
    const initial = getInitialExpandedPaths(targetIndex);
    const oneLevel = getOneLevelChildPaths(targetIndex, initial);
    setExpandedTargetPaths((prev) => new Set([...prev, ...initial, ...oneLevel, ...mappedTargetAncestors]));

    openMapping({
      id: String(map.id || mapId || ''),
      name: String(map.name || mapId || ''),
      sourceTypeId: String(map.sourceTypeId || 'swift-mt103').toLowerCase(),
      targetTypeId: String(map.targetTypeId || 'pacs').toLowerCase(),
      sourceSchemaPath: String(map.sourceSchemaPath || 'schemas/swift-mt103.json'),
      targetSchemaPath: String(map.targetSchemaPath || 'schemas/pacs.008.001.14.xsd'),
      items: mappedItems,
      persisted: true,
    });
  }, [openMapping, targetIndex]);

  const openMapDialog = useCallback(async () => {
    try {
      await loadAvailableMaps();
      setOpenDialog(true);
      setMenuOpen(false);
    } catch (e) {
      setStatus(`Open failed: ${e.message}`);
    }
  }, [loadAvailableMaps]);

  const updateSchemaSelection = useCallback((pane, nextSchemaPath) => {
    const selectedSchemaPath = String(nextSchemaPath || '').trim();
    if (!selectedSchemaPath) return;

    const matchedSchema = resolveSchemaByPath(schemasByPath, selectedSchemaPath);
    const resolvedTypeId = String(matchedSchema?.typeId || matchedSchema?.area || matchedSchema?.name || '').toLowerCase();

    if (pane === 'source') {
      if (selectedSchemaPath === sourceSchemaPath) return;
      setSourceSchemaPath(selectedSchemaPath);
      if (resolvedTypeId) setSourceTypeId(resolvedTypeId);
    } else {
      if (selectedSchemaPath === targetSchemaPath) return;
      setTargetSchemaPath(selectedSchemaPath);
      if (resolvedTypeId) setTargetTypeId(resolvedTypeId);
    }

    if (items.length > 0) {
      setItems([]);
      setStatus('Schema changed. Existing links were cleared because field structures may differ.');
    } else {
      setStatus('Schema updated.');
    }
    setIsPersistedMap(false);
  }, [items.length, schemasByPath, sourceSchemaPath, targetSchemaPath]);

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
      if (!isCompatible(sourceNode, targetNode, sourceSchemaPath, targetSchemaPath)) {
        setStatus(`Incompatible mapping: ${sourceNode.path} -> ${targetNode.path}`);
        return;
      }

      const nextItem = {
        sourcePath: sourceNode.path,
        targetPath: targetNode.path,
        kind: sourceNode.kind,
        sourceValueType: sourceNode.valueType,
        targetValueType: targetNode.valueType,
        conversionRule: '',
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

  function updateItemConversionRule(index, conversionRule) {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, conversionRule } : item)));
  }

  async function saveMapping() {
    try {
      if (hasConversionRuleErrors) {
        setStatus('Save failed: one or more conversion rules are invalid');
        return;
      }
      if (!editingId) {
        setStatus('Save failed: create or open a map first');
        return;
      }

      const payload = {
        id: editingId,
        name: String(name || '').trim() || `${sourceTypeId} -> ${targetTypeId}`,
        description: '',
        sourceTypeId,
        targetTypeId,
        sourceSchemaPath,
        targetSchemaPath,
        sourceSchemaMtime: sourceSchema?.mtime ? String(sourceSchema.mtime) : '',
        targetSchemaMtime: targetSchema?.mtime ? String(targetSchema.mtime) : '',
        sourceStructure: sourceSchema?.structure || null,
        targetStructure: targetSchema?.structure || null,
        rules: items.map((item) => ({
          sourcePath: item.sourcePath,
          targetPath: item.targetPath,
          kind: item.kind,
          sourceValueType: item.sourceValueType,
          targetValueType: item.targetValueType,
          conversionRule: item.conversionRule,
        })),
        submaps: [],
      };

      const endpoint = isPersistedMap ? `/api/mapper/maps/${encodeURIComponent(editingId)}` : '/api/mapper/maps';
      const method = isPersistedMap ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Save failed: ${data.error || 'unknown error'}`);
        return;
      }

      const savedMap = data.map || payload;
      setIsPersistedMap(true);
      setStatus(`Saved map: ${savedMap.name || editingId}`);
      openMapping({
        id: String(savedMap.id || editingId),
        name: String(savedMap.name || name || editingId),
        sourceTypeId: String(savedMap.sourceTypeId || sourceTypeId).toLowerCase(),
        targetTypeId: String(savedMap.targetTypeId || targetTypeId).toLowerCase(),
        sourceSchemaPath: String(savedMap.sourceSchemaPath || sourceSchemaPath),
        targetSchemaPath: String(savedMap.targetSchemaPath || targetSchemaPath),
        items,
        persisted: true,
      });
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
  }

  async function runMapping() {
    try {
      if (!editingId) {
        setStatus('Run failed: open or create a map first');
        return;
      }

      let payload = null;
      const payloadText = String(runPayloadText || '').trim();
      if (payloadText) {
        try {
          payload = JSON.parse(payloadText);
        } catch {
          setStatus('Run failed: payload must be valid JSON');
          return;
        }
      }

      const body = payload
        ? { payload }
        : { testCaseId: selectedTestCaseId || '' };

      const res = await fetch(`/api/mapper/maps/${encodeURIComponent(editingId)}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRunResult(null);
        setStatus(`Run failed: ${data.error || 'unknown error'}`);
        return;
      }

      setRunResult(data);
      setStatus(`Run succeeded for map ${editingId}`);
    } catch (e) {
      setStatus(`Run failed: ${e.message}`);
    }
  }

  async function applyShapeAwareMap(sourcePath, targetPath) {
    try {
      if (!editingId) {
        setStatus('Shape map failed: open or create a map first');
        return;
      }
      if (!sourcePath || !targetPath) {
        setStatus('Shape map failed: source and target branch paths are required');
        return;
      }

      const res = await fetch(`/api/mapper/maps/${encodeURIComponent(editingId)}/auto-shape-map`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`Shape map failed: ${data.error || 'unknown error'}`);
        return;
      }

      const map = data.map || {};
      const mappedItems = (Array.isArray(map.rules) ? map.rules : [])
        .map((rule) => {
          const sourcePathValue = String(rule.sourcePath || rule.from || '').trim();
          const targetPathValue = String(rule.targetPath || rule.to || '').trim();
          if (!sourcePathValue || !targetPathValue) return null;
          return {
            sourcePath: sourcePathValue,
            targetPath: targetPathValue,
            kind: String(rule.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
            sourceValueType: String(rule.sourceValueType || 'unknown').toLowerCase() || 'unknown',
            targetValueType: String(rule.targetValueType || 'unknown').toLowerCase() || 'unknown',
            conversionRule: String(rule.conversionRule || rule.conversion || '').trim(),
          };
        })
        .filter(Boolean);

      setItems(mappedItems);
      setStatus(`Shape-aware map added ${Number(data.added || 0)} links`);
    } catch (e) {
      setStatus(`Shape map failed: ${e.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 1300, color: '#111827', background: '#ffffff' }}>
      <Suspense fallback={<div style={{ ...SECTION_STYLE, padding: 22 }}>Loading drag-and-drop mapper…</div>}>
        <LazyDataMapperEditor
          availableMaps={availableMaps}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          openDialog={openDialog}
          setOpenDialog={setOpenDialog}
          createNewMap={createNewMap}
          openMapDialog={openMapDialog}
          openMapFile={openMapFile}
          editingId={editingId}
          name={name}
          sourceTypeId={sourceTypeId}
          targetTypeId={targetTypeId}
          sourceSchemaPath={effectiveSourceSchemaPath}
          targetSchemaPath={effectiveTargetSchemaPath}
          schemaChoices={schemaChoices}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
          onSourceSchemaChange={(nextPath) => updateSchemaSelection('source', nextPath)}
          onTargetSchemaChange={(nextPath) => updateSchemaSelection('target', nextPath)}
          status={status}
          setItems={setItems}
          sourceMtFieldDefs={sourceMtFieldDefs}
          targetMtFieldDefs={targetMtFieldDefs}
          sourceIsXsd={sourceIsXsd}
          targetIsXsd={targetIsXsd}
          sourceNodes={sourceNodes}
          targetNodes={targetNodes}
          sourceRoots={sourceRoots}
          targetRoots={targetRoots}
          sourceIndex={sourceIndex}
          targetIndex={targetIndex}
          conversionRuleErrors={conversionRuleErrors}
          hasConversionRuleErrors={hasConversionRuleErrors}
          expandedSourcePaths={expandedSourcePaths}
          expandedTargetPaths={expandedTargetPaths}
          onSourceDragStart={onSourceDragStart}
          onTargetDrop={onTargetDrop}
          labelForPath={labelForPath}
          isMtRequiredPath={isMtRequiredPath}
          getXsdDisplayName={getXsdDisplayName}
          updateItemConversionRule={updateItemConversionRule}
          removeItem={removeItem}
          saveMapping={saveMapping}
          runMapping={runMapping}
          testCases={testCases}
          selectedTestCaseId={selectedTestCaseId}
          setSelectedTestCaseId={setSelectedTestCaseId}
          runPayloadText={runPayloadText}
          setRunPayloadText={setRunPayloadText}
          runResult={runResult}
          applyShapeAwareMap={applyShapeAwareMap}
          mappingTitle={mappingTitle}
          items={items}
          toggleExpandPath={toggleExpandPath}
        />
      </Suspense>
    </div>
  );
}
