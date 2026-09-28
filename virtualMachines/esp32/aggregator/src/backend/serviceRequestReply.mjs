function typeIds(value, label) {
  const ids = Array.isArray(value) ? value : [value];
  const normalized = ids.map(item => String(item || '').trim()).filter(Boolean);
  if (!normalized.length) throw new Error(`${label} must contain at least one Data Librarian type id`);
  return normalized;
}

function required(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function createServiceRequest({ requestId, serviceId, operation = 'convert', inputTypeIds, outputTypeIds, body, replyQueue, metadata = {} } = {}) {
  return {
    protocol: 'pulse.service.request.v1',
    requestId: required(requestId, 'requestId'),
    serviceId: required(serviceId, 'serviceId'),
    operation: required(operation, 'operation'),
    inputTypeIds: typeIds(inputTypeIds, 'inputTypeIds'),
    outputTypeIds: typeIds(outputTypeIds, 'outputTypeIds'),
    replyQueue: required(replyQueue, 'replyQueue'),
    body,
    metadata
  };
}

export function createServiceReply({ request, status = 'completed', body, outputTypeIds, error = null, instanceId = null, metadata = {} } = {}) {
  if (!request?.requestId) throw new Error('request with requestId is required');
  return {
    protocol: 'pulse.service.reply.v1',
    requestId: request.requestId,
    serviceId: request.serviceId,
    operation: request.operation,
    status: required(status, 'status'),
    outputTypeIds: typeIds(outputTypeIds || request.outputTypeIds, 'outputTypeIds'),
    body,
    error,
    instanceId,
    metadata
  };
}

export function assertServiceReplyForRequest(request, reply) {
  if (!request || !reply) throw new Error('request and reply are required');
  if (reply.requestId !== request.requestId) throw new Error(`Reply requestId '${reply.requestId}' does not match '${request.requestId}'`);
  if (reply.serviceId !== request.serviceId) throw new Error(`Reply serviceId '${reply.serviceId}' does not match '${request.serviceId}'`);
  const expected = new Set(request.outputTypeIds || []);
  const actual = reply.outputTypeIds || [];
  if (!actual.some(typeId => expected.has(typeId))) throw new Error('Reply output type is not accepted by the request');
  return true;
}
