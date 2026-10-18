# XSD predigestion

The desktop Data Librarian converts uploaded `.xsd` and `.xml` files with the existing Pascalish XSD parser. It stores the parser's normalized field tree as a versioned JSON artifact so later schema requests can use the converted tree without reparsing the XSD.

Artifacts are stored under `services/librarian/predigested-xsd/`, separately from the schema catalog. Each JSON artifact has this envelope:

```json
{
  "format": "pulse-predigested-xsd",
  "version": 1,
  "schemaPath": "relative/schema.xsd",
  "tree": { "name": "root", "children": [] },
  "dependencies": [
    { "path": "relative/schema.xsd", "hash": "sha256-hex" }
  ]
}
```

Dependency hashes are SHA-256 over UTF-16LE text, matching the parser's file hashing. The Librarian validates every dependency before using an artifact. A changed source or included schema causes a fresh parse and artifact replacement. Uploads are parsed before the target schema is replaced; invalid XSD/XML therefore leaves the previous source and artifact intact. Schema rename and deletion remove the old path's artifact.

Version 1 stores the field tree used by the existing Librarian schema APIs. It is a simplified application model, not a complete standards-level XSD component model or a self-contained representation of every XSD feature. The Pascalish conversion and artifact persistence are desktop-only; ESP32 consumers must not assume they can generate or interpret these artifacts without an explicitly implemented compatible reader.
