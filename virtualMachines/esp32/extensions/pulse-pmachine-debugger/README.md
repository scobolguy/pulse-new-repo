# Pulse PMachine Debugger

This VS Code extension provides native Run and Debug support for Pulse PMachine programs.

## Services in Explorer

Expand **Pulse Services** in the VS Code Explorer sidebar to browse the
Aggregator `/api/services` directory, including configured offerings, runtime
instances, and named Pascalish services registered on discovered PMachine nodes
and configured discovery collectors. When a service has multiple instances,
expand its service group to see each instance as a distinct leaf, identified by
node/endpoint and instance ID. A single instance is shown directly as a leaf.
Tooltips show the endpoint, provider, protocol, status, and configuration reference.
**Pulse Servers** separately lists hosting machines and infrastructure such as
RabbitMQ, MSMQ, and MSSQL; these do not appear under Services.
Registered does not mean healthy;
unreachable node registries are shown explicitly rather than silently omitted.
Use the refresh button to reload the directory, and **Open Endpoint** to open a
configured HTTP/HTTPS endpoint in your browser. The view uses
`pulse-pmachine.backendUrl` and refreshes when that setting changes. Request
failures are reported in the view, a notification, and the `Pulse PMachine` output.

## Run from the editor

Open a Pascalish, VBish, WFL, or MAPL source file and select **Run on PMachine** above the source or from the editor title bar. Choose the local JavaScript PMachine, a discovered JavaScript PMachine (for example, `magic-js-pmachine-01`), or a discovered ESP32 PMachine; output appears in the `Pulse PMachine` Output channel. Discovered JavaScript targets run through the Aggregator deployment API using their node ID; their registry addresses are not device API endpoints. Configured direct host:port JavaScript nodes and ESP32 boards use the shared `runPcodeOnEsp32` runner in `aggregator/scripts/run-pascal-on-esp32-node.mjs` to upload compiled pcode and its signed program map via `/ffs/upload`, then run via `/pmachine/execute_file`. The local JavaScript option runs in-process. Set `pulse-pmachine.backendUrl` if the Aggregator is not running at `http://127.0.0.1:4000`.

JavaScript PMachine targets are kept separate from ESP32 upload targets in the picker. To run on the Hanoi board, choose the target whose description contains `192.168.2.115`. Run-to-completion ESP32 uploads omit the editor-only source map to reduce device memory usage; interactive debugging retains source mapping.

The initial configuration debugs `src/towers-of-hanoi-program.pas` on the JavaScript PMachine and stops at the top-level program entry (`begin`, line 18) before executing it. Use the standard VS Code Continue, Step Over, Step In, Step Out, Pause, Stop, Call Stack, and Variables controls.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code and signed program map to `192.168.2.115` through `debugApiUrl: http://127.0.0.1:4000`, and starts a persistent on-device debug session at the program entry. The firmware loads procedure signatures from that map so recursive parameters appear correctly in Locals. Source breakpoints can be added or removed while paused. Step In enters calls; Step Over stays at the current call depth; Step Out returns to the caller. Program output is forwarded to the Debug Console without duplication. The Call Stack view currently shows the active source location, not every historical frame.

Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel or Playwright is needed. Build the `esp32_pmachine` firmware and upload it to the board's actual USB port (COM7 for this board), without uploading a filesystem image. Keep only PulseAggregator running for backend discovery, and restart it after changing backend debugger code. After installing an updated extension package, run **Developer: Reload Window** to load the new adapter. Run-to-completion ESP32 launch configurations remain separate from interactive debug sessions.

## Debugger regression tests

From this extension directory, run `npm run compile` followed by `node --test test/debugger.test.mjs`. Tests cover three legal five-disk Hanoi executions (802 instructions each), JS source entry and recursive locals, source stepping, signed map transport, remote breakpoint edits, DAP error responses, and the editor's shared remote runner export, host/port transport, input validation, and HTTP failures. To include the live board test through the backend API in PowerShell, set `$env:PMACHINE_TEST_HOST = '192.168.2.115'` before running the tests. The live test creates and deletes its own debug session.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.

Local JavaScript source breakpoints stop before a statement executes. Breakpoints on blank lines or non-executable keywords relocate to the next mapped statement in that source file; the adapter reports the resolved line to VS Code. Lines beyond the last mapped statement are unverified. Editing or clearing source breakpoints replaces the previous set for that file. A breakpoint on a procedure call stops in the caller; Step In enters the procedure and exposes its parameters in Locals.
