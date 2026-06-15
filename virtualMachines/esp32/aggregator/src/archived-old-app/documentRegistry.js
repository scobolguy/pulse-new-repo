export const PASCALISH_KEYWORDS = [
  'program',
  'daemon',
  'refresh',
  'ms',
  's',
  'm',
  'service',
  'role',
  'code_librarian',
  'library',
  'use',
  'as',
  'interop',
  'wfl',
  'workflow',
  'cobolish',
  'pascalish',
  'router',
  'mapper',
  'input',
  'source',
  'target',
  'description',
  'enabled',
  'begin',
  'end',
  'output',
  'type',
  'types',
  'when',
  'transform',
  'map',
  'to',
  'using',
  'true',
  'false',
  'var',
  'from',
  'librarian',
  'cobegin',
  'coend',
  'subflow',
  'sync',
  'async',
  'wait',
  'on',
  'error',
  'backout',
  'try',
  'catch',
  'endtry'
];

export const COBOLISH_KEYWORDS = [
  'identification',
  'division',
  'program-id',
  'environment',
  'configuration',
  'input-output',
  'data',
  'procedure',
  'working-storage',
  'file',
  'section',
  'fd',
  '01',
  '77',
  '88',
  'pic',
  'picture',
  'value',
  'occurs',
  'redefines',
  'renames',
  'usage',
  'move',
  'set',
  'perform',
  'until',
  'varying',
  'through',
  'thru',
  'call',
  'using',
  'by',
  'reference',
  'content',
  'on',
  'exception',
  'not',
  'size',
  'error',
  'end-call',
  'evaluate',
  'when',
  'other',
  'if',
  'then',
  'else',
  'end-if',
  'display',
  'accept',
  'read',
  'write',
  'open',
  'close',
  'start',
  'delete',
  'goback',
  'stop',
  'run',
  'returning',
  'end-evaluate',
  'end-perform',
  'end-program',
  'end-id',
  'interop',
  'wfl',
  'pascalish'
];

export const WORKFLOW_KEYWORDS = [
  'QUEUE',
  'FILE',
  'API',
  'BASE',
  'WORKFLOW',
  'STEP',
  'CALL',
  'CHECK',
  'EXPECT',
  'RETRIES',
  'EVERY',
  'ROUTE',
  'SET',
  'STATE',
  'WAIT',
  'ISSUE',
  'CREATE',
  'TITLE',
  'DESCRIPTION',
  'PRIORITY',
  'ASSIGN',
  'USER',
  'REPORTER',
  'TYPE',
  'TYPES',
  'INTO',
  'TESTCASE',
  'TESTPLAN',
  'PLAN',
  'LINK',
  'ADD',
  'PROJECT',
  'RELEASE',
  'FOR',
  'DEPLOYMENT',
  'ARTIFACT',
  'LOCATION',
  'PROJECTPLAN',
  'MILESTONE',
  'DUE',
  'DATE',
  'TASK',
  'SYNCHPOINT',
  'DELIVERABLE',
  'RESOURCE',
  'COBEGIN',
  'COEND',
  'SUBFLOW',
  'SYNC',
  'ASYNC',
  'ON',
  'ERROR',
  'BACKOUT',
  'TRY',
  'CATCH',
  'ENDTRY',
  'BEGIN',
  'END',
  'IF',
  'FIELD',
  'EQUALS',
  'CONTAINS',
  'THEN',
  'ELSE',
  'ENDIF',
  'IF',
  'TRUE',
  'FALSE',
  'FROM'
];

export const DOCUMENT_TYPES = [
  {
    id: 'pascalish',
    label: 'Pascalish',
    extension: '.pas',
    editorId: 'pascalish',
    editorLabel: 'Pascalish Editor',
    monacoLanguage: 'pascalish',
    starterContent: [
      'program "new-pascalish-program";',
      'role code_librarian;',
      'library "core-shared" from librarian;',
      'interop wfl "new-workflow" as wf;',
      '',
      'var myLegacyMessage : swift-mt103 from librarian;',
      ''
    ].join('\n')
  },
  {
    id: 'workflow',
    label: 'Workflow',
    extension: '.wfl',
    editorId: 'workflow',
    editorLabel: 'Workflow Editor',
    monacoLanguage: 'workflow-dsl',
    starterContent: [
      'WORKFLOW "new-workflow" BEGIN',
      'END;'
    ].join('\n')
  },
  {
    id: 'cobolish',
    label: 'COBOLISH',
    extension: '.cob',
    editorId: 'cobolish',
    editorLabel: 'COBOLISH Editor',
    monacoLanguage: 'cobolish',
    starterContent: [
      'IDENTIFICATION DIVISION.',
      'PROGRAM-ID. NEW-COBOLISH-PROGRAM.',
      'ENVIRONMENT DIVISION.',
      'CONFIGURATION SECTION.',
      'DATA DIVISION.',
      'WORKING-STORAGE SECTION.',
      '01  CUSTOMER-ID        PIC X(20).',
      '01  CUSTOMER-BALANCE    PIC 9(9)V99.',
      'PROCEDURE DIVISION.',
      '    INTEROP WFL "pain2-routing" AS ROUTING-FLOW.',
      '    INTEROP PASCALISH "router-mapper" AS ROUTER-MAPPER.',
      '    MOVE CUSTOMER-ID TO CUSTOMER-ID.',
      '    DISPLAY "COBOLISH READY".',
      '    GOBACK.',
      'END PROGRAM NEW-COBOLISH-PROGRAM.'
    ].join('\n')
  }
];

const DOCUMENT_TYPE_BY_ID = new Map(DOCUMENT_TYPES.map((item) => [item.id, item]));
const DOCUMENT_TYPE_BY_EXTENSION = new Map(DOCUMENT_TYPES.map((item) => [item.extension, item]));

export function getDocumentTypeById(typeId) {
  return DOCUMENT_TYPE_BY_ID.get(String(typeId || '').trim().toLowerCase()) || null;
}

export function getDocumentTypeByExtension(fileName) {
  const text = String(fileName || '').trim().toLowerCase();
  const dotIndex = text.lastIndexOf('.');
  if (dotIndex < 0) return null;
  return DOCUMENT_TYPE_BY_EXTENSION.get(text.slice(dotIndex)) || null;
}

export function getDocumentTypeByFileName(fileName) {
  return getDocumentTypeByExtension(fileName);
}

export function normalizeDocumentFileName(fileName, typeId) {
  const baseName = String(fileName || '').trim();
  const type = getDocumentTypeById(typeId);
  if (!type) return baseName;
  const normalizedBase = baseName.replace(/[\\/]+/g, '_').trim();
  if (!normalizedBase) return `untitled${type.extension}`;
  if (normalizedBase.toLowerCase().endsWith(type.extension)) return normalizedBase;
  return `${normalizedBase}${type.extension}`;
}

export function createNewDocumentFileName(typeId, existingNames = []) {
  const type = getDocumentTypeById(typeId);
  if (!type) return 'untitled.txt';
  const names = new Set((Array.isArray(existingNames) ? existingNames : []).map((item) => String(item || '').trim().toLowerCase()));
  const stem = `untitled${type.extension}`;
  if (!names.has(stem.toLowerCase())) return stem;

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `untitled-${index}${type.extension}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }

  return `untitled-${Date.now()}${type.extension}`;
}

export function getDocumentTypeLabel(typeId) {
  return getDocumentTypeById(typeId)?.label || String(typeId || 'Document');
}
