// fileServer.js - Modular File Server backend service
// Supports: FFS (custom file system) and WebDAV (SharePoint)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

// Placeholder for FFS and WebDAV integration
export function createFileServer({ ffsConfig = {}, webdavConfig = {}, federatedConfig = {} } = {}) {
  const router = express.Router();
  // FFS root directory (default: ./ffs-root)
  const ffsRoot = ffsConfig.root || path.resolve(process.cwd(), 'ffs-root');
  const packageRoot = federatedConfig.packageRoot || path.join(ffsRoot, 'packages');
  const deploymentIndexPath = federatedConfig.deploymentIndexPath || path.join(ffsRoot, 'service-deployments.json');
  const deploymentRegistry = federatedConfig.deploymentRegistry instanceof Map
    ? federatedConfig.deploymentRegistry
    : null;

  // Utility: resolve FFS path safely
  function resolveFFSPath(relPath) {
    const safePath = path.normalize(relPath).replace(/^([/\\]+)/, '');
    const resolved = path.join(ffsRoot, safePath);
    const rootWithSep = `${path.resolve(ffsRoot)}${path.sep}`;
    const resolvedAbs = path.resolve(resolved);
    if (resolvedAbs !== path.resolve(ffsRoot) && !resolvedAbs.startsWith(rootWithSep)) {
      throw new Error('Path escapes FFS root');
    }
    return resolvedAbs;
  }

  async function ensureFederatedRoots() {
    await fs.mkdir(ffsRoot, { recursive: true });
    await fs.mkdir(packageRoot, { recursive: true });
  }

  function sanitizePackageToken(value, fallback = 'unnamed') {
    const token = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-');
    return token || fallback;
  }

  function resolvePackagePath(name, version) {
    const safeName = sanitizePackageToken(name, 'package');
    const safeVersion = sanitizePackageToken(version, 'latest');
    return path.join(packageRoot, safeName, safeVersion);
  }

  async function listPackageEntries() {
    await ensureFederatedRoots();
    const packages = [];
    const packageNames = await fs.readdir(packageRoot, { withFileTypes: true });
    for (const nameEntry of packageNames) {
      if (!nameEntry.isDirectory()) continue;
      const name = nameEntry.name;
      const versionsDir = path.join(packageRoot, name);
      const versions = await fs.readdir(versionsDir, { withFileTypes: true });
      for (const versionEntry of versions) {
        if (!versionEntry.isDirectory()) continue;
        const version = versionEntry.name;
        const manifestPath = path.join(versionsDir, version, 'manifest.json');
        const pcodePath = path.join(versionsDir, version, 'program.pcode');
        let manifest = {};
        try {
          manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        } catch {
          manifest = {};
        }
        let pcodeBytes = null;
        try {
          const stat = await fs.stat(pcodePath);
          pcodeBytes = stat.size;
        } catch {
          pcodeBytes = null;
        }
        packages.push({
          name,
          version,
          pcodePath: path.relative(ffsRoot, pcodePath).replace(/\\/g, '/'),
          pcodeBytes,
          manifest
        });
      }
    }
    return packages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
  }

  async function readDeploymentIndex() {
    try {
      const raw = await fs.readFile(deploymentIndexPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.deployments) ? parsed : { deployments: [] };
    } catch {
      return { deployments: [] };
    }
  }

  async function writeDeploymentIndex(index) {
    await ensureFederatedRoots();
    await fs.writeFile(deploymentIndexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
  }

  function syncRegistryFromDeployments(deployments) {
    if (!deploymentRegistry) return;
    deploymentRegistry.clear();
    for (const item of Array.isArray(deployments) ? deployments : []) {
      const key = String(item?.key || `${String(item?.serviceName || '').trim().toLowerCase()}::${String(item?.targetNodeId || '*').trim().toLowerCase()}`);
      deploymentRegistry.set(key, {
        key,
        ...item
      });
    }
  }


  // List directory contents (FFS)
  router.get('/ffs/list', async (req, res) => {
    try {
      await ensureFederatedRoots();
      const relPath = req.query.path || '.';
      const dirPath = resolveFFSPath(relPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
      res.json({ files });
    } catch (e) {
      res.status(500).json({ error: 'FFS list failed', details: e.toString() });
    }
  });

  // Get file contents (FFS)
  router.get('/ffs/get', async (req, res) => {
    try {
      await ensureFederatedRoots();
      const relPath = req.query.path;
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const filePath = resolveFFSPath(relPath);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
      const data = await fs.readFile(filePath);
      res.send(data);
    } catch (e) {
      res.status(500).json({ error: 'FFS get failed', details: e.toString() });
    }
  });

  // Create file or directory (FFS)
  router.post('/ffs/create', async (req, res) => {
    try {
      await ensureFederatedRoots();
      const { path: relPath, type } = req.body;
      if (!relPath || !type) return res.status(400).json({ error: 'Missing path or type' });
      const absPath = resolveFFSPath(relPath);
      if (type === 'directory') {
        await fs.mkdir(absPath, { recursive: true });
        res.json({ ok: true });
      } else if (type === 'file') {
        await fs.writeFile(absPath, '');
        res.json({ ok: true });
      } else {
        res.status(400).json({ error: 'Invalid type' });
      }
    } catch (e) {
      res.status(500).json({ error: 'FFS create failed', details: e.toString() });
    }
  });

  // Delete file or directory (FFS)
  router.post('/ffs/delete', async (req, res) => {
    try {
      await ensureFederatedRoots();
      const { path: relPath } = req.body;
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const absPath = resolveFFSPath(relPath);
      await fs.rm(absPath, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'FFS delete failed', details: e.toString() });
    }
  });

  // Modify file (FFS)
  router.post('/ffs/put', async (req, res) => {
    try {
      await ensureFederatedRoots();
      const { path: relPath, data } = req.body;
      if (!relPath || typeof data !== 'string') return res.status(400).json({ error: 'Missing path or data' });
      const absPath = resolveFFSPath(relPath);
      await fs.writeFile(absPath, data);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'FFS put failed', details: e.toString() });
    }
  });

  // List all distributed pcode packages visible to PMachine nodes.
  router.get('/ffs/packages', async (req, res) => {
    try {
      const packages = await listPackageEntries();
      res.json({ packages });
    } catch (e) {
      res.status(500).json({ error: 'FFS package list failed', details: e.toString() });
    }
  });

  // Publish a pcode package into the shared federated filesystem.
  router.post('/ffs/packages/publish', async (req, res) => {
    try {
      const { name, version = 'latest', pcode = '', manifest = {} } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      if (typeof pcode !== 'string' || !pcode.trim()) {
        return res.status(400).json({ error: 'pcode must be a non-empty string' });
      }

      const pkgDir = resolvePackagePath(name, version);
      await fs.mkdir(pkgDir, { recursive: true });

      const normalizedManifest = {
        name: sanitizePackageToken(name, 'package'),
        version: sanitizePackageToken(version, 'latest'),
        publishedAt: new Date().toISOString(),
        pcodeBytes: Buffer.byteLength(pcode, 'utf-8'),
        ...((manifest && typeof manifest === 'object') ? manifest : {})
      };

      await fs.writeFile(path.join(pkgDir, 'program.pcode'), pcode, 'utf-8');
      await fs.writeFile(path.join(pkgDir, 'manifest.json'), JSON.stringify(normalizedManifest, null, 2) + '\n', 'utf-8');

      res.json({
        ok: true,
        package: {
          name: normalizedManifest.name,
          version: normalizedManifest.version,
          manifestPath: path.relative(ffsRoot, path.join(pkgDir, 'manifest.json')).replace(/\\/g, '/'),
          pcodePath: path.relative(ffsRoot, path.join(pkgDir, 'program.pcode')).replace(/\\/g, '/')
        }
      });
    } catch (e) {
      res.status(500).json({ error: 'FFS package publish failed', details: e.toString() });
    }
  });

  router.get('/ffs/packages/:name/:version', async (req, res) => {
    try {
      const pkgDir = resolvePackagePath(req.params.name, req.params.version);
      const manifestRaw = await fs.readFile(path.join(pkgDir, 'manifest.json'), 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      const pcodeStat = await fs.stat(path.join(pkgDir, 'program.pcode'));
      res.json({
        package: {
          name: sanitizePackageToken(req.params.name, 'package'),
          version: sanitizePackageToken(req.params.version, 'latest'),
          manifest,
          pcodeBytes: pcodeStat.size
        }
      });
    } catch (e) {
      res.status(404).json({ error: 'Package not found', details: e.toString() });
    }
  });

  router.get('/ffs/packages/:name/:version/pcode', async (req, res) => {
    try {
      const pkgDir = resolvePackagePath(req.params.name, req.params.version);
      const pcode = await fs.readFile(path.join(pkgDir, 'program.pcode'), 'utf-8');
      res.type('text/plain').send(pcode);
    } catch (e) {
      res.status(404).json({ error: 'Package pcode not found', details: e.toString() });
    }
  });

  // Desired service deployments map service request names to package artifacts.
  router.get('/ffs/services/deployments', async (req, res) => {
    try {
      const index = await readDeploymentIndex();
      syncRegistryFromDeployments(index.deployments);
      res.json(index);
    } catch (e) {
      res.status(500).json({ error: 'FFS deployment list failed', details: e.toString() });
    }
  });

  router.post('/ffs/services/deploy', async (req, res) => {
    try {
      const {
        serviceName,
        packageName,
        packageVersion = 'latest',
        targetNodeId = null,
        metadata = {}
      } = req.body || {};

      if (!serviceName || !packageName) {
        return res.status(400).json({ error: 'serviceName and packageName are required' });
      }

      const pkgDir = resolvePackagePath(packageName, packageVersion);
      await fs.stat(path.join(pkgDir, 'program.pcode'));

      const index = await readDeploymentIndex();
      const deployments = Array.isArray(index.deployments) ? index.deployments : [];
      const key = `${String(serviceName).trim().toLowerCase()}::${String(targetNodeId || '*').trim().toLowerCase()}`;
      const nextEntry = {
        key,
        serviceName: String(serviceName).trim(),
        targetNodeId: targetNodeId ? String(targetNodeId).trim() : null,
        packageName: sanitizePackageToken(packageName, 'package'),
        packageVersion: sanitizePackageToken(packageVersion, 'latest'),
        pcodePath: path.relative(ffsRoot, path.join(pkgDir, 'program.pcode')).replace(/\\/g, '/'),
        updatedAt: new Date().toISOString(),
        metadata: (metadata && typeof metadata === 'object') ? metadata : {}
      };

      const existingIdx = deployments.findIndex(item => String(item.key || '') === key);
      if (existingIdx >= 0) {
        deployments[existingIdx] = { ...deployments[existingIdx], ...nextEntry };
      } else {
        deployments.push(nextEntry);
      }

      const saved = {
        updatedAt: new Date().toISOString(),
        deployments
      };
      await writeDeploymentIndex(saved);
      syncRegistryFromDeployments(saved.deployments);
      res.json({ ok: true, deployment: nextEntry });
    } catch (e) {
      res.status(500).json({ error: 'FFS deployment update failed', details: e.toString() });
    }
  });


  // WebDAV/SharePoint endpoints (stub)
  router.get('/webdav/list', async (req, res) => {
    res.status(501).json({ error: 'WebDAV list not implemented' });
  });
  router.get('/webdav/get', async (req, res) => {
    res.status(501).json({ error: 'WebDAV get not implemented' });
  });
  router.post('/webdav/create', async (req, res) => {
    res.status(501).json({ error: 'WebDAV create not implemented' });
  });
  router.post('/webdav/delete', async (req, res) => {
    res.status(501).json({ error: 'WebDAV delete not implemented' });
  });
  router.post('/webdav/put', async (req, res) => {
    res.status(501).json({ error: 'WebDAV put not implemented' });
  });

  return { router };
}
