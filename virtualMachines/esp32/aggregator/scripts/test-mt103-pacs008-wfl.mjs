import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const source = await fs.readFile(path.resolve('aggregator/data/mt103-pacs008-daemon.wfl'), 'utf8');
const compiled = compileWorkflowDSLWithAntlr(source);

assert.equal(compiled.symbols.queues.find(item => item.symbol === 'incoming_mt103').managerId, 'qm-secondary');
assert.equal(compiled.symbols.queues.find(item => item.symbol === 'outgoing_message').managerId, 'qm-secondary');
assert.equal(compiled.symbols.databases.find(item => item.symbol === 'message_store').managerId, 'db-mssql');
assert.equal(compiled.bindings.bySymbol.daemon_artifact.managerId, 'artifact-manager');
assert.deepEqual(compiled.deployments[0].targets, ['magic-js-pmachine-01', 'esp32-edge-pool']);
assert.equal(compiled.deployments[0].resources[0].kind, 'daemon');

console.log('[mt103-pacs008-wfl] PASS: logical bindings and JS/ESP32 daemon targets compile');
