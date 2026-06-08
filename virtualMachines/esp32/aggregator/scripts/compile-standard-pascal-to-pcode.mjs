import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const KEYWORDS = new Set([
  'PROGRAM',
  'VAR',
  'PROCEDURE',
  'BEGIN',
  'END',
  'INTEGER',
  'IF',
  'THEN',
  'ELSE',
  'WRITELN'
]);

class Tokenizer {
  constructor(source) {
    this.source = String(source || '');
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.peek();

      if (this.isAlpha(ch) || ch === '_') {
        this.tokens.push(this.readIdentOrKeyword());
        continue;
      }

      if (this.isDigit(ch)) {
        this.tokens.push(this.readNumber());
        continue;
      }

      if (ch === '\'' || ch === '"') {
        this.tokens.push(this.readString());
        continue;
      }

      const two = this.source.slice(this.pos, this.pos + 2);
      if (two === ':=' || two === '<=' || two === '>=' || two === '<>') {
        this.tokens.push(this.token('SYMBOL', two));
        this.advance(2);
        continue;
      }

      if (';:,.()+-*/=<>	'.includes(ch)) {
        this.tokens.push(this.token('SYMBOL', ch));
        this.advance();
        continue;
      }

      throw this.error(`Unexpected character '${ch}'`);
    }

    this.tokens.push(this.token('EOF', 'EOF'));
    return this.tokens;
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (/\s/.test(ch)) {
        this.advance();
        continue;
      }

      if (ch === '{') {
        this.advance();
        while (this.pos < this.source.length && this.peek() !== '}') this.advance();
        if (this.pos >= this.source.length) throw this.error('Unterminated comment');
        this.advance();
        continue;
      }

      if (this.source.slice(this.pos, this.pos + 2) === '(*') {
        this.advance(2);
        while (this.pos < this.source.length && this.source.slice(this.pos, this.pos + 2) !== '*)') this.advance();
        if (this.pos >= this.source.length) throw this.error('Unterminated comment');
        this.advance(2);
        continue;
      }

      if (this.source.slice(this.pos, this.pos + 2) === '//') {
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }

      break;
    }
  }

  readIdentOrKeyword() {
    const line = this.line;
    const col = this.col;
    let text = '';
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (!(this.isAlpha(ch) || this.isDigit(ch) || ch === '_')) break;
      text += ch;
      this.advance();
    }
    const upper = text.toUpperCase();
    if (KEYWORDS.has(upper)) return { type: 'KEYWORD', value: upper, line, col };
    return { type: 'IDENT', value: text, line, col };
  }

  readNumber() {
    const line = this.line;
    const col = this.col;
    let text = '';
    while (this.pos < this.source.length && this.isDigit(this.peek())) {
      text += this.peek();
      this.advance();
    }
    return { type: 'NUMBER', value: Number.parseInt(text, 10), line, col };
  }

  readString() {
    const quote = this.peek();
    const line = this.line;
    const col = this.col;
    this.advance();
    let value = '';

    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === quote) {
        this.advance();
        return { type: 'STRING', value, line, col };
      }
      if (ch === '\\') {
        this.advance();
        if (this.pos < this.source.length) {
          value += this.peek();
          this.advance();
        }
        continue;
      }
      value += ch;
      this.advance();
    }

    throw this.error('Unterminated string literal');
  }

  token(type, value) {
    return { type, value, line: this.line, col: this.col };
  }

  error(msg) {
    return new Error(`[STD-PASCAL] ${msg} at ${this.line}:${this.col}`);
  }

  peek() {
    return this.source[this.pos];
  }

  advance(n = 1) {
    for (let i = 0; i < n; i += 1) {
      const ch = this.source[this.pos];
      this.pos += 1;
      if (ch === '\n') {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
    }
  }

  isAlpha(ch) {
    return /[A-Za-z]/.test(ch);
  }

  isDigit(ch) {
    return /[0-9]/.test(ch);
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parseProgram() {
    this.expectKeyword('PROGRAM');
    const programName = this.expect('IDENT').value;
    this.expectSymbol(';');

    const globals = this.parseVarSection();
    const procedures = [];
    while (this.matchKeyword('PROCEDURE')) {
      procedures.push(this.parseProcedure());
    }

    const main = this.parseCompoundStatement();
    this.expectSymbol('.');
    this.expect('EOF');

    return {
      type: 'Program',
      name: programName,
      globals,
      procedures,
      main
    };
  }

  parseVarSection() {
    const vars = [];
    if (!this.matchKeyword('VAR')) return vars;

    while (this.current().type === 'IDENT') {
      const names = this.parseIdentList();
      this.expectSymbol(':');
      this.expectKeyword('INTEGER');
      this.expectSymbol(';');
      for (const n of names) vars.push(n);
    }

    return vars;
  }

  parseProcedure() {
    const name = this.expect('IDENT').value;
    this.expectSymbol('(');
    const params = this.parseParamList();
    this.expectSymbol(')');
    this.expectSymbol(';');

    const locals = this.parseVarSection();
    const body = this.parseCompoundStatement();
    this.expectSymbol(';');

    return {
      type: 'Procedure',
      name,
      params,
      locals,
      body
    };
  }

  parseParamList() {
    const params = [];
    if (this.current().type === 'SYMBOL' && this.current().value === ')') return params;

    while (true) {
      const names = this.parseIdentList();
      this.expectSymbol(':');
      this.expectKeyword('INTEGER');
      params.push(...names);
      if (!this.matchSymbol(';')) break;
    }

    return params;
  }

  parseIdentList() {
    const names = [this.expect('IDENT').value];
    while (this.matchSymbol(',')) names.push(this.expect('IDENT').value);
    return names;
  }

  parseCompoundStatement() {
    this.expectKeyword('BEGIN');
    const statements = [];

    while (!(this.current().type === 'KEYWORD' && this.current().value === 'END')) {
      if (this.matchSymbol(';')) continue;
      statements.push(this.parseStatement());
      this.matchSymbol(';');
    }

    this.expectKeyword('END');
    return { type: 'Block', statements };
  }

  parseStatement() {
    const t = this.current();

    if (t.type === 'KEYWORD' && t.value === 'BEGIN') {
      return this.parseCompoundStatement();
    }

    if (t.type === 'KEYWORD' && t.value === 'IF') {
      this.consume();
      const condition = this.parseExpr();
      this.expectKeyword('THEN');
      const thenStmt = this.parseStatement();
      let elseStmt = null;
      if (this.matchKeyword('ELSE')) elseStmt = this.parseStatement();
      return { type: 'If', condition, thenStmt, elseStmt };
    }

    if (t.type === 'KEYWORD' && t.value === 'WRITELN') {
      this.consume();
      this.expectSymbol('(');
      const args = [];
      if (!(this.current().type === 'SYMBOL' && this.current().value === ')')) {
        args.push(this.parseWriteArg());
        while (this.matchSymbol(',')) args.push(this.parseWriteArg());
      }
      this.expectSymbol(')');
      return { type: 'Writeln', args };
    }

    if (t.type === 'IDENT') {
      const ident = this.consume().value;
      if (this.matchSymbol(':=')) {
        const expr = this.parseExpr();
        return { type: 'Assign', name: ident, expr };
      }

      if (this.matchSymbol('(')) {
        const args = [];
        if (!(this.current().type === 'SYMBOL' && this.current().value === ')')) {
          args.push(this.parseExpr());
          while (this.matchSymbol(',')) args.push(this.parseExpr());
        }
        this.expectSymbol(')');
        return { type: 'Call', name: ident, args };
      }

      return { type: 'Call', name: ident, args: [] };
    }

    throw this.error(`Unexpected token ${t.type}:${t.value}`);
  }

  parseWriteArg() {
    if (this.current().type === 'STRING') {
      return { type: 'StringLiteral', value: this.consume().value };
    }
    return this.parseExpr();
  }

  parseExpr() {
    let node = this.parseAdditive();
    if (this.current().type === 'SYMBOL' && ['=', '<>', '<', '<=', '>', '>='].includes(this.current().value)) {
      const op = this.consume().value;
      const rhs = this.parseAdditive();
      node = { type: 'Binary', op, left: node, right: rhs };
    }
    return node;
  }

  parseAdditive() {
    let node = this.parseTerm();
    while (this.current().type === 'SYMBOL' && ['+', '-'].includes(this.current().value)) {
      const op = this.consume().value;
      const rhs = this.parseTerm();
      node = { type: 'Binary', op, left: node, right: rhs };
    }
    return node;
  }

  parseTerm() {
    let node = this.parseFactor();
    while (this.current().type === 'SYMBOL' && ['*', '/'].includes(this.current().value)) {
      const op = this.consume().value;
      const rhs = this.parseFactor();
      node = { type: 'Binary', op, left: node, right: rhs };
    }
    return node;
  }

  parseFactor() {
    const t = this.current();

    if (t.type === 'NUMBER') {
      this.consume();
      return { type: 'NumberLiteral', value: t.value };
    }

    if (t.type === 'IDENT') {
      this.consume();
      return { type: 'Identifier', name: t.value };
    }

    if (t.type === 'SYMBOL' && t.value === '(') {
      this.consume();
      const node = this.parseExpr();
      this.expectSymbol(')');
      return node;
    }

    if (t.type === 'SYMBOL' && t.value === '-') {
      this.consume();
      const inner = this.parseFactor();
      return { type: 'Unary', op: '-', expr: inner };
    }

    throw this.error(`Unexpected factor token ${t.type}:${t.value}`);
  }

  current() {
    return this.tokens[this.pos];
  }

  consume() {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  expect(type) {
    const t = this.current();
    if (t.type !== type) throw this.error(`Expected ${type}, got ${t.type}:${t.value}`);
    return this.consume();
  }

  expectKeyword(value) {
    const t = this.current();
    if (t.type !== 'KEYWORD' || t.value !== value) {
      throw this.error(`Expected keyword ${value}, got ${t.type}:${t.value}`);
    }
    this.consume();
  }

  expectSymbol(value) {
    const t = this.current();
    if (t.type !== 'SYMBOL' || t.value !== value) {
      throw this.error(`Expected symbol ${value}, got ${t.type}:${t.value}`);
    }
    this.consume();
  }

  matchKeyword(value) {
    const t = this.current();
    if (t.type === 'KEYWORD' && t.value === value) {
      this.consume();
      return true;
    }
    return false;
  }

  matchSymbol(value) {
    const t = this.current();
    if (t.type === 'SYMBOL' && t.value === value) {
      this.consume();
      return true;
    }
    return false;
  }

  error(msg) {
    const t = this.current();
    return new Error(`[STD-PASCAL] ${msg} at ${t.line}:${t.col}`);
  }
}

class Codegen {
  constructor(ast) {
    this.ast = ast;
    this.lines = [];
    this.labelId = 0;
    this.procedureLabels = new Map();
  }

  generate() {
    this.emit('# Auto-generated from standard Pascal subset');
    this.emit('JMP MAIN');

    for (const proc of this.ast.procedures) {
      const label = this.procLabel(proc.name);
      this.emit(`${label}:`);
      this.emitBlock(proc.body);
      this.emit('RET');
    }

    this.emit('MAIN:');
    this.emitBlock(this.ast.main);
    this.emit('HALT');

    const procedures = {};
    for (const p of this.ast.procedures) {
      procedures[this.procLabel(p.name)] = {
        name: p.name,
        params: p.params,
        locals: p.locals
      };
    }

    const programMap = {
      version: 1,
      generatedAt: new Date().toISOString(),
      serviceId: this.ast.name,
      runtimeUnit: {
        kind: 'program',
        id: this.ast.name,
        refreshMs: null
      },
      executionModel: 'standard-pascal',
      globals: this.ast.globals,
      procedures,
      entryLabel: 'MAIN',
      sourceLanguage: 'pascal'
    };

    return {
      pcodeText: `${this.lines.join('\n')}\n`,
      programMap
    };
  }

  emitBlock(block) {
    for (const stmt of block.statements) {
      this.emitStatement(stmt);
    }
  }

  emitStatement(stmt) {
    if (!stmt) return;

    if (stmt.type === 'Block') {
      this.emitBlock(stmt);
      return;
    }

    if (stmt.type === 'Assign') {
      this.emitExpr(stmt.expr);
      this.emit(`STORE ${stmt.name}`);
      return;
    }

    if (stmt.type === 'Call') {
      for (const arg of stmt.args) this.emitExpr(arg);
      const label = this.procedureLabels.get(stmt.name) || this.procLabel(stmt.name);
      this.emit(`CALL ${label} ${stmt.args.length}`);
      return;
    }

    if (stmt.type === 'If') {
      const elseLabel = this.nextLabel('ELSE');
      const endLabel = this.nextLabel('ENDIF');
      this.emitExpr(stmt.condition);
      this.emit(`JZ ${elseLabel}`);
      this.emitStatement(stmt.thenStmt);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${elseLabel}:`);
      if (stmt.elseStmt) this.emitStatement(stmt.elseStmt);
      this.emit(`${endLabel}:`);
      return;
    }

    if (stmt.type === 'Writeln') {
      for (const arg of stmt.args) {
        if (arg.type === 'StringLiteral') {
          this.emit(`PUSH_STR "${this.escapeString(arg.value)}"`);
          this.emit('PRINT');
        } else {
          this.emitExpr(arg);
          this.emit('PRINT_INT');
        }
      }
      this.emit('PRINT_NL');
      return;
    }

    throw new Error(`[STD-PASCAL] Unsupported statement type: ${stmt.type}`);
  }

  emitExpr(expr) {
    if (expr.type === 'NumberLiteral') {
      this.emit(`PUSH_INT ${expr.value}`);
      return;
    }

    if (expr.type === 'Identifier') {
      this.emit(`LOAD ${expr.name}`);
      return;
    }

    if (expr.type === 'Unary' && expr.op === '-') {
      this.emit('PUSH_INT 0');
      this.emitExpr(expr.expr);
      this.emit('SUB');
      return;
    }

    if (expr.type === 'Binary') {
      this.emitExpr(expr.left);
      this.emitExpr(expr.right);
      const map = {
        '+': 'ADD',
        '-': 'SUB',
        '*': 'MUL',
        '/': 'DIV',
        '=': 'EQ',
        '<>': 'NEQ',
        '<': 'LT',
        '<=': 'LE',
        '>': 'GT',
        '>=': 'GE'
      };
      const op = map[expr.op];
      if (!op) throw new Error(`[STD-PASCAL] Unsupported binary op ${expr.op}`);
      this.emit(op);
      return;
    }

    throw new Error(`[STD-PASCAL] Unsupported expr type: ${expr.type}`);
  }

  procLabel(name) {
    const existing = this.procedureLabels.get(name);
    if (existing) return existing;
    const label = `PROC_${String(name).toUpperCase()}`;
    this.procedureLabels.set(name, label);
    return label;
  }

  nextLabel(prefix) {
    this.labelId += 1;
    return `${prefix}_${this.labelId}`;
  }

  escapeString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  emit(line) {
    this.lines.push(line);
  }
}

function parseArgs(argv) {
  const args = {
    in: './data/towers-of-hanoi.pas',
    out: '../pcode/towers-of-hanoi.pcode',
    mapOut: '../pcode/towers-of-hanoi.program.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--out') args.out = argv[i + 1];
    if (token === '--map-out') args.mapOut = argv[i + 1];
  }

  return args;
}

export function compileStandardPascal(sourceText) {
  const tokenizer = new Tokenizer(sourceText);
  const tokens = tokenizer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  const codegen = new Codegen(ast);
  return codegen.generate();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);

  const source = await fs.readFile(inPath, 'utf-8');
  const compiled = compileStandardPascal(source);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });

  await fs.writeFile(outPath, compiled.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(compiled.programMap, null, 2)}\n`, 'utf-8');

  console.log(`[STD-PASCAL] Input: ${path.relative(process.cwd(), inPath)}`);
  console.log(`[STD-PASCAL] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[STD-PASCAL] Output (program map): ${path.relative(process.cwd(), mapOutPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[STD-PASCAL] Failed:', err.message);
    process.exitCode = 1;
  });
}
