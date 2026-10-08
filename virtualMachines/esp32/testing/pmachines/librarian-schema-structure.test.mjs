import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPascalishSchemaStructureService } from '../../aggregator/src/librarian/schema-structure-service.mjs';

const logger = { log() {}, error() {}, warn() {} };

test('Pascalish schema filename policy preserves supported names and versions', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    assert.deepEqual(await service.parseFilename('PACS.002.001.12.XSD'), {
      name: 'pacs.002.001.12',
      version: 12,
      type: 'xsd',
      area: 'pacs',
      typeId: 'pacs'
    });
    assert.deepEqual(await service.parseFilename('order.v3.avro'), {
      name: 'order',
      version: 3,
      type: 'avro',
      typeId: 'order'
    });
    assert.deepEqual(await service.parseFilename('legacy.CPY'), {
      name: 'legacy',
      version: null,
      type: 'copybook',
      typeId: 'legacy'
    });
    assert.deepEqual(await service.parseFilename('payment.json-schema'), {
      name: 'payment',
      version: null,
      type: 'json-schema',
      typeId: 'payment'
    });
    assert.equal(await service.parseFilename('not-a-schema.txt'), null);
    assert.equal(await service.parseFilename('invalid.name.with.dots.json'), null);
  } finally {
    await service.stop();
  }
});

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
    assert.deepEqual(await service.parseJsonValue('{"empty":[],"mixed":[1,{"nested":true}]}'), {
      name: 'root',
      kind: 'branch',
      valueType: 'object',
      children: [
        {
          name: 'empty',
          kind: 'branch',
          valueType: 'array',
          children: [],
          enumValues: []
        },
        {
          name: 'mixed',
          kind: 'branch',
          valueType: 'array',
          children: [{ name: '[0]', kind: 'leaf', valueType: 'number' }]
        }
      ]
    });
  } finally {
    await service.stop();
  }
});

test('Pascalish schema structure service enriches SWIFT field metadata', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    assert.deepEqual(JSON.parse(await service.enrichSwiftFields(JSON.stringify({
      messageType: 'mt103',
      fields: {
        '32A': {},
        '99Z': { type: '', format: null, length: 0 },
        '70': { type: 'custom', format: 'manual', length: 'explicit' },
        ignored: null
      },
      nested: {
        messageType: 'MT202CONT',
        fields: { '20': {} }
      }
    }))), {
      messageType: 'mt103',
      fields: {
        '32A': { type: 'composite', format: '6!n3!a15d', length: '6!n3!a15d' },
        '99Z': { type: 'string', format: 'variable', length: 'variable' },
        '70': { type: 'custom', format: 'manual', length: 'explicit' },
        ignored: null
      },
      nested: {
        messageType: 'MT202CONT',
        fields: { '20': { type: 'string', format: '16x', length: '16x' } }
      }
    });
    assert.deepEqual(JSON.parse(await service.enrichSwiftFields('{"messageType":"MT103","fields":[{}]}')), {
      messageType: 'MT103',
      fields: [{}]
    });
    const structure = await service.parseJsonValue('{"messageType":"MT103","fields":{"32A":{}}}');
    const enrichedFields = structure.children.find(node => node.name === 'fields')
      .children[0].children.map(node => node.name);
    assert.deepEqual(enrichedFields, ['type', 'format', 'length']);
    assert.deepEqual(JSON.parse(await service.enrichSwiftFields('{"messageType":"AB103","fields":{"32A":{}}}')), {
      messageType: 'AB103',
      fields: { '32A': {} }
    });
  } finally {
    await service.stop();
  }
});

test('Pascalish schema structure service builds JSON Schema trees', async () => {
  const service = await createPascalishSchemaStructureService({ logger });
  try {
    assert.deepEqual(await service.parseJsonSchema('{"type":"object","properties":{"id":{"type":"string"},"state":{"enum":["A","B"]},"complex":{"enum":[1,{"value":2}]},"empty":{"enum":[]}}}'), {
      name: 'root',
      kind: 'branch',
      valueType: 'object',
      children: [
        { name: 'id', kind: 'leaf', valueType: 'string', children: [] },
        { name: 'state', kind: 'leaf', valueType: 'enum', enumValues: ['A', 'B'], children: [] },
        {
          name: 'complex',
          kind: 'leaf',
          valueType: 'enum',
          enumValues: [1, '{"value":2}'],
          children: []
        },
        { name: 'empty', kind: 'leaf', valueType: 'enum', children: [] }
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
