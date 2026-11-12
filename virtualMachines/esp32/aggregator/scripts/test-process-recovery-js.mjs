import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PMachineScheduler } from '../../pmachines/javascript/index.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { collectJsPmachineResources } from '../src/backend/swarmResourceReporter.mjs';
import { ProcessCheckpointCoordinator } from '../src/backend/process-checkpoint.mjs';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../src/backend/swarmCheckpointStore.mjs';

function stop(server) {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

test('two JavaScript pmachines recover a process from its replicated checkpoint', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-process-recovery-'));
  const stores = ['node-a', 'node-b'].map(id =>
    new SwarmCheckpointStore({ id, filePath: path.join(directory, `${id}.bin`) }));
  const nodes = ['node-a', 'node-b'].map(name => ({
    name,
    server: createJsPmachineNodeServer({
      name, scheduler: new PMachineScheduler({ slots: 1 })
    })
  }));
  t.after(async () => {
    for (const node of nodes) if (node.server.listening) await stop(node.server);
    for (const store of stores) store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  await Promise.all(nodes.map(async node => {
    node.server.listen(0, '127.0.0.1');
    await once(node.server, 'listening');
    node.origin = `http://127.0.0.1:${node.server.address().port}`;
  }));
  const resources = await Promise.all(nodes.map(node => collectJsPmachineResources(node.origin)));
  assert.deepEqual(resources.map(item => item.status), ['online', 'online']);

  const active = new ProcessCheckpointCoordinator({
    pair: new SwarmCheckpointPair(stores),
    processId: 'screen-process-1',
    codeId: 'screen-program-v1',
    nodeId: 'node-a',
    executionEpoch: 1,
  });
  const checkpoint = await active.checkpointProcess(
    { paragraph: 'UPDATE-ACCOUNT', account: 'A100', balance: 42 },
    {
      screenState: { input: 'CONFIRM' },
      transactionContext: { active: ['tx-1'], completed: [] },
    }
  );
  assert.equal(checkpoint.replicas.length, 2);

  await stop(nodes[0].server);
  const survivor = await collectJsPmachineResources(nodes[1].origin);
  assert.equal(survivor.status, 'online');

  const replacement = new ProcessCheckpointCoordinator({
    pair: new SwarmCheckpointPair(stores),
    processId: 'screen-process-1',
    codeId: 'screen-program-v1',
    nodeId: 'node-b',
    executionEpoch: 2,
  });
  const restored = await replacement.restoreCheckpoint(checkpoint.checkpointId, {
    executionEpoch: 2,
    nodeId: 'node-b',
  });
  assert.deepEqual(restored.state, {
    paragraph: 'UPDATE-ACCOUNT', account: 'A100', balance: 42
  });
  assert.deepEqual(restored.transactionsToAbort, ['tx-1']);
  assert.equal(restored.nodeId, 'node-b');
});
