# WFL

Canonical home of Pulse's workflow and deployment language.

- `src/`: frontend, DSL compiler, p-code compiler and workflow interpreter.
- `grammar/WorkflowDsl.g4`: active source grammar.
- `grammar/WFL.g4`: older deployment-only grammar retained for reference.
- `grammar/generated/`: checked-in JavaScript parser for the active grammar.
- `examples/`: workflow sources.
- `tests/`: configuration and service-call regressions.
- `docs/workflow-dsl.md`: language and deployment guide.
- `scripts/`: parser generation.

From this directory:

```powershell
npm ci
npm test
npm run antlr:generate
npm run compile -- --in examples\routing.wfl --symbols-out symbols.json --workflow-out workflows.json --artifact-out workflow.json
npm run compile:pcode -- --in examples\routing.wfl --workflow route-payments --out routing.pcode --out-map routing.program.json
npm run interpret -- --in examples\routing.wfl --workflow route-payments --dry-run
```

Parser regeneration requires Java and the existing ANTLR 4.13.2 jar under
`virtualMachines/esp32/aggregator/tools` at the repository root.

Backend service registration, deployment manifests, generic-system contracts,
hosted deployment policy and VFL deployment integration remain in the aggregator.
Consequently this is a repository-local package, not an independent distribution.
Application-level integration tests remain in the aggregator.

Legacy aggregator imports and CLI entrypoints forward here, including the workflow
interpreter. CLI inputs, output paths and runtime data defaults remain relative to
the caller's working directory. Pass explicit paths outside the aggregator.
No workflow or deployment behavior was intentionally changed.
