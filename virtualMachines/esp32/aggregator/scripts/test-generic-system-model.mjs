import assert from 'node:assert/strict';
import { buildGenericSystem, flattenGenericSystems } from '../src/backend/genericSystem.mjs';

const source = {
  id: 'payments',
  systems: [
    { id: 'ingress', ports: [{ symbol: 'out', direction: 'output', dataTypeId: 'payment' }] },
    { id: 'ledger', ports: [{ symbol: 'in', direction: 'input', dataTypeId: 'payment' }] }
  ],
  connections: [
    { symbol: 'orders', source: 'ingress.out', target: 'ledger.in', dataTypeId: 'payment' }
  ]
};

const system = buildGenericSystem(source);
assert.equal(system.kind, 'generic-system');
assert.deepEqual(flattenGenericSystems(system).map(item => item.systemId), ['payments', 'ingress', 'ledger']);
assert.equal(system.connections[0].sourcePath, 'payments.ingress.out');
assert.equal(system.connections[0].targetPath, 'payments.ledger.in');

assert.throws(() => buildGenericSystem({
  ...source,
  connections: [{ symbol: 'bad', source: 'ingress.out', target: 'ledger.in', dataTypeId: 'audit' }]
}), /does not match its endpoints/);

assert.throws(() => buildGenericSystem({
  id: 'disconnected',
  systems: [{ id: 'a' }, { id: 'b' }]
}), /disconnected children/);

const cyclic = { id: 'cyclic', systems: [] };
cyclic.systems.push(cyclic);
assert.throws(() => buildGenericSystem(cyclic), /containment cycle/);

console.log('[generic-system-model] PASS');
