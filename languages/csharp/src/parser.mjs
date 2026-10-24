const KEYWORDS = new Set(`abstract as base bool break byte case catch char checked class const continue decimal
default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in
int interface internal is lock long namespace new null object operator out override params private protected public
readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof
uint ulong unchecked unsafe ushort using virtual void volatile while`.split(/\s+/));

export function fail(node, message) {
  throw new SyntaxError(`C# ${node.fileName}:${node.line}:${node.column}: ${message}`);
}

export function tokenize(source, fileName) {
  const tokens = [];
  let offset = 0, line = 1, column = 1;
  const advance = () => {
    const char = source[offset++];
    if (char === '\n') { line++; column = 1; } else column++;
    return char;
  };
  while (offset < source.length) {
    if (/\s/.test(source[offset])) { advance(); continue; }
    const location = { fileName, line, column };
    const rest = source.slice(offset);
    if (rest.startsWith('//')) {
      while (offset < source.length && source[offset] !== '\n') advance();
      continue;
    }
    if (rest.startsWith('/*')) {
      advance(); advance();
      while (offset < source.length && !source.startsWith('*/', offset)) advance();
      if (offset === source.length) fail(location, 'Unterminated block comment');
      advance(); advance();
      continue;
    }
    if (source[offset] === '"' || rest.startsWith('@"')) {
      const verbatim = source[offset] === '@';
      if (verbatim) advance();
      advance();
      let value = '', closed = false;
      while (offset < source.length) {
        const char = advance();
        if (char === '"') {
          if (verbatim && source[offset] === '"') { advance(); value += '"'; continue; }
          closed = true;
          break;
        }
        if (!verbatim && (char === '\r' || char === '\n')) fail(location, 'Newline in regular string literal');
        if (!verbatim && char === '\\') {
          const escape = advance();
          const simple = { "'": "'", '"': '"', '\\': '\\', '0': '\0', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
          if (Object.hasOwn(simple, escape)) value += simple[escape];
          else if (['u', 'U', 'x'].includes(escape)) {
            const size = escape === 'u' ? 4 : escape === 'U' ? 8 : 4;
            let digits = '';
            while (digits.length < size && /[0-9a-fA-F]/.test(source[offset] || 'z')) digits += advance();
            if (!digits || (escape !== 'x' && digits.length !== size)) fail(location, 'Invalid Unicode escape');
            const code = Number.parseInt(digits, 16);
            if (code > 0x10ffff) fail(location, 'Unicode escape is out of range');
            value += String.fromCodePoint(code);
          } else fail(location, `Unsupported string escape \\${escape}`);
        } else value += char;
      }
      if (!closed) fail(location, 'Unterminated string literal');
      tokens.push({ ...location, kind: 'string', value });
      continue;
    }
    const name = /^@?[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (name) {
      for (let i = 0; i < name[0].length; i++) advance();
      const escaped = name[0][0] === '@', value = name[0].replace(/^@/, '');
      tokens.push({ ...location, value, kind: !escaped && KEYWORDS.has(value) ? 'keyword' : 'identifier' });
      continue;
    }
    const number = /^\d+/.exec(rest);
    if (number) {
      for (let i = 0; i < number[0].length; i++) advance();
      tokens.push({ ...location, kind: 'number', value: number[0] });
      continue;
    }
    const symbol = /^(?:==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|[{}()[\];,.<>+\-*/%!=?:])/.exec(rest);
    if (!symbol) fail(location, `Unsupported character ${JSON.stringify(source[offset])}`);
    for (let i = 0; i < symbol[0].length; i++) advance();
    tokens.push({ ...location, kind: 'symbol', value: symbol[0] });
  }
  tokens.push({ fileName, line, column, kind: 'eof', value: '<eof>' });
  return tokens;
}

const PRECEDENCE = new Map([
  ['=', 1], ['+=', 1], ['-=', 1], ['*=', 1], ['/=', 1], ['%=', 1],
  ['||', 2], ['&&', 3], ['==', 4], ['!=', 4], ['<', 5], ['<=', 5], ['>', 5], ['>=', 5],
  ['+', 6], ['-', 6], ['*', 7], ['/', 7], ['%', 7]
]);

export class Parser {
  constructor(tokens) { this.tokens = tokens; this.index = 0; }
  get token() { return this.tokens[this.index]; }
  at(value) { return this.token.value === value && ['keyword', 'symbol', 'eof'].includes(this.token.kind); }
  take(value) {
    if (!this.at(value)) return false;
    return this.tokens[this.index++];
  }
  expect(value) {
    const token = this.take(value);
    if (!token) fail(this.token, `Expected '${value}', found ${JSON.stringify(this.token.value)}`);
    return token;
  }
  identifier() {
    const token = this.token;
    if (token.kind !== 'identifier') fail(token, 'Expected an identifier');
    this.index++;
    return token;
  }
  qualifiedName() {
    let name = this.identifier().value;
    while (this.take('.')) name += '.' + this.identifier().value;
    return name;
  }
  type() {
    const token = this.token;
    if (!['int', 'bool', 'string', 'void'].some(value => this.at(value)) && token.kind !== 'identifier')
      fail(token, 'Supported types are int, bool, string and method type parameters (void only for return types)');
    this.index++;
    return { ...token, name: token.value };
  }
  typeList(read) {
    const items = [];
    if (this.take('<')) {
      do { items.push(read()); } while (this.take(','));
      this.expect('>');
    }
    return items;
  }
  modifiers(allowed) {
    const result = new Set();
    let visibility = false;
    while (allowed.some(value => this.at(value))) {
      const token = this.tokens[this.index++];
      if (result.has(token.value)) fail(token, `Duplicate modifier '${token.value}'`);
      if (['public', 'internal', 'private'].includes(token.value)) {
        if (visibility) fail(token, 'Conflicting accessibility modifiers');
        visibility = true;
      }
      result.add(token.value);
    }
    return result;
  }
  parse() {
    const token = this.token;
    this.usingSystem = false;
    while (this.take('using')) {
      const token = this.token;
      if (this.qualifiedName() !== 'System') fail(token, 'Only using System is supported');
      this.expect(';');
      this.usingSystem = true;
    }
    let namespace = '';
    if (this.take('namespace')) { namespace = this.qualifiedName(); this.expect('{'); }
    const classes = [];
    while (!this.at('<eof>') && !this.at('}')) {
      this.modifiers(['public', 'internal', 'static']);
      this.expect('class');
      const token = this.identifier(), name = namespace ? `${namespace}.${token.value}` : token.value;
      this.expect('{');
      const methods = [];
      while (!this.at('}')) {
        if (this.at('<eof>')) fail(this.token, 'Unterminated class');
        const modifiers = this.modifiers(['public', 'internal', 'private', 'static']);
        if (!modifiers.has('static')) fail(this.token, 'Only static methods are supported; fields and instance members are not supported');
        const returnType = this.type(), method = this.identifier();
        const typeParams = this.typeList(() => this.identifier());
        this.expect('(');
        const params = [];
        if (!this.at(')')) {
          do { params.push({ type: this.type(), token: this.identifier() }); } while (this.take(','));
        }
        this.expect(')');
        const body = this.block();
        methods.push({ token: method, name: method.value, owner: name, returnType, typeParams, params, body, modifiers });
      }
      this.expect('}');
      classes.push({ token, name, methods });
    }
    if (namespace) this.expect('}');
    this.expect('<eof>');
    return { token, classes, usingSystem: this.usingSystem };
  }
  block() {
    const token = this.expect('{'), statements = [];
    while (!this.at('}')) {
      if (this.at('<eof>')) fail(this.token, 'Unterminated block');
      statements.push(this.statement());
    }
    this.expect('}');
    return { kind: 'block', token, statements };
  }
  isDeclaration() {
    return ['int', 'bool', 'string'].some(value => this.at(value))
      || this.token.kind === 'identifier' && this.tokens[this.index + 1]?.kind === 'identifier';
  }
  declaration() {
    const type = this.type(), declarations = [];
    do {
      const token = this.identifier();
      const value = this.take('=') ? this.expression() : null;
      declarations.push({ token, value });
    } while (this.take(','));
    return { kind: 'declare', token: type, type, declarations };
  }
  expressions() {
    const values = [this.expression()];
    while (this.take(',')) values.push(this.expression());
    return values;
  }
  statement() {
    const token = this.token;
    if (this.at('{')) return this.block();
    if (this.take(';')) return { kind: 'empty', token };
    if (this.take('if')) {
      this.expect('('); const condition = this.expression(); this.expect(')');
      const then = this.statement(), otherwise = this.take('else') ? this.statement() : null;
      return { kind: 'if', token, condition, then, otherwise };
    }
    if (this.take('while')) {
      this.expect('('); const condition = this.expression(); this.expect(')');
      return { kind: 'while', token, condition, body: this.statement() };
    }
    if (this.take('do')) {
      const body = this.statement(); this.expect('while'); this.expect('(');
      const condition = this.expression(); this.expect(')'); this.expect(';');
      return { kind: 'do', token, condition, body };
    }
    if (this.take('for')) {
      this.expect('(');
      const init = this.at(';') ? null : this.isDeclaration() ? this.declaration()
        : { kind: 'expressions', token: this.token, values: this.expressions() };
      this.expect(';');
      const condition = this.at(';') ? null : this.expression(); this.expect(';');
      const increment = this.at(')') ? [] : this.expressions(); this.expect(')');
      return { kind: 'for', token, init, condition, increment, body: this.statement() };
    }
    if (this.take('return')) {
      const value = this.at(';') ? null : this.expression(); this.expect(';');
      return { kind: 'return', token, value };
    }
    if (this.take('break') || this.take('continue')) {
      this.expect(';');
      return { kind: token.value, token };
    }
    if (this.isDeclaration()) { const node = this.declaration(); this.expect(';'); return node; }
    const value = this.expression(); this.expect(';');
    return { kind: 'expressions', token, values: [value] };
  }
  expression(minimum = 1) {
    let left = this.unary();
    while (this.token.kind === 'symbol' && (PRECEDENCE.get(this.token.value) || 0) >= minimum) {
      const token = this.tokens[this.index++], precedence = PRECEDENCE.get(token.value);
      const right = this.expression(precedence === 1 ? precedence : precedence + 1);
      left = { kind: precedence === 1 ? 'assign' : 'binary', token, op: token.value, left, right };
    }
    if (minimum === 1 && this.take('?')) {
      const yes = this.expression(); this.expect(':');
      left = { kind: 'conditional', token: left.token, condition: left, yes, no: this.expression() };
    }
    return left;
  }
  unary() {
    if (['+', '-', '!', '++', '--'].some(value => this.at(value))) {
      const token = this.tokens[this.index++];
      return { kind: ['++', '--'].includes(token.value) ? 'increment' : 'unary', token, op: token.value, value: this.unary(), prefix: true };
    }
    let result = this.primary();
    if (this.at('++') || this.at('--')) {
      const token = this.tokens[this.index++];
      result = { kind: 'increment', token, op: token.value, value: result, prefix: false };
    }
    return result;
  }
  primary() {
    const token = this.token;
    if (token.kind === 'number' || token.kind === 'string') {
      this.index++;
      return { kind: 'literal', token, literalType: token.kind === 'number' ? 'int' : 'string', value: token.value };
    }
    if (this.take('true') || this.take('false'))
      return { kind: 'literal', token, literalType: 'bool', value: token.value === 'true' };
    if (this.take('unchecked')) {
      this.expect('('); const value = this.expression(); this.expect(')');
      return { kind: 'unchecked', token, value };
    }
    if (this.take('(')) { const result = this.expression(); this.expect(')'); return result; }
    if (token.kind !== 'identifier') fail(token, `Unsupported or invalid expression ${JSON.stringify(token.value)}`);
    const name = this.qualifiedName();
    let typeArgs = [];
    if (this.at('<')) {
      let cursor = this.index + 1;
      while (this.tokens[cursor]?.kind === 'identifier' || ['int', 'bool', 'string', ','].includes(this.tokens[cursor]?.value)) cursor++;
      if (this.tokens[cursor]?.value === '>' && this.tokens[cursor + 1]?.value === '(')
        typeArgs = this.typeList(() => this.type());
    }
    if (this.take('(')) {
      const args = this.at(')') ? [] : this.expressions();
      this.expect(')');
      return { kind: 'call', token, name, typeArgs, args };
    }
    return { kind: 'name', token, name };
  }
}
