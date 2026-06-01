import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  createNewDocumentFileName,
  DOCUMENT_TYPES,
  getDocumentTypeById,
  getDocumentTypeByFileName,
  normalizeDocumentFileName,
  WORKFLOW_KEYWORDS
} from './documentRegistry';
import { initializePascalishLanguage } from './PascalishEditor';
import StartupFsmMonitor from './StartupFsmMonitor';

const LOCAL_STORAGE_KEY = 'pulse-develop-workspace-documents';
const workflowState = {
  initialized: false,
  completionDisposable: null
};

function initializeWorkflowLanguage(monaco) {
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
        }
      ];

      return {
        suggestions: [...snippetItems, ...keywordItems]
      };
    }
  });
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

export default function DevelopWorkspace({ createRequest, onCreateRequestHandled, themeStyle = 'standard' }) {
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
  const [showStartupMonitor, setShowStartupMonitor] = useState(true);

  const selectedFile = useMemo(() => {
    return files.find((item) => item.name === selectedFileName) || null;
  }, [files, selectedFileName]);

  const openFiles = useMemo(() => {
    return openFileNames
      .map((name) => files.find((item) => item.name === name))
      .filter(Boolean);
  }, [files, openFileNames]);

  const editorDescriptor = useMemo(() => {
    return getEditorDescriptor(selectedFileName);
  }, [selectedFileName]);

  function openDocument(fileName) {
    setSelectedFileName(fileName);
    setOpenFileNames((current) => (current.includes(fileName) ? current : [...current, fileName]));
  }

  function closeDocument(fileName) {
    setOpenFileNames((current) => current.filter((item) => item !== fileName));
    setSelectedFileName((currentSelected) => {
      if (currentSelected !== fileName) return currentSelected;
      const remaining = openFileNames.filter((item) => item !== fileName);
      return remaining[0] || files.find((item) => item.name !== fileName)?.name || '';
    });
  }

  function syncOpenSelection(nextFiles, preferredFileName = '') {
    if (preferredFileName && nextFiles.some((item) => item.name === preferredFileName)) {
      setSelectedFileName(preferredFileName);
      setOpenFileNames((current) => (current.includes(preferredFileName) ? current : [...current, preferredFileName]));
      return;
    }

    if (nextFiles.length === 0) {
      setSelectedFileName('');
      setOpenFileNames([]);
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
  }

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
        syncOpenSelection(nextFiles, selectedFileName);
      } catch (fetchError) {
        if (!cancelled) {
          const localDocuments = loadLocalDocuments();
          setFiles(localDocuments);
          setStorageMode('local');
          setStatus('Backend unavailable, using local workspace mode.');
          setError(fetchError.message);
          syncOpenSelection(localDocuments, selectedFileName);
        }
      }
    }

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [selectedFileName]);

  useEffect(() => {
    if (!selectedFileName) {
      setContent('');
      setRenameValue('');
      return;
    }

    if (storageMode === 'local') {
      const localDocument = files.find((item) => item.name === selectedFileName);
      if (localDocument) {
        setContent(String(localDocument.content ?? ''));
        setRenameValue(selectedFileName);
        setDirty(false);
        setError('');
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
  }, [selectedFileName]);

  useEffect(() => {
    if (!createRequest?.typeId) return;

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
  }, [createRequest]);

  async function refreshFiles(preferredFileName = '') {
    if (storageMode === 'local') {
      const nextFiles = loadLocalDocuments();
      setFiles(nextFiles);
      syncOpenSelection(nextFiles, preferredFileName);
      return;
    }

    const response = await fetch('/api/develop/files');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Failed to load files (${response.status}).`);
    }

    const nextFiles = Array.isArray(payload.files) ? payload.files : [];
    setFiles(nextFiles);
    syncOpenSelection(nextFiles, preferredFileName);
  }

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

  const fileTypeLabel = selectedFile ? selectedFile.documentTypeLabel : 'Document';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 12, height: '100%' }}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 14, padding: 12, background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.58))' }}>
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
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.12, opacity: 0.62 }}>Develop / {fileTypeLabel}</div>
            <h2 style={{ margin: '2px 0 0' }}>{selectedFileName || 'No file selected'}</h2>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => setShowStartupMonitor((current) => !current)}>
              {showStartupMonitor ? 'Hide Startup FSM' : 'Show Startup FSM'}
            </button>
            <button onClick={saveDocument} disabled={!selectedFileName || !dirty || busy}>Save</button>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Rename file"
              style={{ minWidth: 220 }}
              disabled={!selectedFileName || busy}
            />
            <button onClick={() => renameDocument().catch((renameError) => setError(renameError.message))} disabled={!selectedFileName || busy}>Rename</button>
            <button onClick={() => deleteDocument().catch((deleteError) => setError(deleteError.message))} disabled={!selectedFileName || busy}>Delete</button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca' }}>
            {error}
          </div>
        )}

        {showStartupMonitor && <StartupFsmMonitor themeStyle={themeStyle} />}

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

        <div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 14, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={editorDescriptor.monacoLanguage}
            theme={editorDescriptor.id === 'workflow' ? 'workflowWorkbench' : 'pascalishWorkbench'}
            value={content}
            beforeMount={(monaco) => {
              initializePascalishLanguage(monaco, { current: [] });
              initializeWorkflowLanguage(monaco);
            }}
            onChange={(value) => {
              setContent(value || '');
              setDirty(true);
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              wordWrap: 'on',
              smoothScrolling: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              formatOnType: false,
              automaticLayout: true,
              padding: { top: 14, bottom: 14 },
              scrollBeyondLastLine: false
            }}
          />
        </div>
      </section>
    </div>
  );
}
