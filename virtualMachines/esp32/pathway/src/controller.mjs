import dgram from 'node:dgram';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createNodeAdapter, isDefinitiveRejection } from './node-adapter.mjs';
import { HOST_PROFILES } from '../../pmachines/shared/contracts/host-capabilities.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const ipOf = address => address?.replace(/^::ffff:/, '');

export function validateDefinition(definition) {
  const { name, replicas, idempotent, artifact } = definition ?? {};
  if (!identifier(name) || !Number.isInteger(replicas) || replicas < 1 || replicas > 16 ||
      typeof idempotent !== 'boolean' || artifact?.programMap?.runtimeUnit?.kind !== 'service' ||
      artifact.programMap.runtimeUnit.id !== name || artifact.programMap.hostBindingsVersion !== 1 ||
      typeof artifact.pcodeText !== 'string' || Buffer.byteLength(artifact.pcodeText) > 65536) {
    throw failure('Invalid server-class definition');
  }
  const endpoints = artifact.programMap.serviceEndpoints;
  const endpoint = Array.isArray(endpoints) ?
    endpoints.find(item => item?.verb === 'POST' && item.path === `/api/pathway/${name}`) : null;
  if (!Array.isArray(endpoints) || !endpoint || endpoints.length > 16 ||
      endpoints.some(item => !item || !['GET', 'POST'].includes(item.verb) ||
        typeof item.path !== 'string' || !/^\/api\/[A-Za-z0-9/_-]+$/.test(item.path)) ||
      new Set(endpoints.map(item => `${item.verb} ${item.path}`)).size !== endpoints.length) {
    throw failure('Server class requires its own /api/pathway/name POST endpoint');
  }
  const targets = artifact.programMap.targets;
  if (!Array.isArray(targets) || !targets.length || targets.some(target => !['js', 'esp32'].includes(target))) {
    throw failure('Invalid deployment targets');
  }
  const required = artifact.programMap.requiredHostCapabilities ?? [];
  if (!Array.isArray(required) || required.some(value => typeof value !== 'string')) throw failure('Invalid capability requirements');
  const networkPeers = definition.networkPeers;
  if (networkPeers !== undefined && (!Array.isArray(networkPeers) || networkPeers.length > 8 ||
      networkPeers.some(peer => net.isIP(peer?.ip) !== 4 || !Number.isInteger(peer.port) ||
        peer.port < 1 || peer.port > 65535))) throw failure('Invalid server-class network peer grants');
  const network = networkPeers === undefined ? {} : { networkPeers };
  return { name, replicas, idempotent, artifact, path: endpoint.path, ...network,
    revision: digest({ pcode: artifact.pcodeText, map: compactServiceHostProgramMap(artifact.programMap), ...network }) };
}

export class PathwayController {
  constructor({ stateFile, allowedHosts = ['127.0.0.1'], beaconTtlMs = 180000, reconcileMs = 2000,
    adapter = createNodeAdapter(), clock = Date.now, logger = console } = {}) {
    if (!stateFile || !Array.isArray(allowedHosts) || !allowedHosts.length ||
        allowedHosts.some(host => net.isIP(host) !== 4) ||
        !Number.isInteger(beaconTtlMs) || beaconTtlMs < 100 || !Number.isInteger(reconcileMs) || reconcileMs < 50) {
      throw failure('Invalid controller state file, allowed hosts or timing');
    }
    this.stateFile = path.resolve(stateFile);
    this.allowedHosts = new Set(allowedHosts);
    this.beaconTtlMs = beaconTtlMs;
    this.reconcileMs = reconcileMs;
    this.adapter = adapter;
    this.clock = clock;
    this.logger = logger;
    this.nodes = new Map();
    this.definitions = new Map();
    this.placements = [];
    this.errors = [];
    this.id = null;
    this.pending = null;
    this.cursor = new Map();
    this.inflight = 0;
  }
  report(message) {
    this.errors.push({ at: this.clock(), message });
    if (this.errors.length > 32) this.errors.shift();
    this.logger.warn(`[PATHWAY] ${message}`);
  }
  async open() {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    try { this.lock = await fs.open(`${this.stateFile}.lock`, 'wx'); }
    catch (error) {
      if (error.code === 'EEXIST') throw failure('Controller state is locked; ensure its owner is stopped before removing the lock', 409);
      throw error;
    }
    try {
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, stateFile: this.stateFile }));
      let saved;
      try { saved = JSON.parse(await fs.readFile(this.stateFile, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (saved) {
        if (saved.version !== 1 || !/^[a-f0-9]{8}$/.test(saved.id) || !Array.isArray(saved.definitions) ||
            !Array.isArray(saved.placements)) throw failure('Invalid controller state');
        this.id = saved.id;
        for (const definition of saved.definitions) {
          const valid = validateDefinition(definition);
          this.definitions.set(valid.name, valid);
        }
        // Never trust persisted liveness: adoption requires a fresh beacon and matching node status.
        this.savedPlacements = saved.placements;
      } else {
        this.id = randomUUID().slice(0, 8);
        this.savedPlacements = [];
      }
      await this.save();
    } catch (error) { await this.releaseLock(); throw error; }
    return this;
  }
  async save() {
    const text = JSON.stringify({ version: 1, id: this.id, definitions: [...this.definitions.values()],
      placements: this.savedPlacements ?? [] }, null, 2);
    const write = async () => {
      const temporary = `${this.stateFile}.${this.id}.tmp`;
      const file = await fs.open(temporary, 'w');
      try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
      await fs.rename(temporary, this.stateFile);
    };
    const pending = (this.savePending ?? Promise.resolve()).then(write, write);
    this.savePending = pending;
    await pending;
  }
  async define(definition) {
    if (!this.lock) throw failure('Controller is not open', 503);
    const valid = validateDefinition(definition);
    const existing = this.definitions.get(valid.name);
    if (existing && existing.revision !== valid.revision) {
      throw failure('Live artifact replacement is not supported; use a new server-class name', 409);
    }
    if (existing && valid.replicas < existing.replicas) throw failure('Scale-down is not supported in this first version', 409);
    if (this.definitions.size >= 32 && !existing) throw failure('Server-class capacity exceeded', 503);
    this.definitions.set(valid.name, valid);
    try { await this.save(); }
    catch (error) {
      if (existing) this.definitions.set(valid.name, existing); else this.definitions.delete(valid.name);
      throw error;
    }
    await this.reconcile();
  }
  observe(beacon, peerAddress) {
    const peer = ipOf(peerAddress);
    if (!this.allowedHosts.has(peer)) throw failure('Beacon peer is not in the deployment allowlist', 403);
    if (!beacon || !['nodeBeacon', 'machineAvailability'].includes(beacon.kind) ||
        !identifier(beacon.nodeId) || (beacon.ip && beacon.ip !== peer)) throw failure('Invalid node beacon');
    const port = beacon.httpPort ?? beacon.port ?? 80;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw failure('Invalid beacon HTTP port');
    const runtimeText = `${beacon.runtime ?? ''} ${beacon.hardware ?? ''}`.toLowerCase();
    const previous = this.nodes.get(beacon.nodeId);
    const runtime = /javascript|js-pmachine/.test(runtimeText) ? 'js' :
      /esp32/.test(runtimeText) ? 'esp32' : previous?.runtime ?? null;
    if (beacon.protocol && !['http', 'https'].includes(beacon.protocol)) throw failure('Invalid beacon protocol');
    const origin = `${beacon.protocol || 'http'}://${peer}:${beacon.protocol === 'https' ? beacon.httpsPort || 443 : port}`;
    if (this.nodes.size >= 256 && !previous) throw failure('Discovery capacity exceeded', 503);
    if (previous && previous.origin !== origin) {
      this.placements = this.placements.filter(item => item.nodeId !== beacon.nodeId);
    }
    const node = previous?.origin === origin ? previous : {};
    Object.assign(node, { id: beacon.nodeId, origin, runtime, seen: this.clock(),
      available: beacon.available !== false && beacon.availability?.available !== false,
      draining: beacon.draining === true || beacon.availability?.draining === true,
      retryAt: previous?.retryAt ?? 0, verified: previous?.origin === origin && previous.verified === true });
    this.nodes.set(beacon.nodeId, node);
  }
  eligible(node, definition) {
    return node.verified && node.runtime && node.available && !node.draining && this.clock() - node.seen < this.beaconTtlMs &&
      node.retryAt <= this.clock() && definition.artifact.programMap.targets.includes(node.runtime) &&
      (definition.artifact.programMap.requiredHostCapabilities ?? [])
        .every(capability => [...(HOST_PROFILES[node.runtime].capabilities ?? []),
          ...(node.serviceCapabilities?.[definition.name] ?? [])].includes(capability));
  }
  reconcile() {
    if (this.pending) return this.pending;
    this.pending = this.performReconcile().finally(() => { this.pending = null; });
    return this.pending;
  }
  async performReconcile() {
    if (!this.lock) throw failure('Controller is not open', 503);
    const next = [];
    const occupied = new Set();
    for (const node of this.nodes.values()) {
      if (node.verified || node.retryAt > this.clock() || this.clock() - node.seen >= this.beaconTtlMs) continue;
      try {
        const description = await this.adapter.describe(node);
        node.runtime = description.runtime;
        node.serviceCapabilities = description.serviceCapabilities ?? {};
        node.verified = true;
      } catch (error) {
        node.retryAt = this.clock() + this.reconcileMs * 2;
        this.report(`${node.id} capability probe: ${error.message}`);
      }
    }
    for (const definition of this.definitions.values()) {
      const candidates = [...this.nodes.values()].filter(node => this.eligible(node, definition));
      const prior = new Set([...this.placements, ...this.savedPlacements]
        .filter(item => item.name === definition.name && item.revision === definition.revision).map(item => item.nodeId));
      candidates.sort((a, b) => Number(prior.has(b.id)) - Number(prior.has(a.id)) || a.id.localeCompare(b.id));
      for (const node of candidates) {
        if (next.filter(item => item.name === definition.name).length >= definition.replicas) break;
        if (occupied.has(node.id)) continue;
        const collectorId = `pw-${this.id}-${definition.name}-${definition.revision}`;
        try {
          await this.adapter.install(node, definition, collectorId);
          if (this.nodes.get(node.id) !== node || !this.eligible(node, definition)) {
            this.report(`${node.id}/${definition.name}: placement invalidated while installing`);
            continue;
          }
          next.push({ name: definition.name, nodeId: node.id, origin: node.origin,
            revision: definition.revision, collectorId });
          occupied.add(node.id);
        } catch (error) {
          node.retryAt = this.clock() + this.reconcileMs * 2;
          this.report(`${node.id}/${definition.name}: ${error.message}`);
        }
      }
      if (next.filter(item => item.name === definition.name).length >= definition.replicas) {
        const collectorId = `pw-${this.id}-${definition.name}-${definition.revision}`;
        for (const node of candidates.filter(candidate => !occupied.has(candidate.id))) {
          try { await this.adapter.retire(node, collectorId); }
          catch (error) { this.report(`${node.id}/${definition.name} retirement: ${error.message}`); }
        }
      }
    }
    this.placements = next;
    this.savedPlacements = next;
    for (const node of this.nodes.values()) {
      if (this.clock() - node.seen >= this.beaconTtlMs) this.nodes.delete(node.id);
    }
    await this.save();
  }
  async send(name, record, { requestId } = {}) {
    if (!this.lock) throw failure('Controller is not open', 503);
    const definition = this.definitions.get(name);
    if (!definition) throw failure(`Unknown server class ${name}`, 404);
    if (typeof record !== 'string' || !/^[\x20-\x7e]*$/.test(record) || record.length > 512) {
      throw failure('Request must be a printable ASCII record of at most 512 bytes');
    }
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(requestId))) {
      throw failure('Invalid requester request ID');
    }
    if ((definition.artifact.programMap.requiredHostCapabilities?.includes('inventory.transaction') ||
        definition.artifact.programMap.inventoryRequestIdRequired) && !requestId) {
      throw failure('Inventory transactions require a stable requester request ID');
    }
    if (this.inflight >= 32) throw failure('Requester capacity exceeded', 503);
    this.inflight++;
    try {
      const candidates = this.placements.filter(item => item.name === name)
        .map(item => this.nodes.get(item.nodeId)).filter(node => node && this.eligible(node, definition));
      if (!candidates.length) throw failure(`No available server for ${name}`, 503);
      const start = (this.cursor.get(name) ?? 0) % candidates.length;
      this.cursor.set(name, start + 1);
      let lastError;
      for (let attempt = 0; attempt < (definition.idempotent ? Math.min(candidates.length, 2) : 1); attempt++) {
        const node = candidates[(start + attempt) % candidates.length];
        try {
          const reply = await this.adapter.send(node, definition, record, { requestId });
          if (!Number.isInteger(reply?.code) || typeof reply.data !== 'string' || reply.data.length > 512) {
            throw new Error('Invalid server reply record');
          }
          return { ...reply, nodeId: node.id };
        } catch (error) {
          if (isDefinitiveRejection(error)) throw Object.assign(error, { uncertain: false });
          lastError = error;
          node.retryAt = this.clock() + this.reconcileMs * 2;
          this.placements = this.placements.filter(item => item.nodeId !== node.id);
          this.report(`${node.id}/${name} request failed: ${error.message}`);
        }
      }
      throw Object.assign(failure(`Request outcome uncertain: ${lastError.message}`, 503), { uncertain: true });
    } finally { this.inflight--; }
  }
  snapshot() {
    return { controllerId: this.id, nodes: [...this.nodes.values()].map(node => ({
      ...node, live: this.clock() - node.seen < this.beaconTtlMs,
    })), classes: [...this.definitions.values()].map(({ name, replicas, idempotent }) => ({ name, replicas, idempotent })),
    placements: this.placements, errors: this.errors };
  }
  async listen({ udpPort = 4210, host = '0.0.0.0' } = {}) {
    if (!this.lock || this.socket) throw failure('Controller must be open and not already listening', 409);
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.on('message', (message, peer) => {
      try {
        if (message.length > 8192) throw failure('Beacon exceeds 8 KiB');
        this.observe(JSON.parse(message), peer.address);
      } catch (error) { this.report(`Rejected beacon: ${error.message}`); }
    });
    await new Promise((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.bind(udpPort, host, resolve);
    });
    this.socket.removeAllListeners('error');
    this.socket.on('error', error => this.report(`Beacon socket: ${error.message}`));
    this.timer = setInterval(() => {
      this.reconcile().catch(error => this.report(`Reconciliation failed: ${error.message}`));
    }, this.reconcileMs);
    return this.socket.address();
  }
  async releaseLock() {
    if (this.lock) {
      await this.lock.close();
      this.lock = null;
      await fs.unlink(`${this.stateFile}.lock`);
    }
  }
  async close() {
    clearInterval(this.timer);
    try {
      if (this.socket) {
        const socket = this.socket;
        this.socket = null;
        await new Promise(resolve => socket.close(resolve));
      }
      if (this.pending) await this.pending;
      if (this.lock) await this.save();
    } finally { await this.releaseLock(); }
  }
}
