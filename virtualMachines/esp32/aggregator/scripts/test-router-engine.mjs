import { createRouterEngine } from '../router-engine.mjs';
import fs from 'fs/promises';

const published = [];
const inMemoryQueues = new Map();
const TEST_RULES_PATH = './data/router-rules.test.json';

async function seedRules() {
  const seed = [
    {
      id: 'swift-fanout-default',
      name: 'SWIFT inbound fan-out',
      enabled: true,
      inputQueue: 'swift.inbound',
      outputs: [
        {
          queueName: 'audit.all',
          whenRule: 'output := 1;',
          transformRule: 'output := src;'
        },
        {
          queueName: 'payments.mt103',
          whenRule: 'IF startswith(upper(src), "MT103") THEN output := 1 ELSE output := 0;',
          transformRule: 'output := src;'
        }
      ]
    }
  ];
  await fs.writeFile(TEST_RULES_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf-8');
}

function enqueueInput(queueName, message, sourceService = 'test-seed') {
  const q = inMemoryQueues.get(queueName) || [];
  q.push({ message, sourceService });
  inMemoryQueues.set(queueName, q);
}

const router = createRouterEngine({
  rulesPath: TEST_RULES_PATH,
  publishToQueue: async ({ queueName, message, sourceService }) => {
    published.push({ queueName, message, sourceService });
    return { deliveredTo: 'test-manager', mode: 'test' };
  },
  dequeueFromQueue: async ({ inputQueue }) => {
    const q = inMemoryQueues.get(inputQueue) || [];
    if (q.length === 0) return null;
    return q.shift();
  }
});

async function main() {
  await seedRules();

  const direct = await router.ingest({
    inputQueue: 'swift.inbound',
    message: 'MT103:TEST:ABC',
    sourceService: 'webapi'
  });

  enqueueInput('swift.inbound', 'MT103:QUEUE:DEF', 'queue-source');
  enqueueInput('swift.inbound', 'MT202:QUEUE:GHI', 'queue-source');

  const fromQueue = await router.processFromQueue('swift.inbound', { maxMessages: 5, consumerService: 'router-worker' });

  console.log('Direct routing result:', JSON.stringify(direct, null, 2));
  console.log('Queue routing result:', JSON.stringify(fromQueue, null, 2));
  console.log('Published messages:', JSON.stringify(published, null, 2));

  await fs.unlink(TEST_RULES_PATH).catch(() => {});
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
