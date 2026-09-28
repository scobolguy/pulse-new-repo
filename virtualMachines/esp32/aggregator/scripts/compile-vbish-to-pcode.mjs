import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';
import { buildPcodeSourceMap } from './pcode-source-map.mjs';

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
  const native = compileVbishWithAntlr(sourceText, options);
  if (!native.valid) throw new Error(`[VBISH] Parse failed:\n${native.syntaxErrors.join('\n')}`);
  const built = new VbishCodegen().build(sourceText);
  const runtime = native.runtime || { kind: 'program', id: options.fileName?.replace(/\.[^.]+$/, '') || 'vbish-program', placement: 'local' };
  const concreteSystems = (native.systems || []).filter(system => !system.abstract);
  const flattenMembers = (system) => (system.members || []).flatMap(member =>
    member.kind === 'system' ? flattenMembers(member) : [{ ...member, systemId: system.systemId }]
  );
  const systemMembers = concreteSystems.flatMap(flattenMembers);
  return {
    language: 'vbish',
    sourceLanguage: 'vbish',
    compilerPipeline: 'vbish-to-pcode',
    runtimeUnit: { kind: runtime.kind, id: runtime.id, refreshMs: runtime.interval || null },
    native,
    pcodeText: built.pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceLanguage: 'vbish',
      executionModel: 'vbish-program',
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
    }
  };
}
