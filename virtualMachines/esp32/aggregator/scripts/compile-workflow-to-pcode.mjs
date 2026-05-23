import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';

function parseArgs(argv) {
  const args = {
    in: './data/workflow.wfl',
    workflow: null,
    out: '../pcode/workflow-router.pcode',
    outMap: '../pcode/workflow-router.program.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--workflow') args.workflow = argv[i + 1];
    if (token === '--out') args.out = argv[i + 1];
    if (token === '--out-map') args.outMap = argv[i + 1];
  }

  return args;
}

function sanitizeLabel(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'X';
}

function q(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function toWhenRule(condition) {
  const field = String(condition?.field || '').trim();
  const op = String(condition?.operator || '').trim().toLowerCase();
  const value = String(condition?.value || '');
  if (!field) {
    throw new Error('IF condition is missing field');
  }
  if (op === 'equals') {
    return `FIELD_EQUALS(${q(field)},${q(value)})`;
  }
  if (op === 'contains') {
    return `FIELD_CONTAINS(${q(field)},${q(value)})`;
  }
  throw new Error(`Unsupported IF operator for pcode emit: ${op}`);
}

function emitStatements(steps, lines, labels, branchCounterRef) {
  for (const step of steps || []) {
    if (step.action === 'route_queue') {
      labels.push({ type: 'route_queue', stepId: step.id, queueRef: step.queueRef });
      lines.push(`ROUTE_EMIT ${q(step.queueRef)}`);
      continue;
    }

    if (step.action === 'set_state') {
      labels.push({ type: 'set_state', stepId: step.id, key: step.key, value: step.value });
      lines.push(`ROUTE_SET_STATE ${q(`${step.key}=${step.value}`)}`);
      continue;
    }

    if (step.action === 'if') {
      const branchId = branchCounterRef.value++;
      const elseLabel = `IF_${branchId}_ELSE`;
      const endLabel = `IF_${branchId}_END`;

      lines.push(`ROUTE_EVAL_WHEN ${q(toWhenRule(step.condition))}`);
      lines.push(`JZ ${elseLabel}`);

      emitStatements(step.then || [], lines, labels, branchCounterRef);
      lines.push(`JMP ${endLabel}`);

      lines.push(`${elseLabel}:`);
      emitStatements(step.else || [], lines, labels, branchCounterRef);
      lines.push(`${endLabel}:`);
      continue;
    }

    if (step.action === 'call_api') {
      labels.push({ type: 'call_api_ignored', stepId: step.id, route: step.route });
      lines.push('NOP');
      continue;
    }

    if (step.action === 'wait') {
      labels.push({ type: 'wait_ignored', stepId: step.id, durationMs: step.durationMs });
      lines.push('NOP');
      continue;
    }

    if (step.action === 'check_api') {
      labels.push({
        type: 'check_api_ignored',
        stepId: step.id,
        method: step.method,
        route: step.route,
        expectedStatus: step.expectedStatus,
        retries: step.retries,
        everyMs: step.everyMs
      });
      lines.push('NOP');
      continue;
    }

    throw new Error(`Unsupported workflow step for pcode emit: ${step.action}`);
  }
}

function compileWorkflowToPcode(compiled, workflowId) {
  const workflow = (compiled.workflows || []).find(item => item.id === workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const queueBySymbol = new Map((compiled.symbols?.queues || []).map(item => [item.symbol, item.queueName]));

  const lines = [];
  const programMap = [];
  const branchCounterRef = { value: 1 };

  lines.push('# Auto-generated pcode from workflow DSL');
  lines.push(`# WORKFLOW ${workflowId}`);

  const emitted = [];
  emitStatements(workflow.steps || [], lines, emitted, branchCounterRef);
  lines.push('HALT');

  // Replace symbolic queue refs in ROUTE_EMIT with concrete queue names.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/^ROUTE_EMIT\s+"([^"]+)"$/);
    if (!m) continue;
    const queueRef = m[1];
    const queueName = queueBySymbol.get(queueRef) || queueRef;
    lines[i] = `ROUTE_EMIT ${q(queueName)}`;
  }

  let address = 0;
  for (const line of lines) {
    const t = String(line || '').trim();
    if (!t || t.startsWith('#') || t.endsWith(':')) continue;
    programMap.push({ address, text: t });
    address += 1;
  }

  return {
    workflowId,
    generatedAt: new Date().toISOString(),
    instructionCount: address,
    pcodeText: `${lines.join('\n')}\n`,
    programMap,
    notes: emitted
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compileWorkflowDSL(sourceText);

  const workflowId = args.workflow || (compiled.workflows[0] ? compiled.workflows[0].id : null);
  if (!workflowId) {
    throw new Error('No workflow found to compile');
  }

  const out = compileWorkflowToPcode(compiled, workflowId);

  const outPath = path.resolve(args.out);
  const outMapPath = path.resolve(args.outMap);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(outMapPath), { recursive: true });

  await fs.writeFile(outPath, out.pcodeText, 'utf-8');
  await fs.writeFile(outMapPath, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');

  console.log(`[WORKFLOW-PCODE] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[WORKFLOW-PCODE] Workflow: ${workflowId}`);
  console.log(`[WORKFLOW-PCODE] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[WORKFLOW-PCODE] Output (program map): ${path.relative(process.cwd(), outMapPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[WORKFLOW-PCODE] Failed:', err.message);
    process.exitCode = 1;
  });
}
