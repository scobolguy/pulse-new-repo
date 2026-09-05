import fs from 'fs/promises';
import path from 'path';
import { normalizePascalPrompt, detectCoachMode, runCoachSession } from './run-ollama-dsl-coach.mjs';
import { runPascalOnEsp32 } from './run-pascal-on-esp32-node.mjs';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileRouterMapperDSL } from './compile-pascal.mjs';

const WORKDIR = process.cwd();
const DATA_DIR = path.resolve(WORKDIR, 'data');
const SESSIONS_DIR = path.resolve(DATA_DIR, 'ollama-mentor-sessions');
const ESCALATIONS_DIR = path.resolve(DATA_DIR, 'ollama-copilot-escalations');
const CANDIDATES_DIR = path.resolve(DATA_DIR, 'ollama-mentor-candidates');
const RESULTS_DIR = path.resolve(DATA_DIR, 'ollama-mentor-results');
const POST_TIMEOUT_GRACE_MS = 5000;
const POST_TIMEOUT_POLL_MS = 250;

function parseArgs(argv) {
  const args = {
    prompt: '',
    model: process.env.OLLAMA_MODEL || 'phi3:latest',
    timeoutMs: 30000,
    topK: 2,
    maxContextChars: 2500,
    numPredict: 320,
    noRepair: false,
    out: ''
  };

  function readOptionValue(startIndex) {
    const parts = [];
    for (let index = startIndex; index < argv.length; index += 1) {
      const value = String(argv[index] || '');
      if (value.startsWith('--')) break;
      parts.push(value);
    }
    return parts.join(' ').trim();
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--prompt') {
      args.prompt = readOptionValue(i + 1);
      i += Math.max(0, args.prompt.split(/\s+/).filter(Boolean).length);
      continue;
    }
    if (token === '--model') {
      args.model = String(argv[i + 1] || args.model);
      i += 1;
      continue;
    }
    if (token === '--timeout-ms') {
      args.timeoutMs = Math.max(1000, Number.parseInt(String(argv[i + 1] || args.timeoutMs), 10) || 30000);
      i += 1;
      continue;
    }
    if (token === '--top-k') {
      args.topK = Math.max(1, Number.parseInt(String(argv[i + 1] || args.topK), 10) || 4);
      i += 1;
      continue;
    }
    if (token === '--max-context-chars') {
      args.maxContextChars = Math.max(1000, Number.parseInt(String(argv[i + 1] || args.maxContextChars), 10) || 5000);
      i += 1;
      continue;
    }
    if (token === '--num-predict') {
      args.numPredict = Math.max(64, Number.parseInt(String(argv[i + 1] || args.numPredict), 10) || 320);
      i += 1;
      continue;
    }
    if (token === '--no-repair') {
      args.noRepair = true;
      continue;
    }
    if (token === '--out') {
      args.out = path.resolve(String(argv[i + 1] || args.out));
      i += 1;
    }
  }

  if (!args.prompt.trim()) {
    throw new Error('Missing required --prompt argument');
  }

  args.prompt = normalizePascalPrompt(args.prompt);

  return args;
}

function makeSessionId() {
  return `mentor-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function splitPromptStages(promptText) {
  const originalPrompt = normalizePascalPrompt(promptText);
  const deploymentPattern = /\b(?:and\s+)?deploy\b[\s\S]*$/i;
  const match = deploymentPattern.exec(originalPrompt);
  if (!match) {
    return {
      originalPrompt,
      generationPrompt: originalPrompt,
      followUpPrompt: null,
      hasDeploymentStage: false
    };
  }

  const generationPrompt = originalPrompt.slice(0, match.index).trim().replace(/[\s,;]+$/g, '').trim();
  const followUpPrompt = originalPrompt.slice(match.index).trim();
  return {
    originalPrompt,
    generationPrompt: generationPrompt || originalPrompt,
    followUpPrompt: followUpPrompt || null,
    hasDeploymentStage: Boolean(followUpPrompt)
  };
}

async function ensureDirs() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await fs.mkdir(ESCALATIONS_DIR, { recursive: true });
  await fs.mkdir(CANDIDATES_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

async function ensureCandidateFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '', 'utf-8');
}

async function getCandidateMetadata(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return {
      exists: stat.isFile(),
      bytes: Number(stat.size || 0)
    };
  } catch {
    return {
      exists: false,
      bytes: 0
    };
  }
}

function detectServiceIdFromCandidate(candidateText) {
  const match = String(candidateText || '').match(/\bservice\s+"([^"]+)"\s*;/i);
  return match ? String(match[1] || '').trim() : '';
}

function buildDeploymentFollowUp(args, coachResult) {
  if (!args.hasDeploymentStage || !args.followUpPrompt) return null;
  const followPrompt = String(args.followUpPrompt || '');
  const nodeNameMatch = followPrompt.match(/\b([a-z0-9]+(?:\.[a-z0-9_-]+)+)\b/i);
  const nodeName = nodeNameMatch ? String(nodeNameMatch[1] || '').trim() : 'neptune.child1';

  if (args.coachMode === 'pascal-program') {
    return {
      type: 'deployment-follow-up',
      prompt: args.followUpPrompt,
      nodeName,
      deployType: 'pascal-program',
      commands: [
        'Set-Location .\\aggregator',
        `$env:ESP32_NODE_NAME='${nodeName}'`,
        'npm run run:pascal:esp32'
      ]
    };
  }

  const serviceId = detectServiceIdFromCandidate(coachResult?.candidate || '') || 'helloService';
  const deployScript = serviceId.toLowerCase() === 'helloservice'
    ? 'deploy:esp32:hello-service'
    : `deploy:esp32:${serviceId}`;

  return {
    type: 'deployment-follow-up',
    prompt: args.followUpPrompt,
    nodeName,
    serviceId,
    deployType: 'pascalish-service',
    commands: [
      'Set-Location .\\aggregator',
      `$env:ESP32_NODE_NAME='${nodeName}'`,
      `npm run ${deployScript}`
    ]
  };
}

async function loadValidatedCandidateResult(filePath, coachMode) {
  try {
    const candidateText = String(await fs.readFile(filePath, 'utf-8') || '').trim();
    if (!candidateText) return null;
    if (coachMode === 'pascalish-service') {
      const compiled = compileRouterMapperDSL(candidateText);
      return {
        status: 'ok',
        source: 'candidate-file-after-timeout',
        validation: {
          valid: true,
          dialect: 'pascalish-service',
          summary: {
            serviceId: compiled?.serviceId || null,
            routers: Array.isArray(compiled?.routerRules) ? compiled.routerRules.length : 0,
            mappers: Array.isArray(compiled?.dataMappings) ? compiled.dataMappings.length : 0,
            runtimeKind: compiled?.runtimeUnit?.kind || 'service'
          },
          errors: []
        },
        candidate: candidateText,
        outputPath: path.relative(WORKDIR, filePath).replace(/\\/g, '/')
      };
    }

    const compiled = compilePascalishProgramWithAntlr(candidateText);
    return {
      status: 'ok',
      source: 'candidate-file-after-timeout',
      validation: {
        valid: true,
        dialect: 'pascal-program',
        summary: {
          pcodeInstructions: Number.isFinite(Number(compiled?.programMap?.length)) ? Number(compiled.programMap.length) : null,
          pcodeLines: Number.isFinite(Number(compiled?.pcodeText?.split('\n')?.length)) ? Number(compiled.pcodeText.split('\n').length) : null
        },
        errors: []
      },
      candidate: candidateText,
      outputPath: path.relative(WORKDIR, filePath).replace(/\\/g, '/')
    };
  } catch {
    return null;
  }
}

async function loadCoachResultFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function waitForLateSuccess(candidatePath, resultPath, coachMode, timeoutMs = POST_TIMEOUT_GRACE_MS) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() <= deadline) {
    const resultFile = await loadCoachResultFile(resultPath);
    if (resultFile?.status === 'ok') return resultFile;
    const candidateResult = await loadValidatedCandidateResult(candidatePath, coachMode);
    if (candidateResult) return candidateResult;
    await new Promise((resolve) => setTimeout(resolve, POST_TIMEOUT_POLL_MS));
  }
  return null;
}

async function runCoachInProcess(args) {
  let timedOut = false;
  let parsed = null;
  let stderr = '';

  const sessionPromise = runCoachSession({
    prompt: args.prompt,
    model: args.model,
    mode: args.coachMode,
    topK: args.topK,
    maxContextChars: args.maxContextChars,
    numPredict: args.numPredict,
    noRepair: args.noRepair,
    out: args.out,
    resultOut: args.resultOut
  }).then((result) => {
    parsed = result;
  }).catch((err) => {
    stderr = String(err?.stack || err?.message || err);
  });

  await Promise.race([
    sessionPromise,
    new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(); }, args.timeoutMs))
  ]);

  return { parsed, timedOut, hardTimedOut: false, stdout: '', stderr };
}

async function writeSessionRecord(sessionId, payload) {
  const filePath = path.resolve(SESSIONS_DIR, `${sessionId}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  return filePath;
}

async function writeEscalationPacket(sessionId, args, runResult) {
  const candidateMeta = await getCandidateMetadata(args.out);
  const packet = {
    sessionId,
    createdAt: new Date().toISOString(),
    status: 'needs-copilot',
    reason: runResult.timedOut ? 'timeout' : 'validation-or-runtime-error',
    prompt: args.prompt,
    generationPrompt: args.generationPrompt,
    followUpPrompt: args.followUpPrompt,
    hasDeploymentStage: args.hasDeploymentStage,
    model: args.model,
    timeoutMs: args.timeoutMs,
    topK: args.topK,
    maxContextChars: args.maxContextChars,
    numPredict: args.numPredict,
    noRepair: args.noRepair,
    candidatePath: path.relative(WORKDIR, args.out).replace(/\\/g, '/'),
    candidateCaptured: candidateMeta.exists,
    candidateBytes: candidateMeta.bytes,
    coachResult: runResult.parsed || null,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    instructions: [
      'Solve the Pascal program request using the prompt and any partial candidate.',
      'Return only final Pascal source code.',
      'Save the answer to a file and ingest it with scripts/ingest-pascal-mentor-answer.mjs.'
    ]
  };

  const packetPath = path.resolve(ESCALATIONS_DIR, `${sessionId}.packet.json`);
  await fs.writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf-8');
  return { packet, packetPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const promptStages = splitPromptStages(args.prompt);
  args.prompt = promptStages.originalPrompt;
  args.generationPrompt = promptStages.generationPrompt;
  args.followUpPrompt = promptStages.followUpPrompt;
  args.hasDeploymentStage = promptStages.hasDeploymentStage;
  args.coachMode = detectCoachMode(args.generationPrompt);
  const sessionId = makeSessionId();
  await ensureDirs();
  if (!args.out) {
    args.out = path.resolve(CANDIDATES_DIR, `${sessionId}.pas`);
  }
  args.resultOut = path.resolve(RESULTS_DIR, `${sessionId}.result.json`);
  await ensureCandidateFile(args.out);

  const startedAt = Date.now();
  const runResult = await runCoachInProcess({ ...args, prompt: args.generationPrompt });
  const elapsedMs = Date.now() - startedAt;

  if ((runResult.hardTimedOut || runResult.timedOut) && !(runResult.parsed?.status === 'ok')) {
    runResult.parsed = await waitForLateSuccess(args.out, args.resultOut, args.coachMode);
  }

  if (runResult.parsed?.status === 'ok') {
    const completedAfterTimeout = runResult.timedOut === true;
    const followUp = buildDeploymentFollowUp(args, runResult.parsed);

    // Auto-execute deployment for pascal-program when a deploy stage was requested
    let deployResult = null;
    if (followUp?.deployType === 'pascal-program' && args.out) {
      try {
        deployResult = await runPascalOnEsp32({ source: args.out, node: followUp.nodeName });
      } catch (deployErr) {
        deployResult = { error: String(deployErr?.message || deployErr) };
      }
    }

    const session = {
      sessionId,
      status: completedAfterTimeout ? 'solved-by-ollama-after-timeout' : 'solved-by-ollama',
      createdAt: new Date().toISOString(),
      elapsedMs,
      prompt: args.prompt,
      generationPrompt: args.generationPrompt,
      followUpPrompt: args.followUpPrompt,
      hasDeploymentStage: args.hasDeploymentStage,
      coachMode: args.coachMode,
      topK: args.topK,
      maxContextChars: args.maxContextChars,
      numPredict: args.numPredict,
      noRepair: args.noRepair,
      completedAfterTimeout,
      followUp,
      deployResult,
      outputPath: path.relative(WORKDIR, args.out).replace(/\\/g, '/'),
      result: runResult.parsed
    };
    const sessionPath = await writeSessionRecord(sessionId, session);
    console.log(JSON.stringify({
      status: 'ok',
      sessionId,
      solvedBy: completedAfterTimeout ? 'ollama-after-timeout' : 'ollama',
      generationPrompt: args.generationPrompt,
      followUpPrompt: args.followUpPrompt,
      hasDeploymentStage: args.hasDeploymentStage,
      coachMode: args.coachMode,
      topK: args.topK,
      maxContextChars: args.maxContextChars,
      numPredict: args.numPredict,
      noRepair: args.noRepair,
      completedAfterTimeout,
      followUp,
      deployResult,
      sessionPath: path.relative(WORKDIR, sessionPath).replace(/\\/g, '/'),
      outputPath: session.outputPath,
      elapsedMs
    }, null, 2));
    return;
  }

  const { packetPath, packet } = await writeEscalationPacket(sessionId, args, runResult);
  const session = {
    sessionId,
    status: 'needs-copilot',
    createdAt: new Date().toISOString(),
    elapsedMs,
    prompt: args.prompt,
    generationPrompt: args.generationPrompt,
    followUpPrompt: args.followUpPrompt,
    hasDeploymentStage: args.hasDeploymentStage,
    coachMode: args.coachMode,
    topK: args.topK,
    maxContextChars: args.maxContextChars,
    numPredict: args.numPredict,
    noRepair: args.noRepair,
    escalationPacketPath: path.relative(WORKDIR, packetPath).replace(/\\/g, '/'),
    coachResult: runResult.parsed || null,
    reason: packet.reason
  };
  const sessionPath = await writeSessionRecord(sessionId, session);

  console.log(JSON.stringify({
    status: 'needs-copilot',
    sessionId,
    solvedBy: null,
    reason: packet.reason,
    generationPrompt: args.generationPrompt,
    followUpPrompt: args.followUpPrompt,
    hasDeploymentStage: args.hasDeploymentStage,
    topK: args.topK,
    maxContextChars: args.maxContextChars,
    numPredict: args.numPredict,
    noRepair: args.noRepair,
    sessionPath: path.relative(WORKDIR, sessionPath).replace(/\\/g, '/'),
    escalationPacketPath: session.escalationPacketPath,
    candidatePath: packet.candidatePath,
    elapsedMs
  }, null, 2));

  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
