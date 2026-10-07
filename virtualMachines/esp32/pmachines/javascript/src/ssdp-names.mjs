import http from 'node:http';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { createBoundedTextBindings } from './bounded-text.mjs';

const privateIPv4 = ip => net.isIP(ip) === 4 && (ip.startsWith('10.') ||
  ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function descriptionTarget(location, peer, allowedPeers = [], allowedPorts = [80, 8200]) {
  if (typeof location !== 'string' || location.length > 256 ||
      !/^http:\/\/[0-9.]+(?::[0-9]+)?(?:\/|$)/.test(location)) throw new Error('Description requires literal IPv4 HTTP URL');
  const url = new URL(location);
  const literal = /^http:\/\/([0-9.]+)/.exec(location)[1];
  if (!privateIPv4(literal) || literal !== url.hostname ||
      (url.hostname !== peer && !allowedPeers.includes(url.hostname)) ||
      url.username || url.password || location.includes('#') || !allowedPorts.includes(Number(url.port || 80))) {
    throw new Error('Description URL denied by peer/port policy');
  }
  return url;
}

function decode(text) {
  return text.replace(/&([^;]*);|&/g, (whole, entity) => {
    const known = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(known, entity)) return known[entity];
    if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity ?? '')) throw new Error('Invalid XML entity');
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!(code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0xd7ff ||
        code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff)) throw new Error('Invalid XML character');
    return String.fromCodePoint(code);
  });
}

// Deliberately bounded XML subset: no DTD, entity declarations, or external resources.
export function descriptionName(xml, uuid) {
  if (!uuidPattern.test(uuid) || Buffer.byteLength(xml) > 16384 || /<!DOCTYPE|<!ENTITY/i.test(xml) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) throw new Error('Invalid or oversized description XML');
  const container = { children: [], text: '' }, stack = [container];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g;
  let offset = 0, count = 0;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== offset || ++count > 2048) throw new Error('Malformed description XML');
    const token = match[0]; offset += token.length;
    const current = stack.at(-1);
    if (token.startsWith('<!--')) {
      if (token.slice(4, -3).includes('--')) throw new Error('Malformed XML comment');
    } else if (token.startsWith('<![CDATA[')) {
      if (stack.length === 1) throw new Error('CDATA outside XML root');
      current.text += token.slice(9, -3);
    } else if (token.startsWith('<?')) {
      if (!/^<\?[A-Za-z_][\w:.-]*(?:\s[\s\S]*)?\?>$/.test(token)) throw new Error('Malformed XML instruction');
    } else if (token.startsWith('</')) {
      const end = /^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(token);
      if (!end || stack.length === 1 || current.tag !== end[1]) throw new Error('Mismatched XML closing tag');
      stack.pop();
    } else if (token.startsWith('<')) {
      const start = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>$/.exec(token);
      if (!start || stack.length > 32) throw new Error('Malformed XML start tag');
      const attrs = new Set();
      for (const attr of start[2].matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g)) {
        if (attrs.has(attr[1])) throw new Error('Duplicate XML attribute');
        attrs.add(attr[1]); decode(attr[2].slice(1, -1));
      }
      const node = { tag: start[1], local: start[1].split(':').at(-1), children: [], text: '' };
      current.children.push(node);
      if (!start[3]) stack.push(node);
    } else {
      if (token.includes(']]>')) throw new Error('Malformed XML text');
      current.text += decode(token);
    }
  }
  if (offset !== xml.length || stack.length !== 1 || container.children.length !== 1 ||
      container.text.trim() || container.children[0].local !== 'root') throw new Error('Malformed XML root');
  const matches = [];
  function device(node) {
    const udns = node.children.filter(child => child.local === 'UDN');
    if (udns.length === 1 && !udns[0].children.length && udns[0].text.trim().toLowerCase() === `uuid:${uuid}`) matches.push(node);
    for (const list of node.children.filter(child => child.local === 'deviceList')) {
      for (const child of list.children.filter(child => child.local === 'device')) device(child);
    }
  }
  for (const root of container.children[0].children.filter(child => child.local === 'device')) device(root);
  if (matches.length !== 1) throw new Error('Description UUID missing or ambiguous');
  const names = matches[0].children.filter(child => child.local === 'friendlyName');
  const name = names[0]?.text.trim();
  if (names.length !== 1 || names[0].children.length || !name || Buffer.byteLength(name) > 256 ||
      /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Invalid friendlyName');
  return name;
}

export function fetchDescription(url, { signal, timeoutMs = 2000, maxBytes = 16384 } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { agent: false, signal }, response => {
      if (response.statusCode !== 200) {
        response.destroy(); reject(new Error(`Description HTTP ${response.statusCode}; redirects forbidden`)); return;
      }
      const chunks = []; let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxBytes) response.destroy(new Error('Description byte limit exceeded'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
        catch { reject(new Error('Description is not UTF-8 XML')); }
      });
    });
    // Absolute deadline includes headers and slow trickle bodies, not just idle sockets.
    const timer = setTimeout(() => request.destroy(new Error('Description timeout')), timeoutMs);
    request.on('error', reject);
    request.on('close', () => clearTimeout(timer));
  });
}

export function createSsdpNames({ clock = () => Math.floor(performance.now()), get = fetchDescription,
  allowedPeers = [], allowedPorts = [80, 8200], logger = console } = {}) {
  if (!Array.isArray(allowedPeers) || allowedPeers.some(ip => !privateIPv4(ip)) ||
      !Array.isArray(allowedPorts) || allowedPorts.length > 16 ||
      allowedPorts.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Invalid description peer/port policy');
  const entries = new Map(), header = createBoundedTextBindings()['host.text_header'];
  let active = 0, stopped = false;
  const controller = new AbortController();
  function expire() {
    const time = clock();
    for (const [key, entry] of entries) if (entry.deadline <= time) entries.delete(key);
    return time;
  }
  function pump() {
    expire();
    if (stopped) return;
    for (const [key, entry] of entries) {
      if (active >= 2) break;
      if (!entry.queued) continue;
      entry.queued = false; entry.pending = true; active++;
      Promise.resolve().then(() => get(entry.url, { signal: AbortSignal.any([
        controller.signal, AbortSignal.timeout(2000)]), timeoutMs: 2000, maxBytes: 16384 }))
        .then(xml => {
          entry.name = descriptionName(xml, key.slice(5)); entry.error = '';
          entry.resolvedAt = clock(); entry.retryAt = entry.resolvedAt + 300000;
        }, error => { throw error; })
        .catch(error => {
          entry.name = null; entry.error = error.message.slice(0, 160); entry.retryAt = clock() + 30000;
          if (!stopped) logger.warn(`[SSDP-NAMES] ${key}: ${entry.error}`);
        }).finally(() => { entry.pending = false; active--; pump(); });
    }
  }
  return {
    observe(unit, event) {
      if (stopped || unit !== 'ssdp-collector' || event.method !== 'UDP') return;
      const time = expire();
      const uuid = header(event.body, 'USN').toLowerCase().slice(5, 41), key = `ssdp:${uuid}`;
      if (!uuidPattern.test(uuid)) return;
      if (header(event.body, 'NTS').toLowerCase() === 'ssdp:byebye') { entries.delete(key); return; }
      const age = Math.min(180, Number(/max-age=(\d+)/i.exec(header(event.body, 'CACHE-CONTROL'))?.[1]));
      if (!age) return;
      let location = '', locationError = '';
      try { location = header(event.body, 'LOCATION'); }
      catch (error) { locationError = error.message.slice(0, 160); }
      let entry = entries.get(key);
      if (!entry || entry.location !== location || entry.peer !== event.peer) {
        if (!entry && entries.size >= 50) entries.delete(entries.keys().next().value);
        entry = { location, peer: event.peer, deadline: time + age * 1000, name: null,
          error: '', retryAt: 0, pending: false, queued: false };
        entries.set(key, entry);
        try {
          if (locationError) throw new Error(locationError);
          entry.url = descriptionTarget(location, event.peer, allowedPeers, allowedPorts);
        }
        catch (error) { entry.error = error.message; }
      }
      entry.deadline = time + age * 1000;
      if (entry.url && time >= entry.retryAt && !entry.pending) { entry.queued = true; pump(); }
    },
    resolve(key, device) {
      const time = expire(), entry = entries.get(key);
      if (device.protocol !== 'ssdp') return null;
      if (!entry || entry.peer !== device.address) return { status: 'fallback', provenance: 'UUID label',
        error: 'No current accepted LOCATION advertisement' };
      const usable = entry.name && time < entry.retryAt;
      return { status: usable ? 'resolved' : 'fallback', provenance: usable ? 'UPnP description friendlyName' : 'UUID label',
        ...(usable ? { name: entry.name } : {}), location: entry.location,
        descriptionAgeMs: entry.resolvedAt === undefined ? null : time - entry.resolvedAt,
        error: entry.error || (usable ? '' : 'Description lookup pending or expired') };
    },
    stats: () => ({ entries: (expire(), entries.size), active }),
    stop() { stopped = true; controller.abort(); entries.clear(); }
  };
}
