export const sharedCompilerFiles = [
  '../compile-scalar-to-pcode.mjs', '../scalar-semantics.mjs', '../method-resolution.mjs', '../source-diagnostics.mjs',
  '../scalar-library.mjs', '../scalar-conversions.mjs', '../integer-types.mjs', '../system-library.mjs',
  '../pulse-network-library.mjs', '../libraries/System/library.json', '../libraries/Pulse.Net/library.json',
  '../../../virtualMachines/esp32/pmachines/shared/pcode-library-linker.mjs',
  '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs'
].map(file => new URL(file, import.meta.url));
