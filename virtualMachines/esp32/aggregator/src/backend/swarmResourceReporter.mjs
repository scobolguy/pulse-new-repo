function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

function measured(value, label, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`Invalid measured ${label}`);
  return value;
}

function protectedEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (url.username || url.password || url.hash || url.search ||
      url.pathname !== '/api/swarm/resources/report' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' &&
        (url.hostname === '127.0.0.1' || url.hostname === '[::1]'))))
    throw new Error('Resource reporting requires HTTPS or numeric loopback HTTP');
  return url;
}

export function createSwarmResourceReporter({ endpoint, nodeId, serviceId, ownerAggregatorId, token, collect }) {
  const url = protectedEndpoint(endpoint);
  identifier(nodeId, 'node id');
  identifier(serviceId, 'service id');
  identifier(ownerAggregatorId, 'owner aggregator id');
  if (typeof token !== 'string' || token.length < 16 || token.length > 512 ||
      !/^[A-Za-z0-9._~-]+$/.test(token)) throw new Error('A private machine bearer credential is required');
  if (typeof collect !== 'function') throw new Error('A measured resource collector is required');
  let lastSequence = -1;
  let running = false;
  return {
    async reportOnce(sequence) {
      measured(sequence, 'report sequence', Number.MAX_SAFE_INTEGER);
      if (sequence <= lastSequence) throw new Error('Reporter sequence must increase');
      if (running) throw new Error('A resource report is already in progress');
      running = true;
      // Consume attempts as well as acknowledgements: a lost response may have
      // been accepted. The caller must persist sequence across process restarts.
      lastSequence = sequence;
      try {
        const resource = await collect();
        if (!['online', 'degraded', 'offline'].includes(resource.status))
          throw new Error('Collector must provide explicit node health');
        const body = {
          nodeId, serviceId, ownerAggregatorId, sequence, status: resource.status,
          estimatedFreeSlots: measured(resource.estimatedFreeSlots, 'free slots', 4096),
          freeMemoryBytes: measured(resource.freeMemoryBytes, 'free memory', 1024 * 1024 * 1024),
        };
        const response = await fetch(url, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (response.status !== 200)
          throw new Error(`Resource report rejected (HTTP ${response.status})`);
        const acknowledgement = await response.json();
        if (acknowledgement.status !== 'ok' || acknowledgement.nodeId !== nodeId)
          throw new Error('Resource report acknowledgement is inconsistent');
        return { sequence, status: resource.status };
      } finally {
        running = false;
      }
    },
  };
}

export async function collectEsp32Resources(origin) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/')
    throw new Error('Explicit ESP32 HTTP(S) origin is required');
  const read = async route => {
    const response = await fetch(new URL(route, url), {
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) throw new Error(`ESP32 resource probe failed (HTTP ${response.status})`);
    return response.json();
  };
  // Sequential observations avoid stressing the small board's HTTP capacity.
  const health = await read('/status');
  const machine = await read('/pmachine/status');
  const host = await read('/pmachine/service_host/status');
  if (!['ok', 'degraded'].includes(health.status) || typeof machine.running !== 'boolean' ||
      typeof host.running !== 'boolean' || host.executionModel !== 'single-worker' ||
      host.workerTaskCount !== 1)
    throw new Error('ESP32 resource snapshot has unsupported health/execution metadata');
  const freeMemoryBytes = Math.min(
    measured(health.freeHeap, 'health heap', 1024 * 1024 * 1024),
    measured(machine.memoryPressure?.freeHeapBytes, 'machine heap', 1024 * 1024 * 1024),
    measured(host.freeHeapBytes, 'host heap', 1024 * 1024 * 1024),
  );
  return {
    nodeName: identifier(health.nodeName, 'observed node name'),
    status: health.status === 'ok' ? 'online' : 'degraded',
    estimatedFreeSlots: machine.running || host.running ? 0 : 1, freeMemoryBytes,
  };
}

export async function collectJsPmachineResources(origin) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/')
    throw new Error('Explicit JavaScript PMachine HTTP(S) origin is required');
  const response = await fetch(new URL('/status', url), { signal: AbortSignal.timeout(10000) });
  if (response.status !== 200) throw new Error(`JavaScript PMachine probe failed (HTTP ${response.status})`);
  const status = await response.json();
  const capacity = status.resourceCapacity;
  if (status.runtime !== 'js-pmachine' || typeof status.nodeName !== 'string' ||
      !['online', 'degraded'].includes(capacity?.status))
    throw new Error('JavaScript PMachine status lacks verified scheduler resource metadata');
  return {
    nodeName: identifier(status.nodeName, 'observed node name'),
    status: capacity.status,
    estimatedFreeSlots: measured(capacity.estimatedFreeSlots, 'free slots', 4096),
    freeMemoryBytes: measured(capacity.freeMemoryBytes, 'free memory', 1024 * 1024 * 1024),
  };
}
