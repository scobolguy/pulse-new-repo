#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/compile-transaction-lifecycle-dsl.mjs --in data/transaction-lifecycle.tsl');
}

function parseArgs(argv) {
  const args = { inputPath: 'data/transaction-lifecycle.tsl' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--in' || a === '--input') {
      args.inputPath = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function tokenize(source) {
  const tokens = [];
  let i = 0;

  function push(type, value, line, col) {
    tokens.push({ type, value, line, col });
  }

  let line = 1;
  let col = 1;

  function advanceChar() {
    const ch = source[i];
    i += 1;
    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return ch;
  }

  while (i < source.length) {
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advanceChar();
      continue;
    }

    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') {
        advanceChar();
      }
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        advanceChar();
      }
      continue;
    }

    if (ch === '"') {
      const startLine = line;
      const startCol = col;
      advanceChar();
      let value = '';
      while (i < source.length) {
        const c = advanceChar();
        if (c === '"') {
          break;
        }
        if (c === '\\') {
          const next = source[i];
          if (next === '"' || next === '\\' || next === 'n' || next === 't' || next === 'r') {
            const escaped = advanceChar();
            if (escaped === 'n') value += '\n';
            else if (escaped === 't') value += '\t';
            else if (escaped === 'r') value += '\r';
            else value += escaped;
            continue;
          }
        }
        value += c;
      }
      push('string', value, startLine, startCol);
      continue;
    }

    if (ch === '-' && source[i + 1] === '>') {
      const startLine = line;
      const startCol = col;
      advanceChar();
      advanceChar();
      push('arrow', '->', startLine, startCol);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const startLine = line;
      const startCol = col;
      let value = '';
      while (i < source.length && /[A-Za-z0-9_.-]/.test(source[i])) {
        value += advanceChar();
      }
      push('ident', value, startLine, startCol);
      continue;
    }

    const startLine = line;
    const startCol = col;
    push('symbol', advanceChar(), startLine, startCol);
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.idx = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.idx + offset] || null;
  }

  next() {
    const t = this.peek();
    if (t) this.idx += 1;
    return t;
  }

  eof() {
    return this.idx >= this.tokens.length;
  }

  error(msg, token = this.peek()) {
    if (!token) {
      throw new Error(`${msg} at end of file`);
    }
    throw new Error(`${msg} at line ${token.line}, col ${token.col}`);
  }

  isKeyword(token, keyword) {
    return token && token.type === 'ident' && token.value.toLowerCase() === keyword.toLowerCase();
  }

  matchKeyword(keyword) {
    const t = this.peek();
    if (this.isKeyword(t, keyword)) {
      this.next();
      return true;
    }
    return false;
  }

  expectKeyword(keyword) {
    if (!this.matchKeyword(keyword)) {
      this.error(`Expected keyword ${keyword}`);
    }
  }

  matchSymbol(symbol) {
    const t = this.peek();
    if (t && t.type === 'symbol' && t.value === symbol) {
      this.next();
      return true;
    }
    return false;
  }

  expectSymbol(symbol) {
    if (!this.matchSymbol(symbol)) {
      this.error(`Expected symbol ${symbol}`);
    }
  }

  expectArrow() {
    const t = this.peek();
    if (!t || t.type !== 'arrow') {
      this.error('Expected ->');
    }
    this.next();
  }

  parseNameOrString() {
    const t = this.peek();
    if (!t) this.error('Expected value');
    if (t.type === 'string') {
      this.next();
      return t.value;
    }
    if (t.type === 'ident') {
      this.next();
      return t.value;
    }
    this.error('Expected string or identifier', t);
  }

  parseIdentifier() {
    const t = this.peek();
    if (!t || t.type !== 'ident') {
      this.error('Expected identifier', t);
    }
    this.next();
    return t.value;
  }

  parseClauseRaw(stopKeywords = []) {
    const pieces = [];
    let depth = 0;

    while (!this.eof()) {
      const t = this.peek();
      if (!t) break;

      if (depth === 0) {
        if (t.type === 'symbol' && t.value === ';') break;
        if (t.type === 'ident' && stopKeywords.some(k => t.value.toLowerCase() === k.toLowerCase())) {
          break;
        }
      }

      this.next();

      if (this.isKeyword(t, 'begin')) {
        depth += 1;
      } else if (this.isKeyword(t, 'end') && depth > 0) {
        depth -= 1;
      }

      if (t.type === 'string') {
        pieces.push(JSON.stringify(t.value));
      } else {
        pieces.push(t.value);
      }
    }

    return pieces.join(' ').replace(/\s+/g, ' ').trim();
  }

  parseClauseValue(stopKeywords = []) {
    const t = this.peek();
    if (!t) return null;

    if (t.type === 'string') {
      this.next();
      return t.value;
    }

    if (this.isKeyword(t, 'begin')) {
      this.next();
      const raw = this.parseClauseRaw(['end']);
      this.expectKeyword('end');
      return raw;
    }

    return this.parseClauseRaw(stopKeywords);
  }

  parseState() {
    this.expectKeyword('state');
    const name = this.parseNameOrString();

    let initial = false;
    let label = name;
    let queueName = null;
    let subflow = null;

    while (!this.eof()) {
      if (this.matchSymbol(';')) break;

      if (this.matchKeyword('initial')) {
        initial = true;
        continue;
      }

      if (this.matchKeyword('label')) {
        label = this.parseNameOrString();
        continue;
      }

      if (this.matchKeyword('queue')) {
        queueName = this.parseNameOrString();
        continue;
      }

      if (this.matchKeyword('subflow')) {
        subflow = this.parseNameOrString();
        continue;
      }

      this.error('Unexpected token in STATE declaration');
    }

    return { name, label, queueName, subflow, initial };
  }

  parseTransition() {
    this.expectKeyword('transition');
    const from = this.parseNameOrString();
    this.expectArrow();
    const to = this.parseNameOrString();
    this.expectKeyword('on');
    const event = this.parseNameOrString();

    let when = null;
    let action = null;

    while (!this.eof()) {
      if (this.matchSymbol(';')) break;

      if (this.matchKeyword('when')) {
        when = this.parseClauseValue(['action']);
        continue;
      }

      if (this.matchKeyword('action')) {
        action = this.parseClauseValue([]);
        continue;
      }

      this.error('Unexpected token in TRANSITION declaration');
    }

    return { from, to, event, when, action };
  }

  parseDescription() {
    this.expectKeyword('description');
    const value = this.parseNameOrString();
    this.expectSymbol(';');
    return value;
  }

  parseOptionalTypeArgs() {
    const items = [];
    if (!this.matchSymbol('<')) {
      return items;
    }

    while (!this.eof()) {
      items.push(this.parseNameOrString());
      if (this.matchSymbol('>')) {
        break;
      }
      this.expectSymbol(',');
    }
    return items;
  }

  parseRequiredParamList() {
    this.expectSymbol('(');
    const items = [];

    if (this.matchSymbol(')')) {
      return items;
    }

    while (!this.eof()) {
      items.push(this.parseIdentifier());
      if (this.matchSymbol(')')) {
        break;
      }
      this.expectSymbol(',');
    }
    return items;
  }

  parseMachineBody(contextKeyword) {
    this.expectKeyword('begin');

    const states = [];
    const transitions = [];
    let description = '';

    while (!this.eof()) {
      if (this.matchKeyword('end')) {
        this.matchSymbol(';');
        break;
      }

      const t = this.peek();
      if (!t) break;

      if (this.isKeyword(t, 'description')) {
        description = this.parseDescription();
        continue;
      }

      if (this.isKeyword(t, 'state')) {
        states.push(this.parseState());
        continue;
      }

      if (this.isKeyword(t, 'transition')) {
        transitions.push(this.parseTransition());
        continue;
      }

      this.error(`Unexpected token in ${contextKeyword} block`);
    }

    return {
      description,
      states,
      transitions
    };
  }

  parseFsmTemplate() {
    this.expectKeyword('fsm');
    const name = this.parseIdentifier();
    const typeParams = this.parseOptionalTypeArgs();
    const paramNames = this.parseRequiredParamList();
    const body = this.parseMachineBody('FSM');

    return {
      name,
      typeParams,
      paramNames,
      description: body.description,
      states: body.states,
      transitions: body.transitions
    };
  }

  parseInstantiation() {
    this.expectKeyword('instantiate');
    const templateName = this.parseIdentifier();
    const typeArgs = this.parseOptionalTypeArgs();
    this.expectKeyword('as');
    const instanceId = this.parseNameOrString();
    this.expectKeyword('with');

    const args = {};
    while (!this.eof()) {
      const key = this.parseIdentifier();
      this.expectSymbol('=');
      const value = this.parseNameOrString();

      if (Object.prototype.hasOwnProperty.call(args, key)) {
        this.error(`Duplicate instantiate argument ${key}`);
      }
      args[key] = value;

      if (this.matchSymbol(';')) break;
      this.expectSymbol(',');
    }

    return {
      templateName,
      typeArgs,
      instanceId,
      args
    };
  }

  parseTransaction() {
    this.expectKeyword('transaction');
    const transactionId = this.parseNameOrString();
    const body = this.parseMachineBody('TRANSACTION');

    return {
      transactionId,
      description: body.description,
      states: body.states,
      transitions: body.transitions
    };
  }

  parseDocument() {
    const templates = [];
    const instantiations = [];
    let transaction = null;

    while (!this.eof()) {
      const t = this.peek();
      if (!t) break;

      if (this.isKeyword(t, 'fsm')) {
        templates.push(this.parseFsmTemplate());
        continue;
      }

      if (this.isKeyword(t, 'instantiate')) {
        instantiations.push(this.parseInstantiation());
        continue;
      }

      if (this.isKeyword(t, 'transaction')) {
        if (transaction) {
          this.error('Only one TRANSACTION block is supported per file');
        }
        transaction = this.parseTransaction();
        continue;
      }

      this.error('Unexpected top-level token');
    }

    return {
      templates,
      instantiations,
      transaction
    };
  }
}

function assertLifecycle(model) {
  const { states, transitions } = model;

  if (!states.length) {
    throw new Error('Lifecycle must define at least one STATE');
  }

  const byName = new Map();
  for (const s of states) {
    if (byName.has(s.name)) {
      throw new Error(`Duplicate state ${s.name}`);
    }
    byName.set(s.name, s);
  }

  const initialStates = states.filter(s => s.initial);
  if (initialStates.length !== 1) {
    throw new Error(`Lifecycle must define exactly one INITIAL state (found ${initialStates.length})`);
  }

  for (const t of transitions) {
    if (!byName.has(t.from)) {
      throw new Error(`Transition references unknown from-state ${t.from}`);
    }
    if (!byName.has(t.to)) {
      throw new Error(`Transition references unknown to-state ${t.to}`);
    }
  }

  return {
    byName,
    initialState: initialStates[0].name
  };
}

function buildTopology(states, transitions) {
  const indegree = new Map();
  const outgoing = new Map();
  const predecessorLayers = new Map();

  for (const s of states) {
    indegree.set(s.name, 0);
    outgoing.set(s.name, []);
    predecessorLayers.set(s.name, []);
  }

  for (const t of transitions) {
    indegree.set(t.to, (indegree.get(t.to) || 0) + 1);
    outgoing.get(t.from).push(t.to);
    predecessorLayers.get(t.to).push(t.from);
  }

  const queue = [];
  for (const [name, degree] of indegree.entries()) {
    if (degree === 0) queue.push(name);
  }

  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    for (const m of outgoing.get(n) || []) {
      indegree.set(m, indegree.get(m) - 1);
      if (indegree.get(m) === 0) {
        queue.push(m);
      }
    }
  }

  if (order.length !== states.length) {
    throw new Error('Lifecycle graph has cycles; topological layout requires an acyclic graph');
  }

  const layerByState = new Map();
  for (const name of order) {
    const preds = predecessorLayers.get(name) || [];
    const layer = preds.length ? Math.max(...preds.map(p => layerByState.get(p) || 0)) + 1 : 0;
    layerByState.set(name, layer);
  }

  const layersMap = new Map();
  for (const [name, layer] of layerByState.entries()) {
    if (!layersMap.has(layer)) layersMap.set(layer, []);
    layersMap.get(layer).push(name);
  }

  const layers = Array.from(layersMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, stateNames]) => ({ index, stateNames }));

  return { order, layers, layerByState };
}

function substituteTemplateValue(value, bindings) {
  if (value == null) return value;
  let out = String(value);

  for (const [key, bound] of Object.entries(bindings)) {
    out = out.split('${' + key + '}').join(String(bound));
  }

  if (Object.prototype.hasOwnProperty.call(bindings, out)) {
    return String(bindings[out]);
  }

  return out;
}

function instantiateTemplate(template, instantiation) {
  if (!template) {
    throw new Error(`Unknown FSM template ${instantiation.templateName}`);
  }

  if (instantiation.typeArgs.length !== template.typeParams.length) {
    throw new Error(
      `FSM template ${template.name} expects ${template.typeParams.length} type args (got ${instantiation.typeArgs.length})`
    );
  }

  const bindings = {};
  for (const [idx, typeParam] of template.typeParams.entries()) {
    bindings[typeParam] = instantiation.typeArgs[idx];
  }

  for (const paramName of template.paramNames) {
    if (!Object.prototype.hasOwnProperty.call(instantiation.args, paramName)) {
      throw new Error(`Instantiation ${instantiation.instanceId} missing argument ${paramName}`);
    }
    bindings[paramName] = instantiation.args[paramName];
  }

  for (const argName of Object.keys(instantiation.args)) {
    if (!template.paramNames.includes(argName)) {
      throw new Error(`Instantiation ${instantiation.instanceId} has unknown argument ${argName}`);
    }
  }

  const states = template.states.map(s => ({
    name: substituteTemplateValue(s.name, bindings),
    label: substituteTemplateValue(s.label || s.name, bindings),
    queueName: s.queueName == null ? null : substituteTemplateValue(s.queueName, bindings),
    subflow: s.subflow == null ? null : substituteTemplateValue(s.subflow, bindings),
    initial: Boolean(s.initial)
  }));

  const transitions = template.transitions.map(t => ({
    from: substituteTemplateValue(t.from, bindings),
    to: substituteTemplateValue(t.to, bindings),
    event: substituteTemplateValue(t.event, bindings),
    when: t.when == null ? null : substituteTemplateValue(t.when, bindings),
    action: t.action == null ? null : substituteTemplateValue(t.action, bindings)
  }));

  const validated = assertLifecycle({ states, transitions });
  const topology = buildTopology(states, transitions);

  return {
    instanceId: instantiation.instanceId,
    templateName: template.name,
    typeArgs: instantiation.typeArgs,
    args: instantiation.args,
    description: substituteTemplateValue(template.description || '', bindings),
    initialState: validated.initialState,
    states: states.map(s => ({
      name: s.name,
      label: s.label,
      queueName: s.queueName,
      subflow: s.subflow,
      initial: Boolean(s.initial),
      layer: topology.layerByState.get(s.name) || 0
    })),
    transitions,
    topology: {
      order: topology.order,
      layers: topology.layers
    }
  };
}

function compileLifecycle(sourceText) {
  const parser = new Parser(tokenize(sourceText));
  const parsedDoc = parser.parseDocument();
  if (!parser.eof()) {
    parser.error('Unexpected trailing tokens');
  }

  if (!parsedDoc.transaction) {
    throw new Error('Lifecycle file must include one TRANSACTION block');
  }

  const parsed = parsedDoc.transaction;

  const { initialState } = assertLifecycle(parsed);
  const topology = buildTopology(parsed.states, parsed.transitions);

  const templateMap = new Map();
  for (const template of parsedDoc.templates) {
    if (templateMap.has(template.name)) {
      throw new Error(`Duplicate FSM template ${template.name}`);
    }

    assertLifecycle({ states: template.states, transitions: template.transitions });
    templateMap.set(template.name, template);
  }

  const fsmInstances = parsedDoc.instantiations.map(instantiation =>
    instantiateTemplate(templateMap.get(instantiation.templateName), instantiation)
  );
  const fsmInstanceIds = new Set(fsmInstances.map(instance => instance.instanceId));

  for (const state of parsed.states) {
    const subflowId = String(state.subflow || '').trim();
    if (!subflowId) continue;
    if (!fsmInstanceIds.has(subflowId)) {
      throw new Error(
        `State ${state.name} references unknown subflow ${subflowId}. Declare it via FSM instantiate ... as "${subflowId}"`
      );
    }
  }

  const stateByName = new Map(parsed.states.map(s => [s.name, s]));
  for (const t of parsed.transitions) {
    const fromState = stateByName.get(t.from);
    const fromSubflow = String(fromState?.subflow || '').trim();
    if (!fromSubflow) continue;

    if (t.when) {
      throw new Error(
        `Transition ${t.from} -> ${t.to} cannot use WHEN because ${t.from} is a subflow state (${fromSubflow}). Use explicit subflow result events.`
      );
    }
    if (t.action) {
      throw new Error(
        `Transition ${t.from} -> ${t.to} cannot use ACTION because ${t.from} is a subflow state (${fromSubflow}). Keep provider details inside the subflow FSM.`
      );
    }
  }

  const states = parsed.states.map(s => ({
    name: s.name,
    label: s.label || s.name,
    queueName: s.queueName || null,
    subflow: s.subflow || null,
    initial: Boolean(s.initial),
    layer: topology.layerByState.get(s.name) || 0
  }));

  const transitions = parsed.transitions.map(t => ({
    from: t.from,
    to: t.to,
    event: t.event,
    when: t.when || null,
    action: t.action || null
  }));

  const dashboard = {
    layout: 'left-to-right-topological',
    states: states.map(s => ({
      stateName: s.name,
      label: s.label,
      queueName: s.queueName,
      subflow: s.subflow,
      layer: s.layer
    })),
    edges: transitions.map(t => ({
      from: t.from,
      to: t.to,
      event: t.event
    }))
  };

  return {
    version: 1,
    compiledAt: new Date().toISOString(),
    transactionId: parsed.transactionId,
    description: parsed.description,
    fsmTemplates: parsedDoc.templates.map(template => ({
      name: template.name,
      typeParams: template.typeParams,
      paramNames: template.paramNames,
      description: template.description || '',
      stateCount: template.states.length,
      transitionCount: template.transitions.length
    })),
    fsmInstances,
    subflows: fsmInstances,
    initialState,
    states,
    transitions,
    topology: {
      order: topology.order,
      layers: topology.layers
    },
    dashboard
  };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(process.cwd(), args.inputPath);

  if (!fs.existsSync(inputPath)) {
    usage();
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const sourceText = fs.readFileSync(inputPath, 'utf-8');
  const compiled = compileLifecycle(sourceText);

  const outDir = path.dirname(inputPath);
  const compiledPath = path.join(outDir, 'transaction-lifecycle-compiled.json');
  const dashboardPath = path.join(outDir, 'transaction-lifecycle-dashboard.json');

  writeJson(compiledPath, compiled);
  writeJson(dashboardPath, compiled.dashboard);

  console.log(`[compile:lifecycle] compiled ${compiled.states.length} states, ${compiled.transitions.length} transitions`);
  console.log(`[compile:lifecycle] wrote ${path.relative(process.cwd(), compiledPath)}`);
  console.log(`[compile:lifecycle] wrote ${path.relative(process.cwd(), dashboardPath)}`);
}

try {
  main();
} catch (e) {
  console.error(`[compile:lifecycle] ${e.message}`);
  process.exit(1);
}
