import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../../virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';

const compiledLibraries = new Map();

const LIBRARY_SOURCES = {
  core: {
    id: 'CobolRuntimeCore',
    file: new URL('../runtime/cobol-runtime-core.pas', import.meta.url),
    exports: {
      PROC_COBOL_RT_ABS: 'COBOL_RT_ABS',
      PROC_COBOL_RT_MAX_NUMERIC2: 'COBOL_RT_MAX_NUMERIC2',
      PROC_COBOL_RT_MIN_NUMERIC2: 'COBOL_RT_MIN_NUMERIC2'
    },
    hostServices: false
  },
  text: {
    id: 'CobolRuntimeText',
    file: new URL('../runtime/cobol-runtime-text.pas', import.meta.url),
    exports: {
      PROC_COBOL_RT_LENGTH: 'COBOL_RT_LENGTH',
      PROC_COBOL_RT_UPPER: 'COBOL_RT_UPPER',
      PROC_COBOL_RT_LOWER: 'COBOL_RT_LOWER',
      PROC_COBOL_RT_REVERSE: 'COBOL_RT_REVERSE',
      PROC_COBOL_RT_CHAR: 'COBOL_RT_CHAR',
      PROC_COBOL_RT_ORD: 'COBOL_RT_ORD',
      PROC_COBOL_RT_CURRENT_DATE: 'COBOL_RT_CURRENT_DATE',
      PROC_COBOL_RT_MAX_TEXT2: 'COBOL_RT_MAX_TEXT2',
      PROC_COBOL_RT_MIN_TEXT2: 'COBOL_RT_MIN_TEXT2'
    },
    hostServices: true
  },
  math: {
    id: 'CobolRuntimeMath',
    file: new URL('../runtime/cobol-runtime-math.pas', import.meta.url),
    exports: {
      ...Object.fromEntries([
        'ACOS', 'ASIN', 'ATAN', 'COS', 'SIN', 'TAN', 'LOG', 'LOG10', 'SQRT',
        'FACTORIAL', 'INTEGER', 'INTEGER_PART', 'MOD', 'REM', 'MEAN', 'MEDIAN',
        'MIDRANGE', 'RANGE', 'SUM', 'VARIANCE', 'STANDARD_DEVIATION', 'ORD_MAX',
        'ORD_MIN', 'NUMVAL', 'NUMVAL_C', 'INTEGER_OF_DATE', 'DATE_OF_INTEGER',
        'INTEGER_OF_DAY', 'DAY_OF_INTEGER', 'ANNUITY', 'PRESENT_VALUE',
        'NUMVAL_C_WITH_CURRENCY', 'RANDOM', 'RANDOM_SEEDED'
      ].map(name => [`PROC_COBOL_RT_${name}`, `COBOL_RT_${name}`]))
    },
    hostServices: true
  }
};

export function getCobolRuntimeLibrary(name) {
  const definition = LIBRARY_SOURCES[name];
  if (!definition) throw new Error(`[COBOLISH] Unknown runtime library ${name}`);
  if (!compiledLibraries.has(name)) {
    const sourceText = readFileSync(definition.file, 'utf8');
    const compiled = compilePascalishProgramWithAntlr(sourceText, {
      fileName: fileURLToPath(definition.file),
      hostServices: definition.hostServices
    });
    compiledLibraries.set(name, {
      id: definition.id,
      pcodeText: compiled.pcodeText,
      programMap: compiled.programMap,
      exports: definition.exports
    });
  }
  return compiledLibraries.get(name);
}
