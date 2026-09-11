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
  const visited = decls.map(item => visitor.visit(item)).filter(Boolean);
  return {
    globals: visited.filter(d => d.type === 'VarSection').flatMap(d => d.vars),
    procedures: visited.filter(d => d.type === 'SubprogramDecl'),
    mappers: visited.filter(d => d.type === 'MapperDecl'),
    routers: visited.filter(d => d.type === 'RouterDecl'),
    types: visited.filter(d => d.type === 'TypeDecl'),
    classes: visited.filter(d => d.type === 'ClassDecl'),
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
  visitCompilationUnit(ctx) {
    const ast = {
      type: 'CompilationUnit',
      runtimeUnit: null,
      variables: [],
      types: [],
      classes: [],
      procedures: [],
      mappers: [],
      routers: [],
      libraries: []
    };

    for (const decl of ctx.decl() || []) {
      const value = this.visit(decl);
      if (!value) continue;
      if (value.type === 'ProgramDecl' || value.type === 'ServiceDecl' || value.type === 'DaemonDecl') {
        ast.runtimeUnit = value;
        if (value.syntheticRouter) ast.routers.push(value.syntheticRouter);
        for (const variable of value.unit?.globals || []) ast.variables.push(variable);
        for (const procedure of value.unit?.procedures || []) ast.procedures.push(procedure);
        for (const mapper of value.unit?.mappers || []) ast.mappers.push(mapper);
        for (const router of value.unit?.routers || []) ast.routers.push(router);
        for (const typeDecl of value.unit?.types || []) ast.types.push(typeDecl);
        for (const classDecl of value.unit?.classes || []) ast.classes.push(classDecl);
        for (const library of value.unit?.libraries || []) ast.libraries.push(library);
      }
      if (value.type === 'VarDecl') ast.variables.push(value);
      if (value.type === 'TypeDecl') ast.types.push(value);
      if (value.type === 'ClassDecl') ast.classes.push(value);
      if (value.type === 'MapperDecl') ast.mappers.push(value);
      if (value.type === 'RouterDecl') ast.routers.push(value);
      if (value.type === 'LibraryDecl' || value.type === 'UseDecl') ast.libraries.push(value);
      if (value.type === 'ServiceDecl') {
        for (const mapper of value.localMappers || []) ast.mappers.push(mapper);
        for (const router of value.gatewayRouters || []) ast.routers.push(router);
      }
    }

    return ast;
  }

  visitDecl(ctx) {
    if (ctx.programDecl()) return this.visit(ctx.programDecl());
    if (ctx.serviceDecl()) return this.visit(ctx.serviceDecl());
    if (ctx.daemonDecl()) return this.visit(ctx.daemonDecl());
    if (ctx.varDecl()) return this.visit(ctx.varDecl());
    if (ctx.typeDecl()) return this.visit(ctx.typeDecl());
    if (ctx.classDecl()) return this.visit(ctx.classDecl());
    if (ctx.routerDecl()) return this.visit(ctx.routerDecl());
    if (ctx.mapperDecl()) return this.visit(ctx.mapperDecl());
    if (ctx.libraryDecl()) return this.visit(ctx.libraryDecl());
    if (ctx.useDecl()) return this.visit(ctx.useDecl());
    return null;
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
    return {
      queueName: unquote(text(ctx.stringValue())),
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

    if (endpoints.length > 0) {
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
        if (decl) localDecls.push(decl);
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
    if (ctx.mapperDecl()) return this.visit(ctx.mapperDecl());
    if (ctx.typeDecl()) return this.visit(ctx.typeDecl());
    if (ctx.libraryDecl()) return this.visit(ctx.libraryDecl());
    if (ctx.varDecl()) return this.visit(ctx.varDecl());
    return null;
  }

  visitLibraryDecl(ctx) {
    return {
      type: 'LibraryDecl',
      id: unquote(text(ctx.stringOrIdent())),
      source: unquote(text(ctx.librarySource()))
    };
  }

  visitServiceEndpoint(ctx) {
    const returnExpr = extractReturnExpr(originalText(ctx.blockStmt()));
    return {
      verb: text(ctx.httpVerb()).toUpperCase(),
      path: unquote(text(ctx.stringValue())),
      acceptsType: ctx.endpointAccepts() ? text(ctx.endpointAccepts().typeRef()) : '',
      returnsType: ctx.endpointReturns() ? text(ctx.endpointReturns().typeRef()) : '',
      returnExpr
    };
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
    return {
      type: 'TypeDecl',
      name: ctx.IDENT().getText(),
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      targetType: this.visit(ctx.typeRef())
    };
  }

  visitClassDecl(ctx) {
    return {
      type: 'ClassDecl',
      name: ctx.IDENT().getText(),
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      extendsType: ctx.classInheritance() ? this.visit(ctx.classInheritance()) : null,
      members: (ctx.classMember() || []).map(member => this.visit(member)).filter(Boolean)
    };
  }

  visitClassInheritance(ctx) {
    return this.visit(ctx.typeRef());
  }

  visitClassMember(ctx) {
    if (ctx.classFieldDecl()) return this.visit(ctx.classFieldDecl());
    if (ctx.classMethodDecl()) return this.visit(ctx.classMethodDecl());
    return null;
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
    const localDecls = (ctx.unitDecl() || [])
      .map(item => this.visit(item))
      .filter(item => item?.type === 'VarSection')
      .flatMap(item => item.vars);

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
    const name = ctx.IDENT() ? ctx.IDENT().getText() : '';
    const returnType = ctx.typeRef() ? this.visit(ctx.typeRef()) : null;
    const localDecls = (ctx.unitDecl() || [])
      .map(item => this.visit(item))
      .filter(item => item?.type === 'VarSection')
      .flatMap(item => item.vars);

    const previousFunction = this.currentFunction || null;
    this.currentFunction = returnType ? name : null;
    const body = this.visit(ctx.block());
    this.currentFunction = previousFunction;

    return {
      type: 'ClassMethodDecl',
      methodKind: text(ctx.getChild(0)).toLowerCase(),
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
    if (ctx.recordType()) return this.visit(ctx.recordType());
    if (ctx.enumType && ctx.enumType()) return this.visit(ctx.enumType());
    if (ctx.queueType()) return this.visit(ctx.queueType());
    if (ctx.stackType()) return this.visit(ctx.stackType());
    if (ctx.priorityQueueType()) return this.visit(ctx.priorityQueueType());
    if (ctx.fixedArrayType()) return this.visit(ctx.fixedArrayType());
    if (ctx.dynamicArrayType()) return this.visit(ctx.dynamicArrayType());
    if (ctx.userType()) return this.visit(ctx.userType());
    return { type: 'TypeRef', kind: 'unknown', id: 'unknown', genericArgs: [] };
  }

  visitGenericTypeParams(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText());
  }

  visitSimpleType(ctx) {
    const decimalCtx = ctx.decimalType && ctx.decimalType();
    if (decimalCtx) {
      const numbers = (decimalCtx.NUMBER() || []).map(token => Number.parseInt(token.getText(), 10));
      return {
        type: 'TypeRef',
        kind: 'simple',
        id: 'decimal',
        precision: Number.isFinite(numbers[0]) ? numbers[0] : 18,
        scale: Number.isFinite(numbers[1]) ? numbers[1] : 0,
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
    if (ctx.varSection()) return this.visit(ctx.varSection());
    if (ctx.subprogramDecl()) return this.visit(ctx.subprogramDecl());
    if (ctx.typeDecl()) return this.visit(ctx.typeDecl());
    if (ctx.classDecl()) return this.visit(ctx.classDecl());
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
      rounded: text(ctx).toLowerCase().endsWith('rounded'),
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
    return (ctx.IDENT() || []).map(token => token.getText()).join('.');
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
    if (ctx.qualifiedName() && text(ctx.getChild(1)) === '(') {
      return {
        type: 'CallExpr',
        name: this.visit(ctx.qualifiedName()),
        args: ctx.exprList() ? this.visit(ctx.exprList()) : []
      };
    }
    if (ctx.simpleType && ctx.simpleType()) {
      return {
        type: 'CallExpr',
        name: text(ctx.simpleType()),
        args: ctx.exprList() ? this.visit(ctx.exprList()) : []
      };
    }
    if (ctx.lvalue()) {
      return { type: 'Identifier', name: this.visit(ctx.lvalue()) };
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

    for (const classDecl of this.ast.classes || []) {
      const fields = new Set();
      const methods = new Set();
      const staticMethods = new Set();
      const fieldDecls = [];
      for (const member of classDecl.members || []) {
        if (member.type === 'ClassFieldDecl') {
          fields.add(member.name);
          fieldDecls.push({ name: member.name, dataType: member.dataType });
        }
        if (member.type === 'ClassMethodDecl') {
          methods.add(member.name);
          if (member.isStatic) staticMethods.add(member.name);
        }
      }
      this.classInfo.set(classDecl.name, { fields, fieldDecls, methods, staticMethods });
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

    this.functionReturnTypes = new Map();
    for (const procedure of this.ast.procedures || []) {
      if (procedure.returnType) {
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

  classOfVariable(name) {
    const key = String(name || '').trim().toLowerCase();
    const declared = this.scopeTypes?.get(key) || this.variableTypes.get(key);
    if (declared?.kind !== 'user') return null;
    return this.classesByName.get(String(declared.id).toLowerCase()) || null;
  }

  // Aggregates have no runtime representation: every leaf field becomes its own scalar
  // slot, and parameters, arguments and results are expanded to match.
  flattenLeaves(path, typeRef) {
    const resolved = this.resolveTypeRef(typeRef);
    if (resolved?.kind === 'record') {
      return (resolved.fields || []).flatMap(field => this.flattenLeaves(`${path}.${field.name}`, field.dataType));
    }
    return [{ path, dataType: resolved }];
  }

  isAggregateType(typeRef) {
    return this.resolveTypeRef(typeRef)?.kind === 'record';
  }

  storageLeaves(path, typeRef) {
    return this.flattenLeaves(path, typeRef).map(leaf => this.normalizeStorageName(leaf.path));
  }

  expandParamNames(paramDecls) {
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
    if (expr?.type === 'Identifier') {
      const declared = this.declaredTypeOf(expr.name);
      if (declared && this.isAggregateType(declared)) return this.storageLeaves(expr.name, declared);
    }
    if (expr?.type === 'CallExpr') {
      const resolved = this.resolveCallTarget(expr.name);
      const returnType = this.functionReturnTypes.get(resolved.toLowerCase());
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
    for (const slot of this.materializeAggregate(operator.self, selfType)) this.emit(`LOAD ${slot}`);

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
      if (classDecl && this.classInfo.get(classDecl.name)?.methods.has(segments[1])) {
        return `${classDecl.name}.${segments[1]}`;
      }
    }
    return this.normalizeProcedureName(name);
  }

  /**
   * Emits a call and returns the resolved subprogram name. `receiver.method(...)` on a
   * class-typed variable passes the receiver's fields as leading arguments, which is how
   * a method reaches `self` without the runtime having object references.
   */
  emitCall(name, args) {
    const segments = String(name || '').trim().split('.').filter(Boolean);
    let leading = [];
    let resolved = this.normalizeProcedureName(name);

    if (segments.length === 2) {
      const classDecl = this.classOfVariable(segments[0]);
      const info = classDecl ? this.classInfo.get(classDecl.name) : null;
      if (info?.methods.has(segments[1])) {
        resolved = `${classDecl.name}.${segments[1]}`;
        leading = info.fieldDecls.flatMap(field => this.storageLeaves(`${segments[0]}.${field.name}`, field.dataType));
      }
    }

    for (const slot of leading) this.emit(`LOAD ${slot}`);
    const formals = this.subprogramParams.get(resolved.toLowerCase()) || null;
    const argc = leading.length + this.emitArguments(formals, args);
    this.emit(`CALL ${this.lookupProcedureLabel(resolved)} ${argc}`);
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
    return this.functionReturnTypes.has(String(name || '').trim().toLowerCase());
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
    if (expr.type === 'Binary') {
      const left = this.staticKindOf(expr.left);
      const right = this.staticKindOf(expr.right);
      if (left === 'string' || right === 'string') return 'string';
      if (left === 'real' || right === 'real') return 'real';
      return 'integer';
    }
    if (expr.type === 'Unary') return this.staticKindOf(expr.expr);
    if (expr.type === 'CallExpr') {
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
      const enumValue = this.lookupEnumValue(expr.name);
      if (enumValue) {
        this.emit(`PUSH_ENUM ${enumValue.typeName} ${enumValue.valueName}`);
        return;
      }
      this.emit(`LOAD ${this.normalizeStorageName(expr.name)}`);
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
    if (!stmt) return;
    if (stmt.type === 'Block') {
      for (const entry of stmt.statements || []) this.emitStatement(entry);
      return;
    }
    if (stmt.type === 'Assign') {
      const targetType = this.declaredTypeOf(stmt.target);
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
    if (stmt.type === 'WaitAll') {
      const config = { timeoutMs: stmt.timeoutMs, reason: stmt.reason };
      this.emit(`ORCH_WAIT_ALL "${this.escapeString(JSON.stringify(config))}"`);
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
        this.emit('RET');
        return;
      }
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
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${missLabel}:`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      this.emit(`${endLabel}:`);
      return;
    }
    throw new Error(`[PASCALISH-PROGRAM] Unsupported statement node: ${stmt.type}`);
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
    this.initStorage(variable.name, variable.dataType);
  }

  // Records have no aggregate slot at runtime: each leaf field gets its own
  // flattened storage name, which must exist before any procedure assigns it.
  initStorage(path, typeRef) {
    const resolved = this.resolveTypeRef(typeRef);
    if (resolved?.kind === 'record') {
      for (const field of resolved.fields || []) this.initStorage(`${path}.${field.name}`, field.dataType);
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

    const refreshMs = runtimeKind === 'daemon' && runtimeUnit.schedule?.expr?.type === 'NumberLiteral'
      ? runtimeUnit.schedule.expr.value
      : null;

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
          methods: classState?.methods || new Set()
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
        this.methodContext = null;
        this.emit('RET');
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
      this.emit('RET');
      procedures[label] = {
        name: procedure.name,
        returnType: procedure.returnType || null,
        params: this.expandParamNames(procedure.paramDecls || []),
        locals: (procedure.localDecls || []).flatMap(item => this.storageLeaves(item.name, item.dataType))
      };
    }

    this.emit('MAIN:');
    for (const definition of Object.entries(procedures)) {
      const [label, info] = definition;
      if (info.returnType && this.isAggregateType(info.returnType)) {
        for (const slot of this.resultSlots(label, info.returnType)) this.zeroInit(slot);
      }
    }
    for (const variable of this.ast.variables || []) {
      this.initVariable(variable);
    }
    this.emitStatement(runtimeUnit.block);
    this.emitRouters();
    this.emit('HALT');
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
        serviceEndpoints: runtimeUnit.endpoints || [],
        globals: (this.ast.variables || []).flatMap(item => this.storageNamesOf(item.name, item.dataType)),
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

export function compilePascalishProgramWithAntlr(sourceText) {
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

  const ast = new PascalishProgramAstBuilder().visit(tree);
  const linkedLibraries = linkLibraries(ast);
  const result = new Codegen(ast).build();

  result.programMap.libraries = linkedLibraries;
  // Attach mapper imports to the program map
  result.programMap.mapperImports = mapperImports;

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
