# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

`src/runtime.mjs` owns the interpreter. The legacy [Aggregator entrypoint](../../aggregator/scripts/run-js-pmachine.mjs) delegates both API calls and CLI execution to this runtime; it must not contain a separate interpreter copy. Queue-manager and debug helper integrations remain in the Aggregator. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

Run the shared conformance suite from `aggregator` with `node scripts/test-pmachine-conformance.mjs --target js`. To compare against installed ESP32 firmware, set `ESP32_HOST` and run the same script with `--diff`.

## Optional COBOL and ISAM host modules

The interpreter does not own COBOL text/date/math helpers or indexed-file storage.
Service and editor hosts use the on-demand
[`createCobolHostLibrary`](../../libraries/cobol/host-library.mjs) loader.
Each host owns its loaded ISAM adapter and disposes it to release file locks.
Importing the loader does not import the utilities, compiler or ISAM adapter;
only the first corresponding host call does. Filesystem grants are still required.
Existing desktop binding imports remain supported as compatibility exports.

## Hosted service readiness

For serialized hosts, intrinsic readiness probes wait for the current invocation
queue before starting their execution timeout. Queue contention is not a failed
storage operation. The probe timeout and genuine dependency/storage-failure
gating remain enabled. Standalone lifecycle integrations can provide an
abort-aware `waitForIntrinsicProbe(signal)` when their probe shares an execution
queue.

An explicit lifecycle `refresh()` waits for an older in-flight probe and samples
again, rather than returning observations taken before the request. Periodic
probes still coalesce while a cycle is in progress.

Direct filesystem-service calls close their HTTP connections after each request.
They do not reuse a socket that may have expired while compiler work blocked the
client event loop, and they do not retry potentially committed writes. Transport
errors retain their underlying cause. Logical-service transactions are unchanged.

## C# and shared System bindings

The initial [C# compiler](../../../../languages/csharp/README.md) targets this
runtime and shares its [System contract](../../../../languages/dotnet/README.md)
with VBish. Procedure CALL arguments preserve strings, boxed values and managed
references rather than coercing every scalar argument into a number.
`CALL_EXT system.int32.divide 2` and `system.int32.remainder 2` enforce Int32
arguments and explicit divide-by-zero/overflow faults. The generic p-machine
`DIV` opcode retains its existing behavior; the C# compiler selects the
appropriate intrinsic instead. These bindings are currently JS-only.

Pascalish supports fixed-point `decimal(precision, scale)` declarations, the `decimal(value)` conversion, and `ROUNDED` assignments. Bare `decimal` defaults to precision 18 and scale 0; `decimal(p)` defaults to scale 0. Precision must be a positive integer, and scale must be an integer from 0 through precision. Assignment fixes the receiving field's scale, truncating by default or rounding half-up away from zero with `ROUNDED`. Decimal literals retain their original digits rather than passing through floating point.

Run the compiler-to-runtime decimal regression from `aggregator` with `node scripts/test-decimal-arithmetic.mjs`. After editing `aggregator/grammar/Pascalish.g4`, regenerate its JavaScript parser with the repository's ANTLR 4.13.2 tool before testing.

## Managed VM storage (initial integration)

The package exports `PMachineMemory` and `PMachineMemoryError`. The memory owner
supports bounded byte blocks, lazy first-access allocation, checked reads/writes,
resizing, ownership transfer, and program/invocation/procedure scopes. Closing a
scope recursively releases its descendants. Failed allocation or growth preserves
existing blocks and throws an explicit error; configured limits never spill into
an unbudgeted allocation.

Pass `runtimeContext.memoryLimitBytes` to `executeProgram`, or pass a
`PMachineMemory` instance as `runtimeContext.memoryManager` to retain allocator
diagnostics across runs. The initial interpreter integration covers operand-stack
slots and global/local variable slots. Each slot costs 16 VM bytes, plus UTF-8
payload bytes for strings. Procedure storage is released on return; invocation
storage is released on success, cancellation, or exceptions. A successful result's
`memory` field describes usage before invocation cleanup; the manager's
`diagnostics()` reports usage after cleanup, with lifetime totals and cumulative
high-water/failure counters. Without either configuration option, execution keeps
its existing allocation behavior.

This is a VM-storage model, not a limit on V8's physical heap. JavaScript metadata,
objects referenced by slots, host-owned tables/caches, file resources, JSON
temporaries, output snapshots, and compiler data are not yet covered by this
integration. Byte-block reads return caller-owned copies outside the budget.
It must not yet be used as a sandbox-wide memory limit.

The allocator API supports lazy blocks and program-lifetime ownership, but
`static`/`lazy` declaration syntax, service-lifetime integration, and the C++/ESP32
ports are not implemented by this initial integration.

Run the focused tests from the ESP32 workspace:

```powershell
node --test testing\pmachines\memory-management.test.mjs
```

## Virtual program scheduling

The package exports `PMachineScheduler`. A scheduler has a bounded number of
execution slots and a separate bound on live virtual programs:

```js
import { PMachineScheduler, parsePcode } from './index.mjs';

const scheduler = new PMachineScheduler({ slots: 1, maxContexts: 64, quantum: 256 });
const result = await scheduler.execute({
  instructions: parsePcode(pcodeText),
  programMap,
  opcodeMap,
  runtimeContext: { callHost, signal },
}, { name: 'requester' });
```

An asynchronous host call releases its slot while awaiting its result. Other
ready programs can use that same slot. The waiting program retains its PC,
operand stack, procedure frames, variables, and resources in its own in-memory
continuation. A reply or host failure reacquires a slot before continuation;
the host call is not executed again. Instruction quanta also let ready programs
share slots during CPU-bound execution. This is cooperative scheduling within
JavaScript, not OS-thread preemption.

Host calls, filesystem operations, FORTRAN I/O, database reads, service calls,
orchestration waits, and debugger waits participate in suspension. Synchronous
bindings do not suspend. `getStatus()` exposes running/ready/waiting programs,
the parked PC and wait reason, available slots, and suspension/resumption counts.
Admission fails explicitly at `maxContexts`, including programs awaiting replies.
An abort releases the program's slot and managed invocation storage, even if its
host promise never settles; adapters must honor the signal to cancel external
work. Late settlement cannot resume an aborted program.

Pass the same `scheduler` to `createPascalishServiceHost`,
`createJsPmachineNodeServer`, or `runSingleMessageForEvolution(args, { scheduler })`
to share slots across hosted and file executions. Hosted scheduling is opt-in:
without a scheduler, services keep their existing serial event execution and
wall-clock timeout. With a scheduler, invocations may interleave at asynchronous
bindings, and `maxExecutionMs` limits slot-occupied execution time, excluding
waiting/ready time. Shared-state bindings must tolerate that interleaving.
Instruction limits remain unchanged. The runtime cannot interrupt a synchronous
host adapter; it checks the active-time budget when control returns.

SCREEN COBOL requesters use a shared scheduler by default. Their host can supply
one explicitly to share its execution slots with other kinds of programs.

The proof uses the existing QueueManager broker in one child process and a
separate responder process that delays its reply for **30,000 ms**. A compiled
SCREEN COBOL requester sends the query, releases the sole slot, and resumes
without re-sending. A different compiled COBOL program completes on that same
slot before the reply arrives:

```powershell
node --test testing\pmachines\virtual-scheduler.test.mjs testing\pmachines\virtual-broker-delay.test.mjs
```

### FFS persistence is a subsequent phase

Current swap-out is **in memory only**: it frees an execution slot, not the
retained program's V8 memory, and does not survive interpreter restart.
Promises and closure-based continuations are not serializable FFS checkpoints.
Persistent swap-out requires an explicit, versioned execution-state format for
program identity, PC, operand/call stacks, variables, managed values, resource
ownership, and the pending broker receive/correlation ID. Recovery must restore
that state and wait for the existing query's reply, never replay the send.
Durable broker reply retention and checkpoint/acknowledgment ordering are also
required; the current test deliberately uses isolated, nonpersistent queues.
## Library-owned message conversion

The interpreter dispatches message opcodes to `libraries/swift/messages.mjs`
and `libraries/messages/mapping.mjs`. FIN parsing, conversion rules, namespace
selection, XML rendering and PACS batch splitting are not interpreter logic.
COBOL edited/display masks and scientific presentation are supplied by
`libraries/formatting/presentation.mjs`; canonical decimal serialization remains
a runtime primitive.

For an unpackaged source checkout, restore the XML dependency declared by
`libraries/swift/package.json` with `npm install --prefix libraries/swift`
from the ESP32 directory. Packaged Pulse extensions declare this dependency and
copy the library import closure into their portable runtime.