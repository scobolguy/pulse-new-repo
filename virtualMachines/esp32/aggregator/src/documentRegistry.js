export const PASCALISH_KEYWORDS = [
  'SERVICE',
  'ROUTER',
  'MAPPER',
  'INPUT',
  'SOURCE',
  'TARGET',
  'DESCRIPTION',
  'ENABLED',
  'BEGIN',
  'END',
  'OUTPUT',
  'TYPE',
  'TYPES',
  'WHEN',
  'TRANSFORM',
  'MAP',
  'TO',
  'USING',
  'TRUE',
  'FALSE',
  'VAR',
  'FROM',
  'LIBRARIAN'
];

export const WORKFLOW_KEYWORDS = [
  'WORKFLOW',
  'STEP',
  'TASK',
  'BEGIN',
  'END',
  'INPUT',
  'OUTPUT',
  'WHEN',
  'TRANSFORM',
  'MAP',
  'TO',
  'USING',
  'IF',
  'THEN',
  'ELSE',
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
      'SERVICE "new-pascalish-service";',
      '',
      'VAR myLegacyMessage : LegacyMT103 FROM Librarian;',
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
