// fileServer.js - Modular File Server backend service
// Supports: FFS (custom file system) and WebDAV (SharePoint)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

// Placeholder for FFS and WebDAV integration
export function createFileServer({ ffsConfig = {}, webdavConfig = {} } = {}) {
  const router = express.Router();
  // FFS root directory (default: ./ffs-root)
  const ffsRoot = ffsConfig.root || path.resolve(process.cwd(), 'ffs-root');

  // Utility: resolve FFS path safely
  function resolveFFSPath(relPath) {
    const safePath = path.normalize(relPath).replace(/^([/\\]+)/, '');
    return path.join(ffsRoot, safePath);
  }


  // List directory contents (FFS)
  router.get('/ffs/list', async (req, res) => {
    try {
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
      const { path: relPath, data } = req.body;
      if (!relPath || typeof data !== 'string') return res.status(400).json({ error: 'Missing path or data' });
      const absPath = resolveFFSPath(relPath);
      await fs.writeFile(absPath, data);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'FFS put failed', details: e.toString() });
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
