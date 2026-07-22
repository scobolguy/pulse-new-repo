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
- `data/ollama-mentor-sessions/`
  Session records.
- `data/ollama-copilot-escalations/`
  Escalation packets for Copilot/manual resolution.

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

## If you want full automation later

To make the Copilot step fully automatic, you would need an external bridge service that can:
- receive escalation packets
- call a Copilot-capable API or editor agent
- return the solved Pascal source
- call the ingest script automatically

The current setup is ready for that bridge, but does not assume one exists.
