import { compileRouterMapperDSL } from './compile-pascal.mjs';
import { compileCobolishWithAntlr } from './cobolish-antlr-compiler.mjs';
import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';
import { emitMapperRoutinePcode } from './compile-mapping-rule.mjs';
import { dslDebug, dslError } from './dsl-debug.mjs';

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

function buildPascalishRuntimeSource(runtime, interop, integration = {}) {
  const declarations = interop.map((item) =>
    `interop ${item.kind.toLowerCase()} "${item.target}";`
  );
  const roleLine = integration.role ? `role ${String(integration.role).toLowerCase()};` : null;
  const libraryLines = (integration.libraries || []).map((item) => {
    const source = item.source && String(item.source).toLowerCase() === 'librarian' ? 'librarian' : String(item.source || 'librarian');
    return `library "${item.id}" from ${source};`;
  });
  const useLines = (integration.uses || []).map((item) => {
    const aliasPart = item.alias ? ` as ${item.alias}` : '';
    return `use "${item.id}"${aliasPart};`;
  });
  const mapperLines = (integration.mapperImports || []).map((item) => `import mapper "${item.id}" from mapper;`);
  const routeLines = (integration.routes || []).map((item) => {
    return `route cbds_mapper from "${item.fromQueue}" to "${item.toQueue}";`;
  });
  const mapperDeclLines = (integration.mappers || []).map((mapper) => {
    const mapLines = (mapper.items || []).map((item) =>
      `  map "${item.sourcePath}" to "${item.targetPath}" using "${String(item.conversionRule || 'output := src;').replace(/"/g, "'")}";`
    );
    return [
      `mapper "${mapper.id}" source "${mapper.sourceTypeId}" target "${mapper.targetTypeId}" begin`,
      ...mapLines,
      'end;'
    ].join('\n');
  });
  const assignmentLines = (integration.assignments || []).map((assignment) =>
    `  ${String(assignment.target || '').toLowerCase()} := ${assignment.value || "''"};`
  );
  const placementPart = runtime.placement ? ` on ${runtime.placement}` : '';
  const refreshPart = runtime.refresh ? runtime.refresh : '';
  const header = `${runtime.kind} "${runtime.id}"${placementPart}${refreshPart};`;
  return [
    header,
    roleLine,
    ...libraryLines,
    ...useLines,
    ...mapperLines,
    ...mapperDeclLines,
    ...declarations,
    'begin',
    ...assignmentLines,
    ...routeLines,
    'end.'
  ].filter(Boolean).join('\n');
}

function buildCommonArtifact(language, sourceText, runtime, interop, native) {
  const integration = {
    role: native?.role || null,
    libraries: native?.libraries || [],
    uses: native?.uses || [],
    mapperImports: native?.mapperImports || [],
    routes: native?.routes || [],
    mappers: native?.mappers || [],
    assignments: native?.assignments || []
  };
  const portableSource = native?.pascalishSource || buildPascalishRuntimeSource(runtime, interop, integration);
  const portable = compileRouterMapperDSL(portableSource);
  const displayPcode = language === 'cobolish'
    ? (native.displayStatements || []).flatMap((value) => [
        `PUSH_STR ${JSON.stringify(value)}`,
        'PRINT',
        'PRINT_NL'
      ]).concat((native.displayVariables || []).flatMap((value) => [
        `LOAD_NAME ${value}`,
        'PRINT',
        'PRINT_NL'
      ]))
    : [];
  const receivePcode = language === 'cobolish'
    ? (native.receiveVariables || []).map((value, index) => [`LOAD_NAME ${index === 0 ? 'src' : '__reply'}`, `STORE_NAME ${value}`])
    : [];
  const assignmentPcode = language === 'cobolish'
    ? (native.assignments || []).flatMap(({ value, target }) => {
        const raw = String(value || '').trim();
        const operand = /^[-+]?\d+(?:\.\d+)?$/.test(raw)
          ? `PUSH_INT ${raw}`
          : /^"(?:[^"\\]|\\.)*"$/.test(raw)
            ? `PUSH_STR ${raw}`
            : /^'(?:[^'\\]|\\.)*'$/.test(raw)
              ? `PUSH_STR ${JSON.stringify(raw.slice(1, -1))}`
              : `LOAD_NAME ${raw}`;
        return [operand, `STORE_NAME ${String(target || '').trim()}`];
      })
    : [];
  if (displayPcode.length > 0 || receivePcode.length > 0 || assignmentPcode.length > 0) {
    const lines = String(portable.pcodeText || '').trimEnd().split('\n');
    const entryIndex = lines.findIndex((line) => line.trim() === 'ENTRY:' || line.trim() === 'MAIN:');
    const firstReceive = receivePcode[0] || [];
    const entryPcode = [...assignmentPcode, ...firstReceive];
    if (entryIndex >= 0 && entryPcode.length > 0) lines.splice(entryIndex + 1, 0, ...entryPcode);
    const laterReceives = receivePcode.slice(1).flat();
    if (laterReceives.length > 0) {
      const haltIndex = lines.findIndex((line) => line.trim() === 'HALT');
      lines.splice(haltIndex >= 0 ? haltIndex : lines.length, 0, ...laterReceives);
    }
    if (displayPcode.length > 0) {
      const haltIndex = lines.findIndex((line) => line.trim() === 'HALT');
      lines.splice(haltIndex >= 0 ? haltIndex : lines.length, 0, ...displayPcode);
    }
    portable.pcodeText = `${lines.join('\n')}\n`;
  }
  portable.programMap.globals = [...new Set([...(portable.programMap.globals || []), ...(native.assignments || []).map(item => String(item.target || '').trim()), ...(native.displayVariables || [])])];
  const mapperRoutines = (portable.programMap?.entries || [])
    .filter((entry) => entry?.kind === 'mapper')
    .map((entry) => emitMapperRoutinePcode(entry));
  if (mapperRoutines.length > 0) {
    portable.pcodeText = `${String(portable.pcodeText || '').trimEnd()}\n${mapperRoutines.join('\n')}\n`;
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
  dslDebug('cobolish', 'compile:start', { fileName: options.fileName || null, chars: String(sourceText || '').length });
  let native;
  try { native = compileCobolishWithAntlr(sourceText, options); } catch (error) { throw dslError('cobolish', 'antlr', error); }
  if (!native.valid) {
    throw dslError('cobolish', 'parse', new Error(native.syntaxErrors.join('\n')));
  }
  const runtime = parseRuntimeDirective(sourceText, normalizeId(native.programId, 'cobolish-program'));
  const interop = native.interop.length > 0 ? native.interop : extractInterop(sourceText);
  const result = buildCommonArtifact('cobolish', sourceText, runtime, interop, native);
  dslDebug('cobolish', 'compile:complete', { runtimeId: result.runtimeUnit?.id });
  return result;
}

export function compileVbishToPmachine(sourceText, options = {}) {
  dslDebug('vbish', 'compile:start', { fileName: options.fileName || null, chars: String(sourceText || '').length });
  let native;
  try { native = compileVbishWithAntlr(sourceText, options); } catch (error) { throw dslError('vbish', 'antlr', error); }
  if (!native.valid) throw dslError('vbish', 'parse', new Error(native.syntaxErrors.join('\n')));
  const runtime = native.runtime || parseRuntimeDirective(sourceText, normalizeId(options.fileName?.replace(/\.[^.]+$/, ''), 'vbish-program'));
  const refresh = runtime.kind === 'daemon' && runtime.interval > 0 ? ` refresh ${runtime.interval} ${runtime.unit}` : '';
  const result = buildCommonArtifact('vbish', sourceText, { ...runtime, refresh }, native.interop, native);
  dslDebug('vbish', 'compile:complete', { runtimeId: result.runtimeUnit?.id });
  return result;
}