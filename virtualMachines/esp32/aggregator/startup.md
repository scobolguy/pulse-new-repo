# Startup Procedure

This document defines the canonical startup order and readiness validation for backend and frontend services.

## One-command ordered startup

Run from `virtualMachines/esp32/aggregator`:

```powershell
npm run startup:fsm:ordered
```

What this command does:

1. Runs backend FSM first: `startup:fsm:backend`
2. Verifies backend status file reports READY
3. Runs frontend FSM second: `startup:fsm:frontend`
4. Verifies frontend status file reports READY
5. Exits with non-zero code if either verification fails

## Required startup order

Always start backend first, then frontend.

- Backend FSM status: `data/startup-fsm-status.json`
- Frontend FSM status: `data/frontend-startup-fsm-status.json`

## FSM independence and dependency model

The states are independent per service and written to separate files.

- Backend status file uses `service: "backend"`.
- Frontend status file uses `service: "frontend"`.
- Frontend tracks backend dependency separately under:
  - `dependencies.backend.required`
  - `dependencies.backend.url`
  - `dependencies.backend.ok`
  - `dependencies.backend.checkedAt`

Frontend READY does not overwrite backend state; backend and frontend FSM histories are independent.

## Health endpoint defaults

Both FSMs use backend health endpoint default:

`http://127.0.0.1:4000/api/authz/me?userId=system-admin`

## Additional useful commands

```powershell
npm run startup:fsm:backend
npm run startup:fsm:frontend
npm run dev:frontend:wait-backend
```

`dev:frontend:wait-backend` waits for backend health and then starts only frontend FSM.

## Troubleshooting

If ordered startup fails:

1. Read `data/startup-fsm-status.json` and `data/frontend-startup-fsm-status.json`.
2. Check the most recent `logs` entry for the failed state.
3. Resolve port conflicts or dependency failures reported in the status logs.
4. Re-run `npm run startup:fsm:ordered`.
