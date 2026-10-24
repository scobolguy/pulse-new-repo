# VBish

Canonical home of Pulse's VB-like p-code compiler.

- `src/`: ANTLR frontend and p-code compiler.
- `grammar/Vbish.g4`: source grammar; `grammar/generated/`: checked-in JavaScript parser.
- `examples/`: small source programs.
- `tests/`: compiler metadata and JavaScript p-machine execution regressions.
- `scripts/`: parser generation.

From this directory:

```powershell
npm ci
npm test
npm run antlr:generate
```

Parser regeneration requires Java and the existing ANTLR 4.13.2 jar under
`virtualMachines/esp32/aggregator/tools` at the repository root.

```javascript
import { compileVbishToPcode } from './src/compile-vbish-to-pcode.mjs';
const artifact = compileVbishToPcode(source, { fileName: 'hello.vbs' });
```

The compiler still uses the aggregator's shared source-map helper. Full application
artifact integration remains in `aggregator/scripts/compile-interoperable-language.mjs`;
the JavaScript runtime remains in its current location pending runtime consolidation.
This is a repository-local package, not a standalone published compiler.

Legacy aggregator compiler imports and regression script entrypoints forward here.
No VBish syntax or runtime semantics were changed by this relocation.

The compiler records the same versioned
[System library identity](../dotnet/README.md) as the C# compiler in
`programMap.libraries`. This establishes a shared contract boundary; it does
not add .NET framework compatibility or change existing VBish `Print` semantics.
