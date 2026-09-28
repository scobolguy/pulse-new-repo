import assert from 'node:assert/strict';
import { buildMt103Pacs008RuntimePlan } from '../src/backend/edgeRuntimePlan.mjs';

const manifest = {
  bySymbol: {
    incoming_mt103: { kind: 'queue', managerId: 'qm-rabbit', physicalName: 'swift.mt103.inbound' },
    message_store: { kind: 'database', managerId: 'db-mysql', physicalName: 'PaymentMessages' },
    MT103_to_PACS008: { kind: 'service', managerId: 'service-aggregator', physicalName: 'MT103_to_PACS008' },
    outgoing_message: { kind: 'queue', managerId: 'qm-msmq', physicalName: 'swift.pacs008.outbound' }
  }
};

const plan = buildMt103Pacs008RuntimePlan({ manifest, target: 'esp32-edge-pool' });
assert.equal(plan.operations.length, 5);
assert.equal(plan.operations[0].managerId, 'qm-rabbit');
assert.equal(plan.operations.at(-1).managerId, 'qm-msmq');
assert.equal(plan.operations[1].managerId, 'db-mysql');
assert.equal(plan.boundedPayload, true);
assert.throws(() => buildMt103Pacs008RuntimePlan({ manifest: { bySymbol: {} }, target: 'esp32' }), /Missing queue binding/);

console.log('[edge-runtime-plan] PASS: JS and ESP32 targets use provider-neutral API transports');
