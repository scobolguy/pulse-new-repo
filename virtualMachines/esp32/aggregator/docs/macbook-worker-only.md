MacBook Worker-Only Setup (No backend.mjs)

Goal
- Run one Node worker process on MacBook.
- Keep Neptune as primary backend/control plane.

What runs where
- Neptune: backend.mjs (orchestrator + workers)
- MacBook: queue-manager-node.mjs only

Prerequisites
- MacBook can reach Neptune over LAN.
- Neptune backend is running and reachable at http://<neptune-ip>:4000.
- Node.js installed on MacBook.

Step 1: Prepare MacBook
- In aggregator folder:
  - npm install
  - cp .env.macbook-worker-only.example .env.local
- Edit .env.local path if desired.

Step 2: Start MacBook queue manager node
- Replace placeholders and run:

  node queue-manager-node.mjs \
    --aggregator=http://<neptune-ip>:4000 \
    --host=0.0.0.0 \
    --port=4100 \
    --manager-id=qm-macbook-4100 \
    --node-id=MacBook \
    --advertise-ip=<macbook-lan-ip>

Expected startup logs
- [QM] qm-macbook-4100 listening on http://0.0.0.0:4100
- [QM] advertising <macbook-lan-ip>:4100 to http://<neptune-ip>:4000

Step 3: Verify on Neptune UI
- Open topology and refresh.
- Confirm a queue manager for MacBook appears in registry views.
- Mark Neptune unavailable and run a test flow.

Important note
- In this worker-only mode, MacBook hosts queue data/queue manager.
- Core flow orchestration logic still runs in Neptune backend workers.
- To execute full orchestration on MacBook too, you would need backend.mjs there.
