import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import QueueManager from '../src/broker/QueueManager.mjs';

function parseArgs(argv) {
  const args = {
    pcode: '../pcode/router-mapper.pcode',
    programMap: '../pcode/router-mapper.program.json',
    inputQueue: 'swift.mt103.parsed',
    message: 'MT103 SAMPLE',
    messageFile: null,
    poll: false,
    pollInterval: 100,
    queuePath: '../data'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--pcode') args.pcode = argv[i + 1];
    if (token === '--program-map') args.programMap = argv[i + 1];
    if (token === '--input-queue') args.inputQueue = argv[i + 1];
    if (token === '--message') args.message = argv[i + 1];
    if (token === '--message-file') args.messageFile = argv[i + 1];
    if (token === '--poll') args.poll = true;
    if (token === '--poll-interval') args.pollInterval = Number.parseInt(argv[i + 1], 10);
    if (token === '--queue-path') args.queuePath = argv[i + 1];
  }
  return args;
}

function trimCopy(s) {
  return String(s || '').trim();
}

function toUpperCopy(s) {
  return String(s || '').toUpperCase();
}

function unquote(text) {
  const s = trimCopy(text);
  if (s.length < 2) return s;
  const q = s[0];
  if ((q === '"' || q === '\'') && s[s.length - 1] === q) {
    return s.slice(1, -1);
  }
  return s;
}

function findTopLevelComma(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      continue;
    }
    if (ch === ',' && depth === 0) {
      return i;
    }
  }
  return -1;
}

function startsWithUpper(text, prefix) {
  return toUpperCopy(text).startsWith(toUpperCopy(prefix));
}

function evaluateWhenRule(whenRule, message) {
  const rule = toUpperCopy(trimCopy(whenRule));
  if (!rule) return true;

  if (rule.includes('OUTPUT := 1')) return true;
  if (rule.includes('OUTPUT := 0') && !rule.includes('THEN OUTPUT := 1')) return false;

  const fn = 'STARTSWITH(UPPER(SRC),';
  const idx = rule.indexOf(fn);
  if (idx >= 0) {
    const firstQuote = whenRule.indexOf('"');
    const secondQuote = whenRule.indexOf('"', firstQuote + 1);
    if (firstQuote >= 0 && secondQuote > firstQuote) {
      const prefix = whenRule.slice(firstQuote + 1, secondQuote);
      return startsWithUpper(message, prefix);
    }
  }

  return false;
}

// --- MT103 FIN text parser ---

function isMT103FinText(text) {
  const t = trimCopy(text);
  return /^:\w{1,3}:/m.test(t) || t.startsWith('{1:') || t.startsWith('{2:') || t.startsWith('{4:');
}

function parse32AField(value) {
  // YYMMDD + 3-char currency + amount (comma decimal)
  const m = trimCopy(value).match(/^(\d{6})([A-Z]{3})(.+)$/);
  if (m) {
    return { raw: value, date: m[1], currency: m[2], amount: m[3] };
  }
  return { raw: value, date: '', currency: '', amount: trimCopy(value) };
}

function parseMT103FinText(text) {
  const result = { block4: {} };

  // If wrapped in full FIN block delimiters, extract block 4 content
  let block4Text = text;
  const b4Start = text.indexOf('{4:');
  if (b4Start >= 0) {
    const b4End = text.indexOf('-}', b4Start);
    block4Text = b4End >= 0 ? text.slice(b4Start + 3, b4End) : text.slice(b4Start + 3);
  }

  const lines = block4Text.split(/\r?\n/);
  let currentTag = null;
  let currentValue = '';

  function flushField() {
    if (!currentTag) return;
    const val = trimCopy(currentValue);
    if (currentTag === '32A') {
      result.block4['32A'] = parse32AField(val);
    } else {
      result.block4[currentTag] = val;
    }
    currentTag = null;
    currentValue = '';
  }

  for (const line of lines) {
    const m = line.match(/^:(\w{1,3}):(.*)/);
    if (m) {
      flushField();
      currentTag = m[1];
      currentValue = m[2];
    } else if (currentTag) {
      currentValue += '\n' + line;
    }
  }
  flushField();

  return result;
}

// --- end MT103 parser ---

function getJsonPathValueAsString(root, dotPath) {
  const parts = String(dotPath || '').split('.').map(trimCopy).filter(Boolean);
  let cur = root;
  for (const key of parts) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) return '';
    cur = cur[key];
  }

  if (typeof cur === 'string') return cur;
  if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
  if (cur && typeof cur === 'object') return JSON.stringify(cur);
  return '';
}

function setJsonPathValue(root, dotPath, value) {
  const parts = String(dotPath || '').split('.').map(trimCopy).filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cur[key] = value;
      return;
    }
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key];
  }
}

function normalizeMtAmount(raw) {
  return trimCopy(raw).replaceAll(' ', '').replaceAll(',', '.');
}

function applyConversionRule(conversionRule, srcValue) {
  const rule = toUpperCopy(trimCopy(conversionRule));
  if (!rule) return srcValue;
  if (rule.includes('UPPER(SRC)')) return toUpperCopy(srcValue);
  if (rule.includes('TRIM(SRC)')) return trimCopy(srcValue);
  if (rule.includes('MTAMOUNTTODECIMAL(SRC)')) return normalizeMtAmount(srcValue);
  if (rule.includes('OUTPUT := SRC')) return srcValue;
  return srcValue;
}

function parseProgramMapMappings(programMap) {
  const entries = Array.isArray(programMap)
    ? programMap
    : (Array.isArray(programMap?.entries) ? programMap.entries : []);

  const mappingsById = new Map();
  for (const entry of entries) {
    if (!entry || entry.kind !== 'mapper') continue;
    const id = String(entry.id || '').trim();
    if (!id) continue;
    const items = Array.isArray(entry.items) ? entry.items.map(it => ({
      sourcePath: String(it?.sourcePath || ''),
      targetPath: String(it?.targetPath || ''),
      conversionRule: String(it?.conversionRule || '')
    })) : [];
    mappingsById.set(id, { id, items });
  }
  return mappingsById;
}

function runMappingById(mappingId, sourcePayload, mappingsById) {
  let mapping = mappingsById.get(mappingId);
  if (!mapping && mappingsById.has(`${mappingId}-mini`)) {
    mapping = mappingsById.get(`${mappingId}-mini`);
  }
  if (!mapping && String(mappingId).endsWith('-mini')) {
    const base = String(mappingId).slice(0, -5);
    mapping = mappingsById.get(base) || null;
  }
  if (!mapping) {
    throw new Error(`Mapping not found: ${mappingId}`);
  }

  let sourceDoc;
  try {
    sourceDoc = JSON.parse(sourcePayload);
  } catch {
    sourceDoc = { src: sourcePayload };
  }

  const out = {};
  for (const item of mapping.items) {
    const srcValue = getJsonPathValueAsString(sourceDoc, item.sourcePath);
    const transformed = applyConversionRule(item.conversionRule, srcValue);
    setJsonPathValue(out, item.targetPath, transformed);
  }
  return JSON.stringify(out);
}

function evaluateTransformExpr(exprText, sourceMessage, mappingsById, depth = 0) {
  if (depth > 8) throw new Error('Transform nesting too deep');

  const expr = trimCopy(exprText);
  if (!expr) return sourceMessage;

  const upper = toUpperCopy(expr);
  if (upper === 'SRC') return sourceMessage;

  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith('\'') && expr.endsWith('\''))) {
    return unquote(expr);
  }

  if (!upper.startsWith('MAP')) {
    return sourceMessage;
  }

  const openIdx = expr.indexOf('(');
  const closeIdx = expr.lastIndexOf(')');
  if (openIdx < 0 || closeIdx <= openIdx) {
    throw new Error('Invalid MAP expression');
  }

  const inside = trimCopy(expr.slice(openIdx + 1, closeIdx));
  const commaIdx = findTopLevelComma(inside);
  if (commaIdx < 0) {
    throw new Error('MAP requires two arguments');
  }

  const mapIdToken = trimCopy(inside.slice(0, commaIdx));
  const payloadExpr = trimCopy(inside.slice(commaIdx + 1));
  const mappingId = unquote(mapIdToken);
  if (mappingId === mapIdToken) {
    throw new Error('MAP id must be a quoted string');
  }

  const payload = evaluateTransformExpr(payloadExpr, sourceMessage, mappingsById, depth + 1);
  return runMappingById(mappingId, payload, mappingsById);
}

function applyTransformRule(transformRule, sourceMessage, mappingsById) {
  const rule = trimCopy(transformRule);
  if (!rule) return sourceMessage;

  const upper = toUpperCopy(rule);
  const assignIdx = upper.indexOf('OUTPUT :=');
  if (assignIdx < 0) return sourceMessage;

  let rhs = trimCopy(rule.slice(assignIdx + 9));
  const semi = rhs.indexOf(';');
  if (semi >= 0) rhs = trimCopy(rhs.slice(0, semi));

  return evaluateTransformExpr(rhs, sourceMessage, mappingsById, 0);
}

function parseQuotedOperand(text) {
  const first = text.indexOf('"');
  if (first < 0) return '';
  let i = first + 1;
  let out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      out += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
    i += 1;
  }
  return out;
}

function parsePcode(text) {
  const instructions = [];
  const labels = new Map();
  const unresolved = [];
  const lines = String(text || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = trimCopy(rawLine.split('#')[0]);
    if (!line) continue;

    if (line.endsWith(':')) {
      const label = trimCopy(line.slice(0, -1));
      if (label) labels.set(label, instructions.length);
      continue;
    }

    const firstSpace = line.indexOf(' ');
    const mnemonic = firstSpace < 0 ? line : line.slice(0, firstSpace);
    const rest = firstSpace < 0 ? '' : line.slice(firstSpace + 1);
    const instr = {
      mnemonic,
      operand: null,
      targetIndex: -1
    };

    if (mnemonic === 'JMP' || mnemonic === 'JZ') {
      instr.operand = trimCopy(rest);
      unresolved.push({ idx: instructions.length, label: instr.operand });
    } else if (mnemonic === 'ROUTE_MATCH_QUEUE' || mnemonic === 'ROUTE_EVAL_WHEN' || mnemonic === 'ROUTE_TRANSFORM' || mnemonic === 'ROUTE_EMIT' || mnemonic === 'PUSH_STR') {
      instr.operand = parseQuotedOperand(rest);
    } else if (mnemonic === 'PUSH_INT') {
      instr.operand = Number.parseInt(trimCopy(rest), 10);
    }

    instructions.push(instr);
  }

  for (const jump of unresolved) {
    const target = labels.get(jump.label);
    instructions[jump.idx].targetIndex = typeof target === 'number' ? target : -1;
  }

  return instructions;
}

function executeProgram({ instructions, opcodeMap, mappingsById, inputQueue, sourceMessage }) {
  const stack = [];
  let pc = 0;
  let currentMessage = sourceMessage;
  const deliveries = [];

  const requiredMnemonics = [
    'NOP', 'JMP', 'JZ', 'HALT',
    'ROUTE_MATCH_QUEUE', 'ROUTE_EVAL_WHEN', 'ROUTE_TRANSFORM', 'ROUTE_EMIT',
    'PARSE_FIN_TEXT'
  ];

  for (const name of requiredMnemonics) {
    const manifestName = `OP_${name}`;
    if (!opcodeMap.has(manifestName)) {
      throw new Error(`Opcode missing from manifest for JS runtime: ${manifestName}`);
    }
  }

  while (pc >= 0 && pc < instructions.length) {
    const instr = instructions[pc];
    const op = instr.mnemonic;

    if (op === 'NOP') {
      pc += 1;
      continue;
    }
    if (op === 'HALT') {
      break;
    }
    if (op === 'JMP') {
      pc = instr.targetIndex >= 0 ? instr.targetIndex : instructions.length;
      continue;
    }
    if (op === 'JZ') {
      const v = Number(stack.pop() || 0);
      pc = (v === 0)
        ? (instr.targetIndex >= 0 ? instr.targetIndex : instructions.length)
        : (pc + 1);
      continue;
    }
    if (op === 'PUSH_INT') {
      stack.push(Number(instr.operand || 0));
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_MATCH_QUEUE') {
      stack.push(String(instr.operand || '') === String(inputQueue) ? 1 : 0);
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_EVAL_WHEN') {
      stack.push(evaluateWhenRule(String(instr.operand || ''), currentMessage) ? 1 : 0);
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_TRANSFORM') {
      currentMessage = applyTransformRule(String(instr.operand || ''), currentMessage, mappingsById);
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_EMIT') {
      deliveries.push({ queueName: String(instr.operand || ''), message: currentMessage });
      pc += 1;
      continue;
    }
    if (op === 'PARSE_FIN_TEXT') {
      currentMessage = JSON.stringify(parseMT103FinText(currentMessage));
      pc += 1;
      continue;
    }

    pc += 1;
  }

  return { deliveries };
}

async function readMessage(args) {
  if (args.messageFile) {
    const p = path.resolve(args.messageFile);
    return fs.readFile(p, 'utf-8');
  }
  return args.message;
}

async function runSingleMessage(args) {
  const pcodePath = path.resolve(args.pcode);
  const programMapPath = path.resolve(args.programMap);
  const pcodeText = await fs.readFile(pcodePath, 'utf-8');
  const programMap = JSON.parse(await fs.readFile(programMapPath, 'utf-8'));
  const sourceMessage = await readMessage(args);

  const opcodeMap = await loadOpcodeMap();
  const mappingsById = parseProgramMapMappings(programMap);
  const instructions = parsePcode(pcodeText);
  const result = executeProgram({
    instructions,
    opcodeMap,
    mappingsById,
    inputQueue: args.inputQueue,
    sourceMessage
  });

  const out = {
    runtime: 'js-pmachine',
    pcodePath: path.relative(process.cwd(), pcodePath),
    programMapPath: path.relative(process.cwd(), programMapPath),
    inputQueue: args.inputQueue,
    sourceMessage,
    publishedCount: result.deliveries.length,
    deliveries: result.deliveries
  };

  console.log(JSON.stringify(out, null, 2));
}

async function pollAndRoute(args) {
  const pcodePath = path.resolve(args.pcode);
  const programMapPath = path.resolve(args.programMap);
  const queuePath = path.resolve(args.queuePath);
  
  const pcodeText = await fs.readFile(pcodePath, 'utf-8');
  const programMap = JSON.parse(await fs.readFile(programMapPath, 'utf-8'));
  
  const opcodeMap = await loadOpcodeMap();
  const mappingsById = parseProgramMapMappings(programMap);
  const instructions = parsePcode(pcodeText);
  
  // Initialize queue manager
  const qm = new QueueManager('pcode-router', queuePath);
  
  // Ensure input queue exists
  if (!qm.queueConfig[args.inputQueue]) {
    qm.createQueue(args.inputQueue);
  }
  
  console.log(`[POLLER] Starting on input queue: ${args.inputQueue}, interval: ${args.pollInterval}ms`);
  console.log(`[POLLER] Queue path: ${queuePath}`);
  
  let messageCount = 0;
  
  while (true) {
    const msg = qm.dequeue(args.inputQueue, 'pcode-router');
    
    if (!msg) {
      // No message available, sleep and retry
      await new Promise(resolve => setTimeout(resolve, args.pollInterval));
      continue;
    }
    
    messageCount += 1;
    const sourceMessage = msg.message || String(msg);
    
    console.log(`[POLLER] Message #${messageCount}: processing from ${args.inputQueue}`);
    
    try {
      const result = executeProgram({
        instructions,
        opcodeMap,
        mappingsById,
        inputQueue: args.inputQueue,
        sourceMessage
      });
      
      // Enqueue deliveries to their output queues
      for (const delivery of result.deliveries) {
        const queueName = delivery.queueName;
        
        // Ensure output queue exists
        if (!qm.queueConfig[queueName]) {
          qm.createQueue(queueName);
        }
        
        qm.enqueue(queueName, delivery.message, 'pcode-router', msg.messageEnvelope || null);
        console.log(`[POLLER] Enqueued to ${queueName}`);
      }
    } catch (err) {
      console.error(`[POLLER] Error routing message #${messageCount}:`, err.message);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.poll) {
    await pollAndRoute(args);
  } else {
    await runSingleMessage(args);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[JS-PMACHINE] Failed:', err.message);
    process.exitCode = 1;
  });
}
