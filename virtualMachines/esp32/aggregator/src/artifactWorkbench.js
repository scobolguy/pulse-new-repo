let languagesRegistered = false;

function buildWflSymbols(value) {
  const lines = String(value || '').split(/\r?\n/);
  const symbols = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    let match = line.match(/^WORKFLOW\s+"([^"]+)"/i);
    if (match) {
      symbols.push({ id: `workflow-${match[1]}`, label: match[1], kind: 'workflow', line: index + 1 });
      continue;
    }
    match = line.match(/^QUEUE\s+"([^"]+)"/i);
    if (match) {
      symbols.push({ id: `queue-${match[1]}`, label: match[1], kind: 'queue', line: index + 1 });
      continue;
    }
    match = line.match(/^API\s+"([^"]+)"/i);
    if (match) {
      symbols.push({ id: `api-${match[1]}`, label: match[1], kind: 'api', line: index + 1 });
      continue;
    }
    match = line.match(/^FILE\s+"([^"]+)"/i);
    if (match) {
      symbols.push({ id: `file-${match[1]}`, label: match[1], kind: 'file', line: index + 1 });
      continue;
    }
    match = line.match(/^STEP\s+"([^"]+)"/i);
    if (match) {
      symbols.push({ id: `step-${match[1]}-${index + 1}`, label: match[1], kind: 'step', line: index + 1 });
    }
  }
  return symbols;
}

function buildJsonSymbols(value) {
  const lines = String(value || '').split(/\r?\n/);
  const symbols = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    let match = line.match(/^"id":\s+"([^"]+)"/);
    if (match) {
      symbols.push({ id: `id-${match[1]}-${index + 1}`, label: match[1], kind: 'artifact', line: index + 1 });
      continue;
    }
    match = line.match(/^"sourcePath":\s+"([^"]+)"/);
    if (match) {
      symbols.push({ id: `source-${index + 1}`, label: match[1], kind: 'source', line: index + 1 });
      continue;
    }
    match = line.match(/^"targetPath":\s+"([^"]+)"/);
    if (match) {
      symbols.push({ id: `target-${index + 1}`, label: match[1], kind: 'target', line: index + 1 });
    }
  }
  return symbols;
}

function buildMermaidSymbols(value) {
  const lines = String(value || '').split(/\r?\n/);
  return lines
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('flowchart')) return null;
      return { id: `mermaid-${index + 1}`, label: trimmed.slice(0, 72), kind: 'node', line: index + 1 };
    })
    .filter(Boolean);
}

function extractWorkflowBlocks(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/);
  const blocks = new Map();
  let currentId = null;
  let buffer = [];
  for (const line of lines) {
    const startMatch = line.match(/^WORKFLOW\s+"([^"]+)"\s+BEGIN/i);
    if (startMatch) {
      currentId = startMatch[1];
      buffer = [line];
      continue;
    }
    if (currentId) {
      buffer.push(line);
      if (/^END;\s*$/i.test(line.trim())) {
        blocks.set(currentId, buffer.join('\n'));
        currentId = null;
        buffer = [];
      }
    }
  }
  return blocks;
}

function buildRoutingRuleTemplate() {
  return `${JSON.stringify({
    id: 'route-template-001',
    name: 'Route Template',
    serviceId: 'aggregator-router-service',
    enabled: true,
    inputQueue: 'swift.inbound',
    sourceTypeId: 'swift-mt103',
    outputTypeId: 'pacs',
    enums: {
      priority: ['low', 'normal', 'high', 'urgent'],
      routeClass: ['payment', 'audit', 'ops']
    },
    outputs: [
      {
        queueName: 'pacs.outbound',
        whenRule: {
          expressionType: 'conditional',
          language: 'pascalish',
          expression: 'IF amount > 1000 AND currency = "USD" THEN output := 1 ELSE output := 0;'
        },
        transformRule: {
          expressionType: 'string',
          language: 'pascalish',
          expression: 'output := concat(src, "|", routeClass);'
        },
        scoreRule: {
          expressionType: 'arithmetic',
          language: 'pascalish',
          expression: 'output := amount * 1.02;'
        }
      }
    ]
  }, null, 2)}\n`;
}

function buildMappingRuleTemplate() {
  return `${JSON.stringify({
    id: 'map-template-001',
    name: 'Mapping Template',
    sourceTypeId: 'pacs',
    targetTypeId: 'swift-mt103',
    sourceSchemaPath: 'schemas/pacs.008.001.14.xsd',
    targetSchemaPath: 'schemas/swift-mt103.json',
    enabled: true,
    enums: {
      chargeBearer: ['CRED', 'DEBT', 'SHAR', 'SLEV']
    },
    items: [
      {
        sourcePath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr',
        targetPath: 'MT103:71A',
        kind: 'leaf',
        sourceValueType: 'string',
        targetValueType: 'string',
        conversionRule: {
          expressionType: 'string',
          language: 'pascalish',
          expression: 'output := upper(src);'
        },
        validationRule: {
          expressionType: 'conditional',
          language: 'pascalish',
          expression: 'IF in_enum(src, chargeBearer) THEN output := 1 ELSE output := 0;'
        }
      }
    ]
  }, null, 2)}\n`;
}

export function buildPublicArtifacts({ workflowSource, workflowCards, dataMappings, flowDefinitions, routingRules = [] }) {
  const workflowBlocks = extractWorkflowBlocks(workflowSource);
  const artifacts = [];

  artifacts.push({
    id: 'workflow:full',
    name: 'workflow.wfl',
    kind: 'workflow-source',
    language: 'wfl',
    value: String(workflowSource || ''),
    symbols: buildWflSymbols(workflowSource),
    readOnly: false
  });

  for (const workflow of workflowCards || []) {
    const workflowId = String(workflow?.id || '').trim();
    if (!workflowId) continue;
    const block = workflowBlocks.get(workflowId) || `WORKFLOW "${workflowId}" BEGIN\nEND;`;
    artifacts.push({
      id: `workflow:${workflowId}`,
      name: `${workflow.name || workflowId}.wfl`,
      kind: 'workflow',
      language: 'wfl',
      value: block,
      symbols: buildWflSymbols(block),
      readOnly: false
    });
    artifacts.push({
      id: `workflow-mermaid:${workflowId}`,
      name: `${workflow.name || workflowId}.mmd`,
      kind: 'workflow-mermaid',
      language: 'mermaid',
      value: String(workflow.mermaidSource || ''),
      symbols: buildMermaidSymbols(workflow.mermaidSource),
      readOnly: false
    });
  }

  for (const flow of flowDefinitions || []) {
    const flowId = String(flow?.id || '').trim();
    if (!flowId) continue;
    artifacts.push({
      id: `flow:${flowId}`,
      name: `${flow.name || flowId}.mmd`,
      kind: 'flow',
      language: 'mermaid',
      value: String(flow.mermaidSource || ''),
      symbols: buildMermaidSymbols(flow.mermaidSource),
      readOnly: false
    });
  }

  const routingRulesText = `${JSON.stringify(routingRules || [], null, 2)}\n`;
  artifacts.push({
    id: 'routing-rules:active',
    name: 'routing-rules.json',
    kind: 'routing-rule-set',
    language: 'json',
    value: routingRulesText,
    symbols: buildJsonSymbols(routingRulesText),
    readOnly: false,
    schema: 'routing-rule-set'
  });

  artifacts.push({
    id: 'routing-rules:template',
    name: 'routing-rule-template.json',
    kind: 'routing-rule-template',
    language: 'json',
    value: buildRoutingRuleTemplate(),
    symbols: buildJsonSymbols(buildRoutingRuleTemplate()),
    readOnly: false,
    schema: 'routing-rule'
  });

  for (const mapping of dataMappings || []) {
    const mapId = String(mapping?.id || '').trim();
    if (!mapId) continue;
    const value = `${JSON.stringify(mapping, null, 2)}\n`;
    artifacts.push({
      id: `map:${mapId}`,
      name: `${mapping.name || mapId}.json`,
      kind: 'map',
      language: 'json',
      value,
      symbols: buildJsonSymbols(value),
      readOnly: false,
      schema: 'mapping-rule'
    });
  }

  artifacts.push({
    id: 'mapping-rules:template',
    name: 'mapping-rule-template.json',
    kind: 'mapping-rule-template',
    language: 'json',
    value: buildMappingRuleTemplate(),
    symbols: buildJsonSymbols(buildMappingRuleTemplate()),
    readOnly: false,
    schema: 'mapping-rule'
  });

  return artifacts;
}

export function getInitialArtifactId(cardPreview) {
  const kind = String(cardPreview?.kind || '').toLowerCase();
  const id = String(cardPreview?.item?.id || '').trim();
  if (kind === 'workflow' && id) return `workflow:${id}`;
  if (kind === 'flow' && id) return `flow:${id}`;
  return 'routing-rules:active';
}

export function registerArtifactLanguages(monaco) {
  if (languagesRegistered || !monaco) return;
  languagesRegistered = true;

  monaco.languages.register({ id: 'wfl' });
  monaco.languages.setMonarchTokensProvider('wfl', {
    tokenizer: {
      root: [
        [/\b(WORKFLOW|STEP|QUEUE|FILE|API|BEGIN|END|IF|THEN|ELSE|ENDIF|CALL|CHECK|WAIT|ROUTE|STATE|EXPECT|RETRIES|EVERY|ISSUE|TESTCASE|TESTPLAN|PROJECT|RELEASE|DEPLOYMENT|ARTIFACT|PROJECTPLAN|MILESTONE|TASK|SYNCHPOINT|DELIVERABLE|RESOURCE|FOR|LOCATION|DUE|DATE|CREATE|TITLE|DESCRIPTION|PRIORITY|ASSIGN|USER|REPORTER|TYPE|PLAN|ADD|TO|INTO|LINK|POST|GET|PUT|PATCH|DELETE)\b/, 'keyword'],
        [/"[^"]*"/, 'string'],
        [/\b\d+\b/, 'number'],
        [/#.*$/, 'comment']
      ]
    }
  });

  monaco.languages.register({ id: 'mermaid' });
  monaco.languages.setMonarchTokensProvider('mermaid', {
    tokenizer: {
      root: [
        [/\b(flowchart|graph|subgraph|end)\b/, 'keyword'],
        [/-->|-\.->|==>|==/, 'operator'],
        [/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/, 'string'],
        [/[A-Za-z_][\w-]*/, 'identifier']
      ]
    }
  });

  monaco.editor.defineTheme('pulse-artifact-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '7dcfff' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'comment', foreground: '6b7280' }
    ],
    colors: {
      'editor.background': '#0f1520',
      'editor.lineHighlightBackground': '#162132',
      'editorGutter.background': '#0f1520'
    }
  });

  const enumValueSchema = {
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' }
    }
  };

  const expressionSchema = {
    type: 'object',
    required: ['expressionType', 'language', 'expression'],
    properties: {
      expressionType: {
        type: 'string',
        enum: ['conditional', 'arithmetic', 'string']
      },
      language: {
        type: 'string',
        enum: ['pascalish', 'wfl-expression']
      },
      expression: { type: 'string' }
    }
  };

  const routingRuleSchema = {
    type: 'object',
    required: ['id', 'name', 'inputQueue', 'outputs'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      serviceId: { type: 'string' },
      enabled: { type: 'boolean' },
      inputQueue: { type: 'string' },
      sourceTypeId: { type: 'string' },
      outputTypeId: { type: 'string' },
      enums: enumValueSchema,
      outputs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['queueName'],
          properties: {
            queueName: { type: 'string' },
            whenRule: {
              oneOf: [{ type: 'string' }, expressionSchema]
            },
            transformRule: {
              oneOf: [{ type: 'string' }, expressionSchema]
            },
            scoreRule: expressionSchema
          }
        }
      }
    }
  };

  const mappingRuleSchema = {
    type: 'object',
    required: ['id', 'name', 'sourceTypeId', 'targetTypeId', 'items'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      sourceTypeId: { type: 'string' },
      targetTypeId: { type: 'string' },
      sourceSchemaPath: { type: 'string' },
      targetSchemaPath: { type: 'string' },
      enabled: { type: 'boolean' },
      enums: enumValueSchema,
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sourcePath', 'targetPath'],
          properties: {
            sourcePath: { type: 'string' },
            targetPath: { type: 'string' },
            kind: { type: 'string' },
            sourceValueType: { type: 'string' },
            targetValueType: { type: 'string' },
            conversionRule: {
              oneOf: [{ type: 'string' }, expressionSchema]
            },
            validationRule: expressionSchema
          }
        }
      }
    }
  };

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    schemas: [
      {
        uri: 'inmemory://schemas/routing-rule.schema.json',
        fileMatch: ['*routing-rule*.json', '*routing-rules*.json'],
        schema: {
          type: 'array',
          items: routingRuleSchema
        }
      },
      {
        uri: 'inmemory://schemas/mapping-rule.schema.json',
        fileMatch: ['*mapping-rule*.json', '*map:*.json', '*pacs*.json', '*mt*.json'],
        schema: mappingRuleSchema
      }
    ]
  });
}
