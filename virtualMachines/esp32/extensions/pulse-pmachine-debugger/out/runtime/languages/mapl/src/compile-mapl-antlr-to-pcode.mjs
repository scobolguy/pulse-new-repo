import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import antlr4 from 'antlr4';
import MAPLLexer from '../grammar/generated/MAPLLexer.js';
import MAPLParser from '../grammar/generated/MAPLParser.js';
import MAPLVisitor from '../grammar/generated/MAPLVisitor.js';
import { compileConversionRuleToOps } from '../../../virtualMachines/esp32/aggregator/scripts/compile-mapping-rule.mjs';
import { dslDebug, dslError } from '../../../virtualMachines/esp32/aggregator/scripts/dsl-debug.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';

const SUPPORTED_MAP_FUNCTIONS = new Set([
  'trim',
  'upper',
  'yymmddtoiso',
  'mtamounttodecimal',
  'mtpartyname',
  'mtchargebearertoiso'
]);

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

const QUOTED_PATH = /^[A-Za-z_]\w*(\.([A-Za-z_]\w*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))*$/;

// Function arguments that are bare field paths are unquoted so they match designer paths.
function pathText(node) {
  const raw = text(node);
  if (!QUOTED_PATH.test(raw)) return raw;
  return (raw.match(/[A-Za-z_]\w*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || []).map(unquoteMaplString).join('.');
}

function quote(value) {
  return `"${String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export const MAPL_KEYWORDS = new Set([
  'map', 'from', 'to', 'end', 'default', 'using', 'if', 'then', 'else', 'for', 'each', 'as',
  'validate', 'or', 'and', 'mod', 'not', 'true', 'false'
]);

export function unquoteMaplString(raw) {
  const value = String(raw || '');
  if (value.length < 2 || !(value[0] === '"' || value[0] === '\'')) return value;
  return value.slice(1, -1).replace(/\\(.)/g, '$1');
}

export function quoteMaplString(value) {
  return `'${String(value ?? '').replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`;
}

function isPlainMaplIdent(segment) {
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(segment) && !MAPL_KEYWORDS.has(segment);
}

export function formatMaplName(name) {
  const value = String(name ?? '');
  return isPlainMaplIdent(value) ? value : quoteMaplString(value);
}

/** Render a dotted field path as MAPL; segments that are not plain identifiers are quoted. */
export function formatMaplPath(fieldPath) {
  const segments = String(fieldPath ?? '').split('.').filter(segment => segment.length > 0);
  if (segments.length === 0) throw new Error('[MAPL] Empty field path');
  if (!isPlainMaplIdent(segments[0])) throw new Error(`[MAPL] Field path must start with an identifier: ${fieldPath}`);
  return segments.map((segment, index) => (index === 0 || isPlainMaplIdent(segment) ? segment : quoteMaplString(segment))).join('.');
}

function directiveValue(ctx) {
  if (ctx.STRING()) return unquoteMaplString(ctx.STRING().getText());
  if (ctx.NUMBER()) return Number(ctx.NUMBER().getText());
  return ctx.getText() === 'true';
}

class MaplAstBuilder extends MAPLVisitor {
  visitMapUnit(ctx) {
    return {
      type: 'MapUnit',
      maps: (ctx.mapDecl() || []).map(item => this.visit(item))
    };
  }

  visitMapDecl(ctx) {
    const names = ctx.nameRef().map(item => unquoteMaplString(item.getText()));
    const directives = {};
    for (const directive of ctx.mapDirective() || []) {
      directives[directive.IDENT().getText()] = directiveValue(directive.directiveValue());
    }
    return {
      type: 'MapDecl',
      id: names[0],
      sourceTypeId: names[1],
      targetTypeId: names[2],
      directives,
      statements: this.visit(ctx.mapBody())
    };
  }

  visitFieldPath(ctx) {
    return [ctx.IDENT().getText(), ...(ctx.pathSegment() || []).map(segment => unquoteMaplString(segment.getText()))].join('.');
  }

  visitMapBody(ctx) {
    return (ctx.mapStmt() || []).map(item => this.visit(item)).filter(Boolean);
  }

  visitMapStmt(ctx) {
    if (ctx.assignDefaultStmt()) return this.visit(ctx.assignDefaultStmt());
    if (ctx.functionAssignStmt()) return this.visit(ctx.functionAssignStmt());
    if (ctx.assignStmt()) return this.visit(ctx.assignStmt());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.forStmt()) return this.visit(ctx.forStmt());
    if (ctx.validateStmt()) return this.visit(ctx.validateStmt());
    return null;
  }

  visitAssignStmt(ctx) {
    const statement = {
      type: 'Assign',
      targetPath: this.visit(ctx.fieldPath(0)),
      sourcePath: this.visit(ctx.fieldPath(1))
    };
    if (ctx.STRING()) statement.conversionRule = unquoteMaplString(ctx.STRING().getText());
    return statement;
  }

  visitAssignDefaultStmt(ctx) {
    return {
      type: 'AssignDefault',
      targetPath: this.visit(ctx.fieldPath(0)),
      sourcePath: this.visit(ctx.fieldPath(1)),
      defaultExpression: text(ctx.expr())
    };
  }

  visitFunctionAssignStmt(ctx) {
    const call = this.visit(ctx.functionCall());
    return {
      type: 'FunctionAssign',
      targetPath: this.visit(ctx.fieldPath()),
      function: call
    };
  }

  visitFunctionCall(ctx) {
    return {
      type: 'FunctionCall',
      name: ctx.IDENT().getText(),
      arguments: ctx.exprList() ? (ctx.exprList().expr() || []).map(expr => pathText(expr)) : []
    };
  }

  visitIfStmt(ctx) {
    const bodies = ctx.mapBody();
    return {
      type: 'If',
      condition: text(ctx.expr()),
      thenStatements: bodies[0] ? this.visit(bodies[0]) : [],
      elseStatements: bodies[1] ? this.visit(bodies[1]) : []
    };
  }

  visitForStmt(ctx) {
    return {
      type: 'ForEach',
      sourcePath: this.visit(ctx.fieldPath()),
      variable: ctx.IDENT().getText(),
      statements: this.visit(ctx.mapBody())
    };
  }

  visitValidateStmt(ctx) {
    return {
      type: 'Validate',
      expression: text(ctx.expr())
    };
  }
}

function lowerStaticItems(map) {
  const items = [];
  const irOnly = [];

  const addItem = (sourcePath, targetPath, conversionRule) => {
    items.push({
      sourcePath,
      targetPath,
      conversionRule,
      ops: compileConversionRuleToOps(conversionRule)
    });
  };

  for (const statement of map.statements) {
    if (statement.type === 'Assign') {
      const conversionRule = statement.conversionRule || 'OUTPUT := SRC;';
      if (!isSupportedConversionRule(conversionRule)) {
        irOnly.push({ type: statement.type, reason: 'Conversion is not supported by the native MAPL runtime.' });
        continue;
      }
      addItem(statement.sourcePath, statement.targetPath, conversionRule);
      continue;
    }

    if (statement.type === 'AssignDefault') {
      addItem(statement.sourcePath, statement.targetPath, 'OUTPUT := SRC;');
      irOnly.push({ type: statement.type, reason: 'Current OP_MAP runtime does not apply default expressions.' });
      continue;
    }

    if (statement.type === 'FunctionAssign'
        && statement.function.arguments.length === 1
        && SUPPORTED_MAP_FUNCTIONS.has(String(statement.function.name || '').toLowerCase())) {
      const conversionRule = `OUTPUT := ${statement.function.name}(SRC);`;
      addItem(statement.function.arguments[0], statement.targetPath, conversionRule);
      continue;
    }

    irOnly.push({ type: statement.type, reason: 'Construct is preserved in MAPL IR but is not executable by the current OP_MAP runtime.' });
  }

  return { items, irOnly };
}

function isSupportedConversionRule(ruleText) {
  let expression = String(ruleText || '').trim()
    .replace(/^output\s*(:=|=)\s*/i, '')
    .replace(/;+\s*$/, '')
    .trim();
  if (expression.toUpperCase() === 'SRC') return true;
  if ((expression.startsWith('"') && expression.endsWith('"'))
      || (expression.startsWith("'") && expression.endsWith("'"))) return true;

  const call = expression.match(/^([a-z_][a-z0-9_]*)\((.*)\)$/i);
  if (!call || !SUPPORTED_MAP_FUNCTIONS.has(call[1].toLowerCase())) return false;
  return isSupportedConversionRule(call[2]);
}

export function compileMaplWithAntlr(sourceText) {
  const text = String(sourceText || '');
  dslDebug('mapl', 'compile:start', { chars: text.length });
  try {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new MAPLLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new MAPLParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.mapUnit();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[MAPL] Parse failed:\n${errors.join('\n')}`);
  }

  const ast = new MaplAstBuilder().visit(tree);
  if (ast.maps.length === 0) {
    throw new Error('[MAPL] No map declarations found');
  }

  const entries = [];
  const compatibility = [];
  for (const map of ast.maps) {
    const lowered = lowerStaticItems(map);
    entries.push({
      kind: 'mapper',
      id: map.id,
      sourceTypeId: map.sourceTypeId,
      targetTypeId: map.targetTypeId,
      metadata: map.directives,
      items: lowered.items,
      maplIr: map.statements
    });
    compatibility.push({
      mapId: map.id,
      executableItems: lowered.items.length,
      irOnly: lowered.irOnly
    });
  }

  const firstMap = ast.maps[0];
  const pcodeText = [
    '# Auto-generated from ANTLR MAPL grammar',
    `OP_MAP SRC, ${quote(firstMap.id)}, mappedPayload`,
    'MAP_RETURN mappedPayload',
    'HALT',
    ''
  ].join('\n');

  const result = {
    pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      serviceId: `mapl-${firstMap.id}`,
      runtimeUnit: { kind: 'program', id: `mapl-${firstMap.id}`, refreshMs: null },
      executionModel: 'mapl-op-map-return',
      sourceLanguage: 'mapl',
      globals: ['mappedPayload'],
      entryMapId: firstMap.id,
      entries,
      compatibility
    },
    ast
  };
  dslDebug('mapl', 'compile:complete', { maps: result.ast.maps.length });
  return result;
  } catch (error) {
    throw dslError('mapl', 'compile', error, { chars: text.length });
  }
}

function parseArgs(argv) {
  const args = {
    in: '../src/sample.mapl',
    out: '../object/pcode/mapl.pcode',
    mapOut: '../object/pcode/mapl.program.json'
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--in') args.in = argv[index + 1];
    if (argv[index] === '--out') args.out = argv[index + 1];
    if (argv[index] === '--map-out') args.mapOut = argv[index + 1];
  }
  return args;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);
  const source = await fs.readFile(inputPath, 'utf-8');
  const compiled = compileMaplWithAntlr(source);
  const signedProgramMap = attachPcodeSignature(compiled.programMap, compiled.pcodeText);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });
  await fs.writeFile(outPath, compiled.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(signedProgramMap, null, 2)}\n`, 'utf-8');

  console.log(`[MAPL] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[MAPL] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[MAPL] Output (program map): ${path.relative(process.cwd(), mapOutPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[MAPL] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}