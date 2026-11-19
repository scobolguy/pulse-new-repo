import { createRequire } from 'node:module';
import { XmlEventReader, xmlEscapeText } from '../../shared/xml/xml-tokenizer.mjs';

const require = createRequire(new URL('../../../aggregator/package.json', import.meta.url));
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

function failure(message, status = 400, details = {}) {
  return Object.assign(new Error(message), { status, ...details });
}

function validateXmlSource(value, maxBytes, capacityMessage) {
  if (typeof value !== 'string') throw failure('Expected XML text');
  const size = Buffer.byteLength(value);
  if (size > maxBytes) throw failure(capacityMessage, 413);
  const markup = value.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, '');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(markup)) throw failure('XML DTD and entity declarations are disabled');
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)[^;\s<]*;/.test(markup)) {
    throw failure('Unknown XML entity');
  }
  const validCharacter = code => code === 9 || code === 10 || code === 13
    || code >= 32 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff;
  for (const character of value) {
    if (!validCharacter(character.codePointAt(0))) throw failure('Invalid XML character');
  }
  for (const match of markup.matchAll(/&#(x[0-9a-fA-F]+|\d+);/g)) {
    const code = match[1].startsWith('x') ? Number.parseInt(match[1].slice(1), 16) : Number(match[1]);
    if (!validCharacter(code)) throw failure('Invalid XML character reference');
  }
  return size;
}

export function createXmlStreamBindings({ maxBytes = 1000000, maxNodes = 20000, maxDepth = 64 } = {}) {
  for (const [name, value] of Object.entries({ maxBytes, maxNodes, maxDepth })) {
    if (!Number.isSafeInteger(value) || value < 1) throw failure(`Invalid XML stream limit: ${name}`);
  }
  const streams = new Map();
  let nextHandle = 1;

  function getStream(handle) {
    const state = streams.get(handle);
    if (!state) throw failure('Invalid XML stream handle');
    return state;
  }

  function nextSerializedEvent(handle, state) {
    try {
      feedUntilEvent(state);
    } catch (error) {
      streams.delete(handle);
      if (!error.xmlDiagnostic) {
        throw failure(error.message, error.status || 400, {
          ...state.reader.location(), xmlDiagnostic: true
        });
      }
      throw error;
    }
    if (state.events.length) return JSON.stringify(state.events.shift());
    streams.delete(handle);
    return '';
  }

  function addRecordValue(values, key, value) {
    if (!key) return;
    if (!Object.hasOwn(values, key)) values[key] = value;
    else if (Array.isArray(values[key])) values[key].push(value);
    else values[key] = [values[key], value];
  }

  function feedUntilEvent(state) {
    while (!state.events.length && !state.finished) {
      const event = state.reader.next();
      if (event) state.events.push(event);
      else state.finished = true;
    }
  }

  return {
    'host.xml_stream_open': (
      value, recordPath = '', headerPath = '', expectedNamespace = '', allowedPathsText = '[]'
    ) => {
      if (streams.size >= 8) throw failure('XML stream capacity exceeded', 413);
      let allowedPaths;
      try { allowedPaths = JSON.parse(allowedPathsText); }
      catch { throw failure('Invalid XML stream path manifest'); }
      if (!Array.isArray(allowedPaths) || allowedPaths.some(path => typeof path !== 'string')
        || (recordPath && (!headerPath || !expectedNamespace || !allowedPaths.includes(recordPath)
          || !allowedPaths.includes(headerPath)))) {
        throw failure('Invalid XML stream record configuration');
      }
      const state = {
        events: [], finished: false,
        recordPath, headerPath, expectedNamespace, allowedPaths: new Set(allowedPaths),
        capture: null, headerValues: null,
        reader: new XmlEventReader(value, { maxBytes, maxNodes, maxDepth })
      };
      const handle = nextHandle++;
      streams.set(handle, state);
      return handle;
    },
    'host.xml_stream_next': handle => {
      const state = getStream(handle);
      return nextSerializedEvent(handle, state);
    },
    'host.xml_stream_next_record': handle => {
      const state = getStream(handle);
      if (!state.recordPath) throw failure('XML stream has no record configuration');
      let serialized;
      while ((serialized = nextSerializedEvent(handle, state)) !== '') {
        const event = JSON.parse(serialized);
        if (event.kind === 'start') {
          const location = { ...state.reader.location(), xmlDiagnostic: true };
          if (event.namespace !== state.expectedNamespace) {
            throw failure('Unexpected XML namespace', 400, location);
          }
          if (!state.allowedPaths.has(event.path)) {
            throw failure(`Element is not declared in the XML profile: ${event.path}`, 400, location);
          }
          if (event.path === state.headerPath) {
            if (state.headerValues) throw failure('Duplicate XML group header', 400, location);
            state.capture = { mode: 'header', boundaryPath: state.headerPath, values: {}, frames: [] };
          } else if (event.path === state.recordPath) {
            if (state.capture || !state.headerValues) {
              throw failure('Transaction record is out of sequence', 400, location);
            }
            state.capture = { mode: 'transaction', boundaryPath: state.recordPath, values: {}, frames: [] };
          }
          if (state.capture) {
            const capture = state.capture;
            if (capture.frames.length) capture.frames[capture.frames.length - 1].hasChild = true;
            const relativePath = event.path === capture.boundaryPath
              ? '' : event.path.slice(capture.boundaryPath.length + 1).replaceAll('/', '.');
            const frame = { path: event.path, relativePath, text: '', hasChild: false };
            for (const [name, value] of Object.entries(event.attributes || {})) {
              addRecordValue(capture.values, `${relativePath}.${name}`, value);
            }
            capture.frames.push(frame);
          }
        } else if (event.kind === 'text' && state.capture && state.capture.frames.length) {
          state.capture.frames[state.capture.frames.length - 1].text += event.text;
        } else if (event.kind === 'end' && state.capture && state.capture.frames.length) {
          const capture = state.capture;
          const frame = capture.frames.pop();
          if (!frame.hasChild && frame.relativePath) {
            addRecordValue(capture.values, frame.relativePath, frame.text);
          }
          if (event.path === capture.boundaryPath) {
            state.capture = null;
            if (capture.mode === 'header') state.headerValues = capture.values;
            else return JSON.stringify({
              headerValues: state.headerValues,
              transactionValues: capture.values,
              ...Object.fromEntries(Object.entries(state.reader.location())
                .map(([name, value]) => [name, String(value)]))
            });
          }
        }
      }
      return '';
    },
    'host.xml_stream_close': handle => {
      streams.delete(handle);
      return 1;
    },
    'host.xml_escape_text': xmlEscapeText,
  };
}

export function createXmlBindings({
  maxBytes = 1000000, maxNodes = 20000, maxDepth = 64, streamMaxNodes = maxNodes
} = {}) {
  for (const [name, value] of Object.entries({ maxBytes, maxNodes, maxDepth, streamMaxNodes })) {
    if (!Number.isSafeInteger(value) || value < 1) throw failure(`Invalid XML limit: ${name}`);
  }
  const documents = new Map();
  let bytesHeld = 0;
  let nodesHeld = 0;
  let nextHandle = 1;
  function document(handle) {
    const value = documents.get(handle);
    if (!value) throw failure('Invalid XML document handle');
    return value;
  }
  function node(handle, index) {
    const entries = document(handle);
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) throw failure('XML node index out of bounds');
    return entries[index];
  }
  function qname(name, namespaces, attribute = false) {
    if (typeof name !== 'string') throw failure('Expected XML qualified name');
    const parts = name.trim().split(':');
    if (parts.length > 2 || parts.some(part => !/^[\p{L}_][\p{L}\p{N}\p{M}_.\-\u00b7]*$/u.test(part))) {
      throw failure('Invalid XML qualified name');
    }
    if (parts.length === 2 && !Object.hasOwn(namespaces, parts[0])) throw failure(`Unbound XML namespace prefix: ${parts[0]}`);
    return { localName: parts.at(-1), namespaceURI: parts.length === 2
      ? namespaces[parts[0]] : attribute ? '' : namespaces[''] || '' };
  }
  return {
    ...createXmlStreamBindings({ maxBytes, maxNodes: streamMaxNodes, maxDepth }),
    'host.xml_parse': value => {
      if (typeof value !== 'string') throw failure('Expected XML text');
      const size = Buffer.byteLength(value);
      if (size + bytesHeld > maxBytes || documents.size >= 8) throw failure('XML document capacity exceeded', 413);
      // No DTDs or custom entities: never consult external resources or expand user entities.
      validateXmlSource(value, maxBytes - bytesHeld, 'XML document capacity exceeded');
      const { XMLParser } = require('fast-xml-parser');
      const parser = new XMLParser({
        preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '',
        parseTagValue: false, parseAttributeValue: false, trimValues: false,
        htmlEntities: { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" },
        ignoreDeclaration: true, ignorePiTags: true, maxNestedTags: maxDepth
      });
      let ordered;
      try { ordered = parser.parse(value, true); }
      catch (error) { throw failure(`Invalid XML: ${error.message}`); }
      const entries = [];
      function visit(items, inherited, parent, depth) {
        if (depth > maxDepth) throw failure('XML depth capacity exceeded', 413);
        let previous = -1;
        for (const item of items) {
          const name = Object.keys(item).find(key => key !== ':@' && key !== '#text');
          if (!name) {
            if (parent >= 0 && Object.hasOwn(item, '#text')) entries[parent].text += item['#text'];
            else if (String(item['#text'] ?? '').trim()) throw failure('XML text outside root element');
            continue;
          }
          const attributes = item[':@'] || {};
          const namespaces = Object.assign(Object.create(null), inherited);
          for (const [key, uri] of Object.entries(attributes)) {
            if (key === 'xmlns') {
              if (uri === XML_NAMESPACE || uri === 'http://www.w3.org/2000/xmlns/') throw failure('Invalid XML namespace declaration');
              namespaces[''] = uri;
            }
            else if (key.startsWith('xmlns:')) {
              const prefix = key.slice(6);
              if (!uri || prefix === 'xmlns' || (prefix === 'xml' && uri !== XML_NAMESPACE)
                || (prefix !== 'xml' && uri === XML_NAMESPACE) || uri === 'http://www.w3.org/2000/xmlns/') {
                throw failure('Invalid XML namespace declaration');
              }
              namespaces[prefix] = uri;
            }
          }
          const expanded = qname(name, namespaces);
          const attributeNames = new Set();
          for (const key of Object.keys(attributes)) {
            if (key === 'xmlns' || key.startsWith('xmlns:')) continue;
            const resolved = qname(key, namespaces, true);
            const identity = `${resolved.namespaceURI}|${resolved.localName}`;
            if (attributeNames.has(identity)) throw failure('Duplicate expanded XML attribute');
            attributeNames.add(identity);
          }
          if (entries.length + nodesHeld >= maxNodes) throw failure('XML node capacity exceeded', 413);
          const index = entries.length;
          entries.push({ ...expanded, attributes, namespaces, parent, firstChild: -1, nextSibling: -1, end: 0, text: '' });
          if (previous >= 0) entries[previous].nextSibling = index;
          else if (parent >= 0) entries[parent].firstChild = index;
          previous = index;
          visit(item[name], namespaces, index, depth + 1);
          entries[index].end = entries.length;
        }
      }
      visit(ordered, { xml: XML_NAMESPACE }, -1, 0);
      if (!entries.length) throw failure('XML document has no root element');
      if (entries[0].nextSibling >= 0) throw failure('XML document must have exactly one root element');
      documents.set(nextHandle, entries);
      bytesHeld += size;
      nodesHeld += entries.length;
      return nextHandle++;
    },
    'host.xml_count': handle => document(handle).length,
    'host.xml_parent': (handle, index) => node(handle, index).parent,
    'host.xml_append_document': (handle, donorHandle) => {
      if (handle === donorHandle) throw failure('Cannot append an XML document to itself');
      const entries = document(handle);
      const donor = document(donorHandle);
      const offset = entries.length;
      const roots = entries.filter(entry => entry.parent < 0);
      const lastRoot = roots.at(-1);
      const appended = donor.map(entry => ({
        ...entry,
        parent: entry.parent < 0 ? -1 : entry.parent + offset,
        firstChild: entry.firstChild < 0 ? -1 : entry.firstChild + offset,
        nextSibling: entry.nextSibling < 0 ? -1 : entry.nextSibling + offset,
        end: entry.end + offset
      }));
      entries.push(...appended);
      lastRoot.nextSibling = offset;
      documents.delete(donorHandle);
      return offset;
    },
    'host.xml_local_name': (handle, index) => node(handle, index).localName,
    'host.xml_namespace': (handle, index) => node(handle, index).namespaceURI,
    'host.xml_attribute': (handle, index, name) => {
      if (typeof name !== 'string') throw failure('Expected XML attribute name');
      const attributes = node(handle, index).attributes;
      return Object.hasOwn(attributes, name) ? attributes[name] : '';
    },
    'host.xml_has_attribute': (handle, index, name) => {
      if (typeof name !== 'string') throw failure('Expected XML attribute name');
      return Object.hasOwn(node(handle, index).attributes, name) ? 1 : 0;
    },
    'host.xml_attribute_integer': (handle, index, name, fallback) => {
      if (typeof name !== 'string' || !Number.isInteger(fallback) || fallback < 0 || fallback > 2147483647) {
        throw failure('Invalid XML integer attribute arguments');
      }
      const attributes = node(handle, index).attributes;
      if (!Object.hasOwn(attributes, name)) return fallback;
      const value = attributes[name].trim();
      if (!/^\+?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) {
        throw failure(`Invalid XML integer attribute: ${name}`);
      }
      return Number(value);
    },
    'host.xml_qname_local': (handle, index, value) => qname(value, node(handle, index).namespaces).localName,
    'host.xml_qname_namespace': (handle, index, value) => qname(value, node(handle, index).namespaces).namespaceURI,
    'host.xml_first_child': (handle, index) => node(handle, index).firstChild,
    'host.xml_next_sibling': (handle, index) => node(handle, index).nextSibling,
    'host.xml_end': (handle, index) => node(handle, index).end,
    'host.xml_text': (handle, index) => node(handle, index).text
  };
}
