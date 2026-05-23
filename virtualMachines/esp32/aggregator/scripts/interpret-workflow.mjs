import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';

function parseArgs(argv) {
  const args = {
    in: './data/workflow.wfl',
    workflow: null,
    dryRun: false,
    context: '{}',
    contextFile: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--workflow') args.workflow = argv[i + 1];
    if (token === '--dry-run') args.dryRun = true;
    if (token === '--context') args.context = argv[i + 1];
    if (token === '--context-file') args.contextFile = argv[i + 1];
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

function buildQueueMap(symbols) {
  const out = new Map();
  for (const queue of symbols.queues || []) {
    out.set(queue.symbol, queue);
  }
  return out;
}

function parseContext(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('context must be a JSON object');
    }
    return parsed;
  } catch (e) {
    throw new Error(`Invalid --context JSON: ${e.message}`);
  }
}

function getByPath(source, dottedPath) {
  const pathText = String(dottedPath || '').trim();
  if (!pathText) return undefined;
  const parts = pathText.split('.').map(part => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function sleep(ms) {
  const duration = Math.max(0, Number(ms) || 0);
  return new Promise(resolve => setTimeout(resolve, duration));
}

function evaluateCondition(condition, context, state) {
  const fieldPath = String(condition?.field || '').trim();
  const operator = String(condition?.operator || '').trim().toLowerCase();
  const expected = String(condition?.value ?? '');

  const fromState = getByPath(state, fieldPath);
  const fromContext = getByPath(context, fieldPath);
  const actual = fromState !== undefined ? fromState : fromContext;

  if (operator === 'equals') {
    return String(actual ?? '') === expected;
  }

  if (operator === 'contains') {
    if (Array.isArray(actual)) {
      return actual.map(item => String(item)).includes(expected);
    }
    return String(actual ?? '').includes(expected);
  }

  throw new Error(`Unsupported condition operator: ${operator}`);
}

async function executeSteps(steps, runtime, output) {
  for (const step of steps || []) {
    if (step.action === 'call_api') {
      const api = runtime.apiMap.get(step.apiSymbol);
      if (!api || !api.baseUrl) {
        throw new Error(`Unknown API symbol: ${step.apiSymbol}`);
      }

      const url = `${String(api.baseUrl).replace(/\/+$/, '')}${step.route}`;
      if (runtime.dryRun) {
        output.push({
          stepId: step.id,
          mode: 'dry-run',
          action: step.action,
          method: step.method,
          url
        });
        continue;
      }

      const response = await fetch(url, {
        method: step.method,
        headers: {
          'content-type': 'application/json',
          'x-user-id': runtime.actorUserId
        }
      });

      const responseText = await response.text();
      output.push({
        stepId: step.id,
        mode: 'executed',
        action: step.action,
        method: step.method,
        url,
        status: response.status,
        ok: response.ok,
        response: responseText
      });

      if (!response.ok) {
        throw new Error(`Workflow step ${step.id} failed with status ${response.status}`);
      }
      continue;
    }

    if (step.action === 'wait') {
      if (!runtime.dryRun) {
        await sleep(step.durationMs);
      }
      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        durationMs: step.durationMs
      });
      continue;
    }

    if (step.action === 'check_api') {
      const api = runtime.apiMap.get(step.apiSymbol);
      if (!api || !api.baseUrl) {
        throw new Error(`Unknown API symbol: ${step.apiSymbol}`);
      }

      const url = `${String(api.baseUrl).replace(/\/+$/, '')}${step.route}`;
      if (runtime.dryRun) {
        output.push({
          stepId: step.id,
          mode: 'dry-run',
          action: step.action,
          method: step.method,
          url,
          expectedStatus: step.expectedStatus,
          retries: step.retries,
          everyMs: step.everyMs
        });
        continue;
      }

      let lastStatus = null;
      let lastError = null;
      let passed = false;

      for (let attempt = 1; attempt <= step.retries; attempt += 1) {
        try {
          const response = await fetch(url, {
            method: step.method,
            headers: {
              'content-type': 'application/json',
              'x-user-id': runtime.actorUserId
            }
          });

          lastStatus = response.status;
          lastError = null;
          if (response.status === step.expectedStatus) {
            passed = true;
            output.push({
              stepId: step.id,
              mode: 'executed',
              action: step.action,
              method: step.method,
              url,
              expectedStatus: step.expectedStatus,
              status: response.status,
              attemptsUsed: attempt
            });
            break;
          }
        } catch (e) {
          lastError = e?.message || String(e);
        }

        if (attempt < step.retries) {
          await sleep(step.everyMs);
        }
      }

      if (!passed) {
        throw new Error(`Workflow step ${step.id} health check failed (expected ${step.expectedStatus}, lastStatus=${lastStatus ?? 'network-error'}, lastError=${lastError || 'n/a'})`);
      }
      continue;
    }

    if (step.action === 'route_queue') {
      const queueInfo = runtime.queueMap.get(step.queueRef) || null;
      const queueName = queueInfo?.queueName || step.queueRef;
      runtime.state.lastQueue = queueName;
      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        queueRef: step.queueRef,
        queueName
      });
      continue;
    }

    if (step.action === 'set_state') {
      runtime.state[step.key] = step.value;
      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        key: step.key,
        value: step.value
      });
      continue;
    }

    if (step.action === 'if') {
      const matched = evaluateCondition(step.condition, runtime.context, runtime.state);
      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        condition: step.condition,
        branchTaken: matched ? 'then' : 'else'
      });
      await executeSteps(matched ? step.then : step.else, runtime, output);
      continue;
    }

    throw new Error(`Unsupported step action: ${step.action}`);
  }
}

async function executeWorkflow(compiled, workflowId, dryRun = false, context = {}) {
  const workflow = (compiled.workflows || []).find(w => w.id === workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const symbols = compiled.symbols || {};
  const apiMap = buildApiMap(symbols);
  const queueMap = buildQueueMap(symbols);
  const state = {};
  const results = [];

  await executeSteps(workflow.steps || [], {
    dryRun,
    apiMap,
    queueMap,
    state,
    context,
    actorUserId: String(context?.actorUserId || 'system-admin').trim() || 'system-admin'
  }, results);

  return {
    workflowId,
    stepCount: (workflow.steps || []).length,
    results,
    state
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

  let contextText = args.context;
  if (args.contextFile) {
    const contextPath = path.resolve(args.contextFile);
    contextText = await fs.readFile(contextPath, 'utf-8');
  }
  const context = parseContext(contextText);
  const summary = await executeWorkflow(compiled, workflowId, args.dryRun, context);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[WORKFLOW-INTERPRETER] Failed:', err.message);
    process.exitCode = 1;
  });
}
