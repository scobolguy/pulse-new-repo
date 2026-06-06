# Startup Procedure (Backend First, Frontend Second)

This document defines the required startup order and FSM status expectations.

## Required Order

1. Start backend first.
2. Start frontend second.

The frontend depends on backend availability, but frontend and backend FSM states are tracked independently in separate status files.

## Commands

From `virtualMachines/esp32/aggregator`:

```powershell
npm run startup:fsm:backend
npm run startup:fsm:frontend
```

Alternative frontend command that waits for backend first:

```powershell
npm run dev:frontend:wait-backend
```

Notes:
- `dev:frontend:wait-backend` now launches only the frontend FSM after backend is healthy.
- It does not relaunch backend startup or combine both FSM workflows.

## FSM Status Files

Backend FSM status:
- `data/startup-fsm-status.json`

Frontend FSM status:
- `data/frontend-startup-fsm-status.json`

Both files include a `service` field:
- Backend file: `"service": "backend"`
- Frontend file: `"service": "frontend"`

Frontend status also records backend dependency health under:
- `dependencies.backend.required`
- `dependencies.backend.url`
- `dependencies.backend.ok`
- `dependencies.backend.checkedAt`

## Expected READY Conditions

Backend READY:
- Backend FSM reaches `READY`.
- Backend endpoint is healthy.

Frontend READY:
- Frontend FSM verifies backend dependency in `CHECK_BACKEND`.
- Frontend server starts and becomes healthy.
- Frontend FSM reaches `READY`.

## Troubleshooting

If frontend fails with backend dependency errors:
1. Ensure backend FSM was started first.
2. Verify backend status file shows `state: "READY"`.
3. Re-run frontend startup FSM.

If ports are occupied:
1. Resolve the process using the reported port.
2. Re-run the corresponding FSM startup command.
