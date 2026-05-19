export function readEnvString(name, fallback = '') {
  const value = process.env[name];
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

export function readEnvSecret(name, fallback = '') {
  const value = process.env[name];
  if (value == null) return fallback;
  return String(value) || fallback;
}

export function readEnvNumber(name, fallback) {
  return Number(process.env[name] || fallback) || fallback;
}

export function readEnvBoolean(name, truthyValues = ['true'], fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return truthyValues.includes(value);
}

export const BROKER_SUPPORTED_PROVIDERS = ['legacy', 'memory', 'rabbitmq', 'msmq', 'kafka', 'ibm', 'apache'];

const BROKER_PROVIDER_ALIASES = new Map([
  ...BROKER_SUPPORTED_PROVIDERS.map(provider => [provider, provider]),
  ['apache-broker', 'apache'],
  ['apache-activemq', 'apache'],
  ['activemq', 'apache'],
  ['apache-kafka', 'kafka'],
  ['ibm-message-broker', 'ibm'],
  ['ibmmq', 'ibm'],
  ['ibm-mq', 'ibm']
]);

export function normalizeBrokerProvider(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return BROKER_PROVIDER_ALIASES.get(key) || '';
}
