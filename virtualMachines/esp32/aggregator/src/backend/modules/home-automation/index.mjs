/**
 * Home Automation — public entry point.
 * Import from here in backend.mjs; path stays stable even as internals change.
 */
export { createHomeAutomationService } from './service.mjs';
export { registerHomeAutomationRoutes } from './routes.mjs';
