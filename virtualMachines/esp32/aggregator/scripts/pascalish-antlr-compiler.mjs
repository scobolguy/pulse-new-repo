import fs from 'fs/promises';
import path from 'path';
import antlr4 from 'antlr4';
import PascalishRouterMapperLexer from '../grammar/generated-modern/PascalishRouterMapperLexer.js';
import PascalishRouterMapperParser from '../grammar/generated-modern/PascalishRouterMapperParser.js';
import PascalishRouterMapperVisitor from '../grammar/generated-modern/PascalishRouterMapperVisitor.js';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg) {
    this.errors.push(`line ${line}:${column} ${msg}`);
  }
}

function text(node) {
  return node ? String(node.getText()) : '';
}

function unquote(value) {
  const raw = String(value || '');
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

function buildStringList(ctx) {
  if (!ctx) return [];
  const values = ctx.stringValue ? ctx.stringValue() : [];
  return values.map(item => unquote(text(item)));
}

function toBoolean(ctx) {
  const t = text(ctx);
  return t.toUpperCase() === 'TRUE';
}

function extractVarDeclarations(sourceText) {
  const declarations = [];
  const keptLines = [];
  const lines = String(sourceText || '').split(/\r?\n/);
  const varLinePattern = /^\s*VAR\s+([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_][A-Za-z0-9_-]*)\s*(?:FROM\s+(LIBRARIAN|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_][A-Za-z0-9_-]*))?\s*;\s*$/i;

  for (const line of lines) {
    const match = line.match(varLinePattern);
    if (!match) {
      keptLines.push(line);
      continue;
    }

    const id = String(match[1] || '').trim();
    const dataTypeId = unquote(String(match[2] || '').trim());
    const sourceRaw = String(match[3] || '').trim();
    const isLibrarian = sourceRaw.toUpperCase() === 'LIBRARIAN';
    const sourceId = sourceRaw ? (isLibrarian ? 'librarian' : unquote(sourceRaw)) : null;

    declarations.push({
      type: 'VarDecl',
      id,
      dataTypeId,
      source: sourceId ? { sourceId, fromLibrarian: isLibrarian } : null,
      sourceId,
      fromLibrarian: isLibrarian
    });
  }

  return {
    declarations,
    strippedSourceText: keptLines.join('\n')
  };
}

class PascalishAstBuilder extends PascalishRouterMapperVisitor {
  constructor(tokens) {
    super();
    this.tokens = tokens;
  }

  buildPl0Snippet(ctx) {
    if (!ctx) return '';
    if (ctx.STRING && ctx.STRING()) {
      return unquote(ctx.STRING().getText());
    }

    const start = ctx.start.tokenIndex;
    const stop = ctx.stop.tokenIndex;
    const rawTokens = this.tokens.tokens.slice(start, stop + 1).map(t => t.text);
    return rawTokens
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,;\)])/g, '$1')
      .replace(/([\(])\s+/g, '$1')
      .trim();
  }

  visitProgram(ctx) {
    const ast = {
      type: 'Program',
      serviceId: null,
      variables: [],
      routers: [],
      mappers: []
    };

    for (const statement of ctx.statement ? ctx.statement() : []) {
      const value = this.visit(statement);
      if (!value) continue;
      if (value.type === 'ServiceDecl') {
        ast.serviceId = value.serviceId;
      } else if (value.type === 'VarDecl') {
        ast.variables.push(value);
      } else if (value.type === 'RouterDecl') {
        ast.routers.push(value);
      } else if (value.type === 'MapperDecl') {
        ast.mappers.push(value);
      }
    }

    return ast;
  }

  visitStatement(ctx) {
    const serviceDecl = ctx.serviceDecl();
    if (serviceDecl) return this.visit(serviceDecl);

    const varDecl = typeof ctx.varDecl === 'function' ? ctx.varDecl() : null;
    if (varDecl) return this.visit(varDecl);

    const routerDecl = ctx.routerDecl();
    if (routerDecl) return this.visit(routerDecl);

    const mapperDecl = ctx.mapperDecl();
    if (mapperDecl) return this.visit(mapperDecl);

    return null;
  }

  visitServiceDecl(ctx) {
    return {
      type: 'ServiceDecl',
      serviceId: unquote(text(ctx.stringValue()))
    };
  }

  visitVarDecl(ctx) {
    const source = (typeof ctx.varSource === 'function' && ctx.varSource()) ? this.visit(ctx.varSource()) : null;
    return {
      type: 'VarDecl',
      id: text(ctx.IDENT()),
      dataTypeId: unquote(text(ctx.stringOrIdent())),
      source: source || null,
      sourceId: source?.sourceId || null,
      fromLibrarian: Boolean(source?.fromLibrarian)
    };
  }

  visitVarSource(ctx) {
    if (ctx.LIBRARIAN()) {
      return {
        sourceId: 'librarian',
        fromLibrarian: true
      };
    }

    return {
      sourceId: unquote(text(ctx.stringOrIdent())),
      fromLibrarian: false
    };
  }

  visitRouterDecl(ctx) {
    const outputs = [];
    for (const outputCtx of ctx.outputDecl ? ctx.outputDecl() : []) {
      outputs.push(this.visit(outputCtx));
    }

    const header = { description: '', enabled: true, serviceId: null };
    for (const prop of ctx.routerHeaderProp ? ctx.routerHeaderProp() : []) {
      const value = this.visit(prop);
      if (!value) continue;
      if (value.kind === 'description') header.description = value.value;
      if (value.kind === 'enabled') header.enabled = value.value;
      if (value.kind === 'serviceId') header.serviceId = value.value;
    }

    return {
      type: 'RouterDecl',
      id: unquote(text(ctx.stringOrIdent())),
      inputQueue: unquote(text(ctx.stringValue())),
      description: header.description,
      enabled: header.enabled,
      serviceId: header.serviceId,
      outputs
    };
  }

  visitRouterHeaderProp(ctx) {
    if (ctx.DESCRIPTION()) return { kind: 'description', value: unquote(text(ctx.stringValue())) };
    if (ctx.ENABLED()) return { kind: 'enabled', value: toBoolean(ctx.booleanValue()) };
    if (ctx.SERVICE()) return { kind: 'serviceId', value: unquote(text(ctx.stringValue())) };
    return null;
  }

  visitOutputDecl(ctx) {
    const meta = ctx.outputTypeMeta() ? this.visit(ctx.outputTypeMeta()) : null;
    return {
      type: 'OutputDecl',
      queueName: unquote(text(ctx.stringValue(0))),
      dataTypeId: meta?.dataTypeId || null,
      dataTypeIds: meta?.dataTypeIds || null,
      whenRule: this.buildPl0Snippet(ctx.pl0Snippet(0)),
      transformRule: this.buildPl0Snippet(ctx.pl0Snippet(1))
    };
  }

  visitOutputTypeMeta(ctx) {
    if (ctx.TYPE()) {
      const id = unquote(text(ctx.stringValue()));
      return { dataTypeId: id, dataTypeIds: [id] };
    }
    const ids = buildStringList(ctx.stringList());
    return { dataTypeId: ids[0] || null, dataTypeIds: ids };
  }

  visitMapperDecl(ctx) {
    const header = { description: '', enabled: true };
    for (const prop of ctx.mapperHeaderProp ? ctx.mapperHeaderProp() : []) {
      const value = this.visit(prop);
      if (!value) continue;
      if (value.kind === 'description') header.description = value.value;
      if (value.kind === 'enabled') header.enabled = value.value;
    }

    const maps = [];
    for (const mapCtx of ctx.mapDecl ? ctx.mapDecl() : []) {
      maps.push(this.visit(mapCtx));
    }

    return {
      type: 'MapperDecl',
      id: unquote(text(ctx.stringOrIdent())),
      sourceTypeId: unquote(text(ctx.stringValue(0))),
      targetTypeId: unquote(text(ctx.stringValue(1))),
      description: header.description,
      enabled: header.enabled,
      maps
    };
  }

  visitMapperHeaderProp(ctx) {
    if (ctx.DESCRIPTION()) return { kind: 'description', value: unquote(text(ctx.stringValue())) };
    if (ctx.ENABLED()) return { kind: 'enabled', value: toBoolean(ctx.booleanValue()) };
    return null;
  }

  visitMapDecl(ctx) {
    return {
      type: 'MapDecl',
      sourcePath: unquote(text(ctx.stringValue(0))),
      targetPath: unquote(text(ctx.stringValue(1))),
      conversionRule: ctx.USING() ? this.buildPl0Snippet(ctx.pl0Snippet()) : 'output := src;'
    };
  }
}

export function parsePascalishWithAntlr(sourceText) {
  const extracted = extractVarDeclarations(sourceText);
  const input = new antlr4.InputStream(extracted.strippedSourceText);
  const lexer = new PascalishRouterMapperLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new PascalishRouterMapperParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;
  const tree = parser.program();

  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[PASCALISH-ANTLR] Parse failed:\n${errors.join('\n')}`);
  }

  const builder = new PascalishAstBuilder(tokens);
  const ast = builder.visit(tree);
  const parserVars = Array.isArray(ast.variables) ? ast.variables : [];
  ast.variables = [...extracted.declarations, ...parserVars];
  return ast;
}

export function compilePascalishWithAntlr(sourceText) {
  const ast = parsePascalishWithAntlr(sourceText);
  const compiledAt = new Date().toISOString();

  return {
    version: 1,
    compiledAt,
    serviceId: ast.serviceId || 'default-router-service',
    ast,
    variableDeclarations: ast.variables || [],
    routerRules: ast.routers,
    dataMappings: ast.mappers
  };
}

async function main() {
  const inputPath = path.resolve('./data/router-mapper.dsl');
  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compilePascalishWithAntlr(sourceText);
  console.log(JSON.stringify({ routers: compiled.routerRules.length, mappers: compiled.dataMappings.length }, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(err => {
    console.error('[PASCALISH-ANTLR] Failed:', err.message);
    process.exitCode = 1;
  });
}