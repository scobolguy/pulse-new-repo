import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';

function parseArgs(argv) {
  const args = {
    in: './data/workflow.wfl',
    workflow: null,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--workflow') args.workflow = argv[i + 1];
    if (token === '--dry-run') args.dryRun = true;
  }

  return args;
}

function buildApiMap(symbols) {
  const out = new Map();
  for (const api of symbols.apis || []) {
    out.set(api.symbol, api);
  }
  return out;
}

async function executeWorkflow(compiled, workflowId, dryRun = false) {
  const workflow = (compiled.workflows || []).find(w => w.id === workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const apiMap = buildApiMap(compiled.symbols || {});
  const results = [];

  for (const step of workflow.steps || []) {
    if (step.action !== 'call_api') {
      throw new Error(`Unsupported step action: ${step.action}`);
    }

    const api = apiMap.get(step.apiSymbol);
    if (!api || !api.baseUrl) {
      throw new Error(`Unknown API symbol: ${step.apiSymbol}`);
    }

    const url = `${String(api.baseUrl).replace(/\/+$/, '')}${step.route}`;
    if (dryRun) {
      results.push({
        stepId: step.id,
        mode: 'dry-run',
        method: step.method,
        url
      });
      continue;
    }

    const response = await fetch(url, {
      method: step.method,
      headers: { 'content-type': 'application/json' }
    });

    const responseText = await response.text();
    results.push({
      stepId: step.id,
      mode: 'executed',
      method: step.method,
      url,
      status: response.status,
      ok: response.ok,
      response: responseText
    });

    if (!response.ok) {
      throw new Error(`Workflow step ${step.id} failed with status ${response.status}`);
    }
  }

  return {
    workflowId,
    stepCount: (workflow.steps || []).length,
    results
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compileWorkflowDSL(sourceText);

  const workflowId = args.workflow || (compiled.workflows[0] ? compiled.workflows[0].id : null);
  if (!workflowId) {
    throw new Error('No workflows declared in source');
  }

  const summary = await executeWorkflow(compiled, workflowId, args.dryRun);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[WORKFLOW-INTERPRETER] Failed:', err.message);
    process.exitCode = 1;
  });
}
