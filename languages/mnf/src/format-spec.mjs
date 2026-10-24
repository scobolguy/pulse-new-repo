import antlr4 from 'antlr4';
import F77FormatLexer from '../grammar/generated/F77FormatLexer.js';
import F77FormatParser from '../grammar/generated/F77FormatParser.js';
import F77FormatVisitor from '../grammar/generated/F77FormatVisitor.js';
import { FortranError } from './fixed-form.mjs';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(_recognizer, symbol, line, column, message) {
    this.errors.push({ symbol, line, column, message });
  }
}

const isTerminal = node => node && node.symbol !== undefined;
const children = ctx => ctx?.children ?? [];

// ---------------------------------------------------------------- format specifications (section 13)

const F = F77FormatParser;

class FormatBuilder extends F77FormatVisitor {
  constructor(fail) {
    super();
    this.fail = fail;
  }

  visitFormatSpecification(ctx) {
    const list = ctx.formatList();
    return list ? this.visit(list) : [];
  }

  visitFormatList(ctx) {
    return ctx.formatItem().map(item => this.visit(item));
  }

  count(token, what) {
    const value = Number(token.getText());
    if (value <= 0) this.fail(token.symbol, `${what} must be a nonzero unsigned integer`);
    return value;
  }

  repeat(ctx) {
    const token = children(ctx).find(child => isTerminal(child) && child.symbol.type === F.ICON
      && children(ctx).indexOf(child) === 0);
    return token ? this.count(token, 'Repeat count') : 1;
  }

  visitGroupItem(ctx) {
    return { t: 'group', r: this.repeat(ctx), items: this.visit(ctx.formatList()) };
  }

  visitDataItem(ctx) {
    return { ...this.visit(ctx.dataEdit()), r: this.repeat(ctx) };
  }

  visitSkipItem(ctx) {
    return { t: 'X', n: this.repeat(ctx) };
  }

  visitTabItem(ctx) {
    const kind = children(ctx)[0].getText().toUpperCase();
    return { t: kind, n: this.count(ctx.ICON(), 'Tab position') };
  }

  visitScaleItem(ctx) {
    const value = Number(ctx.ICON().getText());
    return { t: 'P', k: ctx.MINUS() ? -value : value };
  }

  visitSignItem(ctx) {
    return { t: ctx.getText().toUpperCase() };
  }

  visitBlankItem(ctx) {
    return { t: ctx.getText().toUpperCase() };
  }

  visitSlashItem() {
    return { t: '/' };
  }

  visitColonItem() {
    return { t: ':' };
  }

  visitLiteralItem(ctx) {
    return { t: 'lit', s: ctx.getText().slice(1, -1).replaceAll("''", "'") };
  }

  visitIntegerEdit(ctx) {
    const numbers = ctx.ICON();
    const w = this.count(numbers[0], 'Field width');
    const m = numbers[1] ? Number(numbers[1].getText()) : null;
    if (m !== null && m > w) this.fail(numbers[1].symbol, 'Iw.m requires m <= w');
    return { t: 'I', w, m };
  }

  visitFixedEdit(ctx) {
    const [w, d] = ctx.ICON();
    return { t: 'F', w: this.count(w, 'Field width'), d: Number(d.getText()) };
  }

  visitExponentEdit(ctx) {
    const kind = children(ctx)[0].getText().toUpperCase();
    const numbers = ctx.ICON();
    const result = { t: kind, w: this.count(numbers[0], 'Field width'), d: Number(numbers[1].getText()), e: null };
    if (numbers[2]) {
      if (kind === 'D') this.fail(numbers[2].symbol, 'Dw.d does not take an exponent width');
      result.e = this.count(numbers[2], 'Exponent width');
    }
    return result;
  }

  visitLogicalEdit(ctx) {
    return { t: 'L', w: this.count(ctx.ICON(), 'Field width') };
  }

  visitCharacterEdit(ctx) {
    return { t: 'A', w: ctx.ICON() ? this.count(ctx.ICON(), 'Field width') : null };
  }
}

// H editing (13.5.2): nHcc...c becomes the equivalent apostrophe edit descriptor.
// An nH sequence only starts where an edit descriptor may start.
export function hollerithToApostrophe(text, fail = () => {}) {
  let out = '';
  let i = 0;
  let canStart = true;
  while (i < text.length) {
    const c = text[i];
    if (c === "'") {
      const end = /^'(?:[^']|'')*'/.exec(text.slice(i));
      if (!end) return out + text.slice(i);
      out += end[0];
      i += end[0].length;
      canStart = false;
      continue;
    }
    if (canStart && /\d/.test(c)) {
      const match = /^(\d+)( *)([Hh])/.exec(text.slice(i));
      if (match) {
        const count = Number(match[1]);
        const start = i + match[0].length;
        if (count === 0 || start + count > text.length) fail(null, 'H edit descriptor runs past the end of the format');
        out += `'${text.slice(start, start + count).replaceAll("'", "''")}'`;
        i = start + count;
        canStart = false;
        continue;
      }
    }
    if (c === '(' || c === ',' || c === '/' || c === ':') canStart = true;
    else if (c !== ' ') canStart = /\d|[+-]/.test(c) ? canStart : false;
    out += c;
    i += 1;
  }
  return out;
}

const fmtNumber = value => String(value);

// Canonical text understood by the FORTRAN runtime library's format interpreter.
export function formatSpecificationText(items) {
  const item = entry => {
    const repeat = entry.r && entry.r !== 1 ? String(entry.r) : '';
    switch (entry.t) {
      case 'group': return `${repeat}(${entry.items.map(item).join(',')})`;
      case 'I': return `${repeat}I${entry.w}${entry.m !== null && entry.m !== undefined ? `.${entry.m}` : ''}`;
      case 'F': return `${repeat}F${entry.w}.${entry.d}`;
      case 'E': case 'D': case 'G':
        return `${repeat}${entry.t}${entry.w}.${entry.d}${entry.e ? `E${entry.e}` : ''}`;
      case 'L': return `${repeat}L${entry.w}`;
      case 'A': return `${repeat}A${entry.w ?? ''}`;
      case 'X': return `${fmtNumber(entry.n)}X`;
      case 'T': case 'TL': case 'TR': return `${entry.t}${entry.n}`;
      case 'P': return `${entry.k}P`;
      case 'lit': return `'${entry.s.replaceAll("'", "''")}'`;
      default: return entry.t;
    }
  };
  return `(${items.map(item).join(',')})`;
}

export function parseFormatSpecification(text, { fileName = 'program.ftn', line = 1, column = 1 } = {}) {
  const fail = (symbol, message) => {
    throw new FortranError(fileName, line, column + (symbol?.column ?? 0), `Invalid format specification: ${message}`);
  };
  text = hollerithToApostrophe(text, fail);
  const lexer = new F77FormatLexer(new antlr4.InputStream(text));
  const errors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(errors);
  const parser = new F77FormatParser(new antlr4.CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(errors);
  const tree = parser.formatSpecification();
  if (errors.errors.length) {
    const error = errors.errors[0];
    fail({ column: error.column }, error.message);
  }
  return new FormatBuilder(fail).visit(tree);
}
