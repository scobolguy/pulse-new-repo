# Testing

Executable tests, test-only harnesses, fixtures, and golden outputs will be consolidated here without changing their current runner technology.

- `aggregator/` for Node.js unit, integration, and end-to-end tests.
- `pmachines/` for JavaScript, Arduino, and cross-runtime conformance checks.
- `hardware/` for opt-in device tests.
- `fixtures/`, `golden/`, and `support/` for reusable test data and helpers.

Tests must write transient output to `runtime/test-results/` or an operating-system temporary directory, never into source directories.

Run `npm run test:aggregator:modules` to verify the existing Aggregator module families and its backend composition seams before or after a migration slice.

Run `npm run test:pmachine:arduino-layout` to verify the current Arduino PMachine source inventory and PlatformIO exclusion contracts before its local-library migration.

The standalone Arduino scheduler and dynamic-library test sources live in `testing/pmachines/`; production PlatformIO profiles continue to exclude their former source filenames until the local-library migration removes those legacy filters.

Run `npm run test:pmachine:javascript` for the offline JavaScript PMachine compatibility, opcode, negative-path, canonical-type, debugger, and deployment-supervisor suite.

Run `npm run test:pmachine:javascript-package` to verify the public JavaScript PMachine package exports.

Run `npm run test:runtime-data-policy` to verify launchers and backend defaults keep operational data outside source-controlled directories.