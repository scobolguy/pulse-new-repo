import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPascalishSchemaStructureService } from '../../aggregator/src/librarian/schema-structure-service.mjs';

const logger = { log() {}, error() {}, warn() {} };

test('Pascalish schema structure service builds JSON value trees', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    assert.deepEqual(await service.parseJsonValue('{"id":7,"tags":["a","b"]}'), {
      name: 'root',
      kind: 'branch',
      valueType: 'object',
      children: [
        { name: 'id', kind: 'leaf', valueType: 'number' },
        {
          name: 'tags',
          kind: 'branch',
          valueType: 'array',
          children: [{ name: '[0]', kind: 'leaf', valueType: 'string' }],
          enumValues: ['a', 'b']
        }
      ]
    });
  } finally {
    await service.stop();
  }
});

test('Pascalish schema structure service builds JSON Schema trees', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    assert.deepEqual(await service.parseJsonSchema('{"type":"object","properties":{"id":{"type":"string"},"state":{"enum":["A","B"]}}}'), {
      name: 'root',
      kind: 'branch',
      valueType: 'object',
      children: [
        { name: 'id', kind: 'leaf', valueType: 'string', children: [] },
        { name: 'state', kind: 'leaf', valueType: 'enum', enumValues: ['A', 'B'], children: [] }
      ]
    });
  } finally {
    await service.stop();
  }
});

test('Pascalish schema structure service builds copybook trees', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    const tree = await service.parseCopybook(
      '01 RECORD.\n  05 GROUP.\n    10 FIELD PIC X(4).\n  05 OTHER PIC 9(3).'
    );
    assert.equal(tree.children[0].name, 'record');
    assert.deepEqual(tree.children[0].children[0].children[0], {
      name: 'field',
      kind: 'leaf',
      valueType: 'X(4)',
      children: []
    });
    assert.equal(tree.children[0].children[1].valueType, '9(3)');
  } finally {
    await service.stop();
  }
});
