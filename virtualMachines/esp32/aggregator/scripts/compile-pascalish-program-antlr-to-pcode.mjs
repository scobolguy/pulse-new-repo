import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import antlr4 from 'antlr4';
import PascalishLexer from '../grammar/generated-modern/PascalishLexer.js';
import PascalishParser from '../grammar/generated-modern/PascalishParser.js';
import PascalishVisitor from '../grammar/generated-modern/PascalishVisitor.js';
import { attachPcodeSignature } from './pcode-signing.mjs';
import { compileConversionRuleToOps, emitMapperRoutinePcode } from './compile-mapping-rule.mjs';
import { resolveLibrary } from './pascalish-library-registry.mjs';
import {
  SERVICE_HOST_BINDINGS, SERVICE_HOST_BINDINGS_VERSION, SERVICE_HOST_INTERNAL_BINDINGS
} from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { DEVICE_BINDINGS, DEVICE_BINDINGS_VERSION } from '../../pmachines/shared/contracts/device-bindings.mjs';
import { HOST_CAPABILITIES_VERSION } from '../../pmachines/shared/contracts/host-capabilities.mjs';

const OPERATOR_METHOD_NAMES = {
  '+': 'op_add',
  '-': 'op_sub',
  '*': 'op_mul',
  '/': 'op_div',
  '=': 'op_eq',
  '<>': 'op_ne',
  '<': 'op_lt',
  '<=': 'op_le',
  '>': 'op_gt',
  '>=': 'op_ge'
};

const BINARY_OPERATOR_METHODS = OPERATOR_METHOD_NAMES;

const CREDENTIAL_PATTERN = /(^|[;\s])(password|pwd|user\s*id|uid|account[_\s]*key|apikey|api[_\s]*key)\s*=/i;

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, message) {
    this.errors.push(`line ${line}:${column + 1} ${message}`);
  }
}

function text(node) {
  return node ? String(node.getText()) : '';
}

function stringOrIdentText(ctx) {
  if (!ctx) return '';
  const node = ctx.stringOrIdent ? ctx.stringOrIdent() : null;
  return node ? text(node) : '';
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

// ANTLR getText() drops whitespace, so recover the original slice for pl0/blocks.
function originalText(ctx) {
  if (!ctx || !ctx.start || !ctx.stop) return '';
  try {
    return ctx.start.getInputStream().getText(ctx.start.start, ctx.stop.stop);
  } catch {
    return text(ctx);
  }
}

function normalizeEscapedDslText(value) {
  return String(value || '')
    .replace(/\\(["'\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function pl0SnippetText(ctx) {
  if (!ctx) return '';
  if (ctx.STRING && ctx.STRING()) {
    return normalizeEscapedDslText(unquote(ctx.STRING().getText()));
  }
  return normalizeEscapedDslText(originalText(ctx));
}

function durationToMs(value, unit) {
  const amount = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const normalized = String(unit || '').trim().toLowerCase();
  if (normalized === 'm') return amount * 60 * 1000;
  if (normalized === 's') return amount * 1000;
  return amount;
}

function collectUnitDecls(ctx, visitor) {
  const decls = (ctx.unitDecl ? ctx.unitDecl() : []) || [];
  const visited = decls.flatMap(item => {
    const value = visitor.visit(item);
    return Array.isArray(value) ? value : [value];
  }).filter(Boolean);
  return {
    globals: visited.filter(d => d.type === 'VarSection').flatMap(d => d.vars),
    procedures: visited.filter(d => d.type === 'SubprogramDecl'),
    mappers: visited.filter(d => d.type === 'MapperDecl'),
    routers: visited.filter(d => d.type === 'RouterDecl'),
    types: visited.filter(d => d.type === 'TypeDecl'),
    classes: visited.filter(d => d.type === 'ClassDecl'),
    methodImpls: visited.filter(d => d.type === 'MethodImplDecl'),
    libraries: visited.filter(d => d.type === 'LibraryDecl' || d.type === 'UseDecl')
  };
}

function extractReturnExpr(blockCode) {
  const source = String(blockCode || '');
  // A RETURN inside a TRANSACTION body wins over any later SUCCESS/BACKOUT return.
  const txnMatch = /transaction\s+[^\n;]+\s+begin([\s\S]*?)success[\s\S]*?backout[\s\S]*?end\s*;/i.exec(source);
  if (txnMatch) {
    const txnReturn = /return\s+([^;]+);/i.exec(String(txnMatch[1] || ''));
    if (txnReturn) return String(txnReturn[1] || '').trim();
  }
  const match = /return\s+([^;]+);/i.exec(source);
  return match ? String(match[1] || '').trim() : '';
}

// Render a service expression back into a PL/0 transform fragment.
function renderServiceExpr(expr) {
  if (!expr) return "''";
  if (expr.type === 'StringLiteral') return `'${String(expr.value).replace(/'/g, "''")}'`;
  if (expr.type === 'NumberLiteral' || expr.type === 'RealLiteral') return String(expr.value);
  if (expr.type === 'BooleanLiteral') return expr.value ? '1' : '0';
  if (expr.type === 'Identifier') return expr.name;
  return "''";
}

// Rewrite map("X", ...) to the service-qualified id when X is service-local.
function qualifyLocalMapRefs(exprText, localMapperIds) {
  if (!exprText || !localMapperIds || localMapperIds.size === 0) return exprText;
  return String(exprText).replace(/\bmap\s*\(\s*("[^"]*"|'[^']*')/gi, (whole, rawId) => {
    const bare = rawId.slice(1, -1);
    const qualified = localMapperIds.get(bare.toLowerCase());
    return qualified ? whole.replace(rawId, `"${qualified}"`) : whole;
  });
}

class PascalishProgramAstBuilder extends PascalishVisitor {
  constructor(sourceText = '', fileName = '', hostServices = false) {
    super();
    this.sourceLines = sourceText.split(/\r?\n/);
    this.fileName = fileName;
    this.hostServices = hostServices;
    this.librarianImports = [];
  }

  visit(ctx) {
    const result = super.visit(ctx);
    if (result && !Array.isArray(result) && result.type && ctx?.start && !result.sourceLocation) {
      result.sourceLocation = {
        sourceFile: this.fileName,
        sourceLanguage: 'pascalish',
        sourceLine: ctx.start.line,
        sourceText: this.sourceLines[ctx.start.line - 1] || '',
        endLine: ctx.stop?.line || ctx.start.line,
      };
    }
    return result;
  }

  visitCompilationUnit(ctx) {
    const ast = {
      type: 'CompilationUnit',
      runtimeUnit: null,
      variables: [],
      types: [],
      classes: [],
      methodImpls: [],
      procedures: [],
      mappers: [],
      routers: [],
      libraries: [],
      systems: [],
      databases: [],
      tables: []
    };

    for (const decl of ctx.decl() || []) {
      const value = this.visit(decl);
      if (!value) continue;
      if (value.type === 'ProgramDecl' || value.type === 'ServiceDecl' || value.type === 'DaemonDecl') {
        ast.runtimeUnit = value;
        if (value.syntheticRouter) ast.routers.push(value.syntheticRouter);
        for (const variable of value.unit?.globals || []) ast.variables.push(variable);
        for (const procedure of value.unit?.procedures || []) ast.procedures.push(procedure);
        if (value.type !== 'ServiceDecl') {
          for (const mapper of value.unit?.mappers || []) ast.mappers.push(mapper);
        }
        for (const router of value.unit?.routers || []) ast.routers.push(router);
        for (const typeDecl of value.unit?.types || []) ast.types.push(typeDecl);
        for (const classDecl of value.unit?.classes || []) ast.classes.push(classDecl);
        for (const methodImpl of value.unit?.methodImpls || []) ast.methodImpls.push(methodImpl);
        for (const library of value.unit?.libraries || []) ast.libraries.push(library);
      }
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (item.type === 'VarDecl') ast.variables.push(item);
        if (item.type === 'TypeDecl') ast.types.push(item);
        if (item.type === 'ClassDecl') ast.classes.push(item);
        if (item.type === 'MethodImplDecl') ast.methodImpls.push(item);
        if (item.type === 'MapperDecl') ast.mappers.push(item);
        if (item.type === 'RouterDecl') ast.routers.push(item);
        if (item.type === 'LibraryDecl' || item.type === 'UseDecl') ast.libraries.push(item);
        if (item.type === 'SystemDecl') ast.systems.push(item);
        if (item.type === 'DatabaseDecl') ast.databases.push(item);
        if (item.type === 'TableDecl') ast.tables.push(item);
        if (item.type === 'ServiceDecl') {
          for (const mapper of item.localMappers || []) ast.mappers.push(mapper);
          for (const router of item.gatewayRouters || []) ast.routers.push(router);
        }
      }
    }

    ast.librarianImports = this.librarianImports;
    return ast;
  }

  visitDecl(ctx) {
    if (ctx.importDecl()) return this.visit(ctx.importDecl());
    if (ctx.programDecl()) return this.visit(ctx.programDecl());
    if (ctx.serviceDecl()) return this.visit(ctx.serviceDecl());
    if (ctx.daemonDecl()) return this.visit(ctx.daemonDecl());
    if (ctx.varDecl()) return this.visit(ctx.varDecl());
    if (ctx.typeDecl()) return this.visit(ctx.typeDecl());
    if (ctx.systemDecl && ctx.systemDecl()) return this.visit(ctx.systemDecl());
    if (ctx.databaseDecl && ctx.databaseDecl()) return this.visit(ctx.databaseDecl());
    if (ctx.tableDecl && ctx.tableDecl()) return this.visit(ctx.tableDecl());
    if (ctx.classDecl()) return this.visit(ctx.classDecl());
    if (ctx && typeof ctx.methodImplDecl === 'function' && ctx.methodImplDecl()) return this.visit(ctx.methodImplDecl());
    if (ctx.routerDecl()) return this.visit(ctx.routerDecl());
    if (ctx.mapperDecl()) return this.visit(ctx.mapperDecl());
    if (ctx.libraryDecl()) return this.visit(ctx.libraryDecl());
    if (ctx.useDecl()) return this.visit(ctx.useDecl());
    return null;
  }

  visitImportDecl(ctx) {
    const items = ctx.librarianImportItems();
    if (items) {
      for (const item of items.importTarget()) {
        this.librarianImports.push({ name: unquote(item.getText()) });
      }
    }
    return null;
  }

  visitSystemDecl(ctx) {
    const names = (ctx.stringOrIdent ? ctx.stringOrIdent() : []).map(item => unquote(text(item)));
    const raw = text(ctx).toLowerCase();
    const abstract = raw.startsWith('systemtype') || raw.startsWith('systemtype');
    const systemName = abstract ? names[0] : names[0];
    const typeName = abstract ? null : (names[1] || null);
    const visibility = String(ctx.systemVisibilityClause ? ctx.systemVisibilityClause()?.getText() : '')
      .toLowerCase().includes('exposed') ? 'exposed' : 'internal';
    const members = (ctx.systemMember ? ctx.systemMember() : [])
      .map(member => this.visit(member))
      .filter(Boolean);
    return {
      type: 'SystemDecl',
      name: systemName,
      typeName,
      abstract,
      visibility,
      members
    };
  }

  visitDatabaseDecl(ctx) {
    const bindings = { server: null, schema: null, catalog: null, connection: null, connectionSecret: null };
    for (const binding of ctx.databaseBinding() || []) {
      const raw = text(binding).toLowerCase();
      const value = unquote(text(binding.stringValue()));
      if (raw.startsWith('server')) bindings.server = value;
      else if (raw.startsWith('schema')) bindings.schema = value;
      else if (raw.startsWith('catalog')) bindings.catalog = value;
      else if (raw.startsWith('connectionsecret')) bindings.connectionSecret = value;
      else if (raw.startsWith('connection')) bindings.connection = value;
    }
    const symbol = ctx.IDENT().getText();
    if (bindings.connection && CREDENTIAL_PATTERN.test(bindings.connection)) {
      throw new Error(`[PASCALISH-PROGRAM] database ${symbol} has credentials in its connection string; use 'connection secret "<ref>"' instead`);
    }
    return {
      type: 'DatabaseDecl',
      symbol,
      typeName: text(ctx.typeName()),
      ...bindings
    };
  }

  visitTableDecl(ctx) {
    const names = ctx.IDENT() || [];
    let schema = null;
    let schemaFromDatabase = false;
    let columns = [];
    for (const binding of ctx.tableBinding() || []) {
      const raw = text(binding).toLowerCase();
      if (raw.startsWith('columnsfromdatabase')) schemaFromDatabase = true;
      else if (binding.stringValue && binding.stringValue()) schema = unquote(text(binding.stringValue()));
      for (const column of binding.columnDecl() || []) {
        columns.push({ name: column.IDENT().getText(), dataType: this.visit(column.typeRef()) });
      }
    }
    const rowType = this.visit(ctx.typeRef());
    if (columns.length === 0 && !schemaFromDatabase) columns = [{ name: 'value', dataType: rowType }];
    return {
      type: 'TableDecl',
      symbol: names[0] ? names[0].getText() : '',
      database: names[1] ? names[1].getText() : null,
      rowType,
      schema,
      schemaFromDatabase,
      columns
    };
  }

  visitSystemMember(ctx) {
    if (ctx.systemQueueDecl()) return this.visit(ctx.systemQueueDecl());
    if (ctx.systemServiceDecl()) return this.visit(ctx.systemServiceDecl());
    return null;
  }

  visitSystemQueueDecl(ctx) {
    const names = (ctx.stringOrIdent ? ctx.stringOrIdent() : []).map(item => unquote(text(item)));
    const visibility = String(ctx.systemVisibilityClause ? ctx.systemVisibilityClause()?.getText() : '')
      .toLowerCase().includes('exposed') ? 'exposed' : 'internal';
    return {
      kind: 'queue',
      symbol: names[0],
      queueName: names[1] || names[0],
      dataTypeId: names[2] || null,
      dataTypeIds: names[2] ? [names[2]] : [],
      visibility
    };
  }

  visitSystemServiceDecl(ctx) {
    const names = (ctx.stringOrIdent ? ctx.stringOrIdent() : []).map(item => unquote(text(item)));
    const visibility = String(ctx.systemVisibilityClause ? ctx.systemVisibilityClause()?.getText() : '')
      .toLowerCase().includes('exposed') ? 'exposed' : 'internal';
    return {
      kind: 'service',
      symbol: names[0],
      serviceId: names[1] || names[0],
      visibility
    };
  }

  visitUseDecl(ctx) {
    return {
      type: 'UseDecl',
      id: unquote(text(ctx.stringOrIdent())),
      alias: ctx.IDENT() ? ctx.IDENT().getText() : null
    };
  }

  visitMapperDecl(ctx) {
    const typeRefs = ctx.typeRef() || [];
    return {
      type: 'MapperDecl',
      id: unquote(text(ctx.stringOrIdent())),
      sourceTypeId: unquote(text(typeRefs[0])),
      targetTypeId: unquote(text(typeRefs[1])),
      maps: (ctx.mapDecl() || []).map(item => this.visit(item)).filter(Boolean)
    };
  }

  visitMapDecl(ctx) {
    const paths = ctx.stringValue() || [];
    return {
      sourcePath: unquote(text(paths[0])),
      targetPath: unquote(text(paths[1])),
      conversionRule: pl0SnippetText(ctx.pl0Snippet())
    };
  }

  visitRouterDecl(ctx) {
    return {
      type: 'RouterDecl',
      id: unquote(text(ctx.stringOrIdent())),
      inputQueue: unquote(text(ctx.stringValue())),
      outputs: (ctx.outputDecl() || []).map(item => this.visit(item)).filter(Boolean)
    };
  }

  visitOutputDecl(ctx) {
    const snippets = ctx.pl0Snippet() || [];
    const outputTypeMeta = ctx.outputTypeMeta ? ctx.outputTypeMeta() : null;
    const outputTypeRef = outputTypeMeta && outputTypeMeta.typeRef ? outputTypeMeta.typeRef() : null;
    return {
      queueName: unquote(text(ctx.stringValue())),
      outputType: outputTypeRef ? unquote(text(outputTypeRef)) : '',
      whenRule: pl0SnippetText(snippets[0]),
      transformRule: pl0SnippetText(snippets[1])
    };
  }

  visitProgramDecl(ctx) {
    const nameNode = ctx.stringOrIdent ? ctx.stringOrIdent() : null;
    const unit = collectUnitDecls(ctx, this);
    return {
      type: 'ProgramDecl',
      name: nameNode ? unquote(text(nameNode)) : '',
      unit,
      block: ctx.block() ? this.visit(ctx.block()) : { type: 'Block', statements: [] }
    };
  }

  visitServiceDecl(ctx) {
    const nameNode = ctx.stringOrIdent ? ctx.stringOrIdent() : null;
    const serviceId = nameNode ? unquote(text(nameNode)) : '';

    const localDecls = [];
    const unit = collectUnitDecls(ctx, this);
    for (const mapper of unit.mappers) localDecls.push(mapper);
    for (const type of unit.types) localDecls.push(type);
    for (const library of unit.libraries) localDecls.push(library);
    for (const variable of unit.globals) localDecls.push(variable);
    const body = ctx.serviceBody() ? this.visit(ctx.serviceBody()) : { type: 'Block', statements: [] };
    for (const entry of body.localDecls || []) localDecls.push(entry);

    const localMappers = localDecls.filter(item => item.type === 'MapperDecl');    const localTypes = localDecls.filter(item => item.type === 'TypeDecl');
    const localLibraries = localDecls.filter(item => item.type === 'LibraryDecl');
    const localVariables = localDecls.filter(item => item.type === 'VarDecl');

    // Local mappers are namespaced under the service so they can never collide
    // with, or be mistaken for, a Mapping Librarian entry.
    const localMapperIds = new Map();
    for (const mapper of localMappers) {
      const qualified = `${serviceId}.${mapper.id}`;
      localMapperIds.set(mapper.id.toLowerCase(), qualified);
      mapper.localName = mapper.id;
      mapper.id = qualified;
      mapper.scope = 'local';
      mapper.ownerServiceId = serviceId;
    }
    for (const item of [...localTypes, ...localLibraries, ...localVariables]) {
      item.scope = 'local';
      item.ownerServiceId = serviceId;
    }

    const endpoints = (ctx.serviceEndpoint() || [])
      .map(item => this.visit(item))
      .filter(Boolean)
      .map(endpoint => ({
        ...endpoint,
        returnExpr: qualifyLocalMapRefs(endpoint.returnExpr, localMapperIds)
      }));

    const node = {
      type: 'ServiceDecl',
      name: serviceId,
      endpoints,
      localMappers,
      localTypes,
      localLibraries,
      localVariables,
      gatewayRouters: (body.statements || [])
        .filter(item => item.type === 'RouteMessage')
        .map((item, index) => ({
          type: 'RouterDecl',
          id: `${serviceId}-route-${index + 1}`,
          inputQueue: item.fromQueue,
          outputs: [{
            queueName: item.toQueue,
            dataTypeId: localMappers[0]?.targetTypeId || 'pacs',
            dataTypeIds: [localMappers[0]?.targetTypeId || 'pacs'],
            whenRule: 'output := 1;',
            transformRule: localMapperIds.size > 0
              ? `output := map('${localMapperIds.get(String(item.mapperId || '').toLowerCase()) || [...localMapperIds.values()][0]}', src);`
              : 'output := src;'
          }]
        })),
      block: {
        ...body,
        statements: (body.statements || []).filter(item => item.type !== 'RouteMessage' && item.type !== 'ServiceCase')
      }
    };
    if (this.hostServices) node.unit = unit;

    const caseStmt = (body.statements || []).find(item => item.type === 'ServiceCase');
    if (caseStmt && caseStmt.arms.length > 0) {
      node.syntheticRouter = {
        type: 'RouterDecl',
        id: `${serviceId}-http`,
        inputQueue: `${serviceId}.in`,
        outputs: caseStmt.arms.map(arm => ({
          queueName: `${serviceId}.out`,
          whenRule: `IF upper(httpVerb) = '${arm.verb}' THEN output := 1 ELSE output := 0;`,
          transformRule: `output := ${qualifyLocalMapRefs(renderServiceExpr(arm.expr), localMapperIds)};`
        }))
      };
    }

    // A service with no endpoints and no CASE still exposes one always-on
    // route, matching the legacy compiler's behaviour.
    if (!node.syntheticRouter && endpoints.length === 0) {
      const bareReturn = (body.statements || []).find(item => item.type === 'Return');
      node.syntheticRouter = {
        type: 'RouterDecl',
        id: `${serviceId}-http`,
        inputQueue: `${serviceId}.in`,
        outputs: [{
          queueName: `${serviceId}.out`,
          whenRule: 'output := 1;',
          transformRule: `output := ${qualifyLocalMapRefs(renderServiceExpr(bareReturn?.expr), localMapperIds)};`
        }]
      };
    }

    if (endpoints.length > 0 && !this.hostServices) {
      node.syntheticRouter = {
        type: 'RouterDecl',
        id: `${serviceId}-http`,
        inputQueue: `${serviceId}.in`,
        serviceId,
        methods: endpoints.map(endpoint => endpoint.verb),
        outputs: endpoints.map(endpoint => ({
          queueName: `${serviceId}.out`,
          httpVerb: endpoint.verb,
          whenRule: `IF upper(httpVerb) = '${endpoint.verb}' THEN output := 1 ELSE output := 0;`,
          transformRule: `output := ${endpoint.returnExpr || "''"};`
        }))
      };
    }

    return node;
  }

  visitServiceBody(ctx) {
    const statements = [];
    const localDecls = [];
    for (const element of ctx.serviceBodyElement() || []) {
      if (element.serviceLocalDecl && element.serviceLocalDecl()) {
        const decl = this.visit(element.serviceLocalDecl());
        if (decl?.type === 'VarSection') localDecls.push(...decl.vars);
        else if (decl) localDecls.push(...(Array.isArray(decl) ? decl : [decl]));
        continue;
      }
      if (element.serviceStmt && element.serviceStmt()) {
        const stmt = this.visit(element.serviceStmt());
        if (stmt) statements.push(stmt);
      }
    }
    return { type: 'Block', statements, localDecls };
  }

  visitServiceLocalDecl(ctx) {
    return this.visit(ctx.unitDecl());
  }

  visitLibraryDecl(ctx) {
    return {
      type: 'LibraryDecl',
      id: unquote(text(ctx.stringOrIdent())),
      source: unquote(text(ctx.librarySource()))
    };
  }

  visitServiceEndpoint(ctx) {
    const bodyContext = ctx.block ? ctx.block() : ctx.blockStmt();
    const returnExpr = extractReturnExpr(originalText(bodyContext));
    const endpoint = {
      verb: text(ctx.httpVerb()).toUpperCase(),
      path: unquote(text(ctx.stringValue())),
      acceptsType: ctx.endpointAccepts() ? text(ctx.endpointAccepts().typeRef()) : '',
      returnsType: ctx.endpointReturns() ? text(ctx.endpointReturns().typeRef()) : '',
      returnExpr
    };
    if (this.hostServices) {
      const input = new antlr4.InputStream(originalText(bodyContext).replace(/[;.]\s*$/, ''));
      const lexer = new PascalishLexer(input);
      const errors = new CollectingErrorListener();
      lexer.removeErrorListeners();
      lexer.addErrorListener(errors);
      const parser = new PascalishParser(new antlr4.CommonTokenStream(lexer));
      parser.removeErrorListeners();
      parser.addErrorListener(errors);
      const block = parser.block();
      if (errors.errors.length) throw new Error(`[PASCALISH-PROGRAM] Service handler parse failed:\n${errors.errors.join('\n')}`);
      const previous = this.currentFunction;
      this.currentFunction = `${endpoint.verb} ${endpoint.path}`;
      try { endpoint.body = this.visit(block); } finally { this.currentFunction = previous; }
    }
    return endpoint;
  }

  visitServiceCaseStmt(ctx) {
    const returns = ctx.serviceReturnStmt() || [];
    const arms = (ctx.serviceCaseArm() || []).map(arm => this.visit(arm)).filter(Boolean);
    // A trailing ELSE RETURN sits outside the arms in the parse tree.
    const elseReturn = returns.length > 0 ? this.visit(returns[returns.length - 1]) : null;
    return {
      type: 'ServiceCase',
      arms,
      elseExpr: elseReturn ? elseReturn.expr : null
    };
  }

  visitServiceCaseArm(ctx) {
    const selector = text(ctx.serviceExpr());
    const returnStmt = ctx.serviceReturnStmt() ? this.visit(ctx.serviceReturnStmt()) : null;
    return {
      selector,
      verb: selector.split('.').pop().toUpperCase(),
      expr: returnStmt ? returnStmt.expr : null
    };
  }

  visitServiceStmt(ctx) {
    if (ctx.serviceReturnStmt()) return this.visit(ctx.serviceReturnStmt());
    if (ctx.serviceCaseStmt()) return this.visit(ctx.serviceCaseStmt());
    if (ctx.serviceRouteStmt()) return this.visit(ctx.serviceRouteStmt());
    return null;
  }

  visitServiceRouteStmt(ctx) {
    const endpoints = ctx.stringOrIdent() || [];
    const mapperId = endpoints.length > 2 ? unquote(text(endpoints[0])) : null;
    const queueStart = endpoints.length > 2 ? 1 : 0;
    return {
      type: 'RouteMessage',
      mapperId,
      fromQueue: unquote(text(endpoints[queueStart])),
      toQueue: unquote(text(endpoints[queueStart + 1]))
    };
  }

  visitServiceReturnStmt(ctx) {
    const expr = ctx.serviceExpr() ? this.visit(ctx.serviceExpr()) : null;
    return {
      type: 'Return',
      expr: expr || { type: 'StringLiteral', value: '' }
    };
  }

  visitServiceExpr(ctx) {
    if (ctx.STRING()) {
      return { type: 'StringLiteral', value: ctx.STRING().getText().slice(1, -1) };
    }
    if (ctx.NUMBER()) {
      const raw = ctx.NUMBER().getText();
      return raw.includes('.')
        ? { type: 'RealLiteral', value: Number.parseFloat(raw) }
        : { type: 'NumberLiteral', value: Number.parseInt(raw, 10) };
    }
    if (ctx.getChildCount() === 1 && (text(ctx) === 'true' || text(ctx) === 'false')) {
      return { type: 'BooleanLiteral', value: text(ctx) === 'true' };
    }
    if (ctx.qualifiedName()) {
      return { type: 'Identifier', name: this.visit(ctx.qualifiedName()) };
    }
    return { type: 'UnknownExpr', raw: text(ctx) };
  }

  visitDaemonDecl(ctx) {
    const nameNode = ctx.stringOrIdent ? ctx.stringOrIdent() : null;
    const unit = collectUnitDecls(ctx, this);
    return {
      type: 'DaemonDecl',
      name: nameNode ? unquote(text(nameNode)) : '',
      unit,
      schedule: ctx.daemonSchedule() ? this.visit(ctx.daemonSchedule()) : null,
      block: ctx.block() ? this.visit(ctx.block()) : { type: 'Block', statements: [] }
    };
  }

  visitDaemonSchedule(ctx) {
    const unitNode = ctx.getChild(ctx.getChildCount() - 1);
    const unit = text(unitNode).toLowerCase();
    const scheduleExpr = this.visit(ctx.expr());
    return {
      type: 'DaemonSchedule',
      unit,
      expr: scheduleExpr
    };
  }

  visitTypeDecl(ctx) {
    if (!ctx.typeBinding) {
      return {
        type: 'TypeDecl',
        name: ctx.IDENT().getText(),
        genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
        targetType: this.visit(ctx.typeRef())
      };
    }
    return (ctx.typeBinding() || []).map(binding => this.visit(binding));
  }

  visitTypeBinding(ctx) {
    const name = ctx.pascalIdentifier().getText();
    const genericParams = ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [];
    if (ctx.objectPascalClassType()) {
      const classCtx = ctx.objectPascalClassType();
      let currentVisibility = 'public';
      const members = [];
      for (const item of classCtx.classBodyItem() || []) {
        if (item.classVisibility()) {
          currentVisibility = text(item.classVisibility()).toLowerCase();
          continue;
        }
        const member = this.visit(item.classMember());
        if (member) {
          member.visibility = currentVisibility;
          members.push(member);
        }
      }
      return { type: 'ClassDecl', name, genericParams, extendsType: classCtx.classInheritance() ? this.visit(classCtx.classInheritance()) : null, members };
    }
    return { type: 'TypeDecl', name, genericParams, targetType: this.visit(ctx.typeRef()) };
  }

  visitClassDecl(ctx) {
    // Visibility sections apply to every member that follows them until the next
    // section keyword or 'end'; members before the first section default to public.
    let currentVisibility = 'public';
    const members = [];
    const bodyItems = ctx.classBodyItem ? ctx.classBodyItem() : [];
    for (const item of bodyItems || []) {
      if (item.classVisibility()) {
        currentVisibility = text(item.classVisibility()).toLowerCase();
        continue;
      }
      const member = this.visit(item.classMember());
      if (member) {
        member.visibility = currentVisibility;
        members.push(member);
      }
    }
    if (!ctx.classBodyItem) {
      for (const memberCtx of ctx.classMember() || []) {
        const member = this.visit(memberCtx);
        if (member) {
          member.visibility = 'public';
          members.push(member);
        }
      }
    }

    return {
      type: 'ClassDecl',
      name: (ctx.pascalIdentifier ? ctx.pascalIdentifier() : ctx.IDENT()).getText(),
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      extendsType: ctx.classInheritance() ? this.visit(ctx.classInheritance()) : null,
      members
    };
  }

  visitClassInheritance(ctx) {
    return this.visit(ctx.typeRef());
  }

  visitClassFieldDecl(ctx) {
    return {
      type: 'ClassFieldDecl',
      name: ctx.IDENT().getText(),
      dataType: this.visit(ctx.typeRef())
    };
  }

  visitClassMember(ctx) {
    if (ctx.classFieldDecl()) return this.visit(ctx.classFieldDecl());
    if (ctx.classMethodDecl()) return this.visit(ctx.classMethodDecl());
    if (ctx.classOperatorDecl && ctx.classOperatorDecl()) return this.visit(ctx.classOperatorDecl());
    return null;
  }

  visitClassOperatorDecl(ctx) {
    const target = text(ctx.operatorTarget());
    const parameters = ctx.methodParamList() ? this.visit(ctx.methodParamList()) : [];
    const declaredReturn = ctx.typeRef() ? this.visit(ctx.typeRef()) : null;
    const symbolName = OPERATOR_METHOD_NAMES[target];
    const localDecls = [];
    if (ctx.varSection && ctx.varSection()) {
      localDecls.push(...this.visit(ctx.varSection()).vars);
    }
    for (const item of (ctx.unitDecl ? ctx.unitDecl() : []) || []) {
      const value = this.visit(item);
      if (value?.type === 'VarSection') localDecls.push(...value.vars);
    }

    // A non-symbolic target names a type: with parameters it converts into this class
    // and is keyed by the source type, without them it converts out of this class.
    const sourceType = parameters.length > 0 ? String(parameters[0]?.dataType?.id || '') : '';
    const name = symbolName
      || (parameters.length > 0 ? `op_from_${sourceType.toLowerCase()}` : `op_to_${target.toLowerCase()}`);
    const returnType = declaredReturn
      || (symbolName || parameters.length > 0 ? null : { type: 'TypeRef', kind: 'simple', id: target, genericArgs: [] });

    const previousFunction = this.currentFunction || null;
    this.currentFunction = name;
    const body = this.visit(ctx.block());
    this.currentFunction = previousFunction;

    return {
      type: 'ClassMethodDecl',
      methodKind: 'function',
      isOperator: true,
      // A conversion into this class constructs a value, so it takes no receiver.
      isStatic: !symbolName && parameters.length > 0,
      operatorTarget: target,
      name,
      genericParams: [],
      parameters,
      localDecls,
      returnType,
      body
    };
  }

  visitClassMethodDecl(ctx) {
    const name = (ctx.pascalIdentifier ? ctx.pascalIdentifier() : ctx.IDENT()).getText();
    const returnType = ctx.typeRef() ? this.visit(ctx.typeRef()) : null;
    const hasBody = Boolean(ctx.block());
    const localDecls = hasBody
      ? (ctx.unitDecl ? ctx.unitDecl() || [] : [])
        .map(item => this.visit(item))
        .filter(item => item?.type === 'VarSection')
        .flatMap(item => item.vars)
      : [];

    const previousFunction = this.currentFunction || null;
    this.currentFunction = returnType ? name : null;
    const body = hasBody ? this.visit(ctx.block()) : null;
    this.currentFunction = previousFunction;

    return {
      type: 'ClassMethodDecl',
      methodKind: text(ctx.getChild(0)).toLowerCase(),
      name,
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      parameters: ctx.methodParamList() ? this.visit(ctx.methodParamList()) : [],
      localDecls,
      returnType,
      body,
      // No body here means the implementation is supplied later by a top-level
      // `Kind ClassName.MethodName(...)` methodImplDecl.
      forward: !hasBody
    };
  }

  // `function Queue<T>.Dequeue: T; begin ... end;` — implements a class method
  // that was forward-declared (or re-declared) in the class body.
  visitMethodImplDecl(ctx) {
    const identifiers = ctx.pascalIdentifier() || [];
    const className = identifiers[0] ? identifiers[0].getText() : '';
    const name = identifiers[1] ? identifiers[1].getText() : '';
    const returnType = ctx.typeRef() ? this.visit(ctx.typeRef()) : null;
    const localDecls = [];
    if (ctx.varSection && ctx.varSection()) {
      localDecls.push(...this.visit(ctx.varSection()).vars);
    }
    for (const item of (ctx.unitDecl ? ctx.unitDecl() : []) || []) {
      const value = this.visit(item);
      if (value?.type === 'VarSection') localDecls.push(...value.vars);
    }

    const previousFunction = this.currentFunction || null;
    this.currentFunction = returnType ? name : null;
    const body = this.visit(ctx.block());
    this.currentFunction = previousFunction;

    return {
      type: 'MethodImplDecl',
      methodKind: text(ctx.getChild(0)).toLowerCase(),
      className,
      name,
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      parameters: ctx.methodParamList() ? this.visit(ctx.methodParamList()) : [],
      localDecls,
      returnType,
      body
    };
  }

  visitMethodParamList(ctx) {
    return (ctx.methodParamDecl() || []).flatMap(item => this.visit(item));
  }

  visitMethodParamDecl(ctx) {
    const names = this.visit(ctx.identList());
    const dataType = this.visit(ctx.typeRef());
    return names.map(name => ({
      type: 'ParameterDecl',
      name,
      dataType
    }));
  }

  visitVarDecl(ctx) {
    const node = {
      type: 'VarDecl',
      name: ctx.IDENT().getText(),
      dataType: this.visit(ctx.typeRef())
    };
    if (ctx.varSource()) {
      const src = this.visit(ctx.varSource());
      node.fromLibrarian = src.fromLibrarian;
      if (src.source !== undefined) node.source = src.source;
    }
    return node;
  }

  visitVarSource(ctx) {
    const ident = ctx.IDENT();
    const str = ctx.STRING();
    if (ident) return { fromLibrarian: false, source: ident.getText() };
    if (str) return { fromLibrarian: false, source: str.getText().replace(/^["']|["']$/g, '') };
    // neither IDENT nor STRING → matched `from librarian`
    return { fromLibrarian: true };
  }

  visitIdentList(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText());
  }

  visitTypeRef(ctx) {
    if (ctx.STRING && ctx.STRING()) {
      return { type: 'TypeRef', kind: 'quoted', id: unquote(ctx.STRING().getText()), genericArgs: [] };
    }
    if (ctx.simpleType()) return this.visit(ctx.simpleType());
    if (ctx.cacheType()) return this.visit(ctx.cacheType());
    if (ctx.recordType()) return this.visit(ctx.recordType());
    if (ctx.enumType && ctx.enumType()) return this.visit(ctx.enumType());
    if (ctx.queueType()) return this.visit(ctx.queueType());
    if (ctx.stackType()) return this.visit(ctx.stackType());
    if (ctx.priorityQueueType()) return this.visit(ctx.priorityQueueType());
    if (ctx.fixedArrayType()) return this.visit(ctx.fixedArrayType());
    if (ctx.dynamicArrayType()) return this.visit(ctx.dynamicArrayType());
    if (ctx.listType && ctx.listType()) return this.visit(ctx.listType());
    if (ctx.userType()) return this.visit(ctx.userType());
    return { type: 'TypeRef', kind: 'unknown', id: 'unknown', genericArgs: [] };
  }

  visitCacheType(ctx) {
    return { type: 'TypeRef', kind: 'cache', elementType: this.visit(ctx.typeRef()), genericArgs: [] };
  }

  visitListType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'list',
      id: 'list',
      elementType: this.visit(ctx.typeRef(0)),
      genericArgs: []
    };
  }

  visitGenericTypeParams(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText());
  }

  visitSimpleType(ctx) {
    const decimalCtx = ctx.decimalType && ctx.decimalType();
    if (decimalCtx) {
      const numbers = (decimalCtx.NUMBER() || []).map(token => Number(token.getText()));
      const precision = numbers[0] ?? 18;
      const scale = numbers[1] ?? 0;
      if (!Number.isSafeInteger(precision) || precision <= 0
        || !Number.isSafeInteger(scale) || scale < 0 || scale > precision) {
        throw new Error('[PASCALISH-PROGRAM] Invalid decimal type: precision must be a positive integer and scale an integer between 0 and precision');
      }
      return {
        type: 'TypeRef',
        kind: 'simple',
        id: 'decimal',
        precision,
        scale,
        genericArgs: []
      };
    }
    return {
      type: 'TypeRef',
      kind: 'simple',
      id: text(ctx),
      genericArgs: []
    };
  }

  visitUserType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'user',
      id: text(ctx.typeName()),
      genericArgs: ctx.genericTypeArgs() ? this.visit(ctx.genericTypeArgs()) : []
    };
  }

  visitGenericTypeArgs(ctx) {
    return (ctx.typeRef() || []).map(typeCtx => this.visit(typeCtx));
  }

  visitRecordType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'record',
      fields: (ctx.recordField() || []).map(field => this.visit(field)),
      genericArgs: []
    };
  }

  visitRecordField(ctx) {
    return {
      name: ctx.IDENT().getText(),
      dataType: this.visit(ctx.typeRef())
    };
  }

  visitEnumType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'enum',
      values: this.visit(ctx.identList()),
      genericArgs: []
    };
  }

  visitQueueType(ctx) {
    return { type: 'TypeRef', kind: 'queue', id: text(ctx), genericArgs: [] };
  }

  visitStackType(ctx) {
    return { type: 'TypeRef', kind: 'stack', id: text(ctx), genericArgs: [] };
  }

  visitPriorityQueueType(ctx) {
    return { type: 'TypeRef', kind: 'priorityqueue', id: text(ctx), genericArgs: [] };
  }

  visitFixedArrayType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'fixed-array',
      id: 'array',
      low: text(ctx.expr(0)),
      high: text(ctx.expr(1)),
      elementType: this.visit(ctx.typeRef()),
      genericArgs: []
    };
  }

  visitDynamicArrayType(ctx) {
    return {
      type: 'TypeRef',
      kind: 'dynamic-array',
      id: 'array',
      capacityType: this.visit(ctx.typeRef(0)),
      elementType: this.visit(ctx.typeRef(1)),
      genericArgs: []
    };
  }

  visitBlock(ctx) {
    const list = ctx.statementList ? ctx.statementList() : null;
    return {
      type: 'Block',
      statements: list ? (list.statement() || []).map(item => this.visit(item)).filter(Boolean) : []
    };
  }

  visitUnitDecl(ctx) {
    if (ctx.importDecl()) return this.visit(ctx.importDecl());
    if (ctx.varSection()) return this.visit(ctx.varSection());
    if (ctx.subprogramDecl()) return this.visit(ctx.subprogramDecl());
    if (ctx.typeDecl()) return this.visit(ctx.typeDecl());
    if (ctx.classDecl()) return this.visit(ctx.classDecl());
    if (ctx && typeof ctx.methodImplDecl === 'function' && ctx.methodImplDecl()) return this.visit(ctx.methodImplDecl());
    if (ctx.routerDecl()) return this.visit(ctx.routerDecl());
    if (ctx.mapperDecl()) return this.visit(ctx.mapperDecl());
    if (ctx.libraryDecl()) return this.visit(ctx.libraryDecl());
    if (ctx.useDecl()) return this.visit(ctx.useDecl());
    return null;
  }

  visitVarSection(ctx) {
    return {
      type: 'VarSection',
      vars: (ctx.varLine() || []).flatMap(line => this.visit(line))
    };
  }

  visitVarLine(ctx) {
    const dataType = this.visit(ctx.typeRef());
    return this.visit(ctx.identList()).map(name => ({ type: 'VarDecl', name, dataType }));
  }

  visitSubprogramDecl(ctx) {
    const inner = (ctx.unitDecl() || []).map(item => this.visit(item)).filter(Boolean);
    const localDecls = inner
      .filter(item => item.type === 'VarSection')
      .flatMap(item => item.vars);
    const paramDecls = ctx.paramSection() ? this.visit(ctx.paramSection()) : [];
    const name = ctx.IDENT().getText();
    const returnType = ctx.typeRef() ? this.visit(ctx.typeRef()) : null;
    const exported = Boolean(ctx.exportFlag && ctx.exportFlag());

    // `return expr` means a value return only inside a function; elsewhere it stays an
    // orchestration ReturnSuccess, which existing service/daemon sources rely on.
    const previousFunction = this.currentFunction || null;
    this.currentFunction = returnType ? name : null;
    const body = this.visit(ctx.block());
    this.currentFunction = previousFunction;

    return {
      type: 'SubprogramDecl',
      kind: text(ctx.getChild(0)).toLowerCase(),
      name,
      exported,
      returnType,
      params: paramDecls.map(item => item.name),
      paramDecls,
      locals: localDecls.map(item => item.name),
      localDecls,
      body
    };
  }

  visitParamSection(ctx) {
    return (ctx.paramGroup() || []).flatMap(group => this.visit(group));
  }

  visitParamGroup(ctx) {
    const dataType = this.visit(ctx.typeRef());
    return this.visit(ctx.identList()).map(name => ({ name, dataType }));
  }

  visitStatement(ctx) {
    if (ctx.assignStmt()) return this.visit(ctx.assignStmt());
    if (ctx.callStmt()) return this.visit(ctx.callStmt());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.whileStmt()) return this.visit(ctx.whileStmt());
    if (ctx.forStmt()) return this.visit(ctx.forStmt());
    if (ctx.repeatStmt()) return this.visit(ctx.repeatStmt());
    if (ctx.withStmt()) return this.visit(ctx.withStmt());
    if (ctx.enqueueStmt()) return this.visit(ctx.enqueueStmt());
    if (ctx.dequeueStmt()) return this.visit(ctx.dequeueStmt());
    if (ctx.insertStmt && ctx.insertStmt()) return this.visit(ctx.insertStmt());
    if (ctx.selectStmt && ctx.selectStmt()) return this.visit(ctx.selectStmt());
    if (ctx.updateStmt && ctx.updateStmt()) return this.visit(ctx.updateStmt());
    if (ctx.deleteStmt && ctx.deleteStmt()) return this.visit(ctx.deleteStmt());
    if (ctx.sendServiceStmt && ctx.sendServiceStmt()) return this.visit(ctx.sendServiceStmt());
    if (ctx.concurrentStmt()) return this.visit(ctx.concurrentStmt());
    if (ctx.returnStmt()) return this.visit(ctx.returnStmt());
    if (ctx.block()) return this.visit(ctx.block());
    return null;
  }

  visitConcurrentStmt(ctx) {
    if (ctx.cobeginStmt()) return this.visit(ctx.cobeginStmt());
    if (ctx.asyncStmt()) return this.visit(ctx.asyncStmt());
    if (ctx.waitStmt()) return this.visit(ctx.waitStmt());
    if (ctx.syncStmt()) return this.visit(ctx.syncStmt());
    if (ctx.subflowStmt()) return this.visit(ctx.subflowStmt());
    return null;
  }

  visitCobeginStmt(ctx) {
    const list = ctx.statementList ? ctx.statementList() : null;
    return {
      type: 'Cobegin',
      body: list ? (list.statement() || []).map(item => this.visit(item)).filter(Boolean) : []
    };
  }

  visitAsyncStmt(ctx) {
    return { type: 'Async', body: this.visit(ctx.statement()) };
  }

  visitSendServiceStmt(ctx) {
    return {
      type: 'SyncService',
      serviceId: unquote(text(ctx.stringValue())),
      input: this.visit(ctx.expr(0)),
      timeoutMs: durationToMs(text(ctx.expr(1)), text(ctx.timeUnit())),
      target: ctx.IDENT().getText()
    };
  }

  visitSubflowStmt(ctx) {
    const node = {
      type: 'Subflow',
      subflowId: unquote(text(ctx.stringValue())),
      nodeId: '',
      timeoutMs: 0,
      handleRef: ''
    };
    for (const option of ctx.subflowOption() || []) {
      if (option.stringOrIdent && option.stringOrIdent()) node.nodeId = unquote(text(option.stringOrIdent()));
      if (option.IDENT && option.IDENT()) node.handleRef = option.IDENT().getText();
      if (option.expr && option.expr() && option.timeUnit && option.timeUnit()) {
        node.timeoutMs = durationToMs(text(option.expr()), text(option.timeUnit()));
      }
    }
    return node;
  }

  visitWaitStmt(ctx) {
    if (!ctx.identGroup || ctx.identGroup().length === 0) {
      return { type: 'WaitAll', handles: [], targets: [], timeoutMs: 0, reason: '' };
    }
    const groups = ctx.identGroup();
    const errorClause = ctx.waitErrorClause ? ctx.waitErrorClause() : null;
    return {
      type: 'WaitAll',
      handles: this.visit(groups[0]),
      targets: groups[1] ? this.visit(groups[1]) : [],
      timeoutMs: ctx.expr() && ctx.timeUnit() ? durationToMs(text(ctx.expr()), text(ctx.timeUnit())) : 0,
      reason: errorClause ? unquote(text(errorClause.stringValue())) : ''
    };
  }

  visitIdentGroup(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText());
  }

  visitReturnStmt(ctx) {
    if (this.currentFunction) {
      if (!ctx.expr()) {
        throw new Error(`[PASCALISH-PROGRAM] Function ${this.currentFunction} has a bare return; a value is required`);
      }
      return { type: 'Return', expr: this.visit(ctx.expr()) };
    }
    return {
      type: 'ReturnSuccess',
      ref: ctx.expr() ? text(ctx.expr()) : ''
    };
  }

  visitWithStmt(ctx) {
    return {
      type: 'With',
      contextExpr: this.visit(ctx.expr()),
      body: ctx.statement() ? [this.visit(ctx.statement())].filter(Boolean) : []
    };
  }

  visitInsertStmt(ctx) {
    const identList = ctx.identList ? ctx.identList() : null;
    return {
      type: 'Insert',
      table: ctx.IDENT().getText(),
      columns: identList ? this.visit(identList) : [],
      values: (ctx.exprList().expr() || []).map(item => this.visit(item))
    };
  }

  visitSelectStmt(ctx) {
    const columnsCtx = ctx.selectColumns();
    // ANTLR returns a bare context when a rule appears once, an array otherwise.
    const lists = [ctx.identList()].flat().filter(Boolean);
    return {
      type: 'Select',
      table: ctx.IDENT().getText(),
      columns: columnsCtx.identList() ? this.visit(columnsCtx.identList()) : [],
      where: ctx.whereClause() ? this.visit(ctx.whereClause()) : null,
      targets: this.visit(lists[lists.length - 1])
    };
  }

  visitUpdateStmt(ctx) {
    return {
      type: 'Update',
      table: ctx.IDENT().getText(),
      assignments: (ctx.columnAssign() || []).map(item => this.visit(item)),
      where: ctx.whereClause() ? this.visit(ctx.whereClause()) : null
    };
  }

  visitColumnAssign(ctx) {
    return { column: ctx.IDENT().getText(), expr: this.visit(ctx.expr()) };
  }

  visitDeleteStmt(ctx) {
    return {
      type: 'Delete',
      table: ctx.IDENT().getText(),
      where: ctx.whereClause() ? this.visit(ctx.whereClause()) : null
    };
  }

  visitWhereClause(ctx) {
    return {
      column: ctx.IDENT().getText(),
      op: text(ctx.compareOp()),
      expr: this.visit(ctx.expr())
    };
  }

  visitEnqueueStmt(ctx) {
    return {
      type: 'Enqueue',
      queue: ctx.IDENT().getText(),
      expr: this.visit(ctx.expr())
    };
  }

  visitDequeueStmt(ctx) {
    const names = ctx.IDENT() || [];
    return {
      type: 'Dequeue',
      queue: names[0] ? names[0].getText() : '',
      target: names[1] ? names[1].getText() : ''
    };
  }

  visitAssignStmt(ctx) {
    return {
      type: 'Assign',
      target: this.visit(ctx.lvalue()),
      rounded: String(ctx.stop.text).toLowerCase() === 'rounded',
      expr: this.visit(ctx.expr())
    };
  }

  visitCallStmt(ctx) {
    return {
      type: 'Call',
      name: this.visit(ctx.qualifiedName()),
      args: ctx.exprList() ? this.visit(ctx.exprList()) : []
    };
  }

  visitIfStmt(ctx) {
    const statements = ctx.statement() || [];
    return {
      type: 'If',
      condition: this.visit(ctx.expr()),
      thenStatements: statements[0] ? [this.visit(statements[0])] : [],
      elseStatements: statements[1] ? [this.visit(statements[1])] : []
    };
  }

  visitWhileStmt(ctx) {
    return {
      type: 'While',
      condition: this.visit(ctx.expr()),
      body: this.visit(ctx.statement())
    };
  }

  visitForStmt(ctx) {
    return {
      type: 'For',
      variable: ctx.IDENT().getText(),
      startExpr: this.visit(ctx.expr(0)),
      endExpr: this.visit(ctx.expr(1)),
      body: this.visit(ctx.statement())
    };
  }

  visitRepeatStmt(ctx) {
    const list = ctx.statementList ? ctx.statementList() : null;
    return {
      type: 'Repeat',
      body: list ? (list.statement() || []).map(item => this.visit(item)).filter(Boolean) : [],
      untilExpr: this.visit(ctx.expr())
    };
  }

  visitLvalue(ctx) {
    const identifiers = ctx.IDENT();
    const idents = (Array.isArray(identifiers) ? identifiers : [identifiers]).map(token => token.getText());
    let indexExpr = null;
    for (const suffix of ctx.lvalueSuffix ? ctx.lvalueSuffix() || [] : []) {
      if (suffix.expr()) {
        if (indexExpr) throw new Error('[PASCALISH-PROGRAM] Chained array indexing (arr[i][j]) is not supported yet');
        indexExpr = this.visit(suffix.expr());
        continue;
      }
      const identToken = suffix.pascalIdentifier ? suffix.pascalIdentifier() : suffix.IDENT();
      if (identToken) {
        if (indexExpr) throw new Error('[PASCALISH-PROGRAM] Field access after an array index is not supported yet');
        idents.push(identToken.getText());
      }
    }
    const base = idents.join('.');
    return indexExpr ? { type: 'IndexedAccess', base, index: indexExpr } : base;
  }

  visitQualifiedName(ctx) {
    return text(ctx);
  }

  visitExprList(ctx) {
    return (ctx.expr() || []).map(item => this.visit(item));
  }

  visitExpr(ctx) {
    return this.visit(ctx.logicalOrExpr());
  }

  visitLogicalOrExpr(ctx) {
    const parts = ctx.logicalAndExpr() || [];
    return foldBinary(parts, 'or', part => this.visit(part));
  }

  visitLogicalAndExpr(ctx) {
    const parts = ctx.equalityExpr() || [];
    return foldBinary(parts, 'and', part => this.visit(part));
  }

  visitEqualityExpr(ctx) {
    return foldFromChildren(ctx, ctx.relationalExpr() || [], part => this.visit(part));
  }

  visitRelationalExpr(ctx) {
    return foldFromChildren(ctx, ctx.additiveExpr() || [], part => this.visit(part));
  }

  visitAdditiveExpr(ctx) {
    return foldFromChildren(ctx, ctx.multiplicativeExpr() || [], part => this.visit(part));
  }

  visitMultiplicativeExpr(ctx) {
    return foldFromChildren(ctx, ctx.unaryExpr() || [], part => this.visit(part));
  }

  visitUnaryExpr(ctx) {
    if (ctx.unaryExpr()) {
      return {
        type: 'Unary',
        op: text(ctx.getChild(0)),
        expr: this.visit(ctx.unaryExpr())
      };
    }
    return this.visit(ctx.primaryExpr());
  }

  visitPrimaryExpr(ctx) {
    if (ctx.NUMBER()) {
      const raw = ctx.NUMBER().getText();
      return raw.includes('.')
        ? { type: 'RealLiteral', value: Number.parseFloat(raw), raw }
        : { type: 'NumberLiteral', value: Number.parseInt(raw, 10), raw };
    }
    if (ctx.STRING()) {
      const raw = ctx.STRING().getText();
      return { type: 'StringLiteral', value: raw.slice(1, -1) };
    }
    if (ctx.getChildCount() === 1 && (text(ctx) === 'true' || text(ctx) === 'false')) {
      return { type: 'BooleanLiteral', value: text(ctx) === 'true' };
    }
    if (text(ctx.getChild(0)) === 'new' && ctx.typeRef()) {
      return { type: 'NewExpr', dataType: this.visit(ctx.typeRef()) };
    }
    if (ctx.qualifiedName() && text(ctx.getChild(1)) === '(') {
      return {
        type: 'CallExpr',
        name: this.visit(ctx.qualifiedName()),
        args: ctx.exprList() ? this.visit(ctx.exprList()) : [],
        fields: (ctx.IDENT ? ctx.IDENT() : []).map(node => node.getText())
      };
    }
    if (ctx.qualifiedName()) {
      return { type: 'Identifier', name: this.visit(ctx.qualifiedName()) };
    }
    if (ctx.simpleType && ctx.simpleType()) {
      return {
        type: 'CallExpr',
        name: text(ctx.simpleType()),
        args: ctx.exprList() ? this.visit(ctx.exprList()) : []
      };
    }
    if (ctx.lvalue()) {
      const lvalue = this.visit(ctx.lvalue());
      return typeof lvalue === 'string' ? { type: 'Identifier', name: lvalue } : lvalue;
    }
    if (ctx.expr()) {
      return this.visit(ctx.expr());
    }
    return { type: 'UnknownExpr', raw: text(ctx) };
  }
}

function foldBinary(parts, operator, mapper) {
  if (!parts || parts.length === 0) return null;
  let node = mapper(parts[0]);
  for (let index = 1; index < parts.length; index += 1) {
    node = { type: 'Binary', op: operator, left: node, right: mapper(parts[index]) };
  }
  return node;
}

function foldFromChildren(ctx, parts, mapper) {
  if (!parts || parts.length === 0) return null;
  let node = mapper(parts[0]);
  for (let index = 1; index < parts.length; index += 1) {
    node = {
      type: 'Binary',
      op: text(ctx.getChild((2 * index) - 1)),
      left: node,
      right: mapper(parts[index])
    };
  }
  return node;
}

class Codegen {
  constructor(ast) {
    this.ast = ast;
    this.lines = [];
    this.labelId = 0;
    this.procLabels = new Map();
    this.classInfo = new Map();

    this.spliceMethodImplementations();

    for (const classDecl of this.ast.classes || []) {
      const fields = new Set();
      const methods = new Set();
      const staticMethods = new Set();
      const fieldDecls = [];
      const fieldVisibility = new Map();
      const methodVisibility = new Map();
      for (const member of classDecl.members || []) {
        if (member.type === 'ClassFieldDecl') {
          fields.add(member.name);
          fieldDecls.push({ name: member.name, dataType: member.dataType });
          fieldVisibility.set(member.name, member.visibility || 'public');
        }
        if (member.type === 'ClassMethodDecl') {
          methods.add(member.name);
          methodVisibility.set(member.name, member.visibility || 'public');
          if (member.isStatic) staticMethods.add(member.name);
        }
      }
      this.classInfo.set(classDecl.name, { fields, fieldDecls, methods, staticMethods, fieldVisibility, methodVisibility });
    }

    this.classesByName = new Map(
      (this.ast.classes || []).map(item => [String(item.name).toLowerCase(), item])
    );

    this.typeDecls = new Map();
    for (const typeDecl of this.ast.types || []) {
      this.typeDecls.set(String(typeDecl.name).toLowerCase(), typeDecl);
    }

    // enumTypes: declared name -> ordered value names. enumValueOwners maps each
    // value name back to its type so bare identifiers can be emitted as PUSH_ENUM.
    this.enumTypes = {};
    this.enumValueOwners = new Map();
    for (const typeDecl of this.ast.types || []) {
      const resolved = this.resolveTypeRef(typeDecl.targetType);
      if (resolved?.kind !== 'enum') continue;
      this.enumTypes[typeDecl.name] = [...(resolved.values || [])];
      if (resolved === typeDecl.targetType) {
        for (const value of resolved.values || []) {
          const key = String(value).toLowerCase();
          if (!this.enumValueOwners.has(key)) {
            this.enumValueOwners.set(key, { typeName: typeDecl.name, valueName: value });
          }
        }
      }
    }

    this.variableTypes = new Map();
    for (const variable of this.ast.variables || []) {
      this.variableTypes.set(String(variable.name).toLowerCase(), variable.dataType);
    }
    const caches = (this.ast.variables || []).filter(variable => this.resolveTypeRef(variable.dataType)?.kind === 'cache');
    if (caches.length && !this.ast.hostServices) throw new Error('Cache declarations require hosted unit variables');
    if (caches.length > 2) throw new Error('Hosted units support at most two caches');
    for (const variable of caches) this.cacheSchema(this.resolveTypeRef(variable.dataType).elementType);

    this.functionReturnTypes = new Map();
    for (const procedure of this.ast.procedures || []) {
      if (procedure.returnType) {
        if (this.resolveTypeRef(procedure.returnType)?.kind === 'cache') throw new Error('Cache handles cannot be returned');
        this.functionReturnTypes.set(String(procedure.name).toLowerCase(), procedure.returnType);
      }
    }
    for (const classDecl of this.ast.classes || []) {
      for (const member of classDecl.members || []) {
        if (member.type === 'ClassMethodDecl' && member.returnType) {
          this.functionReturnTypes.set(`${classDecl.name}.${member.name}`.toLowerCase(), member.returnType);
        }
      }
    }

    // Declared (non-self) parameters, so call sites know which arguments are aggregates.
    this.subprogramParams = new Map();
    for (const procedure of this.ast.procedures || []) {
      this.subprogramParams.set(String(procedure.name).toLowerCase(), procedure.paramDecls || []);
    }
    for (const classDecl of this.ast.classes || []) {
      for (const member of classDecl.members || []) {
        if (member.type !== 'ClassMethodDecl') continue;
        this.subprogramParams.set(`${classDecl.name}.${member.name}`.toLowerCase(), member.parameters || []);
      }
    }
  }

  // Matches each forward-declared class method (`procedure Foo();` with no body)
  // against a top-level `Kind ClassName.MethodName(...) begin ... end;` and
  // splices the implementation's signature/body onto the class-body member, so
  // the rest of codegen never needs to know a method was declared separately.
  spliceMethodImplementations() {
    const implsByKey = new Map();
    for (const impl of this.ast.methodImpls || []) {
      implsByKey.set(`${impl.className}.${impl.name}`.toLowerCase(), impl);
    }
    const consumed = new Set();

    for (const classDecl of this.ast.classes || []) {
      for (const member of classDecl.members || []) {
        if (member.type !== 'ClassMethodDecl') continue;
        const key = `${classDecl.name}.${member.name}`.toLowerCase();
        const impl = implsByKey.get(key);
        if (!member.forward) {
          if (impl) {
            throw new Error(`[PASCALISH-PROGRAM] Method "${classDecl.name}.${member.name}" already has a body and cannot be implemented again`);
          }
          continue;
        }
        if (!impl) {
          throw new Error(`[PASCALISH-PROGRAM] Method "${classDecl.name}.${member.name}" is declared but never implemented`);
        }
        member.parameters = impl.parameters;
        member.localDecls = impl.localDecls;
        member.body = impl.body;
        member.returnType = member.returnType || impl.returnType;
        member.genericParams = (member.genericParams && member.genericParams.length > 0) ? member.genericParams : impl.genericParams;
        member.forward = false;
        consumed.add(key);
      }
    }

    for (const [key] of implsByKey) {
      if (!consumed.has(key)) {
        throw new Error(`[PASCALISH-PROGRAM] Method implementation "${key}" does not match any declared class method`);
      }
    }
  }

  classOfVariable(name) {
    const key = String(name || '').trim().toLowerCase();
    const declared = this.scopeTypes?.get(key) || this.variableTypes.get(key);
    const resolved = this.resolveTypeRef(declared);
    const classId = declared?.kind === 'user'
      ? declared.id
      : resolved?.kind === 'user'
        ? resolved.id
        : declared?.kind === 'queue' && this.classesByName.has('queue')
          ? 'Queue'
          : null;
    if (!classId) return null;
    return this.classesByName.get(String(classId).split('<', 1)[0].toLowerCase()) || null;
  }

  // Walks `extends` links so `protected` members declared on a base class stay
  // reachable from a descendant class's own methods.
  isDescendantOf(childClassName, ancestorClassName) {
    let current = this.classesByName.get(String(childClassName || '').toLowerCase());
    const target = String(ancestorClassName || '').toLowerCase();
    const seen = new Set();
    while (current) {
      const key = String(current.name).toLowerCase();
      if (key === target) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      const parentId = current.extendsType?.id;
      current = parentId ? this.classesByName.get(String(parentId).toLowerCase()) : null;
    }
    return false;
  }

  // `private` members are only reachable from the declaring class's own methods;
  // `protected` also allows access from descendant classes' methods. Suppressed
  // during compiler-generated default initialization, which isn't user-code access.
  assertMemberAccessible(className, memberName, visibility, memberKind) {
    if (this.suppressAccessChecks) return;
    if (!visibility || visibility === 'public') return;
    const accessorClassName = this.currentContext()?.className || null;
    if (visibility === 'private') {
      if (accessorClassName === className) return;
    } else if (visibility === 'protected') {
      if (accessorClassName && this.isDescendantOf(accessorClassName, className)) return;
    }
    throw new Error(`[PASCALISH-PROGRAM] ${visibility} ${memberKind} "${className}.${memberName}" is not accessible here`);
  }

  // Fields arrive as by-value CALL arguments, so mutations inside a method are
  // invisible to the caller unless the updated values are pushed back onto the
  // stack before RET. Pushed in field-declaration order, ahead of any return
  // value, so emitCall can pop them (in reverse) into the receiver's storage.
  emitSelfWriteback() {
    const context = this.methodContext;
    if (!context || context.isStatic) return;
    for (const leaf of context.selfLeafNames || []) this.emit(`LOAD ${leaf}`);
  }

  // Aggregates have no runtime representation: every leaf field becomes its own scalar
  // slot, and parameters, arguments and results are expanded to match. Fixed arrays
  // flatten the same way, one slot per element (`path_0`, `path_1`, ...), which is
  // what makes a compile-time-constant index free but a runtime index need ARR_GET/SET.
  flattenLeaves(path, typeRef) {
    const resolved = this.resolveTypeRef(typeRef);
    if (resolved?.kind === 'record') {
      return (resolved.fields || []).flatMap(field => this.flattenLeaves(`${path}.${field.name}`, field.dataType));
    }
    if (resolved?.kind === 'fixed-array') {
      const [low, high] = this.arrayBounds(resolved);
      const leaves = [];
      for (let i = low; i <= high; i += 1) leaves.push(...this.flattenLeaves(`${path}_${i - low}`, resolved.elementType));
      return leaves;
    }
    return [{ path, dataType: resolved }];
  }

  isAggregateType(typeRef) {
    const kind = this.resolveTypeRef(typeRef)?.kind;
    return kind === 'record' || kind === 'fixed-array';
  }

  // Fixed-array bounds are stored as raw source text; only literal integer bounds
  // are supported (matches the compile-time-constant-index model everywhere else).
  arrayBounds(resolved) {
    const low = parseInt(resolved.low, 10);
    const high = parseInt(resolved.high, 10);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new Error('[PASCALISH-PROGRAM] Array bounds must be literal integers');
    }
    return [low, high];
  }

  storageLeaves(path, typeRef) {
    return this.flattenLeaves(path, typeRef).map(leaf => this.normalizeStorageName(leaf.path));
  }

  // Resolves `basePath` (a plain dotted variable/field path) to its declared
  // fixed-array type, throwing if it isn't one.
  resolveArrayBase(basePath) {
    const resolved = this.resolveTypeRef(this.declaredTypeOf(basePath));
    if (!resolved || resolved.kind !== 'fixed-array') {
      throw new Error(`[PASCALISH-PROGRAM] "${basePath}" is not an array`);
    }
    return resolved;
  }

  // Runtime-indexed array read: pushes a zero-based index, then ARR_GET does the
  // computed-name LOAD (`base_<index>`) with bounds checking at runtime.
  emitArrayIndexLoad(basePath, indexExpr) {
    const resolved = this.resolveArrayBase(basePath);
    const [low, high] = this.arrayBounds(resolved);
    const baseName = this.normalizeStorageName(basePath);
    this.emitExpr(indexExpr);
    if (low !== 0) {
      this.emit(`PUSH_INT ${low}`);
      this.emit('SUB');
    }
    this.emit(`ARR_GET ${baseName} ${high - low + 1}`);
  }

  // Runtime-indexed array write: index first (bottom of stack), then the value
  // (top), so ARR_SET pops value then index in that order.
  emitArrayIndexStore(basePath, indexExpr, valueExpr) {
    const resolved = this.resolveArrayBase(basePath);
    const [low, high] = this.arrayBounds(resolved);
    const baseName = this.normalizeStorageName(basePath);
    this.emitExpr(indexExpr);
    if (low !== 0) {
      this.emit(`PUSH_INT ${low}`);
      this.emit('SUB');
    }
    this.emitExpr(valueExpr);
    this.emit(`ARR_SET ${baseName} ${high - low + 1}`);
  }

  expandParamNames(paramDecls) {
    if ((paramDecls || []).some(item => this.resolveTypeRef(item.dataType)?.kind === 'cache')) {
      throw new Error('Cache handles cannot be passed as parameters');
    }
    return (paramDecls || []).flatMap(item => this.storageLeaves(item.name, item.dataType));
  }

  resultSlots(label, returnType) {
    return this.flattenLeaves('', returnType)
      .map(leaf => `${label}__ret${leaf.path.replace(/\./g, '_')}`);
  }

  nextTempPrefix() {
    this.tempId = (this.tempId || 0) + 1;
    return `__tmp${this.tempId}`;
  }

  /**
   * Leaves an aggregate value in addressable slots and returns their storage names.
   * Identifiers are already addressable; a call's result is copied out of the callee's
   * result slots into fresh temporaries so a later call cannot clobber it.
   */
  materializeAggregate(expr, expectedType) {
    const cache = expr?.type === 'CallExpr' && this.cacheCall(expr.name);
    if (cache) {
      if (cache.method !== 'get') throw new Error('Cache aggregate requires get(key)');
      this.assertCacheType(this.cacheResultType(expr), expectedType);
      return this.emitCacheGet(expr, cache);
    }
    if (expr?.type === 'NewExpr' && expectedType?.kind === 'user') {
      const classDecl = this.classesByName.get(String(expectedType.id || '').toLowerCase());
      if (classDecl) {
        const fields = (classDecl.members || [])
          .filter(member => member.type === 'ClassFieldDecl')
          .flatMap(field => this.storageLeaves(field.name, field.dataType));
        if (fields.length === 0) return [];
        throw new Error(`[PASCALISH-PROGRAM] new ${classDecl.name} with fields requires a constructor call`);
      }
    }
    if (expr?.type === 'IndexedAccess' && expr.index?.type === 'NumberLiteral') {
      const arrayType = this.resolveArrayBase(expr.base);
      const [low, high] = this.arrayBounds(arrayType);
      const index = Number(expr.index.value);
      if (!Number.isInteger(index) || index < low || index > high) {
        throw new Error(`[PASCALISH-PROGRAM] Constant array index ${index} is outside [${low}..${high}]`);
      }
      const elementType = this.resolveTypeRef(arrayType.elementType);
      return this.storageLeaves(`${expr.base}_${index - low}`, elementType);
    }
    if (expr?.type === 'Identifier') {
      const declared = this.declaredTypeOf(expr.name);
      if (declared && this.isAggregateType(declared)) return this.storageLeaves(expr.name, declared);
      if (!declared && expectedType && this.isAggregateType(expectedType)) {
        return this.storageLeaves(expr.name, expectedType);
      }
    }
    if (expr?.type === 'CallExpr') {
      const resolved = this.resolveCallTarget(expr.name);
      const returnType = this.functionReturnTypes.get(resolved.toLowerCase()) || expectedType;
      if (returnType && this.isAggregateType(returnType)) {
        this.emitCall(expr.name, expr.args);
        return this.captureResult(this.lookupProcedureLabel(resolved), returnType);
      }
    }
    if (expr?.type === 'Binary') {
      const operator = this.resolveOperator(expr);
      if (operator) {
        const returnType = this.functionReturnTypes.get(operator.resolvedName.toLowerCase());
        if (returnType && this.isAggregateType(returnType)) {
          this.emitOperatorCall(operator);
          return this.captureResult(this.lookupProcedureLabel(operator.resolvedName), returnType);
        }
      }
    }

    // Widening: the target class declares `operator <ThisClass>(x: <kind>)`.
    const targetClass = expectedType?.kind === 'user'
      ? this.classesByName.get(String(expectedType.id).toLowerCase())
      : null;
    const methodName = `op_from_${this.staticKindOf(expr)}`;
    if (this.hasMethod(targetClass, methodName)) {
      const resolvedName = `${targetClass.name}.${methodName}`;
      const formals = this.subprogramParams.get(resolvedName.toLowerCase()) || [];
      const argc = this.emitArguments(formals, [expr]);
      this.emit(`CALL ${this.lookupProcedureLabel(resolvedName)} ${argc}`);
      return this.captureResult(this.lookupProcedureLabel(resolvedName), expectedType);
    }

    throw new Error(`[PASCALISH-PROGRAM] Expression is not a ${this.describeType(expectedType)} value`);
  }

  // Result slots are shared per subprogram, so copy them out before the next call.
  captureResult(label, returnType) {
    const prefix = this.nextTempPrefix();
    return this.resultSlots(label, returnType).map((slot, index) => {
      const temp = `${prefix}_${index}`;
      this.emit(`LOAD ${slot}`);
      this.emit(`STORE ${temp}`);
      return temp;
    });
  }

  declaredTypeOf(name) {
    const segments = String(name || '').split('.').filter(Boolean);
    if (segments.length === 0) return null;
    let current = this.scopeTypes?.get(segments[0].toLowerCase()) || this.variableTypes.get(segments[0].toLowerCase());
    for (const segment of segments.slice(1)) {
      const resolved = this.resolveTypeRef(current);
      if (resolved?.kind !== 'record') return null;
      const field = (resolved.fields || []).find(item => item.name.toLowerCase() === segment.toLowerCase());
      if (!field) return null;
      current = field.dataType;
    }
    return current || null;
  }

  describeType(typeRef) {
    return typeRef?.id || typeRef?.kind || 'value';
  }

  classOfExpr(expr) {
    if (expr?.type === 'Identifier') {
      const declared = this.declaredTypeOf(expr.name);
      if (declared?.kind === 'user') return this.classesByName.get(String(declared.id).toLowerCase()) || null;
      return null;
    }
    if (expr?.type === 'CallExpr') {
      const returnType = this.functionReturnTypes.get(this.resolveCallTarget(expr.name).toLowerCase());
      if (returnType?.kind === 'user') return this.classesByName.get(String(returnType.id).toLowerCase()) || null;
      return null;
    }
    if (expr?.type === 'Binary') {
      const operator = this.resolveOperator(expr);
      if (!operator) return null;
      const returnType = this.functionReturnTypes.get(operator.resolvedName.toLowerCase());
      if (returnType?.kind === 'user') return this.classesByName.get(String(returnType.id).toLowerCase()) || null;
    }
    return null;
  }

  hasMethod(classDecl, methodName) {
    return Boolean(classDecl) && Boolean(this.classInfo.get(classDecl.name)?.methods.has(methodName));
  }

  // `a + b` becomes a method call on whichever side declares the operator; the other
  // side is converted into that class if it declares a matching conversion.
  resolveOperator(expr) {
    const methodName = BINARY_OPERATOR_METHODS[expr.op];
    if (!methodName) return null;

    const leftClass = this.classOfExpr(expr.left);
    if (this.hasMethod(leftClass, methodName)) {
      return { classDecl: leftClass, methodName, self: expr.left, argument: expr.right, resolvedName: `${leftClass.name}.${methodName}` };
    }
    const rightClass = this.classOfExpr(expr.right);
    if (this.hasMethod(rightClass, methodName)) {
      return { classDecl: rightClass, methodName, self: expr.left, argument: expr.right, resolvedName: `${rightClass.name}.${methodName}` };
    }
    return null;
  }

  emitOperatorCall(operator) {
    const info = this.classInfo.get(operator.classDecl.name);
    const selfType = { type: 'TypeRef', kind: 'user', id: operator.classDecl.name, genericArgs: [] };
    this.suppressAccessChecks = true;
    try {
      for (const slot of this.materializeAggregate(operator.self, selfType)) this.emit(`LOAD ${slot}`);
    } finally {
      this.suppressAccessChecks = false;
    }

    const formals = this.subprogramParams.get(operator.resolvedName.toLowerCase()) || [];
    const argc = info.fieldDecls.length + this.emitArguments(formals, [operator.argument]);
    this.emit(`CALL ${this.lookupProcedureLabel(operator.resolvedName)} ${argc}`);
    return operator.resolvedName;
  }

  // Explicit `real(x)` style narrowing declared as `operator real();` on the class.
  resolveConversionOut(name, args) {
    if ((args || []).length !== 1) return null;
    const classDecl = this.classOfExpr(args[0]);
    const methodName = `op_to_${String(name || '').toLowerCase()}`;
    if (!this.hasMethod(classDecl, methodName)) return null;
    return { classDecl, methodName, resolvedName: `${classDecl.name}.${methodName}` };
  }

  resolveCallTarget(name) {
    const segments = String(name || '').trim().split('.').filter(Boolean);
    if (segments.length === 2) {
      const classDecl = this.classOfVariable(segments[0]);
      const info = classDecl ? this.classInfo.get(classDecl.name) : null;
      const methodName = info
        ? [...info.methods].find(method => method.toLowerCase() === segments[1].toLowerCase())
        : null;
      if (classDecl && methodName) {
        return `${classDecl.name}.${methodName}`;
      }
    }
    return this.normalizeProcedureName(name);
  }

  /**
   * Emits a call and returns the resolved subprogram name. `receiver.method(...)` on a
   * class-typed variable passes the receiver's fields as leading arguments, which is how
   * a method reaches `self` without the runtime having object references.
   */
  cacheSchema(typeRef) {
    const check = (type, depth = 0) => {
      const resolved = this.resolveTypeRef(type);
      if (depth > 32) throw new Error('Cache record type is recursive or too deeply nested');
      if (resolved?.kind === 'record') {
        for (const field of resolved.fields || []) check(field.dataType, depth + 1);
      } else if (resolved?.kind !== 'simple' || !['integer', 'string', 'boolean'].includes(resolved.id?.toLowerCase())) {
        throw new Error('Cache items support integer, string, boolean and records of these types');
      }
    };
    check(typeRef);
    const leaves = this.flattenLeaves('', typeRef);
    if (!leaves.length || leaves.length > 32) throw new Error('Cache items require 1..32 scalar leaves');
    const schema = leaves.map(({ path, dataType }) => {
      if (dataType?.kind !== 'simple' || !['integer', 'string', 'boolean'].includes(dataType.id?.toLowerCase())) {
        throw new Error('Cache items support integer, string, boolean and records of these types');
      }
      return { name: path.replace(/^\./, '') || '__value', type: dataType.id.toLowerCase() };
    });
    if (new Set(schema.map(field => field.name)).size !== schema.length) throw new Error('Duplicate cache item fields');
    return schema;
  }

  cacheCall(name) {
    const [receiver, method, ...rest] = String(name).split('.');
    const type = this.resolveTypeRef(this.declaredTypeOf(receiver));
    if (type?.kind !== 'cache') return null;
    if (!this.ast.hostServices) throw new Error('Cache requires hosted service compilation');
    if (rest.length || !['put', 'get', 'remove', 'next', 'count', 'snapshot'].includes(method?.toLowerCase())) {
      throw new Error(`Unknown cache method: ${name}`);
    }
    if (!this.variableTypes.has(receiver.toLowerCase()) || this.scopeTypes?.has(receiver.toLowerCase())) {
      throw new Error('Cache must be a hosted unit variable');
    }
    return { name: receiver.toLowerCase(), method: method.toLowerCase(), itemType: type.elementType };
  }

  expressionType(expr) {
    if (expr?.type === 'Identifier') return this.declaredTypeOf(expr.name);
    if (expr?.type === 'CallExpr') {
      if (this.cacheCall(expr.name)) return this.cacheResultType(expr);
      const binding = SERVICE_HOST_BINDINGS[String(expr.name).toLowerCase()]
        || (this.ast.deviceBindings && DEVICE_BINDINGS[String(expr.name).toLowerCase()]);
      return this.functionReturnTypes.get(this.resolveCallTarget(expr.name).toLowerCase())
        || (binding ? { kind: 'simple', id: binding.result } : null);
    }
    const literals = { StringLiteral: 'string', NumberLiteral: 'integer', RealLiteral: 'real', BooleanLiteral: 'boolean' };
    if (literals[expr?.type]) return { kind: 'simple', id: literals[expr.type] };
    if (expr?.type === 'Unary') {
      if (expr.op === 'not') return { kind: 'simple', id: 'boolean' };
      const operand = this.resolveTypeRef(this.expressionType(expr.expr));
      return ['integer', 'real'].includes(operand?.id) ? operand : null;
    }
    if (expr?.type === 'Binary') {
      const left = this.expressionType(expr.left), right = this.expressionType(expr.right);
      if (['=', '<>', '<', '<=', '>', '>=', 'and', 'or'].includes(expr.op)) return { kind: 'simple', id: 'boolean' };
      if (left && right && left.id === right.id) return left;
    }
    return null;
  }

  assertCacheType(actual, expected) {
    if (!actual || !expected || this.resolveTypeRef(actual)?.kind !== this.resolveTypeRef(expected)?.kind
      || JSON.stringify(this.cacheSchema(actual)) !== JSON.stringify(this.cacheSchema(expected))) {
      throw new Error('Cache item/result type mismatch');
    }
  }

  cacheResultType(expr) {
    const cache = this.cacheCall(expr.name);
    if (['next', 'snapshot'].includes(cache.method)) return { kind: 'simple', id: 'string' };
    if (cache.method !== 'get') return { kind: 'simple', id: 'integer' };
    let type = cache.itemType;
    for (const name of expr.fields || []) {
      const resolved = this.resolveTypeRef(type);
      const field = resolved?.kind === 'record' && resolved.fields.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!field) throw new Error(`Unknown cache result field: ${name}`);
      type = field.dataType;
    }
    return type;
  }

  validateCacheArgs(args, cache) {
    const arity = cache.method === 'put' ? 3 : cache.method === 'count' ? 0 : cache.method === 'snapshot' ? 2 : 1;
    if ((args || []).length !== arity) throw new Error(`Cache ${cache.method} requires ${arity} arguments`);
    if (arity && this.resolveTypeRef(this.expressionType(args[0]))?.id !== 'string') {
      throw new Error(cache.method === 'next' ? 'Cache cursor must be string' : 'Cache key must be string');
    }
    this.cacheSchema(cache.itemType);
    if (cache.method === 'snapshot' && this.resolveTypeRef(this.expressionType(args[1]))?.id !== 'string') {
      throw new Error('Cache snapshot revision must be string');
    }
    if (cache.method === 'put') {
      this.assertCacheType(this.expressionType(args[1]), cache.itemType);
      if (this.resolveTypeRef(this.expressionType(args[2]))?.id !== 'integer') throw new Error('Cache TTL must be integer milliseconds');
    }
  }

  emitCacheGet(expr, cache) {
    this.validateCacheArgs(expr.args, cache);
    const json = this.nextTempPrefix();
    this.emit(`PUSH_STR "${cache.name}"`);
    this.emitExpr(expr.args[0]);
    this.emit('CALL_EXT host.cache_get 2');
    this.emit(`STORE ${json}`);
    const prefix = this.nextTempPrefix();
    const leaves = this.flattenLeaves(prefix, cache.itemType);
    const schema = this.cacheSchema(cache.itemType);
    leaves.forEach((leaf, index) => {
      this.emit(`LOAD ${json}`);
      this.emit(`PUSH_STR "${schema[index].name}"`);
      this.emit(`CALL_EXT host.json_${schema[index].type === 'string' ? 'text' : 'integer'} 2`);
      this.emit(`STORE ${this.normalizeStorageName(leaf.path)}`);
    });
    let fieldPath = prefix;
    let type = cache.itemType;
    for (const name of expr.fields || []) {
      const field = this.resolveTypeRef(type).fields.find(item => item.name.toLowerCase() === name.toLowerCase());
      fieldPath += `.${field.name}`;
      type = field.dataType;
    }
    return this.storageLeaves(fieldPath, type);
  }

  emitCacheCall(name, args, cache) {
    this.validateCacheArgs(args, cache);
    if (cache.method === 'get') throw new Error('Cache get must be consumed as a typed value');
    this.emit(`PUSH_STR "${cache.name}"`);
    if (cache.method === 'count') {
      this.emit('CALL_EXT host.cache_count 1');
      return name;
    }
    this.emitExpr(args[0]);
    if (cache.method === 'snapshot') this.emitExpr(args[1]);
    if (cache.method === 'put') {
      const json = this.nextTempPrefix();
      const slots = this.isAggregateType(cache.itemType) ? this.materializeAggregate(args[1], cache.itemType) : null;
      this.emit('PUSH_STR "{}"');
      this.emit(`STORE ${json}`);
      this.cacheSchema(cache.itemType).forEach((field, index) => {
        this.emit(`LOAD ${json}`);
        this.emit(`PUSH_STR "${field.name}"`);
        if (slots) this.emit(`LOAD ${slots[index]}`); else this.emitExpr(args[1]);
        this.emit('CALL_EXT host.json_set 3');
        this.emit(`STORE ${json}`);
      });
      this.emit(`LOAD ${json}`);
      this.emitExpr(args[2]);
    }
    this.emit(`CALL_EXT host.cache_${cache.method} ${cache.method === 'put' ? 4 : cache.method === 'snapshot' ? 3 : 2}`);
    return name;
  }

  emitCall(name, args) {
    const cache = this.cacheCall(name);
    if (cache) return this.emitCacheCall(name, args, cache);
    const bindingName = String(name).toLowerCase();
    if (bindingName.startsWith('device.')) {
      if (!this.ast.deviceBindings) throw new Error('[PASCALISH-PROGRAM] Device bindings require deviceBindings compilation');
      const binding = DEVICE_BINDINGS[bindingName];
      if (!binding) throw new Error(`[PASCALISH-PROGRAM] Unknown device binding: ${name}`);
      if ((args || []).length !== binding.arity) throw new Error(`[PASCALISH-PROGRAM] ${name} requires ${binding.arity} arguments`);
      for (let index = 0; index < binding.arity; index += 1) {
        const actual = this.resolveTypeRef(this.expressionType(args[index]));
        if (actual?.id !== binding.args[index]) throw new Error(`[PASCALISH-PROGRAM] ${name} argument ${index + 1} requires ${binding.args[index]}`);
      }
      this.emitArguments(null, args);
      this.emit(`CALL_EXT ${bindingName} ${binding.arity}`);
      return bindingName;
    }
    if (this.ast.hostServices && bindingName.startsWith('host.')) {
      const binding = SERVICE_HOST_BINDINGS[bindingName];
      if (!binding) throw new Error(`[PASCALISH-PROGRAM] Unknown host binding: ${name}`);
      if (SERVICE_HOST_INTERNAL_BINDINGS.has(bindingName)) {
        throw new Error(`[PASCALISH-PROGRAM] ${name} is internal; use typed cache methods`);
      }
      if ((args || []).length !== binding.arity) throw new Error(`[PASCALISH-PROGRAM] ${name} requires ${binding.arity} arguments`);
      this.emitArguments(null, args);
      this.emit(`CALL_EXT ${bindingName} ${binding.arity}`);
      return bindingName;
    }
    const segments = String(name || '').trim().split('.').filter(Boolean);
    let leading = [];
    let resolved = this.normalizeProcedureName(name);
    // Caller-side storage slots to receive the callee's mutated self fields, in
    // field-declaration order (set only for non-static class-method calls).
    let writeBackSlots = null;

    if (segments.length === 2) {
      const classDecl = this.classOfVariable(segments[0]);
      const info = classDecl ? this.classInfo.get(classDecl.name) : null;
      const methodName = info
        ? [...info.methods].find(method => method.toLowerCase() === segments[1].toLowerCase())
        : null;
      if (info && methodName) {
        this.assertMemberAccessible(classDecl.name, methodName, info.methodVisibility.get(methodName), 'method');
        resolved = `${classDecl.name}.${methodName}`;
        this.suppressAccessChecks = true;
        try {
          leading = info.fieldDecls.flatMap(field => this.storageLeaves(`${segments[0]}.${field.name}`, field.dataType));
        } finally {
          this.suppressAccessChecks = false;
        }
        if (!info.staticMethods.has(methodName)) writeBackSlots = leading;
      }
    }

    for (const slot of leading) this.emit(`LOAD ${slot}`);
    const formals = this.subprogramParams.get(resolved.toLowerCase()) || null;
    const argc = leading.length + this.emitArguments(formals, args);
    this.emit(`CALL ${this.lookupProcedureLabel(resolved)} ${argc}`);

    if (writeBackSlots && writeBackSlots.length > 0) {
      // The callee pushed its mutated fields ahead of any real return value, so
      // the return value (if any) is still on top and must be stashed first.
      const returnType = this.functionReturnTypes.get(resolved.toLowerCase());
      const hasStackReturnValue = Boolean(returnType) && !this.isAggregateType(returnType);
      let returnTemp = null;
      if (hasStackReturnValue) {
        returnTemp = this.nextLabel('SELFWB_RET');
        this.emit(`STORE ${returnTemp}`);
      }
      for (const slot of [...writeBackSlots].reverse()) this.emit(`STORE ${slot}`);
      if (returnTemp) this.emit(`LOAD ${returnTemp}`);
    }

    return resolved;
  }

  emitArguments(formals, args) {
    let count = 0;
    (args || []).forEach((argument, index) => {
      const formal = formals ? formals[index] : null;
      if (formal && this.isAggregateType(formal.dataType)) {
        for (const slot of this.materializeAggregate(argument, formal.dataType)) {
          this.emit(`LOAD ${slot}`);
          count += 1;
        }
        return;
      }
      this.emitExpr(argument);
      count += 1;
    });
    return count;
  }

  isFunction(name) {
    const key = String(name || '').trim().toLowerCase();
    if (this.cacheCall(name)) return true;
    return this.functionReturnTypes.has(key) || Boolean(this.ast.hostServices && SERVICE_HOST_BINDINGS[key])
      || Boolean(this.ast.deviceBindings && DEVICE_BINDINGS[key]);
  }

  // Calls are emitted to a label eagerly, so an undeclared target only shows up as a
  // label that was never defined. Catch it here rather than at runtime.
  assertAllCallTargetsDefined() {
    const defined = new Set(
      this.lines.filter(line => line.endsWith(':')).map(line => line.slice(0, -1))
    );
    const missing = [...this.procLabels.entries()]
      .filter(([, label]) => !defined.has(label))
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`[PASCALISH-PROGRAM] Call to undeclared subprogram: ${missing.join(', ')}`);
    }
  }

  // Follows `type A = B` aliases until a structural or simple type is reached.
  resolveTypeRef(typeRef, seen = new Set()) {
    let current = typeRef;
    while (current && current.kind === 'user') {
      const key = String(current.id || '').toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const decl = this.typeDecls.get(key);
      if (!decl) {
        // A class used as a variable type lays out like a record; methods are shared.
        const classDecl = this.classesByName.get(key);
        const info = classDecl ? this.classInfo.get(classDecl.name) : null;
        if (info) return { type: 'TypeRef', kind: 'record', fields: info.fieldDecls, genericArgs: [] };
        return current;
      }
      current = decl.targetType;
    }
    return current || null;
  }

  lookupEnumValue(name) {
    const segments = String(name || '').split('.');
    if (segments.length === 1) return this.enumValueOwners.get(segments[0].toLowerCase()) || null;
    if (segments.length === 2) {
      const typeDecl = this.typeDecls.get(segments[0].toLowerCase());
      const resolved = typeDecl ? this.resolveTypeRef(typeDecl.targetType) : null;
      if (resolved?.kind !== 'enum') return null;
      const valueName = (resolved.values || []).find(v => v.toLowerCase() === segments[1].toLowerCase());
      return valueName ? { typeName: typeDecl.name, valueName } : null;
    }
    return null;
  }

  // Best-effort static kind used to pick PRINT vs PRINT_INT.
  staticKindOf(expr) {
    if (!expr) return 'integer';
    if (expr.type === 'StringLiteral') return 'string';
    if (expr.type === 'RealLiteral') return 'real';
    if (expr.type === 'Identifier') {
      if (this.lookupEnumValue(expr.name)) return 'enum';
      return this.kindOfPath(expr.name);
    }
    if (expr.type === 'IndexedAccess') {
      const resolved = this.resolveTypeRef(this.declaredTypeOf(expr.base));
      return this.kindOfTypeRef(resolved?.elementType);
    }
    if (expr.type === 'Binary') {
      const left = this.staticKindOf(expr.left);
      const right = this.staticKindOf(expr.right);
      if (left === 'string' || right === 'string') return 'string';
      if (left === 'real' || right === 'real') return 'real';
      return 'integer';
    }
    if (expr.type === 'Unary') return this.staticKindOf(expr.expr);
    if (expr.type === 'CallExpr') {
      if (this.cacheCall(expr.name)) return this.kindOfTypeRef(this.cacheResultType(expr));
      if (this.ast.deviceBindings && DEVICE_BINDINGS[String(expr.name).toLowerCase()]) {
        return DEVICE_BINDINGS[String(expr.name).toLowerCase()].result;
      }
      if (this.ast.hostServices && SERVICE_HOST_BINDINGS[String(expr.name).toLowerCase()]) {
        return SERVICE_HOST_BINDINGS[String(expr.name).toLowerCase()].result;
      }
      return this.kindOfTypeRef(this.functionReturnTypes.get(this.resolveCallTarget(expr.name).toLowerCase()));
    }
    return 'integer';
  }

  kindOfTypeRef(typeRef) {
    const resolved = this.resolveTypeRef(typeRef);
    if (!resolved) return 'integer';
    if (resolved.kind === 'enum') return 'enum';
    if (resolved.kind === 'simple') {
      const id = String(resolved.id || '').toLowerCase();
      if (id === 'real') return 'real';
      if (id === 'string') return 'string';
      if (id === 'decimal') return 'decimal';
    }
    return 'integer';
  }

  kindOfPath(name) {
    const segments = String(name || '').split('.').filter(Boolean);
    if (segments.length === 0) return 'integer';
    const head = segments[0].toLowerCase();
    const declared = this.scopeTypes?.get(head) || this.variableTypes.get(head);
    let current = this.resolveTypeRef(declared);
    for (const segment of segments.slice(1)) {
      if (current?.kind !== 'record') return 'integer';
      const field = (current.fields || []).find(f => f.name.toLowerCase() === segment.toLowerCase());
      if (!field) return 'integer';
      current = this.resolveTypeRef(field.dataType);
    }
    return this.kindOfTypeRef(current);
  }

  emit(line) {
    if (line.trim() && !line.startsWith('#') && !line.endsWith(':')) {
      this.sourceMap ||= {};
      if (this.sourceLocation) this.sourceMap[String(this.instructionAddress || 0)] = { ...this.sourceLocation };
      this.instructionAddress = (this.instructionAddress || 0) + 1;
    }
    this.lines.push(line);
  }

  nextLabel(prefix) {
    this.labelId += 1;
    return `${prefix}_${this.labelId}`;
  }

  registerProcedure(name) {
    const label = `PROC_${String(name || '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
    this.procLabels.set(name, label);
    return label;
  }

  lookupProcedureLabel(name) {
    return this.procLabels.get(name) || this.registerProcedure(name);
  }

  currentContext() {
    return this.methodContext || null;
  }

  normalizeStorageName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    const segments = raw.split('.').filter(Boolean);
    if (segments.length === 0) return raw;

    const context = this.currentContext();
    if (context) {
      // Inside a method the receiver's fields arrive as ordinary frame parameters.
      if (segments[0] === 'self') return segments.slice(1).join('_');
      if (context.fields.has(segments[0])) return segments.join('_');
    }

    const topLevelClass = this.classInfo.get(segments[0]);
    if (topLevelClass && segments.length > 1 && topLevelClass.fields.has(segments[1])) {
      return `${segments[0]}__self__${segments.slice(1).join('_')}`;
    }

    if (segments.length > 1) {
      const varClassDecl = this.classOfVariable(segments[0]);
      const info = varClassDecl ? this.classInfo.get(varClassDecl.name) : null;
      if (info?.fields.has(segments[1])) {
        this.assertMemberAccessible(varClassDecl.name, segments[1], info.fieldVisibility.get(segments[1]), 'field');
      }
    }

    return segments.join('_');
  }

  normalizeProcedureName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    const segments = raw.split('.').filter(Boolean);
    const context = this.currentContext();
    if (context) {
      if (segments.length === 1 && context.methods.has(segments[0])) {
        return `${context.className}.${segments[0]}`;
      }
      if (segments[0] === 'self' && segments.length > 1 && context.methods.has(segments[1])) {
        return `${context.className}.${segments[1]}`;
      }
    }

    if (segments.length > 1) {
      const topLevelClass = this.classInfo.get(segments[0]);
      if (topLevelClass && topLevelClass.methods.has(segments[1])) {
        return `${segments[0]}.${segments[1]}`;
      }
    }

    return raw;
  }

  escapeString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  normalizeQueueName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;
    return raw.replace(/__/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '_');
  }

  emitExpr(expr) {
    if (!expr) return;
    if (expr.type === 'NewExpr') {
      const dataType = this.resolveTypeRef(expr.dataType);
      const classDecl = dataType?.kind === 'user'
        ? this.classesByName.get(String(dataType.id || '').toLowerCase())
        : null;
      if (!classDecl) throw new Error(`[PASCALISH-PROGRAM] new ${dataType?.id || 'value'} requires a declared class`);
      const fields = (classDecl.members || []).filter(member => member.type === 'ClassFieldDecl');
      if (fields.length > 0) {
        throw new Error(`[PASCALISH-PROGRAM] new ${classDecl.name} with fields requires a constructor call`);
      }
      // Fieldless classes are opaque presence values in the flattened runtime.
      this.emit('PUSH_INT 1');
      return;
    }
    if (expr.type === 'NumberLiteral') {
      if (this.decimalContext) {
        this.emit(`PUSH_DEC ${expr.raw ?? expr.value} 0`);
        return;
      }
      this.emit(`PUSH_INT ${expr.value}`);
      return;
    }
    if (expr.type === 'RealLiteral') {
      if (this.decimalContext) {
        // Emit the literal's digits verbatim so no float rounding creeps in.
        const [whole, fraction = ''] = String(expr.raw ?? expr.value).split('.');
        this.emit(`PUSH_DEC ${whole}${fraction} ${fraction.length}`);
        return;
      }
      this.emit(`PUSH_REAL ${expr.value}`);
      return;
    }
    if (expr.type === 'BooleanLiteral') {
      this.emit(`PUSH_INT ${expr.value ? 1 : 0}`);
      return;
    }
    if (expr.type === 'StringLiteral') {
      this.emit(`PUSH_STR "${this.escapeString(expr.value)}"`);
      return;
    }
    if (expr.type === 'Identifier') {
      if (this.resolveTypeRef(this.declaredTypeOf(String(expr.name).split('.')[0]))?.kind === 'cache') {
        throw new Error('Cache values require explicit keyed methods');
      }
      const enumValue = this.lookupEnumValue(expr.name);
      if (enumValue) {
        this.emit(`PUSH_ENUM ${enumValue.typeName} ${enumValue.valueName}`);
        return;
      }
      this.emit(`LOAD ${this.normalizeStorageName(expr.name)}`);
      return;
    }
    if (expr.type === 'IndexedAccess') {
      this.emitArrayIndexLoad(expr.base, expr.index);
      return;
    }
    if (expr.type === 'Unary') {
      if (expr.op === '-') {
        this.emit('PUSH_INT 0');
        this.emitExpr(expr.expr);
        this.emit('SUB');
        return;
      }
      if (expr.op === 'not') {
        this.emitExpr(expr.expr);
        this.emit('PUSH_INT 0');
        this.emit('EQ');
        return;
      }
    }
    if (expr.type === 'CallExpr') {
      const cache = this.cacheCall(expr.name);
      if (cache) {
        if (cache.method === 'get') {
          const type = this.cacheResultType(expr);
          if (this.isAggregateType(type)) throw new Error('Assign cache get record to a typed variable or select a field');
          const slots = this.emitCacheGet(expr, cache);
          this.emit(`LOAD ${slots[0]}`);
        } else this.emitCacheCall(expr.name, expr.args, cache);
        return;
      }
      if (String(expr.name || '').toLowerCase() === 'ord' && (expr.args || []).length === 1) {
        this.emitExpr(expr.args[0]);
        this.emit('ORD');
        return;
      }
      if (String(expr.name || '').toLowerCase() === 'decimal' && (expr.args || []).length === 1) {
        const previous = this.decimalContext;
        this.decimalContext = true;
        this.emitExpr(expr.args[0]);
        this.decimalContext = previous;
        this.emit('DEC_CONV');
        return;
      }
      const conversion = this.resolveConversionOut(expr.name, expr.args);
      if (conversion) {
        const selfType = { type: 'TypeRef', kind: 'user', id: conversion.classDecl.name, genericArgs: [] };
        const slots = this.materializeAggregate(expr.args[0], selfType);
        for (const slot of slots) this.emit(`LOAD ${slot}`);
        this.emit(`CALL ${this.lookupProcedureLabel(conversion.resolvedName)} ${slots.length}`);
        return;
      }
      this.emitCall(expr.name, expr.args);
      return;
    }
    if (expr.type === 'Binary') {
      const operator = this.resolveOperator(expr);
      if (operator) {
        this.emitOperatorCall(operator);
        return;
      }
      // String comparisons need STREQ/STRNEQ; EQ coerces operands to numbers.
      const comparesStrings = (expr.op === '=' || expr.op === '<>')
        && (expr.left?.type === 'StringLiteral' || expr.right?.type === 'StringLiteral');
      // `+` is concatenation as soon as one side is known to be a string.
      const concatenates = expr.op === '+'
        && (this.staticKindOf(expr.left) === 'string' || this.staticKindOf(expr.right) === 'string');
      this.emitExpr(expr.left);
      this.emitExpr(expr.right);
      if (comparesStrings) {
        this.emit(expr.op === '=' ? 'STREQ' : 'STRNEQ');
        return;
      }
      if (concatenates) {
        this.emit('CONCAT');
        return;
      }
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
        '>=': 'GE',
        'and': 'AND',
        'or': 'OR'
      };
      const opcode = opMap[expr.op];
      if (!opcode) throw new Error(`[PASCALISH-PROGRAM] Unsupported operator: ${expr.op}`);
      this.emit(opcode);
      return;
    }
    throw new Error(`[PASCALISH-PROGRAM] Unsupported expression node: ${expr.type}`);
  }

  emitStatement(stmt) {
    const previous = this.sourceLocation;
    this.sourceLocation = stmt?.sourceLocation || previous;
    try {
      return this.emitStatementBody(stmt);
    } finally {
      this.sourceLocation = previous;
    }
  }

  emitStatementBody(stmt) {
    if (!stmt) return;
    if (stmt.type === 'Block') {
      for (const entry of stmt.statements || []) this.emitStatement(entry);
      return;
    }
    if (stmt.type === 'Assign') {
      if (stmt.target && typeof stmt.target === 'object' && stmt.target.type === 'IndexedAccess') {
        this.emitArrayIndexStore(stmt.target.base, stmt.target.index, stmt.expr);
        return;
      }
      const targetType = this.declaredTypeOf(stmt.target);
      if (this.resolveTypeRef(targetType)?.kind === 'cache') throw new Error('Cache variables cannot be assigned; use keyed methods');
      if (stmt.expr?.type === 'CallExpr' && this.cacheCall(stmt.expr.name)) {
        this.assertCacheType(this.cacheResultType(stmt.expr), targetType);
      }
      if (targetType && this.isAggregateType(targetType)) {
        const sources = this.materializeAggregate(stmt.expr, targetType);
        const targets = this.storageLeaves(stmt.target, targetType);
        targets.forEach((slot, index) => {
          this.emit(`LOAD ${sources[index]}`);
          this.emit(`STORE ${slot}`);
        });
        return;
      }
      // A decimal receiving field fixes the result scale, as a COBOL PICTURE does.
      const resolved = this.resolveTypeRef(targetType);
      if (this.kindOfTypeRef(targetType) === 'decimal') {
        const previous = this.decimalContext;
        this.decimalContext = true;
        this.emitExpr(stmt.expr);
        this.decimalContext = previous;
        this.emit(`DEC_QUANT ${resolved.scale ?? 0}${stmt.rounded ? ' ROUNDED' : ''}`);
        this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
        return;
      }
      this.emitExpr(stmt.expr);
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      return;
    }
    if (stmt.type === 'Call') {
      const bareName = String(stmt.name || '').toLowerCase();
      if (bareName === 'writeln' || bareName === 'write') {
        for (const argument of stmt.args || []) {
          this.emitExpr(argument);
          // PRINT renders strings, reals and enum names; PRINT_INT is integer-only.
          this.emit(this.staticKindOf(argument) === 'integer' ? 'PRINT_INT' : 'PRINT');
        }
        if (bareName === 'writeln') this.emit('PRINT_NL');
        return;
      }
      const procedureName = this.emitCall(stmt.name, stmt.args);
      // A function used as a statement still leaves its result on the stack.
      if (this.isFunction(procedureName)) this.emit('STORE __discard');
      return;
    }
    if (stmt.type === 'If') {
      const elseLabel = this.nextLabel('ELSE');
      const endLabel = this.nextLabel('ENDIF');
      this.emitExpr(stmt.condition);
      this.emit(`JZ ${elseLabel}`);
      for (const thenStmt of stmt.thenStatements || []) this.emitStatement(thenStmt);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${elseLabel}:`);
      for (const elseStmt of stmt.elseStatements || []) this.emitStatement(elseStmt);
      this.emit(`${endLabel}:`);
      return;
    }
    if (stmt.type === 'While') {
      const startLabel = this.nextLabel('WHILE');
      const endLabel = this.nextLabel('ENDWHILE');
      this.emit(`${startLabel}:`);
      this.emitExpr(stmt.condition);
      this.emit(`JZ ${endLabel}`);
      this.emitStatement(stmt.body);
      this.emit(`JMP ${startLabel}`);
      this.emit(`${endLabel}:`);
      return;
    }
    if (stmt.type === 'For') {
      const loopLabel = this.nextLabel('FOR');
      const endLabel = this.nextLabel('ENDFOR');
      const variableName = stmt.variable.replace(/\./g, '_');
      this.emitExpr(stmt.startExpr);
      this.emit(`STORE ${variableName}`);
      this.emit(`${loopLabel}:`);
      this.emit(`LOAD ${variableName}`);
      this.emitExpr(stmt.endExpr);
      this.emit('LE');
      this.emit(`JZ ${endLabel}`);
      this.emitStatement(stmt.body);
      this.emit(`LOAD ${variableName}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${variableName}`);
      this.emit(`JMP ${loopLabel}`);
      this.emit(`${endLabel}:`);
      return;
    }
    if (stmt.type === 'Repeat') {
      const loopLabel = this.nextLabel('REPEAT');
      this.emit(`${loopLabel}:`);
      for (const entry of stmt.body || []) this.emitStatement(entry);
      this.emitExpr(stmt.untilExpr);
      this.emit(`JZ ${loopLabel}`);
      return;
    }
    if (stmt.type === 'With') {
      // Evaluate the context expression onto the stack, then MSG_WITH_PUSH
      // pops it and installs it as the current dot-path prefix.
      // After the body, MSG_WITH_POP restores the previous prefix.
      this.emitExpr(stmt.contextExpr);
      this.emit('MSG_WITH_PUSH');
      for (const entry of stmt.body || []) this.emitStatement(entry);
      this.emit('MSG_WITH_POP');
      return;
    }
    if (stmt.type === 'Cobegin') {
      for (const entry of stmt.body || []) this.emitStatement(entry);
      return;
    }
    if (stmt.type === 'Async') {
      this.emitStatement(stmt.body);
      return;
    }
    if (stmt.type === 'Subflow') {
      const task = {
        subflowId: stmt.subflowId,
        nodeId: stmt.nodeId,
        timeoutMs: stmt.timeoutMs,
        handleRef: stmt.handleRef
      };
      this.emit(`ORCH_SPAWN "${this.escapeString(JSON.stringify(task))}"`);
      return;
    }
    if (stmt.type === 'SyncService') {
      this.emit(`ORCH_SYNC_SERVICE "${this.escapeString(JSON.stringify({ serviceId: stmt.serviceId, input: stmt.input?.name || '', timeoutMs: stmt.timeoutMs, target: stmt.target }))}"`);
      return;
    }
    if (stmt.type === 'WaitAll') {
      const config = { timeoutMs: stmt.timeoutMs, reason: stmt.reason };
      this.emit(`ORCH_WAIT_ALL "${this.escapeString(JSON.stringify(config))}"`);
      for (let index = 0; index < Math.min(stmt.handles?.length || 0, stmt.targets?.length || 0); index += 1) {
        this.emit(`ORCH_GET_RESULT "${this.escapeString(JSON.stringify({ handleRef: stmt.handles[index], target: stmt.targets[index] }))}"`);
      }
      if (stmt.reason) this.emit(`ORCH_FAIL_TXN "${this.escapeString(stmt.reason)}"`);
      return;
    }
    if (stmt.type === 'ReturnSuccess') {
      this.emit(`ORCH_RETURN_SUCCESS "${this.escapeString(stmt.ref)}"`);
      return;
    }
    if (stmt.type === 'Return') {
      const returnType = this.currentReturnType || null;
      if (returnType && this.isAggregateType(returnType)) {
        const sources = this.materializeAggregate(stmt.expr, returnType);
        this.resultSlots(this.currentReturnLabel, returnType).forEach((slot, index) => {
          this.emit(`LOAD ${sources[index]}`);
          this.emit(`STORE ${slot}`);
        });
        // Aggregate returns go through result slots, not the stack, so self-writeback
        // fields are the only stack values here and must still be pushed before RET.
        this.emitSelfWriteback();
        this.emit('RET');
        return;
      }
      // Self-writeback fields go on the stack first so the return value stays on top.
      this.emitSelfWriteback();
      this.emitExpr(stmt.expr);
      this.emit('RET');
      return;
    }
    if (stmt.type === 'Enqueue') {
      this.emitExpr(stmt.expr);
      this.emit('ROUTE_SET_MESSAGE');
      this.emit(`ROUTE_EMIT "${this.escapeString(this.normalizeQueueName(stmt.queue))}"`);
      return;
    }
    if (stmt.type === 'Dequeue') {
      const queueName = this.normalizeQueueName(stmt.queue);
      const missLabel = this.nextLabel('DEQMISS');
      const endLabel = this.nextLabel('DEQEND');
      this.emit(`ROUTE_MATCH_QUEUE "${this.escapeString(queueName)}"`);
      this.emit(`JZ ${missLabel}`);
      this.emit('ROUTE_GET_MESSAGE');
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${missLabel}:`);
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      this.emit(`${endLabel}:`);
      return;
    }
    if (stmt.type === 'Insert') {
      const table = this.resolveTable(stmt.table, 'insert into');
      const databaseSymbol = this.resolveTableDatabase(table);
      const columns = stmt.columns.length > 0 ? stmt.columns : table.columns.map(column => column.name);
      if (columns.length !== stmt.values.length) {
        throw new Error(`[PASCALISH-PROGRAM] insert into ${table.symbol} has ${columns.length} column(s) but ${stmt.values.length} value(s)`);
      }
      this.assertColumns(table, columns);
      for (const value of stmt.values) this.emitExpr(value);
      this.emit(`DB_INSERT ${this.dbOperand([databaseSymbol, table.symbol, columns.join(',')])}`);
      return;
    }
    if (stmt.type === 'Select') {
      const table = this.resolveTable(stmt.table, 'select from');
      const databaseSymbol = this.resolveTableDatabase(table);
      const columns = stmt.columns.length > 0 ? stmt.columns : table.columns.map(column => column.name);
      this.assertColumns(table, columns);
      if (columns.length !== stmt.targets.length) {
        throw new Error(`[PASCALISH-PROGRAM] select from ${table.symbol} reads ${columns.length} column(s) into ${stmt.targets.length} variable(s)`);
      }
      const where = this.emitWhere(table, stmt.where);
      this.emit(`DB_SELECT ${this.dbOperand([databaseSymbol, table.symbol, columns.join(','), where.column, where.op])}`);
      // Columns are pushed left to right, so store the targets in reverse.
      for (const target of [...stmt.targets].reverse()) {
        this.emit(`STORE ${this.normalizeStorageName(target)}`);
      }
      return;
    }
    if (stmt.type === 'Update') {
      const table = this.resolveTable(stmt.table, 'update');
      const databaseSymbol = this.resolveTableDatabase(table);
      const columns = stmt.assignments.map(item => item.column);
      this.assertColumns(table, columns);
      const where = this.emitWhere(table, stmt.where);
      for (const assignment of stmt.assignments) this.emitExpr(assignment.expr);
      this.emit(`DB_UPDATE ${this.dbOperand([databaseSymbol, table.symbol, columns.join(','), where.column, where.op])}`);
      return;
    }
    if (stmt.type === 'Delete') {
      const table = this.resolveTable(stmt.table, 'delete from');
      const databaseSymbol = this.resolveTableDatabase(table);
      const where = this.emitWhere(table, stmt.where);
      this.emit(`DB_DELETE ${this.dbOperand([databaseSymbol, table.symbol, where.column, where.op])}`);
      return;
    }
    throw new Error(`[PASCALISH-PROGRAM] Unsupported statement node: ${stmt.type}`);
  }

  dbOperand(parts) {
    return parts.map(part => `"${this.escapeString(part)}"`).join(',');
  }

  resolveTable(symbol, action) {
    const table = (this.ast.tables || []).find(item => item.symbol === symbol);
    if (!table) throw new Error(`[PASCALISH-PROGRAM] ${action} undeclared table: ${symbol}`);
    if (table.schemaFromDatabase) {
      throw new Error(`[PASCALISH-PROGRAM] table ${symbol} imports its columns from the database; declare them to use ${action}`);
    }
    return table;
  }

  assertColumns(table, columns) {
    for (const column of columns) {
      if (!table.columns.some(item => item.name === column)) {
        throw new Error(`[PASCALISH-PROGRAM] table ${table.symbol} has no column named ${column}`);
      }
    }
  }

  // Pushes the predicate value so the row filter is a bound parameter, never
  // concatenated into SQL by the host.
  emitWhere(table, where) {
    if (!where) return { column: '', op: '' };
    this.assertColumns(table, [where.column]);
    this.emitExpr(where.expr);
    return { column: where.column, op: where.op };
  }

  // Tables may omit `in <database>` when the unit declares exactly one database.
  resolveTableDatabase(table) {
    const databases = this.ast.databases || [];
    if (table.database) {
      if (!databases.some(item => item.symbol === table.database)) {
        throw new Error(`[PASCALISH-PROGRAM] table ${table.symbol} references undeclared database: ${table.database}`);
      }
      return table.database;
    }
    if (databases.length === 1) return databases[0].symbol;
    throw new Error(`[PASCALISH-PROGRAM] table ${table.symbol} must name its database with "in <database>"`);
  }

  emitRouters() {
    for (const router of this.ast.routers || []) {
      const skipLabel = this.nextLabel('ROUTER_SKIP');
      this.emit(`ROUTE_MATCH_QUEUE "${this.escapeString(router.inputQueue)}"`);
      this.emit(`JZ ${skipLabel}`);
      for (const output of router.outputs || []) {
        const nextLabel = this.nextLabel('OUT_SKIP');
        if (output.whenRule) {
          this.emit(`ROUTE_EVAL_WHEN "${this.escapeString(output.whenRule)}"`);
          this.emit(`JZ ${nextLabel}`);
        }
        if (output.transformRule) {
          const mapCall = String(output.transformRule).match(/^output\s*:=\s*map\(\s*['"]([^'"]+)['"]\s*,\s*src\s*\)\s*;?$/i);
          if (mapCall) {
            this.emit(`ROUTE_MAP_RUN "${this.escapeString(mapCall[1])}"`);
          } else {
            this.emit(`ROUTE_TRANSFORM "${this.escapeString(output.transformRule)}"`);
          }
        }
        this.emit(`ROUTE_EMIT "${this.escapeString(output.queueName)}"`);
        this.emit(`${nextLabel}:`);
      }
      this.emit(`${skipLabel}:`);
    }
  }

  zeroInit(name) {
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${name}`);
  }

  initVariable(variable) {
    this.suppressAccessChecks = true;
    try {
      this.initStorage(variable.name, variable.dataType);
    } finally {
      this.suppressAccessChecks = false;
    }
  }

  // Records have no aggregate slot at runtime: each leaf field gets its own
  // flattened storage name, which must exist before any procedure assigns it.
  initStorage(path, typeRef) {
    const resolved = this.resolveTypeRef(typeRef);
    if (resolved?.kind === 'cache') {
      if (!this.ast.hostServices || !this.variableTypes.has(String(path).toLowerCase())
        || this.scopeTypes?.has(String(path).toLowerCase())) {
        throw new Error('Cache declarations require hosted unit variables');
      }
      this.cacheSchema(resolved.elementType);
      return;
    }
    if (resolved?.kind === 'record') {
      for (const field of resolved.fields || []) this.initStorage(`${path}.${field.name}`, field.dataType);
      return;
    }
    if (resolved?.kind === 'fixed-array') {
      const [low, high] = this.arrayBounds(resolved);
      for (let i = low; i <= high; i += 1) this.initStorage(`${path}_${i - low}`, resolved.elementType);
      return;
    }
    const storageName = this.normalizeStorageName(path);
    if (resolved?.kind === 'enum' && (resolved.values || []).length > 0) {
      const owner = this.enumValueOwners.get(String(resolved.values[0]).toLowerCase());
      if (owner) {
        this.emit(`PUSH_ENUM ${owner.typeName} ${owner.valueName}`);
        this.emit(`STORE ${storageName}`);
        return;
      }
    }
    if (resolved?.kind === 'simple' && String(resolved.id).toLowerCase() === 'string') {
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${storageName}`);
      return;
    }
    if (resolved?.kind === 'simple' && String(resolved.id).toLowerCase() === 'decimal') {
      this.emit(`PUSH_DEC 0 ${resolved.scale ?? 0}`);
      this.emit(`STORE ${storageName}`);
      return;
    }
    this.zeroInit(storageName);
  }

  storageNamesOf(path, typeRef) {
    if (this.resolveTypeRef(typeRef)?.kind === 'cache') return [];
    return this.storageLeaves(path, typeRef);
  }

  build() {
    if (!this.ast.runtimeUnit) {
      throw new Error('[PASCALISH-PROGRAM] Missing top-level runtime declaration (program/service/daemon)');
    }

    const runtimeUnit = this.ast.runtimeUnit;
    const runtimeKind = runtimeUnit.type === 'ProgramDecl'
      ? 'program'
      : runtimeUnit.type === 'ServiceDecl'
        ? 'service'
        : 'daemon';

    let refreshMs = runtimeKind === 'daemon' && runtimeUnit.schedule?.expr?.type === 'NumberLiteral'
      ? runtimeUnit.schedule.expr.value
      : null;
    if (this.ast.hostServices && runtimeKind === 'daemon') {
      const unit = runtimeUnit.schedule?.unit;
      refreshMs = refreshMs == null ? null : refreshMs * (['s', 'second', 'seconds'].includes(unit) ? 1000 : unit === 'm' ? 60000 : 1);
      if (!Number.isSafeInteger(refreshMs) || refreshMs < 10 || refreshMs > 180000) {
        throw new Error('[PASCALISH-PROGRAM] Hosted daemon requires a constant schedule between 10 and 180000 ms');
      }
    }

    this.emit('# Auto-generated from ANTLR Pascalish grammar');
    this.emit('JMP MAIN');

    const procedures = {};
    for (const classDecl of this.ast.classes) {
      const classState = this.classInfo.get(classDecl.name);
      for (const member of classDecl.members) {
        if (member.type !== 'ClassMethodDecl') continue;
        const fullName = `${classDecl.name}.${member.name}`;
        const label = this.registerProcedure(fullName);
        this.emit(`${label}:`);
        this.methodContext = {
          className: classDecl.name,
          fields: classState?.fields || new Set(),
          methods: classState?.methods || new Set(),
          isStatic: Boolean(member.isStatic),
          // Leaf-flattened field names in declaration order; must match the order
          // emitCall reads back on the caller side after CALL returns.
          selfLeafNames: member.isStatic
            ? []
            : (classState?.fieldDecls || []).flatMap(field => this.storageLeaves(field.name, field.dataType))
        };
        this.scopeTypes = new Map();
        if (!member.isStatic) {
          for (const field of classState?.fieldDecls || []) this.scopeTypes.set(field.name.toLowerCase(), field.dataType);
        }
        for (const item of member.parameters || []) this.scopeTypes.set(item.name.toLowerCase(), item.dataType);
        for (const item of member.localDecls || []) this.scopeTypes.set(item.name.toLowerCase(), item.dataType);
        for (const local of member.localDecls || []) this.initVariable(local);
        this.currentReturnType = member.returnType || null;
        this.currentReturnLabel = label;
        this.emitStatement(member.body);
        this.currentReturnType = null;
        this.scopeTypes = null;
        // Fallback for a body that falls through without an explicit `return`.
        this.emitSelfWriteback();
        this.emit('RET');
        this.methodContext = null;
        procedures[label] = {
          name: fullName,
          className: classDecl.name,
          methodName: member.name,
          returnType: member.returnType || null,
          params: [
            ...(member.isStatic ? [] : this.expandParamNames(classState?.fieldDecls || [])),
            ...this.expandParamNames(member.parameters || [])
          ],
          locals: (member.localDecls || []).flatMap(item => this.storageLeaves(item.name, item.dataType)),
          genericParams: member.genericParams || []
        };
      }
    }

    for (const procedure of this.ast.procedures || []) {
      const label = this.registerProcedure(procedure.name);
      this.emit(`${label}:`);
      this.scopeTypes = new Map();
      for (const item of procedure.paramDecls || []) this.scopeTypes.set(item.name.toLowerCase(), item.dataType);
      for (const item of procedure.localDecls || []) this.scopeTypes.set(item.name.toLowerCase(), item.dataType);
      const paramNames = new Set(procedure.params || []);
      for (const local of procedure.localDecls || []) {
        if (!paramNames.has(local.name)) this.initVariable(local);
      }
      this.currentReturnType = procedure.returnType || null;
      this.currentReturnLabel = label;
      this.emitStatement(procedure.body);
      this.currentReturnType = null;
      this.scopeTypes = null;
      this.sourceLocation = procedure.body?.sourceLocation
        ? { ...procedure.body.sourceLocation, sourceLine: procedure.body.sourceLocation.endLine }
        : null;
      this.emit('RET');
      this.sourceLocation = null;
      procedures[label] = {
        name: procedure.name,
        returnType: procedure.returnType || null,
        params: this.expandParamNames(procedure.paramDecls || []),
        locals: (procedure.localDecls || []).flatMap(item => this.storageLeaves(item.name, item.dataType))
      };
    }

    this.emit('MAIN:');
    this.sourceLocation = runtimeUnit.block?.sourceLocation;
    for (const definition of Object.entries(procedures)) {
      const [label, info] = definition;
      if (info.returnType && this.isAggregateType(info.returnType)) {
        for (const slot of this.resultSlots(label, info.returnType)) this.zeroInit(slot);
      }
    }
    for (const variable of this.ast.variables || []) {
      this.initVariable(variable);
    }
    if (this.ast.hostServices && runtimeKind === 'service') {
      for (const endpoint of runtimeUnit.endpoints) {
        const next = this.nextLabel('ENDPOINT_NEXT');
        this.emit('CALL_EXT host.event_method 0');
        this.emit(`PUSH_STR "${this.escapeString(endpoint.verb)}"`);
        this.emit('STREQ');
        this.emit(`JZ ${next}`);
        this.emit('CALL_EXT host.event_path 0');
        this.emit(`PUSH_STR "${this.escapeString(endpoint.path)}"`);
        this.emit('STREQ');
        this.emit(`JZ ${next}`);
        this.emit(`CALL ${this.lookupProcedureLabel(endpoint.handlerName)} 0`);
        this.emit('STORE __service_response');
        this.emit('MAP_RETURN __service_response');
        this.emit('HALT');
        this.emit(`${next}:`);
      }
      this.emit('PUSH_INT 404');
      this.emit('CALL_EXT host.http_status 1');
      this.emit('STORE __discard');
      this.emit('PUSH_STR "{\\"error\\":\\"Service endpoint not found\\"}"');
      this.emit('STORE __service_response');
      this.emit('MAP_RETURN __service_response');
    } else this.emitStatement(runtimeUnit.block);
    this.emitRouters();
    if (this.sourceLocation) this.sourceLocation = { ...this.sourceLocation, sourceLine: this.sourceLocation.endLine };
    this.emit('HALT');
    this.sourceLocation = null;
    this.assertAllCallTargetsDefined();

    const mapperEntries = (this.ast.mappers || []).map(mapper => ({
      kind: 'mapper',
      id: mapper.id,
      scope: mapper.scope === 'local' ? 'local' : 'global',
      ownerServiceId: mapper.ownerServiceId || null,
      sourceTypeId: mapper.sourceTypeId,
      targetTypeId: mapper.targetTypeId,
      items: (mapper.maps || []).map((item) => ({
        ...item,
        ops: item.ops || compileConversionRuleToOps(item.conversionRule)
      }))
    }));

    const mapperRoutines = mapperEntries
      .map((entry) => emitMapperRoutinePcode(entry))
      .filter(Boolean);
    if (mapperRoutines.length > 0) {
      this.lines.push(...mapperRoutines.join('\n').split('\n'));
    }

    const slugifyTypeName = (value) => String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    const typeRegistry = {};
    for (const typeDecl of this.ast.types || []) {
      const resolved = this.resolveTypeRef(typeDecl.targetType);
      const logicalId = String(typeDecl.name || '').trim();
      const canonicalId = `type:${slugifyTypeName(logicalId) || 'unnamed'}`;
      const entry = {
        kind: resolved?.kind || 'unknown',
        name: logicalId,
        logicalId,
        canonicalId,
        aliases: Array.from(new Set([logicalId, logicalId.toLowerCase(), slugifyTypeName(logicalId)])),
        targetType: resolved || null,
        exported: Boolean(typeDecl.exported === true),
        genericParams: typeDecl.genericParams || []
      };
      if (resolved?.kind === 'list' && resolved.elementType) {
        entry.elementType = resolved.elementType;
      }
      typeRegistry[logicalId] = entry;
      typeRegistry[logicalId.toLowerCase()] = entry;
      typeRegistry[canonicalId] = entry;
    }

    const exportedFunctions = (this.ast.procedures || [])
      .filter(proc => proc.exported === true)
      .map(proc => proc.name)
      .concat((this.ast.classes || []).flatMap(classDecl => (classDecl.members || [])
        .filter(member => member.type === 'ClassMethodDecl' && member.exported === true)
        .map(member => `${classDecl.name}.${member.name}`)));

    const systemSymbols = (this.ast.systems || []).map(system => ({
      name: system.name,
      systemId: system.name,
      typeName: system.typeName,
      abstract: system.abstract === true,
      visibility: system.visibility,
      members: system.members || []
    }));
    const systemQueues = systemSymbols.filter(system => !system.abstract).flatMap(system => (system.members || [])
      .filter(member => member.kind === 'queue')
      .map(member => ({
        ...member,
        systemId: system.systemId,
        queueName: `${system.systemId}.${member.queueName}`
      })));
    const systemServices = systemSymbols.filter(system => !system.abstract).flatMap(system => (system.members || [])
      .filter(member => member.kind === 'service')
      .map(member => ({ ...member, systemId: system.systemId })));
    const databaseSymbols = (this.ast.databases || []).map(database => ({
      kind: 'database',
      symbol: database.symbol,
      typeName: database.typeName,
      server: database.server || null,
      schema: database.schema || null,
      catalog: database.catalog || null,
      connection: database.connection || null,
      connectionSecret: database.connectionSecret || null
    }));
    const tableSymbols = (this.ast.tables || []).map(table => ({
      kind: 'table',
      symbol: table.symbol,
      database: this.resolveTableDatabase(table),
      schema: table.schema || null,
      schemaFromDatabase: table.schemaFromDatabase === true,
      rowType: table.rowType,
      columns: table.columns
    }));

    const routerEntries = (this.ast.routers || []).map(router => ({
      kind: 'router',
      id: router.id,
      name: router.id,
      serviceId: runtimeUnit.name,
      inputQueue: router.inputQueue,
      description: router.description || '',
      enabled: router.enabled !== false,
      outputs: (router.outputs || []).map(output => ({
        queueName: output.queueName,
        httpVerb: output.httpVerb || null,
        dataTypeIds: output.dataTypeIds || [],
        dataTypeId: output.dataTypeId || null,
        whenRule: output.whenRule,
        transformRule: output.transformRule
      }))
    }));

    return {
      pcodeText: `${this.lines.join('\n')}\n`,
      programMap: {
        version: 1,
        generatedAt: new Date().toISOString(),
        serviceId: runtimeUnit.name,
        runtimeUnit: {
          kind: runtimeKind,
          id: runtimeUnit.name,
          refreshMs
        },
        executionModel: `pascalish-${runtimeKind}`,
        sourceLanguage: 'pascalish',
        sourceMap: this.sourceMap || {},
        symbols: {
          systems: systemSymbols,
          queues: systemQueues,
          services: systemServices,
          databases: databaseSymbols,
          tables: tableSymbols
        },
        typeRegistry,
        exportedFunctions,
        entries: [...routerEntries, ...mapperEntries],
        localResources: {
          serviceId: runtimeUnit.name || null,
          mappers: (runtimeUnit.localMappers || []).map(item => item.id),
          types: (runtimeUnit.localTypes || []).map(item => item.name),
          libraries: (runtimeUnit.localLibraries || []).map(item => item.id),
          variables: (runtimeUnit.localVariables || []).map(item => item.name),
          publishable: false
        },
        routers: this.ast.routers || [],
        serviceEndpoints: (runtimeUnit.endpoints || []).map(({ body, ...endpoint }) => endpoint),
        ...(this.ast.hostServices ? {
          hostBindingsVersion: SERVICE_HOST_BINDINGS_VERSION, targets: ['js', 'esp32'],
          hostCaches: (this.ast.variables || []).filter(item => this.resolveTypeRef(item.dataType)?.kind === 'cache')
            .map(item => ({ name: item.name.toLowerCase(), capacity: 50,
              fields: this.cacheSchema(this.resolveTypeRef(item.dataType).elementType) }))
        } : {}),
        globals: (() => {
          this.suppressAccessChecks = true;
          try {
            return (this.ast.variables || []).flatMap(item => this.storageNamesOf(item.name, item.dataType));
          } finally {
            this.suppressAccessChecks = false;
          }
        })(),
        variableDeclarations: this.ast.variables,
        enums: this.enumTypes,
        procedures,
        typeDeclarations: this.ast.types,
        classDeclarations: this.ast.classes,
        entryLabel: 'MAIN'
      },
      ir: {
        typeDeclarations: this.ast.types,
        classDeclarations: this.ast.classes,
        methodProcedures: Object.values(procedures)
      },
      ast: this.ast
    };
  }
}

/**
 * Pre-pass: extract  import mapper "<id>" from mapper;  declarations before
 * handing source to ANTLR.  These lines are stripped from the source so the
 * ANTLR grammar sees a clean program, and the imports are returned separately.
 *
 * Syntax variants (case-insensitive):
 *   import mapper "my-map-id" from mapper;
 *   import mapper 'my-map-id' from mapper;
 */
function extractMapperImports(sourceText) {
  const MAPPER_IMPORT_RE = /^\s*import\s+mapper\s+("[^"]*"|'[^']*')\s+from\s+mapper\s*;\s*$/gim;
  const imports = [];
  let match;
  while ((match = MAPPER_IMPORT_RE.exec(sourceText)) !== null) {
    const raw = String(match[1] || '');
    const mapId = raw.replace(/^["']|["']$/g, '').trim();
    if (mapId) {
      imports.push({
        type: 'MapperImport',
        mapId,
      });
    }
  }
  // Strip the import lines so ANTLR does not choke on unknown syntax
  const stripped = sourceText.replace(MAPPER_IMPORT_RE, '');
  return { imports, stripped };
}

export function compilePascalishProgramWithAntlr(sourceText, { fileName = '', hostServices = false, deviceBindings = false } = {}) {
  const { imports: mapperImports, stripped } = extractMapperImports(String(sourceText || ''));

  const input = new antlr4.InputStream(stripped);
  const lexer = new PascalishLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new PascalishParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.compilationUnit();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[PASCALISH-PROGRAM] Parse failed:\n${errors.join('\n')}`);
  }

  const ast = new PascalishProgramAstBuilder(stripped, fileName, hostServices).visit(tree);
  if (deviceBindings) {
    if (hostServices || ast.runtimeUnit?.type !== 'ProgramDecl') {
      throw new Error('[PASCALISH-PROGRAM] Device bindings require a standalone program');
    }
    ast.deviceBindings = true;
  }
  const containsCache = value => value && typeof value === 'object'
    && (value.kind === 'cache' || Object.values(value).some(containsCache));
  if (!hostServices && containsCache(ast)) throw new Error('Cache declarations require hosted unit variables');
  if (hostServices) {
    if (!['ServiceDecl', 'DaemonDecl'].includes(ast.runtimeUnit?.type)
      || (ast.runtimeUnit.type === 'ServiceDecl' && !ast.runtimeUnit.endpoints.length)) {
      throw new Error('[PASCALISH-PROGRAM] Hosted execution requires a service with endpoints or a scheduled daemon');
    }
    ast.hostServices = true;
    const keys = new Set();
    for (const [index, endpoint] of (ast.runtimeUnit.endpoints || []).entries()) {
      const key = `${endpoint.verb} ${endpoint.path}`;
      if (keys.has(key)) throw new Error(`[PASCALISH-PROGRAM] Duplicate endpoint: ${key}`);
      keys.add(key);
      endpoint.handlerName = `__service_endpoint_${index}`;
      ast.procedures.push({
        type: 'SubprogramDecl', name: endpoint.handlerName, params: [], paramDecls: [], localDecls: [],
        returnType: { type: 'TypeRef', kind: 'simple', id: 'string' }, body: endpoint.body
      });
    }
  }
  const linkedLibraries = linkLibraries(ast);
  const result = new Codegen(ast).build();

  if (hostServices) {
    const calls = result.pcodeText.split(/\r?\n/)
      .map(line => /^CALL_EXT\s+(\S+)/.exec(line)?.[1]);
    const capabilities = [...new Set(calls
      .map(name => SERVICE_HOST_BINDINGS[name]?.capability).filter(Boolean))].sort();
    if (capabilities.length) {
      result.programMap.hostCapabilitiesVersion = HOST_CAPABILITIES_VERSION;
      result.programMap.requiredHostCapabilities = capabilities;
      result.programMap.targets = ['js'];
    }
    if (calls.includes('host.capabilities')) result.programMap.targets = ['js'];
    if (calls.some(name => SERVICE_HOST_BINDINGS[name]?.desktopOnly)) result.programMap.targets = ['js'];
  }
  result.programMap.libraries = linkedLibraries;
  if (deviceBindings) result.programMap.deviceBindingsVersion = DEVICE_BINDINGS_VERSION;
  // Attach mapper imports to the program map
  result.programMap.mapperImports = mapperImports;
  result.programMap.librarianImports = ast.librarianImports;

  return result;
}

function parsePascalishAst(sourceText) {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new PascalishLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new PascalishParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.compilationUnit();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[PASCALISH-PROGRAM] Parse failed:\n${errors.join('\n')}`);
  }

  return new PascalishProgramAstBuilder().visit(tree);
}

/**
 * Resolves `use "<id>";` / `library "<id>" from librarian;` declarations and merges each
 * library's types, globals and subprograms into the front of the compiling unit, so user
 * code can reference them. Returns the ordered list of linked library ids.
 */
function linkLibraries(ast) {
  const linked = [];
  const seen = new Set();
  const declarations = [...(ast.libraries || [])];

  // `FROM LIBRARIAN` names a remote unit resolved by the Code Librarian, not a local
  // native library, so it is recorded as metadata and never linked from disk.
  const librarianHosted = new Set(
    declarations
      .filter(item => String(item?.source || '').toLowerCase() === 'librarian')
      .map(item => String(item.id).toLowerCase())
  );

  const pending = declarations.map(item => String(item?.id || '').trim());

  const declaredTypes = new Set((ast.types || []).map(item => String(item.name).toLowerCase()));
  const declaredProcedures = new Set((ast.procedures || []).map(item => String(item.name).toLowerCase()));
  const declaredVariables = new Set((ast.variables || []).map(item => String(item.name).toLowerCase()));

  while (pending.length > 0) {
    const id = String(pending.shift() || '').trim();
    const key = id.toLowerCase();
    if (!id || seen.has(key) || librarianHosted.has(key)) continue;
    seen.add(key);

    const library = resolveLibrary(id);
    const libraryAst = parsePascalishAst(library.sourceText);

    // Depth-first so a library's own dependencies are linked ahead of it.
    for (const nested of libraryAst.libraries || []) pending.push(String(nested?.id || '').trim());

    for (const typeDecl of libraryAst.types || []) {
      const name = String(typeDecl.name).toLowerCase();
      if (declaredTypes.has(name)) {
        throw new Error(`[PASCALISH-PROGRAM] Library "${id}" type ${typeDecl.name} collides with a declaration in the program`);
      }
      declaredTypes.add(name);
      ast.types.unshift(typeDecl);
    }
    for (const classDecl of libraryAst.classes || []) {
      const name = String(classDecl.name).toLowerCase();
      if (declaredTypes.has(name)) {
        throw new Error(`[PASCALISH-PROGRAM] Library "${id}" class ${classDecl.name} collides with a declaration in the program`);
      }
      declaredTypes.add(name);
      ast.classes.unshift(classDecl);
    }
    for (const variable of libraryAst.variables || []) {
      const name = String(variable.name).toLowerCase();
      if (declaredVariables.has(name)) {
        throw new Error(`[PASCALISH-PROGRAM] Library "${id}" variable ${variable.name} collides with a declaration in the program`);
      }
      declaredVariables.add(name);
      ast.variables.unshift(variable);
    }
    for (const procedure of libraryAst.procedures || []) {
      const name = String(procedure.name).toLowerCase();
      if (declaredProcedures.has(name)) {
        throw new Error(`[PASCALISH-PROGRAM] Library "${id}" subprogram ${procedure.name} collides with a declaration in the program`);
      }
      declaredProcedures.add(name);
      ast.procedures.unshift(procedure);
    }

    linked.push(library.id);
  }

  return linked;
}

function parseArgs(argv) {
  const args = {
    in: './data/hello-world.pas',
    out: '../pcode/pascalish-program.pcode',
    mapOut: '../pcode/pascalish-program.program.json'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--in') args.in = argv[index + 1];
    if (token === '--out') args.out = argv[index + 1];
    if (token === '--map-out') args.mapOut = argv[index + 1];
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);

  const source = await fs.readFile(inPath, 'utf-8');
  const compiled = compilePascalishProgramWithAntlr(source);
  const signedProgramMap = attachPcodeSignature(compiled.programMap, compiled.pcodeText);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });

  await fs.writeFile(outPath, compiled.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(signedProgramMap, null, 2)}\n`, 'utf-8');

  console.log(`[PASCALISH-PROGRAM] Input: ${path.relative(process.cwd(), inPath)}`);
  console.log(`[PASCALISH-PROGRAM] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[PASCALISH-PROGRAM] Output (program map): ${path.relative(process.cwd(), mapOutPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[PASCALISH-PROGRAM] Failed:', err.message);
    process.exitCode = 1;
  });
}
