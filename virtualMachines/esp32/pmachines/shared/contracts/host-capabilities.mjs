import { SERVICE_HOST_BINDINGS } from './service-host-bindings.mjs';

export const HOST_CAPABILITIES_VERSION = 1;
export const HOST_PROFILES = Object.freeze({
  js: Object.freeze({ profile: 'desktop', runtime: 'javascript', filesystem: true }),
  esp32: Object.freeze({ profile: 'embedded', runtime: 'esp32', filesystem: false })
});

export function requiredHostCapabilities(instructions) {
  return [...new Set(instructions
    .filter(instruction => instruction.mnemonic === 'CALL_EXT')
    .map(instruction => SERVICE_HOST_BINDINGS[instruction.operand?.label]?.capability)
    .filter(Boolean))].sort();
}

export function assertHostCapabilities(map, instructions, available) {
  const declared = map.requiredHostCapabilities === undefined ? [] : map.requiredHostCapabilities;
  if (!Array.isArray(declared) || declared.some(item => typeof item !== 'string')
    || (map.requiredHostCapabilities !== undefined && map.hostCapabilitiesVersion !== HOST_CAPABILITIES_VERSION)
    || (map.hostCapabilitiesVersion !== undefined && map.hostCapabilitiesVersion !== HOST_CAPABILITIES_VERSION)) {
    throw Object.assign(new Error('Invalid host capability requirements'), { status: 400 });
  }
  const missing = [...new Set([...declared, ...requiredHostCapabilities(instructions)])]
    .filter(capability => !available.includes(capability));
  if (missing.length) throw Object.assign(new Error(`Host capabilities unavailable: ${missing.join(', ')}`), { status: 403 });
}
