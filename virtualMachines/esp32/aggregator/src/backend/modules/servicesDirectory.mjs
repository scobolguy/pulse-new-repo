export async function buildServicesDirectory({
  catalog, instances = [], nodes = [], collectorUrls = [], origin, fetchImpl = fetch
}) {
  const services = new Map();
  const servers = new Map();
  const errors = [];
  const add = (service) => {
    services.set(service.id, service);
    if (['database', 'messaging'].includes(service.kind)) servers.set(service.id, service);
  };
  for (const server of catalog.servers || []) {
    servers.set(`server:${server.id}`, { ...server, id: `server:${server.id}`, category: 'server', source: 'catalog' });
  }
  for (const offering of [...(catalog.serviceOfferings || []), ...(catalog.dataStores || [])]) {
    add({ ...offering, id: `catalog:${offering.id}`, serviceId: offering.id, source: 'catalog' });
  }
  for (const instance of instances) {
    const serviceId = instance.serviceName;
    if (!serviceId) continue;
    const base = instance.ip ? `http://${instance.ip}:${instance.port || 80}` : '';
    add({
      id: `instance:${instance.instanceId}`, instanceId: instance.instanceId, serviceId, name: serviceId,
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
    if (!node.ip) continue;
    const advertised = node.details?.services || node.services || [];
    const base = new URL(`http://${node.ip}:${node.port || node.httpPort || 80}`).origin;
    for (const registration of Array.isArray(advertised) ? advertised : []) {
      const serviceId = typeof registration === 'string' ? registration
        : registration?.name || registration?.serviceName || registration?.serviceId;
      if (typeof serviceId !== 'string' || !serviceId.trim()) continue;
      if ([...services.values()].some(service => service.serviceId === serviceId
        && service.nodeId === (node.nodeId || node.nodeName))) continue;
      add({
        id: `announced:${base}:${serviceId}`, serviceId, name: serviceId,
        nodeId: node.nodeId || node.nodeName || new URL(base).hostname, ip: node.ip,
        provider: 'runtime', protocol: 'http', source: 'node-announcement', status: node.status || 'announced',
        endpoint: new URL(typeof registration === 'object' && registration.endpoint || '/', base).href
      });
    }
    if (!/esp32|esp8266|pmachine|javascript/i.test(runtime) && !advertised.length) continue;
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
          const endpoint = registration.endpoint ? new URL(registration.endpoint, base).href : `${base}/api/service/${encodeURIComponent(serviceId)}`;
          const instanceKey = registration.instanceId || registration.id || (registration.endpoint ? endpoint : '');
          for (const [id, service] of services) {
            if (service.source === 'node-announcement' && service.serviceId === serviceId && service.ip === new URL(base).hostname) {
              services.delete(id);
            }
          }
          add({
            ...registration, id: `${base}:${serviceId}${instanceKey ? `:${instanceKey}` : ''}`, serviceId, name: serviceId,
            nodeId: node.nodeId || node.nodeName || payload.nodeId || new URL(base).hostname,
            ip: new URL(base).hostname, provider: registration.provider || 'pascalish', protocol: registration.protocol || 'http',
            endpoint,
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
    servers: [...servers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    errors
  };
}
