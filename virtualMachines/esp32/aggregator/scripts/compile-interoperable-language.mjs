import { compileRouterMapperDSL } from './compile-pascal.mjs';
import { compileCobolishWithAntlr } from './cobolish-antlr-compiler.mjs';
import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';

const RUNTIME_DIRECTIVE = /^\s*(?:PULSE\s+)?(SERVICE|DAEMON|PROGRAM)\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_-]*))(?:\s+ON\s+(LOCAL|PARENT|CHILD|SIBLING|ALTERNATE))?(?:\s+(?:REFRESH|EVERY)\s+(\d+)\s*(MS|S|M|SECOND|SECONDS)?)?\s*\.?$/im;
const INTEROP_DIRECTIVE = /\bINTEROP\s+(WFL|WORKFLOW|PASCALISH|COBOLISH|VBISH)\s+"([^"]+)"(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_-]*))?/gi;

function normalizeId(value, fallback) {
  const cleaned = String(value || '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseRuntimeDirective(sourceText, fallbackId) {
  const match = RUNTIME_DIRECTIVE.exec(String(sourceText || ''));
  const kind = String(match?.[1] || 'PROGRAM').toLowerCase();
  const id = normalizeId(match?.[2] || match?.[3], fallbackId);
  const placement = String(match?.[4] || 'LOCAL').toLowerCase();
  const interval = Number.parseInt(match?.[5] || '0', 10);
  const unit = String(match?.[6] || 'MS').toLowerCase();
  const refresh = kind === 'daemon' && interval > 0
    ? ` refresh ${interval} ${unit === 'second' || unit === 'seconds' ? 's' : unit}`
    : '';
  return { kind, id, placement, refresh };
}

function extractInterop(sourceText) {
  return Array.from(String(sourceText || '').matchAll(INTEROP_DIRECTIVE), (match) => ({
    kind: String(match[1]).toUpperCase(),
    target: String(match[2]),
    alias: String(match[3] || '').trim() || null
  }));
}

function buildPascalishRuntimeSource(runtime, interop) {
  const declarations = interop.map((item) =>
    `interop ${item.kind.toLowerCase()} "${item.target}";`
  );
  const placementPart = runtime.placement ? ` on ${runtime.placement}` : '';
  const refreshPart = runtime.refresh ? runtime.refresh : '';
  const header = `${runtime.kind} "${runtime.id}"${placementPart}${refreshPart};`;
  return [
    header,
    ...declarations,
    'begin',
    'end.'
  ].join('\n');
}

function buildCommonArtifact(language, sourceText, runtime, interop, native) {
  const portableSource = native?.pascalishSource || buildPascalishRuntimeSource(runtime, interop);
  const portable = compileRouterMapperDSL(portableSource);
  const displayPcode = language === 'cobolish'
    ? (native.displayStatements || []).flatMap((value) => [
        `PUSH_STR ${JSON.stringify(value)}`,
        'PRINT',
        'PRINT_NL'
      ])
    : [];
  if (displayPcode.length > 0) {
    const lines = String(portable.pcodeText || '').trimEnd().split('\n');
    const haltIndex = lines.findIndex((line) => line.trim() === 'HALT');
    lines.splice(haltIndex >= 0 ? haltIndex : lines.length, 0, ...displayPcode);
    portable.pcodeText = `${lines.join('\n')}\n`;
  }
  return {
    ...portable,
    language,
    sourceLanguage: language,
    compilerPipeline: `${language}-to-pmachine`,
    runtimeUnit: portable.runtimeUnit || { kind: runtime.kind, id: runtime.id, refreshMs: null },
    interoperability: interop,
    native,
    executableStatements: { display: native.displayStatements || [] },
    source: String(sourceText || ''),
    portableSource
  };
}

export function compileCobolishToPmachine(sourceText, options = {}) {
  const native = compileCobolishWithAntlr(sourceText, options);
  if (!native.valid) {
    throw new Error(`[COBOLISH] Parse failed:\n${native.syntaxErrors.join('\n')}`);
  }
  const runtime = parseRuntimeDirective(sourceText, normalizeId(native.programId, 'cobolish-program'));
  const interop = native.interop.length > 0 ? native.interop : extractInterop(sourceText);
  return buildCommonArtifact('cobolish', sourceText, runtime, interop, native);
}

export function compileVbishToPmachine(sourceText, options = {}) {
  const native = compileVbishWithAntlr(sourceText, options);
  if (!native.valid) throw new Error(`[VBISH] Parse failed:\n${native.syntaxErrors.join('\n')}`);
  const runtime = native.runtime || parseRuntimeDirective(sourceText, normalizeId(options.fileName?.replace(/\.[^.]+$/, ''), 'vbish-program'));
  const refresh = runtime.kind === 'daemon' && runtime.interval > 0 ? ` refresh ${runtime.interval} ${runtime.unit}` : '';
  return buildCommonArtifact('vbish', sourceText, { ...runtime, refresh }, native.interop, native);
}