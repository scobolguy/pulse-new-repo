# Program Object Output

Pascalish/DSL sources live in `../src/`. Generated program output belongs here:

- `pcode/`: compiler p-code, program maps, router rules, and mapping artifacts;
- `aggregator-pcode/`: Aggregator compiler/test output;
- `projects/`: generated gateway packages and deployment metadata.

Outputs are ignored by Git and may be regenerated. From `../aggregator/`, run
`npm run compile:pascal:wirth` or `npm run test:pascalish:wirth` to compile the
Hanoi source into this layout. Deployment scripts compile sources from `src/`
and upload their generated outputs; remote FFS filenames remain unchanged.

Source-side configuration and sample input payloads belong with the source.
Runtime and operator state remain outside this directory.