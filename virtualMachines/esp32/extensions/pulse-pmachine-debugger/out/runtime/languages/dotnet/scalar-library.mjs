import { linkPcodeLibraries } from '../../virtualMachines/esp32/pmachines/shared/pcode-library-linker.mjs';
import { VALUE_TYPES } from './system-library.mjs';

const signatureTypes = new Set([...VALUE_TYPES, 'void']);
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const version = /^\d+\.\d+\.\d+$/;

export function createScalarLibrary(artifact, { id, version: libraryVersion, exports } = {}) {
  if (!identifier.test(id || '') || !version.test(libraryVersion || ''))
    throw new TypeError('Scalar library requires an identifier id and an exact major.minor.patch version');
  if (artifact?.programMap?.abi?.id !== 'pulse.scalar' || artifact.programMap.abi.version !== 1)
    throw new TypeError('Library must implement pulse.scalar ABI version 1');
  if (!Array.isArray(artifact.programMap.targets) || !artifact.programMap.targets.length)
    throw new TypeError('Scalar library requires explicit target capabilities');
  if (artifact.programMap.linkedLibraries?.length)
    throw new TypeError('Scalar ABI v1 does not support re-exporting already linked libraries');
  if (!exports || !Object.keys(exports).length) throw new TypeError('Scalar library requires explicit exports');
  const bindings = {}, members = [];
  for (const [exportName, reference] of Object.entries(exports)) {
    if (!identifier.test(exportName)) throw new TypeError(`Invalid scalar export name '${exportName}'`);
    const matches = Object.entries(artifact.programMap.procedures).filter(([label, procedure]) =>
      label === reference || procedure.name === reference || procedure.signature === reference);
    if (matches.length !== 1) throw new TypeError(`Export '${reference}' must resolve to one concrete procedure; use a signature or label for overloaded methods`);
    const [label, procedure] = matches[0];
    if (!['public', 'internal'].includes(procedure.visibility))
      throw new TypeError(`Export '${reference}' is not an accessible procedure`);
    if (procedure.typeArguments?.length) throw new TypeError('Generic specializations cannot be exported by scalar ABI v1');
    if (!Array.isArray(procedure.parameterTypes) || procedure.parameterTypes.length !== procedure.params.length
      || procedure.parameterTypes.some(type => !VALUE_TYPES.has(type)) || !signatureTypes.has(procedure.returnType))
      throw new TypeError(`Export '${reference}' has no supported scalar signature`);
    const externalLabel = `ABI_${id}_${exportName}`;
    bindings[externalLabel] = label;
    members.push({ name: `${id}.${exportName}`, label: externalLabel,
      parameterTypes: [...procedure.parameterTypes], returnType: procedure.returnType });
  }
  if (artifact.programMap.globals?.length) throw new TypeError('Scalar ABI v1 libraries cannot contain global state');
  return {
    id, version: libraryVersion, abi: { id: 'pulse.scalar', version: 1 }, members,
    exports: bindings, pcodeText: artifact.pcodeText, programMap: structuredClone(artifact.programMap)
  };
}

export function prepareScalarImports(libraries, sourceLanguage, target = 'js') {
  if (!['js', 'esp32'].includes(target)) throw new TypeError(`Unsupported scalar target '${target}'`);
  if (!Array.isArray(libraries)) throw new TypeError('Scalar libraries must be an array');
  const ids = new Set(), names = new Set(), imports = [];
  for (const library of libraries) {
    if (library.abi?.id !== 'pulse.scalar' || library.abi.version !== 1 || !version.test(library.version || ''))
      throw new TypeError('Imported library must declare scalar ABI v1 and an exact version');
    if (ids.has(library.id)) throw new TypeError(`Duplicate scalar library '${library.id}'`);
    ids.add(library.id);
    if (!library.programMap?.targets?.includes(target)) throw new TypeError(`Library '${library.id}' cannot run on target ${target}`);
    if (!Array.isArray(library.members) || !library.members.length) throw new TypeError('Imported library has no typed exports');
    for (const member of library.members) {
      const key = sourceLanguage === 'vbish' ? member.name.toLowerCase() : member.name;
      if (names.has(key)) throw new TypeError(`Ambiguous imported export '${key}'`);
      names.add(key);
      if (!Array.isArray(member.parameterTypes) || member.parameterTypes.some(type => !VALUE_TYPES.has(type))
        || !signatureTypes.has(member.returnType) || !identifier.test(member.label || ''))
        throw new TypeError(`Invalid imported scalar signature '${key}'`);
      const procedure = library.programMap.procedures?.[library.exports?.[member.label]];
      if (!procedure || JSON.stringify(procedure.parameterTypes) !== JSON.stringify(member.parameterTypes)
        || procedure.returnType !== member.returnType)
        throw new TypeError(`Signature mismatch for imported export '${key}'`);
      imports.push({ key, label: member.label, parameterTypes: member.parameterTypes, returnType: member.returnType });
    }
  }
  return imports;
}

export function linkScalarLibraries(artifact, libraries) {
  const linked = linkPcodeLibraries(artifact, libraries);
  if (!libraries.length) return linked;
  linked.programMap.libraryBindings = libraries.map(library => ({ id: library.id, version: library.version, abiVersion: 1 }));
  return linked;
}
