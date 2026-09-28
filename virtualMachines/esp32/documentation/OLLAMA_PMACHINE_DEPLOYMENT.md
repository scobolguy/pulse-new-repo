# Ollama and Pmachine Deployment

## Purpose

Pulse uses the local Ollama NLI for routine platform operations. Pascalish deployment is an execution-capable operation, so it is exposed as a dedicated tool through the existing local Pulse MCP server rather than relying on free-form language interpretation alone.

No second MCP server is required on this computer.

## Components

- Ollama: local model provider, normally `http://127.0.0.1:11434`.
- Aggregator backend: platform API, normally `http://127.0.0.1:4000`.
- Pulse MCP: existing local MCP service, normally `http://127.0.0.1:4011/mcp`.
- JS pmachine: local execution target.
- ESP32 pmachine: remote execution target reached through the node registry and ESP32 HTTP/FFS APIs.
- API catalog: live route inventory at `GET /api/platform/apis`.

## MCP Tool

The existing `pulse-local` MCP exposes:

`pmachine_deploy_and_run`

The tool accepts:

```json
{
  "source": "program \"towers-of-hanoi\"; ...",
  "sourceFileName": "towers-of-hanoi-program.pas",
  "runtime": "js",
  "targetNodeId": "",
  "inputQueue": "hanoi.n5.api",
  "message": "",
  "debug": false,
  "stepCount": 0,
  "breakAt": [],
  "wflSource": "",
  "wflDeploymentId": "",
  "wflResourceId": ""
}
```

### Runtime rules

- `runtime: "js"`: runs on the local JavaScript pmachine. `targetNodeId` may be omitted.
- `runtime: "esp32"`: requires `targetNodeId`. The source is compiled, signed, uploaded to the selected ESP32, and executed there.
- `debug: true`: creates a JavaScript pmachine debug session. ESP32 debug/stepping remains a later capability and must be reported as a fallback when unavailable.
- `wflSource`: optional WFL text. If present, the selected deployment/resource supplies the effective input queue and output queue metadata.

## Direct HTTP API

The MCP tool calls:

`POST /api/pmachine/deploy-and-run`

The same endpoint can be called by the VS Code extension or another trusted local client. It compiles the Pascalish source and returns the runtime result, stdout, message trace, lifecycle information, and errors.

The existing `POST /api/pmachine/deployments` endpoint remains the persistent deployment-record API. It records desired deployment state and startup manifests; it is separate from the source-based compile/run endpoint.

## API knowledge and grounding

Do not copy the entire API surface into an Ollama prompt. API knowledge changes as routes and discovered nodes change. Use this sequence:

1. Query `GET /api/platform/apis` for the live route catalog.
2. Query `GET /api/platform/apis/summary` for a compact overview.
3. Query `GET /api/platform/providers` for provider actions.
4. Query `GET /api/nodes` before selecting an ESP32 target.
5. Query `GET /api/nodes/:nodeId` when detailed capabilities are needed.
6. Use the dedicated MCP tool for pmachine deployment instead of inventing a raw request.

For hardware control, verify the actual node manifest and firmware source before proposing an endpoint. Do not infer ESP32 routes from generic REST naming.

## Confirmation policy

Ollama may answer read-only questions without confirmation. It must request explicit confirmation before:

- executing source code;
- uploading pcode or program maps to an ESP32;
- changing queues or applying WFL deployment assignments;
- creating, stopping, or restarting persistent deployments;
- changing topology or device state.

A useful confirmation should name the source file, runtime, target node, input queue, debug mode, and whether WFL overrides are enabled.

Example:

> Deploy `towers-of-hanoi-program.pas` to `child1` on the ESP32 pmachine, using queue `hanoi.n5.api`, without WFL reassignment, and execute it now?

## Example requests

- `Run the open Pascalish Hanoi program on the local JS pmachine with input queue hanoi.n5.api.`
- `Deploy towers-of-hanoi-program.pas to ESP32 child1 and execute it with queue hanoi.n5.api.`
- `Start a JS pmachine debug session for the open Pascalish program and step 10 instructions.`
- `Use this WFL deployment to determine the input queue, then run the program on the JS pmachine.`

## VS Code extension integration

The extension should send the active Pascalish editor contents to the MCP tool or the direct deployment API. It should not ask Ollama to reproduce source text or guess node IDs. The visual runner should:

1. read the active document;
2. refresh the node inventory;
3. display only compatible pmachine targets;
4. collect runtime, queue, WFL, and debug choices;
5. require confirmation for execution;
6. call `pmachine_deploy_and_run`;
7. render stdout, debug-session state, and errors.

## Configuration

The MCP service can be pointed at a different backend with:

```powershell
$env:PULSE_PMACHINE_DEPLOY_URL = 'http://127.0.0.1:4000/api/pmachine/deploy-and-run'
```

The Ollama model and profile remain configured in `aggregator/data/nli-config.json` and can be overridden with `NLI_PROFILE`, `OLLAMA_MODEL`, `OLLAMA_HOST`, and `OLLAMA_PORT`.
