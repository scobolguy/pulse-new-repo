/**
 * Home Automation — public entry point.
 * Import from here in backend.mjs; path stays stable even as internals change.
 */
export { createHomeAutomationService } from './application/service.mjs';
export { registerHomeAutomationRoutes } from './http/routes.mjs';
