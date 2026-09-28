#!/usr/bin/env node
/**
 * Service Manager
 * 
 * Spawns and manages individual microservices in split (multi-process) mode:
 * - Broker Service
 * - Home Automation Service
 * - API Gateway - started with BROKER_SERVICE_URL/MODULAR_BACKEND and
 *   HOME_AUTOMATION_SERVICE_URL pointed at the two services above.
 *
 * Ports and OS-service names come from config/service-registry.json for the
 * environment named by PULSE_ENVIRONMENT (default 'default'), so the same
 * box can run a second independent stack (e.g. PULSE_ENVIRONMENT=secondary)
 * on a different port set without colliding with the first.
 *
 * queue-manager-node.mjs is a separate, optional REMOTE/clustered queue
 * manager (used for scaling queues across nodes) - it is not part of the
 * default single-machine split and is not started by startAll(); the
 * Gateway's own qm-primary/qm-secondary (in-process by default, or
 * RabbitMQ-backed via QUEUE_MANAGER_PROVIDER) handle queueing on their own.
 *
 * Usage:
 *   node service-manager.mjs          # Start all services
 *   BROKER_PROVIDER=msmq node service-manager.mjs  # Start with MSMQ broker
 *   PULSE_ENVIRONMENT=secondary node service-manager.mjs  # Second stack, own ports
 *   
 * Commands (via stdin):
 *   restart-broker      # Restart broker service
 *   restart-gateway     # Restart API gateway
 *   restart-home-automation  # Restart home automation service
 *   stop                # Stop all services
 *   status              # Show service status
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';
import { getServiceEntry, getServiceUrl, listServiceEntries, resolveEnvironmentName } from './src/backend/modules/serviceRegistry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENVIRONMENT = resolveEnvironmentName();

// Track child processes
const serviceEntries = Object.fromEntries(listServiceEntries(ENVIRONMENT).map((entry) => [entry.key, entry]));
const services = Object.fromEntries(Object.keys(serviceEntries).map((key) => [key, null]));

/**
 * Start a service
 */
function startService(serviceName, env = {}) {
  const entry = serviceEntries[serviceName];
  if (!entry) {
    console.error(`[MANAGER] Unknown service: ${serviceName}`);
    return;
  }

  if (services[serviceName]?.pid) {
    console.log(`[MANAGER] Service ${serviceName} already running (PID ${services[serviceName].pid})`);
    return;
  }

  const envVars = { ...process.env, ...env };
  const args = [entry.entry];
  if (entry.portCliArg) args.push(entry.portCliArg, String(entry.port));
  const child = spawn('node', args, {
    cwd: __dirname,
    env: envVars,
    stdio: 'inherit',  // Inherit parent's stdio so we see logs
    detached: false
  });

  services[serviceName] = child;
  console.log(`[MANAGER] Started ${serviceName} (PID ${child.pid})`);

  child.on('exit', (code, signal) => {
    console.log(`[MANAGER] Service ${serviceName} exited with code ${code} signal ${signal}`);
    services[serviceName] = null;
  });

  child.on('error', (err) => {
    console.error(`[MANAGER] Error in ${serviceName}:`, err);
  });
}

/**
 * Stop a service
 */
function stopService(serviceName) {
  if (!services[serviceName]) {
    console.log(`[MANAGER] Service ${serviceName} is not running`);
    return;
  }

  const child = services[serviceName];
  console.log(`[MANAGER] Stopping ${serviceName} (PID ${child.pid})`);
  
  child.kill('SIGTERM');
  
  // Force kill after 5 seconds if not stopped
  setTimeout(() => {
    if (services[serviceName]?.pid === child.pid) {
      console.log(`[MANAGER] Force killing ${serviceName}`);
      child.kill('SIGKILL');
    }
  }, 5000);
}

/**
 * Restart a service
 */
function restartService(serviceName, env = {}) {
  console.log(`[MANAGER] Restarting ${serviceName}...`);
  stopService(serviceName);
  setTimeout(() => startService(serviceName, env), 1000);
}

/**
 * Show service status
 */
function showStatus() {
  console.log('\n=== SERVICE STATUS ===');
  for (const [name, child] of Object.entries(services)) {
    const status = child?.pid ? `RUNNING (PID ${child.pid})` : 'STOPPED';
    console.log(`  ${name.padEnd(15)} : ${status}`);
  }
  console.log('======================\n');
}

/**
 * Start all services
 */
function startAll() {
  console.log(`[MANAGER] Starting all services (split mode, environment=${ENVIRONMENT})...`);

  const env = {};
  for (const entry of Object.values(serviceEntries)) {
    if (entry.portEnvVar) env[entry.portEnvVar] = String(entry.port);
  }
  const broker = serviceEntries.broker;
  const homeAutomation = serviceEntries.homeAutomation;
  if (broker?.gatewayEnvVar) env[broker.gatewayEnvVar] = getServiceUrl('broker', ENVIRONMENT);
  if (homeAutomation?.gatewayEnvVar) env[homeAutomation.gatewayEnvVar] = getServiceUrl('homeAutomation', ENVIRONMENT);
  env.MODULAR_BACKEND = '1';

  for (const entry of Object.values(serviceEntries)) {
    if (entry.autoStart === false) continue;
    startService(entry.key, env);
  }
}

/**
 * Stop all services
 */
function stopAll() {
  console.log('[MANAGER] Stopping all services...');
  Object.keys(services).forEach(name => stopService(name));
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n[MANAGER] Received SIGINT, shutting down gracefully...');
  stopAll();
  setTimeout(() => process.exit(0), 3000);
});

process.on('SIGTERM', () => {
  console.log('[MANAGER] Received SIGTERM, shutting down...');
  stopAll();
  setTimeout(() => process.exit(0), 3000);
});

/**
 * REPL for commands
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt() {
  rl.question('[manager] > ', (line) => {
    const cmd = line.trim().toLowerCase();

    if (cmd.startsWith('restart-')) {
      const serviceName = cmd.slice('restart-'.length).split(' ')[0];
      restartService(serviceName);
    } else if (cmd === 'stop') {
      stopAll();
      setTimeout(() => process.exit(0), 2000);
    } else if (cmd === 'status') {
      showStatus();
    } else if (cmd === 'help') {
      console.log(`
Available commands:
  restart-<service>               - Restart any configured service
  stop                            - Stop all services and exit
  status                          - Show service status
  help                            - Show this help
      `);
    } else if (cmd !== '') {
      console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
    }

    prompt();
  });
}

// Main
console.log(`
╔════════════════════════════════════════╗
║     Pulse Backend Service Manager      ║
║     Type 'help' for commands            ║
╚════════════════════════════════════════╝
`);

startAll();
setTimeout(() => {
  showStatus();
  prompt();
}, 3000);
