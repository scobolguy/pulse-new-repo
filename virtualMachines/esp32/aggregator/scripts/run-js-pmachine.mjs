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
    queuePath: '../data',
    backendUrl: 'http://localhost:4000',
    actorUserId: 'system-admin',
    serviceId: ''
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
    if (token === '--backend-url') args.backendUrl = argv[i + 1];
    if (token === '--actor-user-id') args.actorUserId = argv[i + 1];
    if (token === '--service-id') args.serviceId = argv[i + 1];
  }
  return args;
}

function normalizeRuntimeUnit(runtimeUnit, fallbackServiceId = 'default-router-service') {
  const kindRaw = String(runtimeUnit?.kind || '').trim().toLowerCase();
  const kind = (kindRaw === 'program' || kindRaw === 'daemon' || kindRaw === 'service') ? kindRaw : 'service';
  const id = String(runtimeUnit?.id || fallbackServiceId || 'default-router-service').trim() || 'default-router-service';
  const refreshMsRaw = Number(runtimeUnit?.refreshMs || 0);
  const refreshMs = kind === 'daemon' ? (refreshMsRaw > 0 ? Math.floor(refreshMsRaw) : 1000) : null;
  return { kind, id, refreshMs };
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

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map(p => p.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function evaluateWhenRule(whenRule, message, state = {}) {
  const normalizedRule = trimCopy(whenRule);
  const rule = toUpperCopy(normalizedRule);
  if (!rule) return true;

  if (rule.includes('OUTPUT := 1')) return true;
  if (rule.includes('OUTPUT := 0') && !rule.includes('THEN OUTPUT := 1')) return false;

  const fieldMatch = normalizedRule.match(/^FIELD_(EQUALS|CONTAINS)\s*\((.*)\)\s*$/i);
  if (fieldMatch) {
    const op = String(fieldMatch[1] || '').toUpperCase();
    const argsText = String(fieldMatch[2] || '');
    const comma = findTopLevelComma(argsText);
    if (comma >= 0) {
      const field = unquote(argsText.slice(0, comma));
      const expected = unquote(argsText.slice(comma + 1));

      let actual;
      if (String(field).startsWith('state.')) {
        actual = getByPath(state, field.slice(6));
      } else {
        let doc = null;
        try {
          doc = JSON.parse(String(message || '{}'));
        } catch {
          doc = null;
        }
        actual = doc ? getByPath(doc, field) : undefined;
        if (actual === undefined && String(field).startsWith('message.')) {
          actual = doc ? getByPath(doc, field.slice(8)) : undefined;
        }
      }

      if (op === 'EQUALS') {
        return String(actual ?? '') === String(expected ?? '');
      }
      if (op === 'CONTAINS') {
        if (Array.isArray(actual)) {
          return actual.map(v => String(v)).includes(String(expected ?? ''));
        }
        return String(actual ?? '').toUpperCase().includes(String(expected ?? '').toUpperCase());
      }
    }
  }

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

function yyMmDdToIso(raw) {
  const src = trimCopy(raw);
  const m = src.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return src;
  const yy = Number.parseInt(m[1], 10);
  const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${yyyy}-${m[2]}-${m[3]}`;
}

function extractMtPartyName(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => trimCopy(line))
    .filter(Boolean);
  const nonAccount = lines.filter((line) => !line.startsWith('/'));
  return nonAccount[0] || lines[0] || '';
}

function mapMtChargeBearerToIso(raw) {
  const code = toUpperCopy(trimCopy(raw));
  if (code === 'OUR') return 'DEBT';
  if (code === 'BEN') return 'CRED';
  return code;
}

function applyConversionRule(conversionRule, srcValue) {
  const rule = toUpperCopy(trimCopy(conversionRule));
  if (!rule) return srcValue;
  if (rule.includes('UPPER(SRC)')) return toUpperCopy(srcValue);
  if (rule.includes('TRIM(SRC)')) return trimCopy(srcValue);
  if (rule.includes('YYMMDDTOISO(SRC)')) return yyMmDdToIso(srcValue);
  if (rule.includes('MTPARTYNAME(SRC)')) return extractMtPartyName(srcValue);
  if (rule.includes('MTCHARGEBEARERTOISO(SRC)')) return mapMtChargeBearerToIso(srcValue);
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
  mappingsById.__globals = Array.isArray(programMap?.globals) ? programMap.globals : [];
  mappingsById.__proceduresByLabel = programMap?.procedures || {};
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

function parseBareOperand(text) {
  return trimCopy(text || '').split(/\s+/)[0] || '';
}

function parseCallOperand(text) {
  const parts = trimCopy(text || '').split(/\s+/).filter(Boolean);
  return {
    label: parts[0] || '',
    argc: Number.parseInt(parts[1] || '0', 10) || 0
  };
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
    } else if (
      mnemonic === 'ROUTE_MATCH_QUEUE'
      || mnemonic === 'ROUTE_EVAL_WHEN'
      || mnemonic === 'ROUTE_TRANSFORM'
      || mnemonic === 'ROUTE_EMIT'
      || mnemonic === 'ROUTE_SET_STATE'
      || mnemonic === 'ORCH_SPAWN'
      || mnemonic === 'ORCH_WAIT_ALL'
      || mnemonic === 'ORCH_FAIL_TXN'
      || mnemonic === 'ORCH_RETURN_SUCCESS'
      || mnemonic === 'PUSH_STR'
    ) {
      instr.operand = parseQuotedOperand(rest);
    } else if (mnemonic === 'PUSH_INT') {
      instr.operand = Number.parseInt(trimCopy(rest), 10);
    } else if (mnemonic === 'LOAD' || mnemonic === 'STORE') {
      instr.operand = parseBareOperand(rest);
    } else if (mnemonic === 'CALL') {
      instr.operand = parseCallOperand(rest);
      unresolved.push({ idx: instructions.length, label: instr.operand.label });
    }

    instructions.push(instr);
  }

  for (const jump of unresolved) {
    const target = labels.get(jump.label);
    instructions[jump.idx].targetIndex = typeof target === 'number' ? target : -1;
  }

  return instructions;
}

function resolveVar(frame, name) {
  let cursor = frame;
  while (cursor) {
    if (Object.prototype.hasOwnProperty.call(cursor.vars, name)) return cursor.vars[name];
    cursor = cursor.parent;
  }
  return 0;
}

function assignVar(frame, name, value) {
  let cursor = frame;
  while (cursor) {
    if (Object.prototype.hasOwnProperty.call(cursor.vars, name)) {
      cursor.vars[name] = value;
      return;
    }
    cursor = cursor.parent;
  }
  frame.vars[name] = value;
}

async function executeProgram({ instructions, opcodeMap, mappingsById, inputQueue, sourceMessage, runtimeContext = {} }) {
  const stack = [];
  let pc = 0;
  let currentMessage = sourceMessage;
  const deliveries = [];
  const state = {};
  const stdout = [];
  let currentLine = '';

  const programGlobals = Array.isArray(mappingsById?.__globals) ? mappingsById.__globals : [];
  const proceduresByLabel = mappingsById?.__proceduresByLabel || {};
  const globalFrame = {
    vars: Object.fromEntries(programGlobals.map(name => [name, 0])),
    parent: null
  };
  let currentFrame = globalFrame;
  const callStack = [];
  const pendingOrchTasks = [];
  let orchestrationSummary = null;

  const requiredMnemonics = [
    'NOP', 'JMP', 'JZ', 'HALT',
    'ROUTE_MATCH_QUEUE', 'ROUTE_EVAL_WHEN', 'ROUTE_TRANSFORM', 'ROUTE_EMIT', 'ROUTE_SET_STATE',
    'PARSE_FIN_TEXT'
  ];

  const hasRouterOps = instructions.some(i => {
    const m = String(i.mnemonic || '');
    return m.startsWith('ROUTE_') || m === 'PARSE_FIN_TEXT';
  });

  if (hasRouterOps) {
    for (const name of requiredMnemonics) {
      const manifestName = `OP_${name}`;
      if (!opcodeMap.has(manifestName)) {
        throw new Error(`Opcode missing from manifest for JS runtime: ${manifestName}`);
      }
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
    if (op === 'PUSH_STR') {
      stack.push(String(instr.operand || ''));
      pc += 1;
      continue;
    }
    if (op === 'LOAD') {
      stack.push(Number(resolveVar(currentFrame, String(instr.operand || '')) || 0));
      pc += 1;
      continue;
    }
    if (op === 'STORE') {
      assignVar(currentFrame, String(instr.operand || ''), Number(stack.pop() || 0));
      pc += 1;
      continue;
    }
    if (op === 'ADD' || op === 'SUB' || op === 'MUL' || op === 'DIV') {
      const b = Number(stack.pop() || 0);
      const a = Number(stack.pop() || 0);
      if (op === 'ADD') stack.push(a + b);
      if (op === 'SUB') stack.push(a - b);
      if (op === 'MUL') stack.push(a * b);
      if (op === 'DIV') stack.push(Math.trunc(a / (b || 1)));
      pc += 1;
      continue;
    }
    if (op === 'EQ' || op === 'NEQ' || op === 'LT' || op === 'LE' || op === 'GT' || op === 'GE') {
      const b = Number(stack.pop() || 0);
      const a = Number(stack.pop() || 0);
      let truth = 0;
      if (op === 'EQ') truth = a === b ? 1 : 0;
      if (op === 'NEQ') truth = a !== b ? 1 : 0;
      if (op === 'LT') truth = a < b ? 1 : 0;
      if (op === 'LE') truth = a <= b ? 1 : 0;
      if (op === 'GT') truth = a > b ? 1 : 0;
      if (op === 'GE') truth = a >= b ? 1 : 0;
      stack.push(truth);
      pc += 1;
      continue;
    }
    if (op === 'CALL') {
      const call = instr.operand || { label: '', argc: 0 };
      const proc = proceduresByLabel[call.label] || { params: [], locals: [] };
      const args = [];
      for (let i = 0; i < Number(call.argc || 0); i += 1) {
        args.push(Number(stack.pop() || 0));
      }
      args.reverse();

      const vars = {};
      for (let i = 0; i < (proc.params || []).length; i += 1) {
        vars[String(proc.params[i])] = Number(args[i] || 0);
      }
      for (const localName of (proc.locals || [])) {
        if (!Object.prototype.hasOwnProperty.call(vars, localName)) vars[String(localName)] = 0;
      }

      callStack.push({ returnPc: pc + 1, frame: currentFrame });
      currentFrame = { vars, parent: currentFrame };
      pc = instr.targetIndex >= 0 ? instr.targetIndex : instructions.length;
      continue;
    }
    if (op === 'RET') {
      const frame = callStack.pop();
      if (!frame) break;
      currentFrame = frame.frame;
      pc = frame.returnPc;
      continue;
    }
    if (op === 'PRINT') {
      currentLine += String(stack.pop() ?? '');
      pc += 1;
      continue;
    }
    if (op === 'PRINT_INT') {
      currentLine += String(Number(stack.pop() || 0));
      pc += 1;
      continue;
    }
    if (op === 'PRINT_NL') {
      stdout.push(currentLine);
      currentLine = '';
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_MATCH_QUEUE') {
      stack.push(String(instr.operand || '') === String(inputQueue) ? 1 : 0);
      pc += 1;
      continue;
    }
    if (op === 'ROUTE_EVAL_WHEN') {
      stack.push(evaluateWhenRule(String(instr.operand || ''), currentMessage, state) ? 1 : 0);
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
    if (op === 'ROUTE_SET_STATE') {
      const payload = String(instr.operand || '');
      const eq = payload.indexOf('=');
      if (eq >= 0) {
        const key = trimCopy(payload.slice(0, eq));
        const value = trimCopy(payload.slice(eq + 1));
        if (key) state[key] = value;
      }
      pc += 1;
      continue;
    }
    if (op === 'PARSE_FIN_TEXT') {
      currentMessage = JSON.stringify(parseMT103FinText(currentMessage));
      pc += 1;
      continue;
    }

    if (op === 'ORCH_SPAWN') {
      let task = null;
      try {
        task = JSON.parse(String(instr.operand || '{}'));
      } catch {
        task = null;
      }
      if (task && task.subflowId) pendingOrchTasks.push(task);
      pc += 1;
      continue;
    }

    if (op === 'ORCH_WAIT_ALL') {
      let waitCfg = {};
      try {
        waitCfg = JSON.parse(String(instr.operand || '{}'));
      } catch {
        waitCfg = {};
      }

      const invokeSubflow = typeof runtimeContext.invokeSubflow === 'function'
        ? runtimeContext.invokeSubflow
        : async () => ({ success: false, errorMessage: 'invokeSubflow not configured' });

      const settled = await Promise.all(pendingOrchTasks.map(async (task) => {
        try {
          const result = await invokeSubflow({
            subflowId: String(task.subflowId || '').trim(),
            nodeId: String(task.nodeId || '').trim(),
            payload: sourceMessage,
            timeoutMs: Number(task.timeoutMs || 0) || Number(waitCfg.timeoutMs || 0) || 5000
          });

          let payloadSuccess = null;
          if (result && typeof result.response === 'string') {
            try {
              const parsed = JSON.parse(result.response);
              if (typeof parsed?.success === 'boolean') payloadSuccess = parsed.success;
            } catch {}
          } else if (result && typeof result.response === 'object' && typeof result.response?.success === 'boolean') {
            payloadSuccess = result.response.success;
          }

          const success = payloadSuccess == null ? Boolean(result?.success !== false) : Boolean(payloadSuccess);
          return {
            handleRef: String(task.handleRef || '').trim(),
            subflowId: String(task.subflowId || '').trim(),
            nodeId: String(task.nodeId || '').trim(),
            success,
            response: result?.response ?? null,
            errorMessage: result?.errorMessage || null,
            errorCode: result?.errorCode || null
          };
        } catch (error) {
          return {
            handleRef: String(task.handleRef || '').trim(),
            subflowId: String(task.subflowId || '').trim(),
            nodeId: String(task.nodeId || '').trim(),
            success: false,
            response: null,
            errorMessage: error?.message || String(error),
            errorCode: 'invoke_exception'
          };
        }
      }));

      const failed = settled.find(item => item.success !== true);
      orchestrationSummary = {
        success: !failed,
        reason: String(waitCfg.reason || '').trim(),
        results: settled
      };
      state.__orchestration = orchestrationSummary;
      state.__orch_failed = failed ? 1 : 0;
      stack.push(failed ? 0 : 1);
      pc += 1;
      continue;
    }

    if (op === 'ORCH_FAIL_TXN') {
      if (Number(state.__orch_failed || 0) !== 0) {
        state.__orch_error = String(instr.operand || orchestrationSummary?.reason || 'orchestration failed');
        break;
      }
      pc += 1;
      continue;
    }

    if (op === 'ORCH_RETURN_SUCCESS') {
      const ref = String(instr.operand || '').trim();
      let parsedSource = null;
      try {
        parsedSource = JSON.parse(String(sourceMessage || '{}'));
      } catch {
        parsedSource = null;
      }
      state.__orchestration = state.__orchestration || orchestrationSummary || { success: true, results: [] };
      if (parsedSource && ref && Object.prototype.hasOwnProperty.call(parsedSource, ref)) {
        state.__response = parsedSource[ref];
      } else {
        state.__response = state.__orchestration?.results || null;
      }
      pc += 1;
      continue;
    }

    pc += 1;
  }

  if (currentLine.length > 0) stdout.push(currentLine);
  return { deliveries, state, stdout, globals: globalFrame.vars, orchestration: state.__orchestration || null, response: state.__response ?? null, error: state.__orch_error || null };
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
  const runtimeUnit = normalizeRuntimeUnit(programMap?.runtimeUnit, programMap?.serviceId);
  const loadedAt = new Date().toISOString();
  const invokeSubflow = async ({ subflowId, nodeId, payload, timeoutMs }) => {
    const base = String(args.backendUrl || 'http://localhost:4000').replace(/\/$/, '');
    const q = new URLSearchParams();
    q.set('inputQueue', `${subflowId}.in`);
    if (nodeId) q.set('nodeId', String(nodeId));
    if (timeoutMs) q.set('timeoutMs', String(timeoutMs));
    const url = `${base}/api/services/${encodeURIComponent(subflowId)}?${q.toString()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': String(args.actorUserId || 'system-admin')
      },
      body: String(payload || '')
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return {
      success: res.ok,
      response: parsed,
      errorCode: res.ok ? null : `http_${res.status}`,
      errorMessage: res.ok ? null : (typeof parsed === 'object' ? (parsed?.error || '') : String(parsed || ''))
    };
  };

  const result = await executeProgram({
    instructions,
    opcodeMap,
    mappingsById,
    inputQueue: args.inputQueue,
    sourceMessage,
    runtimeContext: {
      invokeSubflow,
      serviceId: args.serviceId || ''
    }
  });

  const out = {
    runtime: 'js-pmachine',
    lifecycle: {
      unitKind: runtimeUnit.kind,
      unitId: runtimeUnit.id,
      daemonRefreshMs: runtimeUnit.refreshMs,
      loadedAt,
      unloadedAt: new Date().toISOString()
    },
    pcodePath: path.relative(process.cwd(), pcodePath),
    programMapPath: path.relative(process.cwd(), programMapPath),
    inputQueue: args.inputQueue,
    sourceMessage,
    publishedCount: result.deliveries.length,
    deliveries: result.deliveries,
    state: result.state,
    stdout: result.stdout || [],
    globals: result.globals || {},
    orchestration: result.orchestration || null,
    response: result.response ?? null,
    error: result.error || null
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
  const runtimeUnit = normalizeRuntimeUnit(programMap?.runtimeUnit, programMap?.serviceId);
  
  // Initialize queue manager
  const qm = new QueueManager('pcode-router', queuePath);
  
  // Ensure input queue exists
  if (!qm.queueConfig[args.inputQueue]) {
    qm.createQueue(args.inputQueue);
  }
  
  console.log(`[POLLER] Starting on input queue: ${args.inputQueue}, interval: ${args.pollInterval}ms`);
  console.log(`[POLLER] Queue path: ${queuePath}`);
  console.log(`[LIFECYCLE] Loaded ${runtimeUnit.kind} '${runtimeUnit.id}'`);
  if (runtimeUnit.kind === 'daemon') {
    console.log(`[LIFECYCLE] Daemon refresh cycle: ${runtimeUnit.refreshMs}ms`);
  }
  
  let messageCount = 0;
  let lastRefreshAt = Date.now();
  
  while (true) {
    if (runtimeUnit.kind === 'daemon' && (Date.now() - lastRefreshAt) >= runtimeUnit.refreshMs) {
      lastRefreshAt = Date.now();
      console.log(`[DAEMON] Refresh cycle tick at ${new Date(lastRefreshAt).toISOString()}`);
    }

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
      const result = await executeProgram({
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
