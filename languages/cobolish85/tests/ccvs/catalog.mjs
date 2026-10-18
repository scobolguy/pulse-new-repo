import { ncCases } from './nucleus.mjs';
import { fileCases } from './files.mjs';
import { sortCases } from './sort.mjs';
import { icCases } from './ic.mjs';
import { smCases } from './sm.mjs';
import { functionCases } from './functions.mjs';
import { segmentationDebugCases } from './segmentation-debug.mjs';
import { reportWriterCases } from './report-writer.mjs';
import { communicationCases } from './communications.mjs';
import { obsoleteCases } from './obsolete.mjs';

// Language modules in the pinned CCVS85 corpus; EXEC, AL and K* are harness/data.
export const ccvsModules = ['NC', 'SQ', 'RL', 'IX', 'ST', 'IC', 'SM', 'IF', 'SG', 'DB', 'RW', 'CM', 'OB'];
export const ccvsCases = [
  ...ncCases, ...fileCases, ...sortCases, ...icCases, ...smCases, ...functionCases,
  ...segmentationDebugCases, ...reportWriterCases, ...communicationCases, ...obsoleteCases
];
export const executableCases = ccvsCases.filter(entry => entry.validation === 'execution');
export const syntaxOnlyCases = ccvsCases.filter(entry => entry.validation === 'syntax');
