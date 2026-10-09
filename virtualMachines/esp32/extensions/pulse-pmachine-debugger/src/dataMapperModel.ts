export type JsonObject = { [key: string]: unknown };

export type MappingRule = JsonObject & {
  sourcePath: string;
  targetPath: string;
  conversionRule?: string;
};

export type MappingDocument = JsonObject & {
  rules?: MappingRule[];
  items?: MappingRule[];
};

export type Field = { path: string; kind: 'leaf' | 'branch'; valueType: string; depth: number };
export type MappingAction =
  | { type: 'connect'; sourcePath: string; targetPath: string }
  | { type: 'remove'; index: number }
  | { type: 'conversion'; index: number; conversionRule: string };

export function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseMapping(text: string): MappingDocument {
  const value: unknown = JSON.parse(text);
  if (!object(value)) throw new Error('Expected one mapping object, not a mapping collection.');
  for (const key of ['rules', 'items']) {
    if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(`${key} must be an array.`);
  }
  const key = Array.isArray(value.rules) ? 'rules' : 'items';
  if (!Array.isArray(value[key])) throw new Error('The mapping must contain a rules or items array.');
  const rules = value[key].map((rule: unknown) => {
    if (!object(rule)) throw new Error('Each mapping rule must be an object.');
    const sourcePath = rule.sourcePath || rule.from;
    const targetPath = rule.targetPath || rule.to;
    // An explicitly cleared conversionRule takes precedence over a legacy conversion.
    const conversionRule = rule.conversionRule ?? rule.conversion;
    if (typeof sourcePath !== 'string' || !sourcePath.trim()
      || typeof targetPath !== 'string' || !targetPath.trim()
      || (conversionRule !== undefined && typeof conversionRule !== 'string')) {
      throw new Error('Each rule needs sourcePath and targetPath strings and an optional conversionRule string.');
    }
    return { ...rule, sourcePath, targetPath, ...(conversionRule === undefined ? {} : { conversionRule }) };
  });
  return { ...value, [key]: rules };
}

export function rulesOf(map: MappingDocument): MappingRule[] {
  return map.rules ?? map.items ?? [];
}

export function fieldsOf(map: MappingDocument, side: 'source' | 'target'): Field[] {
  const fields: Field[] = [];
  function visit(node: unknown, prefix: string, depth: number): void {
    if (!object(node) || !Array.isArray(node.children)) return;
    for (const child of node.children) {
      if (!object(child) || typeof child.name !== 'string' || !child.name) {
        throw new Error(`${side}Structure contains a field without a name.`);
      }
      const fieldPath = prefix ? `${prefix}.${child.name}` : child.name;
      fields.push({ path: fieldPath, depth, kind: child.kind === 'branch' ? 'branch' : 'leaf',
        valueType: typeof child.valueType === 'string' ? child.valueType : 'unknown' });
      visit(child, fieldPath, depth + 1);
    }
  }
  visit(map[`${side}Structure`], '', 0);
  for (const rule of rulesOf(map)) {
    const fieldPath = side === 'source' ? rule.sourcePath : rule.targetPath;
    if (!fields.some(field => field.path === fieldPath)) {
      fields.push({ path: fieldPath, depth: fieldPath.split('.').length - 1,
        kind: rule.kind === 'branch' ? 'branch' : 'leaf',
        valueType: typeof rule[`${side}ValueType`] === 'string' ? String(rule[`${side}ValueType`]) : 'unknown' });
    }
  }
  return fields;
}

export function applyMappingAction(map: MappingDocument, input: unknown): MappingDocument {
  if (!object(input)) throw new Error('Invalid designer action.');
  const key = map.rules ? 'rules' : 'items';
  const rules = [...rulesOf(map)];
  if (input.type === 'connect') {
    const source = fieldsOf(map, 'source').find(field => field.path === input.sourcePath);
    const target = fieldsOf(map, 'target').find(field => field.path === input.targetPath);
    if (!source || !target) throw new Error('Select an existing source and target field.');
    if (source.kind !== target.kind) throw new Error('Connect leaf fields to leaves, or branches to branches.');
    if (rules.some(rule => rule.sourcePath === source.path && rule.targetPath === target.path)) {
      throw new Error('These fields are already connected.');
    }
    rules.push({ sourcePath: source.path, targetPath: target.path, kind: source.kind,
      sourceValueType: source.valueType, targetValueType: target.valueType, conversionRule: '' });
  } else if (input.type === 'remove' || input.type === 'conversion') {
    if (typeof input.index !== 'number' || !Number.isInteger(input.index) || !rules[input.index]) {
      throw new Error('The selected mapping no longer exists.');
    }
    if (input.type === 'remove') rules.splice(input.index, 1);
    else {
      if (typeof input.conversionRule !== 'string' || input.conversionRule.length > 1000) {
        throw new Error('Conversion rules must be strings of at most 1000 characters.');
      }
      validateConversionRule(input.conversionRule);
      rules[input.index] = { ...rules[input.index], conversionRule: input.conversionRule };
      if ('conversion' in rules[input.index]) rules[input.index].conversion = input.conversionRule;
    }
  } else throw new Error('Unknown designer action.');
  return { ...map, [key]: rules };
}

export function emptyMapping(): MappingDocument {
  return { id: '', name: 'New mapping', description: '', rules: [], submaps: [] };
}

export function publicationPayload(map: MappingDocument): JsonObject {
  for (const key of ['id', 'name', 'sourceTypeId', 'targetTypeId', 'sourceSchemaPath', 'targetSchemaPath']) {
    if (typeof map[key] !== 'string' || !String(map[key]).trim()) throw new Error(`${key} is required before publishing or running.`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(String(map.id))) {
    throw new Error('Map ID must contain only letters, numbers, underscores and hyphens (no service-local names).');
  }
  const rules = rulesOf(map).map(rule => ({ ...rule,
    ...(rule.conversion !== undefined ? { conversion: rule.conversionRule ?? '' } : {}),
    conversionRule: rule.conversionRule ?? '',
  }));
  if (!rules.length) throw new Error('Connect at least one pair of fields before publishing or running.');
  const pairs = new Set<string>();
  const fields = { source: fieldsOf(map, 'source'), target: fieldsOf(map, 'target') };
  const schemaFields = {
    source: fieldsOf({ ...map, rules: [], items: [] }, 'source'),
    target: fieldsOf({ ...map, rules: [], items: [] }, 'target'),
  };
  for (const rule of rules) {
    const pair = JSON.stringify([rule.sourcePath, rule.targetPath]);
    if (pairs.has(pair)) throw new Error(`Duplicate mapping: ${rule.sourcePath} -> ${rule.targetPath}`);
    pairs.add(pair);
    validateConversionRule(rule.conversionRule);
    const sourceField = fields.source.find(field => field.path === rule.sourcePath);
    const targetField = fields.target.find(field => field.path === rule.targetPath);
    if (sourceField && targetField && sourceField.kind !== targetField.kind) {
      throw new Error(`Incompatible field shapes: ${rule.sourcePath} -> ${rule.targetPath}`);
    }
    if (sourceField && targetField && sourceField.valueType.toLowerCase() !== targetField.valueType.toLowerCase()
      && sourceField.valueType !== 'unknown' && targetField.valueType !== 'unknown' && !rule.conversionRule.trim()) {
      throw new Error(`Type conversion ${rule.sourcePath} -> ${rule.targetPath} requires a Pascalish routine.`);
    }
    for (const side of ['source', 'target'] as const) {
      const structure = map[`${side}Structure`];
      if (object(structure) && Array.isArray(structure.children)) {
        const available = schemaFields[side];
        if (!available.some(field => field.path === rule[`${side}Path`])) {
          throw new Error(`${side} field is no longer in the selected schema: ${rule[`${side}Path`]}`);
        }
      }
    }
  }
  return {
    id: map.id, name: map.name, description: map.description ?? '',
    sourceTypeId: String(map.sourceTypeId).toLowerCase(), targetTypeId: String(map.targetTypeId).toLowerCase(),
    sourceSchemaPath: map.sourceSchemaPath, targetSchemaPath: map.targetSchemaPath,
    sourceSchemaMtime: map.sourceSchemaMtime ?? '', targetSchemaMtime: map.targetSchemaMtime ?? '',
    sourceStructure: map.sourceStructure ?? null, targetStructure: map.targetStructure ?? null,
    rules, submaps: map.submaps ?? [],
  };
}

export function validateConversionRule(text: string): void {
  if (!text.trim()) return;
  if (text.length > 1000) throw new Error('Conversion rules must be at most 1000 characters.');
  if (!/^[\w\s.,()'"\[\]{};:\-+*/%<>=!|&?#@\\~`]+$/.test(text)) {
    throw new Error('Conversion rule contains unsupported characters.');
  }
  const stack: string[] = [];
  let quote = '';
  let escaped = false;
  for (const ch of text) {
    if (quote) {
      if (!escaped && ch === quote) quote = '';
      escaped = !escaped && ch === '\\';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if ('([{'.includes(ch)) stack.push(ch);
    else if (')]}'.includes(ch) && stack.pop() !== ({ ')': '(', ']': '[', '}': '{' }[ch])) {
      throw new Error('Conversion rule has unbalanced delimiters.');
    }
  }
  if (quote || stack.length) throw new Error('Conversion rule has unbalanced quotes or delimiters.');
  if (!/:=|[A-Za-z_]\w*\s*[=(]|\b(if|then|else|while|do|for|to|begin|end|var|call|not)\b/i.test(text)) {
    throw new Error('Conversion rule needs an assignment, function call, or Pascalish keyword.');
  }
}

export function samePublishedMapping(left: MappingDocument, right: MappingDocument): boolean {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (!object(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return JSON.stringify(canonical(publicationPayload(left))) === JSON.stringify(canonical(publicationPayload(right)));
}

export function prototypeMapping(): MappingDocument {
  const leaf = (name: string, valueType = 'string') => ({ name, kind: 'leaf', valueType });
  return {
    id: 'vscode-prototype', name: 'Payment mapping prototype', enabled: true,
    sourceTypeId: 'prototype-payment', targetTypeId: 'prototype-transfer',
    sourceSchemaPath: 'prototype/payment', targetSchemaPath: 'prototype/transfer',
    sourceStructure: { children: [
      leaf('reference'), leaf('senderName'), leaf('account'),
      leaf('amount', 'decimal'), leaf('currency'), leaf('valueDate', 'date'),
    ] },
    targetStructure: { children: [{ name: 'transfer', kind: 'branch', valueType: 'object', children: [
      leaf('id'), leaf('debtorName'), leaf('debtorAccount'),
      leaf('instructedAmount', 'decimal'), leaf('currency'), leaf('settlementDate', 'date'),
    ] }] },
    rules: [{ sourcePath: 'reference', targetPath: 'transfer.id', kind: 'leaf',
      sourceValueType: 'string', targetValueType: 'string', conversionRule: '' }],
  };
}
