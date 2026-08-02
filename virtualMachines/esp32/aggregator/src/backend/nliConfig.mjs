import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve(process.env.NLI_CONFIG_PATH || './data/nli-config.json');
const DEFAULT_PROFILE = {
  provider: 'ollama',
  host: '127.0.0.1',
  port: 11434,
  model: 'phi3:latest',
  timeoutMs: 90000,
  warmthIntervalMs: 60000,
  keepAlive: '10m',
  options: {
    num_ctx: 2048,
    num_predict: 256,
    temperature: 0.1,
  },
};
const DEFAULT_RESPONSE_POLICY = {
  clarificationConfidence: 0.95,
  clarificationReply: "I'm unclear, can you help me with this",
  successReply: 'OK',
};

let cachedConfig = null;
let cacheLoadedAt = 0;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.warn(`[NLI] Could not load ${CONFIG_PATH}: ${error.message}`);
    return { activeProfile: 'default', profiles: { default: DEFAULT_PROFILE } };
  }
}

export function getNliConfig({ forceReload = false } = {}) {
  const now = Date.now();
  const reloadIntervalMs = positiveInteger(cachedConfig?.reloadIntervalMs, 30000);
  if (!forceReload && cachedConfig && now - cacheLoadedAt < reloadIntervalMs) {
    return cachedConfig;
  }

  const fileConfig = readConfigFile();
  const requestedProfile = String(process.env.NLI_PROFILE || fileConfig.activeProfile || 'default').trim();
  const profile = fileConfig.profiles?.[requestedProfile];
  if (!profile) {
    throw new Error(`NLI profile "${requestedProfile}" is not defined in ${CONFIG_PATH}`);
  }

  cachedConfig = {
    version: positiveInteger(fileConfig.version, 1),
    profile: requestedProfile,
    reloadIntervalMs: positiveInteger(fileConfig.reloadIntervalMs, 30000),
    provider: String(process.env.NLI_PROVIDER || profile.provider || DEFAULT_PROFILE.provider),
    host: String(process.env.OLLAMA_HOST || profile.host || DEFAULT_PROFILE.host),
    port: positiveInteger(process.env.OLLAMA_PORT || profile.port, DEFAULT_PROFILE.port),
    model: String(process.env.OLLAMA_MODEL || profile.model || DEFAULT_PROFILE.model),
    timeoutMs: positiveInteger(process.env.OLLAMA_TIMEOUT_MS || profile.timeoutMs, DEFAULT_PROFILE.timeoutMs),
    warmthIntervalMs: positiveInteger(
      process.env.OLLAMA_WARMTH_INTERVAL_MS || profile.warmthIntervalMs,
      DEFAULT_PROFILE.warmthIntervalMs,
    ),
    keepAlive: String(process.env.OLLAMA_KEEP_ALIVE || profile.keepAlive || DEFAULT_PROFILE.keepAlive),
    options: {
      ...DEFAULT_PROFILE.options,
      ...(profile.options || {}),
    },
    systemPrompt: fileConfig.systemPrompt || {},
    responsePolicy: {
      ...DEFAULT_RESPONSE_POLICY,
      ...(fileConfig.responsePolicy || {}),
    },
    corrections: {
      baselineAt: fileConfig.corrections?.baselineAt || null,
      maxPromptCorrections: positiveInteger(fileConfig.corrections?.maxPromptCorrections, 20),
    },
  };
  cacheLoadedAt = now;
  return cachedConfig;
}

export function reloadNliConfig() {
  cachedConfig = null;
  cacheLoadedAt = 0;
  return getNliConfig({ forceReload: true });
}

export { CONFIG_PATH };