export async function buildServicesDirectory({
  catalog, instances = [], nodes = [], collectorUrls = [], origin, fetchImpl = fetch
}) {
  const services = new Map();
  const errors = [];
  const add = (service) => services.set(service.id, service);
  for (const offering of [...(catalog.serviceOfferings || []), ...(catalog.dataStores || [])]) {
    add({ ...offering, id: `catalog:${offering.id}`, serviceId: offering.id, source: 'catalog' });
  }
  for (const instance of instances) {
    const serviceId = instance.serviceName;
    if (!serviceId) continue;
    const base = instance.ip ? `http://${instance.ip}:${instance.port || 80}` : '';
    add({
      id: `instance:${instance.instanceId}`, serviceId, name: serviceId,
      nodeId: instance.nodeId, ip: instance.ip, status: instance.status,
      endpoint: base ? new URL(instance.metadata?.route || '/', base).href : '',
      provider: 'runtime', protocol: 'http', source: 'runtime'
    });
  }
  const targets = new Map();
  for (const offering of catalog.serviceOfferings || []) {
    if (offering.provider === 'pascalish' && offering.endpoint) {
      targets.set(new URL(offering.endpoint).origin, { nodeId: offering.nodeId });
    }
  }
  for (const node of nodes) {
    const runtime = `${node.details?.hardware || ''} ${node.details?.runtime || ''}`;
    if (!node.ip || !/esp32|esp8266|pmachine|javascript/i.test(runtime)) continue;
    targets.set(new URL(`http://${node.ip}:${node.port || node.httpPort || 80}`).origin, node);
  }
  for (const url of collectorUrls) {
    const base = new URL(url).origin;
    if (!targets.has(base)) targets.set(base, {});
  }
  if (origin) targets.delete(new URL(origin).origin);
  const queue = [...targets];
  async function worker() {
    while (queue.length) {
      const [base, node] = queue.shift();
      try {
        const response = await fetchImpl(`${base}/api/services`, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload.services)) throw new Error('Response does not contain services');
        for (const registration of payload.services) {
          const serviceId = registration.serviceId || registration.name;
          if (typeof serviceId !== 'string' || !serviceId.trim()) throw new Error('Invalid service registration');
          add({
            ...registration, id: `${base}:${serviceId}`, serviceId, name: serviceId,
            nodeId: node.nodeId || node.nodeName || new URL(base).hostname,
            ip: new URL(base).hostname, provider: 'pascalish', protocol: 'http',
            endpoint: `${base}/api/service/${encodeURIComponent(serviceId)}`,
            source: 'node-registry', status: registration.enabled === false ? 'disabled' : 'registered'
          });
        }
      } catch (error) {
        errors.push({ endpoint: `${base}/api/services`, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return {
    status: errors.length ? 'degraded' : 'ok',
    services: [...services.values()].sort((a, b) => (a.name || a.serviceId).localeCompare(b.name || b.serviceId)),
    errors
  };
}
