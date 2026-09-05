import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileRouterMapperDSL } from './compile-pascal.mjs';

const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
const CORPUS_PATH = path.resolve(process.cwd(), 'data', 'dsl-ollama-corpus.json');
const GOLDENS_PATH = path.resolve(process.cwd(), 'data', 'pascal-ollama-goldens.json');

const COACH_MODES = {
  PASCAL_PROGRAM: 'pascal-program',
  PASCALISH_SERVICE: 'pascalish-service'
};

const DEFAULT_COACH_MODE = process.env.OLLAMA_COACH_MODE || COACH_MODES.PASCALISH_SERVICE;

export function normalizePascalPrompt(text) {
  return String(text || '')
    .replace(/pascalprogram/gi, 'Pascal program')
    .replace(/pascalservice/gi, 'Pascal service')
    .replace(/pascaldaemon/gi, 'Pascal daemon')
    .replace(/\bp\s*-?machine\b/gi, 'pmachine')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectCoachMode(promptText) {
  if (DEFAULT_COACH_MODE === COACH_MODES.PASCAL_PROGRAM) {
    return COACH_MODES.PASCAL_PROGRAM;
  }
  const lower = normalizePascalPrompt(promptText).toLowerCase();
  if (/\bpascal\s+program\b|\bstandard\s+pascal\b/.test(lower) &&
      !/\bservice\b|\brouter\b|\bmapper\b|\bdaemon\b|\bpascalish\b/.test(lower)) {
    return COACH_MODES.PASCAL_PROGRAM;
  }
  return COACH_MODES.PASCALISH_SERVICE;
}

function parseArgs(argv) {
  const args = {
    prompt: '',
    model: process.env.OLLAMA_MODEL || 'phi3:latest',
    host: process.env.OLLAMA_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.OLLAMA_PORT || '11434', 10),
    topK: 2,
    maxContextChars: 2500,
    numPredict: 320,
    noRepair: false,
    mode: '',
    resultOut: '',
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
    if (token === '--host') {
      args.host = String(argv[i + 1] || args.host);
      i += 1;
      continue;
    }
    if (token === '--port') {
      args.port = Number.parseInt(String(argv[i + 1] || args.port), 10);
      i += 1;
      continue;
    }
    if (token === '--top-k') {
      args.topK = Math.max(1, Number.parseInt(String(argv[i + 1] || args.topK), 10) || 6);
      i += 1;
      continue;
    }
    if (token === '--max-context-chars') {
      args.maxContextChars = Math.max(1000, Number.parseInt(String(argv[i + 1] || args.maxContextChars), 10) || 9000);
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
    if (token === '--mode') {
      args.mode = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--result-out') {
      args.resultOut = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (token === '--out') {
      args.out = String(argv[i + 1] || '');
      i += 1;
    }
  }

  args.prompt = normalizePascalPrompt(args.prompt);

  if (!args.prompt.trim()) {
    throw new Error('Missing required --prompt argument');
  }

  if (!args.mode) {
    args.mode = detectCoachMode(args.prompt);
  }

  if (!Object.values(COACH_MODES).includes(args.mode)) {
    throw new Error(`Invalid --mode value: ${args.mode}`);
  }

  return args;
}

function tokenize(text) {
  return normalizePascalPrompt(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter(Boolean);
}

function isSimplePascalPrompt(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return true;
  const complexHints = new Set([
    'deploy', 'pmachine', 'service', 'daemon', 'procedure', 'function',
    'recursive', 'orchestration', 'workflow', 'queue', 'router', 'mapper'
  ]);
  const hasComplexHint = tokens.some((token) => complexHints.has(token));
  return tokens.length <= 18 && !hasComplexHint;
}

async function loadCorpus() {
  const raw = await fs.readFile(CORPUS_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.chunks) || parsed.chunks.length === 0) {
    throw new Error('Corpus is empty. Run: node scripts/build-dsl-ollama-corpus.mjs');
  }
  return parsed;
}

async function loadGoldens() {
  try {
    const raw = await fs.readFile(GOLDENS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.examples) ? parsed.examples : [];
  } catch {
    return [];
  }
}

function scoreChunk(queryTokens, chunk) {
  const tokenSet = new Set(chunk.tokens || []);
  let overlap = 0;
  for (const token of queryTokens) {
    if (tokenSet.has(token)) overlap += 1;
  }

  const density = overlap / Math.max(1, Math.sqrt(Number(chunk.tokenCount || 1)));
  return overlap * 2 + density;
}

function retrieveChunks(corpus, query, topK, maxContextChars) {
  const queryTokens = tokenize(query);
  const scored = corpus.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(topK * 3, topK));

  const picked = [];
  let totalChars = 0;
  for (const entry of scored) {
    const snippet = String(entry.chunk.text || '');
    if (!snippet.trim()) continue;
    if (picked.length >= topK) break;
    if (totalChars + snippet.length > maxContextChars) continue;
    picked.push(entry);
    totalChars += snippet.length;
  }

  return picked;
}

function retrieveGoldens(goldens, query, topK) {
  const queryTokens = tokenize(query);
  return goldens
    .map((example) => {
      const source = `${normalizePascalPrompt(example.prompt || '')} ${example.response || ''}`;
      const tokenSet = new Set(tokenize(source));
      let overlap = 0;
      for (const token of queryTokens) {
        if (tokenSet.has(token)) overlap += 1;
      }
      return { example, score: overlap };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));
}

function buildPrompt(userPrompt, picks, goldens, mode) {
  const normalizedPrompt = normalizePascalPrompt(userPrompt);
  const contextBlocks = picks.map((entry, index) => {
    const c = entry.chunk;
    const header = `Source ${index + 1}: ${c.path}:${c.lineStart}`;
    return `${header}\n${c.text}`;
  }).join('\n\n-----\n\n');

  const exampleBlocks = goldens.map((entry, index) => {
    const example = entry.example;
    return [
      `Example ${index + 1} Prompt: ${normalizePascalPrompt(example.prompt)}`,
      `Example ${index + 1} Response:\n${example.response}`
    ].join('\n');
  }).join('\n\n-----\n\n');

  const modeHeader = mode === COACH_MODES.PASCALISH_SERVICE
    ? [
      'You are a Pascalish authoring assistant for this repository.',
      'Use the provided Pascalish context and grammar as ground truth.',
      'Return only Pascalish source declarations (PROGRAM/SERVICE/ROUTER/MAPPER/DAEMON) with no markdown fences and no explanation.'
    ]
    : [
      'You are a standard Pascal program authoring assistant for this repository.',
      'Use the provided Pascal source context and Pascal ANTLR grammar as the only ground truth.',
      'Return only Pascal source code with no markdown fences and no explanation.'
    ];

  return [
    ...modeHeader,
    'Prefer the syntax and style shown in the corpus examples.',
    'The examples below are few-shot demonstrations that should be followed closely.',
    '',
    'Context:',
    contextBlocks,
    '',
    'Few-shot examples:',
    exampleBlocks,
    '',
    'Task:',
    normalizedPrompt
  ].join('\n');
}

async function persistCandidateSnapshot(outPath, responseText, mode) {
  if (!outPath) return;
  const candidate = sanitizeDslCandidate(responseText, mode);
  if (!candidate.trim()) return;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${candidate.trim()}\n`, 'utf-8');
}

function callOllama({ host, port, model, prompt, outPath, numPredict, mode }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      prompt,
      stream: true,
      options: {
        num_predict: Math.max(64, Number(numPredict || 320) || 320)
      }
    });

    const req = http.request({
      hostname: host,
      port,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 300000
    }, (res) => {
      let responseText = '';
      let buffer = '';

      const handleLine = async (line) => {
        const trimmed = String(line || '').trim();
        if (!trimmed) return;
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (parsed.error) {
          reject(new Error(parsed.error));
          req.destroy();
          return;
        }
        if (parsed.response) {
          responseText += String(parsed.response || '');
          try {
            await persistCandidateSnapshot(outPath, responseText, mode);
          } catch {
            // Best-effort snapshot persistence only.
          }
        }
      };

      res.on('data', async (chunk) => {
        buffer += String(chunk);
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          await handleLine(line);
        }
      });
      res.on('end', async () => {
        try {
          if (buffer.trim()) {
            await handleLine(buffer);
          }
          await persistCandidateSnapshot(outPath, responseText, mode);
          resolve(String(responseText || '').trim());
        } catch (error) {
          reject(new Error(`Ollama parse error: ${error.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timed out'));
    });

    req.on('error', (error) => {
      reject(new Error(`Ollama connection error: ${error.message}`));
    });

    req.write(body);
    req.end();
  });
}

function extractDslText(responseText) {
  const raw = String(responseText || '').trim();
  const fenceMatch = raw.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  if (fenceMatch) return String(fenceMatch[1] || '').trim();
  return raw;
}

function extractPascalWindow(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.length === 0) return '';

  const startPattern = /^\s*(program|unit|label|const|type|var|procedure|function|begin)\b/i;
  const endPattern = /^\s*end\.\s*$/i;
  let startIndex = lines.findIndex((line) => startPattern.test(String(line || '')));
  if (startIndex < 0) startIndex = 0;

  const picked = [];
  let sawProgramEnd = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    picked.push(line);
    if (endPattern.test(line)) {
      sawProgramEnd = true;
      continue;
    }
    if (sawProgramEnd && line.trim()) {
      picked.pop();
      break;
    }
  }

  return picked.join('\n').trim();
}

function extractPascalishServiceWindow(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.length === 0) return '';

  const startPattern = /^\s*(program|service|router|mapper|daemon)\b/i;
  const stopPattern = /^\s*(deployment\s*:|\d+\)|\$env:|set-location\b|npm\s+run\b)/i;
  let startIndex = lines.findIndex((line) => startPattern.test(String(line || '')));
  if (startIndex < 0) startIndex = 0;

  const picked = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    if (stopPattern.test(line)) break;
    picked.push(line);
  }

  return picked.join('\n').trim();
}

function sanitizeDslCandidate(responseText, mode) {
  const extracted = extractDslText(responseText);
  if (mode === COACH_MODES.PASCALISH_SERVICE) {
    const serviceWindow = extractPascalishServiceWindow(extracted);
    return serviceWindow || extracted;
  }
  const pascalWindow = extractPascalWindow(extracted);
  return pascalWindow || extracted;
}

function validateDslCandidate(candidateText, mode) {
  const candidate = String(candidateText || '').trim();
  if (!candidate) {
    return { valid: false, dialect: null, errors: ['empty candidate'] };
  }

  const candidates = [candidate, sanitizeDslCandidate(candidate, mode)]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);

  let firstError = null;
  for (const variant of candidates) {
    try {
      if (mode === COACH_MODES.PASCALISH_SERVICE) {
        const compiledService = compileRouterMapperDSL(variant);
        return {
          valid: true,
          dialect: COACH_MODES.PASCALISH_SERVICE,
          summary: {
            serviceId: compiledService?.serviceId || null,
            routers: Array.isArray(compiledService?.routerRules) ? compiledService.routerRules.length : 0,
            mappers: Array.isArray(compiledService?.dataMappings) ? compiledService.dataMappings.length : 0,
            runtimeKind: compiledService?.runtimeUnit?.kind || 'service'
          },
          errors: [],
          normalizedCandidate: variant
        };
      }

      const compiledProgram = compilePascalishProgramWithAntlr(variant);
      return {
        valid: true,
        dialect: COACH_MODES.PASCAL_PROGRAM,
        summary: {
          pcodeInstructions: Number.isFinite(Number(compiledProgram?.programMap?.length)) ? Number(compiledProgram.programMap.length) : null,
          pcodeLines: Number.isFinite(Number(compiledProgram?.pcodeText?.split('\n')?.length)) ? Number(compiledProgram.pcodeText.split('\n').length) : null
        },
        errors: [],
        normalizedCandidate: variant
      };
    } catch (error) {
      if (!firstError) firstError = error;
    }
  }

  return {
    valid: false,
    dialect: null,
    errors: [`${mode}: ${firstError ? firstError.message : 'unknown parse error'}`]
  };
}

function buildRepairPrompt(originalPrompt, previousCandidate, validationErrors, picks, goldens, mode) {
  const base = buildPrompt(originalPrompt, picks, goldens, mode);
  const repairTarget = mode === COACH_MODES.PASCALISH_SERVICE
    ? 'Return corrected Pascalish SERVICE/ROUTER/MAPPER source only.'
    : 'Return corrected Pascal source only.';
  return [
    base,
    '',
    'The previous output failed validation. Fix it.',
    repairTarget,
    'Validation errors:',
    validationErrors.join('\n'),
    '',
    'Previous output:',
    previousCandidate
  ].join('\n');
}

function findGoldenCacheHit(goldens, query) {
  const normalized = (t) => normalizePascalPrompt(t).toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedQuery = normalized(query);
  return goldens.find((example) => normalized(example.prompt || '') === normalizedQuery) || null;
}

function findGoldenFuzzyHit(goldens, query) {
  const queryToks = tokenize(query);
  const qSet = new Set(queryToks);

  let best = null;
  let bestJaccard = 0;

  for (const example of goldens) {
    const promptToks = tokenize(example.prompt || '');
    const pSet = new Set(promptToks);
    let intersection = 0;
    for (const t of qSet) { if (pSet.has(t)) intersection += 1; }
    const union = qSet.size + pSet.size - intersection;
    const jaccard = intersection / Math.max(1, union);
    if (jaccard > bestJaccard) {
      bestJaccard = jaccard;
      best = example;
    }
  }

  if (!best || bestJaccard < 0.75) return null;

  // Find numeric tokens that differ between the golden prompt and the query
  const goldenToks = tokenize(best.prompt || '');
  const goldenOnlyNums = goldenToks.filter((t) => /^\d+$/.test(t) && !qSet.has(t));
  const queryOnlyNums = queryToks.filter((t) => /^\d+$/.test(t) && !new Set(goldenToks).has(t));

  // Apply substitutions only in assignment contexts (:= oldNum) to avoid corrupting
  // peg/index literals in argument positions
  let response = String(best.response || '');
  for (let i = 0; i < goldenOnlyNums.length && i < queryOnlyNums.length; i += 1) {
    const oldNum = goldenOnlyNums[i];
    const newNum = queryOnlyNums[i];
    response = response.replace(new RegExp(`(:=\\s*)${oldNum}\\b`, 'g'), `$1${newNum}`);
  }

  return { ...best, response, fuzzyScore: bestJaccard };
}

export async function runCoachSession({
  prompt,
  model = process.env.OLLAMA_MODEL || 'phi3:latest',
  host = process.env.OLLAMA_HOST || '127.0.0.1',
  port = Number.parseInt(process.env.OLLAMA_PORT || '11434', 10),
  topK = 2,
  maxContextChars = 2500,
  numPredict = 320,
  noRepair = false,
  mode,
  out = '',
  resultOut = ''
}) {
  if (!mode) {
    mode = detectCoachMode(prompt);
  }

  // Cache hit: exact golden match — skip Ollama entirely
  const allGoldens = await loadGoldens();
  const cacheHit = findGoldenCacheHit(allGoldens, prompt);
  if (cacheHit) {
    const candidate = String(cacheHit.response || '').trim();
    const validation = validateDslCandidate(candidate, mode);
    const outPath = out ? path.resolve(out) : '';
    if (out && candidate) {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, `${candidate}\n`, 'utf-8');
    }
    const result = {
      status: validation.valid ? 'ok' : 'error',
      model: 'golden-cache',
      normalizedPrompt: prompt,
      coachMode: mode,
      simplePrompt: true,
      corpusChunksUsed: 0,
      goldenExamplesUsed: 1,
      numPredict: 0,
      noRepair,
      repaired: false,
      cacheHit: true,
      validation,
      outputPath: out ? path.relative(WORKSPACE_ROOT, outPath).replace(/\\/g, '/') : null,
      candidate
    };
    if (resultOut) {
      const resultPath = path.resolve(resultOut);
      await fs.mkdir(path.dirname(resultPath), { recursive: true });
      await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
    }
    return result;
  }

  // Fuzzy golden match: same algorithm, different numeric parameters
  const fuzzyHit = findGoldenFuzzyHit(allGoldens, prompt);
  if (fuzzyHit) {
    const candidate = String(fuzzyHit.response || '').trim();
    const validation = validateDslCandidate(candidate, mode);
    if (validation.valid) {
      const outPath = out ? path.resolve(out) : '';
      if (out && candidate) {
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, `${candidate}\n`, 'utf-8');
      }
      const result = {
        status: 'ok',
        model: 'golden-fuzzy',
        normalizedPrompt: prompt,
        coachMode: mode,
        simplePrompt: true,
        corpusChunksUsed: 0,
        goldenExamplesUsed: 1,
        numPredict: 0,
        noRepair,
        repaired: false,
        fuzzyHit: true,
        fuzzyScore: fuzzyHit.fuzzyScore,
        validation,
        outputPath: out ? path.relative(WORKSPACE_ROOT, outPath).replace(/\\/g, '/') : null,
        candidate
      };
      if (resultOut) {
        const resultPath = path.resolve(resultOut);
        await fs.mkdir(path.dirname(resultPath), { recursive: true });
        await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
      }
      return result;
    }
    // Fuzzy substitution produced invalid code — fall through to Ollama
  }

  const simplePrompt = isSimplePascalPrompt(prompt);
  const effectiveTopK = simplePrompt ? Math.min(topK, 2) : topK;
  const effectiveMaxContextChars = simplePrompt ? Math.min(maxContextChars, 1800) : maxContextChars;
  const effectiveGoldenCount = simplePrompt ? 1 : Math.min(3, effectiveTopK);
  const effectiveNumPredict = simplePrompt ? Math.min(numPredict, 220) : numPredict;
  const corpus = await loadCorpus();
  const picks = retrieveChunks(corpus, prompt, effectiveTopK, effectiveMaxContextChars);
  const goldenPicks = retrieveGoldens(allGoldens, prompt, effectiveGoldenCount);

  if (picks.length === 0) {
    throw new Error('No relevant DSL context found in corpus. Rebuild corpus or broaden prompt terms.');
  }

  const llmPrompt = buildPrompt(prompt, picks, goldenPicks, mode);
  const outPath = out ? path.resolve(out) : '';
  const firstResponse = await callOllama({ host, port, model, prompt: llmPrompt, outPath, numPredict: effectiveNumPredict, mode });
  let candidate = sanitizeDslCandidate(firstResponse, mode);
  let validation = validateDslCandidate(candidate, mode);
  if (validation.valid && validation.normalizedCandidate) {
    candidate = validation.normalizedCandidate;
  }
  let repaired = false;

  if (!validation.valid && !noRepair) {
    const repairPrompt = buildRepairPrompt(prompt, candidate, validation.errors, picks, goldenPicks, mode);
    const repairResponse = await callOllama({ host, port, model, prompt: repairPrompt, outPath, numPredict: effectiveNumPredict, mode });
    candidate = sanitizeDslCandidate(repairResponse, mode);
    validation = validateDslCandidate(candidate, mode);
    if (validation.valid && validation.normalizedCandidate) {
      candidate = validation.normalizedCandidate;
    }
    repaired = true;
  }

  if (out && candidate) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${candidate.trim()}\n`, 'utf-8');
  }

  const result = {
    status: validation.valid ? 'ok' : 'error',
    model,
    normalizedPrompt: prompt,
    coachMode: mode,
    simplePrompt,
    corpusChunksUsed: picks.length,
    goldenExamplesUsed: goldenPicks.length,
    numPredict: effectiveNumPredict,
    noRepair,
    repaired,
    validation,
    outputPath: out ? path.relative(WORKSPACE_ROOT, path.resolve(out)).replace(/\\/g, '/') : null,
    candidate
  };

  if (resultOut) {
    const resultPath = path.resolve(resultOut);
    await fs.mkdir(path.dirname(resultPath), { recursive: true });
    await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runCoachSession({
    prompt: args.prompt,
    model: args.model,
    host: args.host,
    port: args.port,
    topK: args.topK,
    maxContextChars: args.maxContextChars,
    numPredict: args.numPredict,
    noRepair: args.noRepair,
    mode: args.mode,
    out: args.out,
    resultOut: args.resultOut
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ok') {
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
