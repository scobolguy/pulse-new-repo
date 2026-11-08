import { XMLParser } from 'fast-xml-parser';
import { getByPath, setJsonPathValue } from '../shared/json-path.mjs';
const trimCopy = value => String(value || '').trim();
const toUpperCopy = value => String(value || '').toUpperCase();

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: true,
  trimValues: true
});

const ISO_TYPE_PREFIXES = [
  'pacs', 'camt', 'pain', 'head', 'remt',
  'acmt', 'admi', 'auth', 'caaa', 'caam',
  'cain', 'catm', 'catp', 'reda', 'secl',
  'seev', 'semt', 'tsin'
];

export function inferIsoTypeId(typeId) {
  const id = String(typeId || '').trim().toLowerCase();
  if (!id) return false;
  return ISO_TYPE_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}-`) || id.startsWith(`${prefix}.`));
}


// --- SWIFT FIN text parser ---

export function isSwiftFinText(text) {
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

function transformParsedCapture(name, values) {
  const list = Array.isArray(values) ? values : [values];
  if (name === 'mtAmountToDecimal') return normalizeMtAmount(list[0]);
  if (name === 'yymmddToIso') return yyMmDdToIso(list[0]);
  if (name === 'integerString') return list[0] ? String(Number(list[0])) : '';
  if (name === 'concat') return list.map(value => String(value || '')).join('');
  if (name === 'mt940BookingDate') {
    const valueDate = yyMmDdToIso(list[0]);
    return list[1] ? `${valueDate.slice(0, 4)}-${String(list[1]).slice(0, 2)}-${String(list[1]).slice(2, 4)}` : valueDate;
  }
  return list.length === 1 ? list[0] : list;
}

function resolveParsedValue(spec, match, tag, raw) {
  let value;
  if (Object.prototype.hasOwnProperty.call(spec, 'constant')) value = spec.constant;
  else if (spec.source === 'raw') value = raw;
  else if (spec.tagValues) value = spec.tagValues[tag];
  else if (Array.isArray(spec.captures)) value = spec.captures.map(index => match?.[index] || '');
  else value = match?.[spec.capture] || '';
  if (spec.values) value = spec.values[value];
  return spec.transform ? transformParsedCapture(spec.transform, value) : value;
}

function applyParsedValues(target, specs, match, tag, raw) {
  for (const spec of Array.isArray(specs) ? specs : []) {
    const value = resolveParsedValue(spec, match, tag, raw);
    if (spec.omitEmpty && (value === '' || value == null)) continue;
    setJsonPathValue(target, spec.targetPath, value);
  }
}

export function parseSwiftFinText(text, sourceParsing = null) {
  const result = { block4: {} };
  if (sourceParsing?.createdAtPath) {
    setJsonPathValue(result, sourceParsing.createdAtPath, new Date().toISOString());
  }

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
      result.block4[`field${currentTag}`] = val;
      for (const rule of Array.isArray(sourceParsing?.fieldRules) ? sourceParsing.fieldRules : []) {
        if (!Array.isArray(rule.tags) || !rule.tags.includes(currentTag)) continue;
        const match = val.match(new RegExp(rule.pattern));
        if (!match) continue;
        const parsed = {};
        applyParsedValues(parsed, rule.values, match, currentTag, val);
        if (rule.append) {
          const current = getByPath(result, rule.outputPath);
          const list = Array.isArray(current) ? current : [];
          list.push(parsed);
          setJsonPathValue(result, rule.outputPath, list);
        } else {
          setJsonPathValue(result, rule.outputPath, parsed);
        }
      }
      const narrative = sourceParsing?.narrative;
      if (narrative?.tag === currentTag) {
        const entries = getByPath(result, narrative.entriesPath);
        if (Array.isArray(entries) && entries.length > 0) {
          const lastEntry = entries[entries.length - 1];
          const previous = getByPath(lastEntry, narrative.targetPath) || '';
          setJsonPathValue(lastEntry, narrative.targetPath, `${previous}${narrative.separator || ''}${val}`);
        }
      }
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

  for (const rule of Array.isArray(sourceParsing?.derivedRules) ? sourceParsing.derivedRules : []) {
    const raw = getByPath(result, rule.sourcePath);
    const match = String(raw || '').match(new RegExp(rule.pattern));
    if (match) applyParsedValues(result, rule.values, match, '', String(raw || ''));
  }

  const currencyRule = sourceParsing?.entryCurrency;
  if (currencyRule) {
    const currency = (Array.isArray(currencyRule.sourcePaths) ? currencyRule.sourcePaths : [])
      .map(sourcePath => getByPath(result, sourcePath))
      .find(Boolean) || '';
    const entries = getByPath(result, currencyRule.entriesPath);
    for (const entry of Array.isArray(entries) ? entries : []) {
      setJsonPathValue(entry, currencyRule.targetPath, currency);
    }
  }

  return result;
}


export function normalizeMtAmount(raw) {
  return trimCopy(raw).replaceAll(' ', '').replaceAll(',', '.');
}

export function yyMmDdToIso(raw) {
  const src = trimCopy(raw);
  const m = src.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return src;
  const yy = Number.parseInt(m[1], 10);
  const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${yyyy}-${m[2]}-${m[3]}`;
}

export function extractMtPartyName(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => trimCopy(line))
    .filter(Boolean);
  const nonAccount = lines.filter((line) => !line.startsWith('/'));
  return nonAccount[0] || lines[0] || '';
}

export function mapMtChargeBearerToIso(raw) {
  const code = toUpperCopy(trimCopy(raw));
  if (code === 'OUR') return 'DEBT';
  if (code === 'BEN') return 'CRED';
  return code;
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

export function messageObjectToXml(messageObject) {
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

export function expandOutputMessages(message) {
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


function ensurePacsNamespaces(messageObject) {
  if (!messageObject || typeof messageObject !== 'object') {
    return messageObject;
  }

  const docRoot = messageObject.Document;
  if (!docRoot || typeof docRoot !== 'object') {
    return messageObject;
  }

  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns')) {
    docRoot['@xmlns'] = docRoot.FIToFICdtTrf
      ? 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.13'
      : 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14';
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

export function ensureCamtNamespaces(messageObject, configuredNamespace = '') {
  if (!messageObject || typeof messageObject !== 'object') return messageObject;
  const docRoot = messageObject.Document;
  if (!docRoot || typeof docRoot !== 'object') return messageObject;
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns')) {
    docRoot['@xmlns'] = configuredNamespace || resolveCamtNamespace(docRoot);
  }
  if (!Object.prototype.hasOwnProperty.call(docRoot, '@xmlns:xsi')) {
    docRoot['@xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
  }
  return messageObject;
}

export function ensureIsoNamespaces(messageObject, queueType) {
  const typeId = String(queueType || '').trim().toLowerCase();
  if (typeId === 'pacs' || typeId.startsWith('pacs')) return ensurePacsNamespaces(messageObject);
  if (typeId === 'camt' || typeId.startsWith('camt')) return ensureCamtNamespaces(messageObject);
  return messageObject;
}


export function maybeConvertIsoDelivery(queueName, message, queueTypes, isoTypeIds = new Set()) {
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
