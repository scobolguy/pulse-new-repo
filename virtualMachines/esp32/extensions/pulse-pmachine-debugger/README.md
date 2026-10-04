# Pulse PMachine Debugger

This VS Code extension provides native Run and Debug support for Pulse PMachine programs.

## Run from the editor

Open a Pascalish, VBish, WFL, or MAPL source file and select **Run on PMachine** above the source or from the editor title bar. Choose the local JavaScript PMachine, a discovered JavaScript PMachine (for example, `magic-js-pmachine-01`), or a discovered ESP32 PMachine; output appears in the `Pulse PMachine` Output channel. The editor sends compiled pcode, its program map, and the selected node ID to the Aggregator deployment API. JavaScript PMachine nodes are virtual targets executed by the Aggregator's JavaScript runtime, not independently addressable ESP32 boards. Set `pulse-pmachine.backendUrl` if the Aggregator is not running at `http://127.0.0.1:4000`.

JavaScript PMachine targets are kept separate from ESP32 upload targets in the picker. To run on the Hanoi board, choose the target whose description contains `192.168.2.115`. Run-to-completion ESP32 uploads omit the editor-only source map to reduce device memory usage; interactive debugging retains source mapping.

The initial configuration debugs `artifactPrograms/towers-of-hanoi-program.pas` on the JavaScript PMachine and stops at the top-level program entry (`begin`, line 18) before executing it. Use the standard VS Code Continue, Step Over, Step In, Step Out, Pause, Stop, Call Stack, and Variables controls.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code and signed program map to `192.168.2.115` through `debugApiUrl: http://127.0.0.1:4000`, and starts a persistent on-device debug session at the program entry. The firmware loads procedure signatures from that map so recursive parameters appear correctly in Locals. Source breakpoints can be added or removed while paused. Step In enters calls; Step Over stays at the current call depth; Step Out returns to the caller. Program output is forwarded to the Debug Console without duplication. The Call Stack view currently shows the active source location, not every historical frame.

Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel or Playwright is needed. Build the `esp32_pmachine` firmware and upload it to the board's actual USB port (COM7 for this board), without uploading a filesystem image. Keep only PulseAggregator running for backend discovery, and restart it after changing backend debugger code. After installing an updated extension package, run **Developer: Reload Window** to load the new adapter. Run-to-completion ESP32 launch configurations remain separate from interactive debug sessions.

## Debugger regression tests

From this extension directory, run `npm run compile` followed by `node --test test/debugger.test.mjs`. Tests cover three legal five-disk Hanoi executions (802 instructions each), JS source entry and recursive locals, source stepping, signed map transport, remote breakpoint edits, and DAP error responses. To include the live board test through the backend API in PowerShell, set `$env:PMACHINE_TEST_HOST = '192.168.2.115'` before running the tests. The live test creates and deletes its own debug session.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.
