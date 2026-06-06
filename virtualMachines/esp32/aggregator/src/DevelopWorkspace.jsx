import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));
import {
  createNewDocumentFileName,
  DOCUMENT_TYPES,
  getDocumentTypeById,
  getDocumentTypeByFileName,
  normalizeDocumentFileName,
  WORKFLOW_KEYWORDS
} from './documentRegistry';
import { initializePascalishLanguage } from './pascalishLanguage';
import DevelopVisualEditor from './DevelopVisualEditor';

const LOCAL_STORAGE_KEY = 'pulse-develop-workspace-documents';
const EDITOR_LINE_HEIGHT = 22;
const MIN_VISIBLE_EDITOR_LINES = 24;
const MIN_EDITOR_HEIGHT = (EDITOR_LINE_HEIGHT * MIN_VISIBLE_EDITOR_LINES) + 28;
const workflowState = {
  initialized: false,
  completionDisposable: null,
  validationDisposable: null,
  modelDisposables: new Map()
};

function buildWorkflowMarkers(monaco, model, typeFieldMapRef) {
  const content = model.getValue();
  const lines = content.split(/\r?\n/);
  const markers = [];

  const knownTypeFields = Array.from(new Set(
    Object.values(typeFieldMapRef.current || {})
      .flatMap((paths) => Array.isArray(paths) ? paths : [])
      .map((pathValue) => String(pathValue || '').trim())
      .filter(Boolean)
  ));

  const stateFields = Array.from(new Set(
    Array.from(content.matchAll(/\bSTEP\s+("[^"]+"|'[^']+')\s+SET\s+STATE\s+("[^"]+"|'[^']+')/gi))
      .map((match) => String(match?.[2] || '').replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  ));

  const knownFields = new Set([...knownTypeFields, ...stateFields]);
  if (knownFields.size === 0) return markers;

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    const ifFieldMatch = line.match(/\bIF\s+FIELD\s+("[^"]+"|'[^']+')/i);
    if (!ifFieldMatch) continue;

    const rawField = String(ifFieldMatch[1] || '');
    const fieldPath = rawField.replace(/^['"]|['"]$/g, '');
    if (!fieldPath || knownFields.has(fieldPath)) continue;

    const start = line.indexOf(rawField);
    const startColumn = start >= 0 ? start + 1 : 1;
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: `Unknown FIELD path '${fieldPath}'.`,
      startLineNumber: index + 1,
      endLineNumber: index + 1,
      startColumn,
      endColumn: startColumn + rawField.length
    });
  }

  return markers;
}

function attachWorkflowValidation(monaco, model, typeFieldMapRef) {
  if (!model || model.getLanguageId() !== 'workflow-dsl') return;
  const key = model.uri.toString();

  const existing = workflowState.modelDisposables.get(key);
  if (existing) {
    existing.dispose();
    workflowState.modelDisposables.delete(key);
  }

  const runValidation = () => {
    const markers = buildWorkflowMarkers(monaco, model, typeFieldMapRef);
    monaco.editor.setModelMarkers(model, 'workflow-dsl-validation', markers);
  };

  runValidation();

  const contentDisposable = model.onDidChangeContent(runValidation);
  const languageDisposable = model.onDidChangeLanguage(() => {
    if (model.getLanguageId() !== 'workflow-dsl') {
      monaco.editor.setModelMarkers(model, 'workflow-dsl-validation', []);
      const active = workflowState.modelDisposables.get(key);
      if (active) {
        active.dispose();
        workflowState.modelDisposables.delete(key);
      }
      return;
    }
    runValidation();
  });

  workflowState.modelDisposables.set(key, {
    dispose() {
      contentDisposable.dispose();
      languageDisposable.dispose();
    }
  });
}

function initializeWorkflowLanguage(monaco, typeFieldMapRef = { current: {} }) {
  if (!workflowState.initialized) {
    monaco.languages.register({ id: 'workflow-dsl' });

    monaco.languages.setMonarchTokensProvider('workflow-dsl', {
      ignoreCase: true,
      keywords: WORKFLOW_KEYWORDS,
      tokenizer: {
        root: [
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
          [/[;,.()]/, 'delimiter']
        ]
      }
    });

    monaco.editor.defineTheme('workflowWorkbench', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '7DD3FC', fontStyle: 'bold' },
        { token: 'string', foreground: 'C4B5FD' },
        { token: 'number', foreground: 'FDE68A' },
        { token: 'identifier', foreground: 'E5E7EB' }
      ],
      colors: {
        'editor.background': '#0f172a',
        'editorLineNumber.foreground': '#64748b',
        'editorCursor.foreground': '#38bdf8'
      }
    });

    workflowState.initialized = true;
  }

  if (workflowState.completionDisposable) {
    workflowState.completionDisposable.dispose();
  }

  workflowState.completionDisposable = monaco.languages.registerCompletionItemProvider('workflow-dsl', {
    triggerCharacters: [' ', ':', '"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const keywordItems = WORKFLOW_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range
      }));

      const content = model.getValue();
      const activeLine = String(model.getLineContent(position.lineNumber) || '');
      const beforeCursor = activeLine.slice(0, Math.max(0, position.column - 1));

      const stateFields = Array.from(new Set(
        Array.from(content.matchAll(/\bSTEP\s+("[^"]+"|'[^']+')\s+SET\s+STATE\s+("[^"]+"|'[^']+')/gi))
          .map((match) => String(match?.[2] || '').replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
      ));

      const knownTypeFields = Array.from(new Set(
        Object.values(typeFieldMapRef.current || {})
          .flatMap((paths) => Array.isArray(paths) ? paths : [])
          .map((pathValue) => String(pathValue || '').trim())
          .filter(Boolean)
      ));

      let fieldCandidates = [];
      if (/\bIF\s+FIELD\s+"[^"]*$/i.test(beforeCursor) || /\bIF\s+FIELD\s+'[^']*$/i.test(beforeCursor)) {
        fieldCandidates = knownTypeFields;
      } else if (/\bSET\s+STATE\s+"[^"]*$/i.test(beforeCursor) || /\bSET\s+STATE\s+'[^']*$/i.test(beforeCursor)) {
        fieldCandidates = Array.from(new Set([...stateFields, ...knownTypeFields]));
      }

      const fieldItems = fieldCandidates.map((fieldPath) => ({
        label: fieldPath,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: fieldPath,
        detail: 'Known field path',
        range
      }));

      const snippetItems = [
        {
          label: 'workflow-skeleton',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'WORKFLOW "${1:workflow-id}" BEGIN',
            '  STEP "${2:step-id}" BEGIN',
            '  END;',
            'END;'
          ].join('\n'),
          detail: 'Workflow skeleton',
          range
        },
        {
          label: 'cobegin-sync',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'COBEGIN SYNC ON ERROR BACKOUT BEGIN',
            '  SUBFLOW "${1:subflow-a}" BEGIN',
            '    ${2:STEP "id" SET STATE "state.key" = "value";}',
            '  END;',
            'COEND;'
          ].join('\n'),
          detail: 'Synchronous COBEGIN block',
          range
        },
        {
          label: 'cobegin-async',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'COBEGIN ASYNC WAIT ${1:5000} ON ERROR BACKOUT BEGIN',
            '  SUBFLOW "${2:subflow-a}" BEGIN',
            '    ${3:STEP "id" WAIT 1000;}',
            '  END;',
            'COEND;'
          ].join('\n'),
          detail: 'Asynchronous COBEGIN block with timeout',
          range
        }
      ];

      return {
        suggestions: [...fieldItems, ...snippetItems, ...keywordItems]
      };
    }
  });

  if (workflowState.validationDisposable) {
    workflowState.validationDisposable.dispose();
  }

  workflowState.validationDisposable = monaco.editor.onDidCreateModel((model) => {
    attachWorkflowValidation(monaco, model, typeFieldMapRef);
  });

  for (const model of monaco.editor.getModels()) {
    attachWorkflowValidation(monaco, model, typeFieldMapRef);
  }
}

function getEditorDescriptor(fileName) {
  return getDocumentTypeByFileName(fileName) || DOCUMENT_TYPES[0];
}

function sanitizeDisplayName(value) {
  return String(value || '').trim().replace(/[\\/]+/g, '_');
}

function buildSeedDocuments() {
  return DOCUMENT_TYPES.map((type) => ({
    name: createNewDocumentFileName(type.id, []),
    documentTypeId: type.id,
    documentTypeLabel: type.label,
    extension: type.extension,
    content: type.starterContent,
    size: String(type.starterContent || '').length,
    modifiedAt: new Date().toISOString()
  }));
}

function loadLocalDocuments() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return buildSeedDocuments();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return buildSeedDocuments();
    return parsed.filter((item) => item && item.name && item.content !== undefined);
  } catch {
    return buildSeedDocuments();
  }
}

function saveLocalDocuments(documents) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(documents));
}

export default function DevelopWorkspace({ createRequest, onCreateRequestHandled, onOpenDebugger }) {
  const [files, setFiles] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [openFileNames, setOpenFileNames] = useState([]);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('Loading develop workspace...');
  const [dirty, setDirty] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageMode, setStorageMode] = useState('remote');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState('text');
  const showExplorer = false;
  const handledCreateRequestKeyRef = useRef('');
  const typeNamesRef = useRef([]);
  const typeFieldMapRef = useRef({});
  const menuPanelStyle = {
    position: 'absolute',
    top: 34,
    left: 0,
    zIndex: 20,
    minWidth: 220,
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: 10,
    background: '#0b1220',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 12px 28px rgba(2, 6, 23, 0.55)'
  };
  const menuItemStyle = {
    textAlign: 'left',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: 8,
    background: '#1e293b',
    color: '#f8fafc',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3
  };

  useEffect(() => {
    let cancelled = false;

    function collectPathsFromSchemaNode(node, prefix = '', out = []) {
      if (!node || typeof node !== 'object') return out;
      const rawName = String(node.name || '').trim();
      const normalizedName = rawName && rawName !== 'root' ? rawName : '';
      const nextPrefix = normalizedName
        ? (prefix ? `${prefix}.${normalizedName}` : normalizedName)
        : prefix;
      if (nextPrefix) out.push(nextPrefix);
      for (const child of Array.isArray(node.children) ? node.children : []) {
        collectPathsFromSchemaNode(child, nextPrefix, out);
      }
      return out;
    }

    function buildTypeFieldMap(schemas) {
      const map = {};
      for (const schema of Array.isArray(schemas) ? schemas : []) {
        const typeId = String(schema?.typeId || '').trim().toLowerCase();
        if (!typeId) continue;
        if (!map[typeId]) map[typeId] = new Set();
        const paths = collectPathsFromSchemaNode(schema?.structure, '');
        for (const fieldPath of paths) {
          if (fieldPath) map[typeId].add(fieldPath);
        }
      }

      const output = {};
      for (const [typeId, values] of Object.entries(map)) {
        output[typeId] = Array.from(values).sort((a, b) => a.localeCompare(b));
      }
      return output;
    }

    async function loadTypeAwareness() {
      try {
        const [typesResponse, schemasResponse] = await Promise.all([
          fetch('/api/librarian/data-types'),
          fetch('/api/librarian/schemas')
        ]);
        const typePayload = await typesResponse.json().catch(() => ({}));
        const schemaPayload = await schemasResponse.json().catch(() => ({}));
        if (cancelled) return;

        const names = Array.isArray(typePayload.types)
          ? typePayload.types
            .map((item) => String(item?.id || item?.name || item?.typeName || '').trim())
            .filter(Boolean)
          : [];
        typeNamesRef.current = names;

        const schemas = schemasResponse.ok && Array.isArray(schemaPayload.schemas) ? schemaPayload.schemas : [];
        typeFieldMapRef.current = buildTypeFieldMap(schemas);
      } catch {
        if (!cancelled) {
          typeNamesRef.current = [];
          typeFieldMapRef.current = {};
        }
      }
    }

    loadTypeAwareness();
    const timer = setInterval(loadTypeAwareness, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const openFiles = useMemo(() => {
    return openFileNames
      .map((name) => files.find((item) => item.name === name))
      .filter(Boolean);
  }, [files, openFileNames]);

  const editorDescriptor = useMemo(() => {
    return getEditorDescriptor(selectedFileName);
  }, [selectedFileName]);
  const supportsVisualEditor = ['pascalish', 'cobolish', 'workflow'].includes(editorDescriptor.id);

  useEffect(() => {
    if (!supportsVisualEditor && editorViewMode !== 'text') {
      setEditorViewMode('text');
    }
  }, [editorViewMode, supportsVisualEditor]);

  function openDocument(fileName) {
    setSelectedFileName(fileName);
    setOpenFileNames((current) => (current.includes(fileName) ? current : [...current, fileName]));
  }

  function closeDocument(fileName) {
    setOpenFileNames((current) => current.filter((item) => item !== fileName));
    setSelectedFileName((currentSelected) => {
      if (currentSelected !== fileName) return currentSelected;
      const remaining = openFileNames.filter((item) => item !== fileName);
      if (remaining.length === 0) {
        setContent('');
        setRenameValue('');
      }
      return remaining[0] || files.find((item) => item.name !== fileName)?.name || '';
    });
  }

  // Stabilize syncOpenSelection so other callbacks can depend on it safely
  const stableSyncOpenSelection = useCallback((nextFiles, preferredFileName = '') => {
    if (preferredFileName && Array.isArray(nextFiles) && nextFiles.some((item) => item.name === preferredFileName)) {
      setSelectedFileName(preferredFileName);
      setOpenFileNames((current) => (current.includes(preferredFileName) ? current : [...current, preferredFileName]));
      return;
    }

    if (!Array.isArray(nextFiles) || nextFiles.length === 0) {
      setSelectedFileName('');
      setOpenFileNames([]);
      setContent('');
      setRenameValue('');
      setDirty(false);
      setError('');
      return;
    }

    setOpenFileNames((current) => {
      const nextOpen = current.filter((name) => nextFiles.some((item) => item.name === name));
      if (nextOpen.length > 0) return nextOpen;
      return [nextFiles[0].name];
    });

    setSelectedFileName((currentSelected) => {
      if (nextFiles.some((item) => item.name === currentSelected)) return currentSelected;
      return nextFiles[0].name;
    });
  }, []);

  const syncOpenSelectionRef = stableSyncOpenSelection;

  const refreshFiles = useCallback(async (preferredFileName = '') => {
    if (storageMode === 'local') {
      const nextFiles = loadLocalDocuments();
      setFiles(nextFiles);
      syncOpenSelectionRef(nextFiles, preferredFileName);
      return;
    }

    const response = await fetch('/api/develop/files');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Failed to load files (${response.status}).`);
    }

    const nextFiles = Array.isArray(payload.files) ? payload.files : [];
    setFiles(nextFiles);
    syncOpenSelectionRef(nextFiles, preferredFileName);
  }, [storageMode, syncOpenSelectionRef]);

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        const response = await fetch('/api/develop/files');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setStatus(`Unable to load files (${response.status}).`);
          setError(payload.error || `Failed to load files (${response.status}).`);
          return;
        }

        const nextFiles = Array.isArray(payload.files) ? payload.files : [];
        setFiles(nextFiles);
        setStorageMode('remote');
        setStatus(`Loaded ${nextFiles.length} document(s).`);
        syncOpenSelectionRef(nextFiles, selectedFileName);
      } catch (fetchError) {
        if (!cancelled) {
          const localDocuments = loadLocalDocuments();
          setFiles(localDocuments);
          setStorageMode('local');
          setStatus('Backend unavailable, using local workspace mode.');
          setError(fetchError.message);
          syncOpenSelectionRef(localDocuments, selectedFileName);
        }
      }
    }

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [selectedFileName, syncOpenSelectionRef]);

  useEffect(() => {
    if (!selectedFileName) {
      return;
    }

    if (storageMode === 'local') {
      const localDocument = files.find((item) => item.name === selectedFileName);
      if (localDocument) {
        const timer = setTimeout(() => {
          setContent(String(localDocument.content ?? ''));
          setRenameValue(selectedFileName);
          setDirty(false);
          setError('');
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    let cancelled = false;

    async function loadDocument() {
      try {
        const response = await fetch(`/api/develop/files/${encodeURIComponent(selectedFileName)}`);
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setError(payload.error || `Failed to load ${selectedFileName}.`);
          return;
        }

        setContent(String(payload.content ?? ''));
        setRenameValue(selectedFileName);
        setDirty(false);
        setError('');
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message);
        }
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [files, selectedFileName, storageMode]);

  useEffect(() => {
    if (!createRequest?.typeId) return;
    const createRequestKey = `${createRequest.typeId}|${createRequest.name || ''}|${createRequest.nonce || ''}`;
    if (handledCreateRequestKeyRef.current === createRequestKey) return;
    handledCreateRequestKeyRef.current = createRequestKey;

    let cancelled = false;

    async function createDocument() {
      setBusy(true);
      try {
        if (storageMode === 'remote') {
          try {
            const response = await fetch('/api/develop/files', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                typeId: createRequest.typeId,
                name: createRequest.name || ''
              })
            });
            const payload = await response.json().catch(() => ({}));
            if (cancelled) return;

            if (!response.ok) {
              throw new Error(payload.error || 'Unable to create document.');
            }

            const newFileName = payload.file?.name || '';
            await refreshFiles(newFileName);
            setStatus(`Created ${newFileName}.`);
            setError('');
          } catch {
            setStorageMode('local');
            const type = getDocumentTypeById(createRequest.typeId) || DOCUMENT_TYPES[0];
            const existingNames = files.map((item) => item.name);
            const requestedName = createRequest.name ? normalizeDocumentFileName(createRequest.name, type.id) : '';
            const newFileName = requestedName || createNewDocumentFileName(type.id, existingNames);
            const nextFiles = [
              ...files,
              {
                name: newFileName,
                documentTypeId: type.id,
                documentTypeLabel: type.label,
                extension: type.extension,
                content: type.starterContent,
                size: String(type.starterContent || '').length,
                modifiedAt: new Date().toISOString()
              }
            ];
            setFiles(nextFiles);
            saveLocalDocuments(nextFiles);
            openDocument(newFileName);
            setContent(type.starterContent);
            setDirty(false);
            setStatus(`Created ${newFileName}.`);
            setError('');
          }
        } else {
          const type = getDocumentTypeById(createRequest.typeId) || DOCUMENT_TYPES[0];
          const existingNames = files.map((item) => item.name);
          const requestedName = createRequest.name ? normalizeDocumentFileName(createRequest.name, type.id) : '';
          const newFileName = requestedName || createNewDocumentFileName(type.id, existingNames);
          const nextFiles = [
            ...files,
            {
              name: newFileName,
              documentTypeId: type.id,
              documentTypeLabel: type.label,
              extension: type.extension,
              content: type.starterContent,
              size: String(type.starterContent || '').length,
              modifiedAt: new Date().toISOString()
            }
          ];
          setFiles(nextFiles);
          saveLocalDocuments(nextFiles);
          openDocument(newFileName);
          setContent(type.starterContent);
          setDirty(false);
          setStatus(`Created ${newFileName}.`);
          setError('');
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          onCreateRequestHandled?.();
        }
      }
    }

    createDocument();
    return () => {
      cancelled = true;
    };
  }, [createRequest, files, onCreateRequestHandled, refreshFiles, storageMode]);

  

  async function saveDocument() {
    if (!selectedFileName) return;
    setBusy(true);
    try {
      if (storageMode === 'local') {
        const nextFiles = files.map((item) => (
          item.name === selectedFileName
            ? {
                ...item,
                content,
                size: String(content || '').length,
                modifiedAt: new Date().toISOString()
              }
            : item
        ));
        setFiles(nextFiles);
        saveLocalDocuments(nextFiles);
        setDirty(false);
        setStatus(`Saved ${selectedFileName}.`);
        return;
      }

      const response = await fetch(`/api/develop/files/${encodeURIComponent(selectedFileName)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Save failed (${response.status}).`);
      }

      setDirty(false);
      setStatus(`Saved ${payload.file?.name || selectedFileName}.`);
      await refreshFiles(payload.file?.name || selectedFileName);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function renameDocument() {
    if (!selectedFileName) return;
    const proposedName = sanitizeDisplayName(renameValue);
    if (!proposedName || proposedName === selectedFileName) return;

    if (storageMode === 'local') {
      const currentDocument = files.find((item) => item.name === selectedFileName);
      const normalizedName = normalizeDocumentFileName(proposedName, currentDocument?.documentTypeId || 'pascalish');
      const nextFiles = files.map((item) => (
        item.name === selectedFileName
          ? { ...item, name: normalizedName, modifiedAt: new Date().toISOString() }
          : item
      ));
      setFiles(nextFiles);
      saveLocalDocuments(nextFiles);
      setSelectedFileName(normalizedName);
      setRenameValue(normalizedName);
      setStatus(`Renamed to ${normalizedName}.`);
      return;
    }

    const response = await fetch(`/api/develop/files/${encodeURIComponent(selectedFileName)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newName: proposedName })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Rename failed (${response.status}).`);
    }

    const nextName = payload.file?.name || proposedName;
    setOpenFileNames((current) => current.map((item) => (item === selectedFileName ? nextName : item)));
    setSelectedFileName(nextName);
    setStatus(`Renamed to ${nextName}.`);
    await refreshFiles(nextName);
  }

  async function deleteDocument() {
    if (!selectedFileName) return;

    if (storageMode === 'local') {
      const remainingFiles = files.filter((item) => item.name !== selectedFileName);
      setFiles(remainingFiles);
      saveLocalDocuments(remainingFiles);
      setOpenFileNames((current) => current.filter((item) => item !== selectedFileName));
      setSelectedFileName(remainingFiles[0]?.name || '');
      setContent('');
      setDirty(false);
      setStatus(`Deleted ${selectedFileName}.`);
      return;
    }

    const response = await fetch(`/api/develop/files/${encodeURIComponent(selectedFileName)}`, {
      method: 'DELETE'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Delete failed (${response.status}).`);
    }

    const remainingFiles = files.filter((item) => item.name !== selectedFileName);
    setFiles(remainingFiles);
    setOpenFileNames((current) => current.filter((item) => item !== selectedFileName));
    setSelectedFileName(remainingFiles[0]?.name || '');
    setContent('');
    setDirty(false);
    setStatus(`Deleted ${selectedFileName}.`);
  }

  async function createNewDocument(typeId) {
    try {
      const response = await fetch('/api/develop/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ typeId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Unable to create ${typeId}.`);
      }

      const nextName = payload.file?.name || createNewDocumentFileName(typeId, files.map((item) => item.name));
      await refreshFiles(nextName);
      setStatus(`Created ${nextName}.`);
    } catch {
      setStorageMode('local');
      const type = getDocumentTypeById(typeId) || DOCUMENT_TYPES[0];
      const existingNames = files.map((item) => item.name);
      const nextName = createNewDocumentFileName(type.id, existingNames);
      const nextFiles = [
        ...files,
        {
          name: nextName,
          documentTypeId: type.id,
          documentTypeLabel: type.label,
          extension: type.extension,
          content: type.starterContent,
          size: String(type.starterContent || '').length,
          modifiedAt: new Date().toISOString()
        }
      ];
      setFiles(nextFiles);
      saveLocalDocuments(nextFiles);
      setSelectedFileName(nextName);
      setContent(type.starterContent);
      setDirty(false);
      setStatus(`Created ${nextName}.`);
    }
  }

  function handleFileOpen(fileName) {
    if (!fileName) return;
    openDocument(fileName);
    setFileMenuOpen(false);
    setShowOpenPicker(false);
  }

  async function runDocumentAction(mode) {
    if (!selectedFileName || !editorDescriptor?.id) return;

    const supportedCompileTypes = new Set(['pascalish', 'cobolish']);
    if (!supportedCompileTypes.has(editorDescriptor.id)) return;

    setRunMenuOpen(false);
    setBusy(true);
    try {
      const response = await fetch('/api/develop/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFileName,
          content,
          mode
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `${editorDescriptor.label || 'Document'} action failed (${response.status}).`);
      }

      const compile = payload.compile || {};
      const baseMessage = editorDescriptor.id === 'cobolish'
        ? `Compiled ${selectedFileName}: ${compile.programId || 'COBOLISH program'} with ${Number(compile.sections || 0)} division(s), ${Number(compile.paragraphs || 0)} paragraph(s), ${Number(compile.dataItems || 0)} data item(s).${Number(compile.syntaxErrors || 0) > 0 ? ` ${Number(compile.syntaxErrors)} syntax warning(s).` : ''}`
        : `Compiled ${selectedFileName}: ${Number(compile.routers || 0)} router(s), ${Number(compile.mappings || 0)} mapping(s).`;
      if (mode === 'compile-run' && editorDescriptor.id === 'pascalish') {
        setStatus(`${baseMessage} Runtime artifacts updated.`);
      } else if (mode === 'compile-debug' && editorDescriptor.id === 'pascalish') {
        setStatus(`${baseMessage} Opening debugger...`);
        onOpenDebugger?.({
          sourceFileName: selectedFileName,
          fsmId: payload?.debug?.fsmId || 'startup-fsm',
          mode
        });
      } else {
        setStatus(editorDescriptor.id === 'cobolish' && (mode === 'compile-run' || mode === 'compile-debug')
          ? `${baseMessage} Artifact refreshed.`
          : baseMessage);
      }
      setError('');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function handleRunShortcut(event) {
      if (!['pascalish', 'cobolish'].includes(editorDescriptor.id) || busy) return;
      if (event.key !== 'F7') return;

      const activeTag = String(document?.activeElement?.tagName || '').toLowerCase();
      const editingTextInput = activeTag === 'input' || activeTag === 'textarea';
      if (editingTextInput) return;

      event.preventDefault();
      if (event.shiftKey) {
        runDocumentAction('compile-debug');
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        runDocumentAction('compile-run');
        return;
      }
      runDocumentAction('compile');
    }

    window.addEventListener('keydown', handleRunShortcut);
    return () => {
      window.removeEventListener('keydown', handleRunShortcut);
    };
  }, [editorDescriptor.id, busy, selectedFileName, content]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: '8px 10px', background: 'rgba(15, 23, 42, 0.62)', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setFileMenuOpen((current) => !current)}>
            File
          </button>
          {fileMenuOpen && (
            <div style={menuPanelStyle}>
              <button
                type="button"
                onClick={() => {
                  createNewDocument('pascalish').catch((errorValue) => setError(errorValue.message));
                  setFileMenuOpen(false);
                }}
                disabled={busy}
                style={menuItemStyle}
              >
                New Pascalish Program
              </button>
              <button
                type="button"
                onClick={() => {
                  createNewDocument('workflow').catch((errorValue) => setError(errorValue.message));
                  setFileMenuOpen(false);
                }}
                disabled={busy}
                style={menuItemStyle}
              >
                New WFL Program
              </button>
              <button
                type="button"
                onClick={() => {
                  createNewDocument('cobolish').catch((errorValue) => setError(errorValue.message));
                  setFileMenuOpen(false);
                }}
                disabled={busy}
                style={menuItemStyle}
              >
                New COBOLISH Program
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOpenPicker(true);
                  setFileMenuOpen(false);
                }}
                style={menuItemStyle}
              >
                Open...
              </button>
              <button
                type="button"
                onClick={() => {
                  saveDocument();
                  setFileMenuOpen(false);
                }}
                disabled={!selectedFileName || !dirty || busy}
                style={menuItemStyle}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  const proposed = prompt('Rename file:', selectedFileName);
                  if (proposed) {
                    setRenameValue(proposed);
                    renameDocument().catch((renameError) => setError(renameError.message));
                  }
                  setFileMenuOpen(false);
                }}
                disabled={!selectedFileName || busy}
                style={menuItemStyle}
              >
                Rename...
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteDocument().catch((deleteError) => setError(deleteError.message));
                  setFileMenuOpen(false);
                }}
                disabled={!selectedFileName || busy}
                style={menuItemStyle}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        {['pascalish', 'cobolish'].includes(editorDescriptor.id) && (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setRunMenuOpen((current) => !current)}>
              Run
            </button>
            {runMenuOpen && (
              <div style={menuPanelStyle}>
                <button
                  type="button"
                  onClick={() => {
                    runDocumentAction('compile');
                  }}
                  disabled={!selectedFileName || busy}
                  style={menuItemStyle}
                >
                  Compile
                </button>
                {editorDescriptor.id === 'pascalish' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        runDocumentAction('compile-run');
                      }}
                      disabled={!selectedFileName || busy}
                      style={menuItemStyle}
                    >
                      Compile and Run
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        runDocumentAction('compile-debug');
                      }}
                      disabled={!selectedFileName || busy}
                      style={menuItemStyle}
                    >
                      Compile and Debug
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Develop Mode | {editorDescriptor.label} editor
        </div>
        {supportsVisualEditor && (
          <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setEditorViewMode('text')}
              style={{
                border: editorViewMode === 'text' ? '1px solid rgba(56, 189, 248, 0.8)' : undefined,
                background: editorViewMode === 'text' ? 'rgba(14, 165, 233, 0.18)' : undefined
              }}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setEditorViewMode('visual')}
              style={{
                border: editorViewMode === 'visual' ? '1px solid rgba(56, 189, 248, 0.8)' : undefined,
                background: editorViewMode === 'visual' ? 'rgba(14, 165, 233, 0.18)' : undefined
              }}
            >
              Visual
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showExplorer ? '300px minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 12, height: '100%' }}>
      {showExplorer && <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 14, padding: 12, background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.58))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.12, textTransform: 'uppercase', opacity: 0.68 }}>Explorer</div>
            <h3 style={{ margin: '4px 0 0' }}>Develop</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{status}</div>
          </div>
          <button onClick={() => refreshFiles(selectedFileName).catch((refreshError) => setError(refreshError.message))} disabled={busy} title="Refresh">
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => createNewDocument('pascalish')} disabled={busy}>New Pascalish Program</button>
          <button onClick={() => createNewDocument('workflow')} disabled={busy}>New WFL Program</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0, paddingRight: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.58 }}>Open Editors</div>
          {openFiles.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.62, padding: '6px 0 10px' }}>No open editors.</div>
          )}
          {openFiles.map((file) => {
            const isActive = file.name === selectedFileName;
            return (
              <button
                key={file.name}
                onClick={() => openDocument(file.name)}
                style={{
                  textAlign: 'left',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.65)' : '1px solid rgba(148, 163, 184, 0.18)',
                  background: isActive ? 'rgba(14, 165, 233, 0.12)' : 'rgba(15, 23, 42, 0.72)',
                  color: 'inherit',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontWeight: 600 }}>{file.name}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>{file.documentTypeLabel}</div>
              </button>
            );
          })}

          <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.58 }}>Workspace Files</div>
          {files.map((file) => {
            const isActive = file.name === selectedFileName;
            return (
              <button
                key={file.name}
                onClick={() => openDocument(file.name)}
                style={{
                  textAlign: 'left',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.65)' : '1px solid rgba(148, 163, 184, 0.18)',
                  background: isActive ? 'rgba(14, 165, 233, 0.12)' : 'rgba(15, 23, 42, 0.58)',
                  color: 'inherit',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontWeight: 600 }}>{file.name}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>{file.documentTypeLabel}</div>
              </button>
            );
          })}
        </div>
      </aside>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, overflowX: 'auto', minHeight: 42, padding: '6px 6px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.16)' }}>
          {openFiles.map((file) => {
            const isActive = file.name === selectedFileName;
            return (
              <button
                key={file.name}
                onClick={() => openDocument(file.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: '12px 12px 0 0',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(148, 163, 184, 0.12)',
                  borderBottom: isActive ? '1px solid rgba(15, 23, 42, 0.92)' : '1px solid rgba(148, 163, 184, 0.12)',
                  background: isActive ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.56)',
                  color: 'inherit',
                  padding: '8px 12px',
                  marginBottom: '-1px'
                }}
              >
                <span style={{ fontWeight: 600 }}>{file.name}</span>
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    closeDocument(file.name);
                  }}
                  style={{ opacity: 0.74, padding: '0 2px' }}
                  aria-label={`Close ${file.name}`}
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: MIN_EDITOR_HEIGHT, border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 14, overflow: 'hidden' }}>
          {supportsVisualEditor && editorViewMode === 'visual' ? (
            <div style={{ height: '100%', minHeight: MIN_EDITOR_HEIGHT, padding: 10 }}>
              <DevelopVisualEditor
                fileName={selectedFileName}
                languageId={editorDescriptor.id}
                sourceText={content}
                onApplyText={(nextSource) => {
                  setContent(String(nextSource || ''));
                  setDirty(true);
                  setStatus(`Updated ${selectedFileName || 'program'} from visual editor.`);
                }}
              />
            </div>
          ) : (
            <React.Suspense fallback={<div style={{ padding: 20 }}>Loading editor…</div>}>
              <MonacoEditor
                height="100%"
                language={editorDescriptor.monacoLanguage}
                theme={editorDescriptor.id === 'workflow' ? 'workflowWorkbench' : 'pascalishWorkbench'}
                value={content}
                beforeMount={(monaco) => {
                  initializePascalishLanguage(monaco, typeNamesRef, typeFieldMapRef);
                  initializeWorkflowLanguage(monaco, typeFieldMapRef);
                }}
                onChange={(value) => {
                  setContent(value || '');
                  setDirty(true);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: EDITOR_LINE_HEIGHT,
                  wordWrap: 'off',
                  smoothScrolling: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  formatOnType: false,
                  automaticLayout: true,
                  padding: { top: 14, bottom: 14 },
                  scrollBeyondLastLine: false,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    alwaysConsumeMouseWheel: false
                  }
                }}
              />
            </React.Suspense>
          )}
        </div>
      </section>
      </div>

      {showOpenPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 25, background: 'rgba(2, 6, 23, 0.62)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 'min(720px, 92vw)', maxHeight: '78vh', overflow: 'auto', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 12, background: '#0f172a', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={{ margin: 0 }}>Open Program</h3>
              <button type="button" onClick={() => setShowOpenPicker(false)}>Close</button>
            </div>
            {files.length === 0 && <div style={{ opacity: 0.78 }}>No programs found.</div>}
            {files.map((file) => (
              <button
                key={`open-picker:${file.name}`}
                type="button"
                onClick={() => handleFileOpen(file.name)}
                style={{ textAlign: 'left', borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.24)', background: 'rgba(15, 23, 42, 0.84)', padding: '10px 12px' }}
              >
                <div style={{ fontWeight: 600 }}>{file.name}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>{file.documentTypeLabel}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
