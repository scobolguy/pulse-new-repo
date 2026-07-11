import fs from 'fs';

export function registerMediaGatewayRoutes(app, deps = {}) {
  const {
    parseJson,
    pathJoin,
    getMapPlacementSummary,
    normalizeMapPlacementEntry,
    mapPlacementState,
    persistMapPlacementRegistry,
    buildMapKeyFromParts,
    chooseMapPlacement,
    pruneMapPlacementRuntimeState,
    toFiniteNumber,
    LOCAL_TTS_SCRIPT_PATH,
    LOCAL_TTS_OUTPUT_DIR,
    runLocalTtsScript,
    clampInteger,
    PIPER_BIN_PATH,
    PIPER_MODEL_PATH,
    runPiperSynthesis,
    playWavOnHost,
    forwardEsp32BluetoothTts
  } = deps;

  app.get('/api/map-placement', (req, res) => {
    res.json({ status: 'ok', ...getMapPlacementSummary() });
  });

  app.post('/api/map-placement/register', parseJson({ limit: '256kb' }), (req, res) => {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      const entries = Array.isArray(payload.entries) ? payload.entries : [payload];
      const upserted = [];

      for (const item of entries) {
        const normalized = normalizeMapPlacementEntry(item, item?.mapKey || '');
        if (!normalized.mapKey) continue;
        mapPlacementState.maps.set(normalized.mapKey, normalized);
        upserted.push(normalized.mapKey);
      }

      persistMapPlacementRegistry();
      res.json({
        status: 'ok',
        upsertedCount: upserted.length,
        upserted,
        registryUpdatedAt: mapPlacementState.updatedAt
      });
    } catch (e) {
      res.status(400).json({ status: 'error', error: e.message });
    }
  });

  app.post('/api/map-placement/unregister', parseJson({ limit: '128kb' }), (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const mapKey = buildMapKeyFromParts({
      mapKey: payload.mapKey,
      sourceType: payload.sourceType,
      destinationType: payload.destinationType
    });
    if (!mapKey) {
      return res.status(400).json({ status: 'error', error: 'mapKey or sourceType+destinationType required' });
    }
    const removed = mapPlacementState.maps.delete(mapKey);
    if (removed) {
      persistMapPlacementRegistry();
    }
    return res.status(removed ? 200 : 404).json({ status: removed ? 'ok' : 'not_found', mapKey });
  });

  app.post('/api/map-placement/choose', parseJson({ limit: '128kb' }), (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const decision = chooseMapPlacement({
      mapKey: payload.mapKey,
      sourceType: payload.sourceType,
      destinationType: payload.destinationType,
      message: payload.message,
      requestedRole: payload.edgeRole
    });
    if (!decision.ok) {
      return res.status(404).json({ status: 'no_candidate', decision });
    }
    return res.json({
      status: 'ok',
      mapKey: decision.mapKey,
      selected: {
        id: decision.selected.id,
        tier: decision.selected.tier,
        label: decision.selected.label,
        host: decision.selected.host,
        port: decision.selected.port,
        role: decision.selected.role,
        score: Number.isFinite(decision.selected.__score) ? Number(decision.selected.__score.toFixed(4)) : null
      },
      candidateCount: decision.candidates.length
    });
  });

  app.get('/api/map-placement/metrics', (req, res) => {
    const nowMs = Date.now();
    pruneMapPlacementRuntimeState(nowMs);
    const inflight = Array.from(mapPlacementState.inflightByPlacement.entries()).map(([id, count]) => ({
      id,
      inflight: count,
      lastAssignedAtMs: toFiniteNumber(mapPlacementState.assignmentByPlacement.get(id), 0)
    }));
    res.json({
      status: 'ok',
      registryUpdatedAt: mapPlacementState.updatedAt,
      trackedInflight: inflight.length,
      inflight,
      lastDecision: mapPlacementState.lastDecision
    });
  });

  app.get('/api/local-tts/health', (_req, res) => {
    if (process.platform !== 'win32') {
      return res.status(501).json({ ok: false, error: 'Local TTS is only supported on Windows hosts' });
    }
    if (!fs.existsSync(LOCAL_TTS_SCRIPT_PATH)) {
      return res.status(500).json({ ok: false, error: 'Local TTS script missing', script: LOCAL_TTS_SCRIPT_PATH });
    }
    return res.json({ ok: true, platform: process.platform, script: LOCAL_TTS_SCRIPT_PATH });
  });

  app.get('/api/local-tts/voices', async (_req, res) => {
    if (process.platform !== 'win32') {
      return res.status(501).json({ ok: false, error: 'Local TTS is only supported on Windows hosts' });
    }
    try {
      const raw = await runLocalTtsScript(['-Mode', 'voices'], 15000);
      const payload = raw ? JSON.parse(raw) : { ok: true, voices: [] };
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to list local TTS voices',
        details: err?.message || String(err)
      });
    }
  });

  app.post('/api/local-tts/speak', parseJson({ limit: '128kb' }), async (req, res) => {
    if (process.platform !== 'win32') {
      return res.status(501).json({ ok: false, error: 'Local TTS is only supported on Windows hosts' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const text = String(body.text || '').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    const voice = String(body.voice || '').trim();
    const rate = clampInteger(body.rate, -10, 10, 0);
    const volume = clampInteger(body.volume, 0, 100, 100);
    const saveToFile = body.saveToFile === true;
    const playOnHost = body.playOnHost !== false;
    const requestedFileName = String(body.fileName || '').trim();

    const scriptArgs = ['-Mode', 'speak', '-Text', text, '-Rate', String(rate), '-Volume', String(volume)];
    if (voice) scriptArgs.push('-Voice', voice);

    let outputFilePath = '';
    if (saveToFile) {
      fs.mkdirSync(LOCAL_TTS_OUTPUT_DIR, { recursive: true });
      const baseName = requestedFileName && requestedFileName.endsWith('.wav')
        ? requestedFileName
        : `tts-${Date.now()}.wav`;
      outputFilePath = pathJoin(LOCAL_TTS_OUTPUT_DIR, baseName);
      scriptArgs.push('-OutputPath', outputFilePath);
    }
    if (!playOnHost) {
      scriptArgs.push('-NoPlay');
    }

    try {
      const raw = await runLocalTtsScript(scriptArgs, 45000);
      const payload = raw ? JSON.parse(raw) : { ok: true };
      return res.json({
        ok: true,
        text,
        voice: voice || payload.voice || null,
        rate,
        volume,
        playOnHost,
        saveToFile,
        outputFile: outputFilePath || payload.outputFile || null,
        engine: 'windows-sapi'
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'Local TTS playback failed',
        details: err?.message || String(err)
      });
    }
  });

  const handleSpeechSpeak = async (req, res, modeOverride = null) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const text = String(body.text || req.query?.text || '').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    const voice = String(body.voice || req.query?.voice || 'default').trim() || 'default';
    const mode = String(modeOverride || body.mode || req.query?.mode || 'local').trim().toLowerCase();
    const esp32Origin = String(body.esp32Origin || req.query?.esp32Origin || '').trim();
    const rate = clampInteger(body.rate, -10, 10, 0);
    const volume = clampInteger(body.volume, 0, 100, 100);
    const playOnHost = body.playOnHost !== false;

    if (mode === 'piper') {
      if (!fs.existsSync(PIPER_BIN_PATH)) {
        return res.status(500).json({
          ok: false,
          mode: 'piper',
          error: 'Piper binary not found',
          path: PIPER_BIN_PATH
        });
      }
      if (!fs.existsSync(PIPER_MODEL_PATH)) {
        return res.status(500).json({
          ok: false,
          mode: 'piper',
          error: 'Piper model not found',
          path: PIPER_MODEL_PATH
        });
      }

      try {
        fs.mkdirSync(LOCAL_TTS_OUTPUT_DIR, { recursive: true });
        const outFile = pathJoin(LOCAL_TTS_OUTPUT_DIR, `piper-${Date.now()}.wav`);
        await runPiperSynthesis({ text, outputFile: outFile, timeoutMs: 45000 });
        if (playOnHost) {
          await playWavOnHost(outFile, 60000);
        }
        return res.json({
          ok: true,
          mode: 'piper',
          text,
          playOnHost,
          outputFile: outFile,
          engine: 'piper'
        });
      } catch (err) {
        return res.status(500).json({
          ok: false,
          mode: 'piper',
          error: 'Piper speech failed',
          details: err?.message || String(err)
        });
      }
    }

    if (mode === 'esp32') {
      try {
        const forwarded = await forwardEsp32BluetoothTts({ text, voice, origin: esp32Origin });
        return res.json({
          ok: true,
          mode: 'esp32',
          text,
          voice,
          esp32: forwarded
        });
      } catch (err) {
        return res.status(502).json({
          ok: false,
          mode: 'esp32',
          error: 'ESP32 Bluetooth route failed',
          details: err?.message || String(err)
        });
      }
    }

    const scriptArgs = ['-Mode', 'speak', '-Text', text, '-Rate', String(rate), '-Volume', String(volume)];
    if (voice) scriptArgs.push('-Voice', voice);
    if (!playOnHost) scriptArgs.push('-NoPlay');

    try {
      const raw = await runLocalTtsScript(scriptArgs, 45000);
      const payload = raw ? JSON.parse(raw) : { ok: true };
      return res.json({
        ok: true,
        mode: 'local',
        text,
        voice: payload.voice || voice,
        rate,
        volume,
        playOnHost,
        engine: 'windows-sapi'
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        mode: 'local',
        error: 'Local speech failed',
        details: err?.message || String(err)
      });
    }
  };

  app.post('/api/speech/speak', parseJson({ limit: '128kb' }), async (req, res) => handleSpeechSpeak(req, res));

  app.post('/api/bluetooth-audio/tts', parseJson({ limit: '128kb' }), async (req, res) => {
    const forcedMode = String(req.body?.mode || req.query?.mode || 'local').trim().toLowerCase();
    return handleSpeechSpeak(req, res, forcedMode);
  });
}
