import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { PMachineScheduler, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { ProcessCheckpointCoordinator } from '../../../virtualMachines/esp32/aggregator/src/backend/process-checkpoint.mjs';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../../../virtualMachines/esp32/aggregator/src/backend/swarmCheckpointStore.mjs';

export async function runHelloBye({ directory, delayMs = 300000, onLine = console.log } = {}) {
  if (!path.isAbsolute(directory ?? '')) throw new Error('An absolute checkpoint directory is required');
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error('Invalid continuation delay');
  const source = await fs.readFile(new URL('../examples/helloBye.kt', import.meta.url), 'utf8');
  const compiled = compileKotlinToPcode(source, { fileName: 'helloBye.kt', target: 'js' });
  const codeId = createHash('sha256').update(compiled.pcodeText).digest('hex');
  const stores = [];
  try {
    for (const id of ['node-a', 'node-b']) {
      stores.push(new SwarmCheckpointStore({ id, filePath: path.join(directory, `${id}.checkpoints`) }));
    }
    const pair = new SwarmCheckpointPair(stores);
    const schedulers = [new PMachineScheduler({ slots: 1 }), new PMachineScheduler({ slots: 1 })];
    const options = {
      instructions: parsePcode(compiled.pcodeText), opcodeMap: await loadOpcodeMap(),
      programMap: compiled.programMap, inputQueue: 'helloBye', sourceMessage: ''
    };
    const coordinators = ['node-a', 'node-b'].map((nodeId, index) => new ProcessCheckpointCoordinator({
      pair, processId: 'helloBye', codeId, nodeId, executionEpoch: index + 1
    }));
    let checkpoint;
    let checkpointTime;
    const first = await schedulers[0].execute({
      ...options, runtimeContext: {
        onStdoutLine: onLine,
        callHost: async (name, args) => {
          if (name === 'host.restore_checkpoint' && args[0] === 'helloBye' && args[1] === 'latest') return 'start';
          if (name !== 'host.checkpoint_process' || args[0] !== 'helloBye'
              || args[1] !== 'afterHello' || args[2] !== '{}' || checkpoint) {
            throw new Error(`Unexpected helloBye checkpoint call: ${name}`);
          }
          checkpoint = await coordinators[0].checkpointProcess(args[1]);
          checkpointTime = Date.now();
          return checkpoint.checkpointId;
        }
      }
    }, { name: 'helloBye-node-a' });
    if (first.error || !checkpoint || first.stdout.length !== 1 || first.stdout[0] !== 'Hello') {
      throw new Error(`Initial helloBye execution failed: ${first.error || 'checkpoint or output missing'}`);
    }
    const notBefore = checkpointTime + delayMs;
    while (Date.now() < notBefore) await sleep(notBefore - Date.now());
    const second = await schedulers[1].execute({
      ...options, runtimeContext: {
        onStdoutLine: onLine,
        callHost: async (name, args) => {
          if (name !== 'host.restore_checkpoint' || args[0] !== 'helloBye' || args[1] !== 'latest') {
            throw new Error(`Unexpected helloBye recovery call: ${name}`);
          }
          const restored = await coordinators[1].restoreCheckpoint(checkpoint.checkpointId, {
            executionEpoch: 2, nodeId: 'node-b'
          });
          if (restored.degraded) throw new Error('helloBye checkpoint replica is unavailable');
          return restored.state;
        }
      }
    }, { name: 'helloBye-node-b' });
    if (second.error || second.stdout.length !== 1 || second.stdout[0] !== 'Bye') {
      throw new Error(`Resumed helloBye execution failed: ${second.error || 'unexpected output'}`);
    }
    return { checkpointId: checkpoint.checkpointId, checkpointTime, resumedAt: Date.now() };
  } finally {
    for (const store of stores) store.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2];
  if (!directory || process.argv.length !== 3) throw new Error('Usage: node run-hello-bye.mjs <absolute-checkpoint-directory>');
  await runHelloBye({ directory: path.resolve(directory) });
}
