import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSingleMessageForEsp32Evolution } from './run-esp32-evolution.mjs';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const aggregatorRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(aggregatorRoot, '..');

function parseArgs(argv) {
  const args = {
    pcode: path.resolve(repoRoot, 'pcode', 'mt103-to-pacs.service.pcode'),
    programMap: path.resolve(repoRoot, 'pcode', 'mt103-to-pacs.service.program.json'),
    fitnessOut: path.resolve(repoRoot, 'data', 'evolution-fitness.jsonl'),
    selectorOut: path.resolve(repoRoot, 'data', 'evolution-selector.json'),
    manifest: '',
    organismPrefix: 'organism',
    generation: 0,
    transactions: 10000,
    cycles: 1,
    concurrency: 1,
    replacementInterval: 100,
    maxPopulation: 200,
    birthLimit: 25,
    deathLimit: 100,
    organismIdleTtlMs: 60000,
    executionTarget: 'js',
    backendUrl: 'http://127.0.0.1:4000'
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
    if (token === '--replacement-interval') args.replacementInterval = Number.parseInt(argv[i + 1], 10);
    if (token === '--max-population') args.maxPopulation = Number.parseInt(argv[i + 1], 10);
    if (token === '--birth-limit') args.birthLimit = Number.parseInt(argv[i + 1], 10);
    if (token === '--death-limit') args.deathLimit = Number.parseInt(argv[i + 1], 10);
    if (token === '--organism-idle-ttl-ms') args.organismIdleTtlMs = Number.parseInt(argv[i + 1], 10);
    if (token === '--execution-target') args.executionTarget = String(argv[i + 1] || 'js');
    if (token === '--backend-url') args.backendUrl = argv[i + 1];
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

async function runVariant({ pcode, programMap, fitnessOut, organismId, parentId, generation, message, variant, executionTarget, backendUrl }) {
  const runner = String(executionTarget || 'js').trim().toLowerCase() === 'esp32'
    ? runSingleMessageForEsp32Evolution
    : runSingleMessageForEvolution;

  const parsed = await runner({
    pcode,
    programMap,
    inputQueue: 'swift.mt103.parsed',
    message,
    organismId,
    generation: String(generation),
    fitnessOut,
    backendUrl,
    serviceId: 'evolution-first-slice',
    actorUserId: 'system-admin'
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

function normalizeEvolutionRootId(organismId) {
  const match = String(organismId || '').match(/^(organism-\d+)/i);
  return match ? String(match[1]).toLowerCase() : String(organismId || '').trim().toLowerCase();
}

function buildPopulationSummary(results, offeredOrderByOrganism = new Map()) {
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

  const selector = rankByFitness(aggregatedResults, offeredOrderByOrganism).map((entry, index) => ({
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

  return { aggregatedResults, selector };
}

function buildPopulationSummaryWithFilter(results, offeredOrderByOrganism = new Map(), activeOrganismIds = null) {
  const base = buildPopulationSummary(results, offeredOrderByOrganism);
  if (!(activeOrganismIds instanceof Set) || activeOrganismIds.size === 0) {
    return base;
  }

  const activeAggregates = base.aggregatedResults.filter((entry) => activeOrganismIds.has(String(entry.organismId || '')));
  const selector = rankByFitness(activeAggregates, offeredOrderByOrganism).map((entry, index) => ({
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

  return {
    aggregatedResults: base.aggregatedResults,
    selector
  };
}

function buildReplacementOrganism({ sourceEntry, targetEntry, generation, replacementIndex, transactionCount }) {
  const sourceRoot = normalizeEvolutionRootId(sourceEntry?.organismId || 'organism');
  const replacementSuffix = `r${String(replacementIndex + 1).padStart(2, '0')}`;
  const replacementOrganismId = `${sourceRoot}-${replacementSuffix}-g${generation}`;

  return {
    organismId: replacementOrganismId,
    parentId: String(sourceEntry?.organismId || '').trim() || null,
    variant: String(sourceEntry?.variant || targetEntry?.variant || 'normal'),
    generation,
    message: String(sourceEntry?.message || targetEntry?.message || '').trim(),
    genome: mutateGenome(sourceEntry?.genome || {}, replacementIndex),
    morphology: mutateMorphology(sourceEntry?.morphology || {}, replacementIndex),
    replacementFrom: String(sourceEntry?.organismId || '').trim() || null,
    replacementOf: String(targetEntry?.organismId || '').trim() || null,
    replacementAtTransaction: transactionCount
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
      message: String(entry?.message || '').trim(),
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

function isLikelyProcessableMt103Message(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (!/^MT103\b/i.test(text)) return false;

  const requiredTags = [':20:', ':32A:', ':50K:', ':57A:', ':59:'];
  for (const tag of requiredTags) {
    if (!text.includes(tag)) return false;
  }

  const field32A = text.match(/:32A:([^\n\r]+)/i)?.[1] || '';
  if (!/^\d{6}[A-Z]{3}.+/.test(String(field32A).trim())) {
    return false;
  }

  return true;
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
  const maxPopulation = Math.max(1, Math.min(2000, Number.parseInt(args.maxPopulation || '200', 10) || 200));
  const birthLimit = Math.max(1, Number.parseInt(args.birthLimit || '25', 10) || 25);
  const deathLimit = Math.max(1, Number.parseInt(args.deathLimit || '100', 10) || 100);
  const organismIdleTtlMs = Math.max(1000, Number.parseInt(args.organismIdleTtlMs || '60000', 10) || 60000);
  const runStartedAtMs = Date.now();
  const offeredOrderByOrganism = new Map();
  const slots = Array.from({ length: maxPopulation }, () => null);
  const organismById = new Map();
  const activeOrganismIds = [];
  const activeIndexByOrganismId = new Map();

  function addActiveOrganismId(organismId) {
    const id = String(organismId || '').trim();
    if (!id || activeIndexByOrganismId.has(id)) return;
    activeIndexByOrganismId.set(id, activeOrganismIds.length);
    activeOrganismIds.push(id);
  }

  function removeActiveOrganismId(organismId) {
    const id = String(organismId || '').trim();
    const index = activeIndexByOrganismId.get(id);
    if (!Number.isInteger(index)) return;
    const lastIndex = activeOrganismIds.length - 1;
    const lastId = activeOrganismIds[lastIndex];
    activeOrganismIds[index] = lastId;
    activeIndexByOrganismId.set(lastId, index);
    activeOrganismIds.pop();
    activeIndexByOrganismId.delete(id);
  }

  function findNextAvailableSlot(startIndex = 0) {
    if (!slots.length) return -1;
    const start = Math.max(0, Math.min(slots.length - 1, Number(startIndex) || 0));
    for (let step = 0; step < slots.length; step += 1) {
      const index = (start + step) % slots.length;
      if (slots[index] == null) return index;
    }
    return -1;
  }

  function canCountAsProcessable(result, sourceMessage) {
    const structurallyValid = isLikelyProcessableMt103Message(sourceMessage);
    if (!structurallyValid) return false;
    const successCount = Number(result?.fitness?.successCount || 0);
    const deliveryCount = Number(result?.fitness?.deliveryCount || 0);
    const successRate = Number(result?.fitness?.successRate || 0);
    return successCount > 0 || deliveryCount > 0 || successRate > 0;
  }

  function buildLiveOrganismState(entry, slotIndex, bornAtTransaction = 0, bornAtMs = runStartedAtMs) {
    const organismId = String(entry?.organismId || `${args.organismPrefix}-${String(slotIndex + 1).padStart(2, '0')}`).trim();
    return {
      ...entry,
      organismId,
      slotIndex,
      alive: true,
      bornAtTransaction,
      bornAtMs,
      diedAtTransaction: null,
      replacedAtTransaction: null,
      totalProcessed: 0,
      birthCounter: 0,
      deathCounter: 0,
      reproductionCount: 0,
      lastProcessedAtMs: bornAtMs
    };
  }

  function markOrganismDead(organism, transactionCount, reason, nowMs = Date.now()) {
    if (!organism || !organism.alive) return false;
    organism.alive = false;
    organism.diedAtTransaction = transactionCount;
    organism.diedAtMs = nowMs;
    slots[organism.slotIndex] = null;
    removeActiveOrganismId(organism.organismId);
    deathEvents.push({
      transactionCount,
      organismId: organism.organismId,
      slotIndex: organism.slotIndex,
      totalProcessed: organism.totalProcessed,
      birthCounter: organism.birthCounter,
      deathCounter: organism.deathCounter,
      lastProcessedAtMs: organism.lastProcessedAtMs,
      idleForMs: Math.max(0, nowMs - Number(organism.lastProcessedAtMs || nowMs)),
      reason,
      populationSize: activeOrganismIds.length
    });
    return true;
  }

  function expireIdleOrganisms(transactionCount, nowMs = Date.now()) {
    const expired = [];
    for (const organismId of [...activeOrganismIds]) {
      const organism = organismById.get(String(organismId || ''));
      if (!organism || !organism.alive) continue;
      const lastProcessedAtMs = Number(organism.lastProcessedAtMs || organism.bornAtMs || runStartedAtMs);
      if (nowMs - lastProcessedAtMs >= organismIdleTtlMs) {
        if (markOrganismDead(organism, transactionCount, 'idle-ttl', nowMs)) {
          expired.push(organism.organismId);
        }
      }
    }
    return expired;
  }

  for (let index = 0; index < Math.min(inputs.length, maxPopulation); index += 1) {
    const entry = inputs[index];
    const organism = buildLiveOrganismState({
      ...entry,
      __sourceIndex: index,
      organismId: String(entry.organismId || `${args.organismPrefix}-${String(index + 1).padStart(2, '0')}`).trim()
    }, index, 0);
    slots[index] = organism;
    organismById.set(organism.organismId, organism);
    addActiveOrganismId(organism.organismId);
  }

  if (inputs.length > maxPopulation) {
    console.warn(`[evolution-first-slice] manifest has ${inputs.length} organisms, truncating initial population to maxPopulation=${maxPopulation}`);
  }

  const replacementInterval = Math.max(1, Number.parseInt(args.replacementInterval || '100', 10) || 100);
  const results = [];
  const concurrency = Math.max(1, Math.min(totalTransactions, Number.parseInt(args.concurrency || '1', 10) || 1));
  let processedTransactions = 0;
  let replacementCount = 0;
  const replacementEvents = [];
  const birthEvents = [];
  const deathEvents = [];
  const processingLog = [];

  async function runBatch(batchWorkItems) {
    const batchResults = [];
    let cursor = 0;

    async function worker() {
      while (true) {
        const nextIndex = cursor;
        cursor += 1;
        if (nextIndex >= batchWorkItems.length) return;

        const task = batchWorkItems[nextIndex];
        const result = await runVariant({
          pcode: path.resolve(args.pcode),
          programMap: path.resolve(args.programMap),
          fitnessOut: fitnessOutPath,
          organismId: task.organismId,
          parentId: task.item.parentId,
          generation,
          message: task.item.message,
          variant: task.item.variant,
          executionTarget: args.executionTarget,
          backendUrl: args.backendUrl
        });
        batchResults.push({
          ...result,
          slotIndex: task.slotIndex,
          sourceIndex: task.sourceIndex,
          transactionIndex: task.transactionIndex
        });
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return batchResults;
  }

  while (processedTransactions < totalTransactions) {
    expireIdleOrganisms(processedTransactions, Date.now());

    if (activeOrganismIds.length <= 0) {
      console.warn(`[evolution-first-slice] generation ${generation} ended early: no live organisms available at tx ${processedTransactions}`);
      break;
    }

    const batchSize = Math.min(replacementInterval, totalTransactions - processedTransactions);
    const batchWorkItems = [];
    for (let offset = 0; offset < batchSize; offset += 1) {
      const transactionIndex = processedTransactions + offset;
      const activeIndex = Math.floor(Math.random() * activeOrganismIds.length);
      const organismId = String(activeOrganismIds[activeIndex] || '').trim();
      const item = organismById.get(organismId);
      if (!item || !item.alive) {
        continue;
      }
      batchWorkItems.push({
        index: item.slotIndex,
        sourceIndex: item.slotIndex,
        slotIndex: item.slotIndex,
        transactionIndex,
        item,
        organismId
      });
      if (!offeredOrderByOrganism.has(organismId)) {
        offeredOrderByOrganism.set(organismId, transactionIndex);
      }
    }

    const batchResults = await runBatch(batchWorkItems);
    batchResults.sort((left, right) => Number(left.transactionIndex || 0) - Number(right.transactionIndex || 0));
    for (const result of batchResults) {
      const organismId = String(result.organismId || '').trim();
      const organism = organismById.get(organismId);
      if (!organism || !organism.alive) {
        continue;
      }

      results.push(result);
      processedTransactions += 1;
      const nowMs = Date.now();
      organism.lastProcessedAtMs = nowMs;

      const processable = canCountAsProcessable(result, organism.message);
      organism.totalProcessed += 1;
      organism.deathCounter += 1;
      if (processable) {
        organism.birthCounter += 1;
      }

      const spawnedChildren = [];
      while (organism.alive && organism.birthCounter >= birthLimit) {
        const nextSlot = findNextAvailableSlot(organism.slotIndex + 1);
        if (nextSlot < 0) break;
        organism.birthCounter -= birthLimit;
        organism.reproductionCount += 1;
        const birthIndex = birthEvents.length + 1;
        const childId = `${normalizeEvolutionRootId(organism.organismId)}-b${String(birthIndex).padStart(4, '0')}-g${generation}`;
        const child = buildLiveOrganismState({
          organismId: childId,
          parentId: organism.organismId,
          variant: organism.variant,
          generation,
          message: String(organism.message || '').trim(),
          genome: mutateGenome(organism.genome || {}, organism.reproductionCount),
          morphology: mutateMorphology(organism.morphology || {}, organism.reproductionCount)
        }, nextSlot, processedTransactions, nowMs);
        slots[nextSlot] = child;
        organismById.set(child.organismId, child);
        addActiveOrganismId(child.organismId);
        spawnedChildren.push(child.organismId);
        birthEvents.push({
          transactionCount: processedTransactions,
          parentOrganismId: organism.organismId,
          childOrganismId: child.organismId,
          parentSlot: organism.slotIndex,
          childSlot: nextSlot,
          parentBirthCounter: organism.birthCounter,
          populationSize: activeOrganismIds.length
        });
      }

      let died = false;
      if (organism.alive && organism.deathCounter >= deathLimit) {
        died = markOrganismDead(organism, processedTransactions, 'death-limit', nowMs);
      }

      processingLog.push({
        transactionCount: processedTransactions,
        organismId: organism.organismId,
        slotIndex: organism.slotIndex,
        processable,
        birthCounter: organism.birthCounter,
        deathCounter: organism.deathCounter,
        spawnedChildren,
        died
      });

      if (replacementInterval > 0 && processedTransactions < totalTransactions && processedTransactions % replacementInterval === 0) {
        const { selector: liveSelector } = buildPopulationSummaryWithFilter(
          results,
          offeredOrderByOrganism,
          new Set(activeOrganismIds)
        );
        if (liveSelector.length >= 2) {
          const strongest = liveSelector[0];
          const weakest = liveSelector[liveSelector.length - 1];
          const sourceEntry = organismById.get(String(strongest.organismId || ''));
          const targetEntry = organismById.get(String(weakest.organismId || ''));

          if (sourceEntry && targetEntry && sourceEntry.alive && targetEntry.alive && String(sourceEntry.organismId || '') !== String(targetEntry.organismId || '')) {
            const replacement = buildReplacementOrganism({
              sourceEntry,
              targetEntry,
              generation,
              replacementIndex: replacementCount,
              transactionCount: processedTransactions
            });
            const replacementState = buildLiveOrganismState(replacement, targetEntry.slotIndex, processedTransactions);
            slots[targetEntry.slotIndex] = replacementState;
            targetEntry.alive = false;
            targetEntry.replacedAtTransaction = processedTransactions;
            removeActiveOrganismId(targetEntry.organismId);
            organismById.set(replacementState.organismId, replacementState);
            addActiveOrganismId(replacementState.organismId);
            replacementEvents.push({
              transactionCount: processedTransactions,
              weakestOrganismId: String(targetEntry.organismId || ''),
              strongestOrganismId: String(sourceEntry.organismId || ''),
              replacementOrganismId: String(replacementState.organismId || ''),
              sourceIndex: sourceEntry.slotIndex,
              targetIndex: targetEntry.slotIndex,
              sourceVariant: sourceEntry.variant,
              targetVariant: targetEntry.variant,
              strongestScore: Number(strongest.score || 0),
              weakestScore: Number(weakest.score || 0)
            });
            replacementCount += 1;
            console.log(`[evolution-first-slice] generation ${generation} tx ${processedTransactions}: replaced weakest ${targetEntry.organismId} with clone of ${sourceEntry.organismId} -> ${replacementState.organismId}`);
          }
        }
      }
    }

  }

  const { aggregatedResults, selector } = buildPopulationSummaryWithFilter(results, offeredOrderByOrganism, new Set(activeOrganismIds));

  await fs.writeFile(selectorOutPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    generation,
    maxPopulation,
    birthLimit,
    deathLimit,
    organismIdleTtlMs,
    replacementInterval,
    replacementCount,
    replacements: replacementEvents,
    births: birthEvents,
    deaths: deathEvents,
    processingLog,
    activePopulationSize: activeOrganismIds.length,
    selector,
    records: aggregatedResults
  }, null, 2), 'utf8');

  const comparison = buildComparisonSummary(aggregatedResults, selector, generation, baselineSelectorMap);

  const nextGenerationManifest = buildNextGenerationManifest({
    manifestEntries: slots.filter((entry) => entry && entry.alive).map((entry) => ({
      organismId: entry.organismId,
      parentId: entry.parentId || null,
      variant: entry.variant,
      generation: entry.generation,
      message: String(entry.message || '').trim(),
      genome: entry.genome || {},
      morphology: entry.morphology || {}
    })),
    rankedSelector: selector,
    nextGeneration: generation + 1
  });
  await fs.writeFile(nextManifestPath, JSON.stringify(nextGenerationManifest, null, 2), 'utf8');

  return {
    generation,
    transactionCount: totalTransactions,
    maxPopulation,
    birthLimit,
    deathLimit,
    organismIdleTtlMs,
    replacementInterval,
    replacementCount,
    replacements: replacementEvents,
    births: birthEvents,
    deaths: deathEvents,
    processingLog,
    activePopulationSize: activeOrganismIds.length,
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
  const outputRoot = path.resolve(repoRoot, 'data');
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
