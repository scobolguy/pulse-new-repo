#!/usr/bin/env node

import { runCli } from './src/runtime.mjs';

runCli().catch(error => {
	console.error('[JS-PMACHINE] Failed:', error?.message || String(error));
	process.exitCode = 1;
});