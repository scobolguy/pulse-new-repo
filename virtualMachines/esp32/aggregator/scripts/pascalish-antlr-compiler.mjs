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

function normalizeHttpVerb(raw) {
  return String(raw || '').trim().toUpperCase();
}

function normalizeHttpVerbSelector(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized) return null;

  const withOptionalPrefix = normalized.match(/^(?:httpverb\.)?([a-z][a-z0-9_-]*)$/i);
  if (!withOptionalPrefix) return null;

  const value = String(withOptionalPrefix[1] || '').trim();
  return value ? value.toUpperCase() : null;
}

function asSingleQuoted(value) {
  const source = String(value == null ? '' : value);
  return `'${source.replace(/'/g, "''")}'`;
}

function parseDurationToMs(valueText, unitText) {
  const n = Number.parseInt(String(valueText || '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = String(unitText || '').trim().toLowerCase();
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 's') return n * 1000;
  return n;
}

function parseIdentifierList(raw) {
  const textValue = String(raw || '').trim();
  if (!textValue) return [];
  return textValue
    .split(',')
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function parseOrchestrationHints(code) {
  const source = String(code || '');
  const asyncSubflows = [];

  const asyncPattern = /async\s+subflow\s+("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s+on\s+("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s+with\s+([a-z_][a-z0-9_-]*)\s+timeout\s+(\d+)\s*(ms|s|m)?\s+into\s+([a-z_][a-z0-9_-]*)\s*;/gi;

  let asyncMatch;
  while ((asyncMatch = asyncPattern.exec(source)) !== null) {
    const timeoutMs = parseDurationToMs(asyncMatch[4], asyncMatch[5] || 'ms');
    asyncSubflows.push({
      subflowId: unquote(asyncMatch[1]),
      nodeId: unquote(asyncMatch[2]),
      payloadRef: String(asyncMatch[3] || '').trim(),
      timeoutMs,
      handleRef: String(asyncMatch[6] || '').trim()
    });
  }

  const waitAllPattern = /wait\s+all\s*\(([^\)]*)\)\s+into\s*\(([^\)]*)\)\s+timeout\s+(\d+)\s*(ms|s|m)?\s+on\s+error\s+fail\s+transaction\s+("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*;/i;
  const waitAllMatch = waitAllPattern.exec(source);

  const failTxnPattern = /fail\s+transaction\s+("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*;/gi;
  const failTransactions = [];
  let failMatch;
  while ((failMatch = failTxnPattern.exec(source)) !== null) {
    failTransactions.push({ reason: unquote(failMatch[1]) });
  }

  const returnSuccessPattern = /return\s+success\s+([^;]+);/i;
  const returnSuccessMatch = returnSuccessPattern.exec(source);

  return {
    asyncSubflows,
    waitAll: waitAllMatch ? {
      handleRefs: parseIdentifierList(waitAllMatch[1]),
      resultRefs: parseIdentifierList(waitAllMatch[2]),
      timeoutMs: parseDurationToMs(waitAllMatch[3], waitAllMatch[4] || 'ms'),
      onErrorFailTransaction: unquote(waitAllMatch[5])
    } : null,
    failTransactions,
    returnSuccess: returnSuccessMatch ? {
      valueExpr: String(returnSuccessMatch[1] || '').trim()
    } : null
  };
}

function extractReturnExprFromEndpointBlock(blockCode) {
  const source = String(blockCode || '');
  if (!source) return "''";

  // Prefer RETURN inside a TRANSACTION body when present.
  const txnMatch = /transaction\s+[^\n;]+\s+begin([\s\S]*?)success[\s\S]*?backout[\s\S]*?end\s*;/i.exec(source);
  if (txnMatch) {
    const txnBody = String(txnMatch[1] || '');
    const txnReturn = /return\s+([^;]+);/i.exec(txnBody);
    if (txnReturn) return String(txnReturn[1] || '').trim() || "''";
  }

  const directReturn = /return\s+([^;]+);/i.exec(source);
  if (directReturn) return String(directReturn[1] || '').trim() || "''";
  return "''";
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
      services: [],
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

      if (value.type === 'ServiceDecl') {
        if (!ast.serviceId) {
          ast.serviceId = value.id;
        }
        if (!ast.runtimeUnit || String(ast.runtimeUnit.kind || '').toLowerCase() === 'service') {
          ast.runtimeUnit = value.runtimeUnit;
        }
        ast.services.push(value);
        if (value.syntheticRouter) {
          ast.routers.push(value.syntheticRouter);
        }
      } else if (value.type === 'RuntimeDecl') {
        ast.runtimeUnit = value.runtimeUnit;
        if (value.runtimeUnit.kind !== 'service') {
          ast.serviceId = value.runtimeUnit.id;
        }
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
    const serviceDecl = typeof ctx.serviceDecl === 'function' ? ctx.serviceDecl() : null;
    if (serviceDecl) return this.visit(serviceDecl);

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

  visitServiceDecl(ctx) {
    const id = unquote(text(ctx.stringOrIdent()));
    let handlers = [];
    const serviceBodyCtx = typeof ctx.serviceBody === 'function' ? ctx.serviceBody() : null;
    if (serviceBodyCtx) {
      const body = this.visit(serviceBodyCtx);
      handlers = Array.isArray(body?.handlers) ? body.handlers : [];
    } else {
      for (const endpointCtx of (ctx.serviceEndpoint ? ctx.serviceEndpoint() : [])) {
        const endpoint = this.visit(endpointCtx);
        if (!endpoint) continue;
        handlers.push({
          selectorRaw: endpoint.method || '',
          returnExprRaw: endpoint.returnExprRaw || "''",
          endpointPath: endpoint.path || '',
          acceptsType: endpoint.acceptsType || null,
          returnsType: endpoint.returnsType || null
        });
      }
    }

    const methods = [];
    const outputs = [];

    for (const handler of handlers) {
      const method = normalizeHttpVerbSelector(handler?.selectorRaw);
      const returnExprRaw = String(handler?.returnExprRaw || '').trim() || "''";
      if (method && !methods.includes(method)) methods.push(method);

      outputs.push({
        type: 'OutputDecl',
        queueName: `${id}.out`,
        httpVerb: method || null,
        whenRule: method
          ? `IF upper(httpVerb) = ${asSingleQuoted(method)} THEN output := 1 ELSE output := 0;`
          : 'output := 1;',
        transformRule: `output := ${returnExprRaw};`
      });
    }

    // Ensure the service remains executable even with an empty body.
    if (outputs.length === 0) {
      outputs.push({
        type: 'OutputDecl',
        queueName: `${id}.out`,
        httpVerb: null,
        whenRule: 'output := 1;',
        transformRule: "output := '';"
      });
    }

    return {
      type: 'ServiceDecl',
      id,
      runtimeUnit: { kind: 'service', id, refreshMs: null },
      handlers,
      syntheticRouter: {
        type: 'RouterDecl',
        id: `${id}-http`,
        inputQueue: `${id}.in`,
        description: `HTTP service ${id}`,
        enabled: true,
        serviceId: id,
        methods: methods.length > 0 ? methods : null,
        outputs
      }
    };
  }

  visitServiceEndpoint(ctx) {
    const method = normalizeHttpVerb(text(ctx.httpVerb()));
    const path = unquote(text(ctx.stringValue()));
    const acceptsType = ctx.endpointAccepts && ctx.endpointAccepts()
      ? text(ctx.endpointAccepts().typeRef())
      : null;
    const returnsType = ctx.endpointReturns && ctx.endpointReturns()
      ? text(ctx.endpointReturns().typeRef())
      : null;

    const block = this.visit(ctx.blockStmt());
    const rawBlock = String(block?.code || '');

    return {
      type: 'ServiceEndpoint',
      method,
      path,
      acceptsType,
      returnsType,
      returnExprRaw: extractReturnExprFromEndpointBlock(rawBlock)
    };
  }

  visitServiceBody(ctx) {
    const handlers = [];
    for (const stmt of ctx.serviceStmt ? ctx.serviceStmt() : []) {
      const value = this.visit(stmt);
      if (!value) continue;

      if (value.type === 'ServiceCaseStmt') {
        handlers.push(...(value.handlers || []));
      } else if (value.type === 'ServiceReturnStmt') {
        handlers.push({
          selectorRaw: '',
          returnExprRaw: value.returnExprRaw
        });
      }
    }

    return {
      type: 'ServiceBody',
      handlers
    };
  }

  visitServiceStmt(ctx) {
    if (ctx.serviceCaseStmt && ctx.serviceCaseStmt()) {
      return this.visit(ctx.serviceCaseStmt());
    }
    if (ctx.serviceReturnStmt && ctx.serviceReturnStmt()) {
      return this.visit(ctx.serviceReturnStmt());
    }
    return null;
  }

  visitServiceCaseStmt(ctx) {
    const handlers = [];
    for (const arm of ctx.serviceCaseArm ? ctx.serviceCaseArm() : []) {
      const value = this.visit(arm);
      if (!value) continue;
      handlers.push(value);
    }

    if (ctx.ELSE && ctx.ELSE()) {
      const elseReturn = this.visit(ctx.serviceReturnStmt());
      handlers.push({
        selectorRaw: '',
        returnExprRaw: elseReturn?.returnExprRaw || "''"
      });
    }

    return {
      type: 'ServiceCaseStmt',
      handlers
    };
  }

  visitServiceCaseArm(ctx) {
    const selector = this.visit(ctx.serviceExpr());
    const returnStmt = this.visit(ctx.serviceReturnStmt());
    return {
      selectorRaw: String(selector?.raw || '').trim(),
      returnExprRaw: String(returnStmt?.returnExprRaw || '').trim() || "''"
    };
  }

  visitServiceReturnStmt(ctx) {
    const expr = this.visit(ctx.serviceExpr());
    return {
      type: 'ServiceReturnStmt',
      returnExprRaw: String(expr?.raw || '').trim() || "''"
    };
  }

  visitServiceExpr(ctx) {
    if (ctx.qualifiedIdent && ctx.qualifiedIdent()) {
      return this.visit(ctx.qualifiedIdent());
    }
    if (ctx.stringValue && ctx.stringValue()) {
      return { kind: 'string', raw: text(ctx.stringValue()) };
    }
    if (ctx.NUMBER && ctx.NUMBER()) {
      return { kind: 'number', raw: text(ctx.NUMBER()) };
    }
    if (ctx.TRUE && ctx.TRUE()) {
      return { kind: 'boolean', raw: 'TRUE' };
    }
    if (ctx.FALSE && ctx.FALSE()) {
      return { kind: 'boolean', raw: 'FALSE' };
    }
    return { kind: 'unknown', raw: text(ctx) };
  }

  visitQualifiedIdent(ctx) {
    return {
      kind: 'qualifiedIdent',
      raw: text(ctx)
    };
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
      code: normalized,
      orchestration: parseOrchestrationHints(normalized)
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

    const header = { description: '', enabled: true, serviceId: null, methods: null };
    for (const prop of ctx.routerHeaderProp ? ctx.routerHeaderProp() : []) {
      const value = this.visit(prop);
      if (!value) continue;
      if (value.kind === 'description') header.description = value.value;
      if (value.kind === 'enabled') header.enabled = value.value;
      if (value.kind === 'serviceId') header.serviceId = value.value;
      if (value.kind === 'methods') header.methods = value.value;
    }

    return {
      type: 'RouterDecl',
      id: unquote(text(ctx.stringOrIdent())),
      inputQueue: unquote(text(ctx.stringValue())),
      description: header.description,
      enabled: header.enabled,
      serviceId: header.serviceId,
      methods: header.methods,
      outputs
    };
  }

  visitRouterHeaderProp(ctx) {
    if (ctx.DESCRIPTION()) return { kind: 'description', value: unquote(text(ctx.stringValue())) };
    if (ctx.ENABLED()) return { kind: 'enabled', value: toBoolean(ctx.booleanValue()) };
    if (ctx.SERVICE()) return { kind: 'serviceId', value: unquote(text(ctx.stringValue())) };
    if (ctx.METHODS()) return { kind: 'methods', value: this.visit(ctx.verbList()) };
    return null;
  }

  visitVerbList(ctx) {
    const nodes = ctx.stringOrIdent ? ctx.stringOrIdent() : [];
    const values = [];
    for (const node of nodes) {
      const value = normalizeHttpVerb(unquote(text(node)));
      if (!value) continue;
      if (!values.includes(value)) values.push(value);
    }
    return values;
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

// All keyword tokens from the PascalishRouterMapper grammar that must be matched uppercase.
// The grammar was authored with caseInsensitive=true but the generated JS lexer does not
// implement case-folding, so we uppercase these words in a pre-pass instead.
const PASCALISH_KEYWORDS = new Set([
  'SERVICE','CASE','OF','RETURN','METHODS','PROGRAM','DAEMON','REFRESH','MS','LIBRARY',
  'USE','AS','INTEROP','ROLE','CODE_LIBRARIAN','WFL','WORKFLOW','COBOLISH','PASCALISH',
  'ROUTER','MAPPER','INPUT','SOURCE','TARGET','DESCRIPTION','ENABLED','BEGIN','END',
  'OUTPUT','TYPE','TYPES','WHEN','TRANSFORM','MAP','TO','USING','TRUE','FALSE',
  'IF','THEN','ELSE','WHILE','DO','FOR','CALL','NOT','COBEGIN','COEND','SUBFLOW',
  'SYNC','ASYNC','WAIT','ALL','WITH','TIMEOUT','INTO','ON','LOCAL','PARENT','CHILD',
  'SIBLING','ALTERNATE','GET','POST','PUT','DELETE','PATCH','ACCEPTS','RETURNS',
  'ERROR','FAIL','TRANSACTION','SUCCESS','BACKOUT','TRY','CATCH','ENDTRY',
  'VAR','FROM','LIBRARIAN'
]);

/**
 * Uppercase known Pascalish keywords in source text while leaving string literals
 * and identifiers with hyphens (type names like swift-mt103) unchanged.
 * This compensates for the generated PascalishRouterMapperLexer not implementing caseInsensitive.
 */
function normalizeKeywordCase(sourceText) {
  // Walk character-by-character to skip over string literals, then uppercase bare words
  // that are known keywords.
  const src = String(sourceText || '');
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    // String literals — copy verbatim
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out.push(ch);
      i++;
      while (i < src.length) {
        const c = src[i];
        out.push(c);
        if (c === '\\') { i++; if (i < src.length) { out.push(src[i]); i++; } }
        else if (c === quote) { i++; break; }
        else i++;
      }
      continue;
    }
    // Word characters — collect word (letters, digits, underscores; NOT hyphens so type names survive)
    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      const start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
        word += src[i++];
      }
      // Only uppercase if it is a known keyword (case-insensitive match)
      if (PASCALISH_KEYWORDS.has(word.toUpperCase())) {
        out.push(word.toUpperCase());
      } else {
        out.push(word);
      }
      continue;
    }
    // Everything else — copy as-is
    out.push(ch);
    i++;
  }
  return out.join('');
}

function stripLineComments(sourceText) {
  // Strip // line comments before feeding to the ANTLR lexer, which
  // does not have a LINE_COMMENT rule in the generated PascalishRouterMapper grammar.
  // Replace each comment with whitespace to preserve line numbers.
  return String(sourceText || '').replace(/\/\/[^\r\n]*/g, (match) => ' '.repeat(match.length));
}

function extractAndStripMapperImports(sourceText) {
  // Strip  import mapper "..." from mapper;  lines and collect them as MapperImport nodes.
  // Same pre-pass used in compile-pascalish-program-antlr-to-pcode.mjs.
  const MAPPER_IMPORT_RE = /^\s*import\s+mapper\s+("[^"]*"|'[^']*')\s+from\s+mapper\s*;\s*$/gim;
  const imports = [];
  let match;
  while ((match = MAPPER_IMPORT_RE.exec(sourceText)) !== null) {
    const raw = String(match[1] || '');
    const mapId = raw.replace(/^["']|["']$/g, '').trim();
    if (mapId) imports.push({ type: 'MapperImport', mapId });
  }
  let stripped = sourceText.replace(MAPPER_IMPORT_RE, (m) => ' '.repeat(m.length));

  // Rewrite bare service declarations (no body) so the ANTLR grammar is satisfied.
  // The grammar rule requires  SERVICE id ; (serviceBody | serviceEndpoint* END)
  // but Pascalish programs use  service "name";  as a standalone namespace/ID declaration.
  // We inject  begin end  after the semicolon to produce  service "name" ; begin end;
  // which the grammar accepts, without changing the parsed serviceId.
  // The lookahead ensures we don't touch service declarations that already have a body.
  stripped = stripped.replace(
    /\bservice\s+("[^"]*"|'[^']*'|[a-z_][a-z0-9_-]*)\s*;(?=[ \t]*(\r?\n|\/\/))/gi,
    (fullMatch) => fullMatch.replace(/;$/, '; begin end;')
  );

  return { imports, stripped };
}

export function parsePascalishWithAntlr(sourceText) {
  const { imports: mapperImports, stripped: withoutImports } = extractAndStripMapperImports(String(sourceText || ''));
  // Order matters: strip comments first (so // inside strings are handled by stripLineComments
  // comment-aware pass), then normalise keyword case (so var→VAR etc.), then feed to ANTLR.
  const input = new antlr4.InputStream(normalizeKeywordCase(stripLineComments(withoutImports)));
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
  ast.mapperImports = mapperImports;
  return ast;
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
    dataMappings: ast.mappers,
    mapperImports: ast.mapperImports || []
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
