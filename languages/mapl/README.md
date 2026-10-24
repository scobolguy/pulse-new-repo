# MAPL

Canonical home of Pulse's mapping language compiler.

- `src/`: ANTLR-to-p-code compiler and authoring helpers.
- `grammar/MAPL.g4`: source grammar; `grammar/generated/`: checked-in JavaScript parser.
- `examples/`: mapping sources.
- `tests/`: compiler regressions.
- `scripts/`: parser generation.

From this directory:

```powershell
npm ci
npm test
npm run antlr:generate
npm run compile -- --in examples\customer.mapl --out customer.pcode --map-out customer.program.json
```

Parser regeneration requires Java and the existing ANTLR 4.13.2 jar under
`virtualMachines/esp32/aggregator/tools` at the repository root.

The mapper API, conversion-rule emitter, signing and diagnostics remain shared
aggregator services. Mapper API and deployment integration tests remain under
`virtualMachines/esp32/aggregator/scripts`. This is a repository-local package,
not a standalone published compiler.

Legacy aggregator compiler imports and CLI invocations forward here. CLI paths
remain relative to the caller's working directory; pass explicit paths when
running outside the aggregator. No mapping semantics changed.
