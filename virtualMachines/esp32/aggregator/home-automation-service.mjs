#!/usr/bin/env node
/**
 * Standalone Home Automation service.
 *
 * Runs the Kasa/TP-Link/Tuya/Bluetooth/Shark/Alexa/UPnP device discovery and
 * control loop independently of the main aggregator gateway. The gateway can
 * proxy /api/home-automation/* to this process by setting
 * HOME_AUTOMATION_SERVICE_URL (see backend.mjs) — if that env var is unset,
 * the gateway keeps running Home Automation in-process as it always has.
 */
import express from 'express';
import cors from 'cors';
import { readEnvNumber } from './src/env-config.mjs';
import { createHomeAutomationService, registerHomeAutomationRoutes } from './src/backend/modules/home-automation/index.mjs';

const PORT = readEnvNumber('HOME_AUTOMATION_PORT', 4102);
const HOST = process.env.HOME_AUTOMATION_HOST || '127.0.0.1';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

const service = createHomeAutomationService({ backendPort: PORT });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'home-automation', ...service.status() });
});

registerHomeAutomationRoutes(app, service);

app.listen(PORT, HOST, () => {
  console.log(`[HOME-AUTOMATION] Standalone service listening on http://${HOST}:${PORT}`);
});

service.start().catch((error) => {
  console.error('[HOME-AUTOMATION] Startup failed:', error?.stack || error);
});
