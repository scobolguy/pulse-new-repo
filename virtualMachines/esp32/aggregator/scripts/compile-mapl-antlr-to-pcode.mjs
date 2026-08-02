import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import antlr4 from 'antlr4';
import MAPLLexer from '../grammar/generated-modern/MAPLLexer.js';
import MAPLParser from '../grammar/generated-modern/MAPLParser.js';
import MAPLVisitor from '../grammar/generated-modern/MAPLVisitor.js';
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

function quote(value) {
  return `"${String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

class MaplAstBuilder extends MAPLVisitor {
  visitMapUnit(ctx) {
    return {
      type: 'MapUnit',
      maps: (ctx.mapDecl() || []).map(item => this.visit(item))
    };
  }

  visitMapDecl(ctx) {
    const identifiers = ctx.IDENT();
    return {
      type: 'MapDecl',
      id: identifiers[0].getText(),
      sourceTypeId: identifiers[1].getText(),
      targetTypeId: identifiers[2].getText(),
      statements: this.visit(ctx.mapBody())
    };
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
    return {
      type: 'Assign',
      targetPath: text(ctx.fieldPath(0)),
      sourcePath: text(ctx.fieldPath(1))
    };
  }

  visitAssignDefaultStmt(ctx) {
    return {
      type: 'AssignDefault',
      targetPath: text(ctx.fieldPath(0)),
      sourcePath: text(ctx.fieldPath(1)),
      defaultExpression: text(ctx.expr())
    };
  }

  visitFunctionAssignStmt(ctx) {
    const call = this.visit(ctx.functionCall());
    return {
      type: 'FunctionAssign',
      targetPath: text(ctx.fieldPath()),
      function: call
    };
  }

  visitFunctionCall(ctx) {
    return {
      type: 'FunctionCall',
      name: ctx.IDENT().getText(),
      arguments: ctx.exprList() ? (ctx.exprList().expr() || []).map(expr => text(expr)) : []
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
      sourcePath: text(ctx.fieldPath()),
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

  for (const statement of map.statements) {
    if (statement.type === 'Assign') {
      items.push({
        sourcePath: statement.sourcePath,
        targetPath: statement.targetPath,
        conversionRule: 'OUTPUT := SRC;'
      });
      continue;
    }

    if (statement.type === 'AssignDefault') {
      items.push({
        sourcePath: statement.sourcePath,
        targetPath: statement.targetPath,
        conversionRule: 'OUTPUT := SRC;',
        defaultExpression: statement.defaultExpression
      });
      irOnly.push({ type: statement.type, reason: 'Current OP_MAP runtime does not apply default expressions.' });
      continue;
    }

    if (statement.type === 'FunctionAssign' && statement.function.arguments.length === 1) {
      items.push({
        sourcePath: statement.function.arguments[0],
        targetPath: statement.targetPath,
        conversionRule: `OUTPUT := ${statement.function.name}(SRC);`
      });
      continue;
    }

    irOnly.push({ type: statement.type, reason: 'Construct is preserved in MAPL IR but is not executable by the current OP_MAP runtime.' });
  }

  return { items, irOnly };
}

export function compileMaplWithAntlr(sourceText) {
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
    'HALT',
    ''
  ].join('\n');

  return {
    pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      serviceId: `mapl-${firstMap.id}`,
      runtimeUnit: { kind: 'program', id: `mapl-${firstMap.id}`, refreshMs: null },
      executionModel: 'mapl-op-map',
      sourceLanguage: 'mapl',
      globals: ['mappedPayload'],
      entryMapId: firstMap.id,
      entries,
      compatibility
    },
    ast
  };
}

function parseArgs(argv) {
  const args = {
    in: './data/sample.mapl',
    out: '../pcode/mapl.pcode',
    mapOut: '../pcode/mapl.program.json'
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--in') args.in = argv[index + 1];
    if (argv[index] === '--out') args.out = argv[index + 1];
    if (argv[index] === '--map-out') args.mapOut = argv[index + 1];
  }
  return args;
}

async function main() {
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