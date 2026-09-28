#!/usr/bin/env node
/**
 * Deploy-and-test orchestrator for Pascalish programs.
 *
 * Compiles a .pas source once, then runs it on either pmachine runtime,
 * optionally reassigning its trigger/expected queues via a WFL deployment,
 * and optionally attaching a debug session (JS runtime only in Phase 1).
 *
 * Usage:
 *   node scripts/deploy-and-test-pmachine.mjs --source <path.pas> --runtime js|esp32 [options]
 *
 * Options:
 *   --node <name>          ESP32 node name/host (runtime=esp32 only, default neptune.child1)
 *   --input-queue <name>   Queue used to trigger the run (default deploy-test.in)
 *   --message <text>       Inline input message
 *   --message-file <path>  Read the input message from a file instead of --message
 *   --wfl <path.wfl>       WFL file to source queue reassignment from
 *   --deployment <id>      DEPLOYMENT id to use from the WFL file (default: first one)
 *   --service-id <id>      Resource id inside the deployment to match (default: by file name)
 *   --debug                Attach a debug session instead of running to completion (JS only)
 *   --break-at <pc>        PC address to break at (repeatable, debug + js only)
 *   --step-count <n>       Single-step this many instructions before continuing (debug + js only)
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { runPascalOnEsp32 } from './run-pascal-on-esp32-node.mjs';
import { runSingleMessageForEvolution } from '../../pmachines/javascript/index.mjs';
import {
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  setJavaScriptPmachineDebugBreakpoints,
  stepJavaScriptPmachineDebugSession,
  continueJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

function parseArgs(argv) {
  const args = {
    source: '',
    runtime: 'js',
    node: process.env.ESP32_NODE_NAME || 'neptune.child1',
    inputQueue: 'deploy-test.in',
    message: '',
    messageFile: '',
    wfl: '',
    deployment: '',
    serviceId: '',
    debug: false,
    breakAt: [],
    stepCount: 0
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--source') { args.source = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--runtime') { args.runtime = String(argv[i + 1] || args.runtime); i += 1; }
    else if (token === '--node') { args.node = String(argv[i + 1] || args.node); i += 1; }
    else if (token === '--input-queue') { args.inputQueue = String(argv[i + 1] || args.inputQueue); i += 1; }
    else if (token === '--message') { args.message = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--message-file') { args.messageFile = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--wfl') { args.wfl = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--deployment') { args.deployment = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--service-id') { args.serviceId = String(argv[i + 1] || ''); i += 1; }
    else if (token === '--debug') { args.debug = true; }
    else if (token === '--break-at') { const v = Number.parseInt(argv[i + 1], 10); if (Number.isInteger(v)) args.breakAt.push(v); i += 1; }
    else if (token === '--step-count') { args.stepCount = Number.parseInt(argv[i + 1], 10) || 0; i += 1; }
  }
  return args;
}

async function resolveMessage(args) {
  if (args.messageFile) return fs.readFile(path.resolve(args.messageFile), 'utf-8');
  return args.message || '';
}

// Reassigns which queue triggers/receives this run via a WFL DEPLOYMENT block.
// Does not rewrite queue-name literals already baked into ROUTER pcode (future work).
async function resolveWflQueueOverride(args, sourcePath) {
  if (!args.wfl) return null;
  const wflText = await fs.readFile(path.resolve(args.wfl), 'utf-8');
  const compiled = compileWorkflowDSLWithAntlr(wflText);
  const deployments = compiled?.deployments || [];
  if (deployments.length === 0) {
    console.error('[deploy-and-test] WFL file has no DEPLOYMENT blocks; ignoring --wfl.');
    return null;
  }
  const deployment = args.deployment
    ? deployments.find((d) => d.id === args.deployment)
    : deployments[0];
  if (!deployment) {
    console.error(`[deploy-and-test] No deployment named '${args.deployment}' found in WFL file.`);
    return null;
  }
  const sourceBase = path.basename(sourcePath);
  const resource = (args.serviceId ? deployment.resources.find((r) => r.id === args.serviceId) : null)
    || deployment.resources.find((r) => path.basename(r.fileName) === sourceBase)
    || deployment.resources[0]
    || null;
  if (!resource) {
    console.error(`[deploy-and-test] Deployment '${deployment.id}' has no matching resource; ignoring --wfl.`);
    return null;
  }
  console.error(`[deploy-and-test] WFL override: deployment='${deployment.id}' resource='${resource.id}' inputQueue='${resource.inputQueue}' outputQueue='${resource.outputQueue}'`);
  return {
    deploymentId: deployment.id,
    resourceId: resource.id,
    inputQueue: resource.inputQueue,
    outputQueue: resource.outputQueue
  };
}

async function runJsNonDebug({ pcodeText, programMap, inputQueue, message }) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-deploy-test-'));
  const pcodePath = path.join(tmpDir, 'program.pcode');
  const mapPath = path.join(tmpDir, 'program.map.json');
  try {
    await fs.writeFile(pcodePath, pcodeText, 'utf-8');
    await fs.writeFile(mapPath, JSON.stringify(programMap, null, 2), 'utf-8');
    return await runSingleMessageForEvolution({
      pcode: pcodePath,
      programMap: mapPath,
      inputQueue,
      message,
      messageFile: null,
      serviceId: programMap.serviceId || '',
      organismId: '',
      generation: '0',
      fitnessOut: ''
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhileRunning(sessionId, { timeoutMs = 15000, pollMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let state = getJavaScriptPmachineDebugState(sessionId);
  while (state && state.status === 'running' && Date.now() < deadline) {
    await sleep(pollMs);
    state = getJavaScriptPmachineDebugState(sessionId);
  }
  return state;
}

async function runJsDebug({ pcodeText, programMap, inputQueue, message, breakAt, stepCount }) {
  let state = createJavaScriptPmachineDebugSession({
    pcodeText,
    programMap,
    sourceMap: programMap.sourceMap || {},
    inputQueue,
    sourceMessage: message
  });
  const sessionId = state.id;
  const pauses = [];

  if (breakAt.length > 0) {
    setJavaScriptPmachineDebugBreakpoints(sessionId, breakAt);
  }

  if (stepCount > 0) {
    for (let i = 0; i < stepCount && state.status !== 'completed' && state.status !== 'error'; i += 1) {
      stepJavaScriptPmachineDebugSession(sessionId);
      state = await waitWhileRunning(sessionId);
      if (state) pauses.push({ pc: state.pc, sourceLocation: state.sourceLocation, status: state.status });
    }
  }

  while (state && state.status !== 'completed' && state.status !== 'error') {
    continueJavaScriptPmachineDebugSession(sessionId);
    state = await waitWhileRunning(sessionId);
    if (!state) break;
    if (state.status === 'paused') {
      pauses.push({ pc: state.pc, sourceLocation: state.sourceLocation, status: 'breakpoint' });
    }
  }

  return { sessionId, breakpointsHit: pauses, final: state };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) {
    console.error('[deploy-and-test] --source <path.pas> is required.');
    process.exitCode = 1;
    return;
  }

  const sourcePath = path.resolve(args.source);
  const sourceText = await fs.readFile(sourcePath, 'utf-8');
  console.error(`[deploy-and-test] compiling ${path.basename(sourcePath)} ...`);
  const { pcodeText, programMap } = compilePascalishProgramWithAntlr(sourceText);

  const wflOverride = await resolveWflQueueOverride(args, sourcePath);
  const inputQueue = wflOverride?.inputQueue || args.inputQueue;
  const message = await resolveMessage(args);

  const output = {
    source: path.basename(sourcePath),
    runtime: args.runtime,
    inputQueue,
    wflOverride,
    debug: args.debug,
    debugFallback: false
  };

  if (args.runtime === 'js') {
    if (args.debug) {
      output.result = await runJsDebug({
        pcodeText,
        programMap,
        inputQueue,
        message,
        breakAt: args.breakAt,
        stepCount: args.stepCount
      });
    } else {
      output.result = await runJsNonDebug({ pcodeText, programMap, inputQueue, message });
    }
  } else if (args.runtime === 'esp32') {
    if (args.debug) {
      console.error('[deploy-and-test] ESP32 debug/stepping is not implemented yet (Phase 2). Running without stepping.');
      output.debugFallback = true;
    }
    output.result = await runPascalOnEsp32({ source: sourcePath, node: args.node, inputQueue, message });
  } else {
    console.error(`[deploy-and-test] Unknown --runtime '${args.runtime}' (expected 'js' or 'esp32').`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('[deploy-and-test]', error?.message || String(error));
    process.exitCode = 1;
  });
}
