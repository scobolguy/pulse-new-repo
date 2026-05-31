# Pascalish Language Server (LSP)

This server provides:

- Syntax diagnostics via ANTLR parser
- Keyword completions for Pascalish router/mapper DSL

## Run

```powershell
npm run lsp:pascalish
```

## VS Code Client Wiring

Use any LSP client that launches `node tools/pascalish-lsp/server.mjs` over stdio.

For a VS Code extension client, configure:

- command: `node`
- args: `tools/pascalish-lsp/server.mjs`
- document selector: Pascalish DSL files (for example `.dsl`, `.pascalish`)

## Regenerate Parsers

```powershell
npm run antlr:generate
```

This requires `tools/antlr-4.13.2-complete.jar`.

## Next Steps for WYSIWYG Editor

- Add semantic tokens (router, mapper, output, map clauses)
- Add go-to-definition for mapper/router IDs
- Add hover docs for keywords
- Add completion snippets for ROUTER/OUTPUT/MAPPER skeletons
- Add code actions for missing `END;` and malformed clauses
