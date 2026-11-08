function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value : {};
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
export function parseSwarmNodes(payload) {
    const nodes = Array.isArray(payload) ? payload : record(payload).nodes;
    if (!Array.isArray(nodes))
        throw new Error('PMachine discovery response does not contain nodes.');
    const result = new Map();
    for (const value of nodes) {
        if (value === null || typeof value !== 'object' || Array.isArray(value))
            throw new Error('Invalid node in PMachine discovery response.');
        const node = record(value), details = record(node.details), availability = record(node.availability);
        const available = availability.available ?? node.available;
        const draining = availability.draining ?? node.draining;
        const status = text(availability.status ?? node.status).toLowerCase();
        if (available !== true || draining === true || ['offline', 'unavailable', 'draining'].includes(status))
            continue;
        const services = details.services ?? node.services;
        if (!Array.isArray(services) || !services.some(service => text(typeof service === 'string' ? service : record(service).name ?? record(service).serviceName)
            .toLowerCase().includes('pmachine')))
            continue;
        const address = text(node.ip) || text(node.address);
        const id = text(node.nodeId) || text(node.id) || text(node.nodeName) || address;
        if (!address || !id)
            continue;
        const port = typeof node.port === 'number' && Number.isInteger(node.port) && node.port > 0 && node.port <= 65535
            ? node.port : undefined;
        const host = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address;
        result.set(id, {
            id, name: text(node.nodeName) || text(node.name) || id,
            address: port ? `${host}:${port}` : address,
            runtime: text(details.runtime) || text(node.runtime) || text(details.hardware) || text(node.hardware) || 'PMachine',
        });
    }
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export async function loadSwarmNodes(baseUrl) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/pmachine/nodes`, {
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
        throw new Error(`Swarm discovery failed (HTTP ${response.status}).`);
    return parseSwarmNodes(await response.json());
}
//# sourceMappingURL=swarmBackend.js.map