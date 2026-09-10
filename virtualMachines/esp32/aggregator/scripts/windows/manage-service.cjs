#!/usr/bin/env node
/**
 * Generalized Windows Service installer/manager for any PULSE service
 * defined in config/service-registry.json, using node-windows (already a
 * dependency; no external nssm.exe required — same approach as
 * manage-mcp-windows-service.cjs).
 *
 * Usage:
 *   node scripts/windows/manage-service.cjs <install|uninstall|start|stop> <gateway|broker|homeAutomation|queueManager> [--environment <name>]
 *
 * Requires an elevated (Administrator) PowerShell/cmd session for
 * install/uninstall/start/stop — this script does not attempt to elevate
 * itself.
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Service } = require('node-windows');

const aggregatorRoot = path.resolve(__dirname, '..', '..');

async function main() {
  const { getServiceEntry, resolveEnvironmentName } = await import(
    pathToFileURL(path.join(aggregatorRoot, 'src', 'backend', 'modules', 'serviceRegistry.mjs')).href
  );

  const action = String(process.argv[2] || '').toLowerCase();
  const serviceKey = String(process.argv[3] || '').trim();
  const envArgIndex = process.argv.indexOf('--environment');
  const environmentName = envArgIndex >= 0 ? process.argv[envArgIndex + 1] : resolveEnvironmentName();

  if (!['install', 'uninstall', 'start', 'stop'].includes(action) || !serviceKey) {
    console.error('Usage: node scripts/windows/manage-service.cjs <install|uninstall|start|stop> <gateway|broker|homeAutomation|queueManager> [--environment <name>]');
    process.exitCode = 2;
    return;
  }

  let entry;
  try {
    entry = getServiceEntry(serviceKey, environmentName);
  } catch (error) {
    console.error(`[SERVICE] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const envOverrides = { PULSE_ENVIRONMENT: entry.environment };
  if (entry.portEnvVar) envOverrides[entry.portEnvVar] = String(entry.port);

  if (serviceKey === 'gateway') {
    // Installing the Gateway as its own OS service assumes Broker and Home
    // Automation are also installed/running as services in the SAME
    // environment, so point the Gateway at them instead of running in-process.
    const brokerEntry = getServiceEntry('broker', entry.environment);
    const homeAutomationEntry = getServiceEntry('homeAutomation', entry.environment);
    envOverrides.MODULAR_BACKEND = '1';
    envOverrides[brokerEntry.gatewayEnvVar] = `http://127.0.0.1:${brokerEntry.port}`;
    envOverrides[homeAutomationEntry.gatewayEnvVar] = `http://127.0.0.1:${homeAutomationEntry.port}`;
  }

  const envArray = Object.entries(envOverrides).map(([name, value]) => ({ name, value: String(value) }));

  const service = new Service({
    name: entry.osServiceName,
    description: `${entry.name} (${entry.environment})${entry.description ? ` - ${entry.description}` : ''}`,
    script: path.join(aggregatorRoot, entry.entry),
    workingDirectory: aggregatorRoot,
    env: envArray,
    wait: 2,
    grow: 0.5,
    maxRestarts: 10,
    abortOnError: false
  });

  function fail(error) {
    console.error(`[SERVICE] ${entry.osServiceName}: ${error?.message || error}`);
    process.exitCode = 1;
  }

  service.on('error', fail);
  service.on('invalidinstallation', () => fail(new Error('The existing service installation is invalid')));

  if (action === 'install') {
    service.on('install', () => {
      console.log(`[SERVICE] Installed ${entry.osServiceName}; starting it now.`);
      service.start();
    });
    service.on('alreadyinstalled', () => console.log(`[SERVICE] ${entry.osServiceName} is already installed.`));
    service.on('start', () => console.log(`[SERVICE] ${entry.osServiceName} is running on port ${entry.port}.`));
    service.install();
  } else if (action === 'uninstall') {
    service.on('uninstall', () => console.log(`[SERVICE] ${entry.osServiceName} was stopped and removed.`));
    service.on('alreadyuninstalled', () => console.log(`[SERVICE] ${entry.osServiceName} is not installed.`));
    service.uninstall();
  } else if (action === 'start') {
    service.on('start', () => console.log(`[SERVICE] ${entry.osServiceName} started.`));
    service.start();
  } else if (action === 'stop') {
    service.on('stop', () => console.log(`[SERVICE] ${entry.osServiceName} stopped.`));
    service.stop();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
