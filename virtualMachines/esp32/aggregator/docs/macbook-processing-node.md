MacBook Processing Node and Shared Broker

Goal
- Make MacBook a real transaction-processing node.
- Share one broker across Neptune and MacBook.

Prerequisites
- Neptune and MacBook on same LAN.
- RabbitMQ reachable from both machines.
- This repository checked out on both machines.

Step 1: Configure shared broker on both hosts
- Copy .env.shared-broker.example to .env.local on Neptune backend host.
- Copy .env.shared-broker.example to .env.local on MacBook backend host.
- Set the same RabbitMQ values on both hosts:
  - BROKER_PROVIDER=rabbitmq
  - RABBITMQ_URL
  - RABBITMQ_EXCHANGE
  - RABBITMQ_QUEUE_PREFIX

Step 2: Start backend on Neptune and MacBook
- On each machine, from aggregator folder:
  - npm install
  - node backend.mjs

Expected
- Both backends listen on port 4000 on their own host.
- Both publish/consume through the same RabbitMQ broker.

Step 3: Frontend failover targets
- On MacBook frontend host, copy .env.macbook-processing.example to .env.local.
- Set VITE_API_BASES to your two HAProxy gateway IPs.
- Start frontend:
  - npm run dev

Step 4: Register MacBook browser as available
- Open the UI on MacBook.
- On Network Topology, press I'm available.
- MacBook should appear under Active Physical Devices.

Step 5: Verify routing behavior
- Mark Neptune unavailable in UI.
- Send a transaction.
- New assignment should avoid Neptune and use available node(s).

Important note about sharing broker
- Yes, sharing one queue broker is supported and recommended for this test.
- Keep broker settings identical on every backend node.
- If broker is down, all nodes are impacted, so broker HA is the next hardening step.
