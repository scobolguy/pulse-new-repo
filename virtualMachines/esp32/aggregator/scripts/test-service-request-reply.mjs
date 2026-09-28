import assert from 'node:assert/strict';
import { assertServiceReplyForRequest, createServiceReply, createServiceRequest } from '../src/backend/serviceRequestReply.mjs';

const request = createServiceRequest({
  requestId: 'req-001',
  serviceId: 'ConversionService',
  inputTypeIds: ['swift-mt103'],
  outputTypeIds: ['pacs'],
  replyQueue: 'service.ConversionService.replies',
  body: { finEnvelope: { block4: {} } }
});
const reply = createServiceReply({ request, outputTypeIds: ['pacs'], body: { Document: {} }, instanceId: 'conversion-1' });

assert.equal(request.protocol, 'pulse.service.request.v1');
assert.equal(reply.protocol, 'pulse.service.reply.v1');
assert.equal(assertServiceReplyForRequest(request, reply), true);
assert.throws(() => assertServiceReplyForRequest(request, { ...reply, requestId: 'wrong' }), /requestId/);
assert.throws(() => assertServiceReplyForRequest(request, { ...reply, outputTypeIds: ['camt'] }), /output type/);

console.log('[service-request-reply] PASS: correlated typed request/reply envelope');
