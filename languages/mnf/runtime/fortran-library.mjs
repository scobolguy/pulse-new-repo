// FORTRAN 77 runtime library for the Pulse p-machine (CALL_EXT fortran.*).
// Values: INTEGER/LOGICAL are JS numbers (LOGICAL 0/1), CHARACTER values are
// strings, REAL/DOUBLE PRECISION arrive as { real: number } and are returned
// the same way so the host runtime can box them.
import { parseFormatSpecification } from '../src/format-spec.mjs';

export class FortranRuntimeError extends Error {
  constructor(message) {
    super(`FORTRAN runtime error: ${message}`);
  }
}

const fail = message => {
  throw new FortranRuntimeError(message);
};
const isReal = value => value !== null && typeof value === 'object' && 'real' in value;
const num = value => (isReal(value) ? value.real : Number(value));
const real = value => ({ real: Math.fround(value) });
const int32 = value => {
  if (!Number.isFinite(value)) fail('INTEGER conversion of a non-finite value');
  return Math.trunc(value) | 0;
};
const keep = (template, value) => (isReal(template) ? real(value) : int32(value));

export function createFortranState() {
  return { items: null };
}

// ---------------------------------------------------------------- character helpers

const pad = (value, length) => String(value ?? '').padEnd(length, ' ').slice(0, length);

function compareCharacter(left, right) {
  const a = String(left), b = String(right);
  const length = Math.max(a.length, b.length);
  const x = a.padEnd(length, ' '), y = b.padEnd(length, ' ');
  return x < y ? -1 : x > y ? 1 : 0;
}

function checkSubstring(value, first, last) {
  const length = String(value).length;
  if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 1 && first <= last && last <= length))
    fail(`Substring (${first}:${last}) is outside 1:${length}`);
}

// ---------------------------------------------------------------- numeric editing

const significant = value => Number(Math.fround(value).toPrecision(7));

function listReal(value) {
  const x = significant(value);
  if (x === 0) return '0.000000';
  const magnitude = Math.floor(Math.log10(Math.abs(x)));
  if (magnitude >= -1 && magnitude < 7) return x.toFixed(6 - magnitude);
  const [mantissa, exponent] = x.toExponential(6).toUpperCase().split('E');
  const power = Number(exponent);
  return `${mantissa}E${power < 0 ? '-' : '+'}${String(Math.abs(power)).padStart(2, '0')}`;
}

function listItem({ value, tag }) {
  if (tag === 'C') return String(value);
  if (tag === 'L') return value ? 'T' : 'F';
  if (tag === 'R' || tag === 'D') return listReal(num(value));
  return String(num(value));
}

function listDirected(items) {
  let record = ' ';
  items.forEach((item, index) => {
    if (index > 0 && !(item.tag === 'C' && items[index - 1].tag === 'C')) record += ' ';
    record += listItem(item);
  });
  return [record];
}

const stars = width => '*'.repeat(width);
const fitField = (text, width) => {
  if (text.length > width && text.startsWith('0.') && text.length - 1 <= width) text = text.slice(1);
  if (text.length > width && text.startsWith('-0.') && text.length - 1 <= width) text = `-${text.slice(2)}`;
  if (text.length > width && text.startsWith('+0.') && text.length - 1 <= width) text = `+${text.slice(2)}`;
  return text.length > width ? stars(width) : text.padStart(width, ' ');
};

function editInteger(value, { w, m }, mode) {
  const v = num(value);
  let digits = String(Math.abs(v));
  if (m !== null && m !== undefined) {
    digits = digits.padStart(m, '0');
    if (m === 0 && v === 0) digits = '';
  }
  const sign = v < 0 ? '-' : mode.plus ? '+' : '';
  const text = sign + digits;
  return text.length > w ? stars(w) : text.padStart(w, ' ');
}

function editFixed(value, w, d, scale, mode) {
  const x = num(value) * 10 ** scale;
  let text = Math.abs(x).toFixed(d);
  if (d === 0) text += '.';
  const sign = x < 0 ? '-' : mode.plus ? '+' : '';
  return fitField(sign + text, w);
}

function editExponent(value, { t, w, d, e }, scale, mode) {
  const x = num(value);
  if (!(scale > -d && scale < d + 2)) fail(`Scale factor ${scale}P is out of range for ${t}${w}.${d}`);
  const digitsWanted = scale <= 0 ? d + scale : d + 1;
  let digits, exponent;
  if (x === 0) {
    digits = '0'.repeat(digitsWanted);
    exponent = 0;
  } else {
    const [mantissa, power] = Math.abs(x).toExponential(digitsWanted - 1).split('e');
    digits = mantissa.replace('.', '');
    exponent = Number(power) + 1 - scale;
  }
  const body = scale <= 0
    ? `0.${'0'.repeat(-scale)}${digits}`
    : `${digits.slice(0, scale)}.${digits.slice(scale)}`;
  const letter = t === 'D' ? 'D' : 'E';
  const expSign = exponent < 0 ? '-' : '+';
  const magnitude = String(Math.abs(exponent));
  let expField;
  if (e) {
    if (magnitude.length > e) return stars(w);
    expField = `${letter}${expSign}${magnitude.padStart(e, '0')}`;
  } else if (Math.abs(exponent) <= 99) expField = `${letter}${expSign}${magnitude.padStart(2, '0')}`;
  else if (Math.abs(exponent) <= 999) expField = `${expSign}${magnitude}`;
  else return stars(w);
  const sign = x < 0 ? '-' : mode.plus ? '+' : '';
  return fitField(sign + body + expField, w);
}

function editGeneral(value, descriptor, scale, mode) {
  const { w, d, e } = descriptor;
  const magnitude = Math.abs(num(value));
  if (magnitude >= 0.1 && magnitude < 10 ** d) {
    let k = 0;
    while (k <= d && !(magnitude < 10 ** k)) k += 1;
    const blanks = e ? e + 2 : 4;
    return editFixed(value, w - blanks, d - k, 0, mode) + ' '.repeat(blanks);
  }
  return editExponent(value, { ...descriptor, t: 'E' }, scale, mode);
}

const TYPE_NAMES = { I: 'INTEGER', R: 'REAL', D: 'DOUBLE PRECISION', L: 'LOGICAL', C: 'CHARACTER' };

function editItem(descriptor, item, state) {
  const { t } = descriptor;
  const expect = allowed => {
    if (!allowed.includes(item.tag)) fail(`Format descriptor ${t} cannot edit a ${TYPE_NAMES[item.tag]} item`);
  };
  switch (t) {
    case 'I': expect('I'); return editInteger(item.value, descriptor, state);
    case 'F': expect('RD'); return editFixed(item.value, descriptor.w, descriptor.d, state.scale, state);
    case 'E': case 'D': expect('RD'); return editExponent(item.value, descriptor, state.scale, state);
    case 'G': expect('RD'); return editGeneral(item.value, descriptor, state.scale, state);
    case 'L': expect('L'); return `${' '.repeat(descriptor.w - 1)}${item.value ? 'T' : 'F'}`;
    case 'A': {
      expect('C');
      const text = String(item.value);
      if (descriptor.w === null) return text;
      return descriptor.w >= text.length ? text.padStart(descriptor.w, ' ') : text.slice(0, descriptor.w);
    }
    default: return fail(`Unknown edit descriptor ${t}`);
  }
}

const DATA_EDITS = new Set(['I', 'F', 'E', 'D', 'G', 'L', 'A']);

function* walk(list) {
  for (const item of list) {
    if (item.t === 'group') for (let i = 0; i < item.r; i += 1) yield* walk(item.items);
    else if (DATA_EDITS.has(item.t)) for (let i = 0; i < (item.r ?? 1); i += 1) yield item;
    else yield item;
  }
}

export function formatRecords(spec, items) {
  const records = [];
  let record = [], position = 0, length = 0;
  const state = { scale: 0, plus: false };
  const put = text => {
    for (const character of text) {
      while (record.length < position) record.push(' ');
      record[position] = character;
      position += 1;
      length = Math.max(length, position);
    }
  };
  const endRecord = () => {
    records.push(Array.from({ length }, (_, index) => record[index] ?? ' ').join(''));
    record = [];
    position = 0;
    length = 0;
  };
  const lastGroup = [...spec].reverse().find(item => item.t === 'group');
  const reversion = lastGroup ? [lastGroup] : spec;
  let pass = spec, next = 0;
  for (;;) {
    let consumed = false;
    for (const descriptor of walk(pass)) {
      if (DATA_EDITS.has(descriptor.t)) {
        if (next >= items.length) {
          endRecord();
          return records;
        }
        put(editItem(descriptor, items[next], state));
        next += 1;
        consumed = true;
        continue;
      }
      switch (descriptor.t) {
        case ':':
          if (next >= items.length) {
            endRecord();
            return records;
          }
          break;
        case '/': endRecord(); break;
        case 'lit': put(descriptor.s); break;
        case 'X': case 'TR': position += descriptor.n; break;
        case 'TL': position = Math.max(0, position - descriptor.n); break;
        case 'T': position = descriptor.n - 1; break;
        case 'P': state.scale = descriptor.k; break;
        case 'SP': state.plus = true; break;
        case 'S': case 'SS': state.plus = false; break;
        default: break;
      }
    }
    if (next >= items.length) {
      endRecord();
      return records;
    }
    if (!consumed && pass === reversion) fail('Format has no data edit descriptor for the remaining output items');
    endRecord();
    pass = reversion;
  }
}

const runtimeFormats = new Map();

function resolveFormat(format) {
  const text = String(format);
  if (text === '*') return null;
  if (text.startsWith('#')) return JSON.parse(text.slice(1));
  if (runtimeFormats.has(text)) return runtimeFormats.get(text);
  const start = text.search(/\S/);
  if (start < 0 || text[start] !== '(') fail(`Run-time format must begin with '(': ${JSON.stringify(text.trim())}`);
  let depth = 0, end = -1, quoted = false;
  for (let index = start; index < text.length && end < 0; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === "'") {
        if (text[index + 1] === "'") index += 1;
        else quoted = false;
      }
    } else if (character === "'") quoted = true;
    else if (character === '(') depth += 1;
    else if (character === ')' && (depth -= 1) === 0) end = index;
  }
  if (end < 0) fail(`Run-time format has unbalanced parentheses: ${JSON.stringify(text.trim())}`);
  let spec;
  try {
    spec = parseFormatSpecification(text.slice(start, end + 1), { fileName: 'run-time format' });
  } catch (error) {
    fail(String(error.detail ?? error.message).replace(/^Invalid format specification: /, `Invalid run-time format ${JSON.stringify(text.trim())}: `));
  }
  runtimeFormats.set(text, spec);
  return spec;
}

function render(format, items) {
  const spec = resolveFormat(format);
  return spec === null ? listDirected(items) : formatRecords(spec, items);
}

// ---------------------------------------------------------------- intrinsic functions

const MATH = {
  sqrt: x => (x < 0 ? fail('SQRT of a negative argument') : Math.sqrt(x)),
  exp: Math.exp,
  log: x => (x <= 0 ? fail('LOG of a non-positive argument') : Math.log(x)),
  log10: x => (x <= 0 ? fail('LOG10 of a non-positive argument') : Math.log10(x)),
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: x => (Math.abs(x) > 1 ? fail('ASIN argument outside [-1,1]') : Math.asin(x)),
  acos: x => (Math.abs(x) > 1 ? fail('ACOS argument outside [-1,1]') : Math.acos(x)),
  atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh
};

function integerPower(base, exponent) {
  if (base === 0 && exponent <= 0) fail('Zero raised to a non-positive power');
  if (exponent < 0) return base === 1 ? 1 : base === -1 ? (exponent % 2 ? -1 : 1) : 0;
  let result = 1;
  for (let i = 0; i < exponent; i += 1) result = Math.imul(result, base);
  return result;
}

function realPower(base, exponent) {
  if (isReal(exponent)) {
    if (base.real === undefined ? num(base) < 0 : base.real < 0) fail('Negative REAL base raised to a REAL power');
    if (num(base) === 0 && num(exponent) <= 0) fail('Zero raised to a non-positive power');
    return real(num(base) ** num(exponent));
  }
  if (num(base) === 0 && exponent <= 0) fail('Zero raised to a non-positive power');
  return real(num(base) ** exponent);
}

const FUNCTIONS = {
  int: x => int32(num(x)),
  nint: x => int32(Math.sign(num(x)) * Math.floor(Math.abs(num(x)) + 0.5)),
  anint: x => real(Math.sign(num(x)) * Math.floor(Math.abs(num(x)) + 0.5)),
  aint: x => real(Math.trunc(num(x))),
  abs: x => keep(x, Math.abs(num(x))),
  mod: (a, b) => {
    if (num(b) === 0) fail('MOD with a zero second argument');
    return keep(a, num(a) - Math.trunc(num(a) / num(b)) * num(b));
  },
  sign: (a, b) => keep(a, num(b) >= 0 ? Math.abs(num(a)) : -Math.abs(num(a))),
  dim: (a, b) => keep(a, Math.max(num(a) - num(b), 0)),
  max: (...values) => values.reduce((best, value) => (num(value) > num(best) ? value : best)),
  min: (...values) => values.reduce((best, value) => (num(value) < num(best) ? value : best)),
  atan2: (y, x) => {
    if (num(x) === 0 && num(y) === 0) fail('ATAN2 with both arguments zero');
    return real(Math.atan2(num(y), num(x)));
  },
  math: (name, x) => {
    const op = MATH[String(name)];
    if (!op) fail(`Unknown intrinsic ${name}`);
    return real(op(num(x)));
  },
  ipow: (a, b) => integerPower(num(a), num(b)),
  pow: (a, b) => realPower(a, b),
  len: s => String(s).length,
  index: (s, t) => String(s).indexOf(String(t)) + 1,
  char: i => {
    const code = num(i);
    if (!Number.isInteger(code) || code < 0 || code > 255) fail(`CHAR argument ${code} is outside 0-255`);
    return String.fromCharCode(code);
  },
  ichar: c => {
    if (String(c).length !== 1) fail('ICHAR requires a character argument of length 1');
    return String(c).charCodeAt(0);
  },
  ccmp: (a, b) => compareCharacter(a, b),
  pad: (value, length) => pad(value, num(length)),
  fit: (target, value) => pad(value, String(target).length),
  overlay: (actual, dummy) => (String(dummy) + String(actual).slice(String(dummy).length)).slice(0, String(actual).length),
  substr: (value, first, last) => {
    checkSubstring(value, num(first), num(last));
    return String(value).slice(num(first) - 1, num(last));
  },
  replace: (value, first, last, replacement) => {
    checkSubstring(value, num(first), num(last));
    const text = String(value);
    return text.slice(0, num(first) - 1) + pad(replacement, num(last) - num(first) + 1) + text.slice(num(last));
  },
  docount: (start, end, step) => {
    if (num(step) === 0) fail('DO increment parameter is zero');
    return Math.max(int32((num(end) - num(start) + num(step)) / num(step)), 0);
  },
  subscript: (value, lower, upper, name) => {
    if (num(value) < num(lower) || num(value) > num(upper)) fail(`Subscript ${num(value)} of ${name} is outside ${num(lower)}:${num(upper)}`);
    return num(value);
  }
};

// Returns { push, value } so statement-like calls can leave the stack untouched.
export function executeFortranIntrinsic(name, args, state, io) {
  const op = name.slice('fortran.'.length);
  switch (op) {
    case 'begin':
      state.items = [];
      return { push: false };
    case 'item':
      (state.items ??= []).push({ value: args[0], tag: String(args[1]) });
      return { push: false };
    case 'print': {
      for (const record of render(args[0], state.items ?? [])) io.emit(record);
      state.items = null;
      return { push: false };
    }
    case 'format': {
      const records = render(args[0], state.items ?? []);
      state.items = null;
      if (records.length > 1) fail('Internal file overflow: an internal WRITE to a character variable produced more than one record');
      return { push: true, value: records[0] ?? '' };
    }
    default: {
      const fn = FUNCTIONS[op];
      if (!fn) fail(`Unknown FORTRAN library routine ${name}`);
      return { push: true, value: fn(...args) };
    }
  }
}
