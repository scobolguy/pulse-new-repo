/**
 * PL/0 Interpreter with String Support
 * 
 * Grammar (extended with String support):
 * program = { statement }
 * statement = assignment | ifStatement | whileStatement | forStatement | procCall | blockStatement
 * assignment = ident ":=" expr
 * ifStatement = "IF" expr "THEN" statement ["ELSE" statement]
 * whileStatement = "WHILE" expr "DO" statement
 * forStatement = "FOR" ident ":=" expr "TO" expr "DO" statement
 * procCall = "CALL" ident
 * blockStatement = "BEGIN" { statement ";" } "END"
 * expr = term { ("+" | "-" | "||") term }
 * term = factor { ("*" | "/") factor }
 * factor = "(" expr ")" | ident | number | string | funcCall | unaryOp factor
 * unaryOp = "-" | "NOT"
 * funcCall = ident "(" [exprList] ")"
 * exprList = expr { "," expr }
 * ident = letter { letter | digit | "_" }
 * number = digit { digit }
 * string = '"' ... '"' | "'" ... "'"
 */

class Token {
  constructor(type, value, line = 1, col = 1) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.col = col;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.col})`;
  }
}

class Tokenizer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.tokenize();
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // Comments
      if (ch === '/' && this.peek() === '/') {
        this.skipLineComment();
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        this.tokens.push(this.readString());
        continue;
      }

      // Operators
      if (ch === ':' && this.peek() === '=') {
        this.tokens.push(new Token('ASSIGN', ':=', this.line, this.col));
        this.advance(2);
        continue;
      }

      if (ch === '|' && this.peek() === '|') {
        this.tokens.push(new Token('CONCAT', '||', this.line, this.col));
        this.advance(2);
        continue;
      }

      if (ch === '<' && this.peek() === '=') {
        this.tokens.push(new Token('LE', '<=', this.line, this.col));
        this.advance(2);
        continue;
      }

      if (ch === '>' && this.peek() === '=') {
        this.tokens.push(new Token('GE', '>=', this.line, this.col));
        this.advance(2);
        continue;
      }

      if (ch === '<' && this.peek() === '>') {
        this.tokens.push(new Token('NEQ', '<>', this.line, this.col));
        this.advance(2);
        continue;
      }

      // Single char tokens
      const singleCharMap = {
        '(': 'LPAREN',
        ')': 'RPAREN',
        '+': 'PLUS',
        '-': 'MINUS',
        '*': 'MUL',
        '/': 'DIV',
        '=': 'EQ',
        '<': 'LT',
        '>': 'GT',
        ',': 'COMMA',
        ';': 'SEMICOLON',
      };

      if (singleCharMap[ch]) {
        this.tokens.push(new Token(singleCharMap[ch], ch, this.line, this.col));
        this.advance();
        continue;
      }

      // Numbers
      if (this.isDigit(ch)) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifiers and keywords
      if (this.isLetter(ch) || ch === '_') {
        this.tokens.push(this.readIdent());
        continue;
      }

      throw new Error(`Unexpected character: ${ch} at ${this.line}:${this.col}`);
    }

    this.tokens.push(new Token('EOF', null, this.line, this.col));
  }

  readString() {
    const quote = this.source[this.pos];
    const startLine = this.line;
    const startCol = this.col;
    let value = '';
    this.advance(); // skip opening quote

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\' && this.peek() === quote) {
        value += quote;
        this.advance(2);
      } else if (this.source[this.pos] === '\\' && this.peek() === 'n') {
        value += '\n';
        this.advance(2);
      } else if (this.source[this.pos] === '\\' && this.peek() === 't') {
        value += '\t';
        this.advance(2);
      } else {
        value += this.source[this.pos];
        this.advance();
      }
    }

    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at ${startLine}:${startCol}`);
    }

    this.advance(); // skip closing quote
    return new Token('STRING', value, startLine, startCol);
  }

  readNumber() {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';

    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.source[this.pos];
      this.advance();
    }

    return new Token('NUMBER', parseInt(value, 10), startLine, startCol);
  }

  readIdent() {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';

    while (
      this.pos < this.source.length &&
      (this.isLetter(this.source[this.pos]) || this.isDigit(this.source[this.pos]) || this.source[this.pos] === '_')
    ) {
      value += this.source[this.pos];
      this.advance();
    }

    const keywords = ['IF', 'THEN', 'ELSE', 'WHILE', 'DO', 'FOR', 'TO', 'BEGIN', 'END', 'CALL', 'VAR', 'PROCEDURE', 'NOT'];
    const tokenType = keywords.includes(value.toUpperCase()) ? value.toUpperCase() : 'IDENT';

    return new Token(tokenType, value, startLine, startCol);
  }

  skipWhitespace() {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      if (this.source[this.pos] === '\n') {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
      this.pos += 1;
    }
  }

  skipLineComment() {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.advance();
    }
  }

  isLetter(ch) {
    return /[a-zA-Z]/.test(ch);
  }

  isDigit(ch) {
    return /\d/.test(ch);
  }

  peek() {
    return this.source[this.pos + 1] || null;
  }

  advance(count = 1) {
    for (let i = 0; i < count; i += 1) {
      if (this.source[this.pos] === '\n') {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
      this.pos += 1;
    }
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const statements = [];
    while (!this.isAtEnd()) {
      statements.push(this.parseStatement());
      if (this.match('SEMICOLON')) {
        // Optional semicolon between statements
      }
    }
    return {
      type: 'Program',
      statements,
    };
  }

  parseStatement() {
    if (this.match('IF')) {
      return this.parseIfStatement();
    }
    if (this.match('WHILE')) {
      return this.parseWhileStatement();
    }
    if (this.match('FOR')) {
      return this.parseForStatement();
    }
    if (this.match('BEGIN')) {
      return this.parseBlockStatement();
    }
    if (this.match('CALL')) {
      const name = this.consumeIdent('Expected identifier after CALL');
      return { type: 'ProcCall', name };
    }
    if (this.check('IDENT')) {
      return this.parseAssignment();
    }
    throw new Error(`Unexpected token: ${this.peek()}`);
  }

  parseIfStatement() {
    const condition = this.parseExpr();
    this.consume('THEN', 'Expected THEN after IF condition');
    const thenStmt = this.parseStatement();
    let elseStmt = null;
    if (this.match('ELSE')) {
      elseStmt = this.parseStatement();
    }
    return {
      type: 'IfStatement',
      condition,
      thenStmt,
      elseStmt,
    };
  }

  parseWhileStatement() {
    const condition = this.parseExpr();
    this.consume('DO', 'Expected DO after WHILE condition');
    const body = this.parseStatement();
    return {
      type: 'WhileStatement',
      condition,
      body,
    };
  }

  parseForStatement() {
    const variable = this.consumeIdent('Expected variable name in FOR');
    this.consume('ASSIGN', 'Expected := in FOR statement');
    const start = this.parseExpr();
    this.consume('TO', 'Expected TO in FOR statement');
    const end = this.parseExpr();
    this.consume('DO', 'Expected DO in FOR statement');
    const body = this.parseStatement();
    return {
      type: 'ForStatement',
      variable,
      start,
      end,
      body,
    };
  }

  parseBlockStatement() {
    const statements = [];
    while (!this.check('END') && !this.isAtEnd()) {
      statements.push(this.parseStatement());
      if (this.match('SEMICOLON')) {
        // Optional semicolon
      }
    }
    this.consume('END', 'Expected END to close block');
    return {
      type: 'BlockStatement',
      statements,
    };
  }

  parseAssignment() {
    const name = this.consumeIdent('Expected identifier');
    this.consume('ASSIGN', 'Expected :=');
    const value = this.parseExpr();
    return {
      type: 'Assignment',
      name,
      value,
    };
  }

  parseExpr() {
    let left = this.parseTerm();
    while (this.match('PLUS', 'MINUS', 'CONCAT')) {
      const op = this.previous().value;
      const right = this.parseTerm();
      left = {
        type: 'BinaryOp',
        op,
        left,
        right,
      };
    }
    return this.parseComparison(left);
  }

  parseComparison(left) {
    if (this.match('EQ', 'LT', 'GT', 'LE', 'GE', 'NEQ')) {
      const op = this.previous().value;
      const right = this.parseTerm();
      return {
        type: 'BinaryOp',
        op,
        left,
        right,
      };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.match('MUL', 'DIV')) {
      const op = this.previous().value;
      const right = this.parseFactor();
      left = {
        type: 'BinaryOp',
        op,
        left,
        right,
      };
    }
    return left;
  }

  parseFactor() {
    if (this.match('LPAREN')) {
      const expr = this.parseExpr();
      this.consume('RPAREN', 'Expected )');
      return expr;
    }

    if (this.match('MINUS', 'NOT')) {
      const op = this.previous().value;
      const operand = this.parseFactor();
      return {
        type: 'UnaryOp',
        op,
        operand,
      };
    }

    if (this.match('NUMBER')) {
      return {
        type: 'Literal',
        value: this.previous().value,
        valueType: 'number',
      };
    }

    if (this.match('STRING')) {
      return {
        type: 'Literal',
        value: this.previous().value,
        valueType: 'string',
      };
    }

    if (this.check('IDENT')) {
      const name = this.consumeIdent('Expected identifier');
      if (this.match('LPAREN')) {
        // Function call
        const args = [];
        if (!this.check('RPAREN')) {
          args.push(this.parseExpr());
          while (this.match('COMMA')) {
            args.push(this.parseExpr());
          }
        }
        this.consume('RPAREN', 'Expected ) after function arguments');
        return {
          type: 'FunctionCall',
          name,
          args,
        };
      }
      // Variable reference
      return {
        type: 'VariableRef',
        name,
      };
    }

    throw new Error(`Unexpected token: ${this.peek()}`);
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  advance() {
    if (!this.isAtEnd()) this.pos += 1;
    return this.previous();
  }

  isAtEnd() {
    return this.peek().type === 'EOF';
  }

  peek() {
    return this.tokens[this.pos];
  }

  previous() {
    return this.tokens[this.pos - 1];
  }

  consume(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    throw new Error(`${message} at ${this.peek()}`);
  }

  consumeIdent(message) {
    if (this.check('IDENT')) {
      const token = this.advance();
      return token.value;
    }
    throw new Error(`${message} at ${this.peek()}`);
  }
}

class Interpreter {
  constructor(globalVariables = {}) {
    this.globals = globalVariables;
    this.variables = { ...globalVariables };
    this.procedures = {};
    this.returnValue = null;
  }

  interpret(ast) {
    if (ast.type === 'Program') {
      for (const stmt of ast.statements) {
        this.executeStatement(stmt);
      }
      return this.variables;
    }
    return this.executeStatement(ast);
  }

  executeStatement(stmt) {
    if (!stmt) return;

    switch (stmt.type) {
      case 'Assignment':
        this.variables[stmt.name] = this.evaluateExpr(stmt.value);
        break;

      case 'IfStatement': {
        const condition = this.evaluateExpr(stmt.condition);
        if (this.isTruthy(condition)) {
          this.executeStatement(stmt.thenStmt);
        } else if (stmt.elseStmt) {
          this.executeStatement(stmt.elseStmt);
        }
        break;
      }

      case 'WhileStatement':
        while (this.isTruthy(this.evaluateExpr(stmt.condition))) {
          this.executeStatement(stmt.body);
        }
        break;

      case 'ForStatement': {
        const start = this.toNumber(this.evaluateExpr(stmt.start));
        const end = this.toNumber(this.evaluateExpr(stmt.end));
        for (let i = start; i <= end; i += 1) {
          this.variables[stmt.variable] = i;
          this.executeStatement(stmt.body);
        }
        break;
      }

      case 'BlockStatement':
        for (const s of stmt.statements) {
          this.executeStatement(s);
        }
        break;

      case 'ProcCall':
        if (this.procedures[stmt.name]) {
          this.procedures[stmt.name]();
        } else {
          throw new Error(`Undefined procedure: ${stmt.name}`);
        }
        break;

      default:
        throw new Error(`Unknown statement type: ${stmt.type}`);
    }
  }

  evaluateExpr(expr) {
    switch (expr.type) {
      case 'Literal':
        return expr.value;

      case 'VariableRef': {
        if (!(expr.name in this.variables)) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return this.variables[expr.name];
      }

      case 'BinaryOp': {
        const left = this.evaluateExpr(expr.left);
        const right = this.evaluateExpr(expr.right);
        return this.applyBinaryOp(expr.op, left, right);
      }

      case 'UnaryOp': {
        const operand = this.evaluateExpr(expr.operand);
        return this.applyUnaryOp(expr.op, operand);
      }

      case 'FunctionCall':
        return this.callBuiltinFunction(expr.name, expr.args);

      default:
        throw new Error(`Unknown expression type: ${expr.type}`);
    }
  }

  applyBinaryOp(op, left, right) {
    switch (op) {
      case '+': {
        const l = this.toNumber(left);
        const r = this.toNumber(right);
        return l + r;
      }
      case '-': {
        const l = this.toNumber(left);
        const r = this.toNumber(right);
        return l - r;
      }
      case '*': {
        const l = this.toNumber(left);
        const r = this.toNumber(right);
        return l * r;
      }
      case '/': {
        const l = this.toNumber(left);
        const r = this.toNumber(right);
        if (r === 0) throw new Error('Division by zero');
        return Math.floor(l / r);
      }
      case '||': {
        return this.toString(left) + this.toString(right);
      }
      case '=':
        return this.toNumber(left) === this.toNumber(right) ? 1 : 0;
      case '<':
        return this.toNumber(left) < this.toNumber(right) ? 1 : 0;
      case '>':
        return this.toNumber(left) > this.toNumber(right) ? 1 : 0;
      case '<=':
        return this.toNumber(left) <= this.toNumber(right) ? 1 : 0;
      case '>=':
        return this.toNumber(left) >= this.toNumber(right) ? 1 : 0;
      case '<>':
        return this.toNumber(left) !== this.toNumber(right) ? 1 : 0;
      default:
        throw new Error(`Unknown binary operator: ${op}`);
    }
  }

  applyUnaryOp(op, operand) {
    switch (op) {
      case '-':
        return -this.toNumber(operand);
      case 'NOT':
        return this.isTruthy(operand) ? 0 : 1;
      default:
        throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  callBuiltinFunction(name, args) {
    const argValues = args.map(arg => this.evaluateExpr(arg));

    switch (name.toLowerCase()) {
      case 'trim':
        return this.toString(argValues[0]).trim();

      case 'upper':
        return this.toString(argValues[0]).toUpperCase();

      case 'lower':
        return this.toString(argValues[0]).toLowerCase();

      case 'substr': {
        const str = this.toString(argValues[0]);
        const start = this.toNumber(argValues[1]) || 1; // 1-based indexing
        const len = argValues[2] != null ? this.toNumber(argValues[2]) : undefined;
        return str.substring(start - 1, len != null ? start - 1 + len : undefined);
      }

      case 'length':
        return this.toString(argValues[0]).length;

      case 'index': {
        const str = this.toString(argValues[0]);
        const searchStr = this.toString(argValues[1]);
        return str.indexOf(searchStr) + 1; // 1-based result
      }

      case 'replace': {
        const str = this.toString(argValues[0]);
        const from = this.toString(argValues[1]);
        const to = this.toString(argValues[2]);
        return str.replace(new RegExp(from, 'g'), to);
      }

      case 'startswith': {
        const str = this.toString(argValues[0]);
        const prefix = this.toString(argValues[1]);
        return str.startsWith(prefix) ? 1 : 0;
      }

      case 'endswith': {
        const str = this.toString(argValues[0]);
        const suffix = this.toString(argValues[1]);
        return str.endsWith(suffix) ? 1 : 0;
      }

      case 'reverse':
        return this.toString(argValues[0]).split('').reverse().join('');

      case 'padleft': {
        const str = this.toString(argValues[0]);
        const width = this.toNumber(argValues[1]);
        const padChar = argValues[2] != null ? this.toString(argValues[2])[0] || ' ' : ' ';
        return str.padStart(width, padChar);
      }

      case 'padright': {
        const str = this.toString(argValues[0]);
        const width = this.toNumber(argValues[1]);
        const padChar = argValues[2] != null ? this.toString(argValues[2])[0] || ' ' : ' ';
        return str.padEnd(width, padChar);
      }

      case 'split': {
        const str = this.toString(argValues[0]);
        const delimiter = this.toString(argValues[1]);
        return str.split(delimiter);
      }

      case 'join': {
        // join(array, delimiter) - requires array support
        const arr = Array.isArray(argValues[0]) ? argValues[0] : [argValues[0]];
        const delimiter = this.toString(argValues[1] || '');
        return arr.join(delimiter);
      }

      // Numeric functions
      case 'abs':
        return Math.abs(this.toNumber(argValues[0]));

      case 'min': {
        if (argValues.length === 0) throw new Error('min requires at least one argument');
        return Math.min(...argValues.map(v => this.toNumber(v)));
      }

      case 'max': {
        if (argValues.length === 0) throw new Error('max requires at least one argument');
        return Math.max(...argValues.map(v => this.toNumber(v)));
      }

      case 'round':
        return Math.round(this.toNumber(argValues[0]));

      case 'floor':
        return Math.floor(this.toNumber(argValues[0]));

      case 'ceil':
        return Math.ceil(this.toNumber(argValues[0]));

      // MT-specific functions
      case 'yymmddtoiso': {
        const src = this.toString(argValues[0]).trim();
        if (!/^\d{6}$/.test(src)) return src;
        const yy = parseInt(src.slice(0, 2), 10);
        const mm = src.slice(2, 4);
        const dd = src.slice(4, 6);
        const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
        return `${yyyy}-${mm}-${dd}`;
      }

      case 'mtamounttodecimal':
        return this.toString(argValues[0]).trim().replace(',', '.');

      case 'mtpartyname': {
        const lines = this.toString(argValues[0])
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean);
        const nonAccount = lines.filter(line => !line.startsWith('/'));
        return nonAccount[0] || lines[0] || '';
      }

      case 'mtchargebearertoiso': {
        const code = this.toString(argValues[0]).trim().toUpperCase();
        if (code === 'OUR') return 'DEBT';
        if (code === 'BEN') return 'CRED';
        return code;
      }

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (isNaN(num)) return 0;
      return num;
    }
    return 0;
  }

  toString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(v => this.toString(v)).join(',');
    return String(value);
  }

  isTruthy(value) {
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return Boolean(value);
  }
}

export function runPL0(sourceCode, inputVariables = {}) {
  try {
    const tokenizer = new Tokenizer(sourceCode);
    const parser = new Parser(tokenizer.tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter(inputVariables);
    return interpreter.interpret(ast);
  } catch (error) {
    throw new Error(`PL/0 Runtime Error: ${error.message}`);
  }
}

export { Tokenizer, Parser, Interpreter };
