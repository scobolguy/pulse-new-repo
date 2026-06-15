import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compilePascalishWithAntlr } from './pascalish-antlr-compiler.mjs';

const KEYWORDS = new Set([
  'SERVICE',
  'ROUTER',
  'MAPPER',
  'INPUT',
  'SOURCE',
  'TARGET',
  'DESCRIPTION',
  'ENABLED',
  'BEGIN',
  'END',
  'OUTPUT',
  'TYPE',
  'TYPES',
  'WHEN',
  'TRANSFORM',
  'MAP',
  'TO',
  'USING',
  'TRUE',
  'FALSE',
  'VAR',
  'FROM',
  'LIBRARIAN',
  'IF',
  'THEN',
  'ELSE',
  'WHILE',
  'DO',
  'FOR',
  'CALL',
  'NOT',
  'COBEGIN',
  'COEND',
  'SUBFLOW',
  'SYNC',
  'ASYNC',
  'WAIT',
  'ON',
  'ERROR',
  'BACKOUT',
  'TRY',
  'CATCH',
  'ENDTRY'
]);

class DSLTokenizer {
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
      if (ch === '{') {
        this.skipBraceComment();
        continue;
      }
      if (ch === '(' && this.peek() === '*') {
        this.skipParenStarComment();
        continue;
      }

      if (ch === '"' || ch === "'") {
        this.tokens.push(this.readString());
        continue;
      }

      if (ch === ';') {
        this.tokens.push(this.token('SEMICOLON', ';'));
        this.advance();
        continue;
      }

      if (ch === ':' && this.peek() === '=') {
        this.tokens.push(this.token('ASSIGN', ':='));
        this.advance(2);
        continue;
      }

      if (ch === '|' && this.peek() === '|') {
        this.tokens.push(this.token('CONCAT', '||'));
        this.advance(2);
        continue;
      }

      if (ch === '<' && this.peek() === '=') {
        this.tokens.push(this.token('LE', '<='));
        this.advance(2);
        continue;
      }

      if (ch === '>' && this.peek() === '=') {
        this.tokens.push(this.token('GE', '>='));
        this.advance(2);
        continue;
      }

      if (ch === '<' && this.peek() === '>') {
        this.tokens.push(this.token('NEQ', '<>'));
        this.advance(2);
        continue;
      }

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
        ',': 'COMMA'
      };

      if (singleCharMap[ch]) {
        this.tokens.push(this.token(singleCharMap[ch], ch));
        this.advance();
        continue;
      }

      if (this.isDigit(ch)) {
        this.tokens.push(this.readNumber());
        continue;
      }

      if (this.isLetter(ch) || ch === '_') {
        this.tokens.push(this.readWord());
        continue;
      }

      throw new Error(`Unexpected character '${ch}' at ${this.line}:${this.col}`);
    }

    this.tokens.push(this.token('EOF', null));
  }

  token(type, value) {
    return { type, value, line: this.line, col: this.col };
  }

  readString() {
    const quote = this.source[this.pos];
    const line = this.line;
    const col = this.col;
    this.advance();
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        const next = this.peek();
        if (next === quote) {
          value += quote;
          this.advance(2);
          continue;
        }
        if (next === 'n') {
          value += '\n';
          this.advance(2);
          continue;
        }
        if (next === 't') {
          value += '\t';
          this.advance(2);
          continue;
        }
      }
      value += this.source[this.pos];
      this.advance();
    }

    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at ${line}:${col}`);
    }

    this.advance();
    return { type: 'STRING', value, line, col };
  }

  readWord() {
    const line = this.line;
    const col = this.col;
    let value = '';

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (!(this.isLetter(ch) || this.isDigit(ch) || ch === '_' || ch === '-')) break;
      value += ch;
      this.advance();
    }

    const upper = value.toUpperCase();
    if (KEYWORDS.has(upper)) {
      return { type: upper, value: upper, line, col };
    }
    return { type: 'IDENT', value, line, col };
  }

  readNumber() {
    const line = this.line;
    const col = this.col;
    let value = '';

    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.source[this.pos];
      this.advance();
    }

    return { type: 'NUMBER', value, line, col };
  }

  skipWhitespace() {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      this.advance();
    }
  }

  skipBraceComment() {
    const line = this.line;
    const col = this.col;
    this.advance();
    while (this.pos < this.source.length && this.source[this.pos] !== '}') {
      this.advance();
    }
    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated Pascal comment at ${line}:${col}`);
    }
    this.advance();
  }

  skipParenStarComment() {
    const line = this.line;
    const col = this.col;
    this.advance(2);
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek() === ')') {
        this.advance(2);
        return;
      }
      this.advance();
    }
    throw new Error(`Unterminated Pascal comment at ${line}:${col}`);
  }

  isLetter(ch) {
    return /[a-zA-Z]/.test(ch);
  }

  isDigit(ch) {
    return /[0-9]/.test(ch);
  }

  peek() {
    return this.source[this.pos + 1] || null;
  }

  advance(count = 1) {
    for (let i = 0; i < count; i += 1) {
      const ch = this.source[this.pos];
      this.pos += 1;
      if (ch === '\n') {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
    }
  }
}

class DSLParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parseProgram() {
    let serviceId = null;
    const routers = [];
    const mappers = [];

    while (!this.check('EOF')) {
      if (this.match('SERVICE')) {
        serviceId = this.parseString('Expected service id string after SERVICE');
        this.consume('SEMICOLON', 'Expected ; after SERVICE declaration');
        continue;
      }
      if (this.match('ROUTER')) {
        routers.push(this.parseRouterDecl());
        continue;
      }
      if (this.match('MAPPER')) {
        mappers.push(this.parseMapperDecl());
        continue;
      }
      throw this.errorAtCurrent('Expected SERVICE, ROUTER, or MAPPER');
    }

    return {
      type: 'Program',
      serviceId,
      routers,
      mappers
    };
  }

  parseRouterDecl() {
    const id = this.parseStringOrIdent('Expected router id');
    this.consume('INPUT', 'Expected INPUT in ROUTER declaration');
    const inputQueue = this.parseString('Expected input queue string');

    let description = '';
    let enabled = true;
    let serviceId = null;

    while (!this.check('BEGIN')) {
      if (this.match('DESCRIPTION')) {
        description = this.parseString('Expected string after DESCRIPTION');
      } else if (this.match('ENABLED')) {
        enabled = this.parseBoolean('Expected TRUE or FALSE after ENABLED');
      } else if (this.match('SERVICE')) {
        serviceId = this.parseString('Expected service string after SERVICE');
      } else {
        throw this.errorAtCurrent('Expected DESCRIPTION, ENABLED, SERVICE, or BEGIN');
      }
    }

    this.consume('BEGIN', 'Expected BEGIN to start ROUTER body');
    const outputs = [];
    while (!this.check('END')) {
      this.consume('OUTPUT', 'Expected OUTPUT in ROUTER body');
      const queueName = this.parseString('Expected output queue string');

      let dataTypeId = null;
      let dataTypeIds = null;
      while (!this.check('WHEN')) {
        if (this.match('TYPE')) {
          dataTypeId = this.parseString('Expected type string after TYPE');
          dataTypeIds = [dataTypeId];
          continue;
        }
        if (this.match('TYPES')) {
          dataTypeIds = this.parseStringList('Expected type list after TYPES');
          dataTypeId = dataTypeIds[0] || null;
          continue;
        }
        throw this.errorAtCurrent('Expected TYPE, TYPES, or WHEN in OUTPUT block');
      }

      this.consume('WHEN', 'Expected WHEN in OUTPUT block');
      const whenRule = this.parsePL0Snippet('WHEN');
      this.consume('TRANSFORM', 'Expected TRANSFORM in OUTPUT block');
      const transformRule = this.parsePL0Snippet('TRANSFORM');
      this.consume('SEMICOLON', 'Expected ; after OUTPUT block');

      outputs.push({
        type: 'OutputDecl',
        queueName,
        dataTypeId,
        dataTypeIds,
        whenRule,
        transformRule
      });
    }
    this.consume('END', 'Expected END to close ROUTER');
    this.consume('SEMICOLON', 'Expected ; after ROUTER END');

    return {
      type: 'RouterDecl',
      id,
      inputQueue,
      description,
      enabled,
      serviceId,
      outputs
    };
  }

  parseMapperDecl() {
    const id = this.parseStringOrIdent('Expected mapper id');
    this.consume('SOURCE', 'Expected SOURCE in MAPPER declaration');
    const sourceTypeId = this.parseString('Expected source type string');
    this.consume('TARGET', 'Expected TARGET in MAPPER declaration');
    const targetTypeId = this.parseString('Expected target type string');

    let description = '';
    let enabled = true;

    while (!this.check('BEGIN')) {
      if (this.match('DESCRIPTION')) {
        description = this.parseString('Expected string after DESCRIPTION');
      } else if (this.match('ENABLED')) {
        enabled = this.parseBoolean('Expected TRUE or FALSE after ENABLED');
      } else {
        throw this.errorAtCurrent('Expected DESCRIPTION, ENABLED, or BEGIN');
      }
    }

    this.consume('BEGIN', 'Expected BEGIN to start MAPPER body');
    const maps = [];
    while (!this.check('END')) {
      this.consume('MAP', 'Expected MAP in MAPPER body');
      const sourcePath = this.parseString('Expected source path string after MAP');
      this.consume('TO', 'Expected TO in MAP clause');
      const targetPath = this.parseString('Expected target path string after TO');
      let conversionRule = 'output := src;';
      if (this.match('USING')) {
        conversionRule = this.parsePL0Snippet('USING');
      }
      this.consume('SEMICOLON', 'Expected ; after MAP clause');
      maps.push({
        type: 'MapDecl',
        sourcePath,
        targetPath,
        conversionRule
      });
    }

    this.consume('END', 'Expected END to close MAPPER');
    this.consume('SEMICOLON', 'Expected ; after MAPPER END');

    return {
      type: 'MapperDecl',
      id,
      sourceTypeId,
      targetTypeId,
      description,
      enabled,
      maps
    };
  }

  parseString(message) {
    if (!this.check('STRING')) {
      throw this.errorAtCurrent(message);
    }
    return this.advance().value;
  }

  parseStringOrIdent(message) {
    if (this.check('STRING') || this.check('IDENT')) {
      return this.advance().value;
    }
    throw this.errorAtCurrent(message);
  }

  parseStringList(message) {
    if (this.check('STRING')) {
      return [this.advance().value];
    }

    this.consume('LPAREN', `${message} (expected '(')`);
    const values = [];
    values.push(this.parseString('Expected string value in TYPES list'));
    while (this.match('COMMA')) {
      values.push(this.parseString('Expected string value after comma in TYPES list'));
    }
    this.consume('RPAREN', 'Expected ) to close TYPES list');
    return values;
  }

  parsePL0Snippet(context) {
    if (this.check('STRING')) {
      return this.advance().value;
    }

    if (this.match('BEGIN')) {
      return this.parsePL0BlockAfterBegin();
    }

    throw this.errorAtCurrent(`Expected quoted PL/0 snippet or BEGIN...END block after ${context}`);
  }

  parsePL0BlockAfterBegin() {
    const out = ['BEGIN'];
    let depth = 1;

    while (!this.check('EOF')) {
      const t = this.advance();
      if (t.type === 'BEGIN') {
        depth += 1;
        out.push('BEGIN');
        continue;
      }
      if (t.type === 'END') {
        depth -= 1;
        out.push('END');
        if (depth === 0) {
          return this.normalizePL0Tokens(out);
        }
        continue;
      }
      out.push(this.renderTokenText(t));
    }

    throw this.errorAtCurrent('Unterminated BEGIN...END PL/0 block');
  }

  normalizePL0Tokens(tokens) {
    const joined = tokens.join(' ').replace(/\s+/g, ' ').trim();
    return joined
      .replace(/\s+([,;\)])/g, '$1')
      .replace(/([\(])\s+/g, '$1');
  }

  renderTokenText(token) {
    if (!token) return '';
    if (token.type === 'STRING') return JSON.stringify(token.value);
    if (token.value != null) return String(token.value);
    return token.type;
  }

  parseBoolean(message) {
    if (this.match('TRUE')) return true;
    if (this.match('FALSE')) return false;
    throw this.errorAtCurrent(message);
  }

  match(type) {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.errorAtCurrent(message);
  }

  check(type) {
    return this.peek().type === type;
  }

  peek() {
    return this.tokens[this.pos];
  }

  advance() {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  errorAtCurrent(message) {
    const t = this.peek();
    return new Error(`${message} at ${t.line}:${t.col} (token ${t.type})`);
  }
}

function toRouterRules(ast) {
  const now = new Date().toISOString();

  const stringifyTypeRef = (typeRef) => {
    if (!typeRef || typeof typeRef !== 'object') return '';
    const id = String(typeRef.id || '').trim();
    const genericArgs = Array.isArray(typeRef.genericArgs) ? typeRef.genericArgs : [];
    if (genericArgs.length === 0) return id;
    const renderedArgs = genericArgs.map(arg => stringifyTypeRef(arg)).filter(Boolean);
    return renderedArgs.length > 0 ? `${id}<${renderedArgs.join(',')}>` : id;
  };

  return ast.routers.map(router => {
    return {
      id: router.id,
      name: router.id,
      serviceId: router.serviceId || ast.serviceId || 'default-router-service',
      enabled: router.enabled,
      inputQueue: router.inputQueue,
      ...(Array.isArray(router.methods) && router.methods.length > 0 ? { methods: router.methods } : {}),
      description: router.description,
      outputs: router.outputs.map(out => ({
        queueName: out.queueName,
        ...(out.dataTypeIds && out.dataTypeIds.length > 0
          ? { dataTypeIds: out.dataTypeIds, dataTypeId: out.dataTypeIds[0] }
          : (out.dataTypeId ? { dataTypeId: out.dataTypeId, dataTypeIds: [out.dataTypeId] } : {})),
        ...(out.dataType ? { dataTypeRef: out.dataType, dataTypeSignature: stringifyTypeRef(out.dataType) } : {}),
        ...(out.dataTypes && out.dataTypes.length > 0
          ? { dataTypeRefs: out.dataTypes, dataTypeSignatures: out.dataTypes.map(item => stringifyTypeRef(item)) }
          : {}),
        whenRule: out.whenRule,
        transformRule: out.transformRule
      })),
      createdAt: now,
      updatedAt: now
    };
  });
}

function toDataMappings(ast) {
  const now = new Date().toISOString();

  const stringifyTypeRef = (typeRef) => {
    if (!typeRef || typeof typeRef !== 'object') return '';
    const id = String(typeRef.id || '').trim();
    const genericArgs = Array.isArray(typeRef.genericArgs) ? typeRef.genericArgs : [];
    if (genericArgs.length === 0) return id;
    const renderedArgs = genericArgs.map(arg => stringifyTypeRef(arg)).filter(Boolean);
    return renderedArgs.length > 0 ? `${id}<${renderedArgs.join(',')}>` : id;
  };

  return ast.mappers.map(mapper => {
    return {
      id: mapper.id,
      name: mapper.id,
      sourceTypeId: mapper.sourceTypeId,
      targetTypeId: mapper.targetTypeId,
      sourceTypeRef: mapper.sourceType || null,
      targetTypeRef: mapper.targetType || null,
      sourceTypeSignature: stringifyTypeRef(mapper.sourceType),
      targetTypeSignature: stringifyTypeRef(mapper.targetType),
      enabled: mapper.enabled,
      description: mapper.description,
      items: mapper.maps.map(item => ({
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        kind: 'leaf',
        sourceValueType: 'unknown',
        targetValueType: 'unknown',
        conversionRule: item.conversionRule
      })),
      createdAt: now,
      updatedAt: now
    };
  });
}

function parseArgs(argv) {
  const args = {
    in: './data/router-mapper.dsl',
    routerOut: './data/router-rules.generated.json',
    mappingOut: './data/data-mappings.generated.json',
    artifactOut: './data/router-mapper-compiled.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--router-out') args.routerOut = argv[i + 1];
    if (token === '--mapping-out') args.mappingOut = argv[i + 1];
    if (token === '--artifact-out') args.artifactOut = argv[i + 1];
  }

  return args;
}

export function compileRouterMapperDSL(sourceText) {
  const compiledAntlr = compilePascalishWithAntlr(sourceText);
  const ast = compiledAntlr.ast;
  const routerRules = toRouterRules(ast);
  const dataMappings = toDataMappings(ast);
  const runtimeUnit = compiledAntlr.runtimeUnit || ast.runtimeUnit || {
    kind: 'service',
    id: ast.serviceId || 'default-router-service',
    refreshMs: null
  };

  return {
    version: 1,
    compiledAt: new Date().toISOString(),
    serviceId: ast.serviceId || 'default-router-service',
    runtimeUnit,
    ast,
    roles: compiledAntlr.roles || ast.roles || [],
    codeLibraries: compiledAntlr.codeLibraries || ast.codeLibraries || [],
    uses: compiledAntlr.uses || ast.uses || [],
    interoperability: compiledAntlr.interoperability || ast.interop || [],
    variableDeclarations: compiledAntlr.variableDeclarations || ast.variables || [],
    routerRules,
    dataMappings
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const sourceText = await fs.readFile(inputPath, 'utf-8');

  const compiled = compileRouterMapperDSL(sourceText);

  const routerOutPath = path.resolve(args.routerOut);
  const mappingOutPath = path.resolve(args.mappingOut);
  const artifactOutPath = path.resolve(args.artifactOut);

  await fs.mkdir(path.dirname(routerOutPath), { recursive: true });
  await fs.mkdir(path.dirname(mappingOutPath), { recursive: true });
  await fs.mkdir(path.dirname(artifactOutPath), { recursive: true });

  await fs.writeFile(routerOutPath, `${JSON.stringify(compiled.routerRules, null, 2)}\n`, 'utf-8');
  await fs.writeFile(mappingOutPath, `${JSON.stringify(compiled.dataMappings, null, 2)}\n`, 'utf-8');
  await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');

  console.log(`[DSL-COMPILER] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[DSL-COMPILER] Router rules: ${path.relative(process.cwd(), routerOutPath)}`);
  console.log(`[DSL-COMPILER] Data mappings: ${path.relative(process.cwd(), mappingOutPath)}`);
  console.log(`[DSL-COMPILER] Full artifact: ${path.relative(process.cwd(), artifactOutPath)}`);
  console.log(`[DSL-COMPILER] Routers compiled: ${compiled.routerRules.length}`);
  console.log(`[DSL-COMPILER] Mappers compiled: ${compiled.dataMappings.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[DSL-COMPILER] Failed:', err.message);
    process.exitCode = 1;
  });
}
