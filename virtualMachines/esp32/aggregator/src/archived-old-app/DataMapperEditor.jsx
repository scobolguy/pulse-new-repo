import { useEffect, useMemo, useState } from 'react';

const MAPPER_TEXT_COLOR = '#111827';
const MAPPER_MUTED_TEXT = '#4b5563';
const MAPPER_SURFACE = '#ffffff';

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
  background: MAPPER_SURFACE,
};

export default function DataMapperEditor({
  availableMaps,
  menuOpen,
  setMenuOpen,
  openDialog,
  setOpenDialog,
  createNewMap,
  openMapDialog,
  openMapFile,
  editingId,
  name,
  sourceTypeId,
  targetTypeId,
  sourceSchemaPath,
  targetSchemaPath,
  schemaChoices,
  sourceSchema,
  targetSchema,
  onSourceSchemaChange,
  onTargetSchemaChange,
  status,
  setItems,
  sourceMtFieldDefs,
  targetMtFieldDefs,
  sourceIsXsd,
  targetIsXsd,
  sourceNodes,
  targetNodes,
  sourceRoots,
  targetRoots,
  sourceIndex,
  targetIndex,
  conversionRuleErrors,
  hasConversionRuleErrors,
  expandedSourcePaths,
  expandedTargetPaths,
  onSourceDragStart,
  onTargetDrop,
  labelForPath,
  isMtRequiredPath,
  getXsdDisplayName,
  updateItemConversionRule,
  removeItem,
  saveMapping,
  saveAsMapping,
  runMapping,
  testCases,
  selectedTestCaseId,
  setSelectedTestCaseId,
  runPayloadText,
  setRunPayloadText,
  runResult,
  applyShapeAwareMap,
  mappingTitle,
  items,
  toggleExpandPath,
}) {
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [sourceMatchIndex, setSourceMatchIndex] = useState(-1);
  const [targetMatchIndex, setTargetMatchIndex] = useState(-1);
  const [showSourceMappedOnly, setShowSourceMappedOnly] = useState(false);
  const [showTargetMappedOnly, setShowTargetMappedOnly] = useState(false);
  const editorReady = !!editingId && !!sourceSchema && !!targetSchema;

  const linkedSourcePaths = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      const path = String(item?.sourcePath || '').trim();
      if (path) set.add(path);
    }
    return set;
  }, [items]);

  const linkedTargetPaths = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      const path = String(item?.targetPath || '').trim();
      if (path) set.add(path);
    }
    return set;
  }, [items]);

  const mappedVisibleSourcePaths = useMemo(
    () => buildMappedVisiblePathSet(sourceNodes, linkedSourcePaths),
    [sourceNodes, linkedSourcePaths],
  );
  const mappedVisibleTargetPaths = useMemo(
    () => buildMappedVisiblePathSet(targetNodes, linkedTargetPaths),
    [targetNodes, linkedTargetPaths],
  );

  const conversionRuleSuggestions = useMemo(() => {
    const sourcePaths = Array.isArray(sourceNodes)
      ? sourceNodes
        .map((node) => String(node?.path || '').trim())
        .filter(Boolean)
      : [];
    const targetPaths = Array.isArray(targetNodes)
      ? targetNodes
        .map((node) => String(node?.path || '').trim())
        .filter(Boolean)
      : [];

    const suggestions = new Set([
      'src',
      'output',
      'trim(src)',
      'upcase(src)',
      'downcase(src)',
      'output := src;'
    ]);

    for (const path of sourcePaths) {
      suggestions.add(`src.${path}`);
    }
    for (const path of targetPaths) {
      suggestions.add(`output.${path}`);
    }

    return Array.from(suggestions).sort((a, b) => a.localeCompare(b));
  }, [sourceNodes, targetNodes]);

  const sourceMatchPaths = useMemo(
    () => buildMatchedPathList(sourceNodes, sourceSearchQuery, labelForPath, sourceMtFieldDefs, getXsdDisplayName),
    [sourceNodes, sourceSearchQuery, labelForPath, sourceMtFieldDefs, getXsdDisplayName],
  );
  const targetMatchPaths = useMemo(
    () => buildMatchedPathList(targetNodes, targetSearchQuery, labelForPath, targetMtFieldDefs, getXsdDisplayName),
    [targetNodes, targetSearchQuery, labelForPath, targetMtFieldDefs, getXsdDisplayName],
  );

  const visibleSourcePaths = useMemo(
    () => buildVisiblePathSet(sourceNodes, sourceSearchQuery, labelForPath, sourceMtFieldDefs, getXsdDisplayName),
    [sourceNodes, sourceSearchQuery, labelForPath, sourceMtFieldDefs, getXsdDisplayName],
  );
  const visibleTargetPaths = useMemo(
    () => buildVisiblePathSet(targetNodes, targetSearchQuery, labelForPath, targetMtFieldDefs, getXsdDisplayName),
    [targetNodes, targetSearchQuery, labelForPath, targetMtFieldDefs, getXsdDisplayName],
  );

  const normalizedSourceMatchIndex = normalizeMatchIndex(sourceMatchIndex, sourceSearchQuery, sourceMatchPaths.length);
  const normalizedTargetMatchIndex = normalizeMatchIndex(targetMatchIndex, targetSearchQuery, targetMatchPaths.length);

  const sourceActiveMatchPath = normalizedSourceMatchIndex >= 0 && normalizedSourceMatchIndex < sourceMatchPaths.length
    ? sourceMatchPaths[normalizedSourceMatchIndex]
    : '';
  const targetActiveMatchPath = normalizedTargetMatchIndex >= 0 && normalizedTargetMatchIndex < targetMatchPaths.length
    ? targetMatchPaths[normalizedTargetMatchIndex]
    : '';

  useEffect(() => {
    if (!editorReady || !targetIsXsd || targetRoots.length === 0) return;
    const firstRoot = targetRoots[0];
    const firstLevel = getXsdNodeChildren(firstRoot, targetIndex);
    for (const node of firstLevel) {
      if (!expandedTargetPaths.has(node.path)) {
        toggleExpandPath(node.path, 'target');
      }
    }
  }, [editorReady, targetIsXsd, targetRoots, targetIndex, expandedTargetPaths, toggleExpandPath]);

  function renderXsdTreeNode(node, pane, depth = 0) {
    const isSourcePane = pane === 'source';
    const indexData = isSourcePane ? sourceIndex : targetIndex;
    const expandedPaths = isSourcePane ? expandedSourcePaths : expandedTargetPaths;
    const visiblePaths = isSourcePane ? visibleSourcePaths : visibleTargetPaths;
    const mappedVisiblePaths = isSourcePane ? mappedVisibleSourcePaths : mappedVisibleTargetPaths;
    const showMappedOnly = isSourcePane ? showSourceMappedOnly : showTargetMappedOnly;
    const hasSearch = isSourcePane ? !!sourceSearchQuery.trim() : !!targetSearchQuery.trim();

    if (visiblePaths && !visiblePaths.has(node.path)) return [];
    if (showMappedOnly && mappedVisiblePaths && !mappedVisiblePaths.has(node.path)) return [];

    const children = getXsdNodeChildren(node, indexData);
    const hasChildren = children.length > 0;
    const isExpanded = expandedPaths.has(node.path);
    const typeText = String(node.valueType || 'unknown');
    const isRequired = node.required === true;
    const isEnum = node.isEnum === true;
    const activeMatchPath = isSourcePane ? sourceActiveMatchPath : targetActiveMatchPath;
    const isActiveMatch = activeMatchPath && activeMatchPath === node.path;

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
          background: MAPPER_SURFACE,
          color: MAPPER_TEXT_COLOR,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          outline: isActiveMatch ? '1px solid #111827' : 'none',
          outlineOffset: isActiveMatch ? '-1px' : 0,
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
            color: MAPPER_TEXT_COLOR,
          }}
          disabled={!hasChildren}
          aria-label={hasChildren ? (isExpanded ? 'Collapse node' : 'Expand node') : 'Leaf node'}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
        </button>
        <span style={{ color: MAPPER_TEXT_COLOR, fontWeight: isRequired ? 600 : 400 }}>
          {getXsdDisplayName(node)}
        </span>
        <span style={{ color: MAPPER_TEXT_COLOR }}>({typeText})</span>
        {isEnum && (
          <span style={{ color: MAPPER_TEXT_COLOR, fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 999, padding: '0 6px', lineHeight: '16px', background: MAPPER_SURFACE }}>
            enum
          </span>
        )}
      </div>
    );

    if (!hasChildren || (!isExpanded && !hasSearch)) return [row];
    const descendants = children.flatMap(child => renderXsdTreeNode(child, pane, depth + 1));
    return [row, ...descendants];
  }

  return (
    <div style={{ ...SECTION_STYLE, position: 'relative', background: MAPPER_SURFACE, color: MAPPER_TEXT_COLOR }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setMenuOpen(prev => !prev)} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>
            File ▾
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 5, background: MAPPER_SURFACE, border: '1px solid #cbd5e1', borderRadius: 4, minWidth: 150, boxShadow: '0 3px 10px rgba(0,0,0,0.08)', color: MAPPER_TEXT_COLOR }}>
              <button
                type="button"
                onClick={() => {
                  createNewMap();
                  setMenuOpen(false);
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', cursor: 'pointer', color: MAPPER_TEXT_COLOR }}
              >
                New...
              </button>
              <button
                type="button"
                onClick={openMapDialog}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', cursor: 'pointer', color: MAPPER_TEXT_COLOR }}
              >
                Open...
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveMapping();
                  setMenuOpen(false);
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', cursor: 'pointer', color: MAPPER_TEXT_COLOR }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveAsMapping();
                  setMenuOpen(false);
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', cursor: 'pointer', color: MAPPER_TEXT_COLOR }}
              >
                Save As...
              </button>
            </div>
          )}
        </div>

        <h3 style={{ margin: 0 }}>Data Mapper Drag and Drop</h3>
      </div>

      <p style={{ marginTop: 0, fontSize: 12, color: MAPPER_MUTED_TEXT }}>
        Work with the source and destination only. Open an existing map or create a new one from the File menu, then save changes back to the map file.
      </p>

      {status && (
        <div style={{ marginBottom: 10, fontSize: 12, background: '#f5f5f5', borderRadius: 4, padding: '6px 10px', color: MAPPER_TEXT_COLOR }}>
          {status}
        </div>
      )}

      <div style={{ border: '1px solid #d8e0ea', borderRadius: 6, padding: 10, background: MAPPER_SURFACE, marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: MAPPER_TEXT_COLOR }}>
            <span>Source Data Type</span>
            <select
              value={sourceSchemaPath}
              onChange={event => onSourceSchemaChange(event.target.value)}
              style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
            >
              {schemaChoices.map(choice => (
                <option key={`src-schema:${choice.path}`} value={choice.path}>{choice.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: MAPPER_TEXT_COLOR }}>
            <span>Destination Data Type</span>
            <select
              value={targetSchemaPath}
              onChange={event => onTargetSchemaChange(event.target.value)}
              style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
            >
              {schemaChoices.map(choice => (
                <option key={`dst-schema:${choice.path}`} value={choice.path}>{choice.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!!editingId && (
        <div style={{ marginBottom: 10, fontSize: 12, border: '1px solid #d8e0ea', borderRadius: 6, padding: '8px 10px', background: '#f8fbff', color: MAPPER_TEXT_COLOR }}>
          <div><strong>Opened Map:</strong> {name || editingId}</div>
          <div><strong>Source:</strong> {sourceTypeId} | {sourceSchemaPath} {sourceSchema ? '' : '(schema not resolved)'}</div>
          <div><strong>Destination:</strong> {targetTypeId} | {targetSchemaPath} {targetSchema ? '' : '(schema not resolved)'}</div>
          <div><strong>Links In Map:</strong> {items.length}</div>
        </div>
      )}

      {!editorReady && (
        <div style={{ border: '1px dashed #9ca3af', borderRadius: 8, padding: 22, background: '#fbfcff', color: MAPPER_MUTED_TEXT }}>
          Open a mapping to launch the drag-and-drop screen.
        </div>
      )}

      {editorReady && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: MAPPER_TEXT_COLOR }}>
              <strong>{name || editingId}</strong> | {sourceTypeId}{' -> '}{targetTypeId}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const sourcePath = prompt('Source branch path for shape-aware mapping:', '');
                  if (!sourcePath) return;
                  const targetPath = prompt('Target branch path for shape-aware mapping:', '');
                  if (!targetPath) return;
                  void applyShapeAwareMap(String(sourcePath).trim(), String(targetPath).trim());
                }}
                style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
              >
                Shape Auto-Map
              </button>
              <button type="button" onClick={() => setItems([])} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>Clear Links</button>
              <button type="button" onClick={saveMapping} disabled={hasConversionRuleErrors} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>Save</button>
            </div>
          </div>

          <div style={{ marginBottom: 12, border: '1px solid #d8e0ea', borderRadius: 6, padding: 10, background: '#f8fbff' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MAPPER_TEXT_COLOR, marginBottom: 8 }}>Run Mapper</div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: 8, alignItems: 'start' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: MAPPER_TEXT_COLOR }}>
                <span>Test Case</span>
                <select
                  value={selectedTestCaseId}
                  onChange={(event) => setSelectedTestCaseId(event.target.value)}
                  style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
                >
                  <option value="">Select test case</option>
                  {(Array.isArray(testCases) ? testCases : []).map((testCase) => (
                    <option key={`mapper-test:${testCase.id}`} value={String(testCase.id || '')}>
                      {String(testCase.id || '')} | {String(testCase.name || '')}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: MAPPER_TEXT_COLOR }}>
                <span>Payload Override (optional JSON object)</span>
                <textarea
                  value={runPayloadText}
                  onChange={(event) => setRunPayloadText(event.target.value)}
                  placeholder='{"Document": { "sample": "value" }}'
                  style={{ width: '100%', minHeight: 70, fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontFamily: 'Consolas, monospace', background: '#fff', color: MAPPER_TEXT_COLOR }}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button type="button" onClick={runMapping} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>Run</button>
              </div>
            </div>
            {runResult && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: MAPPER_MUTED_TEXT, marginBottom: 4 }}>Output Preview</div>
                <pre style={{ margin: 0, fontSize: 11, background: '#fff', border: '1px solid #d8e0ea', borderRadius: 4, padding: 8, maxHeight: 220, overflow: 'auto', color: MAPPER_TEXT_COLOR }}>
                  {JSON.stringify(runResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, color: MAPPER_TEXT_COLOR }}>Source</div>
              <input
                type="text"
                value={sourceSearchQuery}
                onChange={(event) => {
                  setSourceSearchQuery(event.target.value);
                  setSourceMatchIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (sourceMatchPaths.length === 0) return;
                  setSourceMatchIndex((prev) => {
                    return getAdjacentMatchIndex(prev, sourceSearchQuery, sourceMatchPaths.length, event.shiftKey ? -1 : 1);
                  });
                }}
                placeholder="Search source fields"
                style={{ width: '100%', marginBottom: 6, fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MAPPER_TEXT_COLOR, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={showSourceMappedOnly}
                  onChange={event => setShowSourceMappedOnly(event.target.checked)}
                />
                Mapped fields only ({linkedSourcePaths.size})
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: MAPPER_TEXT_COLOR }}>
                  {sourceSearchQuery.trim() ? `${sourceMatchPaths.length} matches` : 'Type to search'}
                  {sourceSearchQuery.trim() && sourceMatchPaths.length > 0 ? ` (${normalizedSourceMatchIndex + 1}/${sourceMatchPaths.length})` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setSourceMatchIndex(prev => getAdjacentMatchIndex(prev, sourceSearchQuery, sourceMatchPaths.length, -1))}
                    disabled={sourceMatchPaths.length === 0}
                    style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, fontSize: 11, padding: '2px 8px' }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMatchIndex(prev => getAdjacentMatchIndex(prev, sourceSearchQuery, sourceMatchPaths.length, 1))}
                    disabled={sourceMatchPaths.length === 0}
                    style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, fontSize: 11, padding: '2px 8px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div style={PANEL_STYLE}>
                {sourceIsXsd
                  ? sourceRoots.flatMap(node => renderXsdTreeNode(node, 'source', 0))
                  : sourceNodes.filter((node) => {
                    if (visibleSourcePaths && !visibleSourcePaths.has(node.path)) return false;
                    if (showSourceMappedOnly && mappedVisibleSourcePaths && !mappedVisibleSourcePaths.has(node.path)) return false;
                    return true;
                  }).map((node, index) => {
                    const isRequired = node.required === true || isMtRequiredPath(node.path, sourceMtFieldDefs);
                    const displayPath = labelForPath(node.path, sourceMtFieldDefs);
                    const isActiveMatch = !!sourceActiveMatchPath && sourceActiveMatchPath === node.path;
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
                          background: MAPPER_SURFACE,
                          color: MAPPER_TEXT_COLOR,
                          outline: isActiveMatch ? '1px solid #111827' : 'none',
                          outlineOffset: isActiveMatch ? '-1px' : 0,
                        }}
                        title="Drag to destination"
                      >
                        <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                        <span style={{ color: MAPPER_TEXT_COLOR, fontWeight: isRequired ? 600 : 400 }}>{displayPath}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, color: MAPPER_TEXT_COLOR }}>Destination</div>
              <input
                type="text"
                value={targetSearchQuery}
                onChange={(event) => {
                  setTargetSearchQuery(event.target.value);
                  setTargetMatchIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (targetMatchPaths.length === 0) return;
                  setTargetMatchIndex((prev) => {
                    return getAdjacentMatchIndex(prev, targetSearchQuery, targetMatchPaths.length, event.shiftKey ? -1 : 1);
                  });
                }}
                placeholder="Search destination fields"
                style={{ width: '100%', marginBottom: 6, fontSize: 12, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MAPPER_TEXT_COLOR, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={showTargetMappedOnly}
                  onChange={event => setShowTargetMappedOnly(event.target.checked)}
                />
                Mapped fields only ({linkedTargetPaths.size})
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: MAPPER_TEXT_COLOR }}>
                  {targetSearchQuery.trim() ? `${targetMatchPaths.length} matches` : 'Type to search'}
                  {targetSearchQuery.trim() && targetMatchPaths.length > 0 ? ` (${normalizedTargetMatchIndex + 1}/${targetMatchPaths.length})` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setTargetMatchIndex(prev => getAdjacentMatchIndex(prev, targetSearchQuery, targetMatchPaths.length, -1))}
                    disabled={targetMatchPaths.length === 0}
                    style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, fontSize: 11, padding: '2px 8px' }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMatchIndex(prev => getAdjacentMatchIndex(prev, targetSearchQuery, targetMatchPaths.length, 1))}
                    disabled={targetMatchPaths.length === 0}
                    style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, fontSize: 11, padding: '2px 8px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div style={PANEL_STYLE}>
                {targetIsXsd
                  ? targetRoots.flatMap(node => renderXsdTreeNode(node, 'target', 0))
                  : targetNodes.filter((node) => {
                    if (visibleTargetPaths && !visibleTargetPaths.has(node.path)) return false;
                    if (showTargetMappedOnly && mappedVisibleTargetPaths && !mappedVisibleTargetPaths.has(node.path)) return false;
                    return true;
                  }).map((node, index) => {
                    const isRequired = node.required === true || isMtRequiredPath(node.path, targetMtFieldDefs);
                    const displayPath = labelForPath(node.path, targetMtFieldDefs);
                    const isActiveMatch = !!targetActiveMatchPath && targetActiveMatchPath === node.path;
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
                          background: MAPPER_SURFACE,
                          color: MAPPER_TEXT_COLOR,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          outline: isActiveMatch ? '1px solid #111827' : 'none',
                          outlineOffset: isActiveMatch ? '-1px' : 0,
                        }}
                        title="Drop source node here"
                      >
                        <span>{node.kind === 'branch' ? '▸' : '•'}</span>
                        <span style={{ color: MAPPER_TEXT_COLOR, fontWeight: isRequired ? 600 : 400 }}>{displayPath}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: '1px solid #dce3eb', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
            <datalist id="mapper-conversion-rule-suggestions">
              {conversionRuleSuggestions.map((optionValue) => (
                <option key={`rule-suggest:${optionValue}`} value={optionValue} />
              ))}
            </datalist>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f7f9fc' }}>
                  <th style={{ width: '28%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #dce3eb', fontSize: 12, color: MAPPER_TEXT_COLOR }}>Source</th>
                  <th style={{ width: '28%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #dce3eb', fontSize: 12, color: MAPPER_TEXT_COLOR }}>Destination</th>
                  <th style={{ width: '34%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #dce3eb', fontSize: 12, color: MAPPER_TEXT_COLOR }}>Conversion Rule</th>
                  <th style={{ width: '10%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #dce3eb', fontSize: 12, color: MAPPER_TEXT_COLOR }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`item:${index}`}>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #edf2f7', fontSize: 12, fontFamily: 'Consolas, monospace', verticalAlign: 'top', color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                      {labelForPath(item.sourcePath, sourceMtFieldDefs)}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #edf2f7', fontSize: 12, fontFamily: 'Consolas, monospace', verticalAlign: 'top', color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                      {labelForPath(item.targetPath, targetMtFieldDefs)}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #edf2f7', fontSize: 12, verticalAlign: 'top', color: MAPPER_TEXT_COLOR }}>
                      <input
                        type="text"
                        value={String(item.conversionRule || '')}
                        onChange={(event) => updateItemConversionRule(index, event.target.value)}
                        placeholder="move(src)"
                        list="mapper-conversion-rule-suggestions"
                        style={{
                          width: '100%',
                          fontSize: 12,
                          padding: '6px 8px',
                          border: conversionRuleErrors[index] ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          borderRadius: 4,
                          fontFamily: 'Consolas, monospace',
                          background: '#fff',
                        }}
                      />
                      {conversionRuleErrors[index] && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#b91c1c' }}>Rule error: {conversionRuleErrors[index]}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #edf2f7', fontSize: 12, verticalAlign: 'top' }}>
                      <button type="button" onClick={() => removeItem(index)} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div style={{ padding: 10, fontSize: 12, color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>No links yet. Drag from source and drop on destination.</div>
            )}
          </div>
        </>
      )}

      {openDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ width: 'min(760px, 92vw)', maxHeight: '80vh', overflow: 'auto', background: MAPPER_SURFACE, borderRadius: 8, border: '1px solid #d4dbe3', padding: 14, color: MAPPER_TEXT_COLOR }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Open Mapping</strong>
              <button type="button" onClick={() => setOpenDialog(false)} style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}>Close</button>
            </div>

            {availableMaps.length === 0 && <div style={{ fontSize: 12, color: MAPPER_TEXT_COLOR }}>No map files found.</div>}
            {availableMaps.length > 0 && availableMaps
              .slice()
              .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
              .map((mapping) => (
                <div key={mapping.id} style={{ border: '1px solid #e3e8ef', borderRadius: 6, marginBottom: 8, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: MAPPER_TEXT_COLOR }}>{mappingTitle(mapping)}</div>
                    <div style={{ fontSize: 12, color: MAPPER_TEXT_COLOR }}>{mapping.ruleCount || 0} rules</div>
                    <div style={{ fontSize: 11, color: MAPPER_TEXT_COLOR }}>{mapping.description || mapping.fileName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void openMapFile(mapping.id);
                      setOpenDialog(false);
                    }}
                    style={{ color: MAPPER_TEXT_COLOR, background: MAPPER_SURFACE }}
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

function isXsdWrapperNode(node) {
  const name = String(node?.name || '').toLowerCase();
  const valueType = String(node?.valueType || '').toLowerCase();
  return name === 'sequence' || name === 'choice' || name === 'all' || valueType === 'sequence' || valueType === 'choice' || valueType === 'all' || valueType === 'complextype';
}

function collectMeaningfulXsdChildren(parentPath, indexData) {
  const children = indexData.childrenByParent.get(parentPath) || [];
  const result = [];
  for (const child of children) {
    if (isXsdWrapperNode(child)) {
      result.push(...collectMeaningfulXsdChildren(child.path, indexData));
    } else {
      result.push(child);
    }
  }
  return result;
}

function resolveTypeNode(typeName, indexData) {
  const raw = String(typeName || '').trim();
  if (!raw) return null;
  const direct = indexData.nodeByPath.get(raw);
  if (direct) return direct;
  const noPrefix = raw.includes(':') ? raw.split(':').pop() : raw;
  const byNoPrefix = indexData.nodeByPath.get(noPrefix);
  if (byNoPrefix) return byNoPrefix;
  return indexData.nodeByPathLower.get(raw.toLowerCase()) || indexData.nodeByPathLower.get(noPrefix.toLowerCase()) || null;
}

function getAncestorPaths(path) {
  const raw = String(path || '').trim();
  if (!raw) return [];
  const parts = raw.split('.').filter(Boolean);
  const ancestors = [];
  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

function buildVisiblePathSet(nodes, query, labelForPath, mtFieldDefs, getXsdDisplayName) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return null;

  const visible = new Set();
  for (const node of nodes) {
    const rawPath = String(node?.path || '');
    if (!rawPath) continue;
    const searchableText = buildNodeSearchText(node, labelForPath, mtFieldDefs, getXsdDisplayName);
    if (!searchableText.includes(normalizedQuery)) continue;
    visible.add(rawPath);
    for (const ancestorPath of getAncestorPaths(rawPath)) {
      visible.add(ancestorPath);
    }
  }

  return visible;
}

function buildMatchedPathList(nodes, query, labelForPath, mtFieldDefs, getXsdDisplayName) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return [];
  const matched = [];
  for (const node of nodes) {
    const rawPath = String(node?.path || '');
    if (!rawPath) continue;
    const searchableText = buildNodeSearchText(node, labelForPath, mtFieldDefs, getXsdDisplayName);
    if (searchableText.includes(normalizedQuery)) {
      matched.push(rawPath);
    }
  }
  return matched;
}

function buildNodeSearchText(node, labelForPath, mtFieldDefs, getXsdDisplayName) {
  const rawPath = String(node?.path || '');
  const displayPath = String(labelForPath(rawPath, mtFieldDefs) || '');
  const displayName = String(getXsdDisplayName(node) || '');
  const valueType = String(node?.valueType || '');
  return `${rawPath} ${displayPath} ${displayName} ${valueType}`.toLowerCase();
}

function buildMappedVisiblePathSet(nodes, linkedPaths) {
  const visible = new Set();
  const knownPaths = new Set(nodes.map(node => String(node?.path || '')).filter(Boolean));
  for (const path of linkedPaths) {
    if (knownPaths.has(path)) visible.add(path);
    for (const ancestorPath of getAncestorPaths(path)) {
      if (knownPaths.has(ancestorPath)) visible.add(ancestorPath);
    }
  }
  return visible;
}

function normalizeMatchIndex(index, query, length) {
  if (!String(query || '').trim() || length <= 0) return -1;
  if (index < 0) return 0;
  return index % length;
}

function getAdjacentMatchIndex(index, query, length, step) {
  if (!String(query || '').trim() || length <= 0) return -1;
  const normalized = normalizeMatchIndex(index, query, length);
  return (normalized + step + length) % length;
}

function getXsdNodeChildren(node, indexData) {
  const directChildren = collectMeaningfulXsdChildren(node.path, indexData);
  if (directChildren.length > 0) return directChildren;

  const typeNode = resolveTypeNode(node.valueType, indexData);
  if (!typeNode) return [];

  const typeChildren = collectMeaningfulXsdChildren(typeNode.path, indexData);
  return typeChildren.map((child) => ({
    ...child,
    name: String(child.name || ''),
    path: `${node.path}.${String(child.name || '')}`,
  }));
}
