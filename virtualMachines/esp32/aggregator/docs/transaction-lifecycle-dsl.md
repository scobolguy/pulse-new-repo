# Transaction Lifecycle DSL (Separate Compiler)

This DSL models transaction finite-state lifecycles separately from router and workflow DSLs.

## Source

- `data/transaction-lifecycle.tsl`

## Compiler

- `scripts/compile-transaction-lifecycle-dsl.mjs`

Run:

```powershell
npm run compile:lifecycle
```

## Output artifacts

- `data/transaction-lifecycle-compiled.json`
- `data/transaction-lifecycle-dashboard.json`

The compiled output includes topological layers so the dashboard can render left-to-right flow.

## Syntax

```text
transaction "id" begin
  description "optional";

  state "state_name" initial label "display" queue "queue.name";
  state "verify_liquidity" label "Verify Liquidity" queue "tx.liquidity.verify" subflow "liquidity-management";
  state "another_state" label "display" queue "queue.name";

  transition "from_state" -> "to_state" on "event_name" when "predicate" action "action-text";
end;
```

  Generic FSM templates:

  ```text
  fsm gateway<TProvider>(inboundQueue, pendingQueue, approvedQueue, rejectedQueue) begin
    description "Reusable gateway for ${TProvider}";

    state "inbound" initial label "Inbound ${TProvider}" queue inboundQueue;
    state "pending" queue pendingQueue;
    state "approved" queue approvedQueue;
    state "rejected" queue rejectedQueue;

    transition "inbound" -> "pending" on "received";
    transition "pending" -> "approved" on "approved";
    transition "pending" -> "rejected" on "rejected";
  end;

  instantiate gateway<"boc"> as "boc-gateway" with
    inboundQueue = "lynx.pacs009.outbound",
    pendingQueue = "tx.lynx.pending",
    approvedQueue = "tx.lynx.approved",
    rejectedQueue = "tx.rejected";
  ```

Notes:

- Keywords are case-insensitive. Use lowercase, uppercase, or mixed-case.
- Exactly one state must be marked `initial`.
- Graph must be acyclic for topological left-to-right rendering.
- `queue` binds a state to a queue so live message counts can be shown.
- `subflow` marks a state as a nested FSM boundary. The parent FSM treats it as one state.
- `fsm` declares a generic reusable state machine template.
- `instantiate` expands a template into a concrete FSM instance.
- Template placeholders use only `${name}` substitution.

## Canonical Style (Strict)

To keep the model simple and pure, use these rules:

- Declare reusable behavior in `fsm ... begin ... end;`.
- Materialize concrete machines only via `instantiate ... as ... with ...;`.
- Keep parent transaction states semantic (for example `verify_liquidity`) and hide provider detail in subflows.
- Prefer explicit queue names and explicit transition events over inferred behavior.

Enforced compiler rules:

- A state using `subflow "..."` must reference an instantiated FSM `as "..."`.
- Transitions leaving a subflow state cannot use `when` or `action`.
- Subflow parent transitions must be pure event edges (for example `on "liquidity_verified"`).
- Provider specifics (queue fan-out, approval heuristics, conditional logic) belong inside the instantiated gateway/subflow FSM, not in the parent transaction FSM.

## Subflow Logic and External Calls

Subflow FSMs support conditional guards and external web calls in transition actions.

Guard examples (`when`):

- `when "status = approved"`
- `when "message.amount != 0 and message.currency = CAD"`
- `when "message.route = LYNX or message.route = FEDWIRE"`

Action examples (`action`):

- `action "ENQUEUE lynx.pacs009.outbound"`
- `action "HTTP_SYNC POST https://boc.example/api/liquidity timeout_ms=8000"`
- `action "HTTP_ASYNC POST https://audit.example/events"`
- `action "DB_SYNC liquidity_adapter check_limit"`
- `action "DB_ASYNC ledger_projection upsert"`

Action semantics:

- `HTTP_SYNC` blocks the transition and fails the worker tick if the web call fails.
- `HTTP_ASYNC` is fire-and-forget and does not block progression.
- `DB_SYNC` and `DB_ASYNC` are policy-gated and disabled by default.
- On action failure, the message is re-queued to the source state queue for safety.

DB calls guidance:

- Keep DB effects out of transaction FSM transitions unless required by regulation.
- Prefer asynchronous projection via events (`HTTP_ASYNC` to an internal service) over inline DB writes.
- If DB reads become necessary, model them as explicit gateway/subflow states rather than hidden side effects.

Policy endpoints:

- `GET /api/lifecycle/policy`
- `POST /api/lifecycle/policy` with `{ "allowDbSync": true|false, "allowDbAsync": true|false }`

Note: even when DB flags are enabled, a concrete DB adapter must be configured before DB actions can execute.

## Subflow Reduction Model

Use `subflow` to hide detailed routing in a nested flow while keeping the parent FSM simple.

Example:

```text
state "verify_liquidity" label "Verify Liquidity" queue "tx.liquidity.verify" subflow "liquidity-management";
transition "verify_liquidity" -> "ready_to_settle" on "liquidity_verified";
transition "verify_liquidity" -> "rejected" on "liquidity_failed";
```

Queue contract for `subflow "liquidity-management"`:

- Parent to subflow ingress: `subflow.liquidity-management.inbound`
- Subflow success event: `subflow.liquidity-management.liquidity_verified`
- Subflow failure event: `subflow.liquidity-management.liquidity_failed`

You can map this naturally to generic instances (for example `boc-gateway`, `fed-gateway`) and keep the parent transaction flow at a single abstract state like `verify_liquidity`.

Control endpoints for subflow workers:

- `GET /api/lifecycle/subflows/workers`
- `POST /api/lifecycle/subflows/workers/start-default`
- `POST /api/lifecycle/subflows/workers/stop-all`

## Dashboard API

Backend endpoint:

- `GET /api/lifecycle/dashboard`

Lifecycle test control endpoints:

- `POST /api/lifecycle/test/start`
- `POST /api/lifecycle/test/step`
- `POST /api/lifecycle/simulators/bank-of-canada/approve`
- `POST /api/lifecycle/simulators/bank-of-canada/reject`
- `POST /api/lifecycle/simulators/correspondent/send-mt940`

Returns:

- compiled topology and transitions
- states with live queue lengths
- per-layer totals
- total messages across all states

UI control:

- Open the **Transaction Lifecycle** screen and right-click anywhere.
- Context menu actions let you start a test transaction, single-step events, and trigger the Bank of Canada/correspondent simulators.
