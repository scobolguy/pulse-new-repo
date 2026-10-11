# Generated Artifacts

This boundary holds reproducible local outputs, such as packages, reports, and
build products. Do not commit these outputs unless deliberately promoted to
reviewed golden fixtures.

Compiled program output belongs in `object/` by default, configurable with
`PULSE_PROGRAM_OBJECT_ROOT`. Editable program sources belong in `src/`,
configurable with `PULSE_PROGRAM_SOURCE_ROOT`. Operational state belongs in
`runtime/` or the configured external runtime data roots.
