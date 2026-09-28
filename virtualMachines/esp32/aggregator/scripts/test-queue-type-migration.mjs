import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import QueueManager from '../src/broker/QueueManager.mjs';
import { migratePersistedQueueTypeIds } from '../src/backend/queueTypeMigration.mjs';

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-queue-type-migration-'));
const queueName = 'swift.mt103.legacy';
const canonicalId = 'type:swift-mt103-v4';

try {
  const initial = new QueueManager('migration-proof', runtimeRoot);
  initial.createQueue(queueName, {
    dataTypeId: 'mt103',
    dataTypeIds: ['mt103']
  });

  const migrated = await migratePersistedQueueTypeIds(new Map([['migration-proof', initial]]), [{
    id: 'mt103',
    logicalId: 'mt103',
    canonicalId,
    aliases: ['swift-mt103']
  }]);
  assert.equal(migrated, 1);
  assert.equal(initial.getConfig(queueName).dataTypeId, canonicalId);
  assert.deepEqual(initial.getConfig(queueName).dataTypeIds, [canonicalId]);

  const reloaded = new QueueManager('migration-proof', runtimeRoot);
  assert.equal(reloaded.getConfig(queueName).dataTypeId, canonicalId);
  assert.deepEqual(reloaded.getConfig(queueName).dataTypeIds, [canonicalId]);

  console.log('[queue-type-migration] PASS: legacy queue aliases are persisted as canonical IDs');
} finally {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
