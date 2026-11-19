const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

function failure(message, status = 400, details = {}) {
  return Object.assign(new Error(message), { status, ...details });
}

function validXmlCharacter(codePoint) {
  return codePoint === 9 || codePoint === 10 || codePoint === 13
    || codePoint >= 0x20 && codePoint <= 0xd7ff
    || codePoint >= 0xe000 && codePoint <= 0xfffd
    || codePoint >= 0x10000 && codePoint <= 0x10ffff;
}

function appendCodePoint(codePoint) {
  if (!validXmlCharacter(codePoint)) throw failure('Invalid XML character reference');
  return String.fromCodePoint(codePoint);
}

function decodeEntities(value) {
  return value.replace(/&([^;]*);|&/g, (entity, name) => {
    if (name === undefined) throw failure('Unterminated XML entity');
    if (name === 'amp') return '&';
    if (name === 'lt') return '<';
    if (name === 'gt') return '>';
    if (name === 'quot') return '"';
    if (name === 'apos') return '\'';
    if (/^#\d+$/.test(name)) return appendCodePoint(Number(name.slice(1)));
    if (/^#x[0-9a-f]+$/i.test(name)) return appendCodePoint(Number.parseInt(name.slice(2), 16));
    throw failure(`Unknown XML entity: &${name};`);
  });
}

function splitQName(name) {
  const parts = name.split(':');
  if (parts.length > 2 || parts.some(part => !/^[A-Za-z_][A-Za-z0-9._-]*$/.test(part))) {
    throw failure(`Invalid XML qualified name: ${name}`);
  }
  return parts;
}

export class XmlEventReader {
  constructor(xml, { maxBytes = 1000000, maxNodes = 20000, maxDepth = 64 } = {}) {
    if (typeof xml !== 'string') throw failure('Expected XML text');
    for (const [name, value] of Object.entries({ maxBytes, maxNodes, maxDepth })) {
      if (!Number.isSafeInteger(value) || value < 1) throw failure(`Invalid XML limit: ${name}`);
    }
    this.xml = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
    this.position = 0;
    this.locationOffset = 0;
    this.locationLine = 1;
    this.locationColumn = 1;
    this.maxNodes = maxNodes;
    this.maxDepth = maxDepth;
    this.stack = [];
    this.rootCount = 0;
    this.nodeCount = 0;
    this.pendingEnd = false;
    this.finished = false;
    if (Buffer.byteLength(this.xml) > maxBytes) {
      throw failure('XML stream capacity exceeded', 413, {
        ...this.location(), xmlDiagnostic: true
      });
    }
    for (let index = 0; index < this.xml.length;) {
      const codePoint = this.xml.codePointAt(index);
      if (!validXmlCharacter(codePoint)) {
        throw failure('Invalid XML character', 400, {
          ...this.location(index), xmlDiagnostic: true
        });
      }
      index += codePoint > 0xffff ? 2 : 1;
    }
  }

  fail(message) {
    const location = this.location();
    throw failure(`Invalid XML at line ${location.line}, position ${location.position}: ${message}`,
      400, { ...location, xmlDiagnostic: true });
  }

  location(offset = this.position) {
    let index = 0;
    let line = 1;
    let position = 1;
    if (offset >= this.locationOffset) {
      index = this.locationOffset;
      line = this.locationLine;
      position = this.locationColumn;
    }
    for (; index < offset;) {
      const codePoint = this.xml.codePointAt(index);
      if (codePoint === 10) {
        if (index === 0 || this.xml.charCodeAt(index - 1) !== 13) line += 1;
        position = 1;
      } else if (codePoint === 13) {
        line += 1;
        position = 1;
      } else {
        position += 1;
      }
      index += codePoint > 0xffff ? 2 : 1;
    }
    if (offset >= this.locationOffset) {
      this.locationOffset = offset;
      this.locationLine = line;
      this.locationColumn = position;
    }
    return { line, position };
  }

  startsWith(value) {
    return this.xml.startsWith(value, this.position);
  }

  whitespace() {
    while (this.position < this.xml.length && /[\t\n\r ]/.test(this.xml[this.position])) this.position += 1;
  }

  name() {
    const match = /^[A-Za-z_][A-Za-z0-9._:-]*/.exec(this.xml.slice(this.position));
    if (!match) this.fail('Expected XML name');
    this.position += match[0].length;
    splitQName(match[0]);
    return match[0];
  }

  readUntil(terminator, label) {
    const end = this.xml.indexOf(terminator, this.position);
    if (end < 0) this.fail(`Unterminated ${label}`);
    const value = this.xml.slice(this.position, end);
    this.position = end + terminator.length;
    return value;
  }

  text() {
    const start = this.position;
    while (this.position < this.xml.length && this.xml[this.position] !== '<') this.position += 1;
    const raw = this.xml.slice(start, this.position);
    if (raw.includes(']]>')) this.fail('CDATA terminator in text');
    let value;
    try { value = decodeEntities(raw); }
    catch (error) { this.fail(error.message); }
    if (!this.stack.length) {
      if (value.trim()) this.fail('Text outside root element');
      return null;
    }
    return value ? {
      kind: 'text',
      path: this.stack.map(frame => frame.localName).join('/').replace(/^/, '/'),
      text: value
    } : null;
  }

  next() {
    while (!this.finished) {
      if (this.pendingEnd) {
        this.pendingEnd = false;
        return this.closeElement();
      }
      if (this.position >= this.xml.length) {
        if (this.stack.length) this.fail('Unclosed element');
        if (this.rootCount !== 1) this.fail('Document must have exactly one root element');
        this.finished = true;
        return null;
      }
      if (!this.startsWith('<')) {
        const event = this.text();
        if (event) return event;
        continue;
      }
      if (this.startsWith('<!--')) {
        this.position += 4;
        const comment = this.readUntil('-->', 'comment');
        if (comment.includes('--')) this.fail('Invalid comment');
        continue;
      }
      if (this.startsWith('<![CDATA[')) {
        this.position += 9;
        const text = this.readUntil(']]>', 'CDATA section');
        if (!this.stack.length) this.fail('CDATA outside root element');
        if (text) {
          return {
            kind: 'text',
            path: this.stack.map(frame => frame.localName).join('/').replace(/^/, '/'),
            text
          };
        }
        continue;
      }
      if (this.startsWith('<?')) {
        this.position += 2;
        this.readUntil('?>', 'processing instruction');
        continue;
      }
      if (/^<!\s*(?:DOCTYPE|ENTITY)\b/i.test(this.xml.slice(this.position))) {
        this.fail('XML DTD and entity declarations are disabled');
      }
      if (this.startsWith('</')) {
        this.position += 2;
        const name = this.name();
        this.whitespace();
        if (this.xml[this.position] !== '>') this.fail('Expected closing angle bracket');
        this.position += 1;
        const frame = this.stack[this.stack.length - 1];
        if (!frame || frame.qName !== name) this.fail(`Mismatched closing element ${name}`);
        return this.closeElement();
      }
      if (this.startsWith('<!')) this.fail('Unsupported declaration');
      return this.openElement();
    }
    return null;
  }

  closeElement() {
    const frame = this.stack.pop();
    if (!frame) this.fail('Unexpected closing element');
    return {
      kind: 'end',
      name: frame.localName,
      namespace: frame.namespace,
      path: frame.path
    };
  }

  openElement() {
    this.position += 1;
    const qName = this.name();
    const attributes = Object.create(null);
    let selfClosing = false;
    for (;;) {
      this.whitespace();
      if (this.startsWith('/>')) {
        this.position += 2;
        selfClosing = true;
        break;
      }
      if (this.startsWith('>')) {
        this.position += 1;
        break;
      }
      if (this.position >= this.xml.length) this.fail('Unterminated start element');
      const name = this.name();
      if (Object.hasOwn(attributes, name)) this.fail(`Duplicate attribute ${name}`);
      this.whitespace();
      if (this.xml[this.position] !== '=') this.fail('Expected attribute assignment');
      this.position += 1;
      this.whitespace();
      const quote = this.xml[this.position];
      if (quote !== '"' && quote !== '\'') this.fail('Expected quoted attribute value');
      this.position += 1;
      const start = this.position;
      while (this.position < this.xml.length && this.xml[this.position] !== quote) {
        if (this.xml[this.position] === '<') this.fail('Less-than sign in attribute value');
        this.position += 1;
      }
      if (this.position >= this.xml.length) this.fail('Unterminated attribute value');
      try { attributes[name] = decodeEntities(this.xml.slice(start, this.position)); }
      catch (error) { this.fail(error.message); }
      this.position += 1;
    }
    if (this.stack.length >= this.maxDepth) {
      throw failure('XML depth capacity exceeded', 413, { ...this.location(), xmlDiagnostic: true });
    }
    this.nodeCount += 1;
    if (this.nodeCount > this.maxNodes) {
      throw failure('XML node capacity exceeded', 413, { ...this.location(), xmlDiagnostic: true });
    }
    if (!this.stack.length && ++this.rootCount > 1) this.fail('Document must have exactly one root element');

    const namespaces = Object.assign(Object.create(null), this.stack.at(-1)?.namespaces || { xml: XML_NAMESPACE });
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'xmlns') namespaces[''] = value;
      else if (name.startsWith('xmlns:')) {
        const prefix = name.slice(6);
        if (!prefix || prefix === 'xmlns' || (prefix === 'xml' && value !== XML_NAMESPACE)
          || (prefix !== 'xml' && value === XML_NAMESPACE) || value === XMLNS_NAMESPACE) {
          this.fail('Invalid namespace declaration');
        }
        namespaces[prefix] = value;
      }
    }
    const parts = splitQName(qName);
    if (parts.length === 2 && !Object.hasOwn(namespaces, parts[0])) this.fail(`Unbound namespace prefix ${parts[0]}`);
    const localName = parts.at(-1);
    const namespace = parts.length === 2 ? namespaces[parts[0]] : namespaces[''] || '';
    const path = `${this.stack.at(-1)?.path || ''}/${localName}`;
    const frame = { qName, localName, namespace, path, namespaces };
    this.stack.push(frame);
    if (selfClosing) this.pendingEnd = true;
    const visibleAttributes = {};
    for (const [name, value] of Object.entries(attributes)) {
      if (name !== 'xmlns' && !name.startsWith('xmlns:')) visibleAttributes[name] = value;
    }
    return { kind: 'start', name: localName, namespace, path, attributes: visibleAttributes };
  }
}

export function xmlEscapeText(value) {
  if (typeof value !== 'string') throw failure('Expected XML text to escape');
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;'
  })[character]);
}
