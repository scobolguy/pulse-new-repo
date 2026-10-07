import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianNormalization({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/normalization.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), { fileName, hostServices: true });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-normalization', httpPort: null, udpPort: null,
    maxBodyBytes: 1000000, maxResponseBytes: 1000000, maxEvents: 256,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  async function normalize(operation, value) {
    const result = await host.dispatch({
      transport: 'internal', method: 'POST', path: '/normalize',
      body: JSON.stringify({ operation, value: value ?? null })
    });
    if (result.status !== 200 || !result.body || !Object.hasOwn(result.body, 'value')) {
      throw new Error(result.body?.error || 'Invalid Pascalish normalization response');
    }
    for (const warning of result.body.warnings || []) logger.warn(`[Librarian] ${warning}`);
    return result.body.value;
  }
  return {
    typeRecord: value => normalize('type-record', value),
    createType: value => normalize('create-type', value),
    typeCatalog: value => normalize('type-catalog', value),
    ruleset: value => normalize('ruleset', value),
    rulesetId: value => normalize('ruleset-id', value),
    rulesetCatalog: value => normalize('ruleset-catalog', value),
    stop: () => host.stop()
  };
}
