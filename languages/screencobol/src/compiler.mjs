import antlr4 from 'antlr4';
import Lexer from '../grammar/generated/ScreenCobolLexer.js';
import Parser from '../grammar/generated/ScreenCobolParser.js';
import { buildPcodeSourceMap } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-source-map.mjs';
import { REQUESTER_BINDINGS_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/requester-bindings.mjs';

const nameOf = ctx => ctx.getText().toUpperCase();
const stringOf = ctx => {
  const raw = ctx.getText();
  return raw.slice(1, -1).split(raw[0].repeat(2)).join(raw[0]);
};
function bounded(value, min, max, label) {
  const n = Number(value.getText());
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${label}: ${n}`);
  return n;
}

export function compileScreenCobol(source, { fileName = null } = {}) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 32768) throw new Error('SCREEN COBOL source exceeds 32 KiB');
  const errors = [];
  const listener = { syntaxError: (_r, _o, line, col, message) => errors.push(`${line}:${col + 1}: ${message}`) };
  const lexer = new Lexer(new antlr4.InputStream(source));
  lexer.removeErrorListeners(); lexer.addErrorListener(listener);
  const parser = new Parser(new antlr4.CommonTokenStream(lexer));
  parser.removeErrorListeners(); parser.addErrorListener(listener);
  const tree = parser.program();
  if (errors.length) throw new Error(`SCREEN COBOL parse failed:\n${errors.join('\n')}`);
  const fields = {};
  const screens = {};
  const lines = [];
  const locations = [];
  const emit = (text, line = 1) => { lines.push(text); locations.push(line); };
  const field = ctx => {
    const name = nameOf(ctx);
    if (!Object.hasOwn(fields, name)) throw new Error(`Undefined working-storage item ${name}`);
    return name;
  };
  for (const item of tree.item()) {
    const name = nameOf(item.name());
    if (name === 'FILLER' || Object.hasOwn(fields, name)) throw new Error(`Duplicate/invalid item ${name}`);
    const width = item.integer() ? bounded(item.integer(), 1, 512, 'item width') : 1;
    const value = item.string() ? stringOf(item.string()) : '';
    if (!/^[\x20-\x7e]*$/.test(value) || value.length > width) throw new Error(`Invalid initial value for ${name}`);
    fields[name] = { width, value: value.padEnd(width) };
    emit(`PUSH_STR ${JSON.stringify(fields[name].value)}`, item.start.line);
    emit(`STORE ${name}`, item.start.line);
  }
  for (const screen of tree.screen()) {
    const name = nameOf(screen.name());
    if (Object.hasOwn(screens, name)) throw new Error(`Duplicate screen ${name}`);
    const dimensions = screen.integer();
    const rows = dimensions.length ? bounded(dimensions[0], 1, 60, 'screen rows') : 24;
    const columns = dimensions.length ? bounded(dimensions[1], 1, 160, 'screen columns') : 80;
    const entries = [];
    const used = new Set();
    const names = new Set();
    for (const entry of screen.field()) {
      const namesInEntry = entry.name();
      const label = nameOf(namesInEntry[0]);
      if (label !== 'FILLER' && names.has(label)) throw new Error(`Duplicate screen field ${label}`);
      names.add(label);
      const ints = entry.integer();
      const row = bounded(ints[0], 1, rows, 'row');
      const column = bounded(ints[1], 1, columns, 'column');
      const literal = entry.string() ? stringOf(entry.string()) : null;
      const binding = literal === null ? field(namesInEntry[1]) : null;
      const width = literal !== null ? literal.length : ints[2] ? bounded(ints[2], 1, 512, 'screen width') : 1;
      if (!width || column + width - 1 > columns || (binding && fields[binding].width !== width)) {
        throw new Error(`Screen field ${label} has incompatible width`);
      }
      if (literal !== null && !/^[\x20-\x7e]+$/.test(literal)) throw new Error('Screen literals must be printable ASCII');
      for (let col = column; col < column + width; col++) {
        const key = `${row}:${col}`;
        if (used.has(key)) throw new Error(`Overlapping screen fields at ${key}`);
        used.add(key);
      }
      entries.push({ label, row, column, width, literal, binding,
        direction: entry.direction()?.getText().toUpperCase() ?? 'FROM' });
    }
    screens[name] = { rows, columns, fields: entries };
  }
  if (Object.keys(fields).length > 64 || Object.keys(screens).length !== 1) {
    throw new Error('Requester requires one screen and at most 64 working-storage items');
  }
  const statements = tree.statement();
  let firstScreen = null;
  let stopped = false;
  for (const statement of statements) {
    if (stopped) throw new Error('Statement after STOP RUN');
    const line = statement.start.line;
    const kind = statement.constructor.name;
    if (kind === 'DisplayStatementContext' || kind === 'AcceptStatementContext') {
      const name = nameOf(statement.name());
      if (!Object.hasOwn(screens, name)) throw new Error(`Undefined screen ${name}`);
      firstScreen ??= name;
      const operation = kind === 'DisplayStatementContext' ? 'display' : 'accept';
      for (const entry of screens[name].fields) {
        if (entry.binding && (operation === 'display' || entry.direction !== 'FROM')) {
          emit(`PUSH_STR ${JSON.stringify(entry.binding)}`, line);
          if (operation === 'display') emit(`LOAD ${entry.binding}`, line);
          emit(`CALL_EXT screen.${operation} ${operation === 'display' ? 2 : 1}`, line);
          emit(`STORE ${operation === 'accept' ? entry.binding : '__discard'}`, line);
        }
      }
    } else if (kind === 'MoveStatementContext') {
      const name = field(statement.name());
      const value = stringOf(statement.string());
      if (!/^[\x20-\x7e]*$/.test(value) || value.length > fields[name].width) throw new Error(`Invalid MOVE value for ${name}`);
      emit(`PUSH_STR ${JSON.stringify(value.padEnd(fields[name].width))}`, line);
      emit(`STORE ${name}`, line);
    } else if (kind === 'SendStatementContext') {
      const [input, output] = statement.name().map(field);
      const serverClass = stringOf(statement.string());
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(serverClass)) throw new Error('Invalid server class');
      emit(`PUSH_STR ${JSON.stringify(serverClass)}`, line);
      emit(`LOAD ${input}`, line);
      emit(`PUSH_INT ${bounded(statement.integer(), 0, 32767, 'reply code')}`, line);
      emit('CALL_EXT pathway.send 3', line);
      emit(`STORE ${output}`, line);
    } else if (kind === 'StopStatementContext') {
      emit('HALT', line);
      stopped = true;
    } else throw new Error(`Unsupported SCREEN COBOL statement ${kind}`);
  }
  if (!stopped || !firstScreen) throw new Error('Requester requires a screen and final STOP RUN');
  const pcodeText = `${lines.join('\n')}\n`;
  return { pcodeText, programMap: {
    version: 1, sourceLanguage: 'screencobol', executionModel: 'pathway-requester',
    requesterBindingsVersion: REQUESTER_BINDINGS_VERSION,
    entryLabel: null, screenCobol: { id: nameOf(tree.name()), fields, screens, initialScreen: firstScreen },
    sourceMap: buildPcodeSourceMap({ pcodeText, sourceText: source, sourceFile: fileName,
      sourceLanguage: 'screencobol', sourceLineByAddress: locations }),
  } };
}
