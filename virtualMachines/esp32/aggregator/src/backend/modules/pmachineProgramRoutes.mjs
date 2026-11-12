import path from 'node:path';
import { createPmachineBundleStore } from './pmachineBundleStore.mjs';

export function registerPmachineProgramRoutes(app, { root, supervisor }) {
  const store = createPmachineBundleStore(root);
  app.post('/api/pmachine/programs', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const manifest = await store.install({
        name: body.name,
        manifest: body.manifest,
        files: body.files
      });
      return res.status(201).json({ status: 'installed', manifest });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/pmachine/slots', (req, res) => {
    return res.json({ slots: supervisor?.slots?.() || [], processes: supervisor?.list?.() || [] });
  });

  app.post('/api/pmachine/programs/:name/start', async (req, res) => {
    try {
      if (!supervisor) throw new Error('Pmachine supervisor is unavailable');
      const manifest = await store.read(req.params.name);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const requestedSlot = String(body.slot || '').trim();
      const workloadKind = manifest.type === 'resident' ? 'service'
        : manifest.type === 'transient' ? 'program' : manifest.type;
      const deployment = {
        key: `bundle:${manifest.name}`,
        deploymentId: `bundle:${manifest.name}`,
        serviceName: manifest.name,
        workloadKind,
        runtimeState: 'running',
        metadata: {
          pcodePath: path.join(manifest.directory, manifest.entry),
          programMapPath: path.join(manifest.directory, manifest.programMap),
          slotKind: requestedSlot === 'resident' || requestedSlot === 'transient'
            ? requestedSlot : manifest.type === 'resident' ? 'resident'
              : manifest.type === 'transient' ? 'transient' : 'service',
          serviceIndex: manifest.serviceIndex
        }
      };
      return res.status(201).json({ status: 'running', process: await supervisor.start(deployment) });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.post('/api/pmachine/slots/:slot/stop', async (req, res) => {
    try {
      if (!supervisor) throw new Error('Pmachine supervisor is unavailable');
      const process = supervisor.list().find(item => item.slot === req.params.slot);
      if (!process) return res.status(404).json({ error: 'Pmachine slot is not active' });
      await supervisor.stop({ key: process.key, deploymentId: process.deploymentId, serviceName: process.serviceName });
      return res.json({ status: 'stopped', slot: req.params.slot });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/pmachine/programs/:name', async (req, res) => {
    try {
      return res.json(await store.read(req.params.name));
    } catch (error) {
      return res.status(error?.code === 'ENOENT' ? 404 : 400)
        .json({ error: error?.message || String(error) });
    }
  });
}
