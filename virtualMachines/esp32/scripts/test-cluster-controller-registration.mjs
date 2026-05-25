#!/usr/bin/env node

const args = process.argv.slice(2);
const backendArgIndex = args.findIndex((value) => value === '--backend');
const backendUrl = backendArgIndex >= 0 && args[backendArgIndex + 1]
  ? String(args[backendArgIndex + 1]).trim().replace(/\/$/, '')
  : 'http://localhost:4000';
const discoveryArgIndex = args.findIndex((value) => value === '--discovery');
const discoveryUrl = discoveryArgIndex >= 0 && args[discoveryArgIndex + 1]
  ? String(args[discoveryArgIndex + 1]).trim().replace(/\/$/, '')
  : 'http://localhost:4300';

const idSuffix = `${Date.now()}`;
const controllerId = `cluster-test-${idSuffix}`;
const clusterId = `cluster-${idSuffix}`;

const payload = {
  controllerId,
  clusterId,
  nodeName: `Cluster Test Controller ${idSuffix}`,
  ip: '192.168.1.250',
  parentUdpPort: 4210,
  childUdpPort: 4211,
  parentClusterId: 'root-cluster',
  services: [
    { name: 'qm', status: 'up' },
    { name: 'router', status: 'up' }
  ],
  members: [
    {
      id: 'edge-a',
      nodeName: 'Edge A',
      ip: '192.168.1.251',
      services: [{ name: 'worker', status: 'up' }],
      children: [
        {
          id: 'leaf-a1',
          nodeName: 'Leaf A1',
          ip: '192.168.1.252',
          services: [{ name: 'sensor', status: 'up' }],
          children: []
        },
        {
          id: 'leaf-a2',
          nodeName: 'Leaf A2',
          ip: '192.168.1.253',
          services: [{ name: 'sensor', status: 'up' }],
          children: []
        }
      ]
    },
    {
      id: 'edge-b',
      nodeName: 'Edge B',
      ip: '192.168.1.254',
      services: [{ name: 'worker', status: 'up' }],
      children: []
    }
  ]
};

async function main() {
  const registrationTargets = [
    `${backendUrl}/api/cluster-controller/register`,
    `${discoveryUrl}/api/cluster-controller/register`
  ];

  let registerOk = false;
  let registrationDetails = null;
  for (const endpoint of registrationTargets) {
    const registerRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const registerBody = await registerRes.json().catch(() => ({}));
    if (registerRes.ok) {
      registerOk = true;
      registrationDetails = { endpoint, body: registerBody };
      break;
    }
    if (registerRes.status !== 404) {
      throw new Error(`Registration failed at ${endpoint}: HTTP ${registerRes.status} ${JSON.stringify(registerBody)}`);
    }
  }

  if (!registerOk) {
    throw new Error('Registration failed: backend and discovery registration endpoints were unavailable.');
  }

  const registrationBaseUrl = String(registrationDetails?.endpoint || '').replace(/\/api\/cluster-controller\/register$/, '');
  const nodesSourceUrl = registrationBaseUrl || backendUrl;

  const nodesRes = await fetch(`${nodesSourceUrl}/api/nodes`);
  const nodesBody = await nodesRes.json().catch(() => []);
  if (!nodesRes.ok) {
    throw new Error(`Fetch nodes failed: HTTP ${nodesRes.status}`);
  }

  const nodes = Array.isArray(nodesBody)
    ? nodesBody
    : Array.isArray(nodesBody?.nodes)
      ? nodesBody.nodes
      : [];

  const match = nodes.find((node) => {
    const cid = String(node?.cluster?.clusterId || '').trim();
    const nid = String(node?.id || '').trim();
    return cid === clusterId || nid.includes(controllerId);
  });

  if (!match) {
    throw new Error('Registration submitted but cluster controller not found in /api/nodes response.');
  }

  const summary = {
    registered: true,
    backendUrl,
    discoveryUrl,
    controllerId,
    clusterId,
    registrationEndpoint: registrationDetails?.endpoint,
    nodesEndpoint: `${nodesSourceUrl}/api/nodes`,
    observed: {
      nodeName: match.nodeName,
      ip: match.ip,
      parentUdpPort: match?.cluster?.parentUdpPort,
      childUdpPort: match?.cluster?.childUdpPort,
      memberCount: Array.isArray(match?.cluster?.members) ? match.cluster.members.length : 0,
      lastSeen: match.lastSeen
    }
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`[test-cluster-controller-registration] ${error.message || String(error)}`);
  process.exitCode = 1;
});
