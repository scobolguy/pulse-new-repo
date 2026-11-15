import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';
import { buildPcodeSourceMap } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-source-map.mjs';
import { SYSTEM_LIBRARY } from '../../dotnet/system-library.mjs';
import { compileVb11ToPcode } from './compile-vb11.mjs';
import { SERVICE_HOST_BINDINGS_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { createDotnetServiceContract } from '../../dotnet/service-contract.mjs';
import { HOST_CAPABILITIES_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/host-capabilities.mjs';
import { cacheConstraintError, parseCacheFields } from '../../dotnet/cache-schema.mjs';

function collectMatches(source, pattern, map) {
  const values = [];
  let match;
  while ((match = pattern.exec(source)) !== null) values.push(map(match));
  return values;
}

function storageName(value) {
  return String(value || '').trim().toUpperCase().replace(/-/g, '_');
}

function splitArguments(value) {
  const result = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (const char of String(value || '')) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) { result.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function unquote(value) {
  const raw = String(value || '').trim();
  return raw.length >= 2 && ((raw[0] === '"' && raw.endsWith('"')) || (raw[0] === "'" && raw.endsWith("'")))
    ? raw.slice(1, -1)
    : raw;
}

const PRECEDENCE = new Map([
  ['OR', 1], ['AND', 2], ['=', 3], ['<>', 3], ['<', 3], ['<=', 3], ['>', 3], ['>=', 3],
  ['+', 4], ['-', 4], ['&', 4], ['*', 5], ['/', 5]
]);
const OPCODES = new Map([
  ['OR', 'OR'], ['AND', 'AND'], ['=', 'EQ'], ['<>', 'NEQ'], ['<', 'LT'], ['<=', 'LE'], ['>', 'GT'], ['>=', 'GE'],
  ['+', 'ADD'], ['-', 'SUB'], ['&', 'STRCAT'], ['*', 'MUL'], ['/', 'DIV']
]);

function tokenizeExpression(expression) {
  return String(expression || '').match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<=|>=|<>|[()+\-*/&=<>]|\b(?:AND|OR)\b|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_-]*/gi) || [];
}

class VbishCodegen {
  constructor() {
    this.lines = ['# Auto-generated from native VBish syntax', 'JMP MAIN', 'MAIN:'];
    this.globals = new Set();
    this.labelId = 0;
  }

  emit(line) { this.lines.push(line); }
  label(prefix) { this.labelId += 1; return `VB_${prefix}_${this.labelId}`; }

  emitExpression(expression) {
    const output = [];
    const operators = [];
    for (const token of tokenizeExpression(expression)) {
      const upper = token.toUpperCase();
      if (token === '(') { operators.push(token); continue; }
      if (token === ')') {
        while (operators.length && operators.at(-1) !== '(') output.push(operators.pop());
        operators.pop();
        continue;
      }
      if (PRECEDENCE.has(upper)) {
        while (operators.length && PRECEDENCE.has(operators.at(-1)) && PRECEDENCE.get(operators.at(-1)) >= PRECEDENCE.get(upper)) output.push(operators.pop());
        operators.push(upper);
        continue;
      }
      output.push(token);
    }
    while (operators.length) output.push(operators.pop());

    for (const token of output) {
      const upper = token.toUpperCase();
      if (OPCODES.has(upper)) this.emit(OPCODES.get(upper));
      else if (/^"/.test(token) || /^'/.test(token)) this.emit(`PUSH_STR ${JSON.stringify(unquote(token))}`);
      else if (/^-?\d+$/.test(token)) this.emit(`PUSH_INT ${token}`);
      else if (/^-?\d+\.\d+$/.test(token)) this.emit(`PUSH_REAL ${token}`);
      else if (upper === 'TRUE' || upper === 'FALSE') this.emit(`PUSH_INT ${upper === 'TRUE' ? 1 : 0}`);
      else this.emit(`LOAD ${storageName(token)}`);
    }
  }

  emitDatabaseCall(name, args) {
    const operation = String(name).toUpperCase();
    const quoted = value => JSON.stringify(unquote(value));
    const database = quoted(args[0]);
    const table = quoted(args[1]);
    if (operation === 'DBINSERT') {
      const columns = unquote(args[2]);
      const values = args.slice(3);
      if (values.length !== columns.split(',').filter(Boolean).length) throw new Error('[VBISH] DbInsert requires one value per column');
      values.forEach(value => this.emitExpression(value));
      this.emit(`DB_INSERT ${database},${table},${JSON.stringify(columns)}`);
      return;
    }
    if (operation === 'DBSELECT') {
      const columns = unquote(args[2]);
      const targets = args.slice(6);
      if (targets.length !== columns.split(',').filter(Boolean).length) throw new Error('[VBISH] DbSelect requires one target per selected column');
      if (unquote(args[3])) this.emitExpression(args[5]);
      this.emit(`DB_SELECT ${database},${table},${quoted(args[2])},${quoted(args[3])},${quoted(args[4])}`);
      [...targets].reverse().forEach(target => this.emit(`STORE ${storageName(target)}`));
      return;
    }
    if (operation === 'DBUPDATE') {
      const columns = unquote(args[2]);
      const values = args.slice(6);
      if (values.length !== columns.split(',').filter(Boolean).length) throw new Error('[VBISH] DbUpdate requires one value per column');
      if (unquote(args[3])) this.emitExpression(args[5]);
      values.forEach(value => this.emitExpression(value));
      this.emit(`DB_UPDATE ${database},${table},${JSON.stringify(columns)},${quoted(args[3])},${quoted(args[4])}`);
      return;
    }
    if (unquote(args[2])) this.emitExpression(args[4]);
    this.emit(`DB_DELETE ${database},${table},${quoted(args[2])},${quoted(args[3])}`);
  }

  compileBlock(lines, startIndex = 0, terminators = []) {
    let index = startIndex;
    while (index < lines.length) {
      const line = lines[index].trim();
      const upper = line.toUpperCase();
      if (!line || upper.startsWith("'")) { index += 1; continue; }
      if (terminators.some(term => upper === term || upper.startsWith(`${term} `))) return index;
      if (/^(OPTION|PULSE |PROGRAM |DAEMON |SERVICE |ROLE |LIBRARY |USE |IMPORT |INTEROP |DATABASE |SYSTEM |SUB |FUNCTION |END SUB|END FUNCTION|END SYSTEM)/i.test(line)) { index += 1; continue; }

      const dim = line.match(/^DIM\s+([A-Za-z_][A-Za-z0-9_-]*)(?:\s+AS\s+\w+)?(?:\s*=\s*(.+))?$/i);
      if (dim) {
        const name = storageName(dim[1]);
        this.globals.add(name);
        if (dim[2]) this.emitExpression(dim[2]); else this.emit('PUSH_INT 0');
        this.emit(`STORE ${name}`);
        index += 1;
        continue;
      }

      const forMatch = line.match(/^FOR\s+([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
      if (forMatch) {
        const variable = storageName(forMatch[1]);
        const loop = this.label('FOR');
        const end = this.label('ENDFOR');
        this.globals.add(variable);
        this.emitExpression(forMatch[2]); this.emit(`STORE ${variable}`); this.emit(`${loop}:`);
        this.emit(`LOAD ${variable}`); this.emitExpression(forMatch[3]); this.emit('LE'); this.emit(`JZ ${end}`);
        const bodyEnd = this.compileBlock(lines, index + 1, ['NEXT']);
        this.emit(`LOAD ${variable}`); this.emitExpression(forMatch[4] || '1'); this.emit('ADD'); this.emit(`STORE ${variable}`);
        this.emit(`JMP ${loop}`); this.emit(`${end}:`);
        index = bodyEnd + 1;
        continue;
      }

      const whileMatch = line.match(/^WHILE\s+(.+)$/i);
      if (whileMatch) {
        const loop = this.label('WHILE');
        const end = this.label('ENDWHILE');
        this.emit(`${loop}:`); this.emitExpression(whileMatch[1]); this.emit(`JZ ${end}`);
        const bodyEnd = this.compileBlock(lines, index + 1, ['END WHILE']);
        this.emit(`JMP ${loop}`); this.emit(`${end}:`);
        index = bodyEnd + 1;
        continue;
      }

      const print = line.match(/^(?:PRINT|DISPLAY)\s+(.+)$/i);
      if (print) {
        splitArguments(print[1]).forEach(value => { this.emitExpression(value); this.emit('PRINT'); });
        this.emit('PRINT_NL');
        index += 1;
        continue;
      }

      const dml = line.match(/^(DbInsert|DbSelect|DbUpdate|DbDelete)\s*\((.*)\)$/i);
      if (dml) { this.emitDatabaseCall(dml[1], splitArguments(dml[2])); index += 1; continue; }

      const queueWrite = line.match(/^(QueueWriteSync|QueueWriteAsync)\s*\((.*)\)$/i);
      if (queueWrite) {
        const args = splitArguments(queueWrite[2]);
        if (args.length !== 2) throw new Error(`[VBISH] ${queueWrite[1]} requires a queue symbol and message`);
        this.emitExpression(args[1]);
        this.emit('ROUTE_SET_MESSAGE');
        this.emit(`${queueWrite[1].toUpperCase() === 'QUEUEWRITESYNC' ? 'QUEUE_WRITE_SYNC' : 'QUEUE_WRITE_ASYNC'} ${JSON.stringify(unquote(args[0]))}`);
        index += 1;
        continue;
      }

      const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+)$/);
      if (assignment) {
        const name = storageName(assignment[1]);
        this.globals.add(name);
        this.emitExpression(assignment[2]); this.emit(`STORE ${name}`);
      }
      index += 1;
    }
    return index;
  }

  build(source) {
    this.compileBlock(String(source || '').split(/\r?\n/));
    this.emit('HALT');
    return { pcodeText: `${this.lines.join('\n')}\n`, globals: [...this.globals] };
  }
}

export function compileVbishToPcode(sourceText, options = {}) {
  if (options.profile === 'vb11') return compileVb11ToPcode(sourceText, options);
  if (options.profile && options.profile !== 'pulse') throw new Error(`[VBISH] Unknown language profile '${options.profile}'`);
  const cacheDeclarations = collectMatches(sourceText,
    /^\s*PULSE\s+CACHE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+CAPACITY\s+(\d+)\s+EVERY\s+(\d+)\s+(MS|S|M|SECOND|SECONDS)(?:\s+STORAGE\s+(RAM|FFS))?(?:\s+MODE\s+(PERSISTENT|UPDATEABLE))?(?:\s+FIELDS\s+(?:"([^"]+)"|'([^']+)'))?(?:\s+UNIQUE\s+BY\s+([A-Za-z_][A-Za-z0-9_]*))?(?:\s+LATEST\s+BY\s+([A-Za-z_][A-Za-z0-9_]*))?\s*$/gim,
    match => {
      const schema = match[9] || match[10];
      const parsed = schema ? parseCacheFields(schema) : { fields: [], error: null };
      if (parsed.error) throw new Error(`[VBISH] ${parsed.error}`);
      const uniqueBy = match[11] || '';
      const latestBy = match[12] || '';
      const constraintError = parsed.fields.length ? cacheConstraintError(parsed.fields, uniqueBy, latestBy) : null;
      if (constraintError) throw new Error(`[VBISH] ${constraintError}`);
      const cache = {
        name: String(match[1] || match[2] || match[3] || ''),
        capacity: Number(match[4]),
        ttlMs: Number(match[5]) * ({ MS: 1, S: 1000, SECOND: 1000, SECONDS: 1000, M: 60000 }[match[6].toUpperCase()] || 1),
        storage: match[7] || 'RAM', mode: match[8] || 'PERSISTENT', fields: parsed.fields,
        ...(uniqueBy ? { uniqueBy } : {}), ...(latestBy ? { latestBy } : {})
      };
      if (cache.capacity !== 50) throw new Error('[VBISH] PULSE CACHE capacity must be 50');
      return cache;
    });
  const virtualCacheDeclarations = collectMatches(sourceText,
    /^\s*PULSE\s+VIRTUAL\s+CACHE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+SOURCES\s+(?:"([^"]+)"|'([^']+)')(?:\s+STORAGE\s+(RAM|FFS))?(?:\s+MODE\s+(PERSISTENT|UPDATEABLE))?\s*$/gim,
    match => ({
      name: String(match[1] || match[2] || match[3] || ''),
      sources: String(match[4] || match[5] || '').split(',').map(source => source.trim()).filter(Boolean),
      capacity: 50, fields: [], virtual: true, storage: match[6] || 'RAM', mode: match[7] || 'PERSISTENT'
    }));
  const sourceForParser = sourceText.replace(/^\s*PULSE\s+(?:VIRTUAL\s+)?CACHE\b.*$/gim, '');
  const native = compileVbishWithAntlr(sourceForParser, options);
  if (!native.valid) throw new Error(`[VBISH] Parse failed:\n${native.syntaxErrors.join('\n')}`);
  const built = new VbishCodegen().build(sourceText);
  const runtime = native.runtime || { kind: 'program', id: options.fileName?.replace(/\.[^.]+$/, '') || 'vbish-program', placement: 'local' };
  const endpointDeclarations = collectMatches(sourceText, /\bENDPOINT\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))(?:\s+HANDLER\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*)))?/gi,
    match => ({
      verb: String(match[1] || match[2] || match[3] || '').toUpperCase(),
      path: String(match[4] || match[5] || match[6] || ''),
      ...(match[7] || match[8] || match[9] ? { handler: String(match[7] || match[8] || match[9]) } : {})
    }));
  if (endpointDeclarations.some(endpoint => !['GET', 'POST'].includes(endpoint.verb)
      || !endpoint.path.startsWith('/') || endpoint.path.length > 256)) {
    throw new Error('[VBISH] Service endpoints require GET or POST and an absolute path of 256 characters or fewer');
  }
  if (endpointDeclarations.length && runtime.kind !== 'service') {
    throw new Error('[VBISH] ENDPOINT declarations require a SERVICE runtime');
  }
  const declaredProcedures = new Set(collectMatches(sourceText,
    /^\s*(?:SUB|FUNCTION)\s+([A-Za-z_][A-Za-z0-9_-]*)/gim,
    match => match[1].toUpperCase()));
  for (const endpoint of endpointDeclarations) {
    if (endpoint.handler && !declaredProcedures.has(endpoint.handler.toUpperCase())) {
      throw new Error(`[VBISH] Service endpoint handler not found: ${endpoint.handler}`);
    }
  }
  const concreteSystems = (native.systems || []).filter(system => !system.abstract);
  const flattenMembers = (system) => (system.members || []).flatMap(member =>
    member.kind === 'system' ? flattenMembers(member) : [{ ...member, systemId: system.systemId }]
  );
  const systemMembers = concreteSystems.flatMap(flattenMembers);
  const hosted = ['service', 'daemon'].includes(runtime.kind);
  const runtimeUnit = { kind: runtime.kind, id: runtime.id, refreshMs: runtime.interval || null };
  for (const cache of cacheDeclarations) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(cache.name) || cache.capacity < 1
      || !Number.isSafeInteger(cache.ttlMs) || cache.ttlMs < 1)
      throw new Error('[VBISH] PULSE CACHE requires a valid name, positive capacity, and positive interval');
  }
  for (const cache of virtualCacheDeclarations) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(cache.name) || cache.sources.length < 1
      || cache.sources.some(source => !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(source))
      || !['RAM', 'FFS'].includes(cache.storage) || !['PERSISTENT', 'UPDATEABLE'].includes(cache.mode))
      throw new Error('[VBISH] PULSE VIRTUAL CACHE requires a name and valid sources');
  }
  const cacheNames = [...cacheDeclarations, ...virtualCacheDeclarations].map(cache => cache.name);
  if (new Set(cacheNames).size !== cacheNames.length) throw new Error('[VBISH] Cache names must be unique within a node');
  return {
    language: 'vbish',
    sourceLanguage: 'vbish',
    compilerPipeline: 'vbish-to-pcode',
    runtimeUnit,
    native,
    pcodeText: built.pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceLanguage: 'vbish',
      executionModel: 'vbish-program',
      runtimeUnit,
      libraries: [{ id: SYSTEM_LIBRARY.id, version: SYSTEM_LIBRARY.version }],
      globals: built.globals,
      sourceMap: buildPcodeSourceMap({
        pcodeText: built.pcodeText,
        sourceText,
        sourceFile: options.fileName || null,
        sourceLanguage: 'vbish'
      }),
      symbols: {
        databases: native.databases || [],
        systems: native.systems || [],
        queues: systemMembers.filter(member => member.kind === 'queue'),
        services: systemMembers.filter(member => member.kind === 'service')
      },
      entryLabel: 'MAIN'
      ,
      ...(cacheDeclarations.length || virtualCacheDeclarations.length
        ? { hostCaches: [...cacheDeclarations, ...virtualCacheDeclarations] } : {}),
      ...(hosted ? {
        ...createDotnetServiceContract({ id: runtime.id, endpoints: endpointDeclarations }),
        hostBindingsVersion: SERVICE_HOST_BINDINGS_VERSION,
        hostCapabilitiesVersion: HOST_CAPABILITIES_VERSION
      } : {})
    }
  };
}
