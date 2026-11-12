import assert from 'node:assert/strict';
import test from 'node:test';
import { createPmachineProcessSlots, PMACHINE_SERVICE_LIMIT } from '../../aggregator/src/backend/modules/pmachineProcessSlots.mjs';

function service(key, serviceIndex) {
  return {
    key,
    workloadKind: 'service',
    metadata: serviceIndex === undefined ? {} : { serviceIndex }
  };
}

test('pmachine reserves resident and transient slots independently of services', () => {
  const slots = createPmachineProcessSlots();
  assert.equal(slots.claim({ key: 'resident', workloadKind: 'service', metadata: { slotKind: 'resident' } }).slot, 'resident');
  assert.equal(slots.claim({ key: 'payment', workloadKind: 'program' }).slot, 'transient');
  assert.equal(slots.claim(service('service-a')).slot, 'service-01');
  assert.equal(slots.claim(service('service-b', 15)).slot, 'service-15');
  assert.equal(slots.list().length, 4);
});

test('pmachine rejects a colliding explicit service slot', () => {
  const slots = createPmachineProcessSlots();
  slots.claim(service('first', 3));
  assert.throws(() => slots.claim(service('second', 3)), /service-03 is already occupied/);
});

test('pmachine rejects the sixteenth service', () => {
  const slots = createPmachineProcessSlots();
  for (let index = 1; index <= PMACHINE_SERVICE_LIMIT; index += 1) {
    assert.equal(slots.claim(service(`service-${index}`)).slot, `service-${String(index).padStart(2, '0')}`);
  }
  assert.throws(() => slots.claim(service('service-16')), /capacity exhausted/);
});

test('released service slots can be reused', () => {
  const slots = createPmachineProcessSlots();
  assert.equal(slots.claim(service('first')).slot, 'service-01');
  assert.equal(slots.release('first'), true);
  assert.equal(slots.claim(service('second')).slot, 'service-01');
});
