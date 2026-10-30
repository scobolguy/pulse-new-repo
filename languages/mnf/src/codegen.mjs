// FORTRAN 77 code generator (ANSI X3.9-1978): walks the AST built by parse.mjs and
// emits Pulse p-code using the JavaScript p-machine's FORTRAN runtime library.
//
// Storage model (static, FORTRAN 77 has no recursion):
// - Variables that are never aliased live in named globals (scalars) or named
//   extendable arrays, so debuggers show FORTRAN names.
// - COMMON, EQUIVALENCE and anything passed as an actual argument lives in the
//   program memory _M (one extendable array). Dummy arguments hold _M addresses,
//   which gives FORTRAN call-by-reference semantics with ordinary opcodes.
// - Runtime-library units (libraries/rtl) take their arguments by value and may
//   use CHARACTER*(*) locals as varying-length strings.
import { FortranError } from './fixed-form.mjs';
import { INTRINSICS, LIBRARY_PRIMITIVES, PASSABLE_INTRINSICS } from './intrinsics.mjs';
import { formatSpecificationText } from './format-spec.mjs';

export const MEMORY = '_M';
const MEMCAP = '@MEMCAP';
const UNITS = { integer: 1, real: 1, logical: 1, character: 1, double: 2, complex: 2 };
const RANK = { integer: 1, real: 2, double: 3, complex: 4 };
const SPEC_KINDS = new Set([
  'type', 'implicit', 'parameter', 'dimension', 'common', 'equivalence', 'external', 'intrinsic', 'save', 'data',
  'format', 'entry'
]);
const ANYWHERE_KINDS = new Set(['format', 'data', 'entry']);
const TYPE_NAMES = {
  integer: 'INTEGER', real: 'REAL', double: 'DOUBLE PRECISION', complex: 'COMPLEX', logical: 'LOGICAL',
  character: 'CHARACTER'
};
const REL_OPS = { '.EQ.': 'EQ', '.NE.': 'NEQ', '.LT.': 'LT', '.LE.': 'LE', '.GT.': 'GT', '.GE.': 'GE' };
const isNumeric = t => Object.prototype.hasOwnProperty.call(RANK, t);
const blanks = n => ' '.repeat(Math.max(0, n));
const T = (t, len = null) => ({ t, len });
const pushStr = s => `PUSH_STR ${JSON.stringify(s)}`;
const pushInt = v => `PUSH_INT ${v | 0}`;
function pushReal(v) {
  const text = String(Number(v));
  return `PUSH_REAL ${/[.eEn]/.test(text) ? text : `${text}.0`}`;
}

class NotConstant extends Error {}

// Internal integer expression nodes used for subscripts and addresses.
const I = value => ({ k: 'int', value });
const N = name => ({ k: 'iname', name });
const bin = (op, left, right) => ({ k: 'binary', op, left, right });
function fold(e) {
  if (e.k !== 'binary' || !['+', '-', '*'].includes(e.op)) return e;
  const left = fold(e.left), right = fold(e.right);
  const li = left.k === 'int', ri = right.k === 'int';
  if (li && ri) {
    const a = left.value, b = right.value;
    return I(e.op === '+' ? (a + b) | 0 : e.op === '-' ? (a - b) | 0 : Math.imul(a, b));
  }
  if (e.op === '+' && li && left.value === 0) return right;
  if ((e.op === '+' || e.op === '-') && ri && right.value === 0) return left;
  if (e.op === '*' && ((li && left.value === 0) || (ri && right.value === 0))) return I(0);
  if (e.op === '*' && li && left.value === 1) return right;
  if (e.op === '*' && ri && right.value === 1) return left;
  // Gather constants of a sum to the right: (x + 2) + 3 -> x + 5
  if (e.op === '+' && ri && left.k === 'binary' && left.op === '+' && left.right.k === 'int')
    return fold(bin('+', left.left, I(left.right.value + right.value)));
  return { ...e, left, right };
}

// ---------------------------------------------------------------- constant arithmetic

const realOf = c => (c.t === 'complex' ? c.v.re : Number(c.v));
function convertConst(c, t, fail) {
  if (c.t === t) return c;
  if (t === 'character' || c.t === 'character' || t === 'logical' || c.t === 'logical')
    return fail(`Cannot convert ${TYPE_NAMES[c.t]} constant to ${TYPE_NAMES[t]}`);
  if (t === 'integer') return { t, v: Math.trunc(realOf(c)) | 0 };
  if (t === 'complex') return { t, v: c.t === 'complex' ? c.v : { re: Number(c.v), im: 0 } };
  return { t, v: realOf(c) };
}

function intPower(base, exponent) {
  if (exponent < 0) return base === 1 ? 1 : base === -1 ? (exponent % 2 ? -1 : 1) : 0;
  let result = 1;
  for (let i = 0; i < exponent; i += 1) result = Math.imul(result, base);
  return result;
}

function foldArithmetic(op, a, b, fail) {
  const t = RANK[a.t] >= RANK[b.t] ? a.t : b.t;
  if (op === '**') {
    if (a.t === 'complex' || b.t === 'complex') throw new NotConstant();
    if (a.t === 'integer' && b.t === 'integer') return { t, v: intPower(a.v, b.v) };
    return { t, v: Number(a.v) ** Number(b.v) };
  }
  const x = convertConst(a, t, fail), y = convertConst(b, t, fail);
  if (t === 'complex') {
    const { re: p, im: q } = x.v, { re: r, im: s } = y.v;
    if (op === '+') return { t, v: { re: p + r, im: q + s } };
    if (op === '-') return { t, v: { re: p - r, im: q - s } };
    if (op === '*') return { t, v: { re: p * r - q * s, im: p * s + q * r } };
    const d = r * r + s * s;
    if (d === 0) return fail('Division by zero in a constant expression');
    return { t, v: { re: (p * r + q * s) / d, im: (q * r - p * s) / d } };
  }
  if (t === 'integer') {
    if (op === '+') return { t, v: (x.v + y.v) | 0 };
    if (op === '-') return { t, v: (x.v - y.v) | 0 };
    if (op === '*') return { t, v: Math.imul(x.v, y.v) };
    if (y.v === 0) return fail('Division by zero in a constant expression');
    return { t, v: Math.trunc(x.v / y.v) | 0 };
  }
  if (op === '+') return { t, v: x.v + y.v };
  if (op === '-') return { t, v: x.v - y.v };
  if (op === '*') return { t, v: x.v * y.v };
  if (y.v === 0) return fail('Division by zero in a constant expression');
  return { t, v: x.v / y.v };
}

function padTo(text, len) {
  return typeof len === 'number' ? String(text).padEnd(len, ' ').slice(0, len) : String(text);
}

// ---------------------------------------------------------------- program (linker)

export class Program {
  constructor() {
    this.sections = { init: [], main: [], user: [], library: [] };
    this.section = 'main';
    this.loc = null;
    this.globals = new Set(['_ALTRET', '_X']);
    this.arrays = new Map();
    this.procedures = {};
    this.memory = 0;
    this.commonSizes = new Map();
    this.commonAddrs = new Map();
    this.userUnits = new Map();
    this.userEntries = new Map();
    this.libraryUnits = new Map();
    this.libraryEntries = new Map();
    this.procIds = new Map();
    this.wrappers = new Map();
    this.libraryQueue = [];
    this.libraryGenerated = new Set();
    this.usesIo = false;
    this.symbols = [];
    this.frameRegs = new Set();
  }

  emit(text) {
    this.sections[this.section].push({ text, loc: text.endsWith(':') ? null : this.loc });
  }

  alloc(units) {
    const address = this.memory;
    this.memory += Math.max(0, units);
    return address;
  }

  commonAddress(key) {
    if (!this.commonAddrs.has(key)) this.commonAddrs.set(key, this.alloc(this.commonSizes.get(key) || 0));
    return this.commonAddrs.get(key);
  }

  noteCommonSize(key, size) {
    this.commonSizes.set(key, Math.max(this.commonSizes.get(key) || 0, size));
  }

  addUnit(unit) {
    const units = unit.library ? this.libraryUnits : this.userUnits;
    const entries = unit.library ? this.libraryEntries : this.userEntries;
    if (unit.kind === 'program') {
      if ([...units.values()].some(other => other.kind === 'program'))
        unit.fail(unit.ast.pos, 'An executable program has only one main program');
    }
    const register = (name, entry) => {
      if (entries.has(name)) unit.fail(unit.ast.pos, `Program unit or entry ${name} is defined more than once`);
      entries.set(name, { unit, entry });
    };
    if (unit.kind === 'blockdata') {
      units.set(`#BLOCKDATA:${unit.name}`, unit);
      return;
    }
    units.set(unit.kind === 'program' ? '#MAIN' : unit.name, unit);
    if (unit.kind !== 'program') register(unit.name, unit.mainEntry);
  }

  registerEntries(unit) {
    const entries = unit.library ? this.libraryEntries : this.userEntries;
    for (const entry of unit.entries) {
      if (entries.has(entry.name)) unit.fail(entry.pos, `Program unit or entry ${entry.name} is defined more than once`);
      entries.set(entry.name, { unit, entry });
    }
  }

  // Procedures passed as actual arguments are identified by number at run time.
  procId(target) {
    if (!this.procIds.has(target.label)) this.procIds.set(target.label, { id: this.procIds.size + 1, target });
    return this.procIds.get(target.label).id;
  }

  wrapperFor(name) {
    if (this.wrappers.has(name)) return this.wrappers.get(name);
    const spec = INTRINSICS[name];
    const type = ['LEN', 'INDEX'].includes(name) ? 'character'
      : ['ICHAR'].includes(name) ? 'character'
        : /^(IABS|ISIGN|IDIM|MOD)$/.test(name) ? 'integer'
          : name === 'AIMAG' || name === 'CONJG' || name.startsWith('C') ? 'complex'
            : name.startsWith('D') && name !== 'DPROD' ? 'double' : 'real';
    const argc = ['INDEX', 'DPROD'].includes(name) || /^(D?ATAN2|[AID]?MOD|[ID]?SIGN|[ID]?DIM)$/.test(name) ? 2 : 1;
    const pos = { line: 1, column: 7 };
    const params = Array.from({ length: argc }, (_, index) => ({ name: `A${index}`, pos }));
    const unit = new Unit(this, { kind: 'function', name, params, pos, body: [], end: { label: '', pos } }, { wrapper: name });
    unit.analyze();
    for (const param of params) {
      const sym = unit.symbols.get(param.name);
      sym.type = type; sym.len = type === 'character' ? '*' : null;
      unit.homeOf(sym);
    }
    unit.resultSym.type = spec.res === 'arg' ? type : spec.res;
    if (name === 'ABS') unit.resultSym.type = 'real';
    const target = { label: unit.entryLabel, unit, entry: unit.mainEntry, intrinsic: name };
    this.wrappers.set(name, target);
    return target;
  }

  requireLibrary(name) {
    const found = this.libraryEntries.get(name);
    if (!found) return null;
    if (!this.libraryGenerated.has(found.unit)) {
      this.libraryGenerated.add(found.unit);
      this.libraryQueue.push(found.unit);
    }
    return found;
  }
}

// ---------------------------------------------------------------- program unit: declarations

export class Unit {
  constructor(program, ast, { library = false, fileName = 'program.ftn', wrapper = null } = {}) {
    this.program = program;
    this.ast = ast;
    this.library = library;
    this.fileName = fileName;
    this.kind = ast.kind;
    this.name = ast.name;
    this.wrapper = wrapper;
    if (wrapper) {
      this.prefix = `_I${wrapper}_`;
      this.labelPrefix = `F77I_${wrapper}_`;
      this.entryLabel = `F77W_${wrapper}`;
    } else if (library) {
      this.prefix = `_R${ast.name}_`;
      this.labelPrefix = `F77R_${ast.name}_`;
      this.entryLabel = `F77L_${ast.name}`;
    } else if (ast.kind === 'program') {
      this.prefix = '';
      this.labelPrefix = 'F77M_';
      this.entryLabel = 'F77M_MAIN';
    } else {
      this.prefix = `${ast.name}_`;
      this.labelPrefix = `F77U_${ast.name}_`;
      this.entryLabel = `F77P_${ast.name}`;
    }
    this.internal = this.prefix ? `${this.prefix}_` : '_';
    this.serial = 0;
    this.tempCount = 0;
    this.tempMax = 0;
    this.persistent = 0;
    this.loops = [];
    this.labelRefs = [];
  }

  fail(pos, message) {
    throw new FortranError(this.fileName, pos?.line ?? 1, pos?.column ?? 1, message);
  }

  commonKey(block) {
    return `${this.library ? 'L' : 'U'}/${block}`;
  }

  defaultImplicit() {
    const map = new Map();
    for (let c = 65; c <= 90; c += 1) {
      const letter = String.fromCharCode(c);
      map.set(letter, { t: letter >= 'I' && letter <= 'N' ? 'integer' : 'real', len: null });
    }
    return map;
  }

  declare(name, pos) {
    if (!this.symbols.has(name)) {
      this.symbols.set(name, {
        name, pos, kind: 'var', type: null, len: null, dims: null, dummy: false, common: null, external: false,
        intrinsic: false, passed: false, result: false, typeExplicit: false
      });
    }
    return this.symbols.get(name);
  }

  implicitType(name, pos) {
    const spec = this.implicit.get(name[0]);
    if (!spec) this.fail(pos, `${name} has no type (IMPLICIT NONE is in effect)`);
    return spec;
  }

  symType(sym) {
    if (!sym.type) {
      const spec = this.implicitType(sym.name, sym.pos);
      sym.type = spec.t;
      sym.len = spec.t === 'character' ? spec.len : null;
    }
    return sym.type;
  }

  typeOfName(name, pos) {
    const sym = this.symbols.get(name);
    if (sym?.type) return { t: sym.type, len: sym.len };
    const spec = this.implicitType(name, pos);
    return { t: spec.t, len: spec.len };
  }

  charLength(len, pos) {
    if (!len) return 1;
    if (len.assumed) return '*';
    const value = this.constInt(len.expr, 'A character length');
    if (value < 1) this.fail(pos, 'Character length must be positive');
    return value;
  }

  normType(spec, pos, entityLen = null) {
    if (spec.type !== 'character') return { t: spec.type, len: null };
    return { t: 'character', len: this.charLength(entityLen ?? spec.len, pos) };
  }

  setType(sym, spec, pos, entityLen = null) {
    if (sym.typeExplicit) this.fail(pos, `${sym.name} is already typed`);
    const { t, len } = this.normType(spec, pos, entityLen);
    sym.type = t;
    sym.len = len;
    sym.typeExplicit = true;
  }

  setDims(sym, dims, pos) {
    if (sym.dims) this.fail(pos, `${sym.name} is already dimensioned`);
    if (dims.length > 7) this.fail(pos, 'An array may have at most seven dimensions');
    sym.dims = dims;
    sym.dimsPos = pos;
  }

  defineLabel(label, statement) {
    if (!label) return;
    if (this.labels.has(label)) this.fail(statement.pos, `Statement label ${label} is defined more than once`);
    this.labels.set(label, statement);
  }

  analyze() {
    const ast = this.ast;
    this.symbols = new Map();
    this.implicit = this.defaultImplicit();
    this.commonDecls = [];
    this.equivSets = [];
    this.dataStmts = [];
    this.formats = new Map();
    this.entries = [];
    this.labels = new Map();
    this.assignTargets = new Set();
    this.altReturn = false;
    this.mainEntry = { name: ast.name, params: [], label: this.entryLabel, pos: ast.pos, stars: 0 };
    for (const param of ast.params) this.addDummy(this.mainEntry, param);
    if (ast.kind === 'function') {
      const sym = this.declare(ast.name, ast.pos);
      sym.result = true;
      if (ast.typeSpec) this.setType(sym, ast.typeSpec, ast.pos);
      this.resultSym = sym;
    }
    let executable = false;
    const visit = list => {
      for (const statement of list) {
        if (statement.kind === 'if') {
          executable = true;
          this.defineLabel(statement.label, statement);
          for (const branch of statement.branches.slice(1)) this.defineLabel(branch.label, branch);
          for (const branch of statement.branches) visit(branch.body);
          if (statement.elseBranch) {
            this.defineLabel(statement.elseBranch.label, statement.elseBranch);
            visit(statement.elseBranch.body);
          }
          this.defineLabel(statement.end.label, statement.end);
          continue;
        }
        this.defineLabel(statement.label, statement);
        if (statement.kind === 'assignment' && !executable && this.isStatementFunction(statement)) {
          this.defineStatementFunction(statement);
          continue;
        }
        if (SPEC_KINDS.has(statement.kind)) {
          if (executable && !ANYWHERE_KINDS.has(statement.kind))
            this.fail(statement.pos, 'Declarations must precede executable statements');
          this.declareStatement(statement);
          continue;
        }
        if (this.kind === 'blockdata') this.fail(statement.pos, 'BLOCK DATA may contain only specification and DATA statements');
        executable = true;
        if (statement.kind === 'assignLabel') this.assignTargets.add(statement.target.label);
        if (statement.kind === 'logicalIf' && statement.statement.kind === 'assignLabel')
          this.assignTargets.add(statement.statement.target.label);
      }
    };
    visit(ast.body);
    this.defineLabel(ast.end.label, ast.end);
    this.resolveDeclarations();
    this.scanUsage();
    for (const sym of this.symbols.values()) {
      if (sym.kind === 'var') this.symType(sym);
    }
  }

  addDummy(entry, param) {
    if (param.star) {
      if (this.kind !== 'subroutine') this.fail(param.pos, 'Alternate return specifiers are allowed only in subroutines');
      this.altReturn = true;
      entry.stars += 1;
      return;
    }
    const sym = this.declare(param.name, param.pos);
    if (entry.params.includes(param.name)) this.fail(param.pos, `Dummy argument ${param.name} appears twice`);
    sym.dummy = true;
    entry.params.push(param.name);
  }

  isStatementFunction(statement) {
    const target = statement.target;
    if (!target.args || target.substring) return false;
    const sym = this.symbols.get(target.name);
    if (sym?.dims) return false;
    return target.args.every(arg => arg.k === 'ref' && !arg.args && !arg.substring);
  }

  defineStatementFunction(statement) {
    const target = statement.target;
    const sym = this.declare(target.name, target.pos);
    if (sym.kind === 'stmtfn') this.fail(target.pos, `Statement function ${target.name} is defined more than once`);
    if (sym.dummy) this.fail(target.pos, `${target.name} is a dummy argument`);
    sym.kind = 'stmtfn';
    sym.sfParams = target.args.map(arg => arg.name);
    sym.sfBody = statement.value;
    statement.isStatementFunction = true;
  }

  declareStatement(s) {
    switch (s.kind) {
      case 'type':
        for (const entity of s.entities) {
          const sym = this.declare(entity.name, entity.pos);
          this.setType(sym, s.typeSpec, entity.pos, entity.len);
          if (entity.dims) this.setDims(sym, entity.dims, entity.pos);
        }
        return;
      case 'implicit':
        if (s.none) {
          this.implicit = new Map();
          return;
        }
        for (const spec of s.specs) {
          const type = this.normType(spec.typeSpec, s.pos);
          for (const [from, to] of spec.ranges)
            for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c += 1) this.implicit.set(String.fromCharCode(c), type);
        }
        return;
      case 'parameter':
        for (const def of s.defs) {
          const sym = this.declare(def.name, def.pos);
          if (sym.kind === 'param') this.fail(def.pos, `PARAMETER ${def.name} is defined more than once`);
          if (sym.dummy || sym.dims) this.fail(def.pos, `${def.name} cannot be a PARAMETER`);
          const t = this.symType(sym);
          let value;
          try {
            value = this.cval(def.expr);
          } catch (error) {
            if (error instanceof NotConstant) this.fail(def.pos, 'PARAMETER value must be a constant expression');
            throw error;
          }
          value = convertConst(value, t, message => this.fail(def.pos, message));
          if (t === 'character') {
            if (sym.len === '*') sym.len = value.v.length;
            value = { t, v: padTo(value.v, sym.len) };
          }
          sym.kind = 'param';
          sym.value = value;
        }
        return;
      case 'dimension':
        for (const array of s.arrays) this.setDims(this.declare(array.name, array.pos), array.dims, array.pos);
        return;
      case 'common':
        for (const block of s.blocks) {
          const key = this.commonKey(block.name);
          for (const item of block.items) {
            const sym = this.declare(item.name, item.pos);
            if (sym.common) this.fail(item.pos, `${item.name} is already in a COMMON block`);
            if (sym.dummy) this.fail(item.pos, `Dummy argument ${item.name} cannot be in COMMON`);
            sym.common = key;
            if (item.dims) this.setDims(sym, item.dims, item.pos);
            this.commonDecls.push({ key, sym, pos: item.pos });
          }
        }
        return;
      case 'equivalence':
        this.equivSets.push(...s.sets);
        return;
      case 'external':
        for (const name of s.names) {
          const sym = this.declare(name, s.pos);
          if (sym.intrinsic) this.fail(s.pos, `${name} cannot be both EXTERNAL and INTRINSIC`);
          sym.external = true;
        }
        return;
      case 'intrinsic':
        for (const name of s.names) {
          if (!INTRINSICS[name]) this.fail(s.pos, `${name} is not a FORTRAN 77 intrinsic function`);
          const sym = this.declare(name, s.pos);
          if (sym.external) this.fail(s.pos, `${name} cannot be both EXTERNAL and INTRINSIC`);
          sym.intrinsic = true;
        }
        return;
      case 'save':
        return;
      case 'data':
        this.dataStmts.push(s);
        return;
      case 'format':
        if (!s.label) this.fail(s.pos, 'FORMAT statement requires a statement label');
        this.formats.set(s.label, formatSpecificationText(s.spec));
        return;
      case 'entry': {
        if (this.kind !== 'function' && this.kind !== 'subroutine')
          this.fail(s.pos, 'ENTRY is allowed only in a function or subroutine subprogram');
        const entry = { name: s.name, params: [], label: `${this.library ? 'F77L' : 'F77P'}_${s.name}`, pos: s.pos, stars: 0 };
        for (const param of s.params) this.addDummy(entry, param);
        if (this.kind === 'function') {
          const sym = this.declare(s.name, s.pos);
          sym.result = true;
          sym.entryResult = true;
        }
        s.entry = entry;
        this.entries.push(entry);
        return;
      }
      default:
        this.fail(s.pos, `Unexpected ${s.kind} statement`);
    }
  }
  // ------------------------------------------------------------ constant expressions

  cval(e) {
    const fail = message => this.fail(e.pos, message);
    switch (e.k) {
      case 'int': return { t: 'integer', v: e.value | 0 };
      case 'real': return { t: e.double ? 'double' : 'real', v: e.value };
      case 'string': return { t: 'character', v: e.value };
      case 'logical': return { t: 'logical', v: e.value };
      case 'paren': return this.cval(e.expr);
      case 'complex': {
        const re = this.cval(e.re), im = this.cval(e.im);
        if (!isNumeric(re.t) || !isNumeric(im.t) || re.t === 'complex' || im.t === 'complex')
          return fail('Complex constant parts must be integer or real');
        return { t: 'complex', v: { re: realOf(re), im: realOf(im) } };
      }
      case 'name':
      case 'ref': {
        if (e.args || e.substring) throw new NotConstant();
        if (this.constScope?.has(e.name)) return this.constScope.get(e.name);
        const sym = this.symbols.get(e.name);
        if (sym?.kind === 'param') return sym.value;
        if (e.k === 'name') return fail(`${e.name} is not a named constant`);
        throw new NotConstant();
      }
      case 'unary': {
        const value = this.cval(e.operand);
        if (e.op === '.NOT.') {
          if (value.t !== 'logical') return fail('.NOT. requires a LOGICAL operand');
          return { t: 'logical', v: !value.v };
        }
        if (!isNumeric(value.t)) return fail(`Unary ${e.op} requires a numeric operand`);
        if (e.op === '+') return value;
        if (value.t === 'complex') return { t: 'complex', v: { re: -value.v.re, im: -value.v.im } };
        return { t: value.t, v: value.t === 'integer' ? (-value.v) | 0 : -value.v };
      }
      case 'binary': {
        const a = this.cval(e.left), b = this.cval(e.right);
        if (['+', '-', '*', '/', '**'].includes(e.op)) {
          if (!isNumeric(a.t) || !isNumeric(b.t)) return fail(`Operator ${e.op} requires numeric operands`);
          return foldArithmetic(e.op, a, b, fail);
        }
        if (e.op === '//') {
          if (a.t !== 'character' || b.t !== 'character') return fail('// requires CHARACTER operands');
          return { t: 'character', v: a.v + b.v };
        }
        if (REL_OPS[e.op]) {
          let x = a.v, y = b.v;
          if (a.t === 'character' || b.t === 'character') {
            if (a.t !== b.t) return fail('Cannot compare CHARACTER with a non-CHARACTER value');
            const width = Math.max(x.length, y.length);
            x = x.padEnd(width, ' ');
            y = y.padEnd(width, ' ');
          } else {
            if (a.t === 'complex' || b.t === 'complex') throw new NotConstant();
            x = Number(x);
            y = Number(y);
          }
          const op = REL_OPS[e.op];
          const truth = op === 'EQ' ? x === y : op === 'NEQ' ? x !== y : op === 'LT' ? x < y : op === 'LE' ? x <= y
            : op === 'GT' ? x > y : x >= y;
          return { t: 'logical', v: truth };
        }
        if (a.t !== 'logical' || b.t !== 'logical') return fail(`${e.op} requires LOGICAL operands`);
        if (e.op === '.AND.') return { t: 'logical', v: a.v && b.v };
        if (e.op === '.OR.') return { t: 'logical', v: a.v || b.v };
        if (e.op === '.EQV.') return { t: 'logical', v: a.v === b.v };
        return { t: 'logical', v: a.v !== b.v };
      }
      default:
        throw new NotConstant();
    }
  }

  tryConst(e) {
    try {
      return this.cval(e);
    } catch (error) {
      if (error instanceof NotConstant) return null;
      throw error;
    }
  }

  constInt(e, what) {
    const value = this.tryConst(e);
    if (!value) this.fail(e.pos, `${what} must be a constant expression`);
    if (value.t !== 'integer') this.fail(e.pos, `${what} must be of type INTEGER`);
    return value.v;
  }

  // ------------------------------------------------------------ declarations resolved

  resolveDeclarations() {
    for (const sym of this.symbols.values()) {
      if (sym.kind === 'param') continue;
      if (sym.external && !sym.dummy && sym.kind === 'var' && !sym.dims) {
        sym.kind = 'proc';
        continue;
      }
      this.symType(sym);
      if (sym.dims) this.resolveDims(sym);
      if (sym.len === '*' && sym.kind !== 'stmtfn') {
        if (this.library) sym.varying = true;
        else if (!sym.dummy && !sym.result)
          this.fail(sym.pos, `${sym.name} has assumed length (*) but is not a dummy argument or function result`);
      }
      if (this.library && sym.dummy) {
        if (sym.dims) this.fail(sym.pos, 'Runtime library dummy arguments must be scalars');
        if (sym.type === 'complex') this.fail(sym.pos, 'Runtime library dummy arguments cannot be COMPLEX');
        if (sym.type === 'character') sym.varying = true;
      }
    }
    if (this.resultSym) {
      if (this.resultSym.dims) this.fail(this.resultSym.pos, 'A function result cannot be an array');
      if (this.library && this.resultSym.type === 'character') this.resultSym.varying = true;
    }
    if (this.kind === 'function') {
      for (const entry of this.entries) {
        const sym = this.symbols.get(entry.name);
        if (sym.type === 'character' || this.resultSym.type === 'character') {
          if (sym.type !== this.resultSym.type) this.fail(entry.pos, 'CHARACTER entry names must match the function type');
        }
      }
    }
    // COMMON layout, in storage units, in declaration order per block.
    const offsets = new Map();
    for (const decl of this.commonDecls) {
      if (decl.sym.dims && !decl.sym.dimInfo.constant)
        this.fail(decl.pos, `COMMON array ${decl.sym.name} must have constant bounds`);
      const offset = offsets.get(decl.key) || 0;
      decl.sym.commonOffset = offset;
      offsets.set(decl.key, offset + this.cells(decl.sym));
    }
    this.commonEnds = offsets;
  }

  resolveDims(sym) {
    const dims = [];
    let constant = true;
    let count = 1;
    sym.dims.forEach((dim, index) => {
      const lower = dim.lower ? this.boundValue(dim.lower) : { c: 1 };
      let upper = null;
      if (dim.assumed) {
        if (index !== sym.dims.length - 1 || !sym.dummy)
          this.fail(dim.pos, 'Only the last upper bound of a dummy array may be *');
      } else upper = this.boundValue(dim.upper);
      if (lower.c === undefined || !upper || upper.c === undefined) constant = false;
      if (constant) {
        if (upper.c < lower.c) this.fail(dim.pos, `Upper bound of ${sym.name} is less than its lower bound`);
        count *= upper.c - lower.c + 1;
      }
      dims.push({ lower, upper, assumed: dim.assumed });
    });
    if (!constant && !sym.dummy)
      this.fail(sym.dimsPos, `Array ${sym.name} must have constant bounds (adjustable arrays must be dummy arguments)`);
    sym.dimInfo = { dims, constant, count: constant ? count : null };
  }

  boundValue(expr) {
    const value = this.tryConst(expr);
    if (value) {
      if (value.t !== 'integer') this.fail(expr.pos, 'Array bounds must be INTEGER');
      return { c: value.v };
    }
    return { expr };
  }

  elementCells(sym) {
    return UNITS[sym.type];
  }

  cells(sym) {
    return this.elementCells(sym) * (sym.dims ? sym.dimInfo.count : 1);
  }

  // ------------------------------------------------------------ usage scan

  isArray(name) {
    return Boolean(this.symbols.get(name)?.dims);
  }

  isIntrinsicName(name) {
    const sym = this.symbols.get(name);
    if (sym && (sym.external || sym.dummy || sym.dims || sym.kind === 'stmtfn' || sym.kind === 'param')) return false;
    if (sym?.intrinsic) return true;
    if (!INTRINSICS[name]) return false;
    // A user program unit with an intrinsic's name overrides it only when declared EXTERNAL.
    return true;
  }

  isProcedureName(name) {
    const sym = this.symbols.get(name);
    if (!sym || sym.dims) return false;
    return sym.external || sym.intrinsic || sym.kind === 'proc' || sym.procDummy;
  }

  scanUsage() {
    this.walkUnit((expr, context) => this.scanExpr(expr, context), statement => this.scanStatement(statement));
  }

  walkUnit(onExpr, onStatement) {
    const statements = list => {
      for (const statement of list) {
        if (statement.kind === 'if') {
          for (const branch of statement.branches) {
            onExpr(branch.cond, 'value');
            statements(branch.body);
          }
          if (statement.elseBranch) statements(statement.elseBranch.body);
          continue;
        }
        if (statement.kind === 'logicalIf') {
          onExpr(statement.cond, 'value');
          statements([statement.statement]);
          continue;
        }
        onStatement(statement);
      }
    };
    statements(this.ast.body);
    for (const sym of this.symbols.values()) if (sym.kind === 'stmtfn') onExpr(sym.sfBody, 'value');
  }

  scanStatement(s) {
    const scan = (e, context = 'value') => e && this.scanExpr(e, context);
    switch (s.kind) {
      case 'assignment':
        if (s.isStatementFunction) return;
        scan(s.target, 'target');
        scan(s.value);
        return;
      case 'call':
        this.scanCall(s.name, s.args, s.pos, false);
        return;
      case 'do':
        scan(s.start);
        scan(s.end);
        scan(s.step);
        return;
      case 'computedGoto':
      case 'arithmeticIf':
        scan(s.expr);
        return;
      case 'return':
        scan(s.expr);
        return;
      case 'print':
      case 'write':
      case 'read':
        for (const item of s.control ?? []) scan(item.expr);
        if (s.format?.expr) scan(s.format.expr);
        this.scanIoItems(s.items);
        return;
      case 'auxIo':
        for (const item of s.control) scan(item.expr);
        return;
      default:
        if (s.kind === 'open' || s.kind === 'close' || s.kind === 'inquire') for (const item of s.control) scan(item.expr);
    }
  }

  scanIoItems(items) {
    for (const item of items) {
      if (item.k === 'implied') {
        this.scanExpr(item.start, 'value');
        this.scanExpr(item.end, 'value');
        if (item.step) this.scanExpr(item.step, 'value');
        this.scanIoItems(item.items);
      } else this.scanExpr(item, 'value');
    }
  }

  scanExpr(e, context) {
    if (!e) return;
    switch (e.k) {
      case 'paren': return this.scanExpr(e.expr, 'value');
      case 'unary': return this.scanExpr(e.operand, 'value');
      case 'binary':
        this.scanExpr(e.left, 'value');
        this.scanExpr(e.right, 'value');
        return;
      case 'complex':
        this.scanExpr(e.re, 'value');
        this.scanExpr(e.im, 'value');
        return;
      case 'section':
        this.scanExpr(e.from, 'value');
        this.scanExpr(e.to, 'value');
        return;
      case 'ref': {
        if (e.substring) {
          this.scanExpr(e.substring.from, 'value');
          this.scanExpr(e.substring.to, 'value');
        }
        if (!e.args) return;
        const sym = this.symbols.get(e.name);
        if (sym?.dims || this.isSubstringRef(e)) {
          for (const arg of e.args) this.scanExpr(arg, 'value');
          return;
        }
        if (sym?.kind === 'stmtfn' || this.isIntrinsicName(e.name)) {
          for (const arg of e.args) this.scanExpr(arg, 'value');
          return;
        }
        this.scanCall(e.name, e.args, e.pos, true);
        return;
      }
      default:
    }
  }

  // NAME(e1:e2) on a non-array is a substring of a character scalar; functions never take sections.
  isSubstringRef(e) {
    return Boolean(e.args && e.args.length === 1 && e.args[0].k === 'section' && !this.isArray(e.name));
  }

  scanCall(name, args, pos, isFunction) {
    const sym = this.symbols.get(name);
    if (sym?.dummy) {
      sym.procDummy = true;
      sym.kind = 'proc';
    } else if (sym && sym.kind === 'var' && !sym.dims) {
      sym.kind = 'proc';
      sym.external = true;
    }
    if (this.library) {
      for (const arg of args) this.scanExpr(arg, 'value');
      return;
    }
    for (const arg of args) {
      if (arg.k === 'altReturn') {
        this.labelRefs.push(arg.target);
        continue;
      }
      if (arg.k === 'ref' && !arg.substring) {
        const argSym = this.symbols.get(arg.name);
        if (!arg.args) {
          if (argSym && this.isProcedureName(arg.name)) {
            argSym.procArg = true;
            continue;
          }
          if (argSym?.kind === 'param') continue;
          const target = argSym ?? this.declare(arg.name, arg.pos);
          if (target.kind === 'var') target.passed = true;
          continue;
        }
        if (argSym?.dims) {
          argSym.passed = true;
          for (const sub of arg.args) this.scanExpr(sub, 'value');
          continue;
        }
      }
      this.scanExpr(arg, 'value');
    }
  }
  // ------------------------------------------------------------ storage planning

  planStorage() {
    const parent = new Map();
    const find = sym => {
      let delta = 0;
      let node = sym;
      while (parent.has(node)) {
        const link = parent.get(node);
        delta += link.delta;
        node = link.to;
      }
      return { root: node, delta };
    };
    const members = new Set();
    for (const set of this.equivSets) {
      const items = set.items.map(item => this.equivItem(item));
      const [anchor, ...rest] = items;
      members.add(anchor.sym);
      for (const item of rest) {
        members.add(item.sym);
        const a = find(anchor.sym), b = find(item.sym);
        // pos(anchor) + anchor.offset === pos(item) + item.offset
        if (a.root === b.root) {
          if (a.delta + anchor.offset !== b.delta + item.offset) this.fail(set.pos, 'Contradictory EQUIVALENCE');
          continue;
        }
        parent.set(b.root, { to: a.root, delta: a.delta + anchor.offset - b.delta - item.offset });
      }
    }
    const groups = new Map();
    for (const sym of members) {
      const { root, delta } = find(sym);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push({ sym, delta });
    }
    for (const group of groups.values()) {
      const inCommon = group.filter(member => member.sym.common);
      if (inCommon.length) {
        const { sym: first, delta } = inCommon[0];
        const rootPos = first.commonOffset - delta;
        for (const member of inCommon.slice(1)) {
          if (member.sym.common !== first.common || member.sym.commonOffset - member.delta !== rootPos)
            this.fail(member.sym.pos, `EQUIVALENCE of ${member.sym.name} conflicts with COMMON storage`);
        }
        for (const member of group) {
          if (member.sym.common) continue;
          const offset = rootPos + member.delta;
          if (offset < 0) this.fail(member.sym.pos, `EQUIVALENCE would extend COMMON /${first.common.slice(2)}/ backward`);
          member.sym.common = first.common;
          member.sym.commonOffset = offset;
          this.commonEnds.set(first.common, Math.max(this.commonEnds.get(first.common) || 0, offset + this.cells(member.sym)));
        }
        continue;
      }
      const low = Math.min(...group.map(member => member.delta));
      const high = Math.max(...group.map(member => member.delta + this.cells(member.sym)));
      const block = { size: high - low, address: null };
      for (const member of group) member.sym.equiv = { block, offset: member.delta - low };
    }
    for (const [key, size] of this.commonEnds) this.program.noteCommonSize(key, size);
  }

  equivItem(ref) {
    const sym = this.declare(ref.name, ref.pos);
    this.symType(sym);
    if (sym.dummy) this.fail(ref.pos, `Dummy argument ${ref.name} cannot appear in EQUIVALENCE`);
    if (sym.kind !== 'var') this.fail(ref.pos, `${ref.name} cannot appear in EQUIVALENCE`);
    if (sym.dims && !sym.dimInfo) this.resolveDims(sym);
    let offset = 0;
    let substring = ref.substring;
    let args = ref.args;
    if (args && !sym.dims) {
      if (args.length === 1 && args[0].k === 'section') {
        substring = args[0];
        args = null;
      } else this.fail(ref.pos, `${ref.name} is not an array`);
    }
    if (args) {
      const subs = args.map(arg => this.constInt(arg, 'An EQUIVALENCE subscript'));
      offset = this.constElementIndex(sym, subs, ref.pos) * this.elementCells(sym);
    }
    if (substring?.from && this.constInt(substring.from, 'An EQUIVALENCE substring bound') !== 1)
      this.fail(ref.pos, 'EQUIVALENCE of character substrings other than (1:...) is not supported');
    return { sym, offset };
  }

  constElementIndex(sym, subs, pos) {
    const dims = sym.dimInfo.dims;
    if (subs.length !== dims.length) this.fail(pos, `${sym.name} has ${dims.length} dimension(s)`);
    let index = 0, stride = 1;
    dims.forEach((dim, i) => {
      if (dim.lower.c === undefined || (dim.upper && dim.upper.c === undefined))
        this.fail(pos, `${sym.name} has adjustable bounds`);
      if (subs[i] < dim.lower.c || (dim.upper && subs[i] > dim.upper.c))
        this.fail(pos, `Subscript ${subs[i]} is out of bounds for ${sym.name}`);
      index += (subs[i] - dim.lower.c) * stride;
      if (dim.upper) stride *= dim.upper.c - dim.lower.c + 1;
    });
    return index;
  }

  // ------------------------------------------------------------ homes and locations

  getVar(name, pos) {
    const sym = this.declare(name, pos);
    this.symType(sym);
    return sym;
  }

  homeOf(sym) {
    if (sym.home) return sym.home;
    if (sym.entryResult && this.resultSym && sym !== this.resultSym) return (sym.home = this.homeOf(this.resultSym));
    const reg = `${this.prefix}${sym.name}`;
    if (sym.dummy) {
      this.program.frameRegs.add(reg);
      return (sym.home = { kind: this.library ? 'value' : 'dummy', reg });
    }
    if (sym.common) return (sym.home = { kind: 'mem', addr: this.program.commonAddress(sym.common) + sym.commonOffset });
    if (sym.equiv) {
      if (sym.equiv.block.address === null) sym.equiv.block.address = this.program.alloc(sym.equiv.block.size);
      return (sym.home = { kind: 'mem', addr: sym.equiv.block.address + sym.equiv.offset });
    }
    if (sym.passed && !this.library) {
      const home = { kind: 'mem', addr: this.program.alloc(this.cells(sym)) };
      this.program.symbols.push({ unit: this.name, name: sym.name, address: home.addr, type: sym.type });
      return (sym.home = home);
    }
    if (sym.dims || sym.type === 'complex') {
      const len = (sym.dims ? sym.dimInfo.count : 1) * (sym.type === 'complex' ? 2 : 1);
      this.program.arrays.set(reg, len);
      return (sym.home = { kind: 'arr', base: reg, len });
    }
    return (sym.home = { kind: 'name', reg });
  }

  // Cells per element as laid out in the variable's home.
  homeCells(sym) {
    const home = this.homeOf(sym);
    if (home.kind === 'arr') return sym.type === 'complex' ? 2 : 1;
    return UNITS[sym.type];
  }

  baseLoc(sym, offset = I(0)) {
    const home = this.homeOf(sym);
    switch (home.kind) {
      case 'name':
      case 'value':
        return { k: 'reg', name: home.reg };
      case 'arr':
        return { k: 'cell', base: home.base, len: home.len, idx: fold(offset) };
      case 'mem':
        return { k: 'cell', base: MEMORY, len: MEMCAP, idx: fold(bin('+', I(home.addr), offset)) };
      default:
        return { k: 'cell', base: MEMORY, len: MEMCAP, idx: fold(bin('+', N(home.reg), offset)) };
    }
  }

  astInt(e) {
    const value = this.tryConst(e);
    if (value) {
      if (value.t !== 'integer') this.fail(e.pos, 'Subscripts and substring bounds must be INTEGER');
      return I(value.v);
    }
    return { k: 'ast', e };
  }

  dimReg(sym, i, what) {
    return `${this.internal}K${sym.name}${what}${i}`;
  }

  elementOffset(sym, args, pos) {
    const dims = sym.dimInfo.dims;
    if (args.length !== dims.length) this.fail(pos, `${sym.name} has ${dims.length} dimension(s)`);
    let offset = I(0);
    let stride = I(1);
    dims.forEach((dim, i) => {
      if (args[i].k === 'section') this.fail(args[i].pos, 'Array sections are not FORTRAN 77');
      const lower = dim.lower.c !== undefined ? I(dim.lower.c) : N(this.dimReg(sym, i, 'L'));
      const term = sym.dimInfo.constant ? stride : N(this.dimReg(sym, i, 'S'));
      offset = fold(bin('+', offset, bin('*', bin('-', this.astInt(args[i]), lower), term)));
      if (sym.dimInfo.constant) stride = I(stride.value * (dim.upper.c - dim.lower.c + 1));
    });
    return fold(bin('*', offset, I(this.homeCells(sym))));
  }

  offsetLoc(loc, n) {
    if (loc.k === 'reg') throw new Error('internal: register location has no neighbours');
    return { ...loc, idx: fold(bin('+', loc.idx, I(n))) };
  }

  genIdx(node) {
    switch (node.k) {
      case 'int': this.emit(pushInt(node.value)); return;
      case 'iname': this.emit(`LOAD_NAME ${node.name}`); return;
      case 'ast': this.genAs(node.e, 'integer', 'Subscripts and substring bounds must be INTEGER'); return;
      default:
        this.genIdx(node.left);
        this.genIdx(node.right);
        this.emit(node.op === '+' ? 'ADD' : node.op === '-' ? 'SUB' : 'MUL');
    }
  }

  loadLoc(loc) {
    if (loc.k === 'reg') {
      this.emit(`LOAD_NAME ${loc.name}`);
      return;
    }
    this.genIdx(loc.idx);
    this.emit(`ARR_GET ${loc.base} ${loc.len}`);
  }

  storeLoc(loc, value) {
    if (loc.k === 'reg') {
      value();
      this.emit(`STORE_NAME ${loc.name}`);
      return;
    }
    this.genIdx(loc.idx);
    value();
    this.emit(`ARR_SET ${loc.base} ${loc.len}`);
  }

  // Location of a scalar variable or array element designator (without substring).
  designator(ref) {
    if (this.sfScope?.has(ref.name)) this.fail(ref.pos, `Statement function dummy ${ref.name} cannot be defined`);
    const sym = this.getVar(ref.name, ref.pos);
    if (sym.kind === 'param') this.fail(ref.pos, `${ref.name} is a PARAMETER and cannot be defined`);
    if (sym.kind !== 'var') this.fail(ref.pos, `${ref.name} is not a variable`);
    let args = ref.args, substring = ref.substring;
    if (args && !sym.dims) {
      if (this.isSubstringRef(ref)) {
        substring = args[0];
        args = null;
      } else this.fail(ref.pos, `${ref.name} is not an array`);
    }
    if (sym.dims && !args) return { sym, loc: this.baseLoc(sym), whole: true, substring };
    const loc = args ? this.baseLoc(sym, this.elementOffset(sym, args, ref.pos)) : this.baseLoc(sym);
    return { sym, loc, whole: false, substring };
  }

  symValueType(sym) {
    return T(sym.type, sym.type === 'character' ? (sym.varying ? null : sym.len) : null);
  }

  loadSym(sym, loc) {
    this.loadLoc(loc);
    if (sym.type === 'complex') this.loadLoc(this.offsetLoc(loc, 1));
    if (sym.type === 'character' && this.homeOf(sym).kind === 'dummy' && typeof sym.len === 'number') {
      this.emit(pushInt(0));
      this.emit(pushInt(sym.len));
      this.emit('SUBSTR');
    }
    const type = this.symValueType(sym);
    return sym.type === 'character' && sym.len === '*' && !sym.varying ? T('character', null) : type;
  }

  storeSym(sym, loc, type, value) {
    if (type.t === 'complex') {
      const im = this.temp();
      const re = this.temp();
      value();
      this.emit(`STORE_NAME ${im}`);
      this.emit(`STORE_NAME ${re}`);
      this.storeLoc(loc, () => this.emit(`LOAD_NAME ${re}`));
      this.storeLoc(this.offsetLoc(loc, 1), () => this.emit(`LOAD_NAME ${im}`));
      return;
    }
    this.storeLoc(loc, value);
  }
  // ------------------------------------------------------------ emission helpers

  emit(text) {
    if (this.dry) return;
    this.program.emit(text);
  }

  place(label) {
    this.emit(`${label}:`);
  }

  gl() {
    return `${this.labelPrefix}G${this.serial++}`;
  }

  stmtLabel(label) {
    return `${this.labelPrefix}L${label}`;
  }

  temp() {
    const name = `${this.internal}T${this.tempCount++}`;
    return name;
  }

  dtemp() {
    return `${this.internal}D${this.persistent++}`;
  }

  // Type of an expression without emitting code (memoised per AST node).
  infer(e) {
    if (!this.inferred) this.inferred = new WeakMap();
    if (this.inferred.has(e) && !this.sfScope) return this.inferred.get(e);
    const saved = { dry: this.dry, tempCount: this.tempCount, serial: this.serial };
    this.dry = true;
    let type;
    try {
      type = this.gen(e);
    } finally {
      Object.assign(this, saved);
    }
    if (!this.sfScope) this.inferred.set(e, type);
    return type;
  }

  emitConst(c) {
    switch (c.t) {
      case 'integer': this.emit(pushInt(c.v)); break;
      case 'real': this.emit(pushReal(c.v)); break;
      case 'double':
        this.emit(pushStr(String(c.v)));
        this.emit('CALL_EXT fortran.double 1');
        break;
      case 'logical': this.emit(pushInt(c.v ? 1 : 0)); break;
      case 'character': this.emit(pushStr(c.v)); break;
      default:
        this.emit(pushReal(c.v.re));
        this.emit(pushReal(c.v.im));
    }
    return T(c.t, c.t === 'character' ? c.v.length : null);
  }

  convert(from, to, pos) {
    if (from.t === to) return;
    if (to === 'character' || from.t === 'character' || to === 'logical' || from.t === 'logical')
      this.fail(pos, `Cannot convert ${TYPE_NAMES[from.t]} to ${TYPE_NAMES[to]}`);
    if (from.t === 'complex') {
      this.emit('STORE_NAME _X');
      if (to === 'integer') this.emit('TRUNC');
      else if (to === 'double') this.emit('CALL_EXT fortran.double 1');
      return;
    }
    if (to === 'complex') {
      if (from.t === 'integer') this.emit('TO_REAL');
      this.emit(pushReal(0));
      return;
    }
    if (to === 'double') this.emit('CALL_EXT fortran.double 1');
    else if (from.t === 'double' && to === 'real') this.emit('TO_REAL');
    else if (to === 'integer') this.emit('TRUNC');
    else if (from.t === 'integer') this.emit('TO_REAL');
  }

  genAs(e, t, message = null) {
    const type = this.gen(e);
    if (message && type.t !== t) this.fail(e.pos, message);
    this.convert(type, t, e.pos);
    return T(t, type.len);
  }

  genLogical(e) {
    const type = this.gen(e);
    if (type.t !== 'logical') this.fail(e.pos, 'A LOGICAL expression is required');
  }

  // Fit the character value on the stack (length `from`) to length `to`.
  fitChar(from, to) {
    if (to === null || to === undefined) return;
    if (to === '*') throw new Error('internal: assumed length fit requires a runtime length');
    if (typeof from === 'number' && from === to) return;
    if (typeof from !== 'number' || from < to) {
      this.emit(pushStr(blanks(typeof from === 'number' ? to - from : to)));
      this.emit('CONCAT');
    }
    if (typeof from !== 'number' || from > to) {
      this.emit(pushInt(0));
      this.emit(pushInt(to));
      this.emit('SUBSTR');
    }
  }

  // Store a value into a variable, converting and padding as for an assignment statement.
  assignTo(target, valueExpr, pos) {
    const { sym, loc, whole, substring } = this.designator(target);
    if (whole) this.fail(pos, `Array ${sym.name} cannot be assigned as a whole`);
    if (substring) {
      if (sym.type !== 'character') this.fail(pos, `${sym.name} is not CHARACTER`);
      this.storeSubstring(sym, loc, substring, () => this.gen(valueExpr), valueExpr.pos);
      return;
    }
    this.assignValue(sym, loc, () => this.gen(valueExpr), pos);
  }

  assignValue(sym, loc, valueGen, pos) {
    const target = this.symValueType(sym);
    this.storeSym(sym, loc, target, () => {
      const overlay = target.t === 'character' && this.homeOf(sym).kind === 'dummy';
      if (overlay) this.loadLoc(loc);
      const type = valueGen();
      if (target.t === 'character') {
        if (type.t !== 'character') this.fail(pos, `Cannot assign ${TYPE_NAMES[type.t]} to CHARACTER`);
        if (sym.len === '*' && !sym.varying) {
          this.loadLoc(loc);
          this.emit('STRLEN');
          this.callLibraryRaw('FPAD', 2, pos);
        } else this.fitChar(type.len, target.len);
        if (overlay) this.emit('CALL_EXT fortran.overlay 2');
        return;
      }
      if ((target.t === 'logical') !== (type.t === 'logical'))
        this.fail(pos, `Cannot assign ${TYPE_NAMES[type.t]} to ${TYPE_NAMES[target.t]}`);
      this.convert(type, target.t, pos);
    });
  }

  storeSubstring(sym, loc, range, valueGen, pos) {
    const from = range.from ? this.astInt(range.from) : I(1);
    const knownLen = typeof sym.len === 'number' && !sym.varying ? sym.len : null;
    const whole = this.temp();
    this.loadSym(sym, loc);
    this.emit(`STORE_NAME ${whole}`);
    const to = range.to ? this.astInt(range.to) : knownLen !== null ? I(knownLen) : null;
    const fromReg = this.temp(), toReg = this.temp();
    this.genIdx(from);
    this.emit(`STORE_NAME ${fromReg}`);
    if (to) this.genIdx(to);
    else {
      this.emit(`LOAD_NAME ${whole}`);
      this.emit('STRLEN');
    }
    this.emit(`STORE_NAME ${toReg}`);
    this.storeLoc(loc, () => {
      this.emit(`LOAD_NAME ${whole}`);
      this.emit(pushInt(0));
      this.emit(`LOAD_NAME ${fromReg}`);
      this.emit(pushInt(1));
      this.emit('SUB');
      this.emit('SUBSTR');
      const type = valueGen();
      if (type.t !== 'character') this.fail(pos, 'A CHARACTER value is required');
      const count = from.k === 'int' && to?.k === 'int' ? to.value - from.value + 1 : null;
      if (count !== null) this.fitChar(type.len, Math.max(0, count));
      else {
        this.emit(`LOAD_NAME ${toReg}`);
        this.emit(`LOAD_NAME ${fromReg}`);
        this.emit('SUB');
        this.emit(pushInt(1));
        this.emit('ADD');
        this.callLibraryRaw('FPAD', 2, pos);
      }
      this.emit('CONCAT');
      this.emit(`LOAD_NAME ${whole}`);
      this.emit(`LOAD_NAME ${toReg}`);
      this.emit(`LOAD_NAME ${whole}`);
      this.emit('STRLEN');
      this.emit('SUBSTR');
      this.emit('CONCAT');
    });
  }

  // Leaves value(1:...) of the character value produced by `value` on the stack.
  substringValue(value, len, range) {
    const from = range.from ? this.astInt(range.from) : I(1);
    const to = range.to ? this.astInt(range.to) : typeof len === 'number' ? I(len) : null;
    if (!to) {
      const whole = this.temp();
      value();
      this.emit(`STORE_NAME ${whole}`);
      this.emit(`LOAD_NAME ${whole}`);
      this.genIdx(fold(bin('-', from, I(1))));
      this.emit(`LOAD_NAME ${whole}`);
      this.emit('STRLEN');
      this.genIdx(fold(bin('-', from, I(1))));
      this.emit('SUB');
      this.emit('SUBSTR');
      return T('character', null);
    }
    value();
    this.genIdx(fold(bin('-', from, I(1))));
    this.genIdx(fold(bin('+', bin('-', to, from), I(1))));
    this.emit('SUBSTR');
    const count = from.k === 'int' && to.k === 'int' ? Math.max(0, to.value - from.value + 1) : null;
    return T('character', count);
  }

  // ------------------------------------------------------------ expressions

  gen(e) {
    if (e.k !== 'ref' || !e.args) {
      const constant = e.k === 'ref' && this.sfScope?.has(e.name) ? null : this.tryConst(e);
      if (constant) return this.emitConst(constant);
    }
    switch (e.k) {
      case 'paren': return this.gen(e.expr);
      case 'ref': return this.genRef(e);
      case 'complex':
        this.genAs(e.re, 'real');
        this.genAs(e.im, 'real');
        return T('complex');
      case 'unary': return this.genUnary(e);
      case 'binary': return this.genBinary(e);
      case 'section': return this.fail(e.pos, 'Unexpected section');
      default: return this.fail(e.pos, `Unexpected ${e.k} expression`);
    }
  }

  genUnary(e) {
    if (e.op === '.NOT.') {
      this.genLogical(e.operand);
      this.emit('NOT');
      return T('logical');
    }
    const type = this.infer(e.operand);
    if (!isNumeric(type.t)) this.fail(e.pos, `Unary ${e.op} requires a numeric operand`);
    if (e.op === '+') return this.gen(e.operand);
    if (type.t === 'complex') {
      const re = this.temp(), im = this.temp();
      this.gen(e.operand);
      this.emit(`STORE_NAME ${im}`);
      this.emit(`STORE_NAME ${re}`);
      for (const part of [re, im]) {
        this.emit(pushReal(0));
        this.emit(`LOAD_NAME ${part}`);
        this.emit('SUB');
      }
      return type;
    }
    this.emit(type.t === 'integer' ? pushInt(0) : pushReal(0));
    this.gen(e.operand);
    this.emit('SUB');
    return type;
  }

  genBinary(e) {
    const op = e.op;
    if (['+', '-', '*', '/'].includes(op)) return this.genArithmetic(e);
    if (op === '**') return this.genPower(e);
    if (op === '//') {
      const a = this.gen(e.left);
      const b = this.gen(e.right);
      if (a.t !== 'character' || b.t !== 'character') this.fail(e.pos, '// requires CHARACTER operands');
      this.emit('CONCAT');
      return T('character', typeof a.len === 'number' && typeof b.len === 'number' ? a.len + b.len : null);
    }
    if (REL_OPS[op]) return this.genRelational(REL_OPS[op], e.left, e.right, e.pos);
    this.genLogical(e.left);
    this.genLogical(e.right);
    this.emit(op === '.AND.' ? 'AND' : op === '.OR.' ? 'OR' : op === '.EQV.' ? 'EQ' : 'NEQ');
    return T('logical');
  }

  arithmeticType(a, b, op, pos) {
    if (!isNumeric(a.t) || !isNumeric(b.t)) this.fail(pos, `Operator ${op} requires numeric operands`);
    return RANK[a.t] >= RANK[b.t] ? a.t : b.t;
  }

  genArithmetic(e) {
    const a = this.infer(e.left), b = this.infer(e.right);
    const t = this.arithmeticType(a, b, e.op, e.pos);
    if (t === 'complex') {
      this.genAs(e.left, 'complex');
      this.genAs(e.right, 'complex');
      this.complexArithmetic(e.op, e.pos);
      return T('complex');
    }
    this.genAs(e.left, t);
    this.genAs(e.right, t);
    if (e.op === '/') this.emit(t === 'integer' ? 'DIV' : 'RDIV');
    else this.emit(e.op === '+' ? 'ADD' : e.op === '-' ? 'SUB' : 'MUL');
    return T(t);
  }

  complexArithmetic(op, pos) {
    if (op === '/') {
      this.callLibraryRaw('FCDIV', 4, pos);
      return;
    }
    const [ar, ai, br, bi] = [this.temp(), this.temp(), this.temp(), this.temp()];
    for (const name of [bi, br, ai, ar]) this.emit(`STORE_NAME ${name}`);
    const load = name => this.emit(`LOAD_NAME ${name}`);
    if (op === '+' || op === '-') {
      const opcode = op === '+' ? 'ADD' : 'SUB';
      load(ar); load(br); this.emit(opcode);
      load(ai); load(bi); this.emit(opcode);
      return;
    }
    load(ar); load(br); this.emit('MUL'); load(ai); load(bi); this.emit('MUL'); this.emit('SUB');
    load(ar); load(bi); this.emit('MUL'); load(ai); load(br); this.emit('MUL'); this.emit('ADD');
  }

  genPower(e) {
    const a = this.infer(e.left), b = this.infer(e.right);
    const t = this.arithmeticType(a, b, '**', e.pos);
    const exponent = b.t === 'integer' ? this.tryConst(e.right) : null;
    if (exponent && a.t !== 'complex' && exponent.v >= 0 && exponent.v <= 16) {
      if (exponent.v === 0) {
        this.emit(a.t === 'integer' ? pushInt(1) : pushReal(1));
        return T(a.t);
      }
      const base = this.temp();
      this.gen(e.left);
      if (exponent.v === 1) return T(a.t);
      this.emit(`STORE_NAME ${base}`);
      this.emit(`LOAD_NAME ${base}`);
      for (let i = 1; i < exponent.v; i += 1) {
        this.emit(`LOAD_NAME ${base}`);
        this.emit('MUL');
      }
      return T(a.t);
    }
    if (a.t === 'complex' || b.t === 'complex') {
      this.genAs(e.left, 'complex');
      if (b.t === 'integer') {
        this.gen(e.right);
        return this.callLibraryRaw('FCPOWI', 3, e.pos);
      }
      this.genAs(e.right, 'complex');
      return this.callLibraryRaw('FCPOWZ', 4, e.pos);
    }
    if (a.t === 'integer' && b.t === 'integer') {
      this.gen(e.left);
      this.gen(e.right);
      return this.callLibraryRaw('FIPOW', 2, e.pos);
    }
    if (b.t === 'integer') {
      this.gen(e.left);
      this.gen(e.right);
      this.callLibraryRaw('FRPOWI', 2, e.pos);
      return T(t);
    }
    this.genAs(e.left, 'real');
    this.genAs(e.right, 'real');
    this.callLibraryRaw('FRPOW', 2, e.pos);
    return T(t);
  }

  genRelational(op, left, right, pos) {
    const a = this.infer(left), b = this.infer(right);
    if (a.t === 'character' || b.t === 'character') {
      if (a.t !== b.t) this.fail(pos, 'Cannot compare CHARACTER with a non-CHARACTER value');
      if (typeof a.len === 'number' && typeof b.len === 'number') {
        this.gen(left);
        if (a.len < b.len) this.fitChar(a.len, b.len);
        this.gen(right);
        if (b.len < a.len) this.fitChar(b.len, a.len);
        this.emit(op);
        return T('logical');
      }
      this.gen(left);
      this.gen(right);
      this.callLibraryRaw('FCMP', 2, pos);
      this.emit(pushInt(0));
      this.emit(op);
      return T('logical');
    }
    if (a.t === 'logical' || b.t === 'logical') this.fail(pos, 'LOGICAL values cannot be compared with relational operators; use .EQV. or .NEQV.');
    if (a.t === 'complex' || b.t === 'complex') {
      if (op !== 'EQ' && op !== 'NEQ') this.fail(pos, 'COMPLEX values can only be compared with .EQ. and .NE.');
      this.genAs(left, 'complex');
      this.genAs(right, 'complex');
      const [ar, ai, br, bi] = [this.temp(), this.temp(), this.temp(), this.temp()];
      for (const name of [bi, br, ai, ar]) this.emit(`STORE_NAME ${name}`);
      this.emit(`LOAD_NAME ${ar}`); this.emit(`LOAD_NAME ${br}`); this.emit('EQ');
      this.emit(`LOAD_NAME ${ai}`); this.emit(`LOAD_NAME ${bi}`); this.emit('EQ');
      this.emit('AND');
      if (op === 'NEQ') this.emit('NOT');
      return T('logical');
    }
    this.gen(left);
    this.gen(right);
    this.emit(op);
    return T('logical');
  }

  genRef(e) {
    const scoped = this.sfScope?.get(e.name);
    if (scoped && !e.args) {
      this.emit(`LOAD_NAME ${scoped.regs[0]}`);
      if (scoped.regs[1]) this.emit(`LOAD_NAME ${scoped.regs[1]}`);
      if (e.substring) return this.substringValue(() => {}, scoped.type.len, e.substring);
      return scoped.type;
    }
    const sym = this.symbols.get(e.name);
    if (!e.args) {
      if (sym && this.isProcedureName(e.name) && !sym.result)
        this.fail(e.pos, `Procedure ${e.name} cannot be used as a value`);
      const ref = this.designator(e);
      if (ref.whole) this.fail(e.pos, `Array ${e.name} requires subscripts here`);
      return this.loadDesignator(ref);
    }
    if (sym?.dims || this.isSubstringRef(e)) return this.loadDesignator(this.designator(e));
    if (sym?.kind === 'stmtfn') return this.genStatementFunction(sym, e);
    if (this.isIntrinsicName(e.name)) return this.genIntrinsic(e.name, e.args, e.pos);
    if (this.library) {
      if (LIBRARY_PRIMITIVES[e.name]) return this.genPrimitive(e.name, e.args, e.pos, true);
      return this.callLibrary(e.name, e.args, e.pos, true);
    }
    return this.callUser(e.name, e.args, e.pos, true);
  }

  loadDesignator({ sym, loc, substring }) {
    if (!substring) return this.loadSym(sym, loc);
    if (sym.type !== 'character') this.fail(substring.pos, `${sym.name} is not CHARACTER`);
    const type = this.symValueType(sym);
    return this.substringValue(() => this.loadSym(sym, loc), type.len, substring);
  }

  genStatementFunction(sym, e) {
    if (e.args.length !== sym.sfParams.length)
      this.fail(e.pos, `Statement function ${sym.name} takes ${sym.sfParams.length} argument(s)`);
    if (this.sfActive?.has(sym.name)) this.fail(e.pos, `Statement function ${sym.name} cannot reference itself`);
    const scope = new Map();
    sym.sfParams.forEach((name, index) => {
      const type = this.typeOfName(name, e.pos);
      const regs = type.t === 'complex' ? [this.temp(), this.temp()] : [this.temp()];
      const argType = this.gen(e.args[index]);
      if (type.t === 'character') this.fitChar(argType.len, typeof type.len === 'number' ? type.len : null);
      else this.convert(argType, type.t, e.args[index].pos);
      for (const reg of [...regs].reverse()) this.emit(`STORE_NAME ${reg}`);
      scope.set(name, { regs, type: T(type.t, type.t === 'character' && typeof type.len === 'number' ? type.len : null) });
    });
    const savedScope = this.sfScope;
    this.sfScope = scope;
    this.sfActive = new Set([...(this.sfActive ?? []), sym.name]);
    let type;
    try {
      type = this.gen(sym.sfBody);
    } finally {
      this.sfScope = savedScope;
      this.sfActive.delete(sym.name);
    }
    if (sym.type === 'character') {
      if (type.t !== 'character') this.fail(e.pos, `Statement function ${sym.name} must produce CHARACTER`);
      this.fitChar(type.len, sym.len === '*' ? null : sym.len);
      return T('character', sym.len === '*' ? type.len : sym.len);
    }
    if ((sym.type === 'logical') !== (type.t === 'logical')) this.fail(e.pos, `Statement function ${sym.name} has the wrong type`);
    this.convert(type, sym.type, e.pos);
    return T(sym.type);
  }
  // ------------------------------------------------------------ intrinsic functions

  genIntrinsic(name, args, pos) {
    const spec = INTRINSICS[name];
    const types = args.map(arg => this.infer(arg));
    const need = (count, max = count) => {
      if (args.length < count || args.length > max)
        this.fail(pos, `${name} takes ${count === max ? count : `${count} to ${max}`} argument(s)`);
    };
    const numeric = () => types.forEach((type, i) => { if (!isNumeric(type.t)) this.fail(args[i].pos, `${name} requires numeric arguments`); });
    const generic = () => types.reduce((best, type) => (RANK[type.t] > RANK[best] ? type.t : best), types[0].t);
    const result = spec.res === 'arg' ? generic() : spec.res;
    const store = (t) => {
      const reg = this.temp();
      this.emit(`STORE_NAME ${reg}`);
      return reg;
    };
    const load = reg => this.emit(`LOAD_NAME ${reg}`);
    switch (spec.impl) {
      case 'int':
        need(1); numeric();
        this.gen(args[0]);
        this.convert(types[0], 'integer', pos);
        return T('integer');
      case 'real':
        need(1); numeric();
        this.gen(args[0]);
        this.convert(types[0], result, pos);
        return T(result);
      case 'cmplx':
        need(1, 2); numeric();
        if (args.length === 1) {
          this.genAs(args[0], 'complex');
          return T('complex');
        }
        this.genAs(args[0], 'real');
        this.genAs(args[1], 'real');
        return T('complex');
      case 'ichar':
        need(1);
        if (types[0].t !== 'character') this.fail(pos, 'ICHAR requires a CHARACTER argument');
        this.gen(args[0]);
        this.emit('ASC');
        return T('integer');
      case 'char':
        need(1);
        this.genAs(args[0], 'integer', 'CHAR requires an INTEGER argument');
        this.emit('CHR');
        return T('character', 1);
      case 'len': {
        need(1);
        if (types[0].t !== 'character') this.fail(pos, 'LEN requires a CHARACTER argument');
        if (typeof types[0].len === 'number') return this.emitConst({ t: 'integer', v: types[0].len });
        this.gen(args[0]);
        this.emit('STRLEN');
        return T('integer');
      }
      case 'aimag': {
        need(1);
        this.genAs(args[0], 'complex');
        const im = store();
        this.emit('STORE_NAME _X');
        load(im);
        return T('real');
      }
      case 'conjg': {
        need(1);
        this.genAs(args[0], 'complex');
        const im = store();
        this.emit(pushReal(0));
        load(im);
        this.emit('SUB');
        return T('complex');
      }
      case 'abs': {
        need(1); numeric();
        if (types[0].t === 'complex') {
          this.gen(args[0]);
          this.callLibraryRaw('FCABS', 2, pos);
          return T('real');
        }
        const t = spec.res === 'arg' ? types[0].t : spec.res;
        this.genAs(args[0], t);
        this.absOnStack(t);
        return T(t);
      }
      case 'aint':
      case 'anint':
      case 'nint': {
        need(1); numeric();
        this.genAs(args[0], types[0].t === 'double' ? 'double' : 'real');
        this.callLibraryRaw(spec.impl === 'aint' ? 'FAINT' : spec.impl === 'anint' ? 'FANINT' : 'FNINT', 1, pos);
        if (spec.impl === 'nint') return T('integer');
        return T(types[0].t === 'double' ? 'double' : 'real');
      }
      case 'mod': {
        need(2); numeric();
        const t = spec.res === 'arg' ? generic() : spec.res;
        if (t === 'integer') {
          const a = this.temp(), b = this.temp();
          this.genAs(args[0], t); this.emit(`STORE_NAME ${a}`);
          this.genAs(args[1], t); this.emit(`STORE_NAME ${b}`);
          load(a); load(a); load(b); this.emit('DIV'); load(b); this.emit('MUL'); this.emit('SUB');
          return T(t);
        }
        this.genAs(args[0], t);
        this.genAs(args[1], t);
        this.callLibraryRaw('FRMOD', 2, pos);
        return T(t);
      }
      case 'sign': {
        need(2); numeric();
        const t = spec.res === 'arg' ? generic() : spec.res;
        const b = this.temp();
        this.genAs(args[0], t);
        this.absOnStack(t);
        const magnitude = store();
        this.genAs(args[1], t);
        this.emit(`STORE_NAME ${b}`);
        const negative = this.gl(), done = this.gl();
        load(b); this.emit(pushInt(0)); this.emit('GE'); this.emit(`JZ ${negative}`);
        load(magnitude); this.emit(`JMP ${done}`);
        this.place(negative);
        this.emit(t === 'integer' ? pushInt(0) : pushReal(0)); load(magnitude); this.emit('SUB');
        this.place(done);
        return T(t);
      }
      case 'dim': {
        need(2); numeric();
        const t = spec.res === 'arg' ? generic() : spec.res;
        const a = this.temp(), b = this.temp();
        this.genAs(args[0], t); this.emit(`STORE_NAME ${a}`);
        this.genAs(args[1], t); this.emit(`STORE_NAME ${b}`);
        const zero = this.gl(), done = this.gl();
        load(a); load(b); this.emit('GT'); this.emit(`JZ ${zero}`);
        load(a); load(b); this.emit('SUB'); this.emit(`JMP ${done}`);
        this.place(zero);
        this.emit(t === 'integer' ? pushInt(0) : pushReal(0));
        this.place(done);
        return T(t);
      }
      case 'dprod':
        need(2); numeric();
        this.genAs(args[0], 'double');
        this.genAs(args[1], 'double');
        this.emit('MUL');
        return T('double');
      case 'max':
      case 'min': {
        if (args.length < 2) this.fail(pos, `${name} requires at least two arguments`);
        numeric();
        const work = generic();
        if (work === 'complex') this.fail(pos, `${name} does not accept COMPLEX arguments`);
        const best = this.temp(), next = this.temp();
        this.genAs(args[0], work);
        this.emit(`STORE_NAME ${best}`);
        for (const arg of args.slice(1)) {
          const skip = this.gl();
          this.genAs(arg, work);
          this.emit(`STORE_NAME ${next}`);
          load(next); load(best); this.emit(spec.impl === 'max' ? 'GT' : 'LT'); this.emit(`JZ ${skip}`);
          load(next); this.emit(`STORE_NAME ${best}`);
          this.place(skip);
        }
        load(best);
        const t = spec.res === 'arg' ? work : spec.res;
        this.convert(T(work), t, pos);
        return T(t);
      }
      case 'rtl': {
        need(2);
        if (types.some(type => type.t !== 'character')) this.fail(pos, `${name} requires CHARACTER arguments`);
        this.gen(args[0]);
        this.gen(args[1]);
        return this.callLibraryRaw(spec.rtl, 2, pos);
      }
      case 'math': {
        const two = name === 'ATAN2' || name === 'DATAN2';
        need(two ? 2 : 1); numeric();
        const t = spec.res === 'arg' ? (generic() === 'integer' ? 'real' : generic()) : spec.res;
        if (t === 'complex') {
          if (!spec.crtl) this.fail(pos, `${name} does not accept a COMPLEX argument`);
          this.genAs(args[0], 'complex');
          this.callLibraryRaw(spec.crtl, 2, pos);
          return T('complex');
        }
        for (const arg of args) this.genAs(arg, t);
        this.callLibraryRaw(spec.rtl, args.length, pos);
        return T(t);
      }
      case 'lexical': {
        need(2);
        if (types.some(type => type.t !== 'character')) this.fail(pos, `${name} requires CHARACTER arguments`);
        return this.genRelational(spec.op, args[0], args[1], pos);
      }
      default:
        return this.fail(pos, `Intrinsic ${name} is not supported`);
    }
  }

  absOnStack(t) {
    const value = this.temp();
    const negative = this.gl(), end = this.gl();
    this.emit(`STORE_NAME ${value}`);
    this.emit(`LOAD_NAME ${value}`);
    this.emit(pushInt(0));
    this.emit('GE');
    this.emit(`JZ ${negative}`);
    this.emit(`LOAD_NAME ${value}`);
    this.emit(`JMP ${end}`);
    this.place(negative);
    this.emit(t === 'integer' ? pushInt(0) : pushReal(0));
    this.emit(`LOAD_NAME ${value}`);
    this.emit('SUB');
    this.place(end);
  }
  // ------------------------------------------------------------ calls

  loadResult(unit, entryName) {
    const sym = unit.symbols.get(entryName);
    for (const text of homeLoadCode(unit.homeOf(unit.resultSym), sym.type)) this.emit(text);
    if (sym.type === 'character') return T('character', sym.varying || sym.len === '*' ? null : sym.len);
    return T(sym.type);
  }

  // Calls a runtime-library procedure whose by-value arguments are already on the stack.
  callLibraryRaw(name, argc, pos) {
    const routines = {
      FPAD: ['pad', 'character'], FCMP: ['ccmp', 'integer'], FINDEX: ['index', 'integer'],
      FAINT: ['aint', 'real'], FANINT: ['anint', 'real'], FNINT: ['nint', 'integer'],
      FRMOD: ['mod', 'real'], FIPOW: ['ipow', 'integer'], FRPOWI: ['pow', 'real'], FRPOW: ['pow', 'real'],
      FATAN2: ['atan2', 'real'],
      FCABS: ['cabs', 'real'], FCDIV: ['cdiv', 'complex'],
      FCSQRT: ['csqrt', 'complex'], FCEXP: ['cexp', 'complex'],
      FCLOG: ['clog', 'complex'], FCSIN: ['csin', 'complex'], FCCOS: ['ccos', 'complex'],
      FCPOWI: ['cpowi', 'complex'], FCPOWZ: ['cpow', 'complex'],
    };
    const math = /^F(SQRT|EXP|LOG|LOG10|SIN|COS|TAN|ASIN|ACOS|ATAN|SINH|COSH|TANH)$/.exec(name);
    if (math) {
      this.emit(pushStr(math[1].toLowerCase()));
      this.emit(`CALL_EXT fortran.math ${argc + 1}`);
      return T('real');
    }
    const routine = routines[name];
    if (!routine) this.fail(pos, `Runtime library routine ${name} is not implemented`);
    this.emit(`CALL_EXT fortran.${routine[0]} ${argc}`);
    return T(routine[1]);
  }

  libraryRoutine(name, args, pos) {
    const found = this.program.libraryEntry(name, !this.dry);
    if (!found) this.fail(pos, `Runtime library routine ${name} is not available`);
    found.entry.params.forEach((param, index) => {
      const type = found.unit.symbols.get(param).type;
      const arg = args[index];
      if (typeof arg === 'function') arg();
      else if (typeof arg === 'number') this.emit(pushInt(arg));
      else if (typeof arg === 'string') this.emit(pushStr(arg));
      else if (type === 'character' || type === 'logical') {
        const argType = this.gen(arg);
        if (argType.t !== type) this.fail(arg.pos, `${TYPE_NAMES[type]} value required`);
      } else this.genAs(arg, type);
    });
    this.emit(`CALL ${found.entry.label} ${found.entry.params.length}`);
    if (found.unit.kind !== 'function') return null;
    return this.loadResult(found.unit, found.entry.name);
  }

  callLibrary(name, args, pos, isFunction) {
    const found = this.program.libraryEntry(name, false);
    if (!found) this.fail(pos, `Undefined ${isFunction ? 'function' : 'subroutine'} ${name}`);
    if (isFunction !== (found.unit.kind === 'function'))
      this.fail(pos, `${name} is ${found.unit.kind === 'function' ? 'a function' : 'a subroutine'}`);
    if (args.length !== found.entry.params.length)
      this.fail(pos, `${name} takes ${found.entry.params.length} argument(s)`);
    return this.libraryRoutine(name, args, pos);
  }

  genPrimitive(name, args, pos, isFunction) {
    const spec = LIBRARY_PRIMITIVES[name];
    if (args.length !== spec.args) this.fail(pos, `${name} takes ${spec.args} argument(s)`);
    if (isFunction && !spec.res) this.fail(pos, `${name} is a subroutine`);
    if (!isFunction && spec.res) this.fail(pos, `${name} is a function`);
    const readInto = (opcode, target) => {
      this.emit(opcode);
      const flag = this.temp(), line = this.temp();
      this.emit(`STORE_NAME ${flag}`);
      this.emit(`STORE_NAME ${line}`);
      const { sym, loc } = this.designator(target);
      this.assignValue(sym, loc, () => {
        this.emit(`LOAD_NAME ${line}`);
        return T('character', null);
      }, pos);
      this.emit(`LOAD_NAME ${flag}`);
      return T('logical');
    };
    switch (name) {
      case 'PFOPEN':
        this.genAs(args[0], 'character', 'PFOPEN requires a CHARACTER file name');
        this.genAs(args[1], 'character', 'PFOPEN requires a CHARACTER mode');
        this.emit('FOPEN');
        return T('integer');
      case 'PFREAD':
        this.genAs(args[0], 'integer');
        return readInto('FREADLN', args[1]);
      case 'PGETLN':
        return readInto('READLN', args[0]);
      case 'PFWRIT':
        this.genAs(args[0], 'integer');
        this.genAs(args[1], 'character', 'PFWRIT requires CHARACTER text');
        this.emit('FWRITELN');
        return null;
      case 'PFCLOS':
        this.genAs(args[0], 'integer');
        this.emit('FCLOSE');
        return null;
      case 'PPUTLN':
        this.genAs(args[0], 'character', 'PPUTLN requires CHARACTER text');
        this.emit('PRINT');
        this.emit('PRINT_NL');
        return null;
      default:
        this.genAs(args[0], 'character', 'PPUT requires CHARACTER text');
        this.emit('PRINT');
        return null;
    }
  }

  callUser(name, args, pos, isFunction) {
    const actuals = args.filter(arg => arg.k !== 'altReturn');
    const alternates = args.filter(arg => arg.k === 'altReturn');
    const sym = this.symbols.get(name);
    if (sym?.procDummy) {
      if (alternates.length) this.fail(pos, 'Alternate returns through a dummy procedure are not supported');
      for (const arg of actuals) this.pushActual(arg);
      const type = isFunction ? this.typeOfName(name, pos) : null;
      if (!this.dry) {
        this.program.sections[this.program.section].push({
          dispatch: { reg: this.homeOf(sym).reg, argc: actuals.length, type, name, pos, unit: this },
          loc: this.program.loc
        });
      }
      return type ? T(type.t, type.t === 'character' && typeof type.len === 'number' ? type.len : null) : null;
    }
    const found = this.program.userEntries.get(name);
    if (!found) {
      if (INTRINSICS[name] && !isFunction) this.fail(pos, `${name} is an intrinsic function, not a subroutine`);
      this.fail(pos, `Undefined ${isFunction ? 'function' : 'subroutine'} ${name}`);
    }
    const { unit, entry } = found;
    if (isFunction && unit.kind !== 'function') this.fail(pos, `${name} is a subroutine; use CALL`);
    if (!isFunction && unit.kind !== 'subroutine') this.fail(pos, `${name} is not a subroutine`);
    if (actuals.length !== entry.params.length)
      this.fail(pos, `${name} takes ${entry.params.length} argument(s) but ${actuals.length} were given`);
    if (alternates.length !== entry.stars)
      this.fail(pos, `${name} takes ${entry.stars} alternate return specifier(s)`);
    let resultLen = null;
    if (isFunction) {
      const resultSym = unit.symbols.get(entry.name);
      if (resultSym.type === 'character' && resultSym.len === '*') {
        resultLen = this.typeOfName(name, pos).len;
        if (typeof resultLen !== 'number') this.fail(pos, `The calling unit must declare the length of CHARACTER*(*) function ${name}`);
        this.storeLoc(homeLoc(unit.homeOf(unit.resultSym)), () => this.emit(pushStr(blanks(resultLen))));
      }
    }
    for (const arg of actuals) this.pushActual(arg);
    this.emit(`CALL ${entry.label} ${actuals.length}`);
    alternates.forEach((alternate, index) => {
      this.labelRefs.push(alternate.target);
      this.emit('LOAD_NAME _ALTRET');
      this.emit(pushInt(index + 1));
      this.emit('NEQ');
      this.emit(`JZ ${this.stmtLabel(alternate.target.label)}`);
    });
    if (!isFunction) return null;
    const type = this.loadResult(unit, entry.name);
    return resultLen !== null ? T('character', resultLen) : type;
  }

  // Pushes the _M address of an actual argument (FORTRAN call by reference).
  pushActual(arg) {
    if (arg.k === 'ref' && !arg.substring && !this.sfScope?.has(arg.name)) {
      const sym = this.symbols.get(arg.name);
      if (!arg.args) {
        if (sym && !sym.result && this.isProcedureName(arg.name)) {
          this.pushProcedure(sym, arg);
          return;
        }
        if (sym?.kind !== 'param' && !(sym && this.isProcedureName(arg.name))) {
          const variable = this.getVar(arg.name, arg.pos);
          const loc = this.baseLoc(variable);
          if (loc.k === 'cell' && loc.base === MEMORY) {
            this.genIdx(loc.idx);
            return;
          }
        }
      } else if (sym?.dims) {
        const loc = this.baseLoc(sym, this.elementOffset(sym, arg.args, arg.pos));
        if (loc.base === MEMORY) {
          this.genIdx(loc.idx);
          return;
        }
      }
    }
    const type = this.infer(arg);
    const address = this.dry ? 0 : this.program.alloc(UNITS[type.t]);
    const cell = { k: 'cell', base: MEMORY, len: MEMCAP, idx: I(address) };
    this.storeSym({ type: type.t }, cell, type, () => this.gen(arg));
    this.emit(pushInt(address));
  }

  pushProcedure(sym, arg) {
    if (sym.dummy) {
      this.emit(`LOAD_NAME ${this.homeOf(sym).reg}`);
      return;
    }
    if (sym.intrinsic) {
      if (!PASSABLE_INTRINSICS.has(arg.name)) this.fail(arg.pos, `Intrinsic ${arg.name} cannot be passed as an argument`);
      this.emit(pushInt(this.program.procId(this.program.wrapperFor(arg.name))));
      return;
    }
    const found = this.program.userEntries.get(arg.name);
    if (!found) this.fail(arg.pos, `Undefined external procedure ${arg.name}`);
    this.emit(pushInt(this.program.procId({ label: found.entry.label, unit: found.unit, entry: found.entry })));
  }
  initialize() {
    for (const sym of this.symbols.values()) {
      if (sym.kind !== 'var' || sym.dummy) continue;
      const count = sym.dims ? sym.dimInfo.count : 1;
      if (!Number.isInteger(count)) this.fail(sym.pos, 'Adjustable local arrays are not supported');
      const value = sym.type === 'character' ? { t: 'character', v: blanks(sym.len) }
        : sym.type === 'complex' ? { t: 'complex', v: { re: 0, im: 0 } }
          : { t: sym.type, v: 0 };
      for (let index = 0; index < count; index++) {
        this.storeSym(sym, this.baseLoc(sym, I(index * this.homeCells(sym))), T(sym.type),
          () => this.emitConst(value));
      }
    }
  }

  initializeData() {
    const objects = list => list.flatMap(object => {
      if (object.k === 'implied') {
        const start = this.constInt(object.start, 'DATA implied DO start');
        const end = this.constInt(object.end, 'DATA implied DO limit');
        const step = object.step ? this.constInt(object.step, 'DATA implied DO step') : 1;
        if (!step) this.fail(object.pos, 'DATA implied DO step is zero');
        const result = [], saved = this.constScope;
        this.constScope = new Map(saved);
        for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
          if (result.length > 100000) this.fail(object.pos, 'DATA implied DO exceeds storage limit');
          this.constScope.set(object.variable, { t: 'integer', v: value });
          result.push(...objects(object.objects));
        }
        this.constScope = saved;
        return result;
      }
      const sym = this.getVar(object.name, object.pos);
      let args = object.args, substring = object.substring;
      if (!sym.dims && args?.length === 1 && args[0].k === 'section') {
        substring = args[0];
        args = null;
      }
      if (substring) {
        if (sym.type !== 'character') this.fail(object.pos, 'DATA substring must be CHARACTER');
        substring = {
          ...substring, from: I(substring.from ? this.constInt(substring.from, 'DATA substring bound') : 1),
          to: I(substring.to ? this.constInt(substring.to, 'DATA substring bound') : sym.len),
        };
        if (substring.from.value < 1 || substring.to.value < substring.from.value || substring.to.value > sym.len)
          this.fail(object.pos, 'DATA substring bounds are outside the character variable');
      }
      if (sym.dims && !args) {
        return Array.from({ length: sym.dimInfo.count }, (_, index) =>
          ({ sym, loc: this.baseLoc(sym, I(index * this.homeCells(sym))) }));
      }
      const offset = args ? this.constElementIndex(sym,
        args.map(arg => this.constInt(arg, 'DATA subscript')), object.pos) * this.homeCells(sym) : 0;
      return [{ sym, loc: this.baseLoc(sym, I(offset)), substring }];
    });
    for (const statement of this.dataStmts) {
      for (const set of statement.sets) {
        const targets = objects(set.objects);
        const values = set.values.flatMap(item => {
          const count = item.repeat ? this.constInt(item.repeat, 'DATA repetition count') : 1;
          if (count < 1 || count > 100000) this.fail(item.pos, 'Invalid DATA repetition count');
          return Array.from({ length: count }, () => this.cval(item.value));
        });
        if (targets.length !== values.length) this.fail(set.pos, 'DATA objects and values have different lengths');
        targets.forEach(({ sym, loc, substring }, index) => {
          const value = convertConst(values[index], sym.type, message => this.fail(set.pos, message));
          if (substring) {
            this.storeSubstring(sym, loc, substring, () => this.emitConst(value), set.pos);
            return;
          }
          if (sym.type === 'character') value.v = padTo(value.v, sym.len);
          this.storeSym(sym, loc, T(sym.type), () => this.emitConst(value));
        });
      }
    }
  }

  outputItem(item, legacy) {
    if (item.k === 'implied') {
      this.loop(item, () => item.items.forEach(value => this.outputItem(value, legacy)));
      return;
    }
    const sym = item.k === 'ref' && !item.args ? this.symbols.get(item.name) : null;
    if (sym?.dims) {
      if (!Number.isInteger(sym.dimInfo.count)) this.fail(item.pos, 'Whole-array output requires constant array bounds');
      for (let index = 0; index < sym.dimInfo.count; index++) {
        const type = this.loadSym(sym, this.baseLoc(sym, I(index * this.homeCells(sym))));
        this.outputValue(type, legacy);
      }
      return;
    }
    this.outputValue(this.gen(item), legacy);
  }

  outputValue(type, legacy) {
    if (type.t === 'complex') {
      if (legacy) this.fail(this.program.loc, 'COMPLEX requires formatted or list-directed output');
      this.emit('CALL_EXT fortran.complexitem 2');
      return;
    }
    if (legacy) this.emit('PRINT');
    else {
      this.emit(pushStr({ integer: 'I', real: 'R', double: 'D', logical: 'L', character: 'C' }[type.t]));
      this.emit('CALL_EXT fortran.item 2');
    }
  }

  loop(statement, body) {
    const sym = this.getVar(statement.variable, statement.pos);
    if (!isNumeric(sym.type) || sym.type === 'complex') this.fail(statement.pos, 'DO variable must be numeric');
    const start = this.dtemp(), end = this.dtemp(), step = this.dtemp(), count = this.dtemp();
    this.genAs(statement.start, sym.type); this.emit(`STORE_NAME ${start}`);
    this.genAs(statement.end, sym.type); this.emit(`STORE_NAME ${end}`);
    if (statement.step) this.genAs(statement.step, sym.type);
    else this.emit(sym.type === 'integer' ? pushInt(1) : pushReal(1));
    this.emit(`STORE_NAME ${step}`);
    this.emit(`LOAD_NAME ${start}`); this.emit(`LOAD_NAME ${end}`); this.emit(`LOAD_NAME ${step}`);
    this.emit('CALL_EXT fortran.docount 3'); this.emit(`STORE_NAME ${count}`);
    this.storeLoc(this.baseLoc(sym), () => this.emit(`LOAD_NAME ${start}`));
    const head = this.gl(), done = this.gl();
    this.place(head); this.emit(`LOAD_NAME ${count}`); this.emit(`JZ ${done}`);
    body();
    this.storeLoc(this.baseLoc(sym), () => {
      this.loadSym(sym, this.baseLoc(sym)); this.emit(`LOAD_NAME ${step}`); this.emit('ADD');
    });
    this.emit(`LOAD_NAME ${count}`); this.emit(pushInt(1)); this.emit('SUB'); this.emit(`STORE_NAME ${count}`);
    this.emit(`JMP ${head}`); this.place(done);
  }

  output(statement) {
    if (statement.kind === 'print' && statement.legacy) {
      statement.items.forEach(item => this.outputItem(item, true)); this.emit('PRINT_NL'); return;
    }
    const control = this.ioControls(statement, false);
    this.emit('CALL_EXT fortran.begin 0');
    statement.items.forEach(item => this.outputItem(item, false));
    this.emit('CALL_EXT fortran.write 0');
    const internal = control.get('UNIT');
    if (internal && !internal.star && this.ioType(internal.expr).t === 'character') {
      const done = this.gl();
      this.emit('CALL_EXT fortran.iostatus 0'); this.emit(pushInt(0)); this.emit('EQ'); this.emit(`JZ ${done}`);
      const { sym, loc, whole, substring } = this.designator(internal.expr);
      const count = whole ? sym.dimInfo.count : 1;
      if (!Number.isInteger(count)) this.fail(internal.pos, 'Internal file requires constant record count');
      for (let index = 0; index < count; index++) {
        const target = whole ? this.baseLoc(sym, I(index * this.homeCells(sym))) : loc;
        const value = () => {
          this.emit(pushInt(index)); this.emit('CALL_EXT fortran.internalrecord 1'); return T('character');
        };
        if (substring) this.storeSubstring(sym, target, substring, value, internal.pos);
        else this.assignValue(sym, target, value, internal.pos);
      }
      this.place(done);
    }
    this.ioFinish(control);
  }

  ioText(expr, separator = '') {
    const sym = expr.k === 'ref' && !expr.args ? this.symbols.get(expr.name) : null;
    if (!sym?.dims) return this.gen(expr);
    if (sym.type !== 'character' || !Number.isInteger(sym.dimInfo.count))
      this.fail(expr.pos, 'A character file or format array requires constant bounds');
    this.emit(pushStr(''));
    for (let index = 0; index < sym.dimInfo.count; index++) {
      if (index && separator) { this.emit(pushStr(separator)); this.emit('CONCAT'); }
      this.loadSym(sym, this.baseLoc(sym, I(index * this.homeCells(sym)))); this.emit('CONCAT');
    }
    return T('character');
  }

  ioType(expr) {
    const sym = expr.k === 'ref' && !expr.args ? this.symbols.get(expr.name) : null;
    return sym?.dims ? this.symValueType(sym) : this.infer(expr);
  }

  ioControls(statement, input) {
    const items = statement.kind === 'print'
      ? [{ key: 'UNIT', star: true, pos: statement.pos }, { key: 'FMT', ...statement.format }]
      : statement.control;
    const control = new Map();
    this.emit('CALL_EXT fortran.iobegin 0');
    for (const [index, item] of items.entries()) {
      const key = item.key || ['UNIT', 'FMT'][index];
      if (!key || control.has(key)) this.fail(item.pos, `Invalid or duplicate I/O control ${key}`);
      control.set(key, item);
      if (statement.verb === 'INQUIRE' && !['UNIT', 'FILE', 'IOSTAT', 'ERR'].includes(key)) continue;
      if (!['UNIT', 'FMT', 'REC', 'IOSTAT', 'ERR', 'END', 'FILE', 'STATUS', 'ACCESS', 'FORM', 'RECL', 'BLANK'].includes(key))
        this.fail(item.pos, `Unknown I/O control ${key}`);
      if (['IOSTAT', 'ERR', 'END'].includes(key)) {
        this.emit(pushStr(key)); this.emit(pushInt(1));
      } else if (key === 'UNIT' && !item.star && this.ioType(item.expr).t === 'character') {
        this.emit(pushStr('INTERNAL')); this.ioText(item.expr, '\n');
        this.emit('CALL_EXT fortran.iocontrol 2');
        const sym = item.expr.k === 'ref' && !item.expr.args ? this.symbols.get(item.expr.name) : null;
        this.emit(pushStr('RECORDS')); this.emit(pushInt(sym?.dims ? sym.dimInfo.count : 1));
        this.emit('CALL_EXT fortran.iocontrol 2');
        this.emit(pushStr('RECL'));
        const type = this.ioType(item.expr);
        if (typeof type.len === 'number') this.emit(pushInt(type.len));
        else { this.gen(item.expr); this.emit('STRLEN'); }
      } else {
        this.emit(pushStr(key));
        if (item.star) {
          if (key === 'UNIT') this.emit(pushInt(input ? 5 : 6));
          else if (key === 'FMT') this.emit(pushStr('*'));
          else this.fail(item.pos, `An asterisk is not valid for ${key}`);
        } else if (key === 'FMT') this.ioFormat(item);
        else this.gen(item.expr);
      }
      this.emit('CALL_EXT fortran.iocontrol 2');
    }
    if (!control.has('UNIT') && !(statement.verb === 'INQUIRE' && control.has('FILE')))
      this.fail(statement.pos, 'I/O statement requires UNIT');
    return control;
  }

  ioFormat(item) {
    const label = this.tryConst(item.expr);
    if (label?.t === 'integer') {
      const spec = this.formats.get(String(label.v));
      if (!spec) this.fail(item.pos, `Undefined FORMAT label ${label.v}`);
      this.emit(pushStr(spec));
    } else if (this.ioType(item.expr).t === 'integer') {
      const value = this.temp(), done = this.gl();
      this.gen(item.expr); this.emit(`STORE_NAME ${value}`);
      for (const [label, spec] of this.formats) {
        const next = this.gl();
        this.emit(`LOAD_NAME ${value}`); this.emit(pushInt(Number(label))); this.emit('EQ'); this.emit(`JZ ${next}`);
        this.emit(pushStr(spec)); this.emit(`JMP ${done}`); this.place(next);
      }
      this.emit(pushStr('INVALID FORMAT LABEL')); this.place(done);
    } else {
      const type = this.ioText(item.expr);
      if (type.t !== 'character') this.fail(item.pos, 'FORMAT must be a label or CHARACTER expression');
    }
  }

  ioFinish(control) {
    const status = control.get('IOSTAT');
    if (status) {
      const { sym, loc, whole, substring } = this.designator(status.expr);
      if (sym.type !== 'integer' || whole || substring) this.fail(status.pos, 'IOSTAT must be an INTEGER variable');
      this.storeLoc(loc, () => this.emit('CALL_EXT fortran.iostatus 0'));
    }
    for (const key of ['END', 'ERR']) {
      const item = control.get(key);
      if (!item) continue;
      const label = this.constInt(item.expr, `${key} label`);
      this.labelRefs.push({ label: String(label), pos: item.pos });
      this.emit('CALL_EXT fortran.iostatus 0'); this.emit(pushInt(0)); this.emit(key === 'END' ? 'LT' : 'GT');
      const next = this.gl();
      this.emit(`JZ ${next}`); this.emit(`JMP ${this.stmtLabel(String(label))}`); this.place(next);
    }
  }

  inputItem(item) {
    if (item.k === 'implied') {
      this.loop(item, () => item.items.forEach(value => this.inputItem(value)));
      return;
    }
    const { sym, loc, whole, substring } = this.designator(item);
    const count = whole ? sym.dimInfo.count : 1;
    if (!Number.isInteger(count)) this.fail(item.pos, 'Whole-array READ requires constant bounds');
    for (let index = 0; index < count; index++) {
      const target = whole ? this.baseLoc(sym, I(index * this.homeCells(sym))) : loc;
      let length = sym.type === 'character' ? sym.len : 0;
      if (substring) {
        const from = substring.from ? this.constInt(substring.from, 'Input substring bound') : 1;
        const to = substring.to ? this.constInt(substring.to, 'Input substring bound') : sym.len;
        length = to - from + 1;
      }
      if (typeof length !== 'number') this.fail(item.pos, 'READ character length must be known');
      this.emit(pushStr({ integer: 'I', real: 'R', double: 'D', logical: 'L', character: 'C', complex: 'Z' }[sym.type]));
      this.emit(pushInt(length)); this.emit('CALL_EXT fortran.readvalue 2');
      const first = this.temp(), second = sym.type === 'complex' ? this.temp() : null, skip = this.gl();
      if (second) this.emit(`STORE_NAME ${second}`);
      this.emit(`STORE_NAME ${first}`);
      this.emit('CALL_EXT fortran.readpresent 0'); this.emit(`JZ ${skip}`);
      const value = () => {
        this.emit(`LOAD_NAME ${first}`);
        if (second) this.emit(`LOAD_NAME ${second}`);
        return T(sym.type, length);
      };
      if (substring) this.storeSubstring(sym, target, substring, value, item.pos);
      else this.storeSym(sym, target, T(sym.type), value);
      this.place(skip);
    }
  }

  input(statement) {
    const control = this.ioControls(statement, true);
    this.emit('CALL_EXT fortran.readbegin 0');
    statement.items.forEach(item => this.inputItem(item));
    this.emit('CALL_EXT fortran.readend 0');
    this.ioFinish(control);
  }

  auxiliaryIo(statement) {
    const control = this.ioControls(statement, false);
    this.emit(`CALL_EXT fortran.${statement.verb.toLowerCase()} 0`);
    const done = this.gl();
    if (statement.verb === 'INQUIRE') {
      this.emit('CALL_EXT fortran.iostatus 0'); this.emit(pushInt(0)); this.emit('EQ'); this.emit(`JZ ${done}`);
    }
    if (statement.verb === 'INQUIRE') for (const [key, item] of control) {
      if (['UNIT', 'FILE', 'IOSTAT', 'ERR'].includes(key)) continue;
      const { sym, loc, whole, substring } = this.designator(item.expr);
      if (whole || substring) this.fail(item.pos, 'INQUIRE requires scalar output variables');
      const type = ['EXIST', 'OPENED', 'NAMED'].includes(key) ? 'logical'
        : ['NUMBER', 'RECL', 'NEXTREC'].includes(key) ? 'integer' : 'character';
      this.assignValue(sym, loc, () => {
        this.emit(pushStr(key)); this.emit('CALL_EXT fortran.inquiry 1'); return T(type);
      }, item.pos);
    }
    this.place(done);
    this.ioFinish(control);
  }

  generateStatements(list) {
    for (let index = 0; index < list.length; index++) {
      const statement = list[index];
      this.program.loc = statement.pos;
      this.tempCount = 0;
      if (statement.label) this.place(this.stmtLabel(statement.label));
      if (statement.kind === 'entry') this.place(`${statement.entry.label}_BODY`);
      if (SPEC_KINDS.has(statement.kind) || statement.isStatementFunction) continue;
      if (statement.kind === 'do') {
        let terminal = index + 1;
        while (terminal < list.length && list[terminal].label !== statement.target.label) terminal++;
        if (terminal === list.length) this.fail(statement.pos, `Unterminated DO targeting ${statement.target.label}`);
        this.loop(statement, () => this.generateStatements(list.slice(index + 1, terminal + 1)));
        index = terminal;
        continue;
      }
      if (statement.kind === 'if') {
        const done = this.gl();
        for (const branch of statement.branches) {
          const next = this.gl();
          this.genLogical(branch.cond); this.emit(`JZ ${next}`);
          this.generateStatements(branch.body); this.emit(`JMP ${done}`); this.place(next);
        }
        if (statement.elseBranch) this.generateStatements(statement.elseBranch.body);
        this.place(done);
        if (statement.end.label) this.place(this.stmtLabel(statement.end.label));
        continue;
      }
      switch (statement.kind) {
        case 'assignment': this.assignTo(statement.target, statement.value, statement.pos); break;
        case 'continue': break;
        case 'stop': this.emit('HALT'); break;
        case 'pause': this.fail(statement.pos, 'Interactive PAUSE is not supported'); break;
        case 'print': case 'write': this.output(statement); break;
        case 'read': this.input(statement); break;
        case 'auxIo': this.auxiliaryIo(statement); break;
        case 'goto':
          this.labelRefs.push(statement.target);
          this.emit(`JMP ${this.stmtLabel(statement.target.label)}`);
          break;
        case 'logicalIf': {
          const done = this.gl();
          this.genLogical(statement.cond); this.emit(`JZ ${done}`);
          this.generateStatements([statement.statement]); this.place(done);
          break;
        }
        case 'arithmeticIf': {
          const value = this.temp(), nonnegative = this.gl();
          const type = this.gen(statement.expr);
          if (!isNumeric(type.t) || type.t === 'complex') this.fail(statement.pos, 'Arithmetic IF requires a real or integer expression');
          this.emit(`STORE_NAME ${value}`);
          this.emit(`LOAD_NAME ${value}`); this.emit(pushInt(0)); this.emit('LT'); this.emit(`JZ ${nonnegative}`);
          this.emit(`JMP ${this.stmtLabel(statement.targets[0].label)}`); this.place(nonnegative);
          this.emit(`LOAD_NAME ${value}`); this.emit(pushInt(0)); this.emit('NEQ');
          this.emit(`JZ ${this.stmtLabel(statement.targets[1].label)}`);
          this.emit(`JMP ${this.stmtLabel(statement.targets[2].label)}`);
          this.labelRefs.push(...statement.targets);
          break;
        }
        case 'computedGoto': case 'assignedGoto': {
          const value = this.temp();
          if (statement.kind === 'computedGoto') this.genAs(statement.expr, 'integer');
          else this.loadSym(this.getVar(statement.name, statement.pos), this.baseLoc(this.getVar(statement.name, statement.pos)));
          this.emit(`STORE_NAME ${value}`);
          const targets = statement.targets.length ? statement.targets
            : [...this.assignTargets].map(label => ({ label, pos: statement.pos }));
          targets.forEach((target, targetIndex) => {
            this.emit(`LOAD_NAME ${value}`);
            this.emit(pushInt(statement.kind === 'computedGoto' ? targetIndex + 1 : Number(target.label)));
            this.emit('NEQ'); this.emit(`JZ ${this.stmtLabel(target.label)}`);
          });
          this.labelRefs.push(...targets);
          break;
        }
        case 'assignLabel': {
          const sym = this.getVar(statement.name, statement.pos);
          this.storeLoc(this.baseLoc(sym), () => this.emit(pushInt(Number(statement.target.label))));
          break;
        }
        case 'call': this.callUser(statement.name, statement.args, statement.pos, false); break;
        case 'return':
          if (this.kind === 'program') this.fail(statement.pos, 'RETURN is not allowed in a main program');
          if (statement.expr) { this.genAs(statement.expr, 'integer'); this.emit('STORE_NAME _ALTRET'); }
          else { this.emit(pushInt(0)); this.emit('STORE_NAME _ALTRET'); }
          this.emit('RET');
          break;
        default: this.fail(statement.pos, `Statement ${statement.kind} is not implemented in the FORTRAN 77 p-code backend`);
      }

    }
  }

  initializeBounds(params = null) {
    for (const sym of this.symbols.values()) {
      if (!sym.dummy || !sym.dims || sym.dimInfo.constant || (params && !params.has(sym.name))) continue;
      const stride = this.dtemp();
      this.emit(pushInt(1)); this.emit(`STORE_NAME ${stride}`);
      sym.dimInfo.dims.forEach((dim, index) => {
        const bound = value => {
          if (value.c !== undefined) this.emit(pushInt(value.c));
          else this.genAs(value.expr, 'integer');
        };
        bound(dim.lower); this.emit(`STORE_NAME ${this.dimReg(sym, index, 'L')}`);
        this.emit(`LOAD_NAME ${stride}`); this.emit(`STORE_NAME ${this.dimReg(sym, index, 'S')}`);
        if (dim.upper) {
          bound(dim.upper); this.emit(`LOAD_NAME ${this.dimReg(sym, index, 'L')}`); this.emit('SUB');
          this.emit(pushInt(1)); this.emit('ADD');
          this.emit(`LOAD_NAME ${stride}`); this.emit('MUL'); this.emit(`STORE_NAME ${stride}`);
        }
      });
    }
  }
}

function homeLoc(home) {
  if (home.kind === 'name' || home.kind === 'value') return { k: 'reg', name: home.reg };
  if (home.kind === 'mem') return { k: 'cell', base: MEMORY, len: MEMCAP, idx: I(home.addr) };
  if (home.kind === 'arr') return { k: 'cell', base: home.base, len: home.len, idx: I(0) };
  throw new Error('Unsupported function result storage');
}

function homeLoadCode(home, type) {
  const loc = homeLoc(home);
  if (loc.k === 'reg') return [`LOAD_NAME ${loc.name}`];
  const result = [pushInt(home.kind === 'arr' ? 0 : home.addr), `ARR_GET ${loc.base} ${loc.len}`];
  if (type === 'complex') result.push(pushInt(home.kind === 'arr' ? 1 : home.addr + 1), `ARR_GET ${loc.base} ${loc.len}`);
  return result;
}

export function generateFortranPcode(ast, { fileName = 'program.ftn', sourceText = '' } = {}) {
  const program = new Program();
  const units = ast.map(node => new Unit(program, node, { fileName }));
  for (const unit of units) { unit.analyze(); program.addUnit(unit); }
  const main = units.find(unit => unit.kind === 'program');
  if (!main) throw new FortranError(fileName, 1, 1, 'An executable program requires a main program');
  for (const unit of units) { program.registerEntries(unit); unit.planStorage(); }
  for (const unit of units) for (const sym of unit.symbols.values()) {
    if (sym.kind === 'var') unit.homeOf(sym);
  }
  program.section = 'init';
  for (const unit of units) unit.initialize();
  for (const unit of units) unit.initializeData();
  program.section = 'main';
  for (const unit of [main, ...units.filter(unit => unit !== main && unit.kind !== 'blockdata')]) {
    for (const entry of [unit.mainEntry, ...unit.entries]) {
      program.procedures[entry.label] = {
        name: unit.name, params: entry.params.map(name => `${unit.prefix}${name}`), locals: [],
      };
      unit.place(entry.label);
      unit.initializeBounds(new Set(entry.params));
      unit.emit(`JMP ${entry.label}_BODY`);
    }
    unit.place(`${unit.entryLabel}_BODY`);
    unit.generateStatements(unit.ast.body);
    if (unit.ast.end.label) unit.place(unit.stmtLabel(unit.ast.end.label));
    unit.emit(unit.kind === 'program' ? 'HALT' : 'RET');
    for (const target of unit.labelRefs) {
      if (!unit.labels.has(target.label)) unit.fail(target.pos, `Undefined label ${target.label}`);
    }
  }
  for (const target of program.wrappers.values()) {
    const { unit, entry, intrinsic } = target;
    program.procedures[entry.label] = { name: intrinsic, params: entry.params.map(name => `${unit.prefix}${name}`), locals: [] };
    unit.place(entry.label);
    const args = entry.params.map(name => ({ k: 'ref', name, pos: unit.ast.pos }));
    unit.assignValue(unit.resultSym, homeLoc(unit.homeOf(unit.resultSym)),
      () => unit.genIntrinsic(intrinsic, args, unit.ast.pos), unit.ast.pos);
    unit.emit('RET');
  }
  const expanded = [];
  for (const row of program.sections.main) {
    if (!row.dispatch) { expanded.push(row); continue; }
    const { unit, reg, argc, type, pos } = row.dispatch;
    const saved = program.sections.main;
    program.sections.main = [];
    program.loc = row.loc;
    const done = unit.gl();
    for (const { id, target } of program.procIds.values()) {
      if (target.entry.params.length !== argc || Boolean(type) !== (target.unit.kind === 'function')) continue;
      const next = unit.gl();
      unit.emit(`LOAD_NAME ${reg}`); unit.emit(pushInt(id)); unit.emit('EQ'); unit.emit(`JZ ${next}`);
      unit.emit(`CALL ${target.label} ${argc}`);
      if (type) unit.convert(unit.loadResult(target.unit, target.entry.name), type.t, pos);
      unit.emit(`JMP ${done}`); unit.place(next);
    }
    unit.emit(`LOAD_NAME ${reg}`); unit.emit('CALL_EXT fortran.badprocedure 1');
    unit.place(done);
    expanded.push(...program.sections.main);
    program.sections.main = saved;
  }
  const rows = [...program.sections.init, ...expanded];
  const lines = rows.map(row => row.text.replaceAll(MEMCAP, String(Math.max(1, program.memory))));
  const labels = new Set();
  for (const line of lines.filter(line => line.endsWith(':'))) {
    if (labels.has(line)) throw new FortranError(fileName, 1, 1, `Duplicate generated label ${line}`);
    labels.add(line);
  }
  const sourceMap = {}, sourceLines = sourceText.split(/\r?\n/);
  let pc = 0;
  for (const row of rows) {
    if (row.text.endsWith(':')) continue;
    const line = row.loc?.line || 0;
    sourceMap[pc++] = { sourceFile: fileName, sourceLanguage: 'mnf', sourceLine: line,
      sourceText: line ? sourceLines[line - 1] || '' : '' };
  }
  for (const line of lines) {
    const match = /^(?:LOAD_NAME|STORE_NAME) (.+)$/.exec(line);
    if (match && !program.frameRegs.has(match[1])) program.globals.add(match[1]);
  }
  program.arrays.set(MEMORY, Math.max(1, program.memory));
  const runtimeUnit = { kind: 'program', id: main.name, refreshMs: null };
  return {
    language: 'mnf', programId: main.name, runtimeUnit, compiledAt: new Date().toISOString(),
    pcodeText: `${lines.join('\n')}\n`,
    programMap: { version: 1, sourceLanguage: 'mnf', standard: 'fortran77', targets: ['js'],
      runtimeUnit, globals: [...program.globals], procedures: program.procedures, entries: [], sourceMap,
      extendableDeclarations: [...program.arrays].map(([name, elementCount]) => ({ name, elementCount })),
      requiredRuntimeLibraries: ['fortran77'],
    },
  };
}
