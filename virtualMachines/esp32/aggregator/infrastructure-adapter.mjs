import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../pmachines/javascript/src/service-host.mjs';
import { createInfrastructureReadiness } from './src/backend/modules/infrastructureReadiness.mjs';

export async function createInfrastructureAdapter({
  env = process.env, logger = console, probes,
} = {}) {
  const provider = env.PULSE_INFRASTRUCTURE_PROVIDER;
  if (!['database', 'rabbitmq'].includes(provider)) {
    throw new Error('PULSE_INFRASTRUCTURE_PROVIDER must be database or rabbitmq');
  }
  if (!env.PULSE_SERVICE_INSTANCE_ID || !env.PULSE_OWNER_AGGREGATOR_ID) {
    throw new Error('Infrastructure adapters require a stable instance ID and explicit deployment owner');
  }
  const drivers = probes || createInfrastructureReadiness({
    sqlConnectionString: () => env.FSM_MSSQL_CONNECTION_STRING || '',
    rabbitUrl: () => {
      if (!env.RABBITMQ_URL) throw new Error('RabbitMQ connection is not configured');
      return env.RABBITMQ_URL;
    },
    sqlDriver: env.FSM_MSSQL_DRIVER || '',
  });
  const fileName = fileURLToPath(new URL('../src/service-lifecycle/infrastructure-adapter.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true,
  });
  let host;
  host = await createPascalishServiceHost({
    compiled, collectorId: env.PULSE_SERVICE_INSTANCE_ID,
    host: env.PULSE_ADAPTER_BIND_HOST || '0.0.0.0',
    httpPort: Number(env.PULSE_ADAPTER_PORT || '0'), udpPort: null, logger,
    infrastructureProbe: async () => {
      try {
        await drivers[provider]();
        return JSON.stringify({ status: 200, body: { ready: true } });
      } catch {
        // Driver diagnostics may contain credentials; publish only a provider-specific failure.
        logger.warn(`[INFRASTRUCTURE] ${provider} protocol readiness check failed`);
        return JSON.stringify({ status: 503, body: { ready: false, reason: `${provider}-probe-failed` } });
      }
    },
    lifecycle: {
      serviceId: provider === 'database' ? 'pulse-database' : 'pulse-rabbitmq',
      env, external: true,
      intrinsicProbe: () => host.dispatch({
        transport: 'internal', method: 'GET', path: '/api/runtime/infrastructure/ready', body: '{}',
      }),
    },
  });
  return host;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const adapter = await createInfrastructureAdapter();
  await adapter.start();
  console.log('[INFRASTRUCTURE] Pascalish adapter listening', adapter.getStatus());
  const stop = () => adapter.stop().catch(error => {
    console.error(`[INFRASTRUCTURE] Adapter shutdown failed: ${error.message}`);
    process.exitCode = 1;
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
