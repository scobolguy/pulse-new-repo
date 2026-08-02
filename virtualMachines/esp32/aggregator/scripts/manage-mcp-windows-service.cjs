const path = require('node:path');
const { Service } = require('node-windows');

const action = String(process.argv[2] || '').toLowerCase();
const aggregatorRoot = path.resolve(__dirname, '..');
const service = new Service({
  name: 'PulseMcpService',
  description: 'Pulse local Model Context Protocol HTTP service',
  script: path.join(aggregatorRoot, 'src', 'mcp', 'pulseMcpServer.mjs'),
  workingDirectory: aggregatorRoot,
  nodeOptions: [`--env-file-if-exists=${path.join(aggregatorRoot, '.env.local')}`],
  wait: 2,
  grow: 0.5,
  maxRestarts: 10,
  abortOnError: false,
});

function fail(error) {
  console.error(`[MCP service] ${error?.message || error}`);
  process.exitCode = 1;
}

service.on('error', fail);
service.on('invalidinstallation', () => fail(new Error('The existing service installation is invalid')));

if (action === 'install') {
  service.on('install', () => {
    console.log('[MCP service] Installed PulseMcpService; starting it now.');
    service.start();
  });
  service.on('alreadyinstalled', () => {
    console.log('[MCP service] PulseMcpService is already installed.');
  });
  service.on('start', () => {
    console.log('[MCP service] PulseMcpService is running at http://127.0.0.1:4011/mcp');
  });
  service.install();
} else if (action === 'uninstall') {
  service.on('uninstall', () => {
    console.log('[MCP service] PulseMcpService was stopped and removed.');
  });
  service.on('alreadyuninstalled', () => {
    console.log('[MCP service] PulseMcpService is not installed.');
  });
  service.uninstall();
} else {
  console.error('Usage: node scripts/manage-mcp-windows-service.cjs <install|uninstall>');
  process.exitCode = 2;
}