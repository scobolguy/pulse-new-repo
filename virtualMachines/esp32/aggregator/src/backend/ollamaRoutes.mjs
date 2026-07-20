import { reloadOllamaContext, getOllamaWarmthStatus } from './ollamaService.mjs';

/**
 * Register Ollama management routes.
 */
export function registerOllamaRoutes(app) {
  /**
   * POST /api/ollama/reload
   * Force reload of Ollama context, clearing old state and preparing for fresh analysis.
   */
  app.post('/api/ollama/reload', async (req, res) => {
    try {
      const result = await reloadOllamaContext();
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(503).json({ success: false, error: result.error });
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Reload endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/ollama/status
   * Get warmth keeper status and Ollama diagnostics.
   */
  app.get('/api/ollama/status', (req, res) => {
    try {
      const warmthStatus = getOllamaWarmthStatus();
      res.json({
        warmthKeeper: warmthStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Status endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  console.log('[OLLAMA] Routes registered at /api/ollama/*');
}
