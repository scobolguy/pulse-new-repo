# Ollama -> Copilot Mentor Loop for Pascal

This workflow makes Ollama the first solver for Pascal program requests and uses Copilot only as an escalation path.

## What is automatic

1. Request goes to Ollama first.
2. Ollama generates a Pascal program using:
   - Pascal `.pas` examples
   - the ANTLR grammar corpus
   - accepted few-shot examples in `data/pascal-ollama-goldens.json`
3. The generated program is validated with the standard Pascal ANTLR compiler.
4. If validation passes before the timeout, Ollama is considered to have solved the request.

## What is escalated

If Ollama:
- returns invalid Pascal
- fails with an error
- exceeds the configured timeout, default `30000 ms`

then the mentor loop writes an escalation packet for Copilot/manual resolution.

## Hard boundary

This repository does not have a native runtime API for GitHub Copilot. That means the Copilot step cannot be fully automatic from Node alone.

What is implemented instead:
- automatic escalation packet generation
- manual/editor-side Copilot answer creation
- automatic ingestion of the accepted answer back into Ollama's few-shot dataset

This is the practical version of `Copilot teaches Ollama` in the current environment.

## Commands

Build Pascal corpus:

```bash
npm run dsl:ollama:build-corpus
```

Run Ollama-first mentor loop:

```bash
node scripts/run-ollama-pascal-mentor-loop.mjs --prompt "Write a Pascal program that prints numbers 1 to 5"
```

Faster mode options:

```bash
node scripts/run-ollama-pascal-mentor-loop.mjs --prompt "Write a Pascal program that prints numbers 1 to 5" --top-k 2 --max-context-chars 2500 --num-predict 220 --no-repair
```

Possible results:
- `status: ok` means Ollama solved it
- `status: needs-copilot` means an escalation packet was created

Ingest accepted Copilot/manual answer:

```bash
node scripts/ingest-pascal-mentor-answer.mjs --packet data/ollama-copilot-escalations/<session>.packet.json --answer data/my-final-answer.pas
```

## Files

- `data/dsl-ollama-corpus.json`
  Pascal corpus and grammar chunks used for retrieval.
- `data/pascal-ollama-goldens.json`
  Accepted few-shot examples that improve future Ollama generations.
- `data/ollama-mentor-sessions/<sessionId>.json`
  Session record. Contains `status`, `prompt`, `coachMode`, `topK`, `maxContextChars`, `numPredict`, `elapsedMs`, `reason`, and `escalationPacketPath` when escalated.
- `data/ollama-mentor-candidates/<sessionId>.pas`
  Raw Pascal candidate output from Ollama for the session, even if invalid or partial. Written when the candidate can be captured before timeout.
- `data/ollama-mentor-results/<sessionId>.result.json`
  Detailed result including validation output, error list, repair flag, and the candidate text. Includes `coachMode`, corpus/golden counts used, and `numPredict`.
- `data/ollama-copilot-escalations/<sessionId>.packet.json`
  Escalation packet written when `status: needs-copilot`. Contains all parameters needed to reproduce the session, the `candidatePath`, and instructions for the human resolver.

## Session and Escalation Fields

### Session file (`ollama-mentor-sessions/`)

```json
{
  "sessionId": "mentor-2026-07-22T15-16-33-209Z",
  "status": "needs-copilot",
  "createdAt": "...",
  "elapsedMs": 30014,
  "prompt": "What is the factorial of 5?",
  "generationPrompt": "...",
  "followUpPrompt": null,
  "hasDeploymentStage": false,
  "coachMode": "pascalish-service",
  "topK": 2,
  "maxContextChars": 2500,
  "numPredict": 320,
  "noRepair": false,
  "escalationPacketPath": "data/ollama-copilot-escalations/<sessionId>.packet.json",
  "coachResult": null,
  "reason": "timeout"
}
```

`reason` values: `timeout`, `invalid-pascal`, `error`.

### Result file (`ollama-mentor-results/`)

```json
{
  "status": "error",
  "model": "phi3:latest",
  "coachMode": "pascalish-service",
  "simplePrompt": true,
  "corpusChunksUsed": 2,
  "goldenExamplesUsed": 1,
  "numPredict": 220,
  "noRepair": false,
  "repaired": true,
  "validation": {
    "valid": false,
    "dialect": null,
    "errors": ["pascalish-service: [PASCALISH-PROGRAM] Parse failed: ..."]
  },
  "outputPath": "aggregator/data/ollama-mentor-candidates/<sessionId>.pas",
  "candidate": "<raw pascal source>"
}
```

### Escalation packet (`ollama-copilot-escalations/`)

```json
{
  "sessionId": "...",
  "status": "needs-copilot",
  "reason": "timeout",
  "prompt": "...",
  "model": "phi3:latest",
  "candidatePath": "data/ollama-mentor-candidates/<sessionId>.pas",
  "candidateCaptured": true,
  "candidateBytes": 0,
  "instructions": [
    "Solve the Pascal program request using the prompt and any partial candidate.",
    "Return only final Pascal source code.",
    "Save the answer to a file and ingest it with scripts/ingest-pascal-mentor-answer.mjs."
  ]
}
```

`candidateBytes: 0` means the candidate file is present but the timeout fired before Ollama finished writing output.

## How this teaches Ollama

Ollama is not being weight-trained here.
It is being taught by improving the prompt context it receives every run.

Each accepted Copilot answer becomes a new few-shot example. Over time:
- retrieval improves
- the example set improves
- Ollama requires fewer escalations for similar Pascal tasks

## Speed defaults

The current defaults are tuned for faster feedback:
- `timeoutMs`: `30000`
- `topK`: `2`
- `maxContextChars`: `2500`
- `numPredict`: `320`

For simple prompts, the coach automatically uses an even smaller fast path:
- fewer corpus chunks
- one golden example when possible
- lower prediction cap

Mixed prompts such as `write a Pascal program ... and deploy it on a pmachine` are split so only the Pascal generation part is sent to Ollama.

## Coach modes

- `pascalish-service` — default; targets Pascalish service syntax
- Additional modes are selected automatically based on prompt content

## If you want full automation later

To make the Copilot step fully automatic, you would need an external bridge service that can:
- receive escalation packets
- call a Copilot-capable API or editor agent
- return the solved Pascal source
- call the ingest script automatically

The current setup is ready for that bridge, but does not assume one exists.
