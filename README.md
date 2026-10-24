# pulse-new-repo

This repository contains code and resources for the Pulse project, including DSL definitions, deployment scripts, and ESP32 firmware using PlatformIO.

## Languages

Canonical compiler sources live under [`languages`](languages):

- [Pascalish](languages/pascalish)
- [COBOLish 85](languages/cobolish85)
- [MNF FORTRAN](languages/mnf)
- [VBish](languages/vbish)
- [C#](languages/csharp) (ECMA-334-based subset, generic static methods, JS target)
- [MAPL](languages/mapl)
- [WFL](languages/wfl)

Each language directory documents its setup and tests. Existing compiler
entrypoints under `virtualMachines/esp32/aggregator/scripts` remain compatible.
Shared application services and deployment integration stay in the aggregator.

VBish and C# share a [System library contract](languages/dotnet).
The original [C# validation suite](languages/csharp/validation) records supported
checks separately from unsupported features; it is not ECMA certification.

## VS Code

The combined [Pulse Studio & PMachine Debugger extension](virtualMachines/esp32/extensions/pulse-pmachine-debugger)
provides text language modes for all of the languages above, VFL visual-flow
documents and p-code, plus the existing mapper/librarian/deployment panels.
Use **Pulse: New Language Document** to choose a starter. See the extension
guide for build, package and VSIX installation instructions.
