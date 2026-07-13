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

class PascalishProgramAstBuilder extends PascalishVisitor {
  visitCompilationUnit(ctx) {
    const ast = {
      type: 'CompilationUnit',
      runtimeUnit: null,
      variables: [],
      types: [],
      classes: []
    };

    for (const decl of ctx.decl() || []) {
      const value = this.visit(decl);
      if (!value) continue;
      if (value.type === 'ProgramDecl' || value.type === 'ServiceDecl' || value.type === 'DaemonDecl') {
        ast.runtimeUnit = value;
      }
      if (value.type === 'VarDecl') ast.variables.push(value);
      if (value.type === 'TypeDecl') ast.types.push(value);
      if (value.type === 'ClassDecl') ast.classes.push(value);
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
    return null;
  }

  visitProgramDecl(ctx) {
    return {
      type: 'ProgramDecl',
      name: ctx.IDENT().getText(),
      block: this.visit(ctx.block())
    };
  }

  visitServiceDecl(ctx) {
    return {
      type: 'ServiceDecl',
      name: ctx.IDENT().getText(),
      block: this.visit(ctx.block())
    };
  }

  visitDaemonDecl(ctx) {
    return {
      type: 'DaemonDecl',
      name: ctx.IDENT().getText(),
      schedule: this.visit(ctx.daemonSchedule()),
      block: this.visit(ctx.block())
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
    return {
      type: 'VarDecl',
      name: ctx.IDENT().getText(),
      dataType: this.visit(ctx.typeRef())
    };
  }

  visitIdentList(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText());
  }

  visitTypeRef(ctx) {
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
      id: ctx.IDENT().getText(),
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
    return {
      type: 'Block',
      statements: (ctx.statement() || []).map(item => this.visit(item)).filter(Boolean)
    };
  }

  visitStatement(ctx) {
    if (ctx.assignStmt()) return this.visit(ctx.assignStmt());
    if (ctx.callStmt()) return this.visit(ctx.callStmt());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.whileStmt()) return this.visit(ctx.whileStmt());
    if (ctx.forStmt()) return this.visit(ctx.forStmt());
    if (ctx.repeatStmt()) return this.visit(ctx.repeatStmt());
    if (ctx.enqueueStmt()) return this.visit(ctx.enqueueStmt());
    if (ctx.dequeueStmt()) return this.visit(ctx.dequeueStmt());
    if (ctx.block()) return this.visit(ctx.block());
    return null;
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
    const statements = ctx.statement() || [];
    return {
      type: 'Repeat',
      body: statements.map(item => this.visit(item)).filter(Boolean),
      untilExpr: this.visit(ctx.expr())
    };
  }

  visitLvalue(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText()).join('.');
  }

  visitQualifiedName(ctx) {
    return (ctx.IDENT() || []).map(token => token.getText()).join('.');
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
        '>=': 'GE',
        'and': 'MUL',
        'or': 'ADD'
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

export function compilePascalishProgramWithAntlr(sourceText) {
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

  const ast = new PascalishProgramAstBuilder().visit(tree);
  return new Codegen(ast).build();
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
