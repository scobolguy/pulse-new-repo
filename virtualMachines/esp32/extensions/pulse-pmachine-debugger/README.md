# Pulse PMachine Debugger

This VS Code extension provides native Run and Debug support for Pulse PMachine programs.

The initial configuration debugs `artifactPrograms/towers-of-hanoi-program.pas` on the JavaScript PMachine and stops at the top-level program entry (`begin`, line 18) before executing it. Use the standard VS Code Continue, Step Over, Step In, Step Out, Pause, Stop, Call Stack, and Variables controls.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code to `192.168.2.155`, and starts a persistent on-device debug session at the program entry. Continue, step over, step in, step out, pause, and stop control the ESP32 runtime; stack and variable views reflect the current device state. Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel is used. Build and flash the `esp32_pmachine` firmware through the `Upload ESP32 PMachine Firmware on COM5` task before using it. The `Run no-router enqueue proof on ESP32 COM5/IP` configuration remains a run-to-completion execution.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.
