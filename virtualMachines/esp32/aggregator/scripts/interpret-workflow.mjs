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

function toErrorMessage(error) {
  if (!error) return 'unknown error';
  return error?.message ? String(error.message) : String(error);
}

function normalizeTimeoutQueue(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const jobs = Array.isArray(source.jobs) ? source.jobs : [];
  jobs.sort((a, b) => {
    const left = Date.parse(String(a?.triggerAt || '')) || 0;
    const right = Date.parse(String(b?.triggerAt || '')) || 0;
    return left - right;
  });
  return {
    version: 1,
    updatedAt: source.updatedAt || new Date().toISOString(),
    jobs
  };
}

async function loadTimeoutQueue(queuePath) {
  try {
    const raw = await fs.readFile(queuePath, 'utf-8');
    return normalizeTimeoutQueue(JSON.parse(raw));
  } catch {
    return normalizeTimeoutQueue(null);
  }
}

async function saveTimeoutQueue(queuePath, queue) {
  const normalized = normalizeTimeoutQueue(queue);
  normalized.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await fs.writeFile(queuePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
}

async function enqueueTimeoutJob(runtime, job) {
  const queue = await loadTimeoutQueue(runtime.workflowTimeoutQueuePath);
  queue.jobs.push(job);
  await saveTimeoutQueue(runtime.workflowTimeoutQueuePath, queue);
}

function normalizeIssueTestStore(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const issues = Array.isArray(source.issues) ? source.issues : [];
  const testCases = Array.isArray(source.testCases) ? source.testCases : [];
  const testPlans = Array.isArray(source.testPlans) ? source.testPlans : [];
  const projects = Array.isArray(source.projects) ? source.projects : [];
  const releases = Array.isArray(source.releases) ? source.releases : [];
  const deploymentArtifacts = Array.isArray(source.deploymentArtifacts) ? source.deploymentArtifacts : [];
  const projectPlans = Array.isArray(source.projectPlans) ? source.projectPlans : [];
  const milestones = Array.isArray(source.milestones) ? source.milestones : [];
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  const synchpoints = Array.isArray(source.synchpoints) ? source.synchpoints : [];
  const deliverables = Array.isArray(source.deliverables) ? source.deliverables : [];
  const resources = Array.isArray(source.resources) ? source.resources : [];
  const sequences = source.sequences && typeof source.sequences === 'object' ? source.sequences : {};
  return {
    version: 2,
    updatedAt: source.updatedAt || new Date().toISOString(),
    sequences: {
      issue: Number(sequences.issue) || 0,
      testCase: Number(sequences.testCase) || 0,
      testPlan: Number(sequences.testPlan) || 0,
      project: Number(sequences.project) || 0,
      release: Number(sequences.release) || 0,
      deploymentArtifact: Number(sequences.deploymentArtifact) || 0,
      projectPlan: Number(sequences.projectPlan) || 0,
      milestone: Number(sequences.milestone) || 0,
      task: Number(sequences.task) || 0,
      synchpoint: Number(sequences.synchpoint) || 0,
      deliverable: Number(sequences.deliverable) || 0,
      resource: Number(sequences.resource) || 0
    },
    issues,
    testCases,
    testPlans,
    projects,
    releases,
    deploymentArtifacts,
    projectPlans,
    milestones,
    tasks,
    synchpoints,
    deliverables,
    resources
  };
}

function formatSequenceId(prefix, value) {
  return `${prefix}-${String(value).padStart(6, '0')}`;
}

async function loadIssueTestStore(storePath) {
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeIssueTestStore(parsed);
  } catch {
    return normalizeIssueTestStore(null);
  }
}

async function saveIssueTestStore(storePath, store) {
  const normalized = normalizeIssueTestStore(store);
  normalized.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
}

function stateValueOrThrow(runtime, key, label) {
  const k = String(key || '').trim();
  const value = runtime.state[k];
  if (!value) {
    throw new Error(`Workflow step expected state key '${k}' for ${label}, but it was empty`);
  }
  return String(value);
}

function appendUnique(list, value) {
  const values = Array.isArray(list) ? list : [];
  if (!values.includes(value)) values.push(value);
  return values;
}

function findByIdOrThrow(items, id, label) {
  const found = (Array.isArray(items) ? items : []).find(item => item.id === id);
  if (!found) {
    throw new Error(`${label} not found: ${id}`);
  }
  return found;
}

async function savePlanItemLink(runtime, step, output, itemId, itemFieldName) {
  const planId = stateValueOrThrow(runtime, step.planStateKey, 'project plan update');

  if (!runtime.dryRun) {
    const plan = findByIdOrThrow(runtime.store.projectPlans, planId, 'Project plan');
    plan[itemFieldName] = appendUnique(plan[itemFieldName], itemId);
    plan.updatedAt = new Date().toISOString();
    await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
  }

  output.push({
    stepId: step.id,
    mode: runtime.dryRun ? 'dry-run' : 'executed',
    action: step.action,
    planId,
    itemId,
    itemFieldName
  });
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
    if (step.action === 'try') {
      try {
        await executeSteps(step.body || [], runtime, output);
      } catch (error) {
        if (Array.isArray(step.onError) && step.onError.length > 0) {
          output.push({
            stepId: step.id,
            mode: runtime.dryRun ? 'dry-run' : 'executed',
            action: step.action,
            branchTaken: 'onError',
            error: toErrorMessage(error)
          });
          await executeSteps(step.onError, runtime, output);
          continue;
        }
        throw error;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        branchTaken: 'body'
      });
      continue;
    }

    if (step.action === 'cobegin') {
      const subflows = Array.isArray(step.subflows) ? step.subflows : [];
      if (subflows.length === 0) {
        throw new Error(`COBEGIN ${step.id} must contain at least one subflow`);
      }

      const executeSubflow = async (subflow) => {
        const subflowOutput = [];
        const subflowRuntime = {
          ...runtime,
          state: { ...runtime.state },
          context: { ...runtime.context, subflowId: subflow.id }
        };
        await executeSteps(subflow.steps || [], subflowRuntime, subflowOutput);
        return {
          subflowId: subflow.id,
          state: subflowRuntime.state,
          output: subflowOutput
        };
      };

      const subflowPromises = subflows.map(subflow =>
        executeSubflow(subflow)
          .then(value => ({ ok: true, value }))
          .catch(error => ({ ok: false, subflowId: subflow.id, error }))
      );

      if (step.mode === 'sync') {
        const settled = await Promise.all(subflowPromises);
        const failed = settled.find(item => !item.ok);
        if (failed) {
          const errorMessage = toErrorMessage(failed.error);
          if (step.backoutOnError && !runtime.dryRun) {
            await enqueueTimeoutJob(runtime, {
              id: `${step.id}-backout-${Date.now()}`,
              triggerAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              workflowId: runtime.workflowId,
              stepId: step.id,
              reason: 'subflow-error',
              details: {
                mode: step.mode,
                failedSubflowId: failed.subflowId,
                error: errorMessage,
                context: runtime.context
              }
            });
          }
          throw new Error(`COBEGIN ${step.id} failed in subflow ${failed.subflowId}: ${errorMessage}`);
        }

        for (const item of settled) {
          const value = item.value;
          Object.assign(runtime.state, value.state || {});
          output.push(...(value.output || []));
        }

        output.push({
          stepId: step.id,
          mode: runtime.dryRun ? 'dry-run' : 'executed',
          action: step.action,
          cobeginMode: step.mode,
          subflowCount: subflows.length,
          completed: true
        });
        continue;
      }

      const timeoutMs = Math.max(1, Number(step.timeoutMs) || 0);
      if (!timeoutMs) {
        throw new Error(`COBEGIN ${step.id} ASYNC requires a positive WAIT timeout`);
      }

      const settledPromise = Promise.all(subflowPromises);
      const timeoutGate = sleep(timeoutMs).then(() => ({ timedOut: true }));
      const raceResult = await Promise.race([
        settledPromise.then(items => ({ timedOut: false, items })),
        timeoutGate
      ]);

      if (raceResult.timedOut) {
        if (!runtime.dryRun) {
          await enqueueTimeoutJob(runtime, {
            id: `${step.id}-timeout-${Date.now()}`,
            triggerAt: new Date(Date.now() + timeoutMs).toISOString(),
            createdAt: new Date().toISOString(),
            workflowId: runtime.workflowId,
            stepId: step.id,
            reason: 'async-timeout',
            details: {
              mode: step.mode,
              timeoutMs,
              subflowIds: subflows.map(s => s.id),
              backoutOnError: Boolean(step.backoutOnError),
              context: runtime.context
            }
          });
        }

        output.push({
          stepId: step.id,
          mode: runtime.dryRun ? 'dry-run' : 'executed',
          action: step.action,
          cobeginMode: step.mode,
          timeoutMs,
          timedOut: true,
          queuedTimeoutCheck: true
        });
        continue;
      }

      const failed = (raceResult.items || []).find(item => !item.ok);
      if (failed) {
        const errorMessage = toErrorMessage(failed.error);
        if (step.backoutOnError && !runtime.dryRun) {
          await enqueueTimeoutJob(runtime, {
            id: `${step.id}-backout-${Date.now()}`,
            triggerAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            workflowId: runtime.workflowId,
            stepId: step.id,
            reason: 'subflow-error',
            details: {
              mode: step.mode,
              failedSubflowId: failed.subflowId,
              error: errorMessage,
              context: runtime.context
            }
          });
        }
        throw new Error(`COBEGIN ${step.id} failed in subflow ${failed.subflowId}: ${errorMessage}`);
      }

      for (const item of raceResult.items || []) {
        const value = item.value;
        Object.assign(runtime.state, value.state || {});
        output.push(...(value.output || []));
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        cobeginMode: step.mode,
        timeoutMs,
        timedOut: false,
        subflowCount: subflows.length
      });
      continue;
    }

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

    if (step.action === 'issue_create') {
      const record = {
        id: runtime.dryRun ? 'ISSUE-DRYRUN' : null,
        title: step.title,
        description: step.description,
        priority: String(step.priority || 'medium').toLowerCase(),
        status: 'open',
        assigneeUserId: step.assigneeUserId || null,
        reporterType: step.reporterType || 'tester',
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        linkedTestCaseIds: []
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.issue += 1;
        record.id = formatSequenceId('ISSUE', runtime.store.sequences.issue);
        runtime.store.issues.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        issueId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'testcase_create') {
      const record = {
        id: runtime.dryRun ? 'TC-DRYRUN' : null,
        name: step.name,
        testType: String(step.testType || 'integration').toLowerCase(),
        description: step.description,
        status: 'draft',
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        linkedIssueIds: []
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.testCase += 1;
        record.id = formatSequenceId('TC', runtime.store.sequences.testCase);
        runtime.store.testCases.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        testCaseId: record.id,
        testType: record.testType,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'testplan_create') {
      const planType = String(step.planType || '').trim().toLowerCase();
      if (!['integration', 'acceptance', 'regression'].includes(planType)) {
        throw new Error(`Unsupported test plan type '${step.planType}'. Expected integration, acceptance, or regression`);
      }

      const record = {
        id: runtime.dryRun ? 'TP-DRYRUN' : null,
        name: step.name,
        planType,
        description: step.description,
        status: 'draft',
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testCaseIds: []
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.testPlan += 1;
        record.id = formatSequenceId('TP', runtime.store.sequences.testPlan);
        runtime.store.testPlans.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        testPlanId: record.id,
        planType,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'issue_link_testcase') {
      const issueId = stateValueOrThrow(runtime, step.issueStateKey, 'issue link');
      const testCaseId = stateValueOrThrow(runtime, step.testCaseStateKey, 'issue link');

      if (!runtime.dryRun) {
        const issue = runtime.store.issues.find(item => item.id === issueId);
        const testCase = runtime.store.testCases.find(item => item.id === testCaseId);
        if (!issue) throw new Error(`Issue not found for link: ${issueId}`);
        if (!testCase) throw new Error(`Test case not found for link: ${testCaseId}`);

        issue.linkedTestCaseIds = appendUnique(issue.linkedTestCaseIds, testCaseId);
        issue.updatedAt = new Date().toISOString();
        testCase.linkedIssueIds = appendUnique(testCase.linkedIssueIds, issueId);
        testCase.updatedAt = new Date().toISOString();
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        issueId,
        testCaseId
      });
      continue;
    }

    if (step.action === 'testplan_add_testcase') {
      const testCaseId = stateValueOrThrow(runtime, step.testCaseStateKey, 'test plan update');
      const planId = stateValueOrThrow(runtime, step.planStateKey, 'test plan update');

      if (!runtime.dryRun) {
        const plan = runtime.store.testPlans.find(item => item.id === planId);
        const testCase = runtime.store.testCases.find(item => item.id === testCaseId);
        if (!plan) throw new Error(`Test plan not found: ${planId}`);
        if (!testCase) throw new Error(`Test case not found: ${testCaseId}`);

        plan.testCaseIds = appendUnique(plan.testCaseIds, testCaseId);
        plan.updatedAt = new Date().toISOString();
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        planId,
        testCaseId
      });
      continue;
    }

    if (step.action === 'project_create') {
      const record = {
        id: runtime.dryRun ? 'PRJ-DRYRUN' : null,
        name: step.name,
        description: step.description,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.project += 1;
        record.id = formatSequenceId('PRJ', runtime.store.sequences.project);
        runtime.store.projects.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        projectId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'release_create') {
      const projectId = stateValueOrThrow(runtime, step.projectStateKey, 'release create');
      const record = {
        id: runtime.dryRun ? 'REL-DRYRUN' : null,
        projectId,
        name: step.name,
        description: step.description,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.projects, projectId, 'Project');
        runtime.store.sequences.release += 1;
        record.id = formatSequenceId('REL', runtime.store.sequences.release);
        runtime.store.releases.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        releaseId: record.id,
        projectId,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'deployment_artifact_create') {
      const releaseId = stateValueOrThrow(runtime, step.releaseStateKey, 'deployment artifact create');
      const record = {
        id: runtime.dryRun ? 'DEP-DRYRUN' : null,
        releaseId,
        name: step.name,
        artifactType: step.artifactType,
        location: step.location,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.releases, releaseId, 'Release');
        runtime.store.sequences.deploymentArtifact += 1;
        record.id = formatSequenceId('DEP', runtime.store.sequences.deploymentArtifact);
        runtime.store.deploymentArtifacts.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        deploymentArtifactId: record.id,
        releaseId,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'projectplan_create') {
      const projectId = stateValueOrThrow(runtime, step.projectStateKey, 'project plan create');
      const record = {
        id: runtime.dryRun ? 'PLN-DRYRUN' : null,
        projectId,
        name: step.name,
        description: step.description,
        status: 'draft',
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        milestoneIds: [],
        taskIds: [],
        synchpointIds: [],
        deliverableIds: [],
        resourceIds: []
      };

      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.projects, projectId, 'Project');
        runtime.store.sequences.projectPlan += 1;
        record.id = formatSequenceId('PLN', runtime.store.sequences.projectPlan);
        runtime.store.projectPlans.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        projectPlanId: record.id,
        projectId,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'milestone_create') {
      const record = {
        id: runtime.dryRun ? 'MLS-DRYRUN' : null,
        name: step.name,
        description: step.description,
        dueDate: step.dueDate,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.milestone += 1;
        record.id = formatSequenceId('MLS', runtime.store.sequences.milestone);
        runtime.store.milestones.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        milestoneId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'task_create') {
      const record = {
        id: runtime.dryRun ? 'TSK-DRYRUN' : null,
        name: step.name,
        description: step.description,
        assigneeUserId: step.assigneeUserId || null,
        status: 'open',
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.task += 1;
        record.id = formatSequenceId('TSK', runtime.store.sequences.task);
        runtime.store.tasks.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        taskId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'synchpoint_create') {
      const record = {
        id: runtime.dryRun ? 'SYN-DRYRUN' : null,
        name: step.name,
        description: step.description,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.synchpoint += 1;
        record.id = formatSequenceId('SYN', runtime.store.sequences.synchpoint);
        runtime.store.synchpoints.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        synchpointId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'deliverable_create') {
      const record = {
        id: runtime.dryRun ? 'DLV-DRYRUN' : null,
        name: step.name,
        description: step.description,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.deliverable += 1;
        record.id = formatSequenceId('DLV', runtime.store.sequences.deliverable);
        runtime.store.deliverables.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        deliverableId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'resource_create') {
      const record = {
        id: runtime.dryRun ? 'RES-DRYRUN' : null,
        name: step.name,
        resourceType: step.resourceType,
        description: step.description,
        createdBy: runtime.actorUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!runtime.dryRun) {
        runtime.store.sequences.resource += 1;
        record.id = formatSequenceId('RES', runtime.store.sequences.resource);
        runtime.store.resources.push(record);
        await saveIssueTestStore(runtime.issueTestStorePath, runtime.store);
      }

      if (step.outputStateKey) {
        runtime.state[step.outputStateKey] = record.id;
      }

      output.push({
        stepId: step.id,
        mode: runtime.dryRun ? 'dry-run' : 'executed',
        action: step.action,
        resourceId: record.id,
        outputStateKey: step.outputStateKey || null
      });
      continue;
    }

    if (step.action === 'projectplan_add_milestone') {
      const milestoneId = stateValueOrThrow(runtime, step.itemStateKey, 'project plan milestone link');
      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.milestones, milestoneId, 'Milestone');
      }
      await savePlanItemLink(runtime, step, output, milestoneId, 'milestoneIds');
      continue;
    }

    if (step.action === 'projectplan_add_task') {
      const taskId = stateValueOrThrow(runtime, step.itemStateKey, 'project plan task link');
      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.tasks, taskId, 'Task');
      }
      await savePlanItemLink(runtime, step, output, taskId, 'taskIds');
      continue;
    }

    if (step.action === 'projectplan_add_synchpoint') {
      const synchpointId = stateValueOrThrow(runtime, step.itemStateKey, 'project plan synchpoint link');
      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.synchpoints, synchpointId, 'Synchpoint');
      }
      await savePlanItemLink(runtime, step, output, synchpointId, 'synchpointIds');
      continue;
    }

    if (step.action === 'projectplan_add_deliverable') {
      const deliverableId = stateValueOrThrow(runtime, step.itemStateKey, 'project plan deliverable link');
      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.deliverables, deliverableId, 'Deliverable');
      }
      await savePlanItemLink(runtime, step, output, deliverableId, 'deliverableIds');
      continue;
    }

    if (step.action === 'projectplan_add_resource') {
      const resourceId = stateValueOrThrow(runtime, step.itemStateKey, 'project plan resource link');
      if (!runtime.dryRun) {
        findByIdOrThrow(runtime.store.resources, resourceId, 'Resource');
      }
      await savePlanItemLink(runtime, step, output, resourceId, 'resourceIds');
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
  const issueTestStorePath = path.resolve(String(context?.issueTestStorePath || './data/issue-test-system.json'));
  const store = await loadIssueTestStore(issueTestStorePath);

  await executeSteps(workflow.steps || [], {
    dryRun,
    apiMap,
    queueMap,
    state,
    context,
    workflowId,
    actorUserId: String(context?.actorUserId || 'system-admin').trim() || 'system-admin',
    issueTestStorePath,
    workflowTimeoutQueuePath: path.resolve(String(context?.workflowTimeoutQueuePath || './data/workflow-cobegin-timeouts.json')),
    store
  }, results);

  return {
    workflowId,
    stepCount: (workflow.steps || []).length,
    results,
    state,
    issueTestStorePath
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
