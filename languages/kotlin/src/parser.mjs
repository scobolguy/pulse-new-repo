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

const SCALAR_TYPE_NAMES = {
  Byte: 'sbyte', Short: 'short', Int: 'int', Boolean: 'bool', String: 'string', Unit: 'void',
  IntArray: 'int-array', BooleanArray: 'bool-array', ByteArray: 'byte-array', ShortArray: 'short-array'
};

function parseTypeName(token, typeParameters, knownTypes) {
  const name = typeParameters.has(token.value) ? token.value
    : Object.hasOwn(SCALAR_TYPE_NAMES, token.value) ? SCALAR_TYPE_NAMES[token.value]
      : knownTypes.has(token.value) ? token.value : null;
  if (!name) fail(token, `Unsupported Kotlin type '${token.value}'`);
  return { name, nullable: false, ...token };
}

function parseType(ctx, fileName, typeParameters, knownTypes = new Set()) {
  const token = ctx.start;
  const position = { fileName, line: token.line, column: token.column + 1, sourceLanguage: 'kotlin' };
  const functionType = ctx.functionType?.();
  if (functionType) {
    if (ctx.QUESTION()) fail(position, 'Nullable function types are not supported by the P-code subset');
    const receiverContext = functionType.userType();
    const receiver = receiverContext
      ? parseTypeName({ ...position, value: receiverContext.getText() }, typeParameters, knownTypes) : null;
    if (receiver && (Object.values(SCALAR_TYPE_NAMES).includes(receiver.name) || typeParameters.has(receiver.name)))
      fail(position, 'Function-type receivers must be declared classes');
    const references = functionType.typeReference();
    const read = reference => parseType(reference, fileName, typeParameters, knownTypes);
    return { name: 'function', suspend: Boolean(ctx.SUSPEND()), receiver: receiver?.name ?? null,
      paramTypes: references.slice(0, -1).map(read), returnType: read(references.at(-1)),
      nullable: false, ...position };
  }
  const typeName = ctx.getText().replace(/\?$/, '').replace(/<.*>$/, '');
  const names = { Byte: 'sbyte', Short: 'short', Int: 'int', Boolean: 'bool', String: 'string',
    Exception: 'string', Throwable: 'string', Unit: 'void',
    IntArray: 'int-array', BooleanArray: 'bool-array', ByteArray: 'byte-array', ShortArray: 'short-array' };
  const identifier = /^`[^`]+`$/.test(typeName) ? typeName.slice(1, -1) : typeName;
  const name = typeParameters.has(identifier) ? identifier
    : Object.hasOwn(names, typeName) ? names[typeName]
      : knownTypes.has(identifier) ? identifier : null;
  if (!name) fail({ fileName, line: token.line, column: token.column + 1, sourceLanguage: 'kotlin' },
    `Unsupported Kotlin type '${typeName}'`);
  return { name, nullable: ctx.getText().endsWith('?'),
    fileName, line: token.line, column: token.column + 1, sourceLanguage: 'kotlin' };
}

function decodeString(raw, location) {
  if (raw.startsWith('"""')) fail(location, 'Multiline strings are not supported by the P-code subset');
  const body = raw.slice(1, -1);
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
  let tree;
  try {
    tree = parser.kotlinFile();
  } catch (error) {
    // Pathologically nested sources overflow the recursive-descent predictor;
    // report a located diagnostic instead of crashing the compiler.
    if (error instanceof RangeError)
      fail({ fileName, sourceLanguage: 'kotlin', line: 1, column: 1 },
        'Source nesting exceeds parser recursion limits in this subset');
    throw error;
  }
  if (errors.length) fail(errors[0], errors[0].message);

  const knownTypes = new Set();
  for (const declaration of tree.topLevelDeclaration()) {
    const classDeclaration = declaration.classDeclaration();
    const objectDeclaration = declaration.objectDeclaration();
    if (classDeclaration) knownTypes.add(idValue(classDeclaration.identifier()));
    if (objectDeclaration?.identifier()) knownTypes.add(idValue(objectDeclaration.identifier()));
  }
  let typeParameters = new Set();
  const readType = ctx => parseType(ctx, fileName, typeParameters, knownTypes);

  function scalarMemberCall(value, call) {
    const argumentsList = call.valueArguments()?.valueArgument() || [];
    if (value.member === 'rangeTo') {
      if (call.lambdaLiteral?.() || call.typeArguments() || argumentsList.length !== 1)
        fail(value.token, 'rangeTo requires one argument and no type arguments');
      return { kind: 'binary', token: value.token, op: '..', left: value.value,
        right: expression(argumentsList[0].expression()) };
    }
    if (call.lambdaLiteral?.() || call.typeArguments() || argumentsList.length)
      fail(value.token, `${value.member} requires no arguments or type arguments`);
    return value.member === 'toString'
      ? { kind: 'scalar-string', token: value.token, value: value.value }
      : { kind: 'overflow', token: value.token, checked: false,
        value: { kind: 'convert', token: value.token, value: value.value,
          targetType: { toByte: 'sbyte', toShort: 'short', toInt: 'int' }[value.member] } };
  }

  function stringExpression(raw, token) {
    if (raw.startsWith('"""')) fail(token, 'Multiline strings are not supported by the P-code subset');
    const body = raw.slice(1, -1);
    const literal = value => ({ kind: 'literal', token, literalType: 'string', value });
    let result = literal(''), start = 0;
    const append = value => { result = { kind: 'binary', token, op: '+', left: result, right: value }; };
    for (let index = 0; index < body.length; index++) {
      if (body[index] === '\\') { index++; continue; }
      if (body[index] !== '$' || !/[\{a-zA-Z_]/.test(body[index + 1] || '')) continue;
      append(literal(decodeString(`"${body.slice(start, index)}"`, token)));
      const offset = index + (body[index + 1] === '{' ? 2 : 1);
      const prefix = body.slice(0, offset);
      const line = token.line + (prefix.match(/\n/g) || []).length;
      const column = prefix.includes('\n') ? prefix.length - prefix.lastIndexOf('\n') - 1 : token.column + offset;
      if (body[index + 1] !== '{') {
        const name = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(body.slice(offset))[0];
        append({ kind: 'name', name, token: { ...token, line, column: column + 1, value: name } });
        index = offset + name.length - 1;
      } else {
        const fragmentLexer = new KotlinLexer(new antlr4.InputStream(body.slice(offset)));
        class TemplateListener extends antlr4.error.ErrorListener {
          syntaxError(recognizer, symbol, fragmentLine, fragmentColumn, message) {
            fail({ ...token, line: line + fragmentLine - 1,
              column: fragmentColumn + 1 + (fragmentLine === 1 ? column : 0) }, message);
          }
        }
        fragmentLexer.removeErrorListeners();
        fragmentLexer.addErrorListener(new TemplateListener());
        const fragmentTokens = new antlr4.CommonTokenStream(fragmentLexer);
        const fragmentParser = new KotlinParser(fragmentTokens);
        fragmentParser.removeErrorListeners();
        fragmentParser.addErrorListener(new TemplateListener());
        const parsed = fragmentParser.expression();
        const closing = fragmentTokens.LT(1);
        if (closing.type !== KotlinLexer.RBRACE) fail(token, 'Expected closing } in string template');
        for (const item of fragmentTokens.tokens) {
          item.column += item.line === 1 ? column : 0;
          item.line += line - 1;
        }
        append(expression(parsed));
        index = offset + closing.start;
      }
      start = index + 1;
    }
    if (!start) return literal(decodeString(raw, token));
    append(literal(decodeString(`"${body.slice(start)}"`, token)));
    return result;
  }

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

  function whenExpression(ctx, statementMode = false) {
    const subjectContext = ctx.expression();
    if (!subjectContext && !statementMode)
      fail(location(ctx), 'Subjectless when expressions are not supported by the P-code subset');
    const subjectValue = subjectContext ? expression(subjectContext) : null;
    if (!statementMode && subjectValue.kind !== 'name' && subjectValue.kind !== 'literal')
      fail(location(subjectContext), 'A when expression subject must be a local value or literal in this subset');
    const subjectName = `$pulse$whenSubject$${ctx.start.tokenIndex}`;
    const subject = statementMode && subjectContext
      ? { kind: 'name', token: { ...location(subjectContext), value: subjectName }, name: subjectName }
      : subjectValue;
    const entries = ctx.whenEntry();
    const elseIndex = entries.findIndex(entry => entry.ELSE());
    if ((!statementMode && elseIndex < 0) || elseIndex >= 0 && elseIndex !== entries.length - 1)
      fail(location(ctx), 'A when expression requires a final else branch in this subset');

    function branch(entry) {
      const body = entry.controlStructureBody();
      if (statementMode) return controlBody(body);
      const statements = body.block() ? body.block().statement() : [body.statement()];
      if (statements.length !== 1 || !statements[0].expression())
        fail(location(entry), 'When expression branches must contain one expression in this subset');
      return expression(statements[0].expression());
    }

    function condition(entry) {
      const conditions = entry.whenCondition();
      if (!conditions.length) fail(location(entry), 'A when branch requires a condition');
      let result;
      for (const item of conditions) {
        if (item.IS() || item.NOT_IS() || !item.expression() ||
            (!subject && (item.IN() || item.NOT_IN())))
          fail(location(item), 'When branches support only equality and integer range conditions in this subset');
        const value = expression(item.expression());
        let matches;
        if (!subject) {
          matches = value;
        } else if (item.IN() || item.NOT_IN()) {
          if (value.kind !== 'binary' || !['..', '..<'].includes(value.op))
            fail(location(item), 'When membership conditions require an integer range');
          matches = {
            kind: 'range-test', token: location(item), value: subject,
            start: value.left, end: value.right, exclusive: value.op === '..<',
            negated: Boolean(item.NOT_IN())
          };
        } else {
          matches = { kind: 'binary', token: location(item), op: '==', left: subject, right: value };
        }
        result = result
          ? { kind: 'binary', token: location(item), op: '||', left: result, right: matches }
          : matches;
      }
      return result;
    }
    let alternative = elseIndex >= 0 ? branch(entries[elseIndex]) : null;
    for (let index = (elseIndex >= 0 ? elseIndex : entries.length) - 1; index >= 0; index--) {
      const entry = entries[index];
      alternative = statementMode
        ? { kind: 'if', token: location(entry), condition: condition(entry),
          then: branch(entry), otherwise: alternative }
        : { kind: 'conditional', token: location(entry), condition: condition(entry),
          yes: branch(entry), no: alternative };
    }
    if (!statementMode) return alternative;
    return {
      kind: 'block', token: location(ctx), statements: [
        ...(subjectContext ? [{
          kind: 'declare', token: location(ctx), infer: true,
          declarations: [{ token: { ...location(subjectContext), value: subjectName },
            mutable: false, value: subjectValue }]
        }] : []),
        ...(alternative ? [alternative] : [])
      ]
    };
  }

  function topLevelWhen(context) {
    let current = context;
    while (ruleName(parser, current) !== 'primaryExpression') {
      const children = ruleChildren(current);
      if (children.length !== 1) return null;
      current = children[0];
    }
    return current.whenExpression();
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
      const left = expression(operands[0]);
      const op = operator.getText();
      const right = expression(operands[1]);
      if (left.kind === 'property') {
        // Property writes lower to the synthesized setter; compound writes
        // reread through the getter, so the receiver must be re-evaluable.
        if (left.safe) fail(left.token, 'Safe-call property assignment is not supported');
        if (op !== '=' && left.receiver.kind !== 'name')
          fail(location(operator), 'Compound property assignment requires a simple receiver');
        const value = op === '=' ? right : {
          kind: 'binary', token: location(operator), op: op[0],
          left: structuredClone(left), right,
        };
        return { kind: 'call', token: location(operator), receiver: left.receiver, safe: false,
          name: `set${left.name[0].toUpperCase()}${left.name.slice(1)}`, args: [value], typeArgs: [] };
      }
      return {
        kind: 'assign', token: location(operator),
        op, left, right
      };
    }
    if (name === 'elvisExpression' || name === 'disjunctionExpression' || name === 'conjunctionExpression'
        || name === 'equalityExpression' || name === 'comparisonExpression' || name === 'rangeExpression'
        || name === 'additiveExpression' || name === 'multiplicativeExpression') {
      const children = ruleChildren(ctx);
      // ANTLR prefers the comparison parse of `f<Type> { ... }`; rebuild the
      // single-type-argument trailing-lambda call that Kotlin actually means.
      if (name === 'comparisonExpression' && children.length === 3) {
        const operators = ctx.children.filter(child => child.symbol).map(child => child.getText());
        const reduce = context => {
          let current = context;
          while (ruleName(parser, current) !== 'postfixUnaryExpression') {
            const inner = ruleChildren(current);
            if (inner.length !== 1 || current.children.length !== 1) return null;
            current = inner[0];
          }
          return current.children.length === 1 ? ruleChildren(current)[0] : null;
        };
        const [callee, typeName, operand] = children.map(reduce);
        const lambda = operand?.lambdaLiteral?.();
        if (operators[0] === '<' && operators[1] === '>' && callee?.identifier?.() && typeName?.identifier?.() && lambda) {
          const typeToken = location(typeName.identifier());
          return {
            kind: 'call', token: location(ctx), name: idValue(callee.identifier()), receiver: null, safe: false,
            typeArgs: [parseTypeName(typeToken, typeParameters, knownTypes)], args: [readLambda(lambda)],
          };
        }
      }
      let value = expression(children[0]);
      for (let index = 1; index < children.length; index++) {
        const operator = ctx.children.find((child, childIndex) =>
          childIndex > ctx.children.indexOf(children[index - 1])
          && childIndex < ctx.children.indexOf(children[index])
          && child.symbol)?.getText();
        if (!operator) fail(location(children[index]), 'Unsupported Kotlin operator');
        const token = location(ctx.children[ctx.children.indexOf(children[index]) - 1]);
        const right = expression(children[index]);
        if (operator === 'in' || operator === '!in') {
          if (right.kind === 'binary' && ['..', '..<'].includes(right.op)) {
            value = { kind: 'range-test', token, value, start: right.left, end: right.right,
              exclusive: right.op === '..<', negated: operator === '!in' };
          } else if (right.kind === 'call' && right.args.length === 0) {
            value = { kind: 'call', token, name: `${right.name}.contains`, args: [value],
              typeArgs: [], negated: operator === '!in' };
          } else fail(token, 'Membership requires an integer range or a stateless contains operator');
        } else value = { kind: 'binary', token, op: operator, left: value, right };
      }
      return value;
    }
    if (name === 'infixExpression') {
      const children = ruleChildren(ctx);
      let value = expression(children[0]);
      // `until` is the only lowered infix function: it is the canonical
      // exclusive range spelling in the corpus and maps directly onto ..<.
      for (let index = 1; index < children.length; index += 2) {
        if (idValue(children[index]) !== 'until')
          fail(location(children[index]), 'Infix function calls are not supported by the P-code subset');
        value = { kind: 'binary', token: location(children[index]), op: '..<',
          left: value, right: expression(children[index + 1]) };
      }
      return value;
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
        const indexing = suffix.indexingSuffix?.();
        if (indexing) {
          const argumentsList = indexing.expressionList()?.expression() || [];
          if (argumentsList.length !== 1) fail(location(indexing), 'Only one-dimensional array indexing is supported');
          value = { kind: 'index-get', token: location(indexing), receiver: value,
            index: expression(argumentsList[0]) };
          continue;
        }
        const call = suffix.callSuffix();
        if (call) {
          if (value.kind === 'scalar-member') {
            value = scalarMemberCall(value, call);
            continue;
          }
          if (value.kind !== 'name' && value.kind !== 'callable-reference')
            fail(location(suffix), 'Only direct function calls are supported');
          const trailing = call.lambdaLiteral();
          if (trailing && value.kind !== 'name')
            fail(location(suffix), 'Trailing lambdas require a direct function call');
          const typeArgs = (call.typeArguments()?.typeProjection() || []).map(projection => {
            if (projection.IN() || projection.OUT() || projection.MUL())
              fail(location(projection), 'Type projections are not supported in function calls');
            return readType(projection.typeReference());
          });
          const args = (call.valueArguments()?.valueArgument() || []).map(argument => {
            if (argument.identifier() || argument.MUL()) fail(location(argument), 'Named and spread arguments are not supported');
            return expression(argument.expression());
          });
          if (trailing) args.push(readLambda(trailing));
          const directName = value.kind === 'callable-reference' ? value.member : value.name;
          const name = directName === 'println' ? 'Console.WriteLine'
            : directName === 'print' ? 'Console.Write' : directName;
          const arrayType = { IntArray: 'int-array', BooleanArray: 'bool-array',
            ByteArray: 'byte-array', ShortArray: 'short-array' }[name];
          value = arrayType && args.length === 1
            ? { kind: 'array-new', token: location(ctx), length: args[0], arrayType }
            : { kind: 'call', token: location(ctx), name, args, typeArgs,
              receiver: value.kind === 'callable-reference' ? value.receiver : null,
              safe: value.kind === 'callable-reference' && value.safe };
        } else if (suffix.INCR() || suffix.DECR()) {
          value = { kind: 'increment', token: location(suffix), op: suffix.getText(), value, prefix: false };
        } else if (suffix.navigationSuffix()?.getText() === '.length') {
          value = { kind: 'string-length', token: location(suffix), value };
        } else if (suffix.navigationSuffix()?.DOT()
            && ['rangeTo', 'toByte', 'toShort', 'toInt', 'toString'].includes(suffix.navigationSuffix().identifier().getText())) {
          const navigation = suffix.navigationSuffix();
          value = { kind: 'scalar-member', token: location(suffix), value,
            member: navigation.identifier().getText() };
          if (navigation.typeArguments() || navigation.valueArguments()) {
            if (!navigation.valueArguments()) fail(value.token, `${value.member} requires a function call`);
            value = scalarMemberCall(value, navigation);
          }
        } else if (value.kind === 'name' && value.name === 'Int'
            && ['.MIN_VALUE', '.MAX_VALUE'].includes(suffix.navigationSuffix()?.getText())) {
          const minimum = suffix.navigationSuffix().getText() === '.MIN_VALUE';
          const literal = { kind: 'literal', token: location(suffix), literalType: 'int', value: minimum ? '2147483648' : '2147483647' };
          value = minimum ? { kind: 'unary', token: location(suffix), op: '-', value: literal } : literal;
        } else if (suffix.navigationSuffix()?.DOT() || suffix.navigationSuffix()?.SAFE_ACCESS()) {
          const navigation = suffix.navigationSuffix();
          const member = navigation.identifier()?.getText();
          if (!member) fail(location(suffix), 'Unsupported Kotlin navigation suffix');
          const argumentsList = navigation.valueArguments()?.valueArgument() || [];
          if (argumentsList.some(argument => argument.identifier() || argument.MUL()))
            fail(location(suffix), 'Named and spread arguments are not supported');
          value = argumentsList.length || navigation.valueArguments()
            ? { kind: 'call', token: location(suffix), name: member,
              receiver: value, args: argumentsList.map(argument => expression(argument.expression())), typeArgs: [],
              safe: Boolean(navigation.SAFE_ACCESS()) }
            : { kind: 'property', token: location(suffix), name: member,
              receiver: value, safe: Boolean(navigation.SAFE_ACCESS()) };
        } else if (suffix.EXCLEXCL?.()) {
          value = { kind: 'not-null', token: location(suffix), value };
        } else {
          fail(location(suffix), 'Property access, indexing, and null assertions are not supported by the P-code subset');
        }
      }
      if (value.kind === 'scalar-member')
        fail(value.token, `${value.member || 'property'} requires a function call`);
      return value;
    }
    if (name === 'primaryExpression') {
      if (ctx.literalConstant()) {
        const literal = ctx.literalConstant();
        const token = literal.start;
        const raw = literal.getText();
        if (raw === 'true' || raw === 'false')
          return { kind: 'literal', token: location(literal), literalType: 'bool', value: raw === 'true' };
        if (raw === 'null')
          return { kind: 'literal', token: location(literal), literalType: 'null', nullLiteral: true, value: 0 };
        if (/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|[\d][\d_]*)$/.test(raw))
          return { kind: 'literal', token: location(literal), literalType: 'int', value: raw.replaceAll('_', '') };
        if (/^'(?:[^'\\]|\\.)'$/.test(raw)) {
          const value = raw[1] === '\\' ? ({ n: 10, r: 13, t: 9, '\\': 92, "'": 39 }[raw[2]] ?? raw.charCodeAt(2)) : raw.charCodeAt(1);
          return { kind: 'literal', token: location(literal), literalType: 'int', value };
        }
        if (raw.startsWith('"'))
          return stringExpression(raw, location(literal));
        fail(location(literal), `Unsupported Kotlin literal '${raw}'`);
      }
      if (ctx.identifier()) return { kind: 'name', token: location(ctx.identifier()), name: idValue(ctx.identifier()) };
      if (ctx.THIS()) {
        if (ctx.AT()) fail(location(ctx), 'Labeled this expressions are not supported by the P-code subset');
        return { kind: 'this', token: location(ctx) };
      }
      if (ctx.lambdaLiteral()) return readLambda(ctx.lambdaLiteral());
      if (ctx.callableReference()) {
        const reference = ctx.callableReference();
        if (reference.CLASS()) fail(location(reference), 'Class literals and reflection are not supported by the P-code subset');
        const member = idValue(reference.identifier());
        let receiver = null;
        if (reference.THIS()) receiver = { kind: 'this', token: location(reference) };
        else if (reference.userType()) {
          const text = reference.userType().getText();
          if (text.includes('.') || text.includes('<'))
            fail(location(reference), 'Qualified callable references are not supported by the P-code subset');
          receiver = { kind: 'name', token: { ...location(reference), value: text }, name: text };
        }
        return { kind: 'callable-reference', token: location(ctx), member, receiver, safe: false };
      }
      if (ctx.expression()) return expression(ctx.expression());
      if (ctx.ifExpression()) return conditionalExpression(ctx.ifExpression());
      if (ctx.whenExpression()) return whenExpression(ctx.whenExpression());
      if (ctx.tryExpression()) return tryStatement(ctx.tryExpression());
      if (ctx.jumpExpression()) {
        const jump = ctx.jumpExpression();
        if (jump.AT()) fail(location(jump), 'Labeled jumps are not supported by the P-code subset');
        if (jump.RETURN()) return { kind: 'return', token: location(jump), value: jump.expression() ? expression(jump.expression()) : null };
        if (jump.THROW()) return { kind: 'throw', token: location(jump), value: expression(jump.expression()) };
        if (jump.BREAK() || jump.CONTINUE())
          return { kind: jump.BREAK() ? 'break' : 'continue', token: location(jump) };
        fail(location(jump), 'Unsupported Kotlin jump expression');
      }
      fail(location(ctx), 'Unsupported Kotlin expression');
    }
    fail(location(ctx), `Unsupported Kotlin expression form '${name}'`);
  }

  function readBlock(ctx) {
    return { kind: 'block', token: location(ctx), statements: ctx.statement().map(statement) };
  }

  function readLambda(ctx) {
    const params = (ctx.lambdaParameters()?.lambdaParameter() || []).map(parameter => ({
      token: location(parameter.identifier()),
      type: parameter.typeReference() ? readType(parameter.typeReference()) : null,
    }));
    return { kind: 'lambda', token: location(ctx), params,
      body: { kind: 'block', token: location(ctx), statements: ctx.statement().map(statement) } };
  }

  function tryStatement(ctx) {
    const catchBlocks = ctx.catchBlock();
    if (catchBlocks.length > 1)
      fail(location(ctx), 'Only one Kotlin catch handler is supported by the scalar P-code subset');
    const catches = catchBlocks.map(catchBlock => {
      const parameter = catchBlock.identifier();
      const typeReference = catchBlock.typeReference();
      const typeName = typeReference.userType()?.getText();
      if (!typeName)
        fail(location(typeReference), 'Catch parameter types must be named exception types');
      return {
        parameter: { token: location(parameter), name: idValue(parameter), type: { name: 'catch-value', exceptionType: typeName } },
        body: readBlock(catchBlock.block())
      };
    });
    return {
      kind: 'try', token: location(ctx), body: readBlock(ctx.block()), catches,
      finallyBody: ctx.finallyBlock() ? readBlock(ctx.finallyBlock().block()) : null
    };
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
      let range = expression(loop.expression());
      // xs.indices is 0 until xs.size; the receiver must be a simple name so
      // re-evaluating it for the bound cannot repeat side effects.
      if (range.kind === 'property' && range.name === 'indices' && !range.safe
        && range.receiver?.kind === 'name') {
        range = { kind: 'binary', token: range.token, op: '..<',
          left: { kind: 'literal', token: range.token, literalType: 'int', value: '0' },
          right: { kind: 'property', token: range.token, name: 'size', receiver: range.receiver, safe: false } };
      }
      if (range.kind !== 'binary' || !['..', '..<'].includes(range.op)) {
        // for (x in xs): bind the sequence once, then loop by index. A
        // non-array sequence fails cleanly at the size/index type checks.
        const marker = identifier.start.tokenIndex;
        const seqToken = { ...location(loop), value: `$pulse$seq$${marker}` };
        const idxToken = { ...location(identifier), value: `$pulse$idx$${marker}` };
        const endToken = { ...location(identifier), value: `$pulse$rangeEnd$${marker}` };
        const seqVariable = { kind: 'name', token: seqToken, name: seqToken.value };
        const idxVariable = { kind: 'name', token: idxToken, name: idxToken.value };
        const limitVariable = { kind: 'name', token: endToken, name: endToken.value };
        const element = { kind: 'declare', token: location(identifier), infer: true, type: { name: 'int' },
          declarations: [{ token: location(identifier), mutable: false,
            value: { kind: 'index-get', token: location(identifier), receiver: seqVariable, index: idxVariable } }] };
        return { kind: 'block', token: location(loop), statements: [
          { kind: 'declare', token: location(loop), infer: true, type: { name: 'int' },
            declarations: [{ token: seqToken, mutable: false, value: range }] },
          { kind: 'for', token: location(loop), inclusiveRange: false,
            init: { kind: 'declare', token: location(loop), type: { name: 'int' }, declarations: [
              { token: idxToken, mutable: false,
                value: { kind: 'literal', token: location(loop), literalType: 'int', value: '0' } },
              { token: endToken, mutable: false,
                value: { kind: 'property', token: location(loop), name: 'size', receiver: seqVariable,
                  safe: false, forSequence: true } }
            ] },
            condition: { kind: 'binary', token: location(loop), op: '<', left: idxVariable, right: limitVariable },
            increment: [{ kind: 'increment', token: location(identifier), op: '++', value: idxVariable,
              prefix: true, compilerGenerated: true }],
            body: { kind: 'block', token: location(loop),
              statements: [element, ...(body.kind === 'block' ? body.statements : [body])] } }
        ] };
      }
      const inclusiveRange = range.op === '..';
      const endToken = { ...location(identifier), value: `$pulse$rangeEnd$${identifier.start.tokenIndex}` };
      const loopName = idValue(identifier);
      const loopVariable = { kind: 'name', token: location(identifier), name: loopName };
      const limitVariable = { kind: 'name', token: endToken, name: endToken.value };
      return {
        kind: 'for', token: location(loop), inclusiveRange,
        init: {
          kind: 'declare', token: location(loop), type: { name: 'int' }, declarations: [
            { token: location(identifier), mutable: false, value: range.left },
            { token: endToken, mutable: false, value: range.right }
          ]
        },
        condition: {
          kind: 'binary', token: range.token, op: inclusiveRange ? '<=' : '<',
          left: loopVariable, right: limitVariable
        },
        increment: [{
          kind: 'increment', token: location(identifier), op: '++', value: loopVariable,
          prefix: true, compilerGenerated: true
        }],
        body
      };
    }
    if (ctx.expression()) {
      const when = topLevelWhen(ctx.expression());
      if (when) return whenExpression(when, true);
      const value = expression(ctx.expression());
      if (['return', 'break', 'continue', 'try'].includes(value.kind)) return value;
      return { kind: 'expressions', token, values: [value] };
    }
    if (ctx.functionDeclaration() || ctx.classDeclaration() || ctx.objectDeclaration())
      fail(token, 'Nested declarations are not supported by the P-code subset');
    fail(token, 'Unsupported Kotlin statement');
  }

  function readFunction(ctx, owner = 'Program', forcedName = null) {
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
    const receiverContext = typeof ctx.functionReceiver === 'function' ? ctx.functionReceiver() : null;
    let extensionReceiver = null;
    if (receiverContext) {
      // Extensions on classes declared in this file become synthesized
      // members; scalar, nullable, generic and foreign receivers are rejected.
      const receiverName = receiverContext.userType()?.getText().replace(/<.*>$/, '');
      if (!receiverContext.userType() || receiverContext.QUESTION())
        fail(location(receiverContext), 'Extension receivers must be non-null declared classes in this subset');
      if (!knownTypes.has(receiverName))
        fail(location(receiverContext), `Extension functions require a class declared in this file, not '${receiverName}'`);
      extensionReceiver = receiverName;
    }
    const nameToken = location(ctx.identifier());
    const params = (ctx.valueParameters().valueParameter() || []).map(parameter => {
      if (parameter.VAL() || parameter.VAR()) fail(location(parameter), 'Function parameters cannot use val or var here');
      const modifiers = parameter.parameterModifier().map(item => item.getText())
        .filter(text => !text.startsWith('@')); // parameter annotations carry no runtime behavior here
      if (modifiers.some(item => item !== 'vararg'))
        fail(location(parameter), 'Function parameter modifiers are not supported by the P-code subset');
      return { token: location(parameter.identifier()), type: readType(parameter.typeReference()),
        vararg: modifiers.includes('vararg'),
        defaultValue: parameter.expression() ? expression(parameter.expression()) : null };
    });
    const firstDefault = params.findIndex(param => param.defaultValue);
    if (firstDefault >= 0 && params.slice(firstDefault).some(param => !param.defaultValue))
      fail(nameToken, 'Only trailing positional default parameters are supported in this subset');
    const body = ctx.functionBody();
    if (!body)
      fail(nameToken, 'Function declarations without bodies require interface or abstract-class dispatch, which this subset does not provide');
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
      token: nameToken, name: forcedName || (nameToken.value === 'main' ? 'Main' : nameToken.value),
      owner, returnType, typeParams, params, body: block, extensionReceiver,
      modifiers: new Set(['public', 'static']), attributes: [], block
    };
  }

  // Rewrites a method body so bare field reads route through the synthesized
  // getters, field writes through setters, explicit `this` becomes the hidden
  // receiver parameter, and bare sibling-member calls dispatch on it. Used for
  // declared members of stateful classes and for attached extension functions.
  function convertToInstanceMethod(method, className, fields, memberNames) {
    const fieldIndex = new Map(fields.map(field => [field.name, field]));
    const thisRef = token => ({ kind: 'name', token: { ...token, value: '$this' }, name: '$this' });
    const rewrite = (node, blocked) => {
      if (Array.isArray(node)) return node.map(item => rewrite(item, blocked));
      if (!node || typeof node !== 'object') return node;
      if (!node.kind) {
        const result = {};
        for (const [key, value] of Object.entries(node))
          result[key] = value && typeof value === 'object' ? rewrite(value, blocked) : value;
        return result;
      }
      if (node.kind === 'block') {
        const scope = new Set(blocked);
        const statements = node.statements.map(statementNode => {
          const result = rewrite(statementNode, scope);
          if (statementNode.kind === 'declare')
            for (const declaration of statementNode.declarations) scope.add(declaration.token.value);
          return result;
        });
        return { ...node, statements };
      }
      if (node.kind === 'lambda') {
        const shadowed = new Set([...blocked, ...(node.params || []).map(param => param.token.value)]);
        return { ...node, body: rewrite(node.body, shadowed) };
      }
      if (node.kind === 'this') return thisRef(node.token);
      if (node.kind === 'name' && fieldIndex.has(node.name) && !blocked.has(node.name))
        return { kind: 'property', token: node.token, name: node.name, receiver: thisRef(node.token), safe: false };
      if (node.kind === 'assign' && node.left.kind === 'name'
        && fieldIndex.has(node.left.name) && !blocked.has(node.left.name)) {
        const field = fieldIndex.get(node.left.name);
        if (!field.mutable) fail(node.token, `Val '${node.left.name}' cannot be reassigned`);
        const right = rewrite(node.right, blocked);
        const property = { kind: 'property', token: node.left.token, name: node.left.name,
          receiver: thisRef(node.left.token), safe: false };
        const value = node.op === '=' ? right
          : { kind: 'binary', token: node.token, op: node.op[0], left: property, right };
        return { kind: 'call', token: node.token, receiver: thisRef(node.token), safe: false,
          name: `set${node.left.name[0].toUpperCase()}${node.left.name.slice(1)}`, args: [value], typeArgs: [] };
      }
      if (node.kind === 'call' && !node.receiver && memberNames.has(node.name) && !blocked.has(node.name))
        return { ...node, receiver: thisRef(node.token),
          args: node.args.map(argument => rewrite(argument, blocked)) };
      const result = {};
      for (const [key, value] of Object.entries(node))
        result[key] = key === 'token' || key === 'type' ? value
          : value && typeof value === 'object' ? rewrite(value, blocked) : value;
      return result;
    };
    method.body = rewrite(method.body, new Set(method.params.map(param => param.token.value)));
    method.block = method.body;
    method.instance = true;
    method.params.unshift({ token: { ...method.token, value: '$this' }, type: { name: className }, synthetic: true });
    method.modifiers.delete('static');
  }

  function readClass(ctx) {
    const name = idValue(ctx.identifier());
    const supertypes = (typeof ctx.delegationSpecifiers === 'function'
      ? ctx.delegationSpecifiers()?.delegationSpecifier() || [] : [])
      .map(specifier => specifier.typeReference().getText().replace(/\?$/, '').replace(/<.*>$/, ''));
    // Object declarations have no typeParameters or primaryConstructor grammar
    // rules, so their parse contexts lack those accessors entirely.
    const classTypeParams = (typeof ctx.typeParameters === 'function'
      ? ctx.typeParameters()?.typeParameter() || [] : []).map(parameter => location(parameter.identifier()));
    typeParameters = new Set(classTypeParams.map(token => token.value));
    const methods = [], constructors = [];
    const constructor = typeof ctx.primaryConstructor === 'function' ? ctx.primaryConstructor() : null;
    const fields = [];
    if (constructor) {
      const constructorParameters = constructor.valueParameters()?.valueParameter() || [];
      const stateful = constructorParameters.some(parameter => parameter.VAL() || parameter.VAR());
      const params = constructorParameters.map(parameter => {
        const token = location(parameter.identifier());
        const type = readType(parameter.typeReference());
        const modifiers = parameter.parameterModifier().map(item => item.getText());
        if (stateful && !parameter.VAL() && !parameter.VAR())
          fail(token, 'Primary constructor parameters must be marked val or var in stateful classes');
        // Property types widen beyond non-null scalars: arrays are managed
        // objects and declared classes are object references (null-able), so
        // both store directly in the property bag with zero ABI changes.
        const fieldTypes = ['int', 'byte', 'short', 'ushort', 'sbyte', 'bool', 'string',
          'int-array', 'bool-array', 'byte-array', 'short-array'];
        if (stateful && !((!type.nullable && fieldTypes.includes(type.name)) || knownTypes.has(type.name)))
          fail(type, 'Stateful constructor properties support scalar, array and declared class types');
        if (parameter.VAL() || parameter.VAR())
          fields.push({ name: token.value, type: type.name, mutable: Boolean(parameter.VAR()), token });
        return { token, type, defaultValue: null, vararg: false, field: true, modifiers };
      });
      constructors.push({
        token: location(ctx.identifier()), name, owner: 'Program', returnType: { name, ...location(ctx.identifier()) },
        typeParams: classTypeParams, params, body: { kind: 'block', token: location(ctx), statements: [
          { kind: 'return', token: location(ctx), value: { kind: 'object-value', token: location(ctx), typeName: name } }
        ]}, modifiers: new Set(['public', 'static']), attributes: [], block: null,
        constructorType: name, fields
      });
    }
    if (!constructor) {
      constructors.push({
        token: location(ctx.identifier()), name, owner: 'Program', returnType: { name, ...location(ctx.identifier()) },
        typeParams: classTypeParams, params: [], body: { kind: 'block', token: location(ctx), statements: [
          { kind: 'return', token: location(ctx), value: { kind: 'object-value', token: location(ctx), typeName: name } }
        ]}, modifiers: new Set(['public', 'static']), attributes: [], block: null,
        constructorType: name, fields: []
      });
    }
    // Members below carry executable semantics that this subset does not
    // lower (init blocks run on construction, companion initializers on class
    // load, secondary constructors on dispatch). Silently dropping them would
    // miscompile side effects, so they are rejected up front.
    for (const member of ctx.classBody()?.classMember() || []) {
      if (typeof member.initializer === 'function' && member.initializer())
        fail(location(member), 'Class init blocks are not supported by the P-code subset');
      if (typeof member.companionObject === 'function' && member.companionObject())
        fail(location(member), 'Companion objects are not supported by the P-code subset');
      if (typeof member.secondaryConstructor === 'function' && member.secondaryConstructor())
        fail(location(member), 'Secondary constructors are not supported by the P-code subset');
    }
    // Plain member properties with initializers become object fields appended
    // after any constructor-property fields. Members with unsupported types or
    // initializers are skipped rather than rejected: accessing one fails at
    // its use site, while classes that never touch them stay compilable.
    const fieldInitializers = [];
    for (const member of ctx.classBody()?.classMember() || []) {
      const property = member.propertyDeclaration();
      if (!property || property.propertyAccessor()?.length) continue;
      const token = location(property.identifier());
      let explicit = null, value = null;
      try {
        explicit = property.typeReference() ? readType(property.typeReference()) : null;
        value = property.expression() ? expression(property.expression()) : null;
      } catch {
        continue;
      }
      if (!value) continue;
      const type = explicit?.name
        ?? (value.kind === 'literal' ? { int: 'int', bool: 'bool', string: 'string' }[value.literalType] : null);
      if (!type || explicit?.nullable || !['int', 'sbyte', 'short', 'bool', 'string'].includes(type)) continue;
      fieldInitializers.push({ index: fields.length, value, type });
      fields.push({ name: token.value, type, mutable: Boolean(property.VAR()), token });
    }
    for (const constructed of constructors) {
      constructed.fields = fields;
      constructed.fieldInitializers = fieldInitializers;
    }
    for (const field of fields) {
      methods.push({
        token: field.token, name: `get${field.name[0].toUpperCase()}${field.name.slice(1)}`,
        owner: name, instance: true, returnType: { name: field.type, ...field.token },
        typeParams: [], params: [{ token: { ...field.token, value: '$this' }, type: { name }, synthetic: true }],
        body: { kind: 'block', token: field.token, statements: [
          { kind: 'return', token: field.token, value: { kind: 'field-get', token: field.token, index: fields.indexOf(field), type: field.type } }
        ]}, modifiers: new Set(['public']), attributes: [], block: null
      });
      if (!field.mutable) continue;
      methods.push({
        token: field.token, name: `set${field.name[0].toUpperCase()}${field.name.slice(1)}`,
        owner: name, instance: true, returnType: { name: 'void', ...field.token },
        typeParams: [], params: [
          { token: { ...field.token, value: '$this' }, type: { name }, synthetic: true },
          { token: { ...field.token, value: '$value' }, type: { name: field.type, ...field.token } },
        ],
        body: { kind: 'block', token: field.token, statements: [{
          kind: 'expressions', token: field.token, values: [{
            kind: 'field-set', token: field.token, index: fields.indexOf(field), type: field.type,
            value: { kind: 'name', token: { ...field.token, value: '$value' }, name: '$value' },
          }],
        }] }, modifiers: new Set(['public']), attributes: [], block: null
      });
    }
    const memberFunctions = [];
    for (const member of ctx.classBody()?.classMember() || []) {
      const functionDeclaration = member.functionDeclaration();
      if (functionDeclaration) {
        if (typeof functionDeclaration.functionReceiver === 'function' && functionDeclaration.functionReceiver())
          fail(location(functionDeclaration), 'Member extension functions are not supported by the P-code subset');
        // Abstract members carry no executable body; concrete callers are
        // diagnosed at their call sites when resolution fails.
        if (!functionDeclaration.functionBody()) continue;
        const method = readFunction(functionDeclaration, name);
        methods.push(method);
        memberFunctions.push(method);
      }
      const property = member.propertyDeclaration();
      if (property?.propertyAccessor()?.length) {
        const accessor = property.propertyAccessor().find(item => item.GET());
        if (accessor?.functionBody()) {
          const getter = accessor.functionBody();
          const token = location(property.identifier());
          const body = getter.block()
            ? readBlock(getter.block())
            : { kind: 'block', token, statements: [{ kind: 'return', token, value: expression(getter.expression()) }] };
          methods.push({ token, name: `get${idValue(property.identifier())}`, owner: name,
            returnType: readType(property.typeReference()), typeParams: [], params: [], body,
            modifiers: new Set(['public', 'static']), attributes: [], block: body });
        }
      }
    }
    // Members of stateful classes become instance methods: bare field reads
    // route through the synthesized getters, field writes through setters, and
    // sibling member calls dispatch on the implicit receiver. Object
    // declarations keep their static lowering.
    if (fields.length && typeof ctx.primaryConstructor === 'function' && memberFunctions.length) {
      const memberNames = new Set(memberFunctions.map(method => method.name));
      for (const method of memberFunctions) convertToInstanceMethod(method, name, fields, memberNames);
    }
    typeParameters = new Set();
    return { token: location(ctx.identifier()), name, modifiers: new Set(['public']), methods, constructors, supertypes };
  }

  const pendingInference = [];

  function inferExpressionType(ctx, params) {
    const node = expression(ctx);
    const localTypes = new Map(params.map(param => [param.token.value, param.type]));
    const type = inferValueType(node, localTypes, null);
    if (type) return { name: type, ...location(ctx) };
    // Defer: calls to functions declared elsewhere in the file resolve once
    // every top-level return type is known. The placeholder object is shared
    // by reference, so resolving it updates the owning method in place.
    const placeholder = { name: '$pending-inference', ...location(ctx) };
    pendingInference.push({ placeholder, node, localTypes, token: location(ctx) });
    return placeholder;
  }

  function inferValueType(node, localTypes, returnTypesByName) {
    const infer = value => {
      if (value.kind === 'literal') return { int: 'int', bool: 'bool', string: 'string' }[value.literalType];
      if (value.kind === 'range-test') return 'bool';
      if (value.kind === 'string-length') return 'int';
      if (value.kind === 'scalar-string') return 'string';
      if (value.kind === 'convert') return value.targetType;
      if (value.kind === 'overflow') return infer(value.value);
      if (value.kind === 'name') {
        const local = localTypes.get(value.name);
        return local && local.name !== 'function' ? local.name : null;
      }
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
      if (value.kind === 'call') {
        if (value.name.startsWith('Console.')) return 'void';
        const invoked = localTypes.get(value.name) || localTypes.get(value.name.replace(/\.invoke$/, ''));
        if (invoked?.name === 'function') return invoked.returnType?.name ?? null;
        if (returnTypesByName) {
          const declared = returnTypesByName.get(value.name);
          if (declared && declared.name !== '$pending-inference') return declared.name;
        }
        return null;
      }
      return null;
    };
    return infer(node);
  }

  const functions = [], classes = [];
  const pendingExtensions = [];
  const globalsInitStatements = [];
  const endpoints = [];
  for (const declaration of tree.topLevelDeclaration()) {
    const modifiers = declaration.declarationModifier();
    if (declaration.functionDeclaration()) {
      const method = readFunction(declaration.functionDeclaration());
      for (const modifier of modifiers) {
        const text = modifier.getText();
        if (['suspend', 'tailrec'].includes(text)) {
          // Direct-style subset: suspend functions run synchronously; tail
          // recursion keeps ordinary call frames and instruction budgets.
          method.suspend = method.suspend || text === 'suspend';
          continue;
        }
        const annotation = modifier.annotation();
        if (!annotation) {
          // Modifiers without single-module semantic weight are accepted and
          // ignored; call-site checks still gate operator/infix conventions.
          if (['inline', 'noinline', 'crossinline', 'private', 'public', 'internal',
            'final', 'open', 'external', 'operator', 'infix'].includes(text)) continue;
          fail(location(modifier), `Unsupported function modifier '${text}' in the P-code subset`);
        }
        const annotationName = annotation.qualifiedIdentifier().getText().replace(/^pulse\.http\./, '');
        const verb = httpAnnotations[annotationName];
        if (!verb) continue; // Unknown annotations carry no runtime behavior here.
        if (annotation.typeArguments() || annotation.identifier())
          fail(location(modifier), `@${annotationName} does not accept type arguments or use-site targets`);
        const args = annotation.valueArguments()?.valueArgument() || [];
        if (args.length !== 1 || args[0].identifier() || args[0].MUL())
          fail(location(annotation), `@${annotationName} requires one literal path string`);
        const value = expression(args[0].expression());
        if (value.kind !== 'literal' || value.literalType !== 'string')
          fail(location(annotation), `@${annotationName} requires one literal path string`);
        if (method.typeParams.length || method.params.length || method.returnType.name !== 'string'
          || method.name === 'Main' || method.extensionReceiver)
          fail(method.token, `@${annotationName} handlers must be non-generic, take no parameters and return String`);
        endpoints.push({ verb, path: value.value, handler: method.name });
      }
      if (method.extensionReceiver) {
        if (method.params.some(param => param.defaultValue))
          fail(method.token, 'Extension functions cannot use default parameters in this subset');
        pendingExtensions.push(method);
        continue;
      }
      functions.push(method);
      for (let count = method.params.length - 1; count >= 0 && method.params[count].defaultValue; count--) {
        if (method.name === 'Main' || endpoints.some(endpoint => endpoint.handler === method.name))
          fail(method.token, 'Entry points and HTTP handlers cannot use default parameters');
        const call = {
          kind: 'call', token: method.token, name: method.name,
          args: method.params.map(param => ({ kind: 'name', token: param.token, name: param.token.value })),
          typeArgs: method.typeParams.map(token => ({ ...token, name: token.value }))
        };
        const statements = method.params.slice(count).map(param => ({
          kind: 'declare', token: param.token, type: param.type,
          declarations: [{ token: param.token, mutable: false, value: structuredClone(param.defaultValue) }]
        }));
        statements.push(method.returnType.name === 'void'
          ? { kind: 'expressions', token: method.token, values: [call] }
          : { kind: 'return', token: method.token, value: call });
        const block = { kind: 'block', token: method.token, statements };
        functions.push({ ...method, params: method.params.slice(0, count).map(param => ({ ...param })),
          body: block, block, typeParams: method.typeParams.map(token => ({ ...token })), attributes: [] });
      }
    } else if (declaration.classDeclaration()) {
      const owner = readClass(declaration.classDeclaration());
      classes.push(owner);
      functions.push(...owner.constructors, ...owner.methods.filter(method => method.owner === 'Program'));
    } else if (declaration.objectDeclaration()) {
      const object = declaration.objectDeclaration();
      if (!object.identifier()) fail(location(object), 'Anonymous object declarations are not supported');
      const owner = readClass(object);
      classes.push(owner);
      functions.push(...owner.constructors, ...owner.methods);
    }
    else if (declaration.propertyDeclaration()) {
      const property = declaration.propertyDeclaration();
      if (property.propertyAccessor()?.length)
        fail(location(declaration), 'Top-level property accessors are not supported by the P-code subset');
      if (!property.expression())
        fail(location(declaration), 'Top-level properties require an initializer in this subset');
      const declared = property.typeReference();
      globalsInitStatements.push({
        kind: 'declare', token: location(property), infer: !declared,
        type: declared ? readType(declared) : { name: 'int' },
        declarations: [{
          token: location(property.identifier()), mutable: Boolean(property.VAR()),
          value: expression(property.expression())
        }]
      });
    }
    else if (!declaration.classDeclaration() && !declaration.objectDeclaration())
      fail(location(declaration), 'Only top-level functions and stateless classes are supported by the P-code subset');
  }
  // Top-level properties live in the machine's root frame: a synthetic init
  // runs their declarations at MAIN before the entry point, and every
  // procedure resolves unshadowed reads and writes through the frame chain.
  if (globalsInitStatements.length) {
    const token = globalsInitStatements[0].token;
    functions.push({
      token, name: '$GlobalsInit', owner: 'Program', returnType: { name: 'void', ...token },
      typeParams: [], params: [], globalsInit: true,
      body: { kind: 'block', token, statements: globalsInitStatements },
      modifiers: new Set(['public', 'static']), attributes: [], block: null
    });
  }
  // Attach extension functions to their receiver classes as synthesized
  // members; stateful receivers get the full implicit-this conversion.
  for (const method of pendingExtensions) {
    const owner = classes.find(item => item.name === method.extensionReceiver);
    if (!owner) fail(method.token, `Extension receiver '${method.extensionReceiver}' is not a class declared in this file`);
    method.owner = owner.name;
    const fields = owner.constructors[0]?.fields || [];
    if (fields.length) {
      const memberNames = new Set(owner.methods.filter(item => item.instance).map(item => item.name));
      convertToInstanceMethod(method, owner.name, fields, memberNames);
    }
    owner.methods.push(method);
  }
  if (!endpoints.length && !functions.some(method => method.name === 'Main'))
    fail(location(tree), 'Kotlin source must declare fun main()');
  if (endpoints.length && functions.some(method => method.name === 'Main'))
    fail(location(tree), 'Kotlin services cannot declare fun main()');
  const imports = tree.importHeader();
  const supportedImports = [
    'importkotlin.io.*', 'importkotlin.io.println', 'importpulse.http.HttpGet',
    'importkotlin.test.*', 'importkotlin.test.assertEquals',
    'importkotlinx.coroutines.*', 'importkotlinx.coroutines.yield',
    'importkotlin.coroutines.*', 'importkotlin.coroutines.Continuation',
    'importkotlin.coroutines.intrinsics.*', 'importhelpers.*',
    ...Object.keys(httpAnnotations).map(name => `importpulse.http.${name}`),
    'importpulse.http.*', 'importpulse.net.*',
    ...['requestBody', 'requestMethod', 'requestPath', 'requestPeer', 'requestQuery', 'requestHeader']
      .map(name => `importpulse.http.${name}`),
    ...['tcpExchange', 'udpExchange'].map(name => `importpulse.net.${name}`)
  ];
  const unsupportedImport = imports.find(item => !supportedImports.includes(item.getText()));
  if (unsupportedImport) fail(location(unsupportedImport), 'Unsupported Kotlin import in the P-code subset');
  if (pendingInference.length) {
    const returnTypesByName = new Map();
    for (const owner of classes) for (const method of owner.methods)
      if (!returnTypesByName.has(method.name)) returnTypesByName.set(method.name, method.returnType);
    for (const method of functions)
      if (!returnTypesByName.has(method.name)) returnTypesByName.set(method.name, method.returnType);
    for (const pending of pendingInference) {
      const type = inferValueType(pending.node, pending.localTypes, returnTypesByName);
      if (!type || type === '$pending-inference')
        fail(pending.token, 'Expression-bodied functions need an explicit supported return type for this subset');
      pending.placeholder.name = type;
    }
  }
  const forbidStrayThis = node => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'this')
      fail(node.token, "'this' is only supported inside members of classes with properties");
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(forbidStrayThis);
      else if (value && typeof value === 'object') forbidStrayThis(value);
    }
  };
  for (const method of functions) forbidStrayThis(method.body);
  for (const owner of classes) for (const method of owner.methods) if (!method.instance) forbidStrayThis(method.body);
  inlineFunctionValues(functions, classes, fileName);
  return {
    token: location(tree),
    endpoints,
    hostImports: imports.map(item => item.getText()),
    usingSystem: true,
    classes: [{
      token: location(tree), name: 'Program', modifiers: new Set(['public']), methods: functions
    }, ...classes]
  };
}

const SUSPENSION_INTRINSICS = new Set([
  'suspendCoroutineUninterceptedOrReturn', 'suspendCoroutine', 'suspendCancellableCoroutine',
  'startCoroutineUninterceptedOrReturn', 'createCoroutine', 'createCoroutineUnintercepted', 'intercepted',
]);
const EXCEPTION_CONSTRUCTORS = new Set([
  'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'AssertionError', 'Exception', 'Error',
]);
const CONTINUATION_HELPERS = new Set([
  'EmptyContinuation', 'handleResultContinuation', 'handleExceptionContinuation', 'Continuation',
]);

// Direct-style coroutine lowering. Functions with function-typed parameters are
// compile-time inline templates: each call site specializes the template with
// its lambda arguments, so lambda bodies execute in the caller's frame and
// captured locals are ordinary variables. startCoroutine runs the suspend body
// synchronously to completion, then runs the continuation body; intrinsics that
// actually suspend are rejected with explicit diagnostics.
function inlineFunctionValues(functions, classes, fileName) {
  const isFunctionType = type => type?.name === 'function';
  const templates = new Map();
  const members = new Map(classes.map(owner => [owner.name, {
    fields: new Map((owner.constructors[0]?.fields || []).map(field => [field.name, field])),
    methods: new Set(owner.methods.map(method => method.name)),
  }]));
  const globalNames = new Set(functions.map(method => method.name));
  for (const method of functions) {
    if (isFunctionType(method.returnType))
      fail(method.token, 'Function-typed return values are not supported by the direct-style subset');
    if (!method.params?.some(param => isFunctionType(param.type))) continue;
    if (templates.has(method.name) || method.typeParams?.length || method.params.some(param => param.defaultValue))
      fail(method.token, 'Functions with function-typed parameters must be non-generic, non-overloaded and without defaults');
    templates.set(method.name, method);
  }
  if (!templates.size && !functions.some(method => bodyUsesCoroutineSyntax(method.body))) return;
  let serial = 0;

  function bodyUsesCoroutineSyntax(node) {
    if (!node || typeof node !== 'object') return false;
    if (node.kind === 'lambda' || node.kind === 'throw' || node.kind === 'callable-reference') return true;
    if (node.kind === 'call' && (SUSPENSION_INTRINSICS.has(node.name) || CONTINUATION_HELPERS.has(node.name)
      || node.name === 'startCoroutine')) return true;
    return Object.values(node).some(value => Array.isArray(value)
      ? value.some(item => bodyUsesCoroutineSyntax(item)) : bodyUsesCoroutineSyntax(value));
  }

  const isTemplateCall = node => node?.kind === 'call' && !node.receiver && templates.has(node.name);

  // Lowers a callable reference used where a function value is expected into
  // an equivalent synthesized lambda: ::foo becomes { a, b -> foo(a, b) },
  // recv::foo forwards through the receiver, and Stateful::foo takes the
  // receiver as its first parameter. Pure compile-time rewriting.
  function referenceLambda(node, paramTypes) {
    if (node?.kind !== 'callable-reference') return node;
    const token = node.token;
    const prefix = `$ref${serial++}p`;
    const params = paramTypes.map((_, index) => ({ token: { ...token, value: `${prefix}${index}` }, type: null }));
    const args = params.map(param => ({ kind: 'name', token: param.token, name: param.token.value }));
    let receiver = node.receiver;
    if (receiver?.kind === 'name' && members.get(receiver.name)?.fields.size) receiver = args.shift();
    const name = node.member === 'println' ? 'Console.WriteLine'
      : node.member === 'print' ? 'Console.Write' : node.member;
    const call = { kind: 'call', token, name, args, typeArgs: [], receiver, safe: false };
    return { kind: 'lambda', token, params,
      body: { kind: 'block', token, statements: [{ kind: 'expressions', token, values: [call] }] } };
  }

  function lambdaStatements(lambda, token, args = [], paramTypes = []) {
    if (lambda?.kind !== 'lambda') fail(token, 'Function-typed arguments must be lambda literals in this subset');
    const body = structuredClone(lambda.body);
    forbidReturns(body);
    // A lambda without a parameter list binds a single argument as `it`.
    let params = lambda.params || [];
    if (!params.length && args.length === 1)
      params = [{ token: { ...lambda.token, value: 'it' }, type: null }];
    if (params.length !== args.length)
      fail(lambda.token, `This lambda takes ${params.length} parameter(s) but ${args.length} argument(s) were supplied`);
    // Per-splice renaming keeps repeated inlining of one lambda from colliding.
    const sub = { prefix: `$lam${serial++}$`, renames: new Map(), bindings: new Map(), sawReturn: false };
    const declares = [];
    for (const [index, param] of params.entries()) {
      if (param.token.value === '_') {
        declares.push({ kind: 'expressions', token: param.token, values: [args[index]] });
        continue;
      }
      const type = param.type ?? paramTypes[index];
      if (!type || isFunctionType(type))
        fail(param.token, 'Lambda parameters require a supported scalar type from the function type or an annotation');
      const name = `${sub.prefix}${param.token.value}`;
      sub.renames.set(param.token.value, name);
      declares.push({ kind: 'declare', token: param.token, type: { ...type },
        declarations: [{ token: { ...param.token, value: name }, mutable: false, value: args[index] }] });
    }
    return [...declares, ...substitute(body, sub).statements];
  }

  function forbidReturns(node) {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'return')
      fail(node.token, 'return is not supported inside inlined lambda bodies');
    if (node.kind === 'lambda') return;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(item => forbidReturns(item));
      else forbidReturns(value);
    }
  }

  // Lowers one start-coroutine marker into direct-style statements.
  function startCoroutineStatements(marker) {
    let body = lambdaStatements(marker.lambda, marker.token);
    const setup = [];
    if (marker.receiverClass) {
      const receiverName = `$recv${serial++}`;
      setup.push({ kind: 'declare', token: marker.token, type: { name: marker.receiverClass },
        declarations: [{ token: { ...marker.token, value: receiverName }, mutable: false, value: marker.receiver }] });
      body = applyImplicitReceiver(body, marker.receiverClass, receiverName, new Set());
    }
    const continuation = marker.continuation;
    if (continuation?.kind === 'name' && continuation.name === 'EmptyContinuation') return [...setup, ...body];
    if (continuation?.kind === 'call' && continuation.name === 'handleExceptionContinuation')
      fail(continuation.token, 'Exception continuations require real suspension and are not supported');
    if (continuation?.kind === 'call' && continuation.name === 'handleResultContinuation'
      && continuation.args.length === 1)
      return [...setup, ...body, ...lambdaStatements(continuation.args[0], continuation.token)];
    if (continuation?.kind === 'call' && continuation.name === 'Continuation' && continuation.args.length === 2)
      return [...setup, ...body, ...lambdaStatements(continuation.args[1], continuation.token)];
    fail(marker.token, 'startCoroutine requires EmptyContinuation, handleResultContinuation or a Continuation lambda');
  }

  // Rewrites bare member references in a receiver lambda body to explicit
  // accesses through the declared receiver local. Locally renamed lambda
  // variables carry a $ prefix, so remaining bare names are caller locals or
  // receiver members; members win, matching the corpus shapes.
  function applyImplicitReceiver(node, className, receiverName, blocked) {
    const index = members.get(className);
    const receiverRef = token => ({ kind: 'name', token: { ...token, value: receiverName }, name: receiverName });
    if (Array.isArray(node)) return node.map(item => applyImplicitReceiver(item, className, receiverName, blocked));
    if (!node || typeof node !== 'object') return node;
    if (!node.kind) {
      const result = {};
      for (const [key, value] of Object.entries(node)) {
        result[key] = value && typeof value === 'object'
          ? applyImplicitReceiver(value, className, receiverName, blocked) : value;
      }
      return result;
    }
    if (node.kind === 'lambda') {
      const shadowed = new Set([...blocked, ...(node.params || []).map(param => param.token.value)]);
      return { ...node, body: applyImplicitReceiver(node.body, className, receiverName, shadowed) };
    }
    if (node.kind === 'name' && index.fields.has(node.name) && !blocked.has(node.name)) {
      return { kind: 'property', token: node.token, name: node.name, receiver: receiverRef(node.token), safe: false };
    }
    if (node.kind === 'assign' && node.left.kind === 'name'
      && index.fields.has(node.left.name) && !blocked.has(node.left.name)) {
      const field = index.fields.get(node.left.name);
      if (!field.mutable) fail(node.token, `Val '${node.left.name}' cannot be reassigned`);
      const right = applyImplicitReceiver(node.right, className, receiverName, blocked);
      const property = { kind: 'property', token: node.left.token, name: node.left.name,
        receiver: receiverRef(node.left.token), safe: false };
      const value = node.op === '=' ? right
        : { kind: 'binary', token: node.token, op: node.op[0], left: property, right };
      return { kind: 'call', token: node.token, receiver: receiverRef(node.token), safe: false,
        name: `set${node.left.name[0].toUpperCase()}${node.left.name.slice(1)}`, args: [value], typeArgs: [] };
    }
    if (node.kind === 'call' && !node.receiver && index.methods.has(node.name) && !blocked.has(node.name)
      && !templates.has(node.name) && !globalNames.has(node.name)) {
      return { ...node, receiver: receiverRef(node.token),
        args: node.args.map(argument => applyImplicitReceiver(argument, className, receiverName, blocked)) };
    }
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = key === 'token' || key === 'type' ? value
        : value && typeof value === 'object'
          ? applyImplicitReceiver(value, className, receiverName, blocked) : value;
    }
    return result;
  }

  function forbidContinuationUse(node, name) {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'name' && node.name === name)
      fail(node.token, 'The continuation of a direct-style intrinsic may only be resumed immediately');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(item => forbidContinuationUse(item, name));
      else forbidContinuationUse(value, name);
    }
  }

  // Recognizes suspendCoroutineUninterceptedOrReturn { k -> ...; k.resume(v);
  // COROUTINE_SUSPENDED }: upstream this delivers v before suspending, so the
  // exact direct-style equivalent is running the side effects and yielding v.
  function lowerResumeImmediately(call) {
    if (call?.kind !== 'call' || call.receiver || call.name !== 'suspendCoroutineUninterceptedOrReturn') return null;
    if (call.args.length !== 1 || call.args[0]?.kind !== 'lambda')
      fail(call.token, 'suspendCoroutineUninterceptedOrReturn requires a single lambda argument');
    const lambda = call.args[0];
    if (lambda.params?.length !== 1 || lambda.params[0].token.value === '_')
      fail(lambda.token, 'The intrinsic lambda requires exactly one named continuation parameter');
    const continuation = lambda.params[0].token.value;
    const body = structuredClone(lambda.body);
    forbidReturns(body);
    const statements = [...body.statements];
    const single = statement => statement?.kind === 'expressions' && statement.values.length === 1
      ? statement.values[0] : null;
    if (!(single(statements.at(-1))?.kind === 'name' && single(statements.at(-1)).name === 'COROUTINE_SUSPENDED'))
      fail(lambda.token, 'Direct-style intrinsics require the lambda to end with COROUTINE_SUSPENDED');
    statements.pop();
    const resume = single(statements.at(-1));
    if (!(resume?.kind === 'call' && resume.name === 'resume' && resume.receiver?.kind === 'name'
      && resume.receiver.name === continuation && resume.args.length === 1))
      fail(lambda.token, 'Direct-style intrinsics require resume(value) on the continuation immediately before COROUTINE_SUSPENDED');
    statements.pop();
    forbidContinuationUse(statements, continuation);
    forbidContinuationUse(resume.args[0], continuation);
    const value = resume.args[0];
    const sub = { prefix: `$sus${serial++}$`, renames: new Map(), bindings: new Map(), sawReturn: false };
    return {
      statements: substitute({ kind: 'block', token: lambda.token, statements }, sub).statements,
      value: value.kind === 'name' && value.name === 'Unit' ? null : substitute(value, sub),
    };
  }

  // Deep-clones a template body: renames template locals/parameters, replaces
  // function-typed parameter uses, and tags returns for the wrapper.
  function substitute(node, sub, loopDepth = 0) {
    if (Array.isArray(node)) return node.map(item => substitute(item, sub, loopDepth));
    if (!node || typeof node !== 'object') return node;
    if (!node.kind) {
      const result = {};
      for (const [key, value] of Object.entries(node)) {
        result[key] = key === 'value' && typeof value === 'string' && sub.renames.has(value)
          ? sub.renames.get(value)
          : Array.isArray(value) ? value.map(item => substitute(item, sub, loopDepth))
            : value && typeof value === 'object' ? substitute(value, sub, loopDepth) : value;
      }
      return result;
    }
    if (node.kind === 'name') {
      if (sub.bindings.has(node.name))
        fail(node.token, 'Function-typed parameters can only be invoked or passed to other builders');
      return sub.renames.has(node.name) ? { ...node, name: sub.renames.get(node.name) } : { ...node };
    }
    if (node.kind === 'lambda') {
      return { ...node, body: substitute(node.body, sub, 0) };
    }
    if (node.kind === 'return') {
      if (loopDepth > 0) fail(node.token, 'Returns inside loops cannot be inlined by the direct-style subset');
      sub.sawReturn = true;
      return { kind: 'template-return', token: node.token, value: substitute(node.value, sub, loopDepth) };
    }
    if (node.kind === 'declare') {
      for (const item of node.declarations) {
        if (!sub.renames.has(item.token.value))
          sub.renames.set(item.token.value, `${sub.prefix}${item.token.value}`);
      }
    }
    if (node.kind === 'call') {
      if (!node.receiver && sub.bindings.has(node.name)) {
        const binding = sub.bindings.get(node.name);
        if (binding.receiver)
          fail(node.token, 'Receiver lambdas can only be started with startCoroutine(receiver, continuation)');
        return { kind: 'invoke-lambda', token: node.token, lambda: binding.lambda,
          paramTypes: binding.paramTypes,
          args: node.args.map(argument => substitute(argument, sub, loopDepth)) };
      }
      if (node.name === 'startCoroutine' && node.receiver?.kind === 'name' && sub.bindings.has(node.receiver.name)) {
        const binding = sub.bindings.get(node.receiver.name);
        const expected = binding.receiver ? 2 : 1;
        if (node.args.length !== expected)
          fail(node.token, `startCoroutine requires ${expected} argument(s) for this function type`);
        return { kind: 'start-coroutine', token: node.token, lambda: binding.lambda,
          receiverClass: binding.receiver,
          receiver: binding.receiver ? substitute(node.args[0], sub, loopDepth) : null,
          continuation: substitute(node.args[expected - 1], sub, loopDepth) };
      }
      const args = node.args.map(argument =>
        argument.kind === 'name' && sub.bindings.has(argument.name)
          ? sub.bindings.get(argument.name).lambda : substitute(argument, sub, loopDepth));
      return { ...node, receiver: substitute(node.receiver, sub, loopDepth), args };
    }
    const nested = ['while', 'do', 'for'].includes(node.kind) ? loopDepth + 1 : loopDepth;
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = key === 'token' || key === 'type'
        ? substitute(value, sub, loopDepth)
        : Array.isArray(value) ? value.map(item => substitute(item, sub, nested))
          : value && typeof value === 'object' ? substitute(value, sub, nested) : value;
    }
    return result;
  }

  // Expands a call to a template; returns statements plus the result variable.
  function expand(call, depth) {
    if (depth >= 16) fail(call.token, 'Inline expansion depth exceeded; recursive builders are not supported');
    const template = templates.get(call.name);
    if (call.typeArgs?.length || call.args.length !== template.params.length)
      fail(call.token, `${call.name} requires ${template.params.length} argument(s) without type arguments`);
    const prefix = `$co${serial++}$`;
    const sub = { prefix, renames: new Map(), bindings: new Map(), sawReturn: false };
    const statements = [];
    for (const [index, param] of template.params.entries()) {
      const argument = isFunctionType(param.type)
        ? referenceLambda(call.args[index], param.type.paramTypes) : call.args[index];
      if (isFunctionType(param.type)) {
        if (argument?.kind !== 'lambda')
          fail(call.token, 'Function-typed arguments must be lambda literals in this subset');
        if ((argument.params?.length || 0) !== param.type.paramTypes.length
          && !(!argument.params?.length && param.type.paramTypes.length === 1))
          fail(argument.token, `${param.token.value} requires a lambda with ${param.type.paramTypes.length} parameter(s)`);
        sub.bindings.set(param.token.value, { lambda: argument, paramTypes: param.type.paramTypes,
          receiver: param.type.receiver ?? null });
        continue;
      }
      const name = `${prefix}${param.token.value}`;
      sub.renames.set(param.token.value, name);
      statements.push({ kind: 'declare', token: param.token, type: { ...param.type },
        declarations: [{ token: { ...param.token, value: name }, mutable: false, value: argument }] });
    }
    const body = substitute(template.body, sub);
    const voidResult = template.returnType.name === 'void';
    const resultName = voidResult ? null : `${prefix}result`;
    if (!sub.sawReturn && !voidResult)
      fail(call.token, `${call.name} must return a value before it can be inlined`);
    if (sub.sawReturn) {
      if (resultName) statements.push({ kind: 'declare', token: call.token, type: { ...template.returnType },
        declarations: [{ token: { ...call.token, value: resultName }, mutable: true, value: null }] });
      statements.push({ kind: 'do', token: call.token,
        condition: { kind: 'literal', token: call.token, literalType: 'bool', value: false },
        body: convertReturns(body, resultName) });
    } else {
      statements.push(body);
    }
    return { statements: rewriteStatements(statements, depth + 1), resultName };
  }

  function convertReturns(node, resultName) {
    if (Array.isArray(node)) return node.flatMap(item => {
      const converted = convertReturns(item, resultName);
      return Array.isArray(converted) ? converted : [converted];
    });
    if (!node || typeof node !== 'object' || !node.kind || node.kind === 'lambda') return node;
    if (node.kind === 'template-return') {
      const jump = { kind: 'break', token: node.token };
      if (!resultName) return node.value
        ? [{ kind: 'expressions', token: node.token, values: [node.value] }, jump] : [jump];
      if (!node.value) fail(node.token, 'A value is required by this return statement');
      return [{ kind: 'expressions', token: node.token, values: [{
        kind: 'assign', token: node.token, op: '=', right: node.value,
        left: { kind: 'name', token: { ...node.token, value: resultName }, name: resultName },
      }] }, jump];
    }
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      const converted = key === 'statements' || key === 'values'
        ? convertReturns(value, resultName)
        : Array.isArray(value) ? value.map(item => convertReturns(item, resultName))
          : value && typeof value === 'object' && value.kind ? convertReturns(value, resultName) : value;
      result[key] = Array.isArray(converted) && !['statements', 'values'].includes(key) && !Array.isArray(value)
        ? { kind: 'block', token: node.token, statements: converted } : converted;
    }
    return result;
  }

  function checkExpression(node, guarded = false) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(item => checkExpression(item, guarded));
    if (!node.kind) return;
    if (node.kind === 'lambda')
      fail(node.token, 'Lambdas are only supported as arguments to functions with function-typed parameters');
    if (node.kind === 'callable-reference')
      fail(node.token, 'Callable references are only supported where function-typed arguments are expected');
    if (node.kind === 'invoke-lambda' || node.kind === 'start-coroutine')
      fail(node.token, 'Inlined function values may only be invoked as statements');
    if (node.kind === 'throw' && !guarded && node.value?.kind === 'call' && !node.value.receiver
      && EXCEPTION_CONSTRUCTORS.has(node.value.name) && node.value.args.length <= 1 && !node.value.typeArgs?.length) {
      node.value = node.value.args[0]
        ?? { kind: 'literal', token: node.value.token, literalType: 'string', value: node.value.name };
    }
    if (node.kind === 'call') {
      if (node.name === 'suspendCoroutineUninterceptedOrReturn')
        fail(node.token, 'suspendCoroutineUninterceptedOrReturn is only supported as a statement, initializer, assignment or return value with a resume-immediately lambda');
      if (SUSPENSION_INTRINSICS.has(node.name))
        fail(node.token, 'True suspension intrinsics are not supported by the direct-style coroutine subset');
      if (!node.receiver && templates.has(node.name))
        fail(node.token, `${node.name} takes a function value, so calls are only supported as statements, initializers or return values`);
      if (node.name === 'startCoroutine')
        fail(node.token, 'startCoroutine requires a function-typed parameter receiver inside an inlined builder');
      if (CONTINUATION_HELPERS.has(node.name))
        fail(node.token, 'Continuation helpers are only supported as startCoroutine arguments');
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'token' || key === 'type' || key === 'variable') continue;
      checkExpression(value, guarded);
    }
  }

  function rewriteStatements(statements, depth, guarded = false) {
    return statements.flatMap(node => rewriteStatement(node, depth, guarded));
  }

  // Splices a bound-lambda invocation used as a value: the lambda body runs as
  // statements and its trailing expression becomes the value at the use site.
  function spliceLambdaValue(marker, depth, guarded) {
    marker.args?.forEach(argument => checkExpression(argument, guarded));
    const spliced = lambdaStatements(marker.lambda, marker.token, marker.args ?? [], marker.paramTypes ?? []);
    const last = spliced.at(-1);
    if (last?.kind !== 'expressions' || last.values.length !== 1)
      fail(marker.token, 'This lambda must end in a single expression to produce a value');
    return { statements: rewriteStatements(spliced.slice(0, -1), depth, guarded), value: last.values[0] };
  }

  function rewriteEmbedded(node, depth, guarded = false) {
    if (!node) return node;
    const rewritten = rewriteStatement(node, depth, guarded);
    return rewritten.length === 1 ? rewritten[0] : { kind: 'block', token: node.token, statements: rewritten };
  }

  function rewriteStatement(node, depth, guarded = false) {
    switch (node.kind) {
      case 'block':
        return [{ ...node, statements: rewriteStatements(node.statements, depth, guarded) }];
      case 'if':
        checkExpression(node.condition, guarded);
        return [{ ...node, then: rewriteEmbedded(node.then, depth, guarded),
          otherwise: rewriteEmbedded(node.otherwise, depth, guarded) }];
      case 'while': case 'do': case 'for':
        checkExpression(node.condition, guarded);
        if (node.init) node.init.declarations.forEach(item => checkExpression(item.value, guarded));
        if (node.increment) checkExpression(node.increment, guarded);
        return [{ ...node, body: rewriteEmbedded(node.body, depth, guarded) }];
      case 'try':
        // A try with catch handlers cannot intercept runtime faults in this
        // subset, so thrown exception constructors inside it stay unlowered.
        return [{ ...node, body: rewriteEmbedded(node.body, depth, guarded || node.catches.length > 0),
          catches: node.catches.map(handler => ({ ...handler, body: rewriteEmbedded(handler.body, depth, guarded) })),
          finallyBody: node.finallyBody ? rewriteEmbedded(node.finallyBody, depth, guarded) : null }];
      case 'return': {
        if (node.value?.kind === 'invoke-lambda') {
          const result = spliceLambdaValue(node.value, depth, guarded);
          return [...result.statements,
            ...rewriteStatements([{ ...node, value: result.value }], depth, guarded)];
        }
        if (isTemplateCall(node.value)) {
          node.value.args.forEach(argument => { if (argument.kind !== 'lambda' && argument.kind !== 'callable-reference') checkExpression(argument, guarded); });
          const { statements, resultName } = expand(node.value, depth);
          const value = resultName
            ? { kind: 'name', token: { ...node.token, value: resultName }, name: resultName } : null;
          return [...statements, { ...node, value }];
        }
        const lowered = lowerResumeImmediately(node.value);
        if (lowered) return [...rewriteStatements(lowered.statements, depth, guarded),
          { ...node, value: lowered.value }];
        checkExpression(node.value, guarded);
        return [node];
      }
      case 'declare': {
        const preceding = [];
        for (const item of node.declarations) {
          while (item.value?.kind === 'invoke-lambda') {
            const result = spliceLambdaValue(item.value, depth, guarded);
            preceding.push(...result.statements);
            item.value = result.value;
          }
          const lowered = lowerResumeImmediately(item.value);
          if (lowered) {
            if (!lowered.value) fail(item.token, 'A Unit intrinsic cannot initialize a local variable');
            preceding.push(...rewriteStatements(lowered.statements, depth, guarded));
            item.value = lowered.value;
            continue;
          }
          if (!isTemplateCall(item.value)) { checkExpression(item.value, guarded); continue; }
          item.value.args.forEach(argument => { if (argument.kind !== 'lambda' && argument.kind !== 'callable-reference') checkExpression(argument, guarded); });
          const { statements, resultName } = expand(item.value, depth);
          if (!resultName) fail(item.token, 'A Unit builder cannot initialize a local variable');
          preceding.push(...statements);
          item.value = { kind: 'name', token: { ...item.token, value: resultName }, name: resultName };
        }
        return [...preceding, node];
      }
      case 'expressions': {
        const output = [];
        const remaining = [];
        for (const value of node.values) {
          while (value.kind === 'assign' && value.op === '=' && value.right?.kind === 'invoke-lambda') {
            const result = spliceLambdaValue(value.right, depth, guarded);
            output.push(...result.statements);
            value.right = result.value;
          }
          const lowered = lowerResumeImmediately(value)
            ?? (value.kind === 'assign' && value.op === '=' ? lowerResumeImmediately(value.right) : null);
          if (lowered) {
            output.push(...rewriteStatements(lowered.statements, depth, guarded));
            if (value.kind === 'assign') {
              if (!lowered.value) fail(value.token, 'A Unit intrinsic cannot be assigned');
              checkExpression(lowered.value, guarded);
              remaining.push({ ...value, right: lowered.value });
            } else if (lowered.value) {
              checkExpression(lowered.value, guarded);
              remaining.push(lowered.value);
            }
            continue;
          }
          if (value.kind === 'assign' && value.op === '=' && isTemplateCall(value.right)) {
            value.right.args.forEach(argument => { if (argument.kind !== 'lambda' && argument.kind !== 'callable-reference') checkExpression(argument, guarded); });
            const { statements, resultName } = expand(value.right, depth);
            if (!resultName) fail(value.token, 'A Unit builder cannot be assigned');
            output.push(...statements);
            checkExpression(value.left, guarded);
            remaining.push({ ...value,
              right: { kind: 'name', token: { ...value.token, value: resultName }, name: resultName } });
            continue;
          }
          if (value.kind === 'call' && !value.receiver && value.name === 'run'
            && value.args.length === 1 && value.args[0]?.kind === 'lambda' && !value.typeArgs?.length) {
            output.push(...rewriteStatements(lambdaStatements(value.args[0], value.token), depth, guarded));
            continue;
          }
          if (isTemplateCall(value)) {
            value.args.forEach(argument => { if (argument.kind !== 'lambda' && argument.kind !== 'callable-reference') checkExpression(argument, guarded); });
            output.push(...expand(value, depth).statements);
          } else if (value.kind === 'invoke-lambda') {
            value.args?.forEach(argument => checkExpression(argument, guarded));
            output.push(...rewriteStatements(
              lambdaStatements(value.lambda, value.token, value.args ?? [], value.paramTypes ?? []),
              depth, guarded));
          } else if (value.kind === 'start-coroutine') {
            output.push(...rewriteStatements(startCoroutineStatements(value), depth, guarded));
          } else {
            checkExpression(value, guarded);
            remaining.push(value);
          }
        }
        if (remaining.length) output.push({ ...node, values: remaining });
        return output;
      }
      default:
        checkExpression(node.value ?? node.values, guarded);
        return [node];
    }
  }

  const rewritten = new Set();
  const rewrite = method => {
    if (!method.body || rewritten.has(method) || templates.has(method.name)) return;
    rewritten.add(method);
    method.body = { ...method.body, statements: rewriteStatements(method.body.statements, 0) };
    if (method.block) method.block = method.body;
  };
  functions.forEach(rewrite);
  for (const owner of classes) {
    for (const method of owner.methods) {
      if (method.owner === owner.name) rewrite(method);
    }
  }
  for (let index = functions.length - 1; index >= 0; index--) {
    if (templates.has(functions[index].name)) functions.splice(index, 1);
  }
}
