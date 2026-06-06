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

function toBoolean(ctx) {
  const t = text(ctx);
  return t.toUpperCase() === 'TRUE';
}

function parseDaemonRefreshToMs(rawValue, rawUnit = '') {
  const n = Number.parseInt(String(rawValue || '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return 1000;

  const unit = String(rawUnit || '').trim().toLowerCase();
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 's') return n * 1000;
  return n;
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
      runtimeUnit: null,
      roles: [],
      variables: [],
      routers: [],
      mappers: [],
      codeLibraries: [],
      uses: [],
      interop: [],
      statements: []
    };

    for (const statement of ctx.statement ? ctx.statement() : []) {
      const value = this.visit(statement);
      if (!value) continue;

      if (value.type === 'RuntimeDecl') {
        ast.runtimeUnit = value.runtimeUnit;
        ast.serviceId = value.runtimeUnit.id;
      } else if (value.type === 'RoleDecl') {
        ast.roles.push(value);
      } else if (value.type === 'VarDecl') {
        ast.variables.push(value);
      } else if (value.type === 'LibraryDecl') {
        ast.codeLibraries.push(value);
      } else if (value.type === 'UseDecl') {
        ast.uses.push(value);
      } else if (value.type === 'InteropDecl') {
        ast.interop.push(value);
      } else if (value.type === 'RouterDecl') {
        ast.routers.push(value);
      } else if (value.type === 'MapperDecl') {
        ast.mappers.push(value);
      } else if (value.type === 'BlockStmt') {
        ast.statements.push(value);
      }
    }

    if (!ast.runtimeUnit) {
      ast.runtimeUnit = {
        kind: 'service',
        id: ast.serviceId || 'default-router-service',
        refreshMs: null
      };
      ast.serviceId = ast.runtimeUnit.id;
    }

    const hasCodeLibrarianRole = ast.roles.some(role => role.role === 'code_librarian');
    if (!hasCodeLibrarianRole && (ast.codeLibraries.length > 0 || ast.uses.length > 0)) {
      ast.roles.push({
        type: 'RoleDecl',
        role: 'code_librarian',
        capabilities: ['manage_common_code', 'publish_library_units', 'version_library_units'],
        inferred: true
      });
    }

    ast.programId = ast.runtimeUnit.kind === 'program' ? ast.runtimeUnit.id : null;
    ast.daemonId = ast.runtimeUnit.kind === 'daemon' ? ast.runtimeUnit.id : null;
    ast.daemonRefreshMs = ast.runtimeUnit.kind === 'daemon' ? ast.runtimeUnit.refreshMs : null;

    return ast;
  }

  visitStatement(ctx) {
    const runtimeDecl = typeof ctx.runtimeDecl === 'function' ? ctx.runtimeDecl() : null;
    if (runtimeDecl) return this.visit(runtimeDecl);

    const roleDecl = typeof ctx.roleDecl === 'function' ? ctx.roleDecl() : null;
    if (roleDecl) return this.visit(roleDecl);

    const varDecl = typeof ctx.varDecl === 'function' ? ctx.varDecl() : null;
    if (varDecl) return this.visit(varDecl);

    const libraryDecl = typeof ctx.libraryDecl === 'function' ? ctx.libraryDecl() : null;
    if (libraryDecl) return this.visit(libraryDecl);

    const useDecl = typeof ctx.useDecl === 'function' ? ctx.useDecl() : null;
    if (useDecl) return this.visit(useDecl);

    const interopDecl = typeof ctx.interopDecl === 'function' ? ctx.interopDecl() : null;
    if (interopDecl) return this.visit(interopDecl);

    const routerDecl = typeof ctx.routerDecl === 'function' ? ctx.routerDecl() : null;
    if (routerDecl) return this.visit(routerDecl);

    const mapperDecl = typeof ctx.mapperDecl === 'function' ? ctx.mapperDecl() : null;
    if (mapperDecl) return this.visit(mapperDecl);

    const blockStmt = typeof ctx.blockStmt === 'function' ? ctx.blockStmt() : null;
    if (blockStmt) return this.visit(blockStmt);

    return null;
  }

  visitRoleDecl(ctx) {
    const role = text(ctx.roleName()).toLowerCase();
    return {
      type: 'RoleDecl',
      role,
      capabilities: role === 'code_librarian'
        ? ['manage_common_code', 'publish_library_units', 'version_library_units']
        : []
    };
  }

  visitRuntimeDecl(ctx) {
    if (ctx.serviceDecl()) {
      const serviceId = unquote(text(ctx.serviceDecl().stringOrIdent()));
      return { type: 'RuntimeDecl', runtimeUnit: { kind: 'service', id: serviceId, refreshMs: null } };
    }

    if (ctx.programDecl()) {
      const programId = unquote(text(ctx.programDecl().stringOrIdent()));
      return { type: 'RuntimeDecl', runtimeUnit: { kind: 'program', id: programId, refreshMs: null } };
    }

    if (ctx.daemonDecl()) {
      const daemonCtx = ctx.daemonDecl();
      const daemonId = unquote(text(daemonCtx.stringOrIdent()));
      let refreshMs = 1000;

      if (daemonCtx.daemonRefresh()) {
        const refresh = daemonCtx.daemonRefresh();
        const rawCount = text(refresh.NUMBER());
        const unitCtx = refresh.daemonRefreshUnit ? refresh.daemonRefreshUnit() : null;
        const rawUnit = unitCtx ? text(unitCtx) : '';
        refreshMs = parseDaemonRefreshToMs(rawCount, rawUnit);
      }

      return { type: 'RuntimeDecl', runtimeUnit: { kind: 'daemon', id: daemonId, refreshMs } };
    }

    return null;
  }

  visitBlockStmt(ctx) {
    const start = ctx.start.tokenIndex;
    const stop = ctx.stop.tokenIndex;
    const rawTokens = this.tokens.tokens.slice(start, stop + 1).map(t => t.text);
    const normalized = rawTokens
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,;\)])/g, '$1')
      .replace(/([\(])\s+/g, '$1')
      .trim()
      .replace(/[.;]\s*$/g, '')
      .trim();

    return {
      type: 'BlockStmt',
      code: normalized
    };
  }

  visitVarDecl(ctx) {
    const source = (typeof ctx.varSource === 'function' && ctx.varSource()) ? this.visit(ctx.varSource()) : null;
    const dataType = this.visit(ctx.typeRef());

    return {
      type: 'VarDecl',
      id: text(ctx.IDENT()),
      dataType,
      dataTypeId: dataType.id,
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

  visitLibraryDecl(ctx) {
    const source = this.visit(ctx.librarySource());
    return {
      type: 'LibraryDecl',
      id: unquote(text(ctx.stringOrIdent())),
      source
    };
  }

  visitLibrarySource(ctx) {
    if (ctx.LIBRARIAN()) {
      return { kind: 'librarian', value: 'librarian' };
    }
    return { kind: 'ref', value: unquote(text(ctx.stringOrIdent())) };
  }

  visitUseDecl(ctx) {
    return {
      type: 'UseDecl',
      libraryId: unquote(text(ctx.stringOrIdent())),
      alias: ctx.IDENT() ? text(ctx.IDENT()) : null
    };
  }

  visitInteropDecl(ctx) {
    return {
      type: 'InteropDecl',
      target: text(ctx.interopKind()).toLowerCase(),
      id: unquote(text(ctx.stringOrIdent())),
      alias: ctx.IDENT() ? text(ctx.IDENT()) : null
    };
  }

  visitTypeRef(ctx) {
    const id = unquote(text(ctx.stringOrIdent()));
    const genericArgs = ctx.genericTypeArgs() ? this.visit(ctx.genericTypeArgs()) : [];
    return {
      type: 'TypeRef',
      id,
      genericArgs
    };
  }

  visitGenericTypeArgs(ctx) {
    const args = ctx.typeRef ? ctx.typeRef() : [];
    return args.map(typeCtx => this.visit(typeCtx));
  }

  visitTypeRefList(ctx) {
    const refs = ctx.typeRef ? ctx.typeRef() : [];
    return refs.map(typeCtx => this.visit(typeCtx));
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
      queueName: unquote(text(ctx.stringValue())),
      dataType: meta?.dataType || null,
      dataTypes: meta?.dataTypes || null,
      dataTypeId: meta?.dataType?.id || null,
      dataTypeIds: meta?.dataTypes ? meta.dataTypes.map(item => item.id) : (meta?.dataType ? [meta.dataType.id] : null),
      whenRule: this.buildPl0Snippet(ctx.pl0Snippet(0)),
      transformRule: this.buildPl0Snippet(ctx.pl0Snippet(1))
    };
  }

  visitOutputTypeMeta(ctx) {
    if (ctx.TYPE()) {
      const typeRef = this.visit(ctx.typeRef());
      return { dataType: typeRef, dataTypes: [typeRef] };
    }

    const refs = this.visit(ctx.typeRefList());
    return { dataType: refs[0] || null, dataTypes: refs };
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

    const sourceType = this.visit(ctx.typeRef(0));
    const targetType = this.visit(ctx.typeRef(1));

    return {
      type: 'MapperDecl',
      id: unquote(text(ctx.stringOrIdent())),
      sourceType,
      targetType,
      sourceTypeId: sourceType.id,
      targetTypeId: targetType.id,
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
  const input = new antlr4.InputStream(String(sourceText || ''));
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
  return builder.visit(tree);
}

export function compilePascalishWithAntlr(sourceText) {
  const ast = parsePascalishWithAntlr(sourceText);
  const compiledAt = new Date().toISOString();

  return {
    version: 1,
    compiledAt,
    serviceId: ast.serviceId || ast.runtimeUnit?.id || 'default-router-service',
    runtimeUnit: ast.runtimeUnit || {
      kind: 'service',
      id: ast.serviceId || 'default-router-service',
      refreshMs: null
    },
    ast,
    roles: ast.roles || [],
    codeLibraries: ast.codeLibraries || [],
    uses: ast.uses || [],
    interoperability: ast.interop || [],
    variableDeclarations: ast.variables || [],
    routerRules: ast.routers,
    dataMappings: ast.mappers
  };
}

async function main() {
  const inputPath = path.resolve('./data/router-mapper.dsl');
  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compilePascalishWithAntlr(sourceText);
  console.log(JSON.stringify({
    routers: compiled.routerRules.length,
    mappers: compiled.dataMappings.length,
    roles: compiled.roles.length,
    libraries: compiled.codeLibraries.length,
    interop: compiled.interoperability.length,
    runtimeUnit: compiled.runtimeUnit?.kind || 'service'
  }, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(err => {
    console.error('[PASCALISH-ANTLR] Failed:', err.message);
    process.exitCode = 1;
  });
}
