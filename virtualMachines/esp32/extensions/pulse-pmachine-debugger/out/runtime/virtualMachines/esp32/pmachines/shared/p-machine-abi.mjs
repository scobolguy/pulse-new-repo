export const PMACHINE_ABI = Object.freeze({
  id: 'pulse.pmachine',
  version: 1,
  opcodeManifestVersion: 1,
  features: Object.freeze(['scalar', 'coroutine.yield', 'null.value', 'reference.heap', 'exception.frames']),
  referenceAbiVersion: 1,
  exceptionAbiVersion: 1
});

export function validatePmachineAbi(descriptor) {
  if (descriptor === undefined || descriptor === null) return;
  if (typeof descriptor !== 'object' || descriptor.id !== PMACHINE_ABI.id
      || descriptor.version !== PMACHINE_ABI.version
      || descriptor.opcodeManifestVersion !== PMACHINE_ABI.opcodeManifestVersion) {
    throw new Error(`Unsupported P-machine ABI: expected ${PMACHINE_ABI.id} v${PMACHINE_ABI.version}`);
  }
  if (descriptor.referenceAbiVersion !== undefined
      && descriptor.referenceAbiVersion !== PMACHINE_ABI.referenceAbiVersion) {
    throw new Error(`Unsupported reference ABI: expected v${PMACHINE_ABI.referenceAbiVersion}`);
  }
  if (descriptor.exceptionAbiVersion !== undefined
      && descriptor.exceptionAbiVersion !== PMACHINE_ABI.exceptionAbiVersion) {
    throw new Error(`Unsupported exception ABI: expected v${PMACHINE_ABI.exceptionAbiVersion}`);
  }
}
