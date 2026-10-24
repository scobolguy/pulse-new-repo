# Shared VBish / C# library contract

This directory is the common library boundary for Pulse's VBish and C#
frontends. The name describes their source-language family, not a CLR,
Microsoft .NET implementation, or Windows DLL format.

## Current implementation

- [System manifest](libraries/System/library.json): one library ID/version,
  scalar types, Console signatures and JS Int32 intrinsic bindings.
- [System helper](system-library.mjs): signature lookup and checked
  divide/remainder runtime implementations.
- Both compilers emit the same `System` ID/version in `programMap.libraries`.
- C# uses the manifest for Console resolution and lowers arithmetic faults
  through the intrinsic bindings. VBish retains its existing syntax,
  `Print` behavior and compiler lowering; manifest metadata does not imply
  that every C# System signature is callable from VBish today.

Calls are statically resolved into a program's p-code and runtime bindings.
There is no general library linker, shared-object loader, unload operation,
or cross-language public-method ABI yet.

## Integration direction

Keep library identity, exported names, parameter/return types, target support
and versioning language-neutral. Source spelling belongs in each frontend.
Resolve common APIs against that contract, then emit the same p-code/runtime
bindings; do not create separate VBish and C# implementations of each library.

The next integration stages are:

1. Specify a common procedure/export ABI, diagnostics, artifact format and
   library version resolution; test both frontends against identical contracts.
2. Connect **Code Librarian** to versioned source and compiled library artifacts,
   retaining source maps, hashes/signatures, exports and target capabilities.
3. Connect **Data Librarian** to named schema identities and versions. Keep data
   schemas separate from executable-library ownership and deployment metadata.
4. Let **Data Mapper/MAPL** reference those schema identities and explicit
   conversion-library exports. Validate field types and conversion signatures
   before binding or deployment, rather than copying compiler-specific logic.
5. Add static library resolution and end-to-end cross-language contract tests
   before designing dynamic loading.

Later dynamic libraries are **p-machine libraries**, not Windows DLLs. They
will need relocation/import tables, compatibility checks, ownership/lifetime
rules, bounded storage, deployment integrity and equivalent JS/C++/Arduino
behavior. Loading and unloading must not invalidate live call frames or
managed references. This remains a later project, not a feature of this release.
