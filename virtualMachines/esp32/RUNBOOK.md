# Pulse ESP32 Quick Runbook

This runbook covers the operational entry points for the workspace. For the current architecture and cleanup boundaries, also read `README.md` and `documents/REPOSITORY_HYGIENE_PLAN.md`.

## Startup

- Full stack: `./start-servers.bat`
- Cluster mode: `./start-cluster.bat`
- Backend only: `./start-backend.bat`
- Frontend only: `./start-frontend.bat`

## Shutdown

- Full stack: `./stop-servers.bat`
- Cluster mode: `./stop-cluster.bat`
- Backend only: `./stop-backend.bat`

## Health Check

- PowerShell: `./scripts/health-check-stack.ps1`

Checks:
- Backend orchestrator: `http://127.0.0.1:4000/status`
- Broker: `http://127.0.0.1:4001/health`
- Queue manager (primary): `http://127.0.0.1:4100/health`
- Frontend: `http://127.0.0.1:5173/`

## Cluster Operations

Local cluster startup is a bootstrap action, not the full clustering model.

- `start-cluster.bat` starts the local backend as `primary` by default
- `start-cluster.bat backup <peer-host>` starts the local backend as `backup` and can optionally promote frontend/backend routing
- cluster membership, cluster state, and topology metadata are managed by backend APIs

Current backend cluster endpoints:

- `GET /api/clusters`
- `POST /api/clusters`
- `DELETE /api/clusters/:clusterId`
- `POST /api/clusters/:clusterId/quiesce`
- `POST /api/clusters/:clusterId/start`
- `GET /api/clusters/:clusterId/announce`
- `POST /api/clusters/:clusterId/deploy`

Persisted cluster-related state:

- `aggregator/data/cluster-registry.json`
- `aggregator/data/site-registry.json`
- `aggregator/data/node-topology-overrides.json`
- `aggregator/data/node-rename-overrides.json`

Important current behavior:

- Unassigned nodes are automatically grouped into managed free pools.
- The managed free pools are `free-pool`, `free-pool-js`, and `free-pool-esp`.
- Cluster UDP parent/sibling port pairs are allocated deterministically starting at `4200`.

## Bonecrusher Phase 1 (COM5)

- Compile only: `npm run phase1:bonecrusher:compile`
- Upload only: `npm run phase1:bonecrusher:upload`
- Persist proof only: `npm run phase1:bonecrusher:persist`
- Health checks only: `npm run phase1:bonecrusher:health`
- Full gate (compile + upload + persist + health): `npm run phase1:bonecrusher:full`

Optional parameters (PowerShell direct):
- Custom COM port: `-ComPort COM6`
- Custom Bonecrusher host: `-BonecrusherHost http://192.168.2.119`
- Skip health/persist in full run: `-SkipHealth` / `-SkipPersistProof`

Example:
- `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/phase1-bonecrusher.ps1 -Action full -ComPort COM5 -BonecrusherHost http://192.168.2.115`

## Safe Restart Pattern

1. Run `./stop-servers.bat`
2. Run `./scripts/stop-stack.ps1`
3. Run `./start-servers.bat`
4. Run `./scripts/health-check-stack.ps1`

## Notes

- If frontend binds to 5174, free listeners on 5173 and restart frontend.
- If queue manager is running as backup, check `http://127.0.0.1:4101/health`.
- `stop-cluster.bat` stops the local backend role and frontend listener, but it does not delete persisted cluster registry state.
