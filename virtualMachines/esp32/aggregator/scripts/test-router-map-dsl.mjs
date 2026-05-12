import fs from 'fs/promises';
import { createRouterEngine } from '../router-engine.mjs';

const TEST_RULES_PATH = './data/router-rules.mapdsl.test.json';
const published = [];

async function seedRules() {
  const seed = [
    {
      id: 'map-fanout',
      name: 'Map fanout rule',
      serviceId: 'aggregator-router-service',
      enabled: true,
      inputQueue: 'swift.mt202cov.parsed',
      outputs: [
        {
          queueName: 'audit.all',
          whenRule: 'output := 1;',
          transformRule: 'output := src;'
        },
        {
          queueName: 'pacs.outbound',
          whenRule: 'output := 1;',
          transformRule: 'output := map("mt202cov-to-pacs", src);'
        }
      ]
    }
  ];
  await fs.writeFile(TEST_RULES_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf-8');
}

const router = createRouterEngine({
  rulesPath: TEST_RULES_PATH,
  mappingsPath: './data/data-mappings.json',
  serviceId: 'aggregator-router-service',
  publishToQueue: async ({ queueName, message, sourceService }) => {
    published.push({ queueName, message, sourceService });
    return { deliveredTo: 'test-manager', mode: 'test' };
  },
  dequeueFromQueue: async () => null
});

async function main() {
  await seedRules();

  const inbound = {
    finEnvelope: {
      block4: {
        fields: {
          '20': 'REFCOV12345',
          '21': 'E2E-COV-999',
          '32A': { components: { valueDate: '260520', currency: 'gbp', amount: '500000,00' } },
          '50a': 'Originating Bank Name',
          '52A': 'DEUTDEDD',
          '56A': 'NORSEIT2X10',
          '57A': 'CHQABEBBXXX',
          '58A': 'IRVTIT2XXXX',
          '59a': 'Beneficiary Bank Name',
          '72': 'COVER PAYMENT FOR MT103'
        }
      }
    }
  };

  const result = await router.ingest({
    inputQueue: 'swift.mt202cov.parsed',
    message: inbound,
    sourceService: 'parser-service'
  });

  console.log('Routing result:', JSON.stringify(result, null, 2));
  console.log('Published:', JSON.stringify(published, null, 2));

  await fs.unlink(TEST_RULES_PATH).catch(() => {});
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
