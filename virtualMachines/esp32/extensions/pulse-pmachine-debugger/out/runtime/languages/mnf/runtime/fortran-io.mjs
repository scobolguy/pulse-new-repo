import { FortranRuntimeError, render, resolveFormat, walk } from './fortran-library.mjs';

const number = value => value && typeof value === 'object' && 'real' in value ? value.real : Number(value);
const failure = message => { throw new FortranRuntimeError(message); };
const records = text => {
  const rows = String(text).split(/\r?\n/);
  if (rows.at(-1) === '') rows.pop();
  return rows;
};
const decodeRecords = text => text === null || text === undefined ? []
  : text.startsWith('PULSE-FORTRAN-UNFORMATTED\n')
    ? JSON.parse(text.slice('PULSE-FORTRAN-UNFORMATTED\n'.length)) : records(text);
const empty = (tag, length) => tag === 'C' ? ' '.repeat(length) : tag === 'R' || tag === 'D'
  ? { real: 0, ...(tag === 'D' ? { double: true } : {}) } : 0;
const parseNumber = (field, descriptor, mode) => {
  let text = field.trim();
  text = mode.blankZero ? text.replaceAll(' ', '0') : text.replaceAll(' ', '');
  if (!text) return 0;
  if (/^[+-]?\.?(?:[eEdD][+-]?\d+)?$/.test(text)) return 0;
  text = text.replace(/[dD]/, 'E').replace(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([+-]\d+)$/, '$1E$2');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) failure(`Invalid numeric input ${JSON.stringify(field)}`);
  let result = Number(text);
  if (descriptor && descriptor.t !== 'I') {
    if (!text.split(/[eE]/)[0].includes('.')) result *= 10 ** -descriptor.d;
    if (!/[eE]/.test(text)) result *= 10 ** -mode.scale;
  }
  if (!Number.isFinite(result)) failure(`Numeric input out of range: ${field}`);
  return result;
};

class InputReader {
  constructor(file, format) {
    this.file = file;
    this.spec = format === undefined ? undefined : resolveFormat(format);
    this.position = 0;
    this.mode = { scale: 0, blankZero: file.blank === 'ZERO' };
    this.pending = [];
    this.advance();
    if (this.spec) this.iterator = walk(this.spec);
  }

  advance() {
    if (this.file.cursor >= this.file.rows.length || this.file.rows[this.file.cursor] === null) {
      const error = new FortranRuntimeError('End of file');
      error.status = -1;
      throw error;
    }
    this.record = this.file.rows[this.file.cursor++];
    this.position = 0;
  }

  field(width) {
    const text = String(this.record).slice(this.position, this.position + width).padEnd(width);
    this.position += width;
    return text;
  }

  token() {
    if (this.pending.length) return this.pending.shift();
    if (this.terminated) return null;
    for (;;) {
      let text = String(this.record);
      while (this.position < text.length && /\s/.test(text[this.position])) this.position++;
      if (this.position >= text.length) { this.advance(); continue; }
      if (text[this.position] === '/') { this.terminated = true; return null; }
      if (text[this.position] === ',') { this.position++; return null; }
      let start = this.position, token = '';
      let quote = null, depth = 0;
      for (;;) {
        if (this.position >= text.length) {
          token += text.slice(start);
          if (!quote && !depth) break;
          this.advance(); text = String(this.record); start = 0;
          continue;
        }
        const c = text[this.position];
        if (quote) {
          if (c === quote) {
            if (text[this.position + 1] === quote) this.position++;
            else quote = null;
          }
        } else if (c === "'" || c === '"') quote = c;
        else if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (!depth && /[\s,/]/.test(c)) { token += text.slice(start, this.position); break; }
        this.position++;
      }
      if (quote || depth) failure('Unterminated list-directed input value');
      while (/\s/.test(text[this.position] || '') && this.position < text.length) this.position++;
      if (text[this.position] === ',') this.position++;
      const repeat = /^(\d+)\*(.*)$/.exec(token);
      if (repeat) {
        const count = Number(repeat[1]);
        if (count < 1 || count > 100000) failure('Invalid list-directed repetition');
        token = repeat[2] || null;
        this.pending = Array(count - 1).fill(token);
      }
      return token;
    }
  }

  read(tag, length) {
    if (this.spec === undefined) {
      if (!Array.isArray(this.record)) failure('Unformatted READ requires an unformatted record');
      if (this.position >= this.record.length) failure('Unformatted record is too short');
      const item = this.record[this.position++];
      if (item.tag !== tag) failure(`Unformatted input type ${item.tag} does not match ${tag}`);
      return item.value;
    }
    let field, descriptor = null;
    if (this.spec === null) {
      field = this.token();
      if (field === null) return null;
    } else {
      let reverted = false;
      for (;;) {
        const next = this.iterator.next();
        if (next.done) {
          if (reverted) failure('Input FORMAT contains no data descriptor');
          const group = [...this.spec].reverse().find(item => item.t === 'group');
          this.iterator = walk(group ? this.spec.slice(this.spec.indexOf(group)) : this.spec);
          this.advance();
          reverted = true;
          continue;
        }
        const edit = next.value;
        if (['I', 'F', 'E', 'D', 'G', 'L', 'A'].includes(edit.t)) {
          descriptor = edit;
          field = this.field(edit.w ?? length);
          break;
        }
        switch (edit.t) {
          case '/': this.advance(); break;
          case 'X': case 'TR': this.position += edit.n; break;
          case 'TL': this.position = Math.max(0, this.position - edit.n); break;
          case 'T': this.position = edit.n - 1; break;
          case 'P': this.mode.scale = edit.k; break;
          case 'BN': this.mode.blankZero = false; break;
          case 'BZ': this.mode.blankZero = true; break;
          case 'lit': failure('Character literal edit descriptor is not allowed in an input FORMAT'); break;
          default: break;
        }
      }
    }
    if (tag === 'C') {
      if (descriptor && descriptor.t !== 'A') failure('CHARACTER input requires an A descriptor');
      let text = field;
      if (!descriptor && /^['"]/.test(text)) {
        const quote = text[0];
        if (text.at(-1) !== quote) failure('Unterminated character input');
        text = text.slice(1, -1).replaceAll(quote + quote, quote);
      }
      if (descriptor && field.length > length) text = field.slice(-length);
      return text.padEnd(length).slice(0, length);
    }
    if (tag === 'L') {
      if (descriptor && descriptor.t !== 'L') failure('LOGICAL input requires an L descriptor');
      const text = field.trim().replace(/^\./, '').toUpperCase();
      if (!/^[TF]/.test(text)) failure(`Invalid LOGICAL input ${JSON.stringify(field)}`);
      return text[0] === 'T' ? 1 : 0;
    }
    if (descriptor && !(tag === 'I' ? descriptor.t === 'I' : 'FEDG'.includes(descriptor.t)))
      failure(`Input descriptor ${descriptor.t} is incompatible with ${tag}`);
    const value = parseNumber(field, descriptor, this.mode);
    if (tag === 'I') {
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) failure('INTEGER input out of range');
      return value;
    }
    return { real: tag === 'D' ? value : Math.fround(value), ...(tag === 'D' ? { double: true } : {}) };
  }
}

async function connected(state, io) {
  const control = state.control;
  if (control.has('INTERNAL')) return {
    rows: records(control.get('INTERNAL')), cursor: 0, internal: true, form: 'FORMATTED',
    recl: number(control.get('RECL')), access: 'SEQUENTIAL',
  };
  const unit = number(control.get('UNIT'));
  if (!Number.isSafeInteger(unit) || unit < 0) failure(`Invalid file unit ${unit}`);
  state.units ??= new Map();
  if (!state.units.has(unit)) {
    const file = `fort.${unit}`;
    const text = unit === 5 ? io.stdin : unit === 6 ? '' : await io.files.read(file);
    state.units.set(unit, { unit, file, rows: decodeRecords(text), cursor: 0,
      form: control.has('FMT') ? 'FORMATTED' : 'UNFORMATTED', access: 'SEQUENTIAL', preconnected: unit === 5 || unit === 6 });
  }
  const file = state.units.get(unit);
  if (control.has('REC')) {
    if (file.access !== 'DIRECT') failure('REC requires a DIRECT access file');
    const record = number(control.get('REC'));
    if (!Number.isSafeInteger(record) || record < 1) failure('REC must be a positive INTEGER');
    file.cursor = record - 1;
  } else if (file.access === 'DIRECT') failure('DIRECT I/O requires REC');
  return file;
}

async function persist(file, io) {
  if (!file.preconnected && !file.internal && !file.scratch && file.file)
    await io.files.write(file.file, file.form === 'UNFORMATTED'
      ? 'PULSE-FORTRAN-UNFORMATTED\n' + JSON.stringify(file.rows)
      : file.rows.filter(row => row !== null).join('\n') + (file.rows.length ? '\n' : ''));
}

const IO_ARITIES = {
  iobegin: 0, iocontrol: 2, readbegin: 0, readvalue: 2, readend: 0, write: 0,
  internalrecord: 1, iostatus: 0, open: 0, close: 0, rewind: 0, backspace: 0, endfile: 0,
  inquire: 0, inquiry: 1, readpresent: 0,
};

export function isFortranIoIntrinsic(name) {
  return Object.hasOwn(IO_ARITIES, name.slice(8));
}

export async function executeFortranIoIntrinsic(name, args, state, io) {
  const op = name.slice(8);
  if (args.length !== IO_ARITIES[op]) failure(`Invalid argument count for ${name}`);
  const push = value => ({ push: true, value });
  if (op === 'iobegin') {
    state.control = new Map(); state.ioStatus = 0; state.reader = null;
    if (!state.units) state.units = new Map([5, 6].map(unit => [unit, {
      unit, file: `fort.${unit}`, rows: unit === 5 ? records(io.stdin) : [], cursor: 0,
      form: 'FORMATTED', access: 'SEQUENTIAL', blank: 'NULL', preconnected: true,
    }]));
    return { push: false };
  }
  if (op === 'iocontrol') { state.control.set(String(args[0]), args[1]); return { push: false }; }
  if (op === 'iostatus') return push(state.ioStatus || 0);
  if (op === 'readpresent') return push(!state.nullRead && !state.ioStatus ? 1 : 0);
  if (op === 'internalrecord') return push(state.outputRecords?.[number(args[0])] ?? '');
  if (op === 'inquiry') {
    if (!Object.hasOwn(state.inquiry, args[0])) failure(`Unknown INQUIRE property ${args[0]}`);
    return push(state.inquiry[args[0]]);
  }
  try {
    if (state.ioStatus) {
      if (op === 'readvalue') return args[0] === 'Z' ? { push: false, values: [empty('R'), empty('R')] } : push(empty(args[0], number(args[1])));
      return { push: false };
    }
    const control = state.control;
    switch (op) {
      case 'open': {
        const unit = number(control.get('UNIT')), fileName = String(control.get('FILE') ?? `fort.${unit}`).trimEnd();
        if (!Number.isSafeInteger(unit) || unit < 0) failure('OPEN requires a nonnegative INTEGER unit');
        const status = String(control.get('STATUS') ?? 'UNKNOWN').trim().toUpperCase();
        if (!['OLD', 'NEW', 'SCRATCH', 'UNKNOWN'].includes(status)) failure(`Invalid OPEN STATUS ${status}`);
        const previous = state.units?.get(unit);
        if (previous && (!control.has('FILE') || previous.file === fileName)) {
          if (control.has('BLANK')) previous.blank = String(control.get('BLANK')).trim().toUpperCase();
          return { push: false };
        }
        const existing = status === 'SCRATCH' ? null : await io.files.read(fileName);
        if (status === 'OLD' && existing === null) failure(`OPEN OLD file does not exist: ${fileName}`);
        if (status === 'NEW' && existing !== null) failure(`OPEN NEW file already exists: ${fileName}`);
        const access = String(control.get('ACCESS') ?? 'SEQUENTIAL').trim().toUpperCase();
        const form = String(control.get('FORM') ?? (access === 'DIRECT' ? 'UNFORMATTED' : 'FORMATTED')).trim().toUpperCase();
        const blank = String(control.get('BLANK') ?? 'NULL').trim().toUpperCase();
        const recl = control.has('RECL') ? number(control.get('RECL')) : null;
        if (!['SEQUENTIAL', 'DIRECT'].includes(access) || !['FORMATTED', 'UNFORMATTED'].includes(form)
          || !['NULL', 'ZERO'].includes(blank)) failure('Invalid OPEN ACCESS, FORM, or BLANK');
        if (access === 'DIRECT' && (!Number.isSafeInteger(recl) || recl < 1)) failure('DIRECT files require a positive RECL');
        state.units ??= new Map();
        const rows = decodeRecords(existing);
        state.units.set(unit, { unit, file: fileName, rows,
          cursor: 0, access, form, blank, recl, scratch: status === 'SCRATCH' });
        if (existing === null && status !== 'SCRATCH') await io.files.write(fileName, '');
        return { push: false };
      }
      case 'inquire': {
        const unit = control.has('UNIT') ? number(control.get('UNIT')) : null;
        const name = control.has('FILE') ? String(control.get('FILE')).trimEnd() : null;
        const file = name ? [...(state.units?.values() ?? [])].find(item => item.file === name) : state.units?.get(unit);
        const exists = name ? file || await io.files.read(name) !== null : unit >= 0;
        state.inquiry = {
          EXIST: exists ? 1 : 0, OPENED: file ? 1 : 0, NUMBER: file?.unit ?? -1, NAMED: file && !file.scratch ? 1 : 0,
          NAME: file?.file ?? name ?? '', ACCESS: file?.access ?? 'UNDEFINED', FORM: file?.form ?? 'UNDEFINED',
          SEQUENTIAL: file?.access === 'DIRECT' ? 'NO' : 'YES', DIRECT: file?.access === 'DIRECT' ? 'YES' : 'NO',
          FORMATTED: file?.form === 'UNFORMATTED' ? 'NO' : 'YES', UNFORMATTED: file?.form === 'UNFORMATTED' ? 'YES' : 'NO',
          RECL: file?.recl ?? 0, NEXTREC: file ? file.cursor + 1 : 0, BLANK: file?.blank ?? 'NULL',
        };
        return { push: false };
      }
      case 'close': {
        const file = state.units?.get(number(control.get('UNIT')));
        if (!file) return { push: false };
        const status = String(control.get('STATUS') ?? (file.scratch ? 'DELETE' : 'KEEP')).trim().toUpperCase();
        if (!['KEEP', 'DELETE'].includes(status)) failure(`Invalid CLOSE STATUS ${status}`);
        if (status === 'KEEP' && file.scratch) failure('Cannot KEEP a SCRATCH file');
        if (status === 'DELETE') {
          if (!file.scratch) {
            if (io.files.delete) await io.files.delete(file.file);
            else failure('Host file store does not support DELETE');
          }
        } else await persist(file, io);
        state.units.delete(file.unit);
        return { push: false };
      }
      case 'write': {
        const file = await connected(state, io);
        const formatted = control.has('FMT');
        if (formatted !== (file.form === 'FORMATTED')) failure('WRITE format does not match the connected file FORM');
        const rows = formatted ? render(control.get('FMT'), state.items ?? []) : [[...(state.items ?? [])]];
        state.items = null;
        if (file.internal && rows.length > number(control.get('RECORDS') ?? 1)) failure('Internal file overflow');
        state.outputRecords = rows;
        for (let row of rows) {
          if (file.recl && formatted) {
            if (row.length > file.recl) failure('Output record exceeds RECL');
            row = row.padEnd(file.recl);
          }
          if (file.unit === 6) io.emit(row);
          else {
            file.rows[file.cursor++] = row;
            if (file.access !== 'DIRECT') file.rows.length = file.cursor;
          }
        }
        await persist(file, io);
        return { push: false };
      }
      case 'readbegin': {
        const file = await connected(state, io);
        if (control.has('FMT') !== (file.form === 'FORMATTED')) failure('READ format does not match the connected file FORM');
        state.reader = new InputReader(file, control.has('FMT') ? control.get('FMT') : undefined);
        return { push: false };
      }
      case 'readvalue': {
        const tag = String(args[0]), length = number(args[1]);
        state.nullRead = false;
        if (!state.reader) failure('READ value outside a READ statement');
        if (tag === 'Z') {
          if (state.reader.spec === null) {
            const token = state.reader.token();
            if (token === null) { state.nullRead = true; return { push: false, values: [empty('R'), empty('R')] }; }
            const pair = /^\((.*),(.*)\)$/.exec(token);
            if (!pair) failure(`Invalid COMPLEX input ${token}`);
            return { push: false, values: pair.slice(1).map(part => ({ real: Math.fround(parseNumber(part, null, {})) })) };
          }
          if (state.reader.spec === undefined) return { push: false, values: state.reader.read('Z', 0) };
          return { push: false, values: [state.reader.read('R', 0), state.reader.read('R', 0)] };
        }
        const value = state.reader.read(tag, length);
        state.nullRead = value === null;
        return push(value ?? empty(tag, length));
      }
      case 'readend': return { push: false };
      case 'rewind': (await connected(state, io)).cursor = 0; return { push: false };
      case 'backspace': {
        const file = await connected(state, io);
        file.cursor = Math.max(0, file.cursor - 1);
        return { push: false };
      }
      case 'endfile': {
        const file = await connected(state, io);
        file.rows.length = file.cursor;
        file.rows.push(null); file.cursor++;
        await persist(file, io);
        return { push: false };
      }
      default: failure(`Unknown I/O operation ${op}`);
    }
  } catch (error) {
    if (!(error instanceof FortranRuntimeError)) throw error;
    state.ioStatus = error.status ?? 1;
    if (!state.control.has('IOSTAT') && !state.control.has(state.ioStatus < 0 ? 'END' : 'ERR')) throw error;
    if (op === 'readvalue') return args[0] === 'Z' ? { push: false, values: [empty('R'), empty('R')] } : push(empty(args[0], number(args[1])));
    return { push: false };
  }
}
