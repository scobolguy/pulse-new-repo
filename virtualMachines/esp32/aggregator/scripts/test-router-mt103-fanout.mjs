import fs from 'fs/promises';
import { createRouterEngine } from '../router-engine.mjs';

const TEST_RULES_PATH = './data/router-rules.mt103fanout.test.json';
const published = [];

async function seedRules() {
  const seed = [
    {
      id: 'mt103-fanout',
      name: 'MT103 fan-out',
      serviceId: 'aggregator-router-service',
      enabled: true,
      inputQueue: 'swift.mt103.parsed',
      outputs: [
        {
          queueName: 'correspondent.pacs008.outbound',
          whenRule: 'output := 1;',
          transformRule: 'output := map("mt103-to-pacs", src);'
        },
        {
          queueName: 'lynx.pacs009.outbound',
          whenRule: 'output := 1;',
          transformRule: 'output := map("pacs-to-lynx", map("mt103-to-pacs", src));'
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
          '20': 'REF123456789',
          '21': 'E2E-ABC-123',
          '32A': {
            components: {
              valueDate: '260515',
              currency: 'usd',
              amount: '25000,50'
            }
          },
          '52A': 'DEUTDEDD',
          '57A': 'CHQABEBBXXX',
          '59': {
            lines: [
              '/IT60X0542811101000000123456',
              'JANE DOE'
            ]
          },
          '70': 'Invoice 12345',
          '71A': 'SHA',
          '72': '/INS/ROUTING NOTES'
        }
      }
    }
  };

  const result = await router.ingest({
    inputQueue: 'swift.mt103.parsed',
    message: inbound,
    sourceService: 'swift-parser'
  });

  console.log('Routing result:', JSON.stringify(result, null, 2));
  console.log('Published messages:', JSON.stringify(published, null, 2));

  await fs.unlink(TEST_RULES_PATH).catch(() => {});
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
