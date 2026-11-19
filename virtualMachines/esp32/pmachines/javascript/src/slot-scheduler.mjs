import { createSlotScheduler } from '../../shared/slot-scheduler/runtime.mjs';

function slotError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function createNodeSlotScheduler({
  readFile,
  prepare,
  start,
  stop,
  readState,
  writeState,
}) {
  const slots = new Map();
  return {
    slots,
    runtime: createSlotScheduler({
      read: readFile,
      describe: slot => slots.get(slot)?.descriptor || '{}',
      stage: async (slot, descriptor) => {
        let value;
        try {
          value = JSON.parse(descriptor);
        } catch {
          throw slotError('Invalid scheduler slot descriptor');
        }
        if (!value || Array.isArray(value) || typeof value !== 'object' || value.slot !== slot) {
          throw slotError('Invalid scheduler slot descriptor');
        }
        const prepared = await prepare(value);
        slots.set(slot, { descriptor, value, prepared, active: null });
      },
      activate: async slot => {
        const resource = slots.get(slot);
        if (!resource) throw slotError('Scheduler slot is not staged', 404);
        if (resource.active) throw slotError('Scheduler slot is already active', 409);
        resource.active = await start(resource.prepared, resource.value);
      },
      remove: async slot => {
        const resource = slots.get(slot);
        if (!resource) return;
        const active = resource.active || resource.prepared?.host;
        if (active) await stop(active, resource.value);
        slots.delete(slot);
      },
      readState,
      writeState,
    }),
  };
}
