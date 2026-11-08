import { isSwiftFinText, parseSwiftFinText, normalizeMtAmount, yyMmDdToIso, extractMtPartyName, mapMtChargeBearerToIso, ensureCamtNamespaces } from '../swift/messages.mjs';
import { getJsonPathValue, setJsonPathValue } from '../shared/json-path.mjs';
const trimCopy = value => String(value || '').trim();
const toUpperCopy = value => String(value || '').toUpperCase();

function unquote(text) {
  const s = trimCopy(text);
  if (s.length < 2) return s;
  const q = s[0];
  if ((q === '"' || q === '\'') && s[s.length - 1] === q) {
    return s.slice(1, -1);
  }
  return s;
}

export function asStringValue(value) {
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

// Execute one compiled mapping rule (a flat opcode list) against a source value.
// Opcodes are stack-based: SRC loads the value, native string ops transform it,
// and the top of stack at the end is the rule result. No string interpretation.
export function execCompiledRule(ops, srcValue) {
  const st = [];
  for (const raw of Array.isArray(ops) ? ops : []) {
    const op = String(raw || '').trim();
    if (!op) continue;
    if (op === 'SRC') { st.push(srcValue); continue; }
    if (op === 'TRIM') { st.push(trimCopy(st.pop())); continue; }
    if (op === 'UPPER') { st.push(toUpperCopy(asStringValue(st.pop()))); continue; }
    if (op === 'YYMMDD_TO_ISO') { st.push(yyMmDdToIso(asStringValue(st.pop()))); continue; }
    if (op === 'MT_AMOUNT_TO_DECIMAL') { st.push(normalizeMtAmount(asStringValue(st.pop()))); continue; }
    if (op === 'MT_PARTY_NAME') { st.push(extractMtPartyName(asStringValue(st.pop()))); continue; }
    if (op === 'MT_CHARGE_TO_ISO') { st.push(mapMtChargeBearerToIso(asStringValue(st.pop()))); continue; }
    if (op.startsWith('PUSH_STR ')) { st.push(unquote(op.slice(9))); continue; }
    if (op.startsWith('PUSH_INT ')) { st.push(Number.parseInt(op.slice(9), 10) || 0); continue; }
    if (op === 'DUP' || op === 'OUTPUT' || op === 'RET') continue; // structural no-ops
  }
  return st.length > 0 ? st[st.length - 1] : srcValue;
}

export function runCompiledMapping(mapping, sourcePayload) {
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

  const sourceTypeId = String(mapping.sourceTypeId || '').toLowerCase().replaceAll('_', '-');
  if (sourceTypeId.startsWith('swift-mt') && typeof sourcePayload === 'string') {
    const normalizedPayload = String(sourcePayload).replaceAll('\\r\\n', '\n').replaceAll('\\n', '\n');
    const hasBlock4 = sourceDoc && typeof sourceDoc === 'object' && sourceDoc.block4 && typeof sourceDoc.block4 === 'object';
    if (!hasBlock4 && isSwiftFinText(normalizedPayload)) {
      sourceDoc = parseSwiftFinText(normalizedPayload, mapping.externalDefinition?.sourceParsing);
    }
  }

  const out = {};
  for (const item of mapping.items) {
    const srcValue = getJsonPathValue(sourceDoc, item.sourcePath);
    const transformed = execCompiledRule(item.ops, srcValue);
    setJsonPathValue(out, item.targetPath, transformed);
  }
  const targetTypeId = String(mapping.targetTypeId || '').toLowerCase().replaceAll('_', '-');
  return JSON.stringify(targetTypeId === 'camt'
    ? ensureCamtNamespaces(out, mapping.externalDefinition?.targetNamespace)
    : out);
}

export function runMappingById(mappingId, sourcePayload, mappingsById) {
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

  return runCompiledMapping(mapping, sourcePayload);
}
