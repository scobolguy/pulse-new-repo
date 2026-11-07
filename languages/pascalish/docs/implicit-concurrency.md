# Pascalish execution DAG prototype

Compile a standalone Pascalish program with `{ includeExecutionDag: true }` to
receive an `executionDag` alongside the unchanged P-Code and program map. The
CLI can write the same metadata with `--execution-dag-out <file>`.

The opt-in local executor is exported as `@pulse/pascalish/execution-dag`:

```js
import {
  createExecutionDagWorkerPool,
  executeExecutionDagOrFallback
} from '@pulse/pascalish/execution-dag';

const pool = await createExecutionDagWorkerPool({ concurrency: 4 });
try {
  const result = await executeExecutionDagOrFallback(compiled.executionDag, {}, {
    concurrency: 4,
    workerPool: pool,
    executeSequential: () => executeProgram(sequentialOptions)
  });
} finally {
  await pool.close();
}
```

This prototype executes only the initial contiguous sequence of eligible scalar
assignments with proven-pure expressions. It currently supports integer and
Boolean literals, integer state values, unary minus and `not`, and integer
arithmetic, comparisons, `and`, and `or`. Declared integer and Boolean variables
start at zero; `initialState` overrides those values when needed. Calls,
real/decimal/string expressions,
indexed or field assignments, control flow, and I/O are barriers. Execution
stops at the first barrier and reports its node id in `stoppedAtBarrier`; it
does not execute or skip the remaining Pascalish program. The default compiler
and PMachine paths remain sequential and do not invoke this executor.

For whole-program behavior, use `executeExecutionDagOrFallback` and supply the
normal sequential PMachine call as `executeSequential`. The dispatcher uses DAG
execution only if every statement is supported; otherwise it runs the sequential
program from the beginning, without having executed a DAG prefix first. This
preserves full-program behavior while the supported language subset is small.

DAG nodes include conservative effect labels. Scalar assignments with proven
pure expressions are `transactional` writes and may run in parallel when their
read/write sets do not conflict. `write`/`writeln` are `impure` I/O; other calls
remain `unknown` until routine effect declarations or inference are added.

The worker pool uses Node.js `worker_threads`. It is reusable across DAG runs in
Node.js, but it does not run on the Arduino/ESP32 target. ESP32 programs still
execute their generated P-Code sequentially by default. For opt-in swarm
execution, export `@pulse/pascalish/esp32-dag-swarm` and use
`createEsp32DagScheduler` with a node source returning fresh discovery records.
The Aggregator exposes the same scheduler at `POST /api/pmachine/dag/execute`
with `{ "dag": compiled.executionDag, "initialState": {} }` as the body.

Only fully eligible integer/Boolean assignment DAGs are accepted. The
Aggregator uses its existing discovery beacons to determine node freshness and
availability; nodes must be fresh within the discovery TTL (three minutes),
explicitly available, not draining, and advertise both `pascalish-dag-v1` and
`dagWorker.maxConcurrentTasks`.
Each ESP32 currently advertises capacity one and evaluates one bounded pure
expression at `/pmachine/dag/execute`; expression trees are limited to depth 16
and 64 nodes, with at most 16 inputs. Results are committed only after every
task in its dependency batch succeeds. If there are no eligible workers or a
dispatch fails, the Aggregator executes the eligible DAG sequentially on-host.
Unsupported statements or malformed DAG metadata are rejected rather than
partially dispatched. Ordinary P-Code execution remains unchanged.

For an opt-in hardware check, set `PULSE_ESP32_TEST_URL` to the device origin and
`PULSE_AGGREGATOR_TEST_URL` to the running Aggregator origin, then run
`virtualMachines\esp32\testing\pmachines\verify-esp32-dag-swarm.mjs` with Node.
The check requires a real beacon-derived discovery record and asserts that
all five assignments execute on the device without sequential fallback. It
also checks integer overflow, Boolean operations, and rejected expressions.
The explicitly selected device origin controls the test transport (HTTP for
local development, or HTTPS with a trusted certificate); production dispatch
uses the advertised service protocol and port without bypassing TLS validation.
Set `PULSE_DAG_TEST_MODE=api` to exercise the running Aggregator's execution
endpoint instead of a scheduler instantiated in the test. This mode requires
an HTTPS device origin and fails if the API falls back to sequential execution.
Both the test process and Aggregator must trust the device certificate's CA
(for example, through `NODE_EXTRA_CA_CERTS` configured before starting Node).

An unenrolled ESP32 with no active enrollment can rotate its TLS bootstrap
token using `TLS_BOOTSTRAP_ROTATE` on the physical serial console. The response
contains the newly generated token; keep it private and use it only for
certificate enrollment. Bluetooth/control-plane streams cannot invoke this
command. Rotation preserves Wi-Fi settings and refuses enrolled devices.
Certificate commit returns HTTP 202 with `restartPending: true`. HTTPS restarts
after the loopback proxy receives the response; poll `/tls/status` using the
new trusted certificate until `enrollmentState` is `enrolled`.
DAG dispatch closes each HTTP/TLS connection after receiving its result to
avoid retaining scarce ESP32 TLS-session memory between jobs.

For the two-board resilience check, set `PULSE_ESP32_TEST_URLS` to two
comma-separated trusted HTTPS origins and `PULSE_AGGREGATOR_TEST_URL` to the
running Aggregator. Run
`virtualMachines\esp32\testing\pmachines\verify-esp32-dag-resilience.mjs`.
It checks overlapping dispatch to both boards, exclusive leases across competing
jobs, distinct task IDs, isolated results, transport-failure fallback after a
successful dependency batch, recovery, and concurrent Aggregator API submissions.
Saturated jobs may explicitly fall back sequentially; this MVP does not queue
jobs awaiting a free worker. Transport loss and three-minute beacon expiry are
injected in the test scheduler, without disrupting the boards or changing the
Aggregator's discovery records. Physical power removal and a real three-minute
outage still require a separate hardware test. Set
`PULSE_DAG_TEST_REBOOT=1` to additionally restart one selected board during
dispatch, require an observable outage and explicit fallback, wait up to 120
seconds for trusted TLS and a new beacon, and prove both workers recover.
This optional check disrupts the selected board; it does not remove power or
wait for actual discovery TTL expiry.

For a manual power-removal check, fully disconnect one board's power, verify
its HTTPS endpoint is unreachable, and submit a DAG while its beacon is still
fresh (an explicit timeout fallback is expected). Keep it off until its record
expires after three minutes; the remaining board should then execute without
fallback. Restore power and require a fresh beacon, persisted trusted TLS, and
overlapping two-board dispatch. Ensure each board's persisted discovery UDP
ports match the running Aggregator's listener before testing. For an Aggregator
listening on UDP 4210, POST form fields `parentPort=4210&siblingPort=4211` to
the board's `/node/topology` endpoint. This is separate from Aggregator HTTP
port 4000; a board can recover Wi-Fi and HTTPS yet remain undiscovered when its
UDP ports are wrong.
Topology persistence creates the configuration directory on a fresh filesystem,
reports HTTP 500 if saving fails, and restores saved UDP ports before boot-time
discovery starts. Firmware upload alone preserves this configuration; filesystem
image upload replaces it.
