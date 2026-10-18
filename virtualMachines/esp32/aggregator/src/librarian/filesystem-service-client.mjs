function failure(message, status = 502, code = 'EFILESYSTEM') {
  return Object.assign(new Error(message), { status, code });
}

export function createFilesystemServiceClient(baseUrl, { timeoutMs = 10000, env = process.env } = {}) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\/[^/]+\/?$/i.test(baseUrl)) {
    throw failure('Invalid filesystem service URL', 500, 'EINVAL');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw failure('Invalid filesystem service timeout', 500, 'EINVAL');
  }
  const origin = baseUrl.replace(/\/+$/, '');
  const logicalTransport = env.PULSE_SERVICE_BINDINGS !== undefined
    ? createLogicalServiceTransport({
      serviceId: 'pulse-filesystem', aggregatorUrls: JSON.parse(env.PULSE_AGGREGATOR_URLS || '[]'),
      token: env.PULSE_RUNTIME_REPORT_TOKEN || '',
    })
    : null;

  async function post(route, payload, context) {
    if (logicalTransport) {
      const response = await logicalTransport.request({ method: 'POST', path: route, body: payload }, context);
      if (response.status < 200 || response.status >= 300) {
        throw failure(response.body?.error || `Filesystem service returned HTTP ${response.status}`, response.status,
          response.status === 404 ? 'ENOENT' : response.status === 403 ? 'EACCES' : 'EFILESYSTEM');
      }
      if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body)) {
        throw failure('Filesystem service transaction returned invalid JSON');
      }
      return response.body;
    }
    let response;
    try {
      response = await fetch(`${origin}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: context?.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (context?.signal?.aborted) throw error;
      throw failure(`Filesystem service request failed: ${error.message}`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw failure('Filesystem service returned invalid JSON', response.status);
    }
    if (!response.ok) {
      const code = response.status === 404 ? 'ENOENT' : response.status === 403 ? 'EACCES' : 'EFILESYSTEM';
      throw failure(body?.error || `Filesystem service returned HTTP ${response.status}`, response.status, code);
    }
    return body;
  }

  async function readText(root, relativePath, context) {
    if (root === 'legacy') {
      if (relativePath !== 'data-types.json') throw failure('Legacy storage is restricted to data-types.json', 403, 'EACCES');
      return post('/read-legacy-data-types', {}, context).then(body => body.value);
    }
    return post('/read', { root, path: relativePath }, context).then(body => body.value);
  }

  function readTextAuto(root, relativePath, context) {
    if (root === 'legacy') return readText(root, relativePath, context);
    if (root !== 'schemas') throw failure('Automatic text decoding is restricted to schemas', 403, 'EACCES');
    return post('/read-auto', { root, path: relativePath }, context).then(body => body.value);
  }

  function writeText(root, relativePath, value, context) {
    if (root !== 'catalog' && root !== 'isam') {
      throw failure('Writes are restricted to catalog and ISAM roots', 403, 'EACCES');
    }
    return post('/write', { root, path: relativePath, content: value }, context).then(body => {
      if (body?.stored !== true) throw failure('Filesystem service did not confirm the write');
      return 0;
    });
  }

  function exists(root, relativePath, context) {
    if (root === 'legacy') {
      if (relativePath !== 'data-types.json') throw failure('Legacy storage is restricted to data-types.json', 403, 'EACCES');
      return post('/exists-legacy-data-types', {}, context).then(body => body?.exists === true ? 1 : 0);
    }
    return post('/exists', { root, path: relativePath }, context).then(body => body?.exists === true ? 1 : 0);
  }

  function resolveRelative(root, base, reference, context) {
    if (root !== 'schemas') throw failure('Relative resolution is restricted to schemas', 403, 'EACCES');
    return post('/resolve-relative', { root, base, reference }, context).then(body => {
      if (typeof body?.path !== 'string') throw failure('Filesystem service returned an invalid path');
      return body.path;
    });
  }

  return {
    stop: () => logicalTransport?.stop(),
    readText,
    readTextAuto,
    writeText,
    exists,
    resolveRelative,
    schemaTreePage: (request, context) => post('/schema-tree/page', request, context),
    bindings: {
      'host.fs_read_text': (root, relativePath, context) => readText(root, relativePath, context),
      'host.fs_read_text_auto': (root, relativePath, context) => readTextAuto(root, relativePath, context),
      'host.fs_write_text': (root, relativePath, value, context) => writeText(root, relativePath, value, context),
      'host.fs_exists': (root, relativePath, context) => exists(root, relativePath, context),
      'host.fs_resolve_relative': (root, base, reference, context) => resolveRelative(root, base, reference, context)
    }
  };
}
import { createLogicalServiceTransport } from '../service-lifecycle/transaction-transport.mjs';
