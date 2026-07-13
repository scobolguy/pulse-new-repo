import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import antlr4 from 'antlr4';
import StandardPascalLexer from '../grammar/generated-modern/StandardPascalLexer.js';
import StandardPascalParser from '../grammar/generated-modern/StandardPascalParser.js';
import StandardPascalVisitor from '../grammar/generated-modern/StandardPascalVisitor.js';
import { attachPcodeSignature } from './pcode-signing.mjs';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg) {
    this.errors.push(`line ${line}:${column} ${msg}`);
  }
}

function unquote(text) {
  const raw = String(text || '');
  if (raw.length >= 2) {
    const q = raw[0];
    if ((q === '"' || q === '\'') && raw[raw.length - 1] === q) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

class AstBuilder extends StandardPascalVisitor {
  visitProgram(ctx) {
    return {
      type: 'Program',
      name: ctx.IDENT().getText(),
      block: this.visit(ctx.block())
    };
  }

  visitBlock(ctx) {
    return {
      globals: ctx.varSection() ? this.visit(ctx.varSection()) : [],
      procedures: (ctx.procedureDecl() || []).map(p => this.visit(p)),
      main: this.visit(ctx.compoundStmt())
    };
  }

  visitVarSection(ctx) {
    const out = [];
    for (const decl of (ctx.varDecl() || [])) {
      out.push(...this.visit(decl));
    }
    return out;
  }

  visitVarDecl(ctx) {
    return this.visit(ctx.identList());
  }

  visitIdentList(ctx) {
    return (ctx.IDENT() || []).map(t => t.getText());
  }

  visitProcedureDecl(ctx) {
    return {
      type: 'Procedure',
      name: ctx.IDENT().getText(),
      params: ctx.paramList() ? this.visit(ctx.paramList()) : [],
      locals: ctx.varSection() ? this.visit(ctx.varSection()) : [],
      body: this.visit(ctx.compoundStmt())
    };
  }

  visitParamList(ctx) {
    const out = [];
    for (const p of (ctx.paramDecl() || [])) {
      out.push(...this.visit(p));
    }
    return out;
  }

  visitParamDecl(ctx) {
    return this.visit(ctx.identList());
  }

  visitCompoundStmt(ctx) {
    const list = ctx.statementList();
    return {
      type: 'Block',
      statements: list ? this.visit(list) : []
    };
  }

  visitStatementList(ctx) {
    return (ctx.statement() || []).map(s => this.visit(s)).filter(Boolean);
  }

  visitStatement(ctx) {
    if (ctx.assignment()) return this.visit(ctx.assignment());
    if (ctx.procedureCall()) return this.visit(ctx.procedureCall());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.writelnStmt()) return this.visit(ctx.writelnStmt());
    if (ctx.compoundStmt()) return this.visit(ctx.compoundStmt());
    return null;
  }

  visitAssignment(ctx) {
    return {
      type: 'Assign',
      name: ctx.IDENT().getText(),
      expr: this.visit(ctx.expr())
    };
  }

  visitProcedureCall(ctx) {
    return {
      type: 'Call',
      name: ctx.IDENT().getText(),
      args: ctx.argList() ? this.visit(ctx.argList()) : []
    };
  }

  visitArgList(ctx) {
    return (ctx.expr() || []).map(e => this.visit(e));
  }

  visitIfStmt(ctx) {
    return {
      type: 'If',
      condition: this.visit(ctx.expr()),
      thenStmt: this.visit(ctx.statement(0)),
      elseStmt: ctx.statement(1) ? this.visit(ctx.statement(1)) : null
    };
  }

  visitWritelnStmt(ctx) {
    return {
      type: 'Writeln',
      args: ctx.writeArgList() ? this.visit(ctx.writeArgList()) : []
    };
  }

  visitWriteArgList(ctx) {
    return (ctx.writeArg() || []).map(a => this.visit(a));
  }

  visitWriteArg(ctx) {
    if (ctx.STRING()) {
      return {
        type: 'StringLiteral',
        value: unquote(ctx.STRING().getText())
      };
    }
    return this.visit(ctx.expr());
  }

  visitExpr(ctx) {
    const parts = ctx.additiveExpr() || [];
    if (parts.length === 2) {
      return {
        type: 'Binary',
        op: ctx.getChild(1).getText(),
        left: this.visit(parts[0]),
        right: this.visit(parts[1])
      };
    }
    return this.visit(parts[0]);
  }

  visitAdditiveExpr(ctx) {
    const parts = ctx.multiplicativeExpr() || [];
    let node = this.visit(parts[0]);
    for (let i = 1; i < parts.length; i += 1) {
      node = {
        type: 'Binary',
        op: ctx.getChild((2 * i) - 1).getText(),
        left: node,
        right: this.visit(parts[i])
      };
    }
    return node;
  }

  visitMultiplicativeExpr(ctx) {
    const parts = ctx.unaryExpr() || [];
    let node = this.visit(parts[0]);
    for (let i = 1; i < parts.length; i += 1) {
      node = {
        type: 'Binary',
        op: ctx.getChild((2 * i) - 1).getText(),
        left: node,
        right: this.visit(parts[i])
      };
    }
    return node;
  }

  visitUnaryExpr(ctx) {
    if (ctx.MINUS()) {
      return { type: 'Unary', op: '-', expr: this.visit(ctx.unaryExpr()) };
    }
    return this.visit(ctx.primary());
  }

  visitPrimary(ctx) {
    if (ctx.NUMBER()) {
      return { type: 'NumberLiteral', value: Number.parseInt(ctx.NUMBER().getText(), 10) };
    }
    if (ctx.IDENT()) {
      return { type: 'Identifier', name: ctx.IDENT().getText() };
    }
    return this.visit(ctx.expr());
  }
}

class Codegen {
  constructor(ast) {
    this.ast = ast;
    this.lines = [];
    this.labelId = 0;
    this.procLabels = new Map();
  }

  emit(line) {
    this.lines.push(line);
  }

  nextLabel(prefix) {
    this.labelId += 1;
    return `${prefix}_${this.labelId}`;
  }

  procLabel(name) {
    if (!this.procLabels.has(name)) this.procLabels.set(name, `PROC_${String(name).toUpperCase()}`);
    return this.procLabels.get(name);
  }

  escapeString(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
      const opMap = {
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
      const op = opMap[expr.op];
      if (!op) throw new Error(`[STD-PASCAL] Unsupported operator: ${expr.op}`);
      this.emit(op);
      return;
    }
    throw new Error(`[STD-PASCAL] Unsupported expression node: ${expr.type}`);
  }

  emitZeroInit(name) {
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${name}`);
  }

  emitZeroInitList(names, skip = new Set()) {
    for (const name of names || []) {
      if (!name || skip.has(name)) continue;
      this.emitZeroInit(name);
    }
  }

  emitStatement(stmt) {
    if (!stmt) return;

    if (stmt.type === 'Block') {
      for (const s of stmt.statements) this.emitStatement(s);
      return;
    }

    if (stmt.type === 'Assign') {
      this.emitExpr(stmt.expr);
      this.emit(`STORE ${stmt.name}`);
      return;
    }

    if (stmt.type === 'Call') {
      const callName = String(stmt.name || '').toUpperCase();
      if (callName === 'EMIT' || callName === 'SEND') {
        if (!Array.isArray(stmt.args) || stmt.args.length < 1 || stmt.args.length > 2) {
          throw new Error('[STD-PASCAL] EMIT/SEND expects 1 or 2 arguments: EMIT(queue[, payload])');
        }

        const queueArg = stmt.args[0];
        if (!queueArg || queueArg.type !== 'Identifier') {
          throw new Error('[STD-PASCAL] EMIT/SEND queue argument must be an identifier (queue name)');
        }

        if (stmt.args.length === 2) {
          this.emitExpr(stmt.args[1]);
          this.emit('ROUTE_SET_MESSAGE');
        }
        this.emit(`ROUTE_EMIT "${this.escapeString(queueArg.name)}"`);
        return;
      }

      for (const a of stmt.args) this.emitExpr(a);
      this.emit(`CALL ${this.procLabel(stmt.name)} ${stmt.args.length}`);
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

    throw new Error(`[STD-PASCAL] Unsupported statement node: ${stmt.type}`);
  }

  build() {
    this.emit('# Auto-generated from ANTLR StandardPascal grammar');
    this.emit('JMP MAIN');

    for (const proc of this.ast.block.procedures) {
      this.emit(`${this.procLabel(proc.name)}:`);
      const paramNames = new Set(proc.params || []);
      // Materialize procedure locals in the current call frame.
      this.emitZeroInitList(proc.locals, paramNames);
      this.emitStatement(proc.body);
      this.emit('RET');
    }

    this.emit('MAIN:');
    // Materialize declared globals before any procedure call uses them.
    this.emitZeroInitList(this.ast.block.globals);
    this.emitStatement(this.ast.block.main);
    this.emit('HALT');

    const procedures = {};
    for (const p of this.ast.block.procedures) {
      procedures[this.procLabel(p.name)] = {
        name: p.name,
        params: p.params,
        locals: p.locals
      };
    }

    return {
      pcodeText: `${this.lines.join('\n')}\n`,
      programMap: {
        version: 1,
        generatedAt: new Date().toISOString(),
        serviceId: this.ast.name,
        runtimeUnit: {
          kind: 'program',
          id: this.ast.name,
          refreshMs: null
        },
        executionModel: 'standard-pascal',
        sourceLanguage: 'pascal',
        globals: this.ast.block.globals,
        procedures,
        entryLabel: 'MAIN'
      }
    };
  }
}

export function compileStandardPascalWithAntlr(sourceText) {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new StandardPascalLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new StandardPascalParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.program();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[STD-PASCAL] Parse failed:\n${errors.join('\n')}`);
  }

  const ast = new AstBuilder().visit(tree);
  return new Codegen(ast).build();
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);

  const source = await fs.readFile(inPath, 'utf-8');
  const compiled = compileStandardPascalWithAntlr(source);
  const signedProgramMap = attachPcodeSignature(compiled.programMap, compiled.pcodeText);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });

  await fs.writeFile(outPath, compiled.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(signedProgramMap, null, 2)}\n`, 'utf-8');

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
