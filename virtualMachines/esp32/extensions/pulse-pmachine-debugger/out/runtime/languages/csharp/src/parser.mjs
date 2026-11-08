import antlr4 from 'antlr4';
import CsharpLexer from '../grammar/generated/CsharpLexer.js';
import CsharpParser from '../grammar/generated/CsharpParser.js';
import { fail } from '../../dotnet/source-diagnostics.mjs';
export { fail };

function decodeString(raw, location) {
  if (raw.startsWith('@"')) return raw.slice(2, -1).replace(/""/g, '"');
  const simple = { "'": "'", '"': '"', '\\': '\\', '0': '\0', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
  let value = '';
  for (let index = 1; index < raw.length - 1; index++) {
    if (raw[index] !== '\\') { value += raw[index]; continue; }
    const escape = raw[++index];
    if (Object.hasOwn(simple, escape)) { value += simple[escape]; continue; }
    if (!['x', 'u', 'U'].includes(escape)) fail(location, `Unsupported string escape \\${escape}`);
    const size = escape === 'u' ? 4 : escape === 'U' ? 8 : 4;
    let digits = '';
    while (digits.length < size && /[0-9a-fA-F]/.test(raw[index + 1] || 'z')) digits += raw[++index];
    if (!digits || escape !== 'x' && digits.length !== size) fail(location, 'Invalid Unicode escape');
    const code = Number.parseInt(digits, 16);
    if (code > 0x10ffff) fail(location, 'Unicode escape is out of range');
    value += String.fromCodePoint(code);
  }
  return value;
}

export function parseCsharp(source, { fileName = 'program.cs' } = {}) {
  const location = item => {
    const start = item.start && typeof item.start === 'object' ? item.start : item.symbol || item;
    return { fileName, line: start.line, column: start.column + 1, value: start.text?.replace(/^@/, '') };
  };
  const lexer = new CsharpLexer(new antlr4.InputStream(source));
  const tokens = new antlr4.CommonTokenStream(lexer);
  tokens.fill();
  for (const token of tokens.tokens) {
    if (token.type === CsharpLexer.INVALID_CHARACTER) fail(location(token), `Unsupported character ${JSON.stringify(token.text)}`);
    if (token.type === CsharpLexer.UNTERMINATED_COMMENT) fail(location(token), 'Unterminated block comment');
    if (token.type === CsharpLexer.UNTERMINATED_STRING)
      fail(location(token), /[\r\n]$/.test(token.text) ? 'Newline in regular string literal' : 'Unterminated string literal');
    if (token.type === CsharpLexer.STRING_LITERAL) decodeString(token.text, location(token));
  }
  const parser = new CsharpParser(tokens);
  const errors = [];
  class Listener extends antlr4.error.ErrorListener {
    syntaxError(recognizer, symbol, line, column, message) {
      const expected = recognizer.getExpectedTokens().toString(recognizer.literalNames, recognizer.symbolicNames);
      errors.push({ fileName, line, column: column + 1,
        message: `Expected ${expected === 'IDENTIFIER' ? 'an identifier' : expected}, found ${JSON.stringify(symbol?.text)}: ${message}` });
    }
  }
  parser.removeErrorListeners();
  parser.addErrorListener(new Listener());
  const tree = parser.compilationUnit();
  if (errors.length) fail(errors[0], errors[0].message);
  const identifier = ctx => location(ctx);
  const qualified = ctx => ctx.identifier().map(item => identifier(item).value).join('.');
  const readType = ctx => ({
    ...location(ctx),
    name: ctx.identifier() ? identifier(ctx.identifier()).value : ctx.getText(),
    ...(ctx.typeArguments() ? {
      typeArguments: ctx.typeArguments().type().map(readType)
    } : {})
  });
  function modifiers(items) {
    const result = new Set();
    for (const item of items) {
      const value = item.getText();
      if (result.has(value)) fail(location(item), `Duplicate modifier '${value}'`);
      if (['public', 'private', 'internal'].includes(value) && [...result].some(value => ['public', 'private', 'internal'].includes(value)))
        fail(location(item), 'Conflicting accessibility modifiers');
      result.add(value);
    }
    return result;
  }
  function readClass(ctx, namespace) {
    modifiers(ctx.classModifier());
    const token = identifier(ctx.identifier()), name = namespace ? `${namespace}.${token.value}` : token.value;
    const constructors = ctx.memberDeclaration().filter(member => member.constructorDeclaration()).map(member => {
      const declaration = member.constructorDeclaration();
      const flags = modifiers(declaration.methodModifier());
      const name = identifier(declaration.identifier());
      if (name.value !== token.value) fail(name, 'A constructor must have the same name as its containing class');
      return {
        token: name, name: name.value, params: declaration.parameters()?.parameter().map(parameter => ({
          type: readType(parameter.type()), token: identifier(parameter.identifier())
        })) || [], body: readBlock(declaration.block()), modifiers: flags
      };
    });
    const methods = ctx.memberDeclaration().filter(member => !member.constructorDeclaration()).map(member => {
      const flags = modifiers(member.methodModifier());
      if (!member.type() || (!flags.has('static') && !ctx.classModifier().some(item => item.getText() === 'sealed')))
        fail(location(member), 'Only static methods are supported; fields and instance members are not supported');
      const method = identifier(member.identifier());
      const attributes = member.attributeSection().map(attribute => ({
        name: identifier(attribute.identifier()).value,
        arguments: attribute.arguments()?.expressionList()?.expression().map(expression) || []
      }));
      return {
        token: method, name: method.value, owner: name, returnType: readType(member.type()),
        typeParams: member.typeParameters()?.identifier().map(identifier) || [],
        async: Boolean(member.ASYNC()),
        attributes,
        params: member.parameters()?.parameter().map(parameter => ({
          type: readType(parameter.type()), token: identifier(parameter.identifier())
        })) || [],
        body: readBlock(member.block()), modifiers: flags
      };
    });
    return { token, name, methods, constructors,
      modifiers: new Set(ctx.classModifier().map(item => item.getText())) };
  }
  function readBlock(ctx) { return { kind: 'block', token: location(ctx), statements: ctx.statement().map(statement) }; }
  function declaration(ctx) {
    const type = readType(ctx.type());
    return { kind: 'declare', token: type, type, declarations: ctx.variableDeclarator().map(item => ({
      token: identifier(item.identifier()), value: item.expression() ? expression(item.expression()) : null
    })) };
  }
  const expressionList = ctx => ctx ? ctx.expression().map(expression) : [];
  const expressions = (values, ctx) => ({ kind: 'expressions', token: location(ctx), values });
  function statement(ctx) {
    const token = location(ctx);
    if (ctx.block()) return ctx.CHECKED() || ctx.UNCHECKED()
      ? { kind: 'overflow', token, checked: Boolean(ctx.CHECKED()), body: readBlock(ctx.block()) }
      : readBlock(ctx.block());
    if (ctx.IF()) return { kind: 'if', token, condition: expression(ctx.expression()),
      then: statement(ctx.statement(0)), otherwise: ctx.ELSE() ? statement(ctx.statement(1)) : null };
    if (ctx.FOR()) {
      const init = ctx.forInitializer();
      return {
        kind: 'for', token,
        init: !init ? null : init.declaration() ? declaration(init.declaration()) : expressions(expressionList(init.expressionList()), init),
        condition: ctx.condition ? expression(ctx.condition) : null,
        increment: expressionList(ctx.increment), body: statement(ctx.statement(0))
      };
    }
    if (ctx.WHILE()) return { kind: ctx.DO() ? 'do' : 'while', token,
      condition: expression(ctx.expression()), body: statement(ctx.statement(0)) };
    if (ctx.RETURN()) return { kind: 'return', token, value: ctx.expression() ? expression(ctx.expression()) : null };
    if (ctx.BREAK() || ctx.CONTINUE()) return { kind: ctx.BREAK() ? 'break' : 'continue', token };
    if (ctx.declaration()) return declaration(ctx.declaration());
    if (ctx.expression()) return expressions([expression(ctx.expression())], ctx);
    return { kind: 'empty', token };
  }
  function fold(ctx, items, read) {
    let left = read(items[0]);
    for (let index = 1; index < items.length; index++) {
      const operator = ctx.getChild(index * 2 - 1);
      left = { kind: 'binary', token: location(operator), op: operator.getText(), left, right: read(items[index]) };
    }
    return left;
  }
  const logicalOr = ctx => fold(ctx, ctx.logicalAnd(), logicalAnd);
  const logicalAnd = ctx => fold(ctx, ctx.equality(), equality);
  const equality = ctx => fold(ctx, ctx.relational(), relational);
  const relational = ctx => fold(ctx, ctx.additive(), additive);
  const additive = ctx => fold(ctx, ctx.multiplicative(), multiplicative);
  const multiplicative = ctx => fold(ctx, ctx.unary(), unary);
  function expression(ctx) { return assignment(ctx.assignmentExpression()); }
  function assignment(ctx) {
    const left = conditional(ctx.conditionalExpression());
    return ctx.assignmentOperator() ? {
      kind: 'assign', token: location(ctx.assignmentOperator()), op: ctx.assignmentOperator().getText(),
      left, right: assignment(ctx.assignmentExpression())
    } : left;
  }
  function conditional(ctx) {
    const condition = logicalOr(ctx.logicalOr());
    return ctx.QUESTION() ? { kind: 'conditional', token: location(ctx), condition,
      yes: expression(ctx.expression(0)), no: expression(ctx.expression(1)) } : condition;
  }
  function unary(ctx) {
    if (ctx.scalarCastType()) return {
      kind: 'convert', token: location(ctx), targetType: ctx.scalarCastType().getText(), value: unary(ctx.unary())
    };
    if (ctx.primary()) {
      const value = primary(ctx.primary());
      return ctx.INC() || ctx.DEC() ? {
        kind: 'increment', token: location(ctx.getChild(1)), op: ctx.getChild(1).getText(), value, prefix: false
      } : value;
    }
    const op = ctx.getChild(0).getText();
    return { kind: ['++', '--'].includes(op) ? 'increment' : 'unary',
      token: location(ctx), op, value: unary(ctx.unary()), prefix: true };
  }
  function primary(ctx) {
    const token = location(ctx);
    if (ctx.INTEGER_LITERAL()) return { kind: 'literal', token, literalType: 'int', value: ctx.getText() };
    if (ctx.STRING_LITERAL()) return { kind: 'literal', token, literalType: 'string', value: decodeString(ctx.getText(), token) };
    if (ctx.TRUE() || ctx.FALSE()) return { kind: 'literal', token, literalType: 'bool', value: Boolean(ctx.TRUE()) };
    if (ctx.CHECKED() || ctx.UNCHECKED())
      return { kind: 'overflow', token, checked: Boolean(ctx.CHECKED()), value: expression(ctx.expression()) };
    if (ctx.expression()) return expression(ctx.expression());
    const name = qualified(ctx.qualifiedName());
    return ctx.arguments() ? {
      kind: 'call', token, name, args: expressionList(ctx.arguments().expressionList()),
      typeArgs: ctx.typeArguments()?.type().map(readType) || []
    } : { kind: 'name', token, name };
  }
  let usingSystem = false;
  for (const item of tree.usingDirective()) {
    if (qualified(item.qualifiedName()) !== 'System') fail(location(item), 'Only using System is supported');
    usingSystem = true;
  }
  const namespace = tree.namespaceDeclaration();
  return {
    token: location(tree), usingSystem,
    classes: (namespace ? namespace.classDeclaration() : tree.classDeclaration())
      .map(item => readClass(item, namespace ? qualified(namespace.qualifiedName()) : ''))
  };
}
