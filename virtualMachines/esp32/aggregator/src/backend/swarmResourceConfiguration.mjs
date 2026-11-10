import fs from 'node:fs/promises';
import net from 'node:net';
import { loadRuntimeMachineAuth } from './security/runtimeMachineAuth.mjs';
import { SwarmResourceRegistry } from './swarmResourceRegistry.mjs';

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

export async function loadSwarmResourceConfiguration({
  configPath, credentialsPath, ownerAggregatorId, logger = console,
}) {
  if (typeof configPath !== 'string' || !configPath.trim())
    throw new Error('Swarm resource configuration path is required');
  if (typeof credentialsPath !== 'string' || !credentialsPath.trim())
    throw new Error('Machine credential configuration path is required');
  const owner = requireIdentifier(ownerAggregatorId, 'owner aggregator id');
  const configuration = JSON.parse(await fs.readFile(configPath, 'utf8'));
  if (!configuration || Object.keys(configuration).some(key => !['version', 'clusterId', 'nodes'].includes(key)) ||
      configuration.version !== 1 || !Array.isArray(configuration.nodes) ||
      configuration.nodes.length < 1 || configuration.nodes.length > 256)
    throw new Error('Invalid swarm resource configuration');
  const clusterId = requireIdentifier(configuration.clusterId, 'swarm id');
  const resources = new SwarmResourceRegistry({ clusterId });
  const enrolled = new Set();
  for (const node of configuration.nodes) {
    if (!node || Object.keys(node).some(key => !['nodeId', 'capabilities', 'codeIds'].includes(key)))
      throw new Error('Swarm node configuration contains unsupported fields');
    if (!node || net.isIP(node.nodeId) !== 4) throw new Error('Swarm resource nodes require IPv4 identities');
    resources.enroll({ nodeId: node.nodeId, capabilities: node.capabilities });
    enrolled.add(node.nodeId);
    if (!Array.isArray(node.codeIds) || node.codeIds.length > 128)
      throw new Error('Explicit node executable bundle hashes are required');
    for (const codeId of node.codeIds) resources.verifyBundle(node.nodeId, codeId);
  }
  const credentialConfiguration = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
  if (!credentialConfiguration ||
      Object.keys(credentialConfiguration).some(key => !['version', 'credentials'].includes(key)) ||
      credentialConfiguration.version !== 1 || !Array.isArray(credentialConfiguration.credentials))
    throw new Error('Invalid runtime machine credential configuration');
  const eligible = credentialConfiguration.credentials.filter(credential =>
    credential?.resourceReports === true && credential.ownerAggregatorId === owner);
  for (const credential of eligible) {
    if (!enrolled.has(credential.nodeId))
      throw new Error('Resource-report credential node is not enrolled');
  }
  for (const nodeId of enrolled) {
    if (!eligible.some(credential => credential.nodeId === nodeId))
      throw new Error(`Enrolled node ${nodeId} has no resource-report credential`);
  }
  const machineAuth = await loadRuntimeMachineAuth({
    filePath: credentialsPath, required: true, ownerAggregatorId: owner, logger,
  });
  return {
    clusterId, ownerAggregatorId: owner, resources, machineAuth,
    close() {},
  };
}
