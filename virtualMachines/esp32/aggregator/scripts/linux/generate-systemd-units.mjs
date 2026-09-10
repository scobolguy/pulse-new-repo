#!/usr/bin/env node
/**
 * Generates systemd unit files for every service in config/service-registry.json
 * for a given environment, writing them to deploy/systemd/. Run this, then
 * use scripts/linux/install-services.sh to copy them into /etc/systemd/system.
 *
 * Usage:
 *   node scripts/linux/generate-systemd-units.mjs [--environment <name>] [--user pulse]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listServiceKeys, getServiceEntry, getServiceUrl } from '../../src/backend/modules/serviceRegistry.mjs';

const AGGREGATOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = path.resolve(AGGREGATOR_ROOT, '..');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'deploy', 'systemd');

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

const environmentName = getArg('environment', undefined);
const serviceUser = getArg('user', 'pulse');

function buildUnitContent(entry) {
  const envLines = [`Environment=PULSE_ENVIRONMENT=${entry.environment}`];
  if (entry.portEnvVar) envLines.push(`Environment=${entry.portEnvVar}=${entry.port}`);

  if (entry.key === 'gateway') {
    const brokerEntry = getServiceEntry('broker', entry.environment);
    const homeAutomationEntry = getServiceEntry('homeAutomation', entry.environment);
    envLines.push('Environment=MODULAR_BACKEND=1');
    envLines.push(`Environment=${brokerEntry.gatewayEnvVar}=${getServiceUrl('broker', entry.environment)}`);
    envLines.push(`Environment=${homeAutomationEntry.gatewayEnvVar}=${getServiceUrl('homeAutomation', entry.environment)}`);
  }

  const cliArgs = entry.portCliArg ? ` ${entry.portCliArg}=${entry.port}` : '';

  return `[Unit]
Description=${entry.name} (${entry.environment})
After=network.target

[Service]
Type=simple
User=${serviceUser}
WorkingDirectory=${AGGREGATOR_ROOT}
EnvironmentFile=-${AGGREGATOR_ROOT}/.env.local
${envLines.join('\n')}
ExecStart=/usr/bin/env node ${entry.entry}${cliArgs}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
`;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const written = [];
for (const key of listServiceKeys()) {
  const entry = getServiceEntry(key, environmentName);
  const fileName = `${entry.osServiceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.service`;
  const unitPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(unitPath, buildUnitContent(entry), 'utf8');
  written.push({ key, fileName, port: entry.port });
}

console.log(`Generated ${written.length} unit file(s) in ${OUTPUT_DIR}:`);
for (const item of written) {
  console.log(`  ${item.fileName}  (${item.key}, port ${item.port})`);
}
