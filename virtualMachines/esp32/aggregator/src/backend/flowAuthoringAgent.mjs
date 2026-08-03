function cleanToken(value) {
  return String(value || '').trim().replace(/^[<'"`]+|[>'"`,.;:]+$/g, '');
}

export function normalizeFlowTypeId(value) {
  const token = cleanToken(value).toLowerCase().replace(/\s+/g, '');
  if (/^(?:swift-?)?mt\d{3}$/.test(token)) {
    return `swift-${token.match(/mt\d{3}$/)[0]}`;
  }
  if (/^pacs(?:\.|-)?\d{3}/.test(token)) return 'pacs';
  if (/^pain(?:\.|-)?\d{3}/.test(token)) return 'pain';
  if (/^camt(?:\.|-)?\d{3}/.test(token)) return 'camt';
  return token.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractQueue(prompt, patterns) {
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.groups?.queue) return cleanToken(match.groups.queue);
  }
  return '';
}

export function parseFlowAuthoringPrompt(promptText) {
  const prompt = String(promptText || '').trim();
  const inputQueue = extractQueue(prompt, [
    /\b(?:read|consume|listen\s+to)\s+(?:from\s+)?(?:the\s+)?queue\s+<?(?<queue>[a-z0-9._/-]+)>?/i,
    /\bfrom\s+(?:the\s+)?queue\s+<?(?<queue>[a-z0-9._/-]+)>?/i,
  ]);
  const outputQueue = extractQueue(prompt, [
    /\b(?:the\s+)?output\s+is\s+to\s+go\s+to\s+(?:the\s+)?queue\s+<?(?<queue>[a-z0-9._/-]+)>?/i,
    /\b(?:output(?:\s+is)?(?:\s+to)?|send(?:\s+the)?\s+output\s+to|write\s+to)\s+(?:the\s+)?queue\s+<?(?<queue>[a-z0-9._/-]+)>?/i,
    /\b(?:into|to)\s+(?:the\s+)?output\s+queue\s+<?(?<queue>[a-z0-9._/-]+)>?/i,
  ]);

  const typeToken = '(?:swift[- ]?)?mt\\s*\\d{3}|(?:pacs|pain|camt)(?:[.-]\\d{3})?(?:[.-]\\d{3})?(?:[.-]\\d{2,3})?';
  const conversionPattern = new RegExp(`(?:\\b(?:convert|map|transform)\\s+)?(?<source>${typeToken})\\s+(?:messages?\\s+)?(?:to|into|->)\\s+(?<target>${typeToken})`, 'gi');
  const conversions = [];
  const seen = new Set();
  for (const match of prompt.matchAll(conversionPattern)) {
    const sourceTypeId = normalizeFlowTypeId(match.groups?.source);
    const targetTypeId = normalizeFlowTypeId(match.groups?.target);
    if (!sourceTypeId || !targetTypeId || sourceTypeId === targetTypeId) continue;
    const key = `${sourceTypeId}->${targetTypeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    conversions.push({ sourceTypeId, targetTypeId });
  }

  const missing = [];
  if (!inputQueue) missing.push('input queue');
  if (conversions.length === 0) missing.push('at least one conversion such as MT103 to PACS.008');
  if (!outputQueue) missing.push('output queue');

  return {
    inputQueue,
    outputQueue,
    conversions,
    inputTypeIds: Array.from(new Set(conversions.map(item => item.sourceTypeId))),
    outputTypeIds: Array.from(new Set(conversions.map(item => item.targetTypeId))),
    missing,
  };
}

function nodeId(prefix, value) {
  const suffix = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${suffix || 'node'}`;
}

function safeArtifactName(value) {
  return String(value || 'bob-authored-flow').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function pcodeQuoted(value) {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function messageTypeForSource(sourceTypeId) {
  const match = String(sourceTypeId || '').match(/(?:^|-)mt(\d{3})$/i);
  return match ? `MT${match[1]}` : String(sourceTypeId || '').toUpperCase();
}

export function buildAuthoredFlowPcodeArtifacts({ flowName, request, maps }) {
  const artifactName = safeArtifactName(flowName);
  const programId = `${artifactName}-service`;
  const pcodeFileName = `${artifactName}.pcode`;
  const programMapFileName = `${artifactName}.program.json`;
  const lines = [
    '# Auto-generated pcode for BOB-authored typed mapper flow',
    'ENTRY:',
    `ROUTE_MATCH_QUEUE "${pcodeQuoted(request.inputQueue)}"`,
    'JZ FINISH',
  ];

  maps.forEach((map, index) => {
    const nextLabel = `MAPPER_BRANCH_${index + 1}`;
    const messageType = messageTypeForSource(map.sourceTypeId);
    lines.push(
      `ROUTE_EVAL_WHEN "FIELD_EQUALS(messageType, \\"${pcodeQuoted(messageType)}\\")"`,
      `JZ ${nextLabel}`,
      `ROUTE_TRANSFORM "output := map(\\"${pcodeQuoted(map.id)}\\", src);"`,
      `ROUTE_EMIT "${pcodeQuoted(request.outputQueue)}"`,
      'JMP FINISH',
      `${nextLabel}:`,
      'NOP',
    );
  });
  lines.push('FINISH:', 'HALT', '');

  const routerOutputs = maps.map(map => ({
    queueName: request.outputQueue,
    dataTypeIds: [map.targetTypeId],
    dataTypeId: map.targetTypeId,
    whenRule: `FIELD_EQUALS(messageType, "${messageTypeForSource(map.sourceTypeId)}")`,
    transformRule: `output := map("${map.id}", src);`,
  }));
  const mapperEntries = maps.map((map, index) => ({
    kind: 'mapper',
    id: map.id,
    label: `MAPPER_${index}_${String(map.id).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
    sourceTypeId: map.sourceTypeId,
    targetTypeId: map.targetTypeId,
    itemCount: Array.isArray(map.rules) ? map.rules.length : 0,
    items: (Array.isArray(map.rules) ? map.rules : []).map(rule => ({
      sourcePath: rule.sourcePath,
      targetPath: rule.targetPath,
      conversionRule: rule.conversionRule || '',
    })),
  }));
  const programMap = {
    version: 1,
    generatedAt: new Date().toISOString(),
    serviceId: programId,
    runtimeUnit: { kind: 'service', id: programId, refreshMs: null },
    entryLabel: 'ENTRY',
    finishLabel: 'FINISH',
    instructionSubset: ['ROUTE_MATCH_QUEUE', 'ROUTE_EVAL_WHEN', 'ROUTE_TRANSFORM', 'ROUTE_EMIT', 'JMP', 'JZ', 'NOP', 'HALT'],
    entries: [{
      kind: 'router',
      id: `${artifactName}-router`,
      label: 'ENTRY',
      inputQueue: request.inputQueue,
      inputDataTypeIds: request.inputTypeIds,
      outputs: routerOutputs,
    }, ...mapperEntries],
  };

  return { programId, pcodeFileName, programMapFileName, pcodeText: lines.join('\n'), programMap };
}

export function buildAuthoredFlowDocument({ flowName, request, maps }) {
  const safeName = safeArtifactName(flowName);
  const inputNodeId = nodeId('queue', request.inputQueue);
  const outputNodeId = nodeId('queue', request.outputQueue);
  const nodes = [
    {
      id: inputNodeId,
      label: request.inputQueue,
      kind: 'queue',
      flowNodeType: 'queue',
      type: 'queue',
      config: { queueName: request.inputQueue, inputShape: '', outputShape: request.inputTypeIds.join(','), retryPolicy: '', delayMs: '' },
      x: 40,
      y: 180,
      target: null,
    },
  ];
  const edges = [];

  maps.forEach((map, index) => {
    const mapperNodeId = nodeId('mapper', map.id);
    nodes.push({
      id: mapperNodeId,
      label: map.name || map.id,
      kind: 'mapper',
      flowNodeType: 'mapper',
      type: 'mapper',
      config: {
        inputSchema: map.sourceTypeId,
        outputSchema: map.targetSchemaName || map.targetTypeId,
        ruleset: map.id,
      },
      x: 310,
      y: 70 + (index * 150),
      target: null,
    });
    edges.push({
      id: `edge-${inputNodeId}-${mapperNodeId}`,
      from: inputNodeId,
      to: mapperNodeId,
      type: 'message-broker-call',
      label: map.sourceTypeId,
    });
    edges.push({
      id: `edge-${mapperNodeId}-${outputNodeId}`,
      from: mapperNodeId,
      to: outputNodeId,
      type: 'queue-edge',
      label: map.targetTypeId,
    });
  });

  nodes.push({
    id: outputNodeId,
    label: request.outputQueue,
    kind: 'queue',
    flowNodeType: 'queue',
    type: 'queue',
    config: { queueName: request.outputQueue, inputShape: request.outputTypeIds.join(','), outputShape: '', retryPolicy: '', delayMs: '' },
    x: 650,
    y: 180,
    target: null,
  });

  return {
    kind: 'pulse.canvas.generic-flow',
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    meta: { name: `${safeName}.flw`, canvasModel: 'generic-node-edge', domain: 'flow-designer', authoredBy: 'bob-console' },
    settings: { defaultEdgeType: 'message-broker-call' },
    libraries: { nodeTypes: [], edgeTypes: [] },
    subflows: [],
    nodes,
    edges,
  };
}
