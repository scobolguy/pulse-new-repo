import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';
import { runPL0 } from '../../scripts/pl0-interpreter.mjs';

export async function createPascalishMapperExecution({ logger = console } = {}) {
  const sourcePath = fileURLToPath(new URL('../../../src/mapper/execution-policy.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-mapper-execution',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    maxEvents: 64, desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  async function dispatch(path, body) {
    const result = await host.dispatch({
      method: 'POST', path, transport: 'internal', body: JSON.stringify(body)
    });
    if (result.status !== 200) {
      throw Object.assign(new Error(result.body?.error || `Pascalish Mapper failed (${result.status})`), {
        status: result.status
      });
    }
    return result.body;
  }
  return {
    async run({ payload, rules, sourceTypes = {}, targetTypes = {} }) {
      const plan = await dispatch('/plan', { payload, rules, sourceTypes, targetTypes });
      if (!Array.isArray(plan?.steps) || !Array.isArray(plan?.diagnostics)) {
        throw new Error('Invalid Pascalish Mapper execution plan');
      }
      const steps = plan.steps.map(step => {
        if (!step.conversionRule) return step;
        const variables = runPL0(step.conversionRule, { src: step.value, output: step.value });
        const value = variables && Object.hasOwn(variables, 'output') ? variables.output : step.value;
        if (JSON.stringify(value) === undefined) throw new Error('Mapper conversion returned a non-JSON value');
        return { ...step, value };
      });
      const result = await dispatch('/finish', { steps });
      if (!result?.output || typeof result.output !== 'object' || Array.isArray(result.output)) {
        throw new Error('Invalid Pascalish Mapper execution result');
      }
      return { output: result.output, diagnostics: plan.diagnostics };
    },
    async mapShape({ sourceNodes, targetNodes, sourcePath, targetPath }) {
      const result = await dispatch('/shape', { sourceNodes, targetNodes, sourcePath, targetPath });
      if (!Array.isArray(result?.mappings)) {
        throw new Error('Invalid Pascalish Mapper shape result');
      }
      return result;
    },
    async flattenStructure(structure) {
      const result = await dispatch('/flatten', { structure: structure ?? null });
      if (!Array.isArray(result?.nodes) || result.nodes.some(node =>
        typeof node?.path !== 'string' || typeof node?.kind !== 'string' ||
        typeof node?.valueType !== 'string' || typeof node?.required !== 'boolean'
      )) {
        throw new Error('Invalid Pascalish Mapper flattened structure');
      }
      return result.nodes;
    },
    stop: () => host.stop(),
    getStatus: () => host.getStatus()
  };
}
