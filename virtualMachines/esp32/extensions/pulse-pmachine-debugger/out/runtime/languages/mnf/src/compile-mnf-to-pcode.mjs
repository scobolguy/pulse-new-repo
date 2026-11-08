import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFortran } from './parse.mjs';
import { generateFortranPcode } from './codegen.mjs';

export const MNF_STARTER = [
  '      PROGRAM NOSTALGIA',
  '      INTEGER I,ISUM',
  '      ISUM=0',
  '      DO 100 I=1,10',
  '      ISUM=ISUM+I',
  '  100 CONTINUE',
  "      PRINT, 'SUM = ',ISUM",
  '      END'
].join('\n');

function fail(line, message) { throw new Error(`MNF line ${line}: ${message}`); }

export function readFixedForm(source) {
  const statements = [];
  for (const [index, raw] of String(source).split(/\r?\n/).entries()) {
    const line = index + 1;
    if (/^[Cc*!]/.test(raw) || !raw.trim()) continue;
    if (raw.includes('\t')) fail(line, 'Tabs are not supported in fixed-form source; use spaces');
    const label = raw.slice(0, 5).trim();
    if (label && (!/^\d{1,5}$/.test(label) || Number(label) === 0)) fail(line, 'Invalid statement label in columns 1-5');
    const continuation = raw.length > 5 && ![' ', '0'].includes(raw[5]);
    const text = raw.slice(6, 72);
    if (continuation) {
      if (label || !statements.length) fail(line, 'Continuation requires a preceding statement and no label');
      statements.at(-1).text += text;
    } else if (text.trim()) statements.push({ line, label: label ? String(Number(label)) : '', text });
    else if (raw.trim()) fail(line, 'Statement text must start in column 7');
  }
  return statements;
}

function tokenize(text, line) {
  const tokens = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (/\s/.test(text[cursor])) { cursor++; continue; }
    const rest = text.slice(cursor);
    const string = /^'(?:''|[^'])*'/.exec(rest) || /^"(?:""|[^"])*"/.exec(rest);
    if (string) {
      tokens.push({ kind: 'string', value: string[0].slice(1, -1).replaceAll(string[0][0].repeat(2), string[0][0]) });
      cursor += string[0].length;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/.exec(rest);
    if (number) {
      tokens.push({ kind: 'number', value: number[0] });
      cursor += number[0].length;
      continue;
    }
    const name = /^[A-Za-z][A-Za-z0-9]*/.exec(rest);
    if (name) {
      tokens.push({ kind: 'name', value: name[0].toUpperCase() });
      cursor += name[0].length;
      continue;
    }
    const operator = /^(?:\*\*|[()+\-*/,=])/.exec(rest);
    if (!operator) fail(line, `Unsupported character or syntax near ${JSON.stringify(rest)}`);
    tokens.push({ kind: 'operator', value: operator[0] });
    cursor += operator[0].length;
  }
  return tokens;
}

export function compileMnfStarterToPcode(source, { fileName = 'program.ftn' } = {}) {
  const statements = readFixedForm(source);
  const code = [], sourceMap = {}, types = new Map(), loops = [], labels = new Set(), targets = [];
  let sourceLine = 1, serial = 0, programId = path.basename(fileName, path.extname(fileName));
  let ended = false, executable = false, header = false;
  const emit = instruction => {
    if (!instruction.endsWith(':')) sourceMap[Object.keys(sourceMap).length] = {
      sourceLine, sourceFile: fileName, sourceLanguage: 'mnf'
    };
    code.push(instruction);
  };
  const fresh = () => `__MNF_${serial++}`;
  const variable = name => {
    if (!/^[A-Z][A-Z0-9]{0,5}$/.test(name)) fail(sourceLine, `Names must contain 1-6 letters/digits and start with a letter: ${name}`);
    if (!types.has(name)) types.set(name, /^[I-N]/.test(name) ? 'integer' : 'real');
    return types.get(name);
  };
  function expression(tokens) {
    let position = 0;
    const peek = value => tokens[position]?.value === value;
    function primary() {
      const token = tokens[position++];
      if (!token) fail(sourceLine, 'Expected expression');
      if (token.kind === 'number') {
        const real = /[.Ee]/.test(token.value), value = Number(token.value);
        if (!Number.isFinite(value) || (!real && (!Number.isSafeInteger(value) || value > 2147483647)))
          fail(sourceLine, 'Numeric literal exceeds the p-machine range');
        emit(`${real ? 'PUSH_REAL' : 'PUSH_INT'} ${value}`);
        return { type: real ? 'real' : 'integer' };
      }
      if (token.kind === 'name') {
        const type = variable(token.value);
        emit(`LOAD_NAME ${token.value}`);
        return { type };
      }
      if (token.value === '(') {
        const result = sum();
        if (!peek(')')) fail(sourceLine, 'Expected closing parenthesis');
        position++;
        return result;
      }
      fail(sourceLine, 'Expected numeric expression');
    }
    function power() {
      const left = primary();
      if (peek('**')) {
        position++;
        const exponent = tokens[position++];
        if (exponent?.kind !== 'number' || !/^\d+$/.test(exponent.value) || Number(exponent.value) > 31)
          fail(sourceLine, 'Starter exponent must be an integer constant from 0 to 31');
        const temp = fresh();
        emit(`STORE_NAME ${temp}`);
        emit(`${left.type === 'real' ? 'PUSH_REAL' : 'PUSH_INT'} 1`);
        for (let i = 0; i < Number(exponent.value); i++) { emit(`LOAD_NAME ${temp}`); emit('MUL'); }
      }
      return left;
    }
    function unary() {
      if (peek('+') || peek('-')) {
        const sign = tokens[position++].value;
        if (sign === '-') emit('PUSH_INT 0');
        const result = unary();
        if (sign === '-') emit('SUB');
        return result;
      }
      return power();
    }
    function product() {
      let left = unary();
      while (peek('*') || peek('/')) {
        const op = tokens[position++].value, right = unary();
        emit(op === '*' ? 'MUL' : 'DIV');
        left = { type: left.type === 'real' || right.type === 'real' ? 'real' : 'integer' };
      }
      return left;
    }
    function sum() {
      let left = product();
      while (peek('+') || peek('-')) {
        const op = tokens[position++].value, right = product();
        emit(op === '+' ? 'ADD' : 'SUB');
        left = { type: left.type === 'real' || right.type === 'real' ? 'real' : 'integer' };
      }
      return left;
    }
    const result = sum();
    if (position !== tokens.length) fail(sourceLine, `Unsupported expression near ${tokens[position].value}`);
    return result;
  }
  const split = tokens => {
    const groups = [[]];
    let depth = 0;
    for (const token of tokens) {
      if (token.kind === 'operator' && token.value === '(') depth++;
      if (token.kind === 'operator' && token.value === ')') depth--;
      if (depth < 0) fail(sourceLine, 'Unbalanced parentheses');
      if (token.kind === 'operator' && token.value === ',' && depth === 0) groups.push([]);
      else groups.at(-1).push(token);
    }
    if (depth || groups.some(group => !group.length)) fail(sourceLine, 'Empty item or unbalanced parentheses');
    return groups;
  };
  for (const statement of statements) {
    sourceLine = statement.line;
    if (ended) fail(sourceLine, 'Statements after END are not supported');
    const text = statement.text.trim();
    if (statement.label) {
      if (labels.has(statement.label)) fail(sourceLine, `Duplicate label ${statement.label}`);
      labels.add(statement.label);
      emit(`MNF_LABEL_${statement.label}:`);
    }
    let match;
    if ((match = /^PROGRAM\s+([A-Z][A-Z0-9]*)$/i.exec(text))) {
      if (header || executable || types.size || statement.label) fail(sourceLine, 'PROGRAM must be the first statement');
      header = true;
      programId = match[1].toUpperCase();
    } else if ((match = /^(INTEGER|REAL)\s+(.+)$/i.exec(text))) {
      if (executable) fail(sourceLine, 'Declarations must precede executable statements');
      const type = match[1].toLowerCase();
      for (const part of match[2].split(',')) {
        const name = part.trim().toUpperCase();
        if (types.has(name)) fail(sourceLine, `Duplicate declaration ${name}`);
        variable(name);
        types.set(name, type);
      }
    } else if (/^END$/i.test(text)) {
      if (loops.length) fail(sourceLine, `Unterminated DO ${loops.at(-1).label}`);
      emit('HALT');
      ended = true;
    } else {
      executable = true;
      if ((match = /^DO\s*(\d+)\s*([A-Z][A-Z0-9]*)\s*=\s*(.+)$/i.exec(text))) {
        const name = match[2].toUpperCase(), label = String(Number(match[1]));
        if (variable(name) !== 'integer') fail(sourceLine, 'Starter DO variable must be INTEGER');
        if (loops.some(loop => loop.name === name)) fail(sourceLine, 'Nested DO cannot reuse its control variable');
        if (labels.has(label)) fail(sourceLine, 'DO terminal label must follow the DO statement');
        const values = split(tokenize(match[3], sourceLine));
        if (values.length < 2 || values.length > 3) fail(sourceLine, 'DO requires start, limit and optional constant step');
        const stepText = values[2]?.map(token => token.value).join('') ?? '1';
        if (!/^[+-]?\d+$/.test(stepText) || Number(stepText) === 0 || Math.abs(Number(stepText)) > 2147483647)
          fail(sourceLine, 'DO step must be a nonzero INTEGER constant');
        if (expression(values[0]).type !== 'integer') fail(sourceLine, 'DO start must be INTEGER');
        emit(`STORE_NAME ${name}`);
        const limit = fresh(), start = fresh(), exit = fresh();
        if (expression(values[1]).type !== 'integer') fail(sourceLine, 'DO limit must be INTEGER');
        emit(`STORE_NAME ${limit}`);
        // FORTRAN 66-style DO executes its body before testing the incremented value.
        emit(`${start}:`);
        loops.push({ name, label, limit, start, exit, step: Number(stepText) });
      } else if ((match = /^PRINT\s*,\s*(.+)$/i.exec(text))) {
        for (const item of split(tokenize(match[1], sourceLine))) {
          if (item.length === 1 && item[0].kind === 'string') emit(`PUSH_STR ${JSON.stringify(item[0].value)}`);
          else expression(item);
          emit('PRINT');
        }
        emit('PRINT_NL');
      } else if (/^CONTINUE$/i.test(text)) {
        emit('NOP');
      } else if (/^STOP(?:\s+\d+)?$/i.test(text)) {
        emit('HALT');
      } else if ((match = /^GO\s*TO\s+(\d+)$/i.exec(text))) {
        const label = String(Number(match[1]));
        targets.push({ label, line: sourceLine });
        emit(`JMP MNF_LABEL_${label}`);
      } else if ((match = /^([A-Z][A-Z0-9]*)\s*=\s*(.+)$/i.exec(text))) {
        const name = match[1].toUpperCase(), type = variable(name);
        if (loops.some(loop => loop.name === name)) fail(sourceLine, 'Assignment to active DO variable is not supported');
        const value = expression(tokenize(match[2], sourceLine));
        if (type === 'integer' && value.type === 'real') fail(sourceLine, 'REAL-to-INTEGER assignment is not supported yet');
        if (type === 'real' && value.type === 'integer') { emit('PUSH_REAL 0'); emit('ADD'); }
        emit(`STORE_NAME ${name}`);
      } else fail(sourceLine, `Unsupported statement: ${text}`);
    }
    if (statement.label && loops.some(loop => loop.label === statement.label)) {
      if (loops.at(-1).label !== statement.label) fail(sourceLine, 'Crossed DO ranges');
      if (!/^CONTINUE$/i.test(text)) fail(sourceLine, 'Starter DO terminal statement must be CONTINUE');
      while (loops.at(-1)?.label === statement.label) {
        const loop = loops.pop();
        emit(`LOAD_NAME ${loop.name}`); emit(`PUSH_INT ${loop.step}`); emit('ADD'); emit(`STORE_NAME ${loop.name}`);
        emit(`LOAD_NAME ${loop.name}`); emit(`LOAD_NAME ${loop.limit}`); emit(loop.step > 0 ? 'LE' : 'GE');
        emit(`JZ ${loop.exit}`); emit(`JMP ${loop.start}`); emit(`${loop.exit}:`);
      }
    }
  }
  if (!ended) fail(sourceLine, 'Program requires END');
  for (const target of targets) if (!labels.has(target.label)) fail(target.line, `Undefined label ${target.label}`);
  const runtimeUnit = { kind: 'program', id: programId, refreshMs: null };
  return {
    language: 'mnf', programId, runtimeUnit, compiledAt: new Date().toISOString(),
    pcodeText: code.join('\n') + '\n',
    programMap: {
      version: 1, sourceLanguage: 'mnf', runtimeUnit, globals: [...types.keys()],
      procedures: {}, entries: [], sourceMap
    }
  };
}

export function compileMnfToPcode(source, { fileName = 'program.ftn', standard = 'auto' } = {}) {
  if (!['auto', 'starter', 'fortran77'].includes(standard)) throw new Error(`Unknown FORTRAN standard: ${standard}`);
  if (standard === 'starter') return compileMnfStarterToPcode(source, { fileName });
  if (standard === 'auto') {
    try {
      return compileMnfStarterToPcode(source, { fileName });
    } catch (error) {
      if (!(error instanceof Error) || !/^MNF line \d+:/.test(error.message)) throw error;
    }
  }
  return generateFortranPcode(parseFortran(source, { fileName }).units, { fileName, sourceText: String(source) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [input, output, standard = 'auto'] = process.argv.slice(2);
    if (!input || !output) throw new Error('Usage: node compile-mnf-to-pcode.mjs input.ftn output.pcode [auto|starter|fortran77]');
    const artifact = compileMnfToPcode(await fs.readFile(input, 'utf8'), { fileName: path.basename(input), standard });
    await fs.writeFile(output, artifact.pcodeText);
    await fs.writeFile(output.replace(/(?:\.pcode)?$/, '.program.json'), JSON.stringify(artifact.programMap, null, 2) + '\n');
    console.log(`Compiled ${input} -> ${output}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
