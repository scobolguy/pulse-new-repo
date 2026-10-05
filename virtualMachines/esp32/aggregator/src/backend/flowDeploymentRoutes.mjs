import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../scripts/pcode-signing.mjs';

const ALLOWED_TYPES = new Set(['compute', 'dylib']);
const ALLOWED_ENVIRONMENTS = new Set(['dev', 'qa', 'prod']);

function token(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return normalized || fallback;
}

function deploymentId(name, version) {
  return `${token(name, 'flow')}:${token(version, '0.0.0')}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateRequest(body) {
  const flowName = token(body?.flowName, '');
  const version = token(body?.version, '');
  const type = token(body?.type, 'service');
  const environment = token(body?.environment, 'dev');
  const placement = body?.placement && typeof body.placement === 'object' ? body.placement : {};
  const runtime = String(body?.metadata?.runtime || 'esp32-pmachine').trim().toLowerCase();

  if (!flowName) throw new Error('flowName is required');
  if (!version) throw new Error('version is required');
  if (!ALLOWED_TYPES.has(type)) throw new Error(`type must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}`);
  if (runtime !== 'esp32-pmachine') throw new Error('runtime must be esp32-pmachine');
  if (!ALLOWED_ENVIRONMENTS.has(environment)) throw new Error('environment must be dev, qa, or prod');
  if (!['auto', ''].includes(String(placement.cluster || 'auto')) && !String(placement.cluster).trim()) {
    throw new Error('placement.cluster must be auto or a cluster id');
  }
  if (!['auto', ''].includes(String(placement.node || 'auto')) && !String(placement.node).trim()) {
    throw new Error('placement.node must be auto or a node id');
  }

  return {
    flowName,
    version,
    type,
    runtime,
    environment,
    placement: {
      cluster: String(placement.cluster || 'auto').trim() || 'auto',
      node: String(placement.node || 'auto').trim() || 'auto'
    },
    source: typeof body?.source === 'string' ? body.source : '',
    bundle: typeof body?.bundle === 'string' ? body.bundle : '',
    metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}
  };
}

export function registerFlowDeploymentRoutes(app, { runtimeRoot }) {
  if (!runtimeRoot) throw new Error('runtimeRoot is required');
  const packageRoot = path.join(runtimeRoot, 'federated-ffs', 'packages');
  const deploymentIndexPath = path.join(runtimeRoot, 'federated-ffs', 'service-deployments.json');

  async function getPlacementNodes() {
    const provider = app.locals.discoveryProvider;
    if (provider?.mode !== 'remote') return app.locals.esp32NodeRegistry?.getAllNodes?.() || [];
    const nodes = app.locals.getCurrentNodesWithTopology
      ? await app.locals.getCurrentNodesWithTopology()
      : provider.getNodes();
    return nodes.filter((node) => node.available !== false && node.availability?.available !== false
      && !node.draining && !node.availability?.draining
      && Array.isArray(node.details?.services) && node.details.services.some((service) =>
        String(typeof service === 'string' ? service : service?.name || service?.serviceName || '')
          .toLowerCase().includes('pmachine')));
  }

  async function findPlacementNode(nodeId) {
    return (await getPlacementNodes()).find((node) =>
      [node.nodeId, node.id, node.nodeName].some((id) => String(id || '') === nodeId)) || null;
  }

  async function readIndex() {
    try {
      const parsed = JSON.parse(await fs.readFile(deploymentIndexPath, 'utf8'));
      return { updatedAt: parsed?.updatedAt || new Date().toISOString(), deployments: Array.isArray(parsed?.deployments) ? parsed.deployments : [] };
    } catch {
      return { updatedAt: new Date().toISOString(), deployments: [] };
    }
  }

  async function writeIndex(deployments) {
    await fs.mkdir(path.dirname(deploymentIndexPath), { recursive: true });
    await fs.writeFile(deploymentIndexPath, `${JSON.stringify({ updatedAt: new Date().toISOString(), deployments }, null, 2)}\n`, 'utf8');
  }

  async function uploadToNode(node, packageDir, name) {
    if (!node?.ip) throw new Error('target node is not addressable');
    const baseUrl = `http://${node.ip}:${Number(node.port || 80)}`;
    const remotePrefix = token(name, 'flow').slice(0, 8);
    const files = [
      [`/${remotePrefix}.pc`, await fs.readFile(path.join(packageDir, 'program.pcode'), 'utf8')],
      [`/${remotePrefix}.map.json`, await fs.readFile(path.join(packageDir, 'program.json'), 'utf8')]
    ];
    for (const [file, body] of files) {
      const response = await fetch(`${baseUrl}/ffs/upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ file, body }),
        signal: AbortSignal.timeout(20000)
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`FFS upload ${file} failed (${response.status}): ${text.slice(0, 240)}`);
    }
    return { nodeId: node.nodeId || node.id, ip: node.ip, port: Number(node.port || 80), pcode: files[0][0], programMap: files[1][0] };
  }

  app.get('/api/deployments', async (_req, res) => {
    return res.json(await readIndex());
  });

  app.get('/api/deployment/:deploymentId', async (req, res) => {
    const index = await readIndex();
    const requestedId = String(req.params.deploymentId || '').trim();
    const deployment = index.deployments.find((item) => String(item?.deploymentId || '') === requestedId);
    if (!deployment) return res.status(404).json({ error: 'deployment not found' });
    return res.json({ deployment });
  });

  app.post('/api/deployment/:deploymentId/rollback', async (req, res) => {
    try {
      const index = await readIndex();
      const requestedId = String(req.params.deploymentId || '').trim();
      const currentIndex = index.deployments.findIndex((item) => String(item?.deploymentId || '') === requestedId);
      if (currentIndex < 0) return res.status(404).json({ error: 'deployment not found' });
      const current = index.deployments[currentIndex];
      const targetVersion = token(req.body?.version, '');
      const previous = index.deployments.find((item) => String(item?.serviceName || '').toLowerCase() === String(current.serviceName || '').toLowerCase()
        && String(item?.environment || 'dev') === String(current.environment || 'dev')
        && String(item?.packageVersion || '') === targetVersion);
      if (!previous) return res.status(404).json({ error: 'rollback version not found' });

      let remote = null;
      const targetNodeId = String(current.targetNodeId || '').trim();
      if (targetNodeId) {
        const node = await findPlacementNode(targetNodeId);
        if (!node) return res.status(404).json({ error: `target node not found: ${targetNodeId}` });
        const packageDir = path.join(packageRoot, token(previous.packageName, 'flow'), token(previous.packageVersion, '0.0.0'));
        remote = await uploadToNode(node, packageDir, previous.packageName);
      }

      const now = new Date().toISOString();
      index.deployments[currentIndex] = {
        ...current,
        state: 'rolled_back',
        runtimeState: 'running',
        rollbackTarget: previous.deploymentId,
        remote,
        updatedAt: now
      };
      await writeIndex(index.deployments);
      return res.json({ status: 'rolled_back', deployment: index.deployments[currentIndex], rollbackTarget: previous, remote });
    } catch (error) {
      return res.status(422).json({ error: error?.message || String(error) });
    }
  });

  app.post('/api/deployment/flow', async (req, res) => {
    try {
      const request = validateRequest(req.body || {});
      if (!request.source.trim() && !request.bundle.trim()) {
        return res.status(400).json({ error: 'source or bundle is required' });
      }
      if (request.environment !== 'dev' && request.bundle.trim() && !request.metadata.programMap) {
        return res.status(422).json({ error: 'qa and prod bundle deployments require metadata.programMap for signing' });
      }

      let pcode;
      let programMap;
      if (request.source.trim()) {
        const artifact = compilePascalishProgramWithAntlr(request.source, { fileName: `${request.flowName}.pas` });
        pcode = String(artifact.pcodeText || '').endsWith('\n') ? artifact.pcodeText : `${artifact.pcodeText}\n`;
        programMap = attachPcodeSignature(structuredClone(artifact.programMap || {}), pcode);
      } else {
        pcode = Buffer.from(request.bundle, 'base64').toString('utf8');
        if (!pcode.trim()) return res.status(422).json({ error: 'bundle is not valid base64 p-code' });
        programMap = attachPcodeSignature(
          structuredClone(request.metadata.programMap || { serviceId: request.flowName }),
          pcode
        );
      }

      const name = token(request.flowName, 'flow');
      const version = token(request.version, '0.0.0');
      const packageDir = path.join(packageRoot, name, version);
      await fs.mkdir(packageDir, { recursive: true });
      const manifest = {
        name,
        version,
        serviceId: request.flowName,
        runtimeKind: request.type,
        runtime: request.runtime,
        environment: request.environment,
        pcodeFile: 'program.pcode',
        programMapFile: 'program.json',
        pcodeBytes: Buffer.byteLength(pcode),
        programMapBytes: Buffer.byteLength(JSON.stringify(programMap)),
        contentHash: sha256(pcode),
        publishedAt: new Date().toISOString(),
        metadata: request.metadata
      };

      await fs.writeFile(path.join(packageDir, 'program.pcode'), pcode, 'utf8');
      await fs.writeFile(path.join(packageDir, 'program.json'), `${JSON.stringify(programMap, null, 2)}\n`, 'utf8');
      await fs.writeFile(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      const index = await readIndex();
      const id = deploymentId(request.flowName, request.version);
      const deployment = {
        key: `${request.flowName}::${request.placement.node}`.toLowerCase(),
        deploymentId: id,
        serviceName: request.flowName,
        packageName: name,
        packageVersion: version,
        workloadKind: request.type,
        runtime: request.runtime,
        environment: request.environment,
        clusterId: request.placement.cluster,
        targetNodeId: request.placement.node === 'auto' ? null : request.placement.node,
        targetNodeIds: request.placement.node === 'auto' ? ['*'] : [request.placement.node],
        pcodePath: `packages/${name}/${version}/program.pcode`,
        state: 'staged',
        runtimeState: 'staged',
        contentHash: manifest.contentHash,
        createdAt: manifest.publishedAt,
        updatedAt: new Date().toISOString(),
        metadata: request.metadata
      };
      const deployments = Array.isArray(index.deployments) ? index.deployments : [];
      const existing = deployments.findIndex((item) => item.deploymentId === id && item.environment === request.environment);
      if (existing >= 0) deployments[existing] = deployment;
      else deployments.push(deployment);
      const nodeId = request.placement.node;
      let remote = null;
      let selectedNode = null;
      if (nodeId === 'auto') {
        const candidates = await getPlacementNodes();
        selectedNode = candidates.find((node) => {
          if (!node?.ip) return false;
          if (request.placement.cluster === 'auto') return true;
          return String(node?.topology?.activeClusterId || node?.metadata?.clusterId || '').trim() === request.placement.cluster;
        }) || null;
      } else {
        selectedNode = await findPlacementNode(nodeId);
        if (!selectedNode) return res.status(404).json({ error: `target node not found: ${nodeId}` });
      }
      if (selectedNode) {
        deployment.targetNodeId = String(selectedNode.nodeId || selectedNode.id || '').trim() || null;
        deployment.targetNodeIds = deployment.targetNodeId ? [deployment.targetNodeId] : ['*'];
        remote = await uploadToNode(selectedNode, packageDir, name);
        deployment.state = 'running';
        deployment.runtimeState = 'running';
        deployment.remote = remote;
        deployment.updatedAt = new Date().toISOString();
        deployments[existing >= 0 ? existing : deployments.length - 1] = deployment;
      } else if (nodeId !== 'auto') {
        return res.status(404).json({ error: `target node not found: ${nodeId}` });
      }
      await writeIndex(deployments);

      return res.status(201).json({ status: deployment.state, deployment, package: manifest, remote });
    } catch (error) {
      return res.status(422).json({ error: error?.message || String(error) });
    }
  });
}

export { validateRequest as validateFlowDeploymentRequest };
