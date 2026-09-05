import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import antlr4 from 'antlr4';
import PascalishLexer from '../grammar/generated-modern/PascalishLexer.js';
import PascalishParser from '../grammar/generated-modern/PascalishParser.js';
import PascalishVisitor from '../grammar/generated-modern/PascalishVisitor.js';
import { attachPcodeSignature } from './pcode-signing.mjs';

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

function pl0SnippetText(ctx) {
  if (!ctx) return '';
  if (ctx.STRING && ctx.STRING()) return unquote(ctx.STRING().getText());
  return originalText(ctx);
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
    libraries: visited.filter(d => d.type === 'LibraryDecl')
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
      routers: []
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
      }
      if (value.type === 'VarDecl') ast.variables.push(value);
      if (value.type === 'TypeDecl') ast.types.push(value);
      if (value.type === 'ClassDecl') ast.classes.push(value);
      if (value.type === 'MapperDecl') ast.mappers.push(value);
      if (value.type === 'RouterDecl') ast.routers.push(value);
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
    return null;
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
            whenRule: 'output := 1;',
            transformRule: 'output := src;'
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
    return {
      type: 'RouteMessage',
      fromQueue: unquote(text(endpoints[0])),
      toQueue: unquote(text(endpoints[1]))
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

  visitClassMethodDecl(ctx) {
    return {
      type: 'ClassMethodDecl',
      methodKind: text(ctx.getChild(0)).toLowerCase(),
      name: ctx.IDENT() ? ctx.IDENT().getText() : '',
      genericParams: ctx.genericTypeParams() ? this.visit(ctx.genericTypeParams()) : [],
      parameters: ctx.methodParamList() ? this.visit(ctx.methodParamList()) : [],
      returnType: ctx.typeRef() ? this.visit(ctx.typeRef()) : null,
      body: this.visit(ctx.block())
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
    const locals = inner
      .filter(item => item.type === 'VarSection')
      .flatMap(item => item.vars.map(v => v.name));
    return {
      type: 'SubprogramDecl',
      kind: text(ctx.getChild(0)).toLowerCase(),
      name: ctx.IDENT().getText(),
      params: ctx.paramSection() ? this.visit(ctx.paramSection()) : [],
      locals,
      body: this.visit(ctx.block())
    };
  }

  visitParamSection(ctx) {
    return (ctx.paramGroup() || []).flatMap(group => this.visit(group));
  }

  visitParamGroup(ctx) {
    return this.visit(ctx.identList());
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
        ? { type: 'RealLiteral', value: Number.parseFloat(raw) }
        : { type: 'NumberLiteral', value: Number.parseInt(raw, 10) };
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
    this.typeRegistry = new Map(); // User-defined type aliases

    // Build type registry from type declarations (compile-time type aliasing)
    for (const typeDecl of this.ast.types || []) {
      // typeDecl = { type: 'TypeDecl', name: string, alias: TypeRef }
      this.typeRegistry.set(String(typeDecl.name || '').toLowerCase(), typeDecl.alias);
    }

    for (const classDecl of this.ast.classes || []) {
      const fields = new Set();
      const methods = new Set();
      for (const member of classDecl.members || []) {
        if (member.type === 'ClassFieldDecl') fields.add(member.name);
        if (member.type === 'ClassMethodDecl') methods.add(member.name);
      }
      this.classInfo.set(classDecl.name, { fields, methods });
    }
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

  /**
   * Resolve a type reference by following user-defined type aliases.
   * User-defined types are erased at compile time - this method follows chains
   * of type aliases and returns the underlying base type.
   * @param {object} typeRef - TypeRef AST node
   * @returns {object} - Resolved TypeRef (base type)
   */
  resolveType(typeRef) {
    if (!typeRef) return typeRef;
    
    // If it's a userType with a single identifier, check the type registry
    if (typeRef.type === 'TypeRef' && typeRef.kind === 'userType' && typeRef.id) {
      const key = String(typeRef.id).toLowerCase();
      const aliasedType = this.typeRegistry.get(key);
      if (aliasedType) {
        // Recursively resolve to handle chains like type A = B; type B = integer;
        return this.resolveType(aliasedType);
      }
    }
    
    return typeRef;
  }

  normalizeStorageName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    const segments = raw.split('.').filter(Boolean);
    if (segments.length === 0) return raw;

    const context = this.currentContext();
    if (context) {
      if (segments[0] === 'self') {
        return `${context.className}__self__${segments.slice(1).join('_')}`;
      }
      if (context.fields.has(segments[0])) {
        return `${context.className}__self__${segments.join('_')}`;
      }
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
      this.emit(`PUSH_INT ${expr.value}`);
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
      for (const argument of expr.args || []) this.emitExpr(argument);
      this.emit(`CALL ${this.lookupProcedureLabel(this.normalizeProcedureName(expr.name))} ${(expr.args || []).length}`);
      return;
    }
    if (expr.type === 'Binary') {
      // String comparisons need STREQ/STRNEQ; EQ coerces operands to numbers.
      const comparesStrings = (expr.op === '=' || expr.op === '<>')
        && (expr.left?.type === 'StringLiteral' || expr.right?.type === 'StringLiteral');
      this.emitExpr(expr.left);
      this.emitExpr(expr.right);
      if (comparesStrings) {
        this.emit(expr.op === '=' ? 'STREQ' : 'STRNEQ');
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
      this.emitExpr(stmt.expr);
      this.emit(`STORE ${this.normalizeStorageName(stmt.target)}`);
      return;
    }
    if (stmt.type === 'Call') {
      const bareName = String(stmt.name || '').toLowerCase();
      if (bareName === 'writeln' || bareName === 'write') {
        for (const argument of stmt.args || []) {
          this.emitExpr(argument);
          this.emit(argument?.type === 'StringLiteral' ? 'PRINT' : 'PRINT_INT');
        }
        if (bareName === 'writeln') this.emit('PRINT_NL');
        return;
      }
      for (const argument of stmt.args || []) this.emitExpr(argument);
      this.emit(`CALL ${this.lookupProcedureLabel(this.normalizeProcedureName(stmt.name))} ${(stmt.args || []).length}`);
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
      this.emitExpr(stmt.expr);
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
          this.emit(`ROUTE_TRANSFORM "${this.escapeString(output.transformRule)}"`);
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
        this.emitStatement(member.body);
        this.methodContext = null;
        this.emit('RET');
        procedures[label] = {
          name: fullName,
          className: classDecl.name,
          methodName: member.name,
          params: (member.parameters || []).map(item => item.name),
          genericParams: member.genericParams || []
        };
      }
    }

    for (const procedure of this.ast.procedures || []) {
      const label = this.registerProcedure(procedure.name);
      this.emit(`${label}:`);
      const paramNames = new Set(procedure.params || []);
      for (const localName of procedure.locals || []) {
        if (!paramNames.has(localName)) this.zeroInit(localName);
      }
      this.emitStatement(procedure.body);
      this.emit('RET');
      procedures[label] = {
        name: procedure.name,
        params: procedure.params || [],
        locals: procedure.locals || []
      };
    }

    this.emit('MAIN:');
    for (const classDecl of this.ast.classes || []) {
      const classState = this.classInfo.get(classDecl.name);
      for (const fieldName of classState?.fields || []) {
        this.zeroInit(`${classDecl.name}__self__${fieldName}`);
      }
    }
    for (const variable of this.ast.variables || []) {
      this.zeroInit(this.normalizeStorageName(variable.name));
    }
    this.emitStatement(runtimeUnit.block);
    this.emitRouters();
    this.emit('HALT');

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
        entries: (this.ast.mappers || []).map(mapper => ({
          kind: 'mapper',
          id: mapper.id,
          scope: mapper.scope === 'local' ? 'local' : 'global',
          ownerServiceId: mapper.ownerServiceId || null,
          sourceTypeId: mapper.sourceTypeId,
          targetTypeId: mapper.targetTypeId,
          items: mapper.maps || []
        })),
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
        globals: (this.ast.variables || []).map(item => item.name),
        variableDeclarations: this.ast.variables,
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
  const result = new Codegen(ast).build();

  // Attach mapper imports to the program map
  result.programMap.mapperImports = mapperImports;

  return result;
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
