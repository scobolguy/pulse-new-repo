import { parsePascalish } from './parser/index.mjs';
import { analyzePascalish } from './semantics/index.mjs';
import { lowerToIr } from './ir/index.mjs';
import { emitPcode } from './pcodegen/index.mjs';

function formatError(error) {
  return `line ${error.line}:${error.column} ${error.message}`;
}

export function compilePascalishToPcode(sourceText) {
  const parsed = parsePascalish(sourceText);
  if (parsed.errors.length > 0) {
    const message = parsed.errors.map(formatError).join('\n');
    throw new Error(`[pascalishc] Parse failed:\n${message}`);
  }

  const analysis = analyzePascalish(parsed.ast);
  if (analysis.errors.length > 0) {
    const message = analysis.errors.map(formatError).join('\n');
    throw new Error(`[pascalishc] Semantic analysis failed:\n${message}`);
  }

  const ir = lowerToIr(parsed.ast, analysis.symbols);
  const emitted = emitPcode(ir);

  return {
    tokens: parsed.tokens,
    ast: parsed.ast,
    ir,
    warnings: analysis.warnings,
    ...emitted
  };
}
