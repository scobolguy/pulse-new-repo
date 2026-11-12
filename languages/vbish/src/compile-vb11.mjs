import antlr4 from 'antlr4';
import VbishLexer from '../grammar/generated/VbishLexer.js';
import VbishParser from '../grammar/generated/VbishParser.js';
import { compileScalarToPcode } from '../../dotnet/compile-scalar-to-pcode.mjs';
import { fail } from '../../dotnet/source-diagnostics.mjs';
import { prepareScalarImports, linkScalarLibraries } from '../../dotnet/scalar-library.mjs';
import { PULSE_NETWORK_IMPORTS } from '../../dotnet/pulse-network-library.mjs';

const typeNames = { integer: 'int', sbyte: 'sbyte', byte: 'byte', short: 'short', ushort: 'ushort', boolean: 'bool', string: 'string' };
const normalized = text => text.replace(/^\[|\]$/g, '').toLowerCase();

export function parseVb11(source, { fileName = 'program.vb' } = {}) {
  if (typeof source !== 'string') throw new TypeError('VBish source must be a string');
  const lexer = new VbishLexer(new antlr4.InputStream(source));
  lexer.standardMode = true;
  const errors = [];
  class Listener extends antlr4.error.ErrorListener {
    syntaxError(_recognizer, symbol, line, column, message) {
      errors.push({ fileName, sourceLanguage: 'vbish', line, column: column + 1, message });
    }
  }
  const listener = new Listener();
  lexer.removeErrorListeners(); lexer.addErrorListener(listener);
  const parser = new VbishParser(new antlr4.CommonTokenStream(lexer));
  parser.removeErrorListeners(); parser.addErrorListener(listener);
  const tree = parser.vbCompilationUnit();
  if (errors.length) fail(errors[0], errors[0].message);
  return tree;
}

export function compileVb11ToPcode(source, { fileName = 'program.vb', libraries = [], target = 'js' } = {}) {
  const imports = [
    ...PULSE_NETWORK_IMPORTS.map(item => ({ ...item, key: item.key.toLowerCase() })),
    ...prepareScalarImports(libraries, 'vbish', target)
  ];
  const tree = parseVb11(source, { fileName });
  const token = ctx => {
    const start = ctx.start || ctx.symbol || ctx;
    return { fileName, sourceLanguage: 'vbish', line: start.line, column: start.column + 1, value: start.text };
  };
  let infer = true, serial = 0, currentReturn = 'void';
  let typeParameters = new Set();
  const loops = [];
  const typed = (name, ctx) => ({ ...token(ctx), name });
  const literal = (value, literalType, ctx) => ({ kind: 'literal', value, literalType, token: token(ctx) });
  const name = (value, ctx) => ({ kind: 'name', name: value, token: token(ctx) });
  const block = (statements, ctx) => ({ kind: 'block', statements, token: token(ctx) });
  const binary = (op, left, right, ctx) => ({ kind: 'binary', op, left, right, token: token(ctx) });
  const assignment = (left, right, ctx, op = '=') => ({ kind: 'assign', op, left, right, token: token(ctx) });
  const expressions = (values, ctx) => ({ kind: 'expressions', values, token: token(ctx) });
  const declaration = (id, type, value, ctx) => ({
    kind: 'declare', type: typed(type, ctx), token: token(ctx),
    declarations: [{ token: { ...token(ctx), value: id }, value }]
  });
  function readType(ctx) {
    const text = normalized(ctx.getText());
    const type = typeNames[text] || (typeParameters.has(text) ? text : null);
    if (!type) fail(token(ctx), `Type '${ctx.getText()}' is not supported by the scalar VB11 profile`);
    return type;
  }
  function defaultValue(type, ctx) {
    if (type === 'string') fail(token(ctx), 'Nothing/default String is not supported by the scalar VB11 profile; use an explicit value');
    if (typeParameters.has(type)) fail(token(ctx), 'Default values of type parameters are not supported; use an explicit value');
    return literal(type === 'bool' ? false : '0', type, ctx);
  }
  const seenOptions = new Set();
  for (const option of tree.vbOption()) {
    const text = option.getText().toLowerCase();
    const optionName = text.replace(/(?:on|off)$/, '');
    if (seenOptions.has(optionName)) fail(token(option), 'Duplicate compilation option');
    seenOptions.add(optionName);
    if (text === 'optionexplicitoff' || text === 'optionstrictoff')
      fail(token(option), 'Option Explicit Off and Option Strict Off are not supported by the scalar VB11 profile');
    if (text.startsWith('optioninfer')) infer = text.endsWith('on');
  }
  for (const item of tree.vbImport()) {
    if (item.vbQualifiedName().getText().toLowerCase() !== 'system')
      fail(token(item), 'Only Imports System is supported by the scalar VB11 profile');
  }
  const usingSystem = tree.vbImport().length > 0;
  function qualified(ctx) {
    const value = ctx.vbIdentifier().map(id => normalized(id.getText())).join('.');
    const consoleNames = {
      'system.console.write': 'System.Console.Write', 'system.console.writeline': 'System.Console.WriteLine',
      'console.write': 'Console.Write', 'console.writeline': 'Console.WriteLine'
    };
    return consoleNames[value] || value;
  }
  function call(ctx, args, location) {
    return { kind: 'call', name: qualified(ctx),
      typeArgs: location.vbTypeArguments()?.vbType().map(type => typed(readType(type), type)) || [],
      args: args.vbExpression().map(expression), token: token(location) };
  }
  function fold(ctx, children, read, operators) {
    let result = read(children[0]);
    for (let index = 1; index < children.length; index++) {
      const operator = ctx.getChild(index * 2 - 1).getText().toLowerCase();
      const op = operators[operator];
      if (!op) fail(token(ctx), `Operator '${operator}' is not supported by the scalar VB11 profile`);
      result = binary(op, result, read(children[index]), ctx);
    }
    return result;
  }
  const readOr = ctx => fold(ctx, ctx.vbXor(), readXor, { or: 'or', orelse: '||' });
  const readXor = ctx => fold(ctx, ctx.vbAnd(), readAnd, { xor: 'xor' });
  const readAnd = ctx => fold(ctx, ctx.vbNot(), readNot, { and: 'and', andalso: '&&' });
  const readNot = ctx => ctx.NOT()
    ? { kind: 'unary', op: '!', value: readNot(ctx.vbNot()), token: token(ctx) }
    : readComparison(ctx.vbComparison());
  const readComparison = ctx => fold(ctx, ctx.vbConcat(), readConcat, {
    '=': '==', '<>': '!=', '<': '<', '>': '>', '<=': '<=', '>=': '>='
  });
  const readConcat = ctx => fold(ctx, ctx.vbAdd(), readAdd, { '&': 'concat' });
  const readAdd = ctx => fold(ctx, ctx.vbMod(), readMod, { '+': '+', '-': '-' });
  const readMod = ctx => fold(ctx, ctx.vbIntegerDivision(), readIntegerDivision, { mod: '%' });
  const readIntegerDivision = ctx => fold(ctx, ctx.vbMultiply(), readMultiply, { '\\': '/' });
  const readMultiply = ctx => fold(ctx, ctx.vbUnary(), readUnary, { '*': '*' });
  const readUnary = ctx => ctx.vbPrimary() ? primary(ctx.vbPrimary())
    : { kind: 'unary', op: ctx.getChild(0).getText(), value: readUnary(ctx.vbUnary()), token: token(ctx) };
  function primary(ctx) {
    if (ctx.CINT() || ctx.CSBYTE() || ctx.CBYTE() || ctx.CSHORT() || ctx.CUSHORT() || ctx.CBOOL() || ctx.CSTR()) return {
      kind: 'convert', targetType: ctx.CINT() ? 'int' : ctx.CSBYTE() ? 'sbyte' : ctx.CBYTE() ? 'byte'
        : ctx.CSHORT() ? 'short' : ctx.CUSHORT() ? 'ushort' : ctx.CBOOL() ? 'bool' : 'string',
      value: expression(ctx.vbExpression()), token: token(ctx)
    };
    if (ctx.STRING_LITERAL()) return literal(ctx.STRING_LITERAL().getText().slice(1, -1).replace(/""/g, '"'), 'string', ctx);
    if (ctx.NUMBER()) {
      if (ctx.NUMBER().getText().includes('.')) fail(token(ctx), 'Floating-point literals are not supported by the scalar VB11 profile');
      return literal(ctx.NUMBER().getText(), 'int', ctx);
    }
    if (ctx.TRUE() || ctx.FALSE()) return literal(Boolean(ctx.TRUE()), 'bool', ctx);
    if (ctx.NOTHING()) fail(token(ctx), 'Nothing is not supported by the scalar VB11 profile');
    if (ctx.vbQualifiedName()) return ctx.vbArguments()
      ? call(ctx.vbQualifiedName(), ctx.vbArguments(), ctx)
      : name(qualified(ctx.vbQualifiedName()), ctx);
    return expression(ctx.vbExpression());
  }
  function expression(ctx) { return readOr(ctx.vbOr()); }
  function statements(ctx) { return block(ctx.vbStatement().map(statement), ctx); }
  function loopBody(style, ctx) {
    loops.push(style);
    const result = statements(ctx);
    loops.pop();
    return result;
  }
  function statement(ctx) {
    const at = token(ctx);
    if (ctx.DIM()) {
      const declarations = ctx.vbVariable().map(variable => {
        const value = variable.vbExpression() ? expression(variable.vbExpression()) : null;
        const type = variable.vbType() ? readType(variable.vbType()) : infer && value?.kind === 'literal' ? value.literalType : null;
        if (!type) fail(token(variable), 'An explicit As type is required unless Option Infer On can infer a literal');
        return declaration(normalized(variable.vbIdentifier().getText()), type, value || defaultValue(type, variable), variable);
      });
      return { kind: 'declarations', declarations, token: at };
    }
    if (ctx.vbIf()) {
      const conditional = ctx.vbIf(), conditions = conditional.vbExpression(), bodies = conditional.vbBlock();
      let otherwise = bodies.length > conditions.length ? statements(bodies.at(-1)) : null;
      for (let index = conditions.length - 1; index >= 0; index--) {
        otherwise = { kind: 'if', condition: expression(conditions[index]), then: statements(bodies[index]), otherwise, token: token(conditional) };
      }
      return otherwise;
    }
    if (ctx.vbWhile()) {
      const loop = ctx.vbWhile();
      return { kind: 'while', condition: expression(loop.vbExpression()), body: loopBody('while', loop.vbBlock()), token: at };
    }
    if (ctx.vbFor()) {
      const loop = ctx.vbFor(), id = normalized(loop.vbIdentifier(0).getText());
      if (loop.vbIdentifier(1) && normalized(loop.vbIdentifier(1).getText()) !== id)
        fail(token(loop.vbIdentifier(1)), 'Next variable must match its For variable');
      if (loop.vbType() && readType(loop.vbType()) !== 'int') fail(at, 'For requires Integer in the scalar VB11 profile');
      const values = loop.vbExpression().map(expression), end = `$vb_end_${serial++}`, step = `$vb_step_${serial++}`;
      const init = loop.vbType() ? declaration(id, 'int', values[0], loop)
        : expressions([assignment(name(id, loop), values[0], loop)], loop);
      const stepValue = values[2] || literal('1', 'int', loop);
      return block([
        init, declaration(end, 'int', values[1], loop), declaration(step, 'int', stepValue, loop),
        {
          kind: 'for', init: null, token: at,
          condition: { kind: 'conditional', token: at,
            condition: binary('>=', name(step, loop), literal('0', 'int', loop), loop),
            yes: binary('<=', name(id, loop), name(end, loop), loop),
            no: binary('>=', name(id, loop), name(end, loop), loop) },
          increment: [assignment(name(id, loop), binary('+', name(id, loop), name(step, loop), loop), loop)],
          body: loopBody('for', loop.vbBlock())
        }
      ], loop);
    }
    if (ctx.vbDo()) {
      const loop = ctx.vbDo(), conditions = loop.vbExpression();
      if (conditions.length > 1) fail(at, 'Do cannot have both a leading and trailing condition');
      const leading = loop.getChild(1).getText().toLowerCase();
      const topTest = ['while', 'until'].includes(leading);
      const until = loop.UNTIL().length > 0;
      let condition = conditions.length ? expression(conditions[0]) : literal(true, 'bool', loop);
      if (until) condition = { kind: 'unary', op: '!', value: condition, token: at };
      return { kind: topTest ? 'while' : 'do', condition, body: loopBody('do', loop.vbBlock()), token: at };
    }
    if (ctx.EXIT() || ctx.CONTINUE()) {
      const style = ctx.getChild(1).getText().toLowerCase();
      if (['sub', 'function'].includes(style)) {
        if (style !== (currentReturn === 'void' ? 'sub' : 'function')) fail(at, 'Exit does not match the containing procedure');
        return { kind: 'return', value: currentReturn === 'void' ? null : defaultValue(currentReturn, ctx), token: at };
      }
      if (loops.at(-1) !== style) fail(at, 'Exit/Continue must name the innermost matching loop in the scalar VB11 profile');
      return { kind: ctx.EXIT() ? 'break' : 'continue', token: at };
    }
    if (ctx.RETURN()) {
      return { kind: 'return', value: ctx.vbExpression().length ? expression(ctx.vbExpression(0)) : null, token: at };
    }
    if (ctx.PRINT() || ctx.DISPLAY()) {
      const values = ctx.vbExpression().map(expression);
      return expressions([
        ...values.map(value => ({ kind: 'call', name: 'System.Console.Write', args: [value], typeArgs: [], token: at })),
        { kind: 'call', name: 'System.Console.WriteLine', args: [], typeArgs: [], token: at }
      ], ctx);
    }
    if (ctx.vbQualifiedName()) return expressions([call(ctx.vbQualifiedName(), ctx.vbArguments(), ctx)], ctx);
    const left = name(normalized(ctx.vbIdentifier().getText()), ctx);
    const right = expression(ctx.vbExpression(0));
    const operator = ctx.getChild(1).getText();
    return expressions([operator === '&='
      ? assignment(left, binary('concat', left, right, ctx), ctx)
      : assignment(left, right, ctx, operator)], ctx);
  }
  const modules = tree.vbModule();
  if (modules.length && tree.vbProcedure().length)
    fail(token(tree.vbProcedure(0)), 'Cannot mix module members with standalone procedures in the scalar VB11 profile');
  const owners = modules.length ? modules.map(module => ({
    name: normalized(module.vbIdentifier().getText()), ctx: module, procedures: module.vbProcedure()
  })) : [{ name: 'program', ctx: tree, procedures: tree.vbProcedure() }];
  const classes = owners.map(owner => ({
    name: owner.name, token: token(owner.ctx),
    methods: owner.procedures.map(procedure => {
      const typeParams = procedure.vbTypeParameters()?.vbIdentifier().map(id => ({
        ...token(id), value: normalized(id.getText())
      })) || [];
      typeParameters = new Set(typeParams.map(item => item.value));
      for (const parameter of typeParams) {
        if (Object.hasOwn(typeNames, parameter.value) || ['double', 'long', 'object'].includes(parameter.value))
          fail(parameter, 'A type parameter cannot use a built-in type name');
      }
      currentReturn = procedure.SUB().length ? 'void' : readType(procedure.vbType());
      const body = statements(procedure.vbBlock());
      if (['int', 'bool'].includes(currentReturn)) body.statements.push({
        kind: 'return', value: defaultValue(currentReturn, procedure), token: token(procedure)
      });
      const methodName = normalized(procedure.vbIdentifier().getText());
      return {
        name: methodName === 'main' ? 'Main' : methodName,
        owner: owner.name, token: { ...token(procedure.vbIdentifier()), value: methodName },
        returnType: typed(currentReturn, procedure), typeParams, body,
        modifiers: new Set(['static', procedure.PRIVATE() ? 'private' : 'public']),
        params: procedure.vbParameters().vbParameter().map(parameter => {
          if (parameter.BYREF()) fail(token(parameter), 'ByRef is not supported by the scalar VB11 profile');
          return {
            token: { ...token(parameter.vbIdentifier()), value: normalized(parameter.vbIdentifier().getText()) },
            type: typed(readType(parameter.vbType()), parameter)
          };
        })
      };
    })
  }));
  const artifact = compileScalarToPcode({ token: token(tree), classes, usingSystem }, source, {
    fileName, sourceLanguage: 'vbish', checkedArithmetic: true, imports, target
  });
  artifact.languageProfile = 'vb11-scalar';
  artifact.programMap.languageProfile = 'vb11-scalar';
  artifact.native = { valid: true, syntaxErrors: [], syntaxErrorCount: 0, interop: [] };
  return linkScalarLibraries(artifact, libraries);
}
