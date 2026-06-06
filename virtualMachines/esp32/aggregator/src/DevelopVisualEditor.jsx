import React, { useEffect, useMemo, useRef, useState } from 'react';
import SharedBlockWorkspace from './SharedBlockWorkspace';

const GRID_SIZE = 32;
const BLOCK_WIDTH = 224;
const BLOCK_HEIGHT = 92;
const STORAGE_PREFIX = 'pulse-develop-visual-graph';

const BLOCK_LIBRARY = [
  { kind: 'start', label: 'Start', tone: '#22c55e' },
  { kind: 'compute', label: 'Compute', tone: '#38bdf8' },
  { kind: 'route', label: 'Route', tone: '#f59e0b' },
  { kind: 'map', label: 'Map / Transform', tone: '#c084fc' },
  { kind: 'action', label: 'Action', tone: '#64748b' },
  { kind: 'if', label: 'If Branch', tone: '#fb7185' },
  { kind: 'while', label: 'While Loop', tone: '#f97316' },
  { kind: 'struct', label: 'Structured Type', tone: '#14b8a6' },
  { kind: 'subflow', label: 'Subflow', tone: '#a78bfa' },
  { kind: 'end', label: 'End', tone: '#ef4444' }
];

function snapToGrid(value) {
  return Math.max(GRID_SIZE, Math.round(value / GRID_SIZE) * GRID_SIZE);
}

function slugify(value, fallback = 'item') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function upperSlug(value, fallback = 'ITEM') {
  return slugify(value, fallback).toUpperCase();
}

function createNode(kind, index, x, y) {
  const id = `n${Date.now()}_${Math.floor(Math.random() * 100000)}_${index}`;
  const col = index % 4;
  const row = Math.floor(index / 4);
  const defaults = {
    start: { title: 'Start', data: {} },
    compute: { title: 'Compute', data: { expression: 'result := inputValue;' } },
    route: { title: 'Route', data: { routeName: 'primary_route', queueName: 'queue.primary', transform: 'src' } },
    map: { title: 'Map', data: { mapName: 'canonical_map', source: 'src', target: 'output', transform: 'upper(src)' } },
    action: { title: 'Action', data: { operation: 'call_service()' } },
    if: { title: 'If', data: { condition: 'is_valid' } },
    while: { title: 'While', data: { condition: 'has_more' } },
    struct: { title: 'Struct', data: { typeName: 'CustomerRecord', fields: 'id:string,amount:number' } },
    subflow: { title: 'Subflow', data: { subflowName: 'enrichment_flow' } },
    end: { title: 'End', data: {} }
  };
  const config = defaults[kind] || defaults.action;
  return {
    id,
    kind,
    title: config.title,
    x: snapToGrid(x ?? (96 + (col * 288))),
    y: snapToGrid(y ?? (80 + (row * 176))),
    data: { ...config.data }
  };
}

function createDefaultGraph() {
  const start = createNode('start', 0, 96, 96);
  const compute = createNode('compute', 1, 416, 96);
  const route = createNode('route', 2, 736, 96);
  const end = createNode('end', 3, 1056, 96);
  return {
    nodes: [start, compute, route, end],
    edges: [
      { id: `e_${start.id}_${compute.id}`, from: start.id, to: compute.id, label: '' },
      { id: `e_${compute.id}_${route.id}`, from: compute.id, to: route.id, label: '' },
      { id: `e_${route.id}_${end.id}`, from: route.id, to: end.id, label: '' }
    ]
  };
}

function nodeSummary(node) {
  if (node.kind === 'compute') return node.data.expression || 'expression';
  if (node.kind === 'route') return node.data.queueName || node.data.routeName || 'queue';
  if (node.kind === 'map') return node.data.mapName || 'map';
  if (node.kind === 'if' || node.kind === 'while') return node.data.condition || 'condition';
  if (node.kind === 'struct') return node.data.typeName || 'type';
  if (node.kind === 'subflow') return node.data.subflowName || 'subflow';
  if (node.kind === 'action') return node.data.operation || 'operation';
  return '';
}

function nodeMermaidShape(node) {
  const label = `${node.title}${nodeSummary(node) ? `\\n${nodeSummary(node)}` : ''}`.replace(/"/g, '\\"');
  if (node.kind === 'if' || node.kind === 'while') return `${node.id}{${label}}`;
  if (node.kind === 'end') return `${node.id}([${label}])`;
  return `${node.id}[${label}]`;
}

function buildEdgeMap(edges) {
  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge);
  }
  return outgoing;
}

function generateMermaid(nodes, edges) {
  const lines = ['flowchart TD'];
  for (const node of nodes) {
    lines.push(`  ${nodeMermaidShape(node)}`);
  }
  for (const edge of edges) {
    const label = String(edge.label || '').trim();
    if (label) {
      lines.push(`  ${edge.from} -->|${label.replace(/"/g, '\\"')}| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }
  }
  lines.push('  classDef io fill:#0f172a,stroke:#38bdf8,color:#e2e8f0;');
  lines.push('  classDef route fill:#1f2937,stroke:#f59e0b,color:#fde68a;');
  lines.push('  classDef map fill:#2e1065,stroke:#c084fc,color:#f5d0fe;');
  lines.push('  classDef terminal fill:#3f0d12,stroke:#ef4444,color:#fecaca;');
  const computeIds = nodes.filter((node) => node.kind === 'compute').map((node) => node.id);
  const routeIds = nodes.filter((node) => node.kind === 'route').map((node) => node.id);
  const mapIds = nodes.filter((node) => node.kind === 'map').map((node) => node.id);
  const terminalIds = nodes.filter((node) => node.kind === 'start' || node.kind === 'end').map((node) => node.id);
  if (computeIds.length > 0) lines.push(`  class ${computeIds.join(',')} io;`);
  if (routeIds.length > 0) lines.push(`  class ${routeIds.join(',')} route;`);
  if (mapIds.length > 0) lines.push(`  class ${mapIds.join(',')} map;`);
  if (terminalIds.length > 0) lines.push(`  class ${terminalIds.join(',')} terminal;`);
  return lines.join('\n');
}

function generateStructDeclarations(nodes, languageId) {
  const structNodes = nodes.filter((node) => node.kind === 'struct');
  if (structNodes.length === 0) return [];

  if (languageId === 'pascalish') {
    const lines = ['type'];
    for (const node of structNodes) {
      const typeName = upperSlug(node.data.typeName || node.title || 'record_type', 'RECORD_TYPE').toLowerCase();
      lines.push(`  ${typeName} = record`);
      const fields = String(node.data.fields || '').split(',').map((item) => item.trim()).filter(Boolean);
      if (fields.length === 0) {
        lines.push('    placeholder: string;');
      } else {
        for (const field of fields) {
          const [rawName, rawType] = field.split(':');
          const name = slugify(rawName || 'field', 'field');
          const sourceType = String(rawType || 'string').trim().toLowerCase();
          const targetType = sourceType.includes('num') || sourceType.includes('int') ? 'integer' : 'string';
          lines.push(`    ${name}: ${targetType};`);
        }
      }
      lines.push('  end;');
    }
    lines.push('');
    return lines;
  }

  if (languageId === 'cobolish') {
    const lines = ['DATA DIVISION.', 'WORKING-STORAGE SECTION.'];
    for (const [index, node] of structNodes.entries()) {
      const recordName = upperSlug(node.data.typeName || node.title || `record_${index + 1}`, `RECORD_${index + 1}`);
      lines.push(`01  ${recordName}.`);
      const fields = String(node.data.fields || '').split(',').map((item) => item.trim()).filter(Boolean);
      if (fields.length === 0) {
        lines.push(`    05  ${recordName}-PLACEHOLDER PIC X(30).`);
      } else {
        for (const field of fields) {
          const [rawName, rawType] = field.split(':');
          const name = upperSlug(rawName || 'FIELD', 'FIELD');
          const sourceType = String(rawType || 'string').trim().toLowerCase();
          const picture = sourceType.includes('num') || sourceType.includes('int') ? 'PIC 9(9).' : 'PIC X(64).';
          lines.push(`    05  ${name} ${picture}`);
        }
      }
    }
    lines.push('');
    return lines;
  }

  const lines = ['TYPE'];
  for (const node of structNodes) {
    const typeName = slugify(node.data.typeName || node.title || 'record_type', 'record_type');
    lines.push(`  "${typeName}" FIELDS "${String(node.data.fields || 'placeholder:string')}";`);
  }
  lines.push('');
  return lines;
}

function generatePascalishSource(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = buildEdgeMap(edges);
  const startNode = nodes.find((node) => node.kind === 'start') || nodes[0];
  const visited = new Set();
  const lines = [
    'program "visual_pascalish_program";',
    'role code_librarian;',
    'library "core-shared" from librarian;',
    ''
  ];

  lines.push(...generateStructDeclarations(nodes, 'pascalish'));
  lines.push('begin');

  function emit(nodeId, depth = 1) {
    if (!nodeId || visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) return;
    const indent = '  '.repeat(depth);

    if (node.kind === 'compute') {
      lines.push(`${indent}${node.data.expression || 'result := inputValue;'}`);
    } else if (node.kind === 'route') {
      lines.push(`${indent}output := ${node.data.transform || 'src'}; { route ${slugify(node.data.routeName || node.title, 'route')} to ${node.data.queueName || 'queue.out'} }`);
    } else if (node.kind === 'map') {
      lines.push(`${indent}${node.data.target || 'output'} := map("${node.data.mapName || 'canonical_map'}", ${node.data.source || 'src'}); { transform: ${node.data.transform || 'upper(src)'} }`);
    } else if (node.kind === 'action') {
      lines.push(`${indent}{ action: ${node.data.operation || 'call_service()'} }`);
    } else if (node.kind === 'subflow') {
      lines.push(`${indent}cobegin async begin`);
      lines.push(`${indent}  { subflow: ${node.data.subflowName || 'subflow'} }`);
      lines.push(`${indent}coend;`);
    } else if (node.kind === 'if') {
      const branches = outgoing.get(node.id) || [];
      const trueEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'true') || branches[0];
      const falseEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'false') || branches[1];
      lines.push(`${indent}if ${node.data.condition || 'condition'} then`);
      lines.push(`${indent}begin`);
      if (trueEdge) emit(trueEdge.to, depth + 1);
      lines.push(`${indent}end`);
      if (falseEdge) {
        lines.push(`${indent}else`);
        lines.push(`${indent}begin`);
        emit(falseEdge.to, depth + 1);
        lines.push(`${indent}end;`);
      } else {
        lines.push(`${indent};`);
      }
      return;
    } else if (node.kind === 'while') {
      const loopEdge = (outgoing.get(node.id) || [])[0];
      lines.push(`${indent}while ${node.data.condition || 'condition'} do`);
      lines.push(`${indent}begin`);
      if (loopEdge) emit(loopEdge.to, depth + 1);
      lines.push(`${indent}end;`);
      return;
    } else if (node.kind === 'end') {
      lines.push(`${indent}{ end }`);
      return;
    }

    const next = (outgoing.get(node.id) || []).find((edge) => !edge.label) || (outgoing.get(node.id) || [])[0];
    if (next) emit(next.to, depth);
  }

  if (startNode) {
    const next = (outgoing.get(startNode.id) || [])[0];
    if (next) emit(next.to, 1);
  }
  lines.push('end.');
  return lines.join('\n').replace(/[ \t]+\n/g, '\n');
}

function generateCobolishSource(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = buildEdgeMap(edges);
  const startNode = nodes.find((node) => node.kind === 'start') || nodes[0];
  const visited = new Set();
  const lines = [
    'IDENTIFICATION DIVISION.',
    'PROGRAM-ID. VISUAL-COBOLISH-PROGRAM.',
    'ENVIRONMENT DIVISION.',
    'CONFIGURATION SECTION.',
    ...generateStructDeclarations(nodes, 'cobolish'),
    'PROCEDURE DIVISION.'
  ];

  function emit(nodeId, depth = 0) {
    if (!nodeId || visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) return;
    const indent = '    '.repeat(depth + 1);

    if (node.kind === 'compute') {
      const expression = String(node.data.expression || 'RESULT = INPUT-VALUE').replace(/:=/g, '=').replace(/;/g, '');
      lines.push(`${indent}COMPUTE ${expression}`);
    } else if (node.kind === 'route') {
      lines.push(`${indent}CALL "ROUTE-MESSAGE" USING "${node.data.routeName || 'PRIMARY-ROUTE'}" "${node.data.queueName || 'QUEUE.OUT'}" END-CALL`);
    } else if (node.kind === 'map') {
      lines.push(`${indent}CALL "MAP-TRANSFORM" USING "${node.data.mapName || 'CANONICAL-MAP'}" ${upperSlug(node.data.source || 'SOURCE-DATA', 'SOURCE_DATA')} RETURNING ${upperSlug(node.data.target || 'TARGET-DATA', 'TARGET_DATA')} END-CALL`);
    } else if (node.kind === 'action') {
      lines.push(`${indent}CALL "${upperSlug(node.data.operation || 'USER-ACTION', 'USER_ACTION')}" END-CALL`);
    } else if (node.kind === 'subflow') {
      lines.push(`${indent}CALL "RUN-SUBFLOW" USING "${node.data.subflowName || 'ENRICHMENT-FLOW'}" END-CALL`);
    } else if (node.kind === 'if') {
      const branches = outgoing.get(node.id) || [];
      const trueEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'true') || branches[0];
      const falseEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'false') || branches[1];
      lines.push(`${indent}IF ${String(node.data.condition || 'IS-VALID').toUpperCase().replace(/[^A-Z0-9_-]+/g, '-')}`);
      if (trueEdge) emit(trueEdge.to, depth + 1);
      if (falseEdge) {
        lines.push(`${indent}ELSE`);
        emit(falseEdge.to, depth + 1);
      }
      lines.push(`${indent}END-IF`);
      return;
    } else if (node.kind === 'while') {
      lines.push(`${indent}PERFORM UNTIL NOT ${String(node.data.condition || 'HAS-MORE').toUpperCase().replace(/[^A-Z0-9_-]+/g, '-')}`);
      const loopEdge = (outgoing.get(node.id) || [])[0];
      if (loopEdge) emit(loopEdge.to, depth + 1);
      lines.push(`${indent}END-PERFORM`);
      return;
    } else if (node.kind === 'end') {
      lines.push(`${indent}GOBACK`);
      return;
    }

    const next = (outgoing.get(node.id) || []).find((edge) => !edge.label) || (outgoing.get(node.id) || [])[0];
    if (next) emit(next.to, depth);
  }

  if (startNode) {
    const next = (outgoing.get(startNode.id) || [])[0];
    if (next) emit(next.to, 0);
  }

  lines.push('END PROGRAM VISUAL-COBOLISH-PROGRAM.');
  return lines.join('\n');
}

function generateWorkflowSource(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = buildEdgeMap(edges);
  const startNode = nodes.find((node) => node.kind === 'start') || nodes[0];
  const visited = new Set();
  const lines = ['WORKFLOW "visual-workflow" BEGIN'];

  lines.push(...generateStructDeclarations(nodes, 'workflow'));

  function emit(nodeId, depth = 1) {
    if (!nodeId || visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) return;
    const indent = '  '.repeat(depth);

    if (node.kind === 'compute') {
      lines.push(`${indent}STEP "${slugify(node.title || 'compute', 'compute')}" SET STATE "${slugify(node.data.expression || 'computed', 'computed')}";`);
    } else if (node.kind === 'route') {
      lines.push(`${indent}STEP "${slugify(node.title || 'route', 'route')}" ROUTE QUEUE "${node.data.queueName || 'queue.primary'}";`);
    } else if (node.kind === 'map') {
      lines.push(`${indent}STEP "${slugify(node.title || 'transform', 'transform')}" CALL API "mapper" POST "/api/mapper/transform" EXPECT 200;`);
    } else if (node.kind === 'action') {
      lines.push(`${indent}STEP "${slugify(node.title || 'action', 'action')}" CALL API "service" POST "/${slugify(node.data.operation || 'execute', 'execute')}" EXPECT 200;`);
    } else if (node.kind === 'subflow') {
      lines.push(`${indent}SUBFLOW "${node.data.subflowName || 'subflow'}" BEGIN`);
      lines.push(`${indent}END;`);
    } else if (node.kind === 'if') {
      const branches = outgoing.get(node.id) || [];
      const trueEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'true') || branches[0];
      const falseEdge = branches.find((edge) => String(edge.label || '').toLowerCase() === 'false') || branches[1];
      lines.push(`${indent}IF FIELD "${node.data.condition || 'condition'}" EQUALS "true" THEN`);
      if (trueEdge) emit(trueEdge.to, depth + 1);
      if (falseEdge) {
        lines.push(`${indent}ELSE`);
        emit(falseEdge.to, depth + 1);
      }
      lines.push(`${indent}ENDIF`);
      return;
    } else if (node.kind === 'while') {
      lines.push(`${indent}COBEGIN SYNC ON ERROR BACKOUT BEGIN`);
      const loopEdge = (outgoing.get(node.id) || [])[0];
      if (loopEdge) emit(loopEdge.to, depth + 1);
      lines.push(`${indent}COEND;`);
      return;
    } else if (node.kind === 'end') {
      return;
    }

    const next = (outgoing.get(node.id) || []).find((edge) => !edge.label) || (outgoing.get(node.id) || [])[0];
    if (next) emit(next.to, depth);
  }

  if (startNode) {
    const next = (outgoing.get(startNode.id) || [])[0];
    if (next) emit(next.to, 1);
  }
  lines.push('END;');
  return lines.join('\n');
}

function generateSource(nodes, edges, languageId) {
  if (languageId === 'cobolish') return generateCobolishSource(nodes, edges);
  if (languageId === 'workflow') return generateWorkflowSource(nodes, edges);
  return generatePascalishSource(nodes, edges);
}

function MermaidPreview({ source }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!hostRef.current) return;
      try {
        const { default: mermaid } = await import('mermaid');
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base'
        });
        const renderId = `develop-visual-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { svg } = await mermaid.render(renderId, source || 'flowchart TD\n  A[Empty]');
        if (!cancelled && hostRef.current) hostRef.current.innerHTML = svg;
      } catch (error) {
        if (!cancelled && hostRef.current) {
          hostRef.current.innerHTML = `<pre style="color:#fecaca;white-space:pre-wrap;">Mermaid render failed: ${String(error?.message || error)}</pre>`;
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <div ref={hostRef} style={{ minHeight: 260 }} />;
}

export default function DevelopVisualEditor({ fileName, languageId = 'pascalish', sourceText, onApplyText }) {
  const canvasRef = useRef(null);
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${languageId}:${String(fileName || 'untitled')}`, [fileName, languageId]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [connectFrom, setConnectFrom] = useState('');
  const [connectTo, setConnectTo] = useState('');
  const [connectLabel, setConnectLabel] = useState('');
  const [dragState, setDragState] = useState(null);
  const [graphReady, setGraphReady] = useState(false);

  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const mermaidSource = useMemo(() => generateMermaid(nodes, edges), [nodes, edges]);
  const generatedSource = useMemo(() => generateSource(nodes, edges, languageId), [nodes, edges, languageId]);

  useEffect(() => {
    setGraphReady(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.nodes) && Array.isArray(parsed?.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          setSelectedNodeId(parsed.nodes[0]?.id || '');
          setConnectFrom(parsed.nodes[0]?.id || '');
          setConnectTo(parsed.nodes[1]?.id || '');
          setGraphReady(true);
          return;
        }
      }
    } catch {
      // Fall back to a fresh graph when stored content is malformed.
    }

    const graph = createDefaultGraph();
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeId(graph.nodes[0]?.id || '');
    setConnectFrom(graph.nodes[0]?.id || '');
    setConnectTo(graph.nodes[1]?.id || '');
    setGraphReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!graphReady) return;
    localStorage.setItem(storageKey, JSON.stringify({ nodes, edges }));
  }, [edges, graphReady, nodes, storageKey]);

  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
    if (selectedNodeId && !nodes.some((item) => item.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0]?.id || '');
    }
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    function handleMove(event) {
      if (!dragState) return;
      setNodes((current) => current.map((node) => {
        if (node.id !== dragState.nodeId) return node;
        return {
          ...node,
          x: snapToGrid(dragState.originX + (event.clientX - dragState.startX)),
          y: snapToGrid(dragState.originY + (event.clientY - dragState.startY))
        };
      }));
    }

    function handleUp() {
      if (dragState) setDragState(null);
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState]);

  function addNode(kind, x, y) {
    setNodes((current) => [...current, createNode(kind, current.length, x, y)]);
  }

  function addEdge(labelOverride = null) {
    if (!connectFrom || !connectTo || connectFrom === connectTo) return;
    const nextLabel = labelOverride === null ? connectLabel : labelOverride;
    setEdges((current) => {
      const existing = current.find((edge) => edge.from === connectFrom && edge.to === connectTo && String(edge.label || '') === String(nextLabel || ''));
      if (existing) return current;
      return [...current, {
        id: `e${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        from: connectFrom,
        to: connectTo,
        label: nextLabel
      }];
    });
    if (labelOverride === null) setConnectLabel('');
  }

  function removeSelectedNode() {
    if (!selectedNode) return;
    setNodes((current) => current.filter((item) => item.id !== selectedNode.id));
    setEdges((current) => current.filter((item) => item.from !== selectedNode.id && item.to !== selectedNode.id));
    setSelectedNodeId('');
  }

  function removeEdge(edgeId) {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  }

  function updateSelectedNode(patch) {
    if (!selectedNode) return;
    setNodes((current) => current.map((item) => (item.id === selectedNode.id ? { ...item, ...patch } : item)));
  }

  function updateSelectedNodeData(field, value) {
    if (!selectedNode) return;
    setNodes((current) => current.map((item) => (
      item.id === selectedNode.id
        ? { ...item, data: { ...(item.data || {}), [field]: value } }
        : item
    )));
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const kind = event.dataTransfer.getData('text/pulse-block-kind');
    if (!kind || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid(event.clientX - rect.left + canvasRef.current.scrollLeft - (BLOCK_WIDTH / 2));
    const y = snapToGrid(event.clientY - rect.top + canvasRef.current.scrollTop - (BLOCK_HEIGHT / 2));
    addNode(kind, x, y);
  }

  const supportsConditions = selectedNode?.kind === 'if';

  return (
    <SharedBlockWorkspace
      blockLibrary={BLOCK_LIBRARY}
      nodes={nodes}
      edges={edges}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
      connectFrom={connectFrom}
      connectTo={connectTo}
      connectLabel={connectLabel}
      onConnectFromChange={setConnectFrom}
      onConnectToChange={setConnectTo}
      onConnectLabelChange={setConnectLabel}
      onAddEdge={addEdge}
      onRemoveEdge={removeEdge}
      onAddNode={addNode}
      onNodeDragStart={(event, node) => {
        setDragState({
          nodeId: node.id,
          startX: event.clientX,
          startY: event.clientY,
          originX: node.x,
          originY: node.y
        });
      }}
      onNodeSelect={(nodeId) => {
        setSelectedNodeId(nodeId);
        setConnectFrom(nodeId);
      }}
      onCanvasDrop={handleCanvasDrop}
      onDeleteSelectedNode={removeSelectedNode}
      summarizeNode={nodeSummary}
      renderSelectionFields={(node) => (
        <>
          <input value={node.title || ''} onChange={(event) => updateSelectedNode({ title: event.target.value })} placeholder="Block title" />
          {node.kind === 'compute' && (
            <input value={node.data.expression || ''} onChange={(event) => updateSelectedNodeData('expression', event.target.value)} placeholder="result := inputValue;" />
          )}
          {node.kind === 'route' && (
            <>
              <input value={node.data.routeName || ''} onChange={(event) => updateSelectedNodeData('routeName', event.target.value)} placeholder="Route name" />
              <input value={node.data.queueName || ''} onChange={(event) => updateSelectedNodeData('queueName', event.target.value)} placeholder="Target queue" />
              <input value={node.data.transform || ''} onChange={(event) => updateSelectedNodeData('transform', event.target.value)} placeholder="Transform before route" />
            </>
          )}
          {node.kind === 'map' && (
            <>
              <input value={node.data.mapName || ''} onChange={(event) => updateSelectedNodeData('mapName', event.target.value)} placeholder="Map name" />
              <input value={node.data.source || ''} onChange={(event) => updateSelectedNodeData('source', event.target.value)} placeholder="Source value" />
              <input value={node.data.target || ''} onChange={(event) => updateSelectedNodeData('target', event.target.value)} placeholder="Target value" />
              <input value={node.data.transform || ''} onChange={(event) => updateSelectedNodeData('transform', event.target.value)} placeholder="Transform expression" />
            </>
          )}
          {(node.kind === 'if' || node.kind === 'while') && (
            <input value={node.data.condition || ''} onChange={(event) => updateSelectedNodeData('condition', event.target.value)} placeholder="Condition" />
          )}
          {node.kind === 'action' && (
            <input value={node.data.operation || ''} onChange={(event) => updateSelectedNodeData('operation', event.target.value)} placeholder="Operation" />
          )}
          {node.kind === 'struct' && (
            <>
              <input value={node.data.typeName || ''} onChange={(event) => updateSelectedNodeData('typeName', event.target.value)} placeholder="Type name" />
              <input value={node.data.fields || ''} onChange={(event) => updateSelectedNodeData('fields', event.target.value)} placeholder="field:type,field:type" />
            </>
          )}
          {node.kind === 'subflow' && (
            <input value={node.data.subflowName || ''} onChange={(event) => updateSelectedNodeData('subflowName', event.target.value)} placeholder="Subflow name" />
          )}
        </>
      )}
      renderRightPanel={() => (
        <>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Mermaid Preview</div>
          <MermaidPreview source={mermaidSource} />
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Generated {languageId === 'workflow' ? 'WFL' : languageId === 'cobolish' ? 'COBOLISH' : 'Pascalish'}</div>
          <textarea value={generatedSource} readOnly style={{ minHeight: 260, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12 }} />
          <button type="button" onClick={() => onApplyText?.(generatedSource)}>
            Apply Generated Source To Editor
          </button>
          <div style={{ fontSize: 11, opacity: 0.65 }}>
            Saved visual graph key: {storageKey}
          </div>
          {sourceText ? <div style={{ fontSize: 11, opacity: 0.65 }}>Text editor currently has {sourceText.length} characters.</div> : null}
        </>
      )}
      canvasRef={canvasRef}
      supportsConditionEdges={supportsConditions}
    />
  );
}
