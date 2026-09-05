import antlr4 from 'antlr4';
import VbishLexer from '../grammar/generated-modern/VbishLexer.js';
import VbishParser from '../grammar/generated-modern/VbishParser.js';
import VbishVisitor from '../grammar/generated-modern/VbishVisitor.js';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(_recognizer, _symbol, line, column, message) {
    this.errors.push(`line ${line}:${column} ${message}`);
  }
}

function collectMatches(source, expression, map) {
  return Array.from(String(source || '').matchAll(expression), map);
}

function text(ctx) {
  return ctx ? String(ctx.getText()) : '';
}

function unquote(value) {
  const raw = String(value == null ? '' : value);
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return raw.slice(1, -1);
  }
  return raw;
}

export class VbishToPascalishVisitor extends VbishVisitor {
  constructor() {
    super();
    this.globals = new Map();
    this.mainStatements = [];
    this.procedures = [];
    this.functions = [];
  }

  visitCompilationUnit(ctx) {
    for (const topDecl of ctx.topLevelDecl() || []) {
      if (topDecl.variableDecl && topDecl.variableDecl()) {
        const v = topDecl.variableDecl();
        const id = text(v.IDENTIFIER());
        const type = v.typeName() ? text(v.typeName()).toLowerCase() : 'integer';
        this.globals.set(id, type);
        if (v.expression && v.expression()) {
          const expr = this.visit(v.expression());
          this.mainStatements.push(`${id} := ${expr};`);
        }
      } else if (topDecl.subDecl && topDecl.subDecl()) {
        this.visitSubDecl(topDecl.subDecl());
      } else if (topDecl.functionDecl && topDecl.functionDecl()) {
        this.visitFunctionDecl(topDecl.functionDecl());
      }
    }
    return this;
  }

  visitSubDecl(ctx) {
    const name = text(ctx.IDENTIFIER());
    const isMain = name.toLowerCase() === 'main';
    const localVars = new Map();
    const stmts = [];

    for (const stmtCtx of ctx.statement() || []) {
      if (stmtCtx.variableDecl && stmtCtx.variableDecl()) {
        const v = stmtCtx.variableDecl();
        const id = text(v.IDENTIFIER());
        const type = v.typeName() ? text(v.typeName()).toLowerCase() : 'integer';
        if (isMain) {
          this.globals.set(id, type);
        } else {
          localVars.set(id, type);
        }
        if (v.expression && v.expression()) {
          const expr = this.visit(v.expression());
          if (isMain) {
            this.mainStatements.push(`${id} := ${expr};`);
          } else {
            stmts.push(`${id} := ${expr};`);
          }
        }
      } else {
        const s = this.visitStatement(stmtCtx);
        if (s) {
          if (isMain) {
            this.mainStatements.push(s);
          } else {
            stmts.push(s);
          }
        }
      }
    }

    if (!isMain) {
      const params = this.visitParameterList(ctx.parameterList());
      this.procedures.push({
        name,
        params,
        localVars,
        body: stmts
      });
    }
  }

  visitFunctionDecl(ctx) {
    const name = text(ctx.IDENTIFIER());
    const returnType = ctx.typeName() ? text(ctx.typeName()).toLowerCase() : 'integer';
    const params = this.visitParameterList(ctx.parameterList());
    const localVars = new Map();
    const stmts = [];

    for (const stmtCtx of ctx.statement() || []) {
      if (stmtCtx.variableDecl && stmtCtx.variableDecl()) {
        const v = stmtCtx.variableDecl();
        const id = text(v.IDENTIFIER());
        const type = v.typeName() ? text(v.typeName()).toLowerCase() : 'integer';
        localVars.set(id, type);
        if (v.expression && v.expression()) {
          const expr = this.visit(v.expression());
          stmts.push(`${id} := ${expr};`);
        }
      } else {
        const s = this.visitStatement(stmtCtx, name);
        if (s) stmts.push(s);
      }
    }

    this.functions.push({
      name,
      returnType,
      params,
      localVars,
      body: stmts
    });
  }

  visitParameterList(ctx) {
    if (!ctx) return [];
    const params = [];
    for (const p of ctx.parameter() || []) {
      const name = text(p.expression ? p.expression() : p.IDENTIFIER());
      const type = p.typeName() ? text(p.typeName()).toLowerCase() : 'integer';
      params.push({ name, type });
    }
    return params;
  }

  visitStatement(ctx, currentFnName = null) {
    if (!ctx) return '';
    if (ctx.variableDecl && ctx.variableDecl()) {
      const v = ctx.variableDecl();
      const id = text(v.IDENTIFIER());
      if (v.expression && v.expression()) {
        return `${id} := ${this.visit(v.expression())};`;
      }
      return '';
    }
    if (ctx.assignment && ctx.assignment()) {
      const a = ctx.assignment();
      const id = text(a.IDENTIFIER());
      const expr = this.visit(a.expression());
      return `${id} := ${expr};`;
    }
    if (ctx.printStatement && ctx.printStatement()) {
      const p = ctx.printStatement();
      const exprs = (p.expression() || []).map(e => this.visit(e));
      return `writeln(${exprs.join(', ')});`;
    }
    if (ctx.ifStatement && ctx.ifStatement()) {
      const ifCtx = ctx.ifStatement();
      const cond = this.visit(ifCtx.expression());
      const thenStmts = (ifCtx.statement() || []).map(s => this.visitStatement(s, currentFnName)).filter(Boolean);
      return `if ${cond} then\nbegin\n  ${thenStmts.join('\n  ')}\nend;`;
    }
    if (ctx.forStatement && ctx.forStatement()) {
      const forCtx = ctx.forStatement();
      const id = text(forCtx.IDENTIFIER(0));
      const start = this.visit(forCtx.expression(0));
      const end = this.visit(forCtx.expression(1));
      const bodyStmts = (forCtx.statement() || []).map(s => this.visitStatement(s, currentFnName)).filter(Boolean);
      return `for ${id} := ${start} to ${end} do\nbegin\n  ${bodyStmts.join('\n  ')}\nend;`;
    }
    if (ctx.whileStatement && ctx.whileStatement()) {
      const whileCtx = ctx.whileStatement();
      const cond = this.visit(whileCtx.expression());
      const bodyStmts = (whileCtx.statement() || []).map(s => this.visitStatement(s, currentFnName)).filter(Boolean);
      return `while ${cond} do\nbegin\n  ${bodyStmts.join('\n  ')}\nend;`;
    }
    if (ctx.callStatement && ctx.callStatement()) {
      const c = ctx.callStatement();
      const name = text(c.IDENTIFIER());
      const params = c.parameterList() ? (c.parameterList().parameter() || []).map(p => this.visit(p.expression ? p.expression() : p)) : [];
      return `${name}(${params.join(', ')});`;
    }
    if (ctx.returnStatement && ctx.returnStatement()) {
      const r = ctx.returnStatement();
      if (r.expression && r.expression() && currentFnName) {
        return `${currentFnName} := ${this.visit(r.expression())};`;
      }
      return '';
    }
    return '';
  }

  visitExpression(ctx) {
    if (!ctx) return '';
    return this.visitLogicalOr(ctx.logicalOr ? ctx.logicalOr() : ctx);
  }

  visitLogicalOr(ctx) {
    if (!ctx) return '';
    const ands = ctx.logicalAnd ? ctx.logicalAnd() : [];
    if (ands.length === 0) return this.visitChildren(ctx) || text(ctx);
    return ands.map(a => this.visitLogicalAnd(a)).join(' or ');
  }

  visitLogicalAnd(ctx) {
    if (!ctx) return '';
    const eqs = ctx.equality ? ctx.equality() : [];
    if (eqs.length === 0) return this.visitChildren(ctx) || text(ctx);
    return eqs.map(e => this.visitEquality(e)).join(' and ');
  }

  visitEquality(ctx) {
    if (!ctx) return '';
    const rels = ctx.relational ? ctx.relational() : [];
    if (rels.length === 0) return this.visitChildren(ctx) || text(ctx);
    return rels.map(r => this.visitRelational(r)).join(' = ');
  }

  visitRelational(ctx) {
    if (!ctx) return '';
    const adds = ctx.additive ? ctx.additive() : [];
    if (adds.length === 0) return this.visitChildren(ctx) || text(ctx);
    return adds.map(a => this.visitAdditive(a)).join(' ');
  }

  visitAdditive(ctx) {
    if (!ctx) return '';
    const mults = ctx.multiplicative ? ctx.multiplicative() : [];
    if (mults.length === 0) return this.visitChildren(ctx) || text(ctx);
    return mults.map(m => this.visitMultiplicative(m)).join(' + ');
  }

  visitMultiplicative(ctx) {
    if (!ctx) return '';
    const prims = ctx.primary ? ctx.primary() : [];
    if (prims.length === 0) return this.visitChildren(ctx) || text(ctx);
    return prims.map(p => this.visitPrimary(p)).join(' * ');
  }

  visitPrimary(ctx) {
    if (!ctx) return '';
    if (ctx.STRING_LITERAL && ctx.STRING_LITERAL()) {
      const s = unquote(ctx.STRING_LITERAL().getText());
      return `'${s.replace(/'/g, "''")}'`;
    }
    if (ctx.NUMBER && ctx.NUMBER()) {
      return ctx.NUMBER().getText();
    }
    if (ctx.TRUE && ctx.TRUE()) return 'true';
    if (ctx.FALSE && ctx.FALSE()) return 'false';
    if (ctx.IDENTIFIER && ctx.IDENTIFIER()) {
      const id = ctx.IDENTIFIER().getText();
      if (ctx.parameterList && ctx.parameterList()) {
        const params = (ctx.parameterList().parameter() || []).map(p => this.visit(p.expression ? p.expression() : p));
        return `${id}(${params.join(', ')})`;
      }
      return id;
    }
    if (ctx.expression && ctx.expression()) {
      return `(${this.visit(ctx.expression())})`;
    }
    return text(ctx);
  }

  toPascalishSource(runtimeUnit, interopDecls = []) {
    const lines = [];
    const kind = runtimeUnit?.kind || 'program';
    const id = runtimeUnit?.id || 'vbish-program';
    const placement = runtimeUnit?.placement ? ` on ${runtimeUnit.placement}` : '';
    const refresh = runtimeUnit?.refresh ? runtimeUnit.refresh : '';

    lines.push(`${kind} "${id}"${placement}${refresh};`);
    for (const item of interopDecls) {
      lines.push(`interop ${item.kind.toLowerCase()} "${item.target}";`);
    }

    if (this.globals.size > 0) {
      lines.push('var');
      for (const [name, type] of this.globals.entries()) {
        lines.push(`  ${name} : ${type};`);
      }
    }

    for (const proc of this.procedures) {
      const paramList = proc.params.map(p => `${p.name} : ${p.type}`).join('; ');
      lines.push(`procedure ${proc.name}(${paramList});`);
      if (proc.localVars.size > 0) {
        lines.push('var');
        for (const [name, type] of proc.localVars.entries()) {
          lines.push(`  ${name} : ${type};`);
        }
      }
      lines.push('begin');
      for (const s of proc.body) lines.push(`  ${s}`);
      lines.push('end;');
    }

    for (const fn of this.functions) {
      const paramList = fn.params.map(p => `${p.name} : ${p.type}`).join('; ');
      lines.push(`function ${fn.name}(${paramList}) : ${fn.returnType};`);
      if (fn.localVars.size > 0) {
        lines.push('var');
        for (const [name, type] of fn.localVars.entries()) {
          lines.push(`  ${name} : ${type};`);
        }
      }
      lines.push('begin');
      for (const s of fn.body) lines.push(`  ${s}`);
      lines.push('end;');
    }

    lines.push('begin');
    for (const s of this.mainStatements) {
      lines.push(`  ${s}`);
    }
    lines.push('end.');

    return lines.join('\n');
  }
}

export function compileVbishWithAntlr(sourceText, options = {}) {
  const source = String(sourceText || '');
  const lexer = new VbishLexer(new antlr4.InputStream(source));
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);
  const parser = new VbishParser(new antlr4.CommonTokenStream(lexer));
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  const tree = parser.compilationUnit();

  const syntaxErrors = [...lexerErrors.errors, ...parserErrors.errors];
  const runtimeMatch = /\b(?:PULSE\s+)?(SERVICE|DAEMON|PROGRAM)\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_-]*))(?:\s+ON\s+(LOCAL|PARENT|CHILD|SIBLING|ALTERNATE))?(?:\s+EVERY\s+(\d+)\s*(MS|S|M|SECOND|SECONDS)?)?/i.exec(source);
  const interop = collectMatches(source, /\bINTEROP\s+(WFL|WORKFLOW|PASCALISH|COBOLISH|VBISH)\s+"([^"]+)"(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_-]*))?/gi, (match) => ({
    kind: String(match[1]).toUpperCase(), target: String(match[2]), alias: String(match[3] || '').trim() || null
  }));
  const members = collectMatches(source, /\b(?:SUB|FUNCTION)\s+([A-Za-z_][A-Za-z0-9_-]*)/gi, (match) => String(match[1]));
  const variables = collectMatches(source, /\bDIM\s+([A-Za-z_][A-Za-z0-9_-]*)/gi, (match) => String(match[1]));

  let pascalishSource = '';
  if (syntaxErrors.length === 0) {
    try {
      const visitor = new VbishToPascalishVisitor();
      visitor.visitCompilationUnit(tree);
      const runtimeUnit = runtimeMatch ? {
        kind: runtimeMatch[1].toLowerCase(),
        id: runtimeMatch[2] || runtimeMatch[3],
        placement: String(runtimeMatch[4] || 'LOCAL').toLowerCase(),
        interval: Number(runtimeMatch[5] || 0),
        unit: String(runtimeMatch[6] || 'MS').toLowerCase()
      } : { kind: 'program', id: 'vbish-program', placement: 'local' };
      pascalishSource = visitor.toPascalishSource(runtimeUnit, interop);
    } catch {
      // fallback
    }
  }

  return {
    language: 'vbish', version: 1, compiledAt: new Date().toISOString(), fileName: options.fileName || null,
    valid: syntaxErrors.length === 0, syntaxErrors, syntaxErrorCount: syntaxErrors.length,
    runtime: runtimeMatch ? { kind: runtimeMatch[1].toLowerCase(), id: runtimeMatch[2] || runtimeMatch[3], placement: String(runtimeMatch[4] || 'LOCAL').toLowerCase(), interval: Number(runtimeMatch[5] || 0), unit: String(runtimeMatch[6] || 'MS').toLowerCase() } : null,
    interop, members, variables, source, pascalishSource
  };
}