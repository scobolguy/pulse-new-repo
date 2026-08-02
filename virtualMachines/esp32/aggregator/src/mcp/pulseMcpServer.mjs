import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAlexaRoute } from './pulseAlexaSkill.mjs';
import { callPulseMcp } from './pulseMcpClient.mjs';

const MCP_HOST = process.env.PULSE_MCP_HOST || '127.0.0.1';
const MCP_PORT = Number(process.env.PULSE_MCP_PORT || 4011);
const NLI_URL = process.env.PULSE_NLI_URL || 'http://127.0.0.1:4000/api/nli/query';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 8, fileSize: 10 * 1024 * 1024 },
});

export async function executePulseQuery({ message, channel = 'mcp', attachments = [] }) {
  const requestInit = {
    method: 'POST',
    headers: { 'x-pulse-channel': channel },
    signal: AbortSignal.timeout(65_000),
  };

  if (attachments.length > 0) {
    const body = new FormData();
    body.set('message', message);
    for (const attachment of attachments) {
      const bytes = Buffer.from(attachment.base64, 'base64');
      body.append('files', new Blob([bytes], { type: attachment.mediaType }), attachment.name);
    }
    requestInit.body = body;
  } else {
    requestInit.headers['content-type'] = 'application/json';
    requestInit.body = JSON.stringify({ message });
  }

  const response = await fetch(NLI_URL, requestInit);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.output || payload?.error || `Pulse NLI failed (${response.status})`);
  }

  return {
    output: String(payload.output || ''),
    voiceReply: String(payload.voiceReply || ''),
    intentId: String(payload._intentId || ''),
    interactionId: String(payload._interactionId || ''),
    needsClarification: Boolean(payload._needsClarification),
  };
}

export function createPulseMcpServer() {
  const server = new McpServer({
    name: 'pulse-local',
    version: '1.0.0',
  });

  server.registerTool('pulse_query', {
    title: 'Query Pulse',
    description: 'Run a natural-language request against the local Pulse platform.',
    inputSchema: {
      message: z.string().min(1).max(2000).describe('Natural-language request for Pulse'),
      channel: z.enum(['mcp', 'alexa', 'bob']).default('mcp'),
      attachments: z.array(z.object({
        name: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(255),
        base64: z.string().min(1),
      })).max(8).default([]),
    },
  }, async ({ message, channel, attachments }) => {
    const result = await executePulseQuery({ message, channel, attachments });

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  });

  return server;
}

export function createPulseMcpApp() {
  const app = express();

  registerAlexaRoute(app);

  app.post('/mcp', express.json({ limit: '12mb' }), async (req, res) => {
    const server = createPulseMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[MCP] Request failed:', error?.stack || error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP error' },
          id: null,
        });
      }
    } finally {
      res.on('close', () => {
        transport.close();
        server.close();
      });
    }
  });

  app.post('/query', upload.array('files'), async (req, res) => {
    try {
      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message is required' });
      const attachments = (req.files || []).map(file => ({
        name: file.originalname,
        mediaType: file.mimetype || 'application/octet-stream',
        base64: file.buffer.toString('base64'),
      }));
      const result = await callPulseMcp({ message, channel: 'bob', attachments });
      return res.json({
        output: result.output,
        voiceReply: result.voiceReply,
        _intentId: result.intentId,
        _interactionId: result.interactionId,
        _needsClarification: result.needsClarification,
      });
    } catch (error) {
      return res.status(502).json({ error: error?.message || String(error) });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'pulse-local-mcp', nliUrl: NLI_URL });
  });

  return app;
}

export function startPulseMcpService({ host = MCP_HOST, port = MCP_PORT } = {}) {
  const app = createPulseMcpApp();
  const httpServer = app.listen(port, host, () => {
    const address = httpServer.address();
    const listeningPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[MCP] Pulse local MCP listening at http://${host}:${listeningPort}/mcp`);
  });
  return httpServer;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const httpServer = startPulseMcpService();
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[MCP] ${signal} received; stopping.`);
    httpServer.close((error) => {
      if (error) {
        console.error('[MCP] Shutdown failed:', error?.stack || error);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}