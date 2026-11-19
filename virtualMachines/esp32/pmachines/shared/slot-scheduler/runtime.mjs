import { readFile } from 'node:fs/promises';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../javascript/index.mjs';
import { createJsonObjectBindings } from '../../javascript/src/json-object-bindings.mjs';
import { createJsonCollectionBindings } from '../../javascript/src/json-collection-bindings.mjs';

let artifact;
async function loadArtifact() {
  if (!artifact) {
    artifact = Promise.all([
      readFile(new URL('./slot-scheduler.pcode', import.meta.url), 'utf8'),
      readFile(new URL('./slot-scheduler.map.json', import.meta.url), 'utf8'),
      loadOpcodeMap(),
    ]).then(([pcode, mapText, opcodeMap]) => {
      const map = JSON.parse(mapText);
      const mappingsById = new Map();
      mappingsById.__globals = map.globals;
      mappingsById.__proceduresByLabel = map.procedures;
      return { instructions: parsePcode(pcode), mappingsById, opcodeMap };
    });
  }
  return artifact;
}

export function createSlotScheduler({
  read, describe, stage, activate, remove, readState, writeState,
}) {
  const objectBindings = createJsonObjectBindings();
  const collectionBindings = createJsonCollectionBindings();
  let busy = false;
  return {
    async dispatch(operation, request = '{}') {
      if (busy) return { status: 409, body: { version: 1, error: 'Slot scheduler is busy' } };
      busy = true;
      let response;
      let failure;
      let errorText = '';
      async function checked(action, args, success) {
        try {
          await action(...args);
          return success;
        } catch (error) {
          errorText = error.message;
          return success === 1 ? 0 : (error.status || 500);
        }
      }
      try {
        const bindings = {
          ...objectBindings,
          ...collectionBindings,
          'host.json_has': (text, key) => {
            const value = JSON.parse(text);
            if (!value || Array.isArray(value) || typeof value !== 'object') {
              throw Object.assign(new Error('Expected a JSON object'), { status: 400 });
            }
            return Object.hasOwn(value, key) ? 1 : 0;
          },
          'host.scheduler_operation': () => operation,
          'host.scheduler_request': () => request,
          'host.scheduler_read': read,
          'host.scheduler_slot': describe,
          'host.scheduler_saved_state': readState,
          'host.scheduler_stage': (...args) => checked(stage, args, 200),
          'host.scheduler_activate': (...args) => checked(activate, args, 200),
          'host.scheduler_remove': (...args) => checked(remove, args, 200),
          'host.scheduler_commit': (...args) => checked(writeState, args, 1),
          'host.scheduler_error': () => errorText,
          'host.scheduler_respond': (status, body) => {
            if (response) throw new Error('Scheduler responded more than once');
            response = { status, body: JSON.parse(body) };
            return 1;
          },
        };
        const execution = await executeProgram({
          ...await loadArtifact(),
          inputQueue: 'pmachine.scheduler',
          sourceMessage: '',
          runtimeContext: {
            maxSteps: 200000,
            maxCallDepth: 64,
            async callHost(name, args) {
              try {
                if (!Object.hasOwn(bindings, name)) throw new Error(`Unknown scheduler binding: ${name}`);
                return await bindings[name](...args);
              } catch (error) {
                failure = error;
                throw error;
              }
            },
          },
        });
        if (failure) {
          if (operation === 'restore') {
            throw Object.assign(new Error(`Scheduler recovery failed: ${failure.message}`), { status: 503 });
          }
          throw failure;
        }
        if (execution.error || execution.stepLimitHit || !response) {
          throw new Error(execution.error || 'Scheduler did not complete its request');
        }
        return response;
      } finally {
        busy = false;
      }
    },
  };
}
