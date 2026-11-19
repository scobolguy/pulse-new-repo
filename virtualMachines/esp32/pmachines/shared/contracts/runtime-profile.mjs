import { HOST_CAPABILITIES_VERSION, HOST_PROFILES } from './host-capabilities.mjs';
import { SERVICE_HOST_BINDINGS_VERSION } from './service-host-bindings.mjs';

export const PMACHINE_RUNTIME_PROFILE_VERSION = 1;

const TARGET_DETAILS = Object.freeze({
  js: Object.freeze({
    target: 'js',
    runtime: 'javascript',
    execution: Object.freeze({ model: 'single-threaded-event-loop', cpuParallelism: 1 }),
    taskCapabilities: Object.freeze([])
  }),
  native: Object.freeze({
    target: 'native',
    runtime: 'native',
    execution: Object.freeze({ model: 'serial', cpuParallelism: 1, maxConcurrentPrograms: 1 }),
    taskCapabilities: Object.freeze([])
  }),
  esp32: Object.freeze({
    target: 'esp32',
    runtime: 'pascalish-esp32',
    execution: Object.freeze({ model: 'single-worker', cpuParallelism: 1, maxConcurrentPrograms: 1 }),
    taskCapabilities: Object.freeze(['pascalish-dag-v1'])
  })
});

export function createPmachineRuntimeProfile(target, {
  supportedHostCapabilities,
  execution = {},
  limits = {},
  resources = {}
} = {}) {
  const targetDetails = TARGET_DETAILS[target];
  const hostProfile = HOST_PROFILES[target];
  if (!targetDetails || !hostProfile) throw new Error(`Unknown PMachine runtime target: ${target}`);

  const capabilities = supportedHostCapabilities ?? hostProfile.capabilities ?? [];
  if (!Array.isArray(capabilities) || capabilities.some(value => typeof value !== 'string')) {
    throw new TypeError('supportedHostCapabilities must be a string array');
  }

  return {
    version: PMACHINE_RUNTIME_PROFILE_VERSION,
    target: targetDetails.target,
    runtime: targetDetails.runtime,
    profile: hostProfile.profile,
    contractVersions: {
      serviceHostBindings: SERVICE_HOST_BINDINGS_VERSION,
      hostCapabilities: HOST_CAPABILITIES_VERSION,
      runtimeProfile: PMACHINE_RUNTIME_PROFILE_VERSION
    },
    supportedHostCapabilities: [...new Set(capabilities)].sort(),
    taskCapabilities: [...targetDetails.taskCapabilities],
    execution: { ...targetDetails.execution, ...execution },
    limits: { ...limits },
    resources: { ...resources }
  };
}

export function checkPmachineRuntimeCompatibility(profile, {
  target,
  hostBindingsVersion = SERVICE_HOST_BINDINGS_VERSION,
  hostCapabilitiesVersion = HOST_CAPABILITIES_VERSION,
  requiredHostCapabilities = []
} = {}) {
  const errors = [];
  if (!Array.isArray(requiredHostCapabilities)
    || requiredHostCapabilities.some(capability => typeof capability !== 'string')) {
    errors.push('invalid required host capabilities');
  }
  if (!profile || profile.version !== PMACHINE_RUNTIME_PROFILE_VERSION) {
    errors.push('unsupported runtime profile version');
  } else {
    if (target && profile.target !== target) errors.push(`runtime target '${profile.target}' does not match '${target}'`);
    if (profile.contractVersions?.serviceHostBindings !== hostBindingsVersion) {
      errors.push('service host bindings version mismatch');
    }
    if (profile.contractVersions?.hostCapabilities !== hostCapabilitiesVersion) {
      errors.push('host capabilities version mismatch');
    }
    if (!Array.isArray(profile.supportedHostCapabilities)
      || profile.supportedHostCapabilities.some(capability => typeof capability !== 'string')) {
      errors.push('invalid supported host capabilities');
    } else if (Array.isArray(requiredHostCapabilities)) {
      const supported = new Set(profile.supportedHostCapabilities);
      for (const capability of requiredHostCapabilities) {
        if (typeof capability === 'string' && !supported.has(capability)) {
          errors.push(`host capability unavailable: ${capability}`);
        }
      }
    }
  }
  return { compatible: errors.length === 0, errors };
}
