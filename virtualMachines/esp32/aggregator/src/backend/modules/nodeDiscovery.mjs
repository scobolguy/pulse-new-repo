export async function bindNodeDiscoverySocket(socket, port) {
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    socket.once('error', onError);
    socket.bind(port, () => {
      socket.removeListener('error', onError);
      try {
        socket.setBroadcast(true);
        resolve();
      } catch (error) {
        socket.close();
        reject(error);
      }
    });
  });
}

export async function enrichDiscoveredNode({
  ip,
  discoveredNodes,
  fetchImpl = fetch,
  timeoutMs = 5000,
  logger = console
}) {
  const node = discoveredNodes.get(ip);
  if (!node) return;
  const port = Number(node.httpPort || node.port || node.details?.httpPort || 80);
  const baseUrl = `http://${node.ip || ip}:${port}`;
  let statusDetails = {};
  let serviceDetails = {};

  async function readDetails(endpoint) {
    try {
      const response = await fetchImpl(`${baseUrl}${endpoint}`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Expected a JSON object');
      }
      if (endpoint === '/status') statusDetails = payload;
      else serviceDetails = payload;
      const current = discoveredNodes.get(ip);
      if (!current) return;
      const details = { ...current.details, ...statusDetails, ...serviceDetails };
      // A description without services must not hide capabilities from /status.
      if (Array.isArray(serviceDetails.services) && serviceDetails.services.length > 0) {
        details.services = serviceDetails.services;
      } else if (Array.isArray(statusDetails.services)) {
        details.services = statusDetails.services;
      } else if (Array.isArray(current.details?.services)) {
        details.services = current.details.services;
      }
      discoveredNodes.set(ip, { ...current, details });
    } catch (error) {
      logger.warn(`[DISCOVERY] ${baseUrl}${endpoint}: ${error.message}`);
    }
  }

  await Promise.all(['/status', '/services/describe'].map(readDetails));
}