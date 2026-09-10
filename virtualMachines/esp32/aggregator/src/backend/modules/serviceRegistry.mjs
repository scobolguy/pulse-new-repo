/**
 * Loads config/service-registry.json — the single source of truth for
 * PULSE service processes (entry script, port env var, gateway env var name)
 * and named "environments" (a full port set + OS-service-name prefix), so
 * one box can run multiple independent PULSE stacks without port or
 * service-name collisions. Used by backend.mjs (discovery endpoint),
 * service-manager.mjs (dev orchestration), and the OS-service install
 * scripts (Windows/Linux).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REGISTRY_PATH = path.resolve(AGGREGATOR_ROOT, 'config', 'service-registry.json');
const DEFAULT_ENVIRONMENT = 'default';

let cachedRegistry = null;

export function loadServiceRegistry({ force = false } = {}) {
  if (cachedRegistry && !force) return cachedRegistry;
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  cachedRegistry = {
    version: parsed?.version || 1,
    services: parsed?.services && typeof parsed.services === 'object' ? parsed.services : {},
    environments: parsed?.environments && typeof parsed.environments === 'object' ? parsed.environments : {}
  };
  return cachedRegistry;
}

export function resolveEnvironmentName(explicit) {
  return String(explicit || process.env.PULSE_ENVIRONMENT || DEFAULT_ENVIRONMENT).trim() || DEFAULT_ENVIRONMENT;
}

export function getEnvironment(environmentName) {
  const registry = loadServiceRegistry();
  const name = resolveEnvironmentName(environmentName);
  const environment = registry.environments[name];
  if (!environment) {
    throw new Error(`Unknown environment '${name}' in service-registry.json (known: ${Object.keys(registry.environments).join(', ') || 'none'})`);
  }
  return { key: name, ...environment };
}

export function listServiceKeys() {
  const registry = loadServiceRegistry();
  return Object.keys(registry.services);
}

/** Returns the service definition merged with its resolved port/host for the given environment. */
export function getServiceEntry(key, environmentName) {
  const registry = loadServiceRegistry();
  const definition = registry.services[key];
  if (!definition) throw new Error(`Unknown service '${key}' in service-registry.json`);
  const environment = getEnvironment(environmentName);
  const port = environment.ports?.[key];
  if (!port) throw new Error(`Environment '${environment.key}' has no port assigned for service '${key}'`);
  const servicePrefix = String(environment.servicePrefix || 'Pulse');
  return {
    key,
    ...definition,
    port,
    host: definition.defaultHost,
    environment: environment.key,
    osServiceName: `${servicePrefix}${key.charAt(0).toUpperCase()}${key.slice(1)}${environment.key === DEFAULT_ENVIRONMENT ? '' : `-${environment.key}`}`
  };
}

export function listServiceEntries(environmentName) {
  return listServiceKeys().map((key) => getServiceEntry(key, environmentName));
}

export function getServiceUrl(key, environmentName) {
  const entry = getServiceEntry(key, environmentName);
  const host = entry.host === '0.0.0.0' ? '127.0.0.1' : entry.host;
  return `http://${host}:${entry.port}`;
}

export const SERVICE_REGISTRY_PATH = REGISTRY_PATH;
