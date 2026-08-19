/**
 * Home Automation HTTP routes.
 * Mounts all /api/home-automation/* endpoints onto the Express app.
 */

export function registerHomeAutomationRoutes(app, service) {
  // ── Status & discovery ───────────────────────────────────────────────────
  app.get('/api/home-automation/status', (req, res) => res.json(service.status()));

  app.get('/api/home-automation/devices', (req, res) =>
    res.json({ status: 'ok', devices: service.listDevices() })
  );

  app.post('/api/home-automation/discover', async (req, res) => {
    try {
      res.json(await service.discover({ timeoutMs: req.body?.timeoutMs }));
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  // ── Device action (all protocols) ────────────────────────────────────────
  app.post('/api/home-automation/devices/:deviceId/action', async (req, res) => {
    try {
      const result = await service.invoke(req.params.deviceId, req.body?.action, req.body || {});
      res.json({ status: 'ok', deviceId: req.params.deviceId, action: req.body?.action, result });
    } catch (error) {
      const message = String(error?.message || error);
      res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
    }
  });

  // ── Tuya credentials ─────────────────────────────────────────────────────
  app.put('/api/home-automation/devices/:deviceId/credentials', async (req, res) => {
    try {
      const device = await service.configureTuyaDevice(req.params.deviceId, req.body || {});
      res.json({ status: 'ok', device });
    } catch (error) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  // ── Shark account ─────────────────────────────────────────────────────────
  // PUT /api/home-automation/shark/account  { username, password, europe? }
  app.put('/api/home-automation/shark/account', async (req, res) => {
    try {
      res.json(await service.configureSharkAccount(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  // ── Alexa auth ────────────────────────────────────────────────────────────

  // GET /api/home-automation/alexa/auth-url
  // Returns current auth status. If not authenticated, also starts the proxy
  // server on port 2000 so the browser login URL is immediately reachable.
  app.get('/api/home-automation/alexa/auth-url', async (req, res) => {
    try {
      const ctrl = await service.getAlexaController();
      const hasCookie = await ctrl.hasCookie();
      if (!hasCookie) {
        // Start the proxy in the background so port 2000 is immediately live.
        // connect() with no cookie launches the proxy and resolves once it's
        // listening — it does NOT wait for the browser login.
        ctrl.connect().catch((err) => {
          console.warn('[AlexaAuth] Proxy connect error:', err?.message || err);
        });
      }
      res.json({
        status: hasCookie ? 'already-authed' : 'needs-auth',
        url: ctrl.getProxyAuthUrl(),
        instructions: hasCookie
          ? 'Already authenticated. Call POST /api/home-automation/alexa/discover to refresh devices.'
          : 'Proxy started on port 2000. Open http://localhost:2000/ in a browser, log in to Amazon, then close the tab. Cookie saves automatically.'
      });
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  // POST /api/home-automation/alexa/discover
  // After browser login: connect with saved cookie and discover vacuums.
  app.post('/api/home-automation/alexa/discover', async (req, res) => {
    try {
      const ctrl = await service.getAlexaController();
      await ctrl.connect();
      const vacuums = await ctrl.discoverVacuums();
      res.json({ status: 'ok', found: vacuums.length, vacuums });
    } catch (error) {
      res.status(500).json({ error: String(error?.message || error) });
    }
  });

  // ── Name-based convenience routes ─────────────────────────────────────────
  // POST /api/home-automation/vacuum/start-by-name/:name
  // POST /api/home-automation/vacuum/stop-by-name/:name
  // POST /api/home-automation/vacuum/dock-by-name/:name
  // POST /api/home-automation/vacuum/action-by-name/:name  { "action": "start"|"stop"|"dock"|"pause" }
  //
  // :name is URL-decoded, case-insensitive, substring-matched.
  // e.g. /api/home-automation/vacuum/start-by-name/steve%20mcclean

  async function handleVacuumByName(req, res, action) {
    try {
      const name = decodeURIComponent(req.params.name || '');
      const result = await service.invokeByName(name, action, req.body || {});
      const device = service.findDeviceByName(name);
      res.json({ status: 'ok', name, action, deviceId: device?.id || null, result });
    } catch (error) {
      const message = String(error?.message || error);
      res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
    }
  }

  app.post('/api/home-automation/vacuum/start-by-name/:name', (req, res) => handleVacuumByName(req, res, 'start'));
  app.post('/api/home-automation/vacuum/stop-by-name/:name',  (req, res) => handleVacuumByName(req, res, 'stop'));
  app.post('/api/home-automation/vacuum/dock-by-name/:name',  (req, res) => handleVacuumByName(req, res, 'dock'));
  app.post('/api/home-automation/vacuum/pause-by-name/:name', (req, res) => handleVacuumByName(req, res, 'pause'));

  // Generic: body must contain { "action": "..." }
  app.post('/api/home-automation/vacuum/action-by-name/:name', async (req, res) => {
    const action = String(req.body?.action || 'status').trim().toLowerCase();
    await handleVacuumByName(req, res, action);
  });
}
