import antlr4 from 'antlr4';
import KotlinLexer from '../grammar/generated/KotlinLexer.js';
import KotlinParser from '../grammar/generated/KotlinParser.js';
import { fail } from '../../dotnet/source-diagnostics.mjs';

const ruleName = (parser, ctx) => ctx?.symbol ? null : parser.ruleNames[ctx?.ruleIndex];
const ruleChildren = ctx => (ctx.children || []).filter(child => !child.symbol && child.ruleIndex != null);
const idValue = ctx => ctx.getText().replace(/^`|`$/g, '');
const httpAnnotations = {
  HttpGet: 'GET', HttpPost: 'POST', HttpPut: 'PUT', HttpPatch: 'PATCH',
  HttpDelete: 'DELETE', HttpHead: 'HEAD', HttpOptions: 'OPTIONS'
};

function parseType(ctx, fileName, typeParameters) {
  const token = ctx.start;
  const typeName = ctx.getText();
  const names = { Byte: 'sbyte', Short: 'short', Int: 'int', Boolean: 'bool', String: 'string', Unit: 'void' };
  const identifier = /^`[^`]+`$/.test(typeName) ? typeName.slice(1, -1) : typeName;
  const name = typeParameters.has(identifier) ? identifier
    : Object.hasOwn(names, typeName) ? names[typeName] : null;
  if (!name) fail({ fileName, line: token.line, column: token.column + 1, sourceLanguage: 'kotlin' },
    `Unsupported Kotlin type '${typeName}'`);
  return { name, fileName, line: token.line, column: token.column + 1, sourceLanguage: 'kotlin' };
}

function decodeString(raw, location) {
  if (raw.startsWith('"""')) fail(location, 'Multiline strings are not supported by the P-code subset');
  const body = raw.slice(1, -1);
  if (/(?<!\\)\$/.test(body)) fail(location, 'String templates are not supported by the P-code subset');
  const escapes = { t: '\t', b: '\b', n: '\n', r: '\r', "'": "'", '"': '"', '\\': '\\', '$': '$' };
  let value = '';
  for (let index = 0; index < body.length; index++) {
    if (body[index] !== '\\') {
      value += body[index];
      continue;
    }
    const escape = body[++index];
    if (!Object.hasOwn(escapes, escape)) fail(location, `Unsupported Kotlin string escape \\${escape}`);
    value += escapes[escape];
  }
  return value;
}

export function parseKotlin(source, { fileName = 'program.kt' } = {}) {
  if (typeof source !== 'string') throw new TypeError('Kotlin source must be a string');
  const location = item => {
    const token = item.start || item.symbol || item;
    return {
      fileName, sourceLanguage: 'kotlin', line: token.line, column: token.column + 1,
      value: token.text?.replace(/^`|`$/g, '')
    };
  };
  const lexer = new KotlinLexer(new antlr4.InputStream(source));
  const tokens = new antlr4.CommonTokenStream(lexer);
  const errors = [];
  class Listener extends antlr4.error.ErrorListener {
    syntaxError(recognizer, symbol, line, column, message) {
      errors.push({ fileName, sourceLanguage: 'kotlin', line, column: column + 1, message });
    }
  }
  lexer.removeErrorListeners();
  lexer.addErrorListener(new Listener());
  tokens.fill();
  const parser = new KotlinParser(tokens);
  parser.removeErrorListeners();
  parser.addErrorListener(new Listener());
  const tree = parser.kotlinFile();
  if (errors.length) fail(errors[0], errors[0].message);

  let typeParameters = new Set();
  const readType = ctx => parseType(ctx, fileName, typeParameters);

  function conditionalExpression(ctx) {
    const branches = ctx.controlStructureBody();
    if (branches.length !== 2) fail(location(ctx), 'A Kotlin if expression requires an else branch');
    function branch(body) {
      const statements = body.block() ? body.block().statement() : [body.statement()];
      if (statements.length !== 1)
        fail(location(body), 'Kotlin if expression branches must contain one expression in this subset');
      const value = statements[0];
      if (value.ifStatement()) return conditionalExpression(value.ifStatement());
      if (value.expression()) return expression(value.expression());
      fail(location(value), 'Kotlin if expression branches must contain one expression in this subset');
    }
    return {
      kind: 'conditional', token: location(ctx), condition: expression(ctx.expression()),
      yes: branch(branches[0]), no: branch(branches[1])
    };
  }

  function expression(ctx) {
    if (!ctx) fail(location(tree), 'Expected an expression');
    const name = ruleName(parser, ctx);
    if (name === 'expression') return expression(ctx.assignmentExpression());
    if (name === 'assignmentExpression') {
      const children = ruleChildren(ctx);
      if (children.length === 1) return expression(children[0]);
      const operator = children.find(child => ruleName(parser, child) === 'assignmentOperator');
      const operands = children.filter(child => child !== operator);
      if (!operator || operands.length !== 2) fail(location(ctx), 'Unsupported assignment expression');
      return {
        kind: 'assign', token: location(operator),
        op: operator.getText(), left: expression(operands[0]), right: expression(operands[1])
      };
    }
    if (name === 'elvisExpression' || name === 'disjunctionExpression' || name === 'conjunctionExpression'
        || name === 'equalityExpression' || name === 'comparisonExpression' || name === 'rangeExpression'
        || name === 'additiveExpression' || name === 'multiplicativeExpression') {
      const children = ruleChildren(ctx);
      let value = expression(children[0]);
      for (let index = 1; index < children.length; index++) {
        const operator = ctx.children.find((child, childIndex) =>
          childIndex > ctx.children.indexOf(children[index - 1])
          && childIndex < ctx.children.indexOf(children[index])
          && child.symbol)?.getText();
        if (!operator) fail(location(children[index]), 'Unsupported Kotlin operator');
        value = { kind: 'binary', token: location(ctx.children[ctx.children.indexOf(children[index]) - 1]),
          op: operator, left: value, right: expression(children[index]) };
      }
      return value;
    }
    if (name === 'infixExpression') {
      const children = ruleChildren(ctx);
      if (children.length !== 1) fail(location(ctx), 'Infix function calls are not supported by the P-code subset');
      return expression(children[0]);
    }
    if (name === 'castExpression') {
      const children = ruleChildren(ctx);
      if (children.length !== 1) fail(location(ctx), 'Kotlin casts are not supported by the P-code subset');
      return expression(children[0]);
    }
    if (name === 'prefixUnaryExpression') {
      const children = ruleChildren(ctx);
      let value = expression(children.at(-1));
      for (const prefix of children.slice(0, -1).reverse()) {
        const op = prefix.getText();
        value = op === '++' || op === '--'
          ? { kind: 'increment', token: location(prefix), op, value, prefix: true }
          : { kind: 'unary', token: location(prefix), op, value };
      }
      return value;
    }
    if (name === 'postfixUnaryExpression') {
      const children = ruleChildren(ctx);
      let value = expression(children[0]);
      for (const suffix of children.slice(1)) {
        const call = suffix.callSuffix();
        if (call) {
          if (value.kind !== 'name') fail(location(suffix), 'Only direct function calls are supported');
          if (call.lambdaLiteral()) fail(location(suffix), 'Trailing-lambda calls are not supported');
          const typeArgs = (call.typeArguments()?.typeProjection() || []).map(projection => {
            if (projection.IN() || projection.OUT() || projection.MUL())
              fail(location(projection), 'Type projections are not supported in function calls');
            return readType(projection.typeReference());
          });
          const args = (call.valueArguments()?.valueArgument() || []).map(argument => {
            if (argument.identifier() || argument.MUL()) fail(location(argument), 'Named and spread arguments are not supported');
            return expression(argument.expression());
          });
          const name = value.name === 'println' ? 'Console.WriteLine'
            : value.name === 'print' ? 'Console.Write' : value.name;
          value = { kind: 'call', token: location(ctx), name, args, typeArgs };
        } else if (suffix.INCR() || suffix.DECR()) {
          value = { kind: 'increment', token: location(suffix), op: suffix.getText(), value, prefix: false };
        } else {
          fail(location(suffix), 'Property access, indexing, and null assertions are not supported by the P-code subset');
        }
      }
      return value;
    }
    if (name === 'primaryExpression') {
      if (ctx.literalConstant()) {
        const literal = ctx.literalConstant();
        const token = literal.start;
        const raw = literal.getText();
        if (raw === 'true' || raw === 'false')
          return { kind: 'literal', token: location(literal), literalType: 'bool', value: raw === 'true' };
        if (/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|[\d][\d_]*)$/.test(raw))
          return { kind: 'literal', token: location(literal), literalType: 'int', value: raw.replaceAll('_', '') };
        if (raw.startsWith('"'))
          return { kind: 'literal', token: location(literal), literalType: 'string', value: decodeString(raw, location(literal)) };
        fail(location(literal), `Unsupported Kotlin literal '${raw}'`);
      }
      if (ctx.identifier()) return { kind: 'name', token: location(ctx.identifier()), name: idValue(ctx.identifier()) };
      if (ctx.expression()) return expression(ctx.expression());
      if (ctx.ifExpression()) return conditionalExpression(ctx.ifExpression());
      if (ctx.jumpExpression()) {
        const jump = ctx.jumpExpression();
        if (jump.AT()) fail(location(jump), 'Labeled jumps are not supported by the P-code subset');
        if (jump.RETURN()) return { kind: 'return', token: location(jump), value: jump.expression() ? expression(jump.expression()) : null };
        if (jump.BREAK() || jump.CONTINUE())
          return { kind: jump.BREAK() ? 'break' : 'continue', token: location(jump) };
        fail(location(jump), 'Throw expressions are not supported by the P-code subset');
      }
      fail(location(ctx), 'Unsupported Kotlin expression');
    }
    fail(location(ctx), `Unsupported Kotlin expression form '${name}'`);
  }

  function readBlock(ctx) {
    return { kind: 'block', token: location(ctx), statements: ctx.statement().map(statement) };
  }

  function controlBody(ctx) {
    if (ctx.block()) return readBlock(ctx.block());
    return statement(ctx.statement());
  }

  function statement(ctx) {
    const token = location(ctx);
    if (ctx.propertyDeclaration()) {
      const property = ctx.propertyDeclaration();
      if (property.propertyAccessor().length) fail(token, 'Local property accessors are not supported');
      const identifier = property.identifier();
      const declared = property.typeReference();
      return {
        kind: 'declare', token: location(property), infer: !declared,
        type: declared ? readType(declared) : { name: 'int' },
        declarations: [{
          token: location(identifier), mutable: Boolean(property.VAR()),
          value: property.expression() ? expression(property.expression()) : null
        }]
      };
    }
    if (ctx.ifStatement()) {
      const conditional = ctx.ifStatement();
      const branches = conditional.controlStructureBody();
      return {
        kind: 'if', token: location(conditional), condition: expression(conditional.expression()),
        then: controlBody(branches[0]), otherwise: branches[1] ? controlBody(branches[1]) : null
      };
    }
    if (ctx.loopStatement()) {
      const loop = ctx.loopStatement();
      const body = controlBody(loop.controlStructureBody());
      if (loop.WHILE() || loop.DO()) return {
        kind: loop.DO() ? 'do' : 'while', token: location(loop),
        condition: expression(loop.expression()), body
      };
      const identifier = loop.identifier();
      const range = expression(loop.expression());
      if (range.kind !== 'binary' || !['..', '..<'].includes(range.op))
        fail(location(loop), 'For loops must iterate over a numeric range');
      if (range.op === '..<') fail(location(loop), 'Exclusive ranges are not supported by the P-code subset');
      const endToken = { ...location(identifier), value: `$pulse$rangeEnd$${identifier.start.tokenIndex}` };
      const loopName = idValue(identifier);
      const loopVariable = { kind: 'name', token: location(identifier), name: loopName };
      const limitVariable = { kind: 'name', token: endToken, name: endToken.value };
      return {
        kind: 'for', token: location(loop),
        init: {
          kind: 'declare', token: location(loop), type: { name: 'int' }, declarations: [
            { token: location(identifier), mutable: false, value: range.left },
            { token: endToken, mutable: false, value: range.right }
          ]
        },
        condition: {
          kind: 'binary', token: range.token, op: '<=', left: loopVariable, right: limitVariable
        },
        increment: [{
          kind: 'increment', token: location(identifier), op: '++', value: loopVariable,
          prefix: true, compilerGenerated: true
        }],
        body
      };
    }
    if (ctx.expression()) {
      const value = expression(ctx.expression());
      if (['return', 'break', 'continue'].includes(value.kind)) return value;
      return { kind: 'expressions', token, values: [value] };
    }
    if (ctx.functionDeclaration() || ctx.classDeclaration() || ctx.objectDeclaration())
      fail(token, 'Nested declarations are not supported by the P-code subset');
    fail(token, 'Unsupported Kotlin statement');
  }

  function readFunction(ctx) {
    if (ctx.typeConstraints()) fail(location(ctx.typeConstraints()), 'Generic type constraints are not supported by the P-code subset');
    const typeParams = (ctx.typeParameters()?.typeParameter() || []).map(parameter => {
      if (parameter.typeReference()) fail(location(parameter), 'Generic type bounds are not supported by the P-code subset');
      if (parameter.REIFIED().length || parameter.IN().length || parameter.OUT().length)
        fail(location(parameter), 'Generic type parameter modifiers are not supported by the P-code subset');
      const token = location(parameter.identifier());
      if (['Byte', 'Short', 'Int', 'Boolean', 'String', 'Unit'].includes(token.value))
        fail(token, 'A type parameter cannot use a built-in type name in the P-code subset');
      return token;
    });
    typeParameters = new Set(typeParams.map(token => token.value));
    const nameToken = location(ctx.identifier());
    const params = (ctx.valueParameters().valueParameter() || []).map(parameter => {
      if (parameter.ASSIGN()) fail(location(parameter), 'Default parameter values are not supported by the P-code subset');
      if (parameter.VAL() || parameter.VAR()) fail(location(parameter), 'Function parameters cannot use val or var here');
      if (parameter.parameterModifier().length) fail(location(parameter), 'Function parameter modifiers are not supported by the P-code subset');
      return { token: location(parameter.identifier()), type: readType(parameter.typeReference()) };
    });
    const body = ctx.functionBody();
    const block = body.block()
      ? readBlock(body.block())
      : { kind: 'block', token: location(body), statements: [
        { kind: 'return', token: location(body), value: expression(body.expression()) }
      ] };
    const returnType = ctx.typeReference() ? readType(ctx.typeReference())
      : nameToken.value === 'main' || body.block()
        ? { name: 'void', ...nameToken }
        : inferExpressionType(body.expression(), params);
    if (nameToken.value === 'main' && (typeParams.length || params.length || returnType.name !== 'void'))
      fail(nameToken, 'The P-code entry point must be fun main() with Unit return type');
    typeParameters = new Set();
    return {
      token: nameToken, name: nameToken.value === 'main' ? 'Main' : nameToken.value,
      owner: 'Program', returnType, typeParams, params, body: block,
      modifiers: new Set(['public', 'static']), attributes: [], block
    };
  }

  function inferExpressionType(ctx, params) {
    const node = expression(ctx);
    const localTypes = new Map(params.map(param => [param.token.value, param.type.name]));
    const infer = value => {
      if (value.kind === 'literal') return { int: 'int', bool: 'bool', string: 'string' }[value.literalType];
      if (value.kind === 'name') return localTypes.get(value.name);
      if (value.kind === 'unary') return value.op === '!' ? 'bool' : infer(value.value);
      if (value.kind === 'conditional') {
        const yes = infer(value.yes), no = infer(value.no);
        return yes && yes === no ? yes : null;
      }
      if (value.kind === 'binary') {
        if (['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(value.op)) return 'bool';
        const left = infer(value.left), right = infer(value.right);
        return left === 'string' || right === 'string' ? 'string' : 'int';
      }
      if (value.kind === 'call' && value.name.startsWith('Console.')) return 'void';
      return null;
    };
    const type = infer(node);
    if (!type) fail(location(ctx), 'Expression-bodied functions need an explicit supported return type for this subset');
    return { name: type, ...location(ctx) };
  }

  const functions = [];
  const endpoints = [];
  for (const declaration of tree.topLevelDeclaration()) {
    const modifiers = declaration.declarationModifier();
    if (declaration.functionDeclaration()) {
      const method = readFunction(declaration.functionDeclaration());
      for (const modifier of modifiers) {
        const annotation = modifier.annotation();
        const annotationName = annotation?.qualifiedIdentifier().getText().replace(/^pulse\.http\./, '');
        const verb = httpAnnotations[annotationName];
        if (!annotation || !verb || annotation.typeArguments() || annotation.identifier())
          fail(location(modifier), 'Only HTTP method annotations are supported on Kotlin functions');
        const args = annotation.valueArguments()?.valueArgument() || [];
        if (args.length !== 1 || args[0].identifier() || args[0].MUL())
          fail(location(annotation), `@${annotationName} requires one literal path string`);
        const value = expression(args[0].expression());
        if (value.kind !== 'literal' || value.literalType !== 'string')
          fail(location(annotation), `@${annotationName} requires one literal path string`);
        if (method.typeParams.length || method.params.length || method.returnType.name !== 'string' || method.name === 'Main')
          fail(method.token, `@${annotationName} handlers must be non-generic, take no parameters and return String`);
        endpoints.push({ verb, path: value.value, handler: method.name });
      }
      functions.push(method);
    }
    else if (declaration.propertyDeclaration()) fail(location(declaration), 'Top-level properties are not supported by the P-code subset');
    else fail(location(declaration), 'Only top-level functions are supported by the P-code subset');
  }
  if (!endpoints.length && !functions.some(method => method.name === 'Main'))
    fail(location(tree), 'Kotlin source must declare fun main()');
  if (endpoints.length && functions.some(method => method.name === 'Main'))
    fail(location(tree), 'Kotlin services cannot declare fun main()');
  const imports = tree.importHeader();
  const supportedImports = [
    'importkotlin.io.*', 'importkotlin.io.println', 'importpulse.http.HttpGet',
    ...Object.keys(httpAnnotations).map(name => `importpulse.http.${name}`),
    'importpulse.http.*', 'importpulse.net.*',
    ...['requestBody', 'requestMethod', 'requestPath', 'requestPeer', 'requestQuery', 'requestHeader']
      .map(name => `importpulse.http.${name}`),
    ...['tcpExchange', 'udpExchange'].map(name => `importpulse.net.${name}`)
  ];
  const unsupportedImport = imports.find(item => !supportedImports.includes(item.getText()));
  if (unsupportedImport) fail(location(unsupportedImport), 'Unsupported Kotlin import in the P-code subset');
  return {
    token: location(tree),
    endpoints,
    hostImports: imports.map(item => item.getText()),
    usingSystem: true,
    classes: [{
      token: location(tree), name: 'Program', modifiers: new Set(['public']), methods: functions
    }]
  };
}
