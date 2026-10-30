import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildVflDeployments } from './build-vfl-deployment.mjs';
import { compileWorkflowDSL } from '../../../../languages/wfl/src/compile-workflow-dsl.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function parseArguments(args) {
  const options = { udpPort: 4211 };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!['--in', '--node', '--map-file', '--backend', '--environment', '--udp-port'].includes(flag)) {
      throw new Error(`Unknown option '${flag}'`);
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    const key = ({
      '--in': 'input',
      '--node': 'nodeId',
      '--map-file': 'mapFile',
      '--backend': 'backendUrl',
      '--environment': 'environment',
      '--udp-port': 'udpPort'
    })[flag];
    options[key] = value;
  }
  options.input = required(options.input, '--in');
  options.nodeId = required(options.nodeId, '--node');
  options.mapFile = required(options.mapFile, '--map-file');
  options.udpPort = Number(options.udpPort);
  if (!Number.isInteger(options.udpPort) || options.udpPort < 1 || options.udpPort > 65535) {
    throw new Error('--udp-port must be an integer from 1 to 65535');
  }
  options.backendUrl = String(options.backendUrl || process.env.PULSE_BACKEND_URL || 'http://127.0.0.1:4000')
    .replace(/\/+$/, '');
  return options;
}

async function deploy(options) {
  const inputPath = path.resolve(options.input);
  const mapPath = path.resolve(options.mapFile);
  const mapText = await fs.readFile(mapPath, 'utf8');
  if (path.extname(mapPath).toLowerCase() !== '.mapl') throw new Error('--map-file must point to a .mapl file');

  const source = await fs.readFile(inputPath, 'utf8');
  const compiled = compileWorkflowDSL(source, {
    ...(options.environment ? { environment: options.environment } : {}),
    variables: {
      MAPPER_NODE_ID: options.nodeId,
      MAPPER_MAP_FILE: mapPath
    }
  });
  const flowResource = (compiled.deployments || [])
    .flatMap(deployment => deployment.resources || [])
    .find(resource => resource.kind === 'flow' && String(resource.fileName || '').endsWith('.vfl'));
  if (!flowResource) throw new Error('WFL package must contain a VFL flow resource');

  const flowPath = path.resolve(path.dirname(inputPath), flowResource.fileName);
  const flow = JSON.parse(await fs.readFile(flowPath, 'utf8'));
  const mapNode = flow.nodes?.find(node => node.kind === 'daemon' && node.execution?.hostedUdpMapper === true);
  if (!mapNode) throw new Error('WFL VFL flow must define a hosted UDP MAPL daemon');
  const configuredMapFile = String(compiled.configuration?.variables?.MAPPER_MAP_FILE || '');
  const packageBuild = await buildVflDeployments(compiled, { artifactRoot: path.dirname(inputPath) });
  const service = packageBuild.artifacts.find(artifact => artifact.programMap.runtimeUnit.kind === 'service');
  const daemon = packageBuild.artifacts.find(artifact => artifact.programMap.runtimeUnit.kind === 'daemon');
  if (!service || !daemon) throw new Error('WFL package must build one hosted service and one hosted daemon');
  if (path.resolve(configuredMapFile) !== mapPath) throw new Error('WFL mapper source did not resolve to --map-file');
  if (!daemon.programMap.entries?.length) throw new Error('MAPL source contains no executable maps');

  const base = '/pmachine/programs/data-mapper-udp';
  const files = [];
  const artifactPaths = new Map();
  for (const [kind, artifact] of [['service', service], ['daemon', daemon]]) {
    const prefix = `${base}-${kind}`;
    const file = `${prefix}.pcode`;
    const map = `${prefix}.program.json`;
    const signedMap = attachPcodeSignature(artifact.programMap, artifact.pcodeText);
    files.push({ path: file, content: artifact.pcodeText });
    files.push({ path: map, content: `${JSON.stringify(signedMap, null, 2)}\n` });
    artifactPaths.set(kind, { file, map });
  }

  const requestBody = {
    serviceName: 'data-mapper-udp',
    packageName: 'data-mapper-udp',
    packageVersion: '1.0.0',
    displayName: 'Data Mapper UDP Daemon',
    startup: true,
    files,
    hostedServiceInstall: {
      serviceFile: artifactPaths.get('service').file,
      serviceMap: artifactPaths.get('service').map,
      collectorId: 'data-mapper-udp',
      observationTtlMs: 180000,
      announcementIntervalMs: 60000,
      daemons: [{
        file: artifactPaths.get('daemon').file,
        map: artifactPaths.get('daemon').map,
        udpPort: options.udpPort
      }]
    }
  };

  const response = await fetch(
    `${options.backendUrl}/api/nodes/${encodeURIComponent(options.nodeId)}/deploy`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    }
  );
  const payload = await response.text();
  let result;
  try { result = payload ? JSON.parse(payload) : {}; } catch { result = { error: payload }; }
  if (!response.ok) {
    throw new Error(`Deployment request failed (HTTP ${response.status}): ${result.error || payload || response.statusText}`);
  }
  if (result.hostedInstallation?.running !== true) {
    throw new Error('Backend did not confirm that the hosted service is running');
  }
  return {
    nodeId: options.nodeId,
    udpPort: options.udpPort,
    artifactPaths: files.map(file => file.path),
    result
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await deploy(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[WFL-UDP-MAPPER-DEPLOY] ${error.message}`);
    process.exitCode = 1;
  }
}

export { deploy, parseArguments };
