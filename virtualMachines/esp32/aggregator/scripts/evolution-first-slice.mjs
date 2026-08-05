import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const aggregatorRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(aggregatorRoot, '..');
const defaultOperationalDataRoot = path.resolve(
  process.env.PULSE_OPERATIONAL_DATA_ROOT
  || (process.platform === 'win32' ? 'c:/dev/pulse-operational-data' : '/opt/pulse/operational-data')
);
const defaultRuntimeDataRoot = path.resolve(
  process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultOperationalDataRoot
);
const defaultEvolutionDataRoot = path.resolve(
  process.env.PULSE_EVOLUTION_DATA_ROOT
  || path.join(defaultRuntimeDataRoot, 'evolution')
);

function assertNotWorkspaceDataRoot(label, targetPath) {
  const resolved = path.resolve(String(targetPath || ''));
  const forbiddenRoot = path.resolve(repoRoot, 'data');
  if (resolved === forbiddenRoot || resolved.startsWith(`${forbiddenRoot}${path.sep}`)) {
    throw new Error(`${label} points to ${resolved}. Writes to workspace data are disabled; use federated storage via PULSE_OPERATIONAL_DATA_ROOT/PULSE_RUNTIME_DATA_ROOT/PULSE_QUEUE_DATA_ROOT/PULSE_EVOLUTION_DATA_ROOT.`);
  }
}

assertNotWorkspaceDataRoot('defaultEvolutionDataRoot', defaultEvolutionDataRoot);

function parseArgs(argv) {
  const args = {
    pcode: path.resolve(repoRoot, 'pcode', 'mt103-to-pacs.service.pcode'),
    programMap: path.resolve(repoRoot, 'pcode', 'mt103-to-pacs.service.program.json'),
    fitnessOut: path.resolve(defaultEvolutionDataRoot, 'evolution-fitness.jsonl'),
    selectorOut: path.resolve(defaultEvolutionDataRoot, 'evolution-selector.json'),
    manifest: '',
    organismPrefix: 'organism',
    generation: 0,
    transactions: 10000,
    cycles: 1,
    concurrency: 1
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--pcode') args.pcode = argv[i + 1];
    if (token === '--program-map') args.programMap = argv[i + 1];
    if (token === '--fitness-out') args.fitnessOut = argv[i + 1];
    if (token === '--selector-out') args.selectorOut = argv[i + 1];
    if (token === '--manifest') args.manifest = argv[i + 1];
    if (token === '--organism-prefix') args.organismPrefix = argv[i + 1];
    if (token === '--generation') args.generation = Number.parseInt(argv[i + 1], 10);
    if (token === '--transactions') args.transactions = Number.parseInt(argv[i + 1], 10);
    if (token === '--runs') args.transactions = Number.parseInt(argv[i + 1], 10);
    if (token === '--cycles') args.cycles = Number.parseInt(argv[i + 1], 10);
    if (token === '--concurrency') args.concurrency = Number.parseInt(argv[i + 1], 10);
  }

  return args;
}

function buildDefaultInputs() {
  return [
    {
      variant: 'normal',
      message: [
        'MT103',
        ':20:EVO-ORG-001',
        ':32A:260514USD1000,',
        ':50K:ALPHA CORP',
        ':57A:BANKUS33',
        ':59:/000123456',
        'BETA LLC'
      ].join('\n')
    },
    {
      variant: 'stress',
      message: [
        'MT103',
        ':20:EVO-ORG-002',
        ':32A:260514USD999999,',
        ':50K:ALPHA CORP',
        ':57A:BANKUS33',
        ':59:/000123456',
        'BETA LLC'
      ].join('\n')
    },
    {
      variant: 'hostile',
      message: [
        'MT103',
        ':20:EVO-ORG-003',
        ':32A:BADVALUE',
        ':50K:###',
        ':57A:???',
        ':59:/000123456',
        '???'
      ].join('\n')
    }
  ];
}

function buildDefaultMessage(variant, index) {
  const baseId = `EVO-ORG-${String(index + 1).padStart(3, '0')}`;
  if (variant === 'stress') {
    return [
      'MT103',
      `:20:${baseId}`,
      ':32A:260514USD999999,',
      ':50K:ALPHA CORP',
      ':57A:BANKUS33',
      ':59:/000123456',
      'BETA LLC'
    ].join('\n');
  }
  if (variant === 'hostile') {
    return [
      'MT103',
      `:20:${baseId}`,
      ':32A:BADVALUE',
      ':50K:###',
      ':57A:???',
      ':59:/000123456',
      '???'
    ].join('\n');
  }
  return [
    'MT103',
    `:20:${baseId}`,
    ':32A:260514USD1000,',
    ':50K:ALPHA CORP',
    ':57A:BANKUS33',
    ':59:/000123456',
    'BETA LLC'
  ].join('\n');
}

async function loadManifestInputs(manifestPath) {
  if (!manifestPath) return buildDefaultInputs();

  const resolvedManifest = path.resolve(manifestPath);
  const raw = await fs.readFile(resolvedManifest, 'utf8');
  const doc = JSON.parse(raw);
  const entries = Array.isArray(doc) ? doc : Array.isArray(doc?.organisms) ? doc.organisms : [];

  return entries.map((entry, index) => {
    const variant = String(entry?.variant || entry?.kind || 'normal').trim().toLowerCase();
    const organismId = String(entry?.organismId || entry?.id || `organism-${String(index + 1).padStart(2, '0')}`).trim();
    const parentId = String(entry?.parentId || '').trim() || null;
    const message = String(entry?.message || '').trim() || buildDefaultMessage(variant, index);
    return {
      variant,
      organismId,
      parentId,
      generation: Number.parseInt(entry?.generation || '0', 10) || 0,
      message,
      genome: entry?.genome || {},
      morphology: entry?.morphology || {}
    };
  });
}

async function runVariant({ pcode, programMap, fitnessOut, organismId, parentId, generation, message, variant }) {
  const parsed = await runSingleMessageForEvolution({
    pcode,
    programMap,
    inputQueue: 'swift.mt103.parsed',
    message,
    organismId,
    generation: String(generation),
    fitnessOut
  });
  const fitness = parsed.fitness || null;
  return {
    variant,
    organismId,
    parentId: parentId || null,
    generation,
    outputQueue: parsed.deliveries?.[0]?.queueName || parsed.deliveries?.[0]?.outputQueue || null,
    messageFormat: parsed.deliveries?.[0]?.messageFormat || 'unknown',
    fitness
  };
}

function rankByFitness(records, offeredOrderByOrganism = new Map()) {
  return [...records].sort((left, right) => {
    const leftSuccess = Number.isFinite(Number(left.fitness?.successRate))
      ? Number(left.fitness?.successRate)
      : Number(left.fitness?.successCount || 0);
    const rightSuccess = Number.isFinite(Number(right.fitness?.successRate))
      ? Number(right.fitness?.successRate)
      : Number(right.fitness?.successCount || 0);
    if (rightSuccess !== leftSuccess) return rightSuccess - leftSuccess;
    const leftLatency = Number(left.fitness?.latencyMs || Number.POSITIVE_INFINITY);
    const rightLatency = Number(right.fitness?.latencyMs || Number.POSITIVE_INFINITY);
    if (leftLatency !== rightLatency) return leftLatency - rightLatency;
    const scoreDelta = Number(right.fitness?.score || 0) - Number(left.fitness?.score || 0);
    if (scoreDelta !== 0) return scoreDelta;
    const leftOfferOrder = Number(offeredOrderByOrganism.get(String(left.organismId || '')));
    const rightOfferOrder = Number(offeredOrderByOrganism.get(String(right.organismId || '')));
    if (Number.isFinite(leftOfferOrder) && Number.isFinite(rightOfferOrder) && leftOfferOrder !== rightOfferOrder) {
      return leftOfferOrder - rightOfferOrder;
    }
    return String(left.organismId || '').localeCompare(String(right.organismId || ''));
  });
}

function clampNumber(value, minValue, maxValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minValue;
  return Math.max(minValue, Math.min(maxValue, Math.trunc(numeric)));
}

function cycleFromHint(current, hint = {}, fallbackChoices = [], fallbackIndex = 0) {
  const list = Array.isArray(hint?.choices) && hint.choices.length > 0 ? hint.choices : fallbackChoices;
  if (!Array.isArray(list) || list.length === 0) return current;

  const index = list.indexOf(current);
  if (index < 0) return list[Math.max(0, Math.min(fallbackIndex, list.length - 1))];

  const mode = String(hint?.mode || 'cycle').trim().toLowerCase();
  if (mode === 'hold') return current;
  if (mode === 'reverse') return list[(index - 1 + list.length) % list.length];
  return list[(index + 1) % list.length];
}

function mutateGenome(genome = {}, rankIndex = 0) {
  const retryHint = genome?.mutationHints?.retryPolicy || {};
  const placementHint = genome?.mutationHints?.placementStrategy || {};
  const retryPolicyBase = clampNumber(genome.retryPolicy ?? retryHint.default ?? 3, 1, 7);
  const retryMode = String(retryHint.mode || 'step').trim().toLowerCase();
  const retryStep = clampNumber(retryHint.step ?? 1, 1, 7);
  let retryPolicy = retryPolicyBase;

  if (retryMode === 'hold') {
    retryPolicy = retryPolicyBase;
  } else if (retryMode === 'range') {
    const minValue = clampNumber(retryHint.min ?? 1, 1, 7);
    const maxValue = clampNumber(retryHint.max ?? 7, minValue, 7);
    retryPolicy = clampNumber(minValue + rankIndex, minValue, maxValue);
  } else if (retryMode === 'choices') {
    const choices = Array.isArray(retryHint.choices) && retryHint.choices.length > 0 ? retryHint.choices : [retryPolicyBase];
    retryPolicy = clampNumber(choices[Math.max(0, Math.min(rankIndex, choices.length - 1))], 1, 7);
  } else {
    retryPolicy = clampNumber(retryPolicyBase + (rankIndex % 2 === 0 ? retryStep : -retryStep), 1, 7);
  }

  const placementStrategy = cycleFromHint(
    genome.placementStrategy || placementHint.default || 'cluster.lowLatency',
    placementHint,
    ['cluster.lowLatency', 'cluster.highReliability', 'cluster.random'],
    rankIndex
  );

  return {
    ...genome,
    retryPolicy,
    placementStrategy
  };
}

function mutateMorphology(morphology = {}, rankIndex = 0) {
  const aggregatorHint = morphology?.mutationHints?.aggregatorMode || {};
  const brokerHint = morphology?.mutationHints?.brokerMode || {};
  const aggregatorMode = cycleFromHint(
    morphology.aggregatorMode || aggregatorHint.default || 'central',
    aggregatorHint,
    ['central', 'distributed', 'none'],
    rankIndex
  );
  const brokerMode = cycleFromHint(
    morphology.brokerMode || brokerHint.default || 'central',
    brokerHint,
    ['central', 'p2p', 'gossip', 'none'],
    rankIndex + 1
  );

  return {
    ...morphology,
    aggregatorMode,
    brokerMode
  };
}

function buildNextGenerationManifest({ manifestEntries, rankedSelector, nextGeneration }) {
  const rankedById = new Map(rankedSelector.map((entry) => [String(entry.organismId || ''), entry]));
  const nextOrganisms = [];

  manifestEntries.forEach((entry, index) => {
    const organismId = String(entry?.organismId || `organism-${String(index + 1).padStart(2, '0')}`).trim();
    const ranked = rankedById.get(organismId) || null;
    const rankIndex = Math.max(0, (ranked?.rank || 1) - 1);
    const childId = `${organismId}-g${nextGeneration}`;

    nextOrganisms.push({
      organismId: childId,
      parentId: organismId,
      variant: String(entry?.variant || ranked?.variant || 'normal'),
      generation: nextGeneration,
      genome: mutateGenome(entry?.genome || {}, rankIndex),
      morphology: mutateMorphology(entry?.morphology || {}, rankIndex)
    });
  });

  return { organisms: nextOrganisms };
}

function generationStampedPath(filePath, generation) {
  const resolved = path.resolve(filePath);
  const parsed = path.parse(resolved);
  return path.join(parsed.dir, `${parsed.name}-g${generation}${parsed.ext}`);
}

function deriveNextManifestPath(currentManifestPath, generation) {
  return path.resolve(path.dirname(currentManifestPath), `evolution-generation-${generation}.json`);
}

async function runGenerationCycle({ args, manifestPath, generation, outputRoot, baselineSelectorMap = new Map(), queueStartOffset = null }) {
  const fitnessOutPath = generationStampedPath(path.join(outputRoot, 'evolution-fitness.jsonl'), generation);
  const selectorOutPath = generationStampedPath(path.join(outputRoot, 'evolution-selector.json'), generation);
  const nextManifestPath = deriveNextManifestPath(manifestPath, generation + 1);

  await fs.mkdir(path.dirname(fitnessOutPath), { recursive: true });
  await fs.mkdir(path.dirname(selectorOutPath), { recursive: true });
  await fs.mkdir(path.dirname(nextManifestPath), { recursive: true });
  await fs.writeFile(fitnessOutPath, '', 'utf8');

  const inputs = await loadManifestInputs(manifestPath);
  const totalTransactions = Math.max(1, Number.parseInt(args.transactions || '10000', 10) || 10000);
  const workItems = [];
  for (let transactionIndex = 0; transactionIndex < totalTransactions; transactionIndex += 1) {
    const index = Math.floor(Math.random() * inputs.length);
    const item = inputs[index];
    workItems.push({
      index,
      transactionIndex,
      item,
      organismId: item.organismId || `${args.organismPrefix}-${String(index + 1).padStart(2, '0')}`
    });
  }

  const offeredOrderByOrganism = new Map();
  for (let order = 0; order < workItems.length; order += 1) {
    offeredOrderByOrganism.set(String(workItems[order].organismId || ''), order);
  }

  const results = [];
  const concurrency = Math.max(1, Math.min(totalTransactions, Number.parseInt(args.concurrency || '1', 10) || 1));
  let cursor = 0;

  async function worker() {
    while (true) {
      const nextIndex = cursor;
      cursor += 1;
      if (nextIndex >= workItems.length) return;

      const task = workItems[nextIndex];
      const result = await runVariant({
        pcode: path.resolve(args.pcode),
        programMap: path.resolve(args.programMap),
        fitnessOut: fitnessOutPath,
        organismId: task.organismId,
        parentId: task.item.parentId,
        generation,
        message: task.item.message,
        variant: task.item.variant
      });
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const aggregates = new Map();
  for (const result of results) {
    const key = String(result.organismId || '');
    if (!aggregates.has(key)) {
      aggregates.set(key, {
        organismId: result.organismId,
        parentId: result.parentId || null,
        generation: result.generation,
        variant: result.variant,
        outputQueue: result.outputQueue,
        messageFormat: result.messageFormat,
        transactionCount: 0,
        successCount: 0,
        failureCount: 0,
        retryCountTotal: 0,
        deliveryCountTotal: 0,
        latencyTotalMs: 0,
        scoreTotal: 0
      });
    }

    const bucket = aggregates.get(key);
    bucket.transactionCount += 1;
    bucket.successCount += Number(result.fitness?.successCount || 0);
    bucket.failureCount += Number(result.fitness?.failureCount || 0);
    bucket.retryCountTotal += Number(result.fitness?.retryCount || 0);
    bucket.deliveryCountTotal += Number(result.fitness?.deliveryCount || 0);
    bucket.latencyTotalMs += Number(result.fitness?.latencyMs || 0);
    bucket.scoreTotal += Number(result.fitness?.score || 0);
  }

  const aggregatedResults = Array.from(aggregates.values()).map((entry) => {
    const transactionCount = Math.max(1, Number(entry.transactionCount || 0));
    const successRate = Number((Number(entry.successCount || 0) / transactionCount).toFixed(6));
    const latencyMs = Number((Number(entry.latencyTotalMs || 0) / transactionCount).toFixed(3));
    const score = Number((Number(entry.scoreTotal || 0) / transactionCount).toFixed(3));
    const retryCount = Number((Number(entry.retryCountTotal || 0) / transactionCount).toFixed(3));
    const deliveryCount = Number((Number(entry.deliveryCountTotal || 0) / transactionCount).toFixed(3));

    return {
      organismId: entry.organismId,
      parentId: entry.parentId,
      generation: entry.generation,
      variant: entry.variant,
      outputQueue: entry.outputQueue,
      messageFormat: entry.messageFormat,
      fitness: {
        transactionCount,
        successCount: Number(entry.successCount || 0),
        failureCount: Number(entry.failureCount || 0),
        successRate,
        retryCount,
        deliveryCount,
        latencyMs,
        score
      }
    };
  });

  const ranked = rankByFitness(aggregatedResults, offeredOrderByOrganism);
  const selector = ranked.map((entry, index) => ({
    rank: index + 1,
    organismId: entry.organismId,
    variant: entry.variant,
    generation: entry.generation,
    transactionCount: entry.fitness?.transactionCount || 0,
    successCount: entry.fitness?.successCount || 0,
    successRate: entry.fitness?.successRate || 0,
    latencyMs: entry.fitness?.latencyMs || 0,
    score: entry.fitness?.score || 0,
    outputQueue: entry.outputQueue,
    offeredOrder: offeredOrderByOrganism.get(String(entry.organismId || '')) ?? null,
    messageFormat: entry.messageFormat
  }));

  await fs.writeFile(selectorOutPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    generation,
    selector,
    records: aggregatedResults
  }, null, 2), 'utf8');

  const comparison = buildComparisonSummary(aggregatedResults, selector, generation, baselineSelectorMap);

  const nextGenerationManifest = buildNextGenerationManifest({
    manifestEntries: inputs,
    rankedSelector: selector,
    nextGeneration: generation + 1
  });
  await fs.writeFile(nextManifestPath, JSON.stringify(nextGenerationManifest, null, 2), 'utf8');

  return {
    generation,
    transactionCount: totalTransactions,
    fitnessOut: fitnessOutPath,
    selectorOut: selectorOutPath,
    nextManifestOut: nextManifestPath,
    comparison,
    selector,
    records: aggregatedResults,
    transactions: results
  };
}

function compareFitness(a, b) {
  const aFitness = a?.fitness || {};
  const bFitness = b?.fitness || {};
  return {
    successDelta: Number.isFinite(Number(aFitness.successRate)) && Number.isFinite(Number(bFitness.successRate))
      ? Number(aFitness.successRate) - Number(bFitness.successRate)
      : Number(aFitness.successCount || 0) - Number(bFitness.successCount || 0),
    latencyDeltaMs: Number(aFitness.latencyMs || 0) - Number(bFitness.latencyMs || 0),
    scoreDelta: Number(aFitness.score || 0) - Number(bFitness.score || 0),
    deliveryDelta: Number(aFitness.deliveryCount || 0) - Number(bFitness.deliveryCount || 0)
  };
}

function buildComparisonSummary(results, selector, generation, baselineSelectorMap = new Map()) {
  const ordered = [...selector];
  const pairwise = ordered.length >= 2
    ? {
        left: ordered[0].organismId,
        right: ordered[1].organismId,
        leftVsRight: compareFitness(results.find((entry) => entry.organismId === ordered[0].organismId), results.find((entry) => entry.organismId === ordered[1].organismId)),
        rightVsLeft: compareFitness(results.find((entry) => entry.organismId === ordered[1].organismId), results.find((entry) => entry.organismId === ordered[0].organismId))
      }
    : null;

  const againstInitial = generation > 0
    ? results.map((entry) => ({
        organismId: entry.organismId,
        parentId: entry.parentId || null,
        comparisonToParent: entry.parentId
          ? compareFitness(entry, baselineSelectorMap.get(entry.parentId) || null)
          : null
      }))
    : results.map((entry) => ({
        organismId: entry.organismId,
        comparisonToSelf: compareFitness(entry, entry)
      }));

  return {
    generation,
    pairwise,
    againstInitial
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = defaultEvolutionDataRoot;
  assertNotWorkspaceDataRoot('outputRoot', outputRoot);
  let manifestPath = args.manifest ? path.resolve(args.manifest) : '';
  const generationStart = Number(args.generation || 0);
  const cycles = Math.max(1, Number.parseInt(args.cycles || '1', 10) || 1);
  const reports = [];
  let previousSelectorMap = new Map();

  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex += 1) {
    const generation = generationStart + cycleIndex;
    const cycleNumber = cycleIndex + 1;
    console.log(`[evolution-first-slice] cycle ${cycleNumber}/${cycles} generation ${generation} starting`);
    const report = await runGenerationCycle({
      args,
      manifestPath,
      generation,
      outputRoot,
      baselineSelectorMap: previousSelectorMap
    });
    reports.push(report);
    previousSelectorMap = new Map(report.selector.map((entry) => [entry.organismId, entry]));
    manifestPath = report.nextManifestOut;
    console.log(`[evolution-first-slice] cycle ${cycleNumber}/${cycles} generation ${generation} complete`);
  }

  console.log(JSON.stringify({
    status: 'ok',
    cycles,
    reports
  }, null, 2));
}

main().catch((err) => {
  console.error('[evolution-first-slice] failed:', err.message);
  process.exitCode = 1;
});
