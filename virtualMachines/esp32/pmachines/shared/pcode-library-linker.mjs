const EXECUTABLE_LINE = line => line.trim() && !line.trim().startsWith('#') && !line.trim().endsWith(':');

function normalizedIdentifier(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

function resolveProcedure(programMap, reference, libraryId) {
  const procedures = programMap?.procedures || {};
  if (Object.prototype.hasOwnProperty.call(procedures, reference)) return reference;
  const folded = String(reference).toLowerCase();
  const matches = Object.entries(procedures)
    .filter(([, procedure]) => String(procedure.name || '').toLowerCase() === folded)
    .map(([label]) => label);
  if (matches.length !== 1) {
    throw new Error(`[PCODE-LINK] Library ${libraryId} must resolve ${reference} to exactly one procedure`);
  }
  return matches[0];
}

function procedureBlocks(library) {
  const sourceLines = String(library.pcodeText || '').split(/\r?\n/);
  const procedures = library.programMap?.procedures || {};
  const labels = Object.keys(procedures);
  const mainIndex = sourceLines.findIndex(line => line.trim() === 'MAIN:');
  if (mainIndex < 0) throw new Error(`[PCODE-LINK] Library ${library.id} has no MAIN label`);

  const starts = labels.map(label => ({
    label,
    index: sourceLines.findIndex(line => line.trim() === `${label}:`)
  })).filter(item => item.index >= 0 && item.index < mainIndex)
    .sort((left, right) => left.index - right.index);
  return new Map(starts.map((item, index) => [
    item.label,
    sourceLines.slice(item.index, starts[index + 1]?.index ?? mainIndex)
  ]));
}

function resolveExports(library) {
  const result = new Map();
  for (const [externalName, reference] of Object.entries(library.exports || {})) {
    result.set(externalName, resolveProcedure(library.programMap, reference, library.id));
  }
  return result;
}

function collectProcedureClosure(library, requested, rootProcedures) {
  const blocks = procedureBlocks(library);
  const included = new Set();
  const visit = label => {
    if (included.has(label)) return;
    const block = blocks.get(label);
    if (!block) throw new Error(`[PCODE-LINK] Library ${library.id} has no P-code body for ${label}`);
    included.add(label);
    for (const line of block) {
      const call = /^CALL\s+(\S+)(?:\s+\d+)?$/.exec(line.trim());
      if (!call) continue;
      if (Object.prototype.hasOwnProperty.call(library.programMap.procedures, call[1])) visit(call[1]);
      else if (!Object.prototype.hasOwnProperty.call(rootProcedures, call[1])) {
        throw new Error(`[PCODE-LINK] Library ${library.id} calls unresolved procedure ${call[1]}`);
      }
    }
  };
  requested.forEach(visit);
  return { blocks, included };
}

function executableAddressAt(lines, stopIndex) {
  let address = 0;
  for (let index = 0; index < stopIndex; index += 1) {
    if (EXECUTABLE_LINE(lines[index])) address += 1;
  }
  return address;
}

function rewriteInstruction(line, labels, globals, localNames) {
  const trimmed = line.trim();
  const branch = /^(JMP|JZ)\s+(\S+)$/.exec(trimmed);
  if (branch) return `${branch[1]} ${labels.get(branch[2]) || branch[2]}`;

  const call = /^CALL\s+(\S+)(\s+\d+)?$/.exec(trimmed);
  if (call) return `CALL ${labels.get(call[1]) || call[1]}${call[2] || ''}`;

  const variable = /^(LOAD|STORE|LOAD_NAME|STORE_NAME)\s+(\S+)$/.exec(trimmed);
  if (variable && globals.has(variable[2]) && !localNames.has(variable[2])) {
    return `${variable[1]} ${globals.get(variable[2])}`;
  }
  const array = /^(ARR_GET|ARR_SET)\s+(\S+)(\s+\d+)$/.exec(trimmed);
  if (array && globals.has(array[2]) && !localNames.has(array[2])) {
    return `${array[1]} ${globals.get(array[2])}${array[3]}`;
  }
  return line;
}

function countInstructions(pcodeText) {
  return String(pcodeText || '').split(/\r?\n/).filter(EXECUTABLE_LINE).length;
}

function insertInitializers(pcodeText, labels) {
  if (labels.length === 0) return pcodeText;
  const lines = String(pcodeText || '').split(/\r?\n/);
  const mainIndex = lines.findIndex(line => line.trim() === 'MAIN:');
  if (mainIndex < 0) throw new Error('[PCODE-LINK] Root program has no MAIN label');
  lines.splice(mainIndex + 1, 0, ...labels.map(label => `CALL ${label} 0`));
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function mergeVersion(rootMap, libraryMap, key, libraryId) {
  if (libraryMap[key] === undefined) return rootMap[key];
  if (rootMap[key] !== undefined && rootMap[key] !== libraryMap[key]) {
    throw new Error(`[PCODE-LINK] ${libraryId} ${key} ${libraryMap[key]} conflicts with root ${rootMap[key]}`);
  }
  return libraryMap[key];
}

/**
 * Statically links callable P-code procedures into a program.
 *
 * Each library is { id, pcodeText, programMap, exports, initialize? }. Only exported
 * procedures and their CALL dependencies are copied; each library's MAIN is excluded.
 * Libraries with globals must name an exported initializer that initializes them.
 */
export function linkPcodeLibraries(program, libraries = []) {
  if (!program || typeof program.pcodeText !== 'string' || !program.programMap) {
    throw new Error('[PCODE-LINK] Root program requires pcodeText and programMap');
  }
  if (!Array.isArray(libraries) || libraries.length === 0) return program;

  let pcodeText = program.pcodeText;
  const programMap = structuredClone(program.programMap);
  const rootLabelNames = new Set(
    pcodeText.split(/\r?\n/).map(line => line.trim()).filter(line => line.endsWith(':')).map(line => line.slice(0, -1))
  );
  const rootGlobals = new Set(programMap.globals || []);
  const addedProcedures = {};
  const addedGlobals = [];
  const addedSourceMap = {};
  const initializerLabels = [];
  const linkedLabels = new Set();
  const rootCapabilities = new Set(programMap.requiredHostCapabilities || []);
  let targets = new Set(programMap.targets || ['js', 'esp32']);
  let linkedInstructionCount = countInstructions(pcodeText);
  const rootSourceMap = programMap.sourceMap || {};
  const mainAddress = (() => {
    const lines = pcodeText.split(/\r?\n/);
    const index = lines.findIndex(line => line.trim() === 'MAIN:');
    if (index < 0) throw new Error('[PCODE-LINK] Root program has no MAIN label');
    return executableAddressAt(lines, index);
  })();
  const initializationShift = libraries.reduce((count, library) => count + (library.initialize ? 1 : 0), 0);

  for (const library of libraries) {
    const id = String(library.id || '').trim();
    if (!id) throw new Error('[PCODE-LINK] Each library requires an id');
    if (!library.programMap || typeof library.pcodeText !== 'string') {
      throw new Error(`[PCODE-LINK] Library ${id} requires pcodeText and programMap`);
    }
    const prefix = `LIB_${normalizedIdentifier(id)}_`;
    const exports = resolveExports(library);
    const exportedLabels = new Set(exports.values());
    const globals = new Map((library.programMap.globals || []).map(name => [
      name, `${prefix}GLOBAL_${normalizedIdentifier(name)}`
    ]));
    const required = new Set(exportedLabels);
    if ((library.programMap.globals || []).length && !library.initialize) {
      throw new Error(`[PCODE-LINK] Library ${id} has globals and requires an initializer`);
    }
    const initLabel = library.initialize
      ? resolveProcedure(library.programMap, library.initialize, id)
      : null;
    if (initLabel) required.add(initLabel);
    const { blocks, included } = collectProcedureClosure(library, required, programMap.procedures || {});
    const localLabels = new Map();
    for (const label of included) {
      for (const line of blocks.get(label)) {
        const match = /^([A-Za-z_][A-Za-z0-9_]*):$/.exec(line.trim());
        if (match) localLabels.set(match[1], `${prefix}${normalizedIdentifier(match[1])}`);
      }
    }
    for (const label of localLabels.values()) {
      if (rootLabelNames.has(label) || linkedLabels.has(label)) {
        throw new Error(`[PCODE-LINK] Library ${id} label ${label} collides with the root program`);
      }
      linkedLabels.add(label);
    }
    const publicLabels = new Map();
    for (const [externalName, label] of exports) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(externalName)) {
        throw new Error(`[PCODE-LINK] Library ${id} export ${externalName} is not a valid P-code label`);
      }
      if (rootLabelNames.has(externalName) || linkedLabels.has(externalName)) {
        throw new Error(`[PCODE-LINK] Library ${id} export ${externalName} collides with another label`);
      }
      linkedLabels.add(externalName);
      publicLabels.set(externalName, label);
    }

    const snippets = [];
    const libraryLines = String(library.pcodeText).split(/\r?\n/);
    for (const label of included) {
      const procedure = library.programMap.procedures[label];
      const localNames = new Set([...(procedure.params || []), ...(procedure.locals || [])]);
      const snippet = blocks.get(label).map(line => {
        if (line.trim().endsWith(':')) {
          const oldLabel = line.trim().slice(0, -1);
          return `${localLabels.get(oldLabel) || `${prefix}${normalizedIdentifier(oldLabel)}`}:`;
        }
        return rewriteInstruction(line, localLabels, globals, localNames);
      });
      snippets.push(...snippet);
      const linkedLabel = localLabels.get(label);
      addedProcedures[linkedLabel] = { ...procedure, name: procedure.name || label };
    }

    const exportedNames = {};
    for (const [externalName, label] of publicLabels) {
      const procedure = library.programMap.procedures[label];
      const parameters = procedure.params || [];
      snippets.push(`${externalName}:`);
      for (const parameter of parameters) snippets.push(`LOAD ${parameter}`);
      snippets.push(`CALL ${localLabels.get(label)} ${parameters.length}`, 'RET');
      addedProcedures[externalName] = {
        name: externalName, returnType: procedure.returnType || null, params: parameters, locals: []
      };
      exportedNames[externalName] = externalName;
    }
    if (initLabel) initializerLabels.push(localLabels.get(initLabel));
    for (const [, linkedName] of globals) {
      if (rootGlobals.has(linkedName)) throw new Error(`[PCODE-LINK] Namespaced global collision: ${linkedName}`);
      addedGlobals.push(linkedName);
    }
    Object.assign(programMap.procedures, addedProcedures);
    programMap.linkedLibraries = [...(programMap.linkedLibraries || []), {
      id, exports: exportedNames, ...(initLabel ? { initialize: localLabels.get(initLabel) } : {})
    }];

    const baseAddress = linkedInstructionCount;
    let appended = 0;
    const sourceEntries = library.programMap.sourceMap || {};
    for (const label of included) {
      const block = blocks.get(label);
      const start = libraryLines.findIndex(line => line.trim() === `${label}:`);
      let sourceAddress = executableAddressAt(libraryLines, start);
      for (const line of block) {
        if (!EXECUTABLE_LINE(line)) continue;
        const sourceLocation = sourceEntries[String(sourceAddress)];
        if (sourceLocation) addedSourceMap[String(baseAddress + appended)] = sourceLocation;
        sourceAddress += 1;
        appended += 1;
      }
    }
    linkedInstructionCount += countInstructions(snippets.join('\n'));
    pcodeText = `${pcodeText.trimEnd()}\n${snippets.join('\n')}\n`;

    programMap.globals = [...new Set([...(programMap.globals || []), ...addedGlobals])];
    for (const capability of library.programMap.requiredHostCapabilities || []) rootCapabilities.add(capability);
    if (library.programMap.targets) {
      targets = new Set([...targets].filter(target => library.programMap.targets.includes(target)));
      if (targets.size === 0) throw new Error(`[PCODE-LINK] Library ${id} has no compatible target`);
    }
    const serviceVersion = mergeVersion(programMap, library.programMap, 'hostBindingsVersion', id);
    const capabilityVersion = mergeVersion(programMap, library.programMap, 'hostCapabilitiesVersion', id);
    if (serviceVersion !== undefined) programMap.hostBindingsVersion = serviceVersion;
    if (capabilityVersion !== undefined) programMap.hostCapabilitiesVersion = capabilityVersion;
  }

  pcodeText = insertInitializers(pcodeText, initializerLabels);
  const shiftedSourceMap = {};
  for (const [address, location] of Object.entries(rootSourceMap)) {
    const numericAddress = Number(address);
    if (!Number.isSafeInteger(numericAddress)) {
      shiftedSourceMap[address] = location;
      continue;
    }
    shiftedSourceMap[String(numericAddress >= mainAddress ? numericAddress + initializationShift : numericAddress)] = location;
  }
  const shiftedLibrarySourceMap = {};
  for (const [address, location] of Object.entries(addedSourceMap)) {
    shiftedLibrarySourceMap[String(Number(address) + initializationShift)] = location;
  }
  programMap.sourceMap = { ...shiftedSourceMap, ...shiftedLibrarySourceMap };
  if (rootCapabilities.size) programMap.requiredHostCapabilities = [...rootCapabilities].sort();
  if (programMap.targets || libraries.some(library => library.programMap.targets)) {
    programMap.targets = [...targets];
  }
  return { ...program, pcodeText, programMap };
}
