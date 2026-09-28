import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileSolutionDsl } from './compile-solution-dsl.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { buildDeploymentBindingManifest, translateDeploymentSymbol } from '../src/backend/deploymentBindingManifest.mjs';
import { applySolutionDeliveries } from '../src/backend/solutionRuntimeBindings.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const source = await fs.readFile(new URL('../data/payment-ingestion.solution', import.meta.url), 'utf8');
const artifact = compileSolutionDsl(source, { fileName: 'payment-ingestion.solution' });

assert.equal(artifact.ir.id, 'payment_ingestion');
assert.equal(artifact.ir.databases[0].provider, 'sqlserver');
assert.equal(artifact.ir.queues.length, 2);
assert.equal(artifact.ir.conversions[0].map, 'mt103-to-pacs');
assert.equal(artifact.ir.methods[0].steps.length, 4);
assert.equal(artifact.manifest.compilerVersion, 'solution-dsl-v1');
assert.equal(artifact.programMap.runtimeUnit.kind, 'daemon');
assert.equal(artifact.programMap.runtimeUnit.id, 'MessageDaemon');
assert.match(artifact.pascalish, /dequeue IncomingMessages into message/);
assert.match(artifact.pascalish, /if message <> '' then/);
assert.match(artifact.pascalish, /insert into incoming_messages/);
assert.match(artifact.pcodeText, /ROUTE_MATCH_QUEUE/);
assert.match(artifact.pcodeText, /ROUTE_EMIT/);
assert.match(artifact.pcodeText, /DB_INSERT/);
assert.match(artifact.pcodeText, /ORCH_SYNC_SERVICE/);
assert.match(artifact.pcodeText, /MAP_ConversionService_MT103ToPACS008/);
assert.match(artifact.pcodeText, /HALT/);
const workflow = compileWorkflowDSLWithAntlr(artifact.wfl);
assert.equal(workflow.symbols.queues.length, 2);
assert.equal(workflow.symbols.databases[0].symbol, 'MessageStore');
assert.equal(workflow.deployments[0].resources[0].kind, 'daemon');
assert.equal(workflow.deployments[0].resources[1].kind, 'service');
assert.deepEqual(workflow.deployments[0].resources[1].lifecycle, {
	persistent: true,
	minInstances: 1,
	maxInstances: 4,
	idleTimeout: 5,
	idleTimeoutUnit: 'm'
});
const bindings = buildDeploymentBindingManifest(workflow.symbols);
assert.equal(translateDeploymentSymbol(bindings, 'IncomingMessages', 'queue').physicalName, 'swift.mt103.inbound');
assert.equal(translateDeploymentSymbol(bindings, 'IncomingMessages', 'queue').managerId, 'qm-secondary');
assert.equal(translateDeploymentSymbol(bindings, 'OutgoingPayments', 'queue').physicalName, 'swift.pacs008.outbound');
assert.equal(translateDeploymentSymbol(bindings, 'MessageStore', 'database').physicalName, 'PaymentMessages');
assert.equal(translateDeploymentSymbol(bindings, 'MessageStore', 'database').managerId, 'db-mssql');
const sourceMessage = JSON.stringify({
	finEnvelope: {
		block4: {
			fields: {
				'20': 'CBDSREF123456',
				'21': 'CBDS-E2E-0001',
				'23B': 'CRED',
				'32A': { components: { valueDate: '260702', currency: 'CAD', amount: '12500,45' } },
				'33B': { components: { currency: 'CAD', amount: '12500,45' } },
				'50K': '/123456789\nALPHA IMPORTS LTD',
				'52A': 'ROYCCAT2',
				'53A': 'BOFACATT',
				'56A': 'CITIUS33',
				'57A': 'TDOMCATTTOR',
				'59': '/000987654321\nBETA SUPPLIES INC',
				'70': 'INV-2026-07-02',
				'71A': 'SHA',
				'71B': '15,00',
				'72': '/INS/CBDS ROUTING'
			}
		}
	}
});
const runtime = await executeProgram({
	instructions: parsePcode(artifact.pcodeText),
	opcodeMap: await loadOpcodeMap(),
	inputQueue: 'IncomingMessages',
	sourceMessage,
	runtimeContext: {
		async invokeSubflow({ subflowId, payload }) {
			const servicePayload = JSON.stringify({ ...JSON.parse(payload), httpVerb: 'POST' });
			const serviceRuntime = await executeProgram({
				instructions: parsePcode(artifact.pcodeText),
				opcodeMap: await loadOpcodeMap(),
				inputQueue: `${subflowId}.in`,
				sourceMessage: servicePayload
			});
			const serviceDelivery = serviceRuntime.deliveries.find(item => item.queueName === `${subflowId}.out`);
			assert.ok(serviceDelivery, `service ${subflowId} produced no reply: ${JSON.stringify(serviceRuntime.deliveries)}`);
			assert.notEqual(serviceDelivery.message, 'NaN', `service ${subflowId} produced NaN reply`);
			return { success: true, response: { body: JSON.parse(serviceDelivery.message || '{}') } };
		}
	}
});
const dbDelivery = runtime.deliveries.find(item => item.queueName === 'db.MessageStore.dml');
const outputDelivery = runtime.deliveries.find(item => item.queueName === 'OutgoingPayments');
assert.ok(dbDelivery, 'generated daemon did not persist to the database sink');
assert.deepEqual(JSON.parse(dbDelivery.message), {
	operation: 'insert',
	database: 'MessageStore',
	table: 'incoming_messages',
	row: { reference: sourceMessage, payload: sourceMessage, status: 'received' }
});
const mapped = JSON.parse(outputDelivery?.message || '{}');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.GrpHdr.MsgId, 'CBDSREF123456');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId, 'CBDS-E2E-0001');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt, '2026-07-02');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt['@Ccy'], 'CAD');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt['#text'], '12500.45');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm, 'BETA SUPPLIES INC');
assert.equal(mapped.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr, 'SHA');
const applied = [];
const databaseManager = { async insert(schema, record) { applied.push({ operation: 'insert', schema, record }); } };
const queueManager = { async enqueue(queueName, message) { applied.push({ operation: 'enqueue', queueName, message }); } };
await applySolutionDeliveries({
	deliveries: runtime.deliveries,
	bindingManifest: bindings,
	databaseManagers: new Map([['db-mssql', databaseManager]]),
	queueManagers: new Map([['qm-secondary', queueManager]]),
	databaseSchemas: { MessageStore: { table: 'PaymentMessages', columns: { reference: 'nvarchar(max)', payload: 'nvarchar(max)', status: 'nvarchar(32)' } } }
});
assert.equal(applied.find(item => item.operation === 'insert').schema.table, 'PaymentMessages');
assert.equal(applied.find(item => item.operation === 'enqueue').queueName, 'swift.pacs008.outbound');

const fallbackArtifact = compileSolutionDsl([
	'solution fallback_output;',
	'database Store provider sqlserver table incoming manager db-mssql physical PaymentMessages;',
	'daemon FallbackDaemon refresh 1 s reads MissingInput writes Store uses ConversionService emits AutoCreatedOutput;',
	'begin'
].join('\n'));
const fallbackWorkflow = compileWorkflowDSLWithAntlr(fallbackArtifact.wfl);
assert.equal(fallbackWorkflow.bindings.bySymbol.AutoCreatedOutput.physicalName, 'message.outbound');
assert.equal(fallbackWorkflow.bindings.bySymbol.AutoCreatedOutput.managerId, 'qm-default');

console.log('[solution-dsl] PASS: solution IR, Pascalish/WFL generation, and pcode compilation');