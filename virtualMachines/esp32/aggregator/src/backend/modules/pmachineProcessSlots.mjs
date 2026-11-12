export const PMACHINE_SERVICE_LIMIT = 15;

function slotKind(deployment) {
  const requested = String(deployment?.metadata?.slotKind || '').trim().toLowerCase();
  if (requested === 'resident' || requested === 'transient') return requested;
  return deployment?.workloadKind === 'program' ? 'transient' : 'service';
}

function validServiceIndex(value) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 1 && index <= PMACHINE_SERVICE_LIMIT ? index : null;
}

export function createPmachineProcessSlots() {
  const assignments = new Map();
  const bySlot = new Map();

  function claim(deployment) {
    const key = String(deployment?.key || deployment?.deploymentId || '').trim();
    if (!key) throw new Error('Deployment key is required for pmachine slot allocation');
    const existing = assignments.get(key);
    if (existing) return { ...existing, reused: true };

    const kind = slotKind(deployment);
    let slot;
    if (kind === 'resident') {
      slot = 'resident';
    } else if (kind === 'transient') {
      slot = 'transient';
    } else {
      const requested = validServiceIndex(deployment?.metadata?.serviceIndex);
      if (requested !== null) {
        slot = `service-${String(requested).padStart(2, '0')}`;
        const owner = bySlot.get(slot);
        if (owner && owner !== key) throw new Error(`Pmachine slot ${slot} is already occupied`);
      } else {
        for (let index = 1; index <= PMACHINE_SERVICE_LIMIT; index += 1) {
          const candidate = `service-${String(index).padStart(2, '0')}`;
          if (!bySlot.has(candidate)) {
            slot = candidate;
            break;
          }
        }
      }
      if (!slot) throw new Error(`Pmachine service capacity exhausted (${PMACHINE_SERVICE_LIMIT})`);
    }

    const owner = bySlot.get(slot);
    if (owner && owner !== key) throw new Error(`Pmachine slot ${slot} is already occupied`);
    const assignment = { key, slot, kind };
    assignments.set(key, assignment);
    bySlot.set(slot, key);
    return { ...assignment, reused: false };
  }

  function release(key) {
    const assignment = assignments.get(key);
    if (!assignment) return false;
    assignments.delete(key);
    if (bySlot.get(assignment.slot) === key) bySlot.delete(assignment.slot);
    return true;
  }

  function get(key) {
    const assignment = assignments.get(key);
    return assignment ? { ...assignment } : null;
  }

  function list() {
    return Array.from(assignments.values(), assignment => ({ ...assignment }));
  }

  return { claim, release, get, list };
}
