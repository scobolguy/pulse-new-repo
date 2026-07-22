import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { XMLParser } from 'fast-xml-parser';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import QueueManager from '../src/broker/QueueManager.mjs';

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: true,
  trimValues: true
});

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
    serviceId: '',
    organismId: '',
    generation: '0',
    fitnessOut: ''
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
    if (token === '--organism-id') args.organismId = argv[i + 1];
    if (token === '--generation') args.generation = argv[i + 1];
    if (token === '--fitness-out') args.fitnessOut = argv[i + 1];
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

const ISO_TYPE_PREFIXES = [
  'pacs', 'camt', 'pain', 'head', 'remt',
  'acmt', 'admi', 'auth', 'caaa', 'caam',
  'cain', 'catm', 'catp', 'reda', 'secl',
  'seev', 'semt', 'tsin'
];

function inferIsoTypeId(typeId) {
  const id = String(typeId || '').trim().toLowerCase();
  if (!id) return false;
  return ISO_TYPE_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}-`) || id.startsWith(`${prefix}.`));
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

function getJsonPathValue(root, dotPath) {
  const parts = String(dotPath || '').split('.').map(trimCopy).filter(Boolean);
  let cur = root;
  for (const key of parts) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) return '';
    cur = cur[key];
  }

  return cur;
}

function asStringValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
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
  const srcText = asStringValue(srcValue);
  if (!rule) return srcValue;
  if (rule.includes('UPPER(SRC)')) return toUpperCopy(srcText);
  if (rule.includes('TRIM(SRC)')) return trimCopy(srcText);
  if (rule.includes('YYMMDDTOISO(SRC)')) return yyMmDdToIso(srcText);
  if (rule.includes('MTPARTYNAME(SRC)')) return extractMtPartyName(srcText);
  if (rule.includes('MTCHARGEBEARERTOISO(SRC)')) return mapMtChargeBearerToIso(srcText);
  if (rule.includes('MTAMOUNTTODECIMAL(SRC)')) return normalizeMtAmount(srcText);
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
    mappingsById.set(id, {
      id,
      sourceTypeId: String(entry.sourceTypeId || ''),
      targetTypeId: String(entry.targetTypeId || ''),
      items
    });
  }
  mappingsById.__globals = Array.isArray(programMap?.globals) ? programMap.globals : [];
  mappingsById.__proceduresByLabel = programMap?.procedures || {};
  return mappingsById;
}

function parseProgramMapQueueTypes(programMap) {
  const entries = Array.isArray(programMap)
    ? programMap
    : (Array.isArray(programMap?.entries) ? programMap.entries : []);

  const queueTypes = new Map();
  for (const entry of entries) {
    if (!entry || entry.kind !== 'router') continue;
    const outputs = Array.isArray(entry.outputs) ? entry.outputs : [];
    for (const output of outputs) {
      const queueName = String(output?.queueName || '').trim();
      if (!queueName || queueTypes.has(queueName)) continue;
      const dataTypeId = String(output?.dataTypeId || (Array.isArray(output?.dataTypeIds) ? output.dataTypeIds[0] : '') || '').trim();
      if (dataTypeId) {
        queueTypes.set(queueName, dataTypeId.toLowerCase());
      }
    }
  }

  return queueTypes;
}

async function loadLibrarianIsoTypeIds() {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'services', 'librarian', 'data-types.json'),
    path.resolve(process.cwd(), 'data', 'data-types.json')
  ];

  const out = new Set();
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const entry of parsed) {
        const id = String(entry?.id || '').trim().toLowerCase();
        if (!id) continue;
        const isIso = typeof entry?.isIso === 'boolean' ? entry.isIso : inferIsoTypeId(id);
        if (isIso) out.add(id);
      }
      if (out.size > 0) return out;
    } catch {
      // Try next candidate.
    }
  }

  return out;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function objectToXml(name, value, indent = '') {
  if (value == null) {
    return `${indent}<${name}></${name}>`;
  }

  if (typeof value !== 'object') {
    return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => objectToXml(name, item, indent)).join('\n');
  }

  const attrs = [];
  const childEntries = [];
  let textValue = null;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('@')) {
      attrs.push(`${key.slice(1)}="${xmlEscape(child)}"`);
    } else if (key === '#text') {
      textValue = child;
    } else {
      childEntries.push([key, child]);
    }
  }

  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  if (childEntries.length === 0) {
    return `${indent}<${name}${attrText}>${xmlEscape(textValue)}</${name}>`;
  }

  const childXml = childEntries
    .map(([childName, childValue]) => objectToXml(childName, childValue, `${indent}  `))
    .join('\n');
  const textSegment = textValue == null ? '' : xmlEscape(textValue);
  if (textSegment) {
    return `${indent}<${name}${attrText}>${textSegment}\n${childXml}\n${indent}</${name}>`;
  }

  return `${indent}<${name}${attrText}>\n${childXml}\n${indent}</${name}>`;
}

function messageObjectToXml(messageObject) {
  if (!messageObject || typeof messageObject !== 'object') {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Document/>`;
  }

  const xmlBody = Object.entries(messageObject)
    .map(([rootName, rootValue]) => objectToXml(rootName, rootValue, ''))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
}

function parseXmlMessage(xmlText) {
  const raw = String(xmlText || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('<') && !raw.startsWith('<?xml')) return null;
  try {
    const parsed = XML_PARSER.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function splitPacsBatchObject(payloadObject) {
  if (!payloadObject || typeof payloadObject !== 'object') return null;

  const doc = payloadObject.Document;
  const fi = doc && typeof doc === 'object' ? doc.FIToFICstmrCdtTrf : null;
  if (!fi || typeof fi !== 'object') return null;

  const txList = fi.CdtTrfTxInf;
  if (!Array.isArray(txList) || txList.length <= 1) return null;

  const grpHdr = fi.GrpHdr && typeof fi.GrpHdr === 'object' ? fi.GrpHdr : {};
  return txList.map((tx) => ({
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: grpHdr,
        CdtTrfTxInf: tx
      }
    }
  }));
}

function expandOutputMessages(message) {
  if (Array.isArray(message)) {
    return message;
  }

  if (message && typeof message === 'object') {
    const splitObject = splitPacsBatchObject(message);
    if (splitObject) return splitObject;
    return [message];
  }

  const raw = String(message ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return [raw];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return [raw];
    }
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const splitObject = splitPacsBatchObject(parsed);
      if (!splitObject) return [raw];
      return splitObject.map((item) => JSON.stringify(item));
    } catch {
      return [raw];
    }
  }

  if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
    const parsed = parseXmlMessage(trimmed);
    if (!parsed) return [raw];
    const splitObject = splitPacsBatchObject(parsed);
    if (!splitObject) return [raw];
    return splitObject.map((item) => messageObjectToXml(item));
  }

  return [raw];
}

function buildFitnessReport({ args, sourceMessage, result, durationMs, deliveryCount, mode }) {
  const successCount = Number(deliveryCount || 0) > 0 ? 1 : 0;
  const failureCount = successCount > 0 ? 0 : 1;
  const latencyMs = Math.max(0, Number(durationMs || 0));
  const successRate = successCount > 0 ? 1 : 0;
  const retryCount = Number(result?.state?.retryCount || result?.orchestration?.retries || 0);
  const score = (successCount * 100000) - latencyMs - (retryCount * 1000);

  return {
    organismId: String(args.organismId || args.serviceId || 'organism-0'),
    generation: Number.parseInt(args.generation || '0', 10) || 0,
    inputQueue: String(args.inputQueue || ''),
    mode,
    sourceMessageLength: String(sourceMessage || '').length,
    successCount,
    failureCount,
    retryCount,
    deliveryCount: Number(deliveryCount || 0),
    latencyMs,
    successRate,
    score,
    measuredAt: new Date().toISOString()
  };
}

async function appendFitnessRecord(fitnessOutPath, fitnessReport) {
  if (!fitnessOutPath) return;
  const resolvedPath = path.resolve(fitnessOutPath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.appendFile(resolvedPath, `${JSON.stringify(fitnessReport)}\n`, 'utf8');
}

function ensurePacsNamespaces(messageObject) {
  if (!messageObject || typeof messageObject !== 'object') {
    return messageObject;
  }

  const docRoot = messageObject.Document;
  if (!docRoot || typeof docRoot !== 'object') {
    return messageObject;
  }

  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns')) {
    docRoot['@xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10';
  }
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns:xsi')) {
    docRoot['@xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
  }
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns:hdr')) {
    docRoot['@xmlns:hdr'] = 'urn:swift:xsd:head.001.001.02';
  }

  const txNode = docRoot?.FIToFICstmrCdtTrf;
  const msgId = typeof txNode?.GrpHdr?.MsgId === 'string' ? txNode.GrpHdr.MsgId : '';
  if (msgId && !docRoot['hdr:AppHdr']) {
    docRoot['hdr:AppHdr'] = {
      'hdr:BizMsgIdr': msgId
    };
  }

  return messageObject;
}

function resolveCamtNamespace(docRoot) {
  if (!docRoot || typeof docRoot !== 'object') return 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.14';
  if (docRoot.BkToCstmrStmt && typeof docRoot.BkToCstmrStmt === 'object') {
    return 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.14';
  }
  if (docRoot.BkToCstmrAcctRpt && typeof docRoot.BkToCstmrAcctRpt === 'object') {
    return 'urn:iso:std:iso:20022:tech:xsd:camt.052.001.14';
  }
  if (docRoot.BkToCstmrDbtCdtNtfctn && typeof docRoot.BkToCstmrDbtCdtNtfctn === 'object') {
    return 'urn:iso:std:iso:20022:tech:xsd:camt.054.001.14';
  }
  return 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.14';
}

function ensureCamtNamespaces(messageObject) {
  if (!messageObject || typeof messageObject !== 'object') return messageObject;
  const docRoot = messageObject.Document;
  if (!docRoot || typeof docRoot !== 'object') return messageObject;
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns')) {
    docRoot['@xmlns'] = resolveCamtNamespace(docRoot);
  }
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns:xsi')) {
    docRoot['@xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
  }
  return messageObject;
}

function ensureIsoNamespaces(messageObject, queueType) {
  const typeId = String(queueType || '').trim().toLowerCase();
  if (typeId === 'pacs' || typeId.startsWith('pacs')) return ensurePacsNamespaces(messageObject);
  if (typeId === 'camt' || typeId.startsWith('camt')) return ensureCamtNamespaces(messageObject);
  return messageObject;
}

function maybeConvertIsoDelivery(queueName, message, queueTypes, isoTypeIds = new Set()) {
  const queueType = String(queueTypes?.get(String(queueName || '').trim()) || '').toLowerCase();
  const shouldConvert = !!queueType && (isoTypeIds.has(queueType) || inferIsoTypeId(queueType));
  if (!shouldConvert) {
    return message;
  }

  if (typeof message !== 'string') {
    if (message && typeof message === 'object' && message.Document) {
      return messageObjectToXml(ensureIsoNamespaces(message, queueType));
    }
    return message;
  }

  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) {
    return message;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && parsed.Document
      ? messageObjectToXml(ensureIsoNamespaces(parsed, queueType))
      : message;
  } catch {
    return message;
  }
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
  if (sourcePayload && typeof sourcePayload === 'object') {
    sourceDoc = sourcePayload;
  } else {
    try {
      sourceDoc = JSON.parse(sourcePayload);
    } catch {
      sourceDoc = { src: sourcePayload };
    }
  }

  // For FIN payloads, auto-parse MT103 text when mapper expects swift-mt103 fields.
  const sourceTypeId = String(mapping.sourceTypeId || '').toLowerCase();
  if (sourceTypeId === 'swift-mt103' && typeof sourcePayload === 'string') {
    const normalizedPayload = sourcePayload
      .replaceAll('\\r\\n', '\n')
      .replaceAll('\\n', '\n');
    const hasBlock4 = sourceDoc && typeof sourceDoc === 'object' && sourceDoc.block4 && typeof sourceDoc.block4 === 'object';
    if (!hasBlock4 && isMT103FinText(normalizedPayload)) {
      sourceDoc = parseMT103FinText(normalizedPayload);
    }
  }

  const out = {};
  for (const item of mapping.items) {
    const srcValue = getJsonPathValue(sourceDoc, item.sourcePath);
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

  const openIdx = expr.indexOf('(');
  const closeIdx = expr.lastIndexOf(')');
  const hasCallShape = openIdx > 0 && closeIdx > openIdx;
  if (!hasCallShape) {
    return sourceMessage;
  }

  const fnName = toUpperCopy(trimCopy(expr.slice(0, openIdx)));
  const inside = trimCopy(expr.slice(openIdx + 1, closeIdx));

  if (fnName === 'MAP') {
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

  if (fnName === 'FROMXML') {
    const payload = evaluateTransformExpr(inside, sourceMessage, mappingsById, depth + 1);
    if (payload && typeof payload === 'object') return payload;
    const parsed = parseXmlMessage(payload);
    return parsed || payload;
  }

  if (fnName === 'TOXML') {
    const payload = evaluateTransformExpr(inside, sourceMessage, mappingsById, depth + 1);
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
        return payload;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return parsed && typeof parsed === 'object' ? messageObjectToXml(parsed) : payload;
        } catch {
          return payload;
        }
      }
      return payload;
    }
    if (payload && typeof payload === 'object') {
      return messageObjectToXml(payload);
    }
    return String(payload ?? '');
  }

  return sourceMessage;
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

function splitTopLevelCsv(text) {
  const src = String(text || '');
  const out = [];
  let quote = null;
  let depth = 0;
  let token = '';

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\' && i + 1 < src.length) {
        token += ch + src[i + 1];
        i += 1;
        continue;
      }
      token += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      quote = ch;
      token += ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      token += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      token += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      out.push(trimCopy(token));
      token = '';
      continue;
    }
    token += ch;
  }

  if (token.length > 0) out.push(trimCopy(token));
  return out.filter(Boolean);
}

function parseGenericOperand(text) {
  const raw = trimCopy(text || '');
  return {
    raw,
    args: splitTopLevelCsv(raw)
  };
}

function tokenValue(token, stack, frame) {
  const t = trimCopy(token || '');
  if (!t) return undefined;

  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\'') && t.endsWith('\''))) {
    return unquote(t);
  }

  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);

  if (t === '$TOP') {
    return stack.length > 0 ? stack[stack.length - 1] : 0;
  }

  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(t)) {
    return resolveVar(frame, t);
  }

  return t;
}

function assignTarget(frame, target, value, stack) {
  const t = trimCopy(target || '');
  if (!t) {
    stack.push(value);
    return;
  }
  if (t === '$PUSH') {
    stack.push(value);
    return;
  }
  assignVar(frame, t, value);
}

function ensureQueueEntry(store, key, defaults) {
  if (!store.has(key)) {
    store.set(key, { ...defaults, items: [] });
  }
  return store.get(key);
}

function queueKey(raw, fallbackPrefix) {
  const t = trimCopy(String(raw || ''));
  if (!t) return `${fallbackPrefix}:default`;
  return `${fallbackPrefix}:${t}`;
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
    } else if (
      mnemonic === 'FORK'
      || mnemonic === 'JOIN_ALL'
      || mnemonic === 'JOIN'
      || mnemonic === 'SYNC'
      || mnemonic === 'FORK_SUBFLOW'
      || mnemonic === 'BQ_NEW_STATIC'
      || mnemonic === 'BQ_NEW_DYNAMIC'
      || mnemonic === 'BQ_ENQ'
      || mnemonic === 'BQ_DEQ'
      || mnemonic === 'BQ_PEEK'
      || mnemonic === 'STK_NEW_STATIC'
      || mnemonic === 'STK_NEW_DYNAMIC'
      || mnemonic === 'STK_PUSH'
      || mnemonic === 'STK_POP'
      || mnemonic === 'STK_PEEK'
      || mnemonic === 'PQ_NEW_STATIC'
      || mnemonic === 'PQ_NEW_DYNAMIC'
      || mnemonic === 'PQ_ENQ'
      || mnemonic === 'PQ_DEQ'
      || mnemonic === 'PQ_PEEK'
      || mnemonic === 'FILE_OPEN'
      || mnemonic === 'FILE_READ'
      || mnemonic === 'FILE_WRITE'
      || mnemonic === 'FILE_CLOSE'
      || mnemonic === 'OP_MAP'
      || mnemonic === 'DL_LOAD_SCHEMA'
      || mnemonic === 'DL_LOAD_MAP'
      || mnemonic === 'SRV_CALL'
      || mnemonic === 'ROUTE_SERVICE'
      || mnemonic === 'ROUTE_QUEUE'
      || mnemonic === 'ROUTE_FILE'
    ) {
      instr.operand = parseGenericOperand(rest);
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

async function executeProgram({ instructions, opcodeMap, mappingsById, queueTypesByName = new Map(), isoTypeIds = new Set(), inputQueue, sourceMessage, runtimeContext = {} }) {
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
  const taskTable = new Map();
  const queues = new Map();
  const stacks = new Map();
  const pqueues = new Map();
  const fileHandles = new Map();
  const schemaHandles = new Map();
  const mapHandles = new Map();
  let nextTaskId = 1;
  let nextFileHandle = 1;
  let nextSchemaHandle = 1;
  let nextMapHandle = 1;
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
      const queueName = String(instr.operand || '');
      const outputMessages = expandOutputMessages(currentMessage);
      for (const oneMessage of outputMessages) {
        deliveries.push({
          queueName,
          message: maybeConvertIsoDelivery(queueName, oneMessage, queueTypesByName, isoTypeIds)
        });
      }
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

    if (op === 'FORK') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const label = trimCopy(args[0] || instr.operand?.raw || 'task');
      const taskId = nextTaskId;
      nextTaskId += 1;
      taskTable.set(taskId, { id: taskId, label, status: 'done' });
      stack.push(taskId);
      pc += 1;
      continue;
    }

    if (op === 'JOIN_ALL') {
      const allDone = [...taskTable.values()].every(t => t.status === 'done');
      stack.push(allDone ? 1 : 0);
      pc += 1;
      continue;
    }

    if (op === 'JOIN' || op === 'SYNC') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const rawTaskRef = args.length > 0 ? tokenValue(args[0], stack, currentFrame) : stack.pop();
      const taskId = Number(rawTaskRef || 0);

      let task = null;
      if (!Number.isNaN(taskId) && taskTable.has(taskId)) {
        task = taskTable.get(taskId);
      } else if (typeof rawTaskRef === 'string') {
        task = [...taskTable.values()].find(t => t.label === rawTaskRef || t.subflow === rawTaskRef) || null;
      }

      stack.push(task && task.status === 'done' ? 1 : 0);
      pc += 1;
      continue;
    }

    if (op === 'FORK_SUBFLOW') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const subflow = unquote(args[0] || '');
      const taskId = nextTaskId;
      nextTaskId += 1;
      taskTable.set(taskId, { id: taskId, subflow, status: 'done' });
      stack.push(taskId);
      pc += 1;
      continue;
    }

    if (op === 'BQ_NEW_STATIC' || op === 'BQ_NEW_DYNAMIC') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'queue');
      const capacity = op === 'BQ_NEW_STATIC' ? Number(args[1] || 0) || 0 : 0;
      ensureQueueEntry(queues, key, { type: 'queue', capacity, dynamic: op === 'BQ_NEW_DYNAMIC' });
      pc += 1;
      continue;
    }

    if (op === 'BQ_ENQ') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'queue');
      const q = ensureQueueEntry(queues, key, { type: 'queue', capacity: 0, dynamic: true });
      const value = args.length >= 2 ? tokenValue(args[1], stack, currentFrame) : stack.pop();
      if (q.capacity > 0 && q.items.length >= q.capacity) {
        state.__queue_overflow = key;
      } else {
        q.items.push(value);
      }
      pc += 1;
      continue;
    }

    if (op === 'BQ_DEQ' || op === 'BQ_PEEK') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'queue');
      const q = ensureQueueEntry(queues, key, { type: 'queue', capacity: 0, dynamic: true });
      const value = q.items.length > 0 ? (op === 'BQ_DEQ' ? q.items.shift() : q.items[0]) : null;
      if (value === null || value === undefined) state.__queue_underflow = key;
      assignTarget(currentFrame, args[1], value ?? 0, stack);
      pc += 1;
      continue;
    }

    if (op === 'STK_NEW_STATIC' || op === 'STK_NEW_DYNAMIC') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'stack');
      const capacity = op === 'STK_NEW_STATIC' ? Number(args[1] || 0) || 0 : 0;
      ensureQueueEntry(stacks, key, { type: 'stack', capacity, dynamic: op === 'STK_NEW_DYNAMIC' });
      pc += 1;
      continue;
    }

    if (op === 'STK_PUSH') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'stack');
      const st = ensureQueueEntry(stacks, key, { type: 'stack', capacity: 0, dynamic: true });
      const value = args.length >= 2 ? tokenValue(args[1], stack, currentFrame) : stack.pop();
      if (st.capacity > 0 && st.items.length >= st.capacity) {
        state.__stack_overflow = key;
      } else {
        st.items.push(value);
      }
      pc += 1;
      continue;
    }

    if (op === 'STK_POP' || op === 'STK_PEEK') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'stack');
      const st = ensureQueueEntry(stacks, key, { type: 'stack', capacity: 0, dynamic: true });
      const value = st.items.length > 0 ? (op === 'STK_POP' ? st.items.pop() : st.items[st.items.length - 1]) : null;
      if (value === null || value === undefined) state.__stack_underflow = key;
      assignTarget(currentFrame, args[1], value ?? 0, stack);
      pc += 1;
      continue;
    }

    if (op === 'PQ_NEW_STATIC' || op === 'PQ_NEW_DYNAMIC') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'pqueue');
      const capacity = op === 'PQ_NEW_STATIC' ? Number(args[1] || 0) || 0 : 0;
      ensureQueueEntry(pqueues, key, { type: 'pqueue', capacity, dynamic: op === 'PQ_NEW_DYNAMIC' });
      pc += 1;
      continue;
    }

    if (op === 'PQ_ENQ') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'pqueue');
      const pq = ensureQueueEntry(pqueues, key, { type: 'pqueue', capacity: 0, dynamic: true });
      const value = args.length >= 2 ? tokenValue(args[1], stack, currentFrame) : stack.pop();
      let priority = 0;
      if (typeof value === 'number') priority = value;
      else if (value && typeof value === 'object' && Number.isFinite(Number(value.priority))) priority = Number(value.priority);
      pq.items.push({ value, priority });
      pq.items.sort((a, b) => b.priority - a.priority);
      if (pq.capacity > 0 && pq.items.length > pq.capacity) {
        pq.items.length = pq.capacity;
        state.__pqueue_overflow = key;
      }
      pc += 1;
      continue;
    }

    if (op === 'PQ_DEQ' || op === 'PQ_PEEK') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const key = queueKey(args[0], 'pqueue');
      const pq = ensureQueueEntry(pqueues, key, { type: 'pqueue', capacity: 0, dynamic: true });
      const entry = pq.items.length > 0 ? (op === 'PQ_DEQ' ? pq.items.shift() : pq.items[0]) : null;
      if (!entry) state.__pqueue_underflow = key;
      assignTarget(currentFrame, args[1], entry ? entry.value : 0, stack);
      pc += 1;
      continue;
    }

    if (op === 'FILE_OPEN') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const fileId = unquote(args[0] || `file-${nextFileHandle}`);
      const mode = unquote(args[1] || 'read');
      const handle = nextFileHandle;
      nextFileHandle += 1;
      fileHandles.set(handle, { fileId, mode, cursor: 0, rows: [] });
      stack.push(handle);
      pc += 1;
      continue;
    }

    if (op === 'FILE_READ') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const handle = Number(tokenValue(args[0], stack, currentFrame) || 0);
      const target = args[1] || '$PUSH';
      const file = fileHandles.get(handle);
      const value = file && file.cursor < file.rows.length ? file.rows[file.cursor++] : '';
      assignTarget(currentFrame, target, value, stack);
      pc += 1;
      continue;
    }

    if (op === 'FILE_WRITE') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const handle = Number(tokenValue(args[0], stack, currentFrame) || 0);
      const source = args[1];
      const file = fileHandles.get(handle);
      if (file) {
        const value = source ? tokenValue(source, stack, currentFrame) : stack.pop();
        file.rows.push(value);
      }
      pc += 1;
      continue;
    }

    if (op === 'FILE_CLOSE') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const handle = Number(tokenValue(args[0], stack, currentFrame) || 0);
      fileHandles.delete(handle);
      pc += 1;
      continue;
    }

    if (op === 'OP_MAP') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const inputExpr = args[0] || 'SRC';
      const mapName = unquote(args[1] || '');
      const target = args[2] || '$PUSH';
      const payload = toUpperCopy(inputExpr) === 'SRC'
        ? currentMessage
        : String(tokenValue(inputExpr, stack, currentFrame) ?? '');
      const mapped = runMappingById(mapName, payload, mappingsById);
      currentMessage = mapped;
      assignTarget(currentFrame, target, mapped, stack);
      pc += 1;
      continue;
    }

    if (op === 'DL_LOAD_SCHEMA') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const name = unquote(args[0] || 'default-schema');
      const handle = nextSchemaHandle;
      nextSchemaHandle += 1;
      schemaHandles.set(handle, { name });
      stack.push(handle);
      pc += 1;
      continue;
    }

    if (op === 'DL_LOAD_MAP') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const name = unquote(args[0] || 'default-map');
      const handle = nextMapHandle;
      nextMapHandle += 1;
      mapHandles.set(handle, { name });
      stack.push(handle);
      pc += 1;
      continue;
    }

    if (op === 'SRV_CALL') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const serviceId = unquote(args[0] || '');
      const endpoint = unquote(args[1] || '');
      const inputExpr = args[2] || 'SRC';
      const payload = toUpperCopy(inputExpr) === 'SRC'
        ? currentMessage
        : String(tokenValue(inputExpr, stack, currentFrame) ?? '');

      const invokeService = typeof runtimeContext.invokeService === 'function'
        ? runtimeContext.invokeService
        : async () => ({ success: true, response: payload, errorMessage: null });

      const callResult = await invokeService({ serviceId, endpoint, payload });
      const responseValue = callResult?.response ?? payload;
      currentMessage = typeof responseValue === 'string' ? responseValue : JSON.stringify(responseValue);
      state.__last_service_call = {
        serviceId,
        endpoint,
        success: Boolean(callResult?.success !== false),
        error: callResult?.errorMessage || null
      };
      stack.push(Boolean(callResult?.success !== false) ? 1 : 0);
      pc += 1;
      continue;
    }

    if (op === 'ROUTE_SERVICE' || op === 'ROUTE_QUEUE' || op === 'ROUTE_FILE') {
      const args = Array.isArray(instr.operand?.args) ? instr.operand.args : [];
      const id = unquote(args[0] || instr.operand?.raw || '');
      state.__placement = {
        kind: op === 'ROUTE_SERVICE' ? 'service' : (op === 'ROUTE_QUEUE' ? 'queue' : 'file'),
        id
      };
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

async function executeSingleMessage(args, { printOutput = true } = {}) {
  const pcodePath = path.resolve(args.pcode);
  const programMapPath = path.resolve(args.programMap);
  const pcodeText = await fs.readFile(pcodePath, 'utf-8');
  const programMap = JSON.parse(await fs.readFile(programMapPath, 'utf-8'));
  const sourceMessage = await readMessage(args);

  const opcodeMap = await loadOpcodeMap();
  const mappingsById = parseProgramMapMappings(programMap);
  const queueTypesByName = parseProgramMapQueueTypes(programMap);
  const isoTypeIds = await loadLibrarianIsoTypeIds();
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
  const invokeService = async ({ serviceId, endpoint, payload }) => {
    const endpointText = String(endpoint || '').trim();
    if (endpointText.startsWith('mock://')) {
      return {
        success: true,
        response: payload,
        errorCode: null,
        errorMessage: null
      };
    }

    const base = String(args.backendUrl || 'http://localhost:4000').replace(/\/$/, '');
    const url = endpointText.startsWith('http://') || endpointText.startsWith('https://')
      ? endpointText
      : (endpointText.startsWith('/') ? `${base}${endpointText}` : `${base}/${endpointText}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': String(args.actorUserId || 'system-admin'),
          'x-service-id': String(serviceId || '')
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
    } catch (error) {
      return {
        success: false,
        response: null,
        errorCode: 'network_error',
        errorMessage: error?.message || String(error)
      };
    }
  };

  const startedAt = Date.now();
  const result = await executeProgram({
    instructions,
    opcodeMap,
    mappingsById,
    queueTypesByName,
    isoTypeIds,
    inputQueue: args.inputQueue,
    sourceMessage,
    runtimeContext: {
      invokeSubflow,
      invokeService,
      serviceId: args.serviceId || ''
    }
  });
  const durationMs = Date.now() - startedAt;
  const fitness = buildFitnessReport({
    args,
    sourceMessage,
    result,
    durationMs,
    deliveryCount: result.deliveries.length,
    mode: 'single'
  });
  await appendFitnessRecord(args.fitnessOut, fitness);

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
    error: result.error || null,
    fitness
  };

  if (printOutput) {
    console.log(JSON.stringify(out, null, 2));
  }

  return out;
}

export async function runSingleMessageForEvolution(args) {
  return executeSingleMessage(args, { printOutput: false });
}

async function runSingleMessage(args) {
  await executeSingleMessage(args, { printOutput: true });
}

async function pollAndRoute(args) {
  const pcodePath = path.resolve(args.pcode);
  const programMapPath = path.resolve(args.programMap);
  const queuePath = path.resolve(args.queuePath);
  
  const pcodeText = await fs.readFile(pcodePath, 'utf-8');
  const programMap = JSON.parse(await fs.readFile(programMapPath, 'utf-8'));
  
  const opcodeMap = await loadOpcodeMap();
  const mappingsById = parseProgramMapMappings(programMap);
  const queueTypesByName = parseProgramMapQueueTypes(programMap);
  const isoTypeIds = await loadLibrarianIsoTypeIds();
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

    if (typeof qm.loadFromDisk === 'function') {
      qm.loadFromDisk();
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
      const startedAt = Date.now();
      const result = await executeProgram({
        instructions,
        opcodeMap,
        mappingsById,
        queueTypesByName,
        isoTypeIds,
        inputQueue: args.inputQueue,
        sourceMessage
      });
      const durationMs = Date.now() - startedAt;
      const fitness = buildFitnessReport({
        args,
        sourceMessage,
        result,
        durationMs,
        deliveryCount: result.deliveries.length,
        mode: 'poll'
      });
      await appendFitnessRecord(args.fitnessOut, fitness);
      
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
