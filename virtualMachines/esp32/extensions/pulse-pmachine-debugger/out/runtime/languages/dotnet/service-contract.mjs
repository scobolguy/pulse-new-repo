export const DOTNET_SERVICE_TARGETS = ['js', 'esp32'];
export const DOTNET_SERVICE_HOST_BINDINGS_VERSION = 1;
export const DOTNET_SERVICE_HOST_CAPABILITIES_VERSION = 1;

export function createDotnetServiceContract({ id, endpoints = [], requiredHostCapabilities = [], allowedVerbs = ['GET', 'POST'] }) {
  if (typeof id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) {
    throw new TypeError('Service id must be a valid identifier');
  }
  if (!Array.isArray(endpoints) || endpoints.length > 16) {
    throw new TypeError('Service endpoints must be an array of at most 16 entries');
  }
  const seen = new Set();
  const serviceEndpoints = endpoints.map(endpoint => {
    const verb = String(endpoint?.verb || '').toUpperCase();
    const path = String(endpoint?.path || '');
    const handler = endpoint?.handler === undefined ? undefined : String(endpoint.handler);
    if (!allowedVerbs.includes(verb) || !path.startsWith('/') || path.length > 256) {
      throw new TypeError(`Service endpoints require ${allowedVerbs.join(' or ')} and an absolute path of 256 characters or fewer`);
    }
    if (handler !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(handler)) {
      throw new TypeError(`Invalid service endpoint handler: ${handler}`);
    }
    const key = `${verb} ${path}`;
    if (seen.has(key)) throw new TypeError(`Duplicate service endpoint: ${key}`);
    seen.add(key);
    return { verb, path, ...(handler === undefined ? {} : { handler }) };
  });
  return {
    serviceId: id,
    sourceLanguage: 'dotnet',
    provider: 'dotnet',
    targets: [...DOTNET_SERVICE_TARGETS],
    hostBindingsVersion: DOTNET_SERVICE_HOST_BINDINGS_VERSION,
    hostCapabilitiesVersion: DOTNET_SERVICE_HOST_CAPABILITIES_VERSION,
    requiredHostCapabilities: [...requiredHostCapabilities],
    serviceEndpoints,
    serviceLifecycle: { version: 1, requires: [] },
    capabilities: {
      serviceId: id,
      sourceLanguage: 'dotnet',
      provider: 'dotnet',
      runtime: 'dotnet-pmachine',
      endpoints: serviceEndpoints.map(({ handler, ...endpoint }) => ({
        ...endpoint,
        ...(handler === undefined ? {} : { handler }),
        invocation: 'service-reference',
        requestType: 'json',
        responseType: 'json'
      })),
      lifecycle: { version: 1, requires: [] },
      hostCapabilitiesVersion: DOTNET_SERVICE_HOST_CAPABILITIES_VERSION,
      requiredHostCapabilities: [...requiredHostCapabilities],
      pathway: { discoverable: true, replacement: true }
    }
  };
}
