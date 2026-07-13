import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compileRouterMapperDSL as compileRouterMapperDSLAntlr } from './compile-pascal.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

function parseArgs(argv) {
  const args = {
    in: './data/router-mapper.dsl',
    out: '../pcode/router-mapper.pcode',
    mapOut: '../pcode/router-mapper.program.json',
    manifest: '../pcode/pcode-opcodes.manifest.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--out') args.out = argv[i + 1];
    if (token === '--map-out') args.mapOut = argv[i + 1];
    if (token === '--manifest') args.manifest = argv[i + 1];
  }

  return args;
}

async function loadManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

function assertRequiredOpcodes(manifest) {
  const names = new Set((manifest.opcodes || []).map(op => op.name));
  const required = [
    'OP_JMP',
    'OP_JZ',
    'OP_HALT',
    'OP_ROUTE_MATCH_QUEUE',
    'OP_ROUTE_EVAL_WHEN',
    'OP_ROUTE_TRANSFORM',
    'OP_ROUTE_EMIT',
    'OP_PARSE_FIN_TEXT'
  ];
  const missing = required.filter(name => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`Manifest missing required opcodes: ${missing.join(', ')}`);
  }
}

function sanitizeLabel(text) {
  return String(text || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function normalizeDslRuleText(text) {
  return String(text || '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function encodePcodeStringLiteral(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function emitPortableProgram(compiled) {
  const lines = [];
  const entries = [];
  const orchestrationPrograms = [];

  lines.push('# Auto-generated portable pcode from Pascalish router/mapping DSL');
  lines.push('# Executable routing opcodes for ESP32/JS PMachine parity');
  lines.push('ENTRY:');

  const routerRules = compiled.routerRules || [];
  const mappings = compiled.dataMappings || [];
  const blockStatements = Array.isArray(compiled?.ast?.statements) ? compiled.ast.statements : [];

  for (const stmt of blockStatements) {
    const orch = stmt?.orchestration;
    if (!orch || typeof orch !== 'object') continue;
    if (!Array.isArray(orch.asyncSubflows) || orch.asyncSubflows.length === 0) continue;

    orchestrationPrograms.push({
      programId: String(compiled?.runtimeUnit?.id || compiled?.serviceId || 'program').trim(),
      asyncSubflows: orch.asyncSubflows.map(item => ({
        subflowId: String(item?.subflowId || '').trim(),
        nodeId: String(item?.nodeId || '').trim(),
        payloadRef: String(item?.payloadRef || '').trim(),
        timeoutMs: Number(item?.timeoutMs || 0) || 0,
        handleRef: String(item?.handleRef || '').trim()
      })),
      waitAll: orch.waitAll || null,
      failTransactions: Array.isArray(orch.failTransactions) ? orch.failTransactions : [],
      returnSuccess: orch.returnSuccess || null
    });
  }

  // Build lookup: mapperId (and -mini alias) → sourceTypeId
  const mapperSourceType = new Map();
  for (const m of mappings) {
    const id = String(m.id || '').trim();
    mapperSourceType.set(id, String(m.sourceTypeId || '').trim());
    if (id.endsWith('-mini')) {
      mapperSourceType.set(id.slice(0, -5), String(m.sourceTypeId || '').trim());
    }
  }

  // Extract all quoted mapping IDs referenced in transform rules via MAP("id", ...)
  function referencedMapperIds(transformRule) {
    const ids = [];
    const re = /MAP\s*\(\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(transformRule)) !== null) {
      ids.push(m[1]);
    }
    return ids;
  }

  // Return true if any output of this router ultimately reads from a FIN-text mapper
  function routerNeedsFinParse(r) {
    for (const o of (r.outputs || [])) {
      for (const id of referencedMapperIds(String(o.transformRule || ''))) {
        if (mapperSourceType.get(id) === 'swift-mt103') return true;
      }
    }
    return false;
  }

  if (routerRules.length > 0) {
    lines.push(`JMP ROUTER_0_${sanitizeLabel(routerRules[0].id)}`);
  } else if (orchestrationPrograms.length > 0) {
    lines.push('JMP ORCH_ENTRY');
  } else {
    lines.push('JMP FINISH');
  }

  for (let i = 0; i < routerRules.length; i += 1) {
    const r = routerRules[i];
    const label = `ROUTER_${i}_${sanitizeLabel(r.id)}`;
    const next = routerRules[i + 1];

    lines.push(`${label}:`);
    lines.push(`ROUTE_MATCH_QUEUE "${String(r.inputQueue || '').replace(/"/g, '\\"')}"`);
    lines.push(`JZ ${next ? `ROUTER_${i + 1}_${sanitizeLabel(next.id)}` : (orchestrationPrograms.length > 0 ? 'ORCH_ENTRY' : 'FINISH')}`);
    if (routerNeedsFinParse(r)) {
      lines.push('PARSE_FIN_TEXT');
    }

    const outputs = r.outputs || [];
    for (let j = 0; j < outputs.length; j += 1) {
      const o = outputs[j];
      const skipLabel = `${label}_OUTPUT_SKIP_${j}`;
      const whenRule = normalizeDslRuleText(o.whenRule);
      const transformRule = normalizeDslRuleText(o.transformRule);
      const whenText = encodePcodeStringLiteral(whenRule);
      const transformText = encodePcodeStringLiteral(transformRule);
      const queueText = encodePcodeStringLiteral(o.queueName);

      lines.push(`ROUTE_EVAL_WHEN "${whenText}"`);
      lines.push(`JZ ${skipLabel}`);
      lines.push(`ROUTE_TRANSFORM "${transformText}"`);
      lines.push(`ROUTE_EMIT "${queueText}"`);
      lines.push(`${skipLabel}:`);
      lines.push('NOP');
    }

    if (next) {
      lines.push(`JMP ROUTER_${i + 1}_${sanitizeLabel(next.id)}`);
    } else if (orchestrationPrograms.length > 0) {
      lines.push('JMP ORCH_ENTRY');
    } else {
      lines.push('JMP FINISH');
    }

    entries.push({
      kind: 'router',
      id: r.id,
      label,
      inputQueue: r.inputQueue,
      outputs: (r.outputs || []).map(o => ({
        queueName: o.queueName,
        dataTypeIds: o.dataTypeIds || [],
        dataTypeId: o.dataTypeId || null,
        whenRule: normalizeDslRuleText(o.whenRule),
        transformRule: normalizeDslRuleText(o.transformRule)
      }))
    });
  }

  lines.push('MAPPERS_ENTRY:');
  lines.push(`JMP ${orchestrationPrograms.length > 0 ? 'ORCH_ENTRY' : 'FINISH'}`);

  for (let i = 0; i < mappings.length; i += 1) {
    const m = mappings[i];
    const label = `MAPPER_${i}_${sanitizeLabel(m.id)}`;
    const next = mappings[i + 1];

    lines.push(`${label}:`);
    lines.push('NOP');
    if (next) {
      lines.push(`JMP MAPPER_${i + 1}_${sanitizeLabel(next.id)}`);
    } else {
      lines.push('JMP FINISH');
    }

    entries.push({
      kind: 'mapper',
      id: m.id,
      label,
      sourceTypeId: m.sourceTypeId,
      targetTypeId: m.targetTypeId,
      itemCount: (m.items || []).length,
      items: (m.items || []).map(item => ({
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        conversionRule: item.conversionRule
      }))
    });
  }

  if (orchestrationPrograms.length > 0) {
    lines.push('ORCH_ENTRY:');
    for (let i = 0; i < orchestrationPrograms.length; i += 1) {
      const orch = orchestrationPrograms[i];
      const orchLabel = `ORCH_${i}_${sanitizeLabel(orch.programId)}`;
      lines.push(`${orchLabel}:`);

      for (const sf of orch.asyncSubflows) {
        const payload = {
          subflowId: sf.subflowId,
          nodeId: sf.nodeId,
          payloadRef: sf.payloadRef,
          timeoutMs: sf.timeoutMs,
          handleRef: sf.handleRef
        };
        lines.push(`ORCH_SPAWN "${JSON.stringify(payload).replace(/"/g, '\\"')}"`);
      }

      const waitPayload = {
        handleRefs: Array.isArray(orch?.waitAll?.handleRefs) ? orch.waitAll.handleRefs : [],
        timeoutMs: Number(orch?.waitAll?.timeoutMs || 0) || 0,
        reason: String(orch?.waitAll?.onErrorFailTransaction || '').trim()
      };
      lines.push(`ORCH_WAIT_ALL "${JSON.stringify(waitPayload).replace(/"/g, '\\"')}"`);

      const failReason = String((orch.failTransactions[0]?.reason) || waitPayload.reason || 'orchestration failed').trim();
      lines.push(`ORCH_FAIL_TXN "${failReason.replace(/"/g, '\\"')}"`);

      const returnExpr = String(orch?.returnSuccess?.valueExpr || '').trim();
      lines.push(`ORCH_RETURN_SUCCESS "${returnExpr.replace(/"/g, '\\"')}"`);
      lines.push('JMP FINISH');

      entries.push({
        kind: 'orchestration',
        id: orch.programId,
        label: orchLabel,
        asyncSubflowCount: orch.asyncSubflows.length,
        waitAll: orch.waitAll || null,
        returnSuccess: orch.returnSuccess || null
      });
    }
  }

  lines.push('FINISH:');
  lines.push('HALT');

  return {
    pcodeText: `${lines.join('\n')}\n`,
    symbolMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      serviceId: compiled.serviceId,
      runtimeUnit: compiled.runtimeUnit || {
        kind: 'service',
        id: compiled.serviceId || 'default-router-service',
        refreshMs: null
      },
      variableDeclarations: Array.isArray(compiled.variableDeclarations) ? compiled.variableDeclarations : [],
      entryLabel: 'ENTRY',
      finishLabel: 'FINISH',
      instructionSubset: ['JMP', 'JZ', 'NOP', 'ROUTE_MATCH_QUEUE', 'ROUTE_EVAL_WHEN', 'ROUTE_TRANSFORM', 'ROUTE_EMIT', 'PARSE_FIN_TEXT', 'HALT'],
      orchestrationPrograms,
      instructionSubsetExtended: ['ORCH_SPAWN', 'ORCH_WAIT_ALL', 'ORCH_FAIL_TXN', 'ORCH_RETURN_SUCCESS'],
      entries
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);
  const manifestPath = path.resolve(args.manifest);

  const manifest = await loadManifest(manifestPath);
  assertRequiredOpcodes(manifest);

  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compileRouterMapperDSLAntlr(sourceText);
  const emitted = (compiled && compiled.pcodeText && compiled.programMap)
    ? { pcodeText: compiled.pcodeText, symbolMap: compiled.programMap }
    : emitPortableProgram(compiled);
  const signedSymbolMap = attachPcodeSignature(emitted.symbolMap, emitted.pcodeText);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });

  await fs.writeFile(outPath, emitted.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(signedSymbolMap, null, 2)}\n`, 'utf-8');

  console.log(`[PCODE-COMPILER] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[PCODE-COMPILER] Manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`[PCODE-COMPILER] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[PCODE-COMPILER] Output (symbol map): ${path.relative(process.cwd(), mapOutPath)}`);
  console.log(`[PCODE-COMPILER] Router entries: ${(compiled.routerRules || []).length}`);
  console.log(`[PCODE-COMPILER] Mapper entries: ${(compiled.dataMappings || []).length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[PCODE-COMPILER] Failed:', err.message);
    process.exitCode = 1;
  });
}
