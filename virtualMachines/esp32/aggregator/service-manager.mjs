#!/usr/bin/env node
/**
 * Service Manager
 * 
 * Spawns and manages individual microservices:
 * - Broker Service (port 4001)
 * - Queue Manager Service (port 4002)  [future]
 * - Router Service (port 4003)         [future]
 * - API Gateway (port 4000)
 * 
 * Usage:
 *   node service-manager.mjs          # Start all services
 *   BROKER_PROVIDER=msmq node service-manager.mjs  # Start with MSMQ broker
 *   
 * Commands (via stdin):
 *   restart-broker      # Restart broker service
 *   restart-gateway     # Restart API gateway
 *   stop                # Stop all services
 *   status              # Show service status
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Track child processes
const services = {
  broker: null,
  gateway: null,
  queueManager: null,
  router: null
};

const serviceFiles = {
  broker: 'broker-service.mjs',
  gateway: 'backend.mjs',  // Will be split later, for now use existing backend
  queueManager: 'queue-manager-service.mjs',
  router: 'router-service.mjs'
};

/**
 * Start a service
 */
function startService(serviceName, env = {}) {
  if (!serviceFiles[serviceName]) {
    console.error(`[MANAGER] Unknown service: ${serviceName}`);
    return;
  }

  if (services[serviceName]?.pid) {
    console.log(`[MANAGER] Service ${serviceName} already running (PID ${services[serviceName].pid})`);
    return;
  }

  const envVars = { ...process.env, ...env };
  const child = spawn('node', [serviceFiles[serviceName]], {
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
  console.log('[MANAGER] Starting all services...');
  
  // Broker first
  startService('broker');
  
  // Wait a bit for broker to start, then gateway
  setTimeout(() => {
    startService('gateway');
  }, 2000);
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

    if (cmd.startsWith('restart-broker')) {
      const args = cmd.split(' ').slice(1);
      const env = {};
      for (const arg of args) {
        const [k, v] = arg.split('=');
        if (k && v) env[k.toUpperCase()] = v;
      }
      restartService('broker', env);
    } else if (cmd.startsWith('restart-gateway')) {
      restartService('gateway');
    } else if (cmd === 'stop') {
      stopAll();
      setTimeout(() => process.exit(0), 2000);
    } else if (cmd === 'status') {
      showStatus();
    } else if (cmd === 'help') {
      console.log(`
Available commands:
  restart-broker [ENV=value ...]  - Restart broker service (e.g., restart-broker BROKER_PROVIDER=msmq)
  restart-gateway                 - Restart API gateway
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
