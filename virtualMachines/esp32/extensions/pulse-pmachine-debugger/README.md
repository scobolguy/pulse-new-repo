# Pulse Studio & PMachine Debugger

This single VS Code extension packages Pulse Studio, Data Librarian, Data Mapper,
Deploy, Node Inventory, and native Run and Debug support for PMachine programs.
Install one `pulse-pmachine-debugger` VSIX to get these panels and commands.

## Language editors (0.1.19)

Use **Pulse: New Language Document** in the Command Palette to choose a starter
with the correct language mode, then save it with the listed extension. Existing
source files are recognized automatically. Every mode includes syntax coloring,
comment/bracket configuration and appropriate string handling; MNF also retains
its fixed-form column layout.

| Language | Files | Editor/execution |
| --- | --- | --- |
| Pascal / Pascalish | `.pas`, `.pash`, `.flow.pas`, `.service.pas`, `.program.pas`, `.daemon.pas` | Text editor, compile/run and source debugging |
| COBOLish 85 | `.cob`, `.cobol` | Fixed/free-form highlighting, compile/run and source debugging |
| VBish | `.bas`, `.vb`, `.vbs` | Text editor, compile/run and source debugging |
| C# subset | `.cs` | Text editor, generic static methods, JS-only compile/run and source debugging |
| Fortranish (Minnesota FORTRAN) | `.ftn` | Fixed-form editor, compile/run and source debugging |
| WFL | `.wfl` | Text editor and existing workflow/deployment designers |
| MAPL | `.mapl` | Text editor and existing Data Mapper designer; mapping compilation |
| VFL | `.vfl` | JSON text coloring and existing visual graph editor |
| P-code | `.pcode` | Instruction coloring; native hosted-service debugging with a matching map |
| Assemblerish | `.asmish` | Hardware-handler editor and dedicated compile command; explicit HAL deployment |

These are Pulse language editors, not full language servers. Syntax coloring
does not mean every highlighted construct is supported by a compiler. This
release does not add Roslyn/IntelliSense, automatic completion, full C#/VB.NET
compatibility, or new runtime targets. C# targets JavaScript only; generic
classes and collections remain unsupported. MAPL/VFL are mapping/graph
documents, not scalar console programs; do not assume source-level mapping
debugger support. Raw p-code starter text can be run through the JS CLI, but
native F5 requires the hosted-service artifact/map described below.

If another extension also owns `.cs`, `.vb` or `.pas`, select the desired mode
from VS Code's language picker. Existing VFL/MAPL custom editors remain intact;
use **Reopen Editor With... > Text Editor** for source text.

File associations route `.pas` to **Pascalish**, `.ftn` to **Fortranish** and
`.cob`/`.cobol` to **COBOLish**. Fortranish uses the existing MNF FORTRAN compiler.
The older `pascal` and `mnf` language IDs remain supported for saved settings.

The VSIX includes the language compilers, generated parsers, runtime libraries
and JavaScript p-machine. Open any project folder (or a saved source file), then
use **Run on PMachine** or **Debug on PMachine**. No Pulse repository checkout,
Node.js installation or project-local npm install is needed for these commands.
When working in a Pulse checkout, its compiler/runtime is still preferred.
Network librarian/mapper panels still need their separately managed backend.

The bundled runtime also includes the hosted-service API and bounded COBOL text
bindings. COBOLish server callers can compile with `hostServices: true` and
`nativeTarget: true`, then run the same artifact on a granted JS service host or
deploy it to ESP32. See the [native COBOLish guide](../../../../languages/cobolish85/README.md#native-cobolish-server-code)
for typed host calls, integer/frame limits and JSON replies. This is a hosted
server API, not an automatic database grant or a new console Run/F5 path.

### Assemblerish hardware handlers

Use **Pulse: New Language Document > Assemblerish Hardware Handler**, then
**Pulse: Compile Assemblerish Handler**. The compiler is included in the VSIX;
it writes ordinary p-code plus a `.map.json` sidecar. Compilation does not
install a routine or grant ownership of any pin.
The bundled runtime also includes the Assemblerish CLI, mock HAL, tutorial and
examples under `out/runtime/languages/assemblerish`.

Assemblerish is not a console program: generic Run/F5 is not its deployment
path. Use the [HAL tutorial](../../../../languages/assemblerish/HAL-TUTORIAL.md)
for JS mock-HAL execution, signed ESP32 deployment with explicit pin grants,
and pushbutton, toggle-switch, relay/PWM and DHT11 examples.

For C# validation and the precise subset, see the
[compiler guide](../../../../languages/csharp/README.md) and
[original validation suite](../../../../languages/csharp/validation/README.md).
No C#/MNF hardware certification is implied by desktop editor tests.

### Build, package and install

From this extension directory:

```powershell
npm ci
npm test
npm run test:package
```

The package command builds TypeScript, copies the Studio assets and compiler/runtime
dependency closure, includes production npm dependencies, and creates
`pulse-pmachine-debugger-0.1.23.vsix`. In VS Code, run
**Extensions: Install from VSIX...**, select that file, then
**Developer: Reload Window**. Packaging does not publish or install it.

Editor tests use the real TextMate/Oniguruma tokenizer, compile executable
starters and run them on the JS p-machine. They also check repository-root
resolution and C# generic source stepping through the VS Code debug adapter.
Local JS source breakpoints cover each distinct generated code block for a
statement, including COBOL statements emitted in both a routine and the main body.
`test:package` also builds and extracts the actual VSIX into a temporary directory
outside the checkout. It checks bundled compilers/libraries, JS execution,
debugging and signed direct-node upload/execution against a mock HTTP node.
It does not certify physical ESP32 hardware.

## Minnesota FORTRAN

`.ftn` files use the Fortranish mode, with fixed-form column rulers (5, 6, 72, 80),
syntax highlighting, space indentation and no automatic wrapping/indentation.
Use **Run on PMachine** or a `pulse-pmachine` debug launch with the `.ftn` file.
The compiler preserves the scalar/DO/PRINT starter subset and automatically
selects an experimental FORTRAN 77 backend for extended programs (arrays,
DATA, subprograms, IF, formatted output). Extended programs currently require
the **JavaScript PMachine**: ESP32/native Run and Debug are rejected explicitly.
Starter programs retain their existing shared-opcode ESP32 path. See the
[MNF guide](../../../../languages/mnf/README.md) for supported syntax and limits.
Compilation uses the bundled compiler (or the workspace checkout when present),
and execution uses the shared p-machine rather than a separate FORTRAN interpreter.

The JS backend also handles complex/double-precision arithmetic, ENTRY and
procedure arguments, formatted/list-directed READ, internal files and
sequential/direct files. All 180 supplied FCVS programs match their reference
output on JS; that is not ESP32 certification. Local file storage is confined to
`.pulse-debug/fortran-data` beside the source. Set `pulse-pmachine.fortranInput`
(newline-separated records) or `pulse-pmachine.fortranInputFile` (relative to
the source) for console input. Debug configurations can override these with
`stdin`, `fortranInputFile`, and `fortranDataDirectory`.

### Connecting by IP address

**Run on PMachine** and **Debug on PMachine** always use the active VS Code
text-editor tab, captured when the command is clicked. They save unsaved edits
before compiling; cancelling or failing to save prevents launch. They ignore
inactive file arguments and do not fall back to a sample program. With no active
source editor, they show a message and launch nothing. Explicit F5 launch
configurations with an explicit program still debug that configured program.

Use **Pulse PMachine: Select Default Node** to choose local JavaScript, a
discovered node, **Enter IP address...** for an ESP32, or **Enter JavaScript node
IP address...** for a remote JS runtime (include its HTTP port). Run and Debug
share this default. It persists across window reloads until you select another
node or run **Pulse PMachine: Reset Default Node**. With no saved default, the
next Run or Debug prompts for one; cancelling launches nothing. A saved direct
address or local JS target does not contact the aggregator.

Choose **Enter IP address...** to connect directly to an
ESP32 that is not listed by aggregator discovery. Enter an IPv4 address such as
`192.168.2.90`, optionally with an HTTP port (`192.168.2.90:80`). Discovered
targets remain in the selection picker; no hardcoded hosts are added. If
discovery is unavailable, a warning explains that local and direct IP selection
still work.

The workspace Run and Debug list contains **Debug Active File on Default
PMachine** instead of the sample Hanoi and PlatformIO entries. This entry and
the dynamic active-file entry use the saved node, compile the active file and
start an interactive debug session. With no active source editor, they show a
message and do not start a program. Raw `.pcode` files retain their native
interpreter path. Direct debugging
still requires the board's debug-session API and available file storage; entering
an IP does not remove those firmware requirements.
Remote FFS counts as available storage; no local SD card is required.
The same bundled compilers produce p-code for local JS, remote JS and ESP32
targets. Direct-IP Run uploads the program and map to the node; no local
Aggregator is needed. The node must run compatible Pulse firmware/runtime and
support the program's instructions and host capabilities. Desktop tests do not
certify every language feature on hardware. Local COBOL data is stored under
the project's `.pulse-debug/cobol-data`, not inside the installed extension.
After updating the extension, run **Developer: Reload Window** to load the new
command implementation.

## Data Librarian in Explorer

Run **Pulse Data Librarian: Browse Schemas** from the Command Palette, or expand
**Pulse Data Librarian** in the Explorer sidebar. The dedicated view lists the
Librarian catalog from `pulse-pmachine.backendUrl`; select a schema or field group
to expand it and lazy-load its fields and nested groups. Use the item's context
menu to open the schema's full metadata and structure as a JSON snapshot. Editing
or saving that snapshot does not update the Librarian catalog.

Use the view's refresh button after catalog changes. Backend URL changes and
granting workspace trust also refresh the view. Untrusted workspaces do not
contact the backend. Empty catalogs and schemas without field structures are
shown explicitly; connection or catalog failures appear in the view, a
notification, and the `Pulse PMachine` output channel.

This panel is included in extension version **0.1.13**. After installing the
updated VSIX, run **Developer: Reload Window**. If hidden, use **View: Open View**
and select **Pulse Data Librarian**.

The extension is a network client only: it does not start the Aggregator,
Data Librarian, or Data Mapper when the extension activates or workspace trust
is granted. Manage those services separately and configure
`pulse-pmachine.backendUrl` for the Aggregator. If it is unavailable, the views
report the connection error instead of trying a separate local Librarian.

## Pulse Studio panels

**Data Librarian (ESP32)** appears immediately below **Data Librarian** in Pulse
Studio. Expand `pulse-librarian-s3-readonly` to browse its read-only schema
directory, including all pages and nested directories. Listing requests are
sent through `pulse-pmachine.backendUrl` to the Aggregator's logical-service
transaction route; the client polls the returned transaction status for up to
30 seconds and reports the tracking ID if the transaction remains pending.
Refresh reloads the listing. Clicking a file opens its metadata as a JSON
snapshot. Files are not expandable in the read-only profile, and this view does
not request field parsing from a desktop Librarian.
The ESP32 profile itself does not expose schema contents or field structures.
Use the item's context menu to open its metadata snapshot. Network access
requires workspace trust.

Version **0.1.18** includes aggregator-only ESP32 catalog routing. After installing
the updated VSIX, run **Developer: Reload Window**. The board must run firmware
with `host.service_submit` and have the Pascalish read-only service installed
with an explicit owner, report target and Filesystem binding. Board health alone
does not establish Librarian readiness.

The **Pulse Studio** activity-bar container includes Data Librarian, Data Mapper,
Infrastructure, Deploy, and Node Inventory views, plus the VFL editor and
**Pulse: Open Pulse Studio** command. The native PMachine Data Librarian and
Data Mapper views remain available in Explorer alongside the Studio views.

Deploy can validate and preview WFL deployment declarations. Choosing Deploy
opens the separate WFL editor; its confirmed **Deploy to Backend JS** action
builds referenced VFL source and submits workers to the backend-local supervisor.
It does not install code on remote JS nodes or ESP32s. Node Inventory separates
registered services from observed hosted contexts and provides distinct,
confirmed actions for unregistering a service and stopping a hosted context.

Deploy also includes **Deploy Network Cache to local JS PMachine**. In a trusted
ESP32 project workspace, select it to start a managed VS Code task that creates
a local JS PMachine on `4111`, installs signed cache service contexts with the
Kasa, Tuya and SSDP daemons on `4309`, `4307` and `4308`, and serves the native
aggregation API on `4310`. It also installs the Pulse node discovery service and
daemon on the primary context, listening on shared UDP `4210`. The Aggregator
must use a shared discovery socket too; restart older running backends before
installing this collector. It uses `config/federated-device-cache.json` for LAN
interface and peer settings. Existing listeners/collector contexts are not
replaced. The task terminal reports readiness or errors; keep it running to keep
the deployment alive. A fresh process requires redeployment. Cache source
coverage is reported independently; successful installation is not evidence
that every device was discovered.

## Separate VFL visual and WFL deployment editors

Use **Pulse: New Visual Flow Document** to create a `.vfl` graph,
or open an existing `.vfl` with **Pulse: Open in Flow Designer**. This custom
editor runs entirely inside a VS Code editor tab; it does not need a browser
or the frontend/Vite server. Its left **Palette** starts with **Process**:
drag the rectangular symbol onto the canvas (or choose **Add Node**), move
the box, and use **Link** followed by another node to connect them.
Visual edits share the underlying document's Save and Undo/Redo.
Process boxes use the existing executable `service` kind; assign a source
file before building or deploying them. Existing catalog objects remain
in a separate section below the component palette.

Select a node
and use **Executable Node** to assign its source file, kind and queue symbols.
Pascalish, executable MAPL and WFL workflow sources compile to per-node pcode;
message-broker links become real queue bindings and support fan-out.
**Create WFL Deployment** creates a separate `.wfl` referencing that graph.

Use **Pulse: Open WFL Deployment Editor** to edit deployment source, choose an
environment/defines, open linked graphs, validate, preview, build or submit a
confirmed backend-JS deployment. Preview writes nothing. Build saves artifacts
under `.pulse-build`. The deployment path currently runs on the backend PC;
remote placement/installation and whole-graph debugging are not implemented.
Unsupported transports/steps report errors instead of running as no-ops.

The optional embedded WFL Flow Designer remains available for existing files.
See section 3.2.3, “Executable VFL graphs and separate WFL deployment editor,”
in the Pascalish/WFL/MAPL/P-Code design spec, and the `src/visual-flow-example`
folder for runnable source examples.

Build and package all features together from this extension folder with
`npm run package`; the resulting VSIX is the single installable extension.

## Data Mapper designer

The Data Mapper designer edits MAPL (`*.mapl`) source directly; MAPL is the only
local map format. Opening a `.mapl` file shows the visual designer, and
**Open MAPL text** opens the same document as text beside it. Both views edit
one VS Code document, so they stay synchronized and share Undo/Redo and Save.
A MAPL file holds exactly one `map ... end;` declaration (see
`documentation/compilers/MAPL-BNF.md`).

Run **Pulse Data Mapper: Create Prototype MAPL Map** from the Command Palette and
choose a new `*.mapl` file; the designer opens with sample payment fields. Drag a
source field onto a target field to connect them, or select a source and click a
target (also usable with keyboard Tab and Enter). Select a connection to edit
its conversion rule or remove it, then use **Apply rule**.

Each connection is a top-level MAPL assignment:

```text
target.transfer.id := source.reference;
target.'first name' := source.'given name' using 'output := trim(src);';
```

Visual edits are applied as small text splices: comments, formatting, unknown
directives and statements the designer does not model (conditions, loops,
defaults, function calls, validations) keep their original text. Those
statements are listed under **Other MAPL statements** and are edited in the
MAPL text. New connections are inserted just before the closing `end;`.

To start from real schemas, run **Pulse Data Mapper: Create MAPL Map**, then use
**Map details** to set its ID (header name) and `@name`. **Choose source schema**
and **Choose target schema** load the Librarian catalog through
`pulse-pmachine.backendUrl` (default `http://127.0.0.1:4000`) and record the
choice as `@sourceSchema` / `@targetSchema` directives plus the header type IDs.
Librarian and Mapper requests are sent to their logical service IDs through the
Aggregator transaction API; held work is polled for up to 30 seconds and
uncertain work is reported rather than replayed.
Field structures are not stored in the file: the designer loads them from the
Librarian when the map opens or a schema is chosen. Offline, or for schemas that
cannot be loaded, the field lists are inferred from the paths used in the MAPL
rules and the schema label says so. Switching schemas asks before clearing
connections. **Refresh selected schemas** reloads both structures.

**Pulse Data Mapper: Import from Aggregator as MAPL** (also on the designer
toolbar) lists backend maps and writes the chosen map to a new `.mapl` file. It
never overwrites an existing file. **Publish to Aggregator** confirms the
destination and whether it will create or replace a backend map; the MAPL file
remains the source of truth and is not rewritten by publishing. Publication does
not deploy to a PMachine. Existing backend maps are reread after confirmation
to detect intervening edits; the backend API has no atomic conditional write.

The **Test mapping** panel accepts a sample JSON object, or a backend test case
if the sample input is blank. Test cases use the Aggregator's schema-generated
sample data, not the stored test case's actual message. Run executes the exact
published map through `/api/mapper/maps/:id/run` and displays its output and
diagnostics. Local changes must be published first; running never publishes
implicitly. Document or input changes mark previous output stale.

Backend actions require a trusted workspace, have bounded HTTP timeouts, and
report failures in the designer and `Pulse PMachine` output channel. Invalid
MAPL is reported and disables visual editing until it is repaired in the text.

Conversion rules support basic local validation (maximum 1000 characters,
balanced delimiters, and assignment/function/keyword presence). Full execution
validation is performed by the Aggregator's Pascalish routine interpreter.
Unlike types require an explicit conversion routine. Branch-to-leaf links and
duplicate links are rejected.

Build with `npm run compile`, package with `npm run package`, install the VSIX
using **Extensions: Install from VSIX**, then run **Developer: Reload Window**.
Run `node --test test/maplDocument.test.mjs test/dataMapper.test.mjs test/dataMapperBackend.test.mjs`
after compiling for MAPL parsing/splicing (checked against the ANTLR compiler),
model, designer and HTTP regression tests. To exercise real publish/update/run
APIs in PowerShell, set `$env:PULSE_MAPPER_TEST_URL = 'http://127.0.0.1:4000'`
before that test command. The live test creates a uniquely named temporary map
and deletes it afterward.

## Services in Explorer

Expand **Pulse Services** in the VS Code Explorer sidebar to browse the
Aggregator `/api/services` directory, including configured offerings, runtime
instances, and named Pascalish services registered on discovered PMachine nodes
and configured discovery collectors. The directory includes **Pulse Data Librarian**
and **Pulse Data Mapper** from the service registry. After updating the gateway,
restart it and refresh the view to load the directory route. When a service has multiple instances,
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

Open a Pascalish, COBOLish, VBish, C#, MNF, WFL, or MAPL source file and select **Run on PMachine** above the source or from the editor title bar. Choose the local JavaScript PMachine, a discovered JavaScript PMachine (for example, `magic-js-pmachine-01`), or a discovered ESP32 PMachine; output appears in the `Pulse PMachine` Output channel. Discovered JavaScript targets run through the Aggregator deployment API using their node ID; their registry addresses are not device API endpoints. Configured direct host:port JavaScript nodes and ESP32 boards use the shared `runPcodeOnEsp32` runner in `aggregator/scripts/run-pascal-on-esp32-node.mjs` to upload compiled pcode and its signed program map via `/ffs/upload`, then run via `/pmachine/execute_file`. The local JavaScript option runs in-process. Set `pulse-pmachine.backendUrl` if the Aggregator is not running at `http://127.0.0.1:4000`.

JavaScript PMachine targets are kept separate from ESP32 upload targets in the picker. To run on the Hanoi board, choose the target whose description contains `192.168.2.115`. Run-to-completion ESP32 uploads omit the editor-only source map to reduce device memory usage; interactive debugging retains source mapping.

## Debug compiled P-code with the native C++ PMachine

Open a native-target hosted-service `.pcode` file and press **F5**, choose
**Debug native P-code file**, or run **Pulse: Run on PMachine**. The first debug
launch builds the C++ interpreter into `.pulse-build/native-pmachine`; CMake and
a working Windows C++ toolchain must be installed. Set
`pulse-pmachine.nativeInterpreterPath` to an existing executable to use a
prebuilt interpreter instead.

The matching program map is required. By default, `service.pcode` loads
`service.program.json` beside it; set `programMap` in `launch.json` to select a
different map. The map must declare the `native` target and a hosted HTTP
service. The debug request uses the first declared endpoint; `requestMethod`,
`requestPath`, and `requestBody` can override it. The interpreter supports only
its documented native opcode and host-binding subset and rejects incompatible
artifacts explicitly.

The standard VS Code Debug view supports P-code instruction breakpoints,
Continue, Step In/Over/Out, current and caller frames, Globals, Locals, and
simple variable-name evaluation. P-code line numbers are physical lines in the
`.pcode` file. A host binding executes atomically, and Pause while execution is
running is not available; use a breakpoint or Stop. This mode runs one service
request in the interpreter and does not start a long-lived HTTP server.

The initial configuration debugs `src/towers-of-hanoi-program.pas` on the JavaScript PMachine and stops at the top-level program entry (`begin`, line 18) before executing it. Use the standard VS Code Continue, Step Over, Step In, Step Out, Pause, Stop, Call Stack, and Variables controls.

Local `.cob` and `.cobol` debug sessions compile as Tandem COBOL-85, recognize numbered fixed-format cards automatically, and honor `cobolSourceFormat: "fixed"` or `"free"` when detection is not suitable. Local COBOL sessions provide the desktop text, date and intrinsic host functions plus filesystem-backed ISAM storage. By default, file assignments under the COBOL `data` grant persist in `.pulse-debug/cobol-data`; set `cobolDataDirectory` to choose another directory. Breakpoints map to source statements, and COBOL numeric variables display using their PICTURE width and scale.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code and signed program map to `192.168.2.115` through `debugApiUrl: http://127.0.0.1:4000`, and starts a persistent on-device debug session at the program entry. The firmware loads procedure signatures from that map so recursive parameters appear correctly in Locals. Source breakpoints can be added or removed while paused. Step In enters calls; Step Over stays at the current call depth; Step Out returns to the caller. Program output is forwarded to the Debug Console without duplication. The Call Stack view currently shows the active source location, not every historical frame.

Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel or Playwright is needed. Build the `esp32_pmachine` firmware and upload it to the board's actual USB port (COM7 for this board), without uploading a filesystem image. Keep only PulseAggregator running for backend discovery, and restart it after changing backend debugger code. After installing an updated extension package, run **Developer: Reload Window** to load the new adapter. Run-to-completion ESP32 launch configurations remain separate from interactive debug sessions.

## Debugger regression tests

From this extension directory, run `npm run compile` followed by `node --test test/debugger.test.mjs`. The workspace test `node --test testing/pmachines/native-service-host.test.mjs` builds the Windows C++ host and verifies Node/native HTTP parity plus P-code breakpoints, stepping, local values, and request completion. Extension tests cover three legal five-disk Hanoi executions (802 instructions each), JS source entry and recursive locals, fixed-format COBOL stepping, host calls and sequential-file storage, source stepping, signed map transport, remote breakpoint edits, DAP error responses, and the editor's shared remote runner export, host/port transport, input validation, and HTTP failures. To include the live board test through the backend API in PowerShell, set `$env:PMACHINE_TEST_HOST = '192.168.2.115'` before running the tests. The live test creates and deletes its own debug session.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.

Local JavaScript source breakpoints stop before a statement executes. Breakpoints on blank lines or non-executable keywords relocate to the next mapped statement in that source file; the adapter reports the resolved line to VS Code. Lines beyond the last mapped statement are unverified. Editing or clearing source breakpoints replaces the previous set for that file. A breakpoint on a procedure call stops in the caller; Step In enters the procedure and exposes its parameters in Locals.
# SCREEN COBOL requesters

The `.scob` language mode provides SCREEN COBOL highlighting, a starter, and
**Pulse: Compile SCREEN COBOL Requester**. The formal parser and compiler are
bundled with the extension. Requesters use the Pathway screen/server-class
host, rather than ordinary console Run/Debug. See the repository's
[Pathway demo](../../pathway/README.md) for running the browser screen and
COBOLish server replicas independently of the aggregator.
