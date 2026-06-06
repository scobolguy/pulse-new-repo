import { COBOLISH_KEYWORDS, PASCALISH_KEYWORDS } from './documentRegistry';

let languageInitialized = false;
let completionDisposable = null;
let cobolishCompletionDisposable = null;
let validationDisposable = null;
const validationModelDisposables = new Map();

function normalizeTypeId(value) {
  return String(value || '').trim().replace(/<.*$/, '').toLowerCase();
}

function collectDefinedFieldsByType(sourceText) {
  const byType = new Map();
  const lines = String(sourceText || '').split(/\r?\n/);
  let mapperSourceType = '';
  let mapperTargetType = '';

  const add = (typeId, fieldPath) => {
    const normalizedType = normalizeTypeId(typeId);
    const normalizedPath = String(fieldPath || '').trim();
    if (!normalizedType || !normalizedPath) return;
    if (!byType.has(normalizedType)) byType.set(normalizedType, new Set());
    byType.get(normalizedType).add(normalizedPath);
  };

  for (const line of lines) {
    const mapperMatch = line.match(/\bMAPPER\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*)\s+SOURCE\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)\s+TARGET\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)/i);
    if (mapperMatch) {
      mapperSourceType = String(mapperMatch[2] || '').replace(/^['"]|['"]$/g, '');
      mapperTargetType = String(mapperMatch[3] || '').replace(/^['"]|['"]$/g, '');
      continue;
    }

    if (/^\s*END\s*;\s*$/i.test(line)) {
      mapperSourceType = '';
      mapperTargetType = '';
      continue;
    }

    const mapMatch = line.match(/\bMAP\s+("[^"]+"|'[^']+')\s+TO\s+("[^"]+"|'[^']+')/i);
    if (mapMatch) {
      const sourcePath = String(mapMatch[1] || '').replace(/^['"]|['"]$/g, '');
      const targetPath = String(mapMatch[2] || '').replace(/^['"]|['"]$/g, '');
      add(mapperSourceType, sourcePath);
      add(mapperTargetType, targetPath);
    }
  }

  return byType;
}

function collectDeclaredVariablesByType(sourceText) {
  const variableTypeByName = new Map();
  const lines = String(sourceText || '').split(/\r?\n/);

  for (const line of lines) {
    const varMatch = line.match(/^\s*VAR\s+([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)\b/i);
    if (!varMatch) continue;
    const variableName = String(varMatch[1] || '').trim();
    const rawType = String(varMatch[2] || '').trim();
    const typeName = rawType.replace(/^['"]|['"]$/g, '');
    if (!variableName || !typeName) continue;
    variableTypeByName.set(variableName, normalizeTypeId(typeName));
  }

  return variableTypeByName;
}

function getMemberSuggestions(fieldPaths, rawAccessSuffix) {
  const accessSuffix = String(rawAccessSuffix || '');
  const pathSegments = accessSuffix.split('.');
  const typedSegment = String(pathSegments.pop() || '');
  const baseSegments = pathSegments.filter(Boolean);
  const typedLower = typedSegment.toLowerCase();
  const unique = new Map();

  for (const fieldPath of fieldPaths) {
    const parts = String(fieldPath || '').split('.').filter(Boolean);
    if (parts.length <= baseSegments.length) continue;

    let matchesBase = true;
    for (let index = 0; index < baseSegments.length; index += 1) {
      if (parts[index] !== baseSegments[index]) {
        matchesBase = false;
        break;
      }
    }
    if (!matchesBase) continue;

    const nextSegment = String(parts[baseSegments.length] || '');
    if (!nextSegment) continue;
    if (typedLower && !nextSegment.toLowerCase().startsWith(typedLower)) continue;

    const isLeaf = parts.length === baseSegments.length + 1;
    if (!unique.has(nextSegment)) {
      unique.set(nextSegment, { insertText: isLeaf ? nextSegment : `${nextSegment}.`, isLeaf });
    }
  }

  return Array.from(unique.entries()).map(([segment, meta]) => ({
    segment,
    insertText: meta.insertText,
    isLeaf: meta.isLeaf
  }));
}

function findMapperContext(lines, lineNumber) {
  let mapperSourceType = '';
  let mapperTargetType = '';

  for (let index = 0; index < lineNumber; index += 1) {
    const line = lines[index];
    const mapperMatch = line.match(/\bMAPPER\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*)\s+SOURCE\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)\s+TARGET\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)/i);
    if (mapperMatch) {
      mapperSourceType = String(mapperMatch[2] || '').replace(/^['"]|['"]$/g, '');
      mapperTargetType = String(mapperMatch[3] || '').replace(/^['"]|['"]$/g, '');
      continue;
    }

    if (/^\s*END\s*;\s*$/i.test(line)) {
      mapperSourceType = '';
      mapperTargetType = '';
    }
  }

  return { mapperSourceType, mapperTargetType };
}

function mergeFieldCandidates(typeFieldMapRef, definedByType, typeId) {
  const normalizedType = normalizeTypeId(typeId);
  const known = new Set();

  const fromRef = typeFieldMapRef?.current?.[normalizedType];
  if (Array.isArray(fromRef)) {
    for (const value of fromRef) known.add(String(value));
  }

  const fromDefined = definedByType.get(normalizedType);
  if (fromDefined) {
    for (const value of fromDefined.values()) known.add(String(value));
  }

  return Array.from(known).sort((a, b) => a.localeCompare(b));
}

function buildPascalishMarkers(monaco, model, typeNamesRef, typeFieldMapRef) {
  const text = model.getValue();
  const lines = text.split(/\r?\n/);
  const markers = [];
  const definedByType = collectDefinedFieldsByType(text);

  const knownTypes = new Set(
    (typeNamesRef?.current || []).map((value) => normalizeTypeId(value))
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');

    const varMatch = line.match(/^\s*VAR\s+[A-Za-z_][A-Za-z0-9_-]*\s*:\s*("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)\b/i);
    if (varMatch) {
      const rawType = String(varMatch[1] || '').trim();
      const typeName = rawType.replace(/^['"]|['"]$/g, '');
      const normalizedType = normalizeTypeId(typeName);
      if (normalizedType && knownTypes.size > 0 && !knownTypes.has(normalizedType)) {
        const quotedIndex = line.indexOf(rawType);
        const startColumn = quotedIndex >= 0 ? quotedIndex + 1 : 1;
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `Unknown data type '${typeName}'.`,
          startLineNumber: index + 1,
          endLineNumber: index + 1,
          startColumn,
          endColumn: startColumn + rawType.length
        });
      }
    }
  }

  let mapperSourceType = '';
  let mapperTargetType = '';
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');

    const mapperMatch = line.match(/\bMAPPER\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*)\s+SOURCE\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)\s+TARGET\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*(?:<[^>]+>)?)/i);
    if (mapperMatch) {
      mapperSourceType = String(mapperMatch[2] || '').replace(/^['"]|['"]$/g, '');
      mapperTargetType = String(mapperMatch[3] || '').replace(/^['"]|['"]$/g, '');
      continue;
    }

    if (/^\s*END\s*;\s*$/i.test(line)) {
      mapperSourceType = '';
      mapperTargetType = '';
      continue;
    }

    const mapMatch = line.match(/\bMAP\s+("[^"]+"|'[^']+')\s+TO\s+("[^"]+"|'[^']+')/i);
    if (!mapMatch) continue;

    const sourceRaw = String(mapMatch[1] || '');
    const targetRaw = String(mapMatch[2] || '');
    const sourcePath = sourceRaw.replace(/^['"]|['"]$/g, '');
    const targetPath = targetRaw.replace(/^['"]|['"]$/g, '');

    const knownSourceFields = new Set(mergeFieldCandidates(typeFieldMapRef, definedByType, mapperSourceType));
    const knownTargetFields = new Set(mergeFieldCandidates(typeFieldMapRef, definedByType, mapperTargetType));

    if (knownSourceFields.size > 0 && sourcePath && !knownSourceFields.has(sourcePath)) {
      const sourceStart = line.indexOf(sourceRaw);
      const startColumn = sourceStart >= 0 ? sourceStart + 1 : 1;
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `Unknown source field '${sourcePath}' for type '${mapperSourceType || 'unknown'}'.`,
        startLineNumber: index + 1,
        endLineNumber: index + 1,
        startColumn,
        endColumn: startColumn + sourceRaw.length
      });
    }

    if (knownTargetFields.size > 0 && targetPath && !knownTargetFields.has(targetPath)) {
      const targetStart = line.lastIndexOf(targetRaw);
      const startColumn = targetStart >= 0 ? targetStart + 1 : 1;
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `Unknown target field '${targetPath}' for type '${mapperTargetType || 'unknown'}'.`,
        startLineNumber: index + 1,
        endLineNumber: index + 1,
        startColumn,
        endColumn: startColumn + targetRaw.length
      });
    }
  }

  return markers;
}

function collectCobolishSymbols(sourceText) {
  const symbols = {
    paragraphNames: new Set(),
    programId: '',
    copyBooks: new Set(),
    interopTargets: new Set()
  };

  const lines = String(sourceText || '').split(/\r?\n/);
  for (const line of lines) {
    const programMatch = line.match(/^\s*PROGRAM-ID\.?\s+([A-Za-z0-9_-]+)/i);
    if (programMatch) {
      symbols.programId = String(programMatch[1] || '').trim();
    }

    const paragraphMatch = line.match(/^\s{0,7}([A-Za-z0-9_-]+)\.(?:\s|$)/);
    if (paragraphMatch) {
      const name = String(paragraphMatch[1] || '').trim();
      if (name && !/^(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE|WORKING-STORAGE|FILE|CONFIGURATION|INPUT-OUTPUT)$/i.test(name)) {
        symbols.paragraphNames.add(name);
      }
    }

    const interopMatch = line.match(/\bINTEROP\s+(WFL|PASCALISH|COBOLISH)\s+"([^"]+)"(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_-]*))?/i);
    if (interopMatch) {
      symbols.interopTargets.add(String(interopMatch[2] || '').trim());
      if (interopMatch[3]) symbols.paragraphNames.add(String(interopMatch[3]).trim());
    }

    const copyMatch = line.match(/\bCOPY\s+([A-Za-z0-9_.-]+)/i);
    if (copyMatch) {
      symbols.copyBooks.add(String(copyMatch[1] || '').trim());
    }
  }

  return symbols;
}

function buildCobolishMarkers(monaco, model) {
  const text = model.getValue();
  const lines = text.split(/\r?\n/);
  const markers = [];
  const symbols = collectCobolishSymbols(text);

  let paragraphSeen = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    if (/^\s*PROCEDURE\s+DIVISION\.?/i.test(line)) {
      paragraphSeen = true;
    }

    const identMatch = line.match(/^\s*PROGRAM-ID\.?\s+([A-Za-z0-9_-]+)/i);
    if (identMatch && !symbols.programId) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'PROGRAM-ID should name the COBOLISH program.',
        startLineNumber: index + 1,
        endLineNumber: index + 1,
        startColumn: 1,
        endColumn: line.length + 1
      });
    }

    if (paragraphSeen && /^\s*[A-Z0-9_-]+\.(?:\s|$)/i.test(line)) {
      continue;
    }

    if (/\bINTEROP\s+WFL\b/i.test(line) && !/\bAS\s+[A-Za-z_][A-Za-z0-9_-]*\b/i.test(line)) {
      markers.push({
        severity: monaco.MarkerSeverity.Info,
        message: 'Consider aliasing WFL interop targets with AS to make callbacks explicit.',
        startLineNumber: index + 1,
        endLineNumber: index + 1,
        startColumn: 1,
        endColumn: line.length + 1
      });
    }
  }

  if (!symbols.programId) {
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: 'Missing PROGRAM-ID paragraph.',
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1,
      endColumn: 1
    });
  }

  return markers;
}

function attachCobolishValidation(monaco, model) {
  if (!model || model.getLanguageId() !== 'cobolish') return;

  const key = model.uri.toString();
  const existing = validationModelDisposables.get(key);
  if (existing) {
    existing.dispose();
    validationModelDisposables.delete(key);
  }

  const runValidation = () => {
    const markers = buildCobolishMarkers(monaco, model);
    monaco.editor.setModelMarkers(model, 'cobolish-validation', markers);
  };

  runValidation();

  const contentDisposable = model.onDidChangeContent(runValidation);
  const languageDisposable = model.onDidChangeLanguage(() => {
    if (model.getLanguageId() !== 'cobolish') {
      monaco.editor.setModelMarkers(model, 'cobolish-validation', []);
      const active = validationModelDisposables.get(key);
      if (active) {
        active.dispose();
        validationModelDisposables.delete(key);
      }
      return;
    }

    runValidation();
  });

  validationModelDisposables.set(key, {
    dispose() {
      contentDisposable.dispose();
      languageDisposable.dispose();
    }
  });
}

function attachPascalishValidation(monaco, model, typeNamesRef, typeFieldMapRef) {
  if (!model || model.getLanguageId() !== 'pascalish') return;
  const key = model.uri.toString();

  const existing = validationModelDisposables.get(key);
  if (existing) {
    existing.dispose();
    validationModelDisposables.delete(key);
  }

  const runValidation = () => {
    const markers = buildPascalishMarkers(monaco, model, typeNamesRef, typeFieldMapRef);
    monaco.editor.setModelMarkers(model, 'pascalish-validation', markers);
  };

  runValidation();

  const contentDisposable = model.onDidChangeContent(runValidation);
  const languageDisposable = model.onDidChangeLanguage(() => {
    if (model.getLanguageId() !== 'pascalish') {
      monaco.editor.setModelMarkers(model, 'pascalish-validation', []);
      const active = validationModelDisposables.get(key);
      if (active) {
        active.dispose();
        validationModelDisposables.delete(key);
      }
      return;
    }
    runValidation();
  });

  validationModelDisposables.set(key, {
    dispose() {
      contentDisposable.dispose();
      languageDisposable.dispose();
    }
  });
}

export function initializePascalishLanguage(monaco, typeNamesRef, typeFieldMapRef = { current: {} }) {
  if (!languageInitialized) {
    monaco.languages.register({ id: 'pascalish' });
    monaco.languages.register({ id: 'cobolish' });

    monaco.languages.setMonarchTokensProvider('pascalish', {
      ignoreCase: true,
      keywords: PASCALISH_KEYWORDS,
      tokenizer: {
        root: [
          [/\{[^}]*\}/, 'comment'],
          [/\(\*[\s\S]*?\*\)/, 'comment'],
          [/[A-Za-z_][A-Za-z0-9_-]*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/[0-9]+/, 'number'],
          [/[:=]/, 'operator'],
          [/\|\|/, 'operator'],
          [/[<>]=?/, 'operator'],
          [/<>/, 'operator'],
          [/[;,.()]/, 'delimiter'],
        ]
      }
    });

    monaco.languages.setMonarchTokensProvider('cobolish', {
      ignoreCase: true,
      defaultToken: 'identifier',
      tokenizer: {
        root: [
          [/[0-9]{2}/, 'number'],
          [/\*.*$/, 'comment'],
          [/\*>.*$/, 'comment'],
          [/[A-Za-z][A-Za-z0-9_-]*/i, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/\./, 'delimiter'],
          [/,/, 'delimiter'],
          [/-/, 'operator'],
          [/\(/, 'delimiter'],
          [/\)/, 'delimiter'],
          [/\b[0-9]+(V[0-9]+)?\b/i, 'number']
        ]
      },
      keywords: COBOLISH_KEYWORDS
    });

    monaco.languages.setLanguageConfiguration('pascalish', {
      comments: {
        blockComment: ['(*', '*)']
      },
      autoClosingPairs: [
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '(', close: ')' }
      ]
    });

    monaco.languages.setLanguageConfiguration('cobolish', {
      comments: {
        lineComment: '*',
        blockComment: ['*>', '']
      },
      autoClosingPairs: [
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '(', close: ')' }
      ],
      surroundingPairs: [
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '(', close: ')' }
      ]
    });

    monaco.editor.defineTheme('pascalishWorkbench', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'FFB454', fontStyle: 'bold' },
        { token: 'string', foreground: 'A6E3A1' },
        { token: 'number', foreground: '89DDFF' },
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'identifier', foreground: 'E5E7EB' },
      ],
      colors: {
        'editor.background': '#0b1220',
        'editorLineNumber.foreground': '#4b5563',
        'editorCursor.foreground': '#f59e0b',
      }
    });

    languageInitialized = true;
  }

  if (completionDisposable) {
    completionDisposable.dispose();
  }

  completionDisposable = monaco.languages.registerCompletionItemProvider('pascalish', {
    triggerCharacters: [' ', ':', '"', '.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const typeItems = (typeNamesRef.current || []).map((typeName) => ({
        label: typeName,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: typeName,
        detail: 'Librarian data type',
        documentation: `Data type from Librarian: ${typeName}`,
        range,
      }));

      const text = model.getValue();
      const lines = text.split(/\r?\n/);
      const activeLine = String(lines[position.lineNumber - 1] || '');
      const beforeCursor = activeLine.slice(0, Math.max(0, position.column - 1));
      const definedByType = collectDefinedFieldsByType(text);
      const variableTypeByName = collectDeclaredVariablesByType(text);
      const context = findMapperContext(lines, position.lineNumber);

      const memberAccessMatch = beforeCursor.match(/\b([A-Za-z_][A-Za-z0-9_-]*)\.([A-Za-z0-9_.-]*)$/);
      if (memberAccessMatch) {
        const variableName = String(memberAccessMatch[1] || '').trim();
        const accessSuffix = String(memberAccessMatch[2] || '');
        const variableTypeId = variableTypeByName.get(variableName) || '';
        const fieldPaths = mergeFieldCandidates(typeFieldMapRef, definedByType, variableTypeId);
        const memberSuggestions = getMemberSuggestions(fieldPaths, accessSuffix).map((item) => ({
          label: item.segment,
          kind: item.isLeaf ? monaco.languages.CompletionItemKind.Field : monaco.languages.CompletionItemKind.Module,
          insertText: item.insertText,
          detail: variableTypeId
            ? `${item.isLeaf ? 'Field' : 'Path group'} for ${variableTypeId}`
            : (item.isLeaf ? 'Field path' : 'Path group'),
          range,
        }));

        return {
          suggestions: memberSuggestions
        };
      }

      let fieldTypeId = '';
      if (/\bMAP\s+"[^"]*$/i.test(beforeCursor) || /\bMAP\s+'[^']*$/i.test(beforeCursor)) {
        fieldTypeId = context.mapperSourceType;
      } else if (/\bTO\s+"[^"]*$/i.test(beforeCursor) || /\bTO\s+'[^']*$/i.test(beforeCursor)) {
        fieldTypeId = context.mapperTargetType;
      }

      const fieldItems = mergeFieldCandidates(typeFieldMapRef, definedByType, fieldTypeId).map((fieldPath) => ({
        label: fieldPath,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: fieldPath,
        detail: fieldTypeId ? `Field path for ${fieldTypeId}` : 'Field path',
        range,
      }));

      const keywordItems = PASCALISH_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
      }));

      const snippetItems = [
        {
          label: 'var-from-librarian',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: 'var ${1:myLegacyMessage} : ${2:swift-mt103} from librarian;',
          detail: 'Librarian-aware variable declaration',
          range,
        },
        {
          label: 'router-skeleton',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'router "${1:route-id}" input "${2:queue.in}" description "${3:description}" enabled true begin',
            '  output "${4:queue.out}"',
            '    when "output := 1;"',
            '    transform "output := src;";',
            'end;'
          ].join('\n'),
          detail: 'Router definition skeleton',
          range,
        }
      ];

      return {
        suggestions: [...fieldItems, ...snippetItems, ...typeItems, ...keywordItems]
      };
    }
  });

  if (cobolishCompletionDisposable) {
    cobolishCompletionDisposable.dispose();
  }

  cobolishCompletionDisposable = monaco.languages.registerCompletionItemProvider('cobolish', {
    triggerCharacters: [' ', '.', '-', '"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const activeLine = String(model.getLineContent(position.lineNumber) || '');
      const beforeCursor = activeLine.slice(0, Math.max(0, position.column - 1));
      const symbols = collectCobolishSymbols(model.getValue());

      const sectionSnippets = [
        {
          label: 'program-skeleton',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'IDENTIFICATION DIVISION.',
            'PROGRAM-ID. ${1:NEW-COBOLISH-PROGRAM}.',
            'ENVIRONMENT DIVISION.',
            'DATA DIVISION.',
            'WORKING-STORAGE SECTION.',
            '01  ${2:RECORD-NAME}    PIC X(20) VALUE SPACES.',
            'PROCEDURE DIVISION.',
            '    ${0:GOBACK}.',
            'END PROGRAM ${1:NEW-COBOLISH-PROGRAM}.'
          ].join('\n'),
          detail: 'COBOLISH program skeleton',
          range,
        },
        {
          label: 'interop-wfl',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: 'INTEROP WFL "${1:workflow-id}" AS ${2:workflowAlias}.',
          detail: 'WFL interoperability clause',
          range,
        },
        {
          label: 'interop-pascalish',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: 'INTEROP PASCALISH "${1:pascalish-unit}" AS ${2:pascalishAlias}.',
          detail: 'Pascalish interoperability clause',
          range,
        }
      ];

      const keywordItems = COBOLISH_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword.toUpperCase(),
        range,
      }));

      const paragraphItems = Array.from(symbols.paragraphNames.values()).map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `${name}.`,
        detail: 'Existing COBOLISH paragraph',
        range,
      }));

      const targetItems = Array.from(symbols.interopTargets.values()).map((value) => ({
        label: value,
        kind: monaco.languages.CompletionItemKind.Module,
        insertText: value,
        detail: 'Interop target',
        range,
      }));

      const isProgramHeader = /^\s*PROGRAM-ID\.?/i.test(beforeCursor);
      const isInteropLine = /\bINTEROP\s+(WFL|PASCALISH|COBOLISH)?\s*[^\n]*$/i.test(beforeCursor);

      const suggestions = [
        ...sectionSnippets,
        ...keywordItems,
        ...paragraphItems,
        ...targetItems
      ];

      if (isProgramHeader) {
        suggestions.unshift({
          label: 'program-name',
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: 'NEW-COBOLISH-PROGRAM',
          detail: 'Suggested program id',
          range,
        });
      }

      if (isInteropLine) {
        suggestions.unshift({
          label: 'WFL',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'WFL',
          range,
        }, {
          label: 'PASCALISH',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'PASCALISH',
          range,
        }, {
          label: 'COBOLISH',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'COBOLISH',
          range,
        });
      }

      return { suggestions };
    }
  });

  if (validationDisposable) {
    validationDisposable.dispose();
  }

  validationDisposable = monaco.editor.onDidCreateModel((model) => {
    attachPascalishValidation(monaco, model, typeNamesRef, typeFieldMapRef);
    attachCobolishValidation(monaco, model);
  });

  for (const model of monaco.editor.getModels()) {
    attachPascalishValidation(monaco, model, typeNamesRef, typeFieldMapRef);
    attachCobolishValidation(monaco, model);
  }
}
